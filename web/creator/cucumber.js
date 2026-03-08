export default {
  import: ['e2e/**/*.ts'],
  require: ['ts-node/register'],
  loader: ['ts-node/esm'],
  format: ['progress', 'html:e2e/reports/cucumber-report.html'],
  formatOptions: { snippetInterface: 'async-await' },
  publishQuiet: true,
};
