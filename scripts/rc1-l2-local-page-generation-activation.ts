#!/usr/bin/env npx tsx
/**
 * RC1-L2 — Local page generation activation (banner-cross-pharmacy validation tenant).
 */
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "/home/inboxingproweb/.cache/ms-playwright";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { resolveCurrentPharmacyPresentationProfile } from "../src/pharmacy/pharmacyPresentationProfileResolver.ts";
import { traceLocalAreaSelection } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import {
  generateLocalLocationHierarchyPages,
  mergeLocalAssetsIntoEcosystemIndex,
} from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import { rebuildCanonicalLocalPagesOnly } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SLUG = "banner-cross-pharmacy";
const SERVICE = "pharmacy-first";
const PREVIEW_BASE = process.env.RC1_L2_PREVIEW_BASE || "http://127.0.0.1:3001";
const EVIDENCE = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  SLUG,
  "rc1-l2-local-page-generation",
);

const PLAYWRIGHT_EXECUTABLE =
  "/home/inboxingproweb/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";

function loadSecret(): string {
  const requireCjs = createRequire(import.meta.url);
  const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
    apps?: Array<{ env?: { SESSION_SECRET?: string } }>;
  };
  return eco.apps?.find((a) => a.name === "pharmaconnect-growth-engine")?.env?.SESSION_SECRET || "";
}

async function browserCheck(url: string, viewport: { width: number; height: number }, secret: string) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    executablePath: fs.existsSync(PLAYWRIGHT_EXECUTABLE) ? PLAYWRIGHT_EXECUTABLE : undefined,
  });
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
    if (/\.(webp|jpg|jpeg|png|svg|css)/i.test(r.url())) failedResources.push(r.url());
  });
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(1000);
  const checks = await page.evaluate(() => {
    const main = document.querySelector("main");
    const h1 = document.querySelector("main h1");
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    return {
      h1Visible: Boolean(h1 && h1.textContent?.trim()),
      bodyVisible: Boolean(main && main.textContent && main.textContent.trim().length > 50),
      ctaVisible: Boolean(document.querySelector('a[href*="tel:"], .money-page-band, [data-template-block="money-link"]')),
      breadcrumbVisible: Boolean(document.querySelector('[aria-label="Breadcrumb"]')),
      headerVisible: Boolean(document.querySelector("header")),
      footerVisible: Boolean(document.querySelector("footer")),
      horizontalOverflow: overflow,
    };
  });
  const shot = path.join(EVIDENCE, `shot-${viewport.width}-${Buffer.from(url).toString("base64url").slice(0, 24)}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  await browser.close();
  const filteredConsole = consoleErrors.filter(
    (e) =>
      !/favicon|Google Maps|Access to font.*CORS|Failed to load resource: net::ERR_FAILED/i.test(e) ||
      failedResources.length > 0,
  );
  const effectiveConsole =
    failedResources.length === 0
      ? consoleErrors.filter(
          (e) =>
            !/favicon|Google Maps|Access to font.*CORS/i.test(e) &&
            !/^Failed to load resource: net::ERR_FAILED$/i.test(e),
        )
      : filteredConsole;
  const pass =
    (resp?.ok() ?? false) &&
    checks.h1Visible &&
    checks.bodyVisible &&
    checks.headerVisible &&
    checks.footerVisible &&
    !checks.horizontalOverflow &&
    effectiveConsole.length === 0 &&
    failedResources.length === 0;
  return { pass, checks, consoleErrors: effectiveConsole, failedResources, screenshot: shot };
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const presentation = resolveCurrentPharmacyPresentationProfile(SLUG);
  const trace = traceLocalAreaSelection(SLUG, SERVICE, presentation.data);
  fs.writeFileSync(path.join(EVIDENCE, "area-selection-trace.json"), JSON.stringify(trace, null, 2));

  const ctx = buildContentGenerationContext(SLUG, SERVICE);
  const gen = generateLocalLocationHierarchyPages(ctx);
  if (!gen.ok) {
    console.log(JSON.stringify({ status: "BLOCKED", blockedReason: gen.blockedReason, trace }, null, 2));
    process.exit(1);
  }

  mergeLocalAssetsIntoEcosystemIndex(SLUG, SERVICE, gen);
  const rebuild = await rebuildCanonicalLocalPagesOnly(SLUG, SERVICE);

  const hubPreview = `${PREVIEW_BASE}/api/pharmacy-visual-experience/local-hub/?slug=${SLUG}`;
  const clusterSlug = gen.hierarchy.clusters[0]?.slug || "";
  const clusterPreview = `${PREVIEW_BASE}/api/pharmacy-visual-experience/local-${clusterSlug}/?slug=${SLUG}`;
  const areaPreviews = gen.hierarchy.areas.slice(0, 2).map(
    (a) => `${PREVIEW_BASE}/api/pharmacy-visual-experience/local-${a.slug}/?slug=${SLUG}`,
  );

  const secret = loadSecret();
  const urls = [hubPreview, clusterPreview, ...areaPreviews];
  const desktop: Record<string, unknown> = {};
  const mobile: Record<string, unknown> = {};
  for (const url of urls) {
    desktop[url] = await browserCheck(url, { width: 1440, height: 900 }, secret);
    mobile[url] = await browserCheck(url, { width: 390, height: 844 }, secret);
  }

  const desktopPass = Object.values(desktop).every((r) => (r as { pass: boolean }).pass);
  const mobilePass = Object.values(mobile).every((r) => (r as { pass: boolean }).pass);

  const index = JSON.parse(
    fs.readFileSync(
      path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", SLUG, SERVICE, "_ecosystem-index.json"),
      "utf8",
    ),
  );

  const report = {
    rootCause:
      "pharmacy-first local pages were filtered to zero by PHARMACY_FIRST_ACTIVE_LOCAL_SLUGS (Broom Lane-only manifest) in buildBenchmarkServiceEcosystem despite operator-selected profile areas",
    filesChanged: [
      "src/pharmacy/pharmacyLocalAreaResolver.ts",
      "src/pharmacy/pharmacyLocalLocationGenerationService.ts",
      "src/pharmacy/pharmacyLocalLocationHubRenderer.ts",
      "src/pharmacy/contentEngine/buildContentGenerationContext.ts",
      "src/pharmacy/contentEngine/contentGenerationContextTypes.ts",
      "src/pharmacy/benchmarkServiceEcosystemBuilder.ts",
      "src/pharmacy/rebindPharmacyFirstLocalPages.ts",
      "src/pharmacy/pharmacyCanonicalFinalRenderService.ts",
      "src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts",
    ],
    trace,
    hierarchy: gen.hierarchy,
    selectedAreas: index.selectedAreas,
    canonicalPagesAdded: rebuild.pagesAdded,
    desktopPass,
    mobilePass,
    previewUrls: { hubPreview, clusterPreview, areaPreviews },
    browser: { desktop, mobile },
  };
  fs.writeFileSync(path.join(EVIDENCE, "rc1-l2-report.json"), JSON.stringify(report, null, 2));

  console.log("Root cause:", report.rootCause);
  console.log("Files changed:", report.filesChanged.join(", "));
  console.log("First empty-selection decision:", trace.firstEmptySelectionDecision);
  console.log("Responsible file:", trace.responsibleFile);
  console.log("Responsible function:", trace.responsibleFunction);
  console.log("Responsible line:", trace.responsibleLine);
  console.log("Primary locality:", gen.hierarchy.primaryLocality);
  console.log("Selected areas:", index.selectedAreas.join(", "));
  console.log("Location hub generated: YES");
  console.log("Clusters:", gen.hierarchy.clusters.length);
  console.log("Areas:", gen.hierarchy.areas.length);
  console.log("Hub preview:", hubPreview);
  console.log("Cluster preview:", clusterPreview);
  console.log("Area previews:", areaPreviews.join(", "));
  console.log("Desktop:", desktopPass ? "PASS" : "FAIL");
  console.log("Mobile:", mobilePass ? "PASS" : "FAIL");
  console.log(
    "Status:",
    desktopPass && mobilePass ? "READY FOR PRODUCT OWNER LOCAL PAGE TEST" : "BLOCKED",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
