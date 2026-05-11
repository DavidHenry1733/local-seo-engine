/**
 * liveCrawl.ts
 *
 * GET  /api/live-crawl/:slug        — return cached crawl results
 * POST /api/live-crawl/:slug        — run a full live URL crawl
 * POST /api/live-crawl/:slug/fix-deploy — FTP-upload patched hub HTML files
 *
 * The crawl:
 *   1. Fetches the live sitemap and checks HTTP status of every URL
 *   2. For each hub page in the sitemap, fetches live HTML and extracts
 *      all internal links, then checks their HTTP status
 *   3. Returns a structured report of broken links and 404s
 */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import * as ftp from "basic-ftp";

const __filename     = fileURLToPath(import.meta.url);
const __dirname      = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");
const PROJECTS_DIR   = path.join(WORKSPACE_ROOT, "config", "projects");

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface UrlCheckResult {
  url:    string;
  status: number | "error";
  error?: string;
}

interface LinkIssue {
  href:      string;
  fullUrl:   string;
  anchorText: string;
  status:    number | "error";
}

interface PageLinkCheck {
  sourcePage: string;
  sourceSlug: string;
  pageRole:   "hub" | "cluster" | "unknown";
  totalInternalLinks: number;
  brokenLinks: LinkIssue[];
  brokenCount: number;
}

interface CrawlReport {
  crawledAt:   string;
  domain:      string;
  sitemapUrl:  string;
  sitemap: {
    status:        number | "error";
    totalUrls:     number;
    okCount:       number;
    notFoundCount: number;
    errorCount:    number;
    urlResults:    UrlCheckResult[];
  };
  linkChecks: PageLinkCheck[];
  /** Broken hrefs that appear on SYSTEMIC_THRESHOLD or more pages (template/nav issues). */
  systemicBrokenHrefs: string[];
  summary: {
    totalSitemapUrls:        number;
    sitemapOk:               number;
    sitemapBroken:           number;
    totalLinksChecked:       number;
    totalBrokenLinks:        number;
    hubsWithBrokenLinks:     number;
    /** Broken links unique to specific pages (not systemic nav issues). */
    pageSpecificBrokenLinks: number;
    pageSpecificPagesAffected: number;
    systemicIssueCount:      number;
    canDeploy:               boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadProject(slug: string): Record<string, unknown> | null {
  const p = path.join(PROJECTS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return null; }
}

function cachePath(slug: string): string {
  return path.join(OUTPUT_DIR, slug, "live-crawl.json");
}

/** Fetch URL, return status code (or "error"). Follows redirects. */
async function checkUrl(url: string): Promise<UrlCheckResult> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return { url, status: res.status };
  } catch (e: unknown) {
    return { url, status: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Parse all <loc> URLs from a sitemap XML string. */
function parseSitemapUrls(xml: string): string[] {
  const matches = xml.match(/<loc>([^<]+)<\/loc>/g) ?? [];
  return matches
    .map((m) => m.replace(/<\/?loc>/g, "").trim())
    .filter(Boolean);
}

/** Extract all internal href values from an HTML page. */
function extractInternalLinks(
  html: string,
  domain: string
): Array<{ href: string; anchorText: string }> {
  const results: Array<{ href: string; anchorText: string }> = [];
  // Match <a href="...">...</a> patterns
  const anchorRe = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1].trim();
    // Strip HTML tags from anchor text
    const anchorText = m[2].replace(/<[^>]+>/g, "").trim().slice(0, 120);
    // Only include internal links (relative paths or same domain)
    if (href.startsWith("/") || href.startsWith(domain)) {
      // Skip anchors, javascript, mailto, tel
      if (href.startsWith("#") || href.startsWith("javascript:") ||
          href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      results.push({ href, anchorText });
    }
  }
  return results;
}

/** Resolve a relative or absolute href to a full URL. */
function resolveHref(href: string, domain: string): string {
  if (href.startsWith("http")) return href;
  return `${domain.replace(/\/+$/, "")}${href}`;
}

/**
 * Determine if a URL path looks like a generated hub/cluster page by checking
 * whether an index.html exists for it in the project output directory.
 * Falls back to a generic service-area pattern if the output dir is absent.
 */
function isHubSlug(slug: string, outputSlugDir?: string): boolean {
  if (outputSlugDir) {
    return fs.existsSync(path.join(outputSlugDir, slug, "index.html"));
  }
  // Fallback: any path with at least one hyphen (service-area pattern)
  return /^[a-z0-9]+-[a-z0-9]/.test(slug);
}

/** Concurrently check a list of URLs with a concurrency cap. */
async function checkUrlsBatch(urls: string[], concurrency = 10): Promise<UrlCheckResult[]> {
  const results: UrlCheckResult[] = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(checkUrl));
    results.push(...batchResults);
  }
  return results;
}

// ── GET /api/live-crawl/:slug (cached results) ────────────────────────────────

router.get("/live-crawl/:slug", (req, res) => {
  const { slug } = req.params;
  const cache    = cachePath(slug);
  if (!fs.existsSync(cache)) {
    res.json({ cached: false, report: null });
    return;
  }
  try {
    const report: CrawlReport = JSON.parse(fs.readFileSync(cache, "utf8"));
    res.json({ cached: true, report });
  } catch {
    res.json({ cached: false, report: null });
  }
});

// ── POST /api/live-crawl/:slug (run crawl) ────────────────────────────────────

router.post("/live-crawl/:slug", async (req, res) => {
  const { slug } = req.params;
  const project  = loadProject(slug);
  if (!project) {
    res.status(404).json({ error: `No project found: ${slug}` });
    return;
  }

  const domain     = (project.domain as string | undefined)?.replace(/\/+$/, "") ?? "";
  const sitemapUrl = `${domain}/sitemap.xml`;

  // 1. Fetch sitemap
  let sitemapXml  = "";
  let sitemapStatus: number | "error" = "error";
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const sres  = await fetch(sitemapUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    sitemapStatus = sres.status;
    if (sres.ok) sitemapXml = await sres.text();
  } catch (e: unknown) {
    sitemapStatus = "error";
  }

  const sitemapUrls = parseSitemapUrls(sitemapXml);

  // 2. Check HTTP status of every sitemap URL
  const urlResults = await checkUrlsBatch(sitemapUrls, 10);

  const okCount       = urlResults.filter((r) => r.status === 200).length;
  const notFoundCount = urlResults.filter((r) => r.status === 404).length;
  const errorCount    = urlResults.filter((r) => r.status === "error").length;

  // 3. For hub pages in the sitemap, fetch live HTML and check internal links
  const clientOutputDir = path.join(OUTPUT_DIR, slug);
  const hubUrls = sitemapUrls.filter((u) => {
    const pageSlug = u.replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");
    return isHubSlug(pageSlug, fs.existsSync(clientOutputDir) ? clientOutputDir : undefined);
  });

  const linkChecks: PageLinkCheck[] = [];

  for (const hubUrl of hubUrls) {
    const hubSlug = hubUrl.replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15_000);
      const hres  = await fetch(hubUrl, { signal: ctrl.signal });
      clearTimeout(timer);

      if (!hres.ok) {
        linkChecks.push({
          sourcePage: hubUrl,
          sourceSlug: hubSlug,
          pageRole:   "hub",
          totalInternalLinks: 0,
          brokenLinks: [],
          brokenCount: 0,
        });
        continue;
      }

      const html      = await hres.text();
      const rawLinks  = extractInternalLinks(html, domain);
      // Deduplicate by href
      const seen      = new Set<string>();
      const links     = rawLinks.filter((l) => {
        if (seen.has(l.href)) return false;
        seen.add(l.href);
        return true;
      });

      // Check each link
      const fullLinks = links.map((l) => ({
        ...l,
        fullUrl: resolveHref(l.href, domain),
      }));

      const linkStatuses = await checkUrlsBatch(fullLinks.map((l) => l.fullUrl), 8);
      const statusMap    = new Map(linkStatuses.map((r) => [r.url, r.status]));

      const brokenLinks: LinkIssue[] = fullLinks
        .map((l) => ({
          href:       l.href,
          fullUrl:    l.fullUrl,
          anchorText: l.anchorText,
          status:     statusMap.get(l.fullUrl) ?? "error",
        }))
        .filter((l) => l.status === 404 || l.status === "error");

      linkChecks.push({
        sourcePage:         hubUrl,
        sourceSlug:         hubSlug,
        pageRole:           "hub",
        totalInternalLinks: links.length,
        brokenLinks,
        brokenCount:        brokenLinks.length,
      });
    } catch {
      linkChecks.push({
        sourcePage: hubUrl,
        sourceSlug: hubSlug,
        pageRole:   "hub",
        totalInternalLinks: 0,
        brokenLinks: [],
        brokenCount: 0,
      });
    }
  }

  const totalBrokenLinks      = linkChecks.reduce((s, c) => s + c.brokenCount, 0);
  const hubsWithBrokenLinks   = linkChecks.filter((c) => c.brokenCount > 0).length;
  const totalInternalChecked  = linkChecks.reduce((s, c) => s + c.totalInternalLinks, 0);

  // ── Systemic vs page-specific broken link analysis ──────────────────────────
  // A broken href appearing on 3+ pages is a template/nav issue, not page-specific.
  const SYSTEMIC_THRESHOLD = 3;
  const hrefFrequency = new Map<string, number>();
  for (const check of linkChecks) {
    for (const link of check.brokenLinks) {
      hrefFrequency.set(link.href, (hrefFrequency.get(link.href) ?? 0) + 1);
    }
  }
  const systemicBrokenHrefs = [...hrefFrequency.entries()]
    .filter(([, count]) => count >= SYSTEMIC_THRESHOLD)
    .map(([href]) => href);
  const systemicSet = new Set(systemicBrokenHrefs);

  // Page-specific: broken links that are NOT systemic
  const pageSpecificChecks = linkChecks
    .map((c) => ({
      ...c,
      brokenLinks: c.brokenLinks.filter((l) => !systemicSet.has(l.href)),
    }))
    .filter((c) => c.brokenLinks.length > 0);

  const pageSpecificBrokenLinks    = pageSpecificChecks.reduce((s, c) => s + c.brokenLinks.length, 0);
  const pageSpecificPagesAffected  = pageSpecificChecks.length;

  const report: CrawlReport = {
    crawledAt:  new Date().toISOString(),
    domain,
    sitemapUrl,
    sitemap: {
      status:    sitemapStatus,
      totalUrls: sitemapUrls.length,
      okCount,
      notFoundCount,
      errorCount,
      urlResults,
    },
    linkChecks,
    systemicBrokenHrefs,
    summary: {
      totalSitemapUrls:          sitemapUrls.length,
      sitemapOk:                 okCount,
      sitemapBroken:             notFoundCount + errorCount,
      totalLinksChecked:         totalInternalChecked,
      totalBrokenLinks,
      hubsWithBrokenLinks,
      pageSpecificBrokenLinks,
      pageSpecificPagesAffected,
      systemicIssueCount:        systemicBrokenHrefs.length,
      canDeploy:                 notFoundCount === 0 && pageSpecificBrokenLinks === 0,
    },
  };

  // Cache to disk
  const clientDir = path.join(OUTPUT_DIR, slug);
  if (fs.existsSync(clientDir)) {
    fs.writeFileSync(cachePath(slug), JSON.stringify(report, null, 2));
  }

  res.json({ cached: false, report });
});

// ── Helpers for fix-deploy ────────────────────────────────────────────────────

/**
 * Strip broken anchor tags from HTML.
 * Replaces <a href="HREF">inner</a> with just inner text for every broken href.
 * Returns { html, patchCount }.
 */
function patchBrokenLinks(html: string, brokenHrefs: string[]): { html: string; patchCount: number } {
  let patchCount = 0;
  let patched = html;
  for (const href of brokenHrefs) {
    // Escape special regex chars in the href
    const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match opening tag with this href (attribute order-agnostic, handles extra attrs)
    const re = new RegExp(
      `<a(?=[^>]*\\shref="${escaped}"(?=[\\s>]))[^>]*>([\\s\\S]*?)<\\/a>`,
      "gi"
    );
    const before = patched;
    patched = patched.replace(re, "$1");
    if (patched !== before) patchCount += (before.match(re) ?? []).length || 1;
  }
  return { html: patched, patchCount };
}

// ── POST /api/live-crawl/:slug/fix-deploy ────────────────────────────────────
// Auto-patches broken links from the crawl report out of local HTML files,
// then FTP-uploads the patched pages to the live server.

router.post("/live-crawl/:slug/fix-deploy", async (req, res) => {
  const { slug }  = req.params;
  const project   = loadProject(slug);
  if (!project) {
    res.status(404).json({ error: `No project found: ${slug}` });
    return;
  }

  const deploy = project.deploy as Record<string, unknown> | undefined;
  if (!deploy?.enabled) {
    res.status(400).json({ error: "FTP deploy is not enabled for this project." });
    return;
  }

  const host       = deploy.host as string;
  const port       = (deploy.port as number | undefined) ?? 21;
  const remoteRoot = (deploy.remoteRoot as string | undefined) ?? "/";
  const ftpUser    = (deploy.username as string | undefined) || process.env.DEPLOY_USERNAME;
  const ftpPass    = (deploy.password as string | undefined) || process.env.DEPLOY_PASSWORD;

  if (!ftpUser || !ftpPass) {
    res.status(400).json({ error: "FTP credentials not configured." });
    return;
  }

  const clientDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(clientDir)) {
    res.status(400).json({ error: "No output directory found for this project." });
    return;
  }

  // Build a map of pageSlug → brokenHrefs from the cached crawl report
  const brokenBySlug = new Map<string, string[]>();
  const cache = cachePath(slug);
  if (fs.existsSync(cache)) {
    try {
      const report: CrawlReport = JSON.parse(fs.readFileSync(cache, "utf8"));
      for (const check of report.linkChecks) {
        if (check.brokenCount > 0) {
          brokenBySlug.set(check.sourceSlug, check.brokenLinks.map((l) => l.href));
        }
      }
    } catch { /* proceed without patch map */ }
  }

  // Pages to deploy: broken-link pages that have a local file, or all local pages
  let pageSlugs: string[] = [...brokenBySlug.keys()]
    .filter((s) => fs.existsSync(path.join(clientDir, s, "index.html")));

  if (pageSlugs.length === 0) {
    pageSlugs = fs.readdirSync(clientDir)
      .filter((d) => fs.existsSync(path.join(clientDir, d, "index.html")));
  }

  if (pageSlugs.length === 0) {
    res.status(400).json({ error: "No local page files found in the output directory." });
    return;
  }

  const client      = new ftp.Client(60_000);
  const uploaded:   string[] = [];
  const errors:     string[] = [];
  let   totalPatches = 0;

  try {
    await client.access({ host, port, user: ftpUser, password: ftpPass, secure: false });

    for (const pageSlug of pageSlugs) {
      const localFile  = path.join(clientDir, pageSlug, "index.html");
      const remoteDest = [remoteRoot, pageSlug, "index.html"].join("/").replace(/\/+/g, "/");
      try {
        // Read local HTML and patch out any broken anchor tags
        let html = fs.readFileSync(localFile, "utf8");
        const brokenHrefs = brokenBySlug.get(pageSlug) ?? [];
        if (brokenHrefs.length > 0) {
          const { html: patched, patchCount } = patchBrokenLinks(html, brokenHrefs);
          html = patched;
          totalPatches += patchCount;
        }

        // Upload patched content from an in-memory buffer
        const buf = Buffer.from(html, "utf8");
        const readable = Readable.from(buf);
        await client.uploadFrom(readable, remoteDest);
        uploaded.push(pageSlug);
      } catch (e: unknown) {
        errors.push(`${pageSlug}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e: unknown) {
    res.status(500).json({
      error: `FTP connection failed: ${e instanceof Error ? e.message : String(e)}`,
    });
    return;
  } finally {
    client.close();
  }

  res.json({
    uploaded,
    errors,
    patchesApplied: totalPatches,
    success: errors.length === 0,
    message: errors.length === 0
      ? `Deployed ${uploaded.length} pages (${totalPatches} broken link${totalPatches !== 1 ? "s" : ""} patched).`
      : `Deployed ${uploaded.length}, failed ${errors.length}. ${totalPatches} patches applied.`,
  });
});

export default router;
