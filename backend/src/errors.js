// An error that carries an HTTP status code. Throw it anywhere in the request
// pipeline and the error-handler middleware turns it into a JSON response.
class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

// Network-level error codes from Node.js when the database host can't be reached.
const NETWORK_ERROR_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'EHOSTUNREACH']);

/**
 * True when an error means "the database is unreachable right now" (as
 * opposed to a bug such as bad SQL). These become 503 Service Unavailable.
 */
function isDatabaseUnavailable(err) {
  if (!err) return false;
  if (NETWORK_ERROR_CODES.has(err.code)) return true;
  // PostgreSQL SQLSTATE classes: 08 = connection exception,
  // 57P0x = server shutting down / cannot connect now, 53300 = too many connections.
  if (typeof err.code === 'string' && (err.code.startsWith('08') || /^57P0[1-3]$/.test(err.code) || err.code === '53300')) {
    return true;
  }
  return /Connection terminated|timeout exceeded when trying to connect/i.test(err.message || '');
}

module.exports = { AppError, isDatabaseUnavailable };
