const { USE_DATABASE } = require('../config/config');
const transportService = USE_DATABASE ? require('../services/transportService') : null;
const { notifyUser } = require('./notificationsController');
const { isAuthenticated, hasRole } = require('../middlewares/auth');
const { JOB_TRANSITIONS, isValidJobTransition, REQUEST_STATUS } = require('../utils/transportStates');

// In-memory (non-database) job + review stores, shared so routes/tests can
// inspect them, mirroring the other controllers.
const transportJobs = [];
const transportReviews = [];
let jobIdCounter = 0;
let reviewIdCounter = 0;

function makeJobId() {
  jobIdCounter += 1;
  return `TJ-${String(jobIdCounter).padStart(4, '0')}`;
}

function makeReviewId() {
  reviewIdCounter += 1;
  return `TV-${String(reviewIdCounter).padStart(4, '0')}`;
}

// Shared factory used by acceptQuote (transportOffersController) so exactly one
// record exists per accepted quote, with a stable id sequence.
function createJobRecord(data) {
  const now = new Date().toISOString();
  const job = {
    id: makeJobId(),
    transportRequestId: data.transportRequestId,
    transportOfferId: data.transportOfferId,
    transporterId: data.transporterId,
    orderId: data.orderId || null,
    status: data.status || 'BOOKED',
    updatedBy: data.updatedBy || null,
    createdAt: now,
    updatedAt: now,
  };
  transportJobs.push(job);
  return job;
}

function findRequestLocally(id) {
  const { transportRequests } = require('./transportRequestsController');
  return transportRequests.find((r) => r.id === id) || null;
}

function recalcAvgRatingLocally(transporterId) {
  const { transporterProfiles } = require('./transporterController');
  const profile = transporterProfiles.find((p) => p.userId === transporterId);
  const ratings = transportReviews.filter((r) => r.transporterId === transporterId);
  let average = null;
  if (ratings.length > 0 && profile) {
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    average = Math.round((sum / ratings.length) * 100) / 100;
    profile.avgRating = average;
  }
  return average;
}

// GET /api/transport-jobs
// Assigned transporter sees their jobs; a requester sees jobs against their own
// transport requests. Unrelated users get an empty list (nothing leaked).
async function getAllJobs(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }

  if (USE_DATABASE) {
    try {
      const data = hasRole(req, 'TRANSPORTER')
        ? await transportService.findJobsForTransporter(req.user.id)
        : await transportService.findJobsForRequester(req.user.id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  const requestIds = new Set(
    transportRequestsOf(req.user.id).map((r) => r.id)
  );
  const mine = transportJobs.filter(
    (j) => j.transporterId === req.user.id || requestIds.has(j.transportRequestId)
  );
  return res.status(200).json({ success: true, data: mine });
}

function transportRequestsOf(userId) {
  const { transportRequests } = require('./transportRequestsController');
  return transportRequests.filter((r) => r.userId === userId);
}

// GET /api/transport-jobs/history
// Terminal jobs only (DELIVERED/CANCELLED), same party scoping as the main list.
async function getJobHistory(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }

  if (USE_DATABASE) {
    try {
      const data = hasRole(req, 'TRANSPORTER')
        ? await transportService.findJobsForTransporter(req.user.id, true)
        : await transportService.findJobsForRequester(req.user.id, true);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  const requestIds = new Set(transportRequestsOf(req.user.id).map((r) => r.id));
  const mine = transportJobs.filter(
    (j) =>
      (j.transporterId === req.user.id || requestIds.has(j.transportRequestId)) &&
      (j.status === 'DELIVERED' || j.status === 'CANCELLED')
  );
  return res.status(200).json({ success: true, data: mine });
}

// GET /api/transport-jobs/:id
// Assigned transporter or the requester who owns the request. Anyone else: 404.
async function getJobById(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }

  const jobId = req.params.id;
  let job;
  let requesterUserId = null;

  if (USE_DATABASE) {
    try {
      job = await transportService.findJobById(jobId);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }
      requesterUserId = job.requesterUserId;
    } catch (error) {
      return next(error);
    }
  } else {
    job = transportJobs.find((j) => j.id === jobId) || null;
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    const request = findRequestLocally(job.transportRequestId);
    requesterUserId = request ? request.userId : null;
  }

  if (job.transporterId === req.user.id || requesterUserId === req.user.id) {
    return res.status(200).json({ success: true, data: job });
  }
  return res.status(404).json({ success: false, message: 'Job not found' });
}

// PUT /api/transport-jobs/:id/status
// Only the assigned TRANSPORTER may advance/cancel status. Enforces valid state
// transitions server-side; arbitrary jumps are rejected. DELIVERED completes the
// transport request and notifies the requester.
async function updateJobStatus(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }
  if (!hasRole(req, 'TRANSPORTER')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const jobId = req.params.id;
  const toStatus = req.body && req.body.status;
  if (!toStatus || !Object.prototype.hasOwnProperty.call(JOB_TRANSITIONS, toStatus)) {
    return res.status(400).json({ success: false, message: 'status is invalid' });
  }

  if (USE_DATABASE) {
    try {
      const result = await transportService.updateJobStatus({ jobId, status: toStatus, actorId: req.user.id });
      if (!result.ok) {
        return res.status(result.status).json({ success: false, message: result.message });
      }
      const { job, requesterUserId } = result.data;
      if (requesterUserId && requesterUserId !== req.user.id) {
        notifyUser({
          userId: requesterUserId,
          type: 'transport_status',
          title: 'Transport status update',
          body: `Your transport job is now ${job.status}.`,
          refType: 'transportJob',
          refId: job.id,
        }).catch(() => {});
      }
      if (toStatus === 'DELIVERED' && requesterUserId && requesterUserId !== req.user.id) {
        notifyUser({
          userId: requesterUserId,
          type: 'transport_delivered',
          title: 'Transport delivered',
          body: 'Your transport job has been delivered.',
          refType: 'transportJob',
          refId: job.id,
        }).catch(() => {});
      }
      return res.status(200).json({ success: true, data: job });
    } catch (error) {
      return next(error);
    }
  }

  // ---- In-memory (non-database) path ----
  const job = transportJobs.find((j) => j.id === jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  if (job.transporterId !== req.user.id) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  if (!isValidJobTransition(job.status, toStatus)) {
    return res.status(400).json({
      success: false,
      message: `Cannot transition from ${job.status} to ${toStatus}`,
    });
  }

  job.status = toStatus;
  job.updatedBy = req.user.id;
  job.updatedAt = new Date().toISOString();

  const request = findRequestLocally(job.transportRequestId);
  if (toStatus === 'DELIVERED' && request) {
    request.status = REQUEST_STATUS.COMPLETED;
    request.updatedAt = job.updatedAt;
  }

  const requesterUserId = request ? request.userId : null;
  if (requesterUserId && requesterUserId !== req.user.id) {
    notifyUser({
      userId: requesterUserId,
      type: 'transport_status',
      title: 'Transport status update',
      body: `Your transport job is now ${job.status}.`,
      refType: 'transportJob',
      refId: job.id,
    }).catch(() => {});
  }
  if (toStatus === 'DELIVERED' && requesterUserId && requesterUserId !== req.user.id) {
    notifyUser({
      userId: requesterUserId,
      type: 'transport_delivered',
      title: 'Transport delivered',
      body: 'Your transport job has been delivered.',
      refType: 'transportJob',
      refId: job.id,
    }).catch(() => {});
  }
  return res.status(200).json({ success: true, data: job });
}

const MAX_COMMENT_LENGTH = 1200;

// POST /api/transport-jobs/:id/review
// Only the requester of a DELIVERED job may review; one review per reviewer per
// job. The transporter's avgRating is recalculated from TransportReview rows and
// persisted on their profile. The existing order Review model is untouched.
async function createReview(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }
  if (!hasRole(req, 'FARMER', 'BUYER')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const jobId = req.params.id;
  const { rating, comment } = req.body;

  if (rating === undefined || rating === null || !Number.isInteger(Number(rating))) {
    return res.status(400).json({ success: false, message: 'rating must be an integer between 1 and 5' });
  }
  const numericRating = Number(rating);
  if (numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ success: false, message: 'rating must be an integer between 1 and 5' });
  }
  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') {
      return res.status(400).json({ success: false, message: 'comment must be text' });
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ success: false, message: `comment cannot exceed ${MAX_COMMENT_LENGTH} characters` });
    }
  }
  const normalizedComment = comment !== undefined && comment !== null ? String(comment).trim() : null;

  if (USE_DATABASE) {
    try {
      const job = await transportService.findJobById(jobId);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }
      if (job.status !== 'DELIVERED') {
        return res.status(400).json({ success: false, message: 'You can only review a delivered job' });
      }
      const request = await transportService.findRequestById(job.transportRequestId);
      if (!request || request.userId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You are not a party to this job' });
      }
      const existing = await transportService.findReviewForJob(jobId, req.user.id);
      if (existing) {
        return res.status(409).json({ success: false, message: 'You have already reviewed this job' });
      }
      const { review } = await transportService.createReviewAndRecalc({
        jobId,
        reviewerId: req.user.id,
        transporterId: job.transporterId,
        rating: numericRating,
        comment: normalizedComment,
      });
      if (job.transporterId && job.transporterId !== req.user.id) {
        notifyUser({
          userId: job.transporterId,
          type: 'transport_review',
          title: 'New transport rating',
          body: 'Someone rated your transport job.',
          refType: 'transportJob',
          refId: jobId,
        }).catch(() => {});
      }
      return res.status(201).json({ success: true, data: review });
    } catch (error) {
      return next(error);
    }
  }

  // ---- In-memory (non-database) path ----
  const job = transportJobs.find((j) => j.id === jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  if (job.status !== 'DELIVERED') {
    return res.status(400).json({ success: false, message: 'You can only review a delivered job' });
  }
  const request = findRequestLocally(job.transportRequestId);
  if (!request || request.userId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'You are not a party to this job' });
  }
  if (transportReviews.some((r) => r.jobId === jobId && r.reviewerId === req.user.id)) {
    return res.status(409).json({ success: false, message: 'You have already reviewed this job' });
  }

  const now = new Date().toISOString();
  const newReview = {
    id: makeReviewId(),
    jobId,
    reviewerId: req.user.id,
    transporterId: job.transporterId,
    rating: numericRating,
    comment: normalizedComment,
    createdAt: now,
    updatedAt: now,
  };
  transportReviews.push(newReview);
  recalcAvgRatingLocally(job.transporterId);

  if (job.transporterId && job.transporterId !== req.user.id) {
    notifyUser({
      userId: job.transporterId,
      type: 'transport_review',
      title: 'New transport rating',
      body: 'Someone rated your transport job.',
      refType: 'transportJob',
      refId: jobId,
    }).catch(() => {});
  }
  return res.status(201).json({ success: true, data: newReview });
}

// GET /api/transporters/:userId/reviews
// Any authenticated user may view a transporter's received ratings (public
// profile info), shaped like the existing user reviews endpoint.
async function getTransporterReviews(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ success: false, message: 'Missing or expired authorization' });
  }

  const transporterId = req.params.userId;

  if (USE_DATABASE) {
    try {
      const data = await transportService.findReviewsForTransporter(transporterId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  const received = transportReviews.filter((r) => r.transporterId === transporterId);
  let average = null;
  if (received.length > 0) {
    const sum = received.reduce((acc, r) => acc + r.rating, 0);
    average = Math.round((sum / received.length) * 100) / 100;
  }
  return res.status(200).json({ success: true, data: { average, count: received.length, reviews: received } });
}

module.exports = {
  getAllJobs,
  getJobHistory,
  getJobById,
  updateJobStatus,
  createReview,
  getTransporterReviews,
  createJobRecord,
  transportJobs,
  transportReviews,
};