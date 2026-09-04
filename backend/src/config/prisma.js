const { PrismaClient } = require('@prisma/client');

// A single shared Prisma client instance used by all services.
// Prisma reads the connection URL (DATABASE_URL) automatically from .env.
const prisma = new PrismaClient();

module.exports = prisma;
