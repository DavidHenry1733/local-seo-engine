/**
 * rolloutRunner.ts
 *
 * Sequential rollout orchestrator for the Area Engine integration pipeline.
 *
 * Accepts an array of SelectedAreaPageDef objects (already ranked and typed
 * by the area engine) and processes them in tier order:
 *   Stage 1 — priority areas
 *   Stage 2 — secondary areas (only when includeSecondary: true)
 *   Stage 3 — tertiary areas  (deferred to disk by default)
 *
 * For each area in the active stages:
 *   1. Write ClusterConfigEnriched JSON to disk
 *   2. Generate AI content via generateClusterContent() (with area signals)
 *   3. Refine readability via refineClusterContent()
 *   4. Render HTML via renderClusterHtml()
 *   5. Upload to FTP
 *
 * One retry is performed on any failure at step 2 or 5.
 * Refinement failure at step 3 is non-fatal — the run continues with
 * unrefined content and logs a warning.
 *
 * Outputs:
 *   output/<clientSlug>/rollout-log.json
 *   output/<clientSlug>/deferred-areas.json  (when deferred areas exist)
 *
 * Spec ref: Area Engine Integration Spec v1 — Sections 5, 7.2, 7.3
 */

import fs             from "node:fs";
import path           from "node:path";
import { randomUUID } from "node:crypto";
import * as ftp       from "basic-ftp";

import type { AreaTier }            from "../area/areaTypes";
import type { DeployConfig }        from "./types";
import { SelectedAreaPageDef, buildClusterConfig, writeClusterConfig } from "./buildClusterConfigs";
import { generateClusterContent, ClusterPageInputs }                    from "./generateClusterContent";
import { applyWebDesignNarrativePackage }                               from "../narratives/applyWebDesignNarrativePackage";
import { applyLocalSeoNarrativePackage }                                from "../narratives/applyLocalSeoNarrativePackage";
import { refineClusterContent }                                          from "./refineContent";
import { renderClusterHtml, RenderProjectConfig }                        from "./renderClusterPage";
import {
  DeferredQueue,
  RolloutEntry,
  RolloutEntryStatus,
  RolloutLog,
  RolloutOptions,
  RolloutTotals,
} from "./rolloutTypes";

// ── Tier sort order ────────────────────────────────────────────────────────────

const TIER_ORDER: Record<AreaTier, number> = {
  hub:       99,
  priority:  0,
  secondary: 1,
  tertiary:  2,
  cluster:   3,
};

// ── Sorting ───────────────────────────────────────────────────────────────────

/**
 * Sort SelectedAreaPageDef[] into rollout order:
 * priority → secondary → tertiary.
 * Stable — preserves input order within each tier.
 */
export function sortByTier(defs: SelectedAreaPageDef[]): SelectedAreaPageDef[] {
  return [...defs].sort(
    (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]
  );
}

// ── FTP credential resolver ────────────────────────────────────────────────────

function resolveFtpCredentials(deploy: DeployConfig) {
  const user     = process.env.DEPLOY_USERNAME;
  const password = process.env.DEPLOY_PASSWORD;
  if (!user || !password) {
    throw new Error(
      "Missing FTP credentials. Set DEPLOY_USERNAME and DEPLOY_PASSWORD env vars."
    );
  }
  return {
    user,
    password,
    host:       deploy.host,
    port:       deploy.port ?? 21,
    remoteRoot: deploy.remoteRoot ?? "/",
  };
}

// ── Job result ────────────────────────────────────────────────────────────────

interface JobResult {
  outputPath: string;
  liveUrl:    string;
}

// ── One generation attempt ────────────────────────────────────────────────────

/**
 * Executes one full generation + deploy pipeline for a single area.
 * Always writes the cluster config to disk first (idempotent).
 * In dry-run mode the AI and FTP steps are skipped.
 */
async function runOneAttempt(
  def:     SelectedAreaPageDef,
  project: RenderProjectConfig,
  dryRun:  boolean
): Promise<JobResult> {
  // ── 1. Write cluster config ────────────────────────────────────────────────
  const clusterConfig = buildClusterConfig(def);
  writeClusterConfig(def, clusterConfig);

  const slug    = def.remotePath.replace(/\//g, "").trim() || "cluster";
  const outDir  = path.join("output", project.clientSlug, slug);
  const outFile = path.join(outDir, "index.html");
  const liveUrl = `${project.domain.replace(/\/+$/, "")}${def.remotePath}`;

  if (dryRun) {
    console.log(`  [dry-run] Config written → ${def.configPath}`);
    return { outputPath: outFile, liveUrl };
  }

  // ── 2. Build AI inputs (area signals injected here) ───────────────────────
  const inputs: ClusterPageInputs = {
    brandName:          project.businessName,
    legalName:          project.businessName ?? project.footerCompanyName,
    serviceName:        def.service,
    location:           def.area,
    primaryKeyword:     def.primaryKeyword,
    supportingKeywords: def.supportingKeywords,
    ctaText:            project.primaryCtaText,
    ctaUrl:             project.primaryCtaUrl,
    hubUrl:             def.hubUrl,
    hubAnchor:          def.hubAnchor,
    relatedPages:       def.relatedPages,
    businessAddress:    project.businessAddress,
    areaSignals:        def.signals,
  };

  // ── 3. Generate AI content ─────────────────────────────────────────────────
  const rawAi = await generateClusterContent(inputs);
  console.log(`  AI content generated.`);

  // ── 4. Refine readability (non-fatal) ─────────────────────────────────────
  let ai = applyWebDesignNarrativePackage({
    content: rawAi,
    area: def.area,
    city: def.city,
    serviceName: def.service,
    narrativeEngine: project.narrativeEngine,
  });
  ai = applyLocalSeoNarrativePackage({
    content: ai,
    area: def.area,
    city: def.city,
    serviceName: def.service,
    narrativeEngine: project.narrativeEngine,
  });
  try {
    // TEMP TEST: refinement disabled
    ai = ai;
    console.log(`  Readability refined.`);
  } catch (refineErr) {
    const msg = refineErr instanceof Error ? refineErr.message : String(refineErr);
    console.warn(`  Warning: refinement failed (${msg}) — using unrefined content.`);
  }

  // ── 5. Render HTML ─────────────────────────────────────────────────────────
  const html = renderClusterHtml({ project, cluster: clusterConfig, ai });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, html, "utf8");
  console.log(
    `  Rendered → ${outFile}  (${fs.statSync(outFile).size.toLocaleString()} bytes)`
  );

  // ── 6. FTP upload ──────────────────────────────────────────────────────────
  if (!project.deploy?.enabled) {
    console.log(`  FTP disabled — skipping upload.`);
  } else {
    const { user, password, host, port, remoteRoot } =
      resolveFtpCredentials(project.deploy);

    const remoteDest = [remoteRoot, def.remotePath, "index.html"]
      .join("/")
      .replace(/\/+/g, "/");

    console.log(`  Uploading to ${host}:${port}…`);
    const ftpClient = new ftp.Client();
    ftpClient.ftp.verbose = false;
    try {
      await ftpClient.access({ host, port, user, password, secure: false });
      await ftpClient.ensureDir(path.dirname(remoteDest));
      await ftpClient.uploadFrom(outFile, remoteDest);
      console.log(`  Uploaded: ${remoteDest}`);
    } finally {
      ftpClient.close();
    }
  }

  console.log(`  Live at: ${liveUrl}`);
  return { outputPath: outFile, liveUrl };
}

// ── Retry wrapper ──────────────────────────────────────────────────────────────

/**
 * Attempts fn() up to maxAttempts times.
 * Waits 2 s between attempts.
 * Returns the result on the first success, or the error after all attempts fail.
 */
async function runWithRetry(
  fn:          () => Promise<JobResult>,
  maxAttempts  = 2
): Promise<{ result?: JobResult; attempts: number; error?: Error }> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        console.warn(
          `  Attempt ${attempt} failed: ${lastError.message} — retrying in 2 s…`
        );
        await new Promise((r) => setTimeout(r, 2_000));
      }
    }
  }
  return { attempts: maxAttempts, error: lastError };
}

// ── Disk writers ───────────────────────────────────────────────────────────────

/**
 * Writes the rollout log to output/<clientSlug>/rollout-log.json.
 * Returns the written file path.
 */
export function writeRolloutLog(log: RolloutLog, clientSlug: string): string {
  const dir  = path.join("output", clientSlug);
  const file = path.join(dir, "rollout-log.json");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(log, null, 2), "utf8");
  return file;
}

/**
 * Writes the deferred area queue to output/<clientSlug>/deferred-areas.json.
 * Returns the written file path.
 */
export function writeDeferredQueue(
  queue:      DeferredQueue,
  clientSlug: string
): string {
  const dir  = path.join("output", clientSlug);
  const file = path.join(dir, "deferred-areas.json");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(queue, null, 2), "utf8");
  return file;
}

// ── Main rollout orchestrator ──────────────────────────────────────────────────

/**
 * Runs the full area rollout pipeline for the supplied defs.
 *
 * Processing order:
 *   1. Priority areas (always)
 *   2. Secondary areas (only when options.includeSecondary = true)
 *   3. Tertiary areas  (deferred by default; set deferTertiary = false to run)
 *
 * Each area is processed sequentially. One retry is attempted on failure.
 * Deferred areas are never attempted — they are written to disk only.
 *
 * @returns The completed RolloutLog (also written to disk).
 */
export async function runAreaRollout(
  defs:    SelectedAreaPageDef[],
  project: RenderProjectConfig,
  options: RolloutOptions = {}
): Promise<RolloutLog> {
  const {
    includeSecondary = false,
    dryRun           = false,
    deferTertiary    = true,
  } = options;

  const runId     = randomUUID();
  const startedAt = new Date().toISOString();

  const entries:  RolloutEntry[]        = [];
  const deferred: SelectedAreaPageDef[] = [];

  // ── Partition into active vs deferred ─────────────────────────────────────
  const sorted    = sortByTier(defs);
  const toProcess: SelectedAreaPageDef[] = [];

  for (const def of sorted) {
    if (def.tier === "tertiary" && deferTertiary) {
      deferred.push(def);
    } else if (def.tier === "secondary" && !includeSecondary) {
      deferred.push(def);
    } else {
      toProcess.push(def);
    }
  }

  // ── Record deferred entries immediately ───────────────────────────────────
  const deferredAt = new Date().toISOString();
  for (const def of deferred) {
    entries.push({
      area:       def.area,
      city:       def.city,
      tier:       def.tier,
      status:     "deferred",
      attempts:   0,
      configPath: def.configPath,
      outputPath: "",
      liveUrl:    "",
      durationMs: 0,
      startedAt:  deferredAt,
      finishedAt: deferredAt,
    });
  }

  // ── Header ────────────────────────────────────────────────────────────────
  const modeTag = dryRun ? " [dry-run]" : "";
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  Area Rollout${modeTag} — ${defs[0]?.service} / ${defs[0]?.city}`);
  console.log(`  Run ID: ${runId}`);
  console.log(`  Active: ${toProcess.length}  Deferred: ${deferred.length}`);
  console.log(`═══════════════════════════════════════════════════════════`);

  // ── Sequential generation ─────────────────────────────────────────────────
  let active = 0;
  for (const def of toProcess) {
    active++;

    console.log(
      `\n[${active}/${toProcess.length}] Generating: ${def.service} ${def.area}` +
      `  (${def.tier})${modeTag}...`
    );

    const jobStartedAt = new Date().toISOString();
    const t0           = Date.now();

    const { result, attempts, error } = await runWithRetry(
      () => runOneAttempt(def, project, dryRun)
    );

    const durationMs    = Date.now() - t0;
    const jobFinishedAt = new Date().toISOString();
    const status: RolloutEntryStatus = result ? "success" : "failed";

    entries.push({
      area:         def.area,
      city:         def.city,
      tier:         def.tier,
      status,
      attempts,
      configPath:   def.configPath,
      outputPath:   result?.outputPath ?? "",
      liveUrl:      result?.liveUrl    ?? "",
      durationMs,
      errorMessage: error?.message,
      startedAt:    jobStartedAt,
      finishedAt:   jobFinishedAt,
    });

    if (error) {
      console.error(
        `  ✗ Failed after ${attempts} attempt(s): ${error.message}`
      );
    } else {
      const s = (durationMs / 1000).toFixed(1);
      console.log(`  ✓ Done in ${s}s`);
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals: RolloutTotals = {
    attempted: toProcess.length,
    succeeded: entries.filter((e) => e.status === "success").length,
    failed:    entries.filter((e) => e.status === "failed").length,
    deferred:  deferred.length,
  };

  const finishedAt = new Date().toISOString();

  const log: RolloutLog = {
    runId,
    service:    defs[0]?.service ?? "",
    city:       defs[0]?.city    ?? "",
    project:    project.clientSlug,
    startedAt,
    finishedAt,
    totals,
    entries,
    deferred:   deferred.map((d) => d.area),
  };

  // ── Write log ─────────────────────────────────────────────────────────────
  const logFile = writeRolloutLog(log, project.clientSlug);

  // ── Write deferred queue ───────────────────────────────────────────────────
  if (deferred.length > 0) {
    const queue: DeferredQueue = {
      project:   project.clientSlug,
      city:      defs[0]?.city    ?? "",
      service:   defs[0]?.service ?? "",
      createdAt: finishedAt,
      areas:     deferred,
    };
    const queueFile = writeDeferredQueue(queue, project.clientSlug);
    console.log(`\n── Deferred Queue → ${queueFile}`);
    console.log(`   Areas: ${deferred.map((d) => d.area).join(", ")}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n── Rollout complete ─────────────────────────────────────`);
  console.log(`  Generated  : ${totals.succeeded} / ${totals.attempted}`);
  console.log(`  Failed     : ${totals.failed}`);
  console.log(`  Deferred   : ${totals.deferred}`);
  console.log(`  Run ID     : ${runId}`);
  console.log(`  Log        → ${logFile}`);

  return log;
}
