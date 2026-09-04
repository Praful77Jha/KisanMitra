// Frontend apiClient error-handling regression tests.
//
// Validates that translateFetchError (frontend/src/services/apiClient.js)
// correctly converts raw fetch/AbortController errors into user-facing
// messages, while preserving intentional API error messages.
//
// Because apiClient.js uses ES module syntax and React Native imports, this
// test extracts the pure translateFetchError logic and exercises it directly,
// plus simulates the full apiPost catch-chain to verify end-to-end behavior.
//
// Run: node --test test/apiClient.errorHandling.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Replicate translateFetchError from frontend/src/services/apiClient.js
// (must stay in sync with the production source)
// ---------------------------------------------------------------------------
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

// Verify the replica matches production (fail loudly if someone changes the
// source but forgets to update this test file).
const fs = require('fs');
const pathMod = require('path');
const apiClientSource = fs.readFileSync(
  pathMod.join(__dirname, '..', '..', 'frontend', 'src', 'services', 'apiClient.js'),
  'utf8'
);
// Extract the production translateFetchError function body
const fnStart = apiClientSource.indexOf('function translateFetchError(error)');
const fnEndMarker = "return new Error('An unexpected error occurred. Please try again.');";
const fnEnd = apiClientSource.indexOf(fnEndMarker, fnStart) + fnEndMarker.length;
// Find the closing brace after that
let braceCount = 0;
let closingIdx = fnEnd;
for (let i = apiClientSource.indexOf('{', fnStart); i <= apiClientSource.length; i++) {
  if (apiClientSource[i] === '{') braceCount++;
  if (apiClientSource[i] === '}') {
    braceCount--;
    if (braceCount === 0) { closingIdx = i + 1; break; }
  }
}
const productionFnBody = apiClientSource.substring(fnStart, closingIdx);
const normalizedProduction = productionFnBody.replace(/\s+/g, ' ').trim();
const normalizedReplica = translateFetchError.toString().replace(/\s+/g, ' ').trim();
if (normalizedProduction !== normalizedReplica) {
  throw new Error(
    'translateFetchError replica in this test does not match production source.\n' +
    'Production: ' + normalizedProduction + '\n' +
    'Replica:    ' + normalizedReplica
  );
}

// ---------------------------------------------------------------------------
// Simulate the apiPost catch-chain: translateFetchError → throw
// This mirrors what apiClient.js does:
//   } catch (error) { clearTimeout(timer); throw translateFetchError(error); }
// ---------------------------------------------------------------------------
function simulateApiCatch(error) {
  try {
    throw translateFetchError(error);
  } catch (translated) {
    return translated;
  }
}

// ===========================================================================
// translateFetchError unit tests
// ===========================================================================

test('translateFetchError: AbortError with name property → timeout message', () => {
  const abortError = new DOMException('The operation was aborted.', 'AbortError');
  const result = translateFetchError(abortError);
  assert.ok(result instanceof Error);
  assert.equal(result.message, 'Request timed out. Please check your connection and try again.');
});

test('translateFetchError: error with raw "Aborted" message → timeout message', () => {
  const rawAborted = new Error('Aborted');
  const result = translateFetchError(rawAborted);
  assert.ok(result instanceof Error);
  assert.equal(result.message, 'Request timed out. Please check your connection and try again.');
});

test('translateFetchError: TypeError (network failure) → network error message', () => {
  const typeErr = new TypeError('Failed to fetch');
  const result = translateFetchError(typeErr);
  assert.ok(result instanceof Error);
  assert.equal(result.message, 'Network error. Please check your internet connection and try again.');
});

test('translateFetchError: intentional API error (Error with message) → preserved as-is', () => {
  const apiError = new Error('User with this phone already exists');
  const result = translateFetchError(apiError);
  assert.ok(result instanceof Error);
  assert.equal(result.message, 'User with this phone already exists');
  assert.equal(result, apiError, 'should return the same Error instance');
});

test('translateFetchError: HTTP fallback error → preserved as-is', () => {
  const httpError = new Error('HTTP 500');
  const result = translateFetchError(httpError);
  assert.equal(result, httpError);
});

test('translateFetchError: 400 validation error → preserved as-is', () => {
  const valError = new Error('name, phone, and password are required');
  const result = translateFetchError(valError);
  assert.equal(result.message, 'name, phone, and password are required');
});

test('translateFetchError: non-Error thrown value (string) → generic safe message', () => {
  const result = translateFetchError('some raw string error');
  assert.ok(result instanceof Error);
  assert.equal(result.message, 'An unexpected error occurred. Please try again.');
});

test('translateFetchError: non-Error thrown value (object) → generic safe message', () => {
  const result = translateFetchError({ code: 123, detail: 'internal thing' });
  assert.ok(result instanceof Error);
  assert.equal(result.message, 'An unexpected error occurred. Please try again.');
});

test('translateFetchError: null → generic safe message', () => {
  const result = translateFetchError(null);
  assert.ok(result instanceof Error);
  assert.equal(result.message, 'An unexpected error occurred. Please try again.');
});

test('translateFetchError: undefined → generic safe message', () => {
  const result = translateFetchError(undefined);
  assert.ok(result instanceof Error);
  assert.equal(result.message, 'An unexpected error occurred. Please try again.');
});

test('translateFetchError: never returns a value that is not an Error instance', () => {
  const inputs = [
    new DOMException('abort', 'AbortError'),
    new Error('Aborted'),
    new TypeError('network'),
    new Error('API message'),
    new Error('HTTP 400'),
    'string',
    42,
    null,
    undefined,
    { obj: true },
    false,
  ];
  for (const input of inputs) {
    const result = translateFetchError(input);
    assert.ok(
      result instanceof Error,
      `translateFetchError(${String(input)}) should return an Error, got ${typeof result}`
    );
  }
});

// ===========================================================================
// Simulated apiPost catch-chain tests
// ===========================================================================

test('apiPost catch-chain: AbortError becomes user-friendly timeout error', () => {
  const abortError = new DOMException('The operation was aborted.', 'AbortError');
  const thrown = simulateApiCatch(abortError);
  assert.equal(thrown.message, 'Request timed out. Please check your connection and try again.');
});

test('apiPost catch-chain: "Aborted" message becomes user-friendly timeout error', () => {
  const thrown = simulateApiCatch(new Error('Aborted'));
  assert.equal(thrown.message, 'Request timed out. Please check your connection and try again.');
});

test('apiPost catch-chain: network TypeError becomes user-friendly network error', () => {
  const thrown = simulateApiCatch(new TypeError('Network request failed'));
  assert.equal(thrown.message, 'Network error. Please check your internet connection and try again.');
});

test('apiPost catch-chain: API error message is preserved for user display', () => {
  const thrown = simulateApiCatch(new Error('User with this phone already exists'));
  assert.equal(thrown.message, 'User with this phone already exists');
});

test('apiPost catch-chain: missing-fields error is preserved', () => {
  const thrown = simulateApiCatch(new Error('name, phone, and password are required'));
  assert.equal(thrown.message, 'name, phone, and password are required');
});

test('apiPost catch-chain: raw "Aborted" never leaks to caller', () => {
  const abortError = new DOMException('The operation was aborted.', 'AbortError');
  const thrown = simulateApiCatch(abortError);
  assert.notEqual(thrown.message, 'Aborted');
  assert.notEqual(thrown.message, 'The operation was aborted.');
  assert.ok(thrown.message.includes('timed out'));
});

test('apiPost catch-chain: raw TypeError message never leaks to caller', () => {
  const thrown = simulateApiCatch(new TypeError('Failed to fetch'));
  assert.notEqual(thrown.message, 'Failed to fetch');
  assert.ok(thrown.message.includes('Network error'));
});

// ===========================================================================
// Simulated AuthContext error propagation test
// ===========================================================================

test('AuthContext register: translated error.message is displayed on RegisterScreen', () => {
  // Simulate the RegisterScreen catch block:
  //   catch (error) { setSubmitError(error.message || t('errors.registrationFailed')); }
  const abortError = new DOMException('The operation was aborted.', 'AbortError');
  const translated = translateFetchError(abortError);
  const displayedMessage = translated.message || 'Registration failed';
  assert.equal(displayedMessage, 'Request timed out. Please check your connection and try again.');
  assert.notEqual(displayedMessage, 'Aborted');
});

test('AuthContext register: API duplicate-phone error is displayed on RegisterScreen', () => {
  const apiError = new Error('User with this phone already exists');
  const translated = translateFetchError(apiError);
  const displayedMessage = translated.message || 'Registration failed';
  assert.equal(displayedMessage, 'User with this phone already exists');
});

test('AuthContext register: null error falls back to registration failed', () => {
  const translated = translateFetchError(null);
  // RegisterScreen: error.message || t('errors.registrationFailed')
  // Since translated is an Error with message, it uses the message
  const displayedMessage = translated.message || 'Registration failed';
  assert.equal(displayedMessage, 'An unexpected error occurred. Please try again.');
});

// ===========================================================================
// 401 / session-expiry behavior (not changed by this fix)
// ===========================================================================

test('translateFetchError: does not interfere with 401 session-expiry flow', () => {
  // handleAuthFailure fires BEFORE the !response.ok check throws.
  // The 401 error itself is a normal Error thrown by the !response.ok path.
  // translateFetchError should pass it through unchanged.
  const error401 = new Error('Invalid or expired token');
  const result = translateFetchError(error401);
  assert.equal(result, error401, '401 error must pass through unchanged');
});

test('handleAuthFailure: isAuthEndpoint correctly identifies login/register', () => {
  // Replicate isAuthEndpoint from apiClient.js
  function isAuthEndpoint(path) {
    return path === '/auth/login' || path === '/auth/register';
  }
  assert.equal(isAuthEndpoint('/auth/login'), true);
  assert.equal(isAuthEndpoint('/auth/register'), true);
  assert.equal(isAuthEndpoint('/auth/me'), false);
  assert.equal(isAuthEndpoint('/products'), false);
});
