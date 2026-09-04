// Regression tests for PATCH /api/users/me (update signed-in user's location).
//
// Uses the same mocked-Prisma style as other backend tests so it runs without a
// live MySQL instance. Run: node --test test/usersUpdateLocation.test.js

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// In-memory Prisma mock backed by a simple Map
// ---------------------------------------------------------------------------
const users = new Map();

const prismaMock = {
  user: {
    update: async ({ where, data }) => {
      const record = users.get(where.id);
      if (!record) throw new Error('Record not found');
      const updated = { ...record, ...data };
      users.set(where.id, updated);
      return updated;
    },
  },
};

// Inject the mock into the require cache BEFORE loading userService.
const prismaPath = require.resolve('../src/config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock };

// Load the userService (picks up the mocked prisma) and the controller handler.
const userServicePath = require.resolve('../src/services/userService');
delete require.cache[userServicePath];
const { updateLocation } = require('../src/controllers/usersController');

// Unauthenticated guard used on the route.
const verifyToken = require('../src/middlewares/auth').verifyToken;

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('PATCH /users/me: updates the signed-in user location and returns safe user', async () => {
  users.clear();
  users.set('user-1', { id: 'user-1', name: 'A Farmer', phone: '9000000001', passwordHash: 'x', location: null });

  const res = makeRes();
  await updateLocation(
    { user: { id: 'user-1' }, body: { location: 'Pimpalgaon, Nashik, Maharashtra' } },
    res,
    (err) => { throw err; }
  );

  assert.equal(statusOf(res), 200);
  const body = bodyOf(res);
  assert.equal(body.success, true);
  assert.equal(body.data.location, 'Pimpalgaon, Nashik, Maharashtra');
  assert.equal(body.data.passwordHash, undefined, 'passwordHash must not be exposed');
  assert.equal(users.get('user-1').location, 'Pimpalgaon, Nashik, Maharashtra');
});

test('PATCH /users/me: rejects missing/blank location with 400', async () => {
  users.clear();
  users.set('user-1', { id: 'user-1', name: 'A Farmer', phone: '9000000001', passwordHash: 'x', location: null });

  const res = makeRes();
  await updateLocation(
    { user: { id: 'user-1' }, body: { location: '   ' } },
    res,
    (err) => { throw err; }
  );

  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).success, false);
});

test('PATCH /users/me: trims and caps location at 120 chars', async () => {
  users.clear();
  users.set('user-1', { id: 'user-1', name: 'A Farmer', phone: '9000000001', passwordHash: 'x', location: null });

  const long = 'x'.repeat(300);
  const res = makeRes();
  await updateLocation(
    { user: { id: 'user-1' }, body: { location: `  ${long}  ` } },
    res,
    (err) => { throw err; }
  );

  assert.equal(statusOf(res), 200);
  const saved = users.get('user-1').location;
  assert.equal(saved.length, 120);
  assert.ok(!saved.startsWith(' '));
});

test('PATCH /users/me: is gated behind verifyToken (no Authorization header → 401)', async () => {
  const res = makeRes();
  await verifyToken({ headers: {} }, res, () => {});
  assert.equal(statusOf(res), 401);
  assert.equal(bodyOf(res).success, false);
});
