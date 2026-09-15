#!/usr/bin/env npx tsx
/**
 * COMMERCIAL-PHARMACY-PROFILE-IMPORT-REVIEW-45
 * Read-only: customer-facing confirm-pharmacy presentation.
 * Does not re-import, edit profile, resolve conflicts, regenerate, or publish.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";
import { buildCustomerSetupConfirmView } from "../src/pharmacy/growthEngineCustomerSetupConfirmService.ts";
import { renderPremiumCustomerDashboardPage } from "../src/pharmacy/growthEnginePremiumCustomerDashboardPage.ts";
import {
  COMMERCIAL_BLUE_UI_BASELINE_ID,
  usesCommercialBlueBaseline,
} from "../src/pharmacy/pharmacyCommercialBlueUiBaseline.ts";
import { buildTenantImageLibraryView, MAX_ACTIVE_TENANT_IMAGES } from "../src/pharmacy/pharmacyTenantImageLibraryContract.ts";
import { resolveTenantBrandIdentity } from "../src/pharmacy/pharmacyTenantBrandIdentityContract.ts";
import { isLockedCampaignApprovedForStaging } from "../src/pharmacy/pharmacyLockedCampaignStagingPublishService.ts";
import { buildAuthoritativeCampaignProgramme } from "../src/pharmacy/pharmacyAuthoritativeCampaignProgrammeService.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const FLU_BANK = "eb79f51391b6b6e5cd0b4ac02d6cbe235306159a8847aa704eb5d64f7f4d1ce3";
const CAMPAIGNS = [
  "flu-vaccinations",
  "travel-vaccinations",
  "pharmacy-first",
  "blood-pressure-checks",
] as const;

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

function shaFile(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function shaDir(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  const hash = crypto.createHash("sha256");
  for (const file of files.sort()) {
    hash.update(path.relative(dir, file));
    hash.update(fs.readFileSync(file));
  }
  return hash.digest("hex");
}

function snapshotIntegrity(): Record<string, string | null> {
  const out: Record<string, string | null> = {
    fluBankFile: shaFile(
      path.join(ROOT, "data/pharmacy-approved-service-banks/banks/flu-vaccinations", `${FLU_BANK}.json`),
    ),
    profile: shaFile(path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`)),
    reviewCentre: shaFile(path.join(ROOT, "data/growth-engine", `${SLUG}-review-centre.json`)),
    imageLibrary: shaFile(path.join(ROOT, "data/pharmacy-tenant-image-library", `${SLUG}.json`)),
    stagingCurrent: shaDir(path.join("/var/www/pharmaconnect-sites", SLUG, "current")),
    stagingReleases: shaDir(path.join("/var/www/pharmaconnect-sites", SLUG, "releases")),
  };
  for (const campaign of CAMPAIGNS) {
    out[`approval:${campaign}`] = shaFile(
      path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", SLUG, `${campaign}.json`),
    );
    out[`package:${campaign}`] = shaFile(
      path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${campaign}.json`),
    );
    out[`service:${campaign}`] = shaFile(
      path.join(ROOT, "output/pharmacy-visual-experience", SLUG, campaign, "index.html"),
    );
  }
  return out;
}

function main(): void {
  const before = snapshotIntegrity();
  const view = buildCustomerSetupConfirmView(SLUG);
  const html = renderCustomerSetupConfirmPage(SLUG);
  const images = buildTenantImageLibraryView(SLUG);
  const brand = resolveTenantBrandIdentity(SLUG);
  const programme = buildAuthoritativeCampaignProgramme(SLUG);
  const dashboard = renderPremiumCustomerDashboardPage(SLUG);

  const conflictFields = view.businessDetailConflicts.map((c) => c.field);
  const radioChecked = html.match(/<input[^>]*name="resolution-[^"]+"[^>]*checked/g) || [];

  record(
    "commercial-hero",
    html.includes("<h1>Review your pharmacy details</h1>") &&
      html.includes("We imported information from your website and business profile. Confirm the details below before continuing.") &&
      html.includes("Pharmacy identity imported") &&
      html.includes("Website reviewed") &&
      /services detected/i.test(html) &&
      html.includes(`${images.activeCount} of ${MAX_ACTIVE_TENANT_IMAGES} active`) &&
      !/import completeness/i.test(html) &&
      !html.includes("43%"),
    "compact hero without invented percentage",
  );

  record(
    "confirmed-details-summary",
    html.includes("Confirmed pharmacy details") &&
      html.includes('id="pharmacyName"') &&
      html.includes('id="website"') &&
      html.includes('id="phone"') &&
      !html.includes("Google Profile Import</h2>") &&
      !html.includes("Website Address Evidence"),
    "one confirmed-details card, no duplicated import records",
  );

  record(
    "conflict-visibility-actionability",
    conflictFields.includes("displayAddress") &&
      conflictFields.includes("gphcNumber") &&
      html.includes("Items requiring confirmation") &&
      html.includes("Address presentation") &&
      html.includes("GPhC registration number") &&
      html.includes("Keep current details") &&
      html.includes("Use imported value") &&
      html.includes("Enter a different value") &&
      radioChecked.length === 0 &&
      !html.includes("Canonical:") &&
      !/confidence:\s*\d+%/i.test(html.replace(/<details[\s\S]*?id="brand-review-panel"[\s\S]*?<\/details>/, "")),
    `conflicts=${conflictFields.join(",")} preselected=${radioChecked.length}`,
  );

  record(
    "services-summary",
    html.includes("Services found") &&
      html.includes("Pharmacy First") &&
      !/serviceId["']?\s*:/.test(html),
    "detected services listed without internal IDs",
  );

  record(
    "brand-review-connection",
    html.includes("Review brand") &&
      html.includes('data-brand-review="v1"') &&
      html.includes('id="brand-review-heading"') &&
      html.includes("confirmBrandBtn") &&
      brand.confirmationStatus !== undefined,
    `brand=${brand.confirmationStatus}`,
  );

  record(
    "image-library-20-of-20",
    images.activeCount === 20 &&
      html.includes("20 of 20 active") &&
      html.includes("Open Image Library") &&
      html.includes("/api/pharmacy-image-library?slug=") &&
      html.includes("Placement is automatic") &&
      (html.match(/class="css-image-card"/g) || []).length === 0,
    `active=${images.activeCount}/${MAX_ACTIVE_TENANT_IMAGES}`,
  );

  record(
    "technical-evidence-isolation",
    html.includes("View import details") &&
      !html.includes("Import completeness") &&
      !html.includes("matchedSnippet") &&
      !html.includes("master-admin") &&
      !html.includes("Website Address Evidence") &&
      !/[a-f0-9]{64}/.test(html) &&
      html.includes("Google Business Profile") &&
      html.includes("Website inventory"),
    "collapsed source summary only",
  );

  record(
    "continuation-safety",
    html.includes("Confirm and continue") &&
      html.includes("Return to dashboard") &&
      /id="confirmBtn"[^>]*disabled/.test(html) &&
      html.includes("items-requiring-confirmation") &&
      html.includes("Please confirm:"),
    "confirm blocked until conflicts are chosen; optional fields not used as the gate",
  );

  record(
    "blue-responsive-ui",
    usesCommercialBlueBaseline(html) &&
      html.includes(COMMERCIAL_BLUE_UI_BASELINE_ID) &&
      /@media\(max-width:720px\)/.test(html) &&
      html.toLowerCase().includes("#005eb8"),
    COMMERCIAL_BLUE_UI_BASELINE_ID,
  );

  const core = programme.campaigns.filter((c) => (CAMPAIGNS as readonly string[]).includes(c.serviceId));
  record(
    "profile-campaign-staging-integrity",
    core.every((c) => c.approvedLocked) &&
      core.reduce((sum, c) => sum + Number(c.corePageCount || 0), 0) === 36 &&
      isLockedCampaignApprovedForStaging(SLUG, "flu-vaccinations") === true &&
      dashboard.includes("4 approved campaigns") &&
      view.gphcCandidate?.verificationStatus === "customer-confirmation-required",
    "four locked campaigns, Flu staging, unresolved GPhC candidate unchanged",
  );

  const after = snapshotIntegrity();
  const mutated = Object.keys(before).filter((key) => before[key] !== after[key]);
  record(
    "no-state-mutation",
    mutated.length === 0,
    mutated.length ? `mutated=${mutated.join(",")}` : "profile, campaigns, images and staging unchanged",
  );

  const failed = checks.filter((c) => !c.pass).map((c) => c.id);
  if (failed.length) {
    console.error(`FAIL ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS commercial-pharmacy-profile-import-review-45");
}

main();
