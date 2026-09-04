const prisma = require('../config/prisma');

async function findAllProducts() {
  // No date/createdAt fields on Product, so rows match the original shape directly.
  return prisma.product.findMany({ orderBy: { id: 'asc' } });
}

async function findProductById(id) {
  return prisma.product.findUnique({ where: { id } });
}

// Convert the raw Prisma row (Decimal/bigint amounts as strings) into a JSON-safe
// shape with numbers, so newly created products match the numeric shape the
// existing read paths already expose (the frontend renders numeric values).
function formatProduct(product) {
  if (!product) return null;
  return {
    ...product,
    quantity: Number(product.quantity),
    pricePerQuintal: Number(product.pricePerQuintal),
    sellerRating: product.sellerRating === null ? null : Number(product.sellerRating),
    distanceKm: product.distanceKm === null ? null : Number(product.distanceKm),
    transportCost: product.transportCost === null ? null : Number(product.transportCost),
    otherCosts: product.otherCosts === null ? null : Number(product.otherCosts),
  };
}

// Create a new product listing owned by the authenticated seller. Quantity and
// prices arrive as the string/number from the request and are persisted as
// Decimal via the Prisma Decimal marker. Unknown/benign enumeration defaults are
// set server-side so a fresh listing is stored neutral (not verified, no
// self-asserted rating) exactly like a freshly submitted offer.
async function createProduct(data) {
  const { sellerUserId, seller, name, category, grade, quantity, unit, pricePerQuintal, location, description } = data;
  const { Prisma } = require('@prisma/client');
  const product = await prisma.product.create({
    data: {
      id: `p${Date.now()}`,
      name,
      category,
      grade: grade || null,
      quantity: new Prisma.Decimal(quantity),
      unit,
      pricePerQuintal: new Prisma.Decimal(pricePerQuintal),
      seller,
      sellerUserId,
      verified: false,
      location: location || null,
      dealScore: 50,
      description: description || null,
    },
  });
  return formatProduct(product);
}

module.exports = { findAllProducts, findProductById, createProduct, formatProduct };
