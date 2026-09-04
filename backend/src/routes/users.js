const express = require('express');
const router = express.Router();
const { getUserReviews } = require('../controllers/reviewsController');
const { verifyToken } = require('../middlewares/auth');

// A user's received ratings & reviews (public profile info) plus the calculated
// average. Authenticated so it is not used as an unauthenticated enumeration
// vector, but any logged-in user may view another user's received reviews.
router.get('/:userId/reviews', verifyToken, getUserReviews);

module.exports = router;
