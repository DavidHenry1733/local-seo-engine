#!/usr/bin/env npx tsx
/**
 * RC1-L3 — Local page mobile overflow + Product Owner preview URLs.
 */
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "/home/inboxingproweb/.cache/ms-playwright";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import {
  generateLocalLocationHierarchyPages,
  mergeLocalAssetsIntoEcosystemIndex,
} from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import { rebuildCanonicalLocalPagesOnly, readFinalRenderManifest } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import {
  buildCanonicalLocalPagePreviewUrl,
  CANONICAL_PREVIEW_HOST,
} from "../src/pharmacy/pharmacyCanonicalFinalRenderPreviewService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SLUG = "banner-cross-pharmacy";
const SERVICE = "pharmacy-first";
const PREVIEW_HOST = process.env.RC1_L3_PREVIEW_HOST || CANONICAL_PREVIEW_HOST;
const PREVIEW_BASE = process.env.RC1_L3_PREVIEW_BASE || "http://127.0.0.1:3001";
const EVIDENCE = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-publish", SLUG, "rc1-l3-local-mobile-preview");

const EXEC = "/home/inboxingproweb/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";

function loadSecret(): string {
  const requireCjs = createRequire(import.meta.url);
  const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
    apps?: Array<{ env?: { SESSION_SECRET?: string } }>;
  };
  return eco.apps?.find((a) => a.name === "pharmaconnect-growth-engine")?.env?.SESSION_SECRET || "";
}

function previewUrl(pageSlug: string, usePublicHost: boolean): string {
  if (usePublicHost) return buildCanonicalLocalPagePreviewUrl(SLUG, pageSlug, PREVIEW_HOST);
  return `${PREVIEW_BASE}/api/pharmacy-visual-experience/${encodeURIComponent(pageSlug)}/?slug=${encodeURIComponent(SLUG)}`;
}

async function measureOverflow(page: import("playwright").Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const offenders: Array<{ sel: string; right: number; w: number; ws: string }> = [];
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.right <= vw + 1) continue;
      const cs = getComputedStyle(el);
      if (rect.width < 2 && rect.height < 2) continue;
      const cls =
        typeof el.className === "string" && el.className
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
      offenders.push({
        sel: `${el.tagName.toLowerCase()}${cls}`,
        right: Math.round(rect.right),
        w: Math.round(rect.width),
        ws: cs.whiteSpace,
      });
    }
    offenders.sort((a, b) => b.right - a.right);
    return { vw, sw, diff: sw - vw, offenders: offenders.slice(0, 5) };
  });
}

async function validatePage(
  browser: import("playwright").Browser,
  url: string,
  viewport: { width: number; height: number },
  secret: string,
  screenshotPath: string,
) {
  const context = await browser.newContext({
    viewport,
    extraHTTPHeaders: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const failedResources: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (/fonts\.googleapis|fonts\.gstatic/i.test(u)) return;
    if (/\.(webp|jpg|jpeg|png|svg|css|woff2?)/i.test(u) && (u.includes("/assets/") || u.startsWith("http://127.0.0.1") || u.includes("pharmaconnect"))) {
      failedResources.push(u);
    }
  });
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(800);
  const overflow = await measureOverflow(page);
  const checks = await page.evaluate(() => ({
    h1: Boolean(document.querySelector("main h1")?.textContent?.trim()),
    breadcrumb: Boolean(document.querySelector('[aria-label="Breadcrumb"]')),
    header: Boolean(document.querySelector("header")),
    footer: Boolean(document.querySelector("footer")),
    cta: Boolean(document.querySelector('a[href*="tel:"], .money-page-band, [data-template-block="money-link"]')),
  }));
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await context.close();
  const filteredConsole = consoleErrors.filter(
    (e) =>
      !/favicon|Google Maps|Access to font.*CORS/i.test(e) &&
      !/^Failed to load resource: net::ERR_FAILED$/i.test(e),
  );
  const pass =
    (resp?.ok() ?? false) &&
    overflow.diff <= 0 &&
    checks.h1 &&
    checks.header &&
    checks.footer &&
    filteredConsole.length === 0 &&
    failedResources.length === 0;
  return { pass, overflow, checks, consoleErrors: filteredConsole, failedResources };
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });

  const ctx = buildContentGenerationContext(SLUG, SERVICE);
  const beforeManifest = readFinalRenderManifest(SLUG);
  const gen = generateLocalLocationHierarchyPages(ctx);
  mergeLocalAssetsIntoEcosystemIndex(SLUG, SERVICE, gen);
  const rebuild = await rebuildCanonicalLocalPagesOnly(SLUG, SERVICE);

  const hubSlug = "local-hub";
  const clusterSlug = gen.hierarchy.clusters[0]?.slug ? `local-${gen.hierarchy.clusters[0].slug}` : "local-cluster-ecclesall";
  const area1 = gen.hierarchy.areas[0]?.slug ? `local-${gen.hierarchy.areas[0].slug}` : "local-sheffield-city-centre";
  const area2 = gen.hierarchy.areas[1]?.slug ? `local-${gen.hierarchy.areas[1].slug}` : "local-broomhill";

  const poHub = previewUrl(hubSlug, true);
  const poCluster = previewUrl(clusterSlug.replace(/^local-/, "local-").startsWith("local-cluster") ? clusterSlug : `local-${gen.hierarchy.clusters[0].slug}`, true);
  const poArea1 = previewUrl(area1, true);
  const poArea2 = previewUrl(area2, true);

  const clusterPageSlug = gen.hierarchy.clusters[0] ? `local-${gen.hierarchy.clusters[0].slug}` : "local-cluster-ecclesall";

  const secret = loadSecret();
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    executablePath: fs.existsSync(EXEC) ? EXEC : undefined,
  });

  const testPages = [
    { key: "hub", slug: hubSlug },
    { key: "cluster", slug: clusterPageSlug },
    { key: "area1", slug: area1 },
    { key: "area2", slug: area2 },
  ];

  const results: Record<string, Record<string, unknown>> = {};
  for (const p of testPages) {
    const url = previewUrl(p.slug, false);
    results[p.key] = {};
    for (const w of [1440, 768, 390, 320]) {
      results[p.key][String(w)] = await validatePage(
        browser,
        url,
        { width: w, height: w <= 400 ? 844 : 900 },
        secret,
        path.join(EVIDENCE, `${p.key}-${w}.png`),
      );
    }
  }
  await browser.close();

  const overflowBefore = { maxDiff: 362, pages: ["local-hub", "local-cluster-ecclesall", "local-sheffield-city-centre", "local-broomhill"], selectors: ["header.site-header nav.nav-links a (white-space: nowrap)"] };

  let maxRemaining = 0;
  for (const p of Object.values(results)) {
    for (const r of Object.values(p) as Array<{ overflow: { diff: number } }>) {
      maxRemaining = Math.max(maxRemaining, r.overflow.diff);
    }
  }

  const report = {
    overflowBefore,
    results,
    productOwnerUrls: {
      hub: buildCanonicalLocalPagePreviewUrl(SLUG, hubSlug),
      cluster: buildCanonicalLocalPagePreviewUrl(SLUG, clusterPageSlug),
      areas: [buildCanonicalLocalPagePreviewUrl(SLUG, area1), buildCanonicalLocalPagePreviewUrl(SLUG, area2)],
    },
    canonicalRebuilt: rebuild.pagesAdded > 0,
    hierarchyUnchanged: JSON.stringify(beforeManifest?.pages.filter((x) => !x.pageSlug.startsWith("local-")).map((x) => x.pageSlug)) ===
      JSON.stringify(readFinalRenderManifest(SLUG)?.pages.filter((x) => !x.pageSlug.startsWith("local-")).map((x) => x.pageSlug)),
  };
  fs.writeFileSync(path.join(EVIDENCE, "rc1-l3-report.json"), JSON.stringify(report, null, 2));

  const pass = (k: string, w: number) => (results[k][String(w)] as { pass: boolean }).pass;

  console.log("PO hub:", report.productOwnerUrls.hub);
  console.log("PO cluster:", report.productOwnerUrls.cluster);
  console.log("PO areas:", report.productOwnerUrls.areas.join(", "));
  console.log("hub 390:", pass("hub", 390) ? "PASS" : "FAIL");
  console.log("hub 320:", pass("hub", 320) ? "PASS" : "FAIL");
  console.log("cluster 390:", pass("cluster", 390) ? "PASS" : "FAIL");
  console.log("cluster 320:", pass("cluster", 320) ? "PASS" : "FAIL");
  console.log("area1 390:", pass("area1", 390) ? "PASS" : "FAIL");
  console.log("area1 320:", pass("area1", 320) ? "PASS" : "FAIL");
  console.log("area2 390:", pass("area2", 390) ? "PASS" : "FAIL");
  console.log("area2 320:", pass("area2", 320) ? "PASS" : "FAIL");
  console.log("tablet hub:", pass("hub", 768) ? "PASS" : "FAIL");
  console.log("desktop hub:", pass("hub", 1440) ? "PASS" : "FAIL");
  console.log("max overflow remaining:", maxRemaining);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
