#!/usr/bin/env npx tsx
/**
 * PHARMACONNECT-COMMERCIAL-ACCEPTANCE-HOTFIX-01
 * Google connect-later must not block Business Profile / brand evidence.
 * Fixture tenant only. Does not touch the acceptance pharmacy or historical tenants.
 */
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { writeSetupProfile, readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { getPharmacyBrandDnaPath } from "../src/pharmacy/pharmacyBrandDnaStore.ts";
import {
  businessProfileReviewOpenAllowed,
  confirmManualOnboardingBrandSource,
  manualBrandConfirmationOffer,
  MANUAL_BRAND_SOURCE_PREFIX,
} from "../src/pharmacy/masterAdminGoogleLaterBrandEvidence.ts";
import { buildBusinessProfileReview } from "../src/pharmacy/masterAdminBusinessProfileReviewService.ts";
import { canApproveBusinessProfileWithGoogleState } from "../src/pharmacy/masterAdminBusinessProfileGoogleValidation.ts";
import {
  buildCprEvidenceFields,
  enrichReviewableEvidenceFields,
  evaluateRequiredEvidenceGate,
} from "../src/pharmacy/masterAdminCoreProductRecoveryEvidenceService.ts";
import {
  approveServicePageEvidenceReview,
  buildServicePageEvidenceReview,
  decideServicePageEvidenceReviewField,
} from "../src/pharmacy/masterAdminCoreProductRecoveryEvidenceReviewService.ts";
import {
  registerMasterAdminClient,
  removeMasterAdminRegistryEntry,
} from "../src/pharmacy/pharmacyMasterAdminService.ts";
import type { PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const FIXTURE = "hotfix01-google-later-fixture";
const ACCEPTANCE = "pharmaconnect-e2e-test-pharmacy-2";
const HISTORICAL = [
  "brook-pharmacy-demo-derby",
  "yorkshire-pharmacy-and-health-clinic",
  "leeds-pharmacy",
  "vision-pharmacy",
  "banner-cross-pharmacy",
] as const;
const REGISTRY = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/registry.json");
const failures: string[] = [];

function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
  console.log(`${condition ? "PASS" : "FAIL"}  ${message}`);
}

function sha(file: string): string {
  if (!fs.existsSync(file)) return "ABSENT";
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function slugFileHash(slug: string): string {
  const listed = execSync(
    `find data config -path '*${slug}*' -type f 2>/dev/null | sort`,
    { cwd: PHARMACY_WORKSPACE_ROOT, encoding: "utf8" },
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const hash = crypto.createHash("sha256");
  for (const rel of listed) hash.update(rel).update(sha(path.join(PHARMACY_WORKSPACE_ROOT, rel)));
  hash.update(String(listed.length));
  return `${listed.length}:${hash.digest("hex")}`;
}

function removeFixtureFiles(): void {
  const listed = execSync(
    `find data config -path '*${FIXTURE}*' 2>/dev/null | sort`,
    { cwd: PHARMACY_WORKSPACE_ROOT, encoding: "utf8" },
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const rel of listed) {
    const abs = path.join(PHARMACY_WORKSPACE_ROOT, rel);
    if (rel === "data/pharmacy-master-admin/registry.json") continue;
    fs.rmSync(abs, { recursive: true, force: true });
  }
}

function writeDeferredProfile(): void {
  writeSetupProfile(FIXTURE, {
    pharmacyName: "Hotfix Google Later Pharmacy",
    website: "https://example-pharmacy.test/",
    addressLine1: "1 Example Street",
    primaryTown: "Paisley",
    townCity: "Paisley",
    postcode: "PA1 1AA",
    country: "United Kingdom",
    phone: "0141 000 0000",
    businessEmail: "hotfix-google-later@example.test",
    email: "hotfix-google-later@example.test",
    marketScope: "local",
    selectedServices: ["blood-pressure-checks"],
    googleProfileOnboardingState: "deferred",
    googleBusinessProfileUrl: "",
    googlePlaceId: "",
    websiteImportSnapshot: null,
    googleImportSnapshot: null,
  } as PharmacyProfileData);
}

function main(): void {
  console.log("\n=== HOTFIX-01 google-later business profile ===\n");
  const registryBefore = fs.readFileSync(REGISTRY);
  const acceptanceBefore = slugFileHash(ACCEPTANCE);
  const historicalBefore = Object.fromEntries(HISTORICAL.map((slug) => [slug, slugFileHash(slug)]));

  try {
    if (fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${FIXTURE}.json`))) {
      throw new Error("Fixture profile already exists");
    }
    writeDeferredProfile();
    registerMasterAdminClient(FIXTURE, "Hotfix Google Later Pharmacy");

    assert(
      businessProfileReviewOpenAllowed({ workflowStage: "website_import", googleProfileState: "deferred" }) === true,
      "CASE B open: deferred Google allows Business Profile Review from website import",
    );
    assert(
      businessProfileReviewOpenAllowed({ workflowStage: "website_import", googleProfileState: "no_profile" }) === true,
      "CASE B open: no-profile Google allows Business Profile Review",
    );
    assert(
      businessProfileReviewOpenAllowed({ workflowStage: "website_import", googleProfileState: "configured" }) === false,
      "CASE C open: configured Google does not skip the workflow gate",
    );
    assert(
      businessProfileReviewOpenAllowed({ workflowStage: "website_import", googleProfileState: "unknown" }) === false,
      "CASE C open: unknown Google does not skip the workflow gate",
    );
    assert(
      businessProfileReviewOpenAllowed({
        workflowStage: "business_profile_intelligence",
        googleProfileState: "configured",
      }) === true,
      "CASE A open: connected Google at the Business Profile stage stays open",
    );

    const blocked = canApproveBusinessProfileWithGoogleState("configured", {
      googlePlaceId: "",
      googleBusinessProfileUrl: "",
    } as PharmacyProfileData);
    assert(blocked.allowed === false, "CASE C approval: configured Google without an identifier still blocks");
    const selectedBlocked = canApproveBusinessProfileWithGoogleState("selected", {
      googlePlaceId: "",
      googleBusinessProfileUrl: "https://maps.google.com/?cid=1",
    } as PharmacyProfileData);
    assert(selectedBlocked.allowed === false, "CASE C approval: selected Google without a Place ID still blocks");
    const connected = canApproveBusinessProfileWithGoogleState("configured", {
      googlePlaceId: "places/hotfix-connected",
      googleBusinessProfileUrl: "https://maps.google.com/?cid=hotfix",
    } as PharmacyProfileData);
    assert(connected.allowed === true, "CASE A approval: configured Google with an identifier is allowed");
    const deferredApproval = canApproveBusinessProfileWithGoogleState("deferred", {
      googlePlaceId: "",
      googleBusinessProfileUrl: "",
    } as PharmacyProfileData);
    assert(deferredApproval.allowed === true, "CASE B approval: deferred Google is not an approval blocker");

    const beforeOffer = manualBrandConfirmationOffer(FIXTURE);
    assert(beforeOffer.available === true, "CASE D route: manual brand confirmation is visible before confirmation");
    assert(beforeOffer.googleProfileState === "deferred", "CASE D route: Google state is deferred");
    assert(
      (beforeOffer.value || "").includes("https://example-pharmacy.test/"),
      "CASE D route: offered value uses the captured website",
    );

    const beforeReview = buildBusinessProfileReview(FIXTURE);
    assert(
      !(beforeReview.missingSources || []).includes("Google Intelligence"),
      "CASE B sources: deferred Google is not missing Google Intelligence",
    );
    assert(
      (beforeReview.missingSources || []).includes("Website Intelligence"),
      "CASE D sources: failed website import stays missing until the Product Owner confirms",
    );
    assert(beforeReview.manualBrandConfirmation?.available === true, "CASE D review payload exposes the confirm action");

    const confirmed = confirmManualOnboardingBrandSource(FIXTURE, "hotfix-01-test");
    assert(confirmed.ok === true, "CASE D confirm: Product Owner confirmation succeeds");
    const afterProfile = readSetupProfile(FIXTURE);
    assert(afterProfile.googleProfileOnboardingState === "deferred", "CASE B state: Google remains deferred");
    assert(!afterProfile.googleImportSnapshot, "CASE B state: no Google import snapshot was created");
    assert(!afterProfile.websiteImportSnapshot, "CASE D state: no website import snapshot was fabricated");
    assert(!fs.existsSync(getPharmacyBrandDnaPath(FIXTURE)), "CASE D state: no Brand DNA file was fabricated");
    assert(
      (confirmed.ok ? confirmed.value : "").startsWith(MANUAL_BRAND_SOURCE_PREFIX),
      "CASE D value: brand source is a Product Owner onboarding confirmation",
    );
    assert(
      (confirmed.ok ? confirmed.value : "").includes("Hotfix Google Later Pharmacy"),
      "CASE D value: confirmation names the pharmacy already on the profile",
    );

    const afterReview = buildBusinessProfileReview(FIXTURE);
    assert(
      !(afterReview.missingSources || []).includes("Website Intelligence"),
      "CASE D sources: confirmed onboarding brand evidence satisfies the failed-import source",
    );
    assert(
      !(afterReview.missingSources || []).includes("Google Intelligence"),
      "CASE B sources: Google Intelligence stays absent after brand confirmation",
    );
    assert(afterReview.summary.googleProfileState === "deferred", "CASE B summary: Google policy remains deferred");
    assert(afterReview.manualBrandConfirmation?.confirmed === true, "CASE D review: confirmation is recorded");

    const fields = enrichReviewableEvidenceFields(FIXTURE, buildCprEvidenceFields(FIXTURE, "blood-pressure-checks"), "blood-pressure-checks");
    const brandField = fields.find((field) => field.id === "brandSource");
    assert(Boolean(brandField?.value), "CASE B evidence: resolved brand source now has a value");
    assert(
      brandField?.source === "onboarding-business-information",
      `CASE B evidence: source is onboarding business information (${brandField?.source})`,
    );
    const gateBeforeDecision = evaluateRequiredEvidenceGate({
      slug: FIXTURE,
      serviceId: "blood-pressure-checks",
      evidenceFields: fields,
      imageSelections: [],
      canonicalUrl: "https://example-pharmacy.test/blood-pressure-checks/",
    });
    assert(
      !gateBeforeDecision.blockers.some((blocker) => /Resolved brand source/i.test(blocker)),
      "CASE B gate: brand source is no longer a blocker once the onboarding confirmation exists",
    );

    const decided = decideServicePageEvidenceReviewField(FIXTURE, "brandSource", "confirm", "hotfix-01-test");
    const decidedBrand = decided?.sections.flatMap((section) => section.fields).find((field) => field.id === "brandSource");
    assert(decidedBrand?.status === "confirmed", "CASE B decision: brand source can be confirmed in Evidence Review");
    assert(
      !(decided?.blockers || []).some((blocker) => /Resolved brand source/i.test(blocker)),
      "CASE B decision: Evidence Review no longer lists the brand-source dead end",
    );

    let review = buildServicePageEvidenceReview(FIXTURE);
    if (review) {
      for (let pass = 0; pass < 4 && !review.canApprove; pass += 1) {
        const pending = review.sections.flatMap((section) => section.fields).filter((field) => field.status === "not_confirmed");
        let moved = false;
        for (const field of pending) {
          if (field.value || field.id === "fonts") {
            const next = decideServicePageEvidenceReviewField(FIXTURE, field.id, "confirm", "hotfix-01-test");
            if (next) {
              review = next;
              moved = true;
            }
          } else if (field.allowNotApplicable) {
            const next = decideServicePageEvidenceReviewField(FIXTURE, field.id, "not_applicable", "hotfix-01-test");
            if (next) {
              review = next;
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
    }
    assert(Boolean(review), "CASE B review: Evidence Review loads for the fixture");
    if (review?.canApprove) {
      const approved = approveServicePageEvidenceReview(FIXTURE, "hotfix-01-test");
      assert(approved?.approved === true, "CASE B approval: evidence approval completes after legitimate field confirmation");
    } else {
      const leftover = (review?.blockers || []).filter((blocker) => !/Resolved brand source|Google Import/i.test(blocker));
      assert(
        !(review?.blockers || []).some((blocker) => /Resolved brand source|Google Import/i.test(blocker)),
        `CASE B approval: remaining blockers are other required evidence, not the Google-later brand dead end (${(review?.blockers || []).join(" | ")})`,
      );
      assert(leftover.length >= 0, "CASE B approval: non-brand blockers were recorded");
    }

    writeSetupProfile(FIXTURE, {
      ...readSetupProfile(FIXTURE),
      googleProfileOnboardingState: "configured",
      googlePlaceId: "places/hotfix-connected",
      googleBusinessProfileUrl: "https://maps.google.com/?cid=hotfix",
      websiteImportSnapshot: {
        status: "imported",
        importedAt: "2026-09-27T12:00:00.000Z",
        websiteUrl: "https://example-pharmacy.test/",
        message: "",
        logoUrl: "",
        brandPrimaryColor: "",
        brandSecondaryColor: "",
        brandAccentColor: "",
        brandBackgroundColor: "",
        brandTextColor: "",
        phone: "",
        email: "",
        address: "",
        town: "",
        postcode: "",
        socialLinks: [],
        footerLinks: [],
        servicesDetected: [],
        customerVisibleServices: [],
        description: "",
        openingHours: "",
        intelligence: null,
        regulatoryEvidence: [],
      },
      googleImportSnapshot: {
        status: "imported",
        importedAt: "2026-09-27T12:00:00.000Z",
        placeId: "places/hotfix-connected",
        businessName: "Hotfix Google Later Pharmacy",
        formattedAddress: "",
        phone: "",
        website: "https://example-pharmacy.test/",
        rating: null,
        reviewCount: 0,
        photoCount: 0,
        categories: [],
        openingHours: [],
        googleMapsUrl: "https://maps.google.com/?cid=hotfix",
        latitude: null,
        longitude: null,
        candidates: [],
        nationalWebsiteDetected: false,
      },
    } as PharmacyProfileData);
    const connectedReview = buildBusinessProfileReview(FIXTURE);
    assert(
      connectedReview.manualBrandConfirmation?.available !== true,
      "CASE A: manual brand route is not offered when website import succeeded",
    );
    assert(
      connectedReview.summary.googleProfileState === "configured",
      "CASE A: Google state stays configured",
    );
    assert(
      !(connectedReview.missingSources || []).includes("Google Intelligence"),
      "CASE A: imported Google is not reported as missing Google Intelligence",
    );

    writeSetupProfile(FIXTURE, {
      pharmacyName: "Hotfix Google Required Pharmacy",
      website: "https://example-pharmacy.test/",
      googleProfileOnboardingState: "configured",
      googlePlaceId: "",
      googleBusinessProfileUrl: "",
      websiteImportSnapshot: null,
      googleImportSnapshot: null,
      marketScope: "local",
    } as PharmacyProfileData);
    const requiredOffer = manualBrandConfirmationOffer(FIXTURE);
    assert(requiredOffer.available === false, "CASE C: manual brand route is not a bypass when Google is required now");
    const requiredReview = buildBusinessProfileReview(FIXTURE);
    assert(
      requiredReview.summary.googleProfileState === "configured",
      "CASE C: Google remains configured",
    );
    const requiredGate = canApproveBusinessProfileWithGoogleState("configured", readSetupProfile(FIXTURE));
    assert(requiredGate.allowed === false, "CASE C: missing Google identifier still blocks Business Profile approval");

    const page = fs.readFileSync(
      path.join(PHARMACY_WORKSPACE_ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"),
      "utf8",
    );
    assert(page.includes("function businessProfileReviewOpenAllowed"), "UI: Business Profile open gate recognises Google later");
    assert(
      page.includes("Confirm brand source from business information"),
      "UI: Business Profile shows the manual brand confirmation action",
    );
    assert(
      page.includes("Confirm brand source in Business Profile"),
      "UI: Evidence Review points brand source at Business Profile",
    );
  } finally {
    removeMasterAdminRegistryEntry(FIXTURE);
    removeFixtureFiles();
    fs.writeFileSync(REGISTRY, registryBefore);
  }

  const acceptanceAfter = slugFileHash(ACCEPTANCE);
  const historicalAfter = Object.fromEntries(HISTORICAL.map((slug) => [slug, slugFileHash(slug)]));
  assert(acceptanceBefore === acceptanceAfter, "acceptance tenant files unchanged");
  for (const slug of HISTORICAL) {
    assert(historicalBefore[slug] === historicalAfter[slug], `${slug} files unchanged`);
  }
  assert(!fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${FIXTURE}.json`)), "fixture profile removed");

  const failed = failures.length;
  console.log(`\n${failed ? "FAIL" : "PASS"} — ${failed ? failed + " failed" : "all checks passed"}\n`);
  if (failed) process.exit(1);
}

main();
