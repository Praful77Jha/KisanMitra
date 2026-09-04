export const TRANSPORT_MODES = [
  {
    key: 'tractor',
    label: 'Tractor-Trolley',
    ratePerKm: 55,
    loadingCharge: 350,
  },
  {
    key: 'mini',
    label: 'Mini Truck',
    ratePerKm: 85,
    loadingCharge: 500,
  },
  {
    key: 'truck',
    label: 'Truck',
    ratePerKm: 120,
    loadingCharge: 800,
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
