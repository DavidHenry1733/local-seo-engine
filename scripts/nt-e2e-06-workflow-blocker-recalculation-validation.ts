/**
 * NT-E2E-06 — workflow blocker recalculation validation.
 */
import { runWorkflowPreflight, getOrchestrationPreview } from "../src/pharmacy/masterAdminWorkflowOrchestrator.ts";
import { resolveWorkflowStage } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { buildMasterAdminCustomerIssueSummary } from "../src/pharmacy/masterAdminIssueService.ts";
import {
  listWorkflowBlockingIssues,
  resolveWorkflowIssueBlockers,
} from "../src/pharmacy/masterAdminWorkflowIssueBlockerService.ts";
import { isBusinessProfileReviewApproved } from "../src/pharmacy/masterAdminBusinessProfileReviewService.ts";
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

function main() {
  const steps: Step[] = [];
  const ctx = loadMasterAdminCustomerContext(TEST_SLUG);
  const stage = ctx ? resolveWorkflowStage(ctx) : "create_customer";
  const profile = readSetupProfile(TEST_SLUG);
  const googleState = resolveGoogleProfileOnboardingState(profile);
  const issueSummary = buildMasterAdminCustomerIssueSummary(TEST_SLUG);
  const blockers = resolveWorkflowIssueBlockers(TEST_SLUG, stage);
  const preflight = runWorkflowPreflight(TEST_SLUG);
  const orch = getOrchestrationPreview(TEST_SLUG);

  steps.push(step("Current stage is Generate Growth Intelligence", stage === "generate_growth_intelligence", stage));
  steps.push(step("Business Profile approved", isBusinessProfileReviewApproved(TEST_SLUG)));
  steps.push(step("Google state no_profile or deferred", googleState === "no_profile" || googleState === "deferred", googleState));
  steps.push(step("Open support issues exist in index", issueSummary.openCount > 0, String(issueSummary.openCount)));
  steps.push(step("Stale BPR issues filtered from blockers", listWorkflowBlockingIssues(TEST_SLUG, stage).length === 0, String(listWorkflowBlockingIssues(TEST_SLUG, stage).length)));
  steps.push(step("Workflow blocker resolver returns no block", !blockers.blocked, blockers.reason || "none"));
  steps.push(step("Preflight ok", preflight.ok, preflight.reason || "ok"));
  steps.push(step("Continue Workflow enabled", orch.canContinue === true, String(orch.canContinue)));
  steps.push(step("Next action is Growth Intelligence", preflight.actionId === "orchestrate_growth_intelligence", preflight.actionId || "null"));
  steps.push(step("Website Import preserved", Boolean(profile.websiteImportSnapshot?.importedAt)));

  const tenantHits: string[] = [];
  for (const file of [
    "src/pharmacy/masterAdminWorkflowIssueBlockerService.ts",
    "src/pharmacy/masterAdminWorkflowOrchestrator.ts",
  ]) {
    const text = fs.readFileSync(path.join(WORKSPACE_ROOT, file), "utf8");
    if (text.includes("reliable-direct") || text.includes("Banner Cross")) tenantHits.push(file);
  }
  steps.push(step("No tenant-specific blocker code", tenantHits.length === 0, tenantHits.join("; ")));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-06 validation: FAIL (${failed.length})` : "\nNT-E2E-06 validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
