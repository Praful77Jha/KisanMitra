import { apiGet, apiPost } from './apiClient';

// Fetch the full conversation for an order (oldest-first). Both order parties
// (buyer and seller) are allowed; anyone else is rejected by the server.
export async function fetchOrderMessages(orderId) {
  const response = await apiGet(`/chat/orders/${orderId}/messages`);
  if (response.success) {
    return Array.isArray(response.data) ? response.data : [];
  }
  throw new Error(response.message || 'Could not load messages');
}

// Send a message to the other party of an order. Both order parties may send.
export async function sendOrderMessage(orderId, body) {
  const response = await apiPost(`/chat/orders/${orderId}/messages`, { body });
  if (response.success && response.data) return response.data;
  throw new Error(response.message || 'Could not send message');
}
