const express = require('express');
const router = express.Router();
const { getUserReviews } = require('../controllers/reviewsController');
const { updateLocation } = require('../controllers/usersController');
const { verifyToken } = require('../middlewares/auth');

// A user's received ratings & reviews (public profile info) plus the calculated
// average. Authenticated so it is not used as an unauthenticated enumeration
// vector, but any logged-in user may view another user's received reviews.
router.get('/:userId/reviews', verifyToken, getUserReviews);

// Update the signed-in user's preferred location (State → District → Village
// chosen via the frontend picker). Persisted as the plain-text user.location.
// No DB schema change is needed: the `location` column already exists on User.
router.patch('/me', verifyToken, updateLocation);

module.exports = router;
