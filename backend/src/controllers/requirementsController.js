const { USE_DATABASE } = require('../config/config');
const requirementService = USE_DATABASE ? require('../services/requirementService') : null;
const orderService = USE_DATABASE ? require('../services/orderService') : null;

const requirements = [
  {
    id: 'r1',
    cropName: 'Basmati Rice',
    grade: 'A',
    quantity: 120,
    unit: 'Quintal',
    maxPricePerQuintal: 4500,
    location: 'Pune, Maharashtra',
    postedDate: '2026-08-20',
    status: 'active',
    offerCount: 4,
  },
  {
    id: 'r2',
    cropName: 'Red Onion',
    grade: 'B',
    quantity: 80,
    unit: 'Quintal',
    maxPricePerQuintal: 1600,
    location: 'Lasalgaon, Maharashtra',
    postedDate: '2026-08-18',
    status: 'active',
    offerCount: 2,
  },
  {
    id: 'r3',
    cropName: 'Wheat (Sharbati)',
    grade: 'A',
    quantity: 150,
    unit: 'Quintal',
    maxPricePerQuintal: 2200,
    location: 'Indore, Madhya Pradesh',
    postedDate: '2026-08-10',
    status: 'completed',
    offerCount: 3,
  },
];

let idCounter = requirements.length;

async function getAllRequirements(req, res, next) {
  if (USE_DATABASE) {
    try {
      const data = await requirementService.findAllRequirements(req.user.id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
  const mine = requirements.filter((r) => r.userId === req.user.id);
  res.status(200).json({
    success: true,
    data: mine,
  });
}

// Seller-facing list of active requirements the caller may respond to. This is a
// deliberate, authenticated "marketplace of needs": active requirements that do
// not belong to the caller. It does NOT expose the owner-protected requirement
// routes; ownership of a requirement/order is still enforced elsewhere.
async function getAvailableRequirements(req, res, next) {
  if (USE_DATABASE) {
    try {
      const data = await requirementService.findAvailableRequirements(req.user.id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
  const available = requirements.filter(
    (r) => r.status === 'active' && r.userId !== req.user.id
  );
  res.status(200).json({
    success: true,
    data: available,
  });
}

async function getRequirementById(req, res, next) {
  if (USE_DATABASE) {
    try {
      const requirement = await requirementService.findRequirementById(req.params.id);
      if (!requirement || requirement.userId !== req.user.id) {
        return res.status(404).json({
          success: false,
          message: 'Requirement not found',
        });
      }
      return res.status(200).json({
        success: true,
        data: requirement,
      });
    } catch (error) {
      return next(error);
    }
  }
  const requirement = requirements.find((r) => r.id === req.params.id);
  if (!requirement || requirement.userId !== req.user.id) {
    return res.status(404).json({
      success: false,
      message: 'Requirement not found',
    });
  }
  res.status(200).json({
    success: true,
    data: requirement,
  });
}

async function createRequirement(req, res, next) {
  const { cropName, grade, quantity, unit, maxPricePerQuintal, location, requiredBy, notes } = req.body;

  if (!cropName || !quantity || !unit || !maxPricePerQuintal || !location) {
    return res.status(400).json({
      success: false,
      message: 'cropName, quantity, unit, maxPricePerQuintal, and location are required',
    });
  }

  if (USE_DATABASE) {
    try {
      const newRequirement = await requirementService.createRequirement({
        userId: req.user.id,
        cropName,
        grade,
        quantity,
        unit,
        maxPricePerQuintal,
        location,
        requiredBy,
        notes,
      });
      return res.status(201).json({
        success: true,
        data: newRequirement,
      });
    } catch (error) {
      return next(error);
    }
  }

  idCounter += 1;
  const newRequirement = {
    id: `r${idCounter}`,
    userId: req.user.id,
    cropName: cropName.trim(),
    grade: grade || 'A',
    quantity: Number(quantity),
    unit,
    maxPricePerQuintal: Number(maxPricePerQuintal),
    location: location.trim(),
    postedDate: new Date().toISOString().slice(0, 10),
    status: 'active',
    offerCount: 0,
  };

  if (requiredBy) newRequirement.requiredBy = requiredBy;
  if (notes) newRequirement.notes = notes;

  requirements.unshift(newRequirement);

  res.status(201).json({
    success: true,
    data: newRequirement,
  });
}

async function deleteRequirement(req, res, next) {
  const requirementId = req.params.id;

  // A requirement can only be deleted by its owner while it is still active
  // (open) and has no linked orders. Deleting one with orders would orphan those
  // orders, so open transactions from it must be finalized first. Offers under
  // the requirement are removed by the schema's cascade.
  let requirement;
  let orderCount;
  if (USE_DATABASE) {
    try {
      requirement = await requirementService.findRequirementById(requirementId);
      if (!requirement || requirement.userId !== req.user.id) {
        return res.status(404).json({
          success: false,
          message: 'Requirement not found',
        });
      }
      orderCount = await orderService.countOrdersByRequirement(requirementId);
    } catch (error) {
      return next(error);
    }
  } else {
    requirement = requirements.find((r) => r.id === requirementId);
    if (!requirement || requirement.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found',
      });
    }
    const { orders: mockOrders } = require('./ordersController');
    orderCount = mockOrders.filter((o) => o.requirementId === requirementId).length;
  }

  if (requirement.status !== 'active') {
    return res.status(400).json({
      success: false,
      message: 'Only an active requirement can be deleted',
    });
  }
  if (orderCount > 0) {
    return res.status(400).json({
      success: false,
      message: 'This requirement has linked orders and cannot be deleted',
    });
  }

  if (USE_DATABASE) {
    try {
      await requirementService.deleteRequirement(requirementId);
      return res.status(200).json({
        success: true,
        data: { id: requirementId },
      });
    } catch (error) {
      return next(error);
    }
  }

  const index = requirements.findIndex((r) => r.id === requirementId);
  if (index !== -1) requirements.splice(index, 1);
  res.status(200).json({
    success: true,
    data: { id: requirementId },
  });
}

module.exports = { getAllRequirements, getAvailableRequirements, getRequirementById, createRequirement, deleteRequirement, requirements };
