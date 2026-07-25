/**
 * RC1 — Cluster Page architecture lock validation (read-only).
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import {
  buildCanonicalEcosystemGenerationPlan,
  RC1_CLUSTER_PAGE_ARCHITECTURE,
} from "../src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts";
import { buildCommercialEcosystemGenerationDashboard } from "../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts";
import { resolveLocalLocationHierarchy } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

const TENANTS = ["reliable-direct-pharmacy", "banner-cross-pharmacy", "pharmaconnect"] as const;

function scanTenantSpecific(): boolean {
  const files = [
    "src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts",
    "src/pharmacy/pharmacyLocalAreaResolver.ts",
    "src/pharmacy/pharmacyLocalLocationGenerationService.ts",
    "src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts",
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

async function main(): Promise<void> {
  const steps: Array<{ name: string; ok: boolean; detail?: string }> = [];
  steps.push({ name: "RC1 cluster page architecture flag", ok: RC1_CLUSTER_PAGE_ARCHITECTURE === true });

  let crossPass = true;
  for (const slug of TENANTS) {
    const plan = buildCanonicalEcosystemGenerationPlan(slug);
    const dashboard = buildCommercialEcosystemGenerationDashboard(slug);
    const ctx = loadMasterAdminCustomerContext(slug);
    const profile = readSetupProfile(slug);
    const hierarchy = resolveLocalLocationHierarchy(slug, ctx?.serviceId || "pharmacy-first", profile as never);
    const approved = plan.coreEcosystem.approvedAreas;
    const clusters = plan.coreEcosystem.clusterPages;
    const hasAreaPageType = plan.pageInventory.some((p) => p.pageType === "location-area" || p.pageType === "location-hub");
    const parity =
      dashboard.readiness.approvedAreaCount === approved &&
      dashboard.readiness.clusterPagesToGenerate === clusters &&
      approved === clusters;
    const onePerArea = clusters === approved;
    const noAreaPagesInHierarchy = hierarchy.areas.length === 0;
    const ok = parity && onePerArea && !hasAreaPageType && noAreaPagesInHierarchy;
    if (!ok) crossPass = false;
    steps.push({
      name: `Tenant ${slug}`,
      ok,
      detail: `areas=${approved} clusters=${clusters} hierarchyAreas=${hierarchy.areas.length}`,
    });
  }

  steps.push({ name: "Cross-tenant validation", ok: crossPass });
  steps.push({ name: "No tenant-specific code", ok: !scanTenantSpecific() });

  const pass = steps.every((s) => s.ok);
  console.log("RC1 CLUSTER PAGE ARCHITECTURE VALIDATION");
  for (const s of steps) console.log(`${s.ok ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  console.log(`Overall: ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
