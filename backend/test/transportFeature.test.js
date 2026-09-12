// Transporter Feature (Phase 2B) backend tests.
//
// These tests run in NON-DATABASE mode: they exercise the in-memory controllers
// for the whole transporter flow (role auth, profile, requests, quotes, jobs,
// reviews, notifications) and the auth controller against a mocked Prisma user
// store for registration-role coverage, without touching MySQL.
//
// Run: node --test test/transportFeature.test.js

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

// ---------------------------------------------------------------------------
// In-memory Prisma mock (for userService-backed auth controller only)
// ---------------------------------------------------------------------------
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
const userServicePath = require.resolve('../src/services/userService');
delete require.cache[userServicePath];

// ---------------------------------------------------------------------------
// Imports (after the prisma mock is installed)
// ---------------------------------------------------------------------------
const { register, login, me } = require('../src/controllers/authController');
const {
  createProfile,
  getMyProfile,
  updateMyProfile,
  transporterProfiles,
} = require('../src/controllers/transporterController');
const {
  createRequest,
  getAllRequests,
  getAvailableRequests,
  getRequestById,
  deleteRequest,
  transportRequests,
} = require('../src/controllers/transportRequestsController');
const {
  createQuote,
  getQuotesForRequest,
  acceptQuote,
  rejectQuote,
  createCounterOffer,
  getNegotiationHistory,
  transportOffers,
} = require('../src/controllers/transportOffersController');
const {
  getAllJobs,
  getJobHistory,
  getJobById,
  updateJobStatus,
  createReview,
  getTransporterReviews,
  transportJobs,
  transportReviews,
} = require('../src/controllers/transportJobsController');
const { notifications, notifyUser } = require('../src/controllers/notificationsController');
const { orders } = require('../src/controllers/ordersController');
const { requireRole } = require('../src/middlewares/auth');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

function clearNotifications() {
  notifications.length = 0;
}

function createProfileFor(userId) {
  const res = makeRes();
  createProfile(
    makeReq({ user: user(userId, 'TRANSPORTER'), body: { vehicleTypes: 'Mini Truck', baseLocation: 'Pune' } }),
    res,
    noop
  );
  return res;
}

// Creates a farmer request, a transporter quote, and accepts it.
// Returns { requestId, quoteId, jobId, quote, job, request }.
function setupAcceptedJob(requesterId, transporterId, opts = {}) {
  createProfileFor(transporterId);
  const { grain, quantity, vehicle } = opts;
  const created = makeRes();
  createRequest(
    makeReq({
      user: user(requesterId, 'FARMER'),
      body: {
        cropName: grain || 'Wheat',
        quantity: quantity || 10,
        unit: 'Tonne',
        pickupLocation: 'Pune',
        dropLocation: 'Nashik',
        vehicleType: vehicle || null,
      },
    }),
    created,
    noop
  );
  const requestId = bodyOf(created).data.id;

  const quoted = makeRes();
  createQuote(
    makeReq({
      user: user(transporterId, 'TRANSPORTER', 'Transporter One'),
      params: { id: requestId },
      body: { quotedAmount: 5000, vehicleType: 'Mini Truck', distanceKm: 40 },
    }),
    quoted,
    noop
  );
  const quoteId = bodyOf(quoted).data.id;

  clearNotifications();
  const accepted = makeRes();
  acceptQuote({ user: user(requesterId, 'FARMER'), params: { id: quoteId } }, accepted, noop);
  assert.equal(statusOf(accepted), 200);
  const { quote, job, request } = bodyOf(accepted).data;
  return { requestId, quoteId, jobId: job.id, quote, job, request };
}

// ---------------------------------------------------------------------------
// 1. ROLE / AUTH
// ---------------------------------------------------------------------------

test('register: missing role defaults to FARMER', async () => {
  const res = makeRes();
  await register(makeReq({ body: { name: 'Def Farmer', phone: '9100000001', password: 'pass123' } }), res, (e) => { throw e; });
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.role, 'FARMER');
});

test('register: accepts valid BUYER role', async () => {
  const res = makeRes();
  await register(makeReq({ body: { name: 'B Buyer', phone: '9100000002', password: 'pass123', role: 'BUYER' } }), res, (e) => { throw e; });
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.role, 'BUYER');
});

test('register: accepts valid TRANSPORTER role', async () => {
  const res = makeRes();
  await register(makeReq({ body: { name: 'T Trans', phone: '9100000003', password: 'pass123', role: 'TRANSPORTER' } }), res, (e) => { throw e; });
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.role, 'TRANSPORTER');
});

test('register: rejects invalid role with 400', async () => {
  const res = makeRes();
  await register(makeReq({ body: { name: 'Bad Role', phone: '9100000004', password: 'pass123', role: 'SUPERUSER' } }), res, (e) => { throw e; });
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).success, false);
});

test('register: rejects empty role string with 400', async () => {
  const res = makeRes();
  await register(makeReq({ body: { name: 'Bad Role 2', phone: '9100000005', password: 'pass123', role: '' } }), res, (e) => { throw e; });
  assert.equal(statusOf(res), 400);
});

test('login: response includes the user role', async () => {
  await register(makeReq({ body: { name: 'Login Trans', phone: '9100000006', password: 'pass123', role: 'TRANSPORTER' } }), makeRes(), noop);
  const res = makeRes();
  await login(makeReq({ body: { phone: '9100000006', password: 'pass123' } }), res, (e) => { throw e; });
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.user.role, 'TRANSPORTER');
});

test('me: returns the authenticated user with role', async () => {
  await register(makeReq({ body: { name: 'Me Buyer', phone: '9100000007', password: 'pass123', role: 'BUYER' } }), makeRes(), noop);
  const res = makeRes();
  await me(makeReq({ user: { id: 'any-id', phone: '9100000007' }, body: {} }), res, (e) => { throw e; });
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.phone, '9100000007');
  assert.equal(bodyOf(res).data.role, 'BUYER');
});

test('requireRole: rejects a user with the wrong role (403)', async () => {
  const middleware = requireRole('TRANSPORTER');
  const res = makeRes();
  await middleware({ user: user('farmer-a', 'FARMER') }, res, () => assert.fail('should not reach next'));
  assert.equal(statusOf(res), 403);
});

test('requireRole: allows a user with a permitted role', async () => {
  const middleware = requireRole('FARMER', 'BUYER');
  let nextCalled = false;
  await middleware({ user: user('buyer-a', 'BUYER') }, makeRes(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('requireRole: rejects unauthenticated request (401)', async () => {
  const middleware = requireRole('TRANSPORTER');
  const res = makeRes();
  await middleware({ user: null }, res, () => assert.fail('should not reach next'));
  assert.equal(statusOf(res), 401);
});

// ---------------------------------------------------------------------------
// 2. TRANSPORTER PROFILE
// ---------------------------------------------------------------------------

test('profile: transporter creates a profile', () => {
  const res = createProfileFor('transporter-1');
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.userId, 'transporter-1');
  assert.equal(bodyOf(res).data.vehicleTypes, 'Mini Truck');
  assert.equal(bodyOf(res).data.avgRating, null);
});

test('profile: duplicate creation returns 409', () => {
  createProfileFor('transporter-dup');
  const res = createProfileFor('transporter-dup');
  assert.equal(statusOf(res), 409);
});

test('profile: transporter reads own profile', () => {
  createProfileFor('transporter-2');
  const res = makeRes();
  getMyProfile(makeReq({ user: user('transporter-2', 'TRANSPORTER') }), res, noop);
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.userId, 'transporter-2');
});

test('profile: missing profile returns 404', () => {
  const res = makeRes();
  getMyProfile(makeReq({ user: user('transporter-noprofile', 'TRANSPORTER') }), res, noop);
  assert.equal(statusOf(res), 404);
});

test('profile: transporter updates own profile', () => {
  createProfileFor('transporter-3');
  const res = makeRes();
  updateMyProfile(
    makeReq({ user: user('transporter-3', 'TRANSPORTER'), body: { vehicleTypes: 'Truck', baseLocation: 'Mumbai', description: 'Long distance' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.vehicleTypes, 'Truck');
  assert.equal(bodyOf(res).data.description, 'Long distance');
});

test('profile: farmer or buyer cannot create a transporter profile (403)', () => {
  for (const role of ['FARMER', 'BUYER']) {
    const res = makeRes();
    createProfile(
      makeReq({ user: user(`plain-${role}`, role), body: { vehicleTypes: 'Truck', baseLocation: 'Pune' } }),
      res,
      noop
    );
    assert.equal(statusOf(res), 403);
  }
});

test('profile: avgRating is never client-controlled', () => {
  const res = makeRes();
  createProfile(
    makeReq({
      user: user('transporter-rating', 'TRANSPORTER'),
      body: { vehicleTypes: 'Truck', baseLocation: 'Pune', avgRating: 5 },
    }),
    res,
    noop
  );
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.avgRating, null);
});

test('profile: missing required fields returns 400', () => {
  const res = makeRes();
  createProfile(makeReq({ user: user('transporter-missing', 'TRANSPORTER'), body: { vehicleTypes: 'Truck' } }), res, noop);
  assert.equal(statusOf(res), 400);
});

test('profile: unauthenticated request returns 401', () => {
  const res = makeRes();
  createProfile(makeReq({ user: null, body: { vehicleTypes: 'Truck', baseLocation: 'Pune' } }), res, noop);
  assert.equal(statusOf(res), 401);
});

test('profile: vehicleCapacity is accepted on create and update', () => {
  const created = makeRes();
  createProfile(
    makeReq({ user: user('transporter-cap', 'TRANSPORTER'), body: { vehicleTypes: 'Truck', baseLocation: 'Pune', vehicleCapacity: 12.5 } }),
    created,
    noop
  );
  assert.equal(statusOf(created), 201);
  assert.equal(bodyOf(created).data.vehicleCapacity, 12.5);

  const invalid = makeRes();
  createProfile(
    makeReq({ user: user('transporter-cap-bad', 'TRANSPORTER'), body: { vehicleTypes: 'Truck', baseLocation: 'Pune', vehicleCapacity: -3 } }),
    invalid,
    noop
  );
  assert.equal(statusOf(invalid), 400);

  const updated = makeRes();
  updateMyProfile(
    makeReq({ user: user('transporter-cap', 'TRANSPORTER'), body: { vehicleCapacity: 20 } }),
    updated,
    noop
  );
  assert.equal(statusOf(updated), 200);
  assert.equal(bodyOf(updated).data.vehicleCapacity, 20);
});

// ---------------------------------------------------------------------------
// 3. TRANSPORT REQUESTS
// ---------------------------------------------------------------------------

test('request: farmer creates a transport request', () => {
  const res = makeRes();
  createRequest(
    makeReq({ user: user('farmer-req', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'Aurangabad', dropLocation: 'Pune' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.status, 'OPEN');
  assert.equal(bodyOf(res).data.userId, 'farmer-req');
});

test('request: buyer creates a transport request', () => {
  const res = makeRes();
  createRequest(
    makeReq({ user: user('buyer-req', 'BUYER'), body: { cropName: 'Onion', quantity: 3, unit: 'Tonne', pickupLocation: 'Nashik', dropLocation: 'Mumbai' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 201);
});

test('request: transporter cannot create a request (403)', () => {
  const res = makeRes();
  createRequest(
    makeReq({ user: user('transporter-req', 'TRANSPORTER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 403);
});

test('request: unauthenticated rejected (401)', () => {
  const res = makeRes();
  createRequest(
    makeReq({ user: null, body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 401);
});

test('request: missing required fields returns 400', () => {
  const res = makeRes();
  createRequest(
    makeReq({ user: user('farmer-req-2', 'FARMER'), body: { cropName: 'Rice', quantity: 5 } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
});

test('request: quantity must be positive', () => {
  const res = makeRes();
  createRequest(
    makeReq({ user: user('farmer-req-3', 'FARMER'), body: { cropName: 'Rice', quantity: 0, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
});

test('request: requester can view own request; unrelated user cannot (404)', () => {
  const created = makeRes();
  createRequest(
    makeReq({ user: user('owner-req', 'FARMER'), body: { cropName: 'Soybean', quantity: 8, unit: 'Tonne', pickupLocation: 'Indore', dropLocation: 'Pune' } }),
    created,
    noop
  );
  const requestId = bodyOf(created).data.id;

  const own = makeRes();
  getRequestById(makeReq({ user: user('owner-req', 'FARMER'), params: { id: requestId } }), own, noop);
  assert.equal(statusOf(own), 200);

  const stranger = makeRes();
  getRequestById(makeReq({ user: user('stranger', 'FARMER'), params: { id: requestId } }), stranger, noop);
  assert.equal(statusOf(stranger), 404);
});

test('request: transporter can view an OPEN request', () => {
  const created = makeRes();
  createRequest(
    makeReq({ user: user('owner-open', 'FARMER'), body: { cropName: 'Maize', quantity: 4, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    created,
    noop
  );
  const requestId = bodyOf(created).data.id;

  const res = makeRes();
  getRequestById(makeReq({ user: user('transporter-view', 'TRANSPORTER'), params: { id: requestId } }), res, noop);
  assert.equal(statusOf(res), 200);
});

test('request: transporter cannot view a closed request they did not quote on', () => {
  const created = makeRes();
  createRequest(
    makeReq({ user: user('owner-closed', 'FARMER'), body: { cropName: 'Jowar', quantity: 2, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    created,
    noop
  );
  const requestId = bodyOf(created).data.id;
  const request = transportRequests.find((r) => r.id === requestId);
  request.status = 'COMPLETED';

  const res = makeRes();
  getRequestById(makeReq({ user: user('transporter-other', 'TRANSPORTER'), params: { id: requestId } }), res, noop);
  assert.equal(statusOf(res), 404);
});

test('request: list only returns the caller\'s own requests', () => {
  const created = makeRes();
  createRequest(
    makeReq({ user: user('farmer-list', 'FARMER'), body: { cropName: 'Gram', quantity: 1, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    created,
    noop
  );
  const myId = bodyOf(created).data.id;

  const mine = makeRes();
  getAllRequests(makeReq({ user: user('farmer-list', 'FARMER') }), mine, noop);
  assert.equal(bodyOf(mine).data.some((r) => r.id === myId), true);

  const other = makeRes();
  getAllRequests(makeReq({ user: user('farmer-list-other', 'FARMER') }), other, noop);
  assert.equal(bodyOf(other).data.some((r) => r.id === myId), false);
});

test('request: available list exposes OPEN requests to transporters only', () => {
  const openReq = makeRes();
  createRequest(
    makeReq({ user: user('avail-owner', 'FARMER'), body: { cropName: 'Cotton', quantity: 9, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    openReq,
    noop
  );
  const openId = bodyOf(openReq).data.id;

  const closedReq = makeRes();
  createRequest(
    makeReq({ user: user('avail-owner', 'FARMER'), body: { cropName: 'Tur', quantity: 2, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    closedReq,
    noop
  );
  const closedId = bodyOf(closedReq).data.id;
  transportRequests.find((r) => r.id === closedId).status = 'CANCELLED';

  const res = makeRes();
  getAvailableRequests(makeReq({ user: user('transporter-avail', 'TRANSPORTER') }), res, noop);
  assert.equal(statusOf(res), 200);
  const data = bodyOf(res).data;
  assert.equal(data.some((r) => r.id === openId), true);
  assert.equal(data.some((r) => r.id === closedId), false, 'closed requests excluded from available list');
});

test('request: available list refused for non-transporters (403)', () => {
  const res = makeRes();
  getAvailableRequests(makeReq({ user: user('farmer-avail', 'FARMER') }), res, noop);
  assert.equal(statusOf(res), 403);
});

test('request: expectedBudget and coordinates are optional extras on create', () => {
  const res = makeRes();
  createRequest(
    makeReq({
      user: user('farmer-budget', 'FARMER'),
      body: {
        cropName: 'Wheat',
        quantity: 8,
        unit: 'Tonne',
        pickupLocation: 'A',
        dropLocation: 'B',
        expectedBudget: 4500,
        distanceKm: 120,
        pickupLat: 18.52,
        pickupLng: 73.85,
        dropLat: 19.07,
        dropLng: 72.87,
      },
    }),
    res,
    noop
  );
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.expectedBudget, 4500);
  assert.equal(bodyOf(res).data.distanceKm, 120);
  assert.equal(bodyOf(res).data.pickupLat, 18.52);

  const badBudget = makeRes();
  createRequest(
    makeReq({ user: user('farmer-budget-bad', 'FARMER'), body: { cropName: 'Wheat', quantity: 8, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B', expectedBudget: -100 } }),
    badBudget,
    noop
  );
  assert.equal(statusOf(badBudget), 400);

  const badLat = makeRes();
  createRequest(
    makeReq({ user: user('farmer-lat-bad', 'FARMER'), body: { cropName: 'Wheat', quantity: 8, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B', pickupLat: 91 } }),
    badLat,
    noop
  );
  assert.equal(statusOf(badLat), 400);
});

test('request: available list filters by the transporter vehicle types', () => {
  // A transporter with Truck profile, and a transporter with Tempo profile.
  createProfile(
    makeReq({ user: user('matcher-truck', 'TRANSPORTER'), body: { vehicleTypes: 'Truck', baseLocation: 'Pune' } }),
    makeRes(),
    noop
  );
  createProfile(
    makeReq({ user: user('matcher-tempo', 'TRANSPORTER'), body: { vehicleTypes: 'Tempo', baseLocation: 'Pune' } }),
    makeRes(),
    noop
  );

  const truckReq = makeRes();
  createRequest(
    makeReq({ user: user('farmer-m1', 'FARMER'), body: { cropName: 'Rice', quantity: 4, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B', vehicleType: 'Truck' } }),
    truckReq,
    noop
  );
  const truckId = bodyOf(truckReq).data.id;

  const openReq = makeRes();
  createRequest(
    makeReq({ user: user('farmer-m2', 'FARMER'), body: { cropName: 'Rice', quantity: 4, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    openReq,
    noop
  );
  const openId = bodyOf(openReq).data.id;

  const tempos = makeRes();
  getAvailableRequests(makeReq({ user: user('matcher-tempo', 'TRANSPORTER') }), tempos, noop);
  const tempoData = bodyOf(tempos).data;
  assert.equal(tempoData.some((r) => r.id === openId), true, 'no-preference requests always shown');
  assert.equal(tempoData.some((r) => r.id === truckId), false, 'Truck request hidden from Tempo transporter');

  const trucks = makeRes();
  getAvailableRequests(makeReq({ user: user('matcher-truck', 'TRANSPORTER') }), trucks, noop);
  const truckData = bodyOf(trucks).data;
  assert.equal(truckData.some((r) => r.id === truckId), true, 'Truck request shown to Truck transporter');
});

test('request: order attachment verifies order ownership', () => {
  orders.push({
    id: 'ORD-TEST-1',
    userId: 'farmer-order',
    sellerUserId: 'seller-order',
    status: 'Order Confirmed',
  });
  const ok = makeRes();
  createRequest(
    makeReq({
      user: user('farmer-order', 'FARMER'),
      body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B', orderId: 'ORD-TEST-1' },
    }),
    ok,
    noop
  );
  assert.equal(statusOf(ok), 201);
  assert.equal(bodyOf(ok).data.orderId, 'ORD-TEST-1');

  const bad = makeRes();
  createRequest(
    makeReq({
      user: user('intruder-order', 'FARMER'),
      body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B', orderId: 'ORD-TEST-1' },
    }),
    bad,
    noop
  );
  assert.equal(statusOf(bad), 404, 'cannot attach transport to another user\'s order');
});

test('request: requester can delete own OPEN request', () => {
  const created = makeRes();
  createRequest(
    makeReq({ user: user('del-owner', 'FARMER'), body: { cropName: 'Rice', quantity: 2, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    created,
    noop
  );
  const requestId = bodyOf(created).data.id;

  const res = makeRes();
  deleteRequest(makeReq({ user: user('del-owner', 'FARMER'), params: { id: requestId } }), res, noop);
  assert.equal(statusOf(res), 200);
});

test('request: cannot delete another user\'s request (404)', () => {
  const created = makeRes();
  createRequest(
    makeReq({ user: user('del-owner-2', 'FARMER'), body: { cropName: 'Rice', quantity: 2, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    created,
    noop
  );
  const requestId = bodyOf(created).data.id;

  const res = makeRes();
  deleteRequest(makeReq({ user: user('del-intruder', 'FARMER'), params: { id: requestId } }), res, noop);
  assert.equal(statusOf(res), 404);
});

test('request: cannot delete a request once a job exists', () => {
  const { requestId } = setupAcceptedJob('del-farmer', 'del-transport', { grain: 'Barley' });
  const res = makeRes();
  deleteRequest(makeReq({ user: user('del-farmer', 'FARMER'), params: { id: requestId } }), res, noop);
  assert.equal(statusOf(res), 400);
});

// ---------------------------------------------------------------------------
// 4. TRANSPORT OFFERS / QUOTES
// ---------------------------------------------------------------------------

test('quote: transporter with profile quotes successfully', () => {
  createProfileFor('transporter-q1');
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-q1', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;

  const res = makeRes();
  createQuote(
    makeReq({ user: user('transporter-q1', 'TRANSPORTER', 'Transporter Q'), params: { id: requestId }, body: { quotedAmount: 4000, vehicleType: 'Mini Truck', distanceKm: 20 } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.status, 'SUBMITTED');
  assert.equal(bodyOf(res).data.transporterId, 'transporter-q1');
});

test('quote: farmer/buyer cannot quote (403)', () => {
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-q2', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;

  for (const role of ['FARMER', 'BUYER']) {
    const res = makeRes();
    createQuote(
      makeReq({ user: user(`non-transport-${role}`, role), params: { id: requestId }, body: { quotedAmount: 100, vehicleType: 'Truck' } }),
      res,
      noop
    );
    assert.equal(statusOf(res), 403);
  }
});

test('quote: transporter without a profile cannot quote (403)', () => {
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-q3', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;

  const res = makeRes();
  createQuote(
    makeReq({ user: user('transporter-noprofile-q', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 100, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 403);
});

test('quote: cannot quote on your own request (400)', () => {
  const made = makeRes();
  createRequest(
    makeReq({ user: user('tx-own', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;
  createProfileFor('tx-own');

  const res = makeRes();
  createQuote(
    makeReq({ user: user('tx-own', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 100, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
});

test('quote: duplicate active quote prevented on same request', () => {
  createProfileFor('transporter-dup-q');
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-dup-q', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;

  const first = makeRes();
  createQuote(
    makeReq({ user: user('transporter-dup-q', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 4000, vehicleType: 'Truck' } }),
    first,
    noop
  );
  assert.equal(statusOf(first), 201);

  const second = makeRes();
  createQuote(
    makeReq({ user: user('transporter-dup-q', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 3500, vehicleType: 'Truck' } }),
    second,
    noop
  );
  assert.equal(statusOf(second), 400);
});

test('quote: vehicleType is server-derived from the profile, never the body', () => {
  createProfileFor('transporter-derive');
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-derive', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;

  // Profile says 'Mini Truck' but the body claims 'Truck': the quote must carry
  // the profile's 'Mini Truck', proving the client cannot influence the field.
  const res = makeRes();
  createQuote(
    makeReq({ user: user('transporter-derive', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 4000, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.vehicleType, 'Mini Truck');
});

test('quote: request demanding a vehicle the transporter does not offer is rejected (400)', () => {
  createProfileFor('transporter-compat');
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-compat', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B', vehicleType: 'Container' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;

  const res = makeRes();
  createQuote(
    makeReq({ user: user('transporter-compat', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 4000 } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
});

test('quote: a request with a matching vehicle preference is quotable and stores the preferred vehicle', () => {
  createProfileFor('transporter-match');
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-match', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B', vehicleType: 'Mini Truck' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;

  const res = makeRes();
  createQuote(
    makeReq({ user: user('transporter-match', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 4000 } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.vehicleType, 'Mini Truck');
});

test('quote: invalid amount rejected', () => {
  createProfileFor('transporter-amt');
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-amt', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;

  for (const quotedAmount of [0, -100, 'abc']) {
    const res = makeRes();
    createQuote(
      makeReq({ user: user('transporter-amt', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount, vehicleType: 'Truck' } }),
      res,
      noop
    );
    assert.equal(statusOf(res), 400);
  }
});

test('quote: request must be OPEN', () => {
  createProfileFor('transporter-closed-q');
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-closed-q', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;
  transportRequests.find((r) => r.id === requestId).status = 'COMPLETED';

  const res = makeRes();
  createQuote(
    makeReq({ user: user('transporter-closed-q', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 100, vehicleType: 'Truck' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400);
});

test('quote: requester sees quotes; unrelated user cannot (404)', () => {
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-see', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;
  createProfileFor('transporter-see');
  createQuote(
    makeReq({ user: user('transporter-see', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 4000, vehicleType: 'Truck' } }),
    makeRes(),
    noop
  );

  const owner = makeRes();
  getQuotesForRequest(makeReq({ user: user('farmer-see', 'FARMER'), params: { id: requestId } }), owner, noop);
  assert.equal(statusOf(owner), 200);
  assert.equal(bodyOf(owner).data.length, 1);

  const stranger = makeRes();
  getQuotesForRequest(makeReq({ user: user('stranger-see', 'FARMER'), params: { id: requestId } }), stranger, noop);
  assert.equal(statusOf(stranger), 404);
});

test('quote: transporter cannot see competing quotes via the owner endpoint', () => {
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-compete', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;

  const res = makeRes();
  getQuotesForRequest(makeReq({ user: user('transporter-compete', 'TRANSPORTER'), params: { id: requestId } }), res, noop);
  assert.equal(statusOf(res), 403);
});

test('quote: requester is notified when a quote arrives', () => {
  clearNotifications();
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-notif-q', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;
  createProfileFor('transporter-notif-q');

  createQuote(
    makeReq({ user: user('transporter-notif-q', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 4000, vehicleType: 'Truck' } }),
    makeRes(),
    noop
  );

  assert.equal(notifications.some((n) => n.type === 'transport_quote' && n.userId === 'farmer-notif-q'), true);
});

// ---------------------------------------------------------------------------
// 5. ACCEPT QUOTE
// ---------------------------------------------------------------------------

test('accept: requester accepts a quote — job created, others rejected, request IN_PROGRESS, transporter notified', () => {
  createProfileFor('transport-accept-1');
  createProfileFor('transport-accept-2');
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-accept', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;

  createQuote(
    makeReq({ user: user('transport-accept-1', 'TRANSPORTER', 'T One'), params: { id: requestId }, body: { quotedAmount: 5000, vehicleType: 'Truck' } }),
    makeRes(),
    noop
  );
  const winner = makeRes();
  createQuote(
    makeReq({ user: user('transport-accept-2', 'TRANSPORTER', 'T Two'), params: { id: requestId }, body: { quotedAmount: 4000, vehicleType: 'Truck' } }),
    winner,
    noop
  );
  const winnerId = bodyOf(winner).data.id;

  clearNotifications();
  const res = makeRes();
  acceptQuote({ user: user('farmer-accept', 'FARMER'), params: { id: winnerId } }, res, noop);
  assert.equal(statusOf(res), 200);

  const data = bodyOf(res).data;
  assert.equal(data.quote.id, winnerId);
  assert.equal(data.quote.status, 'ACCEPTED');
  assert.equal(transportJobs.some((j) => j.id === data.job.id), true, 'job created');
  assert.equal(transportJobs.filter((j) => j.transportRequestId === requestId).length, 1, 'exactly one job');
  assert.equal(data.request.status, 'IN_PROGRESS');
  assert.equal(transportOffers.some((o) => o.transportRequestId === requestId && o.status === 'REJECTED'), true, 'other quotes rejected');
  assert.equal(
    notifications.some((n) => n.type === 'transport_quote_accepted' && n.userId === 'transport-accept-2'),
    true,
    'selected transporter notified'
  );
});

test('accept: accepting twice does not create a second job', () => {
  const { quoteId, jobId, requestId } = setupAcceptedJob('farmer-accept2', 'transport-accept2', { grain: 'Wheat' });
  const before = transportJobs.filter((j) => j.transportRequestId === requestId).length;

  const second = makeRes();
  acceptQuote({ user: user('farmer-accept2', 'FARMER'), params: { id: quoteId } }, second, noop);
  assert.notEqual(statusOf(second), 201);

  const after = transportJobs.filter((j) => j.transportRequestId === requestId).length;
  assert.equal(after, before, 'no second job');
  assert.equal(after, 1);
  assert.equal(transportJobs.some((j) => j.id === jobId), true);
});

test('accept: unrelated user cannot accept (404)', () => {
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-uacc', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;
  createProfileFor('transport-uacc');
  const quoted = makeRes();
  createQuote(
    makeReq({ user: user('transport-uacc', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 5000, vehicleType: 'Truck' } }),
    quoted,
    noop
  );

  const res = makeRes();
  acceptQuote(makeReq({ user: user('intruder-uacc', 'FARMER'), params: { id: bodyOf(quoted).data.id } }), res, noop);
  assert.equal(statusOf(res), 404);
});

test('accept: transporter cannot accept (403)', () => {
  const { quoteId } = setupAcceptedJob('farmer-acc-trans', 'transport-acc-trans');
  const res = makeRes();
  acceptQuote(makeReq({ user: user('transport-acc-trans', 'TRANSPORTER'), params: { id: quoteId } }), res, noop);
  assert.equal(statusOf(res), 403);
});

test('accept: requester can reject a submitted quote', () => {
  const made = makeRes();
  createRequest(
    makeReq({ user: user('farmer-rej', 'FARMER'), body: { cropName: 'Rice', quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' } }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;
  createProfileFor('transport-rej');
  const quoted = makeRes();
  createQuote(
    makeReq({ user: user('transport-rej', 'TRANSPORTER'), params: { id: requestId }, body: { quotedAmount: 5000, vehicleType: 'Truck' } }),
    quoted,
    noop
  );

  const res = makeRes();
  rejectQuote(makeReq({ user: user('farmer-rej', 'FARMER'), params: { id: bodyOf(quoted).data.id } }), res, noop);
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.status, 'REJECTED');
});

test('accept: cannot reject an accepted quote (400)', () => {
  const { quoteId } = setupAcceptedJob('farmer-rejacc', 'transport-rejacc');
  const res = makeRes();
  rejectQuote(makeReq({ user: user('farmer-rejacc', 'FARMER'), params: { id: quoteId } }), res, noop);
  assert.equal(statusOf(res), 400);
});

// ---------------------------------------------------------------------------
// 5b. COUNTER OFFERS / NEGOTIATION
// ---------------------------------------------------------------------------

function setupRequestWithQuote(requesterId, transporterId, crop = 'Rice') {
  const made = makeRes();
  createRequest(
    makeReq({
      user: user(requesterId, 'FARMER'),
      body: { cropName: crop, quantity: 5, unit: 'Tonne', pickupLocation: 'A', dropLocation: 'B' },
    }),
    made,
    noop
  );
  const requestId = bodyOf(made).data.id;
  createProfileFor(transporterId);
  const quoted = makeRes();
  createQuote(
    makeReq({ user: user(transporterId, 'TRANSPORTER', 'Counter Transporter'), params: { id: requestId }, body: { quotedAmount: 5000, vehicleType: 'Truck' } }),
    quoted,
    noop
  );
  return { requestId, quoteId: bodyOf(quoted).data.id };
}

test('counter: requester counters the transporter quote — new offer supersedes parent and preserves thread fields', () => {
  const { quoteId } = setupRequestWithQuote('farmer-counter', 'transport-counter', 'Rice');

  const res = makeRes();
  createCounterOffer(
    makeReq({ user: user('farmer-counter', 'FARMER'), params: { id: quoteId }, body: { quotedAmount: 4500 } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 201);

  const data = bodyOf(res).data;
  assert.equal(data.superseded.id, quoteId);
  assert.equal(data.superseded.status, 'SUPERSEDED', 'answered offer is no longer actionable');
  assert.equal(data.offer.status, 'SUBMITTED');
  assert.equal(data.offer.quotedAmount, 4500);
  assert.equal(data.offer.offerType, 'COUNTER');
  assert.equal(data.offer.parentOfferId, quoteId, 'new offer chains back to the offer it answers');
  assert.equal(data.offer.negotiationRound, 2, 'round increments from the parent');
  assert.equal(data.offer.transporterId, 'transport-counter', 'transporter side of the thread is preserved');
});

test('counter: an unrelated user cannot counter (403)', () => {
  const { quoteId } = setupRequestWithQuote('farmer-counter-x', 'transport-counter-x');

  // A stranger (not the request owner, not the quoted transporter) is refused.
  const requester = makeRes();
  createCounterOffer(
    makeReq({ user: user('farmer-counter-x', 'FARMER'), params: { id: quoteId }, body: { quotedAmount: 4500 } }),
    requester,
    noop
  );
  assert.equal(statusOf(requester), 201, 'sanity: requester can counter');
  const latestId = bodyOf(requester).data.offer.id;

  const stranger = makeRes();
  createCounterOffer(
    makeReq({ user: user('intruder-counter', 'FARMER'), params: { id: latestId }, body: { quotedAmount: 3000 } }),
    stranger,
    noop
  );
  assert.equal(statusOf(stranger), 403);
});

test('counter: non-positive or non-numeric amounts rejected (400)', () => {
  const { quoteId } = setupRequestWithQuote('farmer-counter-amt', 'transport-counter-amt');

  for (const quotedAmount of [0, -100, 'abc']) {
    const res = makeRes();
    createCounterOffer(
      makeReq({ user: user('farmer-counter-amt', 'FARMER'), params: { id: quoteId }, body: { quotedAmount } }),
      res,
      noop
    );
    assert.equal(statusOf(res), 400, `amount ${quotedAmount} must be rejected`);
  }

  const missing = makeRes();
  createCounterOffer(
    makeReq({ user: user('farmer-counter-amt', 'FARMER'), params: { id: quoteId }, body: {} }),
    missing,
    noop
  );
  assert.equal(statusOf(missing), 400);
});

test('counter: an accepted quote cannot be countered (400)', () => {
  const { quoteId, requestId, jobId } = setupAcceptedJob('farmer-counter-acc', 'transport-counter-acc');

  const res = makeRes();
  createCounterOffer(
    makeReq({ user: user('farmer-counter-acc', 'FARMER'), params: { id: quoteId }, body: { quotedAmount: 1000 } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 400, 'a settled thread is closed to counters');
  assert.equal(transportJobs.some((j) => j.id === jobId), true, 'the accepted job is untouched');
});

test('history: negotiation thread is returned newest-first for participants', () => {
  const { requestId, quoteId } = setupRequestWithQuote('farmer-counter-hist', 'transport-counter-hist', 'Wheat');

  const c1 = makeRes();
  createCounterOffer(
    makeReq({ user: user('farmer-counter-hist', 'FARMER'), params: { id: quoteId }, body: { quotedAmount: 4500 } }),
    c1,
    noop
  );
  const counter1 = bodyOf(c1).data.offer.id;

  const c2 = makeRes();
  createCounterOffer(
    makeReq({ user: user('transport-counter-hist', 'TRANSPORTER'), params: { id: counter1 }, body: { quotedAmount: 4750 } }),
    c2,
    noop
  );
  const counter2 = bodyOf(c2).data.offer.id;

  const res = makeRes();
  getNegotiationHistory(
    makeReq({ user: user('farmer-counter-hist', 'FARMER'), params: { id: counter2 } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 200);
  const history = bodyOf(res).data;
  assert.equal(history.length, 3);
  assert.deepEqual(
    history.map((o) => o.id),
    [counter2, counter1, quoteId],
    'most recent offer first, oldest last'
  );
  assert.deepEqual(
    history.map((o) => o.negotiationRound),
    [3, 2, 1],
    'rounds descend from newest to oldest'
  );
  assert.deepEqual(
    history.map((o) => o.offerType),
    ['COUNTER', 'COUNTER', 'INITIAL']
  );
  assert.equal(history.every((o) => o.transportRequestId === requestId), true, 'all links belong to the same request');

  // The quoted transporter is also a participant and can read the thread.
  const asTransporter = makeRes();
  getNegotiationHistory(
    makeReq({ user: user('transport-counter-hist', 'TRANSPORTER'), params: { id: counter2 } }),
    asTransporter,
    noop
  );
  assert.equal(statusOf(asTransporter), 200);
  assert.equal(bodyOf(asTransporter).data.length, 3);
});

test('counter: the OTHER participant is notified and the sender is never notified', () => {
  clearNotifications();

  // Requester counters the transporter quote -> the transporter is notified.
  const rSetup = setupRequestWithQuote('farmer-notif-c1', 'transport-notif-c1', 'Rice');
  createCounterOffer(
    makeReq({ user: user('farmer-notif-c1', 'FARMER'), params: { id: rSetup.quoteId }, body: { quotedAmount: 4500 } }),
    makeRes(),
    noop
  );
  assert.equal(
    notifications.some((n) => n.type === 'transport_quote_counter' && n.userId === 'transport-notif-c1'),
    true,
    'transporter is notified when the requester counters'
  );
  assert.equal(
    notifications.some((n) => n.type === 'transport_quote_counter' && n.userId === 'farmer-notif-c1'),
    false,
    'the countering sender is never notified'
  );

  // Transporter counters the requester's counter -> the requester is notified.
  clearNotifications();
  const tSetup = setupRequestWithQuote('farmer-notif-c2', 'transport-notif-c2', 'Rice');
  const first = makeRes();
  createCounterOffer(
    makeReq({ user: user('farmer-notif-c2', 'FARMER'), params: { id: tSetup.quoteId }, body: { quotedAmount: 4500 } }),
    first,
    noop
  );
  const latestId = bodyOf(first).data.offer.id;
  createCounterOffer(
    makeReq({ user: user('transport-notif-c2', 'TRANSPORTER'), params: { id: latestId }, body: { quotedAmount: 4750 } }),
    makeRes(),
    noop
  );
  // notifications.unshift => index 0 is the newest. The requester's earlier
  // counter legitimately notified the transporter, so assert on the newest:
  // the transporter's own counter goes to the requester, never to itself.
  assert.equal(notifications[0].type, 'transport_quote_counter');
  assert.equal(notifications[0].userId, 'farmer-notif-c2', 'requester is notified when the transporter counters');
  assert.equal(
    notifications[0].userId === 'transport-notif-c2',
    false,
    'the countering transporter is never the recipient of its own counter'
  );
  assert.equal(
    notifications.filter((n) => n.type === 'transport_quote_counter').length,
    2,
    'one counter notification per counter'
  );
});

test('counter: exactly one counter notification is created, carrying the request reference', () => {
  clearNotifications();
  const { requestId, quoteId } = setupRequestWithQuote('farmer-notif-c3', 'transport-notif-c3', 'Rice');
  createCounterOffer(
    makeReq({ user: user('farmer-notif-c3', 'FARMER'), params: { id: quoteId }, body: { quotedAmount: 4500 } }),
    makeRes(),
    noop
  );
  assert.equal(notifications.filter((n) => n.type === 'transport_quote_counter').length, 1, 'exactly one notification');
  const n = notifications.find((x) => x.type === 'transport_quote_counter');
  assert.equal(n.userId, 'transport-notif-c3', 'notifies the other participant');
  assert.equal(n.refType, 'transportRequest');
  assert.equal(n.refId, requestId);
});

// ---------------------------------------------------------------------------
// 6. JOBS + STATE MACHINE
// ---------------------------------------------------------------------------

test('job: assigned transporter and requester both see the job; unrelated user cannot', () => {
  const { requestId, jobId } = setupAcceptedJob('farmer-job1', 'transport-job1', { grain: 'Rice' });

  const asTransporter = makeRes();
  getAllJobs(makeReq({ user: user('transport-job1', 'TRANSPORTER') }), asTransporter, noop);
  assert.equal(bodyOf(asTransporter).data.some((j) => j.id === jobId), true);

  const asRequester = makeRes();
  getAllJobs(makeReq({ user: user('farmer-job1', 'FARMER') }), asRequester, noop);
  assert.equal(bodyOf(asRequester).data.some((j) => j.id === jobId), true);

  const asStranger = makeRes();
  getAllJobs(makeReq({ user: user('stranger-job', 'FARMER') }), asStranger, noop);
  assert.equal(bodyOf(asStranger).data.some((j) => j.id === jobId), false, 'stranger list must not include the job');

  const strangerDetail = makeRes();
  getJobById(makeReq({ user: user('stranger-job', 'FARMER'), params: { id: jobId } }), strangerDetail, noop);
  assert.equal(statusOf(strangerDetail), 404);

  const hijacker = makeRes();
  getJobById(makeReq({ user: user('other-transport', 'TRANSPORTER'), params: { id: jobId } }), hijacker, noop);
  assert.equal(statusOf(hijacker), 404);
});

test('job: valid lifecycle transitions succeed and delivered completes the request', () => {
  const { requestId, jobId } = setupAcceptedJob('farmer-life', 'transport-life', { grain: 'Rice' });
  clearNotifications();

  const sequence = ['DRIVER_ASSIGNED', 'PICKUP_STARTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
  for (const toStatus of sequence) {
    const res = makeRes();
    updateJobStatus(makeReq({ user: user('transport-life', 'TRANSPORTER'), params: { id: jobId }, body: { status: toStatus } }), res, noop);
    assert.equal(statusOf(res), 200, `transition to ${toStatus} should succeed`);
    assert.equal(bodyOf(res).data.status, toStatus);
  }

  const request = transportRequests.find((r) => r.id === requestId);
  assert.equal(request.status, 'COMPLETED', 'delivery completes the transport request');
  assert.equal(notifications.some((n) => n.type === 'transport_status' && n.userId === 'farmer-life'), true);
  assert.equal(notifications.some((n) => n.type === 'transport_delivered' && n.userId === 'farmer-life'), true);
});

test('job: arbitrary status jumps are rejected', () => {
  const { jobId } = setupAcceptedJob('farmer-jump', 'transport-jump');
  const res = makeRes();
  updateJobStatus(makeReq({ user: user('transport-jump', 'TRANSPORTER'), params: { id: jobId }, body: { status: 'DELIVERED' } }), res, noop);
  assert.equal(statusOf(res), 400, 'BOOKED -> DELIVERED must be forbidden');
});

test('job: status update attempts on an unknown state are rejected', () => {
  const { jobId } = setupAcceptedJob('farmer-state', 'transport-state');
  const res = makeRes();
  updateJobStatus(makeReq({ user: user('transport-state', 'TRANSPORTER'), params: { id: jobId }, body: { status: 'FAST_TRAVEL' } }), res, noop);
  assert.equal(statusOf(res), 400);
});

test('job: only the assigned transporter can update status', () => {
  const { jobId } = setupAcceptedJob('farmer-owner', 'transport-owner');

  const requester = makeRes();
  updateJobStatus(makeReq({ user: user('farmer-owner', 'FARMER'), params: { id: jobId }, body: { status: 'DRIVER_ASSIGNED' } }), requester, noop);
  assert.equal(statusOf(requester), 403, 'requester cannot change status');

  const otherTransporter = makeRes();
  updateJobStatus(makeReq({ user: user('transport-other', 'TRANSPORTER'), params: { id: jobId }, body: { status: 'DRIVER_ASSIGNED' } }), otherTransporter, noop);
  assert.equal(statusOf(otherTransporter), 404, 'unassigned transporter cannot change status');
});

test('job: history returns terminal jobs', () => {
  const { jobId } = setupAcceptedJob('farmer-hist', 'transport-hist');
  updateJobStatus(makeReq({ user: user('transport-hist', 'TRANSPORTER'), params: { id: jobId }, body: { status: 'CANCELLED' } }), makeRes(), noop);

  const res = makeRes();
  getJobHistory(makeReq({ user: user('transport-hist', 'TRANSPORTER') }), res, noop);
  assert.equal(bodyOf(res).data.some((j) => j.id === jobId), true);
});

// ---------------------------------------------------------------------------
// 7. REVIEWS
// ---------------------------------------------------------------------------

function deliverJob(jobId, transporterId) {
  let toStatus = 'DRIVER_ASSIGNED';
  const lifecycle = ['DRIVER_ASSIGNED', 'PICKUP_STARTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
  for (toStatus of lifecycle) {
    updateJobStatus(makeReq({ user: user(transporterId, 'TRANSPORTER'), params: { id: jobId }, body: { status: toStatus } }), makeRes(), noop);
  }
}

test('review: requester can review a delivered job; avgRating recalculated', () => {
  const { jobId } = setupAcceptedJob('farmer-review', 'transport-review');
  deliverJob(jobId, 'transport-review');
  clearNotifications();

  const res = makeRes();
  createReview(
    makeReq({ user: user('farmer-review', 'FARMER'), params: { id: jobId }, body: { rating: 5, comment: 'Great service' } }),
    res,
    noop
  );
  assert.equal(statusOf(res), 201);
  assert.equal(bodyOf(res).data.rating, 5);

  const profile = transporterProfiles.find((p) => p.userId === 'transport-review');
  assert.equal(profile.avgRating, 5, 'avgRating recalculated and persisted on profile');
  assert.equal(notifications.some((n) => n.type === 'transport_review' && n.userId === 'transport-review'), true, 'transporter notified');
});

test('review: cannot review before delivery (400)', () => {
  const { jobId } = setupAcceptedJob('farmer-nodelivery', 'transport-nodelivery');
  const res = makeRes();
  createReview(makeReq({ user: user('farmer-nodelivery', 'FARMER'), params: { id: jobId }, body: { rating: 4 } }), res, noop);
  assert.equal(statusOf(res), 400);
});

test('review: unrelated user cannot review (403)', () => {
  const { jobId } = setupAcceptedJob('farmer-review-x', 'transport-review-x');
  deliverJob(jobId, 'transport-review-x');
  const res = makeRes();
  createReview(makeReq({ user: user('stranger-review', 'FARMER'), params: { id: jobId }, body: { rating: 4 } }), res, noop);
  assert.equal(statusOf(res), 403);
});

test('review: duplicate review rejected (409)', () => {
  const { jobId } = setupAcceptedJob('farmer-dup-review', 'transport-dup-review');
  deliverJob(jobId, 'transport-dup-review');
  createReview(makeReq({ user: user('farmer-dup-review', 'FARMER'), params: { id: jobId }, body: { rating: 4 } }), makeRes(), noop);
  const res = makeRes();
  createReview(makeReq({ user: user('farmer-dup-review', 'FARMER'), params: { id: jobId }, body: { rating: 5 } }), res, noop);
  assert.equal(statusOf(res), 409);
});

test('review: rating must be an integer 1-5 (400)', () => {
  const { jobId } = setupAcceptedJob('farmer-rating', 'transport-rating');
  deliverJob(jobId, 'transport-rating');
  for (const rating of [0, 6, 2.5, 'x']) {
    const res = makeRes();
    createReview(makeReq({ user: user('farmer-rating', 'FARMER'), params: { id: jobId }, body: { rating } }), res, noop);
    assert.equal(statusOf(res), 400);
  }
});

test('review: transporter reviews endpoint returns aggregate', () => {
  const { jobId } = setupAcceptedJob('farmer-agg', 'transport-agg');
  deliverJob(jobId, 'transport-agg');
  createReview(makeReq({ user: user('farmer-agg', 'FARMER'), params: { id: jobId }, body: { rating: 5 } }), makeRes(), noop);

  const res = makeRes();
  getTransporterReviews(makeReq({ user: user('any-viewer', 'FARMER'), params: { userId: 'transport-agg' } }), res, noop);
  assert.equal(statusOf(res), 200);
  assert.equal(bodyOf(res).data.average, 5);
  assert.equal(bodyOf(res).data.count, 1);
});

test('review: transporter reviews endpoint requires authentication', () => {
  const res = makeRes();
  getTransporterReviews(makeReq({ user: null, params: { userId: 'transport-agg' } }), res, noop);
  assert.equal(statusOf(res), 401);
});