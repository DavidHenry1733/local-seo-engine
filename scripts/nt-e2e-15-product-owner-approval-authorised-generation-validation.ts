/**
 * NT-E2E-15 — Product Owner approval and authorised ecosystem generation validation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildCommercialEcosystemGenerationDashboard,
  assertEcosystemGenerationAllowed,
  resolveCommercialWorkflowNextAction,
} from "../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts";
import {
  isAuthorisedEcosystemGenerated,
  readHistoricalEcosystemPackage,
  HISTORICAL_ACCIDENTAL_JOB_ID,
} from "../src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts";
import { buildCommercialIntelligenceDashboard } from "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts";
import { buildCommercialQualityReview } from "../src/pharmacy/masterAdminCommercialQualityReviewService.ts";
import { isCommercialIntelligenceApproved } from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";
import { resolveWorkflowStage, verifyStageCompletion } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { buildCustomerWorkflowState } from "../src/pharmacy/masterAdminWorkflowEngine.ts";

const SLUG = "reliable-direct-pharmacy";

type Step = { name: string; passed: boolean; detail?: string };
function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

function main() {
  const steps: Step[] = [];
  const page = readFileSync(resolve("artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  const api = readFileSync(resolve("artifacts/api-server/src/routes/api/masterAdminPlatform.ts"), "utf8");
  const orchestrator = readFileSync(resolve("src/pharmacy/masterAdminWorkflowOrchestrator.ts"), "utf8");
  const stageExecutor = readFileSync(resolve("src/pharmacy/masterAdminWorkflowStageExecutor.ts"), "utf8");
  const finalisation = readFileSync(resolve("src/pharmacy/masterAdminWorkflowJobFinalisationService.ts"), "utf8");

  const ctx = loadMasterAdminCustomerContext(SLUG);
  const stage = ctx ? resolveWorkflowStage(ctx) : null;
  const ci = buildCommercialIntelligenceDashboard(SLUG);
  const cge = buildCommercialEcosystemGenerationDashboard(SLUG);
  const historical = readHistoricalEcosystemPackage(SLUG);
  const wf = buildCustomerWorkflowState(SLUG);

  steps.push(step("Authorised service exists", readFileSync(resolve("src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts"), "utf8").includes("beginAuthorisedEcosystemGeneration")));
  steps.push(step("Historical job ID constant", HISTORICAL_ACCIDENTAL_JOB_ID === "4a470616-abbc-484e-85d9-73ee1cd520d7"));
  steps.push(step("Stage completion uses authorised gate", stageExecutor.includes("isAuthorisedEcosystemGenerated")));
  steps.push(step("Job finalisation completes authorised record before verify", /completeAuthorisedEcosystemGeneration[\s\S]*verifyJobOutputEvidence/.test(finalisation)));
  steps.push(step("Orchestrator begins authorised generation on job create", orchestrator.includes("beginAuthorisedEcosystemGeneration")));
  steps.push(step("Confirm endpoint uses confirmAuthorisedEcosystemGeneration", api.includes("confirmAuthorisedEcosystemGeneration")));
  steps.push(step("UI Approve Intelligence action", page.includes("Approve Intelligence") && page.includes("approveCommercialIntelligenceReview")));
  steps.push(step("UI Generate Approved Ecosystem action", page.includes("Generate Approved Ecosystem")));
  steps.push(step("UI historical package warning", page.includes("Historical package exists") || page.includes("Historical Package Exists")));
  steps.push(step("UI generation confirmation dialog", page.includes("first Product Owner-authorised ecosystem")));
  steps.push(step("No Regenerate Ecosystem without explanation", !page.includes("Regenerate Ecosystem")));
  steps.push(step("CI not approved", !isCommercialIntelligenceApproved(SLUG)));
  steps.push(step("Historical package detected", Boolean(historical)));
  steps.push(step("Historical not authorised", historical ? historical.productOwnerAuthorised === false : true));
  steps.push(step("Authorised generation not complete", !isAuthorisedEcosystemGenerated(SLUG)));
  steps.push(step("Historical does not satisfy generate_ecosystem gate", !verifyStageCompletion("generate_ecosystem", ctx!)));
  steps.push(step("Generation blocked until CI approval", !assertEcosystemGenerationAllowed(SLUG).ok));
  steps.push(step("CI active action Approve Intelligence", ci.activeAction === "approve_intelligence"));
  steps.push(step("CGE active action Approve Intelligence path", cge.activeAction === "approve_intelligence"));
  steps.push(step("Workflow next action Approve Intelligence", wf?.nextAction?.label === "Approve Intelligence"));
  steps.push(step("Current stage Commercial Intelligence", stage === "commercial_intelligence"));
  steps.push(
    step(
      "Quality review blocked on historical only",
      !buildCommercialQualityReview(SLUG).productOwnerAuthorised && buildCommercialQualityReview(SLUG).blockers.some((b) => /authorised/i.test(b)),
    ),
  );
  steps.push(step("resolveCommercialWorkflowNextAction", resolveCommercialWorkflowNextAction(SLUG, "commercial_intelligence") === "Approve Intelligence"));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(`\nSummary: ${steps.length - failed.length}/${steps.length} passed`);
  if (failed.length) process.exit(1);
}

main();
