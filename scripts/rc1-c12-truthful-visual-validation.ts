#!/usr/bin/env npx tsx
/**
 * RC1-C12 — Truthful visual validation (browser is source of truth).
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { resolveCanonicalFinalRenderRoot } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import {
  TRUTHFUL_VIEWPORTS,
  capturePageEvidence,
  compareBrowserEvidence,
  computePixelSimilarity,
  buildMismatchReport,
  startStaticServer,
  passesSiteChromeContract,
  type SimilarityVector,
  type PageBrowserEvidence,
} from "../src/pharmacy/pharmacyTruthfulVisualValidationService.ts";

const SLUG = process.argv[2] || "banner-cross-pharmacy";
const SERVICE = process.argv[3] || "pharmacy-first";
const SOURCE_URL = process.argv[4] || "https://pharmacyhealthhub.co.uk/bannercross-pharmacy-sheffield/";
const LIVE_URL = process.env.RC1_MANAGED_BASE || `https://${SLUG}.sites.pharmaconnect.uk`;
const EVIDENCE = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-publish", SLUG, "rc1-c12-evidence");

function avgVectors(items: SimilarityVector[]): SimilarityVector {
  if (!items.length) {
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
  const keys = Object.keys(items[0]) as Array<keyof SimilarityVector>;
  const out = {} as SimilarityVector;
  for (const key of keys) {
    out[key] = Math.round(items.reduce((sum, v) => sum + v[key], 0) / items.length);
  }
  return out;
}

function passesContract(v: SimilarityVector): boolean {
  return passesSiteChromeContract(v);
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const renderRoot = resolveCanonicalFinalRenderRoot(SLUG);
  const port = 8800 + Math.floor(Math.random() * 200);
  const server = await startStaticServer(renderRoot, PHARMACY_WORKSPACE_ROOT, port);
  const canonicalUrl = `${server.url}/${SERVICE}/`;
  const liveUrl = `${LIVE_URL}/${SERVICE}/`;

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const captures: PageBrowserEvidence[] = [];
  const sourceToCanonical: SimilarityVector[] = [];
  const sourceToLive: SimilarityVector[] = [];
  const canonicalToLive: SimilarityVector[] = [];
  const pixelScores: number[] = [];

  for (const viewport of TRUTHFUL_VIEWPORTS) {
    const source = await capturePageEvidence(browser, "source", SOURCE_URL, viewport, EVIDENCE);
    const canonical = await capturePageEvidence(browser, "canonical", canonicalUrl, viewport, EVIDENCE);
    const live = await capturePageEvidence(browser, "live", liveUrl, viewport, EVIDENCE);
    captures.push(source, canonical, live);

    const s2c = compareBrowserEvidence(source, canonical);
    const s2l = compareBrowserEvidence(source, live);
    const c2l = compareBrowserEvidence(canonical, live);
    s2c.pixelSimilarity = process.env.RC1_SKIP_PIXEL === "1" ? 0 : await computePixelSimilarity(source.screenshotPath, canonical.screenshotPath, viewport.width, viewport.height);
    s2l.pixelSimilarity = process.env.RC1_SKIP_PIXEL === "1" ? 0 : await computePixelSimilarity(source.screenshotPath, live.screenshotPath, viewport.width, viewport.height);
    c2l.pixelSimilarity = process.env.RC1_SKIP_PIXEL === "1" ? 0 : await computePixelSimilarity(canonical.screenshotPath, live.screenshotPath, viewport.width, viewport.height);
    pixelScores.push(s2c.pixelSimilarity, c2l.pixelSimilarity);
    sourceToCanonical.push(s2c);
    sourceToLive.push(s2l);
    canonicalToLive.push(c2l);
  }

  await browser.close();
  server.close();

  const desktop = captures.filter((c) => c.viewport === "desktop");
  const sourceDesktop = desktop.find((c) => c.target === "source")!;
  const canonicalDesktop = desktop.find((c) => c.target === "canonical")!;
  const liveDesktop = desktop.find((c) => c.target === "live")!;
  const mismatches = buildMismatchReport(sourceDesktop, canonicalDesktop, liveDesktop);

  const measuredSourceToCanonical = avgVectors(sourceToCanonical);
  const measuredSourceToLive = avgVectors(sourceToLive);
  const measuredCanonicalToLive = avgVectors(canonicalToLive);
  const contractPass = passesContract(measuredSourceToCanonical);

  const rootCause =
    "Canonical renderer flattened all confirmed navigation items into the header row, applied wrong footer background/layer tokens, omitted social footer group, and self-validation gates passed on DNA completeness instead of browser-measured site chrome.";

  const recommendedCorrection =
    "Wire release gates to pharmacyTruthfulVisualValidationService.ts only; block on measured source→canonical footer/header/nav/pixel scores >=95%; fix pharmacyBrandDnaFooterRenderer.ts link hierarchy and pharmacyVisualExperienceLayoutV3.ts hero/layout to match source DOM structure before re-release.";

  const report = {
    realMeasuredSimilarities: {
      sourceToCanonical: measuredSourceToCanonical,
      sourceToLive: measuredSourceToLive,
      canonicalToLive: measuredCanonicalToLive,
      byViewport: TRUTHFUL_VIEWPORTS.map((vp, i) => ({
        viewport: vp.name,
        sourceToCanonical: sourceToCanonical[i],
        sourceToLive: sourceToLive[i],
        canonicalToLive: canonicalToLive[i],
      })),
    },
    screenshots: captures.map((c) => ({
      target: c.target,
      viewport: c.viewport,
      full: c.screenshotPath,
      header: c.headerCropPath,
      footer: c.footerCropPath,
      nav: c.navCropPath,
      hero: c.heroCropPath,
    })),
    failedComponents: mismatches.slice(0, 40),
    responsibleRenderer: [...new Set(mismatches.map((m) => m.rendererResponsible))],
    responsibleDna: [...new Set(mismatches.map((m) => m.dnaRecordResponsible))],
    responsibleFallback: [...new Set(mismatches.map((m) => m.fallbackResponsible).filter(Boolean))],
    rootCause,
    recommendedRendererCorrection: recommendedCorrection,
    status: contractPass ? "READY FOR PRODUCT OWNER TEST" : "BLOCKED",
    urls: { source: SOURCE_URL, canonical: canonicalUrl, live: liveUrl },
    browserEvidence: {
      sourceFooter: sourceDesktop.signature.footer,
      canonicalFooter: canonicalDesktop.signature.footer,
      liveFooter: liveDesktop.signature.footer,
      sourceNavCount: sourceDesktop.signature.nav?.linkLabels.length || 0,
      canonicalNavCount: canonicalDesktop.signature.nav?.linkLabels.length || 0,
      canonicalGenericMarkers: canonicalDesktop.signature.genericMarkers,
      canonicalImageSlots: canonicalDesktop.signature.imageSlots,
    },
  };

  fs.writeFileSync(path.join(EVIDENCE, "rc1-c12-truthful-report.json"), JSON.stringify(report, null, 2));

  console.log("REAL MEASURED SIMILARITIES (source → canonical, averaged across viewports)");
  console.log(JSON.stringify(measuredSourceToCanonical, null, 2));
  console.log("\nSCREENSHOTS");
  for (const s of report.screenshots.filter((x) => x.viewport === "desktop")) {
    console.log(`${s.target}: ${s.full}`);
  }
  console.log("\nFAILED COMPONENTS (sample)");
  for (const m of mismatches.slice(0, 12)) {
    console.log(`- ${m.component}: expected=${m.expected} rendered=${m.rendered} | ${m.rendererResponsible}`);
  }
  console.log("\nROOT CAUSE");
  console.log(rootCause);
  console.log("\nRECOMMENDED RENDERER CORRECTION");
  console.log(recommendedCorrection);
  console.log("\nSTATUS");
  console.log(report.status);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
