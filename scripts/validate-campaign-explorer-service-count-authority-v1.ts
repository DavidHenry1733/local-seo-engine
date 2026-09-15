#!/usr/bin/env npx tsx
/**
 * Campaign Explorer — Website Import service count authority V1 validation.
 */
import {
  buildCampaignExplorerCatalog,
  websiteImportServiceCountDebug,
} from "../src/pharmacy/growthEngineCampaignExplorerService.ts";
import {
  collectWebsiteImportCanonicalServices,
  countWebsiteImportDetectedServices,
  countWebsiteImportServicesDetectedRaw,
  WEBSITE_IMPORT_SERVICE_SOURCE_FIELD,
} from "../src/pharmacy/growthEngineCampaignExplorerWebsiteServices.ts";
import { collectExistingWebsiteServices } from "../src/pharmacy/growthEngineCampaignBuilderFallbackService.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { readSetupProfile, backfillCustomerVisibleServicesForSlug } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { CE_EXISTING_WEBSITE_NOTE } from "../src/pharmacy/growthEngineCampaignExplorerModel.ts";

const TEST_SLUG = "pharmacy-delivered-4u-test";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function confirmServicesDetectedNames(slug: string): string[] {
  const profile = readSetupProfile(slug);
  return (profile.websiteImportSnapshot?.servicesDetected || [])
    .map((n) => String(n || "").trim())
    .filter(Boolean);
}

async function main() {
  console.log("\n=== Campaign Explorer Service Count Authority V1 ===\n");

  await backfillCustomerVisibleServicesForSlug(TEST_SLUG);

  const debug = websiteImportServiceCountDebug(TEST_SLUG);
  console.log("Debug:");
  console.log(`  confirm page service count: ${debug.confirmPageServiceCount}`);
  console.log(`  campaign explorer service count: ${debug.campaignExplorerServiceCount}`);
  console.log(`  source field: ${debug.sourceField}`);
  console.log(`  services: ${debug.serviceNames.join(", ")}`);
  console.log("");

  const catalog = buildCampaignExplorerCatalog(TEST_SLUG);
  const canonical = collectWebsiteImportCanonicalServices(TEST_SLUG);
  const importNames = (readSetupProfile(TEST_SLUG).websiteImportSnapshot?.customerVisibleServices || []).map(
    (s) => s.serviceName,
  );
  const chooseHtml = renderCampaignBuilderPage(TEST_SLUG, "choose");
  const inflated = collectExistingWebsiteServices(TEST_SLUG);

  record(
    "confirm-equals-explorer-count",
    debug.confirmPageServiceCount === debug.campaignExplorerServiceCount &&
      debug.campaignExplorerServiceCount === (catalog?.websiteImportServiceCount || 0),
    `confirm=${debug.confirmPageServiceCount} explorer=${debug.campaignExplorerServiceCount}`,
  );

  record(
    "test-tenant-import-list-parity",
    debug.serviceNames.length === importNames.length &&
      debug.serviceNames.every(
        (name, i) => name.toLowerCase() === String(importNames[i] || "").toLowerCase(),
      ),
    `${debug.serviceNames.length} services: ${debug.serviceNames.join(", ")}`,
  );

  record(
    "source-field-customerVisibleServices",
    debug.sourceField === WEBSITE_IMPORT_SERVICE_SOURCE_FIELD,
    debug.sourceField,
  );

  record(
    "uses-customerVisibleServices-only",
    canonical.every((s) => s.source === "website-import-customerVisibleServices"),
    canonical.map((s) => s.source).join(", ") || "empty",
  );

  record(
    "exact-import-names",
    canonical.every((s) => importNames.some((n) => n.toLowerCase() === s.serviceName.toLowerCase())),
    canonical.map((s) => s.serviceName).join(", "),
  );

  record(
    "no-extra-beyond-import",
    canonical.length <= countWebsiteImportServicesDetectedRaw(TEST_SLUG) &&
      canonical.length === countWebsiteImportDetectedServices(TEST_SLUG),
    `canonical=${canonical.length} raw=${countWebsiteImportServicesDetectedRaw(TEST_SLUG)}`,
  );

  record(
    "no-inflated-fallback-sources",
    canonical.length <= inflated.length,
    `canonical=${canonical.length} fallback-collector=${inflated.length}`,
  );

  record(
    "canonical-dedupe",
    canonical.length === new Set(canonical.map((s) => s.serviceName.toLowerCase())).size,
    `${canonical.length} unique names`,
  );

  record(
    "existing-section-count-in-title",
    Boolean(
      catalog &&
        chooseHtml.includes(`Services Already On Your Website (${catalog.websiteImportServiceCount})`),
    ),
    `(${catalog?.websiteImportServiceCount})`,
  );

  record(
    "import-explanation",
    chooseHtml.includes(CE_EXISTING_WEBSITE_NOTE),
    CE_EXISTING_WEBSITE_NOTE,
  );

  record(
    "no-duplicate-existing-cards",
    Boolean(
      catalog &&
        catalog.existingOnWebsite.length === new Set(catalog.existingOnWebsite.map((s) => s.serviceId)).size,
    ),
    `${catalog?.existingOnWebsite.length} cards`,
  );

  record(
    "catalog-still-present",
    chooseHtml.includes("All NHS Pharmacy Services") && chooseHtml.includes("Private Services"),
    "NHS + Private catalogues",
  );

  record(
    "catalog-detected-marker",
    chooseHtml.includes("Already detected on your website"),
    "marker on overlapping catalog rows",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) {
    failed.forEach((c) => console.log(`  FAIL: ${c.id} — ${c.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
