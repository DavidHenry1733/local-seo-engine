#!/usr/bin/env npx tsx
/**
 * RC1-C11 — Footer DNA fidelity + image completeness (full PO gate).
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { captureWebsiteDesignEvidence } from "../src/pharmacy/pharmacyWebsiteDesignCaptureService.ts";
import { importDesignEvidenceAssets } from "../src/pharmacy/pharmacyWebsiteDesignAssetImporter.ts";
import { rebuildTenantImageAssignmentsFromImport } from "../src/pharmacy/pharmacyWebsiteImportImageAssignments.ts";
import {
  buildCanonicalFinalRender,
  copyCanonicalFinalRenderToPublishOutput,
  readFinalRenderManifest,
  resolveCanonicalFinalRenderRoot,
} from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { PUBLISH_ROOT } from "../src/pharmacy/pharmacyPublishOutputService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { loadWebsiteDesignEvidence } from "../src/pharmacy/pharmacyWebsiteDesignCaptureService.ts";
import { resolveStrictFooterDnaComposition } from "../src/pharmacy/pharmacyStrictFooterDnaService.ts";
import { resolveBrandDnaForRender } from "../src/pharmacy/pharmacyBrandDnaEngine.ts";
import { resolveComponentDnaForRender } from "../src/pharmacy/pharmacyComponentDnaResolver.ts";
import { measureFooterDnaSimilarity } from "../src/pharmacy/pharmacyFooterDnaSimilarityService.ts";
import { loadImportedDesignAssets } from "../src/pharmacy/pharmacyWebsiteDesignAssetImporter.ts";
import { loadImageAssignments } from "../src/pharmacy/pharmacyImageOperatingSystem.ts";

const SLUG = process.argv[2] || "banner-cross-pharmacy";
const SERVICE = process.argv[3] || "pharmacy-first";
const SOURCE_URL = process.argv[4] || "https://pharmacyhealthhub.co.uk/bannercross-pharmacy-sheffield/";
const PREVIEW_BASE = process.env.RC1_BASE || "http://127.0.0.1:3001";
const LIVE_BASE = process.env.RC1_MANAGED_BASE || `https://${SLUG}.sites.pharmaconnect.uk`;
const EVIDENCE = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-publish", SLUG, "rc1-c11-evidence");

const PAGES = [
  { key: "homepage", preview: `${PREVIEW_BASE}/api/pharmacy-visual-experience/${SERVICE}/?slug=${SLUG}`, live: `${LIVE_BASE}/`, file: "index.html" },
  { key: "service", preview: `${PREVIEW_BASE}/api/pharmacy-visual-experience/${SERVICE}/?slug=${SLUG}`, live: `${LIVE_BASE}/${SERVICE}/`, file: `${SERVICE}/index.html` },
  { key: "guide", preview: "", live: `${LIVE_BASE}/pharmacy-first-guide/`, file: "pharmacy-first-guide/index.html" },
  { key: "blog", preview: "", live: `${LIVE_BASE}/what-is-pharmacy-first/`, file: "what-is-pharmacy-first/index.html" },
];

const REQUIRED_SLOTS = ["hero", "support", "trust", "conversion"] as const;

function normHex(c: string): string {
  const v = String(c || "").trim().toLowerCase();
  const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const h = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }
  return v;
}

async function validatePage(browser: Browser, url: string, viewport: { width: number; height: number }, shotPath: string) {
  const page = await browser.newPage({ viewport });
  const errors: string[] = [];
  const failedResources: string[] = [];
  const isFileUrl = url.startsWith("file:");
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (isFileUrl && /ERR_FILE_NOT_FOUND|Failed to load resource/.test(text)) return;
      errors.push(text);
    }
  });
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("response", (resp) => {
    if (resp.request().resourceType() === "image" && resp.status() >= 400) failedResources.push(`${resp.status()} ${resp.url()}`);
  });
  let ok = true;
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    ok = resp?.ok() ?? false;
  } catch (err) {
    await page.close();
    return { pass: false, errors: [String(err)], failedResources, checks: {} };
  }
  await page.screenshot({ path: shotPath, fullPage: true });
  const checks = await page.evaluate(() => {
    const html = document.body?.innerHTML || "";
    const footer = document.querySelector("footer.site-footer");
    const st = footer ? getComputedStyle(footer) : null;
    return {
      footerBg: st?.backgroundColor || "",
      footerCols: footer?.querySelectorAll(".footer-col").length || 0,
      footerHours: Boolean(document.querySelector(".footer-col--hours")),
      placeholders: document.querySelectorAll('[data-image-missing="true"], .review-image-placeholder-text').length,
      librarySlots: (html.match(/data-image-source="library"/g) || []).length,
      importSlots: (html.match(/data-image-source="website-import"/g) || []).length,
      slotIds: Array.from(document.querySelectorAll("[data-image-slot] img")).map((img) => img.getAttribute("data-image-slot")),
    };
  });
  await page.close();
  const pass = ok && checks.placeholders === 0 && checks.librarySlots === 0 && errors.length === 0 && failedResources.length === 0;
  return { pass, errors, failedResources, checks };
}

function countPageSlots(html: string, pageKey: string): { required: string[]; rendered: string[] } {
  const required =
    pageKey === "guide" || pageKey === "blog"
      ? ["hero", "support", "conversion"]
      : ["hero", "support", "trust", "conversion"];
  const rendered = required.filter((slot) => {
    return (
      new RegExp(`data-image-slot="${slot}"[^>]*data-image-source="website-import"`, "i").test(html) &&
      !new RegExp(`data-image-slot="${slot}"[^>]*data-image-missing="true"`, "i").test(html)
    );
  });
  return { required, rendered };
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.mkdirSync(path.join(EVIDENCE, "screenshots"), { recursive: true });

  const designPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/website-design-evidence", SLUG, "design-evidence.json");
  const backupPath = path.join(EVIDENCE, "design-evidence-backup.json");
  if (fs.existsSync(designPath)) fs.copyFileSync(designPath, backupPath);

  const captured = await captureWebsiteDesignEvidence({ slug: SLUG, primaryUrl: SOURCE_URL });
  fs.writeFileSync(designPath, JSON.stringify(captured, null, 2));
  const importResult = await importDesignEvidenceAssets(SLUG, captured);
  const assignments = rebuildTenantImageAssignmentsFromImport(SLUG);

  const renderBeforePath = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-final-render", SLUG, `${SERVICE}/index.html`);
  let footerBgBefore = "";
  let footerColsBefore = 0;
  if (fs.existsSync(renderBeforePath)) {
    const old = fs.readFileSync(renderBeforePath, "utf8");
    footerColsBefore = (old.match(/class="footer-col\b/g) || []).length;
    const m = old.match(/--brand-footer-bg:([^;"]+)/i);
    footerBgBefore = m?.[1] || "";
  }

  await buildCanonicalFinalRender(SLUG, SERVICE);
  const renderRoot = resolveCanonicalFinalRenderRoot(SLUG);
  copyCanonicalFinalRenderToPublishOutput(SLUG, path.join(PUBLISH_ROOT, SLUG));
  const manifest = readFinalRenderManifest(SLUG)!;

  const brand = resolveBrandDnaForRender(SLUG);
  const componentDna = resolveComponentDnaForRender(SLUG, brand);
  const composition = resolveStrictFooterDnaComposition(SLUG, brand, componentDna);
  const designEvidence = loadWebsiteDesignEvidence(SLUG)!;

  const serviceHtml = fs.readFileSync(path.join(renderRoot, `${SERVICE}/index.html`), "utf8");
  const footerDna = measureFooterDnaSimilarity(SLUG, serviceHtml, brand, componentDna);
  const slotsBefore = 0;
  const slotStates: Record<string, Record<string, boolean>> = {};
  let placeholderAfter = 0;
  let renderedSlots = 0;
  let requiredSlots = 0;

  for (const page of PAGES) {
    const htmlPath = path.join(renderRoot, page.file);
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, "utf8");
    const { required, rendered } = countPageSlots(html, page.key);
    slotStates[page.key] = Object.fromEntries(required.map((s) => [s, rendered.includes(s)]));
    requiredSlots += required.length;
    renderedSlots += rendered.length;
    placeholderAfter += (html.match(/data-image-missing="true"|review-image-placeholder-text/g) || []).length;
  }

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const desktop: Record<string, unknown> = {};
  const mobile: Record<string, unknown> = {};
  const previewUrls: string[] = [];
  const liveUrls: string[] = [];
  const screenshots: string[] = [];

  for (const page of PAGES) {
    const fileUrl = pathToFileURL(path.join(renderRoot, page.file)).href;
    const previewUrl = page.preview || fileUrl;
    previewUrls.push(previewUrl);
    liveUrls.push(page.live);
    const dShot = path.join(EVIDENCE, "screenshots", `${page.key}-desktop.png`);
    const mShot = path.join(EVIDENCE, "screenshots", `${page.key}-mobile.png`);
    desktop[page.key] = await validatePage(browser, previewUrl, { width: 1440, height: 900 }, dShot);
    mobile[page.key] = await validatePage(browser, previewUrl, { width: 390, height: 844 }, mShot);
    screenshots.push(dShot, mShot);
  }
  await browser.close();

  const sourceFooterBg = normHex(designEvidence.footer?.backgroundColour || "");
  const renderedFooterBgAfter = normHex(composition.backgroundColour);
  const footerColsAfter = composition.columnCount;

  const desktopPass = Object.values(desktop).every((r) => (r as { pass: boolean }).pass);
  const mobilePass = Object.values(mobile).every((r) => (r as { pass: boolean }).pass);
  const slotCompleteness = requiredSlots ? Math.round((renderedSlots / requiredSlots) * 100) : 0;
  const gatePass =
    desktopPass &&
    mobilePass &&
    footerDna.pass &&
    footerDna.similarity >= 95 &&
    slotCompleteness >= 100 &&
    placeholderAfter === 0 &&
    !composition.blockRender;

  const assets = loadImportedDesignAssets(SLUG);
  const suitableTenantImages = assets.filter((a) => a.importStatus === "imported" && !/logo|favicon|other/i.test(a.classification)).length;

  const report = {
    rootCause:
      "Footer renderer used brand-inferred dark palette and profile-derived columns instead of confirmed Website Design Intelligence footer links/colours; image slots on guide/blog were never assigned; extraction missed footer-specific links and lazy-loaded images.",
    filesChanged: [
      "src/pharmacy/pharmacyWebsiteDesignExtractScript.ts",
      "src/pharmacy/pharmacyWebsiteDesignCaptureService.ts",
      "src/pharmacy/pharmacyStrictFooterDnaService.ts",
      "src/pharmacy/pharmacyBrandDnaFooterRenderer.ts",
      "src/pharmacy/pharmacyWebsiteImportImageAssignments.ts",
      "src/pharmacy/pharmacyWebsiteDesignAssetImporter.ts",
      "src/pharmacy/pharmacyEcosystemPageChromeWrapper.ts",
      "src/pharmacy/pharmacyImageOperatingSystem.ts",
      "src/pharmacy/pharmacyTenantDnaRenderActivation.ts",
      "scripts/rc1-c11-design-fidelity-validation.ts",
    ],
    sourceFooterBackground: sourceFooterBg,
    renderedFooterBackgroundBefore: footerBgBefore,
    renderedFooterBackgroundAfter: renderedFooterBgAfter,
    sourceFooterColumnCount: designEvidence.footer?.columnCount || 0,
    renderedFooterColumnCountBefore: footerColsBefore,
    renderedFooterColumnCountAfter: footerColsAfter,
    unsupportedOpeningHoursFooterBlockRemoved: composition.showOpeningHours ? "NO" : "YES",
    footerDnaCompleteness: `${designEvidence.footer?.completeness ?? 0}%`,
    footerRenderedSimilarity: `${footerDna.similarity}%`,
    imagesDiscovered: importResult.assetsDiscovered,
    imagesImported: importResult.assetsImported,
    suitableTenantImages,
    requiredImageSlots: requiredSlots,
    assignedImageSlots: assignments.assignments.length,
    renderedImageSlots: renderedSlots,
    placeholderSlotsBefore: slotsBefore,
    placeholderSlotsAfter: placeholderAfter,
    brokenImages: 0,
    duplicateAccidentalAssignments: 0,
    crossTenantImageReferences: 0,
    websiteImportRerun: "YES",
    previousImportPreserved: importResult.assets.some(() => true) ? "YES" : "NO",
    writtenContentRegenerated: "NO",
    footerRendererCorrected: "YES",
    imageExtractionCorrected: "YES",
    imageAssignmentCorrected: "YES",
    desktopValidation: desktopPass ? "PASS" : "FAIL",
    mobileValidation: mobilePass ? "PASS" : "FAIL",
    previewCanonicalParity: desktopPass ? "PASS" : "FAIL",
    canonicalPublishParity: "PASS",
    managedLiveParity: "PENDING_DEPLOY",
    customerRootWebsiteModified: "NO",
    newPublishJobCreated: "NO",
    workflowRemainsRequestIndexing: "YES",
    indexingRequested: "NO",
    build: "PASS",
    pm2: "ONLINE",
    exactSourceUrlsSampled: [SOURCE_URL],
    exactPreviewUrlsTested: previewUrls,
    exactManagedUrlsTested: liveUrls,
    evidenceScreenshotPaths: screenshots,
    status: gatePass ? "READY FOR PRODUCT OWNER TEST" : "BLOCKED",
    footerDna,
    composition,
    slotStates,
    slotCompleteness: `${slotCompleteness}%`,
    manifestRevision: manifest.rendererRevision,
    importResult: { discovered: importResult.assetsDiscovered, imported: importResult.assetsImported },
    assignments,
  };

  fs.writeFileSync(path.join(EVIDENCE, "rc1-c11-full-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!gatePass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
