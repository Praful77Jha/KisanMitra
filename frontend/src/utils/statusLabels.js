// Centralized localization helpers for backend value → display label.
//
// Only KNOWN, fixed-backend values are translated. Arbitrary user-entered text
// (free-text crop names such as "Wheat") is intentionally left as stored — we
// do not fake-translate free-form user data. Status/category values below come
// from fixed backend vocabularies, so a missing key falls back to the raw value
// rather than producing a broken translation.

const ORDER_STATUS_KEY = {
  'Order Confirmed': 'status.orderConfirmed',
  Preparing: 'status.preparing',
  Dispatched: 'status.dispatched',
  'In Transit': 'status.inTransit',
  'Out for Delivery': 'status.outForDelivery',
  Delivered: 'status.delivered',
  Cancelled: 'status.cancelled',
};

// Maps the stored English crop category label (e.g. "Grains") to its i18n key.
const CATEGORY_KEY = {
  Grains: 'categories.grains',
  Pulses: 'categories.pulses',
  Fruits: 'categories.fruits',
  Vegetables: 'categories.vegetables',
  Oilseeds: 'categories.oilseeds',
};

// Translate a backend order status / timeline step value via i18n. Unknown
// values (e.g. future statuses) are returned unchanged.
export function translateOrderStatus(status, t) {
  if (!status) return '';
  const key = ORDER_STATUS_KEY[status];
  return key ? t(key) : status;
}

// Translate a stored crop category label (English) to the active language.
// Unknown categories (user-entered) are returned unchanged.
export function translateCategory(category, t) {
  if (!category) return '';
  const key = CATEGORY_KEY[category] || CATEGORY_KEY[category.toLowerCase()];
  return key ? t(key) : category;
}
