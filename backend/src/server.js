// Entry point: wires real dependencies (PostgreSQL) into the app and starts
// listening. Tests import ./app instead, so they never open a port or DB pool.
const config = require('./config');
const { createPool } = require('./db');
const { createApp } = require('./app');
const { createProductRepository } = require('./repositories/productRepository');
const { createOrderRepository } = require('./repositories/orderRepository');

const pool = createPool();

const app = createApp({
  productRepository: createProductRepository(pool),
  orderRepository: createOrderRepository(pool),
  checkDatabase: () => pool.query('SELECT 1'),
  corsOrigin: config.corsOrigin,
});

const server = app.listen(config.port, () => {
  console.log(`[server] API listening on port ${config.port} (${config.nodeEnv})`);
});

// Docker sends SIGTERM on `docker compose stop`. Finish in-flight requests
// and close DB connections instead of being killed mid-request.
function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down...`);
  server.close(async () => {
    await pool.end();
    console.log('[server] Closed cleanly');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
