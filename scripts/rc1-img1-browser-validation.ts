#!/usr/bin/env npx tsx
/**
 * RC1-IMG1 — Playwright validation for canonical preview image policy.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { buildCanonicalPreviewUrl } from "../src/pharmacy/pharmacyCanonicalFinalRenderPreviewService.ts";

const SLUG = process.argv[2] || "banner-cross-pharmacy";
const BASE = process.env.RC1_IMG1_BASE || "https://app.pharmaconnect.uk";
const SESSION_SECRET = process.env.SESSION_SECRET;

type PageKey = "homepage" | "service" | "guide" | "blog";

const PAGES: PageKey[] = ["homepage", "service", "guide", "blog"];

async function validatePage(page: Page, key: PageKey, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  const url = buildCanonicalPreviewUrl(SLUG, key, BASE);
  const consoleErrors: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("requestfailed", (r) => failed.push(r.url()));

  const resp = await page.goto(url, { waitUntil: "networkidle" });
  const status = resp?.status() ?? 0;

  const imgs = await page.$$eval("main img, article img, .eco-image-slot img", (nodes) =>
    nodes.map((img) => ({
      src: (img as HTMLImageElement).src,
      alt: (img as HTMLImageElement).alt,
      nw: (img as HTMLImageElement).naturalWidth,
      nh: (img as HTMLImageElement).naturalHeight,
      slot: img.getAttribute("data-image-slot"),
      source: img.getAttribute("data-image-source"),
    })),
  );

  const websiteImportContent = imgs.filter((i) => /website-import/i.test(i.src) && !/logo/i.test(i.alt));
  const orphanBeforeFooter = await page.$$eval("main > figure.eco-image-slot--support, main > figure.eco-image-slot--conversion", (n) => n.length);
  const footer = await page.locator("footer.site-footer").count();

  return {
    key,
    viewport: viewport.width <= 480 ? "mobile" : "desktop",
    url,
    status,
    imgCount: imgs.length,
    websiteImportContent: websiteImportContent.length,
    orphanBeforeFooter,
    footerVisible: footer > 0,
    consoleErrors,
    failed,
    imgs,
  };
}

async function main() {
  if (!SESSION_SECRET) {
    console.error("SESSION_SECRET required for preview auth");
    process.exit(1);
  }

  const evidenceDir = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/commercial-publish",
    SLUG,
    "rc1-img1-evidence",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    executablePath: chromium.executablePath(),
  });
  const context = await browser.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${SESSION_SECRET}` },
  });
  const page = await context.newPage();

  const results: Record<string, unknown>[] = [];
  let pass = true;

  for (const key of PAGES) {
    for (const viewport of [
      { width: 1366, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const r = await validatePage(page, key, viewport);
      const shot = path.join(evidenceDir, `${key}-${r.viewport}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      const filteredConsole = r.consoleErrors.filter(
        (e) => !/Access to font at .* has been blocked by CORS policy.*authorization/i.test(e),
      );
      const filteredFailed = r.failed.filter((u) => !/fonts\.gstatic\.com/i.test(u));
      if (
        r.status !== 200 ||
        r.websiteImportContent > 0 ||
        r.orphanBeforeFooter > 0 ||
        filteredConsole.length ||
        filteredFailed.length ||
        r.imgs.some((i) => i.nw <= 0 || i.nh <= 0)
      ) {
        pass = false;
      }
      results.push({ ...r, consoleErrors: filteredConsole, failed: filteredFailed, screenshot: shot });
    }
  }

  fs.writeFileSync(path.join(evidenceDir, "browser-validation.json"), JSON.stringify(results, null, 2));
  await browser.close();
  console.log(JSON.stringify({ pass, results: results.map((r) => ({ key: (r as { key: string }).key, viewport: (r as { viewport: string }).viewport, status: (r as { status: number }).status })) }, null, 2));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
