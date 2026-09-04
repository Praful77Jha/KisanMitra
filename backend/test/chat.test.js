// Persistent Buyer-Seller Messaging regression tests (Phase 7).
//
// Run in NON-DATABASE mode: they exercise the in-memory chat controller and the
// party-scoped access rules, following the pattern of logistics.test.js and
// reviews.test.js. Each test builds a real order (buyer + seller) via the
// in-memory requirement -> offer -> order flow, then exercises chat rules.

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRequirement } = require('../src/controllers/requirementsController');
const { createOffer } = require('../src/controllers/offersController');
const { createOrder, orders } = require('../src/controllers/ordersController');
const {
  getMessages,
  sendMessage,
} = require('../src/controllers/chatController');

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

test('a fresh conversation has no messages (200, empty list)', () => {
  const { orderId, buyerId } = createOrderBetween('c-buyer-01', 'c-seller-01');
  const res = makeRes();
  getMessages({ user: { id: buyerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  assert.deepEqual(bodyOf(res).data, []);
});

test('a party (buyer) can send a message to the order (201)', () => {
  const { orderId, buyerId, sellerId } = createOrderBetween('c-buyer-02', 'c-seller-02');
  const res = makeRes();
  sendMessage({ user: { id: buyerId }, params: { orderId }, body: { body: 'Hello, is the stock fresh?' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 201);
  const message = bodyOf(res).data;
  assert.equal(message.orderId, orderId);
  assert.equal(message.senderId, buyerId);
  assert.equal(message.body, 'Hello, is the stock fresh?');
  assert.ok(message.id);
  assert.ok(message.createdAt);
});

test('the other party (seller) can read messages sent by the buyer (persistence)', () => {
  const { orderId, buyerId, sellerId } = createOrderBetween('c-buyer-03', 'c-seller-03');
  sendMessage({ user: { id: buyerId }, params: { orderId }, body: { body: 'First message' } }, makeRes(), () => assert.fail('unexpected error'));

  const res = makeRes();
  getMessages({ user: { id: sellerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  const data = bodyOf(res).data;
  assert.equal(data.length, 1);
  assert.equal(data[0].body, 'First message');
  assert.equal(data[0].senderId, buyerId);
});

test('both parties can send and the messages are ordered oldest-first', () => {
  const { orderId, buyerId, sellerId } = createOrderBetween('c-buyer-04', 'c-seller-04');
  sendMessage({ user: { id: buyerId }, params: { orderId }, body: { body: 'msg 1' } }, makeRes(), () => assert.fail('unexpected error'));
  sendMessage({ user: { id: sellerId }, params: { orderId }, body: { body: 'msg 2' } }, makeRes(), () => assert.fail('unexpected error'));
  sendMessage({ user: { id: buyerId }, params: { orderId }, body: { body: 'msg 3' } }, makeRes(), () => assert.fail('unexpected error'));

  const res = makeRes();
  getMessages({ user: { id: buyerId }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  const data = bodyOf(res).data;
  assert.equal(data.length, 3);
  assert.deepEqual(data.map((m) => m.body), ['msg 1', 'msg 2', 'msg 3']);
});

test('sending a message with an empty body is rejected with 400', () => {
  const { orderId, buyerId } = createOrderBetween('c-buyer-05', 'c-seller-05');
  for (const empty of [undefined, '', '   ']) {
    const res = makeRes();
    sendMessage({ user: { id: buyerId }, params: { orderId }, body: { body: empty } }, res, () => assert.fail('unexpected error'));
    assert.equal(statusOf(res), 400, `body=${JSON.stringify(empty)} should be rejected`);
  }
});

test('a non-party cannot read the conversation (403)', () => {
  const { orderId, buyerId } = createOrderBetween('c-buyer-06', 'c-seller-06');
  sendMessage({ user: { id: buyerId }, params: { orderId }, body: { body: 'secret' } }, makeRes(), () => assert.fail('unexpected error'));
  const res = makeRes();
  getMessages({ user: { id: 'c-intruder-06' }, params: { orderId } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 403);
});

test('a non-party cannot send to the conversation (403)', () => {
  const { orderId, buyerId } = createOrderBetween('c-buyer-07', 'c-seller-07');
  const res = makeRes();
  sendMessage({ user: { id: 'c-intruder-07' }, params: { orderId }, body: { body: 'intrusion' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 403);
});

test('accessing messages for a nonexistent order returns 404', () => {
  const getRes = makeRes();
  getMessages({ user: { id: 'c-buyer-08' }, params: { orderId: 'missing-order' } }, getRes, () => assert.fail('unexpected error'));
  assert.equal(statusOf(getRes), 404);

  const sendRes = makeRes();
  sendMessage({ user: { id: 'c-buyer-08' }, params: { orderId: 'missing-order' }, body: { body: 'hi' } }, sendRes, () => assert.fail('unexpected error'));
  assert.equal(statusOf(sendRes), 404);
});

test('a new message to a counterpart creates a chat notification for them', () => {
  const { orderId, buyerId, sellerId } = createOrderBetween('c-buyer-09', 'c-seller-09');
  const res = makeRes();
  sendMessage({ user: { id: buyerId }, params: { orderId }, body: { body: 'Stock check' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 201);

  const { notifications } = require('../src/controllers/notificationsController');
  const notif = notifications.find((n) => n.userId === sellerId && n.type === 'chat' && n.refId === orderId);
  assert.ok(notif, 'seller should receive a chat notification');
  assert.equal(notif.type, 'chat');
});

test('sending to your own order does not create a self-notification', () => {
  const { orderId, buyerId } = createOrderBetween('c-buyer-10', 'c-seller-10');
  const { notifications } = require('../src/controllers/notificationsController');
  const before = notifications.filter((n) => n.userId === buyerId && n.type === 'chat' && n.refId === orderId).length;
  const res = makeRes();
  sendMessage({ user: { id: buyerId }, params: { orderId }, body: { body: 'self note' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 201);
  const after = notifications.filter((n) => n.userId === buyerId && n.type === 'chat' && n.refId === orderId).length;
  assert.equal(after, before, 'the sender must not receive a self-notification');
});
