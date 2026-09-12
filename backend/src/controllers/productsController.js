const { USE_DATABASE } = require('../config/config');
const productService = USE_DATABASE ? require('../services/productService') : null;
const userService = require('../services/userService');
const { products: demoProducts } = require('../demo/demoData');

// In-memory product store seeded from the shared demo catalog so database mode
// and in-memory mode expose the same marketplace products. Copied (spread) so
// runtime listing mutations never leak back into the shared demo module.
const products = [...demoProducts];

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

const IMAGE_URL_RE = /^\/uploads\/[A-Za-z0-9._-]+$/;

// Create a new "Sell Crop" product listing owned by the authenticated seller.
// The seller identity always comes from the token (req.user), never the body, so
// a posted crop is guaranteed to belong to the logged-in farmer. Ownership is
// recorded on sellerUserId and drives the "you cannot offer on your own
// product" rule in createOffer.
async function createProduct(req, res, next) {
  const { name, category, grade, quantity, unit, pricePerQuintal, location, description, imageUrl } = req.body;

  if (!name || !name.trim() || !category || !quantity || !unit || !pricePerQuintal) {
    return res.status(400).json({
      success: false,
      message: 'name, category, quantity, unit, and pricePerQuintal are required',
    });
  }

  // Optional: a crop photo URL returned by the /api/upload endpoint. Only a
  // relative /uploads/... path is accepted so clients cannot inject arbitrary
  // URLs, and requests without an image keep working exactly as before.
  let cleanImageUrl = null;
  if (imageUrl !== undefined && imageUrl !== null && String(imageUrl).trim() !== '') {
    if (typeof imageUrl !== 'string' || !IMAGE_URL_RE.test(imageUrl)) {
      return res.status(400).json({ success: false, message: 'imageUrl must be a valid /uploads/... path' });
    }
    cleanImageUrl = imageUrl;
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
        imageUrl: cleanImageUrl,
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
    imageUrl: cleanImageUrl,
    description: description ? description.trim() : null,
  };

  products.unshift(newProduct);

  res.status(201).json({ success: true, data: newProduct });
}

module.exports = { getAllProducts, getProductById, createProduct, products };
