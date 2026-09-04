const prisma = require('../config/prisma');

// Valid lifecycle and allowed transitions for order logistics status.
// pending -> pickup -> in_transit -> delivered. `cancelled` is allowed from any
// non-terminal state. `delivered` and `cancelled` are terminal.
const ALLOWED_TRANSITIONS = {
  pending: ['pickup', 'cancelled'],
  pickup: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

function formatLogistics(record) {
  if (!record) return null;
  return {
    id: record.id,
    orderId: record.orderId,
    status: record.status,
    updatedBy: record.updatedBy || null,
    createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : null,
    updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : null,
  };
}

async function findLogisticsByOrder(orderId) {
  const record = await prisma.logistics.findUnique({ where: { orderId } });
  return formatLogistics(record);
}

async function initLogistics(orderId, updatedBy) {
  const record = await prisma.logistics.create({
    data: {
      orderId,
      status: 'pending',
      updatedBy: updatedBy || null,
    },
  });
  return formatLogistics(record);
}

async function updateStatus(orderId, status, updatedBy) {
  const record = await prisma.logistics.update({
    where: { orderId },
    data: {
      status,
      updatedBy: updatedBy || null,
    },
  });
  return formatLogistics(record);
}

module.exports = {
  ALLOWED_TRANSITIONS,
  findLogisticsByOrder,
  initLogistics,
  updateStatus,
};
