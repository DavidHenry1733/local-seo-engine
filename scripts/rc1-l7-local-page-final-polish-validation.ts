#!/usr/bin/env npx tsx
/**
 * RC1-L7 — FAQ headings, homepage component parity, internal link browser checks.
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
  regenerateLocalHubAndClusterPagesOnly,
} from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import { rebuildCanonicalLocalPagesOnly, resolveCanonicalFinalRenderPagePath } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { HOMEPAGE_AREAS_WE_SUPPORT_COMPONENT_ID, HOMEPAGE_LOCATION_COMPONENT_ID } from "../src/pharmacy/pharmacyServicePageTrustInjection.ts";
import { isInternalLocalFaqHeading } from "../src/pharmacy/pharmacyLocalFaqHeadingResolver.ts";
import { rewriteCanonicalHtmlLinksForAuthenticatedPreview } from "../src/pharmacy/pharmacyLocalPageUrlResolver.ts";

const BANNER = "banner-cross-pharmacy";
const SERVICE = "pharmacy-first";
const PREVIEW = "https://app.pharmaconnect.uk";
const EVIDENCE = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  BANNER,
  "rc1-l7-local-page-final-polish",
);
const EXEC = "/home/inboxingproweb/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";

function loadSecret(): string {
  const requireCjs = createRequire(import.meta.url);
  const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
    apps?: Array<{ name?: string; env?: { SESSION_SECRET?: string } }>;
  };
  return eco.apps?.find((a) => a.name === "pharmaconnect-growth-engine")?.env?.SESSION_SECRET || "";
}

function coverageNames(html: string, scope = "#areas-we-support"): string[] {
  const $ = cheerio.load(html);
  return $(`${scope} .coverage-tags .coverage-tag`)
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
}

function faqHeading(html: string): string {
  const $ = cheerio.load(html);
  return $("section.faq .section-head h2, section.faq h2").first().text().trim();
}

async function clickLocalLinks(
  page: import("playwright").Page,
  baseUrl: string,
  secret: string,
): Promise<{ tested: number; passed: number; broken: string[] }> {
  const hrefs = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return [] as string[];
    return [...main.querySelectorAll("a[href]")]
      .map((a) => (a as HTMLAnchorElement).getAttribute("href") || "")
      .filter((h) => h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/#"));
  });
  const unique = [...new Set(hrefs)];
  const broken: string[] = [];
  let passed = 0;
  for (const href of unique) {
    const url = href.startsWith("http") ? href : `${PREVIEW}${href.startsWith("/") ? "" : "/"}${href}`;
    const ctx = await page.context().browser()!.newContext({
      extraHTTPHeaders: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const p = await ctx.newPage();
    const resp = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const ok =
      resp?.ok() &&
      (await p.evaluate(() => Boolean(document.querySelector("main#main-content, main"))));
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
) {
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
  const faq = await page.evaluate(() => {
    const h = document.querySelector("section.faq h2");
    return h?.textContent?.trim() || "";
  });
  const locComponent = await page.evaluate((componentId) =>
    Boolean(document.querySelector(`#local-access[data-component-id="${componentId}"]`)),
  HOMEPAGE_LOCATION_COMPONENT_ID);
  const accessCount = await page.evaluate(
    () => document.querySelectorAll("#local-access, #pharmacy-map-contact").length,
  );
  const links = await clickLocalLinks(page, url, secret);
  await page.screenshot({ path: shot, fullPage: true });
  await ctx.close();
  const filteredConsole = consoleErrors.filter(
    (e) => !/favicon|Google Maps|Access to font|Failed to load resource/i.test(e),
  );
  const pass =
    resp?.ok() &&
    !isInternalLocalFaqHeading(faq) &&
    locComponent &&
    accessCount === 1 &&
    links.broken.length === 0 &&
    filteredConsole.length === 0;
  return { pass, faq, locComponent, accessCount, links, consoleErrors: filteredConsole };
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const areaShaBefore = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "local-sheffield-city-centre")!, "utf8");

  const ctx = buildContentGenerationContext(BANNER, SERVICE);
  const hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
  if (!hierarchy.ok) throw new Error(hierarchy.blockedReason || "blocked");

  const regen = regenerateLocalHubAndClusterPagesOnly(ctx, hierarchy);
  mergeLocalHubClusterAssetsIntoEcosystemIndex(BANNER, SERVICE, regen.assets, hierarchy);
  await rebuildCanonicalLocalPagesOnly(BANNER, SERVICE);

  const areaShaAfter = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "local-sheffield-city-centre")!, "utf8");
  const homeHtml = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "index")!, "utf8");
  const hubRaw = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "local-hub")!, "utf8");
  const hubHtml = rewriteCanonicalHtmlLinksForAuthenticatedPreview(hubRaw, BANNER, SERVICE);
  const eccRaw = fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "local-cluster-ecclesall")!, "utf8");

  const report = {
    faqHubBefore: "Location hub questions",
    faqClusterBefore: "Cluster questions",
    faqHubAfter: faqHeading(hubHtml),
    faqClusterAfter: faqHeading(
      rewriteCanonicalHtmlLinksForAuthenticatedPreview(eccRaw, BANNER, SERVICE),
    ),
    homepageAreas: coverageNames(homeHtml, "#local-access"),
    hubAreas: coverageNames(hubHtml),
    clusterAreas: coverageNames(
      rewriteCanonicalHtmlLinksForAuthenticatedPreview(
        fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "local-cluster-ecclesall")!, "utf8"),
        BANNER,
        SERVICE,
      ),
      "#local-access",
    ),
    areaUnchanged: areaShaBefore === areaShaAfter,
  };

  const secret = loadSecret();
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(EXEC) ? EXEC : undefined,
    args: ["--no-sandbox"],
  });

  const urls = {
    hub: `${PREVIEW}/api/pharmacy-visual-experience/local-hub/?slug=${BANNER}`,
    ecc: `${PREVIEW}/api/pharmacy-visual-experience/local-cluster-ecclesall/?slug=${BANNER}`,
    ful: `${PREVIEW}/api/pharmacy-visual-experience/local-cluster-fulwood/?slug=${BANNER}`,
  };

  const browserOut: Record<string, unknown> = {};
  for (const [key, url, vp, shot] of [
    ["hubDesktop", urls.hub, { w: 1440, h: 900 }, "hub-desktop.png"],
    ["hubMobile", urls.hub, { w: 390, h: 844 }, "hub-mobile.png"],
    ["eccDesktop", urls.ecc, { w: 1440, h: 900 }, "ecc-desktop.png"],
    ["eccMobile", urls.ecc, { w: 390, h: 844 }, "ecc-mobile.png"],
    ["fulDesktop", urls.ful, { w: 1440, h: 900 }, "ful-desktop.png"],
    ["fulMobile", urls.ful, { w: 390, h: 844 }, "ful-mobile.png"],
  ] as const) {
    browserOut[key] = await runPage(browser, url, secret, vp, path.join(EVIDENCE, shot));
  }
  await browser.close();

  fs.writeFileSync(
    path.join(EVIDENCE, "rc1-l7-report.json"),
    JSON.stringify({ ...report, browserOut, urls, components: { HOMEPAGE_AREAS_WE_SUPPORT_COMPONENT_ID, HOMEPAGE_LOCATION_COMPONENT_ID } }, null, 2),
  );
  console.log(JSON.stringify({ report, browser: Object.fromEntries(Object.entries(browserOut).map(([k, v]) => [k, (v as { pass: boolean }).pass])) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
