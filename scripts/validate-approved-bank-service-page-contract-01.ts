/**
 * Locked approved-bank service-page contracts must contain the structure the worker requires.
 * Does not generate a page, create a job, or write tenant files.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isCompleteApprovedBankServicePageContract, loadLockedApprovedBankServicePageContract } from "../src/pharmacy/pharmacyApprovedBankCorePageContract.ts";
import { loadServiceVariantPack } from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";
import { lockedApprovedBankServicePageContractBlocker } from "../src/pharmacy/masterAdminServicePageGenerationReadinessService.ts";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const protectedFiles = [
  "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/business-profile-approvals/gilbert-pharmacy-health-clinic/latest.json",
  "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json",
  "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/core-product-recovery/gilbert-pharmacy-health-clinic/contract.json",
  "data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json",
  "data/pharmacy-master-admin/jobs.json",
];
const before = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
const jobsBefore = JSON.parse(readFileSync(protectedFiles[6], "utf8"));
const failedJob = (jobsBefore.jobs || []).find((job: { id?: string }) => job.id === "2900ac8d-271d-444f-91b0-461ee412e372");
const gilbertGenerationJobs = (jobsBefore.jobs || []).filter((job: { slug?: string; action?: string }) => job.slug === "gilbert-pharmacy-health-clinic" && job.action === "generate_service_page");

const contract = loadLockedApprovedBankServicePageContract("blood-pressure-checks");
const pack = loadServiceVariantPack("blood-pressure-checks");
const bankHeadings = (pack?.howItWorks || []).slice(0, 4).map((step) => String(step.heading || "").trim());
check("canonical blood-pressure bank supplies process headings", bankHeadings.length === 4, bankHeadings.join(" | "));
check("approved-bank contract has non-empty sections", contract.sections.length > 0, String(contract.sections.length));
check("approved-bank contract has non-empty processSteps", contract.processSteps.length > 0, String(contract.processSteps.length));
check("approved-bank contract has non-empty faqs", contract.faqs.length > 0, String(contract.faqs.length));
check("process steps are the canonical bank headings", contract.processSteps.map((step) => step.title).join("|") === bankHeadings.join("|"));
check("worker still rejects a structurally incomplete contract", !isCompleteApprovedBankServicePageContract({
  contractId: contract.contractId,
  serviceId: "blood-pressure-checks",
  serviceName: contract.serviceName,
  bankVersion: contract.bankVersion,
  sections: contract.sections,
  processSteps: [],
  faqs: contract.faqs,
  heroIntroBody: contract.heroIntroBody,
}));
check("readiness accepts the complete blood-pressure contract", lockedApprovedBankServicePageContractBlocker("blood-pressure-checks") === null);
check("readiness rejects another service whose locked contract is incomplete", (lockedApprovedBankServicePageContractBlocker("travel-vaccinations") || "").includes("processSteps"));
check("pharmacy-first complete contract is accepted by the same gate", lockedApprovedBankServicePageContractBlocker("pharmacy-first") === null);
check("no Gilbert-specific contract branch", !readFileSync(resolve("src/pharmacy/masterAdminServicePageGenerationReadinessService.ts"), "utf8").includes("gilbert"));
check("failed job remains failed", failedJob?.status === "failed" && failedJob?.serviceId === "blood-pressure-checks" && jobsBefore.jobs?.[0]?.id === failedJob.id);
check("no replacement generation job", gilbertGenerationJobs.length === 2);

const approval = JSON.parse(readFileSync(protectedFiles[5], "utf8"));
const workflow = JSON.parse(readFileSync(protectedFiles[2], "utf8"));
const history = JSON.parse(readFileSync(protectedFiles[3], "utf8"));
const cpr = JSON.parse(readFileSync(protectedFiles[4], "utf8"));
check("evidence approval remains approved", approval.decision === "approved");
check("Commercial Intelligence remains approved", Boolean(workflow.commercialIntelligenceApproval?.approvedAt));
check("workflow was not advanced", history.currentStage === "generate_ecosystem");
check("no service page generated", cpr.servicePageGenerated === false);
const after = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
check("Gilbert files were not modified", before === after);

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
process.exit(failed.length ? 1 : 0);
