// Order-level Logistics regression tests (Phase 3, POST-MVP).
//
// Run in NON-DATABASE mode: they exercise the in-memory logistics controller and
// the order flow, following the pattern of reviews.test.js and security.test.js.
// The tests build a real order (buyer + seller) via the in-memory requirement ->
// offer -> order flow, then exercise every logistics rule.

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRequirement } = require('../src/controllers/requirementsController');
const { createOffer } = require('../src/controllers/offersController');
const { createOrder, orders } = require('../src/controllers/ordersController');
const { createReview } = require('../src/controllers/reviewsController');
const {
  initLogistics,
  getLogistics,
  updateLogisticsStatus,
  logistics,
} = require('../src/controllers/logisticsController');

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

// Build a real order between a buyer and a seller using the in-memory flow.
// Returns { orderId, buyerId, sellerId }.
function createOrderBetween(buyerId, sellerId) {
  const reqRes = makeRes();
  createRequirement(
    { user: { id: buyerId }, body: { cropName: 'Tomato', quantity: 10, unit: 'Quintal', maxPricePerQuintal: 900, location: 'Nashik' } },
    reqRes,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(reqRes), 201);
  const requirementId = bodyOf(reqRes).data.id;

  const offRes = makeRes();
  createOffer(
    { user: { id: sellerId, name: 'Seller' }, body: { requirementId, quantity: 10, unit: 'Quintal', offeredPricePerQuintal: 850, transportCostPerQuintal: 20, otherCostsPerQuintal: 5 } },
    offRes,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(offRes), 201);
  const offerId = bodyOf(offRes).data.id;

  const ordRes = makeRes();
  createOrder({ user: { id: buyerId }, body: { requirementId, offerId } }, ordRes, () => assert.fail('unexpected error'));
  assert.equal(statusOf(ordRes), 201);
  const orderId = bodyOf(ordRes).data.id;

  return { orderId, buyerId, sellerId };
}

test('buyer initializes a logistics record (starts pending)', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-01', 'l-seller-01');
  const res = makeRes();
  initLogistics({ user: { id: buyerId }, body: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 201);
  const record = bodyOf(res).data;
  assert.equal(record.orderId, orderId);
  assert.equal(record.status, 'pending');
  assert.equal(record.updatedBy, buyerId);
});

test('duplicate logistics record for the same order is rejected with 409', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-02', 'l-seller-02');
  const first = makeRes();
  initLogistics({ user: { id: buyerId }, body: { orderId } }, first, () => assert.fail('unexpected error'));
  assert.equal(statusOf(first), 201);
  const second = makeRes();
  initLogistics({ user: { id: buyerId }, body: { orderId } }, second, () => assert.fail('unexpected error'));
  assert.equal(statusOf(second), 409);
});

test('init requires an orderId (400)', () => {
  const res = makeRes();
  initLogistics({ user: { id: 'l-buyer-03' }, body: {} }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 400);
});

test('buyer (party) can view the logistics record', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-04', 'l-seller-04');
  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  const res = makeRes();
  getLogistics({ user: { id: buyerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.orderId, orderId);
});

test('seller (other party) can view the logistics record', () => {
  const { orderId, buyerId, sellerId } = createOrderBetween('l-buyer-05', 'l-seller-05');
  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  const res = makeRes();
  getLogistics({ user: { id: sellerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.status, 'pending');
});

test('a non-party cannot view the logistics record (404)', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-06', 'l-seller-06');
  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  const res = makeRes();
  getLogistics({ user: { id: 'l-intruder-06' }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 404);
});

test('a non-buyer (seller) cannot initialize logistics (404)', () => {
  const { orderId, sellerId } = createOrderBetween('l-buyer-07', 'l-seller-07');
  const res = makeRes();
  initLogistics({ user: { id: sellerId }, body: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 404);
});

test('a non-buyer (third party) cannot change logistics status (404)', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-08', 'l-seller-08');
  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  const res = makeRes();
  updateLogisticsStatus({ user: { id: 'l-intruder-08' }, params: { orderId }, body: { status: 'pickup' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 404);
});

test('valid state transitions advance pending -> pickup -> in_transit -> delivered', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-09', 'l-seller-09');
  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));

  for (const status of ['pickup', 'in_transit', 'delivered']) {
    const res = makeRes();
    updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status } }, res, () => assert.fail('unexpected error'));
    assert.equal(statusOf(res), 200, `transition to ${status} should succeed`);
    assert.equal(bodyOf(res).data.status, status);
  }
});

test('invalid state transition is rejected (pending -> delivered is 400)', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-10', 'l-seller-10');
  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  const res = makeRes();
  updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status: 'delivered' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 400);
});

test('delivered is a terminal state (no further transitions)', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-11', 'l-seller-11');
  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  // Advance validly to the delivered state first.
  for (const to of ['pickup', 'in_transit', 'delivered']) {
    const step = makeRes();
    updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status: to } }, step, () => assert.fail('unexpected error'));
    assert.equal(statusOf(step), 200, `transition to ${to} should succeed`);
  }
  assert.equal(logistics.find((l) => l.orderId === orderId).status, 'delivered');
  // After delivered, any further change is rejected.
  const res = makeRes();
  updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status: 'cancelled' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 400);
});

test('cancellation is allowed from a non-terminal state', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-12', 'l-seller-12');
  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  const res = makeRes();
  updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status: 'cancelled' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.status, 'cancelled');
});

test('cancelled is terminal (cannot resume)', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-13', 'l-seller-13');
  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status: 'cancelled' } }, makeRes(), () => assert.fail('unexpected error'));
  const res = makeRes();
  updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status: 'pickup' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 400);
});

test('an invalid status value is rejected with 400', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-14', 'l-seller-14');
  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  const res = makeRes();
  updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status: 'teleported' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 400);
});

test('nonexistent order: init and get return 404', () => {
  const initRes = makeRes();
  initLogistics({ user: { id: 'l-buyer-15' }, body: { orderId: 'missing-order' } }, initRes, () => assert.fail('unexpected error'));
  assert.equal(statusOf(initRes), 404);

  const getRes = makeRes();
  getLogistics({ user: { id: 'l-buyer-15' }, params: { orderId: 'missing-order' } }, getRes, () => assert.fail('unexpected error'));
  assert.equal(statusOf(getRes), 404);
});

test('a party with no logistics record gets data:null (200)', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-16', 'l-seller-16');
  const res = makeRes();
  getLogistics({ user: { id: buyerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data, null);
});

test('updating logistics on an order with no record returns 404', () => {
  const { orderId, buyerId } = createOrderBetween('l-buyer-17', 'l-seller-17');
  const res = makeRes();
  updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status: 'pickup' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 404);
});

// --- Order lifecycle fix regression tests ----
// When logistics reaches `delivered`, the order must itself become `Delivered` so
// the existing review/rating flow becomes reachable without any manual DB change.
test('order starts at Order Confirmed and only becomes Delivered once logistics is delivered', () => {
  const { orderId, buyerId } = createOrderBetween('l-life-01', 'l-life-seller-01');
  const stored = orders.find((o) => o.id === orderId);
  assert.equal(stored.status, 'Order Confirmed');

  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));

  // Intermediate non-terminal logistics states do NOT mark the order Delivered.
  for (const status of ['pickup', 'in_transit']) {
    const step = makeRes();
    updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status } }, step, () => assert.fail('unexpected error'));
    assert.equal(statusOf(step), 200);
    assert.notEqual(orders.find((o) => o.id === orderId).status, 'Delivered', `order must not be Delivered at logistics=${status}`);
  }

  // The final valid transition to delivered marks the order Delivered.
  const final = makeRes();
  updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status: 'delivered' } }, final, () => assert.fail('unexpected error'));
  assert.equal(statusOf(final), 200);
  assert.equal(orders.find((o) => o.id === orderId).status, 'Delivered');
});

test('an invalid logistics transition does not mark the order Delivered', () => {
  const { orderId, buyerId } = createOrderBetween('l-life-02', 'l-life-seller-02');
  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  // pending -> delivered is invalid and rejected.
  const res = makeRes();
  updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status: 'delivered' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 400);
  assert.notEqual(orders.find((o) => o.id === orderId).status, 'Delivered');
});

test('a cancelled order stays terminal and is not marked Delivered', () => {
  const { orderId, buyerId } = createOrderBetween('l-life-03', 'l-life-seller-03');
  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  const cancel = makeRes();
  updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status: 'cancelled' } }, cancel, () => assert.fail('unexpected error'));
  assert.equal(statusOf(cancel), 200);
  assert.equal(logistics.find((l) => l.orderId === orderId).status, 'cancelled');
  assert.notEqual(orders.find((o) => o.id === orderId).status, 'Delivered');
  // Cancelled is terminal: cannot resume to delivered later.
  const resume = makeRes();
  updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status: 'delivered' } }, resume, () => assert.fail('unexpected error'));
  assert.equal(statusOf(resume), 400);
  assert.notEqual(orders.find((o) => o.id === orderId).status, 'Delivered');
});

test('integration: after logistics reaches delivered the existing review flow is eligible without manual DB change', () => {
  const { orderId, buyerId, sellerId } = createOrderBetween('l-life-04', 'l-life-seller-04');
  // Order starts non-eligible.
  assert.equal(orders.find((o) => o.id === orderId).status, 'Order Confirmed');

  initLogistics({ user: { id: buyerId }, body: { orderId } }, makeRes(), () => assert.fail('unexpected error'));
  for (const status of ['pickup', 'in_transit', 'delivered']) {
    const step = makeRes();
    updateLogisticsStatus({ user: { id: buyerId }, params: { orderId }, body: { status } }, step, () => assert.fail('unexpected error'));
    assert.equal(statusOf(step), 200, `transition to ${status} should succeed`);
  }

  // The order is now Delivered purely through the logistics flow.
  assert.equal(orders.find((o) => o.id === orderId).status, 'Delivered');

  // A party can now create a review (previously this required a manual DB write).
  const res = makeRes();
  createReview({ user: { id: buyerId }, params: { orderId }, body: { rating: 5, comment: 'Reached via logistics' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.orderId, orderId);
  assert.equal(bodyOf(res).data.reviewedUserId, sellerId);
});
