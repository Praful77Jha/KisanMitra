const DEFAULT_API_BASE_URL =
  'https://kisanmitra-production-884a.up.railway.app/api';

const API_BASE_URL =
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.EXPO_PUBLIC_API_BASE_URL) ||
  DEFAULT_API_BASE_URL;

export default API_BASE_URL;