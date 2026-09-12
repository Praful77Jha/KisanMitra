const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// offerActions.js is a pure ES module (export syntax) while this project is
// CommonJS. Load it through node:vm so tests run with plain `node --test`
// and no Babel / new testing framework.
function loadOfferActions() {
  const filePath = path.join(__dirname, '..', 'src', 'utils', 'offerActions.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const stripped = source
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+/gm, '')
    .trim();
  const wrapped = `${stripped}\n\nreturn { resolveOfferSelectAction };`;
  // eslint-disable-next-line no-new-func
  const mod = new Function(wrapped)();
  return mod;
}

const { resolveOfferSelectAction } = loadOfferActions();

test('product-only offer (no requirementId) returns notice', () => {
  assert.deepEqual(
    resolveOfferSelectAction({ id: 'o7', productId: 'p1', requirementId: null }, new Set(['r1'])),
    { type: 'notice' }
  );
  assert.deepEqual(
    resolveOfferSelectAction({ id: 'o8', productId: 'p1' }, new Set(['r1'])),
    { type: 'notice' }
  );
});

test('offer with empty-string requirementId returns notice', () => {
  assert.deepEqual(
    resolveOfferSelectAction({ id: 'o9', requirementId: '' }, new Set(['r9'])),
    { type: 'notice' }
  );
});

test('requirement-linked + owned offer returns confirm', () => {
  const owned = new Set(['r1', 'r2']);
  assert.deepEqual(
    resolveOfferSelectAction({ id: 'o1', requirementId: 'r1' }, owned),
    { type: 'confirm' }
  );
  assert.deepEqual(
    resolveOfferSelectAction({ id: 'o2', requirementId: 'r2', productId: 'p1' }, owned),
    { type: 'confirm' }
  );
});

test('requirement-linked + NOT owned offer returns notice', () => {
  assert.deepEqual(
    resolveOfferSelectAction({ id: 'o1', requirementId: 'r1' }, new Set(['other-requirement'])),
    { type: 'notice' }
  );
  assert.deepEqual(resolveOfferSelectAction({ id: 'o1', requirementId: 'r1' }, new Set()), {
    type: 'notice',
  });
});

test('null offer returns notice and never navigates', () => {
  assert.deepEqual(resolveOfferSelectAction(null, new Set(['r1'])), { type: 'notice' });
  assert.deepEqual(resolveOfferSelectAction(undefined, new Set(['r1'])), { type: 'notice' });
});

test('undefined ownership set returns notice (safe fallback)', () => {
  assert.deepEqual(resolveOfferSelectAction({ id: 'o1', requirementId: 'r1' }), { type: 'notice' });
  assert.deepEqual(resolveOfferSelectAction({ id: 'o1', requirementId: 'r1' }, null), {
    type: 'notice',
  });
});