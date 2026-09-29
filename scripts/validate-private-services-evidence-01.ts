/**
 * Private services offered is one pharmacy-level Yes/No evidence field.
 * Does not approve evidence, generate content, or write Gilbert files.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const repo = process.cwd();
const page = readFileSync(path.resolve("artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
const evidenceSrc = readFileSync(path.resolve("src/pharmacy/masterAdminCoreProductRecoveryEvidenceService.ts"), "utf8");
const reviewSrc = readFileSync(path.resolve("src/pharmacy/masterAdminCoreProductRecoveryEvidenceReviewService.ts"), "utf8");
const contractSrc = readFileSync(path.resolve("src/pharmacy/pharmacyServicePageTenantContextService.ts"), "utf8");
const readinessSrc = readFileSync(path.resolve("src/pharmacy/masterAdminServicePageGenerationReadinessService.ts"), "utf8");
const activeSrc = evidenceSrc + reviewSrc + contractSrc + readinessSrc + page;

const protectedFiles = [
  "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/business-profile-approvals/gilbert-pharmacy-health-clinic/latest.json",
  "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json",
  "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/core-product-recovery/gilbert-pharmacy-health-clinic/contract.json",
].map((file) => path.join(repo, file));

const before = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
const workflow = JSON.parse(readFileSync(protectedFiles[2], "utf8"));
const history = JSON.parse(readFileSync(protectedFiles[3], "utf8"));
const contract = JSON.parse(readFileSync(protectedFiles[4], "utf8"));

check("old NHS/private combined item absent", !activeSrc.includes("nhsPrivateStatus") && !activeSrc.includes("NHS/private status") && !activeSrc.includes("NHS services available; private services not offered"));
check("no NHS-services confirmation question", !activeSrc.includes("NHS services offered"));
check("Private services offered field is in the page and contract", page.includes("f.id==='privateServicesOffered'") && page.includes("-value=\"Yes\"") && page.includes("-value=\"No\"") && contractSrc.includes('"privateServicesOffered"') && readinessSrc.includes('"privateServicesOffered"'));
check("Yes and No use the evidence decision control", page.includes("-decision=\"edit_value\"") && page.includes("decideEvidenceReviewField(fieldId,decision,btn,null,editedValue)") && page.includes("decideEvidenceReviewField(fieldId,decision,btn,'spg',editedValue)") && reviewSrc.includes('nextValue !== "Yes" && nextValue !== "No"'));
check("missing value displays Not Confirmed", page.includes("f.id==='privateServicesOffered'&&!f.value)return 'Not Confirmed'"));
check("no Gilbert-specific production logic", !/gilbert-pharmacy/.test(evidenceSrc + reviewSrc + page.slice(page.indexOf("function evidenceFieldDecisionButtons"), page.indexOf("function editEvidenceFieldValue"))));
check("pricing evidence stays on its own field", evidenceSrc.includes('evidenceField("pricing", "Pricing", "service", approved.privateServices'));
check("consultation, duration, room, and trust fields remain", ["consultationProcess", "consultationRoom", "expectedDuration", "teamReviewer"].every((id) => evidenceSrc.includes('"' + id + '"')));
check("Commercial Intelligence remains approved", Boolean(workflow.commercialIntelligenceApproval && workflow.commercialIntelligenceApproval.approvedAt));
check("workflow remains generate_ecosystem", history.currentStage === "generate_ecosystem");
check("no content generated", contract.servicePageGenerated === false);

const root = path.join(tmpdir(), "pc-private-services-evidence-" + Date.now());
mkdirSync(path.join(root, "data/pharmacy-profiles"), { recursive: true });
mkdirSync(path.join(root, "data/pharmacy-master-admin"), { recursive: true });
const slug = "private-services-evidence-fixture";
const other = "private-services-evidence-other";
writeFileSync(
  path.join(root, "data/pharmacy-master-admin/registry.json"),
  JSON.stringify({
    version: 1,
    updatedAt: "2026-09-29T00:00:00.000Z",
    clients: [
      { slug, pharmacyName: "Fixture Pharmacy", growthPlanTier: "starter", isDemo: true, archived: false, createdAt: "2026-09-29T00:00:00.000Z", updatedAt: "2026-09-29T00:00:00.000Z" },
      { slug: other, pharmacyName: "Other Pharmacy", growthPlanTier: "starter", isDemo: true, archived: false, createdAt: "2026-09-29T00:00:00.000Z", updatedAt: "2026-09-29T00:00:00.000Z" },
    ],
  }),
);
function writeProfile(id: string, data: Record<string, unknown>) {
  writeFileSync(
    path.join(root, "data/pharmacy-profiles", id + ".json"),
    JSON.stringify({ slug: id, data }),
  );
}
writeProfile(slug, {
  pharmacyName: "Fixture Pharmacy",
  privateServicesAvailable: false,
  selectedServices: ["blood-pressure-checks", "pharmacy-first"],
});
writeProfile(other, {
  pharmacyName: "Other Pharmacy",
  privateServicesAvailable: true,
  selectedServices: ["flu-vaccinations"],
});

process.env.WORKSPACE_ROOT = root;
const evidence = await import("../src/pharmacy/masterAdminCoreProductRecoveryEvidenceService.ts");
const review = await import("../src/pharmacy/masterAdminCoreProductRecoveryEvidenceReviewService.ts");
const tenant = await import("../src/pharmacy/pharmacyServicePageTenantContextService.ts");

const missing = evidence.buildCprEvidenceFields(slug, "pharmacy-first");
const privateField = missing.find((field) => field.id === "privateServicesOffered");
const preserved = ["consultationProcess", "consultationRoom", "expectedDuration", "pricing", "pharmacyName", "seoPlannedTitle"];
check("Private services offered? exists", privateField?.label === "Private services offered?" && privateField.required === true);
check("missing evidence is Not Confirmed, not No", privateField?.value == null && privateField?.status === "not_confirmed");
check("old field is not built", !missing.some((field) => field.id === "nhsPrivateStatus" || field.label === "NHS/private status"));
check("other evidence fields are unchanged", preserved.every((id) => missing.some((field) => field.id === id)));
check("Yes does not name individual services", evidence.resolvePrivateServicesOfferedAnswer({ privateServicesAvailable: true, selectedServices: ["blood-pressure-checks"] }) === "Yes");
check("schema default false is not No", evidence.resolvePrivateServicesOfferedAnswer({ privateServicesAvailable: false }) === null);
check("explicit sourced false projects No", evidence.resolvePrivateServicesOfferedAnswer({ privateServicesAvailable: false, customerSetupFieldSources: { privateServicesAvailable: "manual" } }) === "No");
check("explicit text Yes projects Yes", evidence.resolvePrivateServicesOfferedAnswer({ privateServicesOffered: "Yes" }) === "Yes");

const otherFields = evidence.buildCprEvidenceFields(other, "flu-vaccinations");
const otherPrivate = otherFields.find((field) => field.id === "privateServicesOffered");
check("tenant isolation projects each pharmacy's own answer", otherPrivate?.value === "Yes" && privateField?.value == null);

const rejected = review.decideServicePageEvidenceReviewField(slug, "privateServicesOffered", "edit_value", "regression", "blood-pressure-checks");
check("individual service is not accepted as the answer", rejected == null);
const savedYes = review.decideServicePageEvidenceReviewField(slug, "privateServicesOffered", "edit_value", "regression", "Yes");
const yesField = savedYes?.sections.flatMap((section) => section.fields).find((field) => field.id === "privateServicesOffered");
check("Yes persists through Evidence Review", yesField?.value === "Yes" && yesField.status === "confirmed", JSON.stringify(yesField || savedYes));
check("Yes satisfies this evidence requirement", Boolean(savedYes) && !savedYes!.blockers.some((blocker) => blocker.includes("Private services offered")));
const savedNo = review.decideServicePageEvidenceReviewField(slug, "privateServicesOffered", "edit_value", "regression", "No");
const noField = savedNo?.sections.flatMap((section) => section.fields).find((field) => field.id === "privateServicesOffered");
check("No persists through Evidence Review", noField?.value === "No" && noField.status === "confirmed");
const otherAfter = evidence.buildCprEvidenceFields(other, "flu-vaccinations").find((field) => field.id === "privateServicesOffered");
check("the other tenant decision is unchanged", otherAfter?.value === "Yes" && otherAfter.status === "not_confirmed");

const bundles = tenant.buildSectionEvidenceBundles(slug, savedNo?.primaryService || "pharmacy-first");
const supplied = bundles.flatMap((bundle) => bundle.evidenceFactsSupplied).join("\n");
check(
  "generation contract carries only the pharmacy-level answer",
  supplied.includes("privateServicesOffered=No") && !supplied.includes("nhsPrivateStatus") && !supplied.includes("blood-pressure-checks"),
  supplied,
);

const after = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
check("Gilbert files were not modified", before === after);

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `\nFAIL ${failed.length}/${steps.length}` : `\nPASS ${steps.length}/${steps.length}`);
process.exit(failed.length ? 1 : 0);
