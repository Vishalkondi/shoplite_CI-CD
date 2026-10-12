const { Pool } = require('pg');
const config = require('./config');

function createPool(dbConfig = config.db) {
  const options = dbConfig.connectionString
    ? { connectionString: dbConfig.connectionString }
    : {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
      };

  const pool = new Pool({
    ...options,
    max: 10,
    idleTimeoutMillis: 30000,
    // Fail fast (instead of hanging forever) if the database is unreachable.
    connectionTimeoutMillis: 5000,
  });

  // Without this handler an idle client error would crash the process.
  pool.on('error', (err) => {
    console.error('[db] Unexpected error on idle client:', err.message);
  });

  return pool;
}

/**
 * Runs `work(client)` inside a transaction. Commits on success and rolls back
 * if `work` throws, then always releases the client back to the pool.
 */
async function withTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { createPool, withTransaction };
