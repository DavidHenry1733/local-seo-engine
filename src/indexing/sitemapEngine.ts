/**
 * Indexing & Sitemap Engine
 *
 * Generates sitemap.xml and robots.txt for a set of local SEO pages,
 * then returns an indexing report ready for Search Console submission.
 *
 * IMPORTANT — Google Indexing API:
 *   Do NOT use the Google Indexing API for these pages.
 *   That API is reserved exclusively for JobPosting and BroadcastEvent
 *   (livestream) structured-data pages. For standard service/location
 *   pages, submit sitemap.xml via Google Search Console > Sitemaps.
 */

import fs   from "node:fs";
import path from "node:path";
import {
  type IndexingEngineInput,
  type IndexingEngineOutput,
  type SitemapEntry,
  type ExcludedPage,
  PAGE_PRIORITY,
} from "./indexingTypes";

// ─── URL helpers ──────────────────────────────────────────────────────────────

function toAbsolute(url: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(url)) return url;
  return `${base}/${url.replace(/^\/+/, "")}`;
}

function normalise(url: string): string {
  try {
    const u = new URL(url);
    // force trailing slash for path-only URLs, lowercase host
    if (!u.pathname.endsWith("/") && !u.pathname.includes(".")) {
      u.pathname += "/";
    }
    return u.href;
  } catch {
    return url;
  }
}

function isExternalUrl(url: string, baseUrl: string): boolean {
  try {
    const pageHost = new URL(url).hostname.toLowerCase();
    const baseHost = new URL(baseUrl).hostname.toLowerCase();
    return pageHost !== baseHost;
  } catch {
    return false;
  }
}

// ─── ISO date helper ──────────────────────────────────────────────────────────

function isoDate(value?: string): string {
  if (value) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

// ─── Sitemap XML builder ──────────────────────────────────────────────────────

function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(e =>
      [
        "  <url>",
        `    <loc>${escapeXml(e.loc)}</loc>`,
        `    <lastmod>${e.lastmod}</lastmod>`,
        `    <changefreq>${e.changefreq}</changefreq>`,
        `    <priority>${e.priority.toFixed(1)}</priority>`,
        "  </url>",
      ].join("\n")
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── robots.txt builder ───────────────────────────────────────────────────────

function buildRobotsTxt(sitemapUrl: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${sitemapUrl}`,
    "",
  ].join("\n");
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface SitemapValidationResult {
  passed:   boolean;
  failures: string[];
}

export function validateSitemap(
  sitemapXml:   string,
  baseUrl:      string,
  allPageUrls:  string[],
): SitemapValidationResult {
  const failures: string[] = [];
  const baseHost = new URL(baseUrl).hostname.toLowerCase();

  // Extract <loc> values
  const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());

  // No duplicates
  const seen = new Set<string>();
  for (const loc of locs) {
    if (seen.has(loc)) failures.push(`Duplicate URL in sitemap: ${loc}`);
    seen.add(loc);
  }

  // All locs must belong to baseUrl host
  for (const loc of locs) {
    try {
      const host = new URL(loc).hostname.toLowerCase();
      if (host !== baseHost) {
        failures.push(`Sitemap contains URL from wrong host: ${loc} (expected ${baseHost})`);
      }
    } catch {
      failures.push(`Sitemap contains invalid URL: ${loc}`);
    }
  }

  // No review/blocked pages should be present (cross-check against known page set)
  const locSet = new Set(locs);
  for (const loc of locSet) {
    if (!allPageUrls.includes(loc)) {
      failures.push(`Sitemap URL not in generated page set: ${loc}`);
    }
  }

  return { passed: failures.length === 0, failures };
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function runIndexingEngine(input: IndexingEngineInput): IndexingEngineOutput {
  const { projectSlug, baseUrl, pages } = input;
  // Always use https:// — upgrade or add protocol if missing
  let cleanBase = baseUrl.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(cleanBase)) {
    cleanBase = `https://${cleanBase}`;
  } else {
    cleanBase = cleanBase.replace(/^http:\/\//i, "https://");
  }

  const excluded:     ExcludedPage[] = [];
  const entries:      SitemapEntry[] = [];
  const seenUrls      = new Set<string>();

  let hubCount        = 0;
  let clusterCount    = 0;
  let supportingCount = 0;

  for (const page of pages) {
    const absoluteUrl = normalise(toAbsolute(page.url, cleanBase));

    // — reject review/blocked
    if (page.readiness !== "ready") {
      excluded.push({ url: absoluteUrl, reason: `readiness=${page.readiness}` });
      continue;
    }

    // — reject external URLs (wrong host)
    if (isExternalUrl(absoluteUrl, cleanBase)) {
      excluded.push({
        url:    absoluteUrl,
        reason: `URL host does not match baseUrl host (${new URL(cleanBase).hostname})`,
      });
      continue;
    }

    // — reject duplicates
    if (seenUrls.has(absoluteUrl)) {
      excluded.push({ url: absoluteUrl, reason: "duplicate URL" });
      continue;
    }

    seenUrls.add(absoluteUrl);

    const entry: SitemapEntry = {
      loc:        absoluteUrl,
      lastmod:    isoDate(page.lastmod),
      changefreq: "weekly",
      priority:   PAGE_PRIORITY[page.pageType],
    };

    entries.push(entry);

    if (page.pageType === "hub")        hubCount++;
    else if (page.pageType === "cluster") clusterCount++;
    else                                  supportingCount++;
  }

  // Sort: hubs first, then clusters, then supporting; alpha within each group
  entries.sort((a, b) => {
    const order = { 0.9: 0, 0.8: 1, 0.6: 2 } as Record<number, number>;
    const po = order[a.priority] - order[b.priority];
    return po !== 0 ? po : a.loc.localeCompare(b.loc);
  });

  const sitemapXml  = buildSitemapXml(entries);
  const sitemapUrl  = `${cleanBase}/sitemap.xml`;
  const robotsTxt   = buildRobotsTxt(sitemapUrl);
  const robotsUrl   = `${cleanBase}/robots.txt`;

  // ── Write output files ───────────────────────────────────────────────────
  const outDir = path.join("output", projectSlug);
  fs.mkdirSync(outDir, { recursive: true });

  const sitemapPath = path.join(outDir, "sitemap.xml");
  const robotsPath  = path.join(outDir, "robots.txt");
  fs.writeFileSync(sitemapPath, sitemapXml, "utf8");
  fs.writeFileSync(robotsPath,  robotsTxt,  "utf8");

  // ── Report ───────────────────────────────────────────────────────────────
  const report = {
    sitemapUrl,
    robotsUrl,
    totalInputUrls:  pages.length,
    includedUrls:    entries.length,
    excludedUrls:    excluded,
    hubCount,
    clusterCount,
    supportingCount,
    generatedAt:     new Date().toISOString(),
  };

  return { sitemapXml, robotsTxt, report };
}

// ─── FTP deploy helper ────────────────────────────────────────────────────────

export interface FtpDeployConfig {
  host:       string;
  port?:      number;
  user:       string;
  password:   string;
  remoteRoot: string;
}

export async function deployIndexingFiles(
  projectSlug: string,
  ftpConfig:   FtpDeployConfig,
): Promise<{ sitemapDeployed: boolean; robotsDeployed: boolean }> {
  const ftp = await import(
    "/home/runner/workspace/node_modules/.pnpm/basic-ftp@5.3.0/node_modules/basic-ftp/dist/index.js"
  ) as { Client: new (timeout: number) => any };

  const files = [
    { local: path.join("output", projectSlug, "sitemap.xml"), remote: "sitemap.xml" },
    { local: path.join("output", projectSlug, "robots.txt"),  remote: "robots.txt"  },
  ];

  const results = { sitemapDeployed: false, robotsDeployed: false };

  for (const f of files) {
    if (!fs.existsSync(f.local)) {
      console.warn(`[indexing] Skip deploy — file not found: ${f.local}`);
      continue;
    }
    const remoteDest = [ftpConfig.remoteRoot, f.remote].join("/").replace(/\/+/g, "/");
    const client = new ftp.Client(30000);
    try {
      await client.access({
        host:     ftpConfig.host,
        port:     ftpConfig.port ?? 21,
        user:     ftpConfig.user,
        password: ftpConfig.password,
      });
      await client.uploadFrom(f.local, remoteDest);
      if (f.remote === "sitemap.xml") results.sitemapDeployed = true;
      if (f.remote === "robots.txt")  results.robotsDeployed  = true;
    } finally {
      client.close();
    }
  }

  return results;
}
