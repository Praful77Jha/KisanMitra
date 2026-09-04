const prisma = require('../config/prisma');

async function findAllProducts() {
  // No date/createdAt fields on Product, so rows match the original shape directly.
  return prisma.product.findMany({ orderBy: { id: 'asc' } });
}

async function findProductById(id) {
  return prisma.product.findUnique({ where: { id } });
}

module.exports = { findAllProducts, findProductById };
