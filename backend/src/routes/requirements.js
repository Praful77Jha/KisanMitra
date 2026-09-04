const express = require('express');
const router = express.Router();
const { getAllRequirements, getAvailableRequirements, getRequirementById, createRequirement, deleteRequirement } = require('../controllers/requirementsController');
const { getOffersByRequirement } = require('../controllers/offersController');
const { verifyToken } = require('../middlewares/auth');

router.get('/', verifyToken, getAllRequirements);
// Must be registered before '/:id' so 'available' is not captured as an id.
router.get('/available', verifyToken, getAvailableRequirements);
router.get('/:id', verifyToken, getRequirementById);
router.get('/:id/offers', verifyToken, getOffersByRequirement);
router.post('/', verifyToken, createRequirement);
router.delete('/:id', verifyToken, deleteRequirement);

module.exports = router;
