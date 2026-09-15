#!/usr/bin/env npx tsx
/**
 * Campaign Explorer Service Consistency V1 validation.
 */
import {
  buildCampaignExplorerCatalog,
  websiteImportServiceCountDebug,
} from "../src/pharmacy/growthEngineCampaignExplorerService.ts";
import {
  collectWebsiteImportCanonicalServices,
  countWebsiteImportDetectedServices,
  WEBSITE_IMPORT_SERVICE_SOURCE_FIELD,
} from "../src/pharmacy/growthEngineCampaignExplorerWebsiteServices.ts";
import {
  CE_DETECTED_ON_WEBSITE,
  CE_EXISTING_WEBSITE_NOTE,
} from "../src/pharmacy/growthEngineCampaignExplorerModel.ts";
import { collectExistingWebsiteServices } from "../src/pharmacy/growthEngineCampaignBuilderFallbackService.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { readSetupProfile, backfillCustomerVisibleServicesForSlug } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

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

async function main() {
  console.log("\n=== Campaign Explorer Service Consistency V1 ===\n");

  await backfillCustomerVisibleServicesForSlug(TEST_SLUG);

  const debug = websiteImportServiceCountDebug(TEST_SLUG);
  const catalog = buildCampaignExplorerCatalog(TEST_SLUG);
  const canonical = collectWebsiteImportCanonicalServices(TEST_SLUG);
  const chooseHtml = renderCampaignBuilderPage(TEST_SLUG, "choose");
  const inflated = collectExistingWebsiteServices(TEST_SLUG);
  const importNames = (readSetupProfile(TEST_SLUG).websiteImportSnapshot?.customerVisibleServices || []).map(
    (s) => s.serviceName,
  );

  record(
    "import-count-parity",
    debug.confirmPageServiceCount === debug.campaignExplorerServiceCount &&
      debug.campaignExplorerServiceCount === (catalog?.websiteImportServiceCount || 0),
    `import=${debug.confirmPageServiceCount} explorer=${debug.campaignExplorerServiceCount}`,
  );

  record(
    "source-field",
    debug.sourceField === WEBSITE_IMPORT_SERVICE_SOURCE_FIELD,
    debug.sourceField,
  );

  record(
    "existing-section-count-parity",
    Boolean(catalog && catalog.existingOnWebsite.length === debug.confirmPageServiceCount),
    `${catalog?.existingOnWebsite.length || 0} cards`,
  );

  record(
    "canonical-dedupe",
    canonical.length === new Set(canonical.map((s) => s.serviceName.toLowerCase())).size,
    `${canonical.length} unique names`,
  );

  record(
    "no-inflated-fallback-merge",
    canonical.length <= inflated.length,
    `canonical=${canonical.length} legacy-collector=${inflated.length}`,
  );

  record(
    "consistent-import-names",
    Boolean(
      catalog &&
        catalog.existingOnWebsite.every((item) =>
          importNames.some((n) => n.toLowerCase() === item.serviceName.toLowerCase()),
        ),
    ),
    catalog?.existingOnWebsite.map((s) => s.serviceName).join(", ") || "missing",
  );

  const detectedInCatalog = (catalog?.nhsServices || [])
    .concat(catalog?.privateServices || [])
    .filter((item) => item.detectedOnWebsite);
  record(
    "catalog-detected-markers",
    detectedInCatalog.length >= 1 &&
      detectedInCatalog.every((item) =>
        canonical.some(
          (c) =>
            c.serviceId === item.serviceId ||
            c.serviceName.toLowerCase() === item.serviceName.toLowerCase(),
        ),
      ),
    `${detectedInCatalog.length} marked in NHS/private catalogs`,
  );

  record(
    "travel-clinic-excluded-weak-detection",
    !catalog?.existingOnWebsite.some((s) => s.serviceId === "travel-vaccinations"),
    "Travel Clinic not in customer-visible list",
  );

  record(
    "private-catalog-detected-note",
    chooseHtml.includes(CE_DETECTED_ON_WEBSITE) && chooseHtml.includes("Travel Vaccinations"),
    CE_DETECTED_ON_WEBSITE,
  );

  record(
    "existing-explanation",
    chooseHtml.includes(CE_EXISTING_WEBSITE_NOTE),
    CE_EXISTING_WEBSITE_NOTE,
  );

  record(
    "existing-title-count",
    chooseHtml.includes(`Services Already On Your Website (${debug.confirmPageServiceCount})`),
    `(${debug.confirmPageServiceCount})`,
  );

  record(
    "no-duplicate-existing-cards",
    Boolean(
      catalog &&
        catalog.existingOnWebsite.length === new Set(catalog.existingOnWebsite.map((s) => s.serviceId)).size,
    ),
    "one card per serviceId",
  );

  record(
    "growth-excludes-detected",
    Boolean(
      catalog &&
        !catalog.growthOpportunities.some((g) => catalog.existingOnWebsite.some((e) => e.serviceId === g.serviceId)),
    ),
    `${catalog?.growthOpportunities.length || 0} growth items`,
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
