/**
 * Review & Approval exposes the existing Generate Service Page screen
 * when that is the canonical next action. Does not generate content.
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
const button = page.match(/id="udOpenServicePageGenerationBtn"[\s\S]{0,180}/)?.[0] || "";
const reviewSlice = page.slice(page.indexOf("const canonicalNext=String(c.nextAction||'');"), page.indexOf("const canonicalNext=String(c.nextAction||'');") + 2200);
const opener = page.slice(page.indexOf("async function openServicePageGeneration()"), page.indexOf("function closeServicePageGeneration()"));

check("header uses the canonical next action", page.includes("c.nextAction?'Next: '+c.nextAction"));
check("Review & Approval exposes Generate Service Page", button.includes(">Generate Service Page") && button.includes('onclick="openServicePageGeneration()"') && !button.includes("confirmSpgGenerationClick"));
check("button is shown only for that next action", page.includes("'Generate Service Page':'udOpenServicePageGenerationBtn'") && reviewSlice.includes("CANONICAL_REVIEW_NEXT_ACTIONS[canonicalNext]") && reviewSlice.includes("label===canonicalNext?'inline-block':'none'"));
check("button opens the existing generation screen", opener.includes("/service-page-generation") && opener.includes("await api(") && !opener.includes("/service-page-generation/confirm") && !opener.includes("confirmSpgGenerationClick"));
check("opening the screen does not post a generation job", !/method:\s*'POST'/.test(opener));
check("generation confirm remains the authenticated handoff", page.includes("withAuthHandoff('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/service-page-generation/confirm')"));
check("no Gilbert-specific production logic", !/gilbert-pharmacy/.test(button + reviewSlice + opener));
check("Open Evidence Review remains a separate action", page.includes('id="udOpenEvidenceReviewBtn"') && page.includes("'Open Evidence Review':'udOpenEvidenceReviewBtn'"));

const protectedFiles = [
  "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/business-profile-approvals/gilbert-pharmacy-health-clinic/latest.json",
  "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json",
  "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/core-product-recovery/gilbert-pharmacy-health-clinic/contract.json",
  "data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-service/blood-pressure-checks/field-decisions.json",
  "data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json",
  "data/pharmacy-master-admin/jobs.json",
];
const before = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
const approval = JSON.parse(readFileSync(protectedFiles[6], "utf8"));
const history = JSON.parse(readFileSync(protectedFiles[3], "utf8"));
check("evidence remains approved", approval.decision === "approved");
check("service page generation record stays completed", JSON.parse(readFileSync("data/pharmacy-master-admin/service-page-generation/gilbert-pharmacy-health-clinic/by-service/blood-pressure-checks/latest.json", "utf8")).status === "completed");
check("workflow stage is unchanged", history.currentStage === "generate_ecosystem");

const { resolveCommercialWorkflowNextAction } = await import("../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts");
const gilbertNext = resolveCommercialWorkflowNextAction("gilbert-pharmacy-health-clinic", "generate_ecosystem");
const otherNext = resolveCommercialWorkflowNextAction("pharmaconnect-e2e-test-pharmacy", "generate_ecosystem");
const after = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
check("Generate Service Page remains on the shared canonical map", page.includes("'Generate Service Page':'udOpenServicePageGenerationBtn'"), String(gilbertNext));
check("second pharmacy uses the same generic next-action resolver", otherNext !== "gilbert-pharmacy-health-clinic", String(otherNext));
check("resolver read did not change Gilbert files", before === after);

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
process.exit(failed.length ? 1 : 0);
