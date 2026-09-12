// HTTP-level tests for the negotiated-quote routes (counter + history).
//
// Regression guard for the "Route not found" APK issue: these tests boot the REAL
// Express router (routes/transportQuotes.js) exactly as server.js mounts it and
// verify that the counter/history endpoints respond with the auth gate (401) —
// NOT the generic 404 "Route not found" — and that the full negotiation flow
// works end-to-end over HTTP (in-memory mode, like the running backend).
//
// Run: node --test test/transportQuoteRoutes.test.js

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { signToken } = require('../src/utils/jwt');
const transportQuotesRouter = require('../src/routes/transportQuotes');
const { createProfile, transporterProfiles } = require('../src/controllers/transporterController');
const { createRequest, transportRequests } = require('../src/controllers/transportRequestsController');
const { createQuote, transportOffers } = require('../src/controllers/transportOffersController');
const { notifications } = require('../src/controllers/notificationsController');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const FARMER = 'f-route-1';
const TRANSPORTER = 't-route-1';
const INTRUDER = 'x-route-1';

function farmerToken(name = 'Farmer One') {
  return signToken({ id: FARMER, phone: '9100000101', name });
}
function transporterToken(name = 'Transporter One') {
  return signToken({ id: TRANSPORTER, phone: '9100000102', name });
}
function intruderToken() {
  return signToken({ id: INTRUDER, phone: '9100000103', name: 'Intruder' });
}

function makeReq(user, body, params = {}) {
  return { user, body, headers: {}, params, query: {} };
}

function statusOf(res) {
  for (const c of res.calls) if (c[0] === 'status') return c[1];
  return 200;
}

function makeRes() {
  const calls = [];
  return {
    calls,
    status(code) { calls.push(['status', code]); return this; },
    json(payload) { calls.push(['json', payload]); return this; },
  };
}

function noop() {}

// Seeds a transporter profile + a farmer transport request + the transporter's
// initial quote. Returns { requestId, quoteId }.
function seedNegotiation() {
  createProfile(
    makeReq(
      { id: TRANSPORTER, phone: '9100000102', role: 'TRANSPORTER', name: 'Transporter One' },
      { vehicleTypes: 'Mini Truck', baseLocation: 'Pune' }
    ),
    makeRes(),
    noop
  );

  const requestRes = makeRes();
  createRequest(
    makeReq(
      { id: FARMER, phone: '9100000101', role: 'FARMER', name: 'Farmer One' },
      { cropName: 'Onion', quantity: 50, unit: 'Quintal', pickupLocation: 'Pune', dropLocation: 'Nashik' }
    ),
    requestRes,
    noop
  );
  assert.equal(statusOf(requestRes), 201);
  const requestId = requestRes.calls.find((c) => c[0] === 'json')[1].data.id;

  const quoteRes = makeRes();
  createQuote(
    makeReq(
      { id: TRANSPORTER, phone: '9100000102', role: 'TRANSPORTER', name: 'Transporter One' },
      { quotedAmount: 5000, vehicleType: 'Mini Truck', distanceKm: 40 },
      { id: requestId }
    ),
    quoteRes,
    noop
  );
  assert.equal(statusOf(quoteRes), 201);
  const quoteId = quoteRes.calls.find((c) => c[0] === 'json')[1].data.id;

  return { requestId, quoteId };
}

// ---------------------------------------------------------------------------
// HTTP harness (mirrors server.js: JSON body parsing + JSON 404 handler)
// ---------------------------------------------------------------------------
function buildApp() {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (req, res) => res.status(200).json({ success: true }));
  app.use('/api/transport-quotes', transportQuotesRouter);
  app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
  return app;
}

async function withServer(fn) {
  const server = buildApp().listen(0);
  await new Promise((resolve) => server.on('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function httpCall(base, method, path, { token, body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + path, { method, headers, body: payload });
  return { status: res.status, body: await res.json() };
}

test.beforeEach(() => {
  transportRequests.length = 0;
  transportOffers.length = 0;
  transporterProfiles.length = 0;
  notifications.length = 0;
});

// ---------------------------------------------------------------------------
// Route availability (the APK regression): 401, never 404
// ---------------------------------------------------------------------------

test('POST counter is mounted and auth-gated (401, not "Route not found")', async () => {
  await withServer(async (base) => {
    const res = await httpCall(base, 'POST', '/api/transport-quotes/TQ-0001/counter', {
      body: { quotedAmount: 100 },
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });
});

test('GET history is mounted and auth-gated (401, not "Route not found")', async () => {
  await withServer(async (base) => {
    const res = await httpCall(base, 'GET', '/api/transport-quotes/TQ-0001/history');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });
});

test('malformed / invalid tokens are rejected with 401 JSON', async () => {
  await withServer(async (base) => {
    const malformed = await httpCall(base, 'POST', '/api/transport-quotes/TQ-0001/counter', {
      token: 'not-a-bearer-token',
      body: { quotedAmount: 100 },
    });
    assert.equal(malformed.status, 401);
    assert.equal(malformed.body.success, false);

    const invalid = await httpCall(base, 'GET', '/api/transport-quotes/TQ-0001/history', {
      token: 'Bearer invalid.token.value',
    });
    assert.equal(invalid.status, 401);
  });
});

test('wrong method / unknown routes still return useful JSON 404', async () => {
  await withServer(async (base) => {
    const wrongCounterMethod = await httpCall(base, 'GET', '/api/transport-quotes/TQ-0001/counter', {
      token: farmerToken(),
    });
    assert.equal(wrongCounterMethod.status, 404);
    assert.equal(wrongCounterMethod.body.message, 'Route not found');

    const wrongHistoryMethod = await httpCall(base, 'POST', '/api/transport-quotes/TQ-0001/history', {
      token: farmerToken(),
      body: {},
    });
    assert.equal(wrongHistoryMethod.status, 404);

    const unknown = await httpCall(base, 'DELETE', '/api/transport-quotes/TQ-0001/unknown', {
      token: farmerToken(),
    });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.message, 'Route not found');
  });
});

// ---------------------------------------------------------------------------
// End-to-end negotiation over HTTP (in-memory, same as running backend)
// ---------------------------------------------------------------------------

test('counter: requester counters the transporter quote over HTTP (201, supersedes parent)', async () => {
  const { requestId, quoteId } = seedNegotiation();

  await withServer(async (base) => {
    const res = await httpCall(base, 'POST', `/api/transport-quotes/${quoteId}/counter`, {
      token: farmerToken(),
      body: { quotedAmount: 4800, notes: 'Can you do better?' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    const { superseded, offer } = res.body.data;
    assert.equal(superseded.id, quoteId);
    assert.equal(superseded.status, 'SUPERSEDED');
    assert.equal(offer.transportRequestId, requestId);
    assert.equal(offer.offerType, 'COUNTER');
    assert.equal(offer.negotiationRound, 2);
    assert.equal(offer.parentOfferId, quoteId);
    assert.equal(offer.quotedAmount, 4800);
    assert.equal(offer.status, 'SUBMITTED');
  });
});

test('counter: transporter replies to the counter (201, round 3)', async () => {
  const { quoteId } = seedNegotiation();

  await withServer(async (base) => {
    // Farmer counters the original INITIAL quote -> a new round-2 offer is created.
    const farmerCounter = await httpCall(base, 'POST', `/api/transport-quotes/${quoteId}/counter`, {
      token: farmerToken(),
      body: { quotedAmount: 4800 },
    });
    assert.equal(farmerCounter.status, 201);
    const roundTwoId = farmerCounter.body.data.offer.id;

    // The transporter answers THE ROUND-2 OFFER (the original is now superseded).
    const res = await httpCall(base, 'POST', `/api/transport-quotes/${roundTwoId}/counter`, {
      token: transporterToken(),
      body: { quotedAmount: 4950 },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.offer.offerType, 'COUNTER');
    assert.equal(res.body.data.offer.negotiationRound, 3);
    assert.equal(res.body.data.offer.quotedAmount, 4950);
    assert.equal(res.body.data.offer.parentOfferId, roundTwoId);
  });
});

test('history: full thread returned newest-first for participants', async () => {
  const { quoteId } = seedNegotiation();

  await withServer(async (base) => {
    const farmerCounter = await httpCall(base, 'POST', `/api/transport-quotes/${quoteId}/counter`, {
      token: farmerToken(),
      body: { quotedAmount: 4800 },
    });
    assert.equal(farmerCounter.status, 201);
    const roundTwoId = farmerCounter.body.data.offer.id;

    const transporterCounter = await httpCall(base, 'POST', `/api/transport-quotes/${roundTwoId}/counter`, {
      token: transporterToken(),
      body: { quotedAmount: 4950 },
    });
    assert.equal(transporterCounter.status, 201);
    const roundThreeId = transporterCounter.body.data.offer.id;

    // History is requested on the LATEST offer: it walks the parent chain backwards.
    const res = await httpCall(base, 'GET', `/api/transport-quotes/${roundThreeId}/history`, {
      token: farmerToken(),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const thread = res.body.data;
    assert.equal(thread.length, 3);
    assert.equal(thread[0].negotiationRound, 3); // newest first
    assert.equal(thread[0].quotedAmount, 4950);
    assert.equal(thread[2].negotiationRound, 1); // original INITIAL quote
    assert.equal(thread[2].offerType, 'INITIAL');
    assert.equal(thread[1].parentOfferId, quoteId);
  });
});

test('non-participant cannot counter (403) or read history (404)', async () => {
  const { quoteId } = seedNegotiation();

  await withServer(async (base) => {
    const counter = await httpCall(base, 'POST', `/api/transport-quotes/${quoteId}/counter`, {
      token: intruderToken(),
      body: { quotedAmount: 4000 },
    });
    assert.equal(counter.status, 403);
    assert.equal(counter.body.message, 'Forbidden');

    const history = await httpCall(base, 'GET', `/api/transport-quotes/${quoteId}/history`, {
      token: intruderToken(),
    });
    assert.equal(history.status, 404);
    assert.equal(history.body.success, false);
  });
});

test('invalid amount is rejected with 400', async () => {
  const { quoteId } = seedNegotiation();

  await withServer(async (base) => {
    const zero = await httpCall(base, 'POST', `/api/transport-quotes/${quoteId}/counter`, {
      token: farmerToken(),
      body: { quotedAmount: 0 },
    });
    assert.equal(zero.status, 400);
    assert.equal(zero.body.success, false);

    const negative = await httpCall(base, 'POST', `/api/transport-quotes/${quoteId}/counter`, {
      token: farmerToken(),
      body: { quotedAmount: -10 },
    });
    assert.equal(negative.status, 400);

    const missing = await httpCall(base, 'POST', `/api/transport-quotes/${quoteId}/counter`, {
      token: farmerToken(),
      body: { notes: 'no amount' },
    });
    assert.equal(missing.status, 400);
  });
});

test('an accepted quote can no longer be countered (400)', async () => {
  const { quoteId } = seedNegotiation();
  const { acceptQuote } = require('../src/controllers/transportOffersController');
  const accepted = makeRes();
  acceptQuote(makeReq({ id: FARMER, phone: '9100000101', role: 'FARMER' }, {}, { id: quoteId }), accepted, noop);
  assert.equal(statusOf(accepted), 200);

  await withServer(async (base) => {
    const res = await httpCall(base, 'POST', `/api/transport-quotes/${quoteId}/counter`, {
      token: farmerToken(),
      body: { quotedAmount: 4800 },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });
});