import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const HTML_FILE = path.join(
  ROOT,
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/local/darfield/index.html",
);
const PREVIEW_PATH =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=ai-local-area-page-pilot-v3&area=darfield";
const WOMBWELL_PATH =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=ai-local-area-page-pilot-v3&area=wombwell";
const LIVE = `https://app.pharmaconnect.uk${PREVIEW_PATH}`;
const LOCAL = `http://127.0.0.1:3001${PREVIEW_PATH}`;
const OUT = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-diagnostics/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/darfield/2026-09-01-demo-standard/live-preview-check.json",
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

async function inspect(page: import("playwright").Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.waitForLoadState("domcontentloaded");
  return page.evaluate(() => {
    const overflowPad = 1;
    const docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + overflowPad;
    const bodyOverflow = document.body.scrollWidth > document.body.clientWidth + overflowPad;
    const text = document.body.innerText || "";
    const html = document.documentElement.innerHTML || "";
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      docOverflow,
      bodyOverflow,
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() || "",
      hero: document.querySelector(".hero-copy p")?.textContent?.trim() || "",
      telLinks: [...document.querySelectorAll('a[href^="tel:"]')].length,
      brokenHashLinks: [...document.querySelectorAll("a[href]")].filter((a) => (a.getAttribute("href") || "").trim() === "#").length,
      login: /sign in|log in|password/i.test(text) && !/Pharmacy First/i.test(document.querySelector("h1")?.textContent || ""),
      banner: /AI editorial evidence pilot — not published/i.test(text),
      noindex: /noindex/i.test(html),
      hasNewHero: /Pharmacy First is available in Darfield/.test(text),
      hasHistorySociety: /Darfield History Society/.test(text),
      hasGarlandHouse: /Garland House Surgery/.test(text),
      hasInDarfieldPharmacy: /Yorkshire Pharmacy & Health Clinic in Darfield/.test(text),
      hasWombwell: /\bWombwell\b/.test(text),
      hasUnicorn: /unicorn emblem/.test(text),
      hasSoreThroat: /sore throat/i.test(text),
      hasConsultation: /What happens during the consultation/i.test(text),
      hasUrgent: /Seek urgent medical care/i.test(text),
      hasBook: /Book An Appointment/i.test(text),
      hasMarkers: /%%[A-Z_]+%%/.test(html),
    };
  });
}

async function main() {
  const health = await fetch("http://127.0.0.1:3001/health").then((r) => r.json()).catch((err) => ({ error: String(err) }));
  const unauth = await fetch(LOCAL, { redirect: "manual" }).then((r) => ({ status: r.status, location: r.headers.get("location") }));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const localAuth = withToken(LOCAL);
  const liveAuth = withToken(LIVE);
  await page.goto(localAuth, { waitUntil: "domcontentloaded", timeout: 30000 });
  const desktop = await inspect(page, 1280, 800);
  const mobile = await inspect(page, 390, 844);
  await page.goto(liveAuth, { waitUntil: "domcontentloaded", timeout: 30000 });
  const liveDesktop = await inspect(page, 1280, 800);
  await page.goto(withToken(`https://app.pharmaconnect.uk${WOMBWELL_PATH}`), { waitUntil: "domcontentloaded", timeout: 30000 });
  const wombwell = await inspect(page, 1280, 800);
  await browser.close();
  const html = fs.readFileSync(HTML_FILE, "utf8");
  const payload = {
    health,
    unauthenticatedPreview: unauth,
    localDesktop: desktop,
    localMobile: mobile,
    liveDesktop,
    wombwellStillWombwell: {
      hasWombwell: wombwell.hasWombwell,
      hasHistorySociety: wombwell.hasHistorySociety,
      hasGarlandHouse: wombwell.hasGarlandHouse,
      hasUnicorn: wombwell.hasUnicorn,
      hero: wombwell.hero,
    },
    fileHasPilotBanner: /AI editorial evidence pilot — not published/.test(html),
    fileHasNewCopy: /Darfield History Society/.test(html) && /Garland House Surgery/.test(html),
    fileHasNoWombwellFacts: !/\bWombwell\b/.test(html) && !/unicorn emblem/.test(html),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
