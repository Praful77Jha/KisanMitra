const { USE_DATABASE } = require('../config/config');
const transportService = USE_DATABASE ? require('../services/transportService') : null;
const orderService = USE_DATABASE ? require('../services/orderService') : null;
const { isAuthenticated, hasRole } = require('../middlewares/auth');
const { REQUEST_STATUS, VEHICLE_TYPES, normalizeUnit } = require('../utils/transportStates');

// In-memory (non-database) transport request store, shared so routes and tests
// can inspect it, mirroring the other controllers.
const transportRequests = [];
let requestIdCounter = 0;

function makeRequestId() {
  requestIdCounter += 1;
  return `TRQ-${String(requestIdCounter).padStart(4, '0')}`;
}

function isOrderParty(order, userId) {
  if (!order || !userId) return false;
  return order.userId === userId || order.sellerUserId === userId;
}

function findRequestLocally(id) {
  return transportRequests.find((r) => r.id === id) || null;
}

// POST /api/transport-requests
// FARMER/BUYER only. Optional orderId attaches the request to an order the
// caller is genuinely a party to — never someone else's order.
async function createRequest(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }
  if (!hasRole(req, 'FARMER', 'BUYER')) {
    return res.status(403).json({
      success: false,
      message: 'Only FARMER or BUYER users can post transport requests',
    });
  }

  const {
    cropName,
    quantity,
    unit,
    pickupLocation,
    dropLocation,
    requiredBy,
    vehicleType,
    expectedBudget,
    distanceKm,
    pickupLat,
    pickupLng,
    dropLat,
    dropLng,
    notes,
    orderId,
  } = req.body;

  if (!cropName || quantity === undefined || quantity === null || !unit || !pickupLocation || !dropLocation) {
    return res.status(400).json({
      success: false,
      message: 'cropName, quantity, unit, pickupLocation, and dropLocation are required',
    });
  }
  const numericQuantity = Number(quantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    return res.status(400).json({ success: false, message: 'Enter a valid positive quantity.' });
  }
  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) {
    return res.status(400).json({ success: false, message: 'Please select a valid quantity unit.' });
  }
  if (
    vehicleType !== undefined &&
    vehicleType !== null &&
    String(vehicleType).trim() !== '' &&
    !VEHICLE_TYPES.includes(String(vehicleType).trim())
  ) {
    return res.status(400).json({ success: false, message: 'Please select a valid vehicle type.' });
  }
  if (requiredBy !== undefined && requiredBy !== null && requiredBy !== '') {
    const dateString = String(requiredBy).trim();
    const match = /^\d{4}-\d{2}-\d{2}$/.exec(dateString);
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (!match || dateString < todayString) {
      return res.status(400).json({ success: false, message: 'Required date must be today or a future date.' });
    }
  }

  let numericBudget = null;
  if (expectedBudget !== undefined && expectedBudget !== null && expectedBudget !== '') {
    numericBudget = Number(expectedBudget);
    if (!Number.isFinite(numericBudget) || numericBudget <= 0) {
      return res.status(400).json({ success: false, message: 'expectedBudget must be a positive number' });
    }
  }
  let numericDistance = null;
  if (distanceKm !== undefined && distanceKm !== null && distanceKm !== '') {
    numericDistance = Number(distanceKm);
    if (!Number.isFinite(numericDistance) || numericDistance < 0) {
      return res.status(400).json({ success: false, message: 'distanceKm must be a non-negative number' });
    }
  }
  function toOptionalNumber(value, label, min, max) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num < min || num > max) {
      return { invalid: `${label} must be a number between ${min} and ${max}` };
    }
    return num;
  }
  const pickLat = toOptionalNumber(pickupLat, 'pickupLat', -90, 90);
  const pickLng = toOptionalNumber(pickupLng, 'pickupLng', -180, 180);
  const dlLat = toOptionalNumber(dropLat, 'dropLat', -90, 90);
  const dlLng = toOptionalNumber(dropLng, 'dropLng', -180, 180);
  if (pickLat && pickLat.invalid) return res.status(400).json({ success: false, message: pickLat.invalid });
  if (pickLng && pickLng.invalid) return res.status(400).json({ success: false, message: pickLng.invalid });
  if (dlLat && dlLat.invalid) return res.status(400).json({ success: false, message: dlLat.invalid });
  if (dlLng && dlLng.invalid) return res.status(400).json({ success: false, message: dlLng.invalid });

  // Optional order attachment: verify the authenticated user is a party to the
  // order before allowing any link, preserving existing Order semantics.
  let order = null;
  if (orderId) {
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
    if (!order || !isOrderParty(order, req.user.id)) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
  }

  if (USE_DATABASE) {
    try {
      const created = await transportService.createRequest({
        userId: req.user.id,
        cropName: String(cropName).trim(),
        quantity: numericQuantity,
        unit: normalizedUnit,
        pickupLocation: String(pickupLocation).trim(),
        dropLocation: String(dropLocation).trim(),
        requiredBy: requiredBy || null,
        vehicleType: vehicleType || null,
        expectedBudget: numericBudget,
        distanceKm: numericDistance,
        pickupLat: pickLat,
        pickupLng: pickLng,
        dropLat: dlLat,
        dropLng: dlLng,
        notes: notes || null,
        orderId: orderId || null,
      });
      return res.status(201).json({ success: true, data: created });
    } catch (error) {
      return next(error);
    }
  }

  const now = new Date().toISOString();
  const newRequest = {
    id: makeRequestId(),
    userId: req.user.id,
    cropName: String(cropName).trim(),
    quantity: numericQuantity,
    unit: normalizedUnit,
    pickupLocation: String(pickupLocation).trim(),
    dropLocation: String(dropLocation).trim(),
    requiredBy: requiredBy || null,
    vehicleType: vehicleType || null,
    expectedBudget: numericBudget,
    distanceKm: numericDistance,
    pickupLat: pickLat,
    pickupLng: pickLng,
    dropLat: dlLat,
    dropLng: dlLng,
    notes: notes || null,
    status: REQUEST_STATUS.OPEN,
    orderId: orderId || null,
    createdAt: now,
    updatedAt: now,
  };
  transportRequests.unshift(newRequest);
  return res.status(201).json({ success: true, data: newRequest });
}

// GET /api/transport-requests
// FARMER/BUYER see their own requests. A TRANSPORTER sees only the requests they
// are relevant to (quoted on or linked to their jobs), never another user's
// private collection.
async function getAllRequests(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }

  if (USE_DATABASE) {
    try {
      let data;
      if (hasRole(req, 'TRANSPORTER')) {
        data = await transportService.findRequestsForTransporter(req.user.id);
      } else {
        data = await transportService.findRequestsForRequester(req.user.id);
      }
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  const quotedIds = new Set();
  const jobIds = new Set();
  const { transportOffers } = require('./transportOffersController');
  transportOffers.forEach((o) => {
    if (o.transporterId === req.user.id) quotedIds.add(o.transportRequestId);
  });
  const { transportJobs } = require('./transportJobsController');
  transportJobs.forEach((j) => {
    if (j.transporterId === req.user.id) jobIds.add(j.transportRequestId);
  });

  const mine = transportRequests.filter(
    (r) => r.userId === req.user.id || quotedIds.has(r.id) || jobIds.has(r.id)
  );
  return res.status(200).json({ success: true, data: mine });
}

// GET /api/transport-requests/available
// TRANSPORTER only. Availability list: OPEN requests only, filtered to those
// compatible with the transporter's profile vehicle types (a request with no
// vehicle preference is always shown). Cancelled and completed requests are
// never exposed here.
async function getAvailableRequests(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }
  if (!hasRole(req, 'TRANSPORTER')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  if (USE_DATABASE) {
    try {
      const profile = await transportService.findProfileByUserId(req.user.id);
      const data = await transportService.findOpenRequests(req.user.id, profile);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  const { transporterProfiles } = require('./transporterController');
  const profile = transporterProfiles.find((p) => p.userId === req.user.id) || null;
  const types = profile
    ? String(profile.vehicleTypes || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const available = transportRequests.filter(
    (r) =>
      r.status === REQUEST_STATUS.OPEN &&
      (types.length === 0 || !r.vehicleType || types.includes(r.vehicleType))
  );
  return res.status(200).json({ success: true, data: available });
}

// GET /api/transport-requests/:id
// The requester can view their own request. A transporter can view an OPEN
// request (to quote) or a request they already quoted on. Everyone else gets
// 404 (resource may not be revealed to non-parties).
async function getRequestById(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }

  const requestId = req.params.id;

  if (USE_DATABASE) {
    try {
      const request = await transportService.findRequestById(requestId);
      if (!request) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }
      if (request.userId === req.user.id) {
        return res.status(200).json({ success: true, data: request });
      }
      if (hasRole(req, 'TRANSPORTER')) {
        const hasQuote = await transportService.findActiveQuoteByTransporter(requestId, req.user.id);
        if (request.status === REQUEST_STATUS.OPEN || hasQuote) {
          return res.status(200).json({ success: true, data: request });
        }
      }
      return res.status(404).json({ success: false, message: 'Request not found' });
    } catch (error) {
      return next(error);
    }
  }

  const request = findRequestLocally(requestId);
  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  if (request.userId === req.user.id) {
    return res.status(200).json({ success: true, data: request });
  }
  if (hasRole(req, 'TRANSPORTER')) {
    const { transportOffers } = require('./transportOffersController');
    const hasQuote = transportOffers.some(
      (o) => o.transportRequestId === requestId && o.transporterId === req.user.id
    );
    if (request.status === REQUEST_STATUS.OPEN || hasQuote) {
      return res.status(200).json({ success: true, data: request });
    }
  }
  return res.status(404).json({ success: false, message: 'Request not found' });
}

// DELETE /api/transport-requests/:id
// Requester only. Only an OPEN request with no accepted quote and no job can be
// deleted; once a quote is accepted / a job started the record is protected.
async function deleteRequest(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }

  const requestId = req.params.id;

  let request;
  let jobCount;
  let acceptedCount;
  if (USE_DATABASE) {
    try {
      request = await transportService.findRequestById(requestId);
      if (!request || request.userId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }
      [jobCount, acceptedCount] = await Promise.all([
        transportService.countJobsByRequest(requestId),
        transportService.countAcceptedOffersByRequest(requestId),
      ]);
    } catch (error) {
      return next(error);
    }
  } else {
    request = findRequestLocally(requestId);
    if (!request || request.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    const { transportOffers } = require('./transportOffersController');
    const { transportJobs } = require('./transportJobsController');
    acceptedCount = transportOffers.filter(
      (o) => o.transportRequestId === requestId && o.status === 'ACCEPTED'
    ).length;
    jobCount = transportJobs.filter((j) => j.transportRequestId === requestId).length;
  }

  if (request.status !== REQUEST_STATUS.OPEN) {
    return res.status(400).json({
      success: false,
      message: 'Only an OPEN transport request can be deleted',
    });
  }
  if (jobCount > 0 || acceptedCount > 0) {
    return res.status(400).json({
      success: false,
      message: 'This transport request has an accepted quote or job and cannot be deleted',
    });
  }

  if (USE_DATABASE) {
    try {
      const result = await transportService.deleteRequest(requestId);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  const index = transportRequests.findIndex((r) => r.id === requestId);
  if (index !== -1) transportRequests.splice(index, 1);
  return res.status(200).json({ success: true, data: { id: requestId } });
}

module.exports = {
  createRequest,
  getAllRequests,
  getAvailableRequests,
  getRequestById,
  deleteRequest,
  transportRequests,
};