#!/usr/bin/env npx tsx
/**
 * Website Import Service Detection Accuracy V1 — per-service audit output.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditWebsiteImportServiceDetections } from "../src/pharmacy/growthEngineWebsiteImportCustomerVisibleServices.ts";
import {
  backfillCustomerVisibleServicesForSlug,
  readSetupProfile,
} from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

function parseSlug(): string {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--slug=")) return arg.slice("--slug=".length);
  }
  return "pharmacy-delivered-4u-test";
}

async function main() {
  const slug = parseSlug();
  console.log(`\n=== Website Import Service Detection Audit V1 ===`);
  console.log(`slug: ${slug}\n`);

  await backfillCustomerVisibleServicesForSlug(slug);

  const snap = readSetupProfile(slug).websiteImportSnapshot;
  const intel = snap?.intelligence;
  if (!intel) {
    console.error("No website import intelligence on profile.");
    process.exit(1);
  }

  const audit = await auditWebsiteImportServiceDetections({
    serviceRows: intel.services,
    pages: intel.structure.pages,
    homepageUrl: intel.identity.resolvedUrl || snap.websiteUrl,
  });

  for (const row of audit) {
    console.log(`Service: ${row.serviceName}`);
    console.log(`  source URL: ${row.sourceUrl || "—"}`);
    console.log(`  matched snippet: ${row.matchedSnippet || "—"}`);
    console.log(`  detection method: ${row.detectionMethod}`);
    console.log(`  confidence: ${row.confidence}`);
    console.log(`  customer-visible: ${row.included ? "yes" : "no"}`);
    if (row.exclusionReason) console.log(`  exclusion: ${row.exclusionReason}`);
    console.log("");
  }

  const visible = snap.customerVisibleServices || [];
  console.log(`Customer-visible (${visible.length}): ${visible.map((s) => s.serviceName).join(", ") || "none"}`);
  console.log(`Raw detected (${snap.servicesDetected.length}): ${snap.servicesDetected.join(", ")}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
