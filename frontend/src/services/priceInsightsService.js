import { apiGet } from './apiClient';

// Fetches aggregate price insights derived from recorded order prices.
// Returns the response.data payload: { source, products, product, totals }.
export async function fetchPriceInsights(product) {
  const path = product
    ? `/price-insights?product=${encodeURIComponent(product)}`
    : '/price-insights';
  const response = await apiGet(path);
  if (response.success && response.data) {
    return {
      products: Array.isArray(response.data.products) ? response.data.products : [],
      totals: response.data.totals || { productCount: 0, orderCount: 0 },
    };
  }
  throw new Error(response.message || 'Could not load price insights');
}
