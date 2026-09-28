#!/usr/bin/env npx tsx
/**
 * Business Profile approval continues into Growth Intelligence.
 * Uses the production workflow and branch readers. Writes only under a temp workspace.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STALE = "Multiple pharmacy branches detected — select the branch being onboarded.";
const checks: Array<{ id: string; pass: boolean }> = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function shaFile(rel: string): string {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return "ABSENT";
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function branch(id: string, name: string, street: string, postcode: string) {
  return {
    branchId: id,
    branchName: name,
    parentBrandName: name,
    addressLine1: street,
    addressLine2: "",
    town: "Paisley",
    postcode,
    phone: "0141 111 1111",
    email: "",
    branchUrl: "",
    logoUrl: "",
    openingHours: "",
    services: [],
    googlePlaceId: null,
    googleBusinessName: null,
    googleAddress: null,
    googleMatchConfidence: null,
    evidenceSources: [],
    detectionSignals: [],
  };
}

function resolution(branches: ReturnType<typeof branch>[]) {
  return {
    status: "branch_selection_required",
    detectedAt: "2026-09-28T00:00:00.000Z",
    selectedAt: null,
    selectedBy: null,
    parentBrand: {
      tradingName: "",
      parentWebsite: "",
      logoUrl: "",
      brandPrimaryColor: "",
      brandSecondaryColor: "",
      brandAccentColor: "",
    },
    detectedBranches: branches,
    selectedBranchId: null,
    selectedBranch: null,
    rawImportPreserved: true,
    googleBranchMatchStatus: "pending",
    googleBranchMatchNotes: [],
  };
}

function profile(name: string, branches: ReturnType<typeof branch>[]) {
  return {
    pharmacyName: name,
    website: `https://${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.test`,
    phone: "0141 111 1111",
    postcode: branches[0]?.postcode || "",
    addressLine1: branches[0]?.addressLine1 || "",
    displayAddress: branches[0]?.addressLine1 || "",
    googleProfileOnboardingState: "configured",
    customerSetupGoogleMatchStatus: "confirmed",
    platformClientStatus: "profile_approved",
    selectedServices: ["blood-pressure-checks"],
    websiteImportSnapshot: {
      status: "imported",
      importedAt: "2026-09-28T00:00:00.000Z",
      message: STALE,
      websiteUrl: "https://example.test/contact-us",
      intelligence: {
        structure: { pages: [{ url: "https://example.test/", path: "/", title: "Home" }] },
        business: { addressCandidates: [] },
      },
    },
    websiteBranchResolution: resolution(branches),
    googleImportSnapshot: {
      status: "imported",
      importedAt: "2026-09-28T00:00:00.000Z",
      businessName: name,
      placeId: "ChIJExample",
    },
  };
}

async function main() {
  const gilbertProfile = shaFile("data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json");
  const gilbertApproval = shaFile("data/pharmacy-master-admin/business-profile-approvals/gilbert-pharmacy-health-clinic/latest.json");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "profile-intel-transition-"));
  fs.mkdirSync(path.join(tmp, "data/pharmacy-profiles"), { recursive: true });
  fs.cpSync(path.join(ROOT, "config/pharmacy"), path.join(tmp, "config/pharmacy"), { recursive: true });
  process.env.WORKSPACE_ROOT = tmp;
  process.env.GOOGLE_PLACES_API_KEY = "";

  const { writeSetupProfile } = await import("../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts");
  const {
    currentBusinessProfileContentHash,
    isBusinessProfileReviewApproved,
    approveBusinessProfileReview,
    readLatestApprovalSnapshot,
  } = await import("../src/pharmacy/masterAdminBusinessProfileReviewService.ts");
  const { loadMasterAdminCustomerContext } = await import("../src/pharmacy/masterAdminCustomerContextService.ts");
  const { resolveWorkflowStage } = await import("../src/pharmacy/masterAdminWorkflowStageExecutor.ts");
  const { resolveCommercialWorkflowNextAction } = await import("../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts");
  const { resolveCanonicalWebsiteImportWorkflowState } = await import("../src/pharmacy/masterAdminWebsiteImportWorkflowStateService.ts");
  const { buildWebsiteSourceSummary } = await import("../src/pharmacy/masterAdminCanonicalWebsiteService.ts");
  const { isBranchSelectionBlocking } = await import("../src/pharmacy/masterAdminWebsiteBranchSelectionService.ts");

  const one = [
    branch("a", "Example Pharmacy", "4 Blackford Road", "PA2 7EP"),
    branch("b", "Example Pharmacy & Health", "4 Blackford Rd", "PA2 7EP"),
  ];
  const two = [
    branch("a", "North Pharmacy", "1 High Street", "PA1 1AA"),
    branch("b", "South Pharmacy", "9 Low Street", "PA2 2BB"),
  ];

  const slugs = {
    approved: "pi-transition-approved",
    second: "pi-transition-second",
    open: "pi-transition-open",
    branch: "pi-transition-branch",
  };

  writeSetupProfile(slugs.approved, profile("Approved Pharmacy", one) as never);
  writeSetupProfile(slugs.second, profile("Second Pharmacy", one) as never);
  writeSetupProfile(slugs.open, profile("Open Pharmacy", one) as never);
  writeSetupProfile(slugs.branch, profile("Branch Pharmacy", two) as never);

  fs.mkdirSync(path.join(tmp, "data/pharmacy-master-admin/core-product-recovery", slugs.approved), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "data/pharmacy-master-admin/core-product-recovery", slugs.approved, "contract.json"),
    JSON.stringify({
      version: 1,
      slug: slugs.approved,
      mode: "cpr01_service_page_only",
      enabled: true,
      servicePageGenerated: false,
    }),
  );

  function writeApproval(slug: string) {
    const hash = currentBusinessProfileContentHash(slug);
    const snapshot = {
      version: 1,
      slug,
      profileRevision: 1,
      profileContentHash: hash,
      approvedAt: "2026-09-28T12:00:00.000Z",
      approvedBy: "product-owner",
      finalValues: { businessName: slug },
      fields: [],
      websiteEvidenceVersion: null,
      googleEvidenceVersion: null,
      conflictDecisions: {},
      deferredFields: [],
      warnings: [],
      sourceTimestamps: { websiteImportedAt: null, googleImportedAt: null, profileUpdatedAt: null },
    };
    const dir = path.join(tmp, "data/pharmacy-master-admin/business-profile-approvals", slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "latest.json"), JSON.stringify(snapshot, null, 2));
    fs.writeFileSync(path.join(dir, "revision-1.json"), JSON.stringify(snapshot, null, 2));
    return hash;
  }

  const approvedHash = writeApproval(slugs.approved);
  const secondHash = writeApproval(slugs.second);

  fs.mkdirSync(path.join(tmp, "data/pharmacy-master-admin"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "data/pharmacy-master-admin/registry.json"),
    JSON.stringify({
      version: 1,
      updatedAt: "2026-09-28T12:00:00.000Z",
      clients: Object.values(slugs).map((slug) => ({
        slug,
        pharmacyName: slug,
        growthPlanTier: "growth",
        isDemo: false,
        archived: false,
        createdAt: "2026-09-28T12:00:00.000Z",
        updatedAt: "2026-09-28T12:00:00.000Z",
      })),
    }),
  );

  function stageOf(slug: string): string {
    const ctx = loadMasterAdminCustomerContext(slug);
    if (!ctx) return "missing";
    return resolveWorkflowStage(ctx);
  }

  const stored = readLatestApprovalSnapshot(slugs.approved);
  record("1-approval-persists", Boolean(stored?.approvedAt) && isBusinessProfileReviewApproved(slugs.approved), stored?.approvedAt || "missing");
  record("2-approval-binds-hash", stored?.profileContentHash === approvedHash && Boolean(approvedHash), stored?.profileContentHash || "missing");

  const approvedStage = stageOf(slugs.approved);
  const approvedAction = resolveCommercialWorkflowNextAction(slugs.approved, approvedStage);
  record("3-approved-next-stage", approvedStage === "generate_growth_intelligence" && approvedAction === "Generate Growth Intelligence", `${approvedStage} / ${approvedAction}`);

  const openStage = stageOf(slugs.open);
  record("4-unapproved-blocks-intelligence", !isBusinessProfileReviewApproved(slugs.open) && openStage !== "generate_growth_intelligence", openStage);
  const blocked = approveBusinessProfileReview(slugs.open, "product-owner");
  record("4-unapproved-approve-does-not-persist", blocked.ok === false && readLatestApprovalSnapshot(slugs.open) === null, blocked.errors.join("; ") || "persisted");

  const branchState = resolveCanonicalWebsiteImportWorkflowState(slugs.branch);
  const branchSummary = buildWebsiteSourceSummary(slugs.branch);
  record(
    "5-unresolved-branch-blocks",
    isBranchSelectionBlocking(slugs.branch) &&
      stageOf(slugs.branch) !== "generate_growth_intelligence" &&
      !isBusinessProfileReviewApproved(slugs.branch) &&
      branchState.latestEvidence.includes("Multiple pharmacy branches") &&
      String(branchSummary.lastImportMessage || "").includes("Multiple pharmacy branches"),
    `${stageOf(slugs.branch)} / ${branchState.importState} / ${branchState.latestEvidence}`,
  );

  const resolvedState = resolveCanonicalWebsiteImportWorkflowState(slugs.approved);
  const resolvedSummary = buildWebsiteSourceSummary(slugs.approved);
  record(
    "6-resolved-branch-hides-stale-message",
    !isBranchSelectionBlocking(slugs.approved) &&
      resolvedState.importState === "completed" &&
      !resolvedState.latestEvidence.includes("Multiple pharmacy branches") &&
      !String(resolvedSummary.lastImportMessage || "").includes("Multiple pharmacy branches"),
    `${resolvedState.importState} / ${resolvedState.latestEvidence} / ${resolvedSummary.lastImportMessage}`,
  );

  const approvedFile = path.join(tmp, "data/pharmacy-profiles", `${slugs.approved}.json`);
  const approvedDoc = JSON.parse(fs.readFileSync(approvedFile, "utf8")) as { data: { pharmacyName: string } };
  approvedDoc.data.pharmacyName = "Approved Pharmacy Changed";
  fs.writeFileSync(approvedFile, JSON.stringify(approvedDoc));
  const changedStage = stageOf(slugs.approved);
  record(
    "7-changed-profile-invalidates-approval",
    !isBusinessProfileReviewApproved(slugs.approved) && changedStage !== "generate_growth_intelligence",
    changedStage,
  );

  record(
    "8-tenant-isolation",
    isBusinessProfileReviewApproved(slugs.second) &&
      readLatestApprovalSnapshot(slugs.second)?.profileContentHash === secondHash &&
      readLatestApprovalSnapshot(slugs.second)?.slug === slugs.second,
    readLatestApprovalSnapshot(slugs.second)?.slug || "missing",
  );

  const secondStage = stageOf(slugs.second);
  const secondAction = resolveCommercialWorkflowNextAction(slugs.second, secondStage);
  record("9-second-pharmacy-same-transition", secondStage === "generate_growth_intelligence" && secondAction === "Generate Growth Intelligence", `${secondStage} / ${secondAction}`);

  const page = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  record(
    "10-approval-navigates-to-intelligence",
    page.includes("showUnifiedDashboardSection('intelligence')") && page.includes("Generate Growth Intelligence"),
    "page transition",
  );

  record("gilbert-profile-unchanged", shaFile("data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json") === gilbertProfile, "profile bytes");
  record("gilbert-approval-unchanged", shaFile("data/pharmacy-master-admin/business-profile-approvals/gilbert-pharmacy-health-clinic/latest.json") === gilbertApproval, "approval bytes");

  const failed = checks.filter((c) => !c.pass);
  if (failed.length) {
    console.log(`FAILED ${failed.length}/${checks.length}`);
    process.exit(1);
  }
  console.log(`ALL PASS ${checks.length}/${checks.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
