const express = require('express');
const router = express.Router();
const { getInsights } = require('../controllers/priceInsightsController');

// Price insights derived from recorded order prices (marketplace aggregate).
// Public data (no private/order/user information is returned).
router.get('/', getInsights);

module.exports = router;
