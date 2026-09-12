const prisma = require('../config/prisma');

const ORDER_STAGES = [
  'Order Confirmed',
  'Preparing',
  'Dispatched',
  'In Transit',
  'Out for Delivery',
  'Delivered',
];

const PLATFORM_FEE = 50;

function toDateString(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildOrderTimeline(orderDate, currentStageIndex) {
  return ORDER_STAGES.map((step, index) => ({
    step,
    date: index <= currentStageIndex ? orderDate : null,
    done: index <= currentStageIndex,
  }));
}

// Map a DB order row to the exact shape the API/frontend expects.
function formatOrder(order) {
  if (!order) return null;
  return {
    id: order.id,
    userId: order.userId,
    orderDate: toDateString(order.orderDate),
    productName: order.productName,
    quantity: Number(order.quantity),
    unit: order.unit,
    pricePerQuintal: Number(order.pricePerQuintal),
    transportCost: Number(order.transportCost),
    otherCharges: Number(order.otherCharges),
    platformFee: Number(order.platformFee),
    totalAmount: Number(order.totalAmount),
    deliveryAddress: order.deliveryAddress,
    paymentMethod: order.paymentMethod,
    paymentState: order.paymentState || 'pending',
    paymentRef: order.paymentRef || null,
    paidAt: order.paidAt ? toDateString(order.paidAt) : null,
    sellerName: order.sellerName,
    sellerUserId: order.sellerUserId || null,
    status: order.status,
    timeline: order.timeline,
    requirementId: order.requirementId,
    offerId: order.offerId,
  };
}

// Both the buyer (userId) and the seller (sellerUserId) are parties to an order,
// so a user's order list contains the orders they placed AND the orders they
// received for their products. A single order is returned at most once (the OR
// conditions can never both match the same row for distinct parties).
async function findAllOrders(userId) {
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ userId }, { sellerUserId: userId }],
    },
    orderBy: { id: 'asc' },
  });
  return orders.map(formatOrder);
}

async function findOrderById(id) {
  const order = await prisma.order.findUnique({ where: { id } });
  return formatOrder(order);
}

async function countOrdersByRequirement(requirementId) {
  return prisma.order.count({ where: { requirementId } });
}

// Advance an order to a given canonical ORDER_STAGES status (e.g. 'Delivered').
// Used by the logistics flow so that when delivery is confirmed the order itself
// reaches Delivered, making the review/rating flow reachable. Only `status` is
// changed here; the order stays a valid order and the API contract is untouched.
async function updateOrderStatus(id, status) {
  const updated = await prisma.order.update({
    where: { id },
    data: { status },
  });
  return formatOrder(updated);
}

async function createOrder(data) {
  // Server-side calculation (never trust totals from the client).
  const qty = Number(data.quantity);
  const pricePerQuintal = Number(data.offeredPricePerQuintal);
  const transportPerQuintal = Number(data.transportCostPerQuintal);
  const otherPerQuintal = Number(data.otherCostsPerQuintal);

  const deliveredCostPerQuintal = pricePerQuintal + transportPerQuintal + otherPerQuintal;
  const deliveredTotal = deliveredCostPerQuintal * qty;
  const totalAmount = deliveredTotal + PLATFORM_FEE;

  const orderDate = new Date().toISOString().slice(0, 10);

  // Raise the counter past any existing order number so IDs never collide.
  const existing = await prisma.order.findMany({ select: { id: true } });
  let nextNumber = 250;
  for (const o of existing) {
    const match = /-(\d{4})$/.exec(o.id);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > nextNumber) nextNumber = num;
    }
  }

  const newOrder = {
    id: `ORD-2026-${String(nextNumber + 1).padStart(4, '0')}`,
    userId: data.userId || null,
    orderDate: new Date(orderDate),
    productName: data.cropName.trim(),
    quantity: qty,
    unit: data.unit,
    pricePerQuintal,
    transportCost: transportPerQuintal * qty,
    otherCharges: otherPerQuintal * qty,
    platformFee: PLATFORM_FEE,
    totalAmount,
    deliveryAddress: data.deliveryAddress.trim(),
    paymentMethod: data.paymentMethod || 'Bank Transfer',
    sellerName: data.sellerName.trim(),
    sellerUserId: data.sellerUserId || null,
    status: ORDER_STAGES[0],
    timeline: buildOrderTimeline(orderDate, 0),
    requirementId: data.requirementId || null,
    offerId: data.offerId || null,
  };

  const created = await prisma.order.create({ data: newOrder });
  return formatOrder(created);
}

module.exports = { findAllOrders, findOrderById, countOrdersByRequirement, createOrder, updateOrderStatus };
