import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const HTML_FILE = path.join(
  ROOT,
  "output/pharmacy-ai-local-page-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/local/wombwell/index.html",
);
const PREVIEW_PATH =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=ai-local-area-page-pilot-v3&area=wombwell";
const LIVE = `https://app.pharmaconnect.uk${PREVIEW_PATH}`;
const LOCAL = `http://127.0.0.1:3001${PREVIEW_PATH}`;
const NEW_HERO = "Pharmacy First is available to people in Wombwell who need NHS advice or treatment for eligible common conditions";
const NEW_LOCAL = "Wombwell Heritage Group";
const OLD_SOUTH = "South Area Council";
const OLD_HERO = "Pharmacy First offers support for common conditions to people in Wombwell";
const OUT = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-diagnostics/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01-live-page/live-preview-check.json",
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

async function inspect(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForLoadState("domcontentloaded");
  return page.evaluate((args) => {
    const overflowPad = 1;
    const docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + overflowPad;
    const bodyOverflow = document.body.scrollWidth > document.body.clientWidth + overflowPad;
    const emptyHeadings = [...document.querySelectorAll("h1,h2,h3")].filter((el) => !(el.textContent || "").trim()).length;
    const emptyLeads = [...document.querySelectorAll(".section-head p, .local-intro-lead, .hero-copy p")].filter(
      (el) => !(el.textContent || "").trim() && getComputedStyle(el).display !== "none",
    ).length;
    const text = document.body.innerText || "";
    const html = document.documentElement.innerHTML || "";
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      docOverflow,
      bodyOverflow,
      emptyHeadings,
      emptyLeads,
      hero: document.querySelector(".hero-copy p")?.textContent?.trim() || "",
      h1: document.querySelector("h1")?.textContent?.trim() || "",
      title: document.title,
      telLinks: [...document.querySelectorAll('a[href^="tel:"]')].length,
      mainServiceLinks: [...document.querySelectorAll('a[href*="pharmacy-first"]')].length,
      faqCount: document.querySelectorAll(".faq-q, .cluster-faq-item").length,
      login: /sign in|log in|password/i.test(text) && !/Pharmacy First/i.test(document.querySelector("h1")?.textContent || ""),
      hasNewHero: text.includes(args.NEW_HERO),
      hasNewLocal: text.includes(args.NEW_LOCAL),
      hasSouthAreaCouncil: text.includes(args.OLD_SOUTH),
      hasOldHero: text.includes(args.OLD_HERO),
      hasSoreThroat: /sore throat/i.test(text),
      hasConsultation: /What happens during the consultation/i.test(text),
      hasContactAction: /Contact the pharmacy|tel:01226/i.test(html),
      hasMarkers: /%%[A-Z_]+%%/.test(html),
      hasDarfield: /Darfield/.test(text),
      hasUnicorn: /unicorn emblem/.test(text),
    };
  }, { NEW_HERO, NEW_LOCAL, OLD_SOUTH, OLD_HERO });
}

async function checkUrl(browser, url, label) {
  const page = await browser.newPage();
  const response = await page.goto(withToken(url), { waitUntil: "domcontentloaded", timeout: 30000 });
  const status = response?.status() || 0;
  const desktop = await inspect(page, 1280, 800);
  const mobile = await inspect(page, 390, 844);
  await page.close();
  return { status, finalUrl: url, desktop, mobile, label };
}

async function main() {
  const stored = fs.readFileSync(HTML_FILE, "utf8");
  const unauthLocal = await fetch(LOCAL);
  const unauthLive = await fetch(LIVE);
  const unauthLocalText = await unauthLocal.text();
  const unauthLiveText = await unauthLive.text();
  const exec =
    fs.existsSync("/root/.cache/ms-playwright/chromium-1148/chrome-linux/chrome")
      ? "/root/.cache/ms-playwright/chromium-1148/chrome-linux/chrome"
      : undefined;
  const browser = await chromium.launch({ executablePath: exec, headless: true });
  const local = await checkUrl(browser, LOCAL, "local");
  const live = await checkUrl(browser, LIVE, "live");
  await browser.close();
  const payload = {
    previewUrl: LIVE,
    localPreviewUrl: LOCAL,
    checkedAt: new Date().toISOString(),
    storedHtmlHasNewCopy: stored.includes(NEW_LOCAL) && stored.includes(NEW_HERO) && !stored.includes(OLD_SOUTH),
    servesNewCopy:
      local.desktop.hasNewHero &&
      local.desktop.hasNewLocal &&
      !local.desktop.hasOldHero &&
      !local.desktop.hasSouthAreaCouncil &&
      live.desktop.hasNewHero &&
      live.desktop.hasNewLocal &&
      !live.desktop.hasOldHero &&
      !live.desktop.hasSouthAreaCouncil,
    unauthenticated: {
      local: { status: unauthLocal.status, login: /login|sign in|password/i.test(unauthLocalText) && !unauthLocalText.includes(NEW_HERO) },
      live: { status: unauthLive.status, login: /login|sign in|password/i.test(unauthLiveText) && !unauthLiveText.includes(NEW_HERO) },
    },
    local,
    live,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        servesNewCopy: payload.servesNewCopy,
        storedHtmlHasNewCopy: payload.storedHtmlHasNewCopy,
        localStatus: local.status,
        liveStatus: live.status,
        localHero: local.desktop.hero,
        liveHero: live.desktop.hero,
        localNew: { hero: local.desktop.hasNewHero, local: local.desktop.hasNewLocal, old: local.desktop.hasOldHero, south: local.desktop.hasSouthAreaCouncil, markers: local.desktop.hasMarkers, overflow: local.desktop.docOverflow || local.mobile.docOverflow },
        liveNew: { hero: live.desktop.hasNewHero, local: live.desktop.hasNewLocal, old: live.desktop.hasOldHero, south: live.desktop.hasSouthAreaCouncil, markers: live.desktop.hasMarkers, overflow: live.desktop.docOverflow || live.mobile.docOverflow },
        clinical: { sore: live.desktop.hasSoreThroat, consult: live.desktop.hasConsultation, contact: live.desktop.hasContactAction, tel: live.desktop.telLinks, serviceLinks: live.desktop.mainServiceLinks, faq: live.desktop.faqCount },
        unauthenticated: payload.unauthenticated,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
