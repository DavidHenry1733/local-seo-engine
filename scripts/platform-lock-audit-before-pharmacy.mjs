#!/usr/bin/env node
/**
 * Read-only platform lock audit before Pharmacy/PharmaConnect development.
 */
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROJECT = "inboxingproweb";
const PROJECT_DIR = path.join(ROOT, "output", PROJECT);
const DOMAIN = "https://local.inboxingproweb.com";
const CAMPAIGN_ID = "rotherham-webho-ting-5b9958";
const REPORT_PATH = path.join(PROJECT_DIR, "platform-lock-audit-before-pharmacy.json");
const ROLLOUT_JOB_DIR = "/tmp/seo-rollout-jobs";

const PHANTOM_URLS = [
  `${DOMAIN}/google-business-profile-thurcroft/`,
  `${DOMAIN}/google-business-profile-wickersley/`,
  `${DOMAIN}/local-business-visibility-ecclesall/`,
  `${DOMAIN}/local-business-visibility-wickersley/`,
];

const SERVICE_PAGES = [
  { slug: "web-hosting-rotherham", type: "hosting", campaignId: CAMPAIGN_ID, serviceKey: "web-hosting" },
  { slug: "web-hosting-rawmarsh", type: "hosting", campaignId: CAMPAIGN_ID, serviceKey: "web-hosting" },
  { slug: "web-hosting-wickersley", type: "hosting", campaignId: CAMPAIGN_ID, serviceKey: "web-hosting" },
  { slug: "email-marketing-rotherham", type: "email", campaignId: "rotherham-emailmarketing-266f98", serviceKey: "email-marketing" },
  { slug: "email-marketing-rawmarsh", type: "email", campaignId: "rotherham-emailmarketing-266f98", serviceKey: "email-marketing" },
  { slug: "email-marketing-wickersley", type: "email", campaignId: "rotherham-emailmarketing-266f98", serviceKey: "email-marketing" },
];

const BLOG_URLS = [
  `${DOMAIN}/blog/`,
  `${DOMAIN}/blog/reliable-web-hosting-for-rotherham-businesses/`,
  `${DOMAIN}/blog/signs-your-rotherham-business-needs-better-hosting/`,
  `${DOMAIN}/blog/uk-hosting-vs-cheap-shared-hosting-rotherham/`,
  `${DOMAIN}/blog/how-web-hosting-supports-local-seo-rotherham/`,
];

const LIFECYCLE_ARTIFACTS = [
  "url-lifecycle.json",
  "url-health-audit.json",
  "index-dashboard.json",
  "seo-opportunities.json",
  "seo-health-score.json",
  "full-page-audit.json",
  "dashboard-seo-intelligence-contract.json",
];

const EXPECTED_ASSET_COUNT = 29;

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readToken() {
  try {
    const dump = JSON.parse(fs.readFileSync("/root/.pm2/dump.pm2", "utf8"));
    const app = Array.isArray(dump) ? dump.find((a) => a.name === "local-seo-engine") : dump;
    if (app?.SESSION_SECRET) return app.SESSION_SECRET;
  } catch { /* ignore */ }
  return process.env.SESSION_SECRET ?? "dev-fallback-secret-change-in-prod";
}

const TOKEN = readToken();

function normaliseUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    if (!u.pathname.endsWith("/")) u.pathname += "/";
    return u.toString();
  } catch {
    return url.trim();
  }
}

function sitemapUrlsFromFile(file) {
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => normaliseUrl(m[1]));
}

function fetchUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, { method: "GET", timeout: 30000 }, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", (err) => resolve({ status: 0, error: String(err.message || err), body: "" }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, error: "timeout", body: "" }); });
    req.end();
  });
}

function apiRequest(method, urlPath) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path: urlPath,
        method,
        headers: { Accept: "application/json", "X-Internal-Token": TOKEN },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = { raw: data.slice(0, 500) }; }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on("error", (err) => resolve({ status: 0, body: { error: String(err.message || err) } }));
    req.end();
  });
}

function extractSlotSrc(html, wrapperClass) {
  const re = new RegExp(
    `<div\\b[^>]*class="[^"]*\\b${wrapperClass}\\b[^"]*"[^>]*>[\\s\\S]*?<img\\b[^>]*\\bsrc="([^"]*)"`,
    "i",
  );
  return html.match(re)?.[1] ?? null;
}

function validatePaneImages(body, campaignId, serviceKey) {
  const wrappers = { hero: "hero-media", support: "support-block-media", trust: "trust-block-media" };
  const out = {};
  for (const [slot, wrapper] of Object.entries(wrappers)) {
    const src = extractSlotSrc(body, wrapper);
    const expected = `${DOMAIN}/assets/${campaignId}/${serviceKey}/${slot}.webp`;
    out[slot] = {
      src,
      expected,
      usesPanePath: src === expected,
      usesLibrary: src ? /\/assets\/image-library\//.test(src) : false,
    };
  }
  return out;
}

function hasContextualBodyLinks(body, type) {
  const contextualClass = /class="contextual-link/.test(body);
  const sectionIds = type === "hosting"
    ? ["hosting-features", "hosting-problems", "hosting-security", "hosting-comparison", "hosting-migration"]
    : ["email-why-works", "email-retention", "email-automation", "email-deliverability", "email-reporting"];
  const sectionLinks = sectionIds.some((id) => {
    const re = new RegExp(`id="${id}"[\\s\\S]*?<a\\b`, "i");
    return re.test(body);
  });
  return contextualClass || sectionLinks;
}

async function auditServicePage(page) {
  const url = `${DOMAIN}/${page.slug}/`;
  const res = await fetchUrl(url);
  const paneImages = res.body ? validatePaneImages(res.body, page.campaignId, page.serviceKey) : {};
  const checks = res.body && res.status === 200 ? {
    http200: true,
    correctTemplate: page.type === "hosting"
      ? res.body.includes('id="hosting-features"')
      : res.body.includes('id="email-why-works"'),
    noCrossServiceDrift: page.type === "hosting"
      ? !res.body.includes('id="email-why-works"')
      : !res.body.includes('id="hosting-features"'),
    noConversionPlaceholder: !/<div[^>]*conversion-feature-image[^>]*v3-placeholder/i.test(res.body),
    canonical: new RegExp(`<link rel="canonical" href="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "i").test(res.body),
    schema: /application\/ld\+json/i.test(res.body),
    heroPane: paneImages.hero?.usesPanePath === true,
    supportPane: paneImages.support?.usesPanePath === true,
    trustPane: paneImages.trust?.usesPanePath === true,
    noLibraryFallback: !paneImages.hero?.usesLibrary && !paneImages.support?.usesLibrary && !paneImages.trust?.usesLibrary,
    contextualBodyLinks: hasContextualBodyLinks(res.body, page.type),
  } : { http200: false };

  const pass = res.status === 200 && Object.values(checks).every(Boolean);
  return { url, slug: page.slug, service: page.type, status: res.status, pass, checks, paneImages, error: res.error };
}

function existsLocalHref(href) {
  if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return true;
  const slug = href.replace(/^\/|\/$/g, "");
  if (["uk-website-hosting", "local-seo-services", "custom-website-design", "email-marketing-3", "our-services", "email-sms-marketing-in-rotherham"].includes(slug)) return true;
  const blogDir = path.join(PROJECT_DIR, "blog", slug);
  return fs.existsSync(path.join(PROJECT_DIR, slug, "index.html")) || fs.existsSync(path.join(blogDir, "index.html"));
}

async function auditBlogPage(url) {
  const res = await fetchUrl(url);
  const body = res.body ?? "";
  const issues = [];
  if (res.status !== 200) issues.push(`http-${res.status}`);
  const title = body.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
  const h1 = body.match(/<h1>([^<]+)<\/h1>/i)?.[1] ?? "";
  const isHub = url.endsWith("/blog/");
  const articleSchema = /"@type"\s*:\s*"BlogPosting"/.test(body);
  const faqSchema = /"@type"\s*:\s*"FAQPage"/.test(body);
  const cta = body.includes('class="cta"');
  const internalLinks = body.includes('class="link-panel"') || /<main[\s\S]*<a\b/i.test(body);
  const canonical = body.match(/<link rel="canonical" href="([^"]+)"/i)?.[1] ?? "";
  const tokens = body.match(/\{\{[A-Z_]+\}\}/g) ?? [];
  const broken = [];
  let m;
  const re = /<a\b[^>]*href=["']([^"']+)["']/gi;
  while ((m = re.exec(body))) {
    if (!existsLocalHref(m[1])) broken.push(m[1]);
  }
  if (!title) issues.push("missing-title");
  if (!h1) issues.push("missing-h1");
  if (!articleSchema && !isHub) issues.push("missing-article-schema");
  if (!faqSchema && !isHub) issues.push("missing-faq-schema");
  if (!cta && !isHub) issues.push("missing-cta");
  if (!internalLinks) issues.push("missing-internal-links");
  if (!canonical && !isHub) issues.push("missing-canonical");
  if (tokens.length) issues.push("unreplaced-tokens");
  if (broken.length) issues.push(`broken-links:${broken.join(",")}`);
  return { url, status: res.status, title, h1, articleSchema, faqSchema, cta, internalLinks, canonical, brokenLinks: broken, tokens, issues, pass: issues.length === 0 };
}

function auditRegistrySitemap() {
  const registry = readJson(path.join(PROJECT_DIR, "page-registry.json"));
  const registryUrls = (registry.pages ?? []).map((p) => normaliseUrl(p.url));
  const sitemapUrls = sitemapUrlsFromFile(path.join(PROJECT_DIR, "sitemap.xml"));
  const registrySet = new Set(registryUrls);
  const sitemapSet = new Set(sitemapUrls);
  const malformed = [...registryUrls, ...sitemapUrls].filter((u) => !/^https:\/\/local\.inboxingproweb\.com\/.+\/$/.test(u));
  const dupesRegistry = registryUrls.filter((u, i) => registryUrls.indexOf(u) !== i);
  const dupesSitemap = sitemapUrls.filter((u, i) => sitemapUrls.indexOf(u) !== i);
  const phantomInRegistry = registryUrls.filter((u) => PHANTOM_URLS.includes(u));
  const phantomInSitemap = sitemapUrls.filter((u) => PHANTOM_URLS.includes(u));
  const inRegistryNotSitemap = registryUrls.filter((u) => !sitemapSet.has(u));
  const inSitemapNotRegistry = sitemapUrls.filter((u) => !registrySet.has(u));
  return {
    registryCount: registryUrls.length,
    sitemapCount: sitemapUrls.length,
    registryEqualsSitemap: registryUrls.length === sitemapUrls.length && inRegistryNotSitemap.length === 0 && inSitemapNotRegistry.length === 0,
    malformedCount: new Set(malformed).size,
    duplicateCount: dupesRegistry.length + dupesSitemap.length,
    phantomInRegistry: phantomInRegistry.length,
    phantomInSitemap: phantomInSitemap.length,
    phantomUrls: PHANTOM_URLS,
    phantomExcluded: phantomInRegistry.length === 0 && phantomInSitemap.length === 0,
    inRegistryNotSitemap,
    inSitemapNotRegistry,
    pass: registryUrls.length === 173
      && sitemapUrls.length === 173
      && inRegistryNotSitemap.length === 0
      && inSitemapNotRegistry.length === 0
      && phantomInRegistry.length === 0
      && phantomInSitemap.length === 0
      && malformed.length === 0
      && dupesRegistry.length === 0
      && dupesSitemap.length === 0,
  };
}

function auditLifecycleArtifacts() {
  const results = {};
  let allExist = true;
  for (const file of LIFECYCLE_ARTIFACTS) {
    const p = path.join(PROJECT_DIR, file);
    results[file] = { exists: fs.existsSync(p), generatedAt: null, valid: false };
    if (!fs.existsSync(p)) { allExist = false; continue; }
    try {
      const data = readJson(p);
      results[file].generatedAt = data.generatedAt ?? data.updatedAt ?? null;
      results[file].valid = true;
    } catch {
      results[file].valid = false;
      allExist = false;
    }
  }

  const registry = readJson(path.join(PROJECT_DIR, "page-registry.json"));
  const registryUrls = new Set((registry.pages ?? []).map((p) => normaliseUrl(p.url)));
  const lifecycle = fs.existsSync(path.join(PROJECT_DIR, "url-lifecycle.json"))
    ? readJson(path.join(PROJECT_DIR, "url-lifecycle.json"))
    : null;
  const lifecycleUrls = new Set((lifecycle?.records ?? []).map((r) => normaliseUrl(r.url)));
  const missingFromLifecycle = [...registryUrls].filter((u) => !lifecycleUrls.has(u));
  const gscDataGaps = lifecycle?.summary?.urlsMissingLifecycleData ?? lifecycle?.summary?.missingLifecycleDataCount ?? 0;
  const gscGapUrls = lifecycle?.summary?.urlsMissingLifecycleData ?? [];

  return {
    artifacts: results,
    allExist,
    allValid: Object.values(results).every((r) => r.exists && r.valid),
    registryCount: registryUrls.size,
    lifecycleRecordCount: lifecycleUrls.size,
    missingFromLifecycle,
    gscDataGaps,
    gscGapUrls,
    structuralGaps: missingFromLifecycle.length > 0,
    pass: allExist && Object.values(results).every((r) => r.valid) && missingFromLifecycle.length === 0,
  };
}

function auditContentEngine() {
  const campaignDir = path.join(PROJECT_DIR, "campaign-content", CAMPAIGN_ID);
  const manifestPath = path.join(campaignDir, "campaignContent.json");
  const assetsDir = path.join(campaignDir, "assets");
  const exportsDir = path.join(PROJECT_DIR, "blog");

  const manifestExists = fs.existsSync(manifestPath);
  let manifest = null;
  let assetCount = 0;
  let statusesValid = false;
  if (manifestExists) {
    manifest = readJson(manifestPath);
    assetCount = manifest?.assetIndex?.length ?? 0;
  }
  const assetFiles = fs.existsSync(assetsDir)
    ? fs.readdirSync(assetsDir).filter((f) => f.endsWith(".json"))
    : [];
  if (assetFiles.length) {
    statusesValid = assetFiles.every((f) => {
      const a = readJson(path.join(assetsDir, f));
      return ["generated", "reviewed", "approved", "published"].includes(a.status);
    });
  }

  const blogExports = [
    "reliable-web-hosting-for-rotherham-businesses",
    "signs-your-rotherham-business-needs-better-hosting",
    "uk-hosting-vs-cheap-shared-hosting-rotherham",
    "how-web-hosting-supports-local-seo-rotherham",
  ].map((slug) => ({
    slug,
    html: fs.existsSync(path.join(exportsDir, slug, "index.html")),
    assetJson: fs.existsSync(path.join(exportsDir, slug, "content-engine-asset.json")),
  }));

  return {
    campaignId: CAMPAIGN_ID,
    manifestExists,
    assetCount,
    expectedAssetCount: EXPECTED_ASSET_COUNT,
    assetFileCount: assetFiles.length,
    statusesValid,
    blogExports,
    allBlogExportsPresent: blogExports.every((e) => e.html && e.assetJson),
    pass: manifestExists && assetCount === EXPECTED_ASSET_COUNT && assetFiles.length === EXPECTED_ASSET_COUNT && statusesValid && blogExports.every((e) => e.html),
  };
}

async function auditDashboardApis() {
  const slug = PROJECT;
  const campaigns = await apiRequest("GET", `/api/content/campaigns?slug=${encodeURIComponent(slug)}`);
  const campaignLoad = await apiRequest("GET", `/api/content/${encodeURIComponent(CAMPAIGN_ID)}?slug=${encodeURIComponent(slug)}`);
  const distribution = await apiRequest("GET", `/api/distribution/${encodeURIComponent(slug)}`);
  const distPages = await apiRequest("GET", `/api/distribution/${encodeURIComponent(slug)}/pages`);

  const campaignsOk = campaigns.status === 200 && campaigns.body?.ok && Array.isArray(campaigns.body.campaigns);
  const hasTargetCampaign = campaignsOk && campaigns.body.campaigns.some((c) => c.campaignId === CAMPAIGN_ID);
  const assetsOk = campaignLoad.status === 200 && campaignLoad.body?.ok && Array.isArray(campaignLoad.body.assets);
  const assetCount = assetsOk ? campaignLoad.body.assets.length : 0;
  const distributionOk = distribution.status === 200;
  const distPagesOk = distPages.status === 200;

  const dashboardHtml = await fetchUrl("http://127.0.0.1:3000/dashboard/inboxingproweb");
  const hasCcLoad = dashboardHtml.body.includes("function ccLoad(");
  const hasGeneratedAssets = dashboardHtml.body.includes('data-cc-sub="generated-assets"');
  const hasPageDistribution = dashboardHtml.body.includes('data-cc-sub="page-distribution"');
  const hasVisibilityPosts = dashboardHtml.body.includes('data-cc-sub="visibility-posts"');
  const jsSyntaxRisk = /function\s+\w+\([^)]*\)\s*\{[^}]*$/m.test(dashboardHtml.body.slice(-500));

  return {
    generatedAssets: { apiCampaigns: campaignsOk, hasTargetCampaign, apiAssets: assetsOk, assetCount, expected: EXPECTED_ASSET_COUNT, pass: campaignsOk && hasTargetCampaign && assetsOk && assetCount === EXPECTED_ASSET_COUNT },
    pageDistribution: { distributionApi: distributionOk, distPagesApi: distPagesOk, pass: distributionOk && distPagesOk },
    visibilityPosts: { panelPresent: hasVisibilityPosts, distributionApi: distributionOk, pass: hasVisibilityPosts && distributionOk },
    dashboardHtml: {
      httpStatus: dashboardHtml.status,
      hasCcLoad,
      hasGeneratedAssets,
      hasPageDistribution,
      hasVisibilityPosts,
      jsSyntaxRisk,
      pass: dashboardHtml.status === 200 && hasCcLoad && hasGeneratedAssets && hasPageDistribution && hasVisibilityPosts,
    },
    pass: campaignsOk && hasTargetCampaign && assetsOk && assetCount === EXPECTED_ASSET_COUNT && distributionOk && distPagesOk && dashboardHtml.status === 200,
  };
}

function auditSystem() {
  const pm2 = spawnSync("pm2", ["jlist"], { encoding: "utf8" });
  let pm2Online = false;
  let pm2Restarts = null;
  if (pm2.status === 0) {
    try {
      const apps = JSON.parse(pm2.stdout);
      const app = apps.find((a) => a.name === "local-seo-engine");
      pm2Online = app?.pm2_env?.status === "online";
      pm2Restarts = app?.pm2_env?.restart_time ?? null;
    } catch { /* ignore */ }
  }

  const distPath = path.join(ROOT, "artifacts", "api-server", "dist", "index.mjs");
  const srcPath = path.join(ROOT, "artifacts", "api-server", "src", "routes", "dashboard.ts");
  const distMtime = fs.existsSync(distPath) ? fs.statSync(distPath).mtimeMs : 0;
  const srcMtime = fs.existsSync(srcPath) ? fs.statSync(srcPath).mtimeMs : 0;
  const buildCurrent = distMtime >= srcMtime;

  let activeRolloutJobs = [];
  let failedRolloutJobs = [];
  if (fs.existsSync(ROLLOUT_JOB_DIR)) {
    const files = fs.readdirSync(ROLLOUT_JOB_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const job = readJson(path.join(ROLLOUT_JOB_DIR, file));
        const status = job.status ?? job.state ?? "unknown";
        if (["running", "in_progress", "active", "pending"].includes(String(status).toLowerCase())) {
          activeRolloutJobs.push({ jobId: file.replace(".json", ""), status });
        }
        if (["error", "failed", "cancelled"].includes(String(status).toLowerCase())) {
          const mtime = fs.statSync(path.join(ROLLOUT_JOB_DIR, file)).mtimeMs;
          if (Date.now() - mtime < 24 * 60 * 60 * 1000) {
            failedRolloutJobs.push({ jobId: file.replace(".json", ""), status });
          }
        }
      } catch { /* ignore corrupt job files */ }
    }
  }

  return {
    pm2Online,
    pm2Restarts,
    buildCurrent,
    distMtime: distMtime ? new Date(distMtime).toISOString() : null,
    activeRolloutJobs,
    failedRolloutJobsRecent24h: failedRolloutJobs,
    orphanDeployJobs: activeRolloutJobs.filter((j) => j.status === "running" || j.status === "in_progress"),
    pass: pm2Online && buildCurrent && activeRolloutJobs.length === 0,
  };
}

console.log("=== Platform Lock Audit Before Pharmacy ===\n");

const serviceResults = [];
for (const page of SERVICE_PAGES) {
  const r = await auditServicePage(page);
  serviceResults.push(r);
  console.log(`Service ${r.pass ? "PASS" : "FAIL"} ${r.url}`);
}

const blogResults = [];
for (const url of BLOG_URLS) {
  const r = await auditBlogPage(url);
  blogResults.push(r);
  console.log(`Blog ${r.pass ? "PASS" : "FAIL"} ${url}`);
}

const registrySitemap = auditRegistrySitemap();
console.log(`Registry/Sitemap: ${registrySitemap.pass ? "PASS" : "FAIL"} (${registrySitemap.registryCount}/${registrySitemap.sitemapCount})`);

const lifecycle = auditLifecycleArtifacts();
console.log(`Lifecycle artifacts: ${lifecycle.pass ? "PASS" : "FAIL"}`);

const contentEngine = auditContentEngine();
console.log(`Content Engine: ${contentEngine.pass ? "PASS" : "FAIL"} (${contentEngine.assetCount} assets)`);

const dashboard = await auditDashboardApis();
console.log(`Dashboard APIs: ${dashboard.pass ? "PASS" : "FAIL"}`);

const system = auditSystem();
console.log(`System: ${system.pass ? "PASS" : "FAIL"}`);

const blockers = [];
if (!serviceResults.every((r) => r.pass)) blockers.push("One or more service pages failed live validation");
if (!blogResults.every((r) => r.pass)) blockers.push("One or more blog URLs failed live validation");
if (!registrySitemap.pass) blockers.push("Registry/sitemap parity or phantom URL issue");
if (!lifecycle.allExist || !lifecycle.allValid) blockers.push("Lifecycle artifact missing or invalid");
if (lifecycle.structuralGaps) blockers.push(`Registry URLs missing from lifecycle: ${lifecycle.missingFromLifecycle.length}`);
if (!contentEngine.pass) blockers.push("Content Engine campaign validation failed");
if (!dashboard.pass) blockers.push("Campaign Content dashboard API validation failed");
if (!system.pm2Online) blockers.push("PM2 local-seo-engine not online");
if (!system.buildCurrent) blockers.push("API server build may be stale (dist older than source)");
if (system.activeRolloutJobs.length) blockers.push(`Active rollout jobs: ${system.activeRolloutJobs.length}`);

const pass = blockers.length === 0
  && serviceResults.every((r) => r.pass)
  && blogResults.every((r) => r.pass)
  && registrySitemap.pass
  && lifecycle.pass
  && contentEngine.pass
  && dashboard.pass
  && system.pass;

const recommendation = pass
  ? {
      verdict: "Proceed to Phase 1 Pharmacy Blueprint Build",
      rationale: "Hosting and Email Marketing service pages, Content Engine blog export, registry/sitemap parity, lifecycle artifacts, dashboard APIs, and system health all pass read-only validation. No phantom URLs or active rollout blockers detected.",
      note: lifecycle.gscDataGaps > 0
        ? `${lifecycle.gscDataGaps} newly deployed blog URL(s) await GSC lifecycle data — expected post-deploy without live GSC refresh; not a platform lock blocker.`
        : null,
    }
  : {
      verdict: "Additional platform stabilisation required before Pharmacy",
      rationale: blockers.join("; "),
      note: lifecycle.gscDataGaps > 0 && !lifecycle.structuralGaps
        ? `${lifecycle.gscDataGaps} URL(s) lack GSC inspection data only — structural lifecycle coverage is intact.`
        : null,
    };

const report = {
  reportType: "platform-lock-audit-before-pharmacy",
  verdict: pass
    ? "PASS: Platform Locked And Ready For Pharmacy"
    : "FAIL: Platform Requires Stabilisation",
  generatedAt: new Date().toISOString(),
  priorDeployVerdict: "PASS: Content Engine Blog Static Deploy V1 Complete",
  serviceStatus: {
    pass: serviceResults.every((r) => r.pass),
    pages: serviceResults,
  },
  blogStatus: {
    pass: blogResults.every((r) => r.pass),
    pages: blogResults,
  },
  registrySitemapStatus: registrySitemap,
  lifecycleStatus: {
    pass: lifecycle.pass,
    ...lifecycle,
    gscDataGapNote: lifecycle.gscDataGaps > 0
      ? "Expected for newly deployed blog URLs without live GSC refresh; not counted as structural lifecycle gap"
      : null,
  },
  contentEngineStatus: contentEngine,
  dashboardStatus: dashboard,
  systemStatus: system,
  blockers,
  recommendation,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log("\n" + report.verdict);
console.log(`Report: ${REPORT_PATH}`);
console.log(`Recommendation: ${recommendation.verdict}`);
process.exit(pass ? 0 : 1);
