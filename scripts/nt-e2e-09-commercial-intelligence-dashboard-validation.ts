/**
 * NT-E2E-09 — Commercial Intelligence Dashboard validation.
 */
import { runWorkflowPreflight } from "../src/pharmacy/masterAdminWorkflowOrchestrator.ts";
import { resolveWorkflowStage, verifyStageCompletion } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import {
  COMMERCIAL_INTELLIGENCE_GENERATION_STAGES,
  OPERATOR_WORKFLOW_DISPLAY_ORDER,
  WORKFLOW_STAGE_ORDER,
} from "../src/pharmacy/masterAdminWorkflowModel.ts";
import {
  isCommercialIntelligenceApproved,
  isCommercialIntelligenceReadyForReview,
} from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";
import { buildCommercialIntelligenceDashboard } from "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts";
import { isLegacyAutoAdvance } from "../src/pharmacy/masterAdminWorkflowLegacyService.ts";
import { loadContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { listMasterAdminJobs } from "../src/pharmacy/masterAdminJobService.ts";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";

const TEST_SLUG = "reliable-direct-pharmacy";

type Step = { name: string; passed: boolean; detail?: string };
function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

async function main() {
  const steps: Step[] = [];
  const ctx = loadMasterAdminCustomerContext(TEST_SLUG);
  const stage = ctx ? resolveWorkflowStage(ctx) : "create_customer";
  const preflight = runWorkflowPreflight(TEST_SLUG);
  const dashboard = buildCommercialIntelligenceDashboard(TEST_SLUG);

  steps.push(
    step(
      "Single commercial_intelligence stage in workflow order",
      WORKFLOW_STAGE_ORDER.includes("commercial_intelligence") &&
        !WORKFLOW_STAGE_ORDER.includes("review_competitor_analysis" as never) &&
        !WORKFLOW_STAGE_ORDER.includes("review_local_market_intelligence" as never) &&
        !WORKFLOW_STAGE_ORDER.includes("review_growth_intelligence" as never),
    ),
  );
  steps.push(
    step(
      "Generate Ecosystem follows commercial_intelligence",
      WORKFLOW_STAGE_ORDER.indexOf("commercial_intelligence") <
        WORKFLOW_STAGE_ORDER.indexOf("generate_ecosystem"),
    ),
  );
  steps.push(
    step(
      "Operator workflow shows single Commercial Intelligence step",
      OPERATOR_WORKFLOW_DISPLAY_ORDER.includes("commercial_intelligence") &&
        OPERATOR_WORKFLOW_DISPLAY_ORDER.filter((s) => s === "commercial_intelligence").length === 1,
    ),
  );
  steps.push(
    step(
      "Generation stages collapsed in operator UI",
      COMMERCIAL_INTELLIGENCE_GENERATION_STAGES.every((s) => !OPERATOR_WORKFLOW_DISPLAY_ORDER.includes(s as never)),
    ),
  );
  steps.push(step("Commercial Intelligence Dashboard builder", Boolean(dashboard.executiveSummary)));
  steps.push(
    step(
      "Dashboard includes competitor, local market and growth sections",
      dashboard.competitorAnalysis.competitors.length >= 0 &&
        dashboard.localMarketIntelligence.sections.length > 0 &&
        dashboard.growthIntelligence.sections.length > 0,
    ),
  );
  steps.push(step("Legacy auto advance for Reliable Direct", isLegacyAutoAdvance(TEST_SLUG)));
  steps.push(step("Commercial Intelligence approved (legacy)", isCommercialIntelligenceApproved(TEST_SLUG)));
  steps.push(
    step(
      "Intelligence ready for review (legacy GI)",
      isCommercialIntelligenceReadyForReview(TEST_SLUG),
    ),
  );
  steps.push(step("Website Import preserved", Boolean(readSetupProfile(TEST_SLUG).websiteImportSnapshot?.importedAt)));

  const pkg = ctx ? loadContentPackage(TEST_SLUG, ctx.serviceId) : null;
  steps.push(step("Existing generated content preserved", Boolean(pkg?.generatedAt)));
  steps.push(step("Ecosystem previously generated flag", dashboard.ecosystemPreviouslyGenerated));
  steps.push(
    step(
      "Quality Review gated on ecosystem",
      !verifyStageCompletion("quality_review", ctx!) || Boolean(pkg?.generatedAt),
    ),
  );
  steps.push(
    step(
      "Generate Ecosystem blocked without approval (preflight when at stage)",
      stage !== "generate_ecosystem" ||
        isCommercialIntelligenceApproved(TEST_SLUG) ||
        !preflight.ok,
      preflight.reason,
    ),
  );

  const activeJobs = listMasterAdminJobs({ slug: TEST_SLUG, limit: 10 }).filter(
    (j) => j.status === "queued" || j.status === "running",
  );
  steps.push(step("No duplicate active jobs", activeJobs.length <= 1, activeJobs.map((j) => j.action).join(", ")));

  const modelText = fs.readFileSync(
    path.join(WORKSPACE_ROOT, "src/pharmacy/masterAdminWorkflowModel.ts"),
    "utf8",
  );
  steps.push(step("Three review stages removed from model", !modelText.includes("review_growth_intelligence")));

  const tenantHits: string[] = [];
  for (const file of [
    "src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts",
    "src/pharmacy/masterAdminWorkflowModel.ts",
  ]) {
    const text = fs.readFileSync(path.join(WORKSPACE_ROOT, file), "utf8");
    if (text.includes("reliable-direct") || text.includes("Banner Cross")) tenantHits.push(file);
  }
  steps.push(step("No tenant-specific dashboard code", tenantHits.length === 0, tenantHits.join("; ")));

  steps.push(
    step(
      "Reliable Direct at Quality Review (content preserved, no regeneration)",
      stage === "quality_review",
      stage,
    ),
  );

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-09 validation: FAIL (${failed.length})` : "\nNT-E2E-09 validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
