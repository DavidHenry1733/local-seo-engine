#!/usr/bin/env npx tsx
/**
 * Competitor Analysis execution stays on its own stage.
 * Fixture tenants only. Does not call a live provider or Gilbert's workflow.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pc-ca-"));
process.env.WORKSPACE_ROOT = tmp;
process.env.GOOGLE_PLACES_API_KEY = "";

interface Check { id: string; pass: boolean }
const checks: Check[] = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function writeJson(rel: string, value: unknown) {
  const file = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function extractFunction(src: string, name: string): string {
  const start = src.indexOf(`async function ${name}`);
  const alt = start >= 0 ? start : src.indexOf(`function ${name}`);
  if (alt < 0) return "";
  const exportAt = src.lastIndexOf("export ", alt);
  const from = exportAt >= 0 && alt - exportAt < 40 ? exportAt : alt;
  let depth = 0;
  let started = false;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") { depth++; started = true; }
    else if (ch === "}") {
      depth--;
      if (started && depth === 0) return src.slice(from, i + 1);
    }
  }
  return "";
}

async function main() {
  console.log("\n=== COMPETITOR ANALYSIS EXECUTION 01 ===\n");
  fs.mkdirSync(path.join(tmp, "data/pharmacy-profiles"), { recursive: true });
  fs.cpSync(path.join(ROOT, "config/pharmacy"), path.join(tmp, "config/pharmacy"), { recursive: true });
  const { writeSetupProfile } = await import("../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts");
  const { currentBusinessProfileContentHash } = await import("../src/pharmacy/masterAdminBusinessProfileReviewService.ts");
  const { resolveWorkflowStage, verifyStageCompletion } = await import("../src/pharmacy/masterAdminWorkflowStageExecutor.ts");
  const { loadMasterAdminCustomerContext } = await import("../src/pharmacy/masterAdminCustomerContextService.ts");
  const { runWorkflowPreflight, continueCustomerWorkflow } = await import("../src/pharmacy/masterAdminWorkflowOrchestrator.ts");

  const slugs = {
    approved: "ca-approved-pharmacy",
    unapproved: "ca-unapproved-pharmacy",
    early: "ca-early-pharmacy",
    stored: "ca-stored-pharmacy",
    empty: "ca-empty-pharmacy",
    cpr: "ca-cpr-pharmacy",
    second: "ca-second-pharmacy",
  };

  function profile(name: string, imported: boolean) {
    return {
      pharmacyName: name,
      website: "https://example-pharmacy.test",
      phone: "0141 111 1111",
      email: "owner@example-pharmacy.test",
      businessEmail: "owner@example-pharmacy.test",
      postcode: "PA2 7EP",
      addressLine1: "4 Blackford Road",
      displayAddress: "4 Blackford Road",
      townCity: "Paisley",
      primaryTown: "Paisley",
      country: "United Kingdom",
      marketScope: "local",
      primaryMarket: "Paisley",
      googlePlaceId: "ChIJExample",
      googleProfileOnboardingState: "configured",
      customerSetupGoogleMatchStatus: "confirmed",
      platformClientStatus: imported ? "profile_approved" : "onboarding",
      selectedServices: ["pharmacy-first"],
      websiteImportSnapshot: imported
        ? {
            status: "imported",
            importedAt: "2026-09-28T09:00:00.000Z",
            message: "Website intelligence imported.",
            websiteUrl: "https://example-pharmacy.test/contact-us",
            intelligence: {
              structure: { pages: [{ url: "https://example-pharmacy.test/", path: "/", title: "Home" }] },
              business: { addressCandidates: [] },
            },
          }
        : undefined,
      websiteBranchResolution: imported
        ? {
            status: "branch_selection_required",
            detectedAt: "2026-09-28T09:00:00.000Z",
            selectedAt: null,
            selectedBy: null,
            parentBrand: { tradingName: "", parentWebsite: "", logoUrl: "", brandPrimaryColor: "", brandSecondaryColor: "", brandAccentColor: "" },
            detectedBranches: [
              { branchId: "a", branchName: name, parentBrandName: name, addressLine1: "4 Blackford Road", addressLine2: "", town: "Paisley", postcode: "PA2 7EP", phone: "0141 111 1111", email: "", branchUrl: "", logoUrl: "", openingHours: "", services: [], googlePlaceId: null, googleBusinessName: null, googleAddress: null, googleMatchConfidence: null, evidenceSources: [], detectionSignals: [] },
              { branchId: "b", branchName: name, parentBrandName: name, addressLine1: "4 Blackford Rd", addressLine2: "", town: "Paisley", postcode: "PA2 7EP", phone: "0141 111 1111", email: "", branchUrl: "", logoUrl: "", openingHours: "", services: [], googlePlaceId: null, googleBusinessName: null, googleAddress: null, googleMatchConfidence: null, evidenceSources: [], detectionSignals: [] },
            ],
            selectedBranchId: null,
            selectedBranch: null,
            rawImportPreserved: true,
            googleBranchMatchStatus: "pending",
            googleBranchMatchNotes: [],
          }
        : undefined,
      googleImportSnapshot: imported
        ? { status: "imported", importedAt: "2026-09-28T09:10:00.000Z", businessName: name, placeId: "ChIJExample" }
        : undefined,
    };
  }

  for (const slug of Object.values(slugs)) {
    writeSetupProfile(slug, profile(slug, slug !== slugs.early) as never);
  }
  writeJson("data/pharmacy-master-admin/registry.json", {
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
  });

  function approve(slug: string) {
    const hash = currentBusinessProfileContentHash(slug);
    writeJson(`data/pharmacy-master-admin/business-profile-approvals/${slug}/latest.json`, {
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
    });
  }
  for (const slug of [slugs.approved, slugs.stored, slugs.empty, slugs.cpr, slugs.second]) approve(slug);

  function competitors(slug: string, rows: unknown[]) {
    writeJson(`data/pharmacy-competitor-intelligence/${slug}-intelligence.json`, {
      slug,
      generatedAt: "2026-09-28T12:30:00.000Z",
      source: "google-places-live",
      competitors: rows,
    });
  }
  competitors(slugs.stored, [{ name: "Other Pharmacy", placeId: "other-place", rating: 4, reviewCount: 12 }]);
  competitors(slugs.cpr, [{ name: "Other Pharmacy", placeId: "other-place", rating: 4, reviewCount: 12 }]);
  competitors(slugs.second, [{ name: "Other Pharmacy", placeId: "other-place", rating: 4, reviewCount: 12 }]);
  competitors(slugs.empty, []);
  writeJson(`data/growth-engine/${slugs.cpr}-competitors.json`, {
    version: 3,
    slug: slugs.cpr,
    generatedAt: "2026-09-28T13:00:00.000Z",
    source: "google-places-live",
    competitors: [{ name: "Other Pharmacy", placeId: "other-place" }],
  });
  writeJson(`data/growth-engine/${slugs.cpr}-opportunities.json`, {
    version: 1,
    slug: slugs.cpr,
    generatedAt: "2026-09-28T13:10:00.000Z",
    opportunities: [{ id: "gap", title: "Review gap" }],
  });
  writeJson(`data/pharmacy-master-admin/core-product-recovery/${slugs.cpr}/contract.json`, {
    version: 1,
    slug: slugs.cpr,
    mode: "cpr01_service_page_only",
    enabled: true,
    servicePageGenerated: false,
  });

  function stage(slug: string) {
    const ctx = loadMasterAdminCustomerContext(slug);
    return ctx ? resolveWorkflowStage(ctx) : "missing";
  }
  function complete(slug: string, id: "competitor_analysis" | "local_market_intelligence" | "generate_growth_intelligence") {
    const ctx = loadMasterAdminCustomerContext(slug);
    return ctx ? verifyStageCompletion(id, ctx) : false;
  }

  const approvedPre = runWorkflowPreflight(slugs.approved);
  record("1-approved-can-execute", stage(slugs.approved) === "competitor_analysis" && approvedPre.ok && approvedPre.actionId === "orchestrate_competitor_analysis", `${stage(slugs.approved)} / ${approvedPre.actionId}`);
  const unapprovedPre = runWorkflowPreflight(slugs.unapproved);
  record("2-unapproved-blocked", stage(slugs.unapproved) !== "competitor_analysis" && unapprovedPre.actionId !== "orchestrate_competitor_analysis", `${stage(slugs.unapproved)} / ${unapprovedPre.actionId}`);
  const wrong = await continueCustomerWorkflow(slugs.early, "product-owner", { actionId: "orchestrate_competitor_analysis" });
  record("3-wrong-stage-blocked", wrong.ok === false && wrong.actionId !== "orchestrate_competitor_analysis", wrong.error || wrong.evidence || "");
  const workflowSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts"), "utf8");
  const actionSrc = extractFunction(workflowSrc, "runCompetitorAnalysisWorkflowAction");
  const page = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  const route = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/masterAdminPlatform.ts"), "utf8");
  record(
    "4-authenticated-executor",
    actionSrc.includes("runCompetitorIntelligencePipeline") &&
      route.includes("continueCustomerWorkflowWithOnboardingBatch") &&
      page.includes("withAuthHandoff(") &&
      page.includes("'/continue-workflow'"),
    "canonical executor behind continue-workflow",
  );
  record("5-valid-result-completes-competitor", complete(slugs.stored, "competitor_analysis") && stage(slugs.stored) === "local_market_intelligence", stage(slugs.stored));
  record("6-empty-result-not-complete", complete(slugs.empty, "competitor_analysis") === false && stage(slugs.empty) === "competitor_analysis", stage(slugs.empty));
  record(
    "7-provider-failure-does-not-complete",
    actionSrc.includes('ok: result.combinedStatus === "completed"') && !complete(slugs.empty, "competitor_analysis"),
    "only completed status succeeds",
  );
  record("8-timeout-does-not-complete", actionSrc.includes("catch (err)") && stage(slugs.approved) === "competitor_analysis", "no artifact remains at competitor analysis");
  writeJson(`data/pharmacy-competitor-intelligence/${slugs.empty}-intelligence.json`, { slug: slugs.empty, generatedAt: "not-a-date", competitors: "bad" });
  record("9-malformed-not-complete", complete(slugs.empty, "competitor_analysis") === false, "malformed competitors");
  writeJson(`data/pharmacy-competitor-intelligence/${slugs.empty}-intelligence.json`, { slug: slugs.empty, competitors: [] });
  record("10-partial-not-complete", complete(slugs.empty, "competitor_analysis") === false && stage(slugs.empty) === "competitor_analysis", stage(slugs.empty));
  record("11-tenant-isolation", stage(slugs.approved) === "competitor_analysis" && stage(slugs.stored) === "local_market_intelligence", "separate fixtures");
  const secondPre = runWorkflowPreflight(slugs.second);
  record("12-second-pharmacy", complete(slugs.second, "competitor_analysis") && secondPre.stageId === stage(slugs.second), `${stage(slugs.second)} / ${secondPre.actionId}`);
  record("13-no-gilbert", !actionSrc.includes("gilbert") && !extractFunction(fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminWorkflowStageExecutor.ts"), "utf8"), "resolveWorkflowStage").includes("gilbert"), "generic");
  const storedPre = runWorkflowPreflight(slugs.stored);
  record("14-local-market-after-competitor", stage(slugs.stored) === "local_market_intelligence" && storedPre.actionId === "orchestrate_local_market_intelligence", storedPre.actionId || "");
  const giBlocked = await continueCustomerWorkflow(slugs.approved, "product-owner", { actionId: "orchestrate_growth_intelligence" });
  record("15-growth-blocked", giBlocked.ok === false, giBlocked.error || "");
  record(
    "16-auth-ui-remain",
      page.includes("function canonicalIntelligenceWorkflowAction") &&
      page.includes("withAuthHandoff(") &&
      page.includes("finished.status==='failed'") &&
      !page.includes("'Growth Intelligence job completed'"),
    "panel and failure toast remain",
  );
  const cprPre = runWorkflowPreflight(slugs.cpr);
  record(
    "17-cpr-does-not-jump-to-blocked-ecosystem",
    stage(slugs.cpr) !== "generate_ecosystem" && cprPre.reason !== "Open Evidence Review and approve evidence before generating the service page",
    `${stage(slugs.cpr)} / ${cprPre.reason || cprPre.actionId}`,
  );
  record(
    "18-competitor-action-does-not-derive-later-stages",
    !actionSrc.includes("ensureCommercialIntelligenceDerivedFromStoredCompetitors"),
    "later stages stay on their own actions",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
  fs.rmSync(tmp, { recursive: true, force: true });
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
