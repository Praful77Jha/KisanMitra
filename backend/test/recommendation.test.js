// Smart Selling Recommendation — computeRecommendations unit tests.
//
// Loads the actual production source (frontend/src/utils/logistics.js) via
// Node's vm module (the file is a pure ES module with no imports), so these
// tests exercise the real implementation — not a copy.
//
// Run: node --test test/recommendation.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'logistics.js');
const source = fs.readFileSync(sourcePath, 'utf8');

// The frontend source is a pure ES module (no imports). Transform the `export`
// keywords to CommonJS so the real implementation can run inside a vm sandbox.
const cjsSource = source
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ');

const sandbox = { module: { exports: {} }, exports: {} };
sandbox.module.exports = sandbox.exports;
vm.createContext(sandbox);
vm.runInContext(
  `${cjsSource}\nmodule.exports = { TRANSPORT_MODES, findTransportMode, estimateLogistics, calculateEarnings, computeRecommendations };`,
  sandbox
);

const {
  TRANSPORT_MODES,
  computeRecommendations,
  calculateEarnings,
} = sandbox.module.exports;

// ---------------------------------------------------------------------------
// Shared fixtures (mirror the user's worked example: Onion, 50 qtl, 90 km,
// tractor, ₹4525/qtl, ₹800 other expenses → ₹530 transport/qtl,
// ₹3,979 net/qtl, ₹1,98,950 total)
// ---------------------------------------------------------------------------
const APMC_ONION = [
  { cropName: 'Onion', marketName: 'Lasalgaon', pricePerQtl: 4525 },
  { cropName: 'Onion', marketName: 'Solapur', pricePerQtl: 3400 },
  { cropName: 'Onion', marketName: 'Ahmednagar', pricePerQtl: 3100 },
];

const BUYER_OFFERS = [
  {
    id: 'o1',
    sellerName: 'AgroMart Traders',
    offeredPricePerQuintal: 4200,
    transportCostPerQuintal: 400,
    otherCostsPerQuintal: 20,
    distanceKm: 12,
    verified: true,
    sellerRating: 4.6,
  },
  {
    id: 'o2',
    sellerName: 'FreshBuy',
    offeredPricePerQuintal: 3800,
    transportCostPerQuintal: null,
    otherCostsPerQuintal: 0,
    distanceKm: null,
    verified: false,
    sellerRating: null,
  },
];

test('computeRecommendations: ranks options by totalAmount descending', () => {
  const result = computeRecommendations({
    cropName: 'Onion',
    quantity: 50,
    distanceKm: 90,
    modeKey: 'tractor',
    otherExpenses: 800,
    buyerOffers: BUYER_OFFERS,
    apmcMarkets: APMC_ONION,
  });
  assert.ok(result.length >= 2);
  for (let i = 1; i < result.length; i += 1) {
    assert.ok(result[i - 1].totalAmount >= result[i].totalAmount, `option ${i} out of order`);
  }
});

test('computeRecommendations: empty input returns []', () => {
  const result = computeRecommendations({
    cropName: 'Onion',
    quantity: 50,
    distanceKm: 90,
    modeKey: 'tractor',
    otherExpenses: 0,
    buyerOffers: [],
    apmcMarkets: [],
  });
  assert.equal(result.length, 0);
});

test('computeRecommendations: missing crop or invalid quantity returns []', () => {
  const opts = { quantity: 50, distanceKm: 90, modeKey: 'tractor', buyerOffers: BUYER_OFFERS, apmcMarkets: APMC_ONION };
  assert.equal(computeRecommendations({ ...opts, cropName: '' }).length, 0);
  assert.equal(computeRecommendations({ ...opts, quantity: -3 }).length, 0);
  assert.equal(computeRecommendations({ ...opts, quantity: 0 }).length, 0);
});

test('computeRecommendations: single option is returned as the best option', () => {
  const result = computeRecommendations({
    cropName: 'Onion',
    quantity: 50,
    distanceKm: 90,
    modeKey: 'tractor',
    otherExpenses: 0,
    buyerOffers: [],
    apmcMarkets: [APMC_ONION[0]],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Lasalgaon');
  assert.equal(result[0].type, 'apmc_market');
});

test('computeRecommendations: APMC market matches the worked example', () => {
  const result = computeRecommendations({
    cropName: 'Onion',
    quantity: 50,
    distanceKm: 90,
    modeKey: 'tractor',
    otherExpenses: 800,
    buyerOffers: [],
    apmcMarkets: [APMC_ONION[0]],
  });
  assert.equal(result.length, 1);
  const r = result[0];
  assert.equal(r.pricePerQtl, 4525);
  assert.equal(r.transportPerQtl, 530);
  assert.equal(r.otherPerQtl, 16);
  assert.equal(r.amountPerQtl, 4525 - 530 - 16);
  assert.equal(r.amountPerQtl, 3979);
  assert.equal(r.totalAmount, 3979 * 50);
  assert.equal(r.totalAmount, 198950);
});

test('computeRecommendations: buyer offer uses stored transport and other costs', () => {
  const result = computeRecommendations({
    cropName: 'Onion',
    quantity: 50,
    distanceKm: 90,
    modeKey: 'tractor',
    otherExpenses: 800,
    buyerOffers: [BUYER_OFFERS[0]],
    apmcMarkets: [],
  });
  assert.equal(result.length, 1);
  const r = result[0];
  assert.equal(r.type, 'buyer_offer');
  assert.equal(r.name, 'AgroMart Traders');
  assert.equal(r.pricePerQtl, 4200);
  assert.equal(r.transportPerQtl, 400);
  assert.equal(r.otherPerQtl, 20);
  assert.equal(r.amountPerQtl, 4200 - 400 - 20);
  assert.equal(r.amountPerQtl, 3780);
  assert.equal(r.totalAmount, 3780 * 50);
});

test('computeRecommendations: buyer offer falls back to farmer distance and calculateEarnings when transport missing', () => {
  const result = computeRecommendations({
    cropName: 'Onion',
    quantity: 50,
    distanceKm: 90,
    modeKey: 'tractor',
    otherExpenses: 0,
    buyerOffers: [BUYER_OFFERS[1]],
    apmcMarkets: [],
  });
  assert.equal(result.length, 1);
  const r = result[0];
  // distanceKm is null → falls back to farmer distance (90 km), tractor:
  // tripCost = 55*90 + 350 = 5300, trips = ceil(50/10) = 5 → 530/qtl
  const manual = calculateEarnings({ pricePerQtl: 3800, distanceKm: 90, quantity: 50, modeKey: 'tractor', otherExpenses: 0 });
  assert.equal(r.transportPerQtl, manual.transportPerQtl);
  assert.equal(r.transportPerQtl, 530);
  assert.equal(r.amountPerQtl, 3800 - 530);
});

test('computeRecommendations: APMC market includes farmer other expenses per quintal', () => {
  const result = computeRecommendations({
    cropName: 'Onion',
    quantity: 25,
    distanceKm: 45,
    modeKey: 'truck',
    otherExpenses: 1000,
    buyerOffers: [],
    apmcMarkets: [APMC_ONION[0]],
  });
  assert.equal(result.length, 1);
  const r = result[0];
  assert.equal(r.otherPerQtl, 40); // 1000 / 25
});

test('computeRecommendations: non-positive earnings are excluded', () => {
  const result = computeRecommendations({
    cropName: 'Onion',
    quantity: 50,
    distanceKm: 90,
    modeKey: 'truck',
    otherExpenses: 250000,
    buyerOffers: [],
    apmcMarkets: APMC_ONION,
  });
  // Other expenses (₹5000/qtl) make every APMC net amount ≤ 0 → nothing ranked
  assert.equal(result.length, 0);
});

test('computeRecommendations: missing distance yields transport 0 for APMC but still ranks', () => {
  const result = computeRecommendations({
    cropName: 'Onion',
    quantity: 50,
    distanceKm: 0,
    modeKey: 'tractor',
    otherExpenses: 0,
    buyerOffers: [],
    apmcMarkets: APMC_ONION,
  });
  assert.equal(result.length, 3);
  result.forEach((r) => assert.equal(r.transportPerQtl, 0));
});

test('computeRecommendations: identifies the highest-earning option as best across both sources', () => {
  const result = computeRecommendations({
    cropName: 'Onion',
    quantity: 50,
    distanceKm: 90,
    modeKey: 'tractor',
    otherExpenses: 800,
    buyerOffers: BUYER_OFFERS,
    apmcMarkets: APMC_ONION,
  });
  assert.ok(result.length >= 4);
  // Lasalgaon (₹3,979/qtl) must rank above lower markets and both buyers
  assert.equal(result[0].name, 'Lasalgaon');
  assert.equal(result[0].type, 'apmc_market');
  const sortedAmounts = result.map((r) => r.amountPerQtl);
  assert.equal(sortedAmounts[0], Math.max(...sortedAmounts));
});

test('computeRecommendations: verify transportCost via calculateEarnings matches vehicle-trip logic', () => {
  const manual = calculateEarnings({ pricePerQtl: 4525, distanceKm: 90, quantity: 50, modeKey: 'tractor', otherExpenses: 800 });
  assert.equal(manual.transportPerQtl, 530);
  assert.equal(manual.otherPerQtl, 16);
  assert.equal(manual.amountPerQtl, 3979);
  assert.equal(manual.totalAmount, 198950);
});