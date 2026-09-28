/**
 * Imported Evidence Review exposes one explicit accept action.
 * Imports do not accept evidence by themselves.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyServiceLibraryService.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { writeSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import {
  acceptImportedEvidenceReview,
  buildImportedEvidenceReview,
} from "../src/pharmacy/masterAdminImportedEvidenceReviewService.ts";

const failures: string[] = [];
const SLUGS = [
  "ier-accept-ready",
  "ier-accept-branch",
  "ier-accept-failed",
  "ier-accept-isolation",
  "ier-accept-approved",
  "ier-accept-other",
];

function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
  console.log(`${condition ? "PASS" : "FAIL"}  ${message}`);
}

function shaFile(rel: string): string {
  const file = path.join(WORKSPACE_ROOT, rel);
  if (!fs.existsSync(file)) return "ABSENT";
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function intelligence(safe: boolean) {
  return {
    version: 2,
    importedAt: "2026-09-28T00:00:00.000Z",
    identity: { title: "Example Pharmacy", websiteUrl: "https://example-pharmacy.test", resolvedUrl: "https://example-pharmacy.test/" },
    business: {
      businessName: { selected: "Example Pharmacy", confidence: 90, candidates: [], evidence: null },
      phone: { selected: "0141 111 1111", confidence: 90, candidates: [], evidence: null },
      email: { selected: "", confidence: 0, candidates: [], evidence: null },
      address: { selected: "1 High Street", confidence: 90, candidates: [], evidence: null },
      town: { selected: "Exampleford", confidence: 90, candidates: [], evidence: null },
      postcode: { selected: "PA1 1AA", confidence: 90, candidates: [], evidence: null },
      openingHours: { selected: "", confidence: 0, candidates: [], evidence: null },
    },
    structure: {
      totalPages: 2,
      pages: [{ url: "https://example-pharmacy.test/", path: "/", title: "Home", category: "homepage" }],
    },
    evidenceQuality: {
      technicallyComplete: true,
      safeForBusinessProfileReview: safe,
      blockers: safe ? [] : ["Evidence is not safe"],
      warnings: [],
      contentPagesAnalysed: 2,
      sitemapDocumentsExcluded: 0,
      assessedAt: "2026-09-28T00:00:00.000Z",
    },
  };
}

function writeReady(slug: string, extra: Record<string, unknown> = {}, safe = true): void {
  writeSetupProfile(slug, normalizeProfileData({
    pharmacyName: "Example Pharmacy",
    website: "https://example-pharmacy.test",
    googleProfileOnboardingState: "configured",
    websiteImportSnapshot: {
      status: "imported",
      importedAt: "2026-09-28T00:00:00.000Z",
      message: "Website Intelligence imported.",
      websiteUrl: "https://example-pharmacy.test",
      intelligence: intelligence(safe),
    },
    googleImportSnapshot: {
      status: "imported",
      importedAt: "2026-09-28T00:00:00.000Z",
      businessName: "Example Pharmacy",
      address: "1 High Street",
      postcode: "PA1 1AA",
      phone: "0141 111 1111",
      website: "https://example-pharmacy.test",
      placeId: "ChIJExample",
    },
    ...extra,
  }));
}

function cleanup(): void {
  for (const slug of SLUGS) {
    for (const rel of [
      `data/pharmacy-profiles/${slug}.json`,
      `data/growth-engine/${slug}-workflow.json`,
    ]) {
      const file = path.join(WORKSPACE_ROOT, rel);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}

function main(): void {
  const gilbertRel = "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json";
  const before = shaFile(gilbertRel);
  cleanup();

  writeReady("ier-accept-ready");
  const ready = buildImportedEvidenceReview("ier-accept-ready");
  assert(ready.acceptance.ready === true && ready.acceptance.accepted === false, "1. complete safe evidence is ready and not auto-accepted");
  assert(ready.acceptance.actionLabel === "Accept Imported Evidence", "1. approval action is visible");
  assert(ready.acceptance.businessProfileReviewAvailable === false, "1. Business Profile Review stays unavailable before acceptance");

  writeReady("ier-accept-branch", {
    websiteBranchResolution: {
      status: "branch_selection_required",
      detectedAt: "2026-09-28T00:00:00.000Z",
      detectedBranches: [
        { branchId: "a", branchName: "Example Pharmacy", addressLine1: "1 High Street", town: "Exampleford", postcode: "PA1 1AA", phone: "0141 111 1111" },
        { branchId: "b", branchName: "Example Pharmacy", addressLine1: "9 Other Road", town: "Otherford", postcode: "PA9 9ZZ", phone: "0141 222 2222" },
      ],
    },
  });
  const branch = buildImportedEvidenceReview("ier-accept-branch");
  assert(branch.branchSelection?.requiresSelection === true, "2. unresolved branch still requires selection");
  assert(branch.acceptance.ready === false && branch.acceptance.actionId == null, "2. approval is unavailable while branch selection is open");

  writeSetupProfile("ier-accept-failed", normalizeProfileData({
    pharmacyName: "Example Pharmacy",
    website: "https://example-pharmacy.test",
    googleProfileOnboardingState: "configured",
    websiteImportSnapshot: {
      status: "not_found",
      importedAt: "2026-09-28T00:00:00.000Z",
      message: "Website import incomplete. Could not fetch https://example-pharmacy.test: Request timed out",
      websiteUrl: "https://example-pharmacy.test",
      intelligence: null,
    },
    googleImportSnapshot: {
      status: "imported",
      importedAt: "2026-09-28T00:00:00.000Z",
      businessName: "Example Pharmacy",
      placeId: "ChIJExample",
    },
  }));
  const failed = buildImportedEvidenceReview("ier-accept-failed");
  assert(failed.websiteImported === false && failed.acceptance.ready === false, "3. failed website import hides approval");
  let failedAccept = false;
  try { acceptImportedEvidenceReview("ier-accept-failed", "tester"); } catch { failedAccept = true; }
  assert(failedAccept, "3. failed website import cannot be accepted");

  writeReady("ier-accept-isolation", { pharmacyName: "Brook Pharmacy" });
  const isolated = buildImportedEvidenceReview("ier-accept-isolation");
  assert(isolated.tenantIsolation.passed === false && isolated.acceptance.ready === false, "4. tenant isolation failure hides approval");

  writeReady("ier-accept-approved");
  const accepted = acceptImportedEvidenceReview("ier-accept-approved", "product-owner");
  assert(accepted.accepted === true && accepted.businessProfileReviewAvailable === true, "5. explicit approval makes Business Profile Review available");
  assert(buildImportedEvidenceReview("ier-accept-approved").acceptance.decidedBy === "product-owner", "5. acceptance records the Product Owner");

  writeReady("ier-accept-other");
  const other = buildImportedEvidenceReview("ier-accept-other");
  assert(other.acceptance.accepted === false && other.acceptance.businessProfileReviewAvailable === false, "6. approval does not transfer to another pharmacy");
  const otherAccepted = acceptImportedEvidenceReview("ier-accept-other", "product-owner");
  assert(otherAccepted.accepted === true, "7. a second pharmacy uses the same accept action");
  assert(buildImportedEvidenceReview("ier-accept-approved").acceptance.accepted === true, "6. the first pharmacy acceptance remains its own");

  const gilbert = buildImportedEvidenceReview("gilbert-pharmacy-health-clinic");
  assert(gilbert.acceptance.ready === true && gilbert.acceptance.actionLabel === "Accept Imported Evidence", "Gilbert approval action is ready");
  assert(gilbert.acceptance.accepted === false, "Gilbert is not auto-accepted");
  assert(shaFile(gilbertRel) === before, "Gilbert profile bytes are unchanged");

  cleanup();
  if (failures.length) {
    console.log(`FAILED ${failures.length}`);
    process.exit(1);
  }
  console.log("ALL PASS");
}

main();
