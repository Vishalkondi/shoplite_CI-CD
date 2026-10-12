// Centralised configuration. Values come from environment variables so the
// same code runs locally, in Docker and in CI without changes.
const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Comma-separated list of allowed browser origins for CORS.
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  db: {
    // DATABASE_URL wins if set (e.g. postgres://user:pass@host:5432/db).
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'shop',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'shop',
  },
};

module.exports = config;
