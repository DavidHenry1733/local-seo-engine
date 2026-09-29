/**
 * Review & Approval exposes the same canonical next action the header shows
 * when that action already has a Product Owner screen.
 * Does not approve, generate, or write tenant files.
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
const cprSrc = readFileSync(resolve("src/pharmacy/masterAdminCoreProductRecoveryService.ts"), "utf8");

const mapSlice = page.slice(page.indexOf("const CANONICAL_REVIEW_NEXT_ACTIONS={"), page.indexOf("const CANONICAL_REVIEW_NEXT_OPENERS={"));
const reviewSlice = page.slice(page.indexOf("const canonicalNext=String(c.nextAction||'');"), page.indexOf("const canonicalNext=String(c.nextAction||'');") + 3600);
const reviewButton = page.match(/id="udOpenServicePageReviewBtn"[^>]*>/)?.[0] || "";
const evidenceButton = page.match(/id="udOpenEvidenceReviewBtn"[^>]*>/)?.[0] || "";
const generateButton = page.match(/id="udOpenServicePageGenerationBtn"[^>]*>/)?.[0] || "";
const opener = page.slice(page.indexOf("async function openServicePageReview()"), page.indexOf("function closeServicePageReview()"));

const supported = [
  ["Open Evidence Review", "udOpenEvidenceReviewBtn", "openServicePageEvidenceReview()"],
  ["Generate Service Page", "udOpenServicePageGenerationBtn", "openServicePageGeneration()"],
  ["Open Service Page Review", "udOpenServicePageReviewBtn", "openServicePageReview()"],
  ["Generate Cluster Pages", "udOpenLocalityScopeBtn", "openCampaignLocalitySelection(this.getAttribute('data-campaign-id'),this.getAttribute('data-service-id'))"],
  ["Review Cluster Pages", "openClusterReviewBtn", "openClusterPageReview(this.getAttribute('data-campaign-id'),this.getAttribute('data-service-id'))"],
] as const;

check("header prints the canonical next action", page.includes("c.nextAction?'Next: '+c.nextAction"));
check("campaign header uses the canonical next action", page.includes("CANONICAL_REVIEW_NEXT_ACTIONS[c.nextAction]?c.nextAction:selectedCampaign.nextAction"));
check("Review & Approval reads that same nextAction", reviewSlice.includes("const canonicalNext=String(c.nextAction||'');") && reviewSlice.includes("CANONICAL_REVIEW_NEXT_ACTIONS[canonicalNext]"));
check("one map shows the matching existing button", reviewSlice.includes("Object.keys(CANONICAL_REVIEW_NEXT_ACTIONS)") && reviewSlice.includes("label===canonicalNext?'inline-block':'none'"));
const genericAt = reviewSlice.indexOf("Business Profile Review");
check("generic review controls stay behind the map miss", reviewSlice.includes("if(canonicalReviewAction)") && reviewSlice.includes("<strong>Next required action</strong>") && (genericAt < 0 || reviewSlice.indexOf("if(canonicalReviewAction)") < genericAt));
check("quality and locality controls hide for a mapped action", reviewSlice.includes("if(canonicalReviewAction)") && reviewSlice.includes("qualityBtn.style.display='none'"));
check("isolated two-action gate is gone", !reviewSlice.includes("servicePageNext") && !reviewSlice.includes("canonicalNext==='Open Evidence Review'||"));

for (const [label, id, onclick] of supported) {
  check(`map routes ${label}`, mapSlice.includes(`'${label}':'${id}'`));
  const button = label === "Open Service Page Review"
    ? reviewButton
    : label === "Generate Cluster Pages"
      ? (page.match(/id="udOpenLocalityScopeBtn"[^>]*>/)?.[0] || "")
      : label === "Review Cluster Pages"
        ? (page.match(/id="openClusterReviewBtn"[^>]*>/)?.[0] || "")
      : label === "Open Evidence Review"
        ? evidenceButton
        : generateButton;
  check(`${label} uses its existing opener`, button.includes(`id="${id}"`) && button.includes(`onclick="${onclick}"`) && !button.includes("approveServicePageReview"));
}

check("Open Service Page Review opens the existing GET screen", opener.includes("/service-page-review") && opener.includes("await api(") && !/method:\s*'POST'/.test(opener) && !opener.includes("approveServicePageReview"));
check("no Gilbert-specific production logic", !/gilbert-pharmacy/.test(mapSlice + reviewSlice + reviewButton));

const resolver = cprSrc.slice(
  cprSrc.indexOf("export function resolveServicePageGenerationActionLabel"),
  cprSrc.indexOf("export function approveCprClusterReview"),
);
const constants = new Map<string, string>();
for (const match of cprSrc.matchAll(/export const (CPR[A-Z0-9_]+) = "([^"]+)"/g)) constants.set(match[1], match[2]);
const laterStageLabels = new Set([
  "Cluster Generation in Progress",
  "Open Publish Review",
]);
const returned = new Set<string>();
for (const match of resolver.matchAll(/return (?:"([^"]+)"|(CPR[A-Z0-9_]+))/g)) {
  returned.add(match[1] || constants.get(match[2]) || match[2]);
}
const mapped = new Set(supported.map(([label]) => label));
for (const label of returned) {
  if (laterStageLabels.has(label)) continue;
  check(`resolver label ${label} is on the Review map`, mapped.has(label), label);
}
check("resolver still returns Open Service Page Review", returned.has("Open Service Page Review"));
check("future resolver label cannot skip the map", [...returned].every((label) => mapped.has(label) || laterStageLabels.has(label)));

const protectedFiles = [
  "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
  "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json",
  "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/jobs.json",
  "data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json",
  "data/pharmacy-master-admin/service-page-generation/gilbert-pharmacy-health-clinic/by-service/blood-pressure-checks/latest.json",
  "output/pharmacy-visual-experience/gilbert-pharmacy-health-clinic/blood-pressure-checks/index.html",
];
const before = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
const approval = JSON.parse(readFileSync(protectedFiles[4], "utf8"));
const workflow = JSON.parse(readFileSync(protectedFiles[1], "utf8"));
const history = JSON.parse(readFileSync(protectedFiles[2], "utf8"));
const generation = JSON.parse(readFileSync(protectedFiles[5], "utf8"));
check("evidence remains approved", approval.decision === "approved");
check("Commercial Intelligence remains approved", Boolean(workflow.commercialIntelligenceApproval?.approvedAt));
check("workflow stage is unchanged", history.currentStage === "generate_ecosystem");
check("service page generation remains completed", generation.status === "completed" && generation.jobId === "26bbebdc-00d5-44ff-8ba1-f440c18e6f4c");

const { resolveCommercialWorkflowNextAction } = await import("../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts");
const gilbertNext = resolveCommercialWorkflowNextAction("gilbert-pharmacy-health-clinic", "generate_ecosystem");
const otherNext = resolveCommercialWorkflowNextAction("pharmaconnect-e2e-test-pharmacy", "generate_ecosystem");
const after = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
const localityOpener = page.slice(page.indexOf("async function openCampaignLocalitySelection("), page.indexOf("function closeCampaignLocalitySelection()"));
const sprRender = page.slice(page.indexOf("function renderServicePageReview(review)"), page.indexOf("async function approveServicePageReviewAction()"));
const sprApprove = page.slice(page.indexOf("function updateSprApproveState()"), page.indexOf("function renderServicePageReview(review)"));
const reviewShell = page.slice(page.indexOf("const canonicalNext=String(c.nextAction||'');"), page.indexOf("const pubEl=document.getElementById('udPublishingStatus');"));
check("Generate Cluster Pages opens locality scope", localityOpener.includes("/locality-selection") && !/method:\s*'POST'/.test(localityOpener));
check("locality opener closes the covering service-page review", localityOpener.includes("sprModal") && localityOpener.includes("classList.remove('open')"));
check("missing campaign shows a visible locality error", localityOpener.includes("campaignLocalityError") && localityOpener.includes("Select a service campaign before opening locality selection."));
check("approved review binds campaign identity before opening scope", sprRender.includes("bindClusterScopeButton(clusterBtn, review.campaignId, review.serviceId)") && sprRender.includes("data-campaign-id") && sprRender.includes("openCampaignLocalitySelection(clusterBtn.getAttribute('data-campaign-id'),clusterBtn.getAttribute('data-service-id'))"));
check("Review tab does not show Generate Cluster Pages without a campaign", reviewShell.includes("canonicalNext==='Generate Cluster Pages'") && reviewShell.includes("bindClusterScopeButton(scopeBtn, ident&&ident.campaignId, ident&&ident.serviceId)") && reviewShell.includes("Locality scope unavailable"));
check("approved review uses the canonical opener", sprRender.includes("CANONICAL_REVIEW_NEXT_OPENERS[nextAction]") && sprApprove.includes("btn.style.display=approved?'none':'block'") && !sprRender.includes("generateCampaignLocalityPages()"));
check("header next action for Gilbert is Review Cluster Pages", gilbertNext === "Review Cluster Pages", String(gilbertNext));
check("second pharmacy is not assigned Gilbert's action by name", otherNext !== "gilbert-pharmacy-health-clinic", String(otherNext));
check("resolver read did not change Gilbert files", before === after);

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
process.exit(failed.length ? 1 : 0);
