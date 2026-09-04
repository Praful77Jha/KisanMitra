import { apiGet, apiPut } from './apiClient';

export async function fetchNotifications() {
  const response = await apiGet('/notifications');
  return response.data ?? [];
}

export async function fetchUnreadCount() {
  const response = await apiGet('/notifications/unread-count');
  return response.data?.unread ?? 0;
}

export async function markNotificationRead(id) {
  const response = await apiPut('/notifications/read', { id });
  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await apiPut('/notifications/read', {});
  return response.data;
}
