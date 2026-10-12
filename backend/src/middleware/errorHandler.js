const { AppError, isDatabaseUnavailable } = require('../errors');

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

// Express recognises error handlers by their 4 arguments, so keep `next`
// even though it is unused.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Malformed JSON body sent by the client.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }

  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }

  // Database down or unreachable: tell the client to retry later.
  if (isDatabaseUnavailable(err)) {
    console.error(`[error] Database unavailable: ${err.code || ''} ${err.message}`);
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again shortly.' });
  }

  // Anything else is a bug: log it, but never leak internals (SQL, stack
  // traces, hostnames) to the client.
  console.error('[error]', err);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { notFoundHandler, errorHandler };
