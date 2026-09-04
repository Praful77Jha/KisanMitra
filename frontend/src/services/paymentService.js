import { apiGet, apiPost } from './apiClient';

export async function getPayment(orderId) {
  const response = await apiGet(`/orders/${orderId}/payment`);
  if (response.success && response.data) return response.data;
  throw new Error(response.message || 'Could not load payment');
}

export async function initiatePayment(orderId) {
  const response = await apiPost(`/orders/${orderId}/payment/initiate`, {});
  if (response.success && response.data) return response.data;
  throw new Error(response.message || 'Could not start payment');
}

export async function confirmPayment(orderId) {
  // The amount is always derived server-side from the stored order; the client
  // never sends an amount.
  const response = await apiPost(`/orders/${orderId}/payment/confirm`, {});
  if (response.success && response.data) return response.data;
  throw new Error(response.message || 'Could not complete payment');
}

export async function cancelPayment(orderId) {
  const response = await apiPost(`/orders/${orderId}/payment/cancel`, {});
  if (response.success && response.data) return response.data;
  throw new Error(response.message || 'Could not cancel payment');
}
