const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const SALT_ROUNDS = 10;

async function findUserByPhone(phone) {
  return prisma.user.findUnique({ where: { phone } });
}

async function findUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}

async function createUser({ name, phone, password }) {
  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: { name, phone, passwordHash },
  });
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  findUserByPhone,
  findUserById,
  createUser,
  hashPassword,
  comparePassword,
};
