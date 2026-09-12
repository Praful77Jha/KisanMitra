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

// Quantity units offered in the Best Selling Option form. The recommendation
// maths runs per quintal (prices are per quintal everywhere in the app), so the
// user's chosen unit is converted to quintals before ranking.
export const QUANTITY_UNIT_OPTIONS = [
  { value: 'kg', labelKey: 'recommendation.quantityUnitKg', shortKey: 'recommendation.quantityUnitShortKg' },
  { value: 'quintal', labelKey: 'recommendation.quantityUnitQuintal', shortKey: 'recommendation.quantityUnitShortQuintal' },
  { value: 'tonne', labelKey: 'recommendation.quantityUnitTonne', shortKey: 'recommendation.quantityUnitShortTonne' },
  { value: 'sack', labelKey: 'recommendation.quantityUnitSack', shortKey: 'recommendation.quantityUnitShortSack' },
];

// Distance units for the transport estimate. Miles are converted to km before
// the per-km freight rate is applied.
export const DISTANCE_UNIT_OPTIONS = [
  { value: 'km', labelKey: 'recommendation.distanceUnitKm' },
  { value: 'mi', labelKey: 'recommendation.distanceUnitMi' },
];

// Canonical conversion factors into quintals (1 sack = 40 kg by convention).
const QUANTITY_TO_QUINTAL = { kg: 0.01, quintal: 1, tonne: 10, sack: 0.4 };
const DISTANCE_TO_KM = { km: 1, mi: 1.60934 };

export function quantityToQuintal(quantity, unit) {
  const factor = QUANTITY_TO_QUINTAL[unit];
  if (factor === undefined) return Number(quantity) || 0;
  return (Number(quantity) || 0) * factor;
}

export function quantityFromQuintal(quintals, unit) {
  const factor = QUANTITY_TO_QUINTAL[unit];
  if (factor === undefined) return quintals;
  return quintals / factor;
}

export function distanceToKm(distance, unit) {
  const factor = DISTANCE_TO_KM[unit];
  if (factor === undefined) return Number(distance) || 0;
  return (Number(distance) || 0) * factor;
}

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
  quantityUnit,
  distanceKm,
  distanceUnit,
  modeKey,
  otherExpenses,
  buyerOffers,
  apmcMarkets,
}) {
  const qty = quantityToQuintal(quantity, quantityUnit);
  const dist = distanceToKm(distanceKm, distanceUnit);
  const expenses = Number(otherExpenses) || 0;
  const usedQuantityUnit = quantityUnit || 'quintal';
  const usedDistanceUnit = distanceUnit || 'km';
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
      quantityUnit: usedQuantityUnit,
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
      quantityUnit: usedQuantityUnit,
      verified: false,
      sellerRating: null,
      distanceKm: null,
    });
  });

  options.sort((a, b) => b.totalAmount - a.totalAmount);
  return options;
}
