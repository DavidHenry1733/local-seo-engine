import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const PREVIEW_PATH =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=ai-local-area-page-pilot-v3&area=wombwell";
const LIVE = `https://app.pharmaconnect.uk${PREVIEW_PATH}`;
const LOCAL = `http://127.0.0.1:3001${PREVIEW_PATH}`;
const KEPT_HERO =
  "Pharmacy First is available to people in Wombwell who need NHS advice or treatment for eligible common conditions";
const NEW_DRAFT_MARKERS = [
  "without needing to see a GP first",
  "strong sense of local identity",
  "wider Barnsley area",
  "active community spaces",
  "established routes to healthcare support",
];
const OUT = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-diagnostics/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01-service-to-local/live-preview-check.json",
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
    const text = document.body.innerText || "";
    const html = document.documentElement.innerHTML || "";
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + overflowPad,
      bodyOverflow: document.body.scrollWidth > document.body.clientWidth + overflowPad,
      emptyHeadings: [...document.querySelectorAll("h1,h2,h3")].filter((el) => !(el.textContent || "").trim()).length,
      hero: document.querySelector(".hero-copy p")?.textContent?.trim() || "",
      h1: document.querySelector("h1")?.textContent?.trim() || "",
      title: document.title,
      telLinks: [...document.querySelectorAll('a[href^="tel:"]')].length,
      mainServiceLinks: [...document.querySelectorAll('a[href*="pharmacy-first"]')].length,
      faqCount: document.querySelectorAll(".faq-q, .cluster-faq-item").length,
      login: /sign in|log in|password/i.test(text) && !/Pharmacy First/i.test(document.querySelector("h1")?.textContent || ""),
      hasKeptHero: text.includes(args.KEPT_HERO),
      hasHeritageGroup: /Wombwell Heritage Group/.test(text),
      hasSouthAreaCouncil: /South Area Council/.test(text),
      newDraftMarkersPresent: args.NEW_DRAFT_MARKERS.filter((m) => text.includes(m)),
      hasSoreThroat: /sore throat/i.test(text),
      hasConsultation: /What happens during the consultation/i.test(text),
      hasContactAction: /Contact the pharmacy|tel:01226/i.test(html),
      hasMarkers: /%%[A-Z_]+%%/.test(html),
      hasDarfield: /Darfield/.test(text),
    };
  }, { KEPT_HERO, NEW_DRAFT_MARKERS });
}

async function checkUrl(browser, url, label) {
  const page = await browser.newPage();
  const response = await page.goto(withToken(url), { waitUntil: "domcontentloaded", timeout: 30000 });
  const status = response?.status() || 0;
  const desktop = await inspect(page, 1280, 800);
  const mobile = await inspect(page, 390, 844);
  await page.close();
  return {
    label,
    status,
    servesKept14_21Copy: desktop.hasKeptHero === true,
    servesNewRejectedDraft: desktop.newDraftMarkersPresent.length > 0,
    desktop,
    mobile,
  };
}

async function main() {
  const health = await fetch("http://127.0.0.1:3001/health").then((r) => r.json()).catch((err) => ({ error: String(err) }));
  const browser = await chromium.launch({ headless: true });
  const local = await checkUrl(browser, LOCAL, "local");
  const live = await checkUrl(browser, LIVE, "live");
  await browser.close();
  const payload = {
    health,
    previewUrl: LIVE,
    servesNewCopy: false,
    servesPrevious14_21Candidate: local.servesKept14_21Copy && live.servesKept14_21Copy,
    local,
    live,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload, null, 2));
  if (health?.status !== "ok") process.exitCode = 1;
  if (!payload.servesPrevious14_21Candidate || payload.local.servesNewRejectedDraft || payload.live.servesNewRejectedDraft) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
