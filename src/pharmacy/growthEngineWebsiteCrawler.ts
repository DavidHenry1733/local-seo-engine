/**
 * Growth Engine — Website Intelligence crawl & discovery.
 * Sitemap XML is a discovery source only — never counted as analysed business content.
 */
import type { WebsitePageInventoryItem } from "./growthEngineWebsiteIntelligenceModel.ts";
import { classifyWebsitePage } from "./growthEngineWebsiteClassifier.ts";

const MAX_CONTENT_PAGES = 28;
const MAX_SITEMAP_SEED_URLS = 80;
const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_BYTES = 1_500_000;

const HIGH_VALUE_PATH_RE =
  /\/(about|contact|faq|faqs|frequently-asked|services?|pricing|price|locations?|branches?|team|company|trust|testimonial|review|pharmacy-|local-seo|email-|hosting|growth-|audit|website-design|who-we-are|our-story)/i;

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function isXmlOrSitemapUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const p = u.pathname.toLowerCase();
    return (
      p.endsWith(".xml") ||
      p.includes("sitemap") ||
      p.endsWith(".xsd") ||
      p.endsWith(".xsl")
    );
  } catch {
    return /sitemap|\.xml$/i.test(url);
  }
}

function looksLikeHtmlDocument(html: string): boolean {
  const sample = html.slice(0, 2000).toLowerCase();
  if (!sample) return false;
  if (/<\s*(urlset|sitemapindex)\b/.test(sample)) return false;
  if (/<\s*html\b/.test(sample) || /<\s*body\b/.test(sample) || /<\s*head\b/.test(sample)) return true;
  if (/<!doctype html/.test(sample)) return true;
  // Reject pure XML/JSON
  if (/^\s*<\?xml/.test(sample) && !/<\s*html\b/.test(sample)) return false;
  return /<title\b|<meta\b|<h1\b|<nav\b|<footer\b/.test(sample);
}

function normalizeUrl(raw: string, base: URL): string | null {
  try {
    const u = raw.startsWith("http") ? new URL(raw) : new URL(raw, base.origin);
    if (u.hostname !== base.hostname && u.hostname !== `www.${base.hostname}` && base.hostname !== `www.${u.hostname}`) {
      return null;
    }
    // Collapse www/non-www onto the submitted base host
    u.hostname = base.hostname;
    u.hash = "";
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.href;
  } catch {
    return null;
  }
}

export async function fetchWebsiteHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PharmaConnect-Website-Intelligence/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return "";
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) return new TextDecoder().decode(buf.slice(0, MAX_HTML_BYTES));
    return new TextDecoder().decode(buf);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function extractTitle(html: string): string {
  return (
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ||
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    ""
  );
}

function extractH1(html: string): string {
  return html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "";
}

export function extractInternalLinks(html: string, base: URL): string[] {
  const links = new Set<string>();
  const re = /href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1].trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    const normalized = normalizeUrl(href, base);
    if (normalized && !isXmlOrSitemapUrl(normalized)) links.add(normalized);
  }
  return [...links];
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PharmaConnect-Website-Intelligence/1.0",
        Accept: "application/xml,text/xml,text/html,*/*",
      },
      redirect: "follow",
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/** Parse sitemap / sitemap-index XML into same-host candidate page URLs (never returns the sitemap itself). */
export async function discoverSitemapUrls(base: URL): Promise<string[]> {
  const candidates = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml", "/wp-sitemap.xml"];
  const pageUrls = new Set<string>();
  const sitemapQueue: string[] = [];
  const seenSitemaps = new Set<string>();

  for (const path of candidates) {
    sitemapQueue.push(new URL(path, base.origin).href);
  }

  while (sitemapQueue.length && pageUrls.size < MAX_SITEMAP_SEED_URLS) {
    const sitemapUrl = sitemapQueue.shift()!;
    if (seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);

    const xml = await fetchText(sitemapUrl);
    if (!xml || !/<urlset|<sitemapindex/i.test(xml)) continue;

    const locs = xml.match(/<loc>([^<]+)<\/loc>/gi) || [];
    for (const loc of locs) {
      const inner = loc.replace(/<\/?loc>/gi, "").trim();
      const normalized = normalizeUrl(inner, base);
      if (!normalized) continue;
      if (isXmlOrSitemapUrl(normalized) || /<sitemapindex/i.test(xml)) {
        // Nested sitemap index entries
        if (isXmlOrSitemapUrl(normalized) && !seenSitemaps.has(normalized)) {
          sitemapQueue.push(normalized);
        }
        continue;
      }
      pageUrls.add(normalized);
      if (pageUrls.size >= MAX_SITEMAP_SEED_URLS) break;
    }
  }

  return [...pageUrls];
}

export async function checkRobotsExists(base: URL): Promise<boolean> {
  const robots = await fetchText(new URL("/robots.txt", base.origin).href);
  return Boolean(robots && /user-agent|disallow|allow|sitemap/i.test(robots));
}

function pagePriority(url: string): number {
  try {
    const path = new URL(url).pathname || "/";
    if (path === "/" || path === "") return 100;
    if (/\/about|\/contact|\/faq|\/frequently-asked/i.test(path)) return 90;
    if (HIGH_VALUE_PATH_RE.test(path)) return 80;
    if (/\/services?\//i.test(path)) return 70;
    if (/\/blog\//i.test(path)) return 40;
    return 50;
  } catch {
    return 0;
  }
}

export interface CrawlWebsiteResult {
  pages: WebsitePageInventoryItem[];
  /** Same-host HTML candidate URLs discovered from sitemaps (not analysed by themselves). */
  sitemapUrls: string[];
  robotsDetected: boolean;
  homepageHtml: string;
  pageHtmlByUrl: Record<string, string>;
  /** URLs skipped because they were sitemap/XML or non-HTML. */
  skippedNonContentUrls: string[];
}

export async function crawlWebsite(websiteUrl: string, extraSeedUrls: string[] = []): Promise<CrawlWebsiteResult> {
  const base = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
  const homepageUrl = base.origin + (base.pathname === "/" ? "" : base.pathname) || base.origin;

  const [homepageHtml, sitemapPageUrls, robotsDetected] = await Promise.all([
    fetchWebsiteHtml(homepageUrl),
    discoverSitemapUrls(base),
    checkRobotsExists(base),
  ]);

  const seedScores = new Map<string, { score: number; source: string }>();
  const addSeed = (url: string, source: string, bonus = 0) => {
    if (!url || isXmlOrSitemapUrl(url)) return;
    const n = normalizeUrl(url, base);
    if (!n) return;
    const score = pagePriority(n) + bonus;
    const prev = seedScores.get(n);
    if (!prev || score > prev.score) seedScores.set(n, { score, source });
  };

  addSeed(homepageUrl, "homepage", 20);
  for (const u of sitemapPageUrls) addSeed(u, "sitemap");
  for (const u of extraSeedUrls) addSeed(u, "seed", 10);
  for (const u of extractInternalLinks(homepageHtml, base)) addSeed(u, "homepage-nav");

  const orderedSeeds = [...seedScores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .map(([url, meta]) => ({ url, ...meta }));

  const pages: WebsitePageInventoryItem[] = [];
  const seen = new Set<string>();
  const pageHtmlByUrl: Record<string, string> = {};
  const skippedNonContentUrls: string[] = [];

  for (const seed of orderedSeeds) {
    if (pages.length >= MAX_CONTENT_PAGES) break;
    const url = seed.url;
    if (seen.has(url)) continue;
    seen.add(url);

    if (isXmlOrSitemapUrl(url)) {
      skippedNonContentUrls.push(url);
      continue;
    }

    const html = url === homepageUrl && homepageHtml ? homepageHtml : await fetchWebsiteHtml(url);
    if (!html) {
      skippedNonContentUrls.push(url);
      continue;
    }
    if (!looksLikeHtmlDocument(html)) {
      skippedNonContentUrls.push(url);
      continue;
    }

    pageHtmlByUrl[url] = html;

    // Expand crawl with high-value links from analysed HTML pages
    for (const link of extractInternalLinks(html, base).slice(0, 25)) {
      addSeed(link, `link:${seed.source}`);
    }

    const path = new URL(url).pathname || "/";
    const title = extractTitle(html);
    const h1 = extractH1(html);
    const category = classifyWebsitePage(path, title, html);
    // Clinical service IDs are applied later only when business classification enables them.
    const detectedServiceIds: string[] = [];

    pages.push({
      url,
      path,
      title,
      category,
      detectedServiceIds,
      discoverySource: seed.source,
      fetchStatus: "ok",
      h1,
      isContentPage: true,
      evidenceCategories: [category],
    });
  }

  // Re-sort discovered seeds that arrived mid-crawl and fill remaining budget
  const remaining = [...seedScores.entries()]
    .filter(([url]) => !seen.has(url))
    .sort((a, b) => b[1].score - a[1].score);

  for (const [url, meta] of remaining) {
    if (pages.length >= MAX_CONTENT_PAGES) break;
    if (seen.has(url) || isXmlOrSitemapUrl(url)) continue;
    seen.add(url);
    const html = await fetchWebsiteHtml(url);
    if (!html || !looksLikeHtmlDocument(html)) {
      skippedNonContentUrls.push(url);
      continue;
    }
    pageHtmlByUrl[url] = html;
    const path = new URL(url).pathname || "/";
    const title = extractTitle(html);
    const h1 = extractH1(html);
    const category = classifyWebsitePage(path, title, html);
    pages.push({
      url,
      path,
      title,
      category,
      detectedServiceIds: [],
      discoverySource: meta.source,
      fetchStatus: "ok",
      h1,
      isContentPage: true,
      evidenceCategories: [category],
    });
  }

  return {
    pages,
    sitemapUrls: sitemapPageUrls,
    robotsDetected,
    homepageHtml,
    pageHtmlByUrl,
    skippedNonContentUrls,
  };
}

export function extractTechnicalSignals(
  homepageHtml: string,
  websiteUrl: string,
  sitemapDetected: boolean,
  robotsDetected: boolean,
) {
  const html = homepageHtml || "";
  return {
    https: websiteUrl.startsWith("https://"),
    sitemapDetected,
    robotsDetected,
    schemaDetected: /application\/ld\+json|schema\.org/i.test(html),
    metaTitlesPresent: /<title[^>]*>[^<]{3,}<\/title>/i.test(html),
    metaDescriptionsPresent: /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{10,}/i.test(html),
    openGraphPresent: /<meta[^>]+property=["']og:/i.test(html),
    canonicalPresent: /<link[^>]+rel=["']canonical["']/i.test(html),
    xmlSitemapUrl: sitemapDetected ? new URL("/sitemap.xml", websiteUrl).href : null,
  };
}

export { isXmlOrSitemapUrl, looksLikeHtmlDocument };
