// Database-path regression tests for the client-facing transport validation
// added for the physical APK bug report. Like transportQuoteRoutes.db.test.js,
// these run with USE_DATABASE=true and stub transportService so no live MySQL
// is required. They prove both controllers' DB branches enforce the same
// actionable validations and messages as the in-memory path.
//
// Run: node --test test/transportRequestValidation.db.test.js

process.env.USE_DATABASE = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRequest } = require('../src/controllers/transportRequestsController');
const { createQuote, transportOffers } = require('../src/controllers/transportOffersController');
const transportService = require('../src/services/transportService');
const userService = require('../src/services/userService');
const notificationService = require('../src/services/notificationService');

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
function makeReq(overrides = {}) {
  return { body: {}, headers: {}, params: {}, user: null, ...overrides };
}
function noop() {}
function user(id, role, name) {
  return { id, phone: `${id}-phone`, role, name: name || `User ${id}` };
}

const ORIGINALS = {
  createRequest: transportService.createRequest,
  findProfileByUserId: transportService.findProfileByUserId,
  findRequestById: transportService.findRequestById,
  findActiveQuoteByTransporter: transportService.findActiveQuoteByTransporter,
  createQuote: transportService.createQuote,
  findUserById: userService.findUserById,
  createNotification: notificationService.createNotification,
};

test.afterEach(() => {
  transportService.createRequest = ORIGINALS.createRequest;
  transportService.findProfileByUserId = ORIGINALS.findProfileByUserId;
  transportService.findRequestById = ORIGINALS.findRequestById;
  transportService.findActiveQuoteByTransporter = ORIGINALS.findActiveQuoteByTransporter;
  transportService.createQuote = ORIGINALS.createQuote;
  userService.findUserById = ORIGINALS.findUserById;
  notificationService.createNotification = ORIGINALS.createNotification;
});

const BASE_BODY = {
  cropName: 'Wheat',
  quantity: 90,
  unit: 'kg',
  pickupLocation: 'Rajgurunagar, Pune, Maharashtra',
  dropLocation: 'Budhni, Sehore, Madhya Pradesh',
};

function dateString(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// 1A. createRequest DB branch
// ---------------------------------------------------------------------------

test('DB path: a valid request passes validation and calls the service', async () => {
  let called = false;
  transportService.createRequest = async (data) => {
    called = true;
    return { id: 'TRQ-DBX-1', ...data, status: 'OPEN' };
  };
  const res = makeRes();
  const req = makeReq({
    user: user('f-dbx-ok', 'FARMER'),
    body: { ...BASE_BODY, requiredBy: dateString(1), vehicleType: 'Mini Truck' },
  });
  await createRequest(req, res, noop);
  assert.equal(statusOf(res), 201);
  assert.equal(called, true);
  assert.equal(bodyOf(res).data.unit, 'kg');
  assert.equal(bodyOf(res).data.vehicleType, 'Mini Truck');
});

test('DB path: a past requiredBy is rejected before the service is called (400)', async () => {
  let called = false;
  transportService.createRequest = async () => { called = true; return {}; };
  const res = makeRes();
  await createRequest(
    makeReq({ user: user('f-dbx-past', 'FARMER'), body: { ...BASE_BODY, requiredBy: dateString(-1) } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).message, 'Required date must be today or a future date.');
  assert.equal(called, false);
});

test('DB path: an invalid quantity unit is rejected (400) with the unit message', async () => {
  const res = makeRes();
  await createRequest(
    makeReq({ user: user('f-dbx-unit', 'FARMER'), body: { ...BASE_BODY, unit: 'Box' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).message, 'Please select a valid quantity unit.');
});

test('DB path: an invalid vehicle type is rejected (400) with the vehicle message', async () => {
  const res = makeRes();
  await createRequest(
    makeReq({ user: user('f-dbx-veh', 'FARMER'), body: { ...BASE_BODY, vehicleType: 'Rocket' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).message, 'Please select a valid vehicle type.');
});

test('DB path: an invalid quantity is rejected (400) with the actionable message', async () => {
  const res = makeRes();
  await createRequest(
    makeReq({ user: user('f-dbx-qty', 'FARMER'), body: { ...BASE_BODY, quantity: 0 } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).message, 'Enter a valid positive quantity.');
});

test('DB path: missing authentication is rejected (401)', async () => {
  const res = makeRes();
  await createRequest(makeReq({ user: null, body: BASE_BODY }), res, noop);
  assert.equal(statusOf(res), 401);
});

// ---------------------------------------------------------------------------
// 1B. createQuote DB branch
// ---------------------------------------------------------------------------

function stubQuoteDeps({ profile, request, active, created }) {
  transportService.findProfileByUserId = async () => profile;
  transportService.findRequestById = async () => request;
  transportService.findActiveQuoteByTransporter = async () => active || null;
  transportService.createQuote = async (data) => ({ id: 'TQ-DBX-1', ...data, status: 'SUBMITTED' });
  userService.findUserById = async () => ({ name: 'DB Transporter' });
  return created;
}

test('DB path: a valid quote with a single-vehicle profile is created (201)', async () => {
  notificationService.createNotification = async () => ({ id: 'NTF-DBX' });
  const request = { id: 'TRQ-DBQ-1', userId: 'f-dbq-1', cropName: 'Wheat', status: 'OPEN', vehicleType: null };
  stubQuoteDeps({ profile: { userId: 't-dbq-1', vehicleTypes: 'Mini Truck' }, request });
  const res = makeRes();
  await createQuote(
    makeReq({ user: user('t-dbq-1', 'TRANSPORTER'), params: { id: request.id }, body: { quotedAmount: 5200, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.vehicleType, 'Mini Truck');
  assert.equal(bodyOf(res).data.transporterName, 'DB Transporter');
});

test('DB path: a quote without a transporter profile is rejected (403) with the profile message', async () => {
  const request = { id: 'TRQ-DBQ-2', userId: 'f-dbq-2', cropName: 'Wheat', status: 'OPEN', vehicleType: null };
  stubQuoteDeps({ profile: null, request });
  const res = makeRes();
  await createQuote(
    makeReq({ user: user('t-dbq-2', 'TRANSPORTER'), params: { id: request.id }, body: { quotedAmount: 5200, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 403);
  assert.equal(bodyOf(res).message, 'Please select a vehicle from your transporter profile.');
});

test('DB path: a quote on a closed request is rejected (400) with the closed message', async () => {
  const request = { id: 'TRQ-DBQ-3', userId: 'f-dbq-3', cropName: 'Wheat', status: 'IN_PROGRESS', vehicleType: null };
  stubQuoteDeps({ profile: { userId: 't-dbq-3', vehicleTypes: 'Mini Truck' }, request });
  const res = makeRes();
  await createQuote(
    makeReq({ user: user('t-dbq-3', 'TRANSPORTER'), params: { id: request.id }, body: { quotedAmount: 5200, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).message, 'This transport request is no longer accepting offers.');
});

test('DB path: an invalid amount is rejected before the service is called (400)', async () => {
  const request = { id: 'TRQ-DBQ-4', userId: 'f-dbq-4', cropName: 'Wheat', status: 'OPEN', vehicleType: null };
  stubQuoteDeps({ profile: { userId: 't-dbq-4', vehicleTypes: 'Mini Truck' }, request });
  let called = false;
  transportService.createQuote = async () => { called = true; return {}; };
  const res = makeRes();
  await createQuote(
    makeReq({ user: user('t-dbq-4', 'TRANSPORTER'), params: { id: request.id }, body: { quotedAmount: 'abc', vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
  assert.equal(called, false);
});

test('DB path: a duplicate active quote is rejected (400)', async () => {
  const request = { id: 'TRQ-DBQ-5', userId: 'f-dbq-5', cropName: 'Wheat', status: 'OPEN', vehicleType: null };
  stubQuoteDeps({
    profile: { userId: 't-dbq-5', vehicleTypes: 'Mini Truck' },
    request,
    active: { id: 'TQ-DBQ-5', status: 'SUBMITTED' },
  });
  let called = false;
  transportService.createQuote = async () => { called = true; return {}; };
  const res = makeRes();
  await createQuote(
    makeReq({ user: user('t-dbq-5', 'TRANSPORTER'), params: { id: request.id }, body: { quotedAmount: 5200, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
  assert.equal(called, false);
});

test('DB path: an invalid vehicle in the profile is rejected (400) with the vehicle message', async () => {
  const request = { id: 'TRQ-DBQ-6', userId: 'f-dbq-6', cropName: 'Wheat', status: 'OPEN', vehicleType: null };
  stubQuoteDeps({ profile: { userId: 't-dbq-6', vehicleTypes: 'Hovercraft' }, request });
  const res = makeRes();
  await createQuote(
    makeReq({ user: user('t-dbq-6', 'TRANSPORTER'), params: { id: request.id }, body: { quotedAmount: 5200, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).message, 'Please select a valid vehicle type.');
});

test('DB path: a forbidden role cannot quote (403)', async () => {
  const res = makeRes();
  await createQuote(
    makeReq({ user: user('f-dbq-7', 'FARMER'), params: { id: 'x' }, body: { quotedAmount: 5200, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 403);
});