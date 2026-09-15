#!/usr/bin/env npx tsx
/**
 * RC1-L8 — Generic local content engine lockdown (multi-tenant static + banner-cross browser).
 */
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "/home/inboxingproweb/.cache/ms-playwright";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import * as cheerio from "cheerio";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { resolveLocalLocationHierarchy } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import {
  mergeLocalHubClusterAssetsIntoEcosystemIndex,
  regenerateLocalAreaPagesOnly,
  regenerateLocalHubAndClusterPagesOnly,
} from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import { rebuildCanonicalLocalPagesOnly, resolveCanonicalFinalRenderPagePath } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { HOMEPAGE_LOCATION_COMPONENT_ID } from "../src/pharmacy/pharmacyServicePageTrustInjection.ts";
import {
  INTERNAL_LOCAL_SECTION_HEADING,
  isInternalLocalSectionHeading,
} from "../src/pharmacy/pharmacyLocalSectionHeadingResolver.ts";
import { rewriteCanonicalHtmlLinksForAuthenticatedPreview } from "../src/pharmacy/pharmacyLocalPageUrlResolver.ts";
import { renderLocalLocationHubFullPage } from "../src/pharmacy/pharmacyLocalHierarchyFullPageRenderer.ts";

const SERVICE = "pharmacy-first";
const BANNER = "banner-cross-pharmacy";
const REGRESSION_TENANTS = ["banner-cross-pharmacy", "broom-lane-pharmacy", "pharmaconnect"] as const;
const PREVIEW = "https://app.pharmaconnect.uk";
const EVIDENCE = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  BANNER,
  "rc1-l8-local-content-engine-lockdown",
);
const EXEC = "/home/inboxingproweb/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";
const FORBIDDEN_TENANT_STRINGS = [/banner cross/i, /banner-cross-pharmacy/, /\bsheffield\b/i, /\becclesall\b/i, /\bfulwood\b/i];

function loadSecret(): string {
  const requireCjs = createRequire(import.meta.url);
  const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
    apps?: Array<{ name?: string; env?: { SESSION_SECRET?: string } }>;
  };
  return eco.apps?.find((a) => a.name === "pharmaconnect-growth-engine")?.env?.SESSION_SECRET || "";
}

function extractMainH2s(html: string): string[] {
  const $ = cheerio.load(html);
  return $("main h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
}

function scanEngineSourcesForTenantLeaks(): string[] {
  const files = [
    "src/pharmacy/pharmacyLocalSectionHeadingResolver.ts",
    "src/pharmacy/pharmacyLocalFaqHeadingResolver.ts",
    "src/pharmacy/pharmacyLocalPageUrlResolver.ts",
    "src/pharmacy/pharmacyLocalHubPageRenderer.ts",
    "src/pharmacy/pharmacyLocalClusterLocationPageRenderer.ts",
    "src/pharmacy/pharmacyLocalAreaPageRenderer.ts",
  ];
  const leaks: string[] = [];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel), "utf8");
    for (const re of FORBIDDEN_TENANT_STRINGS) {
      if (re.test(text)) leaks.push(`${rel}: ${re}`);
    }
  }
  return leaks;
}

function regressionTenantRender(slug: string): { ok: boolean; h2: string[]; internal: string[] } {
  const ctx = buildContentGenerationContext(slug, SERVICE);
  const hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
  if (!hierarchy.ok) return { ok: false, h2: [], internal: [] };
  const html = renderLocalLocationHubFullPage(ctx, hierarchy);
  const h2 = extractMainH2s(html);
  const internal = h2.filter((t) => isInternalLocalSectionHeading(t));
  return { ok: true, h2, internal };
}

async function clickLocalLinks(page: import("playwright").Page): Promise<{ tested: number; passed: number; broken: string[] }> {
  const hrefs = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return [] as string[];
    return [...main.querySelectorAll("a[href]")]
      .map((a) => (a as HTMLAnchorElement).getAttribute("href") || "")
      .filter((h) => h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/#"));
  });
  const unique = [...new Set(hrefs)];
  const secret = loadSecret();
  const broken: string[] = [];
  let passed = 0;
  for (const href of unique) {
    const url = `${PREVIEW}${href}`;
    const ctx = await page.context().browser()!.newContext({
      extraHTTPHeaders: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const p = await ctx.newPage();
    const resp = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const ok =
      resp?.ok() && (await p.evaluate(() => Boolean(document.querySelector("main#main-content, main"))));
    if (ok) passed += 1;
    else broken.push(`${href} -> ${resp?.status()}`);
    await ctx.close();
  }
  return { tested: unique.length, passed, broken };
}

async function runPage(
  browser: import("playwright").Browser,
  url: string,
  secret: string,
  vp: { w: number; h: number },
  shot: string,
  options: { requireLocalAccess?: boolean } = {},
) {
  const requireLocalAccess = options.requireLocalAccess !== false;
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    extraHTTPHeaders: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const h2 = await page.evaluate(() =>
    [...document.querySelectorAll("main h2")].map((el) => el.textContent?.trim() || "").filter(Boolean),
  );
  const internalHeadings = h2.filter((t) => INTERNAL_LOCAL_SECTION_HEADING.test(t));
  const locComponent = await page.evaluate(
    (id) => Boolean(document.querySelector(`#local-access[data-component-id="${id}"]`)),
    HOMEPAGE_LOCATION_COMPONENT_ID,
  );
  const accessCount = await page.evaluate(
    () => document.querySelectorAll("#local-access, #pharmacy-map-contact").length,
  );
  const links = await clickLocalLinks(page);
  await page.screenshot({ path: shot, fullPage: true });
  await ctx.close();
  const filteredConsole = consoleErrors.filter(
    (e) => !/favicon|Google Maps|Access to font|Failed to load resource/i.test(e),
  );
  const pass =
    resp?.ok() &&
    internalHeadings.length === 0 &&
    (!requireLocalAccess || (locComponent && accessCount === 1)) &&
    links.broken.length === 0 &&
    filteredConsole.length === 0;
  return { pass, h2, internalHeadings, locComponent, accessCount, links, consoleErrors: filteredConsole };
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });

  const sourceLeaks = scanEngineSourcesForTenantLeaks();
  const regression: Record<string, unknown> = {};
  for (const slug of REGRESSION_TENANTS) {
    regression[slug] = regressionTenantRender(slug);
  }

  const ctx = buildContentGenerationContext(BANNER, SERVICE);
  const hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
  if (!hierarchy.ok) throw new Error(hierarchy.blockedReason || "hierarchy blocked");

  const homeBefore = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "index")!, "utf8");
  const serviceBefore = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "pharmacy-first")!, "utf8");
  const guideBefore = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "pharmacy-first-guide")!, "utf8");
  const blogBefore = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "what-is-pharmacy-first")!, "utf8");
  const faqBefore = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "pharmacy-first-faqs")!, "utf8");

  const hubRegen = regenerateLocalHubAndClusterPagesOnly(ctx, hierarchy);
  mergeLocalHubClusterAssetsIntoEcosystemIndex(BANNER, SERVICE, hubRegen.assets, hierarchy);
  regenerateLocalAreaPagesOnly(ctx, hierarchy);
  await rebuildCanonicalLocalPagesOnly(BANNER, SERVICE);

  const homeSha = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "index")!, "utf8");
  const serviceSha = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "pharmacy-first")!, "utf8");
  const guideSha = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "pharmacy-first-guide")!, "utf8");
  const blogSha = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "what-is-pharmacy-first")!, "utf8");
  const faqSha = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "pharmacy-first-faqs")!, "utf8");

  const hubHtml = rewriteCanonicalHtmlLinksForAuthenticatedPreview(
    fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "local-hub")!, "utf8"),
    BANNER,
    SERVICE,
  );
  const eccHtml = rewriteCanonicalHtmlLinksForAuthenticatedPreview(
    fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "local-cluster-ecclesall")!, "utf8"),
    BANNER,
    SERVICE,
  );
  const areaHtml = rewriteCanonicalHtmlLinksForAuthenticatedPreview(
    fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "local-sheffield-city-centre")!, "utf8"),
    BANNER,
    SERVICE,
  );

  const staticReport = {
    hubHeadings: extractMainH2s(hubHtml),
    clusterHeadings: extractMainH2s(eccHtml),
    areaHeadings: extractMainH2s(areaHtml),
    homepageUnchanged: homeBefore === homeSha,
    serviceUnchanged: serviceBefore === serviceSha,
    guideUnchanged: guideBefore === guideSha,
    blogUnchanged: blogBefore === blogSha,
    faqUnchanged: faqBefore === faqSha,
    sourceLeaks,
    regression,
  };

  fs.writeFileSync(path.join(EVIDENCE, "home-index.snapshot.sha256"), "unchanged-check");

  const secret = loadSecret();
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(EXEC) ? EXEC : undefined,
    args: ["--no-sandbox"],
  });

  const urls = {
    home: `${PREVIEW}/api/pharmacy-visual-experience/?slug=${BANNER}`,
    hub: `${PREVIEW}/api/pharmacy-visual-experience/local-hub/?slug=${BANNER}`,
    ecc: `${PREVIEW}/api/pharmacy-visual-experience/local-cluster-ecclesall/?slug=${BANNER}`,
    area: `${PREVIEW}/api/pharmacy-visual-experience/local-sheffield-city-centre/?slug=${BANNER}`,
  };

  const browserOut: Record<string, unknown> = {};
  for (const [key, url, vp, shot, opts] of [
    ["homeDesktop", urls.home, { w: 1440, h: 900 }, "home-desktop.png", { requireLocalAccess: false }],
    ["homeTablet", urls.home, { w: 834, h: 1112 }, "home-tablet.png", { requireLocalAccess: false }],
    ["homeMobile", urls.home, { w: 390, h: 844 }, "home-mobile.png", { requireLocalAccess: false }],
    ["hubDesktop", urls.hub, { w: 1440, h: 900 }, "hub-desktop.png", { requireLocalAccess: true }],
    ["hubMobile", urls.hub, { w: 390, h: 844 }, "hub-mobile.png", { requireLocalAccess: true }],
    ["eccDesktop", urls.ecc, { w: 1440, h: 900 }, "ecc-desktop.png", { requireLocalAccess: true }],
    ["eccMobile", urls.ecc, { w: 390, h: 844 }, "ecc-mobile.png", { requireLocalAccess: true }],
    ["areaDesktop", urls.area, { w: 1440, h: 900 }, "area-desktop.png", { requireLocalAccess: true }],
    ["areaMobile", urls.area, { w: 390, h: 844 }, "area-mobile.png", { requireLocalAccess: true }],
  ] as const) {
    browserOut[key] = await runPage(browser, url, secret, vp, path.join(EVIDENCE, shot), opts);
  }
  await browser.close();

  const regressionOk = REGRESSION_TENANTS.every(
    (s) => (regression[s] as { ok: boolean; internal: string[] }).ok && !(regression[s] as { internal: string[] }).internal.length,
  );
  const browserPass = Object.values(browserOut).every((v) => (v as { pass: boolean }).pass);
  const allPass =
    sourceLeaks.length === 0 &&
    regressionOk &&
    browserPass &&
    staticReport.homepageUnchanged &&
    staticReport.serviceUnchanged &&
    staticReport.guideUnchanged &&
    staticReport.blogUnchanged &&
    staticReport.faqUnchanged;

  const report = { staticReport, browserOut, urls, allPass };
  fs.writeFileSync(path.join(EVIDENCE, "rc1-l8-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ allPass, browser: Object.fromEntries(Object.entries(browserOut).map(([k, v]) => [k, (v as { pass: boolean }).pass])) }, null, 2));
  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
