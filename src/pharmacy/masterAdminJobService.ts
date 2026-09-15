/**
 * Master Admin Background Jobs V1 — long-running tasks run asynchronously.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { wakeMasterAdminJobWorkerAfterEnqueue } from "./masterAdminJobWorkerWakeService.ts";
import { executeMasterAdminAction } from "./masterAdminPlatformService.ts";
import { isCommercialPublishJobMeta } from "./masterAdminCommercialPublishReviewService.ts";

export type MasterAdminJobStatus = "queued" | "claimed" | "running" | "completed" | "failed";

export interface MasterAdminJob {
  id: string;
  slug: string;
  action: string;
  workflowStage?: string;
  scope?: string;
  serviceId?: string;
  campaignId?: string | null;
  initiationSource?: string;
  evidenceRevision?: string;
  brandRevision?: string;
  imageAssignmentRevision?: string | null;
  stage?: string;
  executionPayload?: Record<string, unknown>;
  status: MasterAdminJobStatus;
  progress: number;
  progressLabel: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  user: string;
  retryCount: number;
  parentJobId?: string;
  cancelledAt?: string;
  claimedBy?: string;
  claimedAt?: string;
  leaseExpiresAt?: string;
  nextRetryAt?: string;
  result?: unknown;
  error?: string;
  stackTrace?: string;
  evidence?: string;
  idempotencyKey?: string;
  sourceRevision?: string;
}

const JOBS_PATH = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "jobs.json");
const MAX_JOBS = 200;
const TERMINAL_JOB_STATUSES = new Set<MasterAdminJobStatus>(["completed", "failed"]);

type JobsStoreCache = {
  mtimeMs: number;
  jobs: MasterAdminJob[];
  byId: Map<string, MasterAdminJob>;
};

let jobsStoreCache: JobsStoreCache | null = null;

export function isTerminalMasterAdminJobStatus(status: string | undefined | null): boolean {
  return TERMINAL_JOB_STATUSES.has(String(status || "") as MasterAdminJobStatus);
}

export const LONG_RUNNING_MASTER_ADMIN_ACTIONS = new Set([
  "import_website",
  "import_google",
  "orchestrate_competitor_analysis",
  "orchestrate_local_market_intelligence",
  "orchestrate_growth_intelligence",
  "generate_ecosystem",
  "generate_service_page",
  "regenerate_service_page",
  "generate_local_cluster_pages",
  "regenerate_local_cluster_page",
  "regenerate_all_local_cluster_pages",
  "publish",
  "request_indexing",
  "init_rank_tracking",
  "health_refresh",
]);

export const WORKER_SUPPORTED_ACTIONS = new Set([
  ...LONG_RUNNING_MASTER_ADMIN_ACTIONS,
  "generate_growth_intelligence",
]);

export function getMasterAdminJobsStorePath(): string {
  return JOBS_PATH;
}

function rememberJobsStore(jobs: MasterAdminJob[], mtimeMs: number): JobsStoreCache {
  const clipped = jobs.slice(0, MAX_JOBS);
  jobsStoreCache = {
    mtimeMs,
    jobs: clipped,
    byId: new Map(clipped.map((job) => [job.id, job])),
  };
  return jobsStoreCache;
}

function readJobsStore(): JobsStoreCache {
  if (!fs.existsSync(JOBS_PATH)) {
    return rememberJobsStore([], 0);
  }
  try {
    const mtimeMs = fs.statSync(JOBS_PATH).mtimeMs;
    if (jobsStoreCache && jobsStoreCache.mtimeMs === mtimeMs) return jobsStoreCache;
    const raw = JSON.parse(fs.readFileSync(JOBS_PATH, "utf8")) as { jobs?: MasterAdminJob[] };
    return rememberJobsStore(Array.isArray(raw.jobs) ? raw.jobs : [], mtimeMs);
  } catch {
    return rememberJobsStore([], 0);
  }
}

function readJobs(): MasterAdminJob[] {
  return readJobsStore().jobs;
}

function writeJobs(jobs: MasterAdminJob[]): void {
  fs.mkdirSync(path.dirname(JOBS_PATH), { recursive: true });
  const clipped = jobs.slice(0, MAX_JOBS);
  fs.writeFileSync(
    JOBS_PATH,
    JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), jobs: clipped }, null, 2),
  );
  rememberJobsStore(clipped, fs.statSync(JOBS_PATH).mtimeMs);
}

function upsertJob(job: MasterAdminJob): void {
  const jobs = readJobs();
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) jobs[idx] = job;
  else jobs.unshift(job);
  writeJobs(jobs);
}

export function getMasterAdminJob(jobId: string): MasterAdminJob | null {
  const id = String(jobId || "").trim();
  if (!id) return null;
  return readJobsStore().byId.get(id) || null;
}

export function listMasterAdminJobs(options?: { slug?: string; limit?: number }): MasterAdminJob[] {
  let jobs = readJobs();
  if (options?.slug) jobs = jobs.filter((j) => j.slug === options.slug);
  const limit = Math.min(Math.max(options?.limit || 50, 1), 100);
  return jobs.slice(0, limit);
}

export function createMasterAdminJob(input: {
  slug: string;
  action: string;
  user: string;
  workflowStage?: string;
  idempotencyKey?: string;
  sourceRevision?: string;
}): MasterAdminJob {
  const job: MasterAdminJob = {
    id: randomUUID(),
    slug: input.slug,
    action: input.action,
    workflowStage: input.workflowStage,
    status: "queued",
    progress: 0,
    progressLabel: "Queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    user: input.user,
    retryCount: 0,
    idempotencyKey: input.idempotencyKey,
    sourceRevision: input.sourceRevision,
  };
  upsertJob(job);
  return job;
}

export function updateMasterAdminJob(jobId: string, patch: Partial<MasterAdminJob>): MasterAdminJob | null {
  return updateJob(jobId, patch);
}

export function completeMasterAdminJobIdempotently(
  jobId: string,
  evidence: string,
  result?: unknown,
): MasterAdminJob | null {
  const job = getMasterAdminJob(jobId);
  if (!job || (job.status !== "queued" && job.status !== "running")) return job;
  return updateJob(jobId, {
    status: "completed",
    progress: 100,
    progressLabel: "Completed (idempotent)",
    completedAt: new Date().toISOString(),
    evidence,
    result: result || { ok: true, idempotent: true },
  });
}

function updateJob(jobId: string, patch: Partial<MasterAdminJob>): MasterAdminJob | null {
  const jobs = readJobs();
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx < 0) return null;
  const next = { ...jobs[idx]!, ...patch, updatedAt: new Date().toISOString() };
  jobs[idx] = next;
  writeJobs(jobs);
  return next;
}

export function isLongRunningMasterAdminAction(actionId: string): boolean {
  return LONG_RUNNING_MASTER_ADMIN_ACTIONS.has(actionId);
}

/** Atomically claim the oldest queued job. Returns null if none or lost race. */
export function claimNextQueuedJob(workerId: string, leaseMs: number): MasterAdminJob | null {
  const jobs = readJobs();
  const candidates = jobs
    .filter((j) => j.status === "queued" && WORKER_SUPPORTED_ACTIONS.has(j.action))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (!candidates.length) return null;

  const target = candidates[0]!;
  const fresh = readJobs();
  const idx = fresh.findIndex((j) => j.id === target.id && j.status === "queued");
  if (idx < 0) return null;

  const now = new Date();
  const claimed: MasterAdminJob = {
    ...fresh[idx]!,
    status: "claimed",
    progress: 5,
    progressLabel: fresh[idx]!.stage?.replace(/-/g, " ") || "Claimed",
    startedAt: now.toISOString(),
    claimedBy: workerId,
    claimedAt: now.toISOString(),
    leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString(),
  };
  fresh[idx] = claimed;
  writeJobs(fresh);
  return claimed;
}

export function recoverStaleMasterAdminJobs(workerId: string): number {
  const jobs = readJobs();
  const now = Date.now();
  let recovered = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]!;
    if (job.status !== "running" && job.status !== "claimed") continue;
    const leaseExpired = job.leaseExpiresAt && new Date(job.leaseExpiresAt).getTime() < now;
    const staleNoLease =
      !job.leaseExpiresAt && job.startedAt && now - new Date(job.startedAt).getTime() > 10 * 60 * 1000;
    const staleClaimed =
      job.status === "claimed" &&
      job.claimedAt &&
      now - new Date(job.claimedAt).getTime() > 2 * 60 * 1000;
    if (!leaseExpired && !staleNoLease && !staleClaimed) continue;

    if (job.progress < 50) {
      jobs[i] = {
        ...job,
        status: "queued",
        progress: 0,
        progressLabel: "Queued (recovered)",
        claimedBy: undefined,
        claimedAt: undefined,
        leaseExpiresAt: undefined,
        startedAt: undefined,
        retryCount: (job.retryCount || 0) + 1,
        nextRetryAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      jobs[i] = {
        ...job,
        status: "failed",
        progress: 100,
        progressLabel: "Failed (stale lease)",
        completedAt: new Date().toISOString(),
        error: job.error || "Worker lease expired",
        updatedAt: new Date().toISOString(),
      };
    }
    recovered += 1;
  }

  if (recovered) writeJobs(jobs);
  void workerId;
  return recovered;
}

export async function executeClaimedMasterAdminJob(
  jobId: string,
  opts: { onProgress?: (progress: number, label: string) => void; body?: Record<string, unknown> } = {},
): Promise<MasterAdminJob | null> {
  const job = getMasterAdminJob(jobId);
  if (!job || (job.status !== "claimed" && job.status !== "running")) return job;

  const { isServicePageOnlyJob, executeServicePageOnlyJob } = await import("./masterAdminServicePageJobService.ts");
  if (isServicePageOnlyJob(job)) {
    return executeServicePageOnlyJob(jobId, {
      onProgress: (progress, label) => {
        opts.onProgress?.(progress, label);
        updateJob(jobId, { progress, progressLabel: label });
      },
      body: { ...(job.executionPayload || {}), ...(opts.body || {}) },
    });
  }

  const { isLocalClusterPagesJob, executeLocalClusterPagesJob } = await import("./masterAdminLocalClusterJobService.ts");
  if (isLocalClusterPagesJob(job)) {
    return executeLocalClusterPagesJob(jobId, {
      onProgress: (progress, label) => {
        opts.onProgress?.(progress, label);
        updateJob(jobId, { progress, progressLabel: label });
      },
      body: { ...(job.executionPayload || {}), ...(opts.body || {}) },
    });
  }

  if (job.status === "claimed") {
    updateJob(jobId, { status: "running" });
  }

  opts.onProgress?.(20, "Executing…");
  updateJob(jobId, { progress: 20, progressLabel: "Executing…" });

  try {
    if (job.action === "publish" && (job.idempotencyKey?.startsWith("commercial-publish:") || isCommercialPublishJobMeta(job.sourceRevision))) {
      const { executeCommercialPublishJob } = await import("./masterAdminCommercialPublishExecutionService.ts");
      const finished = await executeCommercialPublishJob(jobId, {
        onProgress: (progress, label) => opts.onProgress?.(progress, label),
      });
      if (finished?.status === "completed" && job.workflowStage) {
        const { finalizeWorkflowJob } = await import("./masterAdminWorkflowOrchestrator.ts");
        finalizeWorkflowJob(jobId);
        void import("./masterAdminOnboardingBatchService.ts").then(({ refreshOnboardingBatchStatus }) => {
          refreshOnboardingBatchStatus(job.slug);
        });
      } else if (finished?.status === "failed" && job.workflowStage) {
        const { finalizeWorkflowJob } = await import("./masterAdminWorkflowOrchestrator.ts");
        finalizeWorkflowJob(jobId);
      }
      return finished;
    }

    const outcome = await executeMasterAdminAction(job.action, job.slug, job.user, {
      ...(opts.body || {}),
      masterAdminJobId: jobId,
    });
    if (outcome.ok) {
      const completed = updateJob(jobId, {
        status: "completed",
        progress: 100,
        progressLabel: "Completed",
        completedAt: new Date().toISOString(),
        result: outcome.result,
        evidence: outcome.audit.evidence,
        leaseExpiresAt: undefined,
      });
      if (job.workflowStage) {
        const { finalizeWorkflowJob } = await import("./masterAdminWorkflowOrchestrator.ts");
        finalizeWorkflowJob(jobId);
        void import("./masterAdminOnboardingBatchService.ts").then(({ refreshOnboardingBatchStatus }) => {
          refreshOnboardingBatchStatus(job.slug);
        });
      }
      return completed;
    }

    const failed = updateJob(jobId, {
      status: "failed",
      progress: 100,
      progressLabel: "Failed",
      completedAt: new Date().toISOString(),
      error: outcome.error || "Action failed",
      result: outcome.result,
      evidence: outcome.audit.evidence,
      leaseExpiresAt: undefined,
    });
    if (job.workflowStage) {
      const { finalizeWorkflowJob } = await import("./masterAdminWorkflowOrchestrator.ts");
      finalizeWorkflowJob(jobId);
      void import("./masterAdminOnboardingBatchService.ts").then(({ refreshOnboardingBatchStatus }) => {
        refreshOnboardingBatchStatus(job.slug);
      });
    }
    return failed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stackTrace = err instanceof Error ? err.stack || message : message;
    const failed = updateJob(jobId, {
      status: "failed",
      progress: 100,
      progressLabel: "Failed",
      completedAt: new Date().toISOString(),
      error: message,
      stackTrace,
      leaseExpiresAt: undefined,
    });
    if (job.workflowStage) {
      const { finalizeWorkflowJob } = await import("./masterAdminWorkflowOrchestrator.ts");
      finalizeWorkflowJob(jobId);
      void import("./masterAdminOnboardingBatchService.ts").then(({ refreshOnboardingBatchStatus }) => {
        refreshOnboardingBatchStatus(job.slug);
      });
    }
    return failed;
  }
}

/** Queue job and wake the persistent worker — does not execute in-process. */
export function runMasterAdminJobAsync(
  jobId: string,
  body: Record<string, unknown> = {},
  _meta: { workflowStage?: string } = {},
): void {
  const existing = getMasterAdminJob(jobId);
  if (existing) {
    updateJob(jobId, {
      executionPayload: { ...(existing.executionPayload || {}), ...body },
    });
  }
  void _meta;
  wakeMasterAdminJobWorkerAfterEnqueue();
}

export function listActiveMasterAdminJobs(): MasterAdminJob[] {
  return readJobs().filter((j) => j.status === "queued" || j.status === "claimed" || j.status === "running");
}

export function cancelMasterAdminJob(jobId: string, user: string): MasterAdminJob | null {
  const job = getMasterAdminJob(jobId);
  if (!job) return null;
  if (job.status !== "queued") throw new Error("Only queued jobs can be cancelled");
  return updateJob(jobId, {
    status: "failed",
    progressLabel: "Cancelled",
    cancelledAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    error: `Cancelled by ${user}`,
    evidence: "Job cancelled before execution",
  });
}

/** Re-queue an existing failed job by id — no replacement job record. */
export function requeueExistingMasterAdminJob(jobId: string): MasterAdminJob | null {
  const job = getMasterAdminJob(jobId);
  if (!job) return null;
  if (job.status !== "failed") throw new Error("Only failed jobs can be requeued in place");

  const requeued = updateJob(jobId, {
    status: "queued",
    progress: 0,
    progressLabel: "Queued (recovered)",
    startedAt: undefined,
    completedAt: undefined,
    claimedBy: undefined,
    claimedAt: undefined,
    leaseExpiresAt: undefined,
    error: undefined,
    stackTrace: undefined,
    result: undefined,
    evidence: undefined,
    nextRetryAt: new Date().toISOString(),
  });
  if (requeued) runMasterAdminJobAsync(requeued.id, {});
  return requeued;
}

export function retryMasterAdminJob(jobId: string, user: string, body: Record<string, unknown> = {}): MasterAdminJob {
  const job = getMasterAdminJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status !== "failed") throw new Error("Only failed jobs can be retried");
  if (job.status === "completed") throw new Error("Completed jobs cannot be retried");

  const retry = createMasterAdminJob({
    slug: job.slug,
    action: job.action,
    user,
    workflowStage: job.workflowStage,
  });
  updateJob(retry.id, { retryCount: (job.retryCount || 0) + 1, parentJobId: job.id });
  runMasterAdminJobAsync(retry.id, body, { workflowStage: job.workflowStage });
  return retry;
}
