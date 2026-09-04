export function grossRevenue(pricePerUnit, quantity) {
  return pricePerUnit * quantity;
}

export function estimatedNetReturn(grossRevenue, transportCost, otherCosts) {
  return grossRevenue - transportCost - otherCosts;
}

export function totalDeliveredCost(pricePerUnit, transportCost, otherCosts) {
  return pricePerUnit + transportCost + otherCosts;
}

export function rounding(value) {
  return Math.round(value);
}
