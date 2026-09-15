#!/usr/bin/env npx tsx
/**
 * Website Import Service Detection Accuracy V1 validation.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  backfillCustomerVisibleServicesForSlug,
  readSetupProfile,
} from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import {
  WEBSITE_IMPORT_SERVICE_SOURCE_FIELD,
  websiteImportServiceCountDebug,
} from "../src/pharmacy/growthEngineCampaignExplorerWebsiteServices.ts";
import { buildCampaignExplorerCatalog } from "../src/pharmacy/growthEngineCampaignExplorerService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const TEST_SLUG = "pharmacy-delivered-4u-test";
const UMBRELLA_IDS = new Set(["vaccinations", "prescription-dispensing"]);
const WEAK_METHODS = new Set(["page-crawl", "not-detected"]);

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

function parseConfirmCount(html: string): number | null {
  const m = html.match(/Services detected<\/span><span class="css-row-value">([^<]+)<\/span>/i);
  if (!m) return null;
  const n = parseInt(m[1].trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function parseExplorerCount(html: string): number | null {
  const m = html.match(/Services Already On Your Website \((\d+)\)/);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  console.log("\n=== Website Import Service Detection Accuracy V1 ===\n");

  const visible = await backfillCustomerVisibleServicesForSlug(TEST_SLUG);
  const snap = readSetupProfile(TEST_SLUG).websiteImportSnapshot;
  const debug = websiteImportServiceCountDebug(TEST_SLUG);
  const catalog = buildCampaignExplorerCatalog(TEST_SLUG);
  const confirmHtml = renderCustomerSetupConfirmPage(TEST_SLUG);
  const builderHtml = renderCampaignBuilderPage(TEST_SLUG, "choose");

  record(
    "customer-visible-has-evidence",
    visible.every((s) => s.sourceUrl && s.matchedSnippet && s.detectionMethod),
    `${visible.length} services`,
  );

  record(
    "no-umbrella-duplicates",
    !visible.some((s) => UMBRELLA_IDS.has(s.serviceId)),
    visible.map((s) => s.serviceId).join(", "),
  );

  record(
    "no-weak-global-methods",
    visible.every((s) => !WEAK_METHODS.has(s.detectionMethod)),
    visible.map((s) => s.detectionMethod).join(", "),
  );

  record(
    "source-field-customerVisibleServices",
    WEBSITE_IMPORT_SERVICE_SOURCE_FIELD === "websiteImportSnapshot.customerVisibleServices",
    WEBSITE_IMPORT_SERVICE_SOURCE_FIELD,
  );

  record(
    "confirm-explorer-count-parity",
    debug.confirmPageServiceCount === debug.campaignExplorerServiceCount &&
      debug.campaignExplorerServiceCount === visible.length,
    `confirm=${debug.confirmPageServiceCount} explorer=${debug.campaignExplorerServiceCount} visible=${visible.length}`,
  );

  record(
    "html-confirm-explorer-parity",
    parseConfirmCount(confirmHtml) === parseExplorerCount(builderHtml),
    `${parseConfirmCount(confirmHtml)} = ${parseExplorerCount(builderHtml)}`,
  );

  record(
    "explorer-names-match-visible",
    Boolean(
      catalog &&
        catalog.existingOnWebsite.length === visible.length &&
        catalog.existingOnWebsite.every((item, i) => item.serviceName === visible[i]?.serviceName),
    ),
    catalog?.existingOnWebsite.map((s) => s.serviceName).join(", ") || "missing",
  );

  record(
    "raw-detected-broader-than-visible",
    (snap?.servicesDetected.length || 0) >= visible.length,
    `raw=${snap?.servicesDetected.length || 0} visible=${visible.length}`,
  );

  record(
    "test-tenant-four-services",
    visible.length === 4,
    visible.map((s) => s.serviceName).join(", "),
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
