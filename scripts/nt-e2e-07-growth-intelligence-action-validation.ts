import { runWorkflowPreflight } from "../src/pharmacy/masterAdminWorkflowOrchestrator.ts";
import { resolveWorkflowStage } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import {
  findActiveGrowthIntelligenceJob,
  isGrowthIntelligenceWorkflowComplete,
  runGrowthIntelligenceWorkflowAction,
} from "../src/pharmacy/masterAdminGrowthIntelligenceWorkflowService.ts";
import { executeMasterAdminAction } from "../src/pharmacy/masterAdminPlatformService.ts";
import { LONG_RUNNING_STAGE_ACTIONS } from "../src/pharmacy/masterAdminWorkflowModel.ts";
import { LONG_RUNNING_MASTER_ADMIN_ACTIONS } from "../src/pharmacy/masterAdminJobService.ts";
import { resolveGoogleProfileOnboardingState } from "../src/pharmacy/masterAdminGoogleProfileOnboardingService.ts";
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
  const profile = readSetupProfile(TEST_SLUG);
  const googleState = resolveGoogleProfileOnboardingState(profile);
  const ctx = loadMasterAdminCustomerContext(TEST_SLUG);
  const stage = ctx ? resolveWorkflowStage(ctx) : "create_customer";

  steps.push(step("Google state no_profile or deferred", googleState === "no_profile" || googleState === "deferred", googleState));
  steps.push(step("Growth Intelligence workflow complete", isGrowthIntelligenceWorkflowComplete(TEST_SLUG)));
  steps.push(step("orchestrate_growth_intelligence is long-running stage action", LONG_RUNNING_STAGE_ACTIONS.has("orchestrate_growth_intelligence")));
  steps.push(step("orchestrate_growth_intelligence is long-running job action", LONG_RUNNING_MASTER_ADMIN_ACTIONS.has("orchestrate_growth_intelligence")));
  steps.push(step("No active Growth Intelligence job before test", !findActiveGrowthIntelligenceJob(TEST_SLUG)));

  const idempotent = runGrowthIntelligenceWorkflowAction(TEST_SLUG, "nt-e2e-07");
  steps.push(step("Idempotent Growth Intelligence execution", idempotent.ok && Boolean(idempotent.idempotent), idempotent.evidence));
  steps.push(step("Duplicate job not created on idempotent run", !findActiveGrowthIntelligenceJob(TEST_SLUG) || Boolean(idempotent.activeJobId)));

  const action = await executeMasterAdminAction("orchestrate_growth_intelligence", TEST_SLUG, "nt-e2e-07", {});
  steps.push(step("Backend executor mapped via executeMasterAdminAction", action.ok, action.audit.evidence));

  const preflight = runWorkflowPreflight(TEST_SLUG);
  steps.push(step("Continue Workflow preflight ok", preflight.ok, preflight.reason || preflight.actionId || ""));
  steps.push(step("Workflow advanced past Generate Growth Intelligence", stage !== "generate_growth_intelligence", stage));
  steps.push(step("Website Import preserved", Boolean(profile.websiteImportSnapshot?.importedAt)));

  const tenantHits: string[] = [];
  for (const file of [
    "src/pharmacy/masterAdminGrowthIntelligenceWorkflowService.ts",
    "src/pharmacy/masterAdminWorkflowOrchestrator.ts",
  ]) {
    const text = fs.readFileSync(path.join(WORKSPACE_ROOT, file), "utf8");
    if (text.includes("reliable-direct") || text.includes("Banner Cross")) tenantHits.push(file);
  }
  steps.push(step("No tenant-specific GI action code", tenantHits.length === 0, tenantHits.join("; ")));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-07 validation: FAIL (${failed.length})` : "\nNT-E2E-07 validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
