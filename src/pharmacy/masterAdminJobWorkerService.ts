/**
 * Master Admin Background Job Worker V1 — persistent queue processor.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  claimNextQueuedJob,
  executeClaimedMasterAdminJob,
  getMasterAdminJob,
  getMasterAdminJobsStorePath,
  listMasterAdminJobs,
  recoverStaleMasterAdminJobs,
  updateMasterAdminJob,
  type MasterAdminJob,
} from "./masterAdminJobService.ts";
import { registerMasterAdminJobWorkerWake } from "./masterAdminJobWorkerWakeService.ts";

export const WORKER_HEALTH_PATH = path.join(
  WORKSPACE_ROOT,
  "data",
  "pharmacy-master-admin",
  "job-worker-health.json",
);

export const WORKER_POLL_INTERVAL_MS = 5000;
export const WORKER_LEASE_MS = 5 * 60 * 1000;

export interface MasterAdminJobWorkerHealth {
  version: 1;
  workerId: string;
  status: "active" | "stopped";
  startedAt: string;
  lastHeartbeat: string;
  lastPoll: string | null;
  lastClaimedJobId: string | null;
  lastCompletedJobId: string | null;
  lastFailedJobId: string | null;
  jobsProcessed: number;
  currentJobId: string | null;
  queueDepth: number;
  pollIntervalMs: number;
  jobsStorePath: string;
  pid: number;
  hostname: string;
}

let workerStarted = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;
let processing = false;
let jobsProcessed = 0;

const workerId = `${os.hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
const workerStartedAt = new Date().toISOString();

function queueDepth(): number {
  return listMasterAdminJobs({ limit: 200 }).filter((j) => j.status === "queued").length;
}

function writeWorkerHealth(patch: Partial<MasterAdminJobWorkerHealth> & { currentJobId?: string | null }): void {
  const existing = readMasterAdminJobWorkerHealth();
  const health: MasterAdminJobWorkerHealth = {
    version: 1,
    workerId,
    status: workerStarted ? "active" : "stopped",
    startedAt: workerStartedAt,
    lastHeartbeat: new Date().toISOString(),
    lastPoll: patch.lastPoll ?? existing?.lastPoll ?? null,
    lastClaimedJobId: patch.lastClaimedJobId ?? existing?.lastClaimedJobId ?? null,
    lastCompletedJobId: patch.lastCompletedJobId ?? existing?.lastCompletedJobId ?? null,
    lastFailedJobId: patch.lastFailedJobId ?? existing?.lastFailedJobId ?? null,
    jobsProcessed: patch.jobsProcessed ?? existing?.jobsProcessed ?? jobsProcessed,
    currentJobId: patch.currentJobId !== undefined ? patch.currentJobId : existing?.currentJobId ?? null,
    queueDepth: queueDepth(),
    pollIntervalMs: WORKER_POLL_INTERVAL_MS,
    jobsStorePath: getMasterAdminJobsStorePath(),
    pid: process.pid,
    hostname: os.hostname(),
  };
  fs.mkdirSync(path.dirname(WORKER_HEALTH_PATH), { recursive: true });
  fs.writeFileSync(WORKER_HEALTH_PATH, JSON.stringify(health, null, 2));
}

export function readMasterAdminJobWorkerHealth(): MasterAdminJobWorkerHealth | null {
  if (!fs.existsSync(WORKER_HEALTH_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(WORKER_HEALTH_PATH, "utf8")) as MasterAdminJobWorkerHealth;
  } catch {
    return null;
  }
}

async function processOneJob(): Promise<boolean> {
  const claimed = claimNextQueuedJob(workerId, WORKER_LEASE_MS);
  if (!claimed) return false;

  writeWorkerHealth({ lastPoll: new Date().toISOString(), lastClaimedJobId: claimed.id, currentJobId: claimed.id });

  const { isServicePageOnlyJob } = await import("./masterAdminServicePageJobService.ts");
  if (claimed.workflowStage && !isServicePageOnlyJob(claimed)) {
    try {
      const { markWorkflowExecutionRunning } = await import("./masterAdminWorkflowHistoryService.ts");
      markWorkflowExecutionRunning(claimed.slug, claimed.workflowStage, claimed.action, claimed.id);
    } catch {
      /* non-fatal */
    }
  }

  try {
    const finished = await executeClaimedMasterAdminJob(claimed.id, {
      onProgress: (progress, label) => {
        writeWorkerHealth({ currentJobId: claimed.id });
        updateMasterAdminJob(claimed.id, { progress, progressLabel: label });
      },
      body: claimed.executionPayload || {},
    });
    jobsProcessed += 1;
    if (finished?.status === "completed") {
      writeWorkerHealth({
        lastCompletedJobId: finished.id,
        currentJobId: null,
        jobsProcessed,
      });
    } else if (finished?.status === "failed") {
      writeWorkerHealth({
        lastFailedJobId: finished.id,
        currentJobId: null,
        jobsProcessed,
      });
    } else {
      writeWorkerHealth({ currentJobId: null, jobsProcessed });
    }
    return true;
  } catch (err) {
    jobsProcessed += 1;
    writeWorkerHealth({
      lastFailedJobId: claimed.id,
      currentJobId: null,
      jobsProcessed,
    });
    const job = getMasterAdminJob(claimed.id);
    if (job?.workflowStage && !isServicePageOnlyJob(job)) {
      const { finalizeWorkflowJob } = await import("./masterAdminWorkflowOrchestrator.ts");
      finalizeWorkflowJob(claimed.id);
    }
    void err;
    return true;
  }
}

async function pollOnce(): Promise<void> {
  if (processing) return;
  processing = true;
  writeWorkerHealth({ lastPoll: new Date().toISOString() });

  try {
    recoverStaleMasterAdminJobs(workerId);
    let safety = 10;
    while (safety-- > 0) {
      const ran = await processOneJob();
      if (!ran) break;
    }
  } finally {
    processing = false;
    writeWorkerHealth({});
  }
}

export function wakeMasterAdminJobWorker(): void {
  if (!workerStarted) {
    startMasterAdminJobWorker();
  }
  recoverStaleMasterAdminJobs(workerId);
  void pollOnce();
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeTimer = setTimeout(() => {
    void pollOnce();
  }, 250);
}

export function startMasterAdminJobWorker(): void {
  if (workerStarted) {
    void pollOnce();
    return;
  }
  workerStarted = true;

  recoverStaleMasterAdminJobs(workerId);
  writeWorkerHealth({ lastPoll: null, currentJobId: null, jobsProcessed: 0 });

  void pollOnce();

  pollTimer = setInterval(() => {
    writeWorkerHealth({});
    void pollOnce();
  }, WORKER_POLL_INTERVAL_MS);

  if (typeof pollTimer.unref === "function") pollTimer.unref();
}

registerMasterAdminJobWorkerWake(() => {
  startMasterAdminJobWorker();
  wakeMasterAdminJobWorker();
});

/** Force immediate queue processing — used for recovery of orphaned queued jobs. */
export async function nudgeMasterAdminJobQueue(): Promise<{ claimed: boolean; jobId: string | null }> {
  if (!workerStarted) startMasterAdminJobWorker();
  recoverStaleMasterAdminJobs(workerId);
  const before = listMasterAdminJobs({ limit: 20 }).filter((j) => j.status === "queued");
  await pollOnce();
  const after = listMasterAdminJobs({ limit: 20 }).filter((j) => j.status === "queued");
  const claimed = before.length > after.length;
  const jobId = claimed ? before[0]?.id || null : null;
  return { claimed, jobId };
}

export function stopMasterAdminJobWorker(): void {
  workerStarted = false;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  writeWorkerHealth({ currentJobId: null });
  const health = readMasterAdminJobWorkerHealth();
  if (health) {
    health.status = "stopped";
    fs.writeFileSync(WORKER_HEALTH_PATH, JSON.stringify(health, null, 2));
  }
}

export function traceQueuedJob(jobId: string): Record<string, unknown> | null {
  const job = getMasterAdminJob(jobId);
  if (!job) return null;
  const health = readMasterAdminJobWorkerHealth();
  return {
    jobId: job.id,
    tenantSlug: job.slug,
    action: job.action,
    workflowStage: job.workflowStage || null,
    createdAt: job.createdAt,
    queueStorePath: getMasterAdminJobsStorePath(),
    status: job.status,
    claimedBy: job.claimedBy || null,
    claimedAt: job.claimedAt || null,
    startedAt: job.startedAt || null,
    progress: job.progress,
    retryCount: job.retryCount,
    nextRetryAt: job.nextRetryAt || null,
    latestError: job.error || null,
    workerProcessExpected: "pharmaconnect-growth-engine (in-process worker)",
    workerStartupPath: "artifacts/api-server/src/index.ts → startMasterAdminJobWorker()",
    workerPollingMs: WORKER_POLL_INTERVAL_MS,
    workerHealthPath: WORKER_HEALTH_PATH,
    workerHealth: health,
    finalisationCallback: "finalizeWorkflowJob(jobId)",
  };
}

export async function queueInternalValidationJob(user: string): Promise<MasterAdminJob> {
  const { createMasterAdminJob, runMasterAdminJobAsync } = await import("./masterAdminJobService.ts");
  const job = createMasterAdminJob({
    slug: "pharmaconnect",
    action: "health_refresh",
    user,
  });
  runMasterAdminJobAsync(job.id, {}, {});
  return job;
}
