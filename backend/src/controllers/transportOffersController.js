const { USE_DATABASE } = require('../config/config');
const transportService = USE_DATABASE ? require('../services/transportService') : null;
const userService = require('../services/userService');
const { notifyUser } = require('./notificationsController');
const { isAuthenticated, hasRole } = require('../middlewares/auth');
const { REQUEST_STATUS, VEHICLE_TYPES } = require('../utils/transportStates');

// In-memory (non-database) quote store, shared so routes/tests can inspect it.
const transportOffers = [];
let offerIdCounter = 0;

function makeOfferId() {
  offerIdCounter += 1;
  return `TQ-${String(offerIdCounter).padStart(4, '0')}`;
}

function findRequestLocally(id) {
  const { transportRequests } = require('./transportRequestsController');
  return transportRequests.find((r) => r.id === id) || null;
}

function findTransporterProfileLocally(userId) {
  const { transporterProfiles } = require('./transporterController');
  return transporterProfiles.find((p) => p.userId === userId) || null;
}

// Resolve the vehicle type for a quote as server-authoritative. The client can
// no longer dictate it: the stored value comes from the transporter's profile
// (preferring the request's preferred vehicle when the transporter offers it).
// When the request demands a vehicle the transporter does not offer, a
// { incompatible } flag asks the caller to reject the quote.
function deriveQuoteVehicle(profile, request) {
  const types = String(profile ? profile.vehicleTypes || '' : '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (types.length === 0) return { vehicleType: null };
  if (!request || !request.vehicleType) return { vehicleType: types[0] };
  if (types.includes(request.vehicleType)) return { vehicleType: request.vehicleType };
  return { incompatible: true, vehicleType: null };
}

// POST /api/transport-quotes/:id/counter
// The request owner (FARMER/BUYER) or the quoted transporter may answer the
// latest SUBMITTED offer in a negotiation thread: neither accepted, rejected,
// nor superseded offers can be countered. Only a positive amount is accepted.
// The new offer chains to the offer it answers via parentOfferId and carries
// offerType COUNTER with an incremented negotiationRound; the answered offer is
// superseded so only the newest link stays actionable.
async function createCounterOffer(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }

  const offerId = req.params.id;
  const { quotedAmount, notes } = req.body;

  const amount = Number(quotedAmount);
  if (quotedAmount === undefined || quotedAmount === null || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'quotedAmount must be a positive number' });
  }

  if (USE_DATABASE) {
    try {
      const result = await transportService.createCounterOffer({
        offerId,
        actorId: req.user.id,
        quotedAmount: amount,
        notes: notes || null,
      });
      if (!result.ok) {
        return res.status(result.status).json({ success: false, message: result.message });
      }

      // Notify the OTHER participant in the negotiation (never the sender).
      // Requester counters -> the thread's transporter is notified; transporter
      // counters -> the request owner is notified. Mirrors the createQuote/
      // acceptQuote notification format (best-effort, non-fatal).
      const counterOffer = result.data.offer;
      const counterRequest = await transportService.findRequestById(counterOffer.transportRequestId);
      const otherParticipant = counterOffer.transporterId === req.user.id
        ? (counterRequest ? counterRequest.userId : null)
        : counterOffer.transporterId;
      if (otherParticipant && otherParticipant !== req.user.id) {
        notifyUser({
          userId: otherParticipant,
          type: 'transport_quote_counter',
          title: 'Transport quote countered',
          body: `You have a new counter offer for ${counterRequest ? counterRequest.cropName : 'your transport request'}.`,
          refType: 'transportRequest',
          refId: counterOffer.transportRequestId,
        }).catch(() => {});
      }
      return res.status(201).json({ success: true, data: result.data });
    } catch (error) {
      return next(error);
    }
  }

  // ---- In-memory (non-database) path (mirrors the DB service guards) ----
  const offer = transportOffers.find((o) => o.id === offerId);
  if (!offer) {
    return res.status(404).json({ success: false, message: 'Quote not found' });
  }
  const request = findRequestLocally(offer.transportRequestId);
  if (!request || request.status !== REQUEST_STATUS.OPEN) {
    return res.status(400).json({ success: false, message: 'Request is not open to counters' });
  }
  if (offer.status !== 'SUBMITTED') {
    return res.status(400).json({ success: false, message: 'Only the latest submitted quote can be countered' });
  }
  const { transportJobs } = require('./transportJobsController');
  if (transportJobs.some((j) => j.transportRequestId === offer.transportRequestId)) {
    return res.status(400).json({ success: false, message: 'Negotiation is closed; a job already exists' });
  }
  const isRequesterSide = request.userId === req.user.id;
  const isTransporterSide = offer.transporterId === req.user.id;
  if (!isRequesterSide && !isTransporterSide) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const latestAuthorIsTransporter = offer.negotiationRound % 2 === 1;
  if (latestAuthorIsTransporter === isTransporterSide) {
    return res.status(400).json({ success: false, message: 'You cannot counter your own quote' });
  }

  const now = new Date().toISOString();
  offer.status = 'SUPERSEDED';
  offer.updatedAt = now;
  const superseded = { ...offer };
  const created = {
    id: makeOfferId(),
    transportRequestId: request.id,
    transporterId: offer.transporterId,
    transporterName: offer.transporterName,
    quotedAmount: amount,
    vehicleType: offer.vehicleType,
    distanceKm: offer.distanceKm,
    notes: notes || null,
    status: 'SUBMITTED',
    parentOfferId: offer.id,
    offerType: 'COUNTER',
    negotiationRound: offer.negotiationRound + 1,
    createdAt: now,
    updatedAt: now,
  };
  transportOffers.unshift(created);

  // Notify the OTHER participant in the negotiation (never the sender). Same
  // participant rule as the DB path; best-effort and intentionally not awaited.
  const otherParticipant = created.transporterId === req.user.id
    ? request.userId
    : created.transporterId;
  if (otherParticipant && otherParticipant !== req.user.id) {
    notifyUser({
      userId: otherParticipant,
      type: 'transport_quote_counter',
      title: 'Transport quote countered',
      body: `You have a new counter offer for ${request.cropName}.`,
      refType: 'transportRequest',
      refId: request.id,
    }).catch(() => {});
  }
  return res.status(201).json({ success: true, data: { superseded, offer: created } });
}

// GET /api/transport-quotes/:id/history
// The request owner or the quoted transporter may read the full negotiation
// thread for an offer. The chain is walked via parentOfferId and returned
// newest-first (most recent offer at index 0).
async function getNegotiationHistory(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }

  const offerId = req.params.id;

  if (USE_DATABASE) {
    try {
      const offer = await transportService.findOfferById(offerId);
      if (!offer) {
        return res.status(404).json({ success: false, message: 'Quote not found' });
      }
      const request = await transportService.findRequestById(offer.transportRequestId);
      if (!request) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }
      if (request.userId !== req.user.id && offer.transporterId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }
      const data = await transportService.getNegotiationHistory(offerId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  const offer = transportOffers.find((o) => o.id === offerId);
  if (!offer) {
    return res.status(404).json({ success: false, message: 'Quote not found' });
  }
  const request = findRequestLocally(offer.transportRequestId);
  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  if (request.userId !== req.user.id && offer.transporterId !== req.user.id) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  const chain = [];
  let current = offer;
  while (current) {
    chain.unshift(current);
    if (!current.parentOfferId) break;
    current = transportOffers.find((o) => o.id === current.parentOfferId) || null;
  }
  return res.status(200).json({ success: true, data: chain.reverse() });
}

// POST /api/transport-requests/:id/quotes
// TRANSPORTER only with an existing TransporterProfile. The request must be OPEN
// and must not be the transporter's own.
async function createQuote(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }
  if (!hasRole(req, 'TRANSPORTER')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const requestId = req.params.id;
  const { quotedAmount, vehicleType, distanceKm, notes } = req.body;

  if (quotedAmount === undefined || quotedAmount === null) {
    return res.status(400).json({
      success: false,
      message: 'quotedAmount is required',
    });
  }
  if (vehicleType !== undefined && vehicleType !== null && (typeof vehicleType !== 'string' || !vehicleType.trim())) {
    return res.status(400).json({ success: false, message: 'vehicleType must be a non-empty string' });
  }
  const amount = Number(quotedAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'quotedAmount must be a positive number' });
  }
  let numericDistance = null;
  if (distanceKm !== undefined && distanceKm !== null) {
    numericDistance = Number(distanceKm);
    if (!Number.isFinite(numericDistance) || numericDistance < 0) {
      return res.status(400).json({ success: false, message: 'distanceKm must be a non-negative number' });
    }
  }

  if (USE_DATABASE) {
    try {
      const profile = await transportService.findProfileByUserId(req.user.id);
      if (!profile) {
        return res.status(403).json({ success: false, message: 'Please select a vehicle from your transporter profile.' });
      }
      const request = await transportService.findRequestById(requestId);
      if (!request) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }
      if (request.status !== REQUEST_STATUS.OPEN) {
        return res.status(400).json({ success: false, message: 'This transport request is no longer accepting offers.' });
      }
      if (request.userId === req.user.id) {
        return res.status(400).json({ success: false, message: 'You cannot quote on your own request' });
      }
      const duplicate = await transportService.findActiveQuoteByTransporter(requestId, req.user.id);
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active quote for this request',
        });
      }

      const derived = transportService.deriveQuoteVehicle(profile, request);
      if (derived.incompatible) {
        return res.status(400).json({
          success: false,
          message: 'This request requires a vehicle type you do not offer',
        });
      }
      if (!derived.vehicleType) {
        return res.status(400).json({ success: false, message: 'Unable to determine vehicleType; add vehicles to your profile' });
      }
      if (!VEHICLE_TYPES.includes(derived.vehicleType)) {
        return res.status(400).json({ success: false, message: 'Please select a valid vehicle type.' });
      }

      const authenticatedUser = await userService.findUserById(req.user.id);
      const transporterName = authenticatedUser ? authenticatedUser.name : 'Transporter';

      const created = await transportService.createQuote({
        transportRequestId: requestId,
        transporterId: req.user.id,
        transporterName,
        quotedAmount: amount,
        vehicleType: derived.vehicleType,
        distanceKm: numericDistance,
        notes: notes || null,
      });

      if (request.userId && request.userId !== req.user.id) {
        notifyUser({
          userId: request.userId,
          type: 'transport_quote',
          title: 'New transport quote',
          body: `${transporterName} quoted for ${request.cropName}.`,
          refType: 'transportRequest',
          refId: requestId,
        }).catch(() => {});
      }
      return res.status(201).json({ success: true, data: created });
    } catch (error) {
      return next(error);
    }
  }

  // ---- In-memory (non-database) path ----
  const profile = findTransporterProfileLocally(req.user.id);
  if (!profile) {
    return res.status(403).json({ success: false, message: 'Please select a vehicle from your transporter profile.' });
  }
  const request = findRequestLocally(requestId);
  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  if (request.status !== REQUEST_STATUS.OPEN) {
    return res.status(400).json({ success: false, message: 'This transport request is no longer accepting offers.' });
  }
  if (request.userId === req.user.id) {
    return res.status(400).json({ success: false, message: 'You cannot quote on your own request' });
  }
  if (transportOffers.some(
    (o) => o.transportRequestId === requestId && o.transporterId === req.user.id && o.status === 'SUBMITTED'
  )) {
    return res.status(400).json({
      success: false,
      message: 'You already have an active quote for this request',
    });
  }

  const derived = deriveQuoteVehicle(profile, request);
  if (derived.incompatible) {
    return res.status(400).json({
      success: false,
      message: 'This request requires a vehicle type you do not offer',
    });
  }
  if (!derived.vehicleType) {
    return res.status(400).json({ success: false, message: 'Unable to determine vehicleType; add vehicles to your profile' });
  }
  if (!VEHICLE_TYPES.includes(derived.vehicleType)) {
    return res.status(400).json({ success: false, message: 'Please select a valid vehicle type.' });
  }

  const transporterName = req.user.name || 'Transporter';
  const now = new Date().toISOString();
  const newOffer = {
    id: makeOfferId(),
    transportRequestId: requestId,
    transporterId: req.user.id,
    transporterName,
    quotedAmount: amount,
    vehicleType: derived.vehicleType,
    distanceKm: numericDistance,
    notes: notes || null,
    status: 'SUBMITTED',
    parentOfferId: null,
    offerType: 'INITIAL',
    negotiationRound: 1,
    createdAt: now,
    updatedAt: now,
  };
  transportOffers.unshift(newOffer);

  if (request.userId && request.userId !== req.user.id) {
    notifyUser({
      userId: request.userId,
      type: 'transport_quote',
      title: 'New transport quote',
      body: `${transporterName} quoted for ${request.cropName}.`,
      refType: 'transportRequest',
      refId: requestId,
    }).catch(() => {});
  }
  return res.status(201).json({ success: true, data: newOffer });
}

// GET /api/transport-requests/:id/quotes
// Requester (FARMER/BUYER) only — quote comparison for the request owner. A
// transporter must NOT use this endpoint to see competing quotes.
async function getQuotesForRequest(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }
  if (!hasRole(req, 'FARMER', 'BUYER')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const requestId = req.params.id;

  if (USE_DATABASE) {
    try {
      const request = await transportService.findRequestById(requestId);
      if (!request || request.userId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }
      const data = await transportService.findQuotesByRequest(requestId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  const request = findRequestLocally(requestId);
  if (!request || request.userId !== req.user.id) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  const data = transportOffers.filter((o) => o.transportRequestId === requestId);
  return res.status(200).json({ success: true, data });
}

// PUT /api/transport-quotes/:id/accept
// Requester only, atomic: accept selected quote, reject the rest, create one job,
// move request to IN_PROGRESS. A second accept cannot create another job.
async function acceptQuote(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }
  if (!hasRole(req, 'FARMER', 'BUYER')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const quoteId = req.params.id;

  if (USE_DATABASE) {
    try {
      const result = await transportService.acceptQuote({
        quoteId,
        requesterId: req.user.id,
      });
      if (!result.ok) {
        return res.status(result.status).json({ success: false, message: result.message });
      }
      const { quote, job, request } = result.data;
      if (job.transporterId && job.transporterId !== req.user.id) {
        notifyUser({
          userId: job.transporterId,
          type: 'transport_quote_accepted',
          title: 'Transport quote accepted',
          body: `Your quote for ${request.cropName} was accepted.`,
          refType: 'transportJob',
          refId: job.id,
        }).catch(() => {});
      }
      return res.status(200).json({ success: true, data: { quote, job, request } });
    } catch (error) {
      return next(error);
    }
  }

  // ---- In-memory (non-database) path ----
  const quote = transportOffers.find((o) => o.id === quoteId);
  if (!quote) {
    return res.status(404).json({ success: false, message: 'Quote not found' });
  }
  const request = findRequestLocally(quote.transportRequestId);
  if (!request || request.userId !== req.user.id) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  if (request.status !== REQUEST_STATUS.OPEN) {
    return res.status(400).json({ success: false, message: 'Request is not open to quotes' });
  }
  if (quote.status !== 'SUBMITTED') {
    return res.status(400).json({ success: false, message: 'Quote is not in a submittable state' });
  }
  const { transportJobs, createJobRecord } = require('./transportJobsController');
  if (transportJobs.some((j) => j.transportRequestId === request.id)) {
    return res.status(400).json({ success: false, message: 'A job already exists for this request' });
  }

  // Equivalent atomic behavior in memory: all mutations below happen
  // synchronously before any response is produced, so a concurrent accept cannot
  // observe an intermediate state.
  const now = new Date().toISOString();
  quote.status = 'ACCEPTED';
  quote.updatedAt = now;
  transportOffers.forEach((o) => {
    if (o.transportRequestId === request.id && o.status === 'SUBMITTED') {
      o.status = 'REJECTED';
      o.updatedAt = now;
    }
  });
  const job = createJobRecord({
    transportRequestId: request.id,
    transportOfferId: quote.id,
    transporterId: quote.transporterId,
    orderId: request.orderId || null,
    status: 'BOOKED',
    updatedBy: req.user.id,
  });
  request.status = REQUEST_STATUS.IN_PROGRESS;
  request.updatedAt = now;

  if (job.transporterId && job.transporterId !== req.user.id) {
    notifyUser({
      userId: job.transporterId,
      type: 'transport_quote_accepted',
      title: 'Transport quote accepted',
      body: `Your quote for ${request.cropName} was accepted.`,
      refType: 'transportJob',
      refId: job.id,
    }).catch(() => {});
  }
  return res.status(200).json({ success: true, data: { quote, job, request } });
}

// PUT /api/transport-quotes/:id/reject
// Requester only; only a SUBMITTED quote on their own request can be rejected.
async function rejectQuote(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }
  if (!hasRole(req, 'FARMER', 'BUYER')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const quoteId = req.params.id;

  if (USE_DATABASE) {
    try {
      const quote = await transportService.findOfferById(quoteId);
      if (!quote) {
        return res.status(404).json({ success: false, message: 'Quote not found' });
      }
      const request = await transportService.findRequestById(quote.transportRequestId);
      if (!request || request.userId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }
      if (quote.status !== 'SUBMITTED') {
        return res.status(400).json({ success: false, message: 'Only submitted quotes can be rejected' });
      }
      const rejected = await transportService.rejectQuote(quoteId);
      return res.status(200).json({ success: true, data: rejected });
    } catch (error) {
      return next(error);
    }
  }

  const quote = transportOffers.find((o) => o.id === quoteId);
  if (!quote) {
    return res.status(404).json({ success: false, message: 'Quote not found' });
  }
  const request = findRequestLocally(quote.transportRequestId);
  if (!request || request.userId !== req.user.id) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  if (quote.status !== 'SUBMITTED') {
    return res.status(400).json({ success: false, message: 'Only submitted quotes can be rejected' });
  }
  quote.status = 'REJECTED';
  quote.updatedAt = new Date().toISOString();
  return res.status(200).json({ success: true, data: quote });
}

module.exports = {
  createQuote,
  getQuotesForRequest,
  acceptQuote,
  rejectQuote,
  createCounterOffer,
  getNegotiationHistory,
  transportOffers,
};