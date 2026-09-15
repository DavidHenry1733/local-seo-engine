import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "../../lib/logger";
import { runLiveGscRefreshPipeline, type LiveGscRefreshResult } from "../../../../../src/indexing/liveGscRefreshPipeline";

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? path.resolve(process.cwd(), "output");
const WORKSPACE_ROOT = process.cwd();

const router = Router();

const SLUG_RE = /^[a-z0-9_-]+$/i;
const JOB_TIMEOUT_MS = 15 * 60 * 1000;

type JobStatus = "running" | "done" | "error";

interface LiveRefreshJob {
  status: JobStatus;
  projectSlug: string;
  startedAt: string;
  result?: LiveGscRefreshResult;
  error?: string;
}

const jobs = new Map<string, LiveRefreshJob>();
const activeProjectJobs = new Map<string, string>();

function contractPath(projectSlug: string): string {
  return path.join(OUTPUT_DIR, projectSlug, "dashboard-seo-intelligence-contract.json");
}

function isValidSlug(projectSlug: string): boolean {
  return SLUG_RE.test(projectSlug);
}

function pruneOldJobs(): void {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (new Date(job.startedAt).getTime() < cutoff) jobs.delete(id);
  }
}

router.get("/dashboard-seo-intelligence", (req, res) => {
  const { projectSlug } = req.query as Record<string, string>;
  if (!projectSlug) {
    res.status(400).json({ error: "projectSlug is required" });
    return;
  }
  if (!isValidSlug(projectSlug)) {
    res.status(400).json({ error: "Invalid projectSlug" });
    return;
  }

  const file = contractPath(projectSlug);
  if (!fs.existsSync(file)) {
    res.status(404).json({
      error: "dashboard-seo-intelligence-contract.json not found. Build the SEO intelligence contract first.",
      projectSlug,
    });
    return;
  }

  try {
    res.json({ contract: JSON.parse(fs.readFileSync(file, "utf8")) });
  } catch (error) {
    res.status(500).json({
      error: (error as Error).message || "Failed to read dashboard-seo-intelligence-contract.json",
    });
  }
});

router.post("/dashboard-seo-intelligence/live-refresh", (req, res) => {
  const { projectSlug } = (req.body || {}) as { projectSlug?: string };
  if (!projectSlug) {
    res.status(400).json({ success: false, error: "projectSlug is required" });
    return;
  }
  if (!isValidSlug(projectSlug)) {
    res.status(400).json({ success: false, error: "Invalid projectSlug" });
    return;
  }

  pruneOldJobs();

  const existingJobId = activeProjectJobs.get(projectSlug);
  if (existingJobId) {
    const existing = jobs.get(existingJobId);
    if (existing?.status === "running") {
      res.status(409).json({
        success: false,
        error: "A live GSC refresh is already running for this project.",
        jobId: existingJobId,
        status: "running",
      });
      return;
    }
  }

  const jobId = randomUUID();
  const job: LiveRefreshJob = {
    status: "running",
    projectSlug,
    startedAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);
  activeProjectJobs.set(projectSlug, jobId);

  runLiveGscRefreshPipeline({
    projectSlug,
    outputDir: OUTPUT_DIR,
    workspaceRoot: WORKSPACE_ROOT,
    timeoutMs: JOB_TIMEOUT_MS,
  }).then((result) => {
    job.status = result.success ? "done" : "error";
    job.result = result;
    if (!result.success) job.error = result.error;
    activeProjectJobs.delete(projectSlug);

    const reportPath = path.join(OUTPUT_DIR, projectSlug, "live-gsc-index-refresh-report.json");
    try {
      fs.writeFileSync(reportPath, JSON.stringify({
        projectSlug,
        generatedAt: new Date().toISOString(),
        jobId,
        ...result,
      }, null, 2), "utf8");
    } catch { /* ignore report write errors */ }

    logger.info({
      projectSlug,
      jobId,
      success: result.success,
      runtimeMs: result.runtimeMs,
      scoreBefore: result.before.score,
      scoreAfter: result.after.score,
      indexedBefore: result.before.indexed,
      indexedAfter: result.after.indexed,
      lifecycleGapsBefore: result.before.lifecycleGaps,
      lifecycleGapsAfter: result.after.lifecycleGaps,
      gscPropertyUsed: result.gscPropertyUsed,
      error: result.error,
    }, "[liveGscRefresh] completed");
  }).catch((error: unknown) => {
    job.status = "error";
    job.error = (error as Error).message || "Live GSC refresh failed";
    activeProjectJobs.delete(projectSlug);
    logger.error({ projectSlug, jobId, err: error }, "[liveGscRefresh] failed");
  });

  res.json({ success: true, jobId, status: "running", projectSlug });
});

router.get("/dashboard-seo-intelligence/live-refresh/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ success: false, error: "Job not found or expired" });
    return;
  }

  if (job.status === "running") {
    const elapsed = Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000);
    res.json({ success: true, status: "running", projectSlug: job.projectSlug, elapsed });
    return;
  }

  if (job.status === "error") {
    res.json({
      success: false,
      status: "error",
      projectSlug: job.projectSlug,
      error: job.error || job.result?.error || "Live GSC refresh failed",
      ...(job.result || {}),
    });
    return;
  }

  res.json({
    success: job.result?.success ?? true,
    status: "done",
    ...(job.result || {}),
  });
});

export default router;
