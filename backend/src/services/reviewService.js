const prisma = require('../config/prisma');

function formatReview(review) {
  if (!review) return null;
  return {
    id: review.id,
    orderId: review.orderId,
    reviewerId: review.reviewerId,
    reviewedUserId: review.reviewedUserId,
    rating: review.rating,
    comment: review.comment || null,
    createdAt: review.createdAt ? new Date(review.createdAt).toISOString() : null,
  };
}

// Reviews received by a user, with the reviewer's name attached and an overall
// aggregate (average rating + count). Aggregate is calculated on the fly; it is
// never stored redundantly.
async function findReviewsForUser(userId) {
  const reviews = await prisma.review.findMany({
    where: { reviewedUserId: userId },
    orderBy: { createdAt: 'desc' },
    include: { reviewer: { select: { name: true } } },
  });
  const items = reviews.map((r) => ({
    ...formatReview(r),
    reviewerName: r.reviewer ? r.reviewer.name : null,
  }));
  let average = null;
  if (items.length > 0) {
    const sum = items.reduce((acc, r) => acc + r.rating, 0);
    average = Math.round((sum / items.length) * 100) / 100;
  }
  return { average, count: items.length, reviews: items };
}

async function findMyReviewForOrder(orderId, reviewerId) {
  const review = await prisma.review.findUnique({
    where: { orderId_reviewerId: { orderId, reviewerId } },
  });
  return formatReview(review);
}

async function findReviewsForOrder(orderId) {
  const reviews = await prisma.review.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
    include: { reviewer: { select: { name: true } } },
  });
  return reviews.map((r) => ({
    ...formatReview(r),
    reviewerName: r.reviewer ? r.reviewer.name : null,
  }));
}

async function createReview(data) {
  const review = await prisma.review.create({
    data: {
      orderId: data.orderId,
      reviewerId: data.reviewerId,
      reviewedUserId: data.reviewedUserId,
      rating: data.rating,
      comment: data.comment || null,
    },
  });
  return formatReview(review);
}

async function findReviewById(reviewId) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  return formatReview(review);
}

async function updateReview(reviewId, data) {
  const review = await prisma.review.update({
    where: { id: reviewId },
    data: {
      rating: data.rating,
      comment: data.comment || null,
    },
  });
  return formatReview(review);
}

async function deleteReview(reviewId) {
  await prisma.review.delete({ where: { id: reviewId } });
  return true;
}

module.exports = {
  findReviewsForUser,
  findMyReviewForOrder,
  findReviewsForOrder,
  createReview,
  findReviewById,
  updateReview,
  deleteReview,
};
