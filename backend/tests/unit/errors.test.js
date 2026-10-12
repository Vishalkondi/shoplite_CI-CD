const { AppError, isDatabaseUnavailable } = require('../../src/errors');

function errorWithCode(code, message = 'boom') {
  const err = new Error(message);
  err.code = code;
  return err;
}

describe('AppError', () => {
  test('carries an HTTP status and optional details', () => {
    const err = new AppError(409, 'Insufficient stock', ['Only 1 left']);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(409);
    expect(err.message).toBe('Insufficient stock');
    expect(err.details).toEqual(['Only 1 left']);
  });
});

describe('isDatabaseUnavailable', () => {
  test.each(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'EHOSTUNREACH'])(
    'treats network error %s as unavailable',
    (code) => {
      expect(isDatabaseUnavailable(errorWithCode(code))).toBe(true);
    }
  );

  test.each([
    ['08006', 'connection failure'],
    ['08001', 'unable to connect'],
    ['57P01', 'admin shutdown'],
    ['57P03', 'cannot connect now (starting up)'],
    ['53300', 'too many connections'],
  ])('treats PostgreSQL SQLSTATE %s (%s) as unavailable', (code) => {
    expect(isDatabaseUnavailable(errorWithCode(code))).toBe(true);
  });

  test.each(['Connection terminated unexpectedly', 'timeout exceeded when trying to connect'])(
    'treats pg message "%s" as unavailable',
    (message) => {
      expect(isDatabaseUnavailable(new Error(message))).toBe(true);
    }
  );

  test.each([
    ['42P01', 'undefined table (a bug, not an outage)'],
    ['23505', 'unique violation'],
    ['42601', 'syntax error'],
  ])('does NOT treat SQLSTATE %s (%s) as unavailable', (code) => {
    expect(isDatabaseUnavailable(errorWithCode(code))).toBe(false);
  });

  test('handles plain errors and missing values', () => {
    expect(isDatabaseUnavailable(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isDatabaseUnavailable(undefined)).toBe(false);
  });
});
