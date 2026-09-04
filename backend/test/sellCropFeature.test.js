// Tests for the Sell Crop feature (in-memory store).
//
//   POST /api/products (createProduct): lets an authenticated farmer list a crop
//   for sale. The seller identity always comes from the token (req.user), never
//   the body, so a posted crop is guaranteed to belong to the logged-in user
//   (sellerUserId). Once owned, the seller cannot make an offer on their own
//   product (createOffer -> 400).

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createProduct, getAllProducts } = require('../src/controllers/productsController');
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

function postCrop(user, body) {
  const res = makeRes();
  createProduct({ user, body }, res, () => assert.fail('unexpected error'));
  return res;
}

test('createProduct returns 201 and attaches the authenticated seller', () => {
  const res = postCrop(
    { id: 'farmer-a', name: 'Farmer A' },
    {
      name: 'Green Chilli',
      category: 'Vegetables',
      grade: 'A',
      quantity: 40,
      unit: 'Quintal',
      pricePerQuintal: 3200,
      location: 'Pimpalgaon, Nashik, Maharashtra',
      description: 'Freshly harvested',
    }
  );
  assert.equal(statusOf(res), 201);
  const product = bodyOf(res).data;
  // Identity comes from the token, never the body.
  assert.equal(product.sellerUserId, 'farmer-a');
  assert.equal(product.seller, 'Farmer A');
  // Fresh listings are stored neutral.
  assert.equal(product.verified, false);
  assert.equal(product.sellerRating, null);
  assert.equal(product.dealScore, 50);
});

test('createProduct rejects missing required fields with 400', () => {
  const res = postCrop(
    { id: 'farmer-b', name: 'Farmer B' },
    { category: 'Grains', quantity: 10, unit: 'Quintal', pricePerQuintal: 2000 }
  );
  assert.equal(statusOf(res), 400);
});

test('createProduct rejects a non-positive quantity with 400', () => {
  const res = postCrop(
    { id: 'farmer-c', name: 'Farmer C' },
    { name: 'Wheat', category: 'Grains', quantity: 0, unit: 'Quintal', pricePerQuintal: 2000 }
  );
  assert.equal(statusOf(res), 400);
});

test('createProduct rejects a non-positive price with 400', () => {
  const res = postCrop(
    { id: 'farmer-d', name: 'Farmer D' },
    { name: 'Wheat', category: 'Grains', quantity: 10, unit: 'Quintal', pricePerQuintal: -5 }
  );
  assert.equal(statusOf(res), 400);
});

test('a created crop appears in the product marketplace', () => {
  const res = postCrop(
    { id: 'farmer-e', name: 'Farmer E' },
    { name: 'Soybean', category: 'Oilseeds', quantity: 60, unit: 'Quintal', pricePerQuintal: 5400 }
  );
  assert.equal(statusOf(res), 201);
  const id = bodyOf(res).data.id;

  const listRes = makeRes();
  getAllProducts({}, listRes, () => assert.fail('unexpected error'));
  assert.equal(statusOf(listRes), 200);
  assert.equal(bodyOf(listRes).data.some((p) => p.id === id), true);
});

test('the seller cannot make an offer on their own product (400)', () => {
  const res = postCrop(
    { id: 'farmer-f', name: 'Farmer F' },
    { name: 'Tur Dal', category: 'Pulses', quantity: 30, unit: 'Quintal', pricePerQuintal: 8000 }
  );
  assert.equal(statusOf(res), 201);
  const productId = bodyOf(res).data.id;

  const offerRes = makeRes();
  createOffer(
    { user: { id: 'farmer-f', name: 'Farmer F' }, body: { productId, quantity: 5, unit: 'Quintal', offeredPricePerQuintal: 7800 } },
    offerRes,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(offerRes), 400);
  assert.equal(bodyOf(offerRes).success, false);
});

test('a different user can still make an offer on the seller\'s product (201)', () => {
  const res = postCrop(
    { id: 'farmer-g', name: 'Farmer G' },
    { name: 'Onion', category: 'Vegetables', quantity: 50, unit: 'Quintal', pricePerQuintal: 1800 }
  );
  assert.equal(statusOf(res), 201);
  const productId = bodyOf(res).data.id;

  const offerRes = makeRes();
  createOffer(
    { user: { id: 'buyer-z', name: 'Buyer Z' }, body: { productId, quantity: 5, unit: 'Quintal', offeredPricePerQuintal: 1700 } },
    offerRes,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(offerRes), 201);
  assert.equal(bodyOf(offerRes).data.productId, productId);
});
