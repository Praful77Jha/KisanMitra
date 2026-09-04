import { apiGet } from './apiClient';

// Fetches MSAMB reference market prices. Optional `crop` filter narrows to a
// single crop. Returns the response.data payload:
// { source, referenceDate, prices, crops, totals }.
export async function fetchMarketPrices(crop) {
  const path = crop
    ? `/market-prices?crop=${encodeURIComponent(crop)}`
    : '/market-prices';
  const response = await apiGet(path);
  if (response.success && response.data) {
    return {
      source: response.data.source || 'MSAMB',
      referenceDate: response.data.referenceDate || null,
      prices: Array.isArray(response.data.prices) ? response.data.prices : [],
      crops: Array.isArray(response.data.crops) ? response.data.crops : [],
      totals: response.data.totals || { cropCount: 0, priceCount: 0 },
    };
  }
  throw new Error(response.message || 'Could not load market prices');
}
