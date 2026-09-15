import { buildSeoOpportunities } from "../src/indexing/seoOpportunityEngine";

const projectSlug = process.argv[2] || "inboxingproweb";
const report = buildSeoOpportunities(projectSlug, { outputDir: "output" });

const status = report.validation.passed
  ? "PASS: SEO opportunity data layer generated"
  : "FAIL: SEO opportunity data layer requires fixes";

console.log(status);
console.log(`Project: ${report.projectSlug}`);
console.log(`Output: ${report.outputPath}`);
console.log(`Total opportunities: ${report.summary.total}`);
console.log(`Critical: ${report.summary.critical}`);
console.log(`High: ${report.summary.high}`);
console.log(`Medium: ${report.summary.medium}`);
console.log(`Low: ${report.summary.low}`);
console.log("By category:");
for (const [category, count] of Object.entries(report.summary.byCategory)) {
  console.log(`- ${category}: ${count}`);
}

console.log("Top 10 opportunities:");
for (const opportunity of report.topOpportunities.slice(0, 10)) {
  console.log(`- [${opportunity.priority}] ${opportunity.category}: ${opportunity.url} — ${opportunity.issue}`);
}

if (!report.validation.passed) {
  console.log("Validation:");
  console.log(JSON.stringify(report.validation, null, 2));
  process.exitCode = 1;
}
