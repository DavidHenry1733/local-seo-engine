/**
 * RC1-C14 — Reliable serial Playwright visual-validation harness.
 * One browser lifecycle per run; helpers never close browser/context.
 */
import fs from "node:fs";
import path from "node:path";
import type { Browser, BrowserContext, Page } from "playwright";
import { chromium } from "playwright";
import {
  TRUTHFUL_VIEWPORTS,
  compareBrowserEvidence,
  computePixelSimilarity,
  passesSiteChromeContract,
  startStaticServer,
  COMPONENT_EXTRACT_SCRIPT,
  type ValidationTarget,
  type ViewportSpec,
  type PageBrowserEvidence,
  type SimilarityVector,
} from "./pharmacyTruthfulVisualValidationService.ts";

export { TRUTHFUL_VIEWPORTS };

export type CaptureStatus = "PASS" | "FAIL" | "COMPONENT NOT FOUND";

export interface CaptureRecord {
  key: string;
  target: ValidationTarget;
  viewport: ViewportSpec["name"];
  url: string;
  status: CaptureStatus;
  error?: string;
  evidence: PageBrowserEvidence | null;
  screenshotPath: string;
  headerCropPath: string;
  navCropPath: string;
  heroCropPath: string;
  footerCropPath: string;
  imageSlotCropPaths: string[];
}

export interface HarnessLifecycleEvent {
  ts: string;
  phase: string;
  detail: string;
  browserPid?: number;
}

export interface HarnessRunResult {
  lifecycle: HarnessLifecycleEvent[];
  captures: CaptureRecord[];
  sourceToCanonicalByViewport: Record<string, SimilarityVector>;
  canonicalToLiveByViewport: Record<string, SimilarityVector>;
  measuredSourceToCanonical: SimilarityVector | null;
  measuredCanonicalToLive: SimilarityVector | null;
  evidenceComplete: boolean;
  serialValidation: "PASS" | "FAIL";
  gateStatus: "PASS" | "FAIL" | "INCOMPLETE";
  failedGateCategories: string[];
  trace: {
    failureScript?: string;
    failureFunction?: string;
    failureLine?: string;
    browserClosedPrematurely: boolean;
    prematureCloseCause?: string;
    duplicateCloseFound: boolean;
    timeoutRaceFound: boolean;
    unhandledAsyncFound: boolean;
    lastSuccessfulOperation?: string;
    firstFailedOperation?: string;
  };
  urls: { source: string; canonical: string; live: string };
}

const READINESS_SCRIPT = String.raw`(async function(){
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch(e) {}
  var style=document.createElement("style");
  style.textContent="*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}";
  document.head.appendChild(style);
  var imgs=Array.from(document.querySelectorAll("img,[data-image-slot] img"));
  await Promise.all(imgs.map(function(img){
    if(img.complete) return Promise.resolve();
    return new Promise(function(resolve){
      img.addEventListener("load", resolve, {once:true});
      img.addEventListener("error", resolve, {once:true});
      setTimeout(resolve, 5000);
    });
  }));
  function height(){ return document.documentElement.scrollHeight; }
  var a=height(); await new Promise(function(r){ setTimeout(r, 250); });
  var b=height(); await new Promise(function(r){ setTimeout(r, 250); });
  return { stable: Math.abs(a-b) < 2, height: b };
})()`;

const CROP_SELECTORS = {
  header: ["header.site-header", "header[data-component='pharmacy-page-header']", "header", "[role='banner']"],
  nav: ["nav.nav-links", "nav", ".main-navigation"],
  hero: ["#hero-section", ".hero", "[data-image-slot='hero']"],
  footer: ["footer.site-footer", "footer#colophon", "footer", "[role='contentinfo']"],
};

function browserPid(browser: Browser): number | undefined {
  try {
    const proc = (browser as Browser & { process?: () => { pid?: number } }).process?.();
    return proc?.pid;
  } catch {
    return undefined;
  }
}

function logEvent(lifecycle: HarnessLifecycleEvent[], phase: string, detail: string, pid?: number) {
  lifecycle.push({ ts: new Date().toISOString(), phase, detail, browserPid: pid });
}

function emptySimilarity(): SimilarityVector {
  return {
    headerSimilarity: 0,
    footerSimilarity: 0,
    navigationSimilarity: 0,
    typographySimilarity: 0,
    spacingSimilarity: 0,
    logoSimilarity: 0,
    colourSimilarity: 0,
    buttonSimilarity: 0,
    componentSimilarity: 0,
    layoutSimilarity: 0,
    imageSimilarity: 0,
    imageSlotCompleteness: 0,
    responsiveSimilarity: 0,
    pixelSimilarity: 0,
    domSimilarity: 0,
    overall: 0,
  };
}

function avgSimilarity(items: SimilarityVector[]): SimilarityVector | null {
  if (!items.length) return null;
  const keys = Object.keys(items[0]) as Array<keyof SimilarityVector>;
  const out = emptySimilarity();
  for (const key of keys) {
    out[key] = Math.round(items.reduce((sum, v) => sum + v[key], 0) / items.length);
  }
  return out;
}

function verifyPng(filePath: string, viewport: ViewportSpec): { ok: boolean; reason?: string } {
  if (!filePath || !fs.existsSync(filePath)) return { ok: false, reason: "missing" };
  const stat = fs.statSync(filePath);
  if (stat.size <= 0) return { ok: false, reason: "zero-size" };
  const head = fs.readFileSync(filePath).subarray(0, 8);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!head.equals(sig)) return { ok: false, reason: "invalid-png" };
  return { ok: true };
}

async function waitForPageReadiness(page: Page, lifecycle: HarnessLifecycleEvent[], label: string): Promise<void> {
  logEvent(lifecycle, "readiness", `start ${label}`);
  await Promise.race([
    page.waitForLoadState("networkidle", { timeout: 12000 }),
    page.waitForTimeout(12000),
  ]).catch(() => undefined);
  await page.evaluate(READINESS_SCRIPT).catch(() => ({ stable: false }));
  logEvent(lifecycle, "readiness", `complete ${label}`);
}

async function safeElementCrop(
  page: Page,
  selectors: string[],
  outPath: string,
  lifecycle: HarnessLifecycleEvent[],
  label: string,
): Promise<{ path: string; status: CaptureStatus; error?: string }> {
  for (const selector of selectors) {
    try {
      const box = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
        const r = el.getBoundingClientRect();
        if (!r || r.width <= 0 || r.height <= 0) return null;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const x = Math.max(0, Math.min(r.x, vw - 1));
        const y = Math.max(0, Math.min(r.y, vh - 1));
        const width = Math.max(1, Math.min(r.width, vw - x));
        const height = Math.max(1, Math.min(r.height, vh - y));
        return { x, y, width, height };
      }, selector);
      if (!box) continue;
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      await page.screenshot({ path: outPath, clip: box, timeout: 15000 });
      const verified = verifyPng(outPath, { name: "desktop", width: 1440, height: 1200 });
      if (verified.ok) {
        logEvent(lifecycle, "crop", `PASS ${label} ${selector}`);
        return { path: outPath, status: "PASS" };
      }
    } catch (err) {
      logEvent(lifecycle, "crop", `fail ${label} ${selector}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  logEvent(lifecycle, "crop", `COMPONENT NOT FOUND ${label}`);
  return { path: "", status: "COMPONENT NOT FOUND" };
}

async function captureOnPage(
  page: Page,
  target: ValidationTarget,
  url: string,
  viewport: ViewportSpec,
  evidenceDir: string,
  lifecycle: HarnessLifecycleEvent[],
): Promise<{ evidence: PageBrowserEvidence; statuses: Record<string, CaptureStatus>; imageSlotCropPaths: string[] }> {
  const base = path.join(evidenceDir, `${target}-${viewport.name}`);
  fs.mkdirSync(path.dirname(base), { recursive: true });
  const screenshotPath = `${base}-full.png`;
  const statuses: Record<string, CaptureStatus> = {};

  logEvent(lifecycle, "navigate", `${target}-${viewport.name} ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await waitForPageReadiness(page, lifecycle, `${target}-${viewport.name}`);

  let signature: PageBrowserEvidence["signature"];
  try {
    signature = (await page.evaluate(COMPONENT_EXTRACT_SCRIPT)) as PageBrowserEvidence["signature"];
  } catch (err) {
    signature = {
      header: null,
      footer: null,
      nav: null,
      hero: null,
      bodyFont: "",
      headingFont: "",
      primaryColour: "",
      sectionCount: 0,
      domNodeCount: 0,
      genericMarkers: [],
      imageSlots: [],
      consoleErrors: [],
      failedResources: [],
    };
    logEvent(lifecycle, "evaluate", `FAIL ${target}-${viewport.name}: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 20000 });
    statuses.full = verifyPng(screenshotPath, viewport).ok ? "PASS" : "FAIL";
  } catch (err) {
    statuses.full = "FAIL";
    logEvent(lifecycle, "screenshot", `FAIL full ${target}-${viewport.name}: ${err instanceof Error ? err.message : String(err)}`);
  }

  const header = await safeElementCrop(page, CROP_SELECTORS.header, `${base}-header.png`, lifecycle, "header");
  const nav = await safeElementCrop(page, CROP_SELECTORS.nav, `${base}-nav.png`, lifecycle, "nav");
  const hero = await safeElementCrop(page, CROP_SELECTORS.hero, `${base}-hero.png`, lifecycle, "hero");
  const footer = await safeElementCrop(page, CROP_SELECTORS.footer, `${base}-footer.png`, lifecycle, "footer");

  statuses.header = header.status;
  statuses.nav = nav.status;
  statuses.hero = hero.status;
  statuses.footer = footer.status;

  const imageSlotCropPaths: string[] = [];
  const slots = signature.imageSlots.slice(0, 8);
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i]!.slot || `slot-${i}`;
    const crop = await safeElementCrop(
      page,
      [`[data-image-slot="${slot}"]`],
      `${base}-image-${slot}.png`,
      lifecycle,
      `image-${slot}`,
    );
    if (crop.path) imageSlotCropPaths.push(crop.path);
    statuses[`image-${slot}`] = crop.status;
  }

  const evidence: PageBrowserEvidence = {
    target,
    url,
    viewport: viewport.name,
    screenshotPath,
    headerCropPath: header.path,
    footerCropPath: footer.path,
    navCropPath: nav.path,
    heroCropPath: hero.path,
    signature,
  };

  return { evidence, statuses, imageSlotCropPaths };
}

const SERIAL_ORDER: Array<{ target: ValidationTarget; viewport: ViewportSpec["name"] }> = [
  { target: "source", viewport: "desktop" },
  { target: "canonical", viewport: "desktop" },
  { target: "live", viewport: "desktop" },
  { target: "source", viewport: "tablet" },
  { target: "canonical", viewport: "tablet" },
  { target: "live", viewport: "tablet" },
  { target: "source", viewport: "mobile" },
  { target: "canonical", viewport: "mobile" },
  { target: "live", viewport: "mobile" },
];

export interface HarnessOptions {
  slug: string;
  service: string;
  sourceUrl: string;
  liveBase: string;
  evidenceDir: string;
  renderRoot: string;
  workspaceRoot: string;
  skipPixel?: boolean;
}

export async function runTruthfulVisualValidationHarness(options: HarnessOptions): Promise<HarnessRunResult> {
  const lifecycle: HarnessLifecycleEvent[] = [];
  const captures: CaptureRecord[] = [];
  const trace = {
    browserClosedPrematurely: false,
    duplicateCloseFound: false,
    timeoutRaceFound: false,
    unhandledAsyncFound: false,
    lastSuccessfulOperation: undefined as string | undefined,
    firstFailedOperation: undefined as string | undefined,
  };

  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const port = 8930 + Math.floor(Math.random() * 40);
  const server = await startStaticServer(options.renderRoot, options.workspaceRoot, port);
  const urls = {
    source: options.sourceUrl,
    canonical: `${server.url}/${options.service}/`,
    live: `${options.liveBase.replace(/\/$/, "")}/${options.service}/`,
  };

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let browserCloseCount = 0;

  const sourceToCanonicalVectors: SimilarityVector[] = [];
  const canonicalToLiveVectors: SimilarityVector[] = [];
  const sourceToCanonicalByViewport: Record<string, SimilarityVector> = {};
  const canonicalToLiveByViewport: Record<string, SimilarityVector> = {};
  const evidenceByKey = new Map<string, PageBrowserEvidence>();

  try {
    logEvent(lifecycle, "launch", "chromium.launch");
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const pid = browserPid(browser);
    logEvent(lifecycle, "launch", `browser pid=${pid ?? "unknown"}`, pid);

    logEvent(lifecycle, "context", "browser.newContext");
    context = await browser.newContext({ reducedMotion: "reduce" });

    for (const step of SERIAL_ORDER) {
      const viewport = TRUTHFUL_VIEWPORTS.find((v) => v.name === step.viewport)!;
      const url = urls[step.target];
      const key = `${step.target}-${step.viewport}`;
      let page: Page | null = null;
      const record: CaptureRecord = {
        key,
        target: step.target,
        viewport: step.viewport,
        url,
        status: "FAIL",
        evidence: null,
        screenshotPath: "",
        headerCropPath: "",
        navCropPath: "",
        heroCropPath: "",
        footerCropPath: "",
        imageSlotCropPaths: [],
      };

      try {
        if (!context || !browser?.isConnected()) {
          trace.browserClosedPrematurely = true;
          trace.prematureCloseCause = "browser disconnected before capture";
          throw new Error("browser disconnected");
        }
        logEvent(lifecycle, "page", `newPage ${key}`, pid);
        page = await context.newPage();
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        page.setDefaultTimeout(25000);

        const { evidence, statuses, imageSlotCropPaths } = await captureOnPage(page, step.target, url, viewport, options.evidenceDir, lifecycle);
        record.evidence = evidence;
        record.screenshotPath = evidence.screenshotPath;
        record.headerCropPath = evidence.headerCropPath;
        record.navCropPath = evidence.navCropPath;
        record.heroCropPath = evidence.heroCropPath;
        record.footerCropPath = evidence.footerCropPath;
        record.imageSlotCropPaths = imageSlotCropPaths;

        const fullOk = verifyPng(evidence.screenshotPath, viewport).ok;
        record.status = fullOk ? "PASS" : "FAIL";
        if (!fullOk && !trace.firstFailedOperation) {
          trace.firstFailedOperation = `full screenshot ${key}`;
        }
        if (fullOk) trace.lastSuccessfulOperation = `capture ${key}`;

        evidenceByKey.set(key, evidence);
        captures.push(record);
        logEvent(lifecycle, "capture", `complete ${key} statuses=${JSON.stringify(statuses)}`);
      } catch (err) {
        record.status = "FAIL";
        record.error = err instanceof Error ? err.message : String(err);
        captures.push(record);
        if (!trace.firstFailedOperation) trace.firstFailedOperation = `capture ${key}: ${record.error}`;
        logEvent(lifecycle, "capture", `FAIL ${key}: ${record.error}`);
      } finally {
        if (page) {
          try {
            await page.close();
          } catch {
            trace.unhandledAsyncFound = true;
          }
        }
      }
    }

    for (const vp of TRUTHFUL_VIEWPORTS) {
      const source = evidenceByKey.get(`source-${vp.name}`);
      const canonical = evidenceByKey.get(`canonical-${vp.name}`);
      const live = evidenceByKey.get(`live-${vp.name}`);
      if (source && canonical) {
        const s2c = compareBrowserEvidence(source, canonical);
        if (!options.skipPixel) {
          s2c.pixelSimilarity = await computePixelSimilarity(
            source.screenshotPath,
            canonical.screenshotPath,
            vp.width,
            vp.height,
          );
        }
        s2c.responsiveSimilarity = Math.round((s2c.headerSimilarity + s2c.footerSimilarity + s2c.navigationSimilarity) / 3);
        sourceToCanonicalByViewport[vp.name] = s2c;
        sourceToCanonicalVectors.push(s2c);
      }
      if (canonical && live) {
        const c2l = compareBrowserEvidence(canonical, live);
        if (!options.skipPixel) {
          c2l.pixelSimilarity = await computePixelSimilarity(
            canonical.screenshotPath,
            live.screenshotPath,
            vp.width,
            vp.height,
          );
        }
        canonicalToLiveByViewport[vp.name] = c2l;
        canonicalToLiveVectors.push(c2l);
      }
    }
  } finally {
    if (context) {
      try {
        await context.close();
      } catch {
        trace.duplicateCloseFound = true;
      }
    }
    if (browser) {
      try {
        browserCloseCount += 1;
        await browser.close();
      } catch {
        trace.duplicateCloseFound = true;
      }
    }
    server.close();
    logEvent(lifecycle, "shutdown", `browser.close count=${browserCloseCount}`);
  }

  const requiredKeys = SERIAL_ORDER.map((s) => `${s.target}-${s.viewport}`);
  const passedKeys = captures.filter((c) => c.status === "PASS").map((c) => c.key);
  const evidenceComplete = requiredKeys.every((k) => passedKeys.includes(k));

  const measuredSourceToCanonical = evidenceComplete ? avgSimilarity(sourceToCanonicalVectors) : null;
  const measuredCanonicalToLive = evidenceComplete ? avgSimilarity(canonicalToLiveVectors) : null;

  let gateStatus: "PASS" | "FAIL" | "INCOMPLETE" = "INCOMPLETE";
  const failedGateCategories: string[] = [];

  if (!evidenceComplete) {
    gateStatus = "INCOMPLETE";
  } else if (measuredSourceToCanonical && passesSiteChromeContract(measuredSourceToCanonical)) {
    gateStatus = "PASS";
  } else if (measuredSourceToCanonical) {
    gateStatus = "FAIL";
    const m = measuredSourceToCanonical;
    if (m.headerSimilarity < 95) failedGateCategories.push(`header:${m.headerSimilarity}%`);
    if (m.footerSimilarity < 95) failedGateCategories.push(`footer:${m.footerSimilarity}%`);
    if (m.navigationSimilarity < 95) failedGateCategories.push(`navigation:${m.navigationSimilarity}%`);
    if (m.typographySimilarity < 95) failedGateCategories.push(`typography:${m.typographySimilarity}%`);
    if (m.colourSimilarity < 95) failedGateCategories.push(`colour:${m.colourSimilarity}%`);
    if (m.buttonSimilarity < 95) failedGateCategories.push(`button:${m.buttonSimilarity}%`);
    if (m.imageSlotCompleteness < 100) failedGateCategories.push(`image-slot:${m.imageSlotCompleteness}%`);
    if (m.responsiveSimilarity < 95) failedGateCategories.push(`responsive:${m.responsiveSimilarity}%`);
  }

  return {
    lifecycle,
    captures,
    sourceToCanonicalByViewport,
    canonicalToLiveByViewport,
    measuredSourceToCanonical,
    measuredCanonicalToLive,
    evidenceComplete,
    serialValidation: evidenceComplete ? "PASS" : "FAIL",
    gateStatus,
    failedGateCategories,
    trace: {
      failureScript: trace.firstFailedOperation ? "pharmacyTruthfulVisualValidationHarness.ts" : undefined,
      failureFunction: trace.firstFailedOperation ? "captureOnPage/safeElementCrop" : undefined,
      browserClosedPrematurely: trace.browserClosedPrematurely,
      prematureCloseCause: trace.prematureCloseCause,
      duplicateCloseFound: trace.duplicateCloseFound,
      timeoutRaceFound: trace.timeoutRaceFound,
      unhandledAsyncFound: trace.unhandledAsyncFound,
      lastSuccessfulOperation: trace.lastSuccessfulOperation,
      firstFailedOperation: trace.firstFailedOperation,
    },
    urls,
  };
}
