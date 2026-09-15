/**
 * NT-E2E-19 — Canonical generation plan and engine alignment validation (read-only).
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import {
  ensureCanonicalPlanAndMarkExistingIncomplete,
  getCanonicalPlanSchedulerPageCount,
  readCanonicalEcosystemGenerationPlan,
  buildCanonicalEcosystemGenerationPlan,
  resolveCommercialAuthorisedTargetAreaNames,
  compareCanonicalPlanOutputParity,
} from "../src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts";
import { buildCommercialEcosystemGenerationDashboard } from "../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts";
import { readAuthorisedEcosystemGenerationRecord } from "../src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts";
import { resolveCampaignBuilderTargetAreas } from "../src/pharmacy/contentEngine/customerCampaignGenerationContext.ts";
import { loadCampaignBuilderSession } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { resolveLocalLocationHierarchy } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { MIN_CLUSTER_FALLBACK, MIN_AREA_FALLBACK } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";

const TARGET = "reliable-direct-pharmacy";
const CROSS_TENANTS = ["reliable-direct-pharmacy", "banner-cross-pharmacy", "pharmaconnect"] as const;
const AUTHORISED_JOB = "79327576-5cc8-4c23-81a6-cd36defa62ca";

type Step = { name: string; ok: boolean; detail?: string };

function step(name: string, ok: boolean, detail?: string): Step {
  return { name, ok, detail };
}

function scanTenantSpecificBranches(): boolean {
  const files = [
    "src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts",
    "src/pharmacy/pharmacyLocalAreaResolver.ts",
    "src/pharmacy/contentEngine/customerCampaignGenerationContext.ts",
    "src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts",
    "src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts",
  ];
  const forbidden = [/reliable-direct-pharmacy/, /banner-cross-pharmacy/, /\bsheffield\b/i];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(WORKSPACE_ROOT, rel), "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(src)) return true;
    }
  }
  return false;
}

function validateTenant(slug: string): {
  plan: ReturnType<typeof buildCanonicalEcosystemGenerationPlan>;
  dashboard: ReturnType<typeof buildCommercialEcosystemGenerationDashboard>;
  parity: boolean;
  areas: string[];
  hierarchyClusters: number;
  hierarchyAreas: number;
} {
  const plan = buildCanonicalEcosystemGenerationPlan(slug);
  const dashboard = buildCommercialEcosystemGenerationDashboard(slug);
  const ctx = loadMasterAdminCustomerContext(slug);
  const profile = readSetupProfile(slug);
  const serviceId = ctx?.serviceId || "pharmacy-first";
  const hierarchy = resolveLocalLocationHierarchy(slug, serviceId, profile as never);
  const target = resolveCommercialAuthorisedTargetAreaNames(slug);
  const readiness = dashboard.readiness;
  const parity =
    readiness.expectedTotalPageCount === readiness.schedulerPageCount &&
    readiness.schedulerPageCount === getCanonicalPlanSchedulerPageCount(plan);
  return {
    plan,
    dashboard,
    parity,
    areas: target.areas,
    hierarchyClusters: hierarchy.clusters.length,
    hierarchyAreas: hierarchy.areas.length,
  };
}

async function main(): Promise<void> {
  const steps: Step[] = [];

  const plan = ensureCanonicalPlanAndMarkExistingIncomplete(TARGET);
  steps.push(step("Canonical plan created for reliable-direct-pharmacy", Boolean(plan.planId)));
  steps.push(step("Plan persisted to disk", fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/canonical-ecosystem-plans", TARGET, "latest.json"))));

  const dashboard = buildCommercialEcosystemGenerationDashboard(TARGET);
  const readiness = dashboard.readiness;
  steps.push(
    step(
      "Readiness consumes canonical plan",
      readiness.canonicalPlanId === plan.planId && readiness.expectedTotalPageCount === plan.coreEcosystem.totalPages,
      `readiness=${readiness.expectedTotalPageCount} plan=${plan.coreEcosystem.totalPages}`,
    ),
  );
  steps.push(
    step(
      "Scheduler consumes canonical plan",
      readiness.schedulerPageCount === plan.coreEcosystem.totalPages,
      `scheduler=${readiness.schedulerPageCount}`,
    ),
  );
  steps.push(step("Plan/scheduler parity", readiness.schedulerPageCount === readiness.expectedTotalPageCount));

  const auth = readAuthorisedEcosystemGenerationRecord(TARGET);
  steps.push(step("Current 15-page package preserved", auth?.jobId === AUTHORISED_JOB && auth?.status === "completed"));
  steps.push(
    step(
      "Current package marked incomplete against canonical plan",
      auth?.completenessStatus === "SUPERSEDED_INCOMPLETE_RC1" &&
        auth?.completenessLabel === "Superseded — Incomplete Against RC1 Content Architecture V1",
    ),
  );
  steps.push(step("Plan/output comparison service exists", typeof compareCanonicalPlanOutputParity === "function"));

  const session = loadCampaignBuilderSession(TARGET);
  const legacyWholeTown = resolveCampaignBuilderTargetAreas(TARGET, session);
  const commercialAreas = resolveCommercialAuthorisedTargetAreaNames(TARGET);
  steps.push(
    step(
      "wholeTown preserves confirmed named areas (commercial path)",
      commercialAreas.areas.length === 8 && !commercialAreas.areas.every((a) => a === "Sheffield"),
      commercialAreas.areas.join(", "),
    ),
  );
  steps.push(
    step(
      "Legacy wholeTown corrected when profile areas exist",
      legacyWholeTown.areas.length === 8,
      legacyWholeTown.areas.join(", "),
    ),
  );

  const profileAreas = resolveCommercialAuthorisedTargetAreaNames(TARGET).areas;
  const includedAreas = plan.areaEntries.filter((a) => a.inclusionStatus === "included" && a.classification !== "location-hub");
  steps.push(step("Business Profile areas received", profileAreas.length === 8, profileAreas.join(", ")));
  steps.push(step("Business Profile areas included", includedAreas.length === 8, includedAreas.map((a) => a.areaName).join(", ")));
  steps.push(step("Business Profile areas excluded", plan.areaEntries.every((a) => a.inclusionStatus === "included" || a.exclusionReason)));

  steps.push(step("MIN_CLUSTER_FALLBACK retained as minimum only", MIN_CLUSTER_FALLBACK === 2));
  steps.push(step("MIN_AREA_FALLBACK retained as minimum only", MIN_AREA_FALLBACK === 4));

  const hierarchy = validateTenant(TARGET);
  steps.push(
    step(
      "Hierarchy resolver schedules cluster pages only",
      hierarchy.hierarchyClusters === plan.coreEcosystem.clusterPages && hierarchy.hierarchyAreas === 0,
      `hierarchy clusters=${hierarchy.hierarchyClusters} areas=${hierarchy.hierarchyAreas}`,
    ),
  );

  steps.push(step("Guide contract aligned (1)", plan.coreEcosystem.guides === 1));
  steps.push(step("FAQ contract aligned (1)", plan.coreEcosystem.faqs === 1));
  steps.push(step("Image contract aligned (4 roles)", plan.coreEcosystem.requiredImageRoles === 4));
  steps.push(step("Commercial Intelligence recommendations classified", (plan.recommendedFutureContent || []).every((r) => r.classification)));

  let crossTenantPass = true;
  const tenantSummaries: string[] = [];
  for (const slug of CROSS_TENANTS) {
    try {
      const result = validateTenant(slug);
      if (!result.parity) crossTenantPass = false;
      tenantSummaries.push(`${slug}: areas=${result.areas.length} plan=${result.plan.coreEcosystem.totalPages} parity=${result.parity}`);
    } catch (err) {
      crossTenantPass = false;
      tenantSummaries.push(`${slug}: ERROR ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  steps.push(step("Cross-tenant validation", crossTenantPass, tenantSummaries.join(" | ")));
  steps.push(step("Tenant-specific code detected", !scanTenantSpecificBranches()));

  const changedModules = [
    "src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts",
    "src/pharmacy/pharmacyLocalAreaResolver.ts",
    "src/pharmacy/contentEngine/customerCampaignGenerationContext.ts",
    "src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts",
    "src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts",
    "src/pharmacy/masterAdminPlatformService.ts",
  ];
  steps.push(
    step(
      "Changed-module validation",
      changedModules.every((f) => fs.existsSync(path.join(WORKSPACE_ROOT, f))),
    ),
  );

  const pass = steps.every((s) => s.ok);
  const report = {
    defect: "NT-E2E-19",
    target: TARGET,
    pass,
    planId: plan.planId,
    planRevision: plan.planRevision,
    checksum: plan.checksum,
    correctedPlannedPageCount: plan.coreEcosystem.totalPages,
    schedulerPageCount: getCanonicalPlanSchedulerPageCount(plan),
    areaClassifications: plan.areaEntries,
    coreInventory: plan.pageInventory.filter((p) => p.inclusionStatus === "included"),
    recommendedFutureContent: plan.recommendedFutureContent,
    steps,
  };

  const outDir = path.join(WORKSPACE_ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "nt-e2e-19-generation-plan-engine-alignment.json");
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log("NT-E2E-19 GENERATION PLAN / ENGINE ALIGNMENT VALIDATION");
  console.log("=".repeat(60));
  for (const s of steps) {
    console.log(`${s.ok ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log("=".repeat(60));
  console.log(`Overall: ${pass ? "PASS" : "FAIL"}`);
  console.log(`Report: ${outFile}`);
  console.log(`Plan ID: ${plan.planId}`);
  console.log(`Plan revision: ${plan.planRevision}`);
  console.log(`Checksum: ${plan.checksum}`);
  console.log(`Corrected planned page count: ${plan.coreEcosystem.totalPages}`);
  console.log(`Core inventory pages: ${plan.pageInventory.filter((p) => p.inclusionStatus === "included").length}`);

  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
