#!/usr/bin/env node
/**
 * Rerun + deploy Rotherham Website Hosting and Email Marketing campaigns only.
 * Refreshes downstream SEO artifacts (no live GSC refresh).
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
const REPORT_PATH = path.join(PROJECT_DIR, "rotherham-hosting-email-pane-image-redeploy-report.json");

const CAMPAIGNS = [
  {
    id: "rotherham-webho-ting-5b9958",
    serviceKey: "web-hosting",
    type: "hosting",
  },
  {
    id: "rotherham-emailmarketing-266f98",
    serviceKey: "email-marketing",
    type: "email",
  },
];

const SAMPLE_PAGES = {
  hosting: [
    { slug: "web-hosting-rotherham", campaignId: "rotherham-webho-ting-5b9958", serviceKey: "web-hosting" },
    { slug: "web-hosting-rawmarsh", campaignId: "rotherham-webho-ting-5b9958", serviceKey: "web-hosting" },
    { slug: "web-hosting-wickersley", campaignId: "rotherham-webho-ting-5b9958", serviceKey: "web-hosting" },
  ],
  email: [
    { slug: "email-marketing-rotherham", campaignId: "rotherham-emailmarketing-266f98", serviceKey: "email-marketing" },
    { slug: "email-marketing-rawmarsh", campaignId: "rotherham-emailmarketing-266f98", serviceKey: "email-marketing" },
    { slug: "email-marketing-wickersley", campaignId: "rotherham-emailmarketing-266f98", serviceKey: "email-marketing" },
  ],
};

function readToken() {
  try {
    const dump = JSON.parse(fs.readFileSync("/root/.pm2/dump.pm2", "utf8"));
    const app = Array.isArray(dump) ? dump.find((a) => a.name === "local-seo-engine") : dump;
    if (app?.SESSION_SECRET) return app.SESSION_SECRET;
  } catch { /* fall through */ }
  return process.env.SESSION_SECRET ?? "dev-fallback-secret-change-in-prod";
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
    registryEqualsSitemap: (registry.pages?.length ?? 0) === sitemap.length,
    malformed: score?.componentScores?.technical?.metrics?.malformed ?? health?.summary?.malformed ?? null,
    duplicates: score?.componentScores?.technical?.metrics?.duplicates ?? health?.summary?.duplicates ?? null,
    lifecycleGaps: lifecycle?.summary?.missingLifecycleDataCount ?? null,
    seoHealthScore: score?.overallScore ?? null,
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
      },
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
  const deadline = Date.now() + 45 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(5000);
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
          areaDir: e.areaDir,
          step: e.step,
          tier: e.tier,
          error: e.error,
          smokeCheckPassed: e.smokeCheckPassed,
        })),
        succeededPages: succeeded.map((e) => ({
          area: e.area,
          areaDir: e.areaDir,
          tier: e.tier,
          smokeCheckPassed: e.smokeCheckPassed,
        })),
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

function headOk(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const u = new URL(url);
    const req = lib.request(
      { hostname: u.hostname, port: u.port || 443, path: u.pathname, method: "HEAD", timeout: 15000 },
      (res) => resolve(res.statusCode === 200),
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
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
  const slots = ["hero", "support", "trust"];
  const wrappers = { hero: "hero-media", support: "support-block-media", trust: "trust-block-media" };
  const out = {};
  for (const slot of slots) {
    const src = extractSlotSrc(body, wrappers[slot]);
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

async function validateSamplePage(page, type) {
  const url = `${DOMAIN}/${page.slug}/`;
  const res = await fetchUrl(url);
  const paneImages = res.body ? validatePaneImages(res.body, page.campaignId, page.serviceKey) : {};
  const checks = res.body && res.status === 200 ? {
    http200: true,
    hostingFeatures: type === "hosting" ? res.body.includes('id="hosting-features"') : true,
    emailWhyWorks: type === "email" ? res.body.includes('id="email-why-works"') : true,
    emailReviewCta: type === "email" ? res.body.includes('id="email-review-cta"') : true,
    noAiSummary: !res.body.includes('id="ai-summary-section"'),
    noWebDesignProcess: !res.body.includes("How The Web Design Process Works"),
    noHostingOnEmail: type === "email" ? !res.body.includes('id="hosting-features"') : true,
    noEmailOnHosting: type === "hosting" ? !res.body.includes('id="email-why-works"') : true,
    noConversionPlaceholder: !/<div[^>]*conversion-feature-image[^>]*v3-placeholder/i.test(res.body),
    canonical: new RegExp(`<link rel="canonical" href="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "i").test(res.body),
    schema: /application\/ld\+json/i.test(res.body),
    heroPane: paneImages.hero?.usesPanePath === true,
    supportPane: paneImages.support?.usesPanePath === true,
    trustPane: paneImages.trust?.usesPanePath === true,
    noLibraryHero: !paneImages.hero?.usesLibrary,
    noLibrarySupport: !paneImages.support?.usesLibrary,
    noLibraryTrust: !paneImages.trust?.usesLibrary,
  } : { http200: false };

  const pass = res.status === 200 && Object.values(checks).every(Boolean);
  return { url, slug: page.slug, campaignId: page.campaignId, status: res.status, pass, checks, paneImages, error: res.error };
}

async function confirmPaneAssets() {
  const assets = [
    { campaignId: "rotherham-webho-ting-5b9958", serviceKey: "web-hosting", slot: "hero" },
    { campaignId: "rotherham-webho-ting-5b9958", serviceKey: "web-hosting", slot: "support" },
    { campaignId: "rotherham-webho-ting-5b9958", serviceKey: "web-hosting", slot: "trust" },
    { campaignId: "rotherham-emailmarketing-266f98", serviceKey: "email-marketing", slot: "hero" },
    { campaignId: "rotherham-emailmarketing-266f98", serviceKey: "email-marketing", slot: "support" },
    { campaignId: "rotherham-emailmarketing-266f98", serviceKey: "email-marketing", slot: "trust" },
  ];
  const results = [];
  for (const a of assets) {
    const localPath = path.join(ROOT, "output", a.campaignId, "assets", a.serviceKey, `${a.slot}.webp`);
    const url = `${DOMAIN}/assets/${a.campaignId}/${a.serviceKey}/${a.slot}.webp`;
    results.push({
      ...a,
      localExists: fs.existsSync(localPath),
      liveHttp200: await headOk(url),
      url,
    });
  }
  return results;
}

function refreshArtifacts() {
  const tmp = path.join(ROOT, "scripts", ".tmp-rotherham-pane-refresh.ts");
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
`,
  );
  const r = spawnSync("pnpm", ["exec", "tsx", tmp], { cwd: ROOT, encoding: "utf8", timeout: 12 * 60 * 1000 });
  try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  return { ok: r.status === 0, stdout: r.stdout?.slice(-300), stderr: r.stderr?.slice(-800) };
}

console.log("=== Rotherham Hosting + Email Pane Image Redeploy ===\n");

const baseline = snapshotMetrics();
console.log("Baseline:", baseline);

console.log("\nConfirming pane assets...");
const paneAssetCheck = await confirmPaneAssets();
const paneAssetsOk = paneAssetCheck.every((a) => a.localExists && a.liveHttp200);
console.log(paneAssetsOk ? "Pane assets OK" : "Pane asset check FAILED");

const rolloutResults = [];
for (const c of CAMPAIGNS) {
  console.log(`\nRolling out ${c.id}...`);
  const result = await runCampaignRollout(c.id);
  console.log(`  ${result.ok ? "OK" : "FAIL"}: ${result.pagesSucceeded ?? 0}/${result.pagesRegenerated ?? 0} pages`);
  rolloutResults.push({ ...result, type: c.type, serviceKey: c.serviceKey });
}

console.log("\nValidating live sample pages...");
const hostingSampleValidation = [];
for (const p of SAMPLE_PAGES.hosting) {
  const v = await validateSamplePage(p, "hosting");
  hostingSampleValidation.push(v);
  console.log(`  ${v.pass ? "PASS" : "FAIL"} ${p.slug}`);
}
const emailSampleValidation = [];
for (const p of SAMPLE_PAGES.email) {
  const v = await validateSamplePage(p, "email");
  emailSampleValidation.push(v);
  console.log(`  ${v.pass ? "PASS" : "FAIL"} ${p.slug}`);
}

console.log("\nRefreshing downstream artifacts (no GSC)...");
const artifactRefresh = refreshArtifacts();
console.log(artifactRefresh.ok ? "Artifacts refreshed" : "Artifact refresh FAILED");

const after = snapshotMetrics();
console.log("After:", after);

const pagesRegenerated = rolloutResults.reduce((n, r) => n + (r.pagesRegenerated ?? 0), 0);
const pagesDeployed = rolloutResults.reduce((n, r) => n + (r.pagesSucceeded ?? 0), 0);
const pagesFailed = rolloutResults.reduce((n, r) => n + (r.pagesFailed ?? 0), 0);
const failedPages = rolloutResults.flatMap((r) => (r.failedPages ?? []).map((p) => ({ ...p, campaignId: r.campaignId })));
const allSmokePassed = rolloutResults.every((r) =>
  (r.succeededPages ?? []).every((p) => p.smokeCheckPassed !== false),
);

const samplePass = [...hostingSampleValidation, ...emailSampleValidation].every((v) => v.pass);
const rolloutsPass = rolloutResults.every((r) => r.ok);
const platformPass =
  after.registryCount === 169 &&
  after.sitemapCount === 169 &&
  after.registryEqualsSitemap &&
  (after.malformed ?? 0) === 0 &&
  (after.duplicates ?? 0) === 0 &&
  (after.lifecycleGaps ?? 0) === 0;

const verdict =
  paneAssetsOk && rolloutsPass && pagesFailed === 0 && allSmokePassed && samplePass && platformPass && artifactRefresh.ok
    ? "PASS: Rotherham Hosting and Email Pane Image Redeploy Complete"
    : "FAIL: Pane Image Redeploy Requires Investigation";

const report = {
  verdict,
  timestamp: new Date().toISOString(),
  campaigns: CAMPAIGNS.map((c) => c.id),
  paneAssetCheck,
  baseline,
  after,
  rolloutResults,
  pagesRegenerated,
  pagesDeployed,
  pagesFailed,
  failedPages,
  allSmokeChecksPassed: allSmokePassed,
  liveSampleValidation: {
    hosting: hostingSampleValidation,
    email: emailSampleValidation,
  },
  paneImageValidation: {
    allSamplesUsePanePaths: samplePass,
    samples: [...hostingSampleValidation, ...emailSampleValidation].map((v) => ({
      slug: v.slug,
      pass: v.pass,
      paneImages: v.paneImages,
    })),
  },
  registrySitemapImpact: {
    registryCountBefore: baseline.registryCount,
    registryCountAfter: after.registryCount,
    sitemapCountBefore: baseline.sitemapCount,
    sitemapCountAfter: after.sitemapCount,
    registryEqualsSitemap: after.registryEqualsSitemap,
    malformed: after.malformed,
    duplicates: after.duplicates,
    lifecycleGaps: after.lifecycleGaps,
    unchanged: baseline.registryCount === after.registryCount && baseline.sitemapCount === after.sitemapCount,
  },
  artifactRefresh,
  gscRefreshRun: false,
  remainingRolloutBlockers: [
    ...failedPages.map((p) => `${p.campaignId}/${p.area ?? p.areaDir}: ${p.error ?? p.step}`),
    ...hostingSampleValidation.filter((v) => !v.pass).map((v) => `hosting sample fail: ${v.slug}`),
    ...emailSampleValidation.filter((v) => !v.pass).map((v) => `email sample fail: ${v.slug}`),
    ...(after.registryCount !== 169 ? [`registryCount=${after.registryCount}`] : []),
    ...(after.sitemapCount !== 169 ? [`sitemapCount=${after.sitemapCount}`] : []),
    ...(!artifactRefresh.ok ? ["artifact refresh failed"] : []),
  ].filter(Boolean),
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`\n${verdict}`);
console.log(`Report: ${REPORT_PATH}`);
process.exit(verdict.startsWith("PASS") ? 0 : 1);
