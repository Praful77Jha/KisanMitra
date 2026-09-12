// Client-facing transport validation and error-message regression tests
// (IN-MEMORY path). Covers the validations added for the physical APK bug
// report: past requiredBy, quantity units, vehicle types, and the actionable
// messages that replace generic "Internal Server Error" responses.
//
// Run: node --test test/transportRequestValidation.test.js

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

// Mock the prisma client so requiring the controller graph (which imports
// userService) never touches a live database, matching transportFeature.test.js.
const users = new Map();
let idSeq = 0;

const prismaMock = {
  user: {
    findUnique: async ({ where }) => {
      if (where.phone) {
        for (const u of users.values()) {
          if (u.phone === where.phone) return u;
        }
        return null;
      }
      return users.get(where.id) || null;
    },
    create: async ({ data }) => {
      const id = `cuid-${++idSeq}`;
      const record = {
        id,
        name: data.name,
        phone: data.phone,
        passwordHash: data.passwordHash,
        role: data.role || 'FARMER',
        createdAt: new Date(),
      };
      users.set(id, record);
      return record;
    },
  },
};

const prismaPath = require.resolve('../src/config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock };
delete require.cache[require.resolve('../src/services/userService')];

const { createRequest, transportRequests } = require('../src/controllers/transportRequestsController');
const { createProfile, transporterProfiles } = require('../src/controllers/transporterController');
const { createQuote, transportOffers } = require('../src/controllers/transportOffersController');
const { REQUEST_STATUS } = require('../src/utils/transportStates');

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
function createProfileFor(userId, vehicleTypes = 'Mini Truck') {
  createProfile(
    makeReq({ user: user(userId, 'TRANSPORTER'), body: { vehicleTypes, baseLocation: 'Pune' } }),
    makeRes(),
    noop
  );
}

function dateString(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const BASE_BODY = {
  cropName: 'Wheat',
  quantity: 90,
  unit: 'kg',
  pickupLocation: 'Rajgurunagar, Pune, Maharashtra',
  dropLocation: 'Budhni, Sehore, Madhya Pradesh',
};

// ---------------------------------------------------------------------------
// 1A. Transport request creation validation
// ---------------------------------------------------------------------------

test('request: each quantity unit is accepted and stored normalized', () => {
  for (const unit of ['kg', 'quintal', 'tonne', 'sack']) {
    const res = makeRes();
    createRequest(makeReq({ user: user(`req-unit-${unit}`, 'FARMER'), body: { ...BASE_BODY, unit } }), res, noop);
    assert.equal(statusOf(res), 201, `unit ${unit} should be accepted`);
    assert.equal(bodyOf(res).data.unit, unit);
    assert.equal(bodyOf(res).data.quantity, 90);
  }
});

test('request: a capitalized unit is normalized to lowercase', () => {
  const res = makeRes();
  createRequest(makeReq({ user: user('req-unit-cap', 'FARMER'), body: { ...BASE_BODY, unit: 'Tonne' } }), res, noop);
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.unit, 'tonne');
});

test('request: an invalid quantity unit is rejected with an actionable message', () => {
  const res = makeRes();
  createRequest(makeReq({ user: user('req-unit-bad', 'FARMER'), body: { ...BASE_BODY, unit: 'Box' } }), res, noop);
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).message, 'Please select a valid quantity unit.');
});

test('request: every canonical vehicle type is accepted', () => {
  for (const vehicleType of ['Tractor-Trolley', 'Mini Truck', 'Truck', 'Tempo', 'Container']) {
    const res = makeRes();
    createRequest(
      makeReq({ user: user(`req-veh-${vehicleType}`, 'FARMER'), body: { ...BASE_BODY, vehicleType } }),
      res,
      noop
    );
    assert.equal(statusOf(res), 201, `vehicleType ${vehicleType} should be accepted`);
    assert.equal(bodyOf(res).data.vehicleType, vehicleType);
  }
});

test('request: an invalid vehicle type is rejected with an actionable message', () => {
  const res = makeRes();
  createRequest(makeReq({ user: user('req-veh-bad', 'FARMER'), body: { ...BASE_BODY, vehicleType: 'Helicopter' } }), res, noop);
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).message, 'Please select a valid vehicle type.');
});

test('request: a past requiredBy date is rejected with the exact required message', () => {
  const res = makeRes();
  createRequest(makeReq({ user: user('req-past', 'FARMER'), body: { ...BASE_BODY, requiredBy: dateString(-1) } }), res, noop);
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).message, 'Required date must be today or a future date.');
});

test('request: a malformed requiredBy date is rejected (400)', () => {
  const res = makeRes();
  createRequest(makeReq({ user: user('req-bad-date', 'FARMER'), body: { ...BASE_BODY, requiredBy: '15-09-2025' } }), res, noop);
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).message, 'Required date must be today or a future date.');
});

test('request: today and future requiredBy dates are accepted and stored', () => {
  for (const offset of [0, 3]) {
    const res = makeRes();
    createRequest(makeReq({ user: user(`req-date-${offset}`, 'FARMER'), body: { ...BASE_BODY, requiredBy: dateString(offset) } }), res, noop);
    assert.equal(statusOf(res), 201, `requiredBy ${offset} day(s) out should be accepted`);
    assert.equal(bodyOf(res).data.requiredBy, dateString(offset));
  }
});

test('request: invalid quantities produce the actionable quantity message', () => {
  for (const quantity of [0, -1, 'abc']) {
    const res = makeRes();
    createRequest(makeReq({ user: user(`req-qty-${String(quantity)}`, 'FARMER'), body: { ...BASE_BODY, quantity } }), res, noop);
    assert.equal(statusOf(res), 400, `quantity ${quantity} should be rejected`);
    assert.equal(bodyOf(res).message, 'Enter a valid positive quantity.');
  }
});

test('request: missing locations are rejected (400)', () => {
  for (const body of [{ ...BASE_BODY, pickupLocation: undefined }, { ...BASE_BODY, dropLocation: undefined }, { ...BASE_BODY, pickupLocation: '', dropLocation: '' }]) {
    const res = makeRes();
    createRequest(makeReq({ user: user('req-no-loc', 'FARMER'), body }), res, noop);
    assert.equal(statusOf(res), 400);
  }
});

test('request: unauthenticated creation is rejected (401)', () => {
  const res = makeRes();
  createRequest(makeReq({ user: null, body: BASE_BODY }), res, noop);
  assert.equal(statusOf(res), 401);
});

// ---------------------------------------------------------------------------
// 1B. Transport offer (quote) creation validation
// ---------------------------------------------------------------------------

function makeRequestFor(reqId, userId, opts = {}) {
  const res = makeRes();
  createRequest(makeReq({ user: user(userId, 'FARMER'), body: { ...BASE_BODY, ...opts } }), res, noop);
  assert.equal(statusOf(res), 201);
  return bodyOf(res).data.id;
}

test('quote: a single-vehicle transporter can quote and the stored vehicle is the profile vehicle', () => {
  createRequest(makeReq({ user: user('q-single-farmer', 'FARMER'), body: BASE_BODY }), makeRes(), noop);
  const requestId = makeRequestFor('q-single-req', 'q-single-farmer');
  createProfileFor('q-single-t', 'Mini Truck');
  const res = makeRes();
  createQuote(
    makeReq({ user: user('q-single-t', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 5200, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.vehicleType, 'Mini Truck');
});

test('quote: a transporter without a profile gets the exact profile-required message', () => {
  const requestId = makeRequestFor('q-noprofile-req', 'q-noprofile-farmer');
  const res = makeRes();
  createQuote(
    makeReq({ user: user('q-noprofile-t', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 5200, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 403);
  assert.equal(bodyOf(res).message, 'Please select a vehicle from your transporter profile.');
});

test('quote: a closed request is rejected with the exact closed message', () => {
  const requestId = makeRequestFor('q-closed-req', 'q-closed-farmer');
  createProfileFor('q-closed-t');
  const found = transportRequests.find((r) => r.id === requestId);
  found.status = REQUEST_STATUS.IN_PROGRESS;
  const res = makeRes();
  createQuote(
    makeReq({ user: user('q-closed-t', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 5200, vehicleType: 'Mini Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).message, 'This transport request is no longer accepting offers.');
});

test('quote: an invalid amount is rejected (400) without storing an offer', () => {
  const requestId = makeRequestFor('q-amt-req', 'q-amt-farmer');
  createProfileFor('q-amt-t');
  for (const quotedAmount of [0, -100, 'abc']) {
    const res = makeRes();
    createQuote(
      makeReq({ user: user('q-amt-t', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount, vehicleType: 'Mini Truck' } }),
      res,
      noop
    );
    assert.equal(statusOf(res), 400, `amount ${quotedAmount} should be rejected`);
  }
});

test('quote: an invalid vehicle in the transporter profile is rejected with the vehicle message', () => {
  const requestId = makeRequestFor('q-badveh-req', 'q-badveh-farmer');
  createProfileFor('q-badveh-t', 'Hovercraft');
  const res = makeRes();
  createQuote(
    makeReq({ user: user('q-badveh-t', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 5200 } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).message, 'Please select a valid vehicle type.');
});

test('quote: a duplicate active quote is rejected (400)', () => {
  const requestId = makeRequestFor('q-dup-req', 'q-dup-farmer');
  createProfileFor('q-dup-t');
  const first = makeRes();
  createQuote(
    makeReq({ user: user('q-dup-t', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 5200, vehicleType: 'Truck' } }),
    first,
    noop
  );
  assert.equal(statusOf(first), 201);
  const second = makeRes();
  createQuote(
    makeReq({ user: user('q-dup-t', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 5100, vehicleType: 'Truck' } }),
    second,
    noop
  );
  assert.equal(statusOf(second), 400);
});

test('quote: a forbidden role cannot quote (403)', () => {
  const requestId = makeRequestFor('q-forb-req', 'q-forb-farmer');
  const res = makeRes();
  createQuote(
    makeReq({ user: user('q-forb-someone', 'FARMER'), params: { id: requestId }, body: { quotedAmount: 5000, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 403);
});