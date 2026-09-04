const express = require('express');
const router = express.Router();
const {
  postEstimate,
  initLogistics,
  getLogistics,
  updateLogisticsStatus,
} = require('../controllers/logisticsController');
const { verifyToken } = require('../middlewares/auth');

// Public demo freight estimate (kept intact).
router.post('/estimate', postEstimate);

// Order-level logistics / delivery status. All routes require authentication.
// GET is viewable by either order party; POST (init) and PUT (status change)
// are restricted to the buying user. Authorization is enforced server-side.
router.post('/', verifyToken, initLogistics);
router.get('/:orderId', verifyToken, getLogistics);
router.put('/:orderId', verifyToken, updateLogisticsStatus);

module.exports = router;
