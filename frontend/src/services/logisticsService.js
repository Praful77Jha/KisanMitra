import { apiGet, apiPost, apiPut } from './apiClient';

export async function fetchLogistics(orderId) {
  const response = await apiGet(`/logistics/${orderId}`);
  if (response.success) {
    // data may be null (party, but no logistics record yet).
    return response.data ?? null;
  }
  throw new Error(response.message || 'Could not load logistics');
}

export async function initLogistics(orderId) {
  const response = await apiPost('/logistics', { orderId });
  if (response.success && response.data) return response.data;
  throw new Error(response.message || 'Could not create logistics record');
}

export async function updateLogisticsStatus(orderId, status) {
  const response = await apiPut(`/logistics/${orderId}`, { status });
  if (response.success && response.data) return response.data;
  throw new Error(response.message || 'Could not update logistics status');
}
