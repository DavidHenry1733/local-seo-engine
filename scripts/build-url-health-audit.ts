import { buildUrlHealthAudit } from "../src/indexing/urlHealthAuditEngine";

const projectSlug = process.argv[2] || "inboxingproweb";
const audit = buildUrlHealthAudit(projectSlug, { outputDir: "output" });

console.log("PASS: url health audit generated");
console.log(`Project: ${audit.projectSlug}`);
console.log(`Output: ${audit.outputPath}`);
console.log(`Total URLs: ${audit.summary.totalUrls}`);
console.log(`Indexed: ${audit.summary.indexed}`);
console.log(`Excluded: ${audit.summary.excluded}`);
console.log(`Not Indexed: ${audit.summary.notIndexed}`);
console.log(`Malformed: ${audit.summary.malformed}`);
console.log(`Duplicates: ${audit.summary.duplicates}`);
console.log(`Opportunities: ${audit.summary.opportunities}`);
console.log(`Missing lifecycle data: ${audit.summary.missingLifecycleData}`);

console.log("Top action URLs:");
for (const record of audit.topActionUrls) {
  console.log(`- ${record.primaryClassification}: ${record.url} — ${record.actionReason}`);
}
