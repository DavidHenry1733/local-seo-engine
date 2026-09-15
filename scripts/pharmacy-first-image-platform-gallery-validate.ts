#!/usr/bin/env npx tsx
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { listPharmacyFirstMetadataV11 } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformPharmacyFirstPopulation.ts";

function loadSecrets(): void {
  try {
    const requireCjs = createRequire(import.meta.url);
    const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
      apps?: Array<{ env?: { SESSION_SECRET?: string } }>;
    };
    const sec = eco.apps?.[0]?.env?.SESSION_SECRET;
    if (sec) process.env.SESSION_SECRET = sec;
  } catch {
    /* optional */
  }
}

const BASE = process.env.IMAGE_PLATFORM_GALLERY_BASE || "https://app.pharmaconnect.uk";
const evidenceDir = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-image-platform/reports/pharmacy-first-v11");

async function runViewport(label: "desktop" | "mobile", width: number, height: number) {
  loadSecrets();
  const homePlaywright = "/home/inboxingproweb/.cache/ms-playwright";
  if (fs.existsSync(homePlaywright)) process.env.PLAYWRIGHT_BROWSERS_PATH = homePlaywright;

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width, height },
    extraHTTPHeaders: process.env.SESSION_SECRET
      ? { Authorization: `Bearer ${process.env.SESSION_SECRET}` }
      : {},
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("requestfailed", (r) => {
    if (/pharmacy-image-platform\/media/.test(r.url())) failed.push(r.url());
  });

  const url = `${BASE}/api/pharmacy-image-platform/review/pharmacy-first`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) resolve();
            else {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }
          }),
      ),
    );
  });
  const imgs = await page.$$eval("img", (nodes) =>
    nodes.map((img) => ({
      src: (img as HTMLImageElement).src,
      nw: (img as HTMLImageElement).naturalWidth,
      nh: (img as HTMLImageElement).naturalHeight,
    })),
  );

  const expected = listPharmacyFirstMetadataV11().filter((a) => a.approvalStatus === "approved").length;
  const shot = path.join(evidenceDir, `gallery-${label}.png`);
  await page.screenshot({ path: shot, fullPage: true });

  const pass =
    imgs.length >= expected &&
    imgs.every((i) => i.nw > 0 && i.nh > 0) &&
    failed.length === 0 &&
    consoleErrors.filter((e) => !/favicon/i.test(e)).length === 0;

  await browser.close();
  return { label, pass, url, expected, imgCount: imgs.length, imgs, consoleErrors, failed, screenshot: shot };
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const desktop = await runViewport("desktop", 1366, 900);
  const mobile = await runViewport("mobile", 390, 844);
  const out = { desktop, mobile, pass: desktop.pass && mobile.pass };
  fs.writeFileSync(path.join(evidenceDir, "gallery-validation.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (!out.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
