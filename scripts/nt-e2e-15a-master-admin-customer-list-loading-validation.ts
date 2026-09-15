/**
 * NT-E2E-15A — Master Admin customer-list loading validation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildMasterAdminDashboardLite } from "../src/pharmacy/masterAdminDashboardLiteService.ts";
import { resolveCommercialWorkflowNextAction } from "../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts";
import { resolveWorkflowStage } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { isCommercialIntelligenceApproved } from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";

const SLUG = "reliable-direct-pharmacy";

type Step = { name: string; passed: boolean; detail?: string };
function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

function main() {
  const steps: Step[] = [];
  const page = readFileSync(resolve("artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  const dist = readFileSync(resolve("artifacts/api-server/dist/index.mjs"), "utf8");

  const dashboard = buildMasterAdminDashboardLite();
  const ctx = loadMasterAdminCustomerContext(SLUG);

  steps.push(step("Dashboard builds without throw", dashboard.customers.length > 0, String(dashboard.customers.length)));
  steps.push(step("Reliable Direct present", dashboard.customers.some((c) => c.slug === SLUG)));
  steps.push(step("Banner Cross present", dashboard.customers.some((c) => c.slug === "banner-cross-pharmacy")));
  steps.push(step("No broken confirm newline in built JS", !dist.includes("current Business Profile.\n\nThe historical")));
  steps.push(step("Confirm uses escaped newlines in source", page.includes("Business Profile.\\\\n\\\\nThe historical")));
  steps.push(step("loadDashboard has error handler", page.includes("showCustomerTableError")));
  steps.push(step("Retry button wired", page.includes('onclick="loadDashboard()"') && page.includes("Retry")));
  steps.push(step("API timeout configured", page.includes("timeoutMs:30000")));
  steps.push(step("Per-customer summary isolation", readFileSync(resolve("src/pharmacy/masterAdminDashboardLiteService.ts"), "utf8").includes("loadError")));
  steps.push(step("Lightweight next-action resolver", readFileSync(resolve("src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts"), "utf8").includes("readAuthorisedEcosystemGenerationRecord(slug)")));
  steps.push(
    step(
      "Reliable Direct workflow preserved",
      resolveWorkflowStage(ctx!) === "commercial_intelligence" &&
        !isCommercialIntelligenceApproved(SLUG) &&
        resolveCommercialWorkflowNextAction(SLUG, "commercial_intelligence") === "Approve Intelligence",
    ),
  );

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  console.log(`\nSummary: ${steps.length - failed.length}/${steps.length} passed`);
  if (failed.length) process.exit(1);
}

main();
