const { USE_DATABASE } = require('../config/config');
const transportService = USE_DATABASE ? require('../services/transportService') : null;
const { isAuthenticated, hasRole } = require('../middlewares/auth');

// In-memory (non-database) transporter profile store, shared so routes and tests
// can inspect it, mirroring the other controllers.
const transporterProfiles = [];
let profileIdCounter = 0;

function makeProfileId() {
  profileIdCounter += 1;
  return `TP-${String(profileIdCounter).padStart(4, '0')}`;
}

function findProfileLocally(userId) {
  return transporterProfiles.find((p) => p.userId === userId) || null;
}

// POST /api/transporter/profile
// Creates the caller's own profile. TRANSPORTER role only; avgRating is NEVER
// taken from the body — it is owned by the server-side review logic.
async function createProfile(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }
  if (!hasRole(req, 'TRANSPORTER')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { vehicleTypes, vehicleCapacity, baseLocation, description } = req.body;
  if (!vehicleTypes || !baseLocation) {
    return res.status(400).json({
      success: false,
      message: 'vehicleTypes and baseLocation are required',
    });
  }
  let numericCapacity = null;
  if (vehicleCapacity !== undefined && vehicleCapacity !== null && vehicleCapacity !== '') {
    numericCapacity = Number(vehicleCapacity);
    if (!Number.isFinite(numericCapacity) || numericCapacity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'vehicleCapacity must be a positive number',
      });
    }
  }

  if (USE_DATABASE) {
    try {
      const existing = await transportService.findProfileByUserId(req.user.id);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'You already have a transporter profile',
        });
      }
      const created = await transportService.createProfile({
        userId: req.user.id,
        vehicleTypes: String(vehicleTypes).trim(),
        vehicleCapacity: numericCapacity,
        baseLocation: String(baseLocation).trim(),
        description:
          description !== undefined && description !== null ? String(description).trim() : null,
      });
      return res.status(201).json({ success: true, data: created });
    } catch (error) {
      return next(error);
    }
  }

  if (findProfileLocally(req.user.id)) {
    return res.status(409).json({
      success: false,
      message: 'You already have a transporter profile',
    });
  }
  const now = new Date().toISOString();
  const newProfile = {
    id: makeProfileId(),
    userId: req.user.id,
    vehicleTypes: String(vehicleTypes).trim(),
    vehicleCapacity: numericCapacity,
    baseLocation: String(baseLocation).trim(),
    description:
      description !== undefined && description !== null ? String(description).trim() : null,
    avgRating: null,
    createdAt: now,
    updatedAt: now,
  };
  transporterProfiles.push(newProfile);
  return res.status(201).json({ success: true, data: newProfile });
}

// GET /api/transporter/profile/me
async function getMyProfile(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }
  if (!hasRole(req, 'TRANSPORTER')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  if (USE_DATABASE) {
    try {
      const profile = await transportService.findProfileByUserId(req.user.id);
      if (!profile) {
        return res.status(404).json({ success: false, message: 'Transporter profile not found' });
      }
      return res.status(200).json({ success: true, data: profile });
    } catch (error) {
      return next(error);
    }
  }

  const profile = findProfileLocally(req.user.id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Transporter profile not found' });
  }
  return res.status(200).json({ success: true, data: profile });
}

// PATCH /api/transporter/profile/me
// Updates the caller's own profile fields. avgRating is never writable by the
// user: it is only ever recomputed server-side from TransportReview records.
async function updateMyProfile(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }
  if (!hasRole(req, 'TRANSPORTER')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { vehicleTypes, vehicleCapacity, baseLocation, description } = req.body;

  const data = {};
  if (vehicleTypes !== undefined && vehicleTypes !== null) {
    if (typeof vehicleTypes !== 'string' || !vehicleTypes.trim()) {
      return res.status(400).json({ success: false, message: 'vehicleTypes must be a non-empty string' });
    }
    data.vehicleTypes = vehicleTypes.trim();
  }
  if (vehicleCapacity !== undefined && vehicleCapacity !== null && vehicleCapacity !== '') {
    const numericCapacity = Number(vehicleCapacity);
    if (!Number.isFinite(numericCapacity) || numericCapacity <= 0) {
      return res.status(400).json({ success: false, message: 'vehicleCapacity must be a positive number' });
    }
    data.vehicleCapacity = numericCapacity;
  }
  if (baseLocation !== undefined && baseLocation !== null) {
    if (typeof baseLocation !== 'string' || !baseLocation.trim()) {
      return res.status(400).json({ success: false, message: 'baseLocation must be a non-empty string' });
    }
    data.baseLocation = baseLocation.trim();
  }
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return res.status(400).json({ success: false, message: 'description must be text' });
    }
    data.description = description.trim().slice(0, 500);
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ success: false, message: 'Nothing to update' });
  }

  if (USE_DATABASE) {
    try {
      const existing = await transportService.findProfileByUserId(req.user.id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Transporter profile not found' });
      }
      const updated = await transportService.updateProfile(req.user.id, data);
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      return next(error);
    }
  }

  const profile = findProfileLocally(req.user.id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Transporter profile not found' });
  }
  Object.assign(profile, data, { updatedAt: new Date().toISOString() });
  return res.status(200).json({ success: true, data: profile });
}

module.exports = { createProfile, getMyProfile, updateMyProfile, transporterProfiles };