const { USE_DATABASE } = require('../config/config');
// `buildPriceStats` is a pure function over order rows; the whole service module
// is import-safe (Prisma only connects lazily), so we always load it.
const priceInsightsService = require('../services/priceInsightsService');

function toCountableRows(orders) {
  return (orders || [])
    .filter((o) => o && o.productName)
    .map((o) => ({
      productName: o.productName,
      pricePerQuintal: Number(o.pricePerQuintal),
      orderDate: o.orderDate ? String(o.orderDate).slice(0, 10) : null,
      unit: o.unit || 'Quintal',
    }));
}

// GET /api/price-insights?product=<name>
// Marketplace-wide price statistics derived from recorded orders. Public
// aggregate data (no user/order identity, no delivery addresses are exposed).
// The optional `product` filter narrows to a single product name.
async function getInsights(req, res, next) {
  const productParam = req.query.product;
  if (
    productParam !== undefined &&
    (typeof productParam !== 'string' || !productParam.trim())
  ) {
    return res.status(400).json({
      success: false,
      message: 'product filter must be a non-empty string',
    });
  }

  let rows;
  if (USE_DATABASE) {
    try {
      rows = await priceInsightsService.findAllOrdersForInsights();
    } catch (error) {
      return next(error);
    }
  } else {
    const { orders } = require('./ordersController');
    rows = toCountableRows(orders);
  }

  const all = priceInsightsService.buildPriceStats(rows);

  let products = all;
  let product = null;
  if (productParam) {
    const needle = productParam.trim().toLowerCase();
    product = all.find((p) => p.name.toLowerCase() === needle) || null;
    products = product ? [product] : [];
  }

  res.status(200).json({
    success: true,
    data: {
      source: 'orders', // prices are observed from recorded order data
      products,
      product,
      totals: {
        productCount: all.length,
        orderCount: rows.length,
      },
    },
  });
}

module.exports = { getInsights };
