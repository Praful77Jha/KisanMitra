let sessionExpiredHandler = null;

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
}

export function clearSessionExpiredHandler() {
  sessionExpiredHandler = null;
}

export function emitSessionExpired() {
  if (typeof sessionExpiredHandler === 'function') {
    sessionExpiredHandler();
  }
}

export default { setSessionExpiredHandler, clearSessionExpiredHandler, emitSessionExpired };
