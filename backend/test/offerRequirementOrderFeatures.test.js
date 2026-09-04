// Tests for the Phase 8 feature pass (in-memory store).
//
//   1. Product-based offers: POST /api/offers now also accepts a productId (with
//      no requirementId), letting a buyer make an offer on a listed product.
//   2. Delete requirement: DELETE /api/requirements/:id is owner-only, requires an
//      active requirement with no linked orders.
//   3. Cancel order: POST /api/orders/:id/cancel is buyer-only and only allowed
//      while the order is in the earliest "Order Confirmed" stage.

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRequirement, deleteRequirement } = require('../src/controllers/requirementsController');
const { createOffer, getOffersByProduct } = require('../src/controllers/offersController');
const { createOrder, cancelOrder } = require('../src/controllers/ordersController');

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

function makeRequirementOwner(buyerId) {
  const res = makeRes();
  createRequirement(
    { user: { id: buyerId }, body: { cropName: 'Tomato', quantity: 10, unit: 'Quintal', maxPricePerQuintal: 900, location: 'Nashik' } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 201);
  return bodyOf(res).data;
}

function makeOrderFor(requirement) {
  const offerRes = makeRes();
  createOffer(
    { user: { id: 'feature-seller', name: 'Feature Seller' }, body: { requirementId: requirement.id, quantity: 10, unit: 'Quintal', offeredPricePerQuintal: 800 } },
    offerRes,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(offerRes), 201);
  const orderRes = makeRes();
  createOrder(
    { user: { id: requirement.userId }, body: { requirementId: requirement.id, offerId: bodyOf(offerRes).data.id } },
    orderRes,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(orderRes), 201);
  return bodyOf(orderRes).data;
}

// ---- Product-based offers ----

test('createOffer accepts a product-based offer (productId, no requirementId)', () => {
  const res = makeRes();
  createOffer(
    { user: { id: 'feature-buyer', name: 'Feature Buyer' }, body: { productId: 'p1', quantity: 5, unit: 'Quintal', offeredPricePerQuintal: 1000 } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 201);
  const offer = bodyOf(res).data;
  assert.equal(offer.productId, 'p1');
  assert.equal(offer.requirementId, null);
  assert.equal(offer.sellerName, 'Feature Buyer');
});

test('a product-based offer is returned by getOffersByProduct', () => {
  const res = makeRes();
  createOffer(
    { user: { id: 'feature-buyer2', name: 'Feature Buyer Two' }, body: { productId: 'p1', quantity: 5, unit: 'Quintal', offeredPricePerQuintal: 1100 } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 201);

  const listRes = makeRes();
  getOffersByProduct({ user: { id: 'feature-buyer2' }, params: { productId: 'p1' } }, listRes, () => assert.fail('unexpected error'));
  assert.equal(statusOf(listRes), 200);
  const offers = bodyOf(listRes).data;
  assert.ok(offers.some((o) => o.productId === 'p1' && o.requirementId === null));
});

test('createOffer returns 400 when neither requirementId nor productId is provided', () => {
  const res = makeRes();
  createOffer(
    { user: { id: 'feature-buyer3', name: 'Feature Buyer Three' }, body: { quantity: 5, unit: 'Quintal', offeredPricePerQuintal: 1000 } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 400);
});

test('createOffer returns 404 for a nonexistent product', () => {
  const res = makeRes();
  createOffer(
    { user: { id: 'feature-buyer4', name: 'Feature Buyer Four' }, body: { productId: 'product-does-not-exist', quantity: 5, unit: 'Quintal', offeredPricePerQuintal: 1000 } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 404);
});

// ---- Delete requirement ----

test('deleteRequirement removes an active requirement with no orders', () => {
  const requirement = makeRequirementOwner('feature-del-owner');
  const res = makeRes();
  deleteRequirement({ user: { id: 'feature-del-owner' }, params: { id: requirement.id } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
});

test('deleteRequirement returns 404 for a requirement the user does not own', () => {
  const requirement = makeRequirementOwner('feature-del-owner2');
  const res = makeRes();
  deleteRequirement({ user: { id: 'feature-del-intruder' }, params: { id: requirement.id } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 404);
});

test('deleteRequirement rejects a requirement that has linked orders', () => {
  const requirement = makeRequirementOwner('feature-del-withorder');
  makeOrderFor(requirement);

  const res = makeRes();
  deleteRequirement({ user: { id: 'feature-del-withorder' }, params: { id: requirement.id } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 400);
});

// ---- Cancel order ----

test('cancelOrder lets the buyer cancel an Order Confirmed order', () => {
  const requirement = makeRequirementOwner('feature-co-buyer');
  const order = makeOrderFor(requirement);

  const res = makeRes();
  cancelOrder({ user: { id: 'feature-co-buyer' }, params: { id: order.id } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.status, 'Cancelled');
});

test('cancelOrder returns 404 for a user who is not the buyer', () => {
  const requirement = makeRequirementOwner('feature-co-buyer2');
  const order = makeOrderFor(requirement);

  const res = makeRes();
  cancelOrder({ user: { id: 'feature-co-stranger' }, params: { id: order.id } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 404);
});

test('cancelOrder rejects a second cancellation once the order is cancelled', () => {
  const requirement = makeRequirementOwner('feature-co-buyer3');
  const order = makeOrderFor(requirement);
  const buyerId = 'feature-co-buyer3';

  const first = makeRes();
  cancelOrder({ user: { id: buyerId }, params: { id: order.id } }, first, () => assert.fail('unexpected error'));
  assert.equal(statusOf(first), 200);

  const second = makeRes();
  cancelOrder({ user: { id: buyerId }, params: { id: order.id } }, second, () => assert.fail('unexpected error'));
  assert.equal(statusOf(second), 400);
});
