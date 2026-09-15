#!/usr/bin/env npx tsx
/**
 * RC1-L4 — Local canonical body completeness + preview parity (Playwright mandatory).
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
import {
  generateLocalLocationHierarchyPages,
  mergeLocalAssetsIntoEcosystemIndex,
} from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import { rebuildCanonicalLocalPagesOnly, resolveCanonicalFinalRenderPagePath } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { rewritePublishHtmlForStaticHosting } from "../src/pharmacy/pharmacyPublishPackageAssembler.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SLUG = "banner-cross-pharmacy";
const SERVICE = "pharmacy-first";
const PREVIEW_HOST = "https://app.pharmaconnect.uk";
const EVIDENCE = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-publish", SLUG, "rc1-l4-local-body-loss");
const EXEC = "/home/inboxingproweb/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";

const PAGES = [
  { key: "hub", slug: "local-hub", floor: 500, type: "hub" as const },
  { key: "cluster", slug: "local-cluster-ecclesall", floor: 450, type: "cluster" as const },
  { key: "area1", slug: "local-sheffield-city-centre", floor: 400, type: "area" as const },
  { key: "area2", slug: "local-broomhill", floor: 400, type: "area" as const },
];

function sha256File(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function mainMetrics(html: string) {
  const $ = cheerio.load(html);
  const main = $("main").first();
  const words = main.text().replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return {
    words,
    h1: main.find("h1").length,
    sections: main.find("section").length,
    p: main.find("p").length,
    faq: main.find('[data-template-block="faq"], .faq-section, section.faq').length,
    breadcrumb: $('[aria-label="Breadcrumb"]').length,
    cta: main.find('.cta-band, .money-page-band, a[href*="tel:"]').length,
    imgs: main.find("img").length,
    mainSha: crypto.createHash("sha256").update(main.html() || "").digest("hex"),
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

  const before: Record<string, ReturnType<typeof mainMetrics> & { path: string }> = {};
  for (const p of PAGES) {
    const file = resolveCanonicalFinalRenderPagePath(SLUG, p.slug)!;
    before[p.key] = { path: file, ...mainMetrics(fs.readFileSync(file, "utf8")) };
  }

  const ctx = buildContentGenerationContext(SLUG, SERVICE);
  const gen = generateLocalLocationHierarchyPages(ctx);
  mergeLocalAssetsIntoEcosystemIndex(SLUG, SERVICE, gen);
  await rebuildCanonicalLocalPagesOnly(SLUG, SERVICE);

  const after: Record<string, ReturnType<typeof mainMetrics>> = {};
  const ecoMainSha: Record<string, string> = {};
  const ecoRoot = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", SLUG, SERVICE);
  const ecoMap: Record<string, string> = {
    hub: "local/hub/index.html",
    cluster: "local/cluster-ecclesall/index.html",
    area1: "local/sheffield-city-centre/index.html",
    area2: "local/broomhill/index.html",
  };
  for (const p of PAGES) {
    const can = fs.readFileSync(resolveCanonicalFinalRenderPagePath(SLUG, p.slug)!, "utf8");
    after[p.key] = mainMetrics(can);
    const eco = fs.readFileSync(path.join(ecoRoot, ecoMap[p.key]), "utf8");
    const ecoPrepared = rewritePublishHtmlForStaticHosting(eco, SLUG, SERVICE);
    ecoMainSha[p.key] = crypto.createHash("sha256").update(cheerio.load(ecoPrepared)("main").html() || "").digest("hex");
  }

  const secret = loadSecret();
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(EXEC) ? EXEC : undefined,
    args: ["--no-sandbox"],
  });

  const browserOut: Record<string, unknown> = {};
  for (const p of PAGES) {
    for (const vp of [
      { label: "desktop", width: 1440, height: 900 },
      { label: "mobile", width: 390, height: 844 },
    ]) {
      const url = `${PREVIEW_HOST}/api/pharmacy-visual-experience/${encodeURIComponent(p.slug)}/?slug=${encodeURIComponent(SLUG)}`;
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        extraHTTPHeaders: secret ? { Authorization: `Bearer ${secret}` } : {},
      });
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      const failed: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      page.on("requestfailed", (r) => {
        const u = r.url();
        if (/fonts\.googleapis|fonts\.gstatic/i.test(u)) return;
        if (/\.(webp|jpg|jpeg|png|svg|css|woff2?)/i.test(u) && (u.includes("/assets/") || u.includes("pharmaconnect"))) {
          failed.push(u);
        }
      });
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
      const body = await resp!.body();
      const canFile = resolveCanonicalFinalRenderPagePath(SLUG, p.slug)!;
      const canBuf = fs.readFileSync(canFile);
      const dom = await page.evaluate(() => {
        const main = document.querySelector("main");
        const words = main
          ? main.innerText.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length
          : 0;
        const h1 = Boolean(document.querySelector("main h1")?.textContent?.trim());
        const sections = [...document.querySelectorAll("main section")].filter(
          (s) => (s as HTMLElement).innerText.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length >= 25,
        ).length;
        const orphanImgSections = [...document.querySelectorAll("main > section")].filter((s) => {
          const t = (s as HTMLElement).innerText.replace(/\s+/g, " ").trim();
          return s.querySelector("img") && t.split(/\s+/).filter(Boolean).length < 8;
        }).length;
        return {
          words,
          h1,
          substantiveSections: sections,
          breadcrumb: Boolean(document.querySelector('[aria-label="Breadcrumb"]')),
          links: document.querySelectorAll("main a[href]").length,
          faq: Boolean(document.querySelector('main [data-template-block="faq"], main section.faq')),
          cta: Boolean(document.querySelector('main .cta-band, main .money-page-band, main a[href*="tel:"]')),
          orphanImgSections,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      await page.screenshot({ path: path.join(EVIDENCE, `${p.key}-${vp.label}.png`), fullPage: true });
      await context.close();

      const parity = sha256(body) === sha256(canBuf);
      const filteredConsole = consoleErrors.filter(
        (e) =>
          !/favicon|Google Maps|Access to font.*CORS/i.test(e) &&
          !/Failed to load resource/i.test(e),
      );
      const meetsWordFloor = dom.words >= p.floor;
      const pass =
        resp?.ok() &&
        parity &&
        dom.h1 &&
        dom.substantiveSections >= 4 &&
        dom.breadcrumb &&
        dom.cta &&
        meetsWordFloor &&
        dom.orphanImgSections === 0 &&
        dom.overflow <= 0 &&
        filteredConsole.length === 0 &&
        failed.length === 0;

      browserOut[`${p.key}-${vp.label}`] = {
        url,
        pass,
        meetsWordFloor,
        parity,
        dom,
        consoleErrors: filteredConsole,
        failedResources: failed,
      };
    }
  }
  await browser.close();

  const report = { before, after, ecoMainSha, browserOut };
  fs.writeFileSync(path.join(EVIDENCE, "rc1-l4-report.json"), JSON.stringify(report, null, 2));

  for (const p of PAGES) {
    console.log(`${p.key} words before→after: ${before[p.key].words}→${after[p.key].words} ecoMainParity=${ecoMainSha[p.key] === after[p.key].mainSha}`);
  }
  for (const k of Object.keys(browserOut)) {
    console.log(k, (browserOut[k] as { pass: boolean }).pass ? "PASS" : "FAIL");
  }
}

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
