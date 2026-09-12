const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '8mb' }));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'KisanMitra API is running',
  });
});

const productsRouter = require('./routes/products');
app.use('/api/products', productsRouter);

const uploadsRouter = require('./routes/uploads');
app.use('/api/upload', uploadsRouter);

// Serve farmer-uploaded crop photos from backend/uploads. The directory is
// created if missing; express.static only exposes files inside this folder.
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/api/uploads', express.static(uploadsDir));

const requirementsRouter = require('./routes/requirements');
app.use('/api/requirements', requirementsRouter);

const offersRouter = require('./routes/offers');
app.use('/api/offers', offersRouter);

const ordersRouter = require('./routes/orders');
app.use('/api/orders', ordersRouter);

const logisticsRouter = require('./routes/logistics');
app.use('/api/logistics', logisticsRouter);

const priceInsightsRouter = require('./routes/priceInsights');
app.use('/api/price-insights', priceInsightsRouter);

const marketPricesRouter = require('./routes/marketPrices');
app.use('/api/market-prices', marketPricesRouter);

const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

const usersRouter = require('./routes/users');
app.use('/api/users', usersRouter);

const notificationsRouter = require('./routes/notifications');
app.use('/api/notifications', notificationsRouter);

const chatRouter = require('./routes/chat');
app.use('/api/chat', chatRouter);

const transporterRouter = require('./routes/transporter');
app.use('/api/transporter', transporterRouter);

const transportRequestsRouter = require('./routes/transportRequests');
app.use('/api/transport-requests', transportRequestsRouter);

const transportQuotesRouter = require('./routes/transportQuotes');
app.use('/api/transport-quotes', transportQuotesRouter);

const transportJobsRouter = require('./routes/transportJobs');
app.use('/api/transport-jobs', transportJobsRouter);

const transportersRouter = require('./routes/transporters');
app.use('/api/transporters', transportersRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use((err, req, res, next) => {
  // Log full detail server-side but never echo it to the client: unexpected
  // errors (e.g. Prisma/db failures) can leak schema, query, or environment
  // details. Expected 4xx errors are returned directly by controllers and never
  // reach this handler.
  console.error(`[error] ${err.method || ''} ${err.originalUrl || ''}`.trim());
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.status && err.status < 500 ? err.message : 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`KisanMitra API server is running at http://localhost:${PORT}`);
});
