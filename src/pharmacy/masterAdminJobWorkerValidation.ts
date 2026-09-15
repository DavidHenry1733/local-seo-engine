/**
 * Sprint 7A Defect 037 — background job worker validation.
 */
import { buildCustomerWorkflowState } from "./masterAdminWorkflowEngine.ts";
import {
  getMasterAdminJob,
  listMasterAdminJobs,
} from "./masterAdminJobService.ts";
import {
  queueInternalValidationJob,
  readMasterAdminJobWorkerHealth,
  traceQueuedJob,
  WORKER_POLL_INTERVAL_MS,
} from "./masterAdminJobWorkerService.ts";

const BANNER_CROSS_SLUG = "banner-cross-pharmacy";
const BANNER_CROSS_JOB_ID = "9a8e1730-44c0-4ca8-9fa0-b3d403582bb9";

export async function runBackgroundJobWorkerValidation(user: string): Promise<{
  bannerCrossJobId: string;
  trace: Record<string, unknown> | null;
  workerHealth: ReturnType<typeof readMasterAdminJobWorkerHealth>;
  passed: boolean;
  checks: Array<{ label: string; passed: boolean; detail: string }>;
}> {
  const trace = traceQueuedJob(BANNER_CROSS_JOB_ID);
  const bannerJob = getMasterAdminJob(BANNER_CROSS_JOB_ID);
  const wf = buildCustomerWorkflowState(BANNER_CROSS_SLUG, user);
  const duplicateJobs = listMasterAdminJobs({ slug: BANNER_CROSS_SLUG, limit: 20 }).filter(
    (j) => j.action === "import_website",
  );

  let validationJobId: string | null = null;
  const healthBefore = readMasterAdminJobWorkerHealth();
  if (healthBefore?.status === "active") {
    const vJob = await queueInternalValidationJob(user);
    validationJobId = vJob.id;
    await new Promise((r) => setTimeout(r, WORKER_POLL_INTERVAL_MS + 1500));
  }

  const workerHealth = readMasterAdminJobWorkerHealth();
  const validationJob = validationJobId ? getMasterAdminJob(validationJobId) : null;
  const queueDepth = listMasterAdminJobs({ limit: 50 }).filter((j) => j.status === "queued").length;

  const checks = [
    {
      label: "Banner Cross job exists",
      passed: Boolean(bannerJob),
      detail: bannerJob?.id || "missing",
    },
    {
      label: "Banner Cross import_website completed",
      passed: bannerJob?.status === "completed",
      detail: bannerJob?.status || "missing",
    },
    {
      label: "No duplicate import_website jobs",
      passed: duplicateJobs.length === 1,
      detail: `${duplicateJobs.length} job(s)`,
    },
    {
      label: "Workflow advanced to Google Import",
      passed: wf?.currentStage === "google_import",
      detail: wf?.currentStage || "unknown",
    },
    {
      label: "Worker heartbeat active",
      passed: workerHealth?.status === "active" && Boolean(workerHealth.lastHeartbeat),
      detail: workerHealth?.lastHeartbeat || "missing",
    },
    {
      label: "Worker processed validation job",
      passed: !validationJobId || validationJob?.status === "completed",
      detail: validationJob?.status || "skipped",
    },
    {
      label: "Worker remains active after jobs",
      passed: workerHealth?.status === "active",
      detail: workerHealth?.status || "missing",
    },
  ];

  if (trace) {
    console.log("DEFECT 037 TRACE", JSON.stringify(trace, null, 2));
  }

  return {
    bannerCrossJobId: BANNER_CROSS_JOB_ID,
    trace,
    workerHealth,
    passed: checks.every((c) => c.passed),
    checks,
  };
}
