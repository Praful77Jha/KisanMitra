const { USE_DATABASE } = require('../config/config');
const chatService = USE_DATABASE ? require('../services/chatService') : null;
const orderService = USE_DATABASE ? require('../services/orderService') : null;
const { notifyUser } = require('./notificationsController');

// Max plain-text length for a single chat message (mirrors the DB column).
const MAX_BODY_LENGTH = 2000;

// In-memory (non-database) chat message store, shared so routes and tests can
// inspect it, mirroring the other controllers.
const chatMessages = [];

function orderPartyRole(order, userId) {
  if (!order || !userId) return null;
  if (order.userId === userId) return 'buyer';
  if (order.sellerUserId === userId) return 'seller';
  return null;
}

function formatStored(m) {
  return {
    id: m.id,
    orderId: m.orderId,
    senderId: m.senderId,
    body: m.body,
    createdAt: m.createdAt,
    senderName: m.senderName || null,
  };
}

function validateBody(body) {
  if (body === undefined || body === null) return 'message body is required';
  if (typeof body !== 'string' || body.trim().length === 0) {
    return 'message body cannot be empty';
  }
  if (body.length > MAX_BODY_LENGTH) {
    return `message cannot exceed ${MAX_BODY_LENGTH} characters`;
  }
  return null;
}

// Synchronous in-memory order lookup used only in non-database mode, so the
// handlers stay synchronous (matching the other controllers' test convention).
function findOrderInMemory(orderId) {
  const { orders } = require('./ordersController');
  return orders.find((o) => o.id === orderId) || null;
}

function counterpartId(order, role) {
  return role === 'buyer' ? order.sellerUserId : order.userId;
}

function respondError(res, error) {
  if (error instanceof Error) {
    res.status(500).json({ success: false, message: error.message });
    return;
  }
  res.status(error.status).json({ success: false, message: error.message });
}

// GET /api/chat/orders/:orderId/messages
// The order's conversation. Only the two parties (buyer and seller) may view.
async function getMessages(req, res, next) {
  const orderId = req.params.orderId;
  const userId = req.user.id;

  if (!USE_DATABASE) {
    const order = findOrderInMemory(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!orderPartyRole(order, userId)) return res.status(403).json({ success: false, message: 'Forbidden' });
    const data = chatMessages.filter((m) => m.orderId === orderId).map(formatStored);
    return res.status(200).json({ success: true, data });
  }

  try {
    const order = await orderService.findOrderById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!orderPartyRole(order, userId)) return res.status(403).json({ success: false, message: 'Forbidden' });
    const data = await chatService.findMessagesForOrder(orderId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

// POST /api/chat/orders/:orderId/messages  { body }
// Send a message to the other party of the order. Both parties may send.
async function sendMessage(req, res, next) {
  const orderId = req.params.orderId;
  const userId = req.user.id;
  const body = req.body && req.body.body;

  const validationError = validateBody(body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  if (!USE_DATABASE) {
    const order = findOrderInMemory(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const role = orderPartyRole(order, userId);
    if (!role) return res.status(403).json({ success: false, message: 'Forbidden' });

    const message = {
      id: `msg-${chatMessages.length + 1}`,
      orderId,
      senderId: userId,
      body: body.trim(),
      createdAt: new Date().toISOString(),
      senderName: null,
    };
    chatMessages.push(message);

    const notifyUserId = counterpartId(order, role);
    if (notifyUserId && notifyUserId !== userId) {
      notifyUser({
        userId: notifyUserId,
        type: 'chat',
        title: 'New chat message',
        body: 'You have a new message on an order.',
        refType: 'order',
        refId: orderId,
      }).catch(() => {});
    }
    return res.status(201).json({ success: true, data: formatStored(message) });
  }

  try {
    const order = await orderService.findOrderById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const role = orderPartyRole(order, userId);
    if (!role) return res.status(403).json({ success: false, message: 'Forbidden' });

    const message = await chatService.createMessage({ orderId, senderId: userId, body: body.trim() });
    const notifyUserId = counterpartId(order, role);
    if (notifyUserId && notifyUserId !== userId) {
      notifyUser({
        userId: notifyUserId,
        type: 'chat',
        title: 'New chat message',
        body: 'You have a new message on an order.',
        refType: 'order',
        refId: orderId,
      }).catch(() => {});
    }
    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMessages,
  sendMessage,
  chatMessages,
};
