export const UNITS = {
  QUINTAL: { value: 'quintal', label: 'Quintal', short: 'Qtl' },
  KILOGRAM: { value: 'kg', label: 'Kilogram', short: 'kg' },
  TONNE: { value: 'tonne', label: 'Tonne', short: 'T' },
  SACK: { value: 'sack', label: 'Sack', short: 'Sack' },
};

export const CROP_CATEGORIES = [
  { key: 'grains', label: 'Grains' },
  { key: 'pulses', label: 'Pulses' },
  { key: 'fruits', label: 'Fruits' },
  { key: 'vegetables', label: 'Vegetables' },
  { key: 'oilseeds', label: 'Oilseeds' },
];

export const QUALITY_GRADES = ['A+', 'A', 'B', 'C'];

export const DEFAULT_LOCATION = 'Pune, Maharashtra';

export const DEAL_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
};

export const ORDER_STAGES = [
  'Order Confirmed',
  'Preparing',
  'Dispatched',
  'In Transit',
  'Out for Delivery',
  'Delivered',
];
