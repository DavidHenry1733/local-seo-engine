/**
 * NT-E2E-32B — Fast-load customer workflow validation.
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { buildMasterAdminDashboardLite } from "../src/pharmacy/masterAdminDashboardLiteService.ts";
import { buildMasterAdminCustomerRecordLite } from "../src/pharmacy/masterAdminCustomerRecordLiteService.ts";
import { buildMasterAdminCustomerWorkflowSummary } from "../src/pharmacy/masterAdminCustomerWorkflowSummaryService.ts";

const SLUG = "reliable-direct-pharmacy";
const ROOT = path.resolve(import.meta.dirname, "..");
const PAGE_SRC = path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts");

async function main() {
  const dashStart = performance.now();
  buildMasterAdminDashboardLite();
  const dashboardMs = performance.now() - dashStart;

  const customerStart = performance.now();
  const customer = buildMasterAdminCustomerRecordLite(SLUG);
  const customerMs = performance.now() - customerStart;

  const summaryStart = performance.now();
  const summary = buildMasterAdminCustomerWorkflowSummary(SLUG);
  const summaryMs = performance.now() - summaryStart;

  const pageSrc = fs.readFileSync(PAGE_SRC, "utf8");
  const parseOk = !pageSrc.includes("loadCustomerDetailSections(slug,loadSeq)");
  const loadingWorkflow = pageSrc.includes("Loading workflow…");
  const workflowSummaryRoute = fs.existsSync(
    path.join(ROOT, "artifacts/api-server/src/routes/api/masterAdminPlatform.ts"),
  )
    ? fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/masterAdminPlatform.ts"), "utf8").includes(
        "/workflow-summary",
      )
    : false;

  const report = {
    sprint: "NT-E2E-32B",
    slug: SLUG,
    validatedAt: new Date().toISOString(),
    timings: {
      dashboardMs: Math.round(dashboardMs),
      customerMs: Math.round(customerMs),
      workflowSummaryMs: Math.round(summaryMs),
    },
    summary: {
      currentStage: summary?.currentStage,
      nextAction: summary?.nextAction,
      canonicalInventory: summary?.canonicalPlan?.inventoryCount,
      imagePlatform: summary?.imagePlatform,
      commercialIntelligence: summary?.commercialIntelligence?.approvalStatus || summary?.commercialIntelligence?.status,
    },
    checks: {
      dashboardUnder2s: dashboardMs < 2000,
      customerUnder5s: customerMs < 5000,
      summaryUnder2s: summaryMs < 2000,
      persistedSummaryBuilder: Boolean(summary),
      noAutoDetailSections: parseOk,
      loadingWorkflowText: loadingWorkflow,
      workflowSummaryRoute,
      customerLoaded: Boolean(customer),
    },
  };

  const outDir = path.join(ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "nt-e2e-32b-customer-workflow-fast-load.json");
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
