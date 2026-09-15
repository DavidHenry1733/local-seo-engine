/**
 * NT-E2E-06 — workflow blocker resolver for support issues (stale vs genuine).
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import {
  buildBusinessProfileReview,
  isBusinessProfileReviewApproved,
} from "./masterAdminBusinessProfileReviewService.ts";
import {
  resolveGoogleProfileOnboardingState,
  shouldRunGoogleImport,
} from "./masterAdminGoogleProfileOnboardingService.ts";
import { getMasterAdminIssue, listMasterAdminIssueSummaries } from "./masterAdminIssueService.ts";
import type { MasterAdminIssueListSummary } from "./masterAdminIssueModel.ts";
import { WORKFLOW_STAGE_ORDER, type WorkflowStageId } from "./masterAdminWorkflowModel.ts";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { listMasterAdminJobs } from "./masterAdminJobService.ts";
import { readManagedPublishingProfile } from "./masterAdminManagedPublishingService.ts";

function readLatestPublishSnapshot(slug: string): {
  jobId?: string;
  releaseId?: string;
  currentRelease?: string;
  completedAt?: string;
} | null {
  const file = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/commercial-publish",
    safeAdminSlug(slug),
    "latest.json",
  );
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as {
      jobId?: string;
      releaseId?: string;
      currentRelease?: string;
      completedAt?: string;
    };
  } catch {
    return null;
  }
}

const STALE_BPR_GOOGLE_EVIDENCE = /missing source evidence|google intelligence|missing google/i;

function stageIndex(stageId: WorkflowStageId): number {
  const idx = WORKFLOW_STAGE_ORDER.indexOf(stageId as (typeof WORKFLOW_STAGE_ORDER)[number]);
  return idx >= 0 ? idx : -1;
}

function isPostBusinessProfileApprovalStage(stageId: WorkflowStageId): boolean {
  const gi = stageIndex("generate_growth_intelligence");
  const current = stageIndex(stageId);
  return current >= gi && gi >= 0;
}

function isBusinessProfileReviewIssue(issue: MasterAdminIssueListSummary): boolean {
  if (issue.category !== "Onboarding") return false;
  if (/business profile review/i.test(issue.title)) return true;
  const full = getMasterAdminIssue(issue.issueId);
  return full?.affectedPageOrModule === "Business Profile Review";
}

function issueText(issue: MasterAdminIssueListSummary): string {
  return `${issue.title} ${issue.description || ""}`;
}

function isPublishFailureIssue(issue: MasterAdminIssueListSummary): boolean {
  if (issue.category === "Publishing") return true;
  const text = issueText(issue);
  return (
    /commercial publish failed/i.test(text) ||
    /workflow failed:\s*publish/i.test(text) ||
    /connection lost before handshake/i.test(text) ||
    /getconnection:/i.test(text)
  );
}

/**
 * Historical publish failures remain auditable, but must not block readiness once a
 * newer successful current release has completed for the same tenant.
 */
export function isSupersededPublishFailureIssue(
  slug: string,
  issue: MasterAdminIssueListSummary,
): boolean {
  if (!isPublishFailureIssue(issue)) return false;
  const managed = readManagedPublishingProfile(slug);
  const snapshot = readLatestPublishSnapshot(slug);
  const currentRelease = managed?.currentRelease || snapshot?.currentRelease || snapshot?.releaseId || null;
  const completedAt = snapshot?.completedAt || null;
  if (!currentRelease || !completedAt) return false;
  if (completedAt <= (issue.createdAt || "")) return false;
  if ((snapshot?.releaseId || snapshot?.currentRelease) && (snapshot.releaseId || snapshot.currentRelease) !== currentRelease) {
    return false;
  }

  const jobs = listMasterAdminJobs({ slug, limit: 50 }).filter(
    (j) => j.action === "publish" && j.status === "completed",
  );
  return jobs.some((job) => {
    const result = (job.result || {}) as {
      releaseId?: string;
      snapshot?: { releaseId?: string; currentRelease?: string };
    };
    const jobRelease =
      result.releaseId || result.snapshot?.releaseId || result.snapshot?.currentRelease || null;
    const jobCompleted = job.completedAt || job.updatedAt || "";
    if (jobCompleted <= (issue.createdAt || "")) return false;
    if (snapshot?.jobId && job.id === snapshot.jobId) return true;
    return jobRelease === currentRelease;
  });
}

export function isWorkflowIssueStillBlocking(
  slug: string,
  issue: MasterAdminIssueListSummary,
  stageId: WorkflowStageId,
): boolean {
  if (!["Critical", "High"].includes(issue.severity)) return false;
  if (["Closed", "Passed"].includes(issue.status)) return false;

  // CPR-INDEXING-ENTRY-HOTFIX-01 — superseded publish failures must not block post-publish stages.
  if (isSupersededPublishFailureIssue(slug, issue)) {
    return false;
  }

  const bprApproved = isBusinessProfileReviewApproved(slug);
  const profile = readSetupProfile(slug);
  const googleState = resolveGoogleProfileOnboardingState(profile);

  if (isBusinessProfileReviewIssue(issue)) {
    if (bprApproved && isPostBusinessProfileApprovalStage(stageId)) {
      return false;
    }

    if (bprApproved && !shouldRunGoogleImport(googleState) && STALE_BPR_GOOGLE_EVIDENCE.test(issueText(issue))) {
      return false;
    }

    if (bprApproved && /failed to load|data unavailable|missing source evidence/i.test(issue.title)) {
      const review = buildBusinessProfileReview(slug);
      if (!review.loadError && review.missingSources.length === 0) {
        return false;
      }
    }
  }

  return true;
}

export function listWorkflowBlockingIssues(
  slug: string,
  stageId: WorkflowStageId,
): MasterAdminIssueListSummary[] {
  return listMasterAdminIssueSummaries().filter(
    (issue) => issue.tenantSlug === slug && isWorkflowIssueStillBlocking(slug, issue, stageId),
  );
}

export function resolveWorkflowIssueBlockers(
  slug: string,
  stageId: WorkflowStageId,
): { blocked: boolean; blockingIssues: MasterAdminIssueListSummary[]; reason: string | null } {
  const blockingIssues = listWorkflowBlockingIssues(slug, stageId);
  if (!blockingIssues.length) {
    return { blocked: false, blockingIssues: [], reason: null };
  }
  const top = blockingIssues[0]!;
  return {
    blocked: true,
    blockingIssues,
    reason: `Outstanding critical/high support issues block workflow progression (${top.issueId}: ${top.title})`,
  };
}
