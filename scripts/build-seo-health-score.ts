import { buildSeoHealthScore } from "../src/indexing/seoHealthScoreEngine";

const projectSlug = process.argv[2] || "inboxingproweb";
const report = buildSeoHealthScore(projectSlug, { outputDir: "output" });

const status = report.validation.passed
  ? "PASS: SEO health score generated"
  : "FAIL: SEO health score requires fixes";

console.log(status);
console.log(`Project: ${report.projectSlug}`);
console.log(`Output: ${report.outputPath}`);
console.log(`Overall score: ${report.overallScore}`);
console.log(`Grade: ${report.grade}`);
console.log("Component scores:");
for (const [name, score] of Object.entries(report.componentScores)) {
  console.log(`- ${name}: ${score.score} (weight ${score.weight}, weighted ${score.weightedScore}, confidence ${score.confidence})`);
}

console.log("Top issues:");
for (const issue of report.keyIssues.slice(0, 10)) {
  console.log(`- [${issue.priority}] ${issue.category}: ${issue.url} - ${issue.issue}`);
}

console.log("Top quick wins:");
for (const win of report.quickWins.slice(0, 10)) {
  console.log(`- [${win.priority}] ${win.category}: ${win.url} - ${win.issue}`);
}

if (!report.validation.passed) {
  console.log("Validation:");
  console.log(JSON.stringify(report.validation, null, 2));
  process.exitCode = 1;
}
