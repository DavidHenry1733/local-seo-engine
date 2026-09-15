/**
 * Sprint 7A Defect 039 — canonical website validation for Banner Cross Pharmacy.
 */
import { getMasterAdminJob } from "./masterAdminJobService.ts";
import { listMasterAdminAudit } from "./masterAdminAuditService.ts";
import { getCustomerAccountDetail } from "./masterAdminAccountService.ts";
import { buildCustomerWorkflowState } from "./masterAdminWorkflowEngine.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { buildWebsiteSourceSummary } from "./masterAdminCanonicalWebsiteService.ts";
import { executeMasterAdminAction } from "./masterAdminPlatformService.ts";
import { WORKER_POLL_INTERVAL_MS } from "./masterAdminJobWorkerService.ts";

const BANNER_CROSS_SLUG = "banner-cross-pharmacy";
const BRANCH_URL = "https://pharmacyhealthhub.co.uk/bannercross-pharmacy-sheffield";

function branchEvidencePresent(snap: Record<string, unknown> | null | undefined): boolean {
  if (!snap) return false;
  const url = String(snap.websiteUrl || "");
  if (!url.includes("bannercross-pharmacy-sheffield")) return false;
  const town = String(snap.town || "");
  const address = String(snap.address || "");
  if (town || address) return true;
  const intel = snap.intelligence as Record<string, unknown> | undefined;
  const identity = (intel?.identity || {}) as Record<string, unknown>;
  const title = String(identity.title || "").toLowerCase();
  const resolved = String(identity.resolvedUrl || identity.websiteUrl || "");
  return title.includes("bannercross") || resolved.includes("bannercross-pharmacy-sheffield");
}

export async function runCanonicalWebsiteValidation(operator: string): Promise<{
  slug: string;
  passed: boolean;
  checks: Array<{ label: string; passed: boolean; detail: string }>;
  websiteSource: ReturnType<typeof buildWebsiteSourceSummary>;
}> {
  const editOutcome = await executeMasterAdminAction(
    "edit_canonical_website",
    BANNER_CROSS_SLUG,
    operator,
    { websiteUrl: BRANCH_URL },
  );
  if (!editOutcome.ok) throw new Error(editOutcome.error || "edit_canonical_website failed");

  const rerunOutcome = await executeMasterAdminAction("rerun_website_import", BANNER_CROSS_SLUG, operator);
  if (!rerunOutcome.ok) throw new Error(rerunOutcome.error || "rerun_website_import failed");
  const jobId = (rerunOutcome.result as { jobId?: string })?.jobId;
  if (!jobId) throw new Error("rerun_website_import did not return jobId");

  const deadline = Date.now() + 120000;
  let job = getMasterAdminJob(jobId);
  while (job && (job.status === "queued" || job.status === "running") && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, WORKER_POLL_INTERVAL_MS + 500));
    job = getMasterAdminJob(jobId);
  }

  const data = readSetupProfile(BANNER_CROSS_SLUG);
  const snap = data.websiteImportSnapshot as Record<string, unknown> | null | undefined;
  const wf = buildCustomerWorkflowState(BANNER_CROSS_SLUG, operator);
  const accountBefore = getCustomerAccountDetail(BANNER_CROSS_SLUG);
  const audit = listMasterAdminAudit({ slug: BANNER_CROSS_SLUG, limit: 15 });
  const websiteSource = buildWebsiteSourceSummary(BANNER_CROSS_SLUG);

  const snapUrl = String(snap?.websiteUrl || "");

  const checks = [
    {
      label: "Canonical website updated",
      passed: websiteSource.canonicalWebsite.includes("bannercross-pharmacy-sheffield"),
      detail: websiteSource.canonicalWebsite,
    },
    {
      label: "Website import job completed",
      passed: job?.status === "completed",
      detail: job?.status || "unknown",
    },
    {
      label: "Branch URL in import evidence",
      passed: snapUrl.includes("bannercross-pharmacy-sheffield"),
      detail: snapUrl,
    },
    {
      label: "Branch information replaces parent evidence",
      passed: branchEvidencePresent(snap),
      detail: branchEvidencePresent(snap) ? "Branch page intelligence present" : "missing branch signals",
    },
    {
      label: "Workflow at Google Import",
      passed: wf?.currentStage === "google_import",
      detail: wf?.currentStage || "unknown",
    },
    {
      label: "Customer account preserved",
      passed: accountBefore.hasAccount,
      detail: accountBefore.username || "missing",
    },
    {
      label: "Audit preserved",
      passed: audit.length >= 3,
      detail: `${audit.length} recent entries`,
    },
    {
      label: "Import history retained",
      passed: websiteSource.importHistoryCount >= 1,
      detail: `${websiteSource.importHistoryCount} archived snapshot(s)`,
    },
    {
      label: "Edit website action recorded",
      passed: audit.some((a) => a.action === "edit_canonical_website"),
      detail: (editOutcome.result as { canonicalWebsite?: string })?.canonicalWebsite || BRANCH_URL,
    },
  ];

  return {
    slug: BANNER_CROSS_SLUG,
    passed: checks.every((c) => c.passed),
    checks,
    websiteSource,
  };
}
