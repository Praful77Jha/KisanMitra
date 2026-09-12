const { USE_DATABASE } = require('../config/config');
const orderService = USE_DATABASE ? require('../services/orderService') : null;
const offerService = USE_DATABASE ? require('../services/offerService') : null;
const requirementService = USE_DATABASE ? require('../services/requirementService') : null;
const { notifyUser } = require('./notificationsController');

const ORDER_STAGES = [
  'Order Confirmed',
  'Preparing',
  'Dispatched',
  'In Transit',
  'Out for Delivery',
  'Delivered',
];

// Terminal status applied when a buyer cancels an order; it is separate from the
// forward ORDER_STAGES progression and not part of the logistics lifecycle.
const ORDER_STATUS_CANCELLED = 'Cancelled';

// An order may only be cancelled by the buyer who placed it while it is still in
// the earliest stage (Order Confirmed), before any fulfilment has begun.
const CANCELLABLE_ORDER_STATUS = ORDER_STAGES[0];

const orders = [
  {
    id: 'ORD-2026-0194',
    orderDate: '2026-08-22',
    productName: 'Red Onion',
    quantity: 80,
    unit: 'Quintal',
    pricePerQuintal: 1750,
    transportCost: 250,
    otherCharges: 120,
    platformFee: 45,
    totalAmount: 140415,
    deliveryAddress: 'Lasalgaon APMC, Nashik, Maharashtra',
    paymentMethod: 'Bank Transfer',
    sellerName: 'Lasalgaon APMC',
    status: ORDER_STAGES[5],
    timeline: [
      { step: 'Order Confirmed', date: '2026-08-22', done: true },
      { step: 'Preparing', date: '2026-08-23', done: true },
      { step: 'Dispatched', date: '2026-08-24', done: true },
      { step: 'In Transit', date: '2026-08-25', done: true },
      { step: 'Out for Delivery', date: '2026-08-26', done: true },
      { step: 'Delivered', date: '2026-08-27', done: true },
    ],
  },
  {
    id: 'ORD-2026-0172',
    orderDate: '2026-08-15',
    productName: 'Wheat (Sharbati)',
    quantity: 150,
    unit: 'Quintal',
    pricePerQuintal: 2150,
    transportCost: 3200,
    otherCharges: 500,
    platformFee: 60,
    totalAmount: 326160,
    deliveryAddress: 'Indore, Madhya Pradesh',
    paymentMethod: 'Bank Transfer',
    sellerName: 'MP Grain Exports',
    status: ORDER_STAGES[3],
    timeline: [
      { step: 'Order Confirmed', date: '2026-08-15', done: true },
      { step: 'Preparing', date: '2026-08-16', done: true },
      { step: 'Dispatched', date: '2026-08-17', done: true },
      { step: 'In Transit', date: '2026-08-19', done: true },
      { step: 'Out for Delivery', date: null, done: false },
      { step: 'Delivered', date: null, done: false },
    ],
  },
];

let idCounter = 250;

const PLATFORM_FEE = 50;

function buildOrderTimeline(orderDate, currentStageIndex) {
  return ORDER_STAGES.map((step, index) => ({
    step,
    date: index <= currentStageIndex ? orderDate : null,
    done: index <= currentStageIndex,
  }));
}

// Both the buyer (userId) and the seller (sellerUserId) are legitimate parties
// to an order. Sellers receive a "New order received" notification whose refId
// is the order, and must be able to open the order from that notification.
function isOrderParty(order, userId) {
  if (!order || !userId) return false;
  return order.userId === userId || order.sellerUserId === userId;
}

async function getAllOrders(req, res, next) {
  if (USE_DATABASE) {
    try {
      const data = await orderService.findAllOrders(req.user.id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
  const mine = orders.filter(
    (o) => o.userId === req.user.id || o.sellerUserId === req.user.id
  );
  res.status(200).json({
    success: true,
    data: mine,
  });
}

async function getOrderById(req, res, next) {
  if (USE_DATABASE) {
    try {
      const order = await orderService.findOrderById(req.params.id);
      if (!order || !isOrderParty(order, req.user.id)) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }
      return res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }
  const order = orders.find((o) => o.id === req.params.id);
  if (!order || !isOrderParty(order, req.user.id)) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }
  res.status(200).json({
    success: true,
    data: order,
  });
}

async function createOrder(req, res, next) {
  const { requirementId, offerId, paymentMethod } = req.body;

  if (!requirementId || !offerId) {
    return res.status(400).json({
      success: false,
      message: 'requirementId and offerId are required',
    });
  }

  if (USE_DATABASE) {
    try {
      // The buyer must own the requirement they are ordering against.
      const requirement = await requirementService.findRequirementById(requirementId);
      if (!requirement || requirement.userId !== req.user.id) {
        return res.status(404).json({
          success: false,
          message: 'Requirement not found',
        });
      }

      // The selected offer must be real and must belong to that requirement.
      // Order fields are derived server-side from the canonical offer/requirement,
      // so a client can never inject its own sellerName, pricing, or totals.
      const offer = await offerService.findOfferById(offerId);
      if (!offer) {
        return res.status(404).json({
          success: false,
          message: 'Offer not found',
        });
      }
      if (offer.requirementId !== requirementId) {
        return res.status(400).json({
          success: false,
          message: 'This offer does not belong to the selected requirement',
        });
      }

      const order = await orderService.createOrder({
        userId: req.user.id,
        cropName: requirement.cropName,
        quantity: requirement.quantity,
        unit: offer.unit,
        offeredPricePerQuintal: offer.offeredPricePerQuintal,
        transportCostPerQuintal: offer.transportCostPerQuintal,
        otherCostsPerQuintal: offer.otherCostsPerQuintal,
        deliveryAddress: requirement.location,
        paymentMethod: paymentMethod || 'Bank Transfer',
        sellerName: offer.sellerName,
        sellerUserId: offer.sellerUserId || null,
        requirementId,
        offerId,
      });
      // Notify the seller that a new order has been placed for their offer.
      // Best-effort and intentionally not awaited.
      if (order.sellerUserId && order.sellerUserId !== req.user.id) {
        notifyUser({
          userId: order.sellerUserId,
          type: 'order',
          title: 'New order received',
          body: `A new order has been placed for ${order.productName}.`,
          refType: 'order',
          refId: order.id,
        }).catch(() => {});
      }
      return res.status(201).json({ success: true, data: order });
    } catch (error) {
      return next(error);
    }
  }

  // In-memory (non-database) path mirrors the same ownership/linkage rules.
  const { requirements } = require('./requirementsController');
  const { offers } = require('./offersController');
  const requirement = requirements.find((r) => r.id === requirementId);
  if (!requirement || requirement.userId !== req.user.id) {
    return res.status(404).json({
      success: false,
      message: 'Requirement not found',
    });
  }
  const offer = offers.find((o) => o.id === offerId);
  if (!offer) {
    return res.status(404).json({
      success: false,
      message: 'Offer not found',
    });
  }
  if (offer.requirementId !== requirementId) {
    return res.status(400).json({
      success: false,
      message: 'This offer does not belong to the selected requirement',
    });
  }

  const qty = Number(requirement.quantity);
  const pricePerQuintal = Number(offer.offeredPricePerQuintal);
  const transportPerQuintal = Number(offer.transportCostPerQuintal || 0);
  const otherPerQuintal = Number(offer.otherCostsPerQuintal || 0);

  const deliveredCostPerQuintal = pricePerQuintal + transportPerQuintal + otherPerQuintal;
  const deliveredTotal = deliveredCostPerQuintal * qty;
  const totalAmount = deliveredTotal + PLATFORM_FEE;

  const orderDate = new Date().toISOString().slice(0, 10);

  const newOrder = {
    id: `ORD-2026-${String(idCounter++).padStart(4, '0')}`,
    userId: req.user.id,
    orderDate,
    productName: requirement.cropName.trim(),
    quantity: qty,
    unit: offer.unit,
    pricePerQuintal,
    transportCost: transportPerQuintal * qty,
    otherCharges: otherPerQuintal * qty,
    platformFee: PLATFORM_FEE,
    totalAmount,
    deliveryAddress: requirement.location.trim(),
    paymentMethod: paymentMethod || 'Bank Transfer',
    sellerName: offer.sellerName.trim(),
    sellerUserId: offer.sellerUserId || null,
    status: ORDER_STAGES[0],
    timeline: buildOrderTimeline(orderDate, 0),
    requirementId,
    offerId,
  };

  orders.unshift(newOrder);

  // Notify the seller that a new order has been placed for their offer.
  // Best-effort and intentionally not awaited.
  if (newOrder.sellerUserId && newOrder.sellerUserId !== req.user.id) {
    notifyUser({
      userId: newOrder.sellerUserId,
      type: 'order',
      title: 'New order received',
      body: `A new order has been placed for ${newOrder.productName}.`,
      refType: 'order',
      refId: newOrder.id,
    }).catch(() => {});
  }

  res.status(201).json({
    success: true,
    data: newOrder,
  });
}

async function cancelOrder(req, res, next) {
  const orderId = req.params.id;

  // Only the buyer who placed the order may cancel it, and only while it is in
  // the earliest stage (Order Confirmed) before fulfilment has begun.
  if (USE_DATABASE) {
    try {
      const order = await orderService.findOrderById(orderId);
      if (!order || order.userId !== req.user.id) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }
      // No refund facility exists: a paid order cannot be cancelled.
      if (order.paymentState === 'paid') {
        return res.status(400).json({
          success: false,
          message: 'This order has already been paid and cannot be cancelled',
        });
      }
      if (order.status !== CANCELLABLE_ORDER_STATUS) {
        return res.status(400).json({
          success: false,
          message: `An order can only be cancelled while it is ${CANCELLABLE_ORDER_STATUS}`,
        });
      }
      const updated = await orderService.updateOrderStatus(orderId, ORDER_STATUS_CANCELLED);
      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  const order = orders.find((o) => o.id === orderId);
  if (!order || order.userId !== req.user.id) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }
  // No refund facility exists: a paid order cannot be cancelled.
  if (order.paymentState === 'paid') {
    return res.status(400).json({
      success: false,
      message: 'This order has already been paid and cannot be cancelled',
    });
  }
  if (order.status !== CANCELLABLE_ORDER_STATUS) {
    return res.status(400).json({
      success: false,
      message: `An order can only be cancelled while it is ${CANCELLABLE_ORDER_STATUS}`,
    });
  }
  order.status = ORDER_STATUS_CANCELLED;
  res.status(200).json({
    success: true,
    data: order,
  });
}

module.exports = { getAllOrders, getOrderById, createOrder, cancelOrder, orders };
