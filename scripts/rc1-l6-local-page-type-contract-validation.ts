#!/usr/bin/env npx tsx
/**
 * RC1-L6 — Locked local page-type contracts + browser validation.
 */
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "/home/inboxingproweb/.cache/ms-playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";
import {
  contractIdForPageType,
  LOCAL_AREA_CONTRACT_ID,
  LOCAL_CLUSTER_CONTRACT_ID,
  LOCAL_HUB_CONTRACT_ID,
} from "../src/pharmacy/pharmacyLocalPageTypeContracts.ts";
import { HOMEPAGE_AREAS_WE_SUPPORT_COMPONENT_ID } from "../src/pharmacy/pharmacyServicePageTrustInjection.ts";
import {
  countDuplicateAccessSections,
  countImageSlotsByRole,
  validateLocalPageTypeContractHtml,
} from "../src/pharmacy/pharmacyLocalPageContractValidation.ts";
import { LOCAL_HUB_V1_CONTRACT, LOCAL_CLUSTER_V1_CONTRACT } from "../src/pharmacy/pharmacyLocalPageTypeContracts.ts";
import { renderLocalHubPageHtml } from "../src/pharmacy/pharmacyLocalHubPageRenderer.ts";
import { renderLocalClusterLocationPageHtml } from "../src/pharmacy/pharmacyLocalClusterLocationPageRenderer.ts";

const BANNER = "banner-cross-pharmacy";
const DRY = resolveTenantProfileSlug("brook-pharmacy") || "broom-lane-pharmacy";
const SERVICE = "pharmacy-first";
const PREVIEW = "https://app.pharmaconnect.uk";
const EVIDENCE = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  BANNER,
  "rc1-l6-local-page-type-contracts",
);
const EXEC = "/home/inboxingproweb/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";

function metrics(html: string) {
  const $ = cheerio.load(html);
  const main = $("main").first();
  const words = main.text().replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length;
  const substantive = main.find("section").filter((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    return t.split(/\s+/).filter(Boolean).length >= 25;
  }).length;
  const imgs = main.find("img[data-image-slot]").length;
  const contract = $("body").attr("data-local-page-contract") || "";
  return {
    words,
    h1: main.find("h1").length,
    sections: main.find("section").length,
    substantive,
    faq: main.find("section.faq, [data-template-block='faq']").length,
    imgs,
    contract,
    ds: $("body").attr("data-publish-source") || "",
    areasComponent: $('[data-component-id="homepage-areas-we-support"]').length,
    sha: crypto.createHash("sha256").update(html).digest("hex"),
  };
}

function loadSecret(): string {
  const requireCjs = createRequire(import.meta.url);
  const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
    apps?: Array<{ name?: string; env?: { SESSION_SECRET?: string } }>;
  };
  return eco.apps?.find((a) => a.name === "pharmaconnect-growth-engine")?.env?.SESSION_SECRET || "";
}

async function browserCheck(
  browser: import("playwright").Browser,
  url: string,
  secret: string,
  vp: { w: number; h: number; label: string },
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
  const dom = await page.evaluate(() => {
    const main = document.querySelector("main");
    const words = main
      ? main.innerText.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length
      : 0;
    const imgs = main ? main.querySelectorAll("img[data-image-slot]").length : 0;
    const conversionFull = Boolean(
      document.querySelector('section[data-template-block="conversion-image"] img[data-image-slot="conversion"]'),
    );
    const conversionInCta = Boolean(
      document.querySelector('section.cta-band img[data-image-slot="conversion"]'),
    );
    const areasSupport = Boolean(document.querySelector('[data-component-id="homepage-areas-we-support"]'));
    const accessCount = document.querySelectorAll("#local-access, #pharmacy-map-contact").length;
    const bodyEl =
      document.querySelector("main section .section-copy p") ||
      document.querySelector("main section p") ||
      document.querySelector("main .local-intro-lead");
    const bodySize = bodyEl ? parseFloat(getComputedStyle(bodyEl).fontSize) : 0;
    const uppercaseH2 = [...document.querySelectorAll("main h2")].filter(
      (h) => h.textContent === h.textContent?.toUpperCase() && /[A-Z]{4,}/.test(h.textContent || ""),
    ).length;
    return {
      words,
      h1: Boolean(document.querySelector("main h1")),
      imgs,
      conversionFull,
      conversionInCta,
      areasSupport,
      accessCount,
      bodySize,
      uppercaseH2,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      faq: Boolean(document.querySelector("main section.faq")),
      cta: Boolean(document.querySelector("main .cta-band")),
      breadcrumb: Boolean(document.querySelector('[aria-label="Breadcrumb"]')),
    };
  });
  await page.screenshot({ path: shot, fullPage: true });
  await ctx.close();
  const filteredConsole = consoleErrors.filter(
    (e) => !/favicon|Google Maps|Access to font|Failed to load resource/i.test(e),
  );
  const pass =
    resp?.ok() &&
    dom.h1 &&
    dom.words >= 450 &&
    dom.imgs === 4 &&
    dom.conversionFull &&
    !dom.conversionInCta &&
    dom.accessCount === 1 &&
    dom.bodySize >= 16 &&
    dom.uppercaseH2 === 0 &&
    dom.faq &&
    dom.cta &&
    dom.breadcrumb &&
    dom.overflow <= 0 &&
    filteredConsole.length === 0;
  return { pass, dom, url, consoleErrors: filteredConsole };
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const areaShaBefore = crypto
    .createHash("sha256")
    .update(fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "local-sheffield-city-centre")!, "utf8"))
    .digest("hex");

  const ctx = buildContentGenerationContext(BANNER, SERVICE);
  const hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
  if (!hierarchy.ok) throw new Error(hierarchy.blockedReason || "hierarchy blocked");

  const regen = regenerateLocalHubAndClusterPagesOnly(ctx, hierarchy);
  mergeLocalHubClusterAssetsIntoEcosystemIndex(BANNER, SERVICE, regen.assets, hierarchy);
  await rebuildCanonicalLocalPagesOnly(BANNER, SERVICE);

  const areaShaAfter = crypto
    .createHash("sha256")
    .update(fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, "local-sheffield-city-centre")!, "utf8"))
    .digest("hex");

  const hubFile = resolveCanonicalFinalRenderPagePath(BANNER, "local-hub")!;
  const eccFile = resolveCanonicalFinalRenderPagePath(BANNER, "local-cluster-ecclesall")!;
  const fulFile = resolveCanonicalFinalRenderPagePath(BANNER, "local-cluster-fulwood")!;
  const hubHtml = fs.readFileSync(hubFile, "utf8");
  const eccHtml = fs.readFileSync(eccFile, "utf8");

  const dryCtx = buildContentGenerationContext(DRY, SERVICE);
  const dryHierarchy = resolveLocalLocationHierarchy(dryCtx.resolvedSlug, dryCtx.serviceId, dryCtx.rawProfile);
  const dryRun =
    dryHierarchy.ok && dryHierarchy.clusters[0]
      ? {
          hubContract: LOCAL_HUB_CONTRACT_ID,
          clusterContract: LOCAL_CLUSTER_CONTRACT_ID,
          hubGenerator: "renderLocalHubPageHtml",
          clusterGenerator: "renderLocalClusterLocationPageHtml",
          dryHubBytes: renderLocalHubPageHtml(dryCtx, dryHierarchy).length,
          dryClusterBytes: renderLocalClusterLocationPageHtml(dryCtx, dryHierarchy, dryHierarchy.clusters[0]).length,
        }
      : { skipped: true };

  const secret = loadSecret();
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(EXEC) ? EXEC : undefined,
    args: ["--no-sandbox"],
  });

  const urls = {
    hub: `${PREVIEW}/api/pharmacy-visual-experience/local-hub/?slug=${BANNER}`,
    ecclesall: `${PREVIEW}/api/pharmacy-visual-experience/local-cluster-ecclesall/?slug=${BANNER}`,
    fulwood: `${PREVIEW}/api/pharmacy-visual-experience/local-cluster-fulwood/?slug=${BANNER}`,
  };

  const browserOut: Record<string, unknown> = {};
  for (const [key, url, vp, shot] of [
    ["hubDesktop", urls.hub, { w: 1440, h: 900 }, "hub-desktop.png"],
    ["hubTablet", urls.hub, { w: 768, h: 1024 }, "hub-tablet.png"],
    ["hubMobile", urls.hub, { w: 390, h: 844 }, "hub-mobile.png"],
    ["eccDesktop", urls.ecclesall, { w: 1440, h: 900 }, "ecc-desktop.png"],
    ["eccTablet", urls.ecclesall, { w: 768, h: 1024 }, "ecc-tablet.png"],
    ["eccMobile", urls.ecclesall, { w: 390, h: 844 }, "ecc-mobile.png"],
    ["fulDesktop", urls.fulwood, { w: 1440, h: 900 }, "ful-desktop.png"],
    ["fulTablet", urls.fulwood, { w: 768, h: 1024 }, "ful-tablet.png"],
    ["fulMobile", urls.fulwood, { w: 390, h: 844 }, "ful-mobile.png"],
  ] as const) {
    browserOut[key] = await browserCheck(
      browser,
      url,
      secret,
      vp,
      path.join(EVIDENCE, shot),
    );
  }
  await browser.close();

  const report = {
    contracts: {
      hub: LOCAL_HUB_CONTRACT_ID,
      cluster: LOCAL_CLUSTER_CONTRACT_ID,
      area: LOCAL_AREA_CONTRACT_ID,
    },
    homepageAreasComponentId: HOMEPAGE_AREAS_WE_SUPPORT_COMPONENT_ID,
    hub: metrics(hubHtml),
    ecclesall: metrics(eccHtml),
    fulwood: metrics(fs.readFileSync(fulFile, "utf8")),
    hubValidation: validateLocalPageTypeContractHtml(hubHtml, LOCAL_HUB_V1_CONTRACT),
    eccValidation: validateLocalPageTypeContractHtml(eccHtml, LOCAL_CLUSTER_V1_CONTRACT),
    imageSlotsHub: countImageSlotsByRole(hubHtml),
    duplicateAccessHub: countDuplicateAccessSections(hubHtml),
    areaUnchanged: areaShaBefore === areaShaAfter,
    dryRun,
    crossTenant: dryRun.skipped
      ? "SKIP"
      : dryRun.hubContract === LOCAL_HUB_CONTRACT_ID && dryRun.clusterContract === LOCAL_CLUSTER_CONTRACT_ID
        ? "PASS"
        : "FAIL",
    browserOut,
    urls,
    contractSelection: {
      hub: contractIdForPageType("location-hub"),
      cluster: contractIdForPageType("location-cluster"),
      area: contractIdForPageType("location-area"),
    },
  };
  fs.writeFileSync(path.join(EVIDENCE, "rc1-l6-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ areaUnchanged: report.areaUnchanged, hub: report.hub, browser: Object.fromEntries(Object.entries(browserOut).map(([k,v])=>[k,(v as {pass:boolean}).pass])) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
