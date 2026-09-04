const { USE_DATABASE } = require('../config/config');
const offerService = USE_DATABASE ? require('../services/offerService') : null;
const productService = USE_DATABASE ? require('../services/productService') : null;
const requirementService = USE_DATABASE ? require('../services/requirementService') : null;
const userService = require('../services/userService');
const { notifyUser } = require('./notificationsController');

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

async function getOffersByRequirement(req, res, next) {
  const requirementId = req.params.id || req.params.requirementId;

  if (USE_DATABASE) {
    try {
      const requirement = await requirementService.findRequirementById(requirementId);
      if (!requirement || requirement.userId !== req.user.id) {
        return res.status(404).json({
          success: false,
          message: 'Requirement not found',
        });
      }
      const requirementOffers = await offerService.findOffersByRequirement(requirementId);
      return res.status(200).json({
        success: true,
        data: requirementOffers,
      });
    } catch (error) {
      return next(error);
    }
  }

  const { requirements } = require('./requirementsController');
  const requirement = requirements.find((r) => r.id === requirementId);
  if (!requirement || requirement.userId !== req.user.id) {
    return res.status(404).json({
      success: false,
      message: 'Requirement not found',
    });
  }
  const requirementOffers = offers.filter((o) => o.requirementId === requirementId);
  res.status(200).json({
    success: true,
    data: requirementOffers,
  });
}

async function getOfferById(req, res, next) {
  if (USE_DATABASE) {
    try {
      const offer = await offerService.findOfferById(req.params.id);
      if (!offer) {
        return res.status(404).json({
          success: false,
          message: 'Offer not found',
        });
      }
      // An offer that is part of a product listing (has a productId) is public
      // marketplace data, already exposed by GET /products/:productId/offers.
      // A requirement-only offer (no productId) is a private bid in a
      // buyer-seller negotiation: only the buyer who owns the linked
      // requirement may view it.
      if (!offer.productId) {
        const requirement = await requirementService.findRequirementById(offer.requirementId);
        if (!requirement || requirement.userId !== req.user.id) {
          return res.status(404).json({
            success: false,
            message: 'Offer not found',
          });
        }
      }
      return res.status(200).json({
        success: true,
        data: offer,
      });
    } catch (error) {
      return next(error);
    }
  }
  const offer = offers.find((o) => o.id === req.params.id);
  if (!offer) {
    return res.status(404).json({
      success: false,
      message: 'Offer not found',
    });
  }
  // Same ownership rule as the DB path.
  if (!offer.productId) {
    const { requirements } = require('./requirementsController');
    const requirement = requirements.find((r) => r.id === offer.requirementId);
    if (!requirement || requirement.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }
  }
  res.status(200).json({
    success: true,
    data: offer,
  });
}

async function getOffersByProduct(req, res, next) {
  const productId = req.params.productId;

  if (USE_DATABASE) {
    try {
      const product = await productService.findProductById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }
      const productOffers = await offerService.findOffersByProduct(productId);
      return res.status(200).json({
        success: true,
        data: productOffers,
      });
    } catch (error) {
      return next(error);
    }
  }

  const { products } = require('./productsController');
  if (!products.some((p) => p.id === productId)) {
    return res.status(404).json({
      success: false,
      message: 'Product not found',
    });
  }
  const productOffers = offers.filter((o) => o.productId === productId);
  res.status(200).json({
    success: true,
    data: productOffers,
  });
}

let offerIdCounter = offers.length;

async function createOffer(req, res, next) {
  const {
    productId,
    requirementId,
    quantity,
    unit,
    offeredPricePerQuintal,
    transportCostPerQuintal,
    otherCostsPerQuintal,
    distanceKm,
    notes,
  } = req.body;

  if (!quantity || !unit || !offeredPricePerQuintal) {
    return res.status(400).json({
      success: false,
      message:
        'quantity, unit, and offeredPricePerQuintal are required',
    });
  }

  // An offer must be tied to at least one target: either the buyer requirement
  // a seller is responding to, or the product listing a buyer is offering on.
  const isRequirementOffer = Boolean(requirementId);
  const isProductOffer = Boolean(productId);
  if (!isRequirementOffer && !isProductOffer) {
    return res.status(400).json({
      success: false,
      message: 'requirementId or productId is required',
    });
  }

  // Validate the target exists before persisting so no orphan offers are stored.
  let requirement = null;
  let product = null;
  if (isRequirementOffer) {
    // A seller may only respond to a requirement that exists, is open, and is
    // not their own. This prevents orphan offers and self-referencing offers
    // while still allowing the seller to make a real offer on a buyer need.
    if (USE_DATABASE) {
      requirement = await requirementService.findRequirementById(requirementId);
    } else {
      const { requirements: mockReqs } = require('./requirementsController');
      requirement = mockReqs.find((r) => r.id === requirementId);
    }
    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found',
      });
    }
    if (requirement.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This requirement is not open to offers',
      });
    }
    if (requirement.userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot make an offer on your own requirement',
      });
    }
  } else if (USE_DATABASE) {
    product = await productService.findProductById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }
  } else {
    const { products: mockProducts } = require('./productsController');
    product = mockProducts.find((p) => p.id === productId) || null;
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }
  }

  // A seller cannot make an offer on their own listing. This prevents a farmer
  // from bidding against themselves and keeps product-marketplace offers honest.
  if (isProductOffer && product && product.sellerUserId === req.user.id) {
    return res.status(400).json({
      success: false,
      message: 'You cannot make an offer on your own product',
    });
  }

  // Maker identity always comes from the authenticated user, never the body.
  let sellerName;
  if (USE_DATABASE) {
    try {
      const authenticatedUser = await userService.findUserById(req.user.id);
      if (!authenticatedUser) {
        return res.status(401).json({
          success: false,
          message: 'Authenticated user not found',
        });
      }
      sellerName = authenticatedUser.name;
    } catch (error) {
      return next(error);
    }
  } else {
    // Mock/fallback path: identity from the authenticated token payload, so it
    // stays DB-free for tests while never trusting the request body.
    sellerName = req.user.name || 'Seller';
  }

  if (USE_DATABASE) {
    try {
      const newOffer = await offerService.createOffer({
        productId: productId || null,
        requirementId: requirementId || null,
        sellerName,
        sellerUserId: req.user.id,
        quantity,
        unit,
        offeredPricePerQuintal,
        transportCostPerQuintal,
        otherCostsPerQuintal,
        distanceKm,
        notes,
      });
      // Notify the requirement owner (buyer) that a new offer arrived. Best-effort
      // and intentionally not awaited so notification delivery can never delay or
      // break the primary action. Product-based offers have no requirement owner,
      // so no notification is sent for them.
      if (requirement && requirement.userId && requirement.userId !== req.user.id) {
        notifyUser({
          userId: requirement.userId,
          type: 'offer',
          title: 'New offer received',
          body: `${sellerName} made an offer on your ${requirement.cropName} requirement.`,
          refType: 'requirement',
          refId: requirementId,
        }).catch(() => {});
      }
      return res.status(201).json({
        success: true,
        data: newOffer,
      });
    } catch (error) {
      return next(error);
    }
  }

  offerIdCounter += 1;
  const newOffer = {
    id: `o${offerIdCounter}`,
    productId: productId || null,
    requirementId: requirementId || null,
    sellerName,
    sellerUserId: req.user.id,
    // Reputation/verification are reputation claims and must come from a trusted
    // server source, never the request body. There is no per-seller verification
    // workflow in the system, so a freshly submitted offer is stored neutral
    // (no self-asserted rating or verified badge).
    sellerRating: null,
    verified: false,
    quantity: Number(quantity),
    unit,
    offeredPricePerQuintal: Number(offeredPricePerQuintal),
    transportCostPerQuintal: transportCostPerQuintal !== undefined ? Number(transportCostPerQuintal) : 0,
    otherCostsPerQuintal: otherCostsPerQuintal !== undefined ? Number(otherCostsPerQuintal) : 0,
    distanceKm: distanceKm !== undefined ? Number(distanceKm) : 0,
    dealScore: 85,
    shortlisted: false,
    notes: notes || null,
  };

  offers.unshift(newOffer);

  // Keep the requirement's offerCount in parity with the persisted offers, just
  // as the DB path does transactionally (offerService.createOffer).
  if (requirement && typeof requirement.offerCount === 'number') {
    requirement.offerCount += 1;
  }

  // Notify the requirement owner (buyer) that a new offer arrived. Best-effort
  // and intentionally not awaited so notification delivery can never delay or
  // break the primary action. Product-based offers have no requirement owner.
  if (requirement && requirement.userId && requirement.userId !== req.user.id) {
    notifyUser({
      userId: requirement.userId,
      type: 'offer',
      title: 'New offer received',
      body: `${sellerName} made an offer on your ${requirement.cropName} requirement.`,
      refType: 'requirement',
      refId: requirementId,
    }).catch(() => {});
  }

  res.status(201).json({
    success: true,
    data: newOffer,
  });
}

module.exports = { getOffersByRequirement, getOfferById, getOffersByProduct, createOffer, offers };
