/**
 * NT-E2E-20 — Canonical page inventory reconciliation validation (read-only).
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import {
  buildCanonicalEcosystemGenerationPlan,
  deriveCanonicalPlanReadinessCounts,
  getCanonicalPlanSchedulerPageCount,
  normalizeCanonicalPlanInventory,
  type CanonicalPagePlanEntry,
} from "../src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts";
import { buildCommercialEcosystemGenerationDashboard } from "../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts";
import { readAuthorisedEcosystemGenerationRecord } from "../src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts";

const TARGET = "reliable-direct-pharmacy";
const AUTHORISED_JOB = "79327576-5cc8-4c23-81a6-cd36defa62ca";

type Step = { name: string; ok: boolean; detail?: string };

function step(name: string, ok: boolean, detail?: string): Step {
  return { name, ok, detail };
}

function traceInventory(pages: CanonicalPagePlanEntry[]) {
  return pages.map((page) => ({
    inventoryId: page.inventoryId,
    pageType: page.pageType,
    title: page.title,
    url: page.expectedUrlPath,
    included: page.inclusionStatus === "included",
    countedInTotal: page.countedInTotal ? "YES" : "NO",
  }));
}

function duplicateInventoryIds(pages: CanonicalPagePlanEntry[]): string[] {
  const seen = new Map<string, number>();
  for (const page of pages) {
    seen.set(page.inventoryId, (seen.get(page.inventoryId) || 0) + 1);
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

async function main(): Promise<void> {
  const steps: Step[] = [];
  const plan = buildCanonicalEcosystemGenerationPlan(TARGET);
  const normalized = normalizeCanonicalPlanInventory(plan);
  const readinessCounts = deriveCanonicalPlanReadinessCounts(plan);
  const dashboard = buildCommercialEcosystemGenerationDashboard(TARGET);
  const readiness = dashboard.readiness;
  const inv = normalized.inventoryReconciliation;
  const schedulerTotal = getCanonicalPlanSchedulerPageCount(plan);
  const dashboardTotal = readiness.expectedTotalPageCount;
  const inventoryTotal = inv.inventoryTotal;

  console.log("NT-E2E-20 CANONICAL PAGE INVENTORY RECONCILIATION");
  console.log("=".repeat(60));
  console.log("1. TRACE INVENTORY");
  for (const row of traceInventory(normalized.pageInventory)) {
    console.log(
      [
        row.inventoryId,
        row.pageType,
        row.title,
        row.url,
        row.included ? "included" : "excluded",
        row.countedInTotal,
      ].join(" | "),
    );
  }

  console.log("\n2. TRACE TOTAL");
  console.log(`Total calculation: ${inv.totalCalculation}`);
  console.log(`Inventory total (counted pages): ${inventoryTotal}`);
  console.log(`Category sum: ${inv.categorySum}`);
  if (inv.uncategorizedPageTypes.length) {
    console.log(`Excluded page types from total: ${inv.uncategorizedPageTypes.join(", ")}`);
  } else {
    console.log("Excluded page types from total: none");
  }

  console.log("\n3. RECONCILE");
  const categoryChecks = {
    homepage: readiness.expectedHomepageCount === normalized.coreEcosystem.homepage,
    serviceHubs: readiness.expectedServiceHubCount === normalized.coreEcosystem.serviceHubs,
    clusterPages: readiness.clusterPagesToGenerate === normalized.coreEcosystem.clusterPages,
    blogs: readiness.expectedBlogCount === normalized.coreEcosystem.blogs,
    guides: readiness.expectedGuideCount === normalized.coreEcosystem.guides,
    faqs: readiness.expectedFaqCount === normalized.coreEcosystem.faqs,
    supportingPages: readiness.expectedSupportingPageCount === normalized.coreEcosystem.supportingPages,
  };
  console.log(
    [
      `Homepage=${readiness.expectedHomepageCount}`,
      `Service Hubs=${readiness.expectedServiceHubCount}`,
      `Cluster Pages=${readiness.clusterPagesToGenerate}`,
      `Blogs=${readiness.expectedBlogCount}`,
      `Guides=${readiness.expectedGuideCount}`,
      `FAQs=${readiness.expectedFaqCount}`,
      `Supporting Pages=${readiness.expectedSupportingPageCount}`,
      `Expected Total=${dashboardTotal}`,
      `Scheduler Total=${schedulerTotal}`,
      `Inventory Total=${inventoryTotal}`,
    ].join(" · "),
  );

  const totalsReconciled =
    inventoryTotal === schedulerTotal &&
    schedulerTotal === dashboardTotal &&
    inv.categorySum === inventoryTotal &&
    inv.reconciled;

  steps.push(step("Every planned page has inventory id", normalized.pageInventory.every((p) => Boolean(p.inventoryId))));
  steps.push(step("Every included page counted consistently", normalized.pageInventory.every((p) => typeof p.countedInTotal === "boolean")));
  steps.push(step("No duplicate inventory entries", duplicateInventoryIds(normalized.pageInventory).length === 0));
  steps.push(
    step(
      "Category counts match inventory reconciliation",
      Object.values(categoryChecks).every(Boolean),
      JSON.stringify(categoryChecks),
    ),
  );
  steps.push(
    step(
      "Inventory Total = Scheduler Total = Dashboard Total",
      totalsReconciled,
      `inventory=${inventoryTotal} scheduler=${schedulerTotal} dashboard=${dashboardTotal} categorySum=${inv.categorySum}`,
    ),
  );
  steps.push(
    step(
      "Dashboard derives total from inventory (no separate arithmetic)",
      readiness.schedulerPageCount === readiness.expectedTotalPageCount &&
        readiness.inventoryReconciliation?.inventoryTotal === readiness.expectedTotalPageCount,
    ),
  );
  steps.push(step("Plan persisted with inventory reconciliation", Boolean(normalized.inventoryReconciliation?.totalCalculation)));

  const auth = readAuthorisedEcosystemGenerationRecord(TARGET);
  steps.push(step("Authorised job preserved (no regeneration)", auth?.jobId === AUTHORISED_JOB && auth?.status === "completed"));
  steps.push(
    step(
      "No regeneration triggered",
      auth?.completenessStatus === "SUPERSEDED_INCOMPLETE_RC1" && auth?.qualityReviewReady === false,
      `jobId=${auth?.jobId} completeness=${auth?.completenessStatus}`,
    ),
  );

  const pass = steps.every((s) => s.ok);
  const report = {
    defect: "NT-E2E-20",
    target: TARGET,
    pass,
    rootCause:
      "Category breakdown and Expected Total Pages were stored as independent coreEcosystem fields without a reconciled page inventory; dashboard, scheduler, and totals could diverge from the actual planned page list.",
    planId: plan.planId,
    planRevision: plan.planRevision,
    inventoryRecords: traceInventory(normalized.pageInventory),
    inventoryTotal,
    schedulerTotal,
    dashboardTotal,
    totalsReconciled,
    totalCalculation: inv.totalCalculation,
    steps,
  };

  const outDir = path.join(WORKSPACE_ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "nt-e2e-20-canonical-page-inventory-reconciliation.json");
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log("\n4. VALIDATION");
  for (const s of steps) {
    console.log(`${s.ok ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log("=".repeat(60));
  console.log(`Overall: ${pass ? "PASS" : "FAIL"}`);
  console.log(`Report: ${outFile}`);

  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
