const prisma = require('../config/prisma');

// Map a DB notification row to the shape the API/frontend expects.
function formatNotification(notification) {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    refType: notification.refType || null,
    refId: notification.refId || null,
    read: notification.read,
    createdAt: notification.createdAt
      ? new Date(notification.createdAt).toISOString()
      : null,
  };
}

async function createNotification(data) {
  const created = await prisma.notification.create({
    data: {
      id: `n${Date.now()}`,
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      refType: data.refType || null,
      refId: data.refId || null,
    },
  });
  return formatNotification(created);
}

async function findNotificationsForUser(userId) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return notifications.map(formatNotification);
}

async function countUnread(userId) {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

async function markOneRead(notificationId, userId) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notification || notification.userId !== userId) {
    return null;
  }
  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
  return formatNotification(updated);
}

async function markAllRead(userId) {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return result.count;
}

module.exports = {
  createNotification,
  findNotificationsForUser,
  countUnread,
  markOneRead,
  markAllRead,
};
