const prisma = require('../config/prisma');

function toDateString(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Map a DB requirement row to the exact shape the API/frontend expects.
function formatRequirement(requirement) {
  if (!requirement) return null;
  return {
    id: requirement.id,
    userId: requirement.userId,
    cropName: requirement.cropName,
    grade: requirement.grade,
    quantity: Number(requirement.quantity),
    unit: requirement.unit,
    maxPricePerQuintal: Number(requirement.maxPricePerQuintal),
    location: requirement.location,
    postedDate: toDateString(requirement.postedDate),
    status: requirement.status,
    offerCount: requirement.offerCount,
  };
}

async function findAllRequirements(userId) {
  const requirements = await prisma.requirement.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
  });
  return requirements.map(formatRequirement);
}

// Requirements a seller is allowed to respond to: active needs that do not
// belong to the caller. This is the deliberate marketplace-of-needs surface for
// sellers; the owner-protected routes (findAllRequirements / findRequirementById)
// remain strictly scoped to the caller's own records.
async function findAvailableRequirements(userId) {
  const requirements = await prisma.requirement.findMany({
    where: { status: 'active', NOT: { userId } },
    orderBy: { id: 'asc' },
  });
  return requirements.map(formatRequirement);
}

async function findRequirementById(id) {
  const requirement = await prisma.requirement.findUnique({ where: { id } });
  return formatRequirement(requirement);
}

async function createRequirement(data) {
  // idCounter mirrors the old r1, r2, r3... scheme: next id = count + 1.
  const count = await prisma.requirement.count();
  const newRequirement = {
    id: `r${count + 1}`,
    userId: data.userId || null,
    cropName: data.cropName.trim(),
    grade: data.grade || 'A',
    quantity: Number(data.quantity),
    unit: data.unit,
    maxPricePerQuintal: Number(data.maxPricePerQuintal),
    location: data.location.trim(),
    postedDate: new Date(new Date().toISOString().slice(0, 10)),
    status: 'active',
    offerCount: 0,
    updatedAt: new Date(),
    ...(data.requiredBy ? { requiredBy: data.requiredBy } : {}),
    ...(data.notes ? { notes: data.notes } : {}),
  };

  const created = await prisma.requirement.create({ data: newRequirement });
  return formatRequirement(created);
}

async function deleteRequirement(id) {
  // Deleting a requirement cascades to its offers (schema onDelete: Cascade).
  // The controller enforces that the caller owns it, that it is still active,
  // and that no orders reference it before this is reachable.
  await prisma.requirement.delete({ where: { id } });
  return { id };
}

module.exports = { findAllRequirements, findAvailableRequirements, findRequirementById, createRequirement, deleteRequirement };
