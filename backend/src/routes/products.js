const express = require('express');
const router = express.Router();
const { getAllProducts, getProductById } = require('../controllers/productsController');
const { getOffersByProduct } = require('../controllers/offersController');

router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.get('/:productId/offers', getOffersByProduct);

module.exports = router;
