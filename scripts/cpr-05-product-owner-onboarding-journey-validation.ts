/**
 * CPR-05 — Product Owner onboarding journey (dashboard-only path validation).
 * Does not create customers or run generation.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const checks: Array<{ id: string; pass: boolean; detail?: string }> = [];
function check(id: string, pass: boolean, detail?: string) {
  checks.push({ id, pass, detail });
}

const page = read("artifacts/api-server/src/routes/masterAdminPlatformPage.ts");
const api = read("artifacts/api-server/src/routes/api/masterAdminPlatform.ts");
const stageExec = read("src/pharmacy/masterAdminWorkflowStageExecutor.ts");
const workflowEngine = read("src/pharmacy/masterAdminWorkflowEngine.ts");
const orchestrator = read("src/pharmacy/masterAdminWorkflowOrchestrator.ts");
const recovery = read("src/pharmacy/masterAdminCoreProductRecoveryService.ts");
const onboarding = read("src/pharmacy/masterAdminCommercialOnboardingService.ts");

check("Create customer UI", page.includes("openCreateModal()") && page.includes("createCustomer()"));
check("Create customer API", api.includes('router.post("/master-admin-platform/customers"'));
check("CPR enabled on create", onboarding.includes("enableCoreProductRecoveryContract"));
check("Website import workflow stage", stageExec.includes('case "website_import"'));
check("Business profile review UI", page.includes("openBusinessProfileReview()"));
check("Business profile review API", api.includes("/business-profile-review"));
check("Evidence review modal", page.includes("speModal") && page.includes("openServicePageEvidenceReview()"));
check("Evidence review API", api.includes("/service-page-evidence-review"));
check("Evidence approve API", api.includes("/service-page-evidence-review/approve"));
check("Service page generation modal", page.includes("openServicePageGeneration()"));
check("Service page generation API", api.includes("/service-page-generation"));
check("CPR skips CI after BPR", stageExec.includes("resolveCoreProductRecoveryWorkflowStage"));
check("CPR workflow stage after BPR", stageExec.includes('return "generate_ecosystem"'));
check("CPR next action evidence review", recovery.includes('return "Open Evidence Review"'));
check("CPR preflight evidence review", orchestrator.includes("Open Evidence Review and approve evidence"));
check("CPR banner after BPR", page.includes("customerAtCprServicePageJourney"));
check("CPR hides commercial intelligence banner", page.includes("customerAtCprServicePageJourney(c))return false"));
check("Evidence review deep link", page.includes("service-page-evidence-review"));
check("Service page generation deep link", page.includes("service-page-generation"));
check("Operator ladder skips CI for CPR", workflowEngine.includes('stageId === "commercial_intelligence") return true'));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"} — ${c.id}${c.detail ? ` (${c.detail})` : ""}`);
}
console.log(`\nCPR-05 validation: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
