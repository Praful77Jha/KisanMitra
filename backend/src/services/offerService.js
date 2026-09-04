const prisma = require('../config/prisma');

function formatOffer(offer) {
  if (!offer) return null;
  return {
    id: offer.id,
    requirementId: offer.requirementId,
    productId: offer.productId,
    sellerName: offer.sellerName,
    sellerUserId: offer.sellerUserId || null,
    sellerRating: offer.sellerRating === null ? null : Number(offer.sellerRating),
    verified: offer.verified,
    quantity: Number(offer.quantity),
    unit: offer.unit,
    offeredPricePerQuintal: Number(offer.offeredPricePerQuintal),
    distanceKm: offer.distanceKm === null ? null : Number(offer.distanceKm),
    transportCostPerQuintal:
      offer.transportCostPerQuintal === null ? null : Number(offer.transportCostPerQuintal),
    otherCostsPerQuintal:
      offer.otherCostsPerQuintal === null ? null : Number(offer.otherCostsPerQuintal),
    dealScore: offer.dealScore,
    shortlisted: offer.shortlisted,
    notes: offer.notes || null,
  };
}

async function findOfferById(id) {
  const offer = await prisma.offer.findUnique({ where: { id } });
  return formatOffer(offer);
}

async function findOffersByRequirement(requirementId) {
  const offers = await prisma.offer.findMany({
    where: { requirementId },
    orderBy: { id: 'asc' },
  });
  return offers.map(formatOffer);
}

async function findOffersByProduct(productId) {
  const offers = await prisma.offer.findMany({
    where: { productId },
    orderBy: { id: 'asc' },
  });
  return offers.map(formatOffer);
}

async function createOffer(data) {
  // idCounter mirrors the old o1, o2, o3... scheme: raise the counter past any
  // existing offer number so IDs never collide (same approach as orderService).
  const existing = await prisma.offer.findMany({ select: { id: true } });
  let nextNumber = 0;
  for (const o of existing) {
    const match = /^o(\d+)$/.exec(o.id);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > nextNumber) nextNumber = num;
    }
  }

  const newOffer = {
    id: `o${nextNumber + 1}`,
    productId: data.productId || null,
    // An offer is linked to the buyer requirement it responds to OR to the
    // product listing a buyer makes an offer on (product-based offers).
    requirementId: data.requirementId || null,
    sellerName: data.sellerName.trim(),
    sellerUserId: data.sellerUserId || null,
    // Reputation/verification must never come from the request body. The
    // controller no longer forwards them; store a neutral value (no
    // self-asserted rating or verified badge).
    sellerRating: data.sellerRating === undefined || data.sellerRating === null ? null : Number(data.sellerRating),
    verified: data.verified === undefined || data.verified === null ? false : Boolean(data.verified),
    quantity: Number(data.quantity),
    unit: data.unit,
    offeredPricePerQuintal: Number(data.offeredPricePerQuintal),
    transportCostPerQuintal:
      data.transportCostPerQuintal !== undefined ? Number(data.transportCostPerQuintal) : 0,
    otherCostsPerQuintal:
      data.otherCostsPerQuintal !== undefined ? Number(data.otherCostsPerQuintal) : 0,
    distanceKm: data.distanceKm !== undefined ? Number(data.distanceKm) : 0,
    dealScore: 85,
    shortlisted: false,
    notes: data.notes || null,
  };

  // Create the offer and keep the requirement's offer count consistent
  // transactionally, so the stored count never drifts from persisted offers.
  // Product-based offers have no requirementId, so there is no count to update.
  const operations = [prisma.offer.create({ data: newOffer })];
  if (newOffer.requirementId) {
    operations.push(
      prisma.requirement.update({
        where: { id: newOffer.requirementId },
        data: { offerCount: { increment: 1 } },
      })
    );
  }
  const [created] = await prisma.$transaction(operations);
  return formatOffer(created);
}

module.exports = {
  findOfferById,
  findOffersByRequirement,
  findOffersByProduct,
  createOffer,
};
