// Upload endpoint hardening tests (pre-final-build QA).
//
// POST /api/upload now requires authentication (verifyToken middleware on the
// route). These tests assert the 401 gate at the middleware level (the same
// middleware the route mounts) and the handler behaviour for an authenticated
// request: valid images are persisted under /uploads with a server-generated
// name, invalid payloads are rejected, and the client filename is never trusted
// beyond an extension hint.
//
// Run: node --test test/uploads.test.js

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { verifyToken } = require('../src/middlewares/auth');
const { signToken } = require('../src/utils/jwt');
const { uploadImage, UPLOADS_DIR } = require('../src/controllers/uploadsController');

// A valid 1x1 transparent PNG (smallest realistic image payload).
const PNG_1PX_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

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

test('upload: an unauthenticated request is rejected before the handler (401)', () => {
  const res = makeRes();
  verifyToken({ headers: {} }, res, () => assert.fail('must not reach the upload handler'));
  assert.equal(statusOf(res), 401);
});

test('upload: an invalid token is rejected (401)', () => {
  const res = makeRes();
  verifyToken({ headers: { authorization: 'Bearer not.a.valid.token' } }, res, () => assert.fail('must not reach the upload handler'));
  assert.equal(statusOf(res), 401);
});

test('upload: a valid token passes the gate with the user attached', () => {
  const token = signToken({ id: 'upload-user-4', phone: '9000000099' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  let reached = false;
  verifyToken(req, makeRes(), () => { reached = true; });
  assert.equal(reached, true);
  assert.equal(req.user.id, 'upload-user-4');
});

test('upload: an authenticated request uploads a valid image and persists it under /uploads', () => {
  const res = makeRes();
  uploadImage(
    { user: { id: 'upload-user-1' }, body: { fileName: 'crop.png', base64: PNG_1PX_BASE64 } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 201);
  const url = bodyOf(res).data.url;
  assert.match(url, /^\/uploads\/crop-[a-zA-Z0-9-]+\.png$/, 'server-generated unique name');
  const filePath = path.join(UPLOADS_DIR, path.basename(url));
  assert.equal(fs.existsSync(filePath), true, 'image persisted under the uploads directory');
  try {
    fs.rmSync(filePath, { force: true });
  } catch (error) {
    // clean up best-effort so the test leaves no residue
  }
});

test('upload: a malformed base64 payload is rejected (400)', () => {
  const res = makeRes();
  uploadImage(
    { user: { id: 'upload-user-2' }, body: { fileName: 'crop.png', base64: 'not-valid-base64!' } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 400);
  assert.equal(bodyOf(res).success, false);
});

test('upload: a mismatched client extension hint is rejected (400)', () => {
  const res = makeRes();
  uploadImage(
    { user: { id: 'upload-user-3' }, body: { fileName: 'crop.jpg', base64: PNG_1PX_BASE64 } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 400);
});

test('upload: a non-image payload is rejected (400)', () => {
  const res = makeRes();
  const text = Buffer.from('2026 pre-build QA upload guard').toString('base64');
  uploadImage(
    { user: { id: 'upload-user-5' }, body: { fileName: 'note.txt', base64: text } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 400);
});