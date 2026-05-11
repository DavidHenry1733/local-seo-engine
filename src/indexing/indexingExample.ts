/**
 * Indexing & Sitemap Engine — example usage & rollout integration
 *
 * Run:  pnpm exec tsx src/indexing/indexingExample.ts
 *
 * ─── Rollout integration notes ───────────────────────────────────────────────
 *
 * 1. Call runIndexingEngine() AFTER all page QA/validation passes.
 * 2. Include report.sitemapUrl and report.robotsUrl in your rollout proof log.
 * 3. If project.deploy.enabled = true, call deployIndexingFiles() so both
 *    files land at the subdomain root alongside the generated pages.
 * 4. Submit the sitemapUrl to Google Search Console manually:
 *    Search Console → <property> → Sitemaps → Add a new sitemap.
 *
 * ─── Google Indexing API — do NOT use for these pages ────────────────────────
 *    The Google Indexing API is intended exclusively for pages containing
 *    JobPosting or BroadcastEvent (livestream) schema markup.
 *    Submitting standard service/location pages to that API violates Google's
 *    usage policy and will not accelerate crawling. Use sitemap submission via
 *    Search Console instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from "node:fs";
import {
  runIndexingEngine,
  deployIndexingFiles,
  validateSitemap,
} from "./sitemapEngine";
import type { IndexingEngineInput } from "./indexingTypes";

// ─── Example: Rotherham proof campaign ───────────────────────────────────────

const input: IndexingEngineInput = {
  projectSlug: "rotherham-proof",
  baseUrl:     "https://local.inboxingproweb.com",
  pages: [
    {
      url:        "/rotherham/",
      pageType:   "hub",
      readiness:  "ready",
      outputPath: "output/rotherham-proof/rotherham/index.html",
      lastmod:    new Date().toISOString().slice(0, 10),
    },
    {
      url:        "/affordable-web-design-rotherham/",
      pageType:   "hub",
      readiness:  "ready",
      outputPath: "output/rotherham-proof/affordable-web-design-rotherham/index.html",
      lastmod:    new Date().toISOString().slice(0, 10),
    },
    {
      url:        "/web-design-wickersley/",
      pageType:   "cluster",
      readiness:  "ready",
      outputPath: "output/rotherham-proof/web-design-wickersley/index.html",
      lastmod:    new Date().toISOString().slice(0, 10),
    },
    {
      url:        "/web-design-maltby/",
      pageType:   "cluster",
      readiness:  "ready",
      outputPath: "output/rotherham-proof/web-design-maltby/index.html",
      lastmod:    new Date().toISOString().slice(0, 10),
    },
    {
      url:        "/web-design-bramley/",
      pageType:   "cluster",
      readiness:  "ready",
      outputPath: "output/rotherham-proof/web-design-bramley/index.html",
      lastmod:    new Date().toISOString().slice(0, 10),
    },
    // — Example of a blocked page (will be excluded from sitemap)
    {
      url:        "/web-design-dinnington/",
      pageType:   "cluster",
      readiness:  "blocked",
      outputPath: "output/rotherham-proof/web-design-dinnington/index.html",
    },
  ],
};

async function main(): Promise<void> {
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  INDEXING & SITEMAP ENGINE — Rotherham proof");
  console.log("════════════════════════════════════════════════════════════\n");

  // 1. Generate sitemap.xml + robots.txt + report
  const { sitemapXml, robotsTxt, report } = runIndexingEngine(input);

  // 2. Validate
  const readyUrls = input.pages
    .filter(p => p.readiness === "ready")
    .map(p => {
      const base = input.baseUrl.replace(/\/+$/, "");
      const rel  = p.url.replace(/^\/+/, "");
      const abs  = `${base}/${rel}`;
      return abs.endsWith("/") ? abs : abs + "/";
    });

  const validation = validateSitemap(sitemapXml, input.baseUrl, readyUrls);

  // 3. Print report
  console.log("── Sitemap URL    :", report.sitemapUrl);
  console.log("── robots.txt URL :", report.robotsUrl);
  console.log("── Total input    :", report.totalInputUrls);
  console.log("── Included       :", report.includedUrls, `(hub:${report.hubCount} cluster:${report.clusterCount} supporting:${report.supportingCount})`);
  console.log("── Excluded       :", report.excludedUrls.length);
  for (const ex of report.excludedUrls) {
    console.log(`     ✗ ${ex.url}  — ${ex.reason}`);
  }
  console.log("── Validation     :", validation.passed ? "✓ passed" : "✗ FAILED");
  if (!validation.passed) {
    for (const f of validation.failures) console.log(`     ✗ ${f}`);
  }
  console.log("── Generated at   :", report.generatedAt);

  console.log("\n── sitemap.xml preview:\n");
  console.log(sitemapXml);

  console.log("── robots.txt:\n");
  console.log(robotsTxt);

  // 4. FTP deploy (if credentials are present in env)
  const user     = process.env.DEPLOY_USERNAME;
  const password = process.env.DEPLOY_PASSWORD;

  if (user && password) {
    const project = JSON.parse(fs.readFileSync("config/projects/rotherham-proof.json", "utf8"));

    if (project.deploy?.enabled) {
      console.log("── Deploying via FTP…");
      const deployed = await deployIndexingFiles(input.projectSlug, {
        host:       project.deploy.host,
        port:       project.deploy.port ?? 21,
        user,
        password,
        remoteRoot: project.deploy.remoteRoot,
      });
      console.log("  sitemap.xml  :", deployed.sitemapDeployed ? "✓ uploaded" : "✗ failed");
      console.log("  robots.txt   :", deployed.robotsDeployed  ? "✓ uploaded" : "✗ failed");
    }
  } else {
    console.log("── FTP deploy skipped (no credentials in env)");
  }

  console.log("\n── Next step:");
  console.log("   Submit the sitemap URL in Google Search Console:");
  console.log(`   ${report.sitemapUrl}`);
  console.log("   (Property → Sitemaps → Add a new sitemap)\n");
}

main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
