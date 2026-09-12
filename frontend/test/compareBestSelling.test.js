const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Pure-utility tests for the "Compare Deals" and "Best Selling Option" features:
//   - compare: selectBestOffer / totalDeliveredCost (utils/calculation.js)
//   - best selling: computeRecommendations (utils/logistics.js)
// Both modules are dependency-free, so the same loadModule() transformation used
// by the other frontend tests strips the ES import/export syntax and evaluates
// the functions under node --test.

function loadModule(relPath, exportNames) {
  const filePath = path.join(__dirname, '..', 'src', relPath);
  const source = fs.readFileSync(filePath, 'utf8');
  const stripped = source
    .replace(/^import\s+[^\n]+\n?/m, '')
    .replace(/^export\s+/gm, '')
    .trim();
  const names = exportNames.join(', ');
  const wrapped = `${stripped}\n\nreturn { ${names} };`;
  // eslint-disable-next-line no-new-func
  return new Function(wrapped)();
}

const calculation = loadModule('utils/calculation.js', [
  'totalDeliveredCost',
  'selectBestOffer',
  'grossRevenue',
  'estimatedNetReturn',
  'rounding',
]);
const logistics = loadModule('utils/logistics.js', [
  'computeRecommendations',
  'estimateLogistics',
  'calculateEarnings',
  'findTransportMode',
  'TRANSPORT_MODES',
  'quantityToQuintal',
  'quantityFromQuintal',
  'distanceToKm',
  'QUANTITY_UNIT_OPTIONS',
  'DISTANCE_UNIT_OPTIONS',
]);

// ---------------------------------------------------------------------------
// Compare Deals
// ---------------------------------------------------------------------------

test('selectBestOffer returns null for an empty or missing list', () => {
  assert.equal(calculation.selectBestOffer([]), null);
  assert.equal(calculation.selectBestOffer(undefined), null);
  assert.equal(calculation.selectBestOffer(null), null);
});

test('selectBestOffer picks the offer with the lowest delivered cost', () => {
  const offers = [
    { id: 'a', offeredPricePerQuintal: 4400, transportCostPerQuintal: 50, otherCostsPerQuintal: 20, dealScore: 91 },
    // 4470 delivered, cheapest wins even though offered price is higher than b.
    { id: 'b', offeredPricePerQuintal: 4200, transportCostPerQuintal: 300, otherCostsPerQuintal: 80, dealScore: 60 },
    // 4580 delivered.
    { id: 'c', offeredPricePerQuintal: 4500, transportCostPerQuintal: 120, otherCostsPerQuintal: 35, dealScore: 84 },
  ];
  assert.equal(calculation.selectBestOffer(offers).id, 'a');
});

test('selectBestOffer breaks delivered-cost ties by the higher deal score', () => {
  const offers = [
    { id: 'low', offeredPricePerQuintal: 4400, transportCostPerQuintal: 50, otherCostsPerQuintal: 20, dealScore: 72 },
    { id: 'high', offeredPricePerQuintal: 4400, transportCostPerQuintal: 50, otherCostsPerQuintal: 20, dealScore: 91 },
  ];
  assert.equal(calculation.selectBestOffer(offers).id, 'high');
});

test('selectBestOffer does not mutate the input order', () => {
  const offers = [
    { id: 'x', offeredPricePerQuintal: 5000, transportCostPerQuintal: 0, otherCostsPerQuintal: 0, dealScore: 50 },
    { id: 'y', offeredPricePerQuintal: 4000, transportCostPerQuintal: 0, otherCostsPerQuintal: 0, dealScore: 50 },
  ];
  calculation.selectBestOffer(offers);
  assert.deepEqual(offers.map((o) => o.id), ['x', 'y']);
});

test('totalDeliveredCost is offered + transport + other costs', () => {
  assert.equal(calculation.totalDeliveredCost(4400, 50, 20), 4470);
});

// ---------------------------------------------------------------------------
// Best Selling Option (SmartRecommendation)
// ---------------------------------------------------------------------------

test('computeRecommendations returns an empty list without a crop or quantity', () => {
  assert.deepEqual(logistics.computeRecommendations({ quantity: 10 }), []);
  assert.deepEqual(logistics.computeRecommendations({ cropName: 'Onion', quantity: 0 }), []);
  assert.deepEqual(logistics.computeRecommendations({ cropName: 'Onion', quantity: -5 }), []);
});

test('computeRecommendations ranks every option by estimated total amount (desc)', () => {
  const options = logistics.computeRecommendations({
    cropName: 'Onion',
    quantity: 100,
    distanceKm: 50,
    modeKey: 'mini',
    otherExpenses: 500,
    buyerOffers: [
      { id: 'b1', sellerName: 'Buyer A', offeredPricePerQuintal: 3500, transportCostPerQuintal: 0, otherCostsPerQuintal: 30, verified: true, sellerRating: 4.5, distanceKm: 10 },
    ],
    apmcMarkets: [
      { marketName: 'Lasalgaon', pricePerQtl: 4525 },
      { marketName: 'Pune', pricePerQtl: 3500 },
    ],
  });

  assert.ok(options.length >= 3, 'buyer offers and APMC markets all become options');
  for (let i = 1; i < options.length; i += 1) {
    assert.ok(options[i - 1].totalAmount >= options[i].totalAmount, 'sorted by totalAmount descending');
  }

  const apmcLasalgaon = options.find((o) => o.type === 'apmc_market' && o.name === 'Lasalgaon');
  assert.ok(apmcLasalgaon, 'Lasalgaon APMC market appears as an option');
  assert.equal(apmcLasalgaon.amountPerQtl > 0, true);
  assert.equal(apmcLasalgaon.verified, false);
});

test('computeRecommendations subtracts transport and other expenses per quintal', () => {
  const options = logistics.computeRecommendations({
    cropName: 'Wheat',
    quantity: 50,
    distanceKm: 100,
    modeKey: 'truck',
    otherExpenses: 250,           // 250/50 = 5 per qtl
    buyerOffers: [
      { id: 'b1', offeredPricePerQuintal: 2400, transportCostPerQuintal: 90, otherCostsPerQuintal: 10 },
    ],
    apmcMarkets: [{ marketName: 'Nashik', pricePerQtl: 2450 }],
  });

  const buyer = options.find((o) => o.id === 'b1');
  assert.equal(buyer.amountPerQtl, 2400 - 90 - 10);

  const apmc = options.find((o) => o.type === 'apmc_market');
  // Market option pays transport (distance-based) + shares the other expenses.
  assert.ok(apmc.transportPerQtl > 0, 'market option subtracts distance transport');
  assert.equal(apmc.otherPerQtl, 5);
  assert.equal(apmc.totalAmount, (2450 - apmc.transportPerQtl - 5) * 50);
});

test('computeRecommendations skips not-positive prices', () => {
  const options = logistics.computeRecommendations({
    cropName: 'Tur',
    quantity: 10,
    distanceKm: 0,
    modeKey: 'truck',
    otherExpenses: 0,
    buyerOffers: [
      { id: 'zero', offeredPricePerQuintal: 0, transportCostPerQuintal: 0, otherCostsPerQuintal: 0 },
      { id: 'good', offeredPricePerQuintal: 8200, transportCostPerQuintal: 210, otherCostsPerQuintal: 40 },
    ],
    apmcMarkets: [{ marketName: 'Empty', pricePerQtl: 0 }],
  });
  assert.deepEqual(options.map((o) => o.id), ['good']);
});

test('computeRecommendations buyer offer uses its own transport when present and positive', () => {
  const options = logistics.computeRecommendations({
    cropName: 'Onion',
    quantity: 10,
    distanceKm: 500, // far -> distance-based transport would be large
    modeKey: 'truck',
    otherExpenses: 0,
    buyerOffers: [
      { id: 'near', offeredPricePerQuintal: 3500, transportCostPerQuintal: 25, otherCostsPerQuintal: 0 },
    ],
    apmcMarkets: [],
  });
  assert.equal(options[0].transportPerQtl, 25, 'uses the buyer-declared transport, not distance');
});

// ---------------------------------------------------------------------------
// Best Selling Option: quantity and distance unit selectors
// ---------------------------------------------------------------------------

test('quantity units convert to quintals before ranking (kg, tonne, sack)', () => {
  const base = {
    cropName: 'Wheat',
    modeKey: 'truck',
    otherExpenses: 0,
    distanceKm: 0, // no distance transport -> totals isolate the unit conversion
    buyerOffers: [
      { id: 'b1', offeredPricePerQuintal: 5000, transportCostPerQuintal: 0, otherCostsPerQuintal: 0 },
    ],
    apmcMarkets: [],
  };

  // 90 kg == 0.9 quintals.
  const kg = logistics.computeRecommendations({ ...base, quantity: 90, quantityUnit: 'kg' });
  const ql = logistics.computeRecommendations({ ...base, quantity: 0.9 });
  assert.equal(kg[0].totalAmount, ql[0].totalAmount);

  // 1 tonne == 10 quintals.
  const tonne = logistics.computeRecommendations({ ...base, quantity: 1, quantityUnit: 'tonne' });
  const tonneQl = logistics.computeRecommendations({ ...base, quantity: 10 });
  assert.equal(tonne[0].totalAmount, tonneQl[0].totalAmount);

  // 90 sacks (40 kg each) == 36 quintals.
  const sacks = logistics.computeRecommendations({ ...base, quantity: 90, quantityUnit: 'sack' });
  const sacksQl = logistics.computeRecommendations({ ...base, quantity: 36 });
  assert.equal(sacks[0].totalAmount, sacksQl[0].totalAmount);

  // 90 quintals stays itself.
  const quintal = logistics.computeRecommendations({ ...base, quantity: 90, quantityUnit: 'quintal' });
  const quintalQl = logistics.computeRecommendations({ ...base, quantity: 90 });
  assert.equal(quintal[0].totalAmount, quintalQl[0].totalAmount);
});

test('options carry the quantity unit used so the UI can display totals in it', () => {
  const options = logistics.computeRecommendations({
    cropName: 'Onion',
    quantity: 1,
    quantityUnit: 'tonne',
    distanceKm: 50,
    modeKey: 'mini',
    otherExpenses: 0,
    buyerOffers: [
      { id: 'b1', offeredPricePerQuintal: 3000, transportCostPerQuintal: 0, otherCostsPerQuintal: 0 },
    ],
    apmcMarkets: [{ marketName: 'Pune', pricePerQtl: 3000 }],
  });
  assert.ok(options.length >= 2);
  for (const option of options) {
    assert.equal(option.quantityUnit, 'tonne');
  }
});

test('unit conversion helpers default to quintals/kilometres and handle unknown units', () => {
  assert.equal(logistics.quantityToQuintal(5, undefined), 5);
  assert.equal(logistics.quantityToQuintal(5, 'bogus'), 5);
  assert.equal(logistics.distanceToKm(80, undefined), 80);
  assert.equal(logistics.distanceToKm(80, 'bogus'), 80);

  assert.equal(logistics.quantityToQuintal(90, 'kg'), 0.9);
  assert.equal(logistics.quantityToQuintal(1, 'tonne'), 10);
  assert.equal(logistics.quantityToQuintal(90, 'sack'), 36);
  assert.equal(logistics.quantityToQuintal(90, 'quintal'), 90);
  assert.equal(logistics.quantityFromQuintal(0.9, 'kg'), 90);
  assert.equal(logistics.quantityFromQuintal(36, 'sack'), 90);
  assert.equal(logistics.distanceToKm(80, 'mi'), 80 * 1.60934);
});

test('distance in miles is converted to km before the transport estimate', () => {
  const base = {
    cropName: 'Wheat',
    quantity: 10,
    modeKey: 'truck', // ratePerKm 120, loadingCharge 800
    otherExpenses: 0,
    buyerOffers: [
      { id: 'b1', offeredPricePerQuintal: 5000, transportCostPerQuintal: 0, otherCostsPerQuintal: 0 },
    ],
    apmcMarkets: [],
  };

  const km = logistics.computeRecommendations({ ...base, distanceKm: 80, distanceUnit: 'km' });
  assert.equal(km[0].transportPerQtl, 1040, '80 km: (120*80 + 800) / 10 = 1040');

  const mi = logistics.computeRecommendations({ ...base, distanceKm: 80, distanceUnit: 'mi' });
  assert.equal(mi[0].transportPerQtl, 1625, '80 mi ~= 128.75 km -> (120*128.75 + 800) / 10 rounded');
  assert.ok(mi[0].totalAmount < km[0].totalAmount, 'miles cost more to carry than kilometres');
});

test('computeRecommendations stays empty for invalid/empty inputs even with units', () => {
  const base = { buyerOffers: [], apmcMarkets: [] };
  assert.deepEqual(logistics.computeRecommendations({ ...base, cropName: 'Wheat', quantity: '', quantityUnit: 'kg' }), []);
  assert.deepEqual(logistics.computeRecommendations({ ...base, cropName: 'Wheat', quantity: 0, quantityUnit: 'tonne' }), []);
  assert.deepEqual(logistics.computeRecommendations({ ...base, cropName: '', quantity: 10, quantityUnit: 'sack' }), []);
  assert.deepEqual(logistics.computeRecommendations({ ...base, cropName: 'Wheat', quantity: -2, quantityUnit: 'kg' }), []);
});

test('unit selectors expose the four quantity units and two distance units', () => {
  assert.deepEqual(logistics.QUANTITY_UNIT_OPTIONS.map((u) => u.value), ['kg', 'quintal', 'tonne', 'sack']);
  assert.deepEqual(logistics.DISTANCE_UNIT_OPTIONS.map((u) => u.value), ['km', 'mi']);
});