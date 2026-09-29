/**
 * Review & Approval must expose the canonical Open Evidence Review action.
 * Does not approve evidence, generate content, or write tenant files.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const page = readFileSync(resolve("artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
const nextActionSrc = readFileSync(resolve("src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts"), "utf8");
const cprSrc = readFileSync(resolve("src/pharmacy/masterAdminCoreProductRecoveryService.ts"), "utf8");
const orchestratorSrc = readFileSync(resolve("src/pharmacy/masterAdminWorkflowOrchestrator.ts"), "utf8");

const button = page.match(/id="udOpenEvidenceReviewBtn"[^>]*>/)?.[0] || "";
check("2 Open Evidence Review button uses the existing review opener", button.includes('onclick="openServicePageEvidenceReview()"') && !button.includes("openImportedEvidenceReview"));
check("3 header and Review tab use customer nextAction", page.includes("c.nextAction?'Next: '+c.nextAction") && page.includes("const canonicalNext=String(c.nextAction||'');") && page.includes("'Open Evidence Review':'udOpenEvidenceReviewBtn'"));
check("4 review tab names current stage and next action", page.includes("<strong>Current stage</strong>") && page.includes("<strong>Next required action</strong>") && page.includes("stageDisplayLabel(c)"));
check("5 Imported Evidence Review is a separate opener", page.includes("async function openImportedEvidenceReview()") && page.includes("async function openServicePageEvidenceReview()"));
const opener = page.slice(page.indexOf("async function openServicePageEvidenceReview()"), page.indexOf("function closeServicePageEvidenceReview()"));
check("6 opening review is the existing GET", opener.includes("/service-page-evidence-review") && !opener.includes("generate_ecosystem") && !/method:\s*'POST'/.test(opener));
check("7 opener does not generate or publish", !/generate_|publish|indexing/.test(opener));
check("8 unrelated review controls are hidden for this next action", page.includes("if(canonicalReviewAction)") && page.includes("qualityBtn.style.display='none'"));
check("11 no tenant branch in the review action", !/gilbert-pharmacy/.test(button + page.slice(page.indexOf("const canonicalNext=String(c.nextAction||'');"), page.indexOf("const canonicalNext=String(c.nextAction||'');") + 1800)));
check("12 second pharmacy uses the same nextAction string", page.includes("CANONICAL_REVIEW_NEXT_ACTIONS[canonicalNext]") && page.includes("Object.keys(CANONICAL_REVIEW_NEXT_ACTIONS)"));
check("13 no Gilbert-specific production logic", !page.includes("if(c.slug==='gilbert") && !page.includes("gilbert-pharmacy-health-clinic"));
check("1 CPR ecosystem stage returns the service-page action label", nextActionSrc.includes('currentStage === "generate_ecosystem"') && nextActionSrc.includes("resolveServicePageGenerationActionLabel(slug)"));
check("9 evidence review remains required before generation", orchestratorSrc.includes("Open Evidence Review and approve evidence before generating the service page"));
check("10 Generate Ecosystem is not the label while evidence is unapproved", cprSrc.includes('if (!dashboard.evidenceReviewApproved) return "Open Evidence Review";') && cprSrc.includes("return CPR01_GENERATE_ACTION_LABEL;"));
check("14 approval action remains separate from opening review", page.includes("async function approveServicePageEvidenceReview()") && !opener.includes("approveServicePageEvidenceReview"));
check("15 session handoff remains on api calls", page.includes("function withAuthHandoff") || page.includes("withAuthHandoff("));

const protectedFiles = [
  "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/business-profile-approvals/gilbert-pharmacy-health-clinic/latest.json",
  "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json",
  "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/core-product-recovery/gilbert-pharmacy-health-clinic/contract.json",
];
const before = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
const { resolveCommercialWorkflowNextAction } = await import("../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts");
const gilbertNext = resolveCommercialWorkflowNextAction("gilbert-pharmacy-health-clinic", "generate_ecosystem");
const otherNext = resolveCommercialWorkflowNextAction("pharmaconnect-e2e-test-pharmacy", "generate_ecosystem");
const after = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
check("1 Open Evidence Review remains on the shared canonical map", page.includes("'Open Evidence Review':'udOpenEvidenceReviewBtn'"), String(gilbertNext));
check("6 resolver read did not change Gilbert files", before === after);
check("12 second pharmacy does not receive Gilbert's current action", otherNext !== gilbertNext, `${otherNext} vs ${gilbertNext}`);
check("10 second call did not make generation the Gilbert action", gilbertNext !== "Generate Service Page" && gilbertNext !== "Generate Approved Ecosystem");

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `\nFAIL ${failed.length}/${steps.length}` : `\nPASS ${steps.length}/${steps.length}`);
process.exit(failed.length ? 1 : 0);
