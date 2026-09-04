// Loads .env so the flag is available even when tests/scripts don't go via server.js.
require('dotenv').config();

// When true, controllers read/write MySQL through Prisma.
// When false, controllers fall back to the original in-memory arrays.
const USE_DATABASE = process.env.USE_DATABASE === 'true';

// Secret used to sign/verify JWT auth tokens.
// In production this MUST be a long, random value set in the environment.
const JWT_SECRET =
  process.env.JWT_SECRET || 'kisanmitra-dev-only-secret-change-me';

// Token lifetime (e.g. '7d').
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Payment gateway adapter. Only "mock" is available out of the box (a clearly
// labelled development-only simulator used so the payment state machine can be
// exercised end to end). A production gateway (e.g. Razorpay/Stripe) would set
// PAYMENT_GATEWAY and provide real credentials; until then real payment
// execution is PENDING and the app runs in development mode only.
const PAYMENT_GATEWAY = process.env.PAYMENT_GATEWAY || 'mock';

module.exports = { USE_DATABASE, JWT_SECRET, JWT_EXPIRES_IN, PAYMENT_GATEWAY };
