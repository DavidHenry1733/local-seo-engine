/**
 * preflightCheck.ts
 *
 * Validates all preconditions required for a successful rollout before any
 * generation work begins. Call runPreflight() in the rollout route after area
 * defs are loaded but before SSE headers are written.
 *
 * Checks performed:
 *   1. project_config     — config/projects/<slug>.json exists on disk
 *   2. area_defs          — at least one SelectedAreaPageDef is present
 *   3. prompt_file        — prompts/cluster-page-prompt.txt is resolvable
 *   4. template_file      — templates/cluster.html is resolvable
 *   5. output_writable    — output/<slug>/ directory can be created/written
 *   6. ftp_credentials    — DEPLOY_USERNAME + DEPLOY_PASSWORD env vars (deploy only)
 *   7. ftp_config         — deploy.host is set in project config (deploy only)
 *   8. def_fields         — all required fields present on every area def
 */

import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { SelectedAreaPageDef } from "./buildClusterConfigs";

// ── Public types ───────────────────────────────────────────────────────────────

export interface PreflightCheckItem {
  /** Machine-readable identifier for the check */
  id: string;
  /** Human-readable label shown in the UI */
  label: string;
  /** Whether this check passed */
  passed: boolean;
  /** Optional detail — resolved path on success, error description on failure */
  detail?: string;
}

export interface PreflightReport {
  /** True only when every check passed */
  passed: boolean;
  /** Ordered list of individual check results */
  checks: PreflightCheckItem[];
  /** One-line human summary suitable for a toast or log line */
  summary: string;
}

export interface PreflightOptions {
  /** Client slug used for path resolution */
  clientSlug: string;
  /** Absolute path to the project config JSON file */
  projectConfigPath: string;
  /** Fully loaded area defs (may be empty — triggers check failure) */
  defs: SelectedAreaPageDef[];
  /** Absolute path to the per-client output directory */
  outputDir: string;
  /** Whether FTP deploy is enabled for this project */
  deployEnabled: boolean;
  /** FTP host from project.deploy.host (checked only when deployEnabled) */
  deployHost?: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Walk up the directory tree from this compiled module to find a workspace
 * asset. Tries process.cwd() first (CLI usage), then ascends up to 6 levels
 * from import.meta.url (bundled server usage where CWD ≠ workspace root).
 */
function resolveAsset(subpath: string): string {
  const fromCwd = path.join(process.cwd(), subpath);
  if (fs.existsSync(fromCwd)) return fromCwd;

  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, subpath);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break; // filesystem root — stop
    dir = parent;
  }
  return fromCwd; // preserve original path so error messages are meaningful
}

function makeCheck(
  id:     string,
  label:  string,
  passed: boolean,
  detail?: string
): PreflightCheckItem {
  return { id, label, passed, detail };
}

// ── Required fields on every SelectedAreaPageDef ───────────────────────────────

const REQUIRED_DEF_FIELDS: ReadonlyArray<keyof SelectedAreaPageDef> = [
  "area",
  "city",
  "service",
  "primaryKeyword",
  "supportingKeywords",
  "signals",
] as const;

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Run all preflight checks synchronously and return a structured report.
 * This function never throws — failures are captured as check items.
 */
export function runPreflight(opts: PreflightOptions): PreflightReport {
  const checks: PreflightCheckItem[] = [];

  // ── 1. Project config exists ────────────────────────────────────────────────
  const configExists = fs.existsSync(opts.projectConfigPath);
  checks.push(makeCheck(
    "project_config",
    "Project config exists",
    configExists,
    configExists
      ? opts.projectConfigPath
      : `Not found: ${opts.projectConfigPath}`
  ));

  // ── 2. Selected area defs present ──────────────────────────────────────────
  const hasDefs = opts.defs.length > 0;
  checks.push(makeCheck(
    "area_defs",
    "Selected area defs present",
    hasDefs,
    hasDefs
      ? `${opts.defs.length} area(s) queued`
      : "No area defs loaded. Complete Stage 4 (area selection) first."
  ));

  // ── 3. Prompt file resolvable ───────────────────────────────────────────────
  const promptPath  = resolveAsset(path.join("prompts", "cluster-page-prompt.txt"));
  const promptFound = fs.existsSync(promptPath);
  checks.push(makeCheck(
    "prompt_file",
    "AI prompt file resolvable",
    promptFound,
    promptFound
      ? promptPath
      : `Not found: ${promptPath}`
  ));

  // ── 4. Template file resolvable ─────────────────────────────────────────────
  const templatePath  = resolveAsset(path.join("templates", "cluster.html"));
  const templateFound = fs.existsSync(templatePath);
  checks.push(makeCheck(
    "template_file",
    "HTML template file resolvable",
    templateFound,
    templateFound
      ? templatePath
      : `Not found: ${templatePath}`
  ));

  // ── 5. Output directory writable ────────────────────────────────────────────
  let outputWritable = false;
  let outputDetail   = "";
  try {
    fs.mkdirSync(opts.outputDir, { recursive: true });
    fs.accessSync(opts.outputDir, fs.constants.W_OK);
    outputWritable = true;
    outputDetail   = opts.outputDir;
  } catch (err) {
    outputDetail = `Cannot write to ${opts.outputDir}: ${
      err instanceof Error ? err.message : String(err)
    }`;
  }
  checks.push(makeCheck(
    "output_writable",
    "Output directory is writable",
    outputWritable,
    outputDetail
  ));

  // ── 6–7. FTP checks (only when deploy.enabled) ──────────────────────────────
  if (opts.deployEnabled) {
    const user     = process.env.DEPLOY_USERNAME;
    const password = process.env.DEPLOY_PASSWORD;
    const hasCreds = Boolean(user && password);
    checks.push(makeCheck(
      "ftp_credentials",
      "FTP credentials present (DEPLOY_USERNAME / DEPLOY_PASSWORD)",
      hasCreds,
      hasCreds
        ? "Credentials found in environment"
        : "Missing DEPLOY_USERNAME and/or DEPLOY_PASSWORD environment variables"
    ));

    const hasHost = Boolean(opts.deployHost);
    checks.push(makeCheck(
      "ftp_config",
      "FTP host configured in project deploy config",
      hasHost,
      hasHost
        ? `Host: ${opts.deployHost}`
        : "deploy.host is missing or empty in project config"
    ));
  }

  // ── 8. Required fields on every area def ────────────────────────────────────
  const defProblems: string[] = [];
  for (const def of opts.defs) {
    const missing = REQUIRED_DEF_FIELDS.filter((field) => {
      const value = def[field];
      if (value === undefined || value === null) return true;
      if (Array.isArray(value) && value.length === 0) return true;
      if (typeof value === "string" && value.trim() === "") return true;
      return false;
    });
    if (missing.length > 0) {
      defProblems.push(`${def.area || "(unnamed)"}: missing [${missing.join(", ")}]`);
    }
  }
  const defsValid = defProblems.length === 0;
  checks.push(makeCheck(
    "def_fields",
    "Required fields present on all area defs",
    defsValid,
    defsValid
      ? `All ${opts.defs.length} def(s) valid`
      : defProblems.join("; ")
  ));

  // ── Build summary ────────────────────────────────────────────────────────────
  const failCount = checks.filter((c) => !c.passed).length;
  const passed    = failCount === 0;
  const summary   = passed
    ? `All ${checks.length} checks passed. Ready to generate.`
    : `${failCount} of ${checks.length} check(s) failed. Resolve issues before generating.`;

  return { passed, checks, summary };
}
