// Payments regression tests (Phase 5, POST-MVP).
//
// Run in NON-DATABASE mode: they exercise the in-memory order store and the
// payment controller state machine without touching MySQL. The payable amount is
// always derived server-side from the stored order (never from the client).
// Unauthenticated access is enforced by the shared verifyToken middleware, which
// is asserted here against the payment routes.

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

const { verifyToken } = require('../src/middlewares/auth');
const { signToken } = require('../src/utils/jwt');
const {
  getPayment,
  initiatePayment,
  confirmPayment,
  cancelPayment,
} = require('../src/controllers/paymentController');
const { createRequirement } = require('../src/controllers/requirementsController');
const { createOffer } = require('../src/controllers/offersController');
const { createOrder, cancelOrder, orders } = require('../src/controllers/ordersController');
const paymentGateway = require('../src/services/paymentGateway');

function makeRes() {
  const calls = [];
  return {
    calls,
    status(code) { calls.push(['status', code]); return this; },
    json(body) { calls.push(['json', body]); return this; },
  };
}
function statusOf(res) {
  for (let i = 0; i < res.calls.length; i += 1) if (res.calls[i][0] === 'status') return res.calls[i][1];
  return 200;
}
function bodyOf(res) {
  for (let i = 0; i < res.calls.length; i += 1) if (res.calls[i][0] === 'json') return res.calls[i][1];
  return null;
}

// Create an in-memory order for a buyer/seller pair and return its id + server
// derived totalAmount (price 850 + tx 20 + other 5 = 875 * 10 + 50 = 8800).
function createOrderFor(buyerId, sellerId) {
  const reqRes = makeRes();
  createRequirement(
    { user: { id: buyerId }, body: { cropName: 'Tomato', quantity: 10, unit: 'Quintal', maxPricePerQuintal: 900, location: 'Nashik' } },
    reqRes,
    () => assert.fail('unexpected error')
  );
  const requirementId = bodyOf(reqRes).data.id;

  const offRes = makeRes();
  createOffer(
    { user: { id: sellerId, name: 'Seller' }, body: { requirementId, quantity: 10, unit: 'Quintal', offeredPricePerQuintal: 850, transportCostPerQuintal: 20, otherCostsPerQuintal: 5 } },
    offRes,
    () => assert.fail('unexpected error')
  );
  const offerId = bodyOf(offRes).data.id;

  const ordRes = makeRes();
  createOrder({ user: { id: buyerId }, body: { requirementId, offerId } }, ordRes, () => assert.fail('unexpected error'));
  assert.equal(statusOf(ordRes), 201);
  const order = bodyOf(ordRes).data;
  return { orderId: order.id, buyerId, sellerId, amount: Number(order.totalAmount) };
}

function storedOrder(orderId) {
  return orders.find((o) => o.id === orderId);
}

// ---- Unauthenticated access ----

test('unauth: payment routes reject a missing token with 401', () => {
  const res = makeRes();
  verifyToken({ headers: {} }, res, () => assert.fail('should not reach next'));
  assert.equal(statusOf(res), 401);
});

test('unauth: payment routes reject an invalid token with 401', () => {
  const res = makeRes();
  verifyToken({ headers: { authorization: 'Bearer not.valid.token' } }, res, () => assert.fail('should not reach next'));
  assert.equal(statusOf(res), 401);
});

// ---- Authorization ----

test('buyer can view, initiate and confirm payment for their own order', () => {
  const { orderId, buyerId, amount } = createOrderFor('pay-buyer-1', 'pay-seller-1');
  const get = makeRes();
  getPayment({ user: { id: buyerId }, params: { orderId } }, get, () => assert.fail('unexpected error'));
  assert.equal(statusOf(get), 200);
  assert.equal(bodyOf(get).data.state, 'pending');
  assert.equal(bodyOf(get).data.amount, amount);

  const init = makeRes();
  initiatePayment({ user: { id: buyerId }, params: { orderId } }, init, () => assert.fail('unexpected error'));
  assert.equal(statusOf(init), 200);
  assert.equal(bodyOf(init).data.amount, amount);

  const confirm = makeRes();
  confirmPayment({ user: { id: buyerId }, params: { orderId } }, confirm, () => assert.fail('unexpected error'));
  assert.equal(statusOf(confirm), 200);
  assert.equal(bodyOf(confirm).data.state, 'paid');
  assert.equal(storedOrder(orderId).paymentState, 'paid');
});

test('a non-buyer cannot view payment status (404, no leak)', () => {
  const { orderId } = createOrderFor('pay-buyer-2', 'pay-seller-2');
  const res = makeRes();
  getPayment({ user: { id: 'intruder-x' }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 404);
});

test('the seller (party) can view payment status', () => {
  const { orderId, sellerId } = createOrderFor('pay-buyer-3', 'pay-seller-3');
  const res = makeRes();
  getPayment({ user: { id: sellerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  assert.ok(bodyOf(res).data.amount > 0);
});

test('a non-buyer cannot initiate payment (404)', () => {
  const { orderId, sellerId } = createOrderFor('pay-buyer-4', 'pay-seller-4');
  const res = makeRes();
  initiatePayment({ user: { id: sellerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 404);
});

test('a non-buyer cannot confirm payment (404)', () => {
  const { orderId, sellerId } = createOrderFor('pay-buyer-5', 'pay-seller-5');
  const res = makeRes();
  confirmPayment({ user: { id: sellerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 404);
});

test('a non-buyer cannot cancel payment (404)', () => {
  const { orderId, sellerId } = createOrderFor('pay-buyer-6', 'pay-seller-6');
  const res = makeRes();
  cancelPayment({ user: { id: sellerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 404);
});

test('payment on a nonexistent order returns 404', () => {
  const res = makeRes();
  initiatePayment({ user: { id: 'x' }, params: { orderId: 'missing' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 404);
});

// ---- Amount is always server-derived ----

test('a client-supplied amount is ignored; amount comes from the order total', () => {
  const { orderId, buyerId, amount } = createOrderFor('pay-buyer-7', 'pay-seller-7');
  // Malicious client tries to pay 1 unit currency.
  const confirm = makeRes();
  confirmPayment({ user: { id: buyerId }, params: { orderId }, body: { amount: 1 } }, confirm, () => assert.fail('unexpected error'));
  assert.equal(statusOf(confirm), 200);
  // The recorded/returned amount is still the server-derived order total.
  assert.equal(bodyOf(confirm).data.amount, amount);
  assert.notEqual(bodyOf(confirm).data.amount, 1);
});

// ---- Duplicate payment ----

test('duplicate payment cannot create a second payment (409 on second confirm)', () => {
  const { orderId, buyerId } = createOrderFor('pay-buyer-8', 'pay-seller-8');
  const first = makeRes();
  confirmPayment({ user: { id: buyerId }, params: { orderId } }, first, () => assert.fail('unexpected error'));
  assert.equal(statusOf(first), 200);
  assert.equal(bodyOf(first).data.state, 'paid');
  const firstRef = bodyOf(first).data.paymentRef;

  const second = makeRes();
  confirmPayment({ user: { id: buyerId }, params: { orderId } }, second, () => assert.fail('unexpected error'));
  assert.equal(statusOf(second), 409);

  // No second transaction/ref is created.
  assert.equal(storedOrder(orderId).paymentState, 'paid');
  assert.equal(storedOrder(orderId).paymentRef, firstRef);
});

test('initiate on an already-paid order is rejected (409)', () => {
  const { orderId, buyerId } = createOrderFor('pay-buyer-9', 'pay-seller-9');
  confirmPayment({ user: { id: buyerId }, params: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  const res = makeRes();
  initiatePayment({ user: { id: buyerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 409);
});

// ---- Invalid state transitions ----

test('confirming payment on a cancelled order is an invalid transition (400)', () => {
  const { orderId, buyerId } = createOrderFor('pay-buyer-10', 'pay-seller-10');
  const cancel = makeRes();
  cancelPayment({ user: { id: buyerId }, params: { orderId } }, cancel, () => assert.fail('unexpected error'));
  assert.equal(statusOf(cancel), 200);
  assert.equal(storedOrder(orderId).paymentState, 'cancelled');

  const confirm = makeRes();
  confirmPayment({ user: { id: buyerId }, params: { orderId } }, confirm, () => assert.fail('unexpected error'));
  assert.equal(statusOf(confirm), 400);
  assert.notEqual(storedOrder(orderId).paymentState, 'paid');
});

test('cancelling payment on a paid order is an invalid transition (400)', () => {
  const { orderId, buyerId } = createOrderFor('pay-buyer-11', 'pay-seller-11');
  confirmPayment({ user: { id: buyerId }, params: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  const cancel = makeRes();
  cancelPayment({ user: { id: buyerId }, params: { orderId } }, cancel, () => assert.fail('unexpected error'));
  assert.equal(statusOf(cancel), 400);
  assert.equal(storedOrder(orderId).paymentState, 'paid');
});

// ---- Failed payment must not become paid ----

test('a failed payment does not become paid', () => {
  const originalCharge = paymentGateway.charge;
  try {
    const { orderId, buyerId } = createOrderFor('pay-buyer-12', 'pay-seller-12');
    paymentGateway.charge = () => ({
      success: false,
      ref: null,
      gateway: 'mock',
      devOnly: true,
      error: 'Card declined',
    });
    const res = makeRes();
    confirmPayment({ user: { id: buyerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
    assert.equal(statusOf(res), 402);
    assert.equal(bodyOf(res).data.state, 'failed');
    assert.equal(storedOrder(orderId).paymentState, 'failed');
    assert.notEqual(storedOrder(orderId).paymentState, 'paid');
  } finally {
    paymentGateway.charge = originalCharge;
  }
});

test('a failed payment can be retried and succeed', () => {
  const originalCharge = paymentGateway.charge;
  try {
    const { orderId, buyerId } = createOrderFor('pay-buyer-13', 'pay-seller-13');
    paymentGateway.charge = () => ({ success: false, ref: null, gateway: 'mock', devOnly: true, error: 'Down' });
    const fail = makeRes();
    confirmPayment({ user: { id: buyerId }, params: { orderId } }, fail, () => assert.fail('unexpected error'));
    assert.equal(statusOf(fail), 402);
    assert.equal(storedOrder(orderId).paymentState, 'failed');

    // Restore success and retry: failed -> paid is a valid transition.
    paymentGateway.charge = originalCharge;
    const ok = makeRes();
    confirmPayment({ user: { id: buyerId }, params: { orderId } }, ok, () => assert.fail('unexpected error'));
    assert.equal(statusOf(ok), 200);
    assert.equal(storedOrder(orderId).paymentState, 'paid');
  } finally {
    paymentGateway.charge = originalCharge;
  }
});

// ---- No unrelated/private order data exposed ----

test('payment response exposes only sanitized non-private fields', () => {
  const { orderId, buyerId } = createOrderFor('pay-buyer-14', 'pay-seller-14');
  const res = makeRes();
  getPayment({ user: { id: buyerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  const data = bodyOf(res).data;
  const allowed = ['orderId', 'productName', 'amount', 'paymentMethod', 'state', 'paymentRef', 'paidAt', 'devOnly'];
  for (const key of Object.keys(data)) {
    assert.ok(allowed.includes(key), `unexpected field leaked: ${key}`);
  }
  assert.ok(!('deliveryAddress' in data));
  assert.ok(!('sellerName' in data));
  assert.ok(!('userId' in data));
  assert.ok(!('sellerUserId' in data));
  assert.ok(!('quantity' in data));
  assert.ok(!('transportCost' in data));
  assert.ok(!('timeline' in data));
  assert.equal(data.devOnly, true); // clearly labelled development-only gateway
});

test('cancel a pending payment transitions to cancelled', () => {
  const { orderId, buyerId } = createOrderFor('pay-buyer-15', 'pay-seller-15');
  const res = makeRes();
  cancelPayment({ user: { id: buyerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  assert.equal(storedOrder(orderId).paymentState, 'cancelled');
});

// ---- Order cancellation vs payment state (no refund facility) ----

test('a paid order cannot be cancelled; status and payment are unchanged (400)', () => {
  const { orderId, buyerId } = createOrderFor('pay-buyer-16', 'pay-seller-16');
  const pay = makeRes();
  confirmPayment({ user: { id: buyerId }, params: { orderId } }, pay, () => assert.fail('unexpected error'));
  assert.equal(statusOf(pay), 200);
  assert.equal(storedOrder(orderId).paymentState, 'paid');
  const beforeStatus = storedOrder(orderId).status;

  const cancel = makeRes();
  cancelOrder({ user: { id: buyerId }, params: { id: orderId } }, cancel, () => assert.fail('unexpected error'));
  assert.equal(statusOf(cancel), 400);
  assert.match(bodyOf(cancel).message, /paid/i, 'error clearly names the paid state');
  assert.equal(storedOrder(orderId).status, beforeStatus, 'order status unchanged');
  assert.equal(storedOrder(orderId).paymentState, 'paid', 'payment state unchanged');
});

test('an unpaid cancellable order can still be cancelled', () => {
  const { orderId, buyerId } = createOrderFor('pay-buyer-18', 'pay-seller-18');
  const cancel = makeRes();
  cancelOrder({ user: { id: buyerId }, params: { id: orderId } }, cancel, () => assert.fail('unexpected error'));
  assert.equal(statusOf(cancel), 200);
  assert.equal(storedOrder(orderId).status, 'Cancelled');
});

test('confirmPayment rejects a cancelled order even though payment is still pending (400)', () => {
  const { orderId, buyerId } = createOrderFor('pay-buyer-17', 'pay-seller-17');
  const cancel = makeRes();
  cancelOrder({ user: { id: buyerId }, params: { id: orderId } }, cancel, () => assert.fail('unexpected error'));
  assert.equal(statusOf(cancel), 200);
  assert.equal(storedOrder(orderId).status, 'Cancelled');

  const confirm = makeRes();
  confirmPayment({ user: { id: buyerId }, params: { orderId } }, confirm, () => assert.fail('unexpected error'));
  assert.equal(statusOf(confirm), 400);
  assert.match(bodyOf(confirm).message, /cancelled/i, 'error clearly names the cancelled order');
  assert.notEqual(storedOrder(orderId).paymentState, 'paid', 'a cancelled order never becomes paid');
});
