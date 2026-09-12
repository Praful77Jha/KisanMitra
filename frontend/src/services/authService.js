import { apiPost, apiGet, apiPatch } from './apiClient';

export async function register({ name, phone, password, role }) {
  const payload = { name, phone, password };
  if (role) payload.role = role;
  const response = await apiPost('/auth/register', payload);
  return response;
}

export async function login({ phone, password }) {
  const response = await apiPost('/auth/login', { phone, password });
  return response;
}

export async function getMe() {
  const response = await apiGet('/auth/me');
  return response;
}

export async function updateLocation(location) {
  const response = await apiPatch('/users/me', { location });
  return response;
}
