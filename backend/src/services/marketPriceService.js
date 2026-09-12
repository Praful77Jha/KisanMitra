const { USE_DATABASE } = require('../config/config');
const { marketPrices: demoMarketPrices, MSAMB_DATE } = require('../demo/demoData');

const REFERENCE_DATE = MSAMB_DATE;
const SOURCE = 'MSAMB';

// In-memory MSAMB reference data (fallback when USE_DATABASE is false), seeded
// from the shared demo catalog so DB mode and in-memory mode are identical. Rows
// carry an optional per-record referenceDate (older demo batches).
const inMemoryPrices = demoMarketPrices;

async function findByCrop(cropName) {
  if (USE_DATABASE) {
    const prisma = require('../config/prisma');
    const where = cropName ? { cropName } : {};
    const rows = await prisma.marketPrice.findMany({
      where,
      orderBy: [{ cropName: 'asc' }, { pricePerQtl: 'desc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      cropName: r.cropName,
      marketName: r.marketName,
      pricePerQtl: Number(r.pricePerQtl),
      referenceDate: r.referenceDate ? r.referenceDate.toISOString().slice(0, 10) : null,
      source: r.source,
      unit: r.unit,
    }));
  }

  let rows = inMemoryPrices;
  if (cropName) {
    const needle = cropName.trim().toLowerCase();
    rows = rows.filter((r) => r.cropName.toLowerCase() === needle);
  }
  return rows.map((r) => ({
    id: null,
    cropName: r.cropName,
    marketName: r.marketName,
    pricePerQtl: r.pricePerQtl,
    referenceDate: r.referenceDate || REFERENCE_DATE,
    source: SOURCE,
    unit: 'Quintal',
  }));
}

async function listCrops() {
  if (USE_DATABASE) {
    const prisma = require('../config/prisma');
    const rows = await prisma.marketPrice.findMany({
      select: { cropName: true },
      distinct: ['cropName'],
      orderBy: { cropName: 'asc' },
    });
    return rows.map((r) => r.cropName);
  }
  const crops = [...new Set(inMemoryPrices.map((r) => r.cropName))];
  return crops.sort();
}

module.exports = { findByCrop, listCrops };
