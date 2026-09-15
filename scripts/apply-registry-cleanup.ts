import { applyRegistryCleanup } from "../src/indexing/registryCleanupEngine";

const projectSlug = process.argv[2] || "inboxingproweb";
const skipAnalyticsRefresh = process.argv.includes("--skip-analytics-refresh");

const result = await applyRegistryCleanup(projectSlug, {
  outputDir: "output",
  refreshSearchAnalytics: !skipAnalyticsRefresh,
});

const status = result.validation.passed ? "PASS: registry cleanup applied" : "FAIL: registry cleanup requires review";

console.log(status);
console.log(`Project: ${result.projectSlug}`);
console.log(`Registry: ${result.registryPath}`);
console.log(`Backup: ${result.backupPath}`);
console.log(`Registry count before: ${result.registryCountBefore}`);
console.log(`Registry count after: ${result.registryCountAfter}`);
console.log(`URLs removed: ${result.urlsRemoved.length}`);
for (const url of result.urlsRemoved) console.log(`- removed ${url}`);
console.log(`URLs repaired: ${result.urlsRepaired.length}`);
for (const repair of result.urlsRepaired) console.log(`- repaired ${repair.from} -> ${repair.to}`);
console.log(`Lifecycle rebuilt: ${result.lifecycleRebuilt}`);
console.log(`Health audit rebuilt: ${result.healthAuditRebuilt}`);

if (!result.validation.passed) {
  console.log("Validation failures:");
  console.log(JSON.stringify(result.validation, null, 2));
  process.exitCode = 1;
}
