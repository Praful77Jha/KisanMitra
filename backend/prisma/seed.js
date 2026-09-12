const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// The demo marketplace catalog (products, offers, MSAMB market prices) lives in
// ../src/demo/demoData.js and doubles as the in-memory fallback for the API, so
// database mode and in-memory mode always expose the same demo records.
//
// This seed is a DEV/DEMO reseed: it wipes ONLY the demo tables (marketPrice,
// product, requirement, offer, order) so repeated runs stay idempotent and never
// duplicate records. It NEVER touches user accounts, notifications, transport
// requests/quotes/jobs or reviews.
//
// Run:   npm run seed:demo        (backend package.json)
//        npx prisma db seed       (equivalent, same script)
// For the in-memory mode (USE_DATABASE=false) no seeding is needed — the same
// demo rows are already the fallback data.
//
// Demo prices/sales are reference values, NOT live market rates.
const { products, offers, marketPrices, MSAMB_DATE } = require('../src/demo/demoData');

const requirementSeed = [
  {
    id: 'r1',
    cropName: 'Basmati Rice',
    grade: 'A',
    quantity: 120,
    unit: 'Quintal',
    maxPricePerQuintal: 4500,
    location: 'Pune, Maharashtra',
    postedDate: new Date('2026-08-20'),
    status: 'active',
  },
  {
    id: 'r2',
    cropName: 'Red Onion',
    grade: 'B',
    quantity: 80,
    unit: 'Quintal',
    maxPricePerQuintal: 1600,
    location: 'Lasalgaon, Maharashtra',
    postedDate: new Date('2026-08-18'),
    status: 'active',
  },
  {
    id: 'r3',
    cropName: 'Wheat (Sharbati)',
    grade: 'A',
    quantity: 150,
    unit: 'Quintal',
    maxPricePerQuintal: 2200,
    location: 'Indore, Madhya Pradesh',
    postedDate: new Date('2026-08-10'),
    status: 'completed',
  },
];

const orders = [
  {
    id: 'ORD-2026-0194',
    orderDate: new Date('2026-08-22'),
    productName: 'Red Onion',
    quantity: 80,
    unit: 'Quintal',
    pricePerQuintal: 1750,
    transportCost: 250,
    otherCharges: 120,
    platformFee: 45,
    totalAmount: 140415,
    deliveryAddress: 'Lasalgaon APMC, Nashik, Maharashtra',
    paymentMethod: 'Bank Transfer',
    sellerName: 'Lasalgaon APMC',
    status: 'Delivered',
    timeline: [
      { step: 'Order Confirmed', date: '2026-08-22', done: true },
      { step: 'Preparing', date: '2026-08-23', done: true },
      { step: 'Dispatched', date: '2026-08-24', done: true },
      { step: 'In Transit', date: '2026-08-25', done: true },
      { step: 'Out for Delivery', date: '2026-08-26', done: true },
      { step: 'Delivered', date: '2026-08-27', done: true },
    ],
  },
  {
    id: 'ORD-2026-0172',
    orderDate: new Date('2026-08-15'),
    productName: 'Wheat (Sharbati)',
    quantity: 150,
    unit: 'Quintal',
    pricePerQuintal: 2150,
    transportCost: 3200,
    otherCharges: 500,
    platformFee: 60,
    totalAmount: 326160,
    deliveryAddress: 'Indore, Madhya Pradesh',
    paymentMethod: 'Bank Transfer',
    sellerName: 'MP Grain Exports',
    status: 'In Transit',
    timeline: [
      { step: 'Order Confirmed', date: '2026-08-15', done: true },
      { step: 'Preparing', date: '2026-08-16', done: true },
      { step: 'Dispatched', date: '2026-08-17', done: true },
      { step: 'In Transit', date: '2026-08-19', done: true },
      { step: 'Out for Delivery', date: null, done: false },
      { step: 'Delivered', date: null, done: false },
    ],
  },
];

async function main() {
  // Idempotent: wipe tables in reverse FK order so re-runs are clean.
  await prisma.order.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.requirement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.marketPrice.deleteMany();

  // 1. Products (no dependencies)
  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  // 2. Requirements (no FKs at this point)
  for (const r of requirementSeed) {
    await prisma.requirement.create({ data: r });
  }

  // 3. Offers (depend on products + requirements)
  for (const o of offers) {
    await prisma.offer.create({ data: o });
  }

  // 4. Orders (denormalized snapshots; requirementId/offerId deliberately null)
  for (const o of orders) {
    await prisma.order.create({ data: o });
  }

  // Resolve the known seed inconsistency: requirement.offerCount must equal the
  // real number of offers stored for that requirement (r1 had stale 4 vs 3 offers).
  const counts = await prisma.offer.groupBy({
    by: ['requirementId'],
    _count: { _all: true },
  });
  const countMap = {};
  for (const c of counts) {
    if (c.requirementId) countMap[c.requirementId] = c._count._all;
  }
  for (const r of requirementSeed) {
    await prisma.requirement.update({
      where: { id: r.id },
      data: { offerCount: countMap[r.id] || 0 },
    });
  }

  const productCount = await prisma.product.count();
  const requirementCount = await prisma.requirement.count();
  const offerCount = await prisma.offer.count();
  const orderCount = await prisma.order.count();

  // 5. MSAMB reference market prices (idempotent upsert, honors per-row dates)
  for (const mp of marketPrices) {
    const referenceDate = new Date(mp.referenceDate || MSAMB_DATE);
    await prisma.marketPrice.upsert({
      where: {
        cropName_marketName_referenceDate: {
          cropName: mp.cropName,
          marketName: mp.marketName,
          referenceDate,
        },
      },
      update: { pricePerQtl: mp.pricePerQtl },
      create: {
        cropName: mp.cropName,
        marketName: mp.marketName,
        pricePerQtl: mp.pricePerQtl,
        referenceDate,
        source: 'MSAMB',
      },
    });
  }
  const marketPriceCount = await prisma.marketPrice.count();

  console.log('Seed complete.');
  console.log(`Products:      ${productCount}`);
  console.log(`Requirements:  ${requirementCount}`);
  console.log(`Offers:        ${offerCount}`);
  console.log(`Orders:        ${orderCount}`);
  console.log(`MarketPrices:  ${marketPriceCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
