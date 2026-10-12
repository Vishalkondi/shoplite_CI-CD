// Writes a short Markdown table of test results to the GitHub Actions run
// summary page. Used by .github/workflows/ci.yml after `npm run test:ci`.
const fs = require('node:fs');

const RESULTS = 'test-results.json';
const COVERAGE = 'coverage/coverage-summary.json';

if (!fs.existsSync(RESULTS)) {
  console.log(`No ${RESULTS} found - did the test step run?`);
  process.exit(0);
}

const r = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
const lines = [
  '### Backend tests',
  '',
  '| Passed | Failed | Skipped | Total |',
  '|---|---|---|---|',
  `| ${r.numPassedTests} | ${r.numFailedTests} | ${r.numPendingTests} | ${r.numTotalTests} |`,
];

if (fs.existsSync(COVERAGE)) {
  const total = JSON.parse(fs.readFileSync(COVERAGE, 'utf8')).total;
  lines.push('', `Line coverage: **${total.lines.pct}%** · Branch coverage: **${total.branches.pct}%**`);
}

const markdown = `${lines.join('\n')}\n`;
console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
}
