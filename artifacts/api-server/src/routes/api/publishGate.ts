/**
 * publishGate.ts
 *
 * Final Publish Gate — combines ALL QA checks into a single deterministic
 * campaign status: PASS_READY | REVIEW_REQUIRED | FAIL_BLOCKED
 *
 * GET  /api/publish-gate/:slug             — return cached result
 * POST /api/publish-gate/:slug             — run full gate
 * POST /api/publish-gate/:slug/repair      — run link-audit repair then re-run gate
 *
 * Status rules (severity-based, never average-based):
 *   Any critical issue anywhere  → FAIL_BLOCKED   (score capped at 59)
 *   Any major issue anywhere     → REVIEW_REQUIRED (score capped at 84)
 *   >5 warnings (no crit/major)  → REVIEW_REQUIRED (score capped at 89)
 *   No crit, no major, ≤5 warns  → PASS_READY
 */

import { Router }              from "express";
import fs                      from "node:fs";
import path                    from "node:path";
import { fileURLToPath }       from "node:url";
import { runPrePublishCheck }  from "../../../../../src/validate/prePublishChecker";
import { runGateInvariants }   from "../../../../../src/validate/gateInvariantChecker";
import { runAudit, buildCampaignMap } from "./linkAudit";
import { scoreAiReadiness }    from "../../../../../src/generator/aiReadinessScore";
import type { ProjectConfig }  from "./types";
import type { SelectedAreaPageDef } from "../../../../../src/generator/buildClusterConfigs";
import type { GateInvariantIssue, GateSeverity } from "../../../../../src/validate/gateInvariantChecker";
import { loadProviderProfile } from "./providerProfiles";

const __filename     = fileURLToPath(import.meta.url);
const __dirname      = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");
const PROJECTS_DIR   = path.join(WORKSPACE_ROOT, "config", "projects");

const router = Router();

// ── Types ──────────────────────────────────────────────────────────────────────

export type GateCampaignStatus = "PASS_READY" | "REVIEW_REQUIRED" | "FAIL_BLOCKED";
export type GatePageStatus     = "PASS" | "REVIEW" | "FAIL";

export interface GateIssue {
  severity:            GateSeverity;
  category:            string;
  checkKey:            string;
  pageSlug:            string;
  evidence:            string;
  expected:            string;
  actual:              string;
  suggestedFix:        string;
  autoRepairAvailable: boolean;
}

export interface GatePageResult {
  pageSlug:      string;
  pageStatus:    GatePageStatus;
  tier:          string;
  liveUrl:       string;
  criticalCount: number;
  majorCount:    number;
  warningCount:  number;
  overallScore:  number;
  issues:        GateIssue[];
}

export interface GateStatusBreakdown {
  linkIntegrity: "ok" | "issues";
  images:        "ok" | "issues";
  schema:        "ok" | "issues";
  map:           "ok" | "issues";
  moneyPage:     "ok" | "issues";
  content:       "ok" | "issues";
}

export interface GateReport {
  status:          GateCampaignStatus;
  campaignScore:   number;
  totalPages:      number;
  passedPages:     number;
  reviewPages:     number;
  failedPages:     number;
  criticalCount:   number;
  majorCount:      number;
  warningCount:    number;
  aiReadinessAvg:  number | null;
  breakdown:       GateStatusBreakdown;
  issues:          GateIssue[];
  pageResults:     GatePageResult[];
  ranAt:           string;
  slug:            string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function loadSitemapUrls(clientDir: string): string[] {
  const urls: string[] = [];
  try {
    const sitemapPath = path.join(clientDir, "sitemap.xml");
    if (!fs.existsSync(sitemapPath)) return urls;
    const xml = fs.readFileSync(sitemapPath, "utf8");
    for (const m of xml.match(/<loc>([^<]+)<\/loc>/g) ?? []) {
      const u = m.replace(/<\/?loc>/g, "").trim();
      if (u) urls.push(u);
    }
  } catch { /* ignore */ }
  return urls;
}

function toSlug(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function findDef(areaDir: string, defs: SelectedAreaPageDef[]): SelectedAreaPageDef | undefined {
  return defs.find((d) => d.remotePath === `/${areaDir}/`)
    ?? defs.find((d) => toSlug(d.area) === toSlug(areaDir));
}

/** Derive serviceKey from session data or hub-slug prefix */
function deriveServiceKey(serviceName: string, hubSlug: string): string {
  const sn = serviceName.toLowerCase();
  if (sn.includes("hosting")) return "web_hosting";
  if (sn.includes("seo"))     return "local_seo";
  if (sn.includes("design"))  return "web_design";
  // fallback: derive from hub slug prefix
  if (hubSlug.startsWith("web-hosting")) return "web_hosting";
  if (hubSlug.startsWith("local-seo"))   return "local_seo";
  return "web_design";
}

/**
 * Derive an industryType from a campaign service name.
 * Used so the publish gate can pass campaign-level industry to the
 * pre-publish checker — overriding the project-level (often digital)
 * default with the actual trade service industry.
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

/** Extract city from project.businessAddress (first recognisable token) */
function extractBusinessCity(project: ProjectConfig | null): string {
  if (!project) return "";
  const addr = project.businessAddress ?? "";
  if (!addr) return (project.primaryLocation ?? "");
  // Heuristic: last comma-delimited segment before postcode is the city
  const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  if (parts.length === 1) return parts[0];
  return project.primaryLocation ?? "";
}

// ── Link-audit issue → GateIssue mapper ───────────────────────────────────────

const LINK_AUDIT_SEVERITY: Record<string, GateSeverity> = {
  ROOT_LINK:               "critical",
  BARE_SLUG:               "critical",
  CROSS_CAMPAIGN:          "critical",
  WRONG_HUB:               "critical",
  HUB_WRONG_CLUSTER:       "critical",
  MISSING_MONEY_PAGE:      "critical",
  MISSING_MONEY_PAGE_LINK: "critical",
  WRONG_MONEY_PAGE_HREF:   "critical",
  CLUSTER_HAS_MONEY_BAND:  "critical",
};

const LINK_AUDIT_CATEGORY: Record<string, string> = {
  ROOT_LINK:               "B. Link Integrity",
  BARE_SLUG:               "B. Link Integrity",
  CROSS_CAMPAIGN:          "B. Link Integrity",
  WRONG_HUB:               "B. Link Integrity",
  HUB_WRONG_CLUSTER:       "B. Link Integrity",
  MISSING_MONEY_PAGE:      "C. Money Page",
  MISSING_MONEY_PAGE_LINK: "C. Money Page",
  WRONG_MONEY_PAGE_HREF:   "C. Money Page",
  CLUSTER_HAS_MONEY_BAND:  "C. Money Page",
};

const LINK_AUDIT_FIX: Record<string, string> = {
  ROOT_LINK:               "Fix resource-card href to point to the correct hub or cluster URL",
  BARE_SLUG:               "Add service prefix to the bare slug (e.g. /barnsley/ → /web-design-barnsley/)",
  CROSS_CAMPAIGN:          "Remove or fix cross-campaign internal links",
  WRONG_HUB:               "Update cluster-to-hub link to point to the correct hub",
  HUB_WRONG_CLUSTER:       "Remove or fix hub link pointing to wrong cluster",
  MISSING_MONEY_PAGE:      "Insert money-page-band section with correct link after hero section",
  MISSING_MONEY_PAGE_LINK: "Add a link inside the existing money-page-band",
  WRONG_MONEY_PAGE_HREF:   "Update money-page-band href to match configured moneyPageUrl",
  CLUSTER_HAS_MONEY_BAND:  "Remove money-page-band from cluster pages (hub-only element)",
};

function mapLinkIssues(
  linkIssues: Array<{ page: string; type: string; found: string; expected: string }>
): GateIssue[] {
  return linkIssues.map((iss) => ({
    severity:            LINK_AUDIT_SEVERITY[iss.type] ?? "warning",
    category:            LINK_AUDIT_CATEGORY[iss.type] ?? "B. Link Integrity",
    checkKey:            `link.${iss.type.toLowerCase()}`,
    pageSlug:            iss.page.replace(/\/index\.html$/, ""),
    evidence:            `Found: ${iss.found}`,
    expected:            iss.expected,
    actual:              iss.found,
    suggestedFix:        LINK_AUDIT_FIX[iss.type] ?? "Fix the link issue",
    autoRepairAvailable: ["ROOT_LINK","BARE_SLUG","WRONG_HUB","CROSS_CAMPAIGN",
                          "MISSING_MONEY_PAGE","MISSING_MONEY_PAGE_LINK","WRONG_MONEY_PAGE_HREF",
                          "CLUSTER_HAS_MONEY_BAND"].includes(iss.type),
  }));
}

// ── prePublishChecker result → GateIssue mapper ───────────────────────────────

function mapPrePublishIssues(
  checks: Array<{ key: string; level: string; message: string; category: string }>,
  pageSlug: string
): GateIssue[] {
  const issues: GateIssue[] = [];
  for (const c of checks) {
    if (c.level === "pass") continue;

    const sev: GateSeverity =
      c.level === "fail"   ? "critical" :
      c.level === "major"  ? "major"    : "warning";

    const cat =
      c.category === "google"    ? "A. Page Identity & SEO" :
      c.category === "ai"        ? "H. AI Readiness" :
      c.category === "structure" ? "E. Content Completeness" : "E. Content Completeness";

    issues.push({
      severity:            sev,
      category:            cat,
      checkKey:            c.key,
      pageSlug,
      evidence:            c.message,
      expected:            "Check must pass",
      actual:              `${c.level} — ${c.message}`,
      suggestedFix:        c.message,
      autoRepairAvailable: false,
    });
  }
  return issues;
}

// ── Page-level status derivation ──────────────────────────────────────────────

function derivePageStatus(issues: GateIssue[]): GatePageStatus {
  if (issues.some((i) => i.severity === "critical")) return "FAIL";
  if (issues.some((i) => i.severity === "major" || i.severity === "warning")) return "REVIEW";
  return "PASS";
}

// ── Campaign status + score cap ────────────────────────────────────────────────

function deriveGateStatus(
  criticalCount: number,
  majorCount: number,
  warningCount: number
): GateCampaignStatus {
  if (criticalCount > 0) return "FAIL_BLOCKED";
  if (majorCount > 0)    return "REVIEW_REQUIRED";
  if (warningCount > 5)  return "REVIEW_REQUIRED";
  return "PASS_READY";
}

function applyScoreCap(
  rawScore: number,
  criticalCount: number,
  majorCount: number,
  warningCount: number
): number {
  if (criticalCount > 0) return Math.min(rawScore, 59);
  if (majorCount > 0)    return Math.min(rawScore, 84);
  if (warningCount > 5)  return Math.min(rawScore, 89);
  return rawScore;
}

// ── Build status breakdown ─────────────────────────────────────────────────────

function buildBreakdown(issues: GateIssue[]): GateStatusBreakdown {
  const has = (cats: string[]) => issues.some((i) => cats.includes(i.category));
  return {
    linkIntegrity: has(["B. Link Integrity"])             ? "issues" : "ok",
    images:        has(["D. Images"])                      ? "issues" : "ok",
    schema:        has(["F. Schema"])                      ? "issues" : "ok",
    map:           has(["G. Map"])                         ? "issues" : "ok",
    moneyPage:     has(["C. Money Page"])                  ? "issues" : "ok",
    content:       has(["E. Content Completeness",
                        "A. Page Identity & SEO",
                        "H. AI Readiness"])                ? "issues" : "ok",
  };
}

// ── Core gate runner ───────────────────────────────────────────────────────────

function runGate(slug: string, campaignId?: string): GateReport {
  const clientDir  = path.join(OUTPUT_DIR, slug);
  const project    = loadProject(slug);
  const allDefs    = loadAllDefs(clientDir);
  const sitemapUrls = loadSitemapUrls(clientDir);
  const businessCity = extractBusinessCity(project);
  const domain       = (project?.domain ?? "").replace(/\/+$/, "");

  // Build campaign map for hub/cluster context
  const campaignMap = buildCampaignMap(clientDir, slug);

  // Determine campaign filter if campaignId supplied
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

  // Determine which pages to check
  const areaDirs = fs.readdirSync(clientDir).filter((f) => {
    const full = path.join(clientDir, f);
    if (!fs.statSync(full).isDirectory()) return false;
    if (!fs.existsSync(path.join(full, "index.html"))) return false;
    if (campaignFilter && !campaignFilter.has(f)) return false;
    return true;
  });

  // Run link audit for the whole slug (not per campaignId — the audit already uses sessions)
  let linkIssues: Array<{ page: string; type: string; found: string; expected: string }> = [];
  try {
    const auditReport = runAudit(slug);
    linkIssues = auditReport.issues;
    // If campaignFilter is active, filter link issues to those pages
    if (campaignFilter) {
      linkIssues = linkIssues.filter((iss) => {
        const p = iss.page.replace(/\/index\.html$/, "");
        return campaignFilter!.has(p);
      });
    }
  } catch { /* non-fatal — continue without link audit */ }

  const imageMode   = project?.imageMode ?? "";
  const serviceName = project?.mainService ?? "Service";

  const allGateIssues: GateIssue[] = [];
  const pageResults: GatePageResult[] = [];

  // Per-page checks
  for (const areaDir of areaDirs) {
    const htmlPath = path.join(clientDir, areaDir, "index.html");
    const html     = fs.readFileSync(htmlPath, "utf8");
    const def      = findDef(areaDir, allDefs);
    const area     = def?.area ?? areaDir;
    const primaryKw = def?.primaryKeyword ?? `${serviceName} ${area}`;

    // Determine hub/cluster tier — campaignMap is the ground truth for hub detection
    // (AreaTier only covers priority/secondary/tertiary — hub is a separate concept)
    const isHub = campaignMap.has(areaDir);
    const pageType = isHub ? "hub" : "cluster";

    // Derive service context from campaign map
    let campaignServiceName = serviceName;
    let campaignServiceKey  = "web_design";
    for (const [hubSlug, cd] of campaignMap) {
      if (areaDir === hubSlug || cd.clusterSlugs.has(areaDir)) {
        campaignServiceName = cd.serviceName || serviceName;
        campaignServiceKey  = deriveServiceKey(campaignServiceName, hubSlug);
        break;
      }
    }

    const canonicalUrl = `${domain}/${areaDir}/`;
    // Derive campaign-level industryType from the service name so the checker
    // uses the actual trade industry, not the project-level "web-design" default.
    const _gateCampIndustry    = deriveIndustryFromServiceName(campaignServiceName) ?? project?.industryType;
    // Load the customer provider profile (undefined if not yet configured).
    const _gateProviderProfile = loadProviderProfile(slug, campaignServiceKey);

    // 1. prePublishChecker issues
    const ppReport = runPrePublishCheck({
      html,
      pageSlug:             areaDir,
      expectedCanonicalUrl: canonicalUrl,
      pageType,
      primaryKeyword:       primaryKw,
      location:             area,
      serviceName:          campaignServiceName,
      imageMode,
      sitemapUrls,
      industryType:         _gateCampIndustry,
      buyerType:            project?.buyerType,
      businessDomain:       project?.domain,
      serviceType:          project?.serviceType,
      projectBusinessName:  project?.businessName,
      customerProfile:      _gateProviderProfile
        ? { businessName: _gateProviderProfile.businessName, industry: _gateProviderProfile.industry, approved: _gateProviderProfile.approved }
        : undefined,
    });
    const ppIssues = mapPrePublishIssues(ppReport.checks, areaDir);

    // 2. Gate invariant checker issues
    // Load page-data.json for image library validation
    let pageImages: Record<string, { libraryId?: string; src?: string; alt?: string }> | undefined;
    const imageLibraryEnabled = !!(project as any)?.imageLibrary?.enabled;
    if (imageLibraryEnabled) {
      try {
        const pdPath = path.join(clientDir, areaDir, "page-data.json");
        if (fs.existsSync(pdPath)) {
          const pd = JSON.parse(fs.readFileSync(pdPath, "utf8")) as {
            images?: Record<string, { libraryId?: string; src?: string; alt?: string }>;
          };
          pageImages = pd.images ?? undefined;
        }
      } catch { /* non-fatal */ }
    }

    const gateInvariants = runGateInvariants({
      html,
      pageSlug:     areaDir,
      pageType,
      serviceName:  campaignServiceName,
      serviceKey:   campaignServiceKey,
      location:     area,
      businessCity,
      canonicalUrl,
      moneyPageUrl: "", // money page already checked by link audit
      pageImages,
      imageLibraryEnabled,
    });
    const invariantIssues: GateIssue[] = gateInvariants.map((inv: GateInvariantIssue) => ({
      severity:            inv.severity,
      category:            inv.category,
      checkKey:            inv.checkKey,
      pageSlug:            inv.pageSlug,
      evidence:            inv.evidence,
      expected:            inv.expected,
      actual:              inv.actual,
      suggestedFix:        inv.suggestedFix,
      autoRepairAvailable: inv.autoRepairAvailable,
    }));

    // 3. AI readiness
    let aiIssues: GateIssue[] = [];
    try {
      const air = scoreAiReadiness(html);
      if (air.publishBlocked) {
        aiIssues.push({
          severity:            "critical",
          category:            "H. AI Readiness",
          checkKey:            "h.aiPublishBlocked",
          pageSlug:            areaDir,
          evidence:            `AI readiness score ${air.score}/100 — publishBlocked=true`,
          expected:            "AI readiness score ≥ 90, publishBlocked = false",
          actual:              `Score: ${air.score}`,
          suggestedFix:        "Fix AI readiness blocking issues: " + (air.blockingIssues ?? []).join(", "),
          autoRepairAvailable: false,
        });
      } else if (air.score < 90) {
        aiIssues.push({
          severity:            "major",
          category:            "H. AI Readiness",
          checkKey:            "h.aiScoreLow",
          pageSlug:            areaDir,
          evidence:            `AI readiness score ${air.score}/100 (below 90 threshold)`,
          expected:            "AI readiness score ≥ 90",
          actual:              String(air.score),
          suggestedFix:        "Improve AI summary structure, add structured Q&A, and ensure keyword clarity",
          autoRepairAvailable: false,
        });
      }
    } catch { /* non-fatal */ }

    const pageIssues = [...ppIssues, ...invariantIssues, ...aiIssues];
    allGateIssues.push(...pageIssues);

    const pageCritical = pageIssues.filter((i) => i.severity === "critical").length;
    const pageMajor    = pageIssues.filter((i) => i.severity === "major").length;
    const pageWarning  = pageIssues.filter((i) => i.severity === "warning").length;

    const pageStatus = derivePageStatus(pageIssues);
    const rawScore   = Math.round((ppReport.googleScore + ppReport.aiScore + ppReport.structureScore) / 3);

    pageResults.push({
      pageSlug:      areaDir,
      pageStatus,
      tier:          def?.tier ?? (isHub ? "hub" : "secondary"),
      liveUrl:       canonicalUrl,
      criticalCount: pageCritical,
      majorCount:    pageMajor,
      warningCount:  pageWarning,
      overallScore:  applyScoreCap(rawScore, pageCritical, pageMajor, pageWarning),
      issues:        pageIssues,
    });
  }

  // Add link audit issues (mapped to GateIssue format)
  const mappedLinkIssues = mapLinkIssues(linkIssues);
  allGateIssues.push(...mappedLinkIssues);

  // Merge link issues into per-page results
  for (const li of mappedLinkIssues) {
    const page = pageResults.find((p) => p.pageSlug === li.pageSlug || li.pageSlug.startsWith(p.pageSlug));
    if (page) {
      page.issues.push(li);
      if (li.severity === "critical") {
        page.criticalCount++;
        page.pageStatus = "FAIL";
      } else if (li.severity === "major" && page.pageStatus !== "FAIL") {
        page.majorCount++;
        page.pageStatus = "REVIEW";
      } else if (page.pageStatus === "PASS") {
        page.warningCount++;
        page.pageStatus = "REVIEW";
      }
    }
  }

  // Campaign-level counts
  const criticalCount = allGateIssues.filter((i) => i.severity === "critical").length;
  const majorCount    = allGateIssues.filter((i) => i.severity === "major").length;
  const warningCount  = allGateIssues.filter((i) => i.severity === "warning").length;

  const passedPages  = pageResults.filter((p) => p.pageStatus === "PASS").length;
  const reviewPages  = pageResults.filter((p) => p.pageStatus === "REVIEW").length;
  const failedPages  = pageResults.filter((p) => p.pageStatus === "FAIL").length;

  // Campaign score (average raw, then capped)
  const avgRaw = pageResults.length > 0
    ? Math.round(pageResults.reduce((s, p) => s + p.overallScore, 0) / pageResults.length)
    : 100;
  const campaignScore = applyScoreCap(avgRaw, criticalCount, majorCount, warningCount);

  // AI readiness average
  let aiReadinessAvg: number | null = null;
  {
    const aiScores: number[] = [];
    for (const areaDir of areaDirs) {
      const htmlPath = path.join(clientDir, areaDir, "index.html");
      try {
        const html = fs.readFileSync(htmlPath, "utf8");
        const air  = scoreAiReadiness(html);
        aiScores.push(air.score);
      } catch { /* ignore */ }
    }
    if (aiScores.length > 0) {
      aiReadinessAvg = Math.round(aiScores.reduce((s, n) => s + n, 0) / aiScores.length);
    }
  }

  const status = (() => {
    // If any page is FAIL → FAIL_BLOCKED (regardless of counts, per spec rule 4)
    if (failedPages > 0) return "FAIL_BLOCKED" as const;
    return deriveGateStatus(criticalCount, majorCount, warningCount);
  })();

  // Sort pageResults: FAIL first, then REVIEW, then PASS; within tier: hub first
  const PAGE_STATUS_ORDER: Record<string, number> = { FAIL: 0, REVIEW: 1, PASS: 2 };
  const TIER_ORDER: Record<string, number>        = { hub: 0, priority: 1, secondary: 2, tertiary: 3 };
  pageResults.sort((a, b) => {
    const sa = PAGE_STATUS_ORDER[a.pageStatus] ?? 2;
    const sb = PAGE_STATUS_ORDER[b.pageStatus] ?? 2;
    if (sa !== sb) return sa - sb;
    const ta = TIER_ORDER[a.tier] ?? 2;
    const tb = TIER_ORDER[b.tier] ?? 2;
    return ta - tb;
  });

  // Deduplicate allGateIssues (link audit issues may already appear in page.issues)
  const seen = new Set<string>();
  const deduped = allGateIssues.filter((i) => {
    const k = `${i.checkKey}|${i.pageSlug}|${i.actual}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Sort issues: critical first, then major, then warning
  const SEV_ORDER: Record<string, number> = { critical: 0, major: 1, warning: 2 };
  deduped.sort((a, b) => (SEV_ORDER[a.severity] ?? 2) - (SEV_ORDER[b.severity] ?? 2));

  return {
    status,
    campaignScore,
    totalPages:    pageResults.length,
    passedPages,
    reviewPages,
    failedPages,
    criticalCount,
    majorCount,
    warningCount,
    aiReadinessAvg,
    breakdown:     buildBreakdown(deduped),
    issues:        deduped,
    pageResults,
    ranAt:         new Date().toISOString(),
    slug,
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// GET /api/publish-gate/:slug — return cached result
router.get("/publish-gate/:slug", (req, res) => {
  const { slug }   = req.params;
  const clientDir  = path.join(OUTPUT_DIR, slug);
  const cachePath  = path.join(clientDir, "publish-gate.json");

  if (!fs.existsSync(cachePath)) {
    res.json({ cached: false, report: null });
    return;
  }
  try {
    const report = JSON.parse(fs.readFileSync(cachePath, "utf8")) as GateReport;
    res.json({ cached: true, report });
  } catch {
    res.json({ cached: false, report: null });
  }
});

// POST /api/publish-gate/:slug — run full gate
router.post("/publish-gate/:slug", (req, res) => {
  const { slug }       = req.params;
  const { campaignId } = (req.body ?? {}) as { campaignId?: string };
  const clientDir      = path.join(OUTPUT_DIR, slug);

  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: `No output found for: ${slug}` });
    return;
  }

  try {
    const report = runGate(slug, campaignId);
    // Cache to disk
    fs.writeFileSync(path.join(clientDir, "publish-gate.json"), JSON.stringify(report, null, 2));
    res.json({ cached: false, report });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/publish-gate/:slug/repair — run link-repair then re-run gate
router.post("/publish-gate/:slug/repair", async (req, res) => {
  const { slug } = req.params;
  const clientDir = path.join(OUTPUT_DIR, slug);

  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: `No output found for: ${slug}` });
    return;
  }

  // Step 1: use the same repair logic as the link-audit repair endpoint internally
  // We do this by calling the internal HTTP endpoint
  const repairUrl = `http://localhost:${process.env.PORT ?? 8080}/api/link-audit/${encodeURIComponent(slug)}/repair`;
  let repairResult: { pagesFixed?: number; pagesUploaded?: number; fixedPages?: string[] } = {};
  try {
    const r = await fetch(repairUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    "{}",
    });
    repairResult = await r.json() as typeof repairResult;
  } catch {
    // Non-fatal — continue with gate re-run even if repair failed
  }

  // Step 2: re-run the gate
  try {
    const report = runGate(slug);
    fs.writeFileSync(path.join(clientDir, "publish-gate.json"), JSON.stringify(report, null, 2));
    res.json({ repairResult, report });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg, repairResult });
  }
});

export default router;
