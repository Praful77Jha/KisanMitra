const express = require('express');
const router = express.Router();
const { getTransporterReviews } = require('../controllers/transportJobsController');
const { verifyToken } = require('../middlewares/auth');

// A transporter's received transport ratings (public profile info), shaped like
// the existing per-user reviews endpoint.
router.get('/:userId/reviews', verifyToken, getTransporterReviews);

module.exports = router;