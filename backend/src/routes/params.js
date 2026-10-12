const { AppError } = require('../errors');

// Converts a URL parameter to a positive integer id, or throws a 400.
function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, `Invalid id '${raw}'. Expected a positive integer.`);
  }
  return id;
}

module.exports = { parseId };
