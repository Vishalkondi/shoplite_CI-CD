// Jest configuration.
// Coverage thresholds make `npm run test:coverage` FAIL if test coverage
// drops below these percentages, so CI catches untested code.

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/scripts/**'],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    // Always enforced: code that is fully testable without PostgreSQL.
    './src/services/': { statements: 95, branches: 90, functions: 100, lines: 95 },
    './src/routes/': { statements: 95, branches: 80, functions: 100, lines: 95 },
    './src/middleware/': { statements: 95, branches: 90, functions: 100, lines: 95 },
    './src/errors.js': { statements: 95, branches: 85, functions: 100, lines: 95 },
    // Repositories and db.js can only be exercised by the database tests,
    // so their threshold applies only when TEST_DATABASE_URL is set (as in CI).
    ...(hasTestDatabase && {
      global: { statements: 85, branches: 60, functions: 80, lines: 85 },
    }),
  },
};
