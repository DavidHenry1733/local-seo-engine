/**
 * systemHealth.ts
 *
 * POST /api/system-health/:slug/run      — start async full-site audit job
 * GET  /api/system-health/:slug/job/:id  — poll job status / stream progress
 * GET  /api/system-health/:slug          — return cached report
 * GET  /api/system-health/:slug/export   — download JSON or CSV report
 * POST /api/system-health/:slug/fix      — auto-apply a single fixable issue
 */

import { Router }        from "express";
import fs                from "node:fs";
import path              from "node:path";
import { randomUUID }    from "node:crypto";
import { fileURLToPath } from "node:url";
import * as ftp          from "basic-ftp";
import { scoreAiReadiness } from "../../../../../src/generator/aiReadinessScore";
import type { AiReadinessResult } from "../../../../../src/generator/aiReadinessScore";

const __filename     = fileURLToPath(import.meta.url);
const __dirname      = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");
const PROJECTS_DIR   = path.join(WORKSPACE_ROOT, "config", "projects");

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

export type Severity  = "pass" | "warning" | "fail";
export type JobStatus = "running" | "done" | "error";

export interface HealthCheck {
  name:   string;
  status: Severity;
  detail: string;
}

export interface IssueRecord {
  url:          string;
  sourcePage:   string;
  issueType:    string;
  severity:     "warning" | "fail";
  evidence:     string;
  suggestedFix: string;
}

export interface PageHealthResult {
  url:          string;
  slug:         string;
  httpStatus:   number | "error";
  finalUrl:     string;
  title:        string | null;
  metaDesc:     string | null;
  h1:           string | null;
  canonical:    string | null;
  isNoindex:    boolean;
  wordCount:    number;
  inSitemap:    boolean;
  schemaTypes:  string[];
  schemaValid:  boolean;
  schemaErrors: string[];
  brokenInternalLinks: Array<{ href: string; anchorText: string; status: number | "error" }>;
  previewLinks:        number;
  brokenImages:        Array<{ src: string; status: number | "error" }>;
  hasBusinessName:     boolean;
  hasPhone:            boolean;
  hasAddress:          boolean;
  placeholderTokens:   string[];
  checks:              HealthCheck[];
  overallStatus:       Severity;
  aiReadiness?:        AiReadinessResult;
}

export interface SystemHealthSummary {
  totalPages:          number;
  live200Count:        number;
  notFoundCount:       number;
  errorCount:          number;
  brokenInternalLinks: number;
  brokenImages:        number;
  previewUrlCount:     number;
  noindexCount:        number;
  thinContentCount:    number;
  schemaIssueCount:    number;
  missingTitleCount:   number;
  missingH1Count:      number;
  placeholderCount:    number;
  indexEstimateCount:  number | null;
  gscIndexedCount:     number | null;
  passCount:           number;
  warningCount:        number;
  failCount:           number;
  canDeploy:           boolean;
  indexingNote:        string;
  aiReadinessAvg:      number | null;
  aiReadinessBlocked:  number;
  aiReadinessElite:    number;
  aiReadinessGood:     number;
  aiReadinessWeak:     number;
  aiReadinessFail:     number;
}

export interface SystemHealthReport {
  runAt:       string;
  slug:        string;
  domain:      string;
  sitemapUrl:  string;
  sitemapHttpStatus: number | "error";
  sitemapUrlCount:   number;
  siteOffline?: boolean;
  pages:       PageHealthResult[];
  issues:      IssueRecord[];
  summary:     SystemHealthSummary;
}

interface Job {
  status:     JobStatus;
  startedAt:  string;
  progress:   { done: number; total: number; stage: string };
  report?:    SystemHealthReport;
  error?:     string;
}

const jobs = new Map<string, Job>();

function pruneJobs() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (new Date(job.startedAt).getTime() < cutoff) jobs.delete(id);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadProject(slug: string): Record<string, unknown> | null {
  const p = path.join(PROJECTS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return null; }
}

function cachePath(slug: string): string {
  return path.join(OUTPUT_DIR, slug, "system-health.json");
}

function parseSitemapUrls(xml: string): string[] {
  return (xml.match(/<loc>([^<]+)<\/loc>/g) ?? [])
    .map((m) => m.replace(/<\/?loc>/g, "").trim())
    .filter(Boolean);
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 12_000): Promise<Response> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

async function headStatus(url: string): Promise<{ status: number | "error"; contentType: string | null }> {
  try {
    const r = await fetchWithTimeout(url, { method: "HEAD" }, 8_000);
    return { status: r.status, contentType: r.headers.get("content-type") };
  } catch {
    return { status: "error", contentType: null };
  }
}

async function batchCheck<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency = 8,
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(fn));
  }
}

function extractText(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() || null : null;
}

function stripTags(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function extractSchemas(html: string): Array<{ raw: string; parsed: unknown; types: string[]; error: string | null }> {
  const results = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const types  = Array.isArray(parsed)
        ? parsed.map((o) => o?.["@type"]).filter(Boolean)
        : [parsed?.["@type"]].filter(Boolean);
      results.push({ raw, parsed, types: types as string[], error: null });
    } catch (e: unknown) {
      results.push({ raw, parsed: null, types: [], error: (e as Error).message });
    }
  }
  return results;
}

function extractInternalLinks(html: string, domain: string): Array<{ href: string; anchorText: string }> {
  const out: Array<{ href: string; anchorText: string }> = [];
  const seen = new Set<string>();
  const re = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    const isInternal = href.startsWith("/") || href.startsWith(domain);
    if (!isInternal) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ href, anchorText: m[2].replace(/<[^>]+>/g, "").trim().slice(0, 120) });
  }
  return out;
}

function extractImages(html: string, domain: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<img\s[^>]*src="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const src = m[1].trim();
    if (!src || src.startsWith("data:")) continue;
    const full = src.startsWith("http") ? src : `${domain.replace(/\/+$/, "")}${src}`;
    if (!seen.has(full)) { seen.add(full); out.push(full); }
  }
  return out;
}

function findPlaceholders(html: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\{\{[A-Z_]+\}\}/g,
    /\[PLACEHOLDER[^\]]*\]/gi,
    /\[YOUR[^\]]*\]/gi,
    /lorem ipsum/gi,
    /TODO:/gi,
    /REPLACE_ME/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const token = m[0].trim();
      if (!found.includes(token)) found.push(token);
    }
  }
  return found;
}

function resolveHref(href: string, domain: string): string {
  return href.startsWith("http") ? href : `${domain.replace(/\/+$/, "")}${href}`;
}

function makeCheck(name: string, status: Severity, detail: string): HealthCheck {
  return { name, status, detail };
}

function isPreviewLink(href: string): boolean {
  return /\/preview\//i.test(href);
}

// ── Core per-page analyser ────────────────────────────────────────────────────

async function analysePage(
  url:            string,
  sitemapUrlSet:  Set<string>,
  domain:         string,
  profile:        { businessName?: string; phone?: string; address?: string },
  offlineHtml?:   string,
): Promise<{
  result:        PageHealthResult;
  rawInternalLinks: Array<{ href: string; fullUrl: string; anchorText: string }>;
  imageSrcs:     string[];
}> {
  const slug = url.replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");

  let httpStatus: number | "error";
  let finalUrl = url;
  let html = "";

  if (offlineHtml !== undefined) {
    httpStatus = 200;
    html = offlineHtml;
  } else {
    httpStatus = "error";
    try {
      const r = await fetchWithTimeout(url, {}, 12_000);
      httpStatus = r.status;
      finalUrl   = r.url;
      if (r.ok) html = await r.text();
    } catch { /* stay "error" */ }
  }

  const title   = extractText(html, /<title[^>]*>([^<]*)<\/title>/i);
  const metaDesc = extractText(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
    ?? extractText(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const h1       = extractText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const canonical = extractText(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)
    ?? extractText(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const isNoindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  const wordCount = countWords(stripTags(html));

  const schemas      = extractSchemas(html);
  const schemaTypes  = schemas.flatMap((s) => s.types);
  const schemaErrors = schemas.filter((s) => s.error).map((s) => s.error as string);
  const schemaValid  = schemas.length > 0 && schemaErrors.length === 0;

  const rawLinks   = extractInternalLinks(html, domain);
  const imageSrcs  = extractImages(html, domain);
  const placeholders = findPlaceholders(html);

  const hasBusinessName = !!(profile.businessName && html.includes(profile.businessName));
  const hasPhone        = !!(profile.phone && html.includes(profile.phone.replace(/\s/g, "")));
  const hasAddress      = !!(profile.address &&
    profile.address.split(",")[0] &&
    html.toLowerCase().includes(profile.address.split(",")[0].toLowerCase().trim()));

  const inSitemap = sitemapUrlSet.has(url) || sitemapUrlSet.has(url.replace(/\/$/, ""));

  const previewLinks = rawLinks.filter((l) => isPreviewLink(l.href)).length;

  // Build checks
  const checks: HealthCheck[] = [];

  checks.push(makeCheck("HTTP Status", httpStatus === 200 ? "pass" : httpStatus === "error" ? "fail" : "fail", `HTTP ${httpStatus}`));
  checks.push(makeCheck("In Sitemap", inSitemap ? "pass" : "warning", inSitemap ? "Found in sitemap" : "Not found in sitemap"));
  checks.push(makeCheck("Title Tag", title ? "pass" : "fail", title ? `"${title.slice(0, 60)}"` : "Missing title tag"));
  checks.push(makeCheck("Meta Description", metaDesc ? "pass" : "warning", metaDesc ? `${metaDesc.slice(0, 80)}…` : "Missing meta description"));
  checks.push(makeCheck("H1 Tag", h1 ? "pass" : "fail", h1 ? `"${h1.slice(0, 80)}"` : "Missing H1 tag"));
  checks.push(makeCheck("Canonical URL", canonical ? "pass" : "warning", canonical ?? "No canonical tag"));
  checks.push(makeCheck("Not Noindex", !isNoindex ? "pass" : "fail", isNoindex ? "Page has noindex directive" : "Indexable"));
  checks.push(makeCheck("Word Count", wordCount >= 500 ? "pass" : wordCount >= 300 ? "warning" : "fail", `${wordCount} words`));
  checks.push(makeCheck("Schema Present", schemas.length > 0 ? "pass" : "warning", schemas.length > 0 ? `Types: ${schemaTypes.join(", ") || "unknown"}` : "No JSON-LD schema found"));
  checks.push(makeCheck("Schema Valid", schemaErrors.length === 0 ? "pass" : "fail", schemaErrors.length === 0 ? "Valid JSON" : `Errors: ${schemaErrors.join("; ")}`));
  checks.push(makeCheck("Preview Links", previewLinks === 0 ? "pass" : "fail", previewLinks === 0 ? "None" : `${previewLinks} /preview/ link(s) found in HTML`));
  checks.push(makeCheck("Placeholder Tokens", placeholders.length === 0 ? "pass" : "fail", placeholders.length === 0 ? "None" : `Found: ${placeholders.slice(0, 5).join(", ")}`));
  if (profile.businessName) checks.push(makeCheck("Business Name", hasBusinessName ? "pass" : "warning", hasBusinessName ? "Present" : `"${profile.businessName}" not found on page`));
  if (profile.phone)        checks.push(makeCheck("Phone Number",   hasPhone  ? "pass" : "warning", hasPhone  ? "Present" : `${profile.phone} not found on page`));
  if (profile.address)      checks.push(makeCheck("Address",        hasAddress ? "pass" : "warning", hasAddress ? "Present" : "Address not found on page"));

  const worstSeverity = (s: Severity[]) => s.includes("fail") ? "fail" : s.includes("warning") ? "warning" : "pass";
  const overallStatus: Severity = httpStatus !== 200 ? "fail" : worstSeverity(checks.map((c) => c.status));

  // AI Readiness Score — score the fetched/local HTML when available
  let aiReadiness: AiReadinessResult | undefined;
  if (html.length > 200) {
    try { aiReadiness = scoreAiReadiness(html); } catch { /* non-fatal */ }
  }

  const rawInternalLinks = rawLinks.map((l) => ({
    href:       l.href,
    fullUrl:    resolveHref(l.href, domain),
    anchorText: l.anchorText,
  }));

  return {
    result: {
      url,
      slug,
      httpStatus,
      finalUrl,
      title,
      metaDesc,
      h1,
      canonical,
      isNoindex,
      wordCount,
      inSitemap,
      schemaTypes,
      schemaValid,
      schemaErrors,
      brokenInternalLinks: [],
      previewLinks,
      brokenImages: [],
      hasBusinessName,
      hasPhone,
      hasAddress,
      placeholderTokens: placeholders,
      checks,
      overallStatus,
      aiReadiness,
    },
    rawInternalLinks,
    imageSrcs,
  };
}

// ── Main audit runner ─────────────────────────────────────────────────────────

async function runAudit(slug: string, job: Job): Promise<SystemHealthReport> {
  const project = loadProject(slug);
  if (!project) throw new Error(`No project found: ${slug}`);

  const domain     = (project.domain as string | undefined)?.replace(/\/+$/, "") ?? "";
  const sitemapUrl = `${domain}/sitemap.xml`;

  const businessName = project.businessName as string | undefined;
  const phone        = (project.phone as string | undefined)?.replace(/[\s-]/g, "");
  const address      = project.businessAddress as string | undefined;
  const profile      = { businessName, phone, address };

  // 0. Quick reachability probe (3 s) — if the site is offline, work from local files
  job.progress.stage = "Checking site reachability…";
  let siteOnline = false;
  if (domain) {
    try {
      const probe = await fetchWithTimeout(domain + "/", { method: "HEAD" }, 3_000);
      siteOnline = probe.status < 600;
    } catch { /* unreachable */ }
  }

  // 1. Fetch sitemap (skip if offline)
  job.progress.stage = siteOnline ? "Fetching sitemap…" : "Site offline — reading local files…";
  let sitemapHttpStatus: number | "error" = "error";
  let sitemapXml = "";
  if (siteOnline) {
    try {
      const r = await fetchWithTimeout(sitemapUrl, {}, 15_000);
      sitemapHttpStatus = r.status;
      if (r.ok) sitemapXml = await r.text();
    } catch { /* stay error */ }
  }

  // Filter out malformed sitemap entries (absolute URLs embedded in the path — e.g.
  // "https://domain.com/https:domain.com/page/" — that arise from a double-domain bug)
  const rawSitemapUrls = parseSitemapUrls(sitemapXml);
  const sitemapUrls   = rawSitemapUrls.filter((u) => {
    try {
      const { pathname } = new URL(u);
      // Reject any URL whose path segment itself contains a protocol string
      return !pathname.includes("https:") && !pathname.includes("http:");
    } catch { return false; }
  });
  const sitemapUrlSet = new Set(sitemapUrls);

  // Build list of pages to check (from sitemap, or local output directory as fallback)
  const clientDir = path.join(OUTPUT_DIR, slug);
  let localPageDirs: string[] = [];
  if (fs.existsSync(clientDir)) {
    localPageDirs = fs.readdirSync(clientDir).filter((d) => {
      const full = path.join(clientDir, d);
      // Also filter out malformed directory names (phantom output from double-domain bug)
      if (d.includes("https:") || d.includes("http:")) return false;
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "index.html"));
    });
  }

  let urlsToCheck: string[] = sitemapUrls;
  if (urlsToCheck.length === 0 && domain && localPageDirs.length > 0) {
    urlsToCheck = localPageDirs.map((d) => `${domain}/${d}/`);
    if (!siteOnline) {
      job.progress.stage = `Site offline — analysing ${urlsToCheck.length} pages from local output…`;
    } else {
      job.progress.stage = `Sitemap unavailable — crawling ${urlsToCheck.length} pages from local output…`;
    }
  } else if (urlsToCheck.length > 0 && siteOnline) {
    job.progress.stage = `Crawling ${urlsToCheck.length} live pages…`;
  }

  job.progress.total = urlsToCheck.length;

  // Build a local-file lookup map: pageDir → html
  // Always built — local files are the source of truth for content/link analysis since
  // they represent what is about to be (or has been) deployed, independent of live state.
  const localHtmlMap = new Map<string, string>();
  for (const dir of localPageDirs) {
    const htmlPath = path.join(clientDir, dir, "index.html");
    try { localHtmlMap.set(dir, fs.readFileSync(htmlPath, "utf8")); } catch { /* skip */ }
  }

  // 2. Analyse all pages concurrently — always use local HTML for content/link extraction,
  //    then overlay the real live HTTP status when the site is reachable.
  const pageResults: PageHealthResult[] = [];
  const allInternalLinks: Array<{ href: string; fullUrl: string; anchorText: string; sourcePage: string }> = [];
  const allImageSrcs:      Array<{ src: string; sourcePage: string }> = [];

  await batchCheck(urlsToCheck, async (url) => {
    const pageDir    = url.replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");
    const localHtml  = localHtmlMap.get(pageDir);
    // Use local HTML for content analysis when available; fall back to live fetch otherwise
    const offlineHtml = localHtml ?? (siteOnline ? undefined : "");
    const { result, rawInternalLinks, imageSrcs } = await analysePage(
      url, sitemapUrlSet, domain, profile, offlineHtml,
    );
    // When the site is online AND we used local HTML, probe the live URL for its real HTTP status
    if (siteOnline && localHtml !== undefined) {
      try {
        const probe = await fetchWithTimeout(url, { method: "HEAD" }, 8_000);
        const liveStatus = probe.status;
        // Override the HTTP Status check with the real live value
        const httpCheck = result.checks.find((c) => c.name === "HTTP Status");
        if (httpCheck) {
          httpCheck.status = liveStatus === 200 ? "pass" : "fail";
          httpCheck.detail = `HTTP ${liveStatus}`;
        }
        result.httpStatus = liveStatus;
        if (liveStatus !== 200) {
          result.overallStatus = "fail";
        }
      } catch { /* live probe failed — keep analysePage result */ }
    }
    pageResults.push(result);
    for (const link of rawInternalLinks) allInternalLinks.push({ ...link, sourcePage: url });
    for (const src of imageSrcs)         allImageSrcs.push({ src, sourcePage: url });
    job.progress.done++;
  }, 8);

  // 3. Check all unique internal links (skip when offline — all would fail)
  const linkStatusMap  = new Map<string, number | "error">();
  if (siteOnline) {
    job.progress.stage = "Checking internal links…";
    const uniqueLinkUrls = [...new Set(allInternalLinks.map((l) => l.fullUrl))];
    await batchCheck(uniqueLinkUrls, async (url) => {
      const { status } = await headStatus(url);
      linkStatusMap.set(url, status);
    }, 10);
  }

  // 4. Check all unique images (skip when offline)
  // When using local HTML as the source of truth, also check local file existence first —
  // assets that are present in the local output tree are ready for deployment even if not yet live.
  const imageStatusMap  = new Map<string, { status: number | "error"; contentType: string | null }>();
  if (siteOnline) {
    job.progress.stage = "Checking images…";
    const uniqueImageUrls = [...new Set(allImageSrcs.map((i) => i.src))];
    await batchCheck(uniqueImageUrls, async (imgUrl) => {
      // Try local file lookup first: map URL path to output directory path
      try {
        const parsed  = new URL(imgUrl);
        const relPath = parsed.pathname.replace(/^\/+/, "");
        const localAsset = path.join(OUTPUT_DIR, slug, relPath);
        if (fs.existsSync(localAsset)) {
          imageStatusMap.set(imgUrl, { status: 200, contentType: null });
          return;
        }
      } catch { /* malformed URL — fall through to live check */ }
      // Fall back to live HTTP check
      const r = await headStatus(imgUrl);
      imageStatusMap.set(imgUrl, r);
    }, 8);
  }

  // 5. Merge link and image results into per-page records
  const issues: IssueRecord[] = [];

  for (const page of pageResults) {
    const pageLinks  = allInternalLinks.filter((l) => l.sourcePage === page.url);
    const pageImages = allImageSrcs.filter((i) => i.sourcePage === page.url);

    // Broken internal links
    const brokenLinks: PageHealthResult["brokenInternalLinks"] = [];
    for (const link of pageLinks) {
      const status = linkStatusMap.get(link.fullUrl) ?? "error";
      if (status === 404 || status === 500 || status === "error") {
        brokenLinks.push({ href: link.href, anchorText: link.anchorText, status });
        issues.push({
          url:          link.fullUrl,
          sourcePage:   page.url,
          issueType:    "Broken Internal Link",
          severity:     "fail",
          evidence:     `Href: ${link.href} | Anchor: "${link.anchorText}" | Status: ${status}`,
          suggestedFix: `Remove or correct the link to ${link.href}. Verify the target page exists.`,
        });
      }
      if (isPreviewLink(link.href)) {
        issues.push({
          url:          link.fullUrl,
          sourcePage:   page.url,
          issueType:    "Preview URL in Live HTML",
          severity:     "fail",
          evidence:     `Preview link: ${link.href}`,
          suggestedFix: "Remove all /preview/ links before deploying. These should only appear in draft mode.",
        });
      }
    }
    page.brokenInternalLinks = brokenLinks;

    // Broken images
    const brokenImgs: PageHealthResult["brokenImages"] = [];
    for (const img of pageImages) {
      const r = imageStatusMap.get(img.src);
      if (!r || r.status !== 200) {
        brokenImgs.push({ src: img.src, status: r?.status ?? "error" });
        issues.push({
          url:          img.src,
          sourcePage:   page.url,
          issueType:    "Broken Image",
          severity:     "fail",
          evidence:     `Image src: ${img.src} | Status: ${r?.status ?? "error"}`,
          suggestedFix: "Upload the missing image or correct the src path.",
        });
      }
    }
    page.brokenImages = brokenImgs;

    // Update checks for links/images
    const linkCheck = page.checks.find((c) => c.name === "HTTP Status");
    if (linkCheck) { /* already set */ }
    page.checks.push(makeCheck(
      "Internal Links",
      brokenLinks.length === 0 ? "pass" : "fail",
      brokenLinks.length === 0 ? `${pageLinks.length} links OK` : `${brokenLinks.length} broken of ${pageLinks.length}`,
    ));
    page.checks.push(makeCheck(
      "Images",
      brokenImgs.length === 0 ? "pass" : "fail",
      brokenImgs.length === 0 ? `${pageImages.length} images OK` : `${brokenImgs.length} broken of ${pageImages.length}`,
    ));

    // Re-evaluate overallStatus with new checks
    const allStatuses = page.checks.map((c) => c.status);
    page.overallStatus = allStatuses.includes("fail")
      ? "fail" : allStatuses.includes("warning") ? "warning" : "pass";

    // Collect issues from checks
    for (const chk of page.checks) {
      if (chk.status === "fail") {
        if (!["Internal Links", "Images"].includes(chk.name)) {
          issues.push({
            url:          page.url,
            sourcePage:   page.url,
            issueType:    chk.name,
            severity:     "fail",
            evidence:     chk.detail,
            suggestedFix: fixSuggestion(chk.name, chk.detail),
          });
        }
      } else if (chk.status === "warning") {
        issues.push({
          url:          page.url,
          sourcePage:   page.url,
          issueType:    chk.name,
          severity:     "warning",
          evidence:     chk.detail,
          suggestedFix: fixSuggestion(chk.name, chk.detail),
        });
      }
    }
  }

  // 6. Load existing index tracking report (GSC-based)
  const itPath = path.join(OUTPUT_DIR, slug, "index-tracking.json");
  let gscIndexedCount: number | null = null;
  let indexingNote = "";
  if (fs.existsSync(itPath)) {
    try {
      const it = JSON.parse(fs.readFileSync(itPath, "utf8")) as {
        indexedCount?: number; totalChecked?: number; runAt?: string; records?: Array<{ status: string }>;
      };
      if (typeof it.indexedCount === "number") {
        gscIndexedCount = it.indexedCount;
        const runAt = it.runAt ? new Date(it.runAt).toLocaleDateString() : "unknown date";
        indexingNote = `GSC URL Inspection API checked ${it.totalChecked ?? "?"} pages on ${runAt}. ` +
          `GSC shows ${it.indexedCount} indexed. If this differs from Google Search Console's Coverage report, ` +
          `it may be because: (1) the run was partial — not all pages were checked yet, ` +
          `(2) crawl quota was hit — run the full index check to update, or ` +
          `(3) Google Search Console may include pages not in the sitemap. ` +
          `Re-run Index Check to get fresh GSC data.`;
      }
    } catch { /* ignore */ }
  } else {
    indexingNote = "Index Tracking has not been run yet. Run Index Check to get GSC-verified indexing status.";
  }

  // 7. Build summary
  const live200Count    = pageResults.filter((p) => p.httpStatus === 200).length;
  const notFoundCount   = pageResults.filter((p) => p.httpStatus === 404).length;
  const errorCount      = pageResults.filter((p) => p.httpStatus === "error").length;
  const totalBrokenLinks = pageResults.reduce((s, p) => s + p.brokenInternalLinks.length, 0);
  const totalBrokenImgs  = pageResults.reduce((s, p) => s + p.brokenImages.length, 0);
  const previewUrlCount  = pageResults.reduce((s, p) => s + p.previewLinks, 0);
  const noindexCount     = pageResults.filter((p) => p.isNoindex).length;
  const thinContentCount = pageResults.filter((p) => p.wordCount < 300 && p.httpStatus === 200).length;
  const schemaIssueCount = pageResults.filter((p) => !p.schemaValid || p.schemaTypes.length === 0).length;
  const missingTitleCount = pageResults.filter((p) => !p.title).length;
  const missingH1Count    = pageResults.filter((p) => !p.h1).length;
  const placeholderCount  = pageResults.filter((p) => p.placeholderTokens.length > 0).length;
  const passCount   = pageResults.filter((p) => p.overallStatus === "pass").length;
  const warningCount = pageResults.filter((p) => p.overallStatus === "warning").length;
  const failCount    = pageResults.filter((p) => p.overallStatus === "fail").length;

  const canDeploy = notFoundCount === 0 && totalBrokenLinks === 0 && previewUrlCount === 0 &&
    placeholderCount === 0 && failCount === 0;

  // AI Readiness summary stats
  const pagesWithAiScore  = pageResults.filter((p) => p.aiReadiness !== undefined);
  const aiReadinessAvg    = pagesWithAiScore.length > 0
    ? Math.round(pagesWithAiScore.reduce((s, p) => s + (p.aiReadiness?.score ?? 0), 0) / pagesWithAiScore.length)
    : null;
  const aiReadinessBlocked = pagesWithAiScore.filter((p) => p.aiReadiness?.publishBlocked).length;
  const aiReadinessElite   = pagesWithAiScore.filter((p) => p.aiReadiness?.status === "elite").length;
  const aiReadinessGood    = pagesWithAiScore.filter((p) => p.aiReadiness?.status === "good").length;
  const aiReadinessWeak    = pagesWithAiScore.filter((p) => p.aiReadiness?.status === "weak").length;
  const aiReadinessFail    = pagesWithAiScore.filter((p) => p.aiReadiness?.status === "fail").length;

  const report: SystemHealthReport = {
    runAt:       new Date().toISOString(),
    slug,
    domain,
    sitemapUrl,
    sitemapHttpStatus,
    sitemapUrlCount:   sitemapUrls.length,
    siteOffline:       !siteOnline,
    pages:       pageResults,
    issues:      deduplicateIssues(issues),
    summary: {
      totalPages: pageResults.length,
      live200Count,
      notFoundCount,
      errorCount,
      brokenInternalLinks: totalBrokenLinks,
      brokenImages:        totalBrokenImgs,
      previewUrlCount,
      noindexCount,
      thinContentCount,
      schemaIssueCount,
      missingTitleCount,
      missingH1Count,
      placeholderCount,
      indexEstimateCount:  null,
      gscIndexedCount,
      passCount,
      warningCount,
      failCount,
      canDeploy,
      indexingNote,
      aiReadinessAvg,
      aiReadinessBlocked,
      aiReadinessElite,
      aiReadinessGood,
      aiReadinessWeak,
      aiReadinessFail,
    },
  };

  // Cache
  if (fs.existsSync(clientDir)) {
    fs.writeFileSync(cachePath(slug), JSON.stringify(report, null, 2));
  }

  return report;
}

function deduplicateIssues(issues: IssueRecord[]): IssueRecord[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.url}|${i.issueType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fixSuggestion(checkName: string, detail: string): string {
  const map: Record<string, string> = {
    "HTTP Status":         "Check if the page is deployed at the correct URL. Re-run the FTP deploy if needed.",
    "In Sitemap":          "Add this URL to the sitemap.xml and regenerate.",
    "Title Tag":           "Add a unique <title> tag to the page template.",
    "Meta Description":    "Add a compelling <meta name='description'> tag.",
    "H1 Tag":              "Add exactly one <h1> tag with the primary keyword.",
    "Canonical URL":       "Add <link rel='canonical' href='...'/> pointing to this page's URL.",
    "Not Noindex":         "Remove noindex from the robots meta tag to allow Google to index this page.",
    "Word Count":          `Current: ${detail}. Expand the content to at least 500 words.`,
    "Schema Present":      "Add JSON-LD schema markup (LocalBusiness + Service + WebPage recommended).",
    "Schema Valid":        "Fix JSON syntax errors in the application/ld+json script block.",
    "Preview Links":       "Remove all /preview/ href links before deploying.",
    "Placeholder Tokens":  "Replace all template tokens ({{...}}) with real content.",
    "Business Name":       "Ensure the business name appears in the page copy.",
    "Phone Number":        "Ensure the phone number appears on the page.",
    "Address":             "Ensure the business address appears on the page.",
  };
  return map[checkName] ?? "Review the page and correct the issue.";
}

// ── CSV export helper ─────────────────────────────────────────────────────────

function reportToCsv(report: SystemHealthReport): string {
  const rows = [["URL", "HTTP Status", "Title", "H1", "Canonical", "Noindex", "Word Count", "Schema Types", "Broken Links", "Broken Images", "Preview Links", "Placeholders", "Overall Status"]];
  for (const p of report.pages) {
    rows.push([
      p.url,
      String(p.httpStatus),
      p.title ?? "",
      p.h1 ?? "",
      p.canonical ?? "",
      p.isNoindex ? "YES" : "no",
      String(p.wordCount),
      p.schemaTypes.join("; "),
      String(p.brokenInternalLinks.length),
      String(p.brokenImages.length),
      String(p.previewLinks),
      p.placeholderTokens.join("; "),
      p.overallStatus,
    ]);
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET cached report

// ── Platform status summary ────────────────────────────────────────────────
router.get("/platform-status/:slug", (req, res) => {
  const slug = req.params.slug;
  const dir = path.join(OUTPUT_DIR, slug);
  const file = path.join(dir, "platform-status.json");

  function readJson(name: string, fallback: any = {}) {
    try {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {}
    return fallback;
  }

  try {
    if (fs.existsSync(file)) {
      res.json(JSON.parse(fs.readFileSync(file, "utf8")));
      return;
    }

    const registry = readJson("page-registry.json", { pages: [] });
    const health = readJson("registry-health.json", {});
    const orphan = readJson("orphan-check.json", {});

    const livePages = (registry.pages || []).filter((p: any) => p.status === "live").length;

    const status = {
      checkedAt: new Date().toISOString(),
      livePages,
      liveOk: health.liveOk || 0,
      failedPages: health.failedCount || 0,
      sitemapUrls: orphan.sitemapCount || 0,
      registryUrls: orphan.registryCount || livePages,
      missingFromSitemap: (orphan.missingFromSitemap || []).length,
      missingFromRegistry: (orphan.missingFromRegistry || []).length,
      healthy:
        (health.failedCount || 0) === 0 &&
        ((orphan.missingFromSitemap || []).length) === 0 &&
        ((orphan.missingFromRegistry || []).length) === 0,
    };

    res.json(status);
  } catch {
    res.status(500).json({ error: "Failed to read platform status" });
  }
});

router.get("/system-health/:slug", (req, res) => {
  const { slug } = req.params;
  const cache    = cachePath(slug);
  if (!fs.existsSync(cache)) {
    res.json({ cached: false, report: null });
    return;
  }
  try {
    const report: SystemHealthReport = JSON.parse(fs.readFileSync(cache, "utf8"));
    res.json({ cached: true, report });
  } catch {
    res.json({ cached: false, report: null });
  }
});

// POST start audit job
router.post("/system-health/:slug/run", (req, res) => {
  const { slug } = req.params;
  if (!loadProject(slug)) {
    res.status(404).json({ error: `No project: ${slug}` });
    return;
  }
  pruneJobs();
  const jobId = randomUUID();
  const job: Job = {
    status:    "running",
    startedAt: new Date().toISOString(),
    progress:  { done: 0, total: 0, stage: "Starting…" },
  };
  jobs.set(jobId, job);

  // Fire and forget
  runAudit(slug, job).then((report) => {
    job.status = "done";
    job.report = report;
  }).catch((e: unknown) => {
    job.status = "error";
    job.error  = (e as Error).message ?? "Unknown error";
  });

  res.json({ jobId, status: "running" });
});

// GET poll job
router.get("/system-health/:slug/job/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found or expired" }); return; }
  if (job.status === "done") {
    res.json({ status: "done", progress: job.progress, report: job.report });
    return;
  }
  if (job.status === "error") {
    res.json({ status: "error", error: job.error });
    return;
  }
  res.json({ status: "running", progress: job.progress });
});

// ── Auto-fix helpers ─────────────────────────────────────────────────────────

interface DeployConfig {
  enabled: boolean;
  host:     string;
  port:     number;
  user:     string;
  password: string;
}

function getDeployConfig(project: Record<string, unknown>): DeployConfig | null {
  const d = project.deploy as Record<string, unknown> | undefined;
  if (!d || !d.enabled) return null;
  const user = process.env["DEPLOY_USERNAME"] || "";
  const pass = process.env["DEPLOY_PASSWORD"] || "";
  if (!user || !pass) return null;
  return {
    enabled:  true,
    host:     String(d.host ?? ""),
    port:     Number(d.port ?? 21),
    user,
    password: pass,
  };
}

async function ftpUploadFile(cfg: DeployConfig, localPath: string, remotePath: string): Promise<void> {
  const client = new ftp.Client(60_000);
  client.ftp.verbose = false;
  try {
    await client.access({
      host:          cfg.host,
      port:          cfg.port,
      user:          cfg.user,
      password:      cfg.password,
      secure:        true,
      secureOptions: { rejectUnauthorized: false },
    });
    await client.ensureDir(path.posix.dirname(remotePath));
    await client.uploadFrom(localPath, remotePath);
  } finally {
    client.close();
  }
}

function pageSlugFromUrl(pageUrl: string): string {
  return pageUrl.replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");
}

function localHtmlPath(slug: string, pageSlug: string): string {
  return path.join(OUTPUT_DIR, slug, pageSlug, "index.html");
}

function removeCachedIssue(slug: string, issueUrl: string, issueType: string): void {
  const cache = cachePath(slug);
  if (!fs.existsSync(cache)) return;
  try {
    const report: SystemHealthReport = JSON.parse(fs.readFileSync(cache, "utf8"));
    report.issues = report.issues.filter(
      (i) => !(i.url === issueUrl && i.issueType === issueType),
    );
    fs.writeFileSync(cache, JSON.stringify(report, null, 2));
  } catch { /* non-fatal */ }
}

// POST auto-fix a single issue
router.post("/system-health/:slug/fix", async (req, res) => {
  const { slug } = req.params;
  const issue = req.body?.issue as IssueRecord | undefined;
  if (!issue) {
    res.status(400).json({ success: false, message: "Missing issue in request body" });
    return;
  }

  const project = loadProject(slug);
  if (!project) {
    res.status(404).json({ success: false, message: `No project: ${slug}` });
    return;
  }

  const cfg = getDeployConfig(project);
  const issueType  = issue.issueType;
  const sourcePage = issue.sourcePage;
  const pageSlug   = pageSlugFromUrl(sourcePage);

  try {
    // ── Broken Image ────────────────────────────────────────────────────────
    if (issueType === "Broken Image") {
      const imgUrl = issue.url;
      let imgPath = "";
      try { imgPath = new URL(imgUrl).pathname; } catch { imgPath = imgUrl; }

      // Search for the file in workspace root then output dir
      const candidates = [
        path.join(WORKSPACE_ROOT, imgPath.replace(/^\/+/, "")),
        path.join(OUTPUT_DIR, slug, imgPath.replace(/^\/+/, "")),
      ];

      const localFile = candidates.find((c) => fs.existsSync(c));
      if (!localFile) {
        res.json({ success: false, message: "Image not found locally — re-generate the page to produce it, then redeploy." });
        return;
      }

      if (!cfg) {
        res.json({ success: false, message: "Deploy not configured for this project. Enable FTP deploy in project settings." });
        return;
      }

      await ftpUploadFile(cfg, localFile, imgPath);
      removeCachedIssue(slug, issue.url, issueType);
      res.json({ success: true, message: `Image uploaded to ${imgPath}` });
      return;
    }

    // ── Preview URL in Live HTML ─────────────────────────────────────────────
    if (issueType === "Preview URL in Live HTML") {
      const htmlFile = localHtmlPath(slug, pageSlug);
      if (!fs.existsSync(htmlFile)) {
        res.json({ success: false, message: "Local HTML file not found. Re-generate and redeploy the page." });
        return;
      }

      let html = fs.readFileSync(htmlFile, "utf8");
      const before = html;
      // Remove anchor tags whose href contains /preview/
      html = html.replace(/<a\s[^>]*href="[^"]*\/preview\/[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "");
      // Also strip bare href attributes with /preview/
      html = html.replace(/href="[^"]*\/preview\/[^"]*"/gi, 'href="#"');

      if (html === before) {
        res.json({ success: false, message: "No preview links found in local HTML — page may already be fixed. Re-run the audit." });
        return;
      }

      fs.writeFileSync(htmlFile, html, "utf8");

      if (cfg) {
        await ftpUploadFile(cfg, htmlFile, `/${pageSlug}/index.html`);
        removeCachedIssue(slug, issue.url, issueType);
        res.json({ success: true, message: `Preview links removed and page re-uploaded to /${pageSlug}/` });
      } else {
        removeCachedIssue(slug, issue.url, issueType);
        res.json({ success: true, message: "Preview links removed from local file. Enable FTP deploy to push changes live automatically." });
      }
      return;
    }

    // ── Not Noindex ──────────────────────────────────────────────────────────
    if (issueType === "Not Noindex") {
      const htmlFile = localHtmlPath(slug, pageSlug);
      if (!fs.existsSync(htmlFile)) {
        res.json({ success: false, message: "Local HTML file not found. Re-generate and redeploy the page." });
        return;
      }

      let html = fs.readFileSync(htmlFile, "utf8");
      const before = html;
      html = html.replace(/<meta[^>]+name=["']robots["'][^>]*>/gi, (tag) =>
        tag.replace(/noindex\s*,?\s*/gi, "").replace(/,\s*nofollow/gi, ""),
      );
      // If the tag is now empty content, remove it
      html = html.replace(/<meta[^>]+name=["']robots["'][^>]*content=["']\s*["'][^>]*>/gi, "");

      if (html === before) {
        res.json({ success: false, message: "Could not locate noindex directive in local HTML. Re-run the audit." });
        return;
      }

      fs.writeFileSync(htmlFile, html, "utf8");

      if (cfg) {
        await ftpUploadFile(cfg, htmlFile, `/${pageSlug}/index.html`);
        removeCachedIssue(slug, issue.url, issueType);
        res.json({ success: true, message: `Noindex removed and page re-uploaded to /${pageSlug}/` });
      } else {
        removeCachedIssue(slug, issue.url, issueType);
        res.json({ success: true, message: "Noindex directive removed from local file. Enable FTP deploy to push changes live." });
      }
      return;
    }

    // ── Missing Canonical ────────────────────────────────────────────────────
    if (issueType === "Canonical URL") {
      const htmlFile = localHtmlPath(slug, pageSlug);
      if (!fs.existsSync(htmlFile)) {
        res.json({ success: false, message: "Local HTML file not found. Re-generate and redeploy the page." });
        return;
      }

      let html = fs.readFileSync(htmlFile, "utf8");
      if (/<link[^>]+rel=["']canonical["']/i.test(html)) {
        res.json({ success: false, message: "Canonical tag already exists in local HTML. Re-run the audit to verify." });
        return;
      }

      const canonicalUrl = sourcePage.replace(/\/$/, "") + "/";
      const tag = `<link rel="canonical" href="${canonicalUrl}">`;
      html = html.replace(/(<\/head>)/i, `  ${tag}\n$1`);

      if (!html.includes(tag)) {
        res.json({ success: false, message: "Could not inject canonical tag — no </head> found in local HTML." });
        return;
      }

      fs.writeFileSync(htmlFile, html, "utf8");

      if (cfg) {
        await ftpUploadFile(cfg, htmlFile, `/${pageSlug}/index.html`);
        removeCachedIssue(slug, issue.url, issueType);
        res.json({ success: true, message: `Canonical tag injected and page re-uploaded to /${pageSlug}/` });
      } else {
        removeCachedIssue(slug, issue.url, issueType);
        res.json({ success: true, message: "Canonical tag injected into local file. Enable FTP deploy to push changes live." });
      }
      return;
    }

    // ── Broken Internal Link ─────────────────────────────────────────────────
    if (issueType === "Broken Internal Link") {
      // Parse the broken href from evidence: "Href: /contact/ | Anchor: ..."
      const hrefMatch = issue.evidence.match(/Href:\s*(\S+)/);
      const brokenHref = hrefMatch ? hrefMatch[1].replace(/\|.*$/, "").trim() : null;

      if (!brokenHref) {
        res.json({ success: false, message: "Could not parse the broken link path from the audit evidence." });
        return;
      }

      const htmlFile = localHtmlPath(slug, pageSlug);
      if (!fs.existsSync(htmlFile)) {
        res.json({ success: false, message: "Local HTML file not found for this page. Re-generate and redeploy first." });
        return;
      }

      let html = fs.readFileSync(htmlFile, "utf8");
      const before = html;

      // Remove <a> tags whose href exactly matches the broken path (single or double quotes)
      // Replace with inner text only — keeps the visible label, removes the dead link
      const escapedHref = brokenHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const anchorRe = new RegExp(
        `<a(?:\\s[^>]*)? href=["']${escapedHref}["'][^>]*>([\\s\\S]*?)<\\/a>`,
        "gi",
      );
      html = html.replace(anchorRe, "$1");

      if (html === before) {
        res.json({
          success: false,
          message: `Link to "${brokenHref}" not found in the local HTML — it may already be removed. Re-run the audit to confirm.`,
        });
        return;
      }

      fs.writeFileSync(htmlFile, html, "utf8");

      if (cfg) {
        await ftpUploadFile(cfg, htmlFile, `/${pageSlug}/index.html`);
        removeCachedIssue(slug, issue.url, issueType);
        res.json({ success: true, message: `Link to "${brokenHref}" removed and page re-uploaded to /${pageSlug}/` });
      } else {
        removeCachedIssue(slug, issue.url, issueType);
        res.json({ success: true, message: `Link to "${brokenHref}" removed from local file. Enable FTP deploy to push live.` });
      }
      return;
    }

    // ── Not auto-fixable ─────────────────────────────────────────────────────
    const manualGuide: Record<string, string> = {
      "HTTP Status":         "Re-deploy the page using the campaign deploy button.",
      "In Sitemap":          "Regenerate the sitemap from the Sitemap section and re-deploy.",
      "Title Tag":           "Re-generate the page to rebuild the title tag with AI content.",
      "Meta Description":    "Re-generate the page to rebuild the meta description.",
      "H1 Tag":              "Re-generate the page to rebuild the H1 tag.",
      "Word Count":          "Re-generate the page — the AI content will expand the body copy.",
      "Schema Present":      "Re-generate the page to add JSON-LD schema markup.",
      "Schema Valid":        "Re-generate the page to fix schema JSON syntax.",
      "Placeholder Tokens":  "Re-generate the page — the AI will replace all tokens with real content.",
      "Business Name":       "Re-generate the page to include the business name in the copy.",
      "Phone Number":        "Re-generate the page to include the phone number in the copy.",
      "Address":             "Re-generate the page to include the address in the copy.",
      "Internal Links":      "Review internal link targets and fix broken hrefs in the page source.",
    };

    const guide = manualGuide[issueType] || issue.suggestedFix || "Review and fix manually, then re-deploy.";
    res.json({ success: false, autoFixUnavailable: true, message: guide });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: `Fix failed: ${msg}` });
  }
});

// GET export
router.get("/system-health/:slug/export", (req, res) => {
  const { slug }   = req.params;
  const format     = String(req.query.format ?? "json");
  const cache      = cachePath(slug);
  if (!fs.existsSync(cache)) {
    res.status(404).json({ error: "No report cached. Run an audit first." });
    return;
  }
  const report: SystemHealthReport = JSON.parse(fs.readFileSync(cache, "utf8"));
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="system-health-${slug}.csv"`);
    res.send(reportToCsv(report));
  } else {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="system-health-${slug}.json"`);
    res.send(JSON.stringify(report, null, 2));
  }
});

export default router;
