const express = require('express');
const cors = require('cors');
const healthRouter = require('./routes/health');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const requestLogger = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

/**
 * Builds the Express app. Dependencies (repositories, DB check) are passed in
 * rather than imported, so tests can supply fakes without a real database.
 */
function createApp({ productRepository, orderRepository, checkDatabase, corsOrigin, logRequests = true }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  if (corsOrigin) {
    app.use(cors({ origin: corsOrigin.split(',').map((o) => o.trim()) }));
  }
  if (logRequests) {
    app.use(requestLogger);
  }

  app.use('/api/health', healthRouter({ checkDatabase }));
  app.use('/api/products', productsRouter({ productRepository }));
  app.use('/api/orders', ordersRouter({ orderRepository }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
