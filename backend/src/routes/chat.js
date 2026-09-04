const express = require('express');
const router = express.Router();
const { getMessages, sendMessage } = require('../controllers/chatController');
const { verifyToken } = require('../middlewares/auth');

// Persistent buyer-seller messaging for an order (Phase 7). Both the buying and
// the selling party may read and send messages; third parties are forbidden.
// Authorization is enforced server-side from the JWT user and the order parties.
router.get('/orders/:orderId/messages', verifyToken, getMessages);
router.post('/orders/:orderId/messages', verifyToken, sendMessage);

module.exports = router;
