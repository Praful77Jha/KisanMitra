export const PRICE_UNIT = 'Quintal';

export const SAMPLE_NOTICE =
  'Prices below are from the app\'s sample catalog for demonstration. They are not real market or APMC rates.';

export function quintalListings(list) {
  return list.filter((p) => p.unit === PRICE_UNIT);
}

export function averageLoggedPrice(list) {
  const quintalOnly = quintalListings(list);
  if (quintalOnly.length === 0) return null;
  const sum = quintalOnly.reduce((acc, p) => acc + p.pricePerQuintal, 0);
  return sum / quintalOnly.length;
}

export function lowestLogged(list) {
  const quintalOnly = quintalListings(list);
  if (quintalOnly.length === 0) return null;
  return quintalOnly.reduce((best, p) =>
    p.pricePerQuintal < best.pricePerQuintal ? p : best
  );
}

export function highestLogged(list) {
  const quintalOnly = quintalListings(list);
  if (quintalOnly.length === 0) return null;
  return quintalOnly.reduce((best, p) =>
    p.pricePerQuintal > best.pricePerQuintal ? p : best
  );
}

export function highestDealScore(list) {
  if (list.length === 0) return null;
  return list.reduce((best, p) => (p.dealScore > best.dealScore ? p : best));
}

export function highestPriceIn(list) {
  return list.reduce((max, p) => Math.max(max, p.pricePerQuintal), 0);
}

function categoryStats(productsByCategory, categoryKey) {
  const list = productsByCategory[categoryKey] || [];
  return {
    key: categoryKey,
    label: categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1),
    count: list.length,
    quintalCount: quintalListings(list).length,
    avg: averageLoggedPrice(list),
    min: lowestLogged(list),
    max: highestLogged(list),
  };
}

export function buildCategorySummary(products, categories) {
  const productsByCategory = {};
  categories.forEach((c) => {
    productsByCategory[c.key] = products.filter(
      (p) => p.category.toLowerCase() === c.label.toLowerCase()
    );
  });
  return categories.map((c) => categoryStats(productsByCategory, c.key));
}
