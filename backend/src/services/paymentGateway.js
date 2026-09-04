const { PAYMENT_GATEWAY } = require('../config/config');

// Payment gateway adapter (Phase 5).
//
// DEVELOPMENT-ONLY: The built-in "mock" gateway simulates a charge so the
// payment state machine can be exercised end to end. It is clearly labelled as
// development-only and is NOT a real payment provider. No real money moves.
// A production deployment would swap in a real gateway adapter that returns a
// genuine provider reference and only reports success after a real transaction.
//
// `charge` receives the server-derived amount and order id (never a client
// amount) and returns either:
//   { success: true,  ref, gateway, devOnly }
//   { success: false, ref: null, gateway, devOnly, error }
function charge({ amount, orderId }) {
  if (PAYMENT_GATEWAY !== 'mock') {
    // A real gateway is not configured yet; the app must not claim a real
    // payment was processed. Treat it as pending/failed until configured.
    return {
      success: false,
      ref: null,
      gateway: PAYMENT_GATEWAY || 'mock',
      devOnly: false,
      error: 'Payment gateway is not configured',
    };
  }

  const ref = `MOCK-${String(orderId).slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  // Development-only simulator: always reports success for a valid amount.
  return {
    success: amount > 0,
    ref: ref || null,
    gateway: 'mock',
    devOnly: true,
  };
}

module.exports = { charge };
