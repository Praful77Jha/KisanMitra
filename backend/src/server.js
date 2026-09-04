const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'KisanMitra API is running',
  });
});

const productsRouter = require('./routes/products');
app.use('/api/products', productsRouter);

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

const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

const usersRouter = require('./routes/users');
app.use('/api/users', usersRouter);

const notificationsRouter = require('./routes/notifications');
app.use('/api/notifications', notificationsRouter);

const chatRouter = require('./routes/chat');
app.use('/api/chat', chatRouter);

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
