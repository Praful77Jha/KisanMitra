const { USE_DATABASE } = require('../config/config');
const orderService = USE_DATABASE ? require('../services/orderService') : null;
const reviewService = USE_DATABASE ? require('../services/reviewService') : null;
const { notifyUser } = require('./notificationsController');

// A rating/review is only eligible once the order reaches the terminal Delivered
// stage. This prevents premature ratings while keeping the rule simple and safe.
const ELIGIBLE_STATUS = 'Delivered';

const MAX_COMMENT_LENGTH = 1200;

// In-memory fallback store (USE_DATABASE=false), mirroring the other controllers.
const reviews = [];

// Determine who the reviewer may rate given the order's two parties. The
// reviewed user is ALWAYS derived server-side from the authenticated reviewer and
// the order parties — never from the request body.
function computeReviewedUser(order, reviewerId) {
  if (!order) return null;
  // Buyer rating the seller of the order.
  if (order.userId && order.userId === reviewerId) {
    return { reviewedUserId: order.sellerUserId || null, direction: 'buyer-to-seller' };
  }
  // Seller rating the buyer of the order.
  if (order.sellerUserId && order.sellerUserId === reviewerId) {
    return { reviewedUserId: order.userId || null, direction: 'seller-to-buyer' };
  }
  return { reviewedUserId: null, direction: null };
}

function validateRatingInput(rating, comment) {
  if (rating === undefined || rating === null || !Number.isInteger(Number(rating))) {
    return 'rating must be an integer between 1 and 5';
  }
  const numeric = Number(rating);
  if (numeric < 1 || numeric > 5) {
    return 'rating must be an integer between 1 and 5';
  }
  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') {
      return 'comment must be text';
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
      return `comment cannot exceed ${MAX_COMMENT_LENGTH} characters`;
    }
  }
  return null;
}

// POST /api/orders/:orderId/reviews
async function createReview(req, res, next) {
  const orderId = req.params.orderId;
  const { rating, comment } = req.body;
  const reviewerId = req.user.id;

  const validationError = validateRatingInput(rating, comment);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  if (USE_DATABASE) {
    try {
      const order = await orderService.findOrderById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      // Only the two parties to the order can be rated; ensure it is at an
      // eligible (Delivered) status before a rating is accepted.
      if (order.status !== ELIGIBLE_STATUS) {
        return res.status(400).json({
          success: false,
          message: `You can only rate after the order is ${ELIGIBLE_STATUS}`,
        });
      }
      const party = computeReviewedUser(order, reviewerId);
      if (!party || !party.reviewedUserId) {
        return res.status(400).json({
          success: false,
          message: 'You are not a party to this order',
        });
      }
      if (party.reviewedUserId === reviewerId) {
        return res.status(400).json({ success: false, message: 'You cannot rate yourself' });
      }

      // Duplicate-submit protection: one rating per reviewer per order (unique).
      const existing = await reviewService.findMyReviewForOrder(orderId, reviewerId);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'You have already rated this order',
        });
      }

      const review = await reviewService.createReview({
        orderId,
        reviewerId,
        reviewedUserId: party.reviewedUserId,
        rating: Number(rating),
        comment: comment !== undefined && comment !== null ? String(comment).trim() : null,
      });
      // Notify the reviewed user that they received a new rating. Best-effort
      // and intentionally not awaited.
      if (party.reviewedUserId && party.reviewedUserId !== reviewerId) {
        notifyUser({
          userId: party.reviewedUserId,
          type: 'review',
          title: 'New rating received',
          body: 'Someone rated your order.',
          refType: 'review',
          refId: review.id,
        }).catch(() => {});
      }
      return res.status(201).json({ success: true, data: review });
    } catch (error) {
      return next(error);
    }
  }

  // ---- In-memory (non-database) path ----
  const { orders } = require('./ordersController');
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (order.status !== ELIGIBLE_STATUS) {
    return res.status(400).json({
      success: false,
      message: `You can only rate after the order is ${ELIGIBLE_STATUS}`,
    });
  }
  const party = computeReviewedUser(order, reviewerId);
  if (!party || !party.reviewedUserId) {
    return res.status(400).json({ success: false, message: 'You are not a party to this order' });
  }
  if (party.reviewedUserId === reviewerId) {
    return res.status(400).json({ success: false, message: 'You cannot rate yourself' });
  }
  if (reviews.some((r) => r.orderId === orderId && r.reviewerId === reviewerId)) {
    return res.status(409).json({
      success: false,
      message: 'You have already rated this order',
    });
  }

  const newReview = {
    id: `rev-${reviews.length + 1}`,
    orderId,
    reviewerId,
    reviewedUserId: party.reviewedUserId,
    rating: Number(rating),
    comment: comment !== undefined && comment !== null ? String(comment).trim() : null,
    createdAt: new Date().toISOString(),
  };
  reviews.push(newReview);

  // Notify the reviewed user that they received a new rating. Best-effort
  // and intentionally not awaited.
  if (party.reviewedUserId && party.reviewedUserId !== reviewerId) {
    notifyUser({
      userId: party.reviewedUserId,
      type: 'review',
      title: 'New rating received',
      body: 'Someone rated your order.',
      refType: 'review',
      refId: newReview.id,
    }).catch(() => {});
  }

  return res.status(201).json({ success: true, data: newReview });
}

// GET /api/orders/:orderId/reviews
// Reviews against a specific order. Only the two parties to the order may view
// them, so third parties cannot enumerate reviews via order IDs.
async function getOrderReviews(req, res, next) {
  const orderId = req.params.orderId;

  if (USE_DATABASE) {
    try {
      const order = await orderService.findOrderById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      const party = computeReviewedUser(order, req.user.id);
      if (!party.direction) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const data = await reviewService.findReviewsForOrder(orderId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  const { orders } = require('./ordersController');
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const party = computeReviewedUser(order, req.user.id);
  if (!party.direction) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const data = reviews.filter((r) => r.orderId === orderId);
  return res.status(200).json({ success: true, data });
}

// GET /api/users/:userId/reviews
// A user's received reviews plus the calculated aggregate (average + count).
// Any authenticated user may see a user's received reviews (public profile info),
// but reviewer identity is limited to name; no private order data is exposed.
async function getUserReviews(req, res, next) {
  const userId = req.params.userId;

  if (USE_DATABASE) {
    try {
      const data = await reviewService.findReviewsForUser(userId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  const received = reviews.filter((r) => r.reviewedUserId === userId);
  let average = null;
  if (received.length > 0) {
    const sum = received.reduce((acc, r) => acc + r.rating, 0);
    average = Math.round((sum / received.length) * 100) / 100;
  }
  return res.status(200).json({
    success: true,
    data: { average, count: received.length, reviews: received },
  });
}

// PUT /api/orders/:orderId/reviews/:reviewId
// Only the review's author may edit their own rating/comment. Ownership is
// enforced server-side: the review must exist, belong to the given order, and be
// authored by the authenticated user.
async function updateReview(req, res, next) {
  const orderId = req.params.orderId;
  const reviewId = req.params.reviewId;
  const { rating, comment } = req.body;

  const validationError = validateRatingInput(rating, comment);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  if (USE_DATABASE) {
    try {
      const review = await reviewService.findReviewById(reviewId);
      if (!review || review.orderId !== orderId) {
        return res.status(404).json({ success: false, message: 'Review not found' });
      }
      if (review.reviewerId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const updated = await reviewService.updateReview(reviewId, {
        rating: Number(rating),
        comment: comment !== undefined && comment !== null ? String(comment).trim() : null,
      });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      return next(error);
    }
  }

  if (!req.params.reviewId) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }
  const review = reviews.find((r) => r.id === reviewId);
  if (!review || review.orderId !== orderId) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }
  if (review.reviewerId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  review.rating = Number(rating);
  review.comment = comment !== undefined && comment !== null ? String(comment).trim() : null;
  return res.status(200).json({ success: true, data: review });
}

// DELETE /api/orders/:orderId/reviews/:reviewId
// Only the review's author may delete their own review.
async function deleteReview(req, res, next) {
  const orderId = req.params.orderId;
  const reviewId = req.params.reviewId;

  if (USE_DATABASE) {
    try {
      const review = await reviewService.findReviewById(reviewId);
      if (!review || review.orderId !== orderId) {
        return res.status(404).json({ success: false, message: 'Review not found' });
      }
      if (review.reviewerId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      await reviewService.deleteReview(reviewId);
      return res.status(200).json({ success: true, data: { id: reviewId } });
    } catch (error) {
      return next(error);
    }
  }

  const index = reviews.findIndex((r) => r.id === reviewId && r.orderId === orderId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }
  if (reviews[index].reviewerId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const [removed] = reviews.splice(index, 1);
  return res.status(200).json({ success: true, data: { id: removed.id } });
}

module.exports = { createReview, getOrderReviews, getUserReviews, updateReview, deleteReview, reviews };
