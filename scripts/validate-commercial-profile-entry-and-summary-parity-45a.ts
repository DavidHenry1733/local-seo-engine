#!/usr/bin/env npx tsx
/**
 * COMMERCIAL-PROFILE-ENTRY-AND-SUMMARY-PARITY-45A
 * Read-only: dashboard Step 1 route + confirm-page summary presentation.
 * Does not resolve conflicts, upload images, regenerate, or publish.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";
import { buildCustomerSetupConfirmView } from "../src/pharmacy/growthEngineCustomerSetupConfirmService.ts";
import { renderPremiumCustomerDashboardPage } from "../src/pharmacy/growthEnginePremiumCustomerDashboardPage.ts";
import { buildPremiumCustomerDashboardView } from "../src/pharmacy/growthEnginePremiumCustomerDashboard.ts";
import { renderProductOwnerImageLibraryPage } from "../src/pharmacy/growthEngineProductOwnerImageLibraryPage.ts";
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
const CONFIRM = `/api/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(SLUG)}`;

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
    imageLibrary: shaFile(path.join(ROOT, "data/pharmacy-tenant-image-library", `${SLUG}.json`)),
    reviewCentre: shaFile(path.join(ROOT, "data/growth-engine", `${SLUG}-review-centre.json`)),
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
  }
  return out;
}

function featureCard(html: string, id: string): string {
  return html.match(new RegExp(`data-feature-id="${id}"[\\s\\S]*?</article>`))?.[0] || "";
}

function main(): void {
  const before = snapshotIntegrity();
  const dashView = buildPremiumCustomerDashboardView(SLUG);
  const dashboard = renderPremiumCustomerDashboardPage(SLUG);
  const confirm = renderCustomerSetupConfirmPage(SLUG);
  const confirmView = buildCustomerSetupConfirmView(SLUG);
  const libraryPage = renderProductOwnerImageLibraryPage(SLUG);
  const images = buildTenantImageLibraryView(SLUG);
  const brand = resolveTenantBrandIdentity(SLUG);
  const programme = buildAuthoritativeCampaignProgramme(SLUG);
  const step1 = featureCard(dashboard, "pharmacy-profile");
  const step1Href = dashView.featureJourney.find((f) => f.id === "pharmacy-profile")?.href || "";

  record(
    "dashboard-profile-route",
    step1.includes("View profile") &&
      step1.includes(CONFIRM) &&
      !step1.includes("business-intelligence") &&
      step1Href === CONFIRM,
    `step1=${step1Href}`,
  );

  const heroBrand = confirm.includes("Brand Review needs confirmation");
  const cardBrand = confirm.includes("Needs confirmation");
  record(
    "brand-status-parity",
    brand.confirmationStatus !== "confirmed" &&
      heroBrand &&
      cardBrand &&
      !confirm.includes("Brand Review connected") &&
      (confirm.match(/Needs confirmation/g) || []).length >= 1,
    `heroNeedsConfirmation=${heroBrand} card=${cardBrand} record=${brand.confirmationStatus}`,
  );

  const reviewBrandCount = (confirm.match(/Review brand/g) || []).length;
  record(
    "single-brand-review-action",
    reviewBrandCount === 1 &&
      confirm.includes('id="openBrandReviewBtn"') &&
      confirm.includes('data-brand-review="v1"') &&
      confirm.includes("confirmBrandBtn"),
    `reviewBrandCount=${reviewBrandCount}`,
  );

  record(
    "image-library-summary-separation",
    !confirm.includes("tenantLibraryFiles") &&
      !confirm.includes("Upload images") &&
      confirm.includes("Open Image Library") &&
      confirm.includes("20 of 20 active images") &&
      /hero, support, trust, conversion/i.test(confirm) &&
      libraryPage.includes('id="tenantLibraryFiles"') &&
      /<input[^>]*id="tenantLibraryFiles"[^>]*multiple/.test(libraryPage.replace(/\n/g, " ")),
    "profile summary has no upload; dedicated library keeps multiple upload",
  );

  record(
    "twenty-image-integrity",
    images.activeCount === 20 &&
      images.activeCount === MAX_ACTIVE_TENANT_IMAGES &&
      confirm.includes("20 of 20 active"),
    `active=${images.activeCount}/${MAX_ACTIVE_TENANT_IMAGES}`,
  );

  const conflictFields = confirmView.businessDetailConflicts.map((c) => c.field);
  record(
    "conflict-continuation-integrity",
    conflictFields.includes("displayAddress") &&
      conflictFields.includes("gphcNumber") &&
      confirm.includes("Address presentation") &&
      confirm.includes("GPhC registration number") &&
      /id="confirmBtn"[^>]*disabled/.test(confirm) &&
      confirm.includes("Please confirm:") &&
      confirm.includes("Return to dashboard") &&
      confirm.includes("Confirm and continue") &&
      (confirm.match(/<input[^>]*name="resolution-[^"]+"[^>]*checked/g) || []).length === 0,
    `conflicts=${conflictFields.join(",")}`,
  );

  record(
    "action-bar-safety",
    confirm.includes("css-sticky-spacer") &&
      confirm.includes("--confirm-sticky-offset") &&
      confirm.includes("scroll-padding-bottom:var(--confirm-sticky-offset)") &&
      /@media\(max-width:720px\)/.test(confirm) &&
      confirm.includes('id="stickySpacer"') &&
      /View import details[\s\S]*id="stickySpacer"[\s\S]*css-sticky-bar/.test(confirm),
    "spacer reserved below import details; sticky bar after content",
  );

  const core = programme.campaigns.filter((c) => (CAMPAIGNS as readonly string[]).includes(c.serviceId));
  record(
    "campaign-staging-integrity",
    core.every((c) => c.approvedLocked) &&
      core.reduce((sum, c) => sum + Number(c.corePageCount || 0), 0) === 36 &&
      isLockedCampaignApprovedForStaging(SLUG, "flu-vaccinations") === true &&
      dashboard.includes("4 approved campaigns") &&
      usesCommercialBlueBaseline(confirm) &&
      confirm.includes(COMMERCIAL_BLUE_UI_BASELINE_ID),
    "four locked campaigns, Flu staging, blue UI",
  );

  const after = snapshotIntegrity();
  const mutated = Object.keys(before).filter((key) => before[key] !== after[key]);
  record(
    "no-state-mutation",
    mutated.length === 0,
    mutated.length ? `mutated=${mutated.join(",")}` : "profile, brand, images, campaigns and staging unchanged",
  );

  const failed = checks.filter((c) => !c.pass).map((c) => c.id);
  if (failed.length) {
    console.error(`FAIL ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS commercial-profile-entry-and-summary-parity-45a");
}

main();
