// KisanMitra API base URL.
//
// Resolved in order of priority:
//   1. process.env.EXPO_PUBLIC_API_BASE_URL  (set in frontend/.env or frontend/.env.local)
//   2. DEFAULT_API_BASE_URL below (used only when no env var is provided)
//
// Expo (SDK 49+) auto-loads .env / .env.local and inlines ONLY variables prefixed
// with EXPO_PUBLIC_ into the client bundle. A plain API_BASE_URL is NOT inlined.
//
// For a PHYSICAL Android device, localhost points at the phone itself, NOT the
// development PC. Point the app at the dev machine by setting, in .env.local:
//
//   EXPO_PUBLIC_API_BASE_URL=http://<PC-LAN-IP>:5000/api
//
// (.env.local is git-ignored and per-machine, so per-developer LAN IPs are not
// committed.) For Android EMULATOR use http://10.0.2.2:5000/api (host loopback).

const DEFAULT_API_BASE_URL = 'http://192.168.29.212:5000/api';

const API_BASE_URL =
  (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_BASE_URL) ||
  DEFAULT_API_BASE_URL;

export default API_BASE_URL;
