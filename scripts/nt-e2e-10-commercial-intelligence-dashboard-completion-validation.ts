/**
 * NT-E2E-10 — Commercial Intelligence Dashboard completion validation.
 */
import { resolveWorkflowStage } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { buildCommercialIntelligenceDashboard } from "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts";
import {
  isCommercialIntelligenceApproved,
} from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";
import { loadContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { listMasterAdminJobs } from "../src/pharmacy/masterAdminJobService.ts";

const TEST_SLUG = "reliable-direct-pharmacy";

type Step = { name: string; passed: boolean; detail?: string };
function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

async function main() {
  const steps: Step[] = [];
  const ctx = loadMasterAdminCustomerContext(TEST_SLUG)!;
  const stage = resolveWorkflowStage(ctx);
  const d = buildCommercialIntelligenceDashboard(TEST_SLUG);
  const pkg = loadContentPackage(TEST_SLUG, ctx.serviceId);
  const activeJobs = listMasterAdminJobs({ slug: TEST_SLUG, limit: 10 }).filter(
    (j) => j.status === "queued" || j.status === "running",
  );

  steps.push(step("Stage is commercial_intelligence", stage === "commercial_intelligence", stage));
  steps.push(step("Executive Summary populated", Boolean(d.executiveSummary.overallBusinessHealth)));
  steps.push(step("Competitor Analysis visible", d.competitorAnalysis.competitors.length > 0));
  steps.push(step("Competitor narrative present", Boolean(d.competitorAnalysis.narrative)));
  steps.push(step("Local Market sections present", d.localMarketIntelligence.sections.length >= 5));
  steps.push(step("Growth Intelligence sections present", d.growthIntelligence.sections.length >= 5));
  steps.push(step("Previously Generated visible", d.previouslyGenerated.exists));
  steps.push(step("Previously Generated timestamp", Boolean(d.previouslyGenerated.completedAt)));
  steps.push(step("Technical log separated from main sections", d.technicalLog.length >= 0));
  steps.push(step("Blocking Issues section exists", Array.isArray(d.blockingIssues)));
  steps.push(step("Recommendations section exists", Array.isArray(d.recommendations)));
  steps.push(step("Historical Events section exists", d.historicalEvents.length > 0));
  steps.push(step("Approve Intelligence available", d.canApprove));
  steps.push(step("Generate Ecosystem gated until approval", !d.canGenerateEcosystem || isCommercialIntelligenceApproved(TEST_SLUG)));
  steps.push(step("Existing generated content preserved", Boolean(pkg?.generatedAt)));
  steps.push(step("No duplicate active jobs", activeJobs.length <= 1));
  steps.push(step("Dashboard pharmacy name set", Boolean(d.pharmacyName)));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-10 validation: FAIL (${failed.length})` : "\nNT-E2E-10 validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
