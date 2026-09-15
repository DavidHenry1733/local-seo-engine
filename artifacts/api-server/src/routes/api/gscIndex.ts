import express from "express";
import fs from "fs";
import path from "path";
import { inspectUrlWithGsc } from "../../services/gsc/urlInspection";
import { discoverPagesFromGsc } from "../../services/gsc/searchAnalytics";
import { loadOAuthTokens } from "./gscAuth";
import { google } from "googleapis";

const router = express.Router();

type GscJob = {
  id: string;
  slug: string;
  siteUrl: string;
  status: "running" | "complete" | "error";
  total: number;
  checked: number;
  indexed: number;
  crawledNotIndexed: number;
  discoveredNotIndexed: number;
  errors: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
};

const gscJobs = new Map<string, GscJob>();

function makeJobId() {
  return "gsc_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function summariseResults(results: any[]) {
  const state = (r:any) => String(r.coverageState || "").toLowerCase();

  return {
    total: results.length,
    indexed: results.filter((r) =>
      r.verdict === "PASS" &&
      state(r).includes("indexed") &&
      !state(r).includes("not indexed")
    ).length,
    crawledNotIndexed: results.filter((r) =>
      state(r).includes("crawled") &&
      state(r).includes("not indexed")
    ).length,
    discoveredNotIndexed: results.filter((r) =>
      state(r).includes("discovered") &&
      state(r).includes("not indexed")
    ).length,
    errors: results.filter((r) => r.verdict === "ERROR").length,
  };
}

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine", "output");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readImportedGscUrls(slug: string): string[] {
  const file = path.join(OUTPUT_DIR, slug, "gsc-imported-urls.json");

  if (!fs.existsSync(file)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Array.isArray(data.urls)) return data.urls.filter(Boolean);
    if (Array.isArray(data)) return data.filter(Boolean);
  } catch {}

  return [];
}


function gscStatusFile(slug: string) {
  return path.join(OUTPUT_DIR, slug, "gsc-url-status.json");
}

function readGscStatusStore(slug: string): Record<string, any> {
  const file = gscStatusFile(slug);
  if (!fs.existsSync(file)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return data.records || {};
  } catch {
    return {};
  }
}

function writeGscStatusStore(slug: string, records: Record<string, any>) {
  const outDir = path.join(OUTPUT_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    gscStatusFile(slug),
    JSON.stringify({
      slug,
      updatedAt: new Date().toISOString(),
      records,
    }, null, 2)
  );
}

function normaliseCoverageState(v: any) {
  return String(v || "").toLowerCase();
}

function summariseStore(records: Record<string, any>) {
  const all = Object.values(records);
  const checked = all.filter((r:any) => r.lastCheckedAt);

  return {
    total: checked.length,
    knownUrls: all.length,
    indexed: checked.filter((r:any) =>
      r.verdict === "PASS" &&
      normaliseCoverageState(r.coverageState).includes("indexed") &&
      !normaliseCoverageState(r.coverageState).includes("not indexed")
    ).length,
    crawledNotIndexed: checked.filter((r:any) =>
      normaliseCoverageState(r.coverageState).includes("crawled") &&
      normaliseCoverageState(r.coverageState).includes("not indexed")
    ).length,
    discoveredNotIndexed: checked.filter((r:any) =>
      normaliseCoverageState(r.coverageState).includes("discovered") &&
      normaliseCoverageState(r.coverageState).includes("not indexed")
    ).length,
    unknown: checked.filter((r:any) =>
      normaliseCoverageState(r.coverageState).includes("unknown")
    ).length,
    errors: checked.filter((r:any) => r.verdict === "ERROR").length,
    pending: all.filter((r:any) => !r.lastCheckedAt).length,
  };
}

function chooseNextGscBatch(slug: string, urls: string[], batchSize = 25) {
  const existing = readGscStatusStore(slug);
  const now = new Date().toISOString();

  for (const url of urls) {
    if (!existing[url]) {
      existing[url] = {
        url,
        firstSeenAt: now,
        source: "discovered",
      };
    }
  }

  writeGscStatusStore(slug, existing);

  return Object.values(existing)
    .sort((a:any, b:any) => {
      const av = a.lastCheckedAt || "";
      const bv = b.lastCheckedAt || "";
      return av.localeCompare(bv);
    })
    .slice(0, batchSize)
    .map((r:any) => r.url);
}

function updateGscStatusStore(slug: string, siteUrl: string, results: any[]) {
  const records = readGscStatusStore(slug);
  const now = new Date().toISOString();

  for (const r of results) {
    if (!r?.url) continue;

    records[r.url] = {
      ...(records[r.url] || { url: r.url, firstSeenAt: now }),
      siteUrl,
      url: r.url,
      verdict: r.verdict,
      coverageState: r.coverageState,
      indexingState: r.indexingState,
      robotsTxtState: r.robotsTxtState,
      pageFetchState: r.pageFetchState,
      googleCanonical: r.googleCanonical,
      userCanonical: r.userCanonical,
      lastCrawlTime: r.lastCrawlTime,
      lastCheckedAt: now,
      lastError: r.error || null,
    };
  }

  writeGscStatusStore(slug, records);

  return records;
}

function writeGscSnapshotFromStore(slug: string, siteUrl: string, records: Record<string, any>, extra: any = {}) {
  const checkedRecords = Object.values(records).filter((r:any) => r.lastCheckedAt);
  const summary = summariseStore(records);

  const snapshot = {
    slug,
    siteUrl,
    checkedAt: new Date().toISOString(),
    source: "persistent-gsc-url-status",
    ...extra,
    summary,
    results: checkedRecords,
  };

  const outDir = path.join(OUTPUT_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, "gsc-index-status.json"),
    JSON.stringify(snapshot, null, 2)
  );

  return snapshot;
}

function readUrls(slug: string): string[] {
  let registryFile = path.join(OUTPUT_DIR, slug, "page-registry.json");
  let sitemapFile = path.join(OUTPUT_DIR, slug, "sitemap.xml");

  // Fallback for current single-project setup where activeSlug may be a campaign/session,
  // but the registry is stored under the client project folder.
  if (!fs.existsSync(registryFile)) {
    const fallbackRegistry = path.join(OUTPUT_DIR, "inboxingproweb", "page-registry.json");
    const fallbackSitemap = path.join(OUTPUT_DIR, "inboxingproweb", "sitemap.xml");

    if (fs.existsSync(fallbackRegistry)) {
      registryFile = fallbackRegistry;
      sitemapFile = fallbackSitemap;
    }
  }

  if (fs.existsSync(registryFile)) {
    const data = JSON.parse(fs.readFileSync(registryFile, "utf8"));

    if (Array.isArray(data.urls)) return data.urls;

    if (Array.isArray(data.pages)) {
      return data.pages
        .map((p:any)=>p.url)
        .filter(Boolean);
    }

    if (Array.isArray(data)) return data;
  }

  if (fs.existsSync(sitemapFile)) {
    const raw = fs.readFileSync(sitemapFile, "utf8").trim();

    // sitemap.xml is XML, not JSON. Parse <loc> entries safely.
    if (raw.startsWith("<")) {
      return Array.from(raw.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi))
        .map((m) => String(m[1] ?? "").trim())
        .filter((u) => u.startsWith("http"));
    }

    // Legacy support: some older files may contain JSON URL lists.
    const data = JSON.parse(raw);

    if (Array.isArray(data.urls)) return data.urls;

    if (Array.isArray(data.pages)) {
      return data.pages
        .map((p:any)=>p.url)
        .filter(Boolean);
    }

    if (Array.isArray(data)) return data;
  }

  return [];
}


router.post("/gsc-index/import-urls/:slug", express.json({ limit: "5mb" }), (req, res) => {
  const slug = req.params.slug;
  const { urls, text } = req.body || {};

  let imported: string[] = [];

  if (Array.isArray(urls)) {
    imported = urls;
  } else if (typeof text === "string") {
    imported = text
      .split(/\r?\n|,|\t/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"));
  }

  imported = Array.from(new Set(imported));

  const outDir = path.join(OUTPUT_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, "gsc-imported-urls.json"),
    JSON.stringify({
      slug,
      importedAt: new Date().toISOString(),
      count: imported.length,
      urls: imported,
    }, null, 2)
  );

  res.json({
    success: true,
    imported: imported.length,
  });
});

router.post("/gsc-index/refresh/:slug", async (req, res) => {
  const slug = req.params.slug;
  const { siteUrl } = req.body || {};

  if (!siteUrl) {
    return res.status(400).json({ error: "Missing siteUrl" });
  }

  const saved = loadOAuthTokens();

  if (!saved?.refresh_token) {
    return res.status(400).json({ error: "Google Search Console is not connected" });
  }

  const urls = readUrls(slug);

  if (!urls.length) {
    return res.status(404).json({ error: "No URLs found for this project", slug });
  }

  const jobId = makeJobId();

  const job: GscJob = {
    id: jobId,
    slug,
    siteUrl,
    status: "running",
    total: urls.length,
    checked: 0,
    indexed: 0,
    crawledNotIndexed: 0,
    discoveredNotIndexed: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
  };

  gscJobs.set(jobId, job);

  res.json({
    started: true,
    jobId,
    total: urls.length,
    message: "GSC index refresh started",
  });

  setImmediate(async () => {
    const results: any[] = [];

    try {
      const oauth2 = new google.auth.OAuth2(
        process.env.GSC_OAUTH_CLIENT_ID,
        process.env.GSC_OAUTH_CLIENT_SECRET
      );

      oauth2.setCredentials({ refresh_token: saved.refresh_token });

      const tokenResponse = await oauth2.getAccessToken();
      const accessToken = tokenResponse.token;

      if (!accessToken) {
        throw new Error("Failed to obtain Google access token");
      }

      let discovered: any[] = [];

      try {
        discovered = await discoverPagesFromGsc({
          siteUrl,
          accessToken,
          days: 480,
          rowLimit: 25000,
        });
      } catch (err:any) {
        console.error("[gscIndex] Search Analytics discovery failed:", err?.message || err);
        discovered = [];
      }

      console.log("[gscIndex] URL sources", {
        slug,
        registryUrls: urls.length,
        discoveredUrls: discovered.length,
      });

      const allowedHost = "https://local.inboxingproweb.com/";

      const allUrls = Array.from(new Set([
        ...urls,
        ...readImportedGscUrls(slug),
        ...discovered
          .map((p) => p.url)
          .filter((u) => String(u).startsWith(allowedHost)),
      ]));

      const batchUrls = chooseNextGscBatch(slug, allUrls, 25);

      job.total = batchUrls.length;

      const concurrency = 10;
      let cursor = 0;

      async function worker() {
        while (cursor < batchUrls.length) {
          const url = batchUrls[cursor++];
          const result = await inspectUrlWithGsc({ url, siteUrl, accessToken });

          if (
            result.verdict === "ERROR" &&
            String(result.error || "").toLowerCase().includes("quota")
          ) {
            job.status = "error";
            job.error = "Google quota exceeded. Partial results preserved. Try again later.";
            break;
          }

          results.push(result);

          const summary = summariseResults(results);

          job.checked = results.length;
          job.indexed = summary.indexed;
          job.crawledNotIndexed = summary.crawledNotIndexed;
          job.discoveredNotIndexed = summary.discoveredNotIndexed;
          job.errors = summary.errors;
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(concurrency, batchUrls.length) }, () => worker())
      );

      if (results.length === 0) {
        throw new Error("No valid GSC inspection results returned. Existing snapshot preserved.");
      }

      const records = updateGscStatusStore(slug, siteUrl, results);
      const snapshot = writeGscSnapshotFromStore(slug, siteUrl, records, {
        lastBatchChecked: results.length,
        partial: job.status === "error",
        error: job.error || null,
      });

      const finalSummary = snapshot.summary;

      job.indexed = finalSummary.indexed;
      job.crawledNotIndexed = finalSummary.crawledNotIndexed;
      job.discoveredNotIndexed = finalSummary.discoveredNotIndexed;
      job.errors = finalSummary.errors;
      job.checked = finalSummary.total;
      job.total = finalSummary.knownUrls;

      job.status = "complete";
      job.finishedAt = new Date().toISOString();
    } catch (err: any) {
      console.error("[gscIndex] refresh job failed:", err?.message || err);
      job.status = "error";
      job.error = err?.message || String(err);
      job.finishedAt = new Date().toISOString();
    }
  });
});

router.get("/gsc-index/job/:jobId", (req, res) => {
  const job = gscJobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: "GSC job not found" });
  }

  res.json(job);
});

router.get("/gsc-index/status/:slug", (req, res) => {
  const file = path.join(
    OUTPUT_DIR,
    req.params.slug,
    "gsc-index-status.json"
  );

  if (!fs.existsSync(file)) {
    return res.status(404).json({
      error: "No GSC index snapshot yet. Run refresh first.",
    });
  }

  res.json(JSON.parse(fs.readFileSync(file, "utf8")));
});

export default router;

