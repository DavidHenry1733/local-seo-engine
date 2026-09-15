import { buildIndexDashboard } from "../src/indexing/indexDashboardEngine";

const projectSlug = process.argv[2] || "inboxingproweb";
const dashboard = buildIndexDashboard(projectSlug, { outputDir: "output" });

const status = dashboard.validation.passed
  ? "PASS: index dashboard data layer generated"
  : "FAIL: index dashboard data layer requires fixes";

console.log(status);
console.log(`Project: ${dashboard.projectSlug}`);
console.log(`Output: ${dashboard.outputPath}`);
console.log(`Total URLs: ${dashboard.summary.totalUrls}`);
console.log(`Indexed: ${dashboard.summary.indexed}`);
console.log(`Excluded: ${dashboard.summary.excluded}`);
console.log(`Not Indexed: ${dashboard.summary.notIndexed}`);
console.log(`Known to Google: ${dashboard.summary.knownToGoogle}`);
console.log(`Crawled: ${dashboard.summary.crawled}`);
console.log(`Discovered: ${dashboard.summary.discovered}`);
console.log(`Malformed: ${dashboard.summary.malformed}`);
console.log(`Duplicates: ${dashboard.summary.duplicates}`);
console.log(`Opportunities: ${dashboard.summary.opportunities}`);
console.log(`Missing lifecycle data: ${dashboard.summary.missingLifecycleData}`);

console.log("Service breakdown:");
for (const service of dashboard.serviceBreakdown) {
  console.log(
    `- ${service.label}: ${service.urlCount} URLs, ${service.indexedCount} indexed, ` +
    `${service.impressions} impressions, ${service.clicks} clicks, avg position ${service.averagePosition ?? "—"}`,
  );
}

console.log("Top opportunities:");
for (const record of dashboard.topOpportunities.slice(0, 10)) {
  console.log(`- ${record.url} — ${record.actionReason || record.statusGroups.join(", ")}`);
}

if (!dashboard.validation.passed) {
  console.log("Validation:");
  console.log(JSON.stringify(dashboard.validation, null, 2));
  process.exitCode = 1;
}
