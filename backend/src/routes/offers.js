const express = require('express');
const router = express.Router();
const { getOfferById, createOffer } = require('../controllers/offersController');
const { verifyToken } = require('../middlewares/auth');

router.post('/', verifyToken, createOffer);
router.get('/:id', verifyToken, getOfferById);

module.exports = router;
