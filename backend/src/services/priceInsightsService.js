const prisma = require('../config/prisma');

// Price-insights aggregation over recorded ORDER prices (Phase 4).
//
// Data source: real stored order records (Order.pricePerQuintal by productName
// and orderDate). These are observed purchase prices the app already holds. We
// aggregate them into statistics and clearly separate:
//   - observed/stored data  (raw price points / order counts)
//   - calculated statistics (average / min / max / latest / trend)
//   - unavailable data      (e.g. ""insufficient"" when there are too few points
//                            to compute a meaningful trend)
// No fabricated/marketplace-invented prices and no ML forecasts are produced.

function toDateString(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeName(name) {
  return String(name || '').trim();
}

function round(value) {
  return Math.round(value * 100) / 100;
}

// Build aggregated price statistics from a list of order-like rows:
//   { productName, pricePerQuintal, orderDate, unit }
// Returns an array of per-product stat objects sorted by product name.
function buildPriceStats(rows) {
  const groups = {};
  (rows || []).forEach((row) => {
    const name = normalizeName(row.productName);
    if (!name) return;
    const price = toNumber(row.pricePerQuintal);
    if (price == null) return;
    if (!groups[name]) groups[name] = [];
    groups[name].push({
      price,
      date: row.orderDate ? String(row.orderDate).slice(0, 10) : null,
      unit: row.unit || 'Quintal',
    });
  });

  const result = [];
  Object.keys(groups)
    .sort()
    .forEach((name) => {
      const points = groups[name];
      // Sort ascending by date; records without a date sort last.
      const sorted = points.slice().sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      });
      const prices = sorted.map((p) => p.price);
      const count = prices.length;
      const sum = prices.reduce((acc, p) => acc + p, 0);
      const latest = sorted.length ? sorted[sorted.length - 1].price : null;
      const latestDate = sorted.length ? sorted[sorted.length - 1].date : null;

      let trend = 'insufficient';
      if (count >= 3) {
        const earlier = sorted.slice(0, -1);
        const earlierAvg = earlier.reduce((acc, p) => acc + p.price, 0) / earlier.length;
        if (latest > earlierAvg) trend = 'up';
        else if (latest < earlierAvg) trend = 'down';
        else trend = 'flat';
      }

      result.push({
        name,
        unit: groups[name][0].unit || 'Quintal',
        count,
        average: count ? round(sum / count) : null,
        min: count ? round(Math.min(...prices)) : null,
        max: count ? round(Math.max(...prices)) : null,
        latest,
        latestDate,
        trend,
        sufficientHistory: count >= 2,
        history: sorted.map((p) => ({ date: p.date, price: round(p.price) })),
      });
    });
  return result;
}

// DB path: read only the price-relevant fields from every order. No user or
// order identifiers are selected, so the aggregate endpoint leaks no private
// buyer/seller or order information.
async function findAllOrdersForInsights() {
  const rows = await prisma.order.findMany({
    select: { productName: true, pricePerQuintal: true, orderDate: true, unit: true },
    orderBy: { orderDate: 'asc' },
  });
  return rows.map((r) => ({
    productName: r.productName,
    pricePerQuintal: Number(r.pricePerQuintal),
    orderDate: toDateString(r.orderDate),
    unit: r.unit,
  }));
}

module.exports = { buildPriceStats, findAllOrdersForInsights };
