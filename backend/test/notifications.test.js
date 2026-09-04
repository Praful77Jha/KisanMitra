// Notifications regression tests (Phase 2, POST-MVP).
//
// Run in NON-DATABASE mode: they exercise the in-memory notification store and
// the offer/order/review hooks that generate notifications at event points,
// following the pattern of reviews.test.js and security.test.js.

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRequirement } = require('../src/controllers/requirementsController');
const { createOffer } = require('../src/controllers/offersController');
const { createOrder, orders } = require('../src/controllers/ordersController');
const { createReview } = require('../src/controllers/reviewsController');
const {
  getMyNotifications,
  getUnreadCount,
  markRead,
  notifyUser,
} = require('../src/controllers/notificationsController');

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

  return { orderId, requirementId, offerId, buyerId, sellerId };
}

test('notifyUser creates a notification for the target user', async () => {
  const notification = await notifyUser({
    userId: 'notif-user-1',
    type: 'offer',
    title: 'New offer received',
    body: 'Someone made an offer.',
    refType: 'requirement',
    refId: 'req-1',
  });
  assert.ok(notification);
  assert.equal(notification.userId, 'notif-user-1');
  assert.equal(notification.type, 'offer');
  assert.equal(notification.read, false);
});

test('notifyUser with no target user is a safe no-op (never throws)', async () => {
  const result = await notifyUser({
    userId: null,
    type: 'offer',
    title: 'x',
    body: 'y',
  });
  assert.equal(result, null);
});

test('getMyNotifications returns only the requesting user\'s notifications', async () => {
  await notifyUser({ userId: 'notif-list-a', type: 'offer', title: 'for-a', body: 'x', refType: 'requirement', refId: 'r1' });
  await notifyUser({ userId: 'notif-list-b', type: 'order', title: 'for-b', body: 'y', refType: 'order', refId: 'o1' });
  await notifyUser({ userId: 'notif-list-a', type: 'review', title: 'for-a-2', body: 'z', refType: 'review', refId: 'v1' });

  const res = makeRes();
  getMyNotifications({ user: { id: 'notif-list-a' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  const data = bodyOf(res).data;
  assert.equal(data.length, 2);
  for (const n of data) assert.equal(n.userId, 'notif-list-a');
});

test('getUnreadCount counts only the requesting user\'s unread notifications', async () => {
  await notifyUser({ userId: 'notif-count-a', type: 'offer', title: 'a1', body: 'x' });
  await notifyUser({ userId: 'notif-count-a', type: 'order', title: 'a2', body: 'y' });
  await notifyUser({ userId: 'notif-count-b', type: 'offer', title: 'b1', body: 'z' });

  const res = makeRes();
  getUnreadCount({ user: { id: 'notif-count-a' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.unread, 2);
});

test('markRead marks a single notification read (own), and scopes ownership', async () => {
  const owned = await notifyUser({ userId: 'notif-own-a', type: 'offer', title: 'mine', body: 'x' });
  const other = await notifyUser({ userId: 'notif-own-b', type: 'offer', title: 'theirs', body: 'y' });

  // Cannot mark another user's notification.
  const forbid = makeRes();
  markRead({ user: { id: 'notif-own-a' }, body: { id: other.id } }, forbid, () => assert.fail('unexpected error'));
  assert.equal(statusOf(forbid), 404);

  // Own notification can be marked read.
  const ok = makeRes();
  markRead({ user: { id: 'notif-own-a' }, body: { id: owned.id } }, ok, () => assert.fail('unexpected error'));
  assert.equal(statusOf(ok), 200);
  assert.equal(bodyOf(ok).data.read, true);
});

test('markRead without an id marks all of the requesting user\'s notifications read', async () => {
  await notifyUser({ userId: 'notif-all-a', type: 'offer', title: 'a1', body: 'x' });
  await notifyUser({ userId: 'notif-all-a', type: 'order', title: 'a2', body: 'y' });

  const res = makeRes();
  markRead({ user: { id: 'notif-all-a' }, body: {} }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.updated, 2);

  const unread = makeRes();
  getUnreadCount({ user: { id: 'notif-all-a' } }, unread, () => assert.fail('unexpected error'));
  assert.equal(bodyOf(unread).data.unread, 0);
});

test('markRead on a nonexistent notification returns 404', async () => {
  const res = makeRes();
  markRead({ user: { id: 'notif-none' }, body: { id: 'does-not-exist' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 404);
});

test('newest-first ordering of a user\'s notifications', async () => {
  await notifyUser({ userId: 'notif-sort-a', type: 'offer', title: 'older', body: 'x' });
  await notifyUser({ userId: 'notif-sort-a', type: 'order', title: 'newer', body: 'y' });

  const res = makeRes();
  getMyNotifications({ user: { id: 'notif-sort-a' } }, res, () => assert.fail('unexpected error'));
  const data = bodyOf(res).data;
  assert.equal(data[0].title, 'newer');
  assert.equal(data[1].title, 'older');
});

test('creating an offer notifies the requirement owner (buyer)', async () => {
  const { requirementId, buyerId } = createDeliveredOrder('notif-buyer-1', 'notif-seller-1');
  // The helper already created an order; create a fresh offer targeted at the buyer.
  const offRes = makeRes();
  createOffer(
    { user: { id: 'notif-seller-2', name: 'SellerTwo' }, body: { requirementId, quantity: 5, unit: 'Quintal', offeredPricePerQuintal: 800, transportCostPerQuintal: 10, otherCostsPerQuintal: 5 } },
    offRes,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(offRes), 201);

  const res = makeRes();
  getMyNotifications({ user: { id: buyerId } }, res, () => assert.fail('unexpected error'));
  const data = bodyOf(res).data;
  assert.ok(data.some((n) => n.type === 'offer' && n.refType === 'requirement' && n.refId === requirementId));
});

test('creating an order notifies the offer\'s seller', async () => {
  const { buyerId, sellerId } = createDeliveredOrder('notif-buyer-2', 'notif-seller-3');

  const res = makeRes();
  getMyNotifications({ user: { id: sellerId } }, res, () => assert.fail('unexpected error'));
  const data = bodyOf(res).data;
  assert.ok(data.some((n) => n.type === 'order'));
  assert.equal(data.find((n) => n.type === 'order').refType, 'order');
});

test('creating a review notifies the reviewed user', async () => {
  const { orderId, buyerId, sellerId } = createDeliveredOrder('notif-buyer-3', 'notif-seller-4');
  const reviewRes = makeRes();
  createReview({ user: { id: buyerId }, params: { orderId }, body: { rating: 5, comment: 'nice' } }, reviewRes, () => assert.fail('unexpected error'));
  assert.equal(statusOf(reviewRes), 201);

  // The seller is the reviewed party in a buyer->seller review.
  const res = makeRes();
  getMyNotifications({ user: { id: sellerId } }, res, () => assert.fail('unexpected error'));
  const data = bodyOf(res).data;
  const reviewNotif = data.find((n) => n.type === 'review');
  assert.ok(reviewNotif);
  assert.equal(reviewNotif.refType, 'review');
});
