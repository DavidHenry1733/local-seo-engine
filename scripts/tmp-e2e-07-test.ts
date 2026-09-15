import { continueCustomerWorkflowWithOnboardingBatch } from "../src/pharmacy/masterAdminOnboardingWorkflowIntegration.ts";
import { resolveWorkflowStage } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";

const slug = "reliable-direct-pharmacy";
const ctx = loadMasterAdminCustomerContext(slug);
console.log("before stage:", resolveWorkflowStage(ctx));
console.log("before ack:", ctx?.growthIntelligenceAcknowledged);

continueCustomerWorkflowWithOnboardingBatch(slug, "nt-e2e-07-test", {}).then((r) => {
  console.log("result:", { ok: r.ok, error: r.error, stageBefore: r.stageBefore, stageAfter: r.stageAfter, evidence: r.evidence });
  const ctx2 = loadMasterAdminCustomerContext(slug);
  console.log("after stage:", resolveWorkflowStage(ctx2));
  console.log("after ack:", ctx2?.growthIntelligenceAcknowledged);
});
