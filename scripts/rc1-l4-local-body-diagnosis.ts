#!/usr/bin/env npx tsx
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "/home/inboxingproweb/.cache/ms-playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import * as cheerio from "cheerio";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { resolveCanonicalFinalRenderPagePath } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { wrapEcosystemPageWithSiteChrome } from "../src/pharmacy/pharmacyEcosystemPageChromeWrapper.ts";

const SLUG = "banner-cross-pharmacy";
const SERVICE = "pharmacy-first";
const EXEC = "/home/inboxingproweb/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";
const EVIDENCE = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  SLUG,
  "rc1-l4-local-body-loss",
);

const PAGES = [
  { key: "hub", pageSlug: "local-hub", eco: "local/hub/index.html" },
  { key: "cluster", pageSlug: "local-cluster-ecclesall", eco: "local/cluster-ecclesall/index.html" },
  { key: "area1", pageSlug: "local-sheffield-city-centre", eco: "local/sheffield-city-centre/index.html" },
  { key: "area2", pageSlug: "local-broomhill", eco: "local/broomhill/index.html" },
];

function sha256(buf: string | Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function htmlMetrics(html: string) {
  const $ = cheerio.load(html);
  const main = $("main").first();
  const text = main.text().replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean);
  return {
    bodyChars: text.length,
    words: words.length,
    h1: main.find("h1").length,
    h2: main.find("h2").length,
    p: main.find("p").length,
    sections: main.find("section").length,
    faq: main.find('[data-template-block="faq"], details.faq-item, .faq-section').length,
    links: main.find("a[href]").length,
    breadcrumb: $('[aria-label="Breadcrumb"]').length,
    cta: main.find('.money-page-band, .cta-band, a[href*="tel:"]').length,
    imgs: main.find("img").length,
    bodyDS: $("body").attr("data-publish-source") || "",
  };
}

function loadSecret(): string {
  const requireCjs = createRequire(import.meta.url);
  const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
    apps?: Array<{ name?: string; env?: { SESSION_SECRET?: string } }>;
  };
  return eco.apps?.find((a) => a.name === "pharmaconnect-growth-engine")?.env?.SESSION_SECRET || "";
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const ecoRoot = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", SLUG, SERVICE);
  const layers: Record<string, unknown> = {};

  for (const p of PAGES) {
    const ecoFile = path.join(ecoRoot, p.eco);
    const canFile = resolveCanonicalFinalRenderPagePath(SLUG, p.pageSlug)!;
    const ecoHtml = fs.readFileSync(ecoFile, "utf8");
    const canHtml = fs.readFileSync(canFile, "utf8");
    const wrapped = wrapEcosystemPageWithSiteChrome({
      slug: SLUG,
      serviceId: SERVICE,
      sourceHtml: ecoHtml,
      pageSlug: p.pageSlug,
    });
    layers[p.key] = {
      eco: { path: ecoFile, exists: true, size: fs.statSync(ecoFile).size, sha: sha256(ecoHtml), ...htmlMetrics(ecoHtml) },
      wrappedSim: { size: wrapped.length, sha: sha256(wrapped), ...htmlMetrics(wrapped) },
      canonical: { path: canFile, size: fs.statSync(canFile).size, sha: sha256(canHtml), ...htmlMetrics(canHtml) },
      ecoToCanMainParity: sha256(cheerio.load(ecoHtml)("main").html() || "") === sha256(cheerio.load(canHtml)("main").html() || ""),
    };
  }

  fs.writeFileSync(path.join(EVIDENCE, "layer-compare.json"), JSON.stringify(layers, null, 2));

  const secret = loadSecret();
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(EXEC) ? EXEC : undefined,
    args: ["--no-sandbox"],
  });
  const previewHost = "https://app.pharmaconnect.uk";
  const browserResults: Record<string, unknown> = {};

  for (const p of PAGES) {
    const url = `${previewHost}/api/pharmacy-visual-experience/${encodeURIComponent(p.pageSlug)}/?slug=${encodeURIComponent(SLUG)}`;
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const page = await ctx.newPage();
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const previewHtml = await page.content();
    const canFile = resolveCanonicalFinalRenderPagePath(SLUG, p.pageSlug)!;
    const canHtml = fs.readFileSync(canFile, "utf8");
    const dom = await page.evaluate(() => {
      const main = document.querySelector("main");
      const visibleText = main ? main.innerText.replace(/\s+/g, " ").trim() : "";
      const words = visibleText.split(/\s+/).filter(Boolean).length;
      const h1Visible = Boolean(document.querySelector("main h1") && document.querySelector("main h1")!.offsetParent !== null);
      const sections = [...document.querySelectorAll("main section")].map((s) => ({
        cls: s.className,
        words: (s as HTMLElement).innerText.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length,
        imgs: s.querySelectorAll("img").length,
        display: getComputedStyle(s).display,
        visibility: getComputedStyle(s).visibility,
        opacity: getComputedStyle(s).opacity,
      }));
      const orphanImgs = [...document.querySelectorAll("main > section")].filter(
        (s) => s.querySelectorAll("img").length && (s as HTMLElement).innerText.trim().split(/\s+/).length < 8,
      ).length;
      return {
        words,
        h1Visible,
        sectionCount: sections.length,
        sections,
        orphanImageSections: orphanImgs,
        scrollW: document.documentElement.scrollWidth,
        vw: document.documentElement.clientWidth,
      };
    });
    await page.screenshot({ path: path.join(EVIDENCE, `${p.key}-desktop.png`), fullPage: true });
    await ctx.close();
    browserResults[p.key] = {
      url,
      http: resp?.status(),
      previewSha: sha256(previewHtml),
      canonicalSha: sha256(canHtml),
      parity: sha256(previewHtml) === sha256(canHtml) || previewHtml.includes(canHtml.slice(0, 200)),
      dom,
    };
  }
  await browser.close();
  fs.writeFileSync(path.join(EVIDENCE, "browser-results.json"), JSON.stringify(browserResults, null, 2));
  console.log(JSON.stringify({ layers, browserResults }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
