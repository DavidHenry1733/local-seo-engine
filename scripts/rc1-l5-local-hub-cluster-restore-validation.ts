#!/usr/bin/env npx tsx
/**
 * RC1-L5 — Restore full hub/cluster engine + browser validation.
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

const BANNER = "banner-cross-pharmacy";
const BROOK = resolveTenantProfileSlug("brook-pharmacy") || "broom-lane-pharmacy";
const SERVICE = "pharmacy-first";
const PREVIEW = "https://app.pharmaconnect.uk";
const EVIDENCE = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  BANNER,
  "rc1-l5-local-hub-cluster-restore",
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
  return {
    words,
    h1: main.find("h1").length,
    sections: main.find("section").length,
    substantive,
    faq: main.find("section.faq, [data-template-block='faq']").length,
    ds: $("body").attr("data-publish-source") || "",
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
  wordFloor: number,
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
  const body = await resp!.body();
  const canFile = url.includes(BANNER)
    ? resolveCanonicalFinalRenderPagePath(
        BANNER,
        url.match(/pharmacy-visual-experience\/([^/?]+)/)?.[1] || "",
      )
    : null;
  const parity = canFile && fs.existsSync(canFile) ? crypto.createHash("sha256").update(body).digest("hex") === metrics(fs.readFileSync(canFile, "utf8")).sha : true;
  const dom = await page.evaluate(() => {
    const main = document.querySelector("main");
    const words = main
      ? main.innerText.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length
      : 0;
    const substantive = [...document.querySelectorAll("main section")].filter(
      (s) => (s as HTMLElement).innerText.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length >= 25,
    ).length;
    const orphan = [...document.querySelectorAll("main > section")].filter((s) => {
      const t = (s as HTMLElement).innerText.replace(/\s+/g, " ").trim();
      return s.querySelector("img") && t.split(/\s+/).filter(Boolean).length < 8;
    }).length;
    return {
      words,
      h1: Boolean(document.querySelector("main h1")),
      substantive,
      faq: Boolean(document.querySelector("main section.faq, main [data-template-block='faq']")),
      cta: Boolean(document.querySelector("main .cta-band, main .money-page-band, main a[href*='tel:']")),
      breadcrumb: Boolean(document.querySelector('[aria-label="Breadcrumb"]')),
      links: document.querySelectorAll("main a[href]").length,
      orphan,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
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
    dom.substantive >= 7 &&
    dom.words >= wordFloor &&
    dom.faq &&
    dom.cta &&
    dom.breadcrumb &&
    dom.links >= 3 &&
    dom.orphan === 0 &&
    dom.overflow <= 0 &&
    filteredConsole.length === 0;
  return { pass, parity, dom, url };
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const before: Record<string, ReturnType<typeof metrics>> = {};
  for (const [key, slug] of [
    ["hub", "local-hub"],
    ["ecclesall", "local-cluster-ecclesall"],
    ["fulwood", "local-cluster-fulwood"],
    ["area", "local-sheffield-city-centre"],
  ] as const) {
    const f = resolveCanonicalFinalRenderPagePath(BANNER, slug)!;
    before[key] = metrics(fs.readFileSync(f, "utf8"));
  }

  const ctx = buildContentGenerationContext(BANNER, SERVICE);
  const hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
  if (!hierarchy.ok) throw new Error(hierarchy.blockedReason || "hierarchy blocked");

  const regen = regenerateLocalHubAndClusterPagesOnly(ctx, hierarchy);
  mergeLocalHubClusterAssetsIntoEcosystemIndex(BANNER, SERVICE, regen.assets, hierarchy);
  await rebuildCanonicalLocalPagesOnly(BANNER, SERVICE);

  const after: Record<string, ReturnType<typeof metrics>> = {};
  for (const [key, slug] of [
    ["hub", "local-hub"],
    ["ecclesall", "local-cluster-ecclesall"],
    ["fulwood", "local-cluster-fulwood"],
    ["area", "local-sheffield-city-centre"],
  ] as const) {
    after[key] = metrics(fs.readFileSync(resolveCanonicalFinalRenderPagePath(BANNER, slug)!, "utf8"));
  }

  const brookRefPath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    BROOK,
    SERVICE,
    "local/wickersley/index.html",
  );
  const brookRef = fs.existsSync(brookRefPath) ? metrics(fs.readFileSync(brookRefPath, "utf8")) : null;

  const secret = loadSecret();
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(EXEC) ? EXEC : undefined,
    args: ["--no-sandbox"],
  });

  const brookUrl = `${PREVIEW}/api/pharmacy-visual-experience/local-wickersley/?slug=${encodeURIComponent(BROOK)}`;
  const urls = {
    brook: brookUrl,
    hub: `${PREVIEW}/api/pharmacy-visual-experience/local-hub/?slug=${BANNER}`,
    ecclesall: `${PREVIEW}/api/pharmacy-visual-experience/local-cluster-ecclesall/?slug=${BANNER}`,
    fulwood: `${PREVIEW}/api/pharmacy-visual-experience/local-cluster-fulwood/?slug=${BANNER}`,
  };

  const browserOut: Record<string, unknown> = {};
  browserOut.brookDesktop = await browserCheck(
    browser,
    brookUrl,
    secret,
    { w: 1440, h: 900, label: "desktop" },
    path.join(EVIDENCE, "brook-reference-desktop.png"),
    400,
  );
  for (const [key, url, floor] of [
    ["hubDesktop", urls.hub, 500],
    ["hubMobile", urls.hub, 500],
    ["eccDesktop", urls.ecclesall, 450],
    ["eccMobile", urls.ecclesall, 450],
    ["fulDesktop", urls.fulwood, 450],
    ["fulMobile", urls.fulwood, 450],
  ] as const) {
    browserOut[key] = await browserCheck(
      browser,
      url,
      secret,
      key.includes("Mobile") ? { w: 390, h: 844, label: "mobile" } : { w: 1440, h: 900, label: "desktop" },
      path.join(EVIDENCE, `${key}.png`),
      floor,
    );
  }
  await browser.close();

  const report = { before, after, brookRef, brookRefPath, browserOut, urls, brookTenant: BROOK };
  fs.writeFileSync(path.join(EVIDENCE, "rc1-l5-report.json"), JSON.stringify(report, null, 2));

  console.log("before hub words", before.hub.words, "after", after.hub.words);
  console.log("area unchanged sha", before.area.sha === after.area.sha);
  for (const k of Object.keys(browserOut)) {
    console.log(k, (browserOut[k] as { pass: boolean }).pass ? "PASS" : "FAIL");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
