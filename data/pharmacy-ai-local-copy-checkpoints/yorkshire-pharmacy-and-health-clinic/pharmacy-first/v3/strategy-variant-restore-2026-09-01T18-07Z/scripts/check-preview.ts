import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const WOMBWELL =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=ai-local-strategy-variant-v3&area=wombwell";
const DARFIELD =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=ai-local-strategy-variant-v3&area=darfield";
const ACCEPTED_WOMBWELL =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=ai-local-area-page-pilot-v3&area=wombwell";
const LIVE = "https://app.pharmaconnect.uk";
const LOCAL = "http://127.0.0.1:3001";
const OUT = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-checkpoints/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/strategy-variant-restore-2026-09-01T18-07Z/review/live-preview-check.json",
);

const require = createRequire(import.meta.url);
const eco = require(path.join(ROOT, "ecosystem.config.cjs"));
const secret = eco?.apps?.[0]?.env?.SESSION_SECRET || "";
if (!secret) throw new Error("SESSION_SECRET missing");

function withToken(url: string): string {
  const u = new URL(url);
  u.searchParams.set("_t", secret);
  return u.toString();
}

function publicUrl(url: string): string {
  const u = new URL(url);
  u.searchParams.delete("_t");
  return u.toString();
}

async function inspect(page: import("playwright").Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.waitForLoadState("domcontentloaded");
  return page.evaluate(() => {
    const overflowPad = 1;
    const docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + overflowPad;
    const bodyOverflow = document.body.scrollWidth > document.body.clientWidth + overflowPad;
    const headings = [...document.querySelectorAll("main h2")].map((el) => (el.textContent || "").replace(/\s+/g, " ").trim());
    const links = [...document.querySelectorAll("a[href]")].map((el) => (el as HTMLAnchorElement).getAttribute("href") || "");
    const broken = links.filter((href) => href === "#" || href.trim() === "");
    const banner = document.querySelector("[data-component='strategy-variant-banner']")?.textContent || "";
    const robots = document.querySelector('meta[name="robots"]')?.getAttribute("content") || "";
    return {
      title: document.title,
      banner,
      robots,
      headings,
      linkCount: links.length,
      emptyOrHashLinks: broken.length,
      overflowX: docOverflow || bodyOverflow,
      approvalControlFound: Boolean(document.querySelector("[data-approval-control]")),
      approveOrPublishButton: Boolean(
        [...document.querySelectorAll("button, [data-approval-control]")].some((el) =>
          /^(?:Approve|Publish)\b/i.test((el.textContent || "").trim()),
        ),
      ),
    };
  });
}

async function main() {
  const exec = fs.existsSync("/root/.cache/ms-playwright/chromium-1148/chrome-linux/chrome")
    ? "/root/.cache/ms-playwright/chromium-1148/chrome-linux/chrome"
    : undefined;
  const browser = await chromium.launch({ executablePath: exec, headless: true });
  const results: Record<string, unknown> = { generatedAt: new Date().toISOString() };
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${LIVE}${WOMBWELL}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    results.wombwellUnauthenticated = { status: page.url(), finalUrl: page.url() };

    for (const [key, route] of [
      ["wombwellDesktop", WOMBWELL],
      ["darfieldDesktop", DARFIELD],
      ["acceptedWombwellDesktop", ACCEPTED_WOMBWELL],
    ] as const) {
      await page.goto(withToken(`${LIVE}${route}`), { waitUntil: "domcontentloaded", timeout: 45000 });
      results[key] = { url: publicUrl(page.url()), ...(await inspect(page, 1280, 800)) };
    }
    await page.goto(withToken(`${LIVE}${WOMBWELL}`), { waitUntil: "domcontentloaded", timeout: 45000 });
    results.wombwellMobile = { url: publicUrl(page.url()), ...(await inspect(page, 390, 844)) };
    await page.goto(withToken(`${LIVE}${DARFIELD}`), { waitUntil: "domcontentloaded", timeout: 45000 });
    results.darfieldMobile = { url: publicUrl(page.url()), ...(await inspect(page, 390, 844)) };

    await page.goto(withToken(`${LOCAL}${WOMBWELL}`), { waitUntil: "domcontentloaded", timeout: 45000 });
    results.wombwellLocal = { url: publicUrl(page.url()), ...(await inspect(page, 1280, 800)) };
  } finally {
    await browser.close();
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`);
  console.log(OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
