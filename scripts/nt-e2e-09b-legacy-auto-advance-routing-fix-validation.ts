/**
 * NT-E2E-09B — Legacy Auto Advance must not bypass Commercial Intelligence approval.
 */
import { resolveWorkflowStage, verifyStageCompletion } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import {
  isCommercialIntelligenceApproved,
  isCommercialIntelligenceReadyForReview,
} from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";
import { buildCommercialIntelligenceDashboard } from "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts";
import { isLegacyAutoAdvance } from "../src/pharmacy/masterAdminWorkflowLegacyService.ts";
import { loadContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
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
  const ctx = loadMasterAdminCustomerContext(TEST_SLUG)!;
  const stage = resolveWorkflowStage(ctx);
  const dashboard = buildCommercialIntelligenceDashboard(TEST_SLUG);
  const pkg = loadContentPackage(TEST_SLUG, ctx.serviceId);

  const legacySrc = fs.readFileSync(
    path.join(WORKSPACE_ROOT, "src/pharmacy/masterAdminWorkflowLegacyService.ts"),
    "utf8",
  );
  const ciSrc = fs.readFileSync(
    path.join(WORKSPACE_ROOT, "src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts"),
    "utf8",
  );
  const executorSrc = fs.readFileSync(
    path.join(WORKSPACE_ROOT, "src/pharmacy/masterAdminWorkflowStageExecutor.ts"),
    "utf8",
  );

  steps.push(step("Legacy Auto Advance still active for Reliable Direct", isLegacyAutoAdvance(TEST_SLUG)));
  steps.push(
    step(
      "Legacy does not auto-write Commercial Intelligence approval",
      !legacySrc.includes("writeCommercialIntelligenceApproval(slug"),
    ),
  );
  const approvedFn = ciSrc.slice(
    ciSrc.indexOf("export function isCommercialIntelligenceApproved"),
    ciSrc.indexOf("/** @deprecated Use isCommercialIntelligenceApproved"),
  );
  steps.push(
    step(
      "isCommercialIntelligenceApproved requires explicit ack only",
      approvedFn.includes('"commercial-intelligence-approved"') &&
        !approvedFn.includes("isLegacyAutoAdvance(slug)") &&
        !approvedFn.includes('"growth-intelligence-approved"'),
    ),
  );
  steps.push(
    step(
      "verifyStageCompletion commercial_intelligence excludes legacy bypass",
      executorSrc.includes('case "commercial_intelligence"') &&
        executorSrc.includes("return isCommercialIntelligenceApproved(ctx.slug);") &&
        !executorSrc.match(/case "commercial_intelligence"[\s\S]*?legacyIntelligenceStagesComplete/),
    ),
  );
  steps.push(step("Commercial Intelligence NOT auto-approved", !isCommercialIntelligenceApproved(TEST_SLUG)));
  steps.push(step("Commercial Intelligence ready for review", isCommercialIntelligenceReadyForReview(TEST_SLUG)));
  steps.push(
    step(
      "Reliable Direct stage is commercial_intelligence",
      stage === "commercial_intelligence",
      stage,
    ),
  );
  steps.push(
    step(
      "verifyStageCompletion commercial_intelligence is false until explicit approval",
      !verifyStageCompletion("commercial_intelligence", ctx),
    ),
  );
  steps.push(step("Existing generated content preserved", Boolean(pkg?.generatedAt)));
  steps.push(step("Previously Generated message data present", dashboard.ecosystemPreviouslyGenerated));
  steps.push(
    step(
      "Previously Generated timestamp present",
      Boolean(dashboard.ecosystemPreviouslyGeneratedAt),
      dashboard.ecosystemPreviouslyGeneratedAt || "",
    ),
  );
  steps.push(step("Dashboard canApprove enabled", dashboard.canApprove));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-09B validation: FAIL (${failed.length})` : "\nNT-E2E-09B validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
