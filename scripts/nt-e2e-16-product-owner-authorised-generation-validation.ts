/**
 * NT-E2E-16 — Product Owner approval and authorised ecosystem generation (RC1).
 * Does NOT click Approve Intelligence or Generate Approved Ecosystem.
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
  readAuthorisedEcosystemGenerationRecord,
  HISTORICAL_ACCIDENTAL_JOB_ID,
  HISTORICAL_ACCIDENTAL_SOURCE,
} from "../src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts";
import { buildCommercialIntelligenceDashboard } from "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts";
import { buildCommercialQualityReview } from "../src/pharmacy/masterAdminCommercialQualityReviewService.ts";
import { isCommercialIntelligenceApproved } from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";
import { resolveWorkflowStage, verifyStageCompletion } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { buildCustomerWorkflowState } from "../src/pharmacy/masterAdminWorkflowEngine.ts";
import { listMasterAdminJobs } from "../src/pharmacy/masterAdminJobService.ts";

const SLUG = "reliable-direct-pharmacy";

type Step = { name: string; passed: boolean; detail?: string };
function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

function main() {
  const steps: Step[] = [];
  const page = readFileSync(resolve("artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  const api = readFileSync(resolve("artifacts/api-server/src/routes/api/masterAdminPlatform.ts"), "utf8");
  const authorisedSvc = readFileSync(resolve("src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts"), "utf8");
  const cgeSvc = readFileSync(resolve("src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts"), "utf8");

  const ctx = loadMasterAdminCustomerContext(SLUG);
  const stage = ctx ? resolveWorkflowStage(ctx) : null;
  const ci = buildCommercialIntelligenceDashboard(SLUG);
  const cge = buildCommercialEcosystemGenerationDashboard(SLUG);
  const historical = readHistoricalEcosystemPackage(SLUG);
  const wf = buildCustomerWorkflowState(SLUG);
  const authorisedRecord = readAuthorisedEcosystemGenerationRecord(SLUG);
  const activeGenJob = listMasterAdminJobs({ slug: SLUG, limit: 5 }).find(
    (j) => j.action === "generate_ecosystem" && (j.status === "queued" || j.status === "running"),
  );

  steps.push(step("Authorised service v2 record shape", authorisedSvc.includes("version: 2") && authorisedSvc.includes("authorised: true")));
  steps.push(step("Expected page plan builder", authorisedSvc.includes("buildExpectedPagePlan")));
  steps.push(step("Post-generation validation", authorisedSvc.includes("runPostGenerationValidation")));
  steps.push(step("Historical source constant", HISTORICAL_ACCIDENTAL_SOURCE.includes("Accidental pre-approval")));
  steps.push(step("Historical job ID preserved", HISTORICAL_ACCIDENTAL_JOB_ID === "4a470616-abbc-484e-85d9-73ee1cd520d7"));
  steps.push(step("Generation readiness pharmacy name", cgeSvc.includes("pharmacyName")));
  steps.push(step("Generation readiness design intelligence", cgeSvc.includes("designIntelligenceStatus")));
  steps.push(step("Generation readiness image platform", cgeSvc.includes("imagePlatformReadiness")));
  steps.push(step("Generation readiness total pages", cgeSvc.includes("expectedTotalPageCount")));
  steps.push(step("Generation progress payload", cgeSvc.includes("generationProgress")));
  steps.push(step("Confirm endpoint wired", api.includes("confirmAuthorisedEcosystemGeneration")));
  steps.push(step("UI Approve Intelligence", page.includes("Approve Intelligence") && page.includes("approveCommercialIntelligenceReview")));
  steps.push(step("UI Generate Approved Ecosystem", page.includes("Generate Approved Ecosystem")));
  steps.push(step("UI historical disclosure format", page.includes("Historical ecosystem package") && page.includes("Accidental pre-approval")));
  steps.push(step("UI confirmation dialog BP + engines", page.includes("Business Profile and current platform engines")));
  steps.push(step("UI generation progress panel", page.includes("Generating Approved Ecosystem…") && page.includes("generationProgress")));
  steps.push(step("UI quality preview links", page.includes("cqrPreviewLinks")));
  steps.push(step("Customer preserved", Boolean(ctx)));
  steps.push(step("Historical package detected", Boolean(historical)));
  steps.push(
    step(
      "Historical source disclosure",
      historical?.source === HISTORICAL_ACCIDENTAL_SOURCE && historical.productOwnerAuthorised === false,
    ),
  );
  steps.push(step("Authorised generation not complete", !isAuthorisedEcosystemGenerated(SLUG)));
  steps.push(step("No active authorised job during validation", !activeGenJob && authorisedRecord?.status !== "running"));
  steps.push(step("Historical does not satisfy generate_ecosystem gate", ctx ? !verifyStageCompletion("generate_ecosystem", ctx) : false));
  steps.push(
    step(
      "Readiness counts from plan not historical",
      cge.readiness.expectedTotalPageCount > 0 && cge.readiness.expectedTotalPageCount !== (historical?.pageCountEstimate || 0),
    ),
  );
  steps.push(step("Readiness panel fields", Boolean(cge.readiness.pharmacyName && cge.readiness.designIntelligenceStatus)));
  steps.push(
    step(
      "Quality review references authorised gate",
      buildCommercialQualityReview(SLUG).blockers.some((b) => /authorised/i.test(b)) || isAuthorisedEcosystemGenerated(SLUG),
    ),
  );
  steps.push(step("No Regenerate Ecosystem shortcut", !page.includes("Regenerate Ecosystem")));

  const ciApproved = isCommercialIntelligenceApproved(SLUG);
  steps.push(step("CI approval state recorded", ciApproved || ci.activeAction === "approve_intelligence"));
  if (ciApproved) {
    steps.push(step("Stage at or past Generate Ecosystem", stage === "generate_ecosystem" || stage === "quality_review"));
    steps.push(
      step(
        "Next action Generate Approved Ecosystem when approved",
        resolveCommercialWorkflowNextAction(SLUG, stage || "generate_ecosystem") === "Generate Approved Ecosystem" ||
          resolveCommercialWorkflowNextAction(SLUG, stage || "generate_ecosystem") === "Generating Approved Ecosystem…",
      ),
    );
    steps.push(step("CGE can show readiness when approved", Boolean(cge.readiness.expectedTotalPageCount)));
    steps.push(step("Generation allowed or blocked with reason", assertEcosystemGenerationAllowed(SLUG).ok || Boolean(assertEcosystemGenerationAllowed(SLUG).error)));
  } else {
    steps.push(step("Pre-approval next action", wf?.nextAction?.label === "Approve Intelligence"));
    steps.push(step("Generation blocked until approval", !assertEcosystemGenerationAllowed(SLUG).ok));
  }

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(`\nSummary: ${steps.length - failed.length}/${steps.length} passed`);
  console.log(`Current stage: ${stage}`);
  console.log(`CI approved: ${ciApproved}`);
  console.log(`Workflow next action: ${wf?.nextAction?.label || resolveCommercialWorkflowNextAction(SLUG, stage || "")}`);
  if (failed.length) process.exit(1);
}

main();
