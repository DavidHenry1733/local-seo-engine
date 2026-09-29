/**
 * After a successful locality generation, Review Cluster Pages is the next action
 * and the existing locality review lists the rendered pages.
 * Does not generate, approve, or write tenant files.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildMasterAdminCustomerRecordLite } from "../src/pharmacy/masterAdminCustomerRecordLiteService.ts";
import { resolveCommercialWorkflowNextAction } from "../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts";
import { buildCprClusterReviewDashboard } from "../src/pharmacy/masterAdminCoreProductRecoveryService.ts";
import {
  countActiveCustomerIssues,
  isSupersededLocalityGenerationFailureIssue,
} from "../src/pharmacy/masterAdminWorkflowIssueBlockerService.ts";
import { getMasterAdminIssue, listMasterAdminIssueSummaries } from "../src/pharmacy/masterAdminIssueService.ts";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const slug = "gilbert-pharmacy-health-clinic";
const campaignId = "9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f";
const serviceId = "blood-pressure-checks";
const areas = ["paisley", "barrhead", "elderslie", "renfrew", "linwood", "glasgow"];
const localityFiles = areas.map(
  (area) => `output/pharmacy-content-ecosystem/${slug}/${serviceId}/local/${area}/index.html`,
);
const protectedFiles = [
  ...localityFiles,
  "data/pharmacy-campaigns/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/jobs.json",
  "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/service-page-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json",
  "data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json",
  "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json",
  "output/pharmacy-visual-experience/gilbert-pharmacy-health-clinic/blood-pressure-checks/index.html",
  "data/pharmacy-master-admin/issues/index.json",
];
const before = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });

const page = readFileSync(resolve("artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
const blocker = readFileSync(resolve("src/pharmacy/masterAdminWorkflowIssueBlockerService.ts"), "utf8");
const record = buildMasterAdminCustomerRecordLite(slug);
const next = resolveCommercialWorkflowNextAction(slug, "generate_ecosystem");
const other = resolveCommercialWorkflowNextAction("pharmaconnect-e2e-test-pharmacy", "generate_ecosystem");
const review = buildCprClusterReviewDashboard(slug, { campaignId, serviceId });
const jobs = JSON.parse(readFileSync(resolve("data/pharmacy-master-admin/jobs.json"), "utf8"));
const success = (jobs.jobs || []).find((job: { id?: string }) => job.id === "3eeeb55a-3fac-4cbb-8249-61220f9d5490");
const failedA = (jobs.jobs || []).find((job: { id?: string }) => job.id === "697f0bf4-5708-48a0-80eb-72f4617d529b");
const failedB = (jobs.jobs || []).find((job: { id?: string }) => job.id === "ee221113-ad02-4c1d-a56d-3d80df866024");
const gilbertIssues = listMasterAdminIssueSummaries().filter((issue) => issue.tenantSlug === slug && !["Closed", "Passed"].includes(issue.status));
const activeCount = countActiveCustomerIssues(slug);

check("successful locality generation is the next-action input", next === "Review Cluster Pages" && record?.nextAction === "Review Cluster Pages", String(next));
check("Generate Cluster Pages is no longer the canonical next action", next !== "Generate Cluster Pages");
check(
  "all six generated pages are discovered",
  review?.pageCount === 6 && areas.every((area) => review?.pages.some((page) => page.areaSlug === area && page.previewUrl.includes(`/local/${area}/`))),
  review?.pages.map((page) => page.areaSlug).join(","),
);
check("review uses the completed generation job", review?.completedJobId === "3eeeb55a-3fac-4cbb-8249-61220f9d5490" && success?.status === "completed");
check("none of the six pages are auto-approved", review?.pages.every((page) => page.decision === "pending") === true && review?.approvedLocalityCount === 0);
check("header and review map share Review Cluster Pages", page.includes("'Review Cluster Pages':'openClusterReviewBtn'") && page.includes("'Review Cluster Pages':openClusterPageReview"));
check(
  "review opener loads the existing cluster review",
  page.includes("async function openClusterPageReview(campaignId,serviceId)") &&
    page.includes("/cluster-page-review?") &&
    page.includes("Select a service campaign before opening locality review."),
);
check(
  "historical locality failures are not current blockers",
  gilbertIssues.length === 2 &&
    gilbertIssues.every((issue) => isSupersededLocalityGenerationFailureIssue(slug, issue)) &&
    activeCount === 0 &&
    record?.outstandingIssues === 0,
  `stored ${gilbertIssues.length} active-count ${activeCount}`,
);
check("failed locality jobs remain failed history", failedA?.status === "failed" && failedB?.status === "failed");
check("issue records were not closed", gilbertIssues.every((issue) => issue.status === "Open") && getMasterAdminIssue(gilbertIssues[0]?.issueId || "")?.status === "Open");
check("workflow stage was not advanced", JSON.parse(readFileSync("data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json", "utf8")).currentStage === "generate_ecosystem");
check("service page and evidence approvals remain", JSON.parse(readFileSync("data/pharmacy-master-admin/service-page-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json", "utf8")).decision === "approved" && JSON.parse(readFileSync("data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json", "utf8")).decision === "approved");
check("Commercial Intelligence approval remains", Boolean(JSON.parse(readFileSync("data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json", "utf8")).commercialIntelligenceApproval?.approvedAt));
check("production logic has no Gilbert special case", !/gilbert-pharmacy|Paisley|Barrhead/.test(blocker));
check("another tenant does not receive Gilbert's next action", other !== "Review Cluster Pages", String(other));
const localityHashes = localityFiles.map((file) => createHash("sha256").update(readFileSync(file)).digest("hex"));
check("six locality files exist with distinct content", new Set(localityHashes).size === 6);
const after = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
check("review resolution did not change Gilbert files or locality output", before === after);

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
process.exit(failed.length ? 1 : 0);
