const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// transportValidation.js is a pure ES module (export syntax) while this project
// is CommonJS. Load it through node:vm so tests run with plain `node --test`.
function loadModule() {
  const filePath = path.join(__dirname, '..', 'src', 'utils', 'transportValidation.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const stripped = source
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+/gm, '')
    .trim();
  const wrapped = `${stripped}\n\nreturn { isValidRequiredBy, validateTransportRequest, validateTransportQuote, validateTransporterProfile, isValidTransportRating };`;
  // eslint-disable-next-line no-new-func
  return new Function(wrapped)();
}

const {
  isValidRequiredBy,
  validateTransportRequest,
  validateTransportQuote,
  validateTransporterProfile,
  isValidTransportRating,
} = loadModule();

test('isValidRequiredBy accepts real calendar dates and rejects impossible ones', () => {
  assert.equal(isValidRequiredBy('2026-09-10'), true);
  assert.equal(isValidRequiredBy('2024-02-29'), true); // leap year
  assert.equal(isValidRequiredBy(''), true); // optional field
  assert.equal(isValidRequiredBy(undefined), true);
  assert.equal(isValidRequiredBy(null), true);
  assert.equal(isValidRequiredBy('2026-13-01'), false);
  assert.equal(isValidRequiredBy('2025-02-29'), false); // not a leap year
  assert.equal(isValidRequiredBy('2026-9-10'), false); // must be zero-padded
  assert.equal(isValidRequiredBy('not-a-date'), false);
});

test('validateTransportRequest without t returns raw i18n keys', () => {
  const errors = validateTransportRequest({});
  assert.equal(errors.cropName, 'validation.cropRequired');
  assert.equal(errors.quantity, 'validation.quantityInvalid');
  assert.equal(errors.unit, 'validation.unitRequired');
  assert.equal(errors.pickupLocation, 'validation.pickupRequired');
  assert.equal(errors.dropLocation, 'validation.dropRequired');
});

test('validateTransportRequest flags an invalid required-by date', () => {
  const errors = validateTransportRequest({
    cropName: 'Wheat',
    quantity: '100',
    unit: 'Quintal',
    pickupLocation: 'Pune',
    dropLocation: 'Nashik',
    requiredBy: '2026-13-01',
  });
  assert.equal(errors.requiredBy, 'validation.invalidRequiredBy');
});

test('validateTransportRequest with t returns translated messages', () => {
  const errors = validateTransportRequest({}, (key) => `X:${key}`);
  assert.equal(errors.cropName, 'X:validation.cropRequired');
  assert.equal(errors.quantity, 'X:validation.quantityInvalid');
});

test('validateTransportRequest flags an invalid expected budget', () => {
  const errors = validateTransportRequest({
    cropName: 'Wheat',
    quantity: '100',
    unit: 'Quintal',
    pickupLocation: 'Pune',
    dropLocation: 'Nashik',
    expectedBudget: '0',
  });
  assert.equal(errors.expectedBudget, 'validation.budgetInvalid');
  assert.deepEqual(
    validateTransportRequest({
      cropName: 'Wheat',
      quantity: '100',
      unit: 'Quintal',
      pickupLocation: 'Pune',
      dropLocation: 'Nashik',
      expectedBudget: '2500',
    }),
    {}
  );
});

test('validateTransportRequest accepts a valid payload', () => {
  const errors = validateTransportRequest({
    cropName: 'Wheat',
    quantity: '100',
    unit: 'Quintal',
    pickupLocation: 'Pune',
    dropLocation: 'Nashik',
    requiredBy: '2026-09-20',
  });
  assert.deepEqual(errors, {});
});

test('validateTransportQuote validates the amount and optional distance', () => {
  const errors = validateTransportQuote({ quotedAmount: '0', distanceKm: '3' });
  assert.equal(errors.quotedAmount, 'validation.amountInvalid');
  assert.deepEqual(
    validateTransportQuote({ quotedAmount: '5500', vehicleType: 'Truck', distanceKm: '42' }),
    {}
  );
  assert.deepEqual(validateTransportQuote({ quotedAmount: '5500' }), {});
  assert.equal(
    validateTransportQuote({ quotedAmount: '1', distanceKm: '-3' }).distanceKm,
    'validation.distanceInvalid'
  );
});

test('validateTransportQuote with requireVehicleType enforces vehicleType', () => {
  const opts = { requireVehicleType: true };
  const missing = validateTransportQuote({ quotedAmount: '5500' }, undefined, opts);
  assert.equal(missing.vehicleType, 'validation.vehicleRequired');
  assert.equal(missing.quotedAmount, undefined);
  assert.deepEqual(
    validateTransportQuote({ quotedAmount: '5500', vehicleType: 'Truck' }, undefined, opts),
    {}
  );
  const empty = validateTransportQuote({ quotedAmount: '5500', vehicleType: '   ' }, undefined, opts);
  assert.equal(empty.vehicleType, 'validation.vehicleRequired');
});

test('validateTransportQuote with requireVehicleType still validates the amount', () => {
  const errors = validateTransportQuote({ quotedAmount: '' }, undefined, {
    requireVehicleType: true,
  });
  assert.equal(errors.quotedAmount, 'validation.amountInvalid');
  assert.equal(errors.vehicleType, 'validation.vehicleRequired');
});

test('validateTransportQuote with requireVehicleType and t translates the message', () => {
  const errors = validateTransportQuote({ quotedAmount: '100' }, (key) => `X:${key}`, {
    requireVehicleType: true,
  });
  assert.equal(errors.vehicleType, 'X:validation.vehicleRequired');
});

test('validateTransporterProfile requires vehicles and base location', () => {
  const errors = validateTransporterProfile({});
  assert.equal(errors.vehicleTypes, 'validation.profileVehicleRequired');
  assert.equal(errors.baseLocation, 'validation.baseLocationRequired');
  assert.deepEqual(
    validateTransporterProfile({ vehicleTypes: 'Truck', baseLocation: 'Pune' }),
    {}
  );
});

test('validateTransporterProfile validates an optional vehicle capacity', () => {
  const errors = validateTransporterProfile({
    vehicleTypes: 'Truck',
    baseLocation: 'Pune',
    vehicleCapacity: '-5',
  });
  assert.equal(errors.vehicleCapacity, 'validation.capacityInvalid');
  assert.deepEqual(
    validateTransporterProfile({
      vehicleTypes: 'Truck',
      baseLocation: 'Pune',
      vehicleCapacity: '12.5',
    }),
    {}
  );
  assert.deepEqual(
    validateTransporterProfile({ vehicleTypes: 'Truck', baseLocation: 'Pune', vehicleCapacity: '' }),
    {}
  );
});

test('isValidTransportRating accepts integers 1-5 only', () => {
  assert.equal(isValidTransportRating(5), true);
  assert.equal(isValidTransportRating(1), true);
  assert.equal(isValidTransportRating('4'), true);
  assert.equal(isValidTransportRating(0), false);
  assert.equal(isValidTransportRating(6), false);
  assert.equal(isValidTransportRating('4.5'), false);
  assert.equal(isValidTransportRating(3.7), false);
});