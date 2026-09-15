#!/usr/bin/env node
/**
 * Controlled rollout: Website Hosting + Email Marketing campaigns only.
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
const REPORT_PATH = path.join(PROJECT_DIR, "hosting-email-controlled-rollout-report.json");

const HOSTING_CAMPAIGNS = [
  "rotherham-webho-ting-5b9958",
  "sheffield-webho-ting-078586",
  "barnsley-webho-ting-9ccc34",
  "donca-ter-webho-ting-d723be",
];

const EMAIL_CAMPAIGNS = [
  "rotherham-emailmarketing-266f98",
  "heffield-emailmarketing-c7b947",
  "barn-ley-emailmarketing-8fe587",
  "donca-ter-emailmarketing-6106f4",
];

function readToken() {
  const dump = JSON.parse(fs.readFileSync("/root/.pm2/dump.pm2", "utf8"));
  const app = Array.isArray(dump) ? dump.find((a) => a.name === "local-seo-engine") : dump;
  return app?.SESSION_SECRET ?? "dev-fallback-secret-change-in-prod";
}

const TOKEN = readToken();

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function sitemapUrls() {
  const p = path.join(PROJECT_DIR, "sitemap.xml");
  if (!fs.existsSync(p)) return [];
  const xml = fs.readFileSync(p, "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/\/+$/, "") + "/");
}

function snapshotMetrics() {
  const registry = readJson(path.join(PROJECT_DIR, "page-registry.json"));
  const sitemap = sitemapUrls();
  const score = fs.existsSync(path.join(PROJECT_DIR, "seo-health-score.json"))
    ? readJson(path.join(PROJECT_DIR, "seo-health-score.json"))
    : null;
  const lifecycle = fs.existsSync(path.join(PROJECT_DIR, "url-lifecycle.json"))
    ? readJson(path.join(PROJECT_DIR, "url-lifecycle.json"))
    : null;
  const health = fs.existsSync(path.join(PROJECT_DIR, "url-health-audit.json"))
    ? readJson(path.join(PROJECT_DIR, "url-health-audit.json"))
    : null;

  return {
    registryCount: registry.pages?.length ?? 0,
    sitemapCount: sitemap.length,
    seoHealthScore: score?.overallScore ?? null,
    indexed: score?.componentScores?.indexing?.metrics?.indexed
      ?? lifecycle?.summary?.indexedCount
      ?? health?.summary?.indexed
      ?? null,
    notIndexed: score?.componentScores?.indexing?.metrics?.notIndexed
      ?? health?.summary?.notIndexed
      ?? null,
    lifecycleGaps: lifecycle?.summary?.missingLifecycleDataCount ?? null,
    malformed: score?.componentScores?.technical?.metrics?.malformed ?? health?.summary?.malformed ?? null,
    duplicates: score?.componentScores?.technical?.metrics?.duplicates ?? health?.summary?.duplicates ?? null,
    registryEqualsSitemap: (registry.pages?.length ?? 0) === sitemap.length,
  };
}

function apiRequest(method, urlPath, body) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path: urlPath,
        method,
        headers: {
          Accept: "application/json",
          "X-Internal-Token": TOKEN,
          ...(payload
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
            : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = { raw: data.slice(0, 500) }; }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runCampaignRollout(campaignId) {
  const start = await apiRequest("POST", "/api/rollout", {
    clientSlug: PROJECT,
    campaignId,
  });
  if (start.status !== 200 || !start.body?.jobId) {
    return { campaignId, ok: false, error: start.body?.error ?? `HTTP ${start.status}`, pages: [] };
  }

  const jobId = start.body.jobId;
  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(4000);
    const poll = await apiRequest("GET", `/api/rollout/status/${jobId}`);
    const status = poll.body?.status ?? "unknown";
    if (status === "done") {
      const events = poll.body?.events ?? [];
      const pageEvents = events.filter((e) => e.type === "page");
      const failed = pageEvents.filter((e) => e.status === "failed");
      const succeeded = pageEvents.filter((e) => e.status === "success");
      return {
        campaignId,
        ok: failed.length === 0,
        jobId,
        pagesRegenerated: pageEvents.length,
        pagesSucceeded: succeeded.length,
        pagesFailed: failed.length,
        failedPages: failed.map((e) => ({
          area: e.area,
          step: e.step,
          tier: e.tier,
        })),
        succeededPages: succeeded.map((e) => e.area),
      };
    }
    if (status === "error" || status === "cancelled") {
      return { campaignId, ok: false, error: poll.body?.error ?? status, jobId };
    }
  }
  return { campaignId, ok: false, error: "timeout", jobId };
}

function fetchUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, { method: "GET", timeout: 20000 }, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", (err) => resolve({ status: 0, error: String(err.message || err), body: "" }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, error: "timeout", body: "" }); });
    req.end();
  });
}

function validateHostingHtml(body) {
  return {
    hostingFeatures: body.includes('id="hosting-features"'),
    noAiSummary: !body.includes('id="ai-summary-section"'),
    noWebDesignProcess: !body.includes("How The Web Design Process Works"),
    noConversionPlaceholder: !/conversion-feature-image|id="conversion/i.test(body),
    heroImg: /<img[^>]+(?:serve\/inboxingproweb\/hero|hero-v1)/i.test(body),
    supportImg: /<img[^>]+(?:serve\/inboxingproweb\/support|support-v1|support-block-media)/i.test(body),
    trustImg: /<img[^>]+(?:serve\/inboxingproweb\/trust|trust-v1)/i.test(body),
    canonical: /<link rel="canonical" href="https:\/\/local\.inboxingproweb\.com\/[^"]+"/i.test(body),
    schema: /application\/ld\+json/i.test(body),
  };
}

function validateEmailHtml(body) {
  return {
    emailWhyWorks: body.includes('id="email-why-works"'),
    emailReviewCta: body.includes('id="email-review-cta"'),
    noAiSummary: !body.includes('id="ai-summary-section"'),
    noHostingFeatures: !body.includes('id="hosting-features"'),
    noWebDesignProcess: !body.includes("How The Web Design Process Works"),
    noConversionPlaceholder: !/conversion-feature-image|id="conversion/i.test(body),
    heroImg: /<img[^>]+(?:hero-v1|serve\/inboxingproweb\/hero)/i.test(body),
    supportImg: /<img[^>]+(?:support-v1|support-block-media|serve\/inboxingproweb\/support)/i.test(body),
    trustImg: /<img[^>]+(?:trust-v1|serve\/inboxingproweb\/trust)/i.test(body),
    canonical: /<link rel="canonical" href="https:\/\/local\.inboxingproweb\.com\/[^"]+"/i.test(body),
    schema: /application\/ld\+json/i.test(body),
  };
}

async function validateLiveUrls(urls, type) {
  const results = [];
  for (const url of urls) {
    const res = await fetchUrl(url);
    const checks = res.body && res.status === 200
      ? (type === "hosting" ? validateHostingHtml(res.body) : validateEmailHtml(res.body))
      : null;
    const pass = res.status === 200 && checks && Object.values(checks).every(Boolean);
    results.push({ url, status: res.status, pass, checks, error: res.error });
  }
  return results;
}

async function countRegistry404() {
  const registry = readJson(path.join(PROJECT_DIR, "page-registry.json"));
  let count404 = 0;
  let checked = 0;
  for (const page of registry.pages ?? []) {
    const res = await fetchUrl(page.url);
    checked++;
    if (res.status === 404) count404++;
    if (checked % 25 === 0) process.stderr.write(`registry404 check ${checked}/${registry.pages.length}\n`);
  }
  return { registry404Count: count404, registryChecked: checked };
}

async function countSitemap404() {
  const urls = sitemapUrls();
  let count404 = 0;
  for (const url of urls) {
    const res = await fetchUrl(url);
    if (res.status === 404) count404++;
  }
  return { sitemap404Count: count404, sitemapChecked: urls.length };
}

function refreshArtifacts() {
  const tmp = path.join(ROOT, "scripts", ".tmp-refresh-artifacts.ts");
  fs.writeFileSync(
    tmp,
    `import { buildUrlLifecycle } from "../src/indexing/urlLifecycleEngine";
import { buildUrlHealthAudit } from "../src/indexing/urlHealthAuditEngine";
import { buildIndexDashboard } from "../src/indexing/indexDashboardEngine";
import { buildSeoOpportunities } from "../src/indexing/seoOpportunityEngine";
import { buildSeoHealthScore } from "../src/indexing/seoHealthScoreEngine";
import { buildFullPageAudit } from "../src/indexing/fullPageAuditEngine";
import { syncDashboardSeoIntelligenceContract } from "../src/indexing/syncDashboardSeoIntelligenceContract";

const projectSlug = "${PROJECT}";
const outputDir = "output";
await buildUrlLifecycle(projectSlug, { outputDir, refreshSearchAnalytics: false });
buildUrlHealthAudit(projectSlug, { outputDir });
buildIndexDashboard(projectSlug, { outputDir });
buildSeoOpportunities(projectSlug, { outputDir });
buildSeoHealthScore(projectSlug, { outputDir });
buildFullPageAudit(projectSlug, { outputDir });
syncDashboardSeoIntelligenceContract(projectSlug, outputDir);
console.log("artifacts-refreshed");
`
  );
  const r = spawnSync("pnpm", ["exec", "tsx", tmp], { cwd: ROOT, encoding: "utf8", timeout: 10 * 60 * 1000 });
  try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  return { ok: r.status === 0, stdout: r.stdout?.slice(-200), stderr: r.stderr?.slice(-500) };
}

async function runGscRefresh() {
  const start = await apiRequest("POST", "/api/dashboard-seo-intelligence/live-refresh", {
    projectSlug: PROJECT,
  });
  if (start.status !== 200 || !start.body?.jobId) {
    return { ok: false, error: start.body?.error ?? `HTTP ${start.status}` };
  }
  const jobId = start.body.jobId;
  const deadline = Date.now() + 16 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(5000);
    const poll = await apiRequest("GET", `/api/dashboard-seo-intelligence/live-refresh/${jobId}`);
    if (poll.body?.status === "done") {
      return { ok: true, result: poll.body?.result ?? poll.body };
    }
    if (poll.body?.status === "error") {
      return { ok: false, error: poll.body?.error ?? poll.body?.result?.error ?? "GSC refresh error" };
    }
  }
  return { ok: false, error: "GSC refresh timeout" };
}

const HOSTING_LIVE = [
  `${DOMAIN}/web-hosting-rotherham/`,
  `${DOMAIN}/web-hosting-sheffield/`,
  `${DOMAIN}/web-hosting-barnsley/`,
  `${DOMAIN}/web-hosting-doncaster/`,
  `${DOMAIN}/web-hosting-aston/`,
  `${DOMAIN}/web-hosting-bramley/`,
  `${DOMAIN}/web-hosting-wickersley/`,
];

const EMAIL_LIVE = [
  `${DOMAIN}/email-marketing-rotherham/`,
  `${DOMAIN}/email-marketing-sheffield/`,
  `${DOMAIN}/email-marketing-barnsley/`,
  `${DOMAIN}/email-marketing-doncaster/`,
  `${DOMAIN}/email-marketing-aston/`,
  `${DOMAIN}/email-marketing-bramley/`,
  `${DOMAIN}/email-marketing-wickersley/`,
];

console.log("Recording baseline...");
const baseline = snapshotMetrics();
const registry404Baseline = { skipped: true, note: "Full registry HTTP sweep deferred to post-rollout validation" };

console.log("Rolling out Website Hosting campaigns...");
const hostingResults = [];
for (const id of HOSTING_CAMPAIGNS) {
  console.log(`  hosting campaign: ${id}`);
  hostingResults.push(await runCampaignRollout(id));
}

console.log("Rolling out Email Marketing campaigns...");
const emailResults = [];
for (const id of EMAIL_CAMPAIGNS) {
  console.log(`  email campaign: ${id}`);
  emailResults.push(await runCampaignRollout(id));
}

const allRollouts = [...hostingResults, ...emailResults];
const pagesRegenerated = allRollouts.reduce((n, r) => n + (r.pagesRegenerated ?? 0), 0);
const pagesSucceeded = allRollouts.reduce((n, r) => n + (r.pagesSucceeded ?? 0), 0);
const pagesFailed = allRollouts.reduce((n, r) => n + (r.pagesFailed ?? 0), 0);
const failedPages = allRollouts.flatMap((r) => (r.failedPages ?? []).map((p) => ({ ...p, campaignId: r.campaignId })));

console.log("Validating live Hosting URLs...");
const hostingLiveValidation = await validateLiveUrls(HOSTING_LIVE, "hosting");

console.log("Validating live Email URLs...");
const emailLiveValidation = await validateLiveUrls(EMAIL_LIVE, "email");

console.log("Refreshing downstream artifacts...");
const artifactRefresh = refreshArtifacts();

console.log("Running live GSC refresh...");
const gscRefresh = await runGscRefresh();

console.log("Recording after metrics...");
const after = snapshotMetrics();
const registry404After = await countRegistry404();
const sitemap404After = await countSitemap404();

const hostingLivePass = hostingLiveValidation.every((r) => r.pass);
const emailLivePass = emailLiveValidation.every((r) => r.pass);
const rolloutsPass = allRollouts.every((r) => r.ok);
const postValidationPass =
  after.registryEqualsSitemap &&
  (after.malformed ?? 0) === 0 &&
  (after.duplicates ?? 0) === 0 &&
  (after.lifecycleGaps ?? 0) === 0;

const verdict =
  rolloutsPass && hostingLivePass && emailLivePass && pagesFailed === 0
    ? "PASS: Hosting and Email Marketing Controlled Rollout Complete"
    : "FAIL: Controlled Rollout Requires Investigation";

const report = {
  verdict,
  timestamp: new Date().toISOString(),
  baseline: { ...baseline, registry404: registry404Baseline },
  after: { ...after, registry404: registry404After, sitemap404: sitemap404After },
  seoHealthScoreBefore: baseline.seoHealthScore,
  seoHealthScoreAfter: after.seoHealthScore,
  campaigns: {
    hosting: hostingResults,
    email: emailResults,
  },
  pagesRegenerated,
  pagesDeployed: pagesSucceeded,
  pagesFailed,
  failedPages,
  liveHostingValidation: hostingLiveValidation,
  liveEmailValidation: emailLiveValidation,
  artifactRefresh,
  gscRefresh,
  remainingBlockers: [
    ...failedPages.map((p) => `${p.campaignId}/${p.area}: ${p.step}`),
    ...hostingLiveValidation.filter((r) => !r.pass).map((r) => `hosting live fail: ${r.url}`),
    ...emailLiveValidation.filter((r) => !r.pass).map((r) => `email live fail: ${r.url}`),
    ...(registry404After.registry404Count > 0 ? [`registry404=${registry404After.registry404Count}`] : []),
    ...(sitemap404After.sitemap404Count > 0 ? [`sitemap404=${sitemap404After.sitemap404Count}`] : []),
  ].filter(Boolean),
  postValidationPass,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ verdict, pagesRegenerated, pagesSucceeded, pagesFailed, reportPath: REPORT_PATH }, null, 2));
process.exit(verdict.startsWith("PASS") ? 0 : 1);
