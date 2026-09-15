#!/usr/bin/env npx tsx
/**
 * Customer Setup Import Split V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runSetupGoogleImport,
  runSetupWebsiteImport,
  readSetupProfile,
  buildGoogleDraftValues,
  buildWebsiteDraftValues,
} from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import {
  buildCustomerSetupConfirmView,
  runCustomerSetupConfirm,
} from "../src/pharmacy/growthEngineCustomerSetupConfirmService.ts";
import { renderCustomerSetupStartPage } from "../src/pharmacy/growthEngineCustomerSetupStartPage.ts";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const CORE_FIELDS = [
  "pharmacyName",
  "website",
  "phone",
  "businessEmail",
  "addressLine1",
  "primaryTown",
  "townCity",
  "postcode",
  "googlePlaceId",
] as const;

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

function cleanup(slug: string): void {
  const profile = path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`);
  const brand = path.join(ROOT, "config/projects", slug);
  try {
    if (fs.existsSync(profile)) fs.unlinkSync(profile);
  } catch {
    /* ignore */
  }
  try {
    if (fs.existsSync(brand)) fs.rmSync(brand, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function coreFieldsEmpty(data: ReturnType<typeof readSetupProfile>): boolean {
  return CORE_FIELDS.every((key) => !String((data as Record<string, unknown>)[key] || "").trim());
}

async function main() {
  console.log("\n=== Customer Setup Import Split V1 ===\n");

  const apiSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngine.ts"), "utf8");
  record("route-google-import", apiSrc.includes("/setup-google-import"), "POST setup-google-import");
  record("route-website-import", apiSrc.includes("/setup-website-import"), "POST setup-website-import");

  const googleOnlySlug = `split-google-${Date.now()}`;
  const websiteOnlySlug = `split-website-${Date.now()}`;
  const bothSlug = `split-both-${Date.now()}`;

  const startHtml = renderCustomerSetupStartPage(googleOnlySlug);
  record("start-google-card", startHtml.includes("Import Google Business Profile"), "google card");
  record("start-website-card", startHtml.includes("Import Website"), "website card");
  record("start-find-google-btn", startHtml.includes("Find Google Profile"), "find google");
  record("start-import-website-btn", startHtml.includes("Import Website"), "import website");
  record("start-continue-btn", startHtml.includes("Review Imported Details"), "continue");
  record("start-google-help", startHtml.includes("Where do I find my Google Profile link?"), "google help");
  record("start-no-combined-form", !startHtml.includes("Find My Pharmacy") && !startHtml.includes("setupStartForm"), "no combined import");
  record("start-separate-endpoints", startHtml.includes("setup-google-import") && startHtml.includes("setup-website-import"), "split endpoints");

  await runSetupGoogleImport(googleOnlySlug, {
    pharmacyName: "Split Test Pharmacy",
    town: "London",
    postcode: "SW1A 1AA",
  });
  const afterGoogle = readSetupProfile(googleOnlySlug);
  record("google-snapshot-written", Boolean(afterGoogle.googleImportSnapshot), "googleImportSnapshot");
  record("google-core-not-written", coreFieldsEmpty(afterGoogle), "core fields empty after google import");

  await runSetupWebsiteImport(websiteOnlySlug, { websiteUrl: "https://rowlandspharmacy.co.uk/" });
  const afterWebsite = readSetupProfile(websiteOnlySlug);
  record("website-snapshot-written", Boolean(afterWebsite.websiteImportSnapshot), "websiteImportSnapshot");
  record("website-core-not-written", coreFieldsEmpty(afterWebsite), "core fields empty after website import");

  await runSetupGoogleImport(bothSlug, { pharmacyName: "Both Test", town: "Manchester", postcode: "M1 1AE" });
  await runSetupWebsiteImport(bothSlug, { websiteUrl: "https://rowlandspharmacy.co.uk/" });
  const afterBoth = readSetupProfile(bothSlug);

  const confirmHtml = renderCustomerSetupConfirmPage(bothSlug);
  const confirmView = buildCustomerSetupConfirmView(bothSlug);
  record("confirm-title", confirmHtml.includes("Review Imported Details"), "page title");
  record("confirm-google-section", confirmHtml.includes("Google Profile Import"), "google section");
  record("confirm-website-section", confirmHtml.includes("Website Import"), "website section");
  record("confirm-details-section", confirmHtml.includes("Confirm Pharmacy Details"), "details section");
  record(
    "confirm-use-google",
    confirmView.googleSection.status === "imported"
      ? confirmHtml.includes("Use Google Profile Details")
      : !confirmHtml.includes("Use Google Profile Details"),
    confirmView.googleSection.status === "imported" ? "use google btn when imported" : "no use google when not imported",
  );
  record("confirm-use-website", confirmHtml.includes("Use Website Details"), "use website btn");
  record("confirm-primary-cta", confirmHtml.includes("Confirm and Continue"), "confirm CTA");
  record("confirm-source-badges", confirmHtml.includes("css-field-source"), "source badges");
  record("confirm-no-combined-import", !confirmHtml.includes("Find My Pharmacy"), "no combined import");

  buildCustomerSetupConfirmView(bothSlug);
  const websiteDraft = buildWebsiteDraftValues(afterBoth);
  record("website-draft-website", Boolean(websiteDraft.website), websiteDraft.website || "website url");

  const confirm = runCustomerSetupConfirm(bothSlug, {
    pharmacyName: "Both Test Pharmacy",
    website: "https://rowlandspharmacy.co.uk/",
    phone: "01612345678",
    email: "info@example.com",
    address: "1 Test Street",
    town: "Manchester",
    postcode: "M1 1AE",
    fieldSources: {
      pharmacyName: "manual",
      website: "website",
      phone: "google",
      email: "website",
      address: "manual",
      town: "manual",
      postcode: "manual",
    },
  });
  record("confirm-saves", confirm.ok === true, "saved");
  record("redirect-local-market", confirm.redirectUrl.includes("/local-market"), confirm.redirectUrl);

  const saved = readSetupProfile(bothSlug);
  record("saved-pharmacy-name", saved.pharmacyName === "Both Test Pharmacy", saved.pharmacyName || "");
  record("saved-field-sources", saved.customerSetupFieldSources?.website === "website", "sources persisted");

  cleanup(googleOnlySlug);
  cleanup(websiteOnlySlug);
  cleanup(bothSlug);

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
