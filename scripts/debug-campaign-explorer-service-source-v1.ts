#!/usr/bin/env npx tsx
/**
 * Campaign Explorer — emergency service source debug.
 *
 * Usage:
 *   npx tsx scripts/debug-campaign-explorer-service-source-v1.ts --slug=pharmacy-delivered-4u-test
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCampaignExplorerCatalog } from "../src/pharmacy/growthEngineCampaignExplorerService.ts";
import {
  EXPLORER_EXISTING_SERVICES_PRODUCER,
  WEBSITE_IMPORT_SERVICE_SOURCE_FIELD,
  bypassCampaignBuilderExistingServicesCache,
  collectRawWebsiteServiceSources,
  collectWebsiteImportCanonicalServices,
  resolveConfirmPageWebsiteImportServices,
  websiteImportServiceCountDebug,
} from "../src/pharmacy/growthEngineCampaignExplorerWebsiteServices.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

function parseSlug(argv: string[]): string {
  for (const arg of argv) {
    if (arg.startsWith("--slug=")) return arg.slice("--slug=".length);
  }
  return "pharmacy-delivered-4u-test";
}

function printList(label: string, items: string[]) {
  console.log(`  ${label} (${items.length}):`);
  if (!items.length) console.log("    (empty)");
  else items.forEach((item, i) => console.log(`    ${i + 1}. ${item}`));
}

function main() {
  const slug = parseSlug(process.argv.slice(2));
  console.log(`\n=== Campaign Explorer Service Source Debug V1 ===`);
  console.log(`slug: ${slug}\n`);

  const confirm = resolveConfirmPageWebsiteImportServices(slug);
  const debug = websiteImportServiceCountDebug(slug);
  const catalog = buildCampaignExplorerCatalog(slug);
  const raw = collectRawWebsiteServiceSources(slug);
  const canonical = collectWebsiteImportCanonicalServices(slug);

  console.log("--- Confirm Pharmacy (Website Import section) ---");
  printList("confirm page service list", confirm.confirmPageServiceList);
  console.log(`  confirm page service count: ${confirm.confirmPageServiceCount}`);
  console.log(`  confirm source field: ${confirm.confirmSourceField}`);
  console.log(`  confirm "Services detected" row value: ${confirm.confirmServicesDetectedRowValue || "(empty)"}`);

  console.log("\n--- Campaign Explorer (Existing section) ---");
  printList(
    "campaign explorer existing-service list",
    catalog?.existingOnWebsite.map((s) => s.serviceName) || [],
  );
  console.log(`  campaign explorer count: ${catalog?.existingOnWebsite.length ?? 0}`);
  console.log(`  campaign explorer source field: ${WEBSITE_IMPORT_SERVICE_SOURCE_FIELD}`);
  console.log(`  producer: ${EXPLORER_EXISTING_SERVICES_PRODUCER}`);

  console.log("\n--- Parity ---");
  console.log(`  confirm count === explorer count: ${debug.confirmPageServiceCount === debug.campaignExplorerServiceCount}`);
  console.log(`  debug: confirm=${debug.confirmPageServiceCount} explorer=${debug.campaignExplorerServiceCount}`);

  console.log("\n--- Raw candidate sources ---");
  printList(
    "websiteImportSnapshot.customerVisibleServices",
    raw.websiteImportCustomerVisibleServices.map((s) => s.serviceName),
  );
  printList(
    "websiteImportSnapshot.servicesDetected (diagnostic)",
    raw.websiteImportSnapshotServicesDetected,
  );
  printList(
    "websiteImportSnapshot.intelligence.services (exists=true)",
    raw.websiteImportIntelligenceServicesExists.map((s) => s.serviceName),
  );
  console.log(`  websiteImportSnapshot.intelligence.services (all rows): ${raw.websiteImportIntelligenceServicesAll}`);
  printList(
    "detectedWebsiteServices",
    raw.detectedWebsiteServices.map((s) => s.serviceName),
  );
  printList(
    "website report coverage (websiteDetected)",
    raw.websiteReportCoverageDetected.map((s) => s.serviceName),
  );
  printList("profile selectedServices", raw.profileSelectedServices);
  console.log(`  fallback/cached merged collector (${raw.fallbackCollectorMerged.length}):`);
  raw.fallbackCollectorMerged.forEach((s, i) =>
    console.log(`    ${i + 1}. ${s.serviceName} [${s.source}]`),
  );
  console.log(`  campaign builder session: ${raw.campaignBuilderSessionPath}`);
  console.log(`  session stores service list: ${raw.campaignBuilderSessionHasServiceList}`);

  const sessionCleared = bypassCampaignBuilderExistingServicesCache(slug);
  if (sessionCleared) {
    console.log("\n--- Session cache bypass ---");
    console.log("  reset campaign builder session step to choose (no service list in session)");
  }

  console.log("\n--- 9-service list diagnosis ---");
  const nineSources: string[] = [];
  if (raw.websiteImportCustomerVisibleServices.length === visible.length) {
    nineSources.push("websiteImportSnapshot.customerVisibleServices");
  }
  if (raw.websiteImportSnapshotServicesDetected.length === 9) {
    nineSources.push("websiteImportSnapshot.servicesDetected (diagnostic raw)");
  }
  if (raw.websiteImportIntelligenceServicesExists.length === 9) {
    nineSources.push("websiteImportSnapshot.intelligence.services (exists=true)");
  }
  if (raw.detectedWebsiteServices.length === 9) {
    nineSources.push("detectedWebsiteServices");
  }
  if (raw.fallbackCollectorMerged.length === 9) {
    nineSources.push("collectExistingWebsiteServices() merged fallback");
  }
  const visible = raw.websiteImportCustomerVisibleServices;
  if (visible.length === 9) {
    nineSources.push(`${EXPLORER_EXISTING_SERVICES_PRODUCER}`);
  }

  if (nineSources.length) {
    console.log("  sources with count 9:");
    nineSources.forEach((s) => console.log(`    - ${s}`));
  } else {
    console.log("  no single source has exactly 9 services");
  }

  console.log(`\n  Explorer uses: ${EXPLORER_EXISTING_SERVICES_PRODUCER}`);
  console.log(`  Authority field: ${WEBSITE_IMPORT_SERVICE_SOURCE_FIELD}\n`);
}

main();
