// Database-path regression tests for the counter/history endpoints.
//
// These tests run with USE_DATABASE=true and stub the transportService
// persistence layer so no live MySQL connection is required (the same technique
// as auditRegression.db.test.js). They verify the DB branch of
// createCounterOffer / getNegotiationHistory: service result mapping, the
// participant guard, useful JSON errors, and that a notification is sent to the
// OTHER participant.
//
// Run: node --test test/transportQuoteRoutes.db.test.js

process.env.USE_DATABASE = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCounterOffer,
  getNegotiationHistory,
} = require('../src/controllers/transportOffersController');
const transportService = require('../src/services/transportService');
const notificationService = require('../src/services/notificationService');
const { notifications } = require('../src/controllers/notificationsController');

function makeRes() {
  const calls = [];
  return {
    calls,
    status(code) { calls.push(['status', code]); return this; },
    json(body) { calls.push(['json', body]); return this; },
  };
}
function statusOf(res) {
  for (const c of res.calls) if (c[0] === 'status') return c[1];
  return 200;
}
function bodyOf(res) {
  for (const c of res.calls) if (c[0] === 'json') return c[1];
  return null;
}

const REQUEST = {
  id: 'TRQ-DB-1',
  userId: 'f-db-1',
  cropName: 'Onion',
};

const ORIGINAL_OFFER = {
  id: 'TQ-DB-0001',
  transportRequestId: REQUEST.id,
  transporterId: 't-db-1',
  quotedAmount: 5000,
  status: 'SUBMITTED',
  negotiationRound: 1,
};

const originalCreateCounter = transportService.createCounterOffer;
const originalFindOffer = transportService.findOfferById;
const originalFindRequest = transportService.findRequestById;
const originalGetHistory = transportService.getNegotiationHistory;
const originalCreateNotification = notificationService.createNotification;

test.beforeEach(() => {
  notifications.length = 0;
});

test.afterEach(() => {
  transportService.createCounterOffer = originalCreateCounter;
  transportService.findOfferById = originalFindOffer;
  transportService.findRequestById = originalFindRequest;
  transportService.getNegotiationHistory = originalGetHistory;
  notificationService.createNotification = originalCreateNotification;
});

test('DB path: counter success maps the service result and notifies the transporter', async () => {
  const created = {
    ...ORIGINAL_OFFER,
    id: 'TQ-DB-0002',
    quotedAmount: 4800,
    status: 'SUBMITTED',
    parentOfferId: ORIGINAL_OFFER.id,
    offerType: 'COUNTER',
    negotiationRound: 2,
  };
  transportService.createCounterOffer = async () => ({ ok: true, data: { superseded: ORIGINAL_OFFER, offer: created } });
  transportService.findRequestById = async () => REQUEST;

  const notified = [];
  notificationService.createNotification = async (payload) => {
    notified.push(payload);
    return payload;
  };

  const res = makeRes();
  await createCounterOffer(
    { user: { id: 'f-db-1', role: 'FARMER' }, params: { id: ORIGINAL_OFFER.id }, body: { quotedAmount: 4800 } },
    res,
    () => assert.fail('unexpected error')
  );

  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).success, true);
  assert.equal(bodyOf(res).data.offer.offerType, 'COUNTER');
  assert.equal(bodyOf(res).data.offer.parentOfferId, ORIGINAL_OFFER.id);

  // The transporter (the OTHER participant) is notified, never the sender.
  assert.equal(notified.length, 1);
  assert.equal(notified[0].userId, 't-db-1');
  assert.equal(notified[0].type, 'transport_quote_counter');
  assert.equal(notified[0].refId, REQUEST.id);
});

test('DB path: counter service rejection is surfaced with its status code', async () => {
  transportService.createCounterOffer = async () => ({ ok: false, status: 403, message: 'Forbidden' });
  transportService.findRequestById = async () => REQUEST;

  const res = makeRes();
  await createCounterOffer(
    { user: { id: 'x-db-1', role: 'BUYER' }, params: { id: ORIGINAL_OFFER.id }, body: { quotedAmount: 4800 } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 403);
  assert.equal(bodyOf(res).success, false);
  assert.equal(bodyOf(res).message, 'Forbidden');
  assert.equal(notifications.length, 0);
});

test('DB path: non-positive amount rejected before the service is called (400)', async () => {
  let called = false;
  transportService.createCounterOffer = async () => {
    called = true;
    return { ok: true, data: {} };
  };

  for (const quotedAmount of [0, -5, 'abc', undefined]) {
    const res = makeRes();
    await createCounterOffer(
      { user: { id: 'f-db-1', role: 'FARMER' }, params: { id: ORIGINAL_OFFER.id }, body: { quotedAmount } },
      res,
      () => assert.fail('unexpected error')
    );
    assert.equal(statusOf(res), 400);
    assert.equal(bodyOf(res).success, false);
  }
  assert.equal(called, false);
});

test('DB path: history returns the full thread for participants', async () => {
  transportService.findOfferById = async () => ORIGINAL_OFFER;
  transportService.findRequestById = async () => REQUEST;
  transportService.getNegotiationHistory = async () => [
    { ...ORIGINAL_OFFER, id: 'TQ-DB-0002', negotiationRound: 2 },
    ORIGINAL_OFFER,
  ];

  const res = makeRes();
  await getNegotiationHistory(
    { user: { id: 'f-db-1', role: 'FARMER' }, params: { id: ORIGINAL_OFFER.id }, query: {} },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).success, true);
  assert.equal(bodyOf(res).data.length, 2);
  assert.equal(bodyOf(res).data[0].negotiationRound, 2);
});

test('DB path: transporter (other participant) can read history', async () => {
  transportService.findOfferById = async () => ORIGINAL_OFFER;
  transportService.findRequestById = async () => REQUEST;
  transportService.getNegotiationHistory = async () => [ORIGINAL_OFFER];

  const res = makeRes();
  await getNegotiationHistory(
    { user: { id: 't-db-1', role: 'TRANSPORTER' }, params: { id: ORIGINAL_OFFER.id }, query: {} },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 200);
});

test('DB path: non-participant history is hidden with a generic 404', async () => {
  transportService.findOfferById = async () => ORIGINAL_OFFER;
  transportService.findRequestById = async () => REQUEST;

  const res = makeRes();
  await getNegotiationHistory(
    { user: { id: 'x-db-1', role: 'BUYER' }, params: { id: ORIGINAL_OFFER.id }, query: {} },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 404);
  assert.equal(bodyOf(res).success, false);
});

test('DB path: unknown quote returns 404 "Quote not found"', async () => {
  transportService.findOfferById = async () => null;

  const res = makeRes();
  await getNegotiationHistory(
    { user: { id: 'f-db-1', role: 'FARMER' }, params: { id: 'TQ-DB-MISSING' }, query: {} },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 404);
  assert.equal(bodyOf(res).message, 'Quote not found');
});