const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const products = [
  {
    id: 'p1',
    name: 'Basmati Rice',
    category: 'Grains',
    grade: 'A',
    quantity: 120,
    unit: 'Quintal',
    pricePerQuintal: 4200,
    seller: 'AgroMart Traders',
    sellerRating: 4.6,
    verified: true,
    location: 'Nashik, MH',
    distanceKm: 12,
    transportCost: 600,
    otherCosts: 250,
    dealScore: 92,
    imageFile: 'basmati-rice.png',
    description:
      'Premium long-grain Basmati rice, freshly harvested and cleaned. Ideal for bulk buyers and retailers.',
  },
  {
    id: 'p2',
    name: 'Soybean',
    category: 'Oilseeds',
    grade: 'A+',
    quantity: 300,
    unit: 'Quintal',
    pricePerQuintal: 5600,
    seller: 'GreenFields Co-op',
    sellerRating: 4.8,
    verified: true,
    location: 'Latur, MH',
    distanceKm: 45,
    transportCost: 1400,
    otherCosts: 400,
    dealScore: 88,
    imageFile: 'soybean.png',
    description:
      'High-protein soybean with excellent oil yield. Suitable for crushers and processors.',
  },
  {
    id: 'p3',
    name: 'Red Onion',
    category: 'Vegetables',
    grade: 'A',
    quantity: 80,
    unit: 'Quintal',
    pricePerQuintal: 1800,
    seller: 'Lasalgaon APMC',
    sellerRating: 4.3,
    verified: false,
    location: 'Lasalgaon, MH',
    distanceKm: 8,
    transportCost: 250,
    otherCosts: 120,
    dealScore: 90,
    imageFile: 'red-onion.png',
    description:
      'Fresh red onions from Lasalgaon market, graded and sorted. Good storage shelf life.',
  },
  {
    id: 'p4',
    name: 'Wheat (Sharbati)',
    category: 'Grains',
    grade: 'A',
    quantity: 200,
    unit: 'Quintal',
    pricePerQuintal: 2400,
    seller: 'MP Grain Exports',
    sellerRating: 4.5,
    verified: true,
    location: 'Indore, MP',
    distanceKm: 380,
    transportCost: 5200,
    otherCosts: 800,
    dealScore: 61,
    imageFile: 'wheat.png',
    description:
      'Sharbati variety wheat known for premium quality. Best suited for flour milling.',
  },
  {
    id: 'p5',
    name: 'Tur Dal',
    category: 'Pulses',
    grade: 'A',
    quantity: 90,
    unit: 'Quintal',
    pricePerQuintal: 8200,
    seller: 'PulseHub Distributors',
    sellerRating: 4.7,
    verified: true,
    location: 'Akola, MH',
    distanceKm: 60,
    transportCost: 1800,
    otherCosts: 350,
    dealScore: 85,
    imageFile: 'tur-dal.png',
    description:
      'Clean, sorted Tur (Arhar) dal with high protein content. Good for wholesale buyers.',
  },
  {
    id: 'p6',
    name: 'Fresh Mango (Kesar)',
    category: 'Fruits',
    grade: 'A+',
    quantity: 40,
    unit: 'Tonne',
    pricePerQuintal: 7800,
    seller: 'Sindhudurg Farms',
    sellerRating: 4.9,
    verified: true,
    location: 'Ratnagiri, MH',
    distanceKm: 150,
    transportCost: 3200,
    otherCosts: 900,
    dealScore: 78,
    imageFile: 'kesar-mango.png',
    description:
      'Premium Kesar mangoes, handpicked and graded. Export quality, promptly dispatched.',
  },
];

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

const offers = [
  {
    id: 'o1',
    requirementId: 'r1',
    productId: 'p1',
    sellerName: 'AgroMart Traders',
    sellerRating: 4.6,
    verified: true,
    quantity: 120,
    unit: 'Quintal',
    offeredPricePerQuintal: 4400,
    distanceKm: 12,
    transportCostPerQuintal: 50,
    otherCostsPerQuintal: 20,
    dealScore: 91,
    shortlisted: true,
  },
  {
    id: 'o2',
    requirementId: 'r1',
    productId: 'p1',
    sellerName: 'GreenFields Co-op',
    sellerRating: 4.8,
    verified: true,
    quantity: 120,
    unit: 'Quintal',
    offeredPricePerQuintal: 4500,
    distanceKm: 45,
    transportCostPerQuintal: 120,
    otherCostsPerQuintal: 35,
    dealScore: 84,
    shortlisted: false,
  },
  {
    id: 'o3',
    requirementId: 'r1',
    productId: 'p1',
    sellerName: 'MP Grain Exports',
    sellerRating: 4.5,
    verified: true,
    quantity: 120,
    unit: 'Quintal',
    offeredPricePerQuintal: 4650,
    distanceKm: 380,
    transportCostPerQuintal: 430,
    otherCostsPerQuintal: 70,
    dealScore: 62,
    shortlisted: false,
  },
  {
    id: 'o4',
    requirementId: 'r2',
    productId: 'p3',
    sellerName: 'Lasalgaon APMC',
    sellerRating: 4.3,
    verified: false,
    quantity: 80,
    unit: 'Quintal',
    offeredPricePerQuintal: 1750,
    distanceKm: 8,
    transportCostPerQuintal: 25,
    otherCostsPerQuintal: 15,
    dealScore: 92,
    shortlisted: false,
  },
  {
    id: 'o5',
    requirementId: 'r2',
    productId: 'p3',
    sellerName: 'AgroMart Traders',
    sellerRating: 4.6,
    verified: true,
    quantity: 80,
    unit: 'Quintal',
    offeredPricePerQuintal: 1820,
    distanceKm: 15,
    transportCostPerQuintal: 30,
    otherCostsPerQuintal: 10,
    dealScore: 86,
    shortlisted: false,
  },
  {
    id: 'o6',
    requirementId: 'r2',
    productId: 'p3',
    sellerName: 'GreenFields Co-op',
    sellerRating: 4.8,
    verified: true,
    quantity: 80,
    unit: 'Quintal',
    offeredPricePerQuintal: 1800,
    distanceKm: 45,
    transportCostPerQuintal: 90,
    otherCostsPerQuintal: 25,
    dealScore: 79,
    shortlisted: false,
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

// MSAMB reference prices — 3 Sep 2026 (seeded idempotently via upsert).
const marketPrices = [
  { cropName: 'Onion',   marketName: 'Ahmednagar',  pricePerQtl: 3100 },
  { cropName: 'Onion',   marketName: 'Solapur',     pricePerQtl: 3400 },
  { cropName: 'Onion',   marketName: 'Lasalgaon',   pricePerQtl: 4525 },
  { cropName: 'Soybean', marketName: 'Akola',       pricePerQtl: 6080 },
  { cropName: 'Soybean', marketName: 'Amravati',    pricePerQtl: 5900 },
  { cropName: 'Soybean', marketName: 'Sangli',      pricePerQtl: 6850 },
  { cropName: 'Tur',     marketName: 'Akola',       pricePerQtl: 8255 },
  { cropName: 'Tur',     marketName: 'Amravati',    pricePerQtl: 8325 },
  { cropName: 'Wheat',   marketName: 'Solapur',     pricePerQtl: 3665 },
  { cropName: 'Maize',   marketName: 'Lasalgaon',   pricePerQtl: 2551 },
];

const MSAMB_DATE = new Date('2026-09-03');

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

  // 5. MSAMB reference market prices (idempotent upsert)
  for (const mp of marketPrices) {
    await prisma.marketPrice.upsert({
      where: {
        cropName_marketName_referenceDate: {
          cropName: mp.cropName,
          marketName: mp.marketName,
          referenceDate: MSAMB_DATE,
        },
      },
      update: { pricePerQtl: mp.pricePerQtl },
      create: {
        cropName: mp.cropName,
        marketName: mp.marketName,
        pricePerQtl: mp.pricePerQtl,
        referenceDate: MSAMB_DATE,
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
