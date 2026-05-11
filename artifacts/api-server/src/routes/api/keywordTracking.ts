/**
 * Keyword Tracking routes
 *
 * GET  /api/keyword-tracking?projectSlug=   — read persisted report + available count
 * POST /api/keyword-tracking/run            — start async background check, returns jobId
 * GET  /api/keyword-tracking/job/:jobId     — poll job status / progress
 *
 * Keyword targets are loaded automatically from:
 *   output/<projectSlug>/selected-area-defs.json  (primaryKeyword + remotePath)
 *   config/projects/<projectSlug>.json            (domain for full URL)
 *
 * The run is async (fire-and-forget) so large keyword lists (100+) don't
 * time out the HTTP response. The dashboard polls the job endpoint until done.
 *
 * Ordering: hub pages checked first, then stale-first (oldest lastCheckedAt).
 */

import { Router }       from "express";
import path             from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID }   from "node:crypto";
import {
  runKeywordTracking,
  readKeywordReport,
  loadKeywordTargets,
} from "../../../../../src/tracking/keywordTrackingEngine";
import type { KeywordTrackingReport } from "../../../../../src/tracking/keywordTrackingTypes";

const __filename     = fileURLToPath(import.meta.url);
const __dirname      = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");
const CONFIG_DIR     = path.join(WORKSPACE_ROOT, "config", "projects");

const router = Router();

// ─── In-memory job store ──────────────────────────────────────────────────────

interface KtJob {
  status:    "running" | "done" | "error";
  startedAt: string;
  progress:  { done: number; total: number; current: string };
  report?:   KeywordTrackingReport;
  error?:    string;
}

const jobs = new Map<string, KtJob>();

// Prune jobs older than 2 hours
function pruneJobs(): void {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (new Date(job.startedAt).getTime() < cutoff) jobs.delete(id);
  }
}

// ─── GET /api/keyword-tracking ────────────────────────────────────────────────

router.get("/keyword-tracking", (req, res) => {
  const { projectSlug } = req.query as Record<string, string>;
  if (!projectSlug) {
    res.status(400).json({ error: "projectSlug is required" });
    return;
  }
  try {
    const report           = readKeywordReport(projectSlug, OUTPUT_DIR);
    const availableTargets = loadKeywordTargets(projectSlug, OUTPUT_DIR, CONFIG_DIR).length;
    res.json({ report, availableTargets });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ─── POST /api/keyword-tracking/run — async job ───────────────────────────────

router.post("/keyword-tracking/run", (req, res) => {
  const { projectSlug, delayMs } = req.body as {
    projectSlug: string;
    delayMs?:    number;
  };

  if (!projectSlug) {
    res.status(400).json({ error: "projectSlug is required" });
    return;
  }

  pruneJobs();
  const jobId    = randomUUID();
  const safeDelay = Math.max(delayMs ?? 2500, 1000);

  // Load all targets now so we know the total upfront
  const allTargets = loadKeywordTargets(projectSlug, OUTPUT_DIR, CONFIG_DIR);
  if (allTargets.length === 0) {
    res.status(400).json({ error: `No keyword targets found for "${projectSlug}". Run a rollout first.` });
    return;
  }

  // Order: hubs first, then stale-first (oldest lastCheckedAt)
  const existing = readKeywordReport(projectSlug, OUTPUT_DIR);
  const checkedAt = new Map<string, string>(
    (existing?.records ?? []).map(r => [r.keyword.toLowerCase(), r.lastCheckedAt ?? ""])
  );
  allTargets.sort((a, b) => {
    const aDate = checkedAt.get(a.keyword.toLowerCase()) ?? "";
    const bDate = checkedAt.get(b.keyword.toLowerCase()) ?? "";
    return aDate.localeCompare(bDate); // empty string sorts first (never checked)
  });

  const job: KtJob = {
    status:    "running",
    startedAt: new Date().toISOString(),
    progress:  { done: 0, total: allTargets.length, current: "" },
  };
  jobs.set(jobId, job);

  // Fire-and-forget: run all targets, updating job progress as we go
  (async () => {
    try {
      // Patch runKeywordTracking to accept a progress callback by using a
      // large limit (all targets) and checking progress via the callback shim.
      // We run all targets in one call (no cap) since it's now async.
      const report = await runKeywordTracking(
        projectSlug,
        allTargets,
        {
          limit:     allTargets.length, // no cap — run everything
          delayMs:   safeDelay,
          outputDir: OUTPUT_DIR,
          onProgress: (done: number, total: number, current: string) => {
            job.progress = { done, total, current };
          },
        },
      );
      job.status = "done";
      job.report = report;
    } catch (e: unknown) {
      job.status = "error";
      job.error  = (e as Error).message ?? "Unknown error";
    }
  })();

  res.json({ jobId, status: "running", total: allTargets.length });
});

// ─── GET /api/keyword-tracking/job/:jobId — poll ─────────────────────────────

router.get("/keyword-tracking/job/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found or expired" }); return; }
  if (job.status === "done")  { res.json({ status: "done",  progress: job.progress, report: job.report }); return; }
  if (job.status === "error") { res.json({ status: "error", error: job.error }); return; }
  res.json({ status: "running", progress: job.progress });
});

export default router;
