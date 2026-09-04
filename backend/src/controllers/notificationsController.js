const { USE_DATABASE } = require('../config/config');
const notificationService = USE_DATABASE
  ? require('../services/notificationService')
  : null;

// In-memory (non-database) notification store, shared so both the routes and the
// other controllers (offer/order/review hooks) can read/write it, and tests can
// inspect it.
const notifications = [];
let idCounter = 0;

function makeId() {
  idCounter += 1;
  return `NOT-${String(idCounter).padStart(4, '0')}`;
}

// App-wide generator called by other controllers at event points. Must NEVER
// throw or break the primary action: notification delivery is best-effort.
async function notifyUser({ userId, type, title, body, refType, refId }) {
  if (!userId) return null;
  if (USE_DATABASE) {
    try {
      return await notificationService.createNotification({
        userId,
        type,
        title,
        body,
        refType: refType || null,
        refId: refId || null,
      });
    } catch (error) {
      console.error('notifyUser failed (non-fatal):', error.message);
      return null;
    }
  }
  const notification = {
    id: makeId(),
    userId,
    type,
    title,
    body,
    refType: refType || null,
    refId: refId || null,
    read: false,
    createdAt: new Date().toISOString(),
  };
  notifications.unshift(notification);
  return notification;
}

function sortNewest(list) {
  return [...list].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

async function getMyNotifications(req, res, next) {
  const userId = req.user.id;
  if (USE_DATABASE) {
    try {
      const data = await notificationService.findNotificationsForUser(userId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
  const mine = notifications.filter((n) => n.userId === userId);
  return res.status(200).json({ success: true, data: sortNewest(mine) });
}

async function getUnreadCount(req, res, next) {
  const userId = req.user.id;
  if (USE_DATABASE) {
    try {
      const unread = await notificationService.countUnread(userId);
      return res.status(200).json({ success: true, data: { unread } });
    } catch (error) {
      return next(error);
    }
  }
  const unread = notifications.filter((n) => n.userId === userId && !n.read).length;
  return res.status(200).json({ success: true, data: { unread } });
}

async function markRead(req, res, next) {
  const userId = req.user.id;
  const id = req.body && req.body.id;

  if (USE_DATABASE) {
    try {
      if (id) {
        const updated = await notificationService.markOneRead(id, userId);
        if (!updated) {
          return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        return res.status(200).json({ success: true, data: updated });
      }
      const updated = await notificationService.markAllRead(userId);
      return res.status(200).json({ success: true, data: { updated } });
    } catch (error) {
      return next(error);
    }
  }

  if (id) {
    const found = notifications.find((n) => n.id === id);
    if (!found || found.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    found.read = true;
    return res.status(200).json({ success: true, data: found });
  }

  let updated = 0;
  for (const n of notifications) {
    if (n.userId === userId && !n.read) {
      n.read = true;
      updated += 1;
    }
  }
  return res.status(200).json({ success: true, data: { updated } });
}

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markRead,
  notifyUser,
  notifications,
};
