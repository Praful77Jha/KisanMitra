const { USE_DATABASE } = require('../config/config');
const productService = USE_DATABASE ? require('../services/productService') : null;
const userService = require('../services/userService');

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
    sellerUserId: null,
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
    sellerUserId: null,
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
    sellerUserId: null,
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
    sellerUserId: null,
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
    sellerUserId: null,
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
    sellerUserId: null,
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

async function getAllProducts(req, res, next) {
  if (USE_DATABASE) {
    try {
      const data = await productService.findAllProducts();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }
  res.status(200).json({
    success: true,
    data: products,
  });
}

async function getProductById(req, res, next) {
  if (USE_DATABASE) {
    try {
      const product = await productService.findProductById(req.params.id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }
      return res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      return next(error);
    }
  }
  const product = products.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found',
    });
  }
  res.status(200).json({
    success: true,
    data: product,
  });
}

let productIdCounter = products.length;

// Create a new "Sell Crop" product listing owned by the authenticated seller.
// The seller identity always comes from the token (req.user), never the body, so
// a posted crop is guaranteed to belong to the logged-in farmer. Ownership is
// recorded on sellerUserId and drives the "you cannot offer on your own
// product" rule in createOffer.
async function createProduct(req, res, next) {
  const { name, category, grade, quantity, unit, pricePerQuintal, location, description } = req.body;

  if (!name || !name.trim() || !category || !quantity || !unit || !pricePerQuintal) {
    return res.status(400).json({
      success: false,
      message: 'name, category, quantity, unit, and pricePerQuintal are required',
    });
  }

  const qty = Number(quantity);
  const price = Number(pricePerQuintal);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: 'quantity must be a positive number' });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ success: false, message: 'pricePerQuintal must be a positive number' });
  }

  if (USE_DATABASE) {
    try {
      const authenticatedUser = await userService.findUserById(req.user.id);
      if (!authenticatedUser) {
        return res.status(401).json({ success: false, message: 'Authenticated user not found' });
      }
      const newProduct = await productService.createProduct({
        sellerUserId: req.user.id,
        seller: authenticatedUser.name,
        name: name.trim(),
        category: category.trim(),
        grade,
        quantity,
        unit,
        pricePerQuintal,
        location: location ? location.trim() : null,
        description: description ? description.trim() : null,
      });
      return res.status(201).json({ success: true, data: newProduct });
    } catch (error) {
      return next(error);
    }
  }

  productIdCounter += 1;
  const newProduct = {
    id: `p${productIdCounter}`,
    name: name.trim(),
    category: category.trim(),
    grade: grade || null,
    quantity: qty,
    unit,
    pricePerQuintal: price,
    seller: req.user.name || 'Farmer',
    sellerUserId: req.user.id,
    sellerRating: null,
    verified: false,
    location: location ? location.trim() : null,
    distanceKm: null,
    transportCost: null,
    otherCosts: null,
    dealScore: 50,
    imageFile: null,
    description: description ? description.trim() : null,
  };

  products.unshift(newProduct);

  res.status(201).json({ success: true, data: newProduct });
}

module.exports = { getAllProducts, getProductById, createProduct, products };
