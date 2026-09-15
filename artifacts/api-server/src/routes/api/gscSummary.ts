import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadSitemapUrls,
  fetchAccessToken,
  detectAuthMethod,
  readTrackingReport,
} from "../../../../../src/indexing/indexTrackingEngine";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? path.resolve(process.cwd(), "output");
const GSC_WEBMASTERS_BASE = "https://www.googleapis.com/webmasters/v3/sites";

type SourceMethod =
  | "search-console-page-indexing"
  | "url-inspection"
  | "search-analytics-discovery"
  | "manual-gsc-import";

type Summary = {
  projectSlug: string;
  property: string;
  source: "google-search-console";
  sourceMethod: SourceMethod;
  lastUpdated: string;
  indexedCount: number | null;
  notIndexedCount: number | null;
  totalKnown: number | null;
  pagesWithImpressions: number | null;
  pagesWithClicks: number | null;
  inspection: {
    checked: number;
    indexed: number;
    notIndexed: number;
    lastRunAt: string | null;
  } | null;
};

const router = Router();

function summaryPath(slug: string): string {
  return path.join(OUTPUT_DIR, slug, "gsc-summary.json");
}

function readSummary(slug: string): Summary | null {
  const p = summaryPath(slug);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Summary;
  } catch {
    return null;
  }
}

function writeSummary(slug: string, summary: Summary): void {
  const p = summaryPath(slug);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(summary, null, 2), "utf8");
}

function siteUrlFromUrls(urls: string[]): { siteUrl: string; hostname: string } | null {
  for (const u of urls) {
    try {
      const parsed = new URL(u);
      return {
        siteUrl: parsed.protocol + "//" + parsed.hostname + "/",
        hostname: parsed.hostname,
      };
    } catch {
      // skip bad URL
    }
  }
  return null;
}

async function fetchSitemapTotals(siteUrl: string, hostname: string, accessToken: string): Promise<{
  indexed: number;
  submitted: number;
  property: string;
  rawResponse: unknown;
} | null> {
  async function tryFetch(sv: string): Promise<any | null> {
    const url = GSC_WEBMASTERS_BASE + "/" + encodeURIComponent(sv) + "/sitemaps";
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + accessToken },
    });

    if (res.status === 403 || res.status === 404) return null;

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error("GSC Sitemaps API " + String(res.status) + ": " + body.slice(0, 500));
    }

    return res.json();
  }

  let data = await tryFetch(siteUrl);
  let property = siteUrl;

  if (!data) {
    const domainSite = "sc-domain:" + hostname;
    data = await tryFetch(domainSite);
    if (data) property = domainSite;
  }

  if (!data) return null;

  let totalIndexed = 0;
  let totalSubmitted = 0;

  for (const sm of data.sitemap ?? []) {
    for (const c of sm.contents ?? []) {
      const type = String(c.type ?? "").toLowerCase();

      const indexed =
        Number(c.indexed ?? c.indexedUrls ?? c.indexedUrlCount ?? c.isIndexed ?? 0) || 0;

      const submitted =
        Number(c.submitted ?? c.submittedUrls ?? c.submittedUrlCount ?? c.submittedCount ?? 0) || 0;

      if (type === "web" || type === "url" || type === "") {
        totalIndexed += indexed;
        totalSubmitted += submitted;
      }
    }
  }

  return { indexed: totalIndexed, submitted: totalSubmitted, property, rawResponse: data };
}

async function fetchSearchAnalyticsCounts(siteUrl: string, hostname: string, accessToken: string): Promise<{
  pagesWithImpressions: number;
  pagesWithClicks: number;
  rawRows: unknown;
} | null> {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 90);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  async function tryQuery(sv: string): Promise<any | null> {
    const url = GSC_WEBMASTERS_BASE + "/" + encodeURIComponent(sv) + "/searchAnalytics/query";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["page"],
        rowLimit: 25000,
      }),
    });

    if (res.status === 403 || res.status === 404) return null;
    if (!res.ok) return null;

    return res.json();
  }

  let data = await tryQuery(siteUrl);
  if (!data) data = await tryQuery("sc-domain:" + hostname);
  if (!data?.rows) return null;

  return {
    pagesWithImpressions: data.rows.filter((r: any) => (r.impressions ?? 0) > 0).length,
    pagesWithClicks: data.rows.filter((r: any) => (r.clicks ?? 0) > 0).length,
    rawRows: data.rows.slice(0, 5),
  };
}

function buildInspectionSummary(slug: string): Summary["inspection"] {
  const report = readTrackingReport(slug, OUTPUT_DIR);
  if (!report || !report.records.length) return null;

  return {
    checked: report.records.filter((r: any) => r.lastCheckedAt).length,
    indexed: report.indexedCount,
    notIndexed: report.notIndexedCount,
    lastRunAt: report.runAt ?? null,
  };
}

router.get("/gsc-summary/:slug", (req, res) => {
  res.json({ summary: readSummary(req.params.slug) });
});

router.post("/gsc-summary/refresh/:slug", async (req, res) => {
  const slug = req.params.slug;

  if (detectAuthMethod() === "none") {
    res.status(400).json({ error: "No Google credentials configured. Connect Google Search Console first." });
    return;
  }

  const accessToken = await fetchAccessToken();
  if (!accessToken) {
    res.status(500).json({ error: "Failed to obtain Google access token. Try reconnecting Google Search Console." });
    return;
  }

  const urls = loadSitemapUrls(slug, OUTPUT_DIR);

  if (!urls.length) {
    res.status(400).json({
      error: "No sitemap URLs found for project " + slug + ". Run sitemap generation first.",
      debug: { outputDir: OUTPUT_DIR }
    });
    return;
  }

  const site = siteUrlFromUrls(urls);
  if (!site) {
    res.status(400).json({ error: "Could not determine site URL from sitemap." });
    return;
  }

  const warnings: string[] = [];

  let sitemapTotals: Awaited<ReturnType<typeof fetchSitemapTotals>> = null;
  try {
    sitemapTotals = await fetchSitemapTotals(site.siteUrl, site.hostname, accessToken);
  } catch (err: unknown) {
    warnings.push("Sitemaps API: " + (err as Error).message);
  }

  let analytics: Awaited<ReturnType<typeof fetchSearchAnalyticsCounts>> = null;
  try {
    analytics = await fetchSearchAnalyticsCounts(site.siteUrl, site.hostname, accessToken);
  } catch {
    // non-fatal
  }

  const inspection = buildInspectionSummary(slug);

  let sourceMethod: SourceMethod = "url-inspection";
  let indexedCount: number | null = null;
  let notIndexedCount: number | null = null;
  let totalKnown: number | null = null;
  let property = sitemapTotals?.property ?? site.siteUrl;

  if (inspection && inspection.checked > 0) {
    // URL Inspection is more reliable for real indexed/not-indexed status.
    // The Search Console Sitemaps API often reports indexed=0 even when pages
    // have impressions/clicks and inspection confirms indexed URLs.
    sourceMethod = "url-inspection";
    indexedCount = inspection.indexed;
    notIndexedCount = inspection.notIndexed;
    totalKnown = inspection.checked;
    property = sitemapTotals?.property ?? property;
  } else if (sitemapTotals) {
    sourceMethod = "search-console-page-indexing";
    indexedCount = sitemapTotals.indexed;
    notIndexedCount = Math.max(0, sitemapTotals.submitted - sitemapTotals.indexed);
    totalKnown = sitemapTotals.submitted;
    property = sitemapTotals.property;
  }

  const summary: Summary = {
    projectSlug: slug,
    property,
    source: "google-search-console",
    sourceMethod,
    lastUpdated: new Date().toISOString(),
    indexedCount,
    notIndexedCount,
    totalKnown,
    pagesWithImpressions: analytics?.pagesWithImpressions ?? null,
    pagesWithClicks: analytics?.pagesWithClicks ?? null,
    inspection,
  };

  writeSummary(slug, summary);

  res.json({
    summary,
    debug: {
      outputDir: OUTPUT_DIR,
      siteUrl: site.siteUrl,
      hostname: site.hostname,
      sitemapUrlCount: urls.length,
      sitemapsApiRaw: sitemapTotals?.rawResponse ?? null,
      parsedTotals: {
        indexed: sitemapTotals?.indexed ?? null,
        submitted: sitemapTotals?.submitted ?? null,
      },
      searchAnalytics: analytics
        ? {
            pagesWithImpressions: analytics.pagesWithImpressions,
            pagesWithClicks: analytics.pagesWithClicks,
            sampleRows: analytics.rawRows,
          }
        : null,
      inspectionFallback: inspection,
    },
    warnings,
  });
});

export default router;
