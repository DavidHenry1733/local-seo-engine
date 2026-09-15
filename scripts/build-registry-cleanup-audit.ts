import { buildRegistryCleanupAudit } from "../src/indexing/registryCleanupAuditEngine";

const projectSlug = process.argv[2] || "inboxingproweb";
const audit = buildRegistryCleanupAudit(projectSlug, { outputDir: "output" });

console.log("PASS: registry cleanup audit generated");
console.log(`Project: ${audit.projectSlug}`);
console.log(`Output: ${audit.outputPath}`);
console.log(`Total registry URLs: ${audit.summary.totalRegistryUrls}`);
console.log(`Indexable pages: ${audit.summary.indexablePages}`);
console.log(`Non-indexable assets: ${audit.summary.nonIndexableAssets}`);
console.log(`Malformed URLs: ${audit.summary.malformedUrls}`);
console.log(`Duplicate URLs: ${audit.summary.duplicateUrls}`);
console.log(`Legacy URLs: ${audit.summary.legacyUrls}`);
console.log(`Blog URLs: ${audit.summary.blogUrls}`);
console.log(`Hub URLs: ${audit.summary.hubUrls}`);
console.log(`Cluster URLs: ${audit.summary.clusterUrls}`);
console.log(`Safe auto-fix candidates: ${audit.summary.safeAutoFixCandidates}`);
console.log(`Manual review candidates: ${audit.summary.manualReviewCandidates}`);
console.log(`URLs to remove from registry: ${audit.summary.urlsToRemoveFromRegistry}`);
console.log(`URLs to keep: ${audit.summary.urlsToKeep}`);

if (audit.urlsToRemoveFromRegistry.length) {
  console.log("Remove candidates:");
  for (const record of audit.urlsToRemoveFromRegistry.slice(0, 20)) {
    console.log(`- ${record.url} — ${record.reasons.join(", ") || record.classifications.join(", ")}`);
  }
}

if (audit.safeAutoFixCandidates.length) {
  console.log("Safe auto-fix candidates:");
  for (const record of audit.safeAutoFixCandidates.slice(0, 20)) {
    console.log(`- ${record.url} -> ${record.canonicalTarget}`);
  }
}
