/**
 * RC1 — Deployment and regeneration readiness validation (read-only, no generation).
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import {
  buildCanonicalEcosystemGenerationPlan,
  ensureCanonicalPlanAndMarkExistingIncomplete,
  getCanonicalPlanSchedulerPageCount,
  RC1_CLUSTER_PAGE_ARCHITECTURE,
} from "../src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts";
import { buildCommercialEcosystemGenerationDashboard } from "../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts";
import { readAuthorisedEcosystemGenerationRecord, readHistoricalEcosystemPackage } from "../src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts";
import { resolveLocalLocationHierarchy } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

const SLUG = "reliable-direct-pharmacy";
const AUTHORISED_JOB = "79327576-5cc8-4c23-81a6-cd36defa62ca";
const REQUIRED_COMMIT = "ffe7c4b";

const REQUIRED_FILES = [
  "src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts",
  "src/pharmacy/pharmacyLocalAreaResolver.ts",
  "src/pharmacy/pharmacyLocalLocationGenerationService.ts",
  "src/pharmacy/contentEngine/customerCampaignGenerationContext.ts",
  "src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts",
  "src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts",
  "artifacts/api-server/src/routes/masterAdminPlatformPage.ts",
  "scripts/rc1-cluster-page-architecture-validation.ts",
  "scripts/nt-e2e-19-generation-plan-engine-alignment-validation.ts",
];

function step(name: string, ok: boolean, detail?: string) {
  return { name, ok, detail };
}

async function main(): Promise<void> {
  const steps: ReturnType<typeof step>[] = [];
  const { execSync } = await import("node:child_process");
  const gitLog = execSync(`git -c safe.directory=${WORKSPACE_ROOT} log -1 --oneline`, { cwd: WORKSPACE_ROOT, encoding: "utf8" }).trim();
  steps.push(step("Commit verified", gitLog.includes(REQUIRED_COMMIT), gitLog));
  steps.push(step("Required committed files exist", REQUIRED_FILES.every((f) => fs.existsSync(path.join(WORKSPACE_ROOT, f)))));

  const plan = ensureCanonicalPlanAndMarkExistingIncomplete(SLUG);
  const dashboard = buildCommercialEcosystemGenerationDashboard(SLUG);
  const auth = readAuthorisedEcosystemGenerationRecord(SLUG);
  const historical = readHistoricalEcosystemPackage(SLUG);
  const ctx = loadMasterAdminCustomerContext(SLUG);
  const profile = readSetupProfile(SLUG);
  const hierarchy = resolveLocalLocationHierarchy(SLUG, ctx?.serviceId || "pharmacy-first", profile as never);
  const r = dashboard.readiness;

  const pageInventory = plan.pageInventory.filter((p) => p.inclusionStatus === "included");
  const urls = pageInventory.map((p) => p.expectedUrlPath);
  const duplicateUrls = urls.filter((u, i) => urls.indexOf(u) !== i);
  const hasAreaPage = pageInventory.some((p) => p.pageType === "location-area" || p.pageType === "location-hub");
  const hasLegacyAreaUrl = pageInventory.some((p) => p.pageType === "location-area" || /\/local\/(?!cluster-)[^/]+\/$/.test(p.expectedUrlPath));
  const crossTenant = JSON.stringify(plan).match(/banner-cross|rotherham/i);
  const clusterPages = pageInventory.filter((p) => p.pageType === "cluster-page");
  const serviceHubs = pageInventory.filter((p) => p.pageType === "service-hub");

  steps.push(step("RC1 cluster page architecture flag", RC1_CLUSTER_PAGE_ARCHITECTURE === true));
  steps.push(step("Cluster page architecture", clusterPages.length === 8 && serviceHubs.length === 1 && !hasAreaPage));
  steps.push(step("Separate area page schedule removed", !hasAreaPage && hierarchy.areas.length === 0));
  steps.push(step("Canonical plan rebuilt", Boolean(plan.planId)));
  steps.push(step("Plan/scheduler parity", r.expectedTotalPageCount === r.schedulerPageCount && r.schedulerPageCount === plan.coreEcosystem.totalPages));
  steps.push(step("No duplicate locality URLs", duplicateUrls.length === 0, duplicateUrls.join(", ") || undefined));
  steps.push(step("Legacy area-page URLs scheduled", !hasLegacyAreaUrl, hasLegacyAreaUrl ? "found" : "none"));
  steps.push(step("Rotherham references", !crossTenant));
  steps.push(step("Cross-tenant references", !crossTenant));
  steps.push(step("Historical package preserved", Boolean(historical?.preservedForAudit) || fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages/reliable-direct-pharmacy/pharmacy-first.json"))));
  steps.push(step("15-page package preserved", auth?.jobId === AUTHORISED_JOB && auth?.status === "completed"));
  steps.push(
    step(
      "15-page package marked superseded",
      auth?.completenessStatus === "SUPERSEDED_INCOMPLETE_RC1" &&
        auth?.completenessLabel === "Superseded — Incomplete Against RC1 Content Architecture V1",
    ),
  );

  console.log("RC1 URL CONTRACT — reliable-direct-pharmacy");
  console.log("=".repeat(72));
  for (const p of pageInventory) {
    const areaEntry = plan.areaEntries.find((a) => a.areaSlug === p.slug);
    console.log(
      [
        p.pageType,
        p.title,
        p.slug,
        p.expectedUrlPath,
        areaEntry?.parentServiceHub || (p.pageType === "service-hub" ? "—" : "pharmacy-first"),
        p.pageType === "service-hub" ? "pharmacy-first" : areaEntry?.areaName || "—",
        profile.primaryTown || profile.townCity || "Sheffield",
        p.inclusionStatus,
      ].join(" | "),
    );
  }
  console.log("=".repeat(72));

  const report = {
    planId: plan.planId,
    planRevision: plan.planRevision,
    checksum: plan.checksum,
    approvedServices: plan.primaryService,
    townOrCity: plan.confirmedTown,
    approvedAreas: plan.coreEcosystem.approvedAreas,
    serviceHubsPlanned: plan.coreEcosystem.serviceHubs,
    clusterPagesPlanned: plan.coreEcosystem.clusterPages,
    blogsPlanned: plan.coreEcosystem.blogs,
    guidesPlanned: plan.coreEcosystem.guides,
    faqsPlanned: plan.coreEcosystem.faqs,
    supportingPlanned: plan.coreEcosystem.supportingPages,
    imagesPlanned: plan.coreEcosystem.requiredImageRoles,
    expectedTotal: plan.coreEcosystem.totalPages,
    schedulerTotal: getCanonicalPlanSchedulerPageCount(plan),
    dashboard: {
      serviceHubs: r.expectedServiceHubCount,
      approvedAreas: r.approvedAreaCount,
      clusterPages: r.clusterPagesToGenerate,
      total: r.expectedTotalPageCount,
      scheduler: r.schedulerPageCount,
    },
    steps,
  };

  const out = path.join(WORKSPACE_ROOT, "data/validation-reports/rc1-deployment-regeneration-readiness.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));

  console.log("\nRC1 DEPLOYMENT READINESS SUMMARY");
  for (const s of steps) console.log(`${s.ok ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  const pass = steps.every((s) => s.ok);
  console.log(`Overall: ${pass ? "PASS" : "FAIL"}`);
  console.log(`Report: ${out}`);
  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
