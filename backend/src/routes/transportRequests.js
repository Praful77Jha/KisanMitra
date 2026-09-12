const express = require('express');
const router = express.Router();
const {
  createRequest,
  getAllRequests,
  getAvailableRequests,
  getRequestById,
  deleteRequest,
} = require('../controllers/transportRequestsController');
const { createQuote, getQuotesForRequest } = require('../controllers/transportOffersController');
const { verifyToken, requireRole } = require('../middlewares/auth');

// Transport requests. Note ordering: /available must be declared before /:id so
// Express does not swallow it as an id param.

// Marketplace / ownership surfaces.
router.get('/available', verifyToken, requireRole('TRANSPORTER'), getAvailableRequests);
router.get('/', verifyToken, requireRole('FARMER', 'BUYER', 'TRANSPORTER'), getAllRequests);
router.post('/', verifyToken, requireRole('FARMER', 'BUYER'), createRequest);

// Quotes against a request: transporters quote, the owning requester compares.
router.get('/:id/quotes', verifyToken, requireRole('FARMER', 'BUYER'), getQuotesForRequest);
router.post('/:id/quotes', verifyToken, requireRole('TRANSPORTER'), createQuote);

router.get('/:id', verifyToken, requireRole('FARMER', 'BUYER', 'TRANSPORTER'), getRequestById);
router.delete('/:id', verifyToken, requireRole('FARMER', 'BUYER'), deleteRequest);

module.exports = router;