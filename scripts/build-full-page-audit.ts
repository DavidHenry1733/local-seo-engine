import { buildFullPageAudit } from "../src/indexing/fullPageAuditEngine";

const projectSlug = process.argv[2] || "inboxingproweb";
const report = buildFullPageAudit(projectSlug, { outputDir: "output" });

const status = report.validation.passed
  ? "PASS: Full page audit generated"
  : "FAIL: Full page audit requires fixes";

console.log(status);
console.log(`Project: ${report.projectSlug}`);
console.log(`Output: ${report.outputPath}`);
console.log(`Overall status: ${report.readinessVerdict.status}`);
console.log(`Ready for wider rollout: ${report.readinessVerdict.readyForWiderRollout ? "yes" : "no"}`);
console.log(`Health score: ${report.summary.healthScore ?? "—"} (${report.summary.healthGrade ?? "—"})`);
console.log(`Registry URLs: ${report.summary.registryUrls}`);
console.log(`Sitemap URLs: ${report.summary.sitemapUrls}`);
console.log(`Pages audited: ${report.summary.pageCount}`);
console.log(`Indexed: ${report.summary.indexedCount}`);
console.log(`Not indexed: ${report.summary.notIndexedCount}`);
console.log(`Excluded: ${report.summary.excludedCount}`);
console.log(`Impressions: ${report.summary.impressions}`);
console.log(`Clicks: ${report.summary.clicks}`);
console.log(`Average position: ${report.summary.averagePosition ?? "—"}`);
console.log(`Malformed URLs: ${report.summary.malformedUrls}`);
console.log(`Missing lifecycle data: ${report.summary.pagesWithNoLifecycleData}`);
console.log(`Near page-one pages: ${report.summary.nearPageOnePages}`);
console.log(`High impressions / low clicks pages: ${report.summary.highImpressionsLowClicksPages}`);

console.log("By page type:");
for (const [pageType, group] of Object.entries(report.byPageType)) {
  console.log(`- ${pageType}: ${group.pageCount} pages, ${group.indexedCount} indexed, ${group.excludedCount} excluded, ${group.impressions} impressions, ${group.clicks} clicks`);
}

console.log("Top issues:");
for (const issue of report.topIssues.slice(0, 10)) {
  console.log(`- [${issue.severity}] ${issue.category}: ${issue.url} - ${issue.issue}`);
}

console.log("Quick wins:");
for (const win of report.quickWins.slice(0, 10)) {
  console.log(`- [${win.priority}] ${win.category}: ${win.url} - ${win.issue}`);
}

if (!report.validation.passed) {
  console.log("Validation:");
  console.log(JSON.stringify(report.validation, null, 2));
  process.exitCode = 1;
}
