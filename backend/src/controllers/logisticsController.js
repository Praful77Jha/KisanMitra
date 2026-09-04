const { USE_DATABASE } = require('../config/config');
const orderService = USE_DATABASE ? require('../services/orderService') : null;
const logisticsService = USE_DATABASE ? require('../services/logisticsService') : null;

// ---- Freight estimation (existing demo helper, kept intact) ----
const TRANSPORT_MODES = [
  { key: 'tractor', label: 'Tractor-Trolley', ratePerKm: 55, loadingCharge: 350 },
  { key: 'mini', label: 'Mini Truck', ratePerKm: 85, loadingCharge: 500 },
  { key: 'truck', label: 'Truck', ratePerKm: 120, loadingCharge: 800 },
];

function findTransportMode(key) {
  return TRANSPORT_MODES.find((mode) => mode.key === key) || null;
}

function estimateLogistics({ distanceKm, quantity, modeKey }) {
  const mode = findTransportMode(modeKey);
  if (!mode) return null;
  const distance = Number(distanceKm);
  const quantityValue = Number(quantity);
  const freight = mode.ratePerKm * distance;
  const loading = mode.loadingCharge;
  const total = freight + loading;
  const perQuintal = quantityValue > 0 ? Math.round(total / quantityValue) : 0;
  return {
    modeKey: mode.key,
    modeLabel: mode.label,
    distanceKm: distance,
    quantity: quantityValue,
    ratePerKm: mode.ratePerKm,
    freight,
    loading,
    total,
    perQuintal,
  };
}

function postEstimate(req, res) {
  const { distanceKm, quantity, modeKey } = req.body;
  const missing =
    distanceKm === undefined ||
    quantity === undefined ||
    !modeKey ||
    !findTransportMode(modeKey);
  if (missing) {
    return res.status(400).json({
      success: false,
      message: 'distanceKm, quantity, and a valid modeKey are required',
    });
  }
  const distance = Number(distanceKm);
  const quantityValue = Number(quantity);
  if (!Number.isFinite(distance) || distance <= 0) {
    return res.status(400).json({ success: false, message: 'distanceKm must be a positive number' });
  }
  if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
    return res.status(400).json({ success: false, message: 'quantity must be a positive number' });
  }
  const estimate = estimateLogistics({ distanceKm, quantity, modeKey });
  res.status(200).json({ success: true, data: estimate });
}

// ---- Order-level logistics / delivery status (Phase 3) ----

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

// In-memory (non-database) logistics store, shared so routes and tests can
// inspect it, mirroring the other controllers.
const logistics = [];

function isParty(order, userId) {
  if (!order) return false;
  return order.userId === userId || order.sellerUserId === userId;
}

function isBuyer(order, userId) {
  return !!order && order.userId === userId;
}

function isValidTransition(fromStatus, toStatus) {
  const next = ALLOWED_TRANSITIONS[fromStatus];
  return Array.isArray(next) && next.includes(toStatus);
}

// POST /api/logistics  { orderId }  -> initialize a logistics record (pending).
// Buyer only. Duplicate records for the same order are rejected with 409.
async function initLogistics(req, res, next) {
  const orderId = req.body && req.body.orderId;
  if (!orderId) {
    return res.status(400).json({ success: false, message: 'orderId is required' });
  }

  let order;
  if (USE_DATABASE) {
    try {
      order = await orderService.findOrderById(orderId);
    } catch (error) {
      return next(error);
    }
  } else {
    const { orders } = require('./ordersController');
    order = orders.find((o) => o.id === orderId) || null;
  }
  if (!order || !isBuyer(order, req.user.id)) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (USE_DATABASE) {
    try {
      const existing = await logisticsService.findLogisticsByOrder(orderId);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A logistics record already exists for this order',
        });
      }
      const record = await logisticsService.initLogistics(orderId, req.user.id);
      return res.status(201).json({ success: true, data: record });
    } catch (error) {
      return next(error);
    }
  }

  if (logistics.some((l) => l.orderId === orderId)) {
    return res.status(409).json({
      success: false,
      message: 'A logistics record already exists for this order',
    });
  }
  const newRecord = {
    id: `LOG-${String(logistics.length + 1).padStart(4, '0')}`,
    orderId,
    status: 'pending',
    updatedBy: req.user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  logistics.push(newRecord);
  return res.status(201).json({ success: true, data: newRecord });
}

// GET /api/logistics/:orderId  -> the logistics record for an order.
// Only the order's two parties may view. 404 for non-parties / unknown orders
// (does not reveal order existence). data:null when a party has no record yet.
async function getLogistics(req, res, next) {
  const orderId = req.params.orderId;

  let order;
  if (USE_DATABASE) {
    try {
      order = await orderService.findOrderById(orderId);
    } catch (error) {
      return next(error);
    }
  } else {
    const { orders } = require('./ordersController');
    order = orders.find((o) => o.id === orderId) || null;
  }
  if (!order || !isParty(order, req.user.id)) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (USE_DATABASE) {
    try {
      const record = await logisticsService.findLogisticsByOrder(orderId);
      if (!record) {
        return res.status(200).json({ success: true, data: null });
      }
      return res.status(200).json({ success: true, data: record });
    } catch (error) {
      return next(error);
    }
  }

  const record = logistics.find((l) => l.orderId === orderId) || null;
  return res.status(200).json({ success: true, data: record });
}

// PUT /api/logistics/:orderId  { status }  -> advance/cancel logistics status.
// Buyer only. Enforces the valid state transitions; terminal states are frozen.
async function updateLogisticsStatus(req, res, next) {
  const orderId = req.params.orderId;
  const toStatus = req.body && req.body.status;

  if (!toStatus || !Object.prototype.hasOwnProperty.call(ALLOWED_TRANSITIONS, toStatus)) {
    return res.status(400).json({ success: false, message: 'status is invalid' });
  }

  let order;
  if (USE_DATABASE) {
    try {
      order = await orderService.findOrderById(orderId);
    } catch (error) {
      return next(error);
    }
  } else {
    const { orders } = require('./ordersController');
    order = orders.find((o) => o.id === orderId) || null;
  }
  if (!order || !isBuyer(order, req.user.id)) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (USE_DATABASE) {
    try {
      const existing = await logisticsService.findLogisticsByOrder(orderId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'No logistics record for this order',
        });
      }
      if (!isValidTransition(existing.status, toStatus)) {
        return res.status(400).json({
          success: false,
          message: `Cannot transition from ${existing.status} to ${toStatus}`,
        });
      }
      const updated = await logisticsService.updateStatus(orderId, toStatus, req.user.id);
      // When logistics reaches the terminal delivered state, advance the order to
      // the canonical Delivered stage so the existing review flow becomes eligible.
      if (toStatus === 'delivered') {
        await orderService.updateOrderStatus(orderId, 'Delivered');
      }
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      return next(error);
    }
  }

  const record = logistics.find((l) => l.orderId === orderId);
  if (!record) {
    return res.status(404).json({ success: false, message: 'No logistics record for this order' });
  }
  if (!isValidTransition(record.status, toStatus)) {
    return res.status(400).json({
      success: false,
      message: `Cannot transition from ${record.status} to ${toStatus}`,
    });
  }
  record.status = toStatus;
  record.updatedBy = req.user.id;
  record.updatedAt = new Date().toISOString();
  // Mirror the DB path: reaching logistics `delivered` advances the order to the
  // canonical Delivered stage so the existing review flow becomes eligible.
  if (toStatus === 'delivered') {
    order.status = 'Delivered';
  }
  return res.status(200).json({ success: true, data: record });
}

module.exports = {
  postEstimate,
  estimateLogistics,
  initLogistics,
  getLogistics,
  updateLogisticsStatus,
  ALLOWED_TRANSITIONS,
  logistics,
};
