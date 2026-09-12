const { USE_DATABASE, PAYMENT_GATEWAY } = require('../config/config');
const orderService = USE_DATABASE ? require('../services/orderService') : null;
const paymentService = USE_DATABASE ? require('../services/paymentService') : null;
const paymentGateway = require('../services/paymentGateway');

// Payment state handling (Phase 5). Payment state belongs to the existing order.
// States: pending -> paid / failed / cancelled. `failed` may retry (back to
// pending / paid / cancelled). `paid` and `cancelled` are terminal.
//
// The payable amount is ALWAYS derived server-side from the stored order's
// totalAmount. Buyer/seller identity is taken from the authenticated request and
// the stored order (never from the client). No client-supplied amount or
// identity is trusted.
const PAYMENT_STATES = ['pending', 'paid', 'failed', 'cancelled'];
const ALLOWED_TRANSITIONS = {
  pending: ['paid', 'failed', 'cancelled'],
  failed: ['pending', 'paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

// Mirror of ordersController.ORDER_STATUS_CANCELLED; delivery-money rules: a
// cancelled order is no longer payable under any payment state.
const ORDER_STATUS_CANCELLED = 'Cancelled';

function stateOf(order) {
  return order && order.paymentState ? order.paymentState : 'pending';
}

function canTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

function isBuyer(order, userId) {
  return !!order && order.userId === userId;
}

function isParty(order, userId) {
  return !!order && (order.userId === userId || order.sellerUserId === userId);
}

// Only ever expose non-private payment fields for an order.
function sanitizePayment(order) {
  return {
    orderId: order.id,
    productName: order.productName,
    amount: Number(order.totalAmount),
    paymentMethod: order.paymentMethod || 'Bank Transfer',
    state: stateOf(order),
    paymentRef: order.paymentRef || null,
    paidAt: order.paidAt ? String(order.paidAt).slice(0, 10) : null,
    devOnly: PAYMENT_GATEWAY === 'mock', // clearly label the dev-only simulator
  };
}

function findOrderSync(orderId) {
  const { orders } = require('./ordersController');
  return orders.find((o) => o.id === orderId) || null;
}

// GET /:orderId/payment — view payment status. Either order party may view.
async function getPayment(req, res, next) {
  const orderId = req.params.orderId;
  let order;
  if (USE_DATABASE) {
    try {
      order = await orderService.findOrderById(orderId);
    } catch (error) {
      return next(error);
    }
  } else {
    order = findOrderSync(orderId);
  }
  if (!order || !isParty(order, req.user.id)) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  return res.status(200).json({ success: true, data: sanitizePayment(order) });
}

// POST /:orderId/payment/initiate — buyer begins a payment for their own order.
// The amount is derived server-side from the order; the order must not already
// be paid.
async function initiatePayment(req, res, next) {
  const orderId = req.params.orderId;
  let order;
  if (USE_DATABASE) {
    try {
      order = await orderService.findOrderById(orderId);
    } catch (error) {
      return next(error);
    }
  } else {
    order = findOrderSync(orderId);
  }
  if (!order || !isBuyer(order, req.user.id)) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (stateOf(order) === 'paid') {
    return res.status(409).json({
      success: false,
      message: 'Order is already paid',
    });
  }
  return res.status(200).json({ success: true, data: sanitizePayment(order) });
}

// POST /:orderId/payment/confirm — runs the gateway charge (dev-only mock by
// default) and records the resulting state. Only a successful gateway result
// transitions the order to `paid`; a failure leaves it non-paid.
async function confirmPayment(req, res, next) {
  const orderId = req.params.orderId;
  let order;
  if (USE_DATABASE) {
    try {
      order = await orderService.findOrderById(orderId);
    } catch (error) {
      return next(error);
    }
  } else {
    order = findOrderSync(orderId);
  }
  if (!order || !isBuyer(order, req.user.id)) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const current = stateOf(order);
  if (current === 'paid') {
    // Idempotency: never process/duplicate a payment on an already-paid order.
    return res.status(409).json({
      success: false,
      message: 'Order is already paid',
    });
  }
  // A cancelled order must never be payable, regardless of its payment state.
  if (order.status === ORDER_STATUS_CANCELLED) {
    return res.status(400).json({
      success: false,
      message: 'A cancelled order cannot be paid',
    });
  }
  if (!canTransition(current, 'paid')) {
    return res.status(400).json({
      success: false,
      message: `Cannot pay an order in ${current} state`,
    });
  }

  // Server-derived payable amount; the client never supplies it.
  const amount = Number(order.totalAmount);
  const result = paymentGateway.charge({ amount, orderId });

  if (!result.success) {
    if (USE_DATABASE) {
      try {
        // setPaymentState returns the persisted (updated) order; use it so the
        // response reflects the recorded state rather than the stale pre-write
        // copy fetched above.
        const updated = await paymentService.setPaymentState(orderId, 'failed');
        return res.status(402).json({
          success: false,
          message: result.error || 'Payment failed',
          data: sanitizePayment(updated),
        });
      } catch (error) {
        return next(error);
      }
    } else {
      order.paymentState = 'failed';
    }
    return res.status(402).json({
      success: false,
      message: result.error || 'Payment failed',
      data: sanitizePayment(order),
    });
  }

  if (USE_DATABASE) {
    try {
      // recordPayment returns the persisted (updated) order with paymentState
      // 'paid'; use it for the response to avoid reporting the stale state.
      const updated = await paymentService.recordPayment(orderId, {
        paymentState: 'paid',
        paymentRef: result.ref,
        paidAt: new Date(),
      });
      return res.status(200).json({ success: true, data: sanitizePayment(updated) });
    } catch (error) {
      return next(error);
    }
  } else {
    order.paymentState = 'paid';
    order.paymentRef = result.ref;
    order.paidAt = new Date().toISOString();
  }
  return res.status(200).json({ success: true, data: sanitizePayment(order) });
}

// POST /:orderId/payment/cancel — buyer cancels a pending (or retried) payment.
// Terminal states are rejected.
async function cancelPayment(req, res, next) {
  const orderId = req.params.orderId;
  let order;
  if (USE_DATABASE) {
    try {
      order = await orderService.findOrderById(orderId);
    } catch (error) {
      return next(error);
    }
  } else {
    order = findOrderSync(orderId);
  }
  if (!order || !isBuyer(order, req.user.id)) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const current = stateOf(order);
  if (!canTransition(current, 'cancelled')) {
    return res.status(400).json({
      success: false,
      message: `Cannot cancel payment from ${current} state`,
    });
  }

  if (USE_DATABASE) {
    try {
      // setPaymentState returns the persisted (updated) order; use it so the
      // response reflects 'cancelled' rather than the stale pre-write state.
      const updated = await paymentService.setPaymentState(orderId, 'cancelled');
      return res.status(200).json({ success: true, data: sanitizePayment(updated) });
    } catch (error) {
      return next(error);
    }
  } else {
    order.paymentState = 'cancelled';
  }
  return res.status(200).json({ success: true, data: sanitizePayment(order) });
}

module.exports = {
  getPayment,
  initiatePayment,
  confirmPayment,
  cancelPayment,
  PAYMENT_STATES,
  ALLOWED_TRANSITIONS,
};
