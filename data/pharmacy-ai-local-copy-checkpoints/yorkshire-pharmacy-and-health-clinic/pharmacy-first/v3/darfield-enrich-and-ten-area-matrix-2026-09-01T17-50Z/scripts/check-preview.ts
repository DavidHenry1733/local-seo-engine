import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const WOMBWELL =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=ai-local-strategy-variant-v3&area=wombwell";
const DARFIELD =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=ai-local-strategy-variant-v3&area=darfield";
const ACCEPTED_DARFIELD =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=ai-local-area-page-pilot-v3&area=darfield";
const ACCEPTED_WOMBWELL =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=ai-local-area-page-pilot-v3&area=wombwell";
const LIVE = "https://app.pharmaconnect.uk";
const LOCAL = "http://127.0.0.1:3001";
const OUT = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-checkpoints/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/darfield-enrich-and-ten-area-matrix-2026-09-01T17-50Z/review/live-preview-check.json",
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
    const text = document.body.innerText || "";
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
      churchStreet: /Church Street/i.test(text),
      regularActivities: /regular activities and special events/i.test(text),
      historySociety: /Darfield History Society/i.test(text),
      garlandHouse: /Garland House Surgery/i.test(text),
      usingInDarfield: /Using Pharmacy First in Darfield/i.test(text),
      usingFromDarfield: /Using Pharmacy First from Darfield/i.test(text),
      gpWait: /waiting for a routine GP slot/i.test(text),
      wombwellLeak: /Wombwell Heritage Group|Roly Poly|Wishing Tree/i.test(text),
      soreThroat: /sore throat/i.test(text),
      emergency: /Seek urgent medical care for breathing difficulties/i.test(text),
      journeyHeading: /Why Darfield patients start with the pharmacist/i.test(text),
    };
  });
}

async function main() {
  const healthRaw = await fetch("http://127.0.0.1:3001/health").then((r) => r.text());
  let healthJson: unknown = null;
  let healthOk = false;
  try {
    healthJson = JSON.parse(healthRaw);
    healthOk = (healthJson as { status?: string }).status === "ok";
  } catch {
    healthOk = false;
  }

  const exec = fs.existsSync("/root/.cache/ms-playwright/chromium-1148/chrome-linux/chrome")
    ? "/root/.cache/ms-playwright/chromium-1148/chrome-linux/chrome"
    : undefined;
  const browser = await chromium.launch({ executablePath: exec, headless: true });
  const results: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    health: { raw: healthRaw, json: healthJson, ok: healthOk },
  };
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${LIVE}${DARFIELD}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    results.darfieldUnauthenticated = { finalUrl: page.url() };

    for (const [key, route] of [
      ["darfieldDesktop", DARFIELD],
      ["wombwellDesktop", WOMBWELL],
      ["acceptedDarfieldDesktop", ACCEPTED_DARFIELD],
      ["acceptedWombwellDesktop", ACCEPTED_WOMBWELL],
    ] as const) {
      await page.goto(withToken(`${LIVE}${route}`), { waitUntil: "domcontentloaded", timeout: 45000 });
      results[key] = { url: publicUrl(page.url()), ...(await inspect(page, 1280, 800)) };
    }
    await page.goto(withToken(`${LIVE}${DARFIELD}`), { waitUntil: "domcontentloaded", timeout: 45000 });
    results.darfieldMobile = { url: publicUrl(page.url()), ...(await inspect(page, 390, 844)) };
    await page.goto(withToken(`${LOCAL}${DARFIELD}`), { waitUntil: "domcontentloaded", timeout: 45000 });
    results.darfieldLocal = { url: publicUrl(page.url()), ...(await inspect(page, 1280, 800)) };
    await page.goto(withToken(`${LOCAL}${DARFIELD}`), { waitUntil: "domcontentloaded", timeout: 45000 });
    results.darfieldLocalMobile = { url: publicUrl(page.url()), ...(await inspect(page, 390, 844)) };
  } finally {
    await browser.close();
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify({
    out: OUT,
    healthOk,
    darfieldDesktop: (results.darfieldDesktop as Record<string, unknown>) || null,
    darfieldLocal: {
      churchStreet: (results.darfieldLocal as { churchStreet?: boolean })?.churchStreet,
      usingFromDarfield: (results.darfieldLocal as { usingFromDarfield?: boolean })?.usingFromDarfield,
      gpWait: (results.darfieldLocal as { gpWait?: boolean })?.gpWait,
      overflowX: (results.darfieldLocal as { overflowX?: boolean })?.overflowX,
      headings: (results.darfieldLocal as { headings?: string[] })?.headings,
    },
    acceptedDarfieldStillJourney: (results.acceptedDarfieldDesktop as { journeyHeading?: boolean })?.journeyHeading,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
