// Price Insights tests (Phase 4, POST-MVP).
//
// Run in NON-DATABASE mode: they exercise the pure price-insights service and
// the in-memory controller (reading the in-memory order store) without touching
// MySQL. All statistics are derived from real stored order prices; private
// order/user fields must never be leaked through the aggregate endpoint.

process.env.USE_DATABASE = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPriceStats } = require('../src/services/priceInsightsService');
const { getInsights } = require('../src/controllers/priceInsightsController');
const { createRequirement } = require('../src/controllers/requirementsController');
const { createOffer } = require('../src/controllers/offersController');
const { createOrder, orders } = require('../src/controllers/ordersController');

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

// Create a single in-memory order for a given crop/price between buyer and seller.
function createOrderFor(buyerId, sellerId, cropName, price) {
  const reqRes = makeRes();
  createRequirement(
    { user: { id: buyerId }, body: { cropName, quantity: 10, unit: 'Quintal', maxPricePerQuintal: price, location: 'Nashik' } },
    reqRes,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(reqRes), 201);
  const requirementId = bodyOf(reqRes).data.id;

  const offRes = makeRes();
  createOffer(
    { user: { id: sellerId, name: 'Seller' }, body: { requirementId, quantity: 10, unit: 'Quintal', offeredPricePerQuintal: price, transportCostPerQuintal: 5, otherCostsPerQuintal: 2 } },
    offRes,
    () => assert.fail('unexpected error')
  );
  assert.equal(statusOf(offRes), 201);
  const offerId = bodyOf(offRes).data.id;

  const ordRes = makeRes();
  createOrder({ user: { id: buyerId }, body: { requirementId, offerId } }, ordRes, () => assert.fail('unexpected error'));
  assert.equal(statusOf(ordRes), 201);
  return bodyOf(ordRes).data.id;
}

function getOrdersForProduct(name) {
  return orders.filter((o) => o && o.productName && o.productName.trim().toLowerCase() === name.toLowerCase());
}

test('buildPriceStats computes average/min/max/latest/history/count', () => {
  const stats = buildPriceStats([
    { productName: 'Corn', pricePerQuintal: 100, orderDate: '2026-01-01', unit: 'Quintal' },
    { productName: 'Corn', pricePerQuintal: 120, orderDate: '2026-02-01', unit: 'Quintal' },
    { productName: 'Corn', pricePerQuintal: 140, orderDate: '2026-03-01', unit: 'Quintal' },
  ]);
  assert.equal(stats.length, 1);
  const p = stats[0];
  assert.equal(p.name, 'Corn');
  assert.equal(p.count, 3);
  assert.equal(p.average, 120);
  assert.equal(p.min, 100);
  assert.equal(p.max, 140);
  assert.equal(p.latest, 140);
  assert.equal(p.sufficientHistory, true);
  assert.equal(p.trend, 'up');
  assert.equal(p.history.length, 3);
  assert.equal(p.history[0].price, 100);
  assert.equal(p.history[2].price, 140);
});

test('buildPriceStats detects a downward trend', () => {
  const stats = buildPriceStats([
    { productName: 'Corn', pricePerQuintal: 100, orderDate: '2026-01-01', unit: 'Quintal' },
    { productName: 'Corn', pricePerQuintal: 90, orderDate: '2026-02-01', unit: 'Quintal' },
    { productName: 'Corn', pricePerQuintal: 80, orderDate: '2026-03-01', unit: 'Quintal' },
  ]);
  assert.equal(stats[0].trend, 'down');
});

test('buildPriceStats detects a flat trend', () => {
  const stats = buildPriceStats([
    { productName: 'Corn', pricePerQuintal: 100, orderDate: '2026-01-01', unit: 'Quintal' },
    { productName: 'Corn', pricePerQuintal: 100, orderDate: '2026-02-01', unit: 'Quintal' },
    { productName: 'Corn', pricePerQuintal: 100, orderDate: '2026-03-01', unit: 'Quintal' },
  ]);
  assert.equal(stats[0].trend, 'flat');
});

test('insufficient data: fewer than 3 points yields insufficient trend', () => {
  const two = buildPriceStats([
    { productName: 'Corn', pricePerQuintal: 100, orderDate: '2026-01-01' },
    { productName: 'Corn', pricePerQuintal: 120, orderDate: '2026-02-01' },
  ]);
  assert.equal(two[0].sufficientHistory, true);
  assert.equal(two[0].trend, 'insufficient');

  const one = buildPriceStats([
    { productName: 'Corn', pricePerQuintal: 100, orderDate: '2026-01-01' },
  ]);
  assert.equal(one[0].sufficientHistory, false);
  assert.equal(one[0].trend, 'insufficient');
  assert.equal(one[0].average, 100);
  assert.equal(one[0].min, 100);
  assert.equal(one[0].max, 100);
});

test('empty data returns an empty product list', () => {
  const stats = buildPriceStats([]);
  assert.deepEqual(stats, []);
});

test('controller returns aggregated insights from recorded orders', () => {
  createOrderFor('pi-buyer-1', 'pi-seller-1', 'Tomato', 800);
  createOrderFor('pi-buyer-1', 'pi-seller-1', 'Tomato', 1000);
  createOrderFor('pi-buyer-1', 'pi-seller-1', 'Tomato', 900);

  const res = makeRes();
  getInsights({ query: {} }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  const data = bodyOf(res).data;
  assert.equal(data.source, 'orders');
  assert.ok(data.totals.orderCount > 0);

  const tomato = data.products.find((p) => p.name.toLowerCase() === 'tomato');
  assert.ok(tomato, 'tomato product present');
  assert.equal(tomato.average, 900);
  assert.equal(tomato.min, 800);
  assert.equal(tomato.max, 1000);
  assert.equal(tomato.count, 3);
  assert.ok(Array.isArray(tomato.history));
  assert.equal(tomato.history.length, 3);
});

test('controller never exposes private order/user fields', () => {
  const res = makeRes();
  getInsights({ query: {} }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  const data = bodyOf(res).data;
  for (const p of data.products) {
    const allowed = ['name', 'unit', 'count', 'average', 'min', 'max', 'latest', 'latestDate', 'trend', 'sufficientHistory', 'history'];
    for (const key of Object.keys(p)) {
      assert.ok(allowed.includes(key), `unexpected field leaked: ${key}`);
    }
    for (const point of p.history) {
      assert.deepEqual(Object.keys(point).sort(), ['date', 'price']);
    }
    assert.ok(!('orderId' in p));
    assert.ok(!('userId' in p));
    assert.ok(!('sellerUserId' in p));
    assert.ok(!('sellerName' in p));
    assert.ok(!('deliveryAddress' in p));
  }
  assert.ok(!('orders' in data));
});

test('product filter narrows results to the selected product', () => {
  createOrderFor('pi-buyer-2', 'pi-seller-2', 'Potato', 600);
  const res = makeRes();
  getInsights({ query: { product: 'Potato' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  const data = bodyOf(res).data;
  assert.equal(data.products.length, 1);
  assert.equal(data.product.name, 'Potato');
});

test('product filter is case-insensitive', () => {
  const res = makeRes();
  getInsights({ query: { product: 'tOmAtO' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  const data = bodyOf(res).data;
  assert.ok(data.products.some((p) => p.name.toLowerCase() === 'tomato'));
});

test('unknown product filter returns an empty result (not an error)', () => {
  const res = makeRes();
  getInsights({ query: { product: 'DoesNotExist' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  const data = bodyOf(res).data;
  assert.equal(data.products.length, 0);
  assert.equal(data.product, null);
});

test('invalid product filter is rejected', () => {
  for (const q of [{ product: '' }, { product: '   ' }, { product: 7 }]) {
    const res = makeRes();
    getInsights({ query: q }, res, () => assert.fail('unexpected error'));
    assert.equal(statusOf(res), 400, `product=${JSON.stringify(q.product)} should be rejected`);
  }
});

test('a single order still yields usable stats but insufficient trend', () => {
  // Tomato already has >=3 orders above; use a fresh product for the single case.
  createOrderFor('pi-buyer-3', 'pi-seller-3', 'Mango', 500);
  const mine = getOrdersForProduct('Mango');
  assert.equal(mine.length, 1);
  const res = makeRes();
  getInsights({ query: { product: 'Mango' } }, res, () => assert.fail('unexpected error'));
  assert.equal(statusOf(res), 200);
  const p = bodyOf(res).data.product;
  assert.equal(p.count, 1);
  assert.equal(p.trend, 'insufficient');
  assert.equal(p.sufficientHistory, false);
  assert.equal(p.average, 500);
});
