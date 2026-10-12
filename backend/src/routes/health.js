const { Router } = require('express');

// GET /api/health        -> liveness: is the Node process up?
// GET /api/health/ready  -> readiness: can we reach the database?
// Docker, load balancers and CI smoke tests call these endpoints.
function healthRouter({ checkDatabase }) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/ready', async (req, res) => {
    try {
      await checkDatabase();
      res.json({ status: 'ready', database: 'up' });
    } catch (err) {
      // Log the real reason for operators; return a generic message so we
      // never reveal hostnames or usernames to the outside world.
      console.error(`[health] Database check failed: ${err.code || ''} ${err.message}`);
      res.status(503).json({ status: 'not ready', database: 'down' });
    }
  });

  return router;
}

module.exports = healthRouter;
