// Phase 8 production-readiness audit regression tests (in-memory store).
//
// These cover two confirmed defects in the in-memory offer path:
//   1. sellerRating / verified were trusted from the request body (a seller could
//      self-assert a rating and a "verified" badge). They must be server-derived
//      (neutral for a freshly submitted offer) and never taken from the client.
//   2. offerCount was updated transactionally in the DB path but NOT in the
//      in-memory path, so the two stores drifted. It must increment here too.

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRequirement } = require('../src/controllers/requirementsController');
const { createOffer } = require('../src/controllers/offersController');

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

function makeRequirementFor(buyerId) {
  const res = makeRes();
  createRequirement(
    { user: { id: buyerId }, body: { cropName: 'Tomato', quantity: 10, unit: 'Quintal', maxPricePerQuintal: 900, location: 'Nashik' } },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 201);
  return bodyOf(res).data;
}

test('createOffer ignores client-supplied sellerRating and verified (no self-assertion)', () => {
  const requirement = makeRequirementFor('reg-buyer-1');
  const res = makeRes();
  createOffer(
    {
      user: { id: 'reg-seller-1', name: 'Seller One' },
      // Malicious client tries to self-assert a high rating + a verified badge.
      body: {
        requirementId: requirement.id,
        quantity: 10,
        unit: 'Quintal',
        offeredPricePerQuintal: 850,
        sellerRating: 4.9,
        verified: true,
      },
    },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 201);
  const offer = bodyOf(res).data;
  // Both must be server-derived/neutral, never the client-supplied values.
  assert.equal(offer.sellerRating, null);
  assert.equal(offer.verified, false);
  assert.notEqual(offer.sellerRating, 4.9);
  assert.notEqual(offer.verified, true);
});

test('createOffer increments the requirement offerCount in memory (parity with DB path)', () => {
  const requirement = makeRequirementFor('reg-buyer-2');
  assert.equal(requirement.offerCount, 0);

  const res = makeRes();
  createOffer(
    {
      user: { id: 'reg-seller-2', name: 'Seller Two' },
      body: { requirementId: requirement.id, quantity: 10, unit: 'Quintal', offeredPricePerQuintal: 850 },
    },
    res,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(res), 201);
  // The requirement object is a shared reference; the counter must have advanced.
  assert.equal(requirement.offerCount, 1);
});
