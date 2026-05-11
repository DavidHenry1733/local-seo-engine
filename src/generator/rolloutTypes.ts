/**
 * rolloutTypes.ts
 *
 * TypeScript types for the Area Engine rollout system.
 *
 * Used by: rolloutRunner.ts, rolloutExample.ts, runAreaRollout.ts (CLI),
 *          runDeferredAreas.ts (deferred queue processor)
 *
 * Spec ref: Area Engine Integration Spec v1 — Sections 5, 7.2, 7.3
 */

import type { AreaTier }          from "../area/areaTypes";
import type { SelectedAreaPageDef } from "./buildClusterConfigs";

// ── Entry status ──────────────────────────────────────────────────────────────

export type RolloutEntryStatus =
  | "success"   // generated and deployed
  | "failed"    // failed after all retry attempts
  | "deferred"; // not attempted — written to the deferred queue

// ── Per-area result ───────────────────────────────────────────────────────────

/**
 * Result record for a single area within a rollout run.
 * One of these is written to RolloutLog.entries for every area processed,
 * deferred, or failed.
 */
export interface RolloutEntry {
  /** Area name, e.g. "Ecclesall" */
  area:          string;
  /** Parent city, e.g. "Sheffield" */
  city:          string;
  /** Opportunity tier assigned by the area engine */
  tier:          AreaTier;
  /** Outcome for this area */
  status:        RolloutEntryStatus;
  /** Number of generation attempts made (0 = deferred, 1 = first try, 2 = retried) */
  attempts:      number;
  /** Relative path to the written cluster config JSON file */
  configPath:    string;
  /** Relative path to the rendered output HTML file (empty when deferred/failed) */
  outputPath:    string;
  /** Full live URL once deployed (empty when deferred or deploy skipped) */
  liveUrl:       string;
  /** Elapsed time from job start to finish in milliseconds */
  durationMs:    number;
  /** Error description — only set when status is "failed" */
  errorMessage?: string;
  /** Whether the post-render smoke check passed (false = FTP skipped, area marked failed) */
  smokeCheckPassed?: boolean;
  /** Human-readable descriptions of any failing smoke checks */
  smokeCheckFailures?: string[];
  /** ISO 8601 timestamp when the job started */
  startedAt:     string;
  /** ISO 8601 timestamp when the job finished */
  finishedAt:    string;
}

// ── Rollout totals ────────────────────────────────────────────────────────────

export interface RolloutTotals {
  /** Areas that were actually attempted (excludes deferred) */
  attempted: number;
  /** Areas that succeeded on the first or second attempt */
  succeeded: number;
  /** Areas that failed after all retry attempts */
  failed:    number;
  /** Areas written to the deferred queue (not attempted in this run) */
  deferred:  number;
  /** Total pages on disk for this campaign (includes prior runs + current run) */
  totalOnDisk?: number;
}

// ── Rollout log ───────────────────────────────────────────────────────────────

/**
 * Full record of one rollout run.
 * Written to output/<clientSlug>/rollout-log.json at the end of the run.
 * Spec ref: Section 7.3
 */
export interface RolloutLog {
  /** UUID that uniquely identifies this run */
  runId:       string;
  /** Service name, e.g. "Web Design" */
  service:     string;
  /** City name, e.g. "Sheffield" */
  city:        string;
  /** clientSlug from the project config */
  project:     string;
  /** ISO 8601 timestamp when the run started */
  startedAt:   string;
  /** ISO 8601 timestamp when the run finished */
  finishedAt:  string;
  totals:      RolloutTotals;
  /** One entry per area — includes deferred and failed areas */
  entries:     RolloutEntry[];
  /** Area names written to the deferred queue in this run */
  deferred:    string[];
}

// ── Deferred queue ────────────────────────────────────────────────────────────

/**
 * Persisted file that records tertiary (or secondary) areas that were
 * not generated in the main rollout.
 *
 * Written to: output/<clientSlug>/deferred-areas.json
 * Consumed by: src/generator/runDeferredAreas.ts
 *
 * Spec ref: Section 5.4
 */
export interface DeferredQueue {
  /** clientSlug of the owning project */
  project:   string;
  /** City for which the queue applies */
  city:      string;
  /** Service name for which the queue applies */
  service:   string;
  /** ISO 8601 timestamp when this queue was written */
  createdAt: string;
  /**
   * Full SelectedAreaPageDef for each deferred area.
   * runDeferredAreas.ts can process these without re-running the area engine.
   */
  areas: SelectedAreaPageDef[];
}

// ── Runner options ────────────────────────────────────────────────────────────

/**
 * Configuration flags accepted by runAreaRollout().
 */
export interface RolloutOptions {
  /**
   * Generate secondary tier areas in this run.
   * Default: false — only priority areas are generated; secondary areas
   * are written to the deferred queue.
   */
  includeSecondary?: boolean;

  /**
   * Write cluster config files to disk but skip AI content generation,
   * HTML rendering, and FTP upload.
   * Use this to verify config correctness and rollout ordering before
   * committing an AI run.
   * Default: false.
   */
  dryRun?: boolean;

  /**
   * Write tertiary areas to the deferred queue instead of generating them.
   * Set to false only if you explicitly want to generate tertiary areas
   * in this run (requires includeSecondary to also be true).
   * Default: true.
   */
  deferTertiary?: boolean;
}
