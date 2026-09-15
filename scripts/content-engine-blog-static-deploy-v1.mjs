#!/usr/bin/env node
/**
 * Content Engine Blog Static Deploy V1 — registry/sitemap update + targeted FTP deploy.
 */
import ftp from "basic-ftp";
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
const BLOG_DIR = path.join(PROJECT_DIR, "blog");
const DOMAIN = "https://local.inboxingproweb.com";
const CAMPAIGN_ID = "rotherham-webho-ting-5b9958";
const REPORT_PATH = path.join(PROJECT_DIR, "content-engine-blog-static-deploy-v1-report.json");

const PHANTOM_URLS = [
  "https://local.inboxingproweb.com/google-business-profile-thurcroft/",
  "https://local.inboxingproweb.com/google-business-profile-wickersley/",
  "https://local.inboxingproweb.com/local-business-visibility-ecclesall/",
  "https://local.inboxingproweb.com/local-business-visibility-wickersley/",
];

const NEW_BLOG_SLUGS = [
  "reliable-web-hosting-for-rotherham-businesses",
  "signs-your-rotherham-business-needs-better-hosting",
  "uk-hosting-vs-cheap-shared-hosting-rotherham",
  "how-web-hosting-supports-local-seo-rotherham",
];

const LIVE_BLOG_URLS = [
  `${DOMAIN}/blog/`,
  ...NEW_BLOG_SLUGS.map((s) => `${DOMAIN}/blog/${s}/`),
];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

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

function sitemapUrlsFromXml(file) {
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => normaliseUrl(m[1]));
}

function buildUrlsetXml(locs) {
  const body = locs
    .map(({ loc, priority }) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function snapshotCounts() {
  const registry = readJson(path.join(PROJECT_DIR, "page-registry.json"));
  const sitemap = sitemapUrlsFromXml(path.join(PROJECT_DIR, "sitemap.xml"));
  const blogUrls = (registry.pages ?? []).filter((p) => (p.url ?? "").includes("/blog/"));
  const phantomInRegistry = (registry.pages ?? []).filter((p) => PHANTOM_URLS.includes(normaliseUrl(p.url))).length;
  const phantomInSitemap = sitemap.filter((u) => PHANTOM_URLS.includes(u)).length;
  return {
    registryCount: registry.pages?.length ?? 0,
    sitemapCount: sitemap.length,
    blogUrlCount: blogUrls.length,
    phantomInRegistry,
    phantomInSitemap,
    registryEqualsSitemap: (registry.pages?.length ?? 0) === sitemap.length,
  };
}

function pm2DeployEnv() {
  const r = spawnSync("pm2", ["jlist"], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("pm2 jlist failed");
  const apps = JSON.parse(r.stdout);
  const app = apps.find((a) => a.name === "local-seo-engine");
  const env = app?.pm2_env ?? {};
  const user = env.DEPLOY_USERNAME;
  const password = env.DEPLOY_PASSWORD;
  if (!user || !password) throw new Error("DEPLOY_USERNAME/DEPLOY_PASSWORD not in PM2 env");
  return { user, password };
}

async function ftpUpload(files) {
  const { user, password } = pm2DeployEnv();
  const client = new ftp.Client(60000);
  const uploaded = [];
  try {
    await client.access({
      host: "ftp.inboxingproweb.com",
      port: 21,
      user,
      password,
      secure: true,
      secureOptions: { rejectUnauthorized: false },
    });
    for (const { local, remote } of files) {
      const remoteDir = path.posix.dirname(remote);
      if (remoteDir && remoteDir !== ".") {
        await client.ensureDir(remoteDir);
      }
      await client.uploadFrom(local, remote);
      uploaded.push({ local, remote });
    }
  } finally {
    client.close();
  }
  return uploaded;
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

function existsLocalHref(href) {
  if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return true;
  const slug = href.replace(/^\/|\/$/g, "");
  if (["uk-website-hosting", "local-seo-services", "custom-website-design", "email-marketing-3", "our-services"].includes(slug)) return true;
  return fs.existsSync(path.join(PROJECT_DIR, slug, "index.html"))
    || fs.existsSync(path.join(BLOG_DIR, slug, "index.html"));
}

function sitemapUrlsFromXmlFromString(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => normaliseUrl(m[1]));
}

function auditLiveBlogPage(url, body, status) {
  const issues = [];
  if (status !== 200) issues.push(`http-${status}`);
  const title = body.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
  const h1 = body.match(/<h1>([^<]+)<\/h1>/i)?.[1] ?? "";
  const articleSchema = /"@type"\s*:\s*"BlogPosting"/.test(body);
  const faqSchema = /"@type"\s*:\s*"FAQPage"/.test(body);
  const cta = body.includes('class="cta"');
  const internalLinks = body.includes('class="link-panel"') || /<main[\s\S]*<a\b/i.test(body);
  const tokens = body.match(/\{\{[A-Z_]+\}\}/g) ?? [];
  const broken = [];
  let m;
  const re = /<a\b[^>]*href=["']([^"']+)["']/gi;
  while ((m = re.exec(body))) {
    if (!existsLocalHref(m[1])) broken.push(m[1]);
  }
  if (!title) issues.push("missing-title");
  if (!h1) issues.push("missing-h1");
  const isHub = url.endsWith("/blog/");
  if (!articleSchema && !isHub) issues.push("missing-article-schema");
  if (!faqSchema && !isHub) issues.push("missing-faq-schema");
  if (!cta && !isHub) issues.push("missing-cta");
  if (!internalLinks) issues.push("missing-internal-links");
  if (tokens.length) issues.push("unreplaced-tokens");
  if (broken.length) issues.push(`broken-links:${broken.join(",")}`);
  return { url, status, title, h1, articleSchema, faqSchema, cta, internalLinks, brokenLinks: broken, tokens, issues, pass: issues.length === 0 };
}

function refreshArtifacts() {
  const tmp = path.join(ROOT, "scripts", ".tmp-blog-deploy-artifacts.ts");
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
  return { ok: r.status === 0, stdout: r.stdout?.slice(-400), stderr: r.stderr?.slice(-800) };
}

function loadBlogEntry(slug) {
  const assetPath = path.join(BLOG_DIR, slug, "content-engine-asset.json");
  const payload = readJson(assetPath).payload;
  const now = new Date().toISOString();
  return {
    url: `${DOMAIN}/blog/${slug}/`,
    slug: `blog/${slug}`,
    remotePath: `/blog/${slug}/`,
    label: payload.title,
    type: "supporting",
    status: "live",
    includedInSitemap: true,
    priority: 0.6,
    source: "content-engine-blog-export",
    campaignId: CAMPAIGN_ID,
    service: "web-hosting",
    city: "Rotherham",
    contentType: "blog_post",
    deployed: true,
    lastDeployedAt: now,
    lastSeenAt: now,
  };
}

console.log("=== Content Engine Blog Static Deploy V1 ===\n");

const baseline = snapshotCounts();
console.log("Baseline:", baseline);

// Backup registry
const registryPath = path.join(PROJECT_DIR, "page-registry.json");
fs.copyFileSync(registryPath, path.join(PROJECT_DIR, "page-registry.pre-blog-deploy-v1.json"));

// Add 4 blog entries
const registry = readJson(registryPath);
const existingUrls = new Set((registry.pages ?? []).map((p) => normaliseUrl(p.url)));
const newEntries = NEW_BLOG_SLUGS.map(loadBlogEntry).filter((e) => !existingUrls.has(normaliseUrl(e.url)));
registry.pages = [...(registry.pages ?? []), ...newEntries];
registry.updatedAt = new Date().toISOString();
writeJson(registryPath, registry);

// Rebuild sitemap from registry
const masterLocs = registry.pages
  .filter((p) => p.status !== "archived" && p.includedInSitemap !== false)
  .map((p) => {
    const priority = typeof p.priority === "number"
      ? p.priority
      : p.type === "hub" ? 1.0 : p.type === "supporting" ? 0.6 : 0.8;
    return { loc: normaliseUrl(p.url), priority };
  })
  .sort((a, b) => b.priority - a.priority || a.loc.localeCompare(b.loc));

fs.writeFileSync(path.join(PROJECT_DIR, "sitemap.xml"), buildUrlsetXml(masterLocs), "utf8");

const afterRegistry = snapshotCounts();
console.log("After registry/sitemap update:", afterRegistry);

// FTP deploy
const deployFiles = [
  { local: path.join(BLOG_DIR, "index.html"), remote: "/blog/index.html" },
  { local: path.join(PROJECT_DIR, "sitemap.xml"), remote: "/sitemap.xml" },
  ...NEW_BLOG_SLUGS.map((slug) => ({
    local: path.join(BLOG_DIR, slug, "index.html"),
    remote: `/blog/${slug}/index.html`,
  })),
];

let uploaded = [];
let deployError = null;
try {
  uploaded = await ftpUpload(deployFiles);
  console.log(`FTP uploaded ${uploaded.length} files`);
} catch (err) {
  deployError = err instanceof Error ? err.message : String(err);
  console.error("FTP deploy failed:", deployError);
}

console.log("\nRefreshing downstream artifacts (no GSC)...");
const artifactRefresh = refreshArtifacts();
console.log(artifactRefresh.ok ? "Artifacts refreshed" : "Artifact refresh FAILED");

console.log("\nValidating live blog URLs...");
const liveValidation = [];
for (const url of LIVE_BLOG_URLS) {
  const res = await fetchUrl(url);
  const audit = auditLiveBlogPage(url, res.body, res.status);
  liveValidation.push(audit);
  console.log(`  ${audit.pass ? "PASS" : "FAIL"} ${url} (${res.status})`);
}

console.log("\nValidating live sitemap...");
const sitemapRes = await fetchUrl(`${DOMAIN}/sitemap.xml`);
const liveSitemapUrls = sitemapRes.body ? sitemapUrlsFromXmlFromString(sitemapRes.body) : [];

const malformed = liveSitemapUrls.filter((u) => !/^https:\/\/local\.inboxingproweb\.com\/.+\/$/.test(u));
const dupes = liveSitemapUrls.filter((u, i) => liveSitemapUrls.indexOf(u) !== i);
const phantomInLiveSitemap = liveSitemapUrls.filter((u) => PHANTOM_URLS.includes(u));
const newInLiveSitemap = NEW_BLOG_SLUGS.map((s) => `${DOMAIN}/blog/${s}/`).filter((u) => liveSitemapUrls.includes(normaliseUrl(u)));

const liveSitemapValidation = {
  httpStatus: sitemapRes.status,
  count: liveSitemapUrls.length,
  expectedCount: 173,
  includesNewBlogUrls: newInLiveSitemap.length === 4,
  newBlogUrlsFound: newInLiveSitemap,
  phantomExcluded: phantomInLiveSitemap.length === 0,
  phantomFound: phantomInLiveSitemap,
  malformedCount: malformed.length,
  duplicateCount: dupes.length,
  pass: sitemapRes.status === 200
    && liveSitemapUrls.length === 173
    && newInLiveSitemap.length === 4
    && phantomInLiveSitemap.length === 0
    && malformed.length === 0
    && dupes.length === 0,
};

console.log("Live sitemap:", liveSitemapValidation);

const finalCounts = snapshotCounts();
const hubPass = liveValidation.find((v) => v.url === `${DOMAIN}/blog/`)?.pass ?? false;
const newPostsPass = liveValidation.filter((v) => NEW_BLOG_SLUGS.some((s) => v.url.includes(s))).every((v) => v.pass);
const pass = !deployError
  && uploaded.length === deployFiles.length
  && afterRegistry.registryCount === 173
  && afterRegistry.sitemapCount === 173
  && afterRegistry.registryEqualsSitemap
  && afterRegistry.phantomInSitemap === 0
  && afterRegistry.phantomInRegistry === 0
  && artifactRefresh.ok
  && hubPass
  && newPostsPass
  && liveSitemapValidation.pass;

const report = {
  reportType: "content-engine-blog-static-deploy-v1",
  verdict: pass
    ? "PASS: Content Engine Blog Static Deploy V1 Complete"
    : "FAIL: Blog Static Deploy Requires Investigation",
  generatedAt: new Date().toISOString(),
  baseline,
  afterUpdate: afterRegistry,
  final: finalCounts,
  registryCountBefore: baseline.registryCount,
  registryCountAfter: finalCounts.registryCount,
  sitemapCountBefore: baseline.sitemapCount,
  sitemapCountAfter: finalCounts.sitemapCount,
  urlsAdded: newEntries.map((e) => e.url),
  filesDeployed: uploaded,
  deployError,
  liveValidation,
  liveSitemapValidation,
  phantomUrlStatus: {
    phantomUrls: PHANTOM_URLS,
    inRegistry: finalCounts.phantomInRegistry,
    inLocalSitemap: finalCounts.phantomInSitemap,
    inLiveSitemap: phantomInLiveSitemap.length,
    excluded: finalCounts.phantomInRegistry === 0 && finalCounts.phantomInSitemap === 0 && phantomInLiveSitemap.length === 0,
  },
  downstreamArtifactsRefreshed: artifactRefresh.ok
    ? [
        "url-lifecycle.json",
        "url-health-audit.json",
        "index-dashboard.json",
        "seo-opportunities.json",
        "seo-health-score.json",
        "full-page-audit.json",
        "dashboard-seo-intelligence-contract.json",
      ]
    : [],
  artifactRefresh,
  remainingBlockers: pass
    ? []
    : [
        ...(deployError ? [`FTP deploy: ${deployError}`] : []),
        ...(uploaded.length !== deployFiles.length ? ["Incomplete FTP upload"] : []),
        ...(afterRegistry.registryCount !== 173 ? [`Registry count ${afterRegistry.registryCount} !== 173`] : []),
        ...(afterRegistry.sitemapCount !== 173 ? [`Sitemap count ${afterRegistry.sitemapCount} !== 173`] : []),
        ...(afterRegistry.phantomInSitemap > 0 ? ["Phantom URLs still in local sitemap"] : []),
        ...(!artifactRefresh.ok ? ["Downstream artifact refresh failed"] : []),
        ...(!hubPass ? ["Live /blog/ validation failed"] : []),
        ...(!newPostsPass ? ["One or more live blog posts failed validation"] : []),
        ...(!liveSitemapValidation.pass ? ["Live sitemap validation failed"] : []),
      ],
  safeToDeploy: pass,
};

writeJson(REPORT_PATH, report);
console.log("\n" + report.verdict);
console.log(`Report: ${REPORT_PATH}`);
process.exit(pass ? 0 : 1);
