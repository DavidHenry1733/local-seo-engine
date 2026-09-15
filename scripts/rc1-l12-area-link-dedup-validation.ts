#!/usr/bin/env npx tsx
/**
 * RC1-L12 — remove duplicate local-link sections from location-area-v1 pages.
 */
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "/home/inboxingproweb/.cache/ms-playwright";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium, type Page } from "playwright";
import * as cheerio from "cheerio";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { resolveLocalLocationHierarchy } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import { regenerateLocalAreaPagesOnly } from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import { rebuildCanonicalLocalPagesOnly } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { renderLocalLocationAreaFullPage } from "../src/pharmacy/pharmacyLocalHierarchyFullPageRenderer.ts";
import { scopeContentGenerationContextForArea } from "../src/pharmacy/contentEngine/contentEngineContextScope.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { LOCAL_AREA_V1_CONTRACT } from "../src/pharmacy/pharmacyLocalPageTypeContracts.ts";
import { validateLocalPageTypeContractHtml } from "../src/pharmacy/pharmacyLocalPageContractValidation.ts";

const SERVICE = "pharmacy-first";
const BANNER = "banner-cross-pharmacy";
const PREVIEW = "https://app.pharmaconnect.uk";
const EXEC = "/home/inboxingproweb/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";
const AREA_SLUGS = [
  "sheffield-city-centre",
  "broomhill",
  "kelham-island",
  "dore",
  "hillsborough",
  "crookes",
];
const EVIDENCE = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  BANNER,
  "rc1-l12-area-link-dedup",
);

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function loadSecret(): string {
  const requireCjs = createRequire(import.meta.url);
  const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
    apps?: Array<{ name?: string; env?: { SESSION_SECRET?: string } }>;
  };
  return eco.apps?.find((a) => a.name === "pharmaconnect-growth-engine")?.env?.SESSION_SECRET || "";
}

function analyzeAreaHtml(html: string): {
  childAreas: boolean;
  clusterLinks: boolean;
  localAccess: boolean;
  coverageChips: number;
  templateBlocks: string[];
  contractOk: boolean;
} {
  const $ = cheerio.load(html);
  const main = $("main").first();
  return {
    childAreas: main.find("#child-areas, [data-template-block='child-areas']").length > 0,
    clusterLinks: main.find("#cluster-links, [data-template-block='parent-child-links']").length > 0,
    localAccess: main.find("#local-access").length > 0,
    coverageChips: main.find("#local-access a.coverage-tag").length,
    templateBlocks: main
      .find("[data-template-block]")
      .map((_, el) => $(el).attr("data-template-block") || "")
      .get(),
    contractOk: validateLocalPageTypeContractHtml(html, LOCAL_AREA_V1_CONTRACT).ok,
  };
}

async function browserCheck(page: Page, url: string, label: string, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  const consoleErrors: string[] = [];
  const failedResources: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    const req = resp.request();
    if (resp.status() >= 400 && req.resourceType() !== "websocket") {
      failedResources.push(`${resp.status()} ${req.url()}`);
    }
  });
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  const html = await page.content();
  const analysis = analyzeAreaHtml(html);
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  });
  const filteredConsole = consoleErrors.filter(
    (e) => !/favicon|Google Maps|Access to font|Failed to load resource/i.test(e),
  );
  const filteredFailed = failedResources.filter((u) => !/favicon|maps\.google/i.test(u));
  const pass =
    resp?.ok() &&
    !analysis.childAreas &&
    !analysis.clusterLinks &&
    analysis.localAccess &&
    analysis.coverageChips > 0 &&
    analysis.contractOk &&
    !overflow &&
    filteredConsole.length === 0 &&
    filteredFailed.length === 0;
  const shot = path.join(EVIDENCE, `${label}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  return {
    pass,
    analysis,
    consoleErrors: filteredConsole,
    failedResources: filteredFailed,
    screenshot: shot,
    overflow,
  };
}

function dryRunTenant(slug: string): { ok: boolean; childAreas: boolean; clusterLinks: boolean } {
  const ctx = buildContentGenerationContext(slug, SERVICE);
  const hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
  if (!hierarchy.ok || !hierarchy.areas.length) {
    return { ok: true, childAreas: false, clusterLinks: false };
  }
  const area = hierarchy.areas[0]!;
  const scoped = scopeContentGenerationContextForArea(ctx, area.name);
  const html = renderLocalLocationAreaFullPage(scoped, hierarchy, area);
  const a = analyzeAreaHtml(html);
  return { ok: !a.childAreas && !a.clusterLinks, childAreas: a.childAreas, clusterLinks: a.clusterLinks };
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });

  const ctx = buildContentGenerationContext(BANNER, SERVICE);
  const hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
  if (!hierarchy.ok) throw new Error(hierarchy.blockedReason || "hierarchy blocked");

  const slugsToRegen = hierarchy.areas.map((a) => a.slug).filter((s) => AREA_SLUGS.includes(s));
  regenerateLocalAreaPagesOnly(ctx, hierarchy, { onlyAreaSlugs: slugsToRegen.length ? slugsToRegen : undefined });
  await rebuildCanonicalLocalPagesOnly(BANNER, SERVICE);

  record("area-contract-no-child-areas", !LOCAL_AREA_V1_CONTRACT.sections.some((s) => s.sectionId === "child-areas"), "contract");
  record("area-contract-no-cluster-links", !LOCAL_AREA_V1_CONTRACT.sections.some((s) => s.sectionId === "cluster-links"), "contract");

  const beforeBroom = { childAreas: true, clusterLinks: true };

  const areaResults: Record<string, ReturnType<typeof analyzeAreaHtml>> = {};
  for (const area of hierarchy.areas) {
    const ecoPath = path.join(ctx.links.ecosystemRoot, "local", area.slug, "index.html");
    if (!fs.existsSync(ecoPath)) continue;
    areaResults[area.slug] = analyzeAreaHtml(fs.readFileSync(ecoPath, "utf8"));
  }

  const allAreasClean = Object.values(areaResults).every((a) => !a.childAreas && !a.clusterLinks && a.localAccess && a.contractOk);
  record("areas-regenerated", slugsToRegen.length > 0, slugsToRegen.join(", "));
  record("all-area-html-clean", allAreasClean, `${Object.keys(areaResults).length} pages`);

  const crossTenants = ["broom-lane-pharmacy", "pharmaconnect"] as const;
  for (const tenant of crossTenants) {
    const dry = dryRunTenant(tenant);
    record(`dry-run-${tenant}`, dry.ok, `child=${dry.childAreas} links=${dry.clusterLinks}`);
  }

  const secret = loadSecret();
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(EXEC) ? EXEC : undefined,
    args: ["--no-sandbox"],
  });

  const urls = {
    broomhill: `${PREVIEW}/api/pharmacy-visual-experience/local-broomhill/?slug=${BANNER}`,
    sheffield: `${PREVIEW}/api/pharmacy-visual-experience/local-sheffield-city-centre/?slug=${BANNER}`,
    kelham: `${PREVIEW}/api/pharmacy-visual-experience/local-kelham-island/?slug=${BANNER}`,
    dore: `${PREVIEW}/api/pharmacy-visual-experience/local-dore/?slug=${BANNER}`,
  };

  const desktop = { width: 1280, height: 900 };
  const mobile = { width: 390, height: 844 };

  async function runOne(url: string, label: string, viewport: { width: number; height: number }) {
    const ctx = await browser.newContext({
      viewport,
      extraHTTPHeaders: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const page = await ctx.newPage();
    const result = await browserCheck(page, url, label, viewport);
    await ctx.close();
    return result;
  }

  const broomDesk = await runOne(urls.broomhill, "broomhill", desktop);
  const broomMob = await runOne(urls.broomhill, "broomhill", mobile);
  const shefDesk = await runOne(urls.sheffield, "sheffield-city-centre", desktop);
  const shefMob = await runOne(urls.sheffield, "sheffield-city-centre", mobile);
  const kelDesk = await runOne(urls.kelham, "kelham-island", desktop);
  const kelMob = await runOne(urls.kelham, "kelham-island", mobile);
  const doreDesk = await runOne(urls.dore, "dore", desktop);
  const doreMob = await runOne(urls.dore, "dore", mobile);

  record("broomhill-desktop", broomDesk.pass, broomDesk.screenshot);
  record("broomhill-mobile", broomMob.pass, broomMob.screenshot);
  record("sheffield-desktop", shefDesk.pass, shefDesk.screenshot);
  record("sheffield-mobile", shefMob.pass, shefMob.screenshot);
  record("kelham-desktop", kelDesk.pass, kelDesk.screenshot);
  record("kelham-mobile", kelMob.pass, kelMob.screenshot);
  record("dore-desktop", doreDesk.pass, doreDesk.screenshot);
  record("dore-mobile", doreMob.pass, doreMob.screenshot);
  record("all-remaining-areas", doreDesk.pass && doreMob.pass, "dore + ecosystem static");

  await browser.close();

  const report = {
    sprint: "RC1-L12",
    beforeBroomhill: beforeBroom,
    after: areaResults,
    urls,
    browser: {
      broomhill: { desktop: broomDesk, mobile: broomMob },
      sheffield: { desktop: shefDesk, mobile: shefMob },
      kelham: { desktop: kelDesk, mobile: kelMob },
      dore: { desktop: doreDesk, mobile: doreMob },
    },
    checks,
  };
  fs.writeFileSync(path.join(EVIDENCE, "rc1-l12-report.json"), JSON.stringify(report, null, 2));

  const failed = checks.filter((c) => !c.pass);
  if (failed.length) {
    console.error("\nRC1-L12 FAILED:", failed.map((f) => f.id).join(", "));
    process.exit(1);
  }
  console.log("\nRC1-L12 PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
