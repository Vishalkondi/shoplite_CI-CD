// Applies db/init.sql to the database configured by the environment.
// Docker Compose does this automatically; use this script when running
// PostgreSQL yourself:  npm run db:init
const fs = require('node:fs');
const path = require('node:path');
const { createPool } = require('../db');

const INIT_SQL_PATH = path.join(__dirname, '..', '..', 'db', 'init.sql');

async function initDb(pool) {
  const sql = fs.readFileSync(INIT_SQL_PATH, 'utf8');
  await pool.query(sql);
}

if (require.main === module) {
  const pool = createPool();
  initDb(pool)
    .then(() => console.log('[db:init] Schema and sample data applied'))
    .catch((err) => {
      console.error('[db:init] Failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { initDb };
