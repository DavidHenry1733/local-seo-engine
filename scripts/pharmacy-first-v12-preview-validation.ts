#!/usr/bin/env npx tsx
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "/home/inboxingproweb/.cache/ms-playwright";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { RC1_IMG1_PAGE_SLOT_PLANS } from "../src/pharmacy/pharmacyImageLibraryAssignmentService.ts";

const BASE = process.env.V12_PREVIEW_BASE || "https://app.pharmaconnect.uk";
const SLUG = "banner-cross-pharmacy";

const PAGES = [
  { key: "homepage", url: `${BASE}/api/pharmacy-visual-experience/?slug=${SLUG}`, type: "homepage" },
  { key: "service", url: `${BASE}/api/pharmacy-visual-experience/pharmacy-first/?slug=${SLUG}`, type: "service" },
  { key: "guide", url: `${BASE}/api/pharmacy-visual-experience/pharmacy-first-guide/?slug=${SLUG}`, type: "guide" },
  { key: "blog", url: `${BASE}/api/pharmacy-visual-experience/what-is-pharmacy-first/?slug=${SLUG}`, type: "blog" },
];

function loadSecret() {
  const requireCjs = createRequire(import.meta.url);
  const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
    apps?: Array<{ env?: { SESSION_SECRET?: string } }>;
  };
  return eco.apps?.[0]?.env?.SESSION_SECRET || "";
}

const PLAYWRIGHT_EXECUTABLE =
  "/home/inboxingproweb/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";

async function validateViewport(label: "desktop" | "mobile", width: number, height: number) {
  const secret = loadSecret();
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    executablePath: fs.existsSync(PLAYWRIGHT_EXECUTABLE) ? PLAYWRIGHT_EXECUTABLE : undefined,
  });
  const context = await browser.newContext({
    viewport: { width, height },
    extraHTTPHeaders: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("requestfailed", (r) => {
    if (/\.(webp|jpg|jpeg|png|svg)/i.test(r.url())) failed.push(r.url());
  });

  const pageResults: Record<string, unknown> = {};
  const usedAssets = new Set<string>();

  for (const p of PAGES) {
    await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    for (const slot of ["hero", "support", "trust", "conversion"]) {
      const loc = page.locator(`img[data-image-slot="${slot}"]`).first();
      if (await loc.count()) {
        await loc.scrollIntoViewIfNeeded();
      }
    }
    await page.waitForTimeout(1500);
    const shot = path.join(evidenceDir, `${p.key}-${label}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    const imgs = await page.$$eval("[data-image-slot] img", (nodes) =>
      nodes.map((img) => {
        const el = img as HTMLImageElement;
        return {
          slot: el.getAttribute("data-image-slot"),
          source: el.getAttribute("data-image-source"),
          assetId: el.getAttribute("data-platform-asset-id"),
          src: el.src,
          nw: el.naturalWidth,
          nh: el.naturalHeight,
          alt: el.alt,
        };
      }),
    );

    const expectedSlots = RC1_IMG1_PAGE_SLOT_PLANS.filter((pl) => pl.pageType === p.type).map((pl) => pl.slot);
    const legacy = imgs.filter((i) => /pharmacy-image-library.*\.svg/i.test(i.src));
    const placeholders = imgs.filter((i) => i.nw === 0 || i.nh === 0);
    const nonPlatform = imgs.filter((i) => i.source !== "pharmacy-image-platform");
    const orphans = await page.$$eval(
      `main > figure.eco-image-slot--support, main > figure.eco-image-slot--conversion`,
      (n) => n.length,
    );

    for (const img of imgs) {
      if (img.assetId) usedAssets.add(img.assetId);
    }

    pageResults[p.key] = {
      url: p.url,
      expectedSlots: expectedSlots.length,
      imgCount: imgs.length,
      legacySvg: legacy.length,
      placeholders: placeholders.length,
      nonPlatform: nonPlatform.length,
      orphanBeforeFooter: orphans,
      pass:
        imgs.length >= expectedSlots.length &&
        legacy.length === 0 &&
        placeholders.length === 0 &&
        nonPlatform.length === 0 &&
        orphans === 0,
      imgs,
      screenshot: shot,
    };
  }

  await browser.close();
  const filteredConsole = consoleErrors.filter(
    (e) =>
      !/Access to font at .* has been blocked by CORS policy/i.test(e) &&
      !/favicon/i.test(e) &&
      !/Google Maps JavaScript API/i.test(e) &&
      !/gmp-place-details/i.test(e) &&
      !/^Failed to load resource: net::ERR_FAILED$/i.test(e.trim()),
  );
  const pass =
    Object.values(pageResults).every((r) => (r as { pass: boolean }).pass) &&
    filteredConsole.length === 0 &&
    failed.length === 0;
  return { label, pass, pageResults, consoleErrors: filteredConsole, failed, duplicateAssetIds: usedAssets.size < 14 };
}

const evidenceDir = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  SLUG,
  "rc1-v12-image-platform-integration",
);
fs.mkdirSync(evidenceDir, { recursive: true });

async function main() {
  const desktop = await validateViewport("desktop", 1366, 900);
  const mobile = await validateViewport("mobile", 390, 844);
  const out = { desktop, mobile, pass: desktop.pass && mobile.pass };
  fs.writeFileSync(path.join(evidenceDir, "preview-validation.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (!out.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
