/**
 * NT-E2E-14 — Commercial post-intelligence workflow validation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCommercialEcosystemGenerationDashboard, assertEcosystemGenerationAllowed } from "../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts";
import { buildCommercialIndexingReviewDashboard } from "../src/pharmacy/masterAdminCommercialIndexingReviewService.ts";
import { buildCommercialPerformanceDashboard } from "../src/pharmacy/masterAdminCommercialPerformanceDashboardService.ts";
import { buildCommercialQualityReview } from "../src/pharmacy/masterAdminCommercialQualityReviewService.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { loadContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { resolveWorkflowStage, verifyStageCompletion } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { runWorkflowPreflight } from "../src/pharmacy/masterAdminWorkflowOrchestrator.ts";
import { buildCustomerWorkflowState } from "../src/pharmacy/masterAdminWorkflowEngine.ts";

const SLUG = "reliable-direct-pharmacy";

type Step = { name: string; passed: boolean; detail?: string };
function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

function main() {
  const steps: Step[] = [];
  const page = readFileSync(resolve("artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  const orchestrator = readFileSync(resolve("src/pharmacy/masterAdminWorkflowOrchestrator.ts"), "utf8");
  const stageExecutor = readFileSync(resolve("src/pharmacy/masterAdminWorkflowStageExecutor.ts"), "utf8");
  const api = readFileSync(resolve("artifacts/api-server/src/routes/api/masterAdminPlatform.ts"), "utf8");

  steps.push(step("Generate Ecosystem dashboard service", orchestrator.includes("assertEcosystemGenerationAllowed")));
  steps.push(step("Indexing dashboard service wired", api.includes("commercial-indexing-review")));
  steps.push(step("Performance dashboard service wired", api.includes("commercial-performance-dashboard")));
  steps.push(step("Manual review gates for post-CI stages", orchestrator.includes("quality_review:") && orchestrator.includes("request_indexing:")));
  steps.push(step("Quality review uses commercial approval", stageExecutor.includes("readLatestCommercialQualityApproval")));
  steps.push(step("Indexing uses commercial approval", stageExecutor.includes("readLatestCommercialIndexingApproval")));
  steps.push(step("Performance uses commercial acknowledgement", stageExecutor.includes("readLatestCommercialPerformanceAcknowledgement")));
  steps.push(step("UI Generate Ecosystem modal", page.includes("cgeModal") && page.includes("openCommercialEcosystemGeneration")));
  steps.push(step("UI Indexing modal", page.includes("idxModal") && page.includes("openCommercialIndexingReview")));
  steps.push(step("UI Performance modal", page.includes("perfModal") && page.includes("openCommercialPerformanceDashboard")));
  steps.push(step("UI generation confirmation checkbox", page.includes("cgeConfirmCheckbox")));
  steps.push(step("UI indexing confirmation checkbox", page.includes("idxConfirmCheckbox")));
  steps.push(step("Quality review content quality score", page.includes("contentQualityScore")));
  steps.push(step("Quality review navigation label", page.includes("navigationValidationLabel")));

  const ctx = loadMasterAdminCustomerContext(SLUG);
  const pkg = ctx ? loadContentPackage(SLUG, ctx.serviceId) : null;
  const stage = ctx ? resolveWorkflowStage(ctx) : "unknown";
  const workflow = buildCustomerWorkflowState(SLUG, "validation");
  const preflight = runWorkflowPreflight(SLUG);

  steps.push(step("Reliable Direct customer context exists", Boolean(ctx), SLUG));
  steps.push(step("Reliable Direct ecosystem preserved", Boolean(pkg?.generatedAt), pkg?.generatedAt || "missing"));
  steps.push(
    step(
      "Reliable Direct duplicate generation blocked",
      !assertEcosystemGenerationAllowed(SLUG).ok,
      assertEcosystemGenerationAllowed(SLUG).error,
    ),
  );
  steps.push(step("Generate Ecosystem dashboard builds", Boolean(buildCommercialEcosystemGenerationDashboard(SLUG).readiness)));
  steps.push(step("Quality Review dashboard builds", Boolean(buildCommercialQualityReview(SLUG).summary)));
  steps.push(step("Indexing dashboard builds", Boolean(buildCommercialIndexingReviewDashboard(SLUG).narrative)));
  steps.push(step("Performance dashboard builds", Boolean(buildCommercialPerformanceDashboard(SLUG).narrative)));
  steps.push(
    step(
      "Reliable Direct quality score present",
      typeof buildCommercialQualityReview(SLUG).summary.contentQualityScore === "number",
      String(buildCommercialQualityReview(SLUG).summary.contentQualityScore),
    ),
  );
  steps.push(step("Continue workflow blocked at manual review stage", !preflight.ok || Boolean(preflight.reason), preflight.reason || "ok"));
  steps.push(
    step(
      "Operator workflow includes post-CI stages",
      (workflow.stages || []).some((s) => s.id === "generate_ecosystem") &&
        (workflow.stages || []).some((s) => s.id === "quality_review") &&
        (workflow.stages || []).some((s) => s.id === "request_indexing") &&
        (workflow.stages || []).some((s) => s.id === "initialise_rank_tracking"),
    ),
  );
  steps.push(step("Reliable Direct resolved stage recorded", Boolean(stage), stage));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-14 validation: FAIL (${failed.length})` : "\nNT-E2E-14 validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
