
function normalisePrimaryKeyword(raw: string, h1: string, areaDir: string) {
  const v = String(raw || "").trim();

  // Detect polluted multi-service keywords
  const bad =
    v.includes(",") ||
    v.toLowerCase().includes(" and ") ||
    v.split(" ").length > 8;

  if (!bad && v) return v;

  // Prefer clean H1
  if (h1 && h1.trim()) return h1.trim();

  // Fallback to slug-derived title
  return areaDir
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}


/**
 * prePublishQa.ts
 *
 * POST /api/pre-publish-qa/:slug  — run full pre-publish QA check
 * GET  /api/pre-publish-qa/:slug  — return cached results (fast reload)
 *
 * Runs three checkers per page:
 *   1. prePublishChecker  — Google Ready + AI Ready + Structure
 *   2. duplicateScanner   — cross-page duplicate content detection
 *
 * Results are cached to output/{slug}/pre-publish-qa.json
 */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPrePublishCheck } from "../../../../../src/validate/prePublishChecker";
import { scanDuplicates }     from "../../../../../src/validate/duplicateScanner";
import { scoreAiReadiness }   from "../../../../../src/generator/aiReadinessScore";
import type { ProjectConfig } from "./types";
import type { SelectedAreaPageDef } from "../../../../../src/generator/buildClusterConfigs";
import { loadProviderProfile } from "./providerProfiles";
import { resolveServiceIntent } from "../../../../../src/serviceIntent.js";

const __filename    = fileURLToPath(import.meta.url);
const __dirname     = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR    = path.join(WORKSPACE_ROOT, "output");
const PROJECTS_DIR  = path.join(WORKSPACE_ROOT, "config", "projects");

/**
 * Derive an industryType from a campaign service name.
 * Mirrors the logic in rollout.ts so prePublishQa passes campaign-level
 * industry to the checker rather than the project-level default.
 */
function deriveIndustryFromServiceName(serviceName: string): string | undefined {
  const svc = serviceName.toLowerCase().trim();
  if (/plumb|drain/.test(svc))                      return "plumbing";
  if (/electr/.test(svc))                           return "electrical";
  if (/boiler|heat(?:ing)?|gas[\s-]?eng/.test(svc)) return "heating";
  if (/roof/.test(svc))                             return "roofing";
  if (/landscape|garden/.test(svc))                 return "landscaping";
  if (/web[\s-]?des|website[\s-]?des/.test(svc))   return "web-design";
  if (/local[\s-]?seo/.test(svc))                  return "local-seo";
  if (/\bseo\b/.test(svc))                         return "seo";
  if (/digital[\s-]?mark/.test(svc))               return "digital-marketing";
  const isDigitalish = /digital|online|marketing|website|\bweb\b|social|ppc/.test(svc);
  if (!isDigitalish) return "genericTrade";
  return undefined;
}

const router = Router();

// In-memory job status — survives across requests for the same slug
const jobStatus = new Map<string, "running" | "done" | "error">();

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadProject(slug: string): ProjectConfig | null {
  const p = path.join(PROJECTS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")) as ProjectConfig; }
  catch { return null; }
}

function loadAllDefs(clientDir: string): SelectedAreaPageDef[] {
  const all: SelectedAreaPageDef[] = [];
  const mainPath = path.join(clientDir, "selected-area-defs.json");
  if (fs.existsSync(mainPath)) {
    try { all.push(...(JSON.parse(fs.readFileSync(mainPath, "utf8")) as SelectedAreaPageDef[])); }
    catch { /* ignore */ }
  }
  const sessionsDir = path.join(clientDir, "sessions");
  if (fs.existsSync(sessionsDir)) {
    for (const file of fs.readdirSync(sessionsDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const s = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), "utf8")) as Record<string, unknown>;
        all.push(...((s.selectedAreaDefs ?? []) as SelectedAreaPageDef[]));
      } catch { /* skip */ }
    }
  }
  return all;
}

function toSlug(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function stripPrefix(slug: string): string {
  return slug
    .replace(/^web-design-/, "")
    .replace(/^local-seo-/, "")
    .replace(/^email-marketing-/, "")
    .replace(/^web-hosting-/, "")
    .replace(/^affordable-web-design-/, "affordable-");
}

function findDef(areaDir: string, defs: SelectedAreaPageDef[]): SelectedAreaPageDef | undefined {
  // When multiple defs share the same remotePath (e.g. one from selected-area-defs.json
  // with area=null and one from a session with area populated), prefer the one with area.
  const byPath = defs.filter((d) => d.remotePath === `/${areaDir}/`);
  if (byPath.length) return byPath.find((d) => !!d.area) ?? byPath[0];

  const slug = toSlug(areaDir);
  const byArea = defs.find((d) => d.area && toSlug(d.area) === slug);
  if (byArea) return byArea;

  const stripped = stripPrefix(slug);
  return defs.find((d) => d.area && toSlug(d.area) === stripped);
}

/** Parse all <loc> URLs from a sitemap XML file. */
function loadSitemapUrls(clientDir: string): string[] {
  const urls: string[] = [];
  try {
    const sitemapPath = path.join(clientDir, "sitemap.xml");
    if (!fs.existsSync(sitemapPath)) return urls;
    const xml = fs.readFileSync(sitemapPath, "utf8");
    const matches = xml.match(/<loc>([^<]+)<\/loc>/g) ?? [];
    for (const m of matches) {
      const u = m.replace(/<\/?loc>/g, "").trim();
      if (u) urls.push(u);
    }
  } catch { /* ignore */ }
  return urls;
}

// ── GET /api/pre-publish-qa/:slug/page/:areaDir  (single-page fast recheck) ──


function titleFromSlug(areaDir: string): string {
  return String(areaDir || "")
    .split("-")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function isPollutedPrimaryKeyword(v: string): boolean {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return true;
  return (
    s.includes(",") ||
    s.includes(" and ") ||
    s.split(/\s+/).length > 8 ||
    (s.includes("web design") && s.includes("hosting") && s.includes("local seo"))
  );
}

function cleanQaPrimaryKeyword(raw: string, h1: string, areaDir: string): string {
  if (!isPollutedPrimaryKeyword(raw)) return String(raw || "").trim();
  if (String(h1 || "").trim()) return String(h1).trim();
  return titleFromSlug(areaDir);
}

router.get("/pre-publish-qa/:slug/page/:areaDir", (req, res) => {
  const { slug, areaDir } = req.params;
  const clientDir  = path.join(OUTPUT_DIR, slug);
  const htmlPath   = path.join(clientDir, areaDir, "index.html");

  if (!fs.existsSync(htmlPath)) {
    res.status(404).json({ error: `Page not found: ${areaDir}` });
    return;
  }

  const project      = loadProject(slug);
  const allDefs      = loadAllDefs(clientDir);
  const sitemapUrls  = loadSitemapUrls(clientDir);
  const html         = fs.readFileSync(htmlPath, "utf8");
  const def          = findDef(areaDir, allDefs);
  const pageDataPath = path.join(clientDir, areaDir, "page-data.json");
  let pageData: Record<string, unknown> | null = null;
  try {
    if (fs.existsSync(pageDataPath)) {
      pageData = JSON.parse(fs.readFileSync(pageDataPath, "utf8")) as Record<string, unknown>;
    }
  } catch { /* non-fatal */ }

  const projectService = ((project as unknown as Record<string, unknown>)?.mainService as string) ?? "Service";
  const pageIntent = resolveServiceIntent({
    pageSlug: areaDir,
    pageData,
    def: def ? {
      primaryKeyword: def.primaryKeyword,
      area: def.area,
      service: (def as unknown as Record<string, unknown>).service as string | undefined,
    } : null,
    html,
    fallbackService: projectService,
  });

  const area        = pageIntent.location;
  const serviceName = pageIntent.serviceName;
  const domain      = project?.domain?.replace(/\/+$/, "") ?? "";
  const primaryKw   = pageIntent.primaryKeyword;
  const isHub        = def?.tier === "hub";
  const pageType     = isHub ? "hub" : "cluster" as "hub" | "cluster";
  const imageMode    = (project as unknown as Record<string, unknown>)?.imageMode as string ?? "";

  const ppReport = runPrePublishCheck({
    html,
    pageSlug:             areaDir,
    expectedCanonicalUrl: `${domain}/${areaDir}/`,
    pageType,
    primaryKeyword:       primaryKw,
    location:             area,
    serviceName,
    imageMode,
    sitemapUrls,
    industryType:         project?.industryType,
    buyerType:            project?.buyerType,
    businessDomain:       project?.domain,
    serviceType:          project?.serviceType,
    projectBusinessName:  project?.businessName,
  });

  let aiReadinessScore: ReturnType<typeof scoreAiReadiness> | undefined;
  try { aiReadinessScore = scoreAiReadiness(html); } catch { /* non-fatal */ }

  res.json({
    areaDir,
    area,
    tier:           def?.tier ?? (isHub ? "hub" : "secondary"),
    liveUrl:        `${domain}/${areaDir}/`,
    status:         ppReport.status,
    googleScore:    ppReport.googleScore,
    aiScore:        ppReport.aiScore,
    structureScore: ppReport.structureScore,
    overallScore:   ppReport.overallScore,
    rawScore:       ppReport.rawScore,
    capReason:      ppReport.capReason,
    criticalCount:  ppReport.criticalCount,
    majorCount:     ppReport.majorCount,
    warningCount:   ppReport.warningCount,
    wordCount:      ppReport.wordCount,
    checks:         ppReport.checks,
    recommendedFixes: ppReport.recommendedFixes,
    aiReadiness:    aiReadinessScore,
    duplicateRisk:  { level: "unknown", maxSimilarity: 0, matches: [] },
  });
});

// ── GET /api/pre-publish-qa/:slug  (return cached results + job status) ──────

router.get("/pre-publish-qa/:slug", (req, res) => {
  const { slug }   = req.params;
  const clientDir  = path.join(OUTPUT_DIR, slug);
  const cachePath  = path.join(clientDir, "pre-publish-qa.json");
  const status     = jobStatus.get(slug) ?? "idle";

  if (status === "running") {
    res.json({ status: "running", cached: false, results: null });
    return;
  }

  if (!fs.existsSync(cachePath)) {
    res.json({ status, cached: false, results: null });
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    res.json({ status: status || "done", cached: true, ...data });
  } catch {
    res.json({ status: "error", cached: false, results: null });
  }
});

// ── POST /api/pre-publish-qa/:slug  (start background job) ───────────────────

router.post("/pre-publish-qa/:slug", (req, res) => {
  const { slug }       = req.params;
  const { campaignId } = (req.body ?? {}) as { campaignId?: string };
  const clientDir      = path.join(OUTPUT_DIR, slug);

  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: `No output found for: ${slug}` });
    return;
  }

  // If already running, tell the client to keep polling
  if (jobStatus.get(slug) === "running") {
    res.json({ status: "running" });
    return;
  }

  // Load fast config synchronously before responding
  const project    = loadProject(slug);
  const allDefs    = loadAllDefs(clientDir);
  const sitemapUrls = loadSitemapUrls(clientDir);

  // Determine which session hub path we're working against (for image mode etc)
  let sessionHubPath: string | undefined;
  if (campaignId) {
    const sf = path.join(clientDir, "sessions", `${campaignId}.json`);
    if (fs.existsSync(sf)) {
      try {
        const s = JSON.parse(fs.readFileSync(sf, "utf8")) as Record<string, unknown>;
        const defs = (s.selectedAreaDefs ?? []) as Array<{ tier?: string; remotePath?: string }>;
        sessionHubPath = defs.find((d) => d.tier === "hub")?.remotePath;
      } catch { /* ignore */ }
    }
  }

  // Build campaign area filter if campaignId supplied
  let campaignFilter: Set<string> | null = null;
  if (campaignId) {
    const sf = path.join(clientDir, "sessions", `${campaignId}.json`);
    if (fs.existsSync(sf)) {
      try {
        const s = JSON.parse(fs.readFileSync(sf, "utf8")) as Record<string, unknown>;
        const defs = (s.selectedAreaDefs ?? []) as Array<{ remotePath?: string }>;
        campaignFilter = new Set(
          defs.map((d) => d.remotePath?.replace(/^\/|\/$/g, "")).filter(Boolean) as string[]
        );
      } catch { /* ignore */ }
    }
  }

  // Load campaign-level service key, industry type, and provider profile.
  // These apply uniformly to all pages in the campaign and drive the schema
  // identity checks (s.schemaProviderMissing, s.schemaProviderDigital, etc.).
  let _qaCampaignServiceKey = "";
  let _qaCampaignIndustry: string | undefined = project?.industryType;
  if (campaignId) {
    const _sf = path.join(clientDir, "sessions", `${campaignId}.json`);
    if (fs.existsSync(_sf)) {
      try {
        const _s  = JSON.parse(fs.readFileSync(_sf, "utf8")) as Record<string, unknown>;
        const _c  = _s.campaign as { serviceKey?: string; industryType?: string; serviceName?: string } | undefined;
        _qaCampaignServiceKey = _c?.serviceKey ?? "";
        if (_c?.industryType) {
          _qaCampaignIndustry = _c.industryType;
        } else if (_c?.serviceName) {
          _qaCampaignIndustry = deriveIndustryFromServiceName(_c.serviceName) ?? _qaCampaignIndustry;
        }
      } catch { /* ignore */ }
    }
  }
  const _qaProviderProfile = _qaCampaignServiceKey
    ? loadProviderProfile(slug, _qaCampaignServiceKey)
    : undefined;

  // Respond immediately — heavy processing continues in background
  jobStatus.set(slug, "running");
  res.json({ status: "running" });

  // Run all checks after the response is flushed
  setImmediate(() => {
    try {
      const areaDirs = fs.readdirSync(clientDir).filter((f) => {
        const full = path.join(clientDir, f);
        if (!fs.statSync(full).isDirectory()) return false;
        if (!fs.existsSync(path.join(full, "index.html"))) return false;
        if (campaignFilter && !campaignFilter.has(f)) return false;
        return true;
      });

      const imageMode   = (project as unknown as Record<string, unknown>)?.imageMode as string ?? "";
      const serviceName = ((project as unknown as Record<string, unknown>)?.mainService as string) ?? "Service";
      const domain      = project?.domain?.replace(/\/+$/, "") ?? "";

      // Build page list for duplicate scanning
      const pagesList: Array<{ slug: string; area: string; html: string }> = [];

      // Run per-page checks
      const pageResults = areaDirs.map((areaDir) => {
        const htmlPath  = path.join(clientDir, areaDir, "index.html");
        const html      = fs.readFileSync(htmlPath, "utf8");
        const def       = findDef(areaDir, allDefs);
        const area      = def?.area ?? areaDir;
        const pageH1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "").replace(/<[^>]+>/g, "").trim();
        const primaryKw = cleanQaPrimaryKeyword(def?.primaryKeyword ?? "", pageH1, areaDir) || `${serviceName} ${area}`;
        const isHub     = def?.tier === "hub" || sessionHubPath?.replace(/^\/|\/$/g, "") === areaDir;
        const pageType  = isHub ? "hub" : "cluster" as "hub" | "cluster";
        const expectedCanonical = `${domain}/${areaDir}/`;

        pagesList.push({ slug: areaDir, area, html });

        const ppReport = runPrePublishCheck({
          html,
          pageSlug:             areaDir,
          expectedCanonicalUrl: expectedCanonical,
          pageType,
          primaryKeyword:       primaryKw,
          location:             area,
          serviceName,
          imageMode,
          sitemapUrls,
          industryType:         _qaCampaignIndustry,
          buyerType:            project?.buyerType,
          businessDomain:       project?.domain,
          serviceType:          project?.serviceType,
          projectBusinessName:  project?.businessName,
          customerProfile:      _qaProviderProfile
            ? { businessName: _qaProviderProfile.businessName, industry: _qaProviderProfile.industry, approved: _qaProviderProfile.approved }
            : undefined,
        });

        let aiReadinessScore: ReturnType<typeof scoreAiReadiness> | undefined;
        try { aiReadinessScore = scoreAiReadiness(html); } catch { /* non-fatal */ }

        return {
          areaDir,
          area,
          tier:           def?.tier ?? (isHub ? "hub" : "secondary"),
          liveUrl:        `${domain}/${areaDir}/`,
          status:         ppReport.status,
          googleScore:    ppReport.googleScore,
          aiScore:        ppReport.aiScore,
          structureScore: ppReport.structureScore,
          overallScore:   ppReport.overallScore,
          rawScore:       ppReport.rawScore,
          capReason:      ppReport.capReason,
          criticalCount:  ppReport.criticalCount,
          majorCount:     ppReport.majorCount,
          warningCount:   ppReport.warningCount,
          wordCount:      ppReport.wordCount,
          brokenLinks:    ppReport.brokenLinks,
          imageIssues:    ppReport.imageIssues,
          schemaIssues:   ppReport.schemaIssues,
          checks:         ppReport.checks,
          recommendedFixes: ppReport.recommendedFixes,
          aiReadiness:    aiReadinessScore,
        };
      });

      // Duplicate scan across all campaign pages
      const dupResult = scanDuplicates(pagesList);

      // Merge duplicate results into page results
      const dupMap = new Map(dupResult.pages.map((p) => [p.slug, p]));
      const fullResults = pageResults.map((pr) => {
        const dup = dupMap.get(pr.areaDir);
        return {
          ...pr,
          duplicateRisk: dup
            ? {
              level:         dup.level,
              maxSimilarity: Math.round(dup.maxSimilarity * 100),
              matches:       dup.matches,
            }
            : { level: "low" as const, maxSimilarity: 0, matches: [] },
        };
      });

      // Sort: hub first, then by status (fail → review → pass), then by name
      const STATUS_ORDER: Record<string, number> = { fail: 0, review: 1, pass: 2 };
      const TIER_ORDER:   Record<string, number> = { hub: 0, priority: 1, secondary: 2, tertiary: 3 };
      fullResults.sort((a, b) => {
        const ta = TIER_ORDER[a.tier ?? "secondary"] ?? 2;
        const tb = TIER_ORDER[b.tier ?? "secondary"] ?? 2;
        if (ta !== tb) return ta - tb;
        const sa = STATUS_ORDER[a.status] ?? 2;
        const sb = STATUS_ORDER[b.status] ?? 2;
        return sa - sb;
      });

      // Campaign-level summary
      const passCount   = fullResults.filter((r) => r.status === "pass").length;
      const reviewCount = fullResults.filter((r) => r.status === "review").length;
      const failCount   = fullResults.filter((r) => r.status === "fail").length;
      const avg = (key: keyof typeof fullResults[0]) =>
        Math.round(fullResults.reduce((s, r) => s + ((r[key] as number) || 0), 0) / (fullResults.length || 1));

      const pagesWithAiReadiness = fullResults.filter((r) => r.aiReadiness !== undefined);
      const aiReadinessAvg = pagesWithAiReadiness.length > 0
        ? Math.round(pagesWithAiReadiness.reduce((s, r) => s + (r.aiReadiness?.score ?? 0), 0) / pagesWithAiReadiness.length)
        : null;
      const aiReadinessBlockedCount = pagesWithAiReadiness.filter((r) => r.aiReadiness?.publishBlocked).length;

      const summary = {
        totalPages:           fullResults.length,
        passCount,
        reviewCount,
        failCount,
        googleReadyAvg:       avg("googleScore"),
        aiReadyAvg:           avg("aiScore"),
        structureAvg:         avg("structureScore"),
        highDuplicateCount:   dupResult.highRiskCount,
        reviewDuplicateCount: dupResult.reviewRiskCount,
        canDeploy:            failCount === 0 && aiReadinessBlockedCount === 0,
        aiReadinessAvg,
        aiReadinessBlockedCount,
        ranAt:                new Date().toISOString(),
      };

      const output = { summary, results: fullResults };

      // Cache to disk
      fs.writeFileSync(path.join(clientDir, "pre-publish-qa.json"), JSON.stringify(output, null, 2));

      jobStatus.set(slug, "done");
    } catch (err) {
      console.error("[prePublishQa] scan failed", err);
      jobStatus.set(slug, "error");
    }
  });
});

export default router;
