const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const SALT_ROUNDS = 10;

async function findUserByPhone(phone) {
  return prisma.user.findUnique({ where: { phone } });
}

async function findUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}

async function createUser({ name, phone, password, role = 'FARMER' }) {
  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: { name, phone, passwordHash, role },
  });
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

async function updateUserLocation(id, location) {
  return prisma.user.update({
    where: { id },
    data: { location },
  });
}

module.exports = {
  findUserByPhone,
  findUserById,
  createUser,
  hashPassword,
  comparePassword,
  updateUserLocation,
};
