// Minimal integration/hardening tests for Phase 4D Step 2 and Phase 4F Step 3.
//
// These tests run in NON-DATABASE mode: they exercise the in-memory controllers
// and the auth middleware without touching MySQL, so the canonical seed data in
// the database is left untouched. Because the backend's auth routes (register /
// login) are DB-backed, real-token auth-to-route flows are not covered here; the
// middleware is tested in isolation against a signed token, and the workflow
// security rules (offer linking, order ownership/linkage) are verified against
// the in-memory stores.
//
// Run: node --test test/security.test.js

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

const { verifyToken } = require('../src/middlewares/auth');
const { signToken } = require('../src/utils/jwt');
const {
  createRequirement,
  getAllRequirements,
  getRequirementById,
  getAvailableRequirements,
} = require('../src/controllers/requirementsController');
const {
  createOrder,
  getAllOrders,
  getOrderById,
} = require('../src/controllers/ordersController');
const {
  getOffersByRequirement,
  getOfferById,
  createOffer,
} = require('../src/controllers/offersController');

function makeRes() {
  const calls = [];
  return {
    calls,
    status(code) {
      calls.push(['status', code]);
      return this;
    },
    json(body) {
      calls.push(['json', body]);
      return this;
    },
  };
}

function statusOf(res) {
  for (let i = 0; i < res.calls.length; i += 1) {
    if (res.calls[i][0] === 'status') return res.calls[i][1];
  }
  return 200;
}

function bodyOf(res) {
  for (let i = 0; i < res.calls.length; i += 1) {
    if (res.calls[i][0] === 'json') return res.calls[i][1];
  }
  return null;
}

// Helper: create a requirement owned by a buyer and an offer on it made by a
// seller, returning { requirementId, offerId, offer }.
function createLinkedRequirementAndOffer(buyerId, sellerId, sellerName) {
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
    {
      user: { id: sellerId, name: sellerName },
      body: {
        requirementId,
        productId: 'p1',
        quantity: 10,
        unit: 'Quintal',
        offeredPricePerQuintal: 850,
        transportCostPerQuintal: 20,
        otherCostsPerQuintal: 5,
        distanceKm: 10,
        notes: 'fresh produce',
      },
    },
    offRes,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(offRes), 201);
  return { requirementId, offerId: bodyOf(offRes).data.id, offer: bodyOf(offRes).data };
}

test('verifyToken: rejects missing token with 401', () => {
  const res = makeRes();
  verifyToken({ headers: {} }, res, () => assert.fail('should not reach next'));
  assert.equal(statusOf(res), 401);
});

test('verifyToken: rejects malformed header with 401', () => {
  const res = makeRes();
  verifyToken({ headers: { authorization: 'Basic abc' } }, res, () =>
    assert.fail('should not reach next')
  );
  assert.equal(statusOf(res), 401);
});

test('verifyToken: rejects invalid token with 401', () => {
  const res = makeRes();
  verifyToken({ headers: { authorization: 'Bearer not.a.real.token' } }, res, () =>
    assert.fail('should not reach next')
  );
  assert.equal(statusOf(res), 401);
});

test('verifyToken: sets req.user from a valid token', () => {
  const token = signToken({ id: 'user-a', phone: '9000000001' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  verifyToken(req, makeRes(), () => {});
  assert.equal(req.user.id, 'user-a');
  assert.equal(req.user.phone, '9000000001');
});

test('createRequirement attaches the authenticated userId', () => {
  const res = makeRes();
  createRequirement(
    {
      user: { id: 'user-a' },
      body: { cropName: 'Pumpkin', quantity: 10, unit: 'Quintal', maxPricePerQuintal: 900, location: 'Nashik' },
    },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.userId, 'user-a');
});

test('getAllRequirements returns only the caller-owned requirements', () => {
  const created = makeRes();
  createRequirement(
    {
      user: { id: 'user-a' },
      body: { cropName: 'Tomato', quantity: 5, unit: 'Quintal', maxPricePerQuintal: 800, location: 'Pune' },
    },
    created,
    () => assert.fail('unexpected error')
  );
  const createdId = bodyOf(created).data.id;

  const resA = makeRes();
  getAllRequirements({ user: { id: 'user-a' } }, resA, () => assert.fail('unexpected error'));
  const mine = bodyOf(resA).data;
  assert.equal(statusOf(resA), 200);
  assert.equal(mine.some((r) => r.id === createdId), true);

  const resB = makeRes();
  getAllRequirements({ user: { id: 'user-b' } }, resB, () => assert.fail('unexpected error'));
  const other = bodyOf(resB).data;
  assert.equal(other.some((r) => r.id === createdId), false);
});

test('getRequirementById returns 404 for another user\'s requirement', () => {
  const created = makeRes();
  createRequirement(
    {
      user: { id: 'user-a' },
      body: { cropName: 'Potato', quantity: 12, unit: 'Quintal', maxPricePerQuintal: 700, location: 'Satara' },
    },
    created,
    () => assert.fail('unexpected error')
  );
  const createdId = bodyOf(created).data.id;

  const resB = makeRes();
  getRequirementById({ user: { id: 'user-b' }, params: { id: createdId } }, resB, () =>
    assert.fail('unexpected error')
  );
  assert.equal(statusOf(resB), 404);

  const resA = makeRes();
  getRequirementById({ user: { id: 'user-a' }, params: { id: createdId } }, resA, () =>
    assert.fail('unexpected error')
  );
  assert.equal(statusOf(resA), 200);
});

// ---- Phase 4F Step 3: seller offer linking ----

test('seller creates an offer linked to a requirement; seller identity comes from the token, not the body', () => {
  const { requirementId, offer } = createLinkedRequirementAndOffer('buyer-a', 'seller-b', 'Seller B');

  // Offer is linked to the requirement and owned by the seller's NOTE: the offer
  // stores the token-derived seller name (never a body-supplied identity).
  assert.equal(offer.requirementId, requirementId);
  assert.equal(offer.sellerName, 'Seller B');
  assert.equal(offer.notes, 'fresh produce');
});

test('createOffer rejects a nonexistent requirement with 404', () => {
  const res = makeRes();
  createOffer(
    {
      user: { id: 'seller-b', name: 'Seller B' },
      body: { requirementId: 'r-does-not-exist', productId: 'p1', quantity: 5, unit: 'Quintal', offeredPricePerQuintal: 800 },
    },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 404);
});

test('createOffer rejects creating an offer on your own requirement with 400', () => {
  const reqRes = makeRes();
  createRequirement(
    { user: { id: 'owner-a' }, body: { cropName: 'Onion', quantity: 6, unit: 'Quintal', maxPricePerQuintal: 900, location: 'Pune' } },
    reqRes,
    () => assert.fail('unexpected error')
  );
  const requirementId = bodyOf(reqRes).data.id;

  const res = makeRes();
  createOffer(
    {
      user: { id: 'owner-a', name: 'Owner A' },
      body: { requirementId, productId: 'p1', quantity: 6, unit: 'Quintal', offeredPricePerQuintal: 850 },
    },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 400);
});

test('getAvailableRequirements does not include the caller\'s own requirement', () => {
  const created = makeRes();
  createRequirement(
    { user: { id: 'buyer-a' }, body: { cropName: 'Wheat', quantity: 9, unit: 'Quintal', maxPricePerQuintal: 2000, location: 'Indore' } },
    created,
    () => assert.fail('unexpected error')
  );
  const mineId = bodyOf(created).data.id;

  const resSelf = makeRes();
  getAvailableRequirements({ user: { id: 'buyer-a' } }, resSelf, () => assert.fail('unexpected error'));
  assert.equal(bodyOf(resSelf).data.some((r) => r.id === mineId), false);

  const resOther = makeRes();
  getAvailableRequirements({ user: { id: 'seller-b' } }, resOther, () => assert.fail('unexpected error'));
  assert.equal(bodyOf(resOther).data.some((r) => r.id === mineId), true);
});

// ---- Phase 4F Step 3: order creation security ----

test('createOrder places a valid order for the owning buyer with server-derived fields', () => {
  const { requirementId, offer, offerId } = createLinkedRequirementAndOffer('buyer-a', 'seller-b', 'Seller B');
  const res = makeRes();
  createOrder(
    { user: { id: 'buyer-a' }, body: { requirementId, offerId } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 201);
  const order = bodyOf(res).data;
  assert.equal(order.userId, 'buyer-a');
  assert.equal(order.requirementId, requirementId);
  assert.equal(order.offerId, offerId);
  // Fields are derived server-side from the offer/requirement, not the client.
  assert.equal(order.productName, 'Tomato');
  assert.equal(order.sellerName, 'Seller B');
  assert.equal(order.pricePerQuintal, offer.offeredPricePerQuintal);
  // Server-side authoritative total: (850 + 20 + 5) * 10 + 50 = 8800.
  assert.equal(order.totalAmount, 8800);
});

test('createOrder rejects a requirement owned by another user with 404', () => {
  const { requirementId, offerId } = createLinkedRequirementAndOffer('buyer-a', 'seller-b', 'Seller B');
  const res = makeRes();
  createOrder(
    { user: { id: 'intruder-x' }, body: { requirementId, offerId } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 404);
});

test('createOrder rejects an offer that belongs to a different requirement with 400', () => {
  const { requirementId } = createLinkedRequirementAndOffer('buyer-a', 'seller-b', 'Seller B');
  const other = createLinkedRequirementAndOffer('buyer-c', 'seller-d', 'Seller D');
  const res = makeRes();
  createOrder(
    { user: { id: 'buyer-a' }, body: { requirementId, offerId: other.offerId } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 400);
});

test('createOrder rejects a missing offer with 404', () => {
  const { requirementId } = createLinkedRequirementAndOffer('buyer-a', 'seller-b', 'Seller B');
  const res = makeRes();
  createOrder(
    { user: { id: 'buyer-a' }, body: { requirementId, offerId: 'o-missing' } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 404);
});

test('createOrder requires requirementId and offerId with 400', () => {
  const res = makeRes();
  createOrder({ user: { id: 'buyer-a' }, body: {} }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 400);
});

test('getOrderById returns 404 for another user\'s order', () => {
  const { requirementId, offerId } = createLinkedRequirementAndOffer('user-a', 'seller-b', 'Seller B');
  const created = makeRes();
  createOrder(
    { user: { id: 'user-a' }, body: { requirementId, offerId } },
    created,
    () => assert.fail('unexpected error')
  );
  const createdId = bodyOf(created).data.id;

  const resB = makeRes();
  getOrderById({ user: { id: 'user-b' }, params: { id: createdId } }, resB, () =>
    assert.fail('unexpected error')
  );
  assert.equal(statusOf(resB), 404);

  const resA = makeRes();
  getOrderById({ user: { id: 'user-a' }, params: { id: createdId } }, resA, () =>
    assert.fail('unexpected error')
  );
  assert.equal(statusOf(resA), 200);
});

test('getAllOrders returns only the caller-owned orders', () => {
  const { requirementId, offerId } = createLinkedRequirementAndOffer('user-a', 'seller-b', 'Seller B');
  const created = makeRes();
  createOrder(
    { user: { id: 'user-a' }, body: { requirementId, offerId } },
    created,
    () => assert.fail('unexpected error')
  );
  const createdId = bodyOf(created).data.id;

  const resA = makeRes();
  getAllOrders({ user: { id: 'user-a' } }, resA, () => assert.fail('unexpected error'));
  assert.equal(bodyOf(resA).data.some((o) => o.id === createdId), true);

  const resB = makeRes();
  getAllOrders({ user: { id: 'user-b' } }, resB, () => assert.fail('unexpected error'));
  assert.equal(bodyOf(resB).data.some((o) => o.id === createdId), false);
});

test('getOrderById is accessible to both buyer and seller parties, but not a stranger', () => {
  const { requirementId, offerId } = createLinkedRequirementAndOffer('user-a', 'seller-b', 'Seller B');
  const created = makeRes();
  createOrder(
    { user: { id: 'user-a' }, body: { requirementId, offerId } },
    created,
    () => assert.fail('unexpected error')
  );
  const createdId = bodyOf(created).data.id;

  // The seller, who is a legitimate party and receives a "new order" notification,
  // must be able to open the order from that notification.
  const resSeller = makeRes();
  getOrderById({ user: { id: 'seller-b' }, params: { id: createdId } }, resSeller, () =>
    assert.fail('unexpected error')
  );
  assert.equal(statusOf(resSeller), 200);
  assert.equal(bodyOf(resSeller).data.id, createdId);

  // A stranger who is neither buyer nor seller still gets 404.
  const resStranger = makeRes();
  getOrderById({ user: { id: 'user-b' }, params: { id: createdId } }, resStranger, () =>
    assert.fail('unexpected error')
  );
  assert.equal(statusOf(resStranger), 404);
});

test('getOffersByRequirement returns 404 for another user\'s requirement', () => {
  const created = makeRes();
  createRequirement(
    {
      user: { id: 'user-a' },
      body: { cropName: 'Chili', quantity: 8, unit: 'Quintal', maxPricePerQuintal: 1500, location: 'Guntur' },
    },
    created,
    () => assert.fail('unexpected error')
  );
  const createdId = bodyOf(created).data.id;

  const resB = makeRes();
  getOffersByRequirement({ user: { id: 'user-b' }, params: { id: createdId } }, resB, () =>
    assert.fail('unexpected error')
  );
  assert.equal(statusOf(resB), 404);

  const resA = makeRes();
  getOffersByRequirement({ user: { id: 'user-a' }, params: { id: createdId } }, resA, () =>
    assert.fail('unexpected error')
  );
  assert.equal(statusOf(resA), 200);
  assert.equal(Array.isArray(bodyOf(resA).data), true);
});

// ---- GET /offers/:id access control ----
// A requirement-only offer (no productId, matching the app's MakeOffer flow) is
// a private bid in a buyer-seller negotiation and must only be readable by the
// buyer who owns the linked requirement. A product-linked offer is intentionally
// public marketplace data and remains readable by any authenticated caller.

// Helper: a buyer posts a requirement and a seller replies with an offer that is
// linked ONLY to the requirement (no productId), exactly as the app does.
function createPrivateRequirementOffer(buyerId, sellerId, sellerName) {
  const reqRes = makeRes();
  createRequirement(
    { user: { id: buyerId }, body: { cropName: 'Soybean', quantity: 15, unit: 'Quintal', maxPricePerQuintal: 4200, location: 'Amritsar' } },
    reqRes,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(reqRes), 201);
  const requirementId = bodyOf(reqRes).data.id;

  const offRes = makeRes();
  createOffer(
    {
      user: { id: sellerId, name: sellerName },
      body: { requirementId, quantity: 15, unit: 'Quintal', offeredPricePerQuintal: 4000, notes: 'private quote' },
    },
    offRes,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(offRes), 201);
  const offer = bodyOf(offRes).data;
  assert.equal(!offer.productId, true);
  return { requirementId, offerId: offer.id };
}

test('getOfferById returns 404 for a requirement-only offer when the caller is not the owning buyer', () => {
  const { offerId } = createPrivateRequirementOffer('buyer-a', 'seller-b', 'Seller B');

  const resIntruder = makeRes();
  getOfferById(
    { user: { id: 'intruder-x' }, params: { id: offerId } },
    resIntruder,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(resIntruder), 404);
  assert.equal(bodyOf(resIntruder).success, false);
});

test('getOfferById returns the requirement-only offer to the owning buyer', () => {
  const { offerId } = createPrivateRequirementOffer('buyer-a', 'seller-b', 'Seller B');

  const resOwner = makeRes();
  getOfferById(
    { user: { id: 'buyer-a' }, params: { id: offerId } },
    resOwner,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(resOwner), 200);
  assert.equal(bodyOf(resOwner).data.id, offerId);
});

test('getOfferById returns a product-linked offer to any authenticated caller', () => {
  const res = makeRes();
  getOfferById(
    { user: { id: 'some-user' }, params: { id: 'o1' } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.id, 'o1');
});
