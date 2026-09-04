export const TRANSPORT_MODES = [
  {
    key: 'tractor',
    label: 'Tractor-Trolley',
    ratePerKm: 55,
    loadingCharge: 350,
    capacityQtl: 10,
  },
  {
    key: 'mini',
    label: 'Mini Truck',
    ratePerKm: 85,
    loadingCharge: 500,
    capacityQtl: 6,
  },
  {
    key: 'truck',
    label: 'Truck',
    ratePerKm: 120,
    loadingCharge: 800,
    capacityQtl: 20,
  },
];

export function findTransportMode(key) {
  return TRANSPORT_MODES.find((mode) => mode.key === key) || null;
}

export function estimateLogistics({ distanceKm, quantity, modeKey }) {
  const mode = findTransportMode(modeKey);
  if (!mode || typeof mode.ratePerKm !== 'number') {
    return null;
  }

  const distance = Number(distanceKm) || 0;
  const quantityValue = Number(quantity) || 0;
  const freight = mode.ratePerKm * distance;
  const loading = mode.loadingCharge;
  const total = freight + loading;
  const perQuintal =
    quantityValue > 0 ? Math.round(total / quantityValue) : 0;

  return {
    modeKey: mode.key,
    modeLabel: mode.label,
    distanceKm: distance,
    quantity: quantityValue,
    ratePerKm: mode.ratePerKm,
    freight,
    loading,
    total,
    perQuintal,
  };
}

export function calculateEarnings({ pricePerQtl, distanceKm, quantity, modeKey, otherExpenses }) {
  const mode = findTransportMode(modeKey);
  if (!mode || distanceKm <= 0 || quantity <= 0) {
    return null;
  }

  const tripCost = (mode.ratePerKm * distanceKm) + mode.loadingCharge;
  const trips = Math.ceil(quantity / (mode.capacityQtl || 10));
  const transportCost = tripCost * trips;
  const transportPerQtl = Math.round(transportCost / quantity);
  const otherPerQtl = Math.round((Number(otherExpenses) || 0) / quantity);
  const amountPerQtl = pricePerQtl - transportPerQtl - otherPerQtl;
  const totalAmount = amountPerQtl * quantity;

  return {
    transportPerQtl,
    otherPerQtl,
    amountPerQtl,
    totalAmount,
    transportCost,
  };
}

export function computeRecommendations({
  cropName,
  quantity,
  distanceKm,
  modeKey,
  otherExpenses,
  buyerOffers,
  apmcMarkets,
}) {
  const qty = Number(quantity) || 0;
  const dist = Number(distanceKm) || 0;
  const expenses = Number(otherExpenses) || 0;
  if (!cropName || qty <= 0) return [];

  const options = [];

  (buyerOffers || []).forEach((offer) => {
    const pricePerQtl = Number(offer.offeredPricePerQuintal) || 0;
    if (pricePerQtl <= 0) return;

    let transportPerQtl;
    const offerTransport = Number(offer.transportCostPerQuintal);
    if (offerTransport > 0) {
      transportPerQtl = offerTransport;
    } else if (dist > 0) {
      const calc = calculateEarnings({ pricePerQtl, distanceKm: dist, quantity: qty, modeKey, otherExpenses: 0 });
      transportPerQtl = calc ? calc.transportPerQtl : 0;
    } else {
      transportPerQtl = 0;
    }

    const offerOther = Number(offer.otherCostsPerQuintal) || 0;
    const amountPerQtl = pricePerQtl - transportPerQtl - offerOther;
    if (amountPerQtl <= 0) return;

    options.push({
      id: offer.id,
      type: 'buyer_offer',
      name: offer.sellerName || 'Buyer',
      pricePerQtl,
      transportPerQtl,
      otherPerQtl: offerOther,
      amountPerQtl,
      totalAmount: amountPerQtl * qty,
      verified: offer.verified,
      sellerRating: offer.sellerRating,
      distanceKm: offer.distanceKm,
    });
  });

  (apmcMarkets || []).forEach((market) => {
    const pricePerQtl = Number(market.pricePerQtl) || 0;
    if (pricePerQtl <= 0) return;

    let transportPerQtl = 0;
    if (dist > 0) {
      const calc = calculateEarnings({ pricePerQtl, distanceKm: dist, quantity: qty, modeKey, otherExpenses: 0 });
      transportPerQtl = calc ? calc.transportPerQtl : 0;
    }

    const otherPerQtl = Math.round(expenses / qty);
    const amountPerQtl = pricePerQtl - transportPerQtl - otherPerQtl;
    if (amountPerQtl <= 0) return;

    options.push({
      id: `apmc-${market.marketName}`,
      type: 'apmc_market',
      name: market.marketName,
      pricePerQtl,
      transportPerQtl,
      otherPerQtl,
      amountPerQtl,
      totalAmount: amountPerQtl * qty,
      verified: false,
      sellerRating: null,
      distanceKm: null,
    });
  });

  options.sort((a, b) => b.totalAmount - a.totalAmount);
  return options;
}
