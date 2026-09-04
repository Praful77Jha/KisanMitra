import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

function unwrap(response) {
  if (response.success && response.data) return response.data;
  throw new Error('Unexpected response');
}

export async function fetchOrderReviews(orderId) {
  const response = await apiGet(`/orders/${orderId}/reviews`);
  return unwrap(response);
}

export async function submitReview(orderId, payload) {
  const response = await apiPost(`/orders/${orderId}/reviews`, payload);
  return unwrap(response);
}

export async function updateReview(orderId, reviewId, payload) {
  const response = await apiPut(`/orders/${orderId}/reviews/${reviewId}`, payload);
  return unwrap(response);
}

export async function deleteReview(orderId, reviewId) {
  const response = await apiDelete(`/orders/${orderId}/reviews/${reviewId}`);
  return unwrap(response);
}

export async function fetchUserReviews(userId) {
  const response = await apiGet(`/users/${userId}/reviews`);
  return unwrap(response);
}
