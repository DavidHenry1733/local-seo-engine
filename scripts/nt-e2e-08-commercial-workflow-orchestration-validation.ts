import { runWorkflowPreflight } from "../src/pharmacy/masterAdminWorkflowOrchestrator.ts";
import { resolveWorkflowStage, verifyStageCompletion } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { WORKFLOW_STAGE_ORDER, STAGE_EXECUTION_ACTION, LONG_RUNNING_STAGE_ACTIONS } from "../src/pharmacy/masterAdminWorkflowModel.ts";
import {
  isCompetitorAnalysisApproved,
  isGrowthIntelligenceApproved,
  isLocalMarketIntelligenceApproved,
} from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";
import { isLegacyAutoAdvance } from "../src/pharmacy/masterAdminWorkflowLegacyService.ts";
import { loadContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
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

  steps.push(step("Commercial intelligence stages in workflow order", WORKFLOW_STAGE_ORDER.includes("competitor_analysis") && WORKFLOW_STAGE_ORDER.includes("review_growth_intelligence")));
  steps.push(step("Generate Ecosystem follows Growth Intelligence review", WORKFLOW_STAGE_ORDER.indexOf("review_growth_intelligence") < WORKFLOW_STAGE_ORDER.indexOf("generate_ecosystem")));
  steps.push(step("No auto-ack on GI generation path", !fs.readFileSync(path.join(WORKSPACE_ROOT, "src/pharmacy/masterAdminGrowthIntelligenceWorkflowService.ts"), "utf8").includes('writeWorkflowAcknowledgement(slug, "growth-intelligence"')));
  steps.push(step("Legacy auto advance for Reliable Direct", isLegacyAutoAdvance(TEST_SLUG)));
  steps.push(step("Growth Intelligence approved (legacy)", isGrowthIntelligenceApproved(TEST_SLUG)));
  steps.push(step("Competitor Analysis approved (legacy)", isCompetitorAnalysisApproved(TEST_SLUG)));
  steps.push(step("Local Market approved (legacy)", isLocalMarketIntelligenceApproved(TEST_SLUG)));
  steps.push(step("Website Import preserved", Boolean(readSetupProfile(TEST_SLUG).websiteImportSnapshot?.importedAt)));

  const pkg = ctx ? loadContentPackage(TEST_SLUG, ctx.serviceId) : null;
  steps.push(step("Existing generated content preserved", Boolean(pkg?.generatedAt)));
  steps.push(step("Quality Review gated on ecosystem", !verifyStageCompletion("quality_review", ctx!) || Boolean(pkg?.generatedAt)));

  steps.push(step("Generate Ecosystem not in GI stage action", STAGE_EXECUTION_ACTION.generate_growth_intelligence === "orchestrate_growth_intelligence"));
  steps.push(step("GI not long-running auto-skip to ecosystem alone", LONG_RUNNING_STAGE_ACTIONS.has("orchestrate_growth_intelligence")));

  const tenantHits: string[] = [];
  for (const file of [
    "src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts",
    "src/pharmacy/masterAdminWorkflowModel.ts",
  ]) {
    const text = fs.readFileSync(path.join(WORKSPACE_ROOT, file), "utf8");
    if (text.includes("reliable-direct") || text.includes("Banner Cross")) tenantHits.push(file);
  }
  steps.push(step("No tenant-specific workflow code", tenantHits.length === 0, tenantHits.join("; ")));

  steps.push(step("Current stage at Quality Review (legacy preserved)", stage === "quality_review", stage));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-08 validation: FAIL (${failed.length})` : "\nNT-E2E-08 validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
