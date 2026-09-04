const express = require('express');
const router = express.Router();
const { getAllProducts, getProductById, createProduct } = require('../controllers/productsController');
const { getOffersByProduct } = require('../controllers/offersController');
const { verifyToken } = require('../middlewares/auth');

router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.get('/:productId/offers', getOffersByProduct);
router.post('/', verifyToken, createProduct);

module.exports = router;
