#!/usr/bin/env npx tsx
/**
 * Pharmacy Delivered Test Tenant V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  provisionPharmacyDelivered4uTestTenant,
  readSetupProfile,
} from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { buildCustomerSetupConfirmView } from "../src/pharmacy/growthEngineCustomerSetupConfirmService.ts";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";
import { renderCustomerSetupStartPage } from "../src/pharmacy/growthEngineCustomerSetupStartPage.ts";
import {
  PHARMACY_DELIVERED_TEST_BASELINE,
  PHARMACY_DELIVERED_TEST_SLUG,
  profileContainsRowlandsStaleText,
  retiredSetupTestBannerMessage,
} from "../src/pharmacy/growthEngineCustomerSetupTestTenants.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const NEW_SLUG = PHARMACY_DELIVERED_TEST_SLUG;
const RETIRED_SLUG = "rowlands-test";
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${NEW_SLUG}.json`);

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

function main() {
  console.log("\n=== Pharmacy Delivered Test Tenant V1 ===\n");

  const { profilePath } = provisionPharmacyDelivered4uTestTenant();
  record("tenant-exists", fs.existsSync(profilePath), profilePath);

  const data = readSetupProfile(NEW_SLUG);
  const baseline = data.customerSetupAdminBaseline;
  record("baseline-pharmacy-name", baseline?.pharmacyName === PHARMACY_DELIVERED_TEST_BASELINE.pharmacyName, baseline?.pharmacyName || "");
  record("baseline-website", baseline?.website === PHARMACY_DELIVERED_TEST_BASELINE.website, baseline?.website || "");
  record("baseline-town", baseline?.town === PHARMACY_DELIVERED_TEST_BASELINE.town, baseline?.town || "");
  record("baseline-postcode", baseline?.postcode === PHARMACY_DELIVERED_TEST_BASELINE.postcode, baseline?.postcode || "");

  const rawProfile = fs.readFileSync(PROFILE_PATH, "utf8");
  const rowlandsHit = profileContainsRowlandsStaleText(rawProfile);
  record("no-rowlands-text-profile", !rowlandsHit, rowlandsHit || "clean");
  record("no-rowlands-website-profile", !rawProfile.includes("rowlandspharmacy.co.uk"), "rowlandspharmacy.co.uk absent");
  record(
    "no-rowlands-email-profile",
    !rawProfile.includes("patientexperience@rowlandspharmacy.co.uk"),
    "patientexperience absent",
  );

  record("google-snapshot-empty", !data.googleImportSnapshot, "googleImportSnapshot null");
  record("website-snapshot-empty", !data.websiteImportSnapshot, "websiteImportSnapshot null");
  record("imported-keys-empty", (data.websiteImportedFieldKeys || []).length === 0, "websiteImportedFieldKeys");
  record("confirmations-empty", Object.keys(data.profileFieldConfirmations || {}).length === 0, "confirmations");

  const view = buildCustomerSetupConfirmView(NEW_SLUG);
  record(
    "confirm-google-not-imported",
    view.googleSection.notice === "Google Business Profile not imported yet.",
    view.googleSection.notice,
  );
  record(
    "confirm-website-not-imported",
    view.websiteSection.notice === "Website not imported yet.",
    view.websiteSection.notice,
  );
  record("confirm-baseline-name", view.fields.pharmacyName.value === PHARMACY_DELIVERED_TEST_BASELINE.pharmacyName, view.fields.pharmacyName.value);
  record("confirm-baseline-town", view.fields.town.value === PHARMACY_DELIVERED_TEST_BASELINE.town, view.fields.town.value);
  record("confirm-baseline-postcode", view.fields.postcode.value === PHARMACY_DELIVERED_TEST_BASELINE.postcode, view.fields.postcode.value);
  record("confirm-manual-source", view.fields.pharmacyName.source === "manual", view.fields.pharmacyName.source);

  const confirmHtml = renderCustomerSetupConfirmPage(NEW_SLUG);
  const confirmStale = profileContainsRowlandsStaleText(confirmHtml);
  record("confirm-html-clean", !confirmStale, confirmStale || "clean");
  record(
    "confirm-html-notices",
    confirmHtml.includes("Google Business Profile not imported yet.") &&
      confirmHtml.includes("Website not imported yet."),
    "not imported notices",
  );

  const retiredStartHtml = renderCustomerSetupStartPage(RETIRED_SLUG);
  const retiredConfirmHtml = renderCustomerSetupConfirmPage(RETIRED_SLUG);
  const bannerMsg = retiredSetupTestBannerMessage(RETIRED_SLUG);
  record("rowlands-start-retired-banner", retiredStartHtml.includes(bannerMsg), bannerMsg);
  record("rowlands-confirm-retired-banner", retiredConfirmHtml.includes(bannerMsg), bannerMsg);
  record(
    "rowlands-banner-links-new-tenant",
    retiredStartHtml.includes(PHARMACY_DELIVERED_TEST_SLUG) && retiredConfirmHtml.includes(PHARMACY_DELIVERED_TEST_SLUG),
    PHARMACY_DELIVERED_TEST_SLUG,
  );
  record("new-tenant-no-retired-banner", !renderCustomerSetupStartPage(NEW_SLUG).includes("Retired test profile"), "no banner");

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) {
    failed.forEach((c) => console.error(`  FAIL ${c.id}: ${c.detail}`));
    process.exit(1);
  }
}

main();
