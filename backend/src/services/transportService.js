const prisma = require('../config/prisma');
const { REQUEST_STATUS, isValidJobTransition } = require('../utils/transportStates');

// ---- Formatters (DB rows -> API shape, mirroring offerService/logisticsService) ----

function formatProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    userId: profile.userId,
    vehicleTypes: profile.vehicleTypes,
    vehicleCapacity: profile.vehicleCapacity === null || profile.vehicleCapacity === undefined ? null : Number(profile.vehicleCapacity),
    baseLocation: profile.baseLocation,
    description: profile.description || null,
    avgRating: profile.avgRating === null || profile.avgRating === undefined ? null : Number(profile.avgRating),
    createdAt: profile.createdAt ? new Date(profile.createdAt).toISOString() : null,
    updatedAt: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : null,
  };
}

function formatRequest(request) {
  if (!request) return null;
  return {
    id: request.id,
    userId: request.userId || null,
    cropName: request.cropName,
    quantity: Number(request.quantity),
    unit: request.unit,
    pickupLocation: request.pickupLocation,
    dropLocation: request.dropLocation,
    requiredBy: request.requiredBy || null,
    vehicleType: request.vehicleType || null,
    expectedBudget: request.expectedBudget === null || request.expectedBudget === undefined ? null : Number(request.expectedBudget),
    distanceKm: request.distanceKm === null || request.distanceKm === undefined ? null : Number(request.distanceKm),
    pickupLat: request.pickupLat === null || request.pickupLat === undefined ? null : Number(request.pickupLat),
    pickupLng: request.pickupLng === null || request.pickupLng === undefined ? null : Number(request.pickupLng),
    dropLat: request.dropLat === null || request.dropLat === undefined ? null : Number(request.dropLat),
    dropLng: request.dropLng === null || request.dropLng === undefined ? null : Number(request.dropLng),
    notes: request.notes || null,
    status: request.status,
    orderId: request.orderId || null,
    createdAt: request.createdAt ? new Date(request.createdAt).toISOString() : null,
    updatedAt: request.updatedAt ? new Date(request.updatedAt).toISOString() : null,
  };
}

function formatOffer(offer) {
  if (!offer) return null;
  return {
    id: offer.id,
    transportRequestId: offer.transportRequestId,
    transporterId: offer.transporterId,
    transporterName: offer.transporterName,
    quotedAmount: Number(offer.quotedAmount),
    vehicleType: offer.vehicleType,
    distanceKm: offer.distanceKm === null || offer.distanceKm === undefined ? null : Number(offer.distanceKm),
    notes: offer.notes || null,
    status: offer.status,
    parentOfferId: offer.parentOfferId || null,
    offerType: offer.offerType || 'INITIAL',
    negotiationRound: offer.negotiationRound === undefined ? 1 : offer.negotiationRound,
    createdAt: offer.createdAt ? new Date(offer.createdAt).toISOString() : null,
    updatedAt: offer.updatedAt ? new Date(offer.updatedAt).toISOString() : null,
  };
}

function formatJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    transportRequestId: job.transportRequestId,
    transportOfferId: job.transportOfferId,
    transporterId: job.transporterId,
    orderId: job.orderId || null,
    status: job.status,
    updatedBy: job.updatedBy || null,
    requesterUserId: job.transportRequest ? job.transportRequest.userId || null : null,
    createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
    updatedAt: job.updatedAt ? new Date(job.updatedAt).toISOString() : null,
  };
}

function formatReview(review) {
  if (!review) return null;
  return {
    id: review.id,
    jobId: review.jobId,
    reviewerId: review.reviewerId,
    transporterId: review.transporterId,
    rating: review.rating,
    comment: review.comment || null,
    createdAt: review.createdAt ? new Date(review.createdAt).toISOString() : null,
    updatedAt: review.updatedAt ? new Date(review.updatedAt).toISOString() : null,
  };
}

// ---- Transporter profiles ----

async function findProfileByUserId(userId) {
  const profile = await prisma.transporterprofile.findUnique({ where: { userId } });
  return formatProfile(profile);
}

async function createProfile({ userId, vehicleTypes, vehicleCapacity, baseLocation, description }) {
  const created = await prisma.transporterprofile.create({
    data: {
      userId,
      vehicleTypes,
      vehicleCapacity: vehicleCapacity === undefined || vehicleCapacity === null ? null : vehicleCapacity,
      baseLocation,
      description: description || null,
    },
  });
  return formatProfile(created);
}

async function updateProfile(userId, data) {
  const updated = await prisma.transporterprofile.update({
    where: { userId },
    data,
  });
  return formatProfile(updated);
}

// ---- Transport requests ----

async function findRequestById(id) {
  const request = await prisma.transportrequest.findUnique({ where: { id } });
  return formatRequest(request);
}

async function findRequestsForRequester(userId) {
  const requests = await prisma.transportrequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return requests.map(formatRequest);
}

async function findRequestsForTransporter(userId) {
  const requests = await prisma.transportrequest.findMany({
    where: {
      OR: [
        { offers: { some: { transporterId: userId } } },
        { jobs: { some: { transporterId: userId } } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
  return requests.map(formatRequest);
}

// The transporter's marketplace surface: currently OPEN requests. When a
// transporter profile is supplied, requests are filtered to those compatible
// with the transporter's vehicle types — a request with no vehicle preference
// is always compatible; a request with a preference must be one the transporter
// offers. Transporters without a resolved profile see the full availability
// list (they cannot quote until they create a profile anyway).
async function findOpenRequests(transporterId, profile) {
  const requests = await prisma.transportrequest.findMany({
    where: { status: REQUEST_STATUS.OPEN },
    orderBy: { createdAt: 'desc' },
  });
  const formatted = requests.map(formatRequest);
  if (!transporterId || !profile) return formatted;
  const types = String(profile.vehicleTypes || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (types.length === 0) return formatted;
  return formatted.filter((r) => !r.vehicleType || types.includes(r.vehicleType));
}

function profileVehicleTypes(profile) {
  if (!profile) return [];
  return String(profile.vehicleTypes || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// Resolve the vehicle type for a quote as server-authoritative: never from the
// client body. Returns { vehicleType } with the transporter's first vehicle (or
// the request's preferred type when the transporter offers it), or
// { incompatible: true } when the request demands a vehicle the transporter
// does not offer.
function deriveQuoteVehicle(profile, request) {
  const types = profileVehicleTypes(profile);
  if (types.length === 0) return { vehicleType: null };
  if (!request || !request.vehicleType) return { vehicleType: types[0] };
  if (types.includes(request.vehicleType)) return { vehicleType: request.vehicleType };
  return { incompatible: true, vehicleType: null };
}

async function createRequest(data) {
  const created = await prisma.transportrequest.create({
    data: {
      userId: data.userId || null,
      cropName: data.cropName,
      quantity: data.quantity,
      unit: data.unit,
      pickupLocation: data.pickupLocation,
      dropLocation: data.dropLocation,
      requiredBy: data.requiredBy || null,
      vehicleType: data.vehicleType || null,
      expectedBudget: data.expectedBudget === undefined || data.expectedBudget === null ? null : data.expectedBudget,
      distanceKm: data.distanceKm === undefined || data.distanceKm === null ? null : data.distanceKm,
      pickupLat: data.pickupLat === undefined || data.pickupLat === null ? null : data.pickupLat,
      pickupLng: data.pickupLng === undefined || data.pickupLng === null ? null : data.pickupLng,
      dropLat: data.dropLat === undefined || data.dropLat === null ? null : data.dropLat,
      dropLng: data.dropLng === undefined || data.dropLng === null ? null : data.dropLng,
      notes: data.notes || null,
      status: REQUEST_STATUS.OPEN,
      orderId: data.orderId || null,
    },
  });
  return formatRequest(created);
}

async function deleteRequest(id) {
  await prisma.transportrequest.delete({ where: { id } });
  return { id };
}

async function countJobsByRequest(requestId) {
  return prisma.transportjob.count({ where: { transportRequestId: requestId } });
}

async function countAcceptedOffersByRequest(requestId) {
  return prisma.transportoffer.count({
    where: { transportRequestId: requestId, status: 'ACCEPTED' },
  });
}

// ---- Transport offers / quotes ----

async function findOfferById(id) {
  const offer = await prisma.transportoffer.findUnique({ where: { id } });
  return formatOffer(offer);
}

async function findQuotesByRequest(requestId) {
  const offers = await prisma.transportoffer.findMany({
    where: { transportRequestId: requestId },
    orderBy: { createdAt: 'asc' },
  });
  return offers.map(formatOffer);
}

// An active (still negotiable) quote from a transporter on a request.
async function findActiveQuoteByTransporter(requestId, transporterId) {
  const offer = await prisma.transportoffer.findFirst({
    where: { transportRequestId: requestId, transporterId, status: 'SUBMITTED' },
  });
  return formatOffer(offer);
}

async function createQuote(data) {
  const created = await prisma.transportoffer.create({
    data: {
      transportRequestId: data.transportRequestId,
      transporterId: data.transporterId,
      transporterName: data.transporterName,
      quotedAmount: data.quotedAmount,
      vehicleType: data.vehicleType,
      distanceKm: data.distanceKm === undefined || data.distanceKm === null ? null : data.distanceKm,
      notes: data.notes || null,
      status: data.status || 'SUBMITTED',
      parentOfferId: data.parentOfferId || null,
      offerType: data.offerType || 'INITIAL',
      negotiationRound: data.negotiationRound === undefined ? 1 : data.negotiationRound,
    },
  });
  return formatOffer(created);
}

async function rejectQuote(id) {
  const updated = await prisma.transportoffer.update({
    where: { id },
    data: { status: 'REJECTED' },
  });
  return formatOffer(updated);
}

// ---- Counter offers / negotiation ----

// Walk the parent-offer chain from INVENTORY null up to the given offer, then
// reverse so history reads newest-first (the most recent offer first). Mirrors
// the in-memory controller. Includes the max negotiationRound so the caller can
// derive who is currently allowed to act (round/actor parity).
async function getNegotiationHistory(offerId) {
  const offers = [];
  let current = await prisma.transportoffer.findUnique({ where: { id: offerId } });
  while (current) {
    offers.unshift(current);
    if (!current.parentOfferId) break;
    current = await prisma.transportoffer.findUnique({ where: { id: current.parentOfferId } });
  }
  return offers.reverse().map(formatOffer);
}

// The transporterId is fixed for the whole negotiation thread (the transporter
// who opened it). The requester side is identified by the request owner. Authors
// alternate: odd negotiationRound = transporter-authored (INITIAL), even =
// requester-authored (COUNTER). Guards are the same as acceptQuote/rejectQuote
// because a counter is only valid against the latest active offer.
async function createCounterOffer(data) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.transportOffer.findUnique({ where: { id: data.offerId } });
    if (!offer) {
      return { ok: false, status: 404, message: 'Quote not found' };
    }
    const request = await tx.transportRequest.findUnique({
      where: { id: offer.transportRequestId },
    });
    if (!request || request.status !== REQUEST_STATUS.OPEN) {
      return { ok: false, status: 400, message: 'Request is not open to counters' };
    }
    if (offer.status !== 'SUBMITTED') {
      return { ok: false, status: 400, message: 'Only the latest submitted quote can be countered' };
    }
    // Reject counters past a finalization: a job (accept) or REJECTED thread
    // (reject) closes the negotiation.
    const job = await tx.transportJob.findFirst({
      where: { transportRequestId: offer.transportRequestId },
    });
    if (job) {
      return { ok: false, status: 400, message: 'Negotiation is closed; a job already exists' };
    }

    // Actor must be a participant AND not the author of the offer being
    // countered (you counter the other side's latest offer).
    const isRequesterSide = request.userId === data.actorId;
    const isTransporterSide = offer.transporterId === data.actorId;
    if (!isRequesterSide && !isTransporterSide) {
      return { ok: false, status: 403, message: 'Forbidden' };
    }
    const latestAuthorIsTransporter = offer.negotiationRound % 2 === 1;
    if (latestAuthorIsTransporter === isTransporterSide) {
      return { ok: false, status: 400, message: 'You cannot counter your own quote' };
    }

    // Supersede the parent offer so only the newest chain link is actionable,
    // then create the matched counter offer chained via parentOfferId.
    const superseded = await tx.transportOffer.update({
      where: { id: offer.id },
      data: { status: 'SUPERSEDED' },
    });
    const created = await tx.transportOffer.create({
      data: {
        transportRequestId: offer.transportRequestId,
        transporterId: offer.transporterId,
        transporterName: offer.transporterName,
        quotedAmount: data.quotedAmount,
        vehicleType: offer.vehicleType,
        distanceKm: offer.distanceKm,
        notes: data.notes || null,
        status: 'SUBMITTED',
        parentOfferId: offer.id,
        offerType: 'COUNTER',
        negotiationRound: offer.negotiationRound + 1,
      },
    });
    return {
      ok: true,
      status: 201,
      data: { superseded: formatOffer(superseded), offer: formatOffer(created) },
    };
  });
}

// Accept a quote atomically: accept the selected quote, reject all other
// SUBMITTED quotes on the request, create exactly ONE TransportJob, and move the
// request to IN_PROGRESS. Re-entrancy is impossible: a request with an existing
// job (or a non-SUBMITTED/non-OPEN pairing) is refused, so calling accept twice
// never creates a second job. Returns { ok } result objects so the controller
// can map business failures to HTTP statuses without relying on exceptions.
async function acceptQuote({ quoteId, requesterId }) {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.transportOffer.findUnique({ where: { id: quoteId } });
    if (!quote) {
      return { ok: false, status: 404, message: 'Quote not found' };
    }
    const request = await tx.transportRequest.findUnique({
      where: { id: quote.transportRequestId },
    });
    if (!request || request.userId !== requesterId) {
      return { ok: false, status: 404, message: 'Request not found' };
    }
    if (request.status !== REQUEST_STATUS.OPEN) {
      return { ok: false, status: 400, message: 'Request is not open to quotes' };
    }
    if (quote.status !== 'SUBMITTED') {
      return { ok: false, status: 400, message: 'Quote is not in a submittable state' };
    }
    const jobCount = await tx.transportJob.count({
      where: { transportRequestId: quote.transportRequestId },
    });
    if (jobCount > 0) {
      return { ok: false, status: 400, message: 'A job already exists for this request' };
    }

    const acceptedQuote = await tx.transportOffer.update({
      where: { id: quoteId },
      data: { status: 'ACCEPTED' },
    });
    await tx.transportOffer.updateMany({
      where: { transportRequestId: quote.transportRequestId, status: 'SUBMITTED' },
      data: { status: 'REJECTED' },
    });
    const job = await tx.transportJob.create({
      data: {
        transportRequestId: quote.transportRequestId,
        transportOfferId: quoteId,
        transporterId: quote.transporterId,
        orderId: request.orderId || null,
        status: 'BOOKED',
        updatedBy: requesterId,
      },
    });
    const updatedRequest = await tx.transportRequest.update({
      where: { id: quote.transportRequestId },
      data: { status: REQUEST_STATUS.IN_PROGRESS },
    });

    return {
      ok: true,
      data: {
        quote: formatOffer(acceptedQuote),
        job: formatJob(job),
        request: formatRequest(updatedRequest),
      },
    };
  });
}

// ---- Transport jobs ----

async function findJobById(id) {
  const job = await prisma.transportjob.findUnique({
    where: { id },
    include: { transportRequest: { select: { userId: true } } },
  });
  return formatJob(job);
}

const TERMINAL_JOB_STATUSES = ['DELIVERED', 'CANCELLED'];

async function findJobsForTransporter(transporterId, onlyHistory = false) {
  const jobs = await prisma.transportjob.findMany({
    where: {
      transporterId,
      ...(onlyHistory ? { status: { in: TERMINAL_JOB_STATUSES } } : {}),
    },
    include: { transportRequest: { select: { userId: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return jobs.map(formatJob);
}

async function findJobsForRequester(userId, onlyHistory = false) {
  const jobs = await prisma.transportjob.findMany({
    where: {
      transportRequest: { userId },
      ...(onlyHistory ? { status: { in: TERMINAL_JOB_STATUSES } } : {}),
    },
    include: { transportRequest: { select: { userId: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return jobs.map(formatJob);
}

// Update job status (assigned transporter only). Returns { ok } results. When
// the job reaches DELIVERED the transport request is moved to COMPLETED in the
// same transaction. No payment is created and no GPS tracking is claimed.
async function updateJobStatus({ jobId, status, actorId }) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.transportJob.findUnique({
      where: { id: jobId },
      include: { transportRequest: { select: { userId: true } } },
    });
    if (!job) {
      return { ok: false, status: 404, message: 'Job not found' };
    }
    if (job.transporterId !== actorId) {
      return { ok: false, status: 404, message: 'Job not found' };
    }
    // Enforce the same state machine as the in-memory path: arbitrary jumps are
    // rejected and terminal states (DELIVERED/CANCELLED) cannot be left.
    if (!isValidJobTransition(job.status, status)) {
      return {
        ok: false,
        status: 400,
        message: `Cannot transition from ${job.status} to ${status}`,
      };
    }
    const updated = await tx.transportJob.update({
      where: { id: jobId },
      data: { status, updatedBy: actorId },
      include: { transportRequest: { select: { userId: true } } },
    });
    let request = null;
    if (status === 'DELIVERED') {
      request = await tx.transportRequest.update({
        where: { id: job.transportRequestId },
        data: { status: REQUEST_STATUS.COMPLETED },
      });
    }
    return {
      ok: true,
      data: {
        job: formatJob(updated),
        request: request ? formatRequest(request) : null,
        requesterUserId: job.transportRequest ? job.transportRequest.userId || null : null,
      },
    };
  });
}

// ---- Transport reviews ----

async function findReviewForJob(jobId, reviewerId) {
  const review = await prisma.transportreview.findUnique({
    where: { jobId_reviewerId: { jobId, reviewerId } },
  });
  return formatReview(review);
}

// Create a review and immediately recalculate the transporter's avgRating from
// all of their TransportReview records, persisting it on the profile. Atomic.
async function createReviewAndRecalc({ jobId, reviewerId, transporterId, rating, comment }) {
  return prisma.$transaction(async (tx) => {
    const review = await tx.transportReview.create({
      data: { jobId, reviewerId, transporterId, rating, comment: comment || null },
    });
    const aggregate = await tx.transportReview.aggregate({
      where: { transporterId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    let profile = null;
    if (aggregate._count.rating > 0) {
      profile = await tx.transporterProfile.update({
        where: { userId: transporterId },
        data: { avgRating: aggregate._avg.rating },
      });
    }
    return { review: formatReview(review), profile: formatProfile(profile) };
  });
}

async function findReviewsForTransporter(transporterId) {
  const reviews = await prisma.transportreview.findMany({
    where: { transporterId },
    orderBy: { createdAt: 'desc' },
  });
  const formatted = reviews.map(formatReview);
  let average = null;
  if (formatted.length > 0) {
    const sum = formatted.reduce((acc, r) => acc + r.rating, 0);
    average = Math.round((sum / formatted.length) * 100) / 100;
  }
  return { average, count: formatted.length, reviews: formatted };
}

module.exports = {
  findProfileByUserId,
  createProfile,
  updateProfile,
  findRequestById,
  findRequestsForRequester,
  findRequestsForTransporter,
  findOpenRequests,
  profileVehicleTypes,
  deriveQuoteVehicle,
  createRequest,
  deleteRequest,
  countJobsByRequest,
  countAcceptedOffersByRequest,
  findOfferById,
  findQuotesByRequest,
  findActiveQuoteByTransporter,
  createQuote,
  rejectQuote,
  acceptQuote,
  createCounterOffer,
  getNegotiationHistory,
  findJobById,
  findJobsForTransporter,
  findJobsForRequester,
  updateJobStatus,
  findReviewForJob,
  createReviewAndRecalc,
  findReviewsForTransporter,
};