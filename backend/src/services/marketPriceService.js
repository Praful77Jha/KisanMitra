const { USE_DATABASE } = require('../config/config');

const REFERENCE_DATE = '2026-09-03';
const SOURCE = 'MSAMB';

// In-memory MSAMB reference data (fallback when USE_DATABASE is false).
const inMemoryPrices = [
  { cropName: 'Onion',   marketName: 'Ahmednagar', pricePerQtl: 3100 },
  { cropName: 'Onion',   marketName: 'Solapur',    pricePerQtl: 3400 },
  { cropName: 'Onion',   marketName: 'Lasalgaon',  pricePerQtl: 4525 },
  { cropName: 'Soybean', marketName: 'Akola',      pricePerQtl: 6080 },
  { cropName: 'Soybean', marketName: 'Amravati',   pricePerQtl: 5900 },
  { cropName: 'Soybean', marketName: 'Sangli',     pricePerQtl: 6850 },
  { cropName: 'Tur',     marketName: 'Akola',      pricePerQtl: 8255 },
  { cropName: 'Tur',     marketName: 'Amravati',   pricePerQtl: 8325 },
  { cropName: 'Wheat',   marketName: 'Solapur',    pricePerQtl: 3665 },
  { cropName: 'Maize',   marketName: 'Lasalgaon',  pricePerQtl: 2551 },
];

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
    referenceDate: REFERENCE_DATE,
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
