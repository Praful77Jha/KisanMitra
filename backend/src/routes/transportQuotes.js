const express = require('express');
const router = express.Router();
const {
  acceptQuote,
  rejectQuote,
  createCounterOffer,
  getNegotiationHistory,
} = require('../controllers/transportOffersController');
const { verifyToken, requireRole } = require('../middlewares/auth');

// Quote decision endpoints. Only the owning requester (FARMER/BUYER) may accept
// or reject a quote; acceptance atomically creates the single TransportJob.
router.put('/:id/accept', verifyToken, requireRole('FARMER', 'BUYER'), acceptQuote);
router.put('/:id/reject', verifyToken, requireRole('FARMER', 'BUYER'), rejectQuote);

// Negotiation endpoints. Either participant may act: the request owner
// (FARMER/BUYER) or the quoted transporter. Participation is verified inside
// the controller; no requireRole gate so neither side is blocked.
router.post('/:id/counter', verifyToken, createCounterOffer);
router.get('/:id/history', verifyToken, getNegotiationHistory);

module.exports = router;