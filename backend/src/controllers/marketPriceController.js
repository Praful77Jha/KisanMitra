const marketPriceService = require('../services/marketPriceService');

// GET /api/market-prices?crop=<name>
// Returns MSAMB reference market prices. Optional `crop` filter narrows to a
// single crop. Response includes source notice and reference date.
async function getMarketPrices(req, res, next) {
  const cropParam = req.query.crop;
  if (
    cropParam !== undefined &&
    (typeof cropParam !== 'string' || !cropParam.trim())
  ) {
    return res.status(400).json({
      success: false,
      message: 'crop filter must be a non-empty string',
    });
  }

  try {
    const prices = await marketPriceService.findByCrop(cropParam || null);
    const crops = await marketPriceService.listCrops();

    res.status(200).json({
      success: true,
      data: {
        source: 'MSAMB',
        referenceDate: '2026-09-03',
        prices,
        crops,
        totals: {
          cropCount: crops.length,
          priceCount: prices.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getMarketPrices };
