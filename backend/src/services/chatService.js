const prisma = require('../config/prisma');

function formatMessage(message) {
  if (!message) return null;
  return {
    id: message.id,
    orderId: message.orderId,
    senderId: message.senderId,
    body: message.body,
    createdAt: message.createdAt ? new Date(message.createdAt).toISOString() : null,
  };
}

// Messages for an order, oldest-first (conversation order). The sender's name is
// attached (public profile info) so the other party can render who wrote it.
async function findMessagesForOrder(orderId) {
  const messages = await prisma.chatmessage.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { name: true } } },
  });
  return messages.map((m) => ({
    ...formatMessage(m),
    senderName: m.sender ? m.sender.name : null,
  }));
}

async function createMessage(data) {
  const message = await prisma.chatmessage.create({
    data: {
      id: `cm${Date.now()}`,
      orderId: data.orderId,
      senderId: data.senderId,
      body: data.body,
    },
    include: { sender: { select: { name: true } } },
  });
  return {
    ...formatMessage(message),
    senderName: message.sender ? message.sender.name : null,
  };
}

module.exports = {
  findMessagesForOrder,
  createMessage,
};
