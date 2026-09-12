export function grossRevenue(pricePerUnit, quantity) {
  return pricePerUnit * quantity;
}

export function estimatedNetReturn(grossRevenue, transportCost, otherCosts) {
  return grossRevenue - transportCost - otherCosts;
}

export function totalDeliveredCost(pricePerUnit, transportCost, otherCosts) {
  return pricePerUnit + transportCost + otherCosts;
}

// Best-value pick used by the "Compare Deals" screen: the offer with the lowest
// delivered cost wins; a tie is broken by the higher deal score.
export function selectBestOffer(offers, totalCost = totalDeliveredCost) {
  if (!offers || offers.length === 0) return null;
  return [...offers].sort((a, b) => {
    const diff =
      totalCost(a.offeredPricePerQuintal, a.transportCostPerQuintal, a.otherCostsPerQuintal) -
      totalCost(b.offeredPricePerQuintal, b.transportCostPerQuintal, b.otherCostsPerQuintal);
    if (diff !== 0) return diff;
    return b.dealScore - a.dealScore;
  })[0];
}

export function rounding(value) {
  return Math.round(value);
}
