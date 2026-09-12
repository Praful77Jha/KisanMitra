const express = require('express');
const router = express.Router();
const { createProfile, getMyProfile, updateMyProfile } = require('../controllers/transporterController');
const { verifyToken, requireRole } = require('../middlewares/auth');

// Transporter enrollment profile. All profile routes are TRANSPORTER-only; the
// profile always belongs to the authenticated user (req.user.id), never a
// client-supplied id. avgRating is server-owned (see createReview).
router.post('/profile', verifyToken, requireRole('TRANSPORTER'), createProfile);
router.get('/profile/me', verifyToken, requireRole('TRANSPORTER'), getMyProfile);
router.patch('/profile/me', verifyToken, requireRole('TRANSPORTER'), updateMyProfile);

module.exports = router;