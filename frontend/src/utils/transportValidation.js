// Client-side validation for the transport module forms. The backend performs
// the authoritative validation; these helpers give inline feedback only. Each
// validator returns an object of { field: errorText } — empty means valid.
// When no `t` function is passed the error keys are returned directly so the
// helpers stay trivially testable.

// Accepts 'YYYY-MM-DD' with a real calendar date. Empty value is allowed (the
// field is optional).
export function isValidRequiredBy(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return true;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function error(t, key) {
  return t ? t(key) : key;
}

export function validateTransportRequest(
  { cropName, quantity, unit, pickupLocation, dropLocation, requiredBy, expectedBudget },
  t,
) {
  const errors = {};
  if (!String(cropName || '').trim()) {
    errors.cropName = error(t, 'validation.cropRequired');
  }
  const qty = Number(quantity);
  if (quantity === undefined || quantity === null || quantity === '' || !Number.isFinite(qty) || qty <= 0) {
    errors.quantity = error(t, 'validation.quantityInvalid');
  }
  if (!String(unit || '').trim()) {
    errors.unit = error(t, 'validation.unitRequired');
  }
  if (!String(pickupLocation || '').trim()) {
    errors.pickupLocation = error(t, 'validation.pickupRequired');
  }
  if (!String(dropLocation || '').trim()) {
    errors.dropLocation = error(t, 'validation.dropRequired');
  }
  if (!isValidRequiredBy(requiredBy)) {
    errors.requiredBy = error(t, 'validation.invalidRequiredBy');
  }
  if (expectedBudget !== undefined && expectedBudget !== null && expectedBudget !== '') {
    const budget = Number(expectedBudget);
    if (!Number.isFinite(budget) || budget <= 0) {
      errors.expectedBudget = error(t, 'validation.budgetInvalid');
    }
  }
  return errors;
}

export function validateTransportQuote(
  { quotedAmount, vehicleType, distanceKm },
  t,
  { requireVehicleType = false } = {},
) {
  const errors = {};
  const amount = Number(quotedAmount);
  if (quotedAmount === undefined || quotedAmount === null || quotedAmount === '' || !Number.isFinite(amount) || amount <= 0) {
    errors.quotedAmount = error(t, 'validation.amountInvalid');
  }
  if (requireVehicleType && !String(vehicleType || '').trim()) {
    errors.vehicleType = error(t, 'validation.vehicleRequired');
  }
  if (distanceKm !== undefined && distanceKm !== null && distanceKm !== '') {
    const distance = Number(distanceKm);
    if (!Number.isFinite(distance) || distance < 0) {
      errors.distanceKm = error(t, 'validation.distanceInvalid');
    }
  }
  return errors;
}

export function validateTransporterProfile({ vehicleTypes, baseLocation, vehicleCapacity }, t) {
  const errors = {};
  if (!String(vehicleTypes || '').trim()) {
    errors.vehicleTypes = error(t, 'validation.profileVehicleRequired');
  }
  if (!String(baseLocation || '').trim()) {
    errors.baseLocation = error(t, 'validation.baseLocationRequired');
  }
  if (vehicleCapacity !== undefined && vehicleCapacity !== null && vehicleCapacity !== '') {
    const capacity = Number(vehicleCapacity);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      errors.vehicleCapacity = error(t, 'validation.capacityInvalid');
    }
  }
  return errors;
}

// Rating is an integer between 1 and 5 (the backend enforces the same rule).
export function isValidTransportRating(rating) {
  const numeric = Number(rating);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 5;
}