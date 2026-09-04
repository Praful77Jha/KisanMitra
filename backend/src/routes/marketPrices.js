const express = require('express');
const router = express.Router();
const { getMarketPrices } = require('../controllers/marketPriceController');

// MSAMB reference market prices (Market Comparison feature).
// Public data (no user or order information is returned).
router.get('/', getMarketPrices);

module.exports = router;
