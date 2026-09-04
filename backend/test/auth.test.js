// Auth registration/login regression tests.
//
// These tests exercise the auth controller (register, login, me) with a mocked
// Prisma-backed user store so they can run without a live MySQL instance.
//
// Run: node --test test/auth.test.js

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

// ---------------------------------------------------------------------------
// In-memory Prisma mock backed by a simple Map
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
      const record = { id, name: data.name, phone: data.phone, passwordHash: data.passwordHash, createdAt: new Date() };
      users.set(id, record);
      return record;
    },
  },
};

// Inject the mock into the require cache BEFORE loading userService/authController.
const prismaPath = require.resolve('../src/config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock };

// Clear any previously cached userService so it picks up the mocked prisma.
const userServicePath = require.resolve('../src/services/userService');
delete require.cache[userServicePath];

const { register, login, me } = require('../src/controllers/authController');

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
  return { body: {}, headers: {}, params: {}, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('register: creates a new user and returns 201 with safe user (no passwordHash)', async () => {
  const res = makeRes();
  await register(
    makeReq({ body: { name: 'Ravi Kumar', phone: '9000000001', password: 'secret123' } }),
    res,
    (err) => { throw err; }
  );

  assert.equal(statusOf(res), 201);
  const body = bodyOf(res);
  assert.equal(body.success, true);
  assert.ok(body.data);
  assert.equal(body.data.name, 'Ravi Kumar');
  assert.equal(body.data.phone, '9000000001');
  assert.equal(body.data.passwordHash, undefined, 'passwordHash must not be exposed');
});

test('register: rejects duplicate phone with 409', async () => {
  const res = makeRes();
  await register(
    makeReq({ body: { name: 'Duplicate', phone: '9000000001', password: 'pass123' } }),
    res,
    (err) => { throw err; }
  );

  assert.equal(statusOf(res), 409);
  const body = bodyOf(res);
  assert.equal(body.success, false);
  assert.ok(body.message.includes('already exists'));
});

test('register: rejects missing fields with 400', async () => {
  const res = makeRes();
  await register(
    makeReq({ body: { name: 'NoPhone', password: 'pass123' } }),
    res,
    (err) => { throw err; }
  );

  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).success, false);
});

test('register: rejects empty body with 400', async () => {
  const res = makeRes();
  await register(makeReq({ body: {} }), res, (err) => { throw err; });

  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).success, false);
});

test('login: authenticates valid credentials and returns token + safe user', async () => {
  // First register a user (seeded above in duplicate test)
  const res = makeRes();
  await login(
    makeReq({ body: { phone: '9000000001', password: 'secret123' } }),
    res,
    (err) => { throw err; }
  );

  assert.equal(statusOf(res), 200);
  const body = bodyOf(res);
  assert.equal(body.success, true);
  assert.ok(body.data.token, 'should return a JWT token');
  assert.ok(body.data.user);
  assert.equal(body.data.user.phone, '9000000001');
  assert.equal(body.data.user.passwordHash, undefined, 'passwordHash must not be exposed');
});

test('login: rejects wrong password with 401', async () => {
  const res = makeRes();
  await login(
    makeReq({ body: { phone: '9000000001', password: 'wrongpass' } }),
    res,
    (err) => { throw err; }
  );

  assert.equal(statusOf(res), 401);
  assert.equal(bodyOf(res).success, false);
});

test('login: rejects non-existent phone with 401', async () => {
  const res = makeRes();
  await login(
    makeReq({ body: { phone: '9999999999', password: 'pass123' } }),
    res,
    (err) => { throw err; }
  );

  assert.equal(statusOf(res), 401);
  assert.equal(bodyOf(res).success, false);
});

test('login: rejects missing fields with 400', async () => {
  const res = makeRes();
  await login(
    makeReq({ body: { phone: '9000000001' } }),
    res,
    (err) => { throw err; }
  );

  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).success, false);
});

test('me: returns the authenticated user', async () => {
  const res = makeRes();
  await me(
    makeReq({ user: { id: 'cuid-1', phone: '9000000001' } }),
    res,
    (err) => { throw err; }
  );

  assert.equal(statusOf(res), 200);
  const body = bodyOf(res);
  assert.equal(body.success, true);
  assert.equal(body.data.phone, '9000000001');
  assert.equal(body.data.passwordHash, undefined);
});

test('me: returns 404 for non-existent user', async () => {
  const res = makeRes();
  await me(
    makeReq({ user: { id: 'cuid-999', phone: '0000000000' } }),
    res,
    (err) => { throw err; }
  );

  assert.equal(statusOf(res), 404);
  assert.equal(bodyOf(res).success, false);
});
