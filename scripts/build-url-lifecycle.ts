import { buildUrlLifecycle } from "../src/indexing/urlLifecycleEngine";

const projectSlug = process.argv[2] || "inboxingproweb";
const refreshSearchAnalytics = process.argv.includes("--refresh-analytics");

const report = await buildUrlLifecycle(projectSlug, {
  outputDir: "output",
  refreshSearchAnalytics,
});

console.log("PASS: url lifecycle generated");
console.log(`Project: ${report.projectSlug}`);
console.log(`Output: ${report.outputPath}`);
console.log(`Registry count: ${report.summary.registryCount}`);
console.log(`Known count: ${report.summary.knownCount}`);
console.log(`Checked count: ${report.summary.checkedCount}`);
console.log(`Indexed count: ${report.summary.indexedCount}`);
console.log(`Excluded count: ${report.summary.excludedCount}`);
console.log(`URLs missing lifecycle data: ${report.summary.missingLifecycleDataCount}`);
console.log(`Search Analytics rows: ${report.searchAnalytics.rowCount}`);

if (report.searchAnalytics.error) {
  console.log(`Search Analytics warning: ${report.searchAnalytics.error}`);
}
