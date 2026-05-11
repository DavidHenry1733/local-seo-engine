/**
 * Keyword Tracking Engine
 *
 * For each keyword → targetUrl pair, fetches a Google search (100 results)
 * and locates the position of the target URL.
 *
 * Safety constraints:
 *   - Default limit: 20 keywords per run  (configurable)
 *   - Default delay: 2 500 ms between requests
 *   - Always sequential — no parallel Google requests
 *
 * Data source for API runs:
 *   Loads keyword → URL pairs from output/<projectSlug>/selected-area-defs.json
 *   using each area's primaryKeyword + remotePath resolved against the project domain.
 *
 * NOTE: Does NOT use the Google Indexing API (reserved for JobPosting/BroadcastEvent).
 */

import fs   from "node:fs";
import path from "node:path";
import type {
  KeywordTarget,
  KeywordRecord,
  KeywordTrackingReport,
  KeywordTrackingOptions,
} from "./keywordTrackingTypes";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT    = 20;
const DEFAULT_DELAY_MS = 2500;
const RESULT_COUNT     = 100;

const USER_AGENT =
  "Mozilla/5.0 (compatible; InboxingProWebChecker/1.0; +https://inboxingproweb.com)";

// ─── File helpers ─────────────────────────────────────────────────────────────

function reportPath(projectSlug: string, outputDir: string): string {
  return path.join(outputDir, projectSlug, "keyword-tracking.json");
}

export function readKeywordReport(
  projectSlug: string,
  outputDir = "output",
): KeywordTrackingReport | null {
  const p = reportPath(projectSlug, outputDir);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as KeywordTrackingReport;
  } catch {
    return null;
  }
}

function writeKeywordReport(report: KeywordTrackingReport, outputDir: string): void {
  const p = reportPath(report.projectSlug, outputDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(report, null, 2), "utf8");
}

// ─── Keyword loader from project area defs ────────────────────────────────────

interface AreaDef {
  primaryKeyword:    string;
  supportingKeywords?: string[];
  remotePath:        string;
}

interface ProjectConfig {
  domain: string;
}

interface SessionAreaDef extends AreaDef {
  tier?: string;
}

/**
 * Scans all non-archived session files under output/<projectSlug>/sessions/
 * and aggregates ALL selectedAreaDefs regardless of whether the page exists
 * locally — the pages may be live on the FTP server but not in the local
 * output directory.  Also writes the result back to selected-area-defs.json
 * so future calls can use the faster direct-read path.
 *
 * Sort order: hub tier first, then priority, then secondary/other, then
 * alphabetical by remotePath within each tier.
 */
export function rebuildAreaDefsFromSessions(
  projectSlug: string,
  outputDir = "output",
): AreaDef[] {
  const clientDir   = path.join(outputDir, projectSlug);
  const sessionsDir = path.join(clientDir, "sessions");
  if (!fs.existsSync(sessionsDir)) return [];

  const seenKeywords = new Set<string>();
  const seenPaths    = new Set<string>();
  const aggregated: SessionAreaDef[] = [];

  const sessionFiles = fs.readdirSync(sessionsDir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_archived"));

  for (const file of sessionFiles.sort()) {
    try {
      const raw  = fs.readFileSync(path.join(sessionsDir, file), "utf8");
      const sess = JSON.parse(raw) as { selectedAreaDefs?: SessionAreaDef[] };
      const defs = sess.selectedAreaDefs ?? [];
      for (const d of defs) {
        const kw  = (d.primaryKeyword ?? "").trim();
        const rp  = (d.remotePath     ?? "").trim();
        if (!kw || !rp) continue;
        const dirName  = rp.replace(/^\/|\/$/g, "");
        const kwLower  = kw.toLowerCase();
        if (seenKeywords.has(kwLower) || seenPaths.has(dirName)) continue;
        seenKeywords.add(kwLower);
        seenPaths.add(dirName);
        aggregated.push({ primaryKeyword: kw, remotePath: rp, tier: d.tier ?? "priority" });
      }
    } catch { /* skip malformed session */ }
  }

  // Sort: hub first → priority → secondary/other → alphabetical within tier
  const tierOrder: Record<string, number> = { hub: 0, priority: 1, secondary: 2 };
  aggregated.sort((a, b) => {
    const ta = tierOrder[a.tier ?? "priority"] ?? 1;
    const tb = tierOrder[b.tier ?? "priority"] ?? 1;
    if (ta !== tb) return ta - tb;
    return a.remotePath.localeCompare(b.remotePath);
  });

  // Persist so next call can use the fast path
  if (aggregated.length > 0) {
    try {
      fs.writeFileSync(
        path.join(clientDir, "selected-area-defs.json"),
        JSON.stringify(aggregated, null, 2),
        "utf8",
      );
    } catch { /* non-fatal */ }
  }

  return aggregated;
}

/**
 * Loads keyword → URL pairs from:
 *   output/<projectSlug>/selected-area-defs.json   (keyword + remotePath)
 *   config/projects/<projectSlug>.json             (domain for full URL)
 *
 * Falls back to aggregating from session files when the root defs file is
 * absent or yields no usable entries (e.g. first run after a fresh rollout).
 *
 * Returns primaryKeyword for each area mapped to its absolute URL.
 */
export function loadKeywordTargets(
  projectSlug: string,
  outputDir   = "output",
  configDir   = "config/projects",
): KeywordTarget[] {
  const defsPath    = path.join(outputDir, projectSlug, "selected-area-defs.json");
  const projectPath = path.join(configDir, `${projectSlug}.json`);

  let domain = "";
  if (fs.existsSync(projectPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(projectPath, "utf8")) as ProjectConfig;
      domain = (cfg.domain ?? "").replace(/\/+$/, "");
    } catch { /* ignore */ }
  }

  // Load defs — prefer root file, fall back to session aggregation
  let defs: AreaDef[] = [];
  if (fs.existsSync(defsPath)) {
    try {
      defs = JSON.parse(fs.readFileSync(defsPath, "utf8")) as AreaDef[];
    } catch { /* fall through to session fallback */ }
  }
  if (defs.length === 0) {
    defs = rebuildAreaDefsFromSessions(projectSlug, outputDir);
  }

  const targets: KeywordTarget[] = [];
  const seen = new Set<string>();

  for (const def of defs) {
    if (!def.primaryKeyword || !def.remotePath) continue;
    const key = def.primaryKeyword.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    const targetUrl = domain
      ? `${domain}${def.remotePath.startsWith("/") ? "" : "/"}${def.remotePath}`
      : def.remotePath;

    targets.push({ keyword: def.primaryKeyword, targetUrl });
  }

  return targets;
}

// ─── Google search position detector ─────────────────────────────────────────

/**
 * Extracts ordered list of result URLs from a Google search results page.
 * Handles both /url?q= style links and direct HTTPS result links.
 */
function extractResultUrls(html: string): string[] {
  const seen: Set<string> = new Set();
  const urls:  string[]   = [];

  // Pattern 1: /url?q=https://... (classic Google result links)
  const googleUrlRe = /\/url\?(?:[^"]*&)?q=(https?:\/\/[^&"#\s]+)/g;
  for (const m of html.matchAll(googleUrlRe)) {
    try {
      const decoded = decodeURIComponent(m[1]);
      // Skip Google's own domains
      if (/google\.|googleapis\.|gstatic\.|youtube\.com/i.test(decoded)) continue;
      if (!seen.has(decoded)) {
        seen.add(decoded);
        urls.push(decoded);
      }
    } catch { /* skip malformed */ }
  }

  // Pattern 2: data-url="https://..." attributes (newer Google layouts)
  if (urls.length < 5) {
    const dataUrlRe = /data-url="(https?:\/\/(?!(?:www\.)?google\.)[^"]+)"/g;
    for (const m of html.matchAll(dataUrlRe)) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        urls.push(m[1]);
      }
    }
  }

  // Pattern 3: Direct href links to external sites in result blocks
  // Only if we still don't have enough (Google may change HTML)
  if (urls.length < 5) {
    const hrefRe = /href="(https?:\/\/(?!(?:www\.)?(?:google|gstatic|googleapis|youtube|webcache)\.))[^"]+"/g;
    for (const m of html.matchAll(hrefRe)) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        urls.push(m[1]);
      }
    }
  }

  return urls;
}

/**
 * Normalises a URL for comparison: lower-case host, strip trailing slash,
 * strip common query params that don't change page identity.
 */
function normaliseUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hostname  = u.hostname.toLowerCase().replace(/^www\./, "");
    u.search    = "";
    u.hash      = "";
    let p       = u.pathname;
    if (p.endsWith("/") && p.length > 1) p = p.slice(0, -1);
    u.pathname  = p;
    return u.href;
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

/**
 * Searches Google for the keyword and returns the position (1-based) of
 * targetUrl within the first 100 results, or null if not found.
 */
async function detectPosition(
  keyword:   string,
  targetUrl: string,
): Promise<number | null> {
  const query     = encodeURIComponent(keyword);
  const searchUrl = `https://www.google.com/search?q=${query}&num=${RESULT_COUNT}&hl=en&gl=gb`;

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 15_000);

  let html: string;
  try {
    const res = await fetch(searchUrl, {
      signal:  controller.signal,
      headers: {
        "User-Agent":      USER_AGENT,
        "Accept-Language": "en-GB,en;q=0.9",
        "Accept":          "text/html",
        "Cache-Control":   "no-cache",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    clearTimeout(timeout);
    return null;
  }

  // Captcha / unusual traffic — bail out
  if (
    html.includes("detected unusual traffic") ||
    html.includes("g-recaptcha") ||
    html.includes("www.google.com/sorry/")
  ) {
    console.warn(`[keywordTracking] Google rate-limit detected for: "${keyword}"`);
    return null;
  }

  const resultUrls = extractResultUrls(html);
  const normTarget = normaliseUrl(targetUrl);

  for (let i = 0; i < resultUrls.length; i++) {
    if (normaliseUrl(resultUrls[i]) === normTarget) {
      return i + 1; // 1-based position
    }
  }

  return null;
}

// ─── Delay ───────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main engine ──────────────────────────────────────────────────────────────

/**
 * Run keyword ranking checks for a project.
 *
 * @param projectSlug  Slug used to locate output and config files.
 * @param targets      Optional explicit keyword→URL pairs.
 *                     Defaults to loading from selected-area-defs.json.
 * @param options      limit, delayMs, outputDir.
 */
export async function runKeywordTracking(
  projectSlug: string,
  targets:     KeywordTarget[] | null = null,
  options:     KeywordTrackingOptions = {},
): Promise<KeywordTrackingReport> {
  const limit      = options.limit      ?? DEFAULT_LIMIT;
  const delayMs    = options.delayMs    ?? DEFAULT_DELAY_MS;
  const outputDir  = options.outputDir  ?? "output";
  const onProgress = options.onProgress ?? null;

  // Load keyword targets if not provided
  const allTargets = targets ?? loadKeywordTargets(projectSlug, outputDir);

  if (allTargets.length === 0) {
    throw new Error(
      `No keyword targets found for project "${projectSlug}". ` +
      `Ensure output/${projectSlug}/selected-area-defs.json exists.`,
    );
  }

  // Load existing records to preserve history
  const existing = readKeywordReport(projectSlug, outputDir);
  const existingMap = new Map<string, KeywordRecord>(
    (existing?.records ?? []).map(r => [r.keyword.toLowerCase(), r]),
  );

  const toCheck = allTargets.slice(0, limit);
  const skipped = allTargets.slice(limit);

  console.log(
    `[keywordTracking] Checking ${toCheck.length} keywords` +
    (skipped.length ? ` (${skipped.length} deferred — limit=${limit})` : "") +
    ` with ${delayMs}ms delay…`,
  );

  const now     = new Date().toISOString();
  const records: KeywordRecord[] = [];

  for (let i = 0; i < toCheck.length; i++) {
    const { keyword, targetUrl } = toCheck[i];

    if (i > 0) await delay(delayMs);

    console.log(`[keywordTracking] [${i + 1}/${toCheck.length}] "${keyword}" → ${targetUrl}`);

    const prev          = existingMap.get(keyword.toLowerCase());
    const prevPos       = prev?.position ?? null;
    const position      = await detectPosition(keyword, targetUrl);

    let change: number | null = null;
    if (prevPos !== null && position !== null) {
      change = prevPos - position; // positive = moved up (improved)
    } else if (prevPos !== null && position === null) {
      change = null; // lost ranking
    } else if (prevPos === null && position !== null) {
      change = null; // new ranking (no delta yet)
    }

    const firstRankedAt =
      position !== null && prev?.firstRankedAt == null
        ? now
        : (prev?.firstRankedAt ?? null);

    const label = position !== null
      ? `position #${position}` + (change !== null ? ` (${change > 0 ? "+" : ""}${change})` : " (new)")
      : "not ranked";

    console.log(`[keywordTracking]   → ${label}`);
    if (onProgress) onProgress(i + 1, toCheck.length, keyword);

    records.push({
      keyword,
      targetUrl,
      position,
      previousPosition: prevPos,
      change,
      lastCheckedAt:    now,
      firstRankedAt,
    });
  }

  // Carry forward unchecked keywords (preserve their last data)
  for (const { keyword, targetUrl } of skipped) {
    const prev = existingMap.get(keyword.toLowerCase());
    records.push(
      prev ?? {
        keyword,
        targetUrl,
        position:         null,
        previousPosition: null,
        change:           null,
        lastCheckedAt:    now,
        firstRankedAt:    null,
      },
    );
  }

  const ranked      = records.filter(r => r.position !== null).length;
  const improved    = records.filter(r => r.change !== null && r.change > 0).length;
  const dropped     = records.filter(r => r.change !== null && r.change < 0).length;
  const newRankings = records.filter(r => r.previousPosition === null && r.position !== null).length;

  const report: KeywordTrackingReport = {
    projectSlug,
    runAt: now,
    totalKeywords: records.length,
    ranked,
    improved,
    dropped,
    newRankings,
    records,
  };

  writeKeywordReport(report, outputDir);
  return report;
}
