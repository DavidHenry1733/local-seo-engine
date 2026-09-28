#!/usr/bin/env npx tsx
/**
 * Local Market Intelligence is a real stage between Business Profile approval and Growth Intelligence.
 * Fixture tenants only. Does not run Local Market Intelligence or Growth Intelligence for a live tenant.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pc-lmi-"));
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

async function main() {
  console.log("\n=== LOCAL MARKET WORKFLOW 01 ===\n");
  fs.mkdirSync(path.join(tmp, "data/pharmacy-profiles"), { recursive: true });
  fs.cpSync(path.join(ROOT, "config/pharmacy"), path.join(tmp, "config/pharmacy"), { recursive: true });
  const { writeSetupProfile } = await import("../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts");
  const { currentBusinessProfileContentHash } = await import("../src/pharmacy/masterAdminBusinessProfileReviewService.ts");
  const { resolveWorkflowStage, verifyStageCompletion, isCurrentLocalMarketIntelligence } = await import("../src/pharmacy/masterAdminWorkflowStageExecutor.ts");
  const { loadMasterAdminCustomerContext } = await import("../src/pharmacy/masterAdminCustomerContextService.ts");
  const { runWorkflowPreflight, continueCustomerWorkflow } = await import("../src/pharmacy/masterAdminWorkflowOrchestrator.ts");

  const slugs = {
    open: "lmi-open-pharmacy",
    competitor: "lmi-competitor-pharmacy",
    ready: "lmi-ready-pharmacy",
    failed: "lmi-failed-pharmacy",
    stale: "lmi-stale-pharmacy",
    second: "lmi-second-pharmacy",
  };

  function profile(name: string) {
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
      platformClientStatus: "profile_approved",
      selectedServices: ["pharmacy-first"],
      websiteImportSnapshot: {
        status: "imported",
        importedAt: "2026-09-28T09:00:00.000Z",
        message: "Website intelligence imported.",
        websiteUrl: "https://example-pharmacy.test/contact-us",
        intelligence: {
          structure: { pages: [{ url: "https://example-pharmacy.test/", path: "/", title: "Home" }] },
          business: { addressCandidates: [] },
        },
      },
      websiteBranchResolution: {
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
      },
      googleImportSnapshot: {
        status: "imported",
        importedAt: "2026-09-28T09:10:00.000Z",
        businessName: name,
        placeId: "ChIJExample",
      },
    };
  }

  for (const [key, slug] of Object.entries(slugs)) {
    writeSetupProfile(slug, profile(key) as never);
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

  function approve(slug: string, approvedAt: string) {
    const hash = currentBusinessProfileContentHash(slug);
    writeJson(`data/pharmacy-master-admin/business-profile-approvals/${slug}/latest.json`, {
      version: 1,
      slug,
      profileRevision: 1,
      profileContentHash: hash,
      approvedAt,
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

  function competitor(slug: string) {
    writeJson(`data/pharmacy-competitor-intelligence/${slug}-intelligence.json`, {
      slug,
      generatedAt: "2026-09-28T12:30:00.000Z",
      competitors: [{ name: "Other Pharmacy", placeId: "other-place" }],
    });
  }

  function snapshot(slug: string, generatedAt: string, analysis: boolean) {
    writeJson(`data/growth-engine/${slug}-competitors.json`, {
      version: 3,
      slug,
      generatedAt,
      source: "google-places-live",
      competitors: analysis ? [{ name: "Other Pharmacy", placeId: "other-place", latitude: 1, longitude: 2 }] : [],
      analysis: analysis ? { summary: "Local market recorded" } : null,
    });
  }

  approve(slugs.competitor, "2026-09-28T12:00:00.000Z");
  approve(slugs.ready, "2026-09-28T12:00:00.000Z");
  approve(slugs.failed, "2026-09-28T12:00:00.000Z");
  approve(slugs.stale, "2026-09-28T15:00:00.000Z");
  approve(slugs.second, "2026-09-28T12:00:00.000Z");
  competitor(slugs.ready);
  competitor(slugs.failed);
  competitor(slugs.stale);
  competitor(slugs.second);
  snapshot(slugs.ready, "2026-09-28T13:00:00.000Z", true);
  snapshot(slugs.failed, "2026-09-28T13:00:00.000Z", false);
  snapshot(slugs.stale, "2026-09-28T12:30:00.000Z", true);
  snapshot(slugs.second, "2026-09-28T13:00:00.000Z", true);

  function stage(slug: string) {
    const ctx = loadMasterAdminCustomerContext(slug);
    return ctx ? resolveWorkflowStage(ctx) : "missing";
  }
  function preflight(slug: string) {
    return runWorkflowPreflight(slug);
  }

  const openStage = stage(slugs.open);
  const openPre = preflight(slugs.open);
  const openBlocked = await continueCustomerWorkflow(slugs.open, "product-owner", { actionId: "orchestrate_local_market_intelligence" });
  record(
    "1-unapproved-cannot-run-local-market",
    openStage !== "local_market_intelligence" &&
      openStage !== "generate_growth_intelligence" &&
      openBlocked.ok === false &&
      !fs.existsSync(path.join(tmp, `data/growth-engine/${slugs.open}-competitors.json`)),
    `${openStage} / ${openPre.actionId} / ${openBlocked.error}`,
  );

  const competitorStage = stage(slugs.competitor);
  const competitorPre = preflight(slugs.competitor);
  record(
    "2-approved-without-local-market",
    competitorStage === "competitor_analysis" &&
      competitorPre.ok === true &&
      competitorPre.actionId === "orchestrate_competitor_analysis",
    `${competitorStage} / ${competitorPre.actionId}`,
  );

  const missingMarket = await continueCustomerWorkflow(slugs.competitor, "product-owner", { actionId: "orchestrate_growth_intelligence" });
  record(
    "3-growth-blocked-until-local-market",
    missingMarket.ok === false &&
      missingMarket.blocked === true &&
      !fs.existsSync(path.join(tmp, `data/growth-engine/${slugs.competitor}-opportunities.json`)),
    missingMarket.error || "ran",
  );

  const readyStage = stage(slugs.ready);
  const readyPre = preflight(slugs.ready);
  const readyCtx = loadMasterAdminCustomerContext(slugs.ready)!;
  record(
    "4-local-market-complete-allows-growth",
    readyStage === "generate_growth_intelligence" &&
      readyPre.ok === true &&
      readyPre.actionId === "orchestrate_growth_intelligence" &&
      verifyStageCompletion("local_market_intelligence", readyCtx),
    `${readyStage} / ${readyPre.actionId}`,
  );

  const failedStage = stage(slugs.failed);
  const failedPre = preflight(slugs.failed);
  record(
    "5-failed-local-market-stays-retry",
    failedStage === "local_market_intelligence" &&
      failedPre.actionId === "orchestrate_local_market_intelligence" &&
      !isCurrentLocalMarketIntelligence(slugs.failed),
    `${failedStage} / ${failedPre.actionId}`,
  );

  record(
    "6-stale-local-market-not-current",
    !isCurrentLocalMarketIntelligence(slugs.stale) && stage(slugs.stale) === "local_market_intelligence",
    stage(slugs.stale),
  );

  record(
    "7-stage-and-gate-agree",
    competitorPre.stageId === competitorStage && readyPre.stageId === readyStage && failedPre.stageId === failedStage,
    `${competitorPre.stageId} ${readyPre.stageId} ${failedPre.stageId}`,
  );

  const executor = fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminWorkflowStageExecutor.ts"), "utf8");
  record(
    "8-no-second-skip",
    !executor.includes('isBusinessProfileReviewApproved(ctx.slug) &&\n      !isGrowthIntelligenceGenerated(ctx.slug)'),
    "approval no longer skips Local Market Intelligence",
  );

  record(
    "9-tenant-isolation",
    stage(slugs.ready) === "generate_growth_intelligence" && stage(slugs.stale) === "local_market_intelligence",
    `${stage(slugs.ready)} vs ${stage(slugs.stale)}`,
  );

  const secondPre = preflight(slugs.second);
  record(
    "10-second-pharmacy-same-path",
    stage(slugs.second) === readyStage && secondPre.actionId === readyPre.actionId,
    `${stage(slugs.second)} / ${secondPre.actionId}`,
  );

  record(
    "11-no-live-tenant",
    !executor.includes("gilbert-pharmacy") && !executor.includes("gilbertpharmacy"),
    "generic",
  );

  const page = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  record(
    "12-auth-handoff-remains",
    page.includes("withAuthHandoff('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/continue-workflow')"),
    "handoff",
  );
  record(
    "12-ui-uses-stage-action",
    page.includes("function canonicalIntelligenceWorkflowAction") &&
      page.includes("competitor_analysis:'orchestrate_competitor_analysis'") &&
      page.includes("local_market_intelligence:'orchestrate_local_market_intelligence'") &&
      page.includes("continueWorkflow(spec.actionId)") &&
      page.includes("renderCanonicalIntelligenceWorkflowAction(c)"),
    "intelligence action follows the stage",
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
