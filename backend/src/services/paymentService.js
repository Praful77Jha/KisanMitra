const prisma = require('../config/prisma');

// Payment persistence for the DB path (Phase 5). The payable amount is always
// derived from the stored order's totalAmount (see controller); the service only
// records the resulting state, reference, and paid timestamp.

async function recordPayment(orderId, { paymentState, paymentRef, paidAt }) {
  const data = { paymentState, paymentRef: paymentRef || null };
  if (paidAt) data.paidAt = paidAt;
  return prisma.order.update({ where: { id: orderId }, data });
}

async function setPaymentState(orderId, paymentState) {
  return prisma.order.update({
    where: { id: orderId },
    data: { paymentState },
  });
}

module.exports = { recordPayment, setPaymentState };
