import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ValidationSummary, PageValidationResult, ProjectConfig } from "./types";
import { validatePage } from "../../../../../src/validate/qaValidator";
import { scoreContent } from "../../../../../src/score/contentScorer";
import { scoreAiReadiness } from "../../../../../src/score/aiReadinessScorer";
import type { AiReadinessReport } from "../../../../../src/score/aiReadinessScorer";
import type { SelectedAreaPageDef } from "../../../../../src/generator/buildClusterConfigs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR = path.join(WORKSPACE_ROOT, "output");
const PROJECTS_DIR = path.join(WORKSPACE_ROOT, "config", "projects");

const router = Router();

function loadProject(slug: string): ProjectConfig | null {
  const p = path.join(PROJECTS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as ProjectConfig;
  } catch {
    return null;
  }
}

function loadFullDefs(clientDir: string): SelectedAreaPageDef[] {
  const p = path.join(clientDir, "selected-area-defs.json");
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as SelectedAreaPageDef[];
  } catch {
    return [];
  }
}

/** Load area defs from every campaign session file, merged together. */
function loadAllSessionDefs(clientDir: string): SelectedAreaPageDef[] {
  const sessionsDir = path.join(clientDir, "sessions");
  if (!fs.existsSync(sessionsDir)) return [];
  const all: SelectedAreaPageDef[] = [];
  for (const file of fs.readdirSync(sessionsDir)) {
    if (!file.endsWith(".json")) continue;
    // Skip archived/test session files — they may contain stale or conflicting defs.
    if (file.startsWith("_archived") || file.startsWith("_test")) continue;
    try {
      const s = JSON.parse(
        fs.readFileSync(path.join(sessionsDir, file), "utf8")
      ) as Record<string, unknown>;
      const defs = (s.selectedAreaDefs ?? []) as SelectedAreaPageDef[];
      all.push(...defs);
    } catch {
      // skip corrupt session
    }
  }
  return all;
}

function loadSession(clientDir: string): Record<string, unknown> | null {
  const p = path.join(clientDir, "session.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Convert an area name or directory slug to a simple lowercase hyphenated slug. */
function toSlug(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/** Strip common slug prefixes used in directory names.
 * Uses -+ so the hub double-dash convention ("local-seo--rotherham")
 * strips cleanly to "rotherham" rather than leaving a leading dash. */
function stripSlugPrefixes(slug: string): string {
  return slug
    .replace(/^web-design-+/, "")
    .replace(/^local-seo-+/, "")
    .replace(/^web-hosting-+/, "")
    .replace(/^affordable-web-design-/, "affordable-");
}

/**
 * Find the best matching def for a filesystem directory name.
 * Tries exact remotePath first, then fuzzy slugified-area matching.
 */
function findDefForAreaDir(
  areaDir: string,
  defs: SelectedAreaPageDef[]
): SelectedAreaPageDef | undefined {
  // 1. Exact remotePath match
  const exact = defs.find((d) => d.remotePath === `/${areaDir}/`);
  if (exact) return exact;

  // 2. Slugified area name full match (e.g., "sheffield-city-centre" ↔ "Sheffield City Centre")
  const areaSlug = toSlug(areaDir);
  const byArea = defs.find((d) => d.area && toSlug(d.area) === areaSlug);
  if (byArea) return byArea;

  // 3. Strip prefix and match (e.g., "web-design-aston" → "aston" ↔ "Aston")
  const stripped = stripSlugPrefixes(areaSlug);

  // For hub pages (double-dash convention e.g. "local-seo--rotherham"), prefer a
  // hub-tier def that also matches the service type implied by the dir prefix.
  // This prevents a web-design hub def from being used for a local-seo hub page.
  if (areaDir.includes("--")) {
    const servicePrefix = areaDir.split("--")[0].replace(/-/g, " "); // e.g. "local seo"
    const hubTierDef = defs.find(
      (d) =>
        d.tier === "hub" &&
        d.area &&
        toSlug(d.area) === stripped &&
        (d.primaryKeyword?.toLowerCase().includes(servicePrefix) ||
          (d as unknown as Record<string, string>)["service"]
            ?.toLowerCase()
            .includes(servicePrefix))
    );
    if (hubTierDef) return hubTierDef;
    // Fallback: any hub-tier def for this area (service-agnostic)
    const anyHubDef = defs.find((d) => d.tier === "hub" && d.area && toSlug(d.area) === stripped);
    if (anyHubDef) return anyHubDef;
  }

  return defs.find((d) => d.area && toSlug(d.area) === stripped);
}

function deriveReadiness(
  qaScore: number,
  qaPassed: boolean,
  contentScore: number
): "ready" | "review" | "blocked" {
  const combined = Math.round((qaScore + contentScore) / 2);
  if (qaPassed && contentScore >= 60) return "ready";
  if (combined >= 55) return "review";
  return "blocked";
}

router.get("/validate/:slug", (req, res) => {
  const { slug }       = req.params;
  const { campaignId } = req.query as Record<string, string | undefined>;
  const clientDir      = path.join(OUTPUT_DIR, slug);

  // Fast-fail if the project config no longer exists — avoids expensive file scan
  if (!fs.existsSync(path.join(PROJECTS_DIR, `${slug}.json`))) {
    res.status(404).json({ error: `Project not found: ${slug}` });
    return;
  }

  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: `No output found for client: ${slug}` });
    return;
  }

  const project = loadProject(slug);
  const session  = loadSession(clientDir);

  // Merge defs from: (1) selected-area-defs.json, (2) all campaign session files.
  const fullDefs    = loadFullDefs(clientDir);
  const sessionDefs = loadAllSessionDefs(clientDir);
  const allDefs     = [...fullDefs, ...sessionDefs];

  // When a campaignId is supplied, restrict validation to the pages belonging
  // to that specific campaign session (its selectedAreaDefs remotePaths).
  let campaignAreaDirFilter: Set<string> | null = null;
  // Hub pages that belong to this campaign but have no generated folder yet.
  let missingHubDirs: SelectedAreaPageDef[] = [];

  let sessionHubRemotePath: string | undefined;   // e.g. "/web-design-barnsley/"

  if (campaignId) {
    const sessionFile = path.join(clientDir, "sessions", `${campaignId}.json`);
    if (fs.existsSync(sessionFile)) {
      try {
        const s = JSON.parse(fs.readFileSync(sessionFile, "utf8")) as Record<string, unknown>;
        const defs = (s.selectedAreaDefs ?? []) as Array<{ remotePath?: string; hubUrl?: string; tier?: string }>;

        // Capture the hub tier's remotePath so we can use it as the hub check URL.
        sessionHubRemotePath = defs.find((d) => d.tier === "hub")?.remotePath;

        // Convert remotePath "/web-design-aston/" → "web-design-aston"
        campaignAreaDirFilter = new Set(
          defs
            .map((d) => d.remotePath?.replace(/^\/|\/$/g, ""))
            .filter(Boolean) as string[]
        );

        // Identify the hub page(s) for this campaign by inspecting the hubUrl
        // each cluster def points to.  The hub areaDir is the path segment of
        // that URL — only when the URL is on the same domain as the project
        // (or has no explicit host, i.e. relative).  External URLs (e.g. a
        // dhmdigital.net "why-choose-us" nav link stored as hubUrl) must NOT
        // be treated as locally-generated pages.
        const projectHost = (() => {
          try { return new URL(project?.domain ?? "").hostname; } catch { return ""; }
        })();
        const hubDirs = new Set<string>();
        for (const d of defs) {
          if (!d.hubUrl) continue;
          try {
            const u = new URL(d.hubUrl, "https://placeholder.local");
            // Skip if it resolves to a different hostname than the project domain.
            if (projectHost && u.hostname !== "placeholder.local" && u.hostname !== projectHost) continue;
            const seg = u.pathname.replace(/^\/|\/$/g, "");
            if (seg) hubDirs.add(seg);
          } catch { /* ignore malformed */ }
        }

        // Match each hub path segment to a full def so we get tier/area/etc.
        for (const hubDir of hubDirs) {
          const hubDef = allDefs.find(
            (d) => d.remotePath?.replace(/^\/|\/$/g, "") === hubDir
          ) ?? allDefs.find(
            // fuzzy: slug-match area name
            (d) => d.area?.toLowerCase().replace(/\s+/g, "-") === hubDir
          );

          const outputFolder = path.join(clientDir, hubDir);
          const hasHtml = fs.existsSync(path.join(outputFolder, "index.html"));

          if (hasHtml) {
            // Folder exists — just include it in the filter so it is validated.
            campaignAreaDirFilter!.add(hubDir);
          } else {
            // Folder missing — record as a synthetic missing-hub entry to surface
            // in the results table so the user knows it still needs generating.
            if (hubDef) {
              missingHubDirs.push({ ...hubDef, tier: "hub" } as SelectedAreaPageDef);
            } else {
              // No full def found — synthesise a minimal one so we can still show it.
              missingHubDirs.push({
                area:           hubDir,
                remotePath:     `/${hubDir}/`,
                tier:           "hub",
                primaryKeyword: hubDir.replace(/-/g, " "),
              } as unknown as SelectedAreaPageDef);
            }
          }
        }
      } catch { /* fall through to unfiltered */ }
    }
    // Also include defs from selected-area-defs.json (Sheffield secondary areas)
    // if they were written as part of this campaign session.
    if (campaignAreaDirFilter && campaignAreaDirFilter.size === 0) {
      // If session had no selectedAreaDefs, fall back to full defs from file
      fullDefs.forEach((d) => {
        const dir = d.remotePath?.replace(/^\/|\/$/g, "");
        if (dir) campaignAreaDirFilter!.add(dir);
      });
    }
  }

  const campaign = session?.campaign as
    | { serviceName?: string; hubUrl?: string }
    | undefined;

  const serviceName = campaign?.serviceName ?? "Service";
  // Prefer the hub tier's remotePath (e.g. "/web-design-barnsley/") over the
  // stale campaign.hubUrl which may just be the domain root.  hasHref uses
  // substring matching so a path like "/web-design-barnsley/" correctly matches
  // both absolute and preview-prefixed hrefs in the generated HTML.
  const rootHubUrl: string =
    sessionHubRemotePath ??
    (() => {
      const raw = campaign?.hubUrl ?? "";
      try {
        const u = new URL(raw);
        // If the stored hubUrl is just the domain root (pathname "/"), fall back to
        // the domain root path so at least root links pass.
        return u.pathname === "/" ? "/" : u.pathname;
      } catch {
        return raw || "/";
      }
    })();

  // Address lines for trust checks
  const addressLines = project
    ? project.businessAddress
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Supporting page URLs from nav items
  const supportingPageUrls =
    project?.navItems?.map((n) => n.href).filter(Boolean) ?? [];

  // Find directories that have a rendered index.html, optionally filtered to
  // only the pages belonging to the active campaign.
  const areaDirs = fs
    .readdirSync(clientDir)
    .filter((f) => {
      const full = path.join(clientDir, f);
      if (f === "assets" || f === "sessions") return false;
      if (!fs.statSync(full).isDirectory()) return false;
      if (!fs.existsSync(path.join(full, "index.html"))) return false;
      if (campaignAreaDirFilter && !campaignAreaDirFilter.has(f)) return false;
      return true;
    });

  // Build allClusterUrls from ACTUAL filesystem directories (the ground truth),
  // not just from def remotePaths which may differ from the deployed slugs.
  const base = project?.domain.replace(/\/+$/, "") ?? "";
  const allClusterUrls = areaDirs.flatMap((dir) => [
    `${base}/${dir}/`,
    `/${dir}/`,
  ]);

  // Load deferred areas
  let deferred: string[] = [];
  const deferredFile = path.join(clientDir, "deferred-areas.json");
  if (fs.existsSync(deferredFile)) {
    try {
      const raw = JSON.parse(
        fs.readFileSync(deferredFile, "utf8")
      ) as Array<{ area: string }>;
      deferred = raw.map((d) => d.area);
    } catch {
      deferred = [];
    }
  }

  const results: PageValidationResult[] = areaDirs.map((areaDir) => {
    const htmlPath = path.join(clientDir, areaDir, "index.html");
    const html = fs.readFileSync(htmlPath, "utf8");

    // Use fuzzy matching so Rotherham pages ("web-design-aston") correctly map
    // to their def ("Aston") even when the def remotePath was stored as "/aston/".
    const def = findDefForAreaDir(areaDir, allDefs);

    const primaryKeyword = def?.primaryKeyword ?? `${serviceName} ${areaDir}`;
    const supportingKeywords = def?.supportingKeywords ?? [];
    const areaName = def?.area ?? areaDir;

    // Exclude the current page's own URLs from the related-cluster list.
    const relatedClusterUrls = allClusterUrls.filter((u) => {
      return u !== `${base}/${areaDir}/` && u !== `/${areaDir}/`;
    });

    // ── QA validation ──────────────────────────────────────────────────────
    //
    // Hub-link check: use the path portion of the hub URL so hasHref's substring
    // match works against relative hrefs like /preview/.../web-design-barnsley/.
    // Priority: (1) session hub remotePath (most reliable), (2) def.hubUrl path,
    // (3) rootHubUrl.
    const effectiveHubPageUrl: string = (() => {
      // Prefer session-derived hub remotePath (e.g. "/web-design-barnsley/")
      if (sessionHubRemotePath) return sessionHubRemotePath;
      // Fall back to def.hubUrl — extract just the pathname so relative links match
      const raw = def?.hubUrl ?? rootHubUrl;
      try {
        const u = new URL(raw);
        return u.pathname === "/" ? "/" : u.pathname;
      } catch {
        return raw;
      }
    })();

    // Detect hub pages so the validator uses the correct section IDs and skips
    // the nonsensical "does the hub link to itself?" check.
    const isHubPage =
      (sessionHubRemotePath?.replace(/^\/|\/$/g, "") === areaDir) ||
      def?.tier === "hub";

    const qaInput = {
      html,
      pageType: (isHubPage ? "hub" : "cluster") as "hub" | "cluster",
      brandName:          project?.businessName         ?? "",
      legalName:          project?.legalName            ?? project?.businessName ?? "",
      companyNumber:      project?.companyNumber        ?? project?.footerCompanyNumber ?? "",
      addressLines,
      email:              project?.email                ?? "",
      privacyUrl:         project?.privacyUrl           ?? "",
      termsUrl:           project?.termsUrl             ?? "",
      footerLinks:        project?.footerLinks          ?? [],
      primaryKeyword,
      supportingKeywords,
      hubPageUrl:         effectiveHubPageUrl,
      relatedClusterUrls,
      supportingPageUrls,
    };

    const qaReport = validatePage(qaInput);

    // ── Content scoring ─────────────────────────────────────────────────────
    const scoreInput = {
      html,
      pageType: "cluster" as const,
      primaryKeyword,
      supportingKeywords,
      location:           areaName,
      serviceName,
    };

    const scoreReport = scoreContent(scoreInput);

    // ── AI Search Readiness Score (unified 8-subscore framework) ────────────
    const aiReadinessReport = scoreAiReadiness({
      html,
      location:      areaName,
      serviceName,
      contentReport: scoreReport,
      qaReport,
    });

    // ── Map to API response ─────────────────────────────────────────────────
    // Use the unified master score as the primary overallScore
    const overallScore = aiReadinessReport.masterScore;

    const readiness = deriveReadiness(
      qaReport.score,
      qaReport.passed,
      scoreReport.overallScore
    );

    // Legacy categories map (kept for backward compat with any downstream readers)
    const categories: Record<string, number> = {};
    for (const cat of scoreReport.categories) {
      categories[cat.key] = cat.percentage;
    }
    categories["qaStructure"] = qaReport.score;

    const qaIssues = qaReport.checks
      .filter((c) => c.status === "fail")
      .map((c) => c.message);

    // Brand leakage check — flag platform brand name appearing in customer page content.
    // Strip (a) href/src/action/content attributes to avoid false positives from domain
    // references in links and meta tags, and (b) JSON-LD <script> blocks so that the
    // platform hosting domain appearing in structured-data "@id"/"url" fields (which is
    // correct — it IS the hosting domain) is not counted as leakage.
    const platformBrandToken = "inboxingproweb";
    const isOwnPlatformProject = (project?.businessName ?? "").toLowerCase().includes(platformBrandToken)
      || (project?.clientSlug ?? "").toLowerCase().includes(platformBrandToken);
    if (!isOwnPlatformProject) {
      const htmlNoUrlAttrs = html
        .replace(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/href="[^"]*"/gi, 'href=""')
        .replace(/src="[^"]*"/gi, 'src=""')
        .replace(/action="[^"]*"/gi, 'action=""')
        .replace(/content="[^"]*"/gi, 'content=""');
      const leaks = (htmlNoUrlAttrs.match(/inboxingproweb/gi) ?? []).length;
      if (leaks > 0) {
        qaIssues.push(
          `Brand leakage: platform name "InboxingProWeb" found ${leaks} time${leaks > 1 ? "s" : ""} in page content — check footer text, nav labels, schema, and about section`
        );
      }
    }

    const liveUrl = `${(project?.domain ?? "").replace(/\/+$/, "")}${def?.remotePath ?? ""}`;

    return {
      area:         areaName,
      areaDir,
      liveUrl,
      tier:         def?.tier ?? "secondary",
      overallScore,
      readiness,
      categories,
      qaIssues,
      aiReadiness:  aiReadinessReport,
    };
  });

  // Prepend synthetic "blocked" entries for hub pages that belong to this
  // campaign but whose output folder has not been generated yet.
  const base2 = project?.domain.replace(/\/+$/, "") ?? "";
  for (const hubDef of missingHubDirs) {
    const hubDir = hubDef.remotePath?.replace(/^\/|\/$/g, "") ?? String(hubDef.area).toLowerCase().replace(/\s+/g, "-");
    results.unshift({
      area:         hubDef.area ?? hubDir,
      areaDir:      hubDir,
      liveUrl:      `${base2}${hubDef.remotePath ?? `/${hubDir}/`}`,
      tier:         "hub",
      overallScore: 0,
      readiness:    "blocked",
      categories:   {},
      qaIssues:     ["Hub page has not been generated yet — run page generation first"],
    });
  }

  // Sort: hub first, then priority, then secondary/tertiary — within each tier,
  // pages with QA issues bubble above clean pages so the most urgent work is visible.
  const TIER_ORDER: Record<string, number> = { hub: 0, priority: 1, secondary: 2, tertiary: 3 };
  results.sort((a, b) => {
    const ta = TIER_ORDER[a.tier ?? "secondary"] ?? 2;
    const tb = TIER_ORDER[b.tier ?? "secondary"] ?? 2;
    if (ta !== tb) return ta - tb;
    // within same tier: issues first
    const ia = a.qaIssues.length > 0 ? 0 : 1;
    const ib = b.qaIssues.length > 0 ? 0 : 1;
    return ia - ib;
  });

  const summary: ValidationSummary = {
    ready:    results.filter((r) => r.readiness === "ready"),
    review:   results.filter((r) => r.readiness === "review"),
    blocked:  results.filter((r) => r.readiness === "blocked"),
    deferred,
  };

  res.json({ summary, results });
});

export default router;
