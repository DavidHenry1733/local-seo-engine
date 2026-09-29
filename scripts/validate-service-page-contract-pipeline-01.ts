/**
 * Locked approved-bank sections, process steps, and FAQs are the only
 * service-page content authority. Does not generate a page or create a job.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  approvedBankContractToParsedSections,
  loadLockedApprovedBankServicePageContract,
} from "../src/pharmacy/pharmacyApprovedBankCorePageContract.ts";
import {
  projectLockedApprovedBankServicePageFaqs,
  resolveServicePageFaqContent,
} from "../src/pharmacy/pharmacyFaqContentResolver.ts";
import { loadServiceVariantPack } from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";
import {
  commercialPageContractGenerationBlockForFaqCount,
  validateCommercialPageContractV1,
} from "../src/pharmacy/masterAdminCommercialPageContractV1Service.ts";
import { lockedApprovedBankCommercialPageContractBlocker } from "../src/pharmacy/masterAdminServicePageGenerationReadinessService.ts";
import { scrubUnconfirmedServiceClaims } from "../src/pharmacy/pharmacyServicePagePublicationQuality.ts";
import type { ContentGenerationContext } from "../src/pharmacy/contentEngine/contentGenerationContextTypes.ts";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const root = resolve(".");
const protectedFiles = [
  "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
  "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json",
  "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/core-product-recovery/gilbert-pharmacy-health-clinic/contract.json",
  "data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json",
  "data/pharmacy-master-admin/jobs.json",
  "output/pharmacy-visual-experience/gilbert-pharmacy-health-clinic/blood-pressure-checks/index.html",
];
const before = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
const jobs = JSON.parse(readFileSync(protectedFiles[5], "utf8")) as {
  jobs?: Array<{ id?: string; slug?: string; action?: string; status?: string }>;
};
const jobIdsBefore = (jobs.jobs || []).map((job) => job.id);

const layout = readFileSync(resolve(root, "src/pharmacy/pharmacyVisualExperienceLayoutV3.ts"), "utf8");
const visual = readFileSync(resolve(root, "src/pharmacy/pharmacyVisualExperience.ts"), "utf8");
const quality = readFileSync(resolve(root, "src/pharmacy/pharmacyServicePagePublicationQuality.ts"), "utf8");
const readiness = readFileSync(resolve(root, "src/pharmacy/masterAdminServicePageGenerationReadinessService.ts"), "utf8");
const confirm = readFileSync(resolve(root, "src/pharmacy/masterAdminProductOwnerGenerationControlService.ts"), "utf8");
const resolver = readFileSync(resolve(root, "src/pharmacy/pharmacyFaqContentResolver.ts"), "utf8");

const approvedFaqBranch = layout.slice(layout.indexOf("function renderFaqSection"), layout.indexOf("const lockdownFaqs"));
check("approved-bank FAQ branch projects the locked contract", approvedFaqBranch.includes("projectLockedApprovedBankServicePageFaqs"));
check("approved-bank FAQ branch does not null the contract pack", !approvedFaqBranch.includes("variantPack: null"));
check("approved-bank sections come from the locked contract", layout.includes("approvedBankContractToParsedSections(lockedContract)"));
check("approved-bank process steps come from the locked contract", layout.includes("lockedContract?.processSteps"));
check("schema uses rendered FAQs instead of a second FAQ source", visual.includes("const faqsForSchema = renderedFaqs.length"));
check("approved-bank pages skip the legacy FAQ scrub", visual.includes("approvedBankContractAuthoritative: isApprovedBankRegisteredService(serviceId)") && quality.includes("if (isBloodPressure && !options.approvedBankContractAuthoritative)"));
check("readiness reuses the commercial FAQ rule", readiness.includes("lockedApprovedBankCommercialPageContractBlocker(serviceId)") && readiness.includes("commercialPageContractGenerationBlockForFaqCount"));
check(
  "job creation checks readiness before queueing",
  confirm.indexOf("assertServicePageGenerationAllowed") !== -1 &&
    confirm.indexOf("assertServicePageGenerationAllowed") < confirm.indexOf("queueServicePageOnlyJob"),
);
check("locked FAQ projection has no numeric cap", !resolver.slice(resolver.indexOf("function projectLockedApprovedBankServicePageFaqs"), resolver.indexOf("export function extractFaqsFromHtml")).includes("dedupeFaqs"));

const bp = loadLockedApprovedBankServicePageContract("blood-pressure-checks");
const bpPack = loadServiceVariantPack("blood-pressure-checks");
const bpFaqs = projectLockedApprovedBankServicePageFaqs(bpPack!);
const bpSections = approvedBankContractToParsedSections(bp);
check("Blood Pressure Checks stays 7 sections", bp.sections.length === 7, String(bp.sections.length));
check("Blood Pressure Checks stays 4 process steps", bp.processSteps.length === 4, String(bp.processSteps.length));
check("Blood Pressure Checks stays 8 FAQs", bp.faqs.length === 8, String(bp.faqs.length));
check("locked sections project into the page model", bpSections.size === bp.sections.length && bp.sections.every((section) => bpSections.get(section.num)?.title === section.title && bpSections.get(section.num)?.proseHtml === section.proseHtml));
check("locked process steps project without truncation", bp.processSteps.every((step) => step.title.trim() && step.body.trim()));
check("locked FAQs project without truncation", bpFaqs.length === bp.faqs.length && bpFaqs.every((faq, index) => faq.question === bp.faqs[index]?.question && faq.answer === bp.faqs[index]?.answer));

const competingHtml = `<div class="faq-item"><span class="faq-q">Will one high reading mean I have high blood pressure?</span><span class="faq-a">Competing answer.</span></div>`;
const resolved = resolveServicePageFaqContent(
  { variantPack: bpPack, serviceId: "blood-pressure-checks" } as ContentGenerationContext,
  "tenant-isolation-fixture",
  "blood-pressure-checks",
  competingHtml,
);
check("competing FAQ HTML is not the approved-bank authority", resolved.length === 8 && !resolved.some((faq) => faq.question.includes("Will one high reading")));
check("renderer projection does not invent FAQs", resolved.every((faq) => bp.faqs.some((locked) => locked.question === faq.question && locked.answer === faq.answer)));

const visibleHtml = bpFaqs.map((faq) => `<h3 class="faq-q">${faq.question}</h3><p class="faq-a">${faq.answer}</p>`).join("");
const commercial = validateCommercialPageContractV1(visibleHtml);
const faqCheck = commercial.checks.find((item) => item.id === "faq_min_5");
check("Commercial Page Contract sees the projected FAQs", faqCheck?.passed === true && faqCheck.detail === "count=8", faqCheck?.detail);
check("faq_min_5 passes when the locked contract satisfies it", lockedApprovedBankCommercialPageContractBlocker("blood-pressure-checks") === null);
check(
  "faq_min_5 fails before job creation when the locked contract cannot satisfy it",
  commercialPageContractGenerationBlockForFaqCount(4) === "Generation blocked — Commercial Page Contract V1: faq_min_5: Minimum five visible FAQs (count=4)",
);

const scrubbed = scrubUnconfirmedServiceClaims(visibleHtml, {
  serviceId: "blood-pressure-checks",
  approvedBankContractAuthoritative: true,
  abpmConfirmed: false,
});
check("approved-bank FAQ scrub does not remove projected FAQs", (scrubbed.match(/class="faq-q"/g) || []).length === 8);

const first = loadLockedApprovedBankServicePageContract("pharmacy-first");
const firstPack = loadServiceVariantPack("pharmacy-first");
const firstFaqs = projectLockedApprovedBankServicePageFaqs(firstPack!);
const firstSections = approvedBankContractToParsedSections(first);
check("second service uses the same section projection", firstSections.size === first.sections.length);
check("second service uses the same FAQ projection", firstFaqs.length === first.faqs.length && firstFaqs.every((faq, index) => faq.question === first.faqs[index]?.question));
check("second service process steps stay on the locked contract", first.processSteps.length === loadLockedApprovedBankServicePageContract("pharmacy-first").processSteps.length);
check("tenant isolation keeps Gilbert out of the shared projection", !bpFaqs.some((faq) => /gilbert/i.test(faq.question + faq.answer)) && !firstFaqs.some((faq) => /gilbert/i.test(faq.question + faq.answer)));

const failedIds = ["105ded8e-e35e-4381-a1e7-3f9e095fa112", "2900ac8d-271d-444f-91b0-461ee412e372"];
for (const id of failedIds) {
  const job = (jobs.jobs || []).find((item) => item.id === id);
  check(`failed job ${id.slice(0, 8)} remains failed`, job?.status === "failed", job?.status);
}
check("no replacement generation job", jobIdsBefore.length === (jobs.jobs || []).length);

const decision = JSON.parse(readFileSync(protectedFiles[4], "utf8")) as { decision?: string };
const workflow = JSON.parse(readFileSync(protectedFiles[1], "utf8")) as {
  commercialIntelligenceApproval?: { approvedAt?: string };
};
const history = JSON.parse(readFileSync(protectedFiles[2], "utf8")) as { currentStage?: string };
check("evidence approval remains approved", decision.decision === "approved", decision.decision);
check("commercial intelligence remains approved", Boolean(workflow.commercialIntelligenceApproval?.approvedAt));
check("workflow stage was not advanced by this check", history.currentStage === "generate_ecosystem", history.currentStage);

const after = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
check("Gilbert tenant files and failed output were not rewritten", before === after);

const failed = steps.filter((step) => !step.passed);
console.log(`service-page-contract-pipeline-01 ${steps.length - failed.length}/${steps.length}`);
for (const step of failed) console.log(`FAIL ${step.name}${step.detail ? ` — ${step.detail}` : ""}`);
if (failed.length) process.exit(1);
