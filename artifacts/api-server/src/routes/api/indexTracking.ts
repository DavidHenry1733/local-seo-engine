/**
 * Index Tracking routes
 *
 * GET  /api/index-tracking/credentials  — auth status
 * GET  /api/index-tracking?projectSlug= — read persisted report
 * POST /api/index-tracking/run          — start async check job, returns { jobId }
 * GET  /api/index-tracking/job/:jobId   — poll job status
 *
 * Safety:
 *   - Default limit: 50 URLs per run  (GSC quota: 2 000 req/day)
 *   - Default delay: 300 ms between requests
 *   - Maximum limit capped at 200 per API call
 *
 * The run is intentionally async because the Replit proxy has a 120-second
 * request timeout and checking 19 URLs via the GSC API takes ~2 minutes.
 */

import { Router }        from "express";
import path              from "node:path";
import { randomUUID }    from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  runIndexTracking,
  readTrackingReport,
  detectAuthMethod,
} from "../../../../../src/indexing/indexTrackingEngine";
import { loadOAuthTokens } from "./gscAuth";
import type { IndexTrackingReport } from "../../../../../src/indexing/indexTrackingTypes";

const __filename     = fileURLToPath(import.meta.url);
const __dirname      = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");

const router = Router();

// ─── In-memory job store ──────────────────────────────────────────────────────

type JobStatus = "running" | "done" | "error";

interface Job {
  status:    JobStatus;
  startedAt: string;
  report?:   IndexTrackingReport;
  error?:    string;
}

const jobs = new Map<string, Job>();

// Clean up jobs older than 30 minutes to avoid memory leaks
function pruneOldJobs() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (new Date(job.startedAt).getTime() < cutoff) jobs.delete(id);
  }
}

// ─── GET /api/index-tracking/credentials ────────────────────────────────────

router.get("/index-tracking/credentials", (_req, res) => {
  const method = detectAuthMethod();

  let email: string | null = null;
  if (method === "service_account") {
    try {
      const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "") as { client_email?: string };
      email = sa.client_email ?? null;
    } catch { /* ignore */ }
  }

  const clientConfigured = !!(process.env.GSC_OAUTH_CLIENT_ID && process.env.GSC_OAUTH_CLIENT_SECRET);

  res.json({
    configured:     method !== "none",
    method,
    email,
    clientConfigured,
    oauthConnected: !!loadOAuthTokens(),
  });
});

// ─── GET /api/index-tracking ──────────────────────────────────────────────────

router.get("/index-tracking", async (req, res) => {
  const { projectSlug } = req.query as Record<string, string>;
  if (!projectSlug) {
    res.status(400).json({ error: "projectSlug is required" });
    return;
  }
  try {
    const report = readTrackingReport(projectSlug, OUTPUT_DIR);
    res.json({ report });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ─── POST /api/index-tracking/run ────────────────────────────────────────────
// Returns immediately with { jobId } — client must poll /job/:jobId

router.post("/index-tracking/run", (req, res) => {
  const { projectSlug, limit, delayMs, concurrency } = req.body as {
    projectSlug:   string;
    limit?:        number;
    delayMs?:      number;
    concurrency?:  number;
  };

  if (!projectSlug) {
    res.status(400).json({ error: "projectSlug is required" });
    return;
  }

  const safeLimit       = Math.min(limit       ?? 200, 500);
  const safeDelayMs     = Math.max(delayMs     ?? 500, 100);
  const safeConcurrency = Math.max(1, Math.min(concurrency ?? 5, 10));

  pruneOldJobs();

  const jobId = randomUUID();
  const job: Job = { status: "running", startedAt: new Date().toISOString() };
  jobs.set(jobId, job);

  // Fire and forget — updates job in place when done
  runIndexTracking(projectSlug, {
    limit:       safeLimit,
    delayMs:     safeDelayMs,
    concurrency: safeConcurrency,
    outputDir:   OUTPUT_DIR,
  }).then(report => {
    job.status = "done";
    job.report = report;
  }).catch((e: unknown) => {
    job.status = "error";
    job.error  = (e as Error).message ?? "Unknown error";
  });

  res.json({ jobId, status: "running" });
});

// ─── GET /api/index-tracking/job/:jobId ──────────────────────────────────────

router.get("/index-tracking/job/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found or expired" });
    return;
  }
  if (job.status === "done") {
    res.json({ status: "done", report: job.report });
  } else if (job.status === "error") {
    res.json({ status: "error", error: job.error });
  } else {
    const elapsed = Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000);
    res.json({ status: "running", elapsed });
  }
});

export default router;
