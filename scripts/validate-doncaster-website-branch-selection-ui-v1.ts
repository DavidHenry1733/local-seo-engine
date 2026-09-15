#!/usr/bin/env npx tsx
/**
 * DONCASTER-LOCAL-ONBOARDING-BRANCH-SELECTION-FIX-01
 * Source-check IER website-branch actions and run an isolated Doncaster Chemist selection fixture.
 * Does not crawl websites or call Google Places.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

const SLUG = "doncaster-pharmacy";
const CHEMIST_ID = "doncaster-chemist-dn1-2qp";
const SIBLING_ID = "doncaster-pharmacy-dn2-6qp";
const CHEMIST_PLACE_ID = "ChIJDoncasterChemistDN12QP";
const CHEMIST_URL = "https://www.donchemist.co.uk/";

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sourceChecks() {
  const page = read("artifacts/api-server/src/routes/masterAdminPlatformPage.ts");
  const api = read("artifacts/api-server/src/routes/api/masterAdminPlatform.ts");
  const service = read("src/pharmacy/masterAdminWebsiteBranchSelectionService.ts");

  record(
    "row-button-label",
    page.includes(">Use This Pharmacy</button>") && page.includes('data-ier-branch-select="1"'),
    "IER branch rows render Use This Pharmacy",
  );
  record(
    "action-first-column",
    /<th>Action<\/th><th>Pharmacy name<\/th>/.test(page) && page.includes("overflow:auto"),
    "Action column is first and table is scroll-wrapped",
  );
  record(
    "click-uses-existing-select",
    /data-ier-branch-select[\s\S]*selectWebsiteBranch\(branchId\)/.test(page) &&
      page.includes("/website-branches/select"),
    "Row click posts existing website-branches/select",
  );
  record(
    "no-second-selector",
    !/website-branches\/choose/.test(page + api) && !/selectWebsiteBranchV2/.test(page + api + service),
    "No second branch-selection system",
  );
  record(
    "google-select-ui-blocked",
    page.includes("branchBlocked") &&
      page.includes("Website branch selection is required before Google listing selection.") &&
      /branchBlocked\?'<button class="btn secondary"[\s\S]*disabled/.test(page),
    "Google Select disabled while website branch selection is required",
  );
  record(
    "api-error-message-helper",
    page.includes("function apiErrorMessage(") &&
      page.includes("function toast(msg,isError)") &&
      page.includes("if(!el)return") &&
      /catch\(e\)\{toast\(e,true\)\}/.test(page),
    "409 surfaces apiErrorMessage instead of undefined property access",
  );
  record(
    "google-select-route-gate",
    api.includes("isBranchSelectionBlocking(slug)") &&
      /google-candidates\/select[\s\S]{0,800}isBranchSelectionBlocking\(slug\)/.test(api) &&
      api.includes("Website branch selection is required before Google listing selection."),
    "Google select route 409s until website branch selection completes",
  );
  record(
    "reused-route",
    api.includes('router.post("/master-admin-platform/customers/:slug/website-branches/select"') &&
      api.includes("selectWebsiteBranch(slug, branchId, user)"),
    "POST .../website-branches/select still calls selectWebsiteBranch",
  );
  record(
    "persist-website-and-place",
    service.includes("website: branch.branchUrl || data.website") &&
      service.includes("googlePlaceId: branch.googlePlaceId || data.googlePlaceId"),
    "Selected branch website and Google Place ID persist on the setup profile",
  );
  record(
    "leeds-same-route",
    !/leeds-pharmacy/.test(page.slice(page.indexOf("function renderBranchSelectionPanel"), page.indexOf("function renderImportedEvidenceReview"))) &&
      page.includes("async function selectWebsiteBranch(branchId)") &&
      api.includes("selectWebsiteBranch(slug, branchId, user)"),
    "Leeds continues to use the same unscoped selectWebsiteBranch route",
  );
}

async function selectionFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "doncaster-branch-sel-"));
  fs.mkdirSync(path.join(tmp, "data/pharmacy-profiles"), { recursive: true });
  process.env.WORKSPACE_ROOT = tmp;
  process.env.DATAFORSEO_CALLS = "0";

  const { writeSetupProfile, readSetupProfile } = await import(
    "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts"
  );
  const { selectWebsiteBranch, isBranchSelectionBlocking, buildWebsiteBranchSelectionPayload } = await import(
    "../src/pharmacy/masterAdminWebsiteBranchSelectionService.ts"
  );
  const { validateImportTenantIsolationGate } = await import(
    "../src/pharmacy/masterAdminImportTenantIsolationService.ts"
  );
  const { buildImportedEvidenceReview } = await import(
    "../src/pharmacy/masterAdminImportedEvidenceReviewService.ts"
  );

  const chemist = {
    branchId: CHEMIST_ID,
    branchName: "Doncaster Chemist",
    parentBrandName: "Donchemist",
    addressLine1: "Office 2, 83 Copley Road",
    addressLine2: "",
    town: "Doncaster",
    postcode: "DN1 2QP",
    phone: "01302 965997",
    email: "",
    branchUrl: CHEMIST_URL,
    logoUrl: "",
    openingHours: "",
    services: [] as string[],
    googlePlaceId: CHEMIST_PLACE_ID,
    googleBusinessName: "Doncaster Chemist",
    googleAddress: "Office 2, 83 Copley Road, Doncaster DN1 2QP",
    googleMatchConfidence: 92,
    evidenceSources: [{ sourceUrl: CHEMIST_URL, detectionMethod: "contact-page" }],
    detectionSignals: ["address", "postcode", "phone"],
  };
  const sibling = {
    branchId: SIBLING_ID,
    branchName: "Doncaster Pharmacy",
    parentBrandName: "Donchemist",
    addressLine1: "59 Montrose Avenue",
    addressLine2: "",
    town: "Doncaster",
    postcode: "DN2 6QP",
    phone: "01302 000000",
    email: "",
    branchUrl: "https://www.donchemist.co.uk/montrose",
    logoUrl: "",
    openingHours: "",
    services: [] as string[],
    googlePlaceId: "ChIJDoncasterPharmacyDN26QP",
    googleBusinessName: "Doncaster Pharmacy",
    googleAddress: "59 Montrose Avenue, Doncaster DN2 6QP",
    googleMatchConfidence: 80,
    evidenceSources: [{ sourceUrl: "https://donchemist.co.uk", detectionMethod: "homepage" }],
    detectionSignals: ["address", "postcode"],
  };

  writeSetupProfile(SLUG, {
    pharmacyName: "Doncaster Pharmacy",
    tradingName: "Doncaster Pharmacy",
    website: "https://donchemist.co.uk",
    phone: "",
    addressLine1: "",
    townCity: "Doncaster",
    primaryTown: "Doncaster",
    postcode: "",
    marketScope: "local_regional",
    googlePlaceId: "",
    websiteImportSnapshot: {
      status: "needs_review",
      importedAt: "2026-08-19T10:00:00.000Z",
      message: "Multiple pharmacy branches detected — selection required.",
      websiteUrl: "https://donchemist.co.uk",
      logoUrl: "",
      brandPrimaryColor: "",
      brandSecondaryColor: "",
      brandAccentColor: "",
      brandBackgroundColor: "",
      brandTextColor: "",
      phone: "",
      email: "",
      address: "",
      town: "Doncaster",
      postcode: "",
      socialLinks: [],
      footerLinks: [],
      servicesDetected: [],
      customerVisibleServices: [],
      description: "",
      openingHours: "",
      intelligence: null,
    },
    websiteBranchResolution: {
      status: "branch_selection_required",
      detectedAt: "2026-08-19T10:00:00.000Z",
      selectedAt: null,
      selectedBy: null,
      parentBrand: {
        tradingName: "Donchemist",
        parentWebsite: "https://donchemist.co.uk",
        logoUrl: "",
        brandPrimaryColor: "",
        brandSecondaryColor: "",
        brandAccentColor: "",
      },
      detectedBranches: [chemist, sibling],
      selectedBranchId: null,
      selectedBranch: null,
      rawImportPreserved: true,
      googleBranchMatchStatus: "pending",
      googleBranchMatchNotes: ["Branch selection required before Google comparison can be confirmed."],
    },
  } as never);

  const beforeReview = buildImportedEvidenceReview(SLUG);
  const beforeIso = validateImportTenantIsolationGate(SLUG);
  record(
    "before-requires-selection",
    beforeReview.branchSelection?.requiresSelection === true && isBranchSelectionBlocking(SLUG) === true,
    `requiresSelection=${String(beforeReview.branchSelection?.requiresSelection)} blocking=${String(isBranchSelectionBlocking(SLUG))}`,
  );
  record(
    "before-isolation-blocked",
    beforeIso.passed === false && beforeIso.blockers.some((b) => /branch selection required/i.test(b)),
    beforeIso.blockers.join(" | ") || "no blockers",
  );
  record(
    "before-google-blocked",
    isBranchSelectionBlocking(SLUG) === true,
    "Google candidate selection remains blocked until website branch is chosen",
  );
  record(
    "before-two-branches",
    (beforeReview.branchSelection?.detectedBranchCount || 0) === 2,
    String(beforeReview.branchSelection?.detectedBranchCount),
  );

  const payload = selectWebsiteBranch(SLUG, CHEMIST_ID, "validator");
  const after = readSetupProfile(SLUG);
  const refreshed = readSetupProfile(SLUG);
  const afterReview = buildImportedEvidenceReview(SLUG);
  const afterIso = validateImportTenantIsolationGate(SLUG);
  const afterPayload = buildWebsiteBranchSelectionPayload(SLUG);

  record("select-succeeds", payload.requiresSelection === false && payload.selectedBranchId === CHEMIST_ID, payload.selectedBranchId || "none");
  record(
    "persisted-name",
    after.pharmacyName === "Doncaster Chemist" && refreshed.pharmacyName === "Doncaster Chemist",
    after.pharmacyName,
  );
  record(
    "persisted-address",
    after.addressLine1 === "Office 2, 83 Copley Road" && after.townCity === "Doncaster",
    `${after.addressLine1}, ${after.townCity}`,
  );
  record("persisted-postcode", after.postcode === "DN1 2QP" && refreshed.postcode === "DN1 2QP", after.postcode);
  record("persisted-phone", after.phone === "01302 965997", after.phone);
  record("persisted-website", after.website === CHEMIST_URL && refreshed.website === CHEMIST_URL, after.website);
  record(
    "persisted-place-id",
    after.googlePlaceId === CHEMIST_PLACE_ID && refreshed.googlePlaceId === CHEMIST_PLACE_ID,
    after.googlePlaceId,
  );
  record(
    "requires-selection-cleared",
    afterPayload.requiresSelection === false && afterReview.branchSelection?.requiresSelection === false,
    String(afterReview.branchSelection?.requiresSelection),
  );
  record(
    "isolation-passed",
    afterIso.passed === true,
    afterIso.blockers.join(" | ") || "passed",
  );
  record(
    "website-imported",
    afterReview.websiteImported === true,
    String(afterReview.websiteImported),
  );
  record(
    "google-unblocked-after",
    isBranchSelectionBlocking(SLUG) === false,
    "Google matching can proceed after website branch selection",
  );
  const selected = after.websiteBranchResolution?.selectedBranch;
  record(
    "sibling-not-merged",
    after.postcode !== "DN2 6QP" &&
      !String(after.addressLine1 || "").includes("Montrose") &&
      selected?.branchId === CHEMIST_ID &&
      selected?.postcode === "DN1 2QP" &&
      (after.websiteBranchResolution?.detectedBranches || []).some((b) => b.branchId === SIBLING_ID && b.postcode === "DN2 6QP"),
    `selected=${selected?.branchName || "none"} postcode=${after.postcode} siblingRetained=yes`,
  );
}

async function main() {
  console.log("\n=== DONCASTER-WEBSITE-BRANCH-SELECTION-UI-V1 ===\n");
  sourceChecks();
  await selectionFixture();

  const failed = checks.filter((c) => !c.pass);
  const outDir = path.join(ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "doncaster-website-branch-selection-ui-v1.json"),
    JSON.stringify(
      {
        pass: failed.length === 0,
        generatedAt: new Date().toISOString(),
        checks,
      },
      null,
      2,
    ),
  );
  if (failed.length) {
    console.error(`\nFAILED ${failed.length}/${checks.length}`);
    process.exit(1);
  }
  console.log(`\nPASS ${checks.length}/${checks.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
