import API_BASE_URL from '../config';
import { getToken } from './tokenStorage';
import { emitSessionExpired } from './authEvents';

const TIMEOUT_MS = 10000;

function isAuthEndpoint(path) {
  return path === '/auth/login' || path === '/auth/register';
}

function translateFetchError(error) {
  if (error && (error.name === 'AbortError' || (error.message && error.message === 'Aborted'))) {
    return new Error('Request timed out. Please check your connection and try again.');
  }
  if (error instanceof TypeError) {
    return new Error('Network error. Please check your internet connection and try again.');
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error('An unexpected error occurred. Please try again.');
}

function handleAuthFailure(path, status) {
  // A 401 on anything other than login/register means an invalid/expired token.
  if (status === 401 && !isAuthEndpoint(path)) {
    emitSessionExpired();
  }
}

async function buildHeaders() {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function apiPost(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);
    handleAuthFailure(path, response.status);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timer);
    throw translateFetchError(error);
  }
}

export async function apiGet(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: await buildHeaders(),
      signal: controller.signal,
    });

    clearTimeout(timer);
    handleAuthFailure(path, response.status);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timer);
    throw translateFetchError(error);
  }
}

async function apiSend(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: await buildHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);
    handleAuthFailure(path, response.status);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timer);
    throw translateFetchError(error);
  }
}

export function apiPut(path, body) {
  return apiSend('PUT', path, body);
}

export function apiPatch(path, body) {
  return apiSend('PATCH', path, body);
}

export function apiDelete(path) {
  return apiSend('DELETE', path);
}
