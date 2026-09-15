/**
 * NT-E2E-11 — Commercial Intelligence Dashboard UI routing validation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveWorkflowStage } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { buildCommercialIntelligenceDashboard } from "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts";

const TEST_SLUG = "reliable-direct-pharmacy";
const PAGE_PATH = resolve(
  "artifacts/api-server/src/routes/masterAdminPlatformPage.ts",
);

type Step = { name: string; passed: boolean; detail?: string };
function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

function main() {
  const steps: Step[] = [];
  const ctx = loadMasterAdminCustomerContext(TEST_SLUG)!;
  const stage = resolveWorkflowStage(ctx);
  const d = buildCommercialIntelligenceDashboard(TEST_SLUG);
  const page = readFileSync(PAGE_PATH, "utf8");

  steps.push(step("Stage is commercial_intelligence", stage === "commercial_intelligence", stage));
  steps.push(step("Dashboard data builds", Boolean(d.executiveSummary.overallBusinessHealth)));
  steps.push(step("cirModal z-index above customer modal", /#cirModal\{z-index:130\}/.test(page)));
  steps.push(
    step(
      "Open handler hides workflow modal",
      page.includes("document.getElementById('customerModal').classList.remove('open')") &&
        page.includes("document.getElementById('cirModal').classList.add('open')"),
    ),
  );
  steps.push(step("Dashboard renderer targets cirMain", /getElementById\('cirMain'\)|mainEl\.innerHTML/.test(page)));
  steps.push(step("Dashboard renderer targets cirApprovalPanel", /getElementById\('cirApprovalPanel'\)|panelEl\.innerHTML/.test(page)));
  steps.push(
    step(
      "Close handler restores workflow modal",
      page.includes("document.getElementById('customerModal').classList.add('open')") &&
        page.includes("function closeCommercialIntelligenceReview"),
    ),
  );
  steps.push(
    step(
      "Approve closes dashboard and returns to workflow",
      /async function approveCommercialIntelligenceReview[\s\S]*closeCommercialIntelligenceReview\(\)/.test(page),
    ),
  );
  const openHandler = page.match(/async function openCommercialIntelligenceReview\(\)\{[\s\S]*?\n\}/)?.[0] ?? "";
  steps.push(
    step(
      "Open handler does not refresh workflow detail during load",
      openHandler.length > 0 && !openHandler.includes("renderCustomerDetail("),
    ),
  );
  steps.push(step("cirError panel for load failures", page.includes('id="cirError"')));
  steps.push(step("Button handler openCommercialIntelligenceReview", page.includes('onclick="openCommercialIntelligenceReview()"')));
  steps.push(step("Panel resolver commercial-intelligence", page.includes("'panel','commercial-intelligence'")));
  steps.push(step("Executive Summary in renderer", page.includes("Executive Summary")));
  steps.push(step("Competitor Analysis in renderer", page.includes("Competitor Analysis")));
  steps.push(step("Approve Intelligence in renderer", page.includes("Approve Intelligence")));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-11 validation: FAIL (${failed.length})` : "\nNT-E2E-11 validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
