const express = require('express');
const router = express.Router();
const { getMyNotifications, getUnreadCount, markRead } = require('../controllers/notificationsController');
const { verifyToken } = require('../middlewares/auth');

// All notification routes require authentication and are scoped to the JWT user.
router.get('/', verifyToken, getMyNotifications);
router.get('/unread-count', verifyToken, getUnreadCount);
router.put('/read', verifyToken, markRead);

module.exports = router;
