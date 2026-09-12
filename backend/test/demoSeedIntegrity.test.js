// Demo seed data integrity + DB/in-memory parity tests.
//
// Verifies the shared demo catalog (backend/src/demo/demoData.js) feeds both the
// database seed and the in-memory API fallbacks identically:
//   - the requested crops/mandis are present with a primary reference date plus a
//     second dated batch (multi-date records),
//   - record keys are unique so re-seeding never creates duplicates,
//   - every product has at least two offers (so "Compare Deals" is demonstrable),
//   - the in-memory products/offers/market-prices controllers expose the same
//     records as the seed.
//
// Run: node --test test/demoSeedIntegrity.test.js

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

const { products, offers, marketPrices, MSAMB_DATE, DEMO_REQUIREMENT_IDS } = require('../src/demo/demoData');
const { products: productsController, getAllProducts } = require('../src/controllers/productsController');
const { offers: offersController, getOffersByProduct } = require('../src/controllers/offersController');
const marketPriceService = require('../src/services/marketPriceService');

function noop() {}

function makeRes() {
  let status = 200;
  let payload = null;
  return {
    status(code) { status = code; return this; },
    json(body) { payload = body; return this; },
    result() { return { status, payload }; },
  };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

test('demo products: unique ids, all assets mapped, positive prices', () => {
  const ids = products.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 6);
  for (const p of products) {
    assert.ok(p.name, 'product has a name');
    assert.ok(p.imageFile, `${p.id} has an imageFile so ProductCard renders`);
    assert.ok(Number(p.pricePerQuintal) > 0, `${p.id} has a positive price`);
  }
  // Every catalogued product must be demonstrable in "Compare Deals" (>=2 offers).
  const offerCountByProduct = new Map();
  for (const o of offers) offerCountByProduct.set(o.productId, (offerCountByProduct.get(o.productId) || 0) + 1);
  for (const p of products) {
    assert.ok(
      offerCountByProduct.get(p.id) >= 2,
      `${p.id} (${p.name}) has at least two offers for the comparison table`
    );
  }
});

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

test('demo offers: unique ids, valid product/requirement references, positive amounts', () => {
  const ids = offers.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
  const productIds = new Set(products.map((p) => p.id));
  const requirementIds = new Set(DEMO_REQUIREMENT_IDS);
  for (const o of offers) {
    assert.ok(productIds.has(o.productId), `${o.id} references an existing product`);
    if (o.requirementId) {
      assert.ok(requirementIds.has(o.requirementId), `${o.id} references a seeded requirement`);
    }
    assert.ok(Number(o.offeredPricePerQuintal) > 0, `${o.id} has a positive offered price`);
  }
});

// ---------------------------------------------------------------------------
// Market prices
// ---------------------------------------------------------------------------

test('demo market prices: requested crops and mandis, positive and unique', () => {
  assert.ok(marketPrices.length >= 5, 'has a useful number of price records');

  const keySet = new Set();
  for (const mp of marketPrices) {
    assert.ok(Number(mp.pricePerQtl) > 0, `${mp.cropName}/${mp.marketName} has a positive price`);
    const date = mp.referenceDate || MSAMB_DATE;
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/, 'reference dates are ISO dates');
    const key = `${mp.cropName}|${mp.marketName}|${date}`;
    assert.ok(!keySet.has(key), `duplicate market price record: ${key}`);
    keySet.add(key);
  }

  const crops = new Set(marketPrices.map((mp) => mp.cropName));
  for (const crop of ['Onion', 'Wheat', 'Tomato', 'Potato', 'Rice']) {
    assert.ok(crops.has(crop), `demo data includes ${crop}`);
  }

  const mandis = new Set(marketPrices.map((mp) => mp.marketName));
  for (const mandi of ['Lasalgaon', 'Pune', 'Nashik', 'Azadpur', 'Varanasi']) {
    assert.ok(mandis.has(mandi), `demo data includes ${mandi} mandi`);
  }

  // Multiple dated batches: at least one record differs from the primary date.
  const otherDates = marketPrices.filter((mp) => (mp.referenceDate || MSAMB_DATE) !== MSAMB_DATE);
  assert.ok(otherDates.length >= 1, 'demo data contains a second dated batch');
  for (const mp of otherDates) {
    assert.ok(!keySet.has(`${mp.cropName}|${mp.marketName}|${MSAMB_DATE}`), 'no duplicate card for a dated batch');
  }
});

// ---------------------------------------------------------------------------
// DB / in-memory parity
// ---------------------------------------------------------------------------

test('in-memory API exposes the identical demo catalog as the seed', async () => {
  // Products: same set of ids, same order.
  assert.deepEqual(
    productsController.map((p) => p.id),
    products.map((p) => p.id),
    'productsController mirrors demo products'
  );

  // Offers: same set of ids.
  assert.deepEqual(
    new Set(offersController.map((o) => o.id)),
    new Set(offers.map((o) => o.id)),
    'offersController mirrors demo offers'
  );

  // Market prices: same crops via the service's crop listing.
  const crops = await marketPriceService.listCrops();
  assert.ok(crops.includes('Tomato'));
  assert.ok(crops.includes('Potato'));
  assert.ok(crops.includes('Rice'));
  assert.ok(crops.includes('Onion'));
  assert.ok(crops.includes('Wheat'));

  // Market prices: matching filter behaviour for the requested crops.
  const onionRows = await marketPriceService.findByCrop('Onion');
  assert.ok(onionRows.length >= 8, 'Onion has multiple mandi records');
  assert.ok(onionRows.every((r) => r.source === 'MSAMB' && r.unit === 'Quintal'));

  const tomatoRows = await marketPriceService.findByCrop('Tomato');
  assert.equal(tomatoRows.length, marketPrices.filter((mp) => mp.cropName === 'Tomato').length);

  // getOffersByProduct returns >=2 offers for every demo product (status 200).
  for (const p of products) {
    const res = makeRes();
    await getOffersByProduct({ params: { productId: p.id }, user: { id: 'x', role: 'BUYER' } }, res, noop);
    assert.equal(res.result().status, 200, `getOffersByProduct responds for ${p.id}`);
    assert.equal(res.result().payload.data.length >= 2, true, `${p.id} has >=2 offers`);
  }
});

test('GET /api/products fallback endpoint works with demo data', async () => {
  const res = makeRes();
  const { USE_DATABASE } = require('../src/config/config');
  assert.equal(USE_DATABASE, false);
  await getAllProducts({}, res, (e) => { throw e; });
  assert.equal(res.result().status, 200);
  assert.equal(res.result().payload.success, true);
  assert.equal(res.result().payload.data.length, products.length);
});