// Ratings & Reviews regression tests (Phase 1, POST-MVP).
//
// Run in NON-DATABASE mode: they exercise the in-memory controllers (and the
// derived-in-memory reviews store) without touching MySQL, following the pattern
// of security.test.js. The tests build a delivered order via the in-memory
// requirement -> offer -> order flow, then exercise every rating rule.

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRequirement } = require('../src/controllers/requirementsController');
const { createOffer } = require('../src/controllers/offersController');
const { createOrder, orders } = require('../src/controllers/ordersController');
const {
  createReview,
  getOrderReviews,
  getUserReviews,
  updateReview,
  deleteReview,
} = require('../src/controllers/reviewsController');

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

// Build a delivered order between a buyer and a seller using the in-memory flow,
// then flip the stored order to Delivered (simulating that it has progressed).
function createDeliveredOrder(buyerId, sellerId) {
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

  const storedOrder = orders.find((o) => o.id === orderId);
  assert.equal(storedOrder.userId, buyerId);
  assert.equal(storedOrder.sellerUserId, sellerId);
  storedOrder.status = 'Delivered';

  return { orderId, buyerId, sellerId };
}

test('valid buyer rating: buyer rates the seller', () => {
  const { orderId, buyerId, sellerId } = createDeliveredOrder('buyer-1', 'seller-1');
  const res = makeRes();
  createReview(
    { user: { id: buyerId }, params: { orderId }, body: { rating: 5, comment: 'Great seller' } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 201);
  const review = bodyOf(res).data;
  assert.equal(review.orderId, orderId);
  assert.equal(review.reviewerId, buyerId);
  assert.equal(review.reviewedUserId, sellerId);
  assert.equal(review.rating, 5);
});

test('valid seller rating: seller rates the buyer', () => {
  const { orderId, buyerId, sellerId } = createDeliveredOrder('buyer-2', 'seller-2');
  const res = makeRes();
  createReview(
    { user: { id: sellerId }, params: { orderId }, body: { rating: 4, comment: 'Reliable buyer' } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 201);
  const review = bodyOf(res).data;
  assert.equal(review.reviewerId, sellerId);
  assert.equal(review.reviewedUserId, buyerId);
});

test('invalid rating (out of range / non-integer) is rejected', () => {
  const { orderId, buyerId } = createDeliveredOrder('buyer-3', 'seller-3');
  for (const rating of [0, 6, 2.5, -1, 'abc', null]) {
    const res = makeRes();
    createReview(
      { user: { id: buyerId }, params: { orderId }, body: { rating, comment: 'x' } },
      res,
      () => assert.fail('unexpected error')
    );
    assert.equal(statusOf(res), 400, `rating ${rating} should be rejected`);
  }
});

test('rating without review text is valid (comment is optional)', () => {
  const { orderId, buyerId } = createDeliveredOrder('buyer-4', 'seller-4');
  const res = makeRes();
  createReview(
    { user: { id: buyerId }, params: { orderId }, body: { rating: 3 } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.comment, null);
});

test('rating a non-party (unrelated user) is rejected', () => {
  const { orderId } = createDeliveredOrder('buyer-5', 'seller-5');
  const res = makeRes();
  createReview(
    { user: { id: 'intruder-x' }, params: { orderId }, body: { rating: 5, comment: 'hi' } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 400);
});

test('rating a nonexistent order returns 404', () => {
  const res = makeRes();
  createReview(
    { user: { id: 'buyer-6' }, params: { orderId: 'missing-order' }, body: { rating: 5 } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 404);
});

test('rating an order that is not Delivered is rejected', () => {
  const { orderId, buyerId } = createDeliveredOrder('buyer-7', 'seller-7');
  const stored = orders.find((o) => o.id === orderId);
  stored.status = 'In Transit';
  const res = makeRes();
  createReview(
    { user: { id: buyerId }, params: { orderId }, body: { rating: 5 } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 400);
});

test('a review never rates the reviewer (self-rating is impossible)', () => {
  const { orderId, buyerId, sellerId } = createDeliveredOrder('buyer-8', 'seller-8');
  const rb = makeRes();
  createReview({ user: { id: buyerId }, params: { orderId }, body: { rating: 5 } }, rb, () => assert.fail('unexpected error'));
  assert.notEqual(bodyOf(rb).data.reviewedUserId, buyerId);
  assert.equal(bodyOf(rb).data.reviewedUserId, sellerId);

  const rs = makeRes();
  createReview({ user: { id: sellerId }, params: { orderId }, body: { rating: 5 } }, rs, () => assert.fail('unexpected error'));
  assert.notEqual(bodyOf(rs).data.reviewedUserId, sellerId);
  assert.equal(bodyOf(rs).data.reviewedUserId, buyerId);
});

test('duplicate rating by the same reviewer on the same order is rejected', () => {
  const { orderId, buyerId } = createDeliveredOrder('buyer-9', 'seller-9');
  const first = makeRes();
  createReview({ user: { id: buyerId }, params: { orderId }, body: { rating: 5 } }, first, () => assert.fail('unexpected error'));
  assert.equal(statusOf(first), 201);
  const second = makeRes();
  createReview({ user: { id: buyerId }, params: { orderId }, body: { rating: 4 } }, second, () => assert.fail('unexpected error'));
  assert.equal(statusOf(second), 409);
});

test('a non-owner cannot modify or delete another user\'s review', () => {
  const { orderId, buyerId, sellerId } = createDeliveredOrder('buyer-10', 'seller-10');
  const create = makeRes();
  createReview({ user: { id: buyerId }, params: { orderId }, body: { rating: 5, comment: 'original' } }, create, () => assert.fail('unexpected error'));
  const reviewId = bodyOf(create).data.id;

  // The seller (counterparty, non-author) cannot edit.
  const put = makeRes();
  updateReview({ user: { id: sellerId }, params: { orderId, reviewId }, body: { rating: 1, comment: 'hacked' } }, put, () => assert.fail('unexpected error'));
  assert.equal(statusOf(put), 403);

  // The seller cannot delete.
  const del = makeRes();
  deleteReview({ user: { id: sellerId }, params: { orderId, reviewId } }, del, () => assert.fail('unexpected error'));
  assert.equal(statusOf(del), 403);

  // Author can edit.
  const authorPut = makeRes();
  updateReview({ user: { id: buyerId }, params: { orderId, reviewId }, body: { rating: 4, comment: 'edited' } }, authorPut, () => assert.fail('unexpected error'));
  assert.equal(statusOf(authorPut), 200);
  assert.equal(bodyOf(authorPut).data.rating, 4);
  assert.equal(bodyOf(authorPut).data.comment, 'edited');
});

test('author can delete their own review', () => {
  const { orderId, buyerId } = createDeliveredOrder('buyer-11', 'seller-11');
  const create = makeRes();
  createReview({ user: { id: buyerId }, params: { orderId }, body: { rating: 5 } }, create, () => assert.fail('unexpected error'));
  const reviewId = bodyOf(create).data.id;
  const del = makeRes();
  deleteReview({ user: { id: buyerId }, params: { orderId, reviewId } }, del, () => assert.fail('unexpected error'));
  assert.equal(statusOf(del), 200);
});

test('average rating calculation over received reviews', () => {
  // buyer-12 rates seller-12; seller-12 also rates buyer-12 on a second order =>
  // seller-12 receives 1 review from buyer-12, buyer-12 receives 1 from seller-12.
  const { orderId: o1, buyerId: bBuyer, sellerId: bSeller } = createDeliveredOrder('buyer-12', 'seller-12');
  const r1 = makeRes();
  createReview({ user: { id: bBuyer }, params: { orderId: o1 }, body: { rating: 5 } }, r1, () => assert.fail('unexpected error'));
  assert.equal(statusOf(r1), 201);

  // Give seller-12 a second received review (from buyer-13) so average is (5+3)/2 = 4.
  const { orderId: o2 } = createDeliveredOrder('buyer-13', 'seller-12');
  const r2 = makeRes();
  createReview({ user: { id: 'buyer-13' }, params: { orderId: o2 }, body: { rating: 3 } }, r2, () => assert.fail('unexpected error'));
  assert.equal(statusOf(r2), 201);

  const res = makeRes();
  getUserReviews({ user: { id: 'viewer' }, params: { userId: bSeller } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  const data = bodyOf(res).data;
  assert.equal(data.count, 2);
  assert.equal(data.average, 4);
  assert.equal(data.reviews.length, 2);
});

test('getOrderReviews is restricted to the order parties', () => {
  const { orderId, buyerId } = createDeliveredOrder('buyer-14', 'seller-14');
  const create = makeRes();
  createReview({ user: { id: buyerId }, params: { orderId }, body: { rating: 5 } }, create, () => assert.fail('unexpected error'));
  assert.equal(statusOf(create), 201);

  // Party can view.
  const ok = makeRes();
  getOrderReviews({ user: { id: buyerId }, params: { orderId } }, ok, () => assert.fail('unexpected error'));
  assert.equal(statusOf(ok), 200);
  assert.equal(bodyOf(ok).data.length, 1);

  // Non-party is forbidden.
  const forbidden = makeRes();
  getOrderReviews({ user: { id: 'outsider' }, params: { orderId } }, forbidden, () => assert.fail('unexpected error'));
  assert.equal(statusOf(forbidden), 403);
});
