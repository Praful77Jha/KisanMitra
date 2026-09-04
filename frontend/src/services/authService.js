import { apiPost, apiGet, apiPatch } from './apiClient';

export async function register({ name, phone, password }) {
  const response = await apiPost('/auth/register', { name, phone, password });
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
