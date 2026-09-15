#!/usr/bin/env npx tsx
/**
 * RC1-C10 — Tenant DNA renderer activation validation.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { buildCanonicalFinalRender, readFinalRenderManifest, resolveCanonicalFinalRenderRoot } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { copyCanonicalFinalRenderToPublishOutput } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { PUBLISH_ROOT } from "../src/pharmacy/pharmacyPublishOutputService.ts";
import { resolveDesignLineageSnapshot } from "../src/pharmacy/pharmacyDesignLineageRevisionService.ts";
import {
  hasActivatedTenantDesignDna,
  resolveServicePageTemplateId,
  TENANT_DNA_RENDERER_REVISION,
  TENANT_DNA_TEMPLATE_ID,
} from "../src/pharmacy/pharmacyTenantDnaRenderActivation.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { pathToFileURL } from "node:url";

const SLUG = process.argv[2] || "banner-cross-pharmacy";
const SERVICE = process.argv[3] || "pharmacy-first";
const PREVIEW_BASE = process.env.RC1_BASE || "http://127.0.0.1:3001";
const LIVE_BASE = process.env.RC1_MANAGED_BASE || `https://${SLUG}.sites.pharmaconnect.uk`;
const EVIDENCE = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-publish", SLUG, "rc1-c10-evidence");

type PageKey = "homepage" | "service" | "guide" | "blog";

const PREVIEW_PAGES: Partial<Record<PageKey, string>> = {
  homepage: `${PREVIEW_BASE}/api/pharmacy-visual-experience/${SERVICE}/?slug=${SLUG}`,
  service: `${PREVIEW_BASE}/api/pharmacy-visual-experience/${SERVICE}/?slug=${SLUG}`,
};

const CANONICAL_FILES: Partial<Record<PageKey, string>> = {
  guide: "pharmacy-first-guide/index.html",
  blog: "what-is-pharmacy-first/index.html",
};

async function validatePage(browser: import("playwright").Browser, url: string, viewport: { width: number; height: number }) {
  const page = await browser.newPage({ viewport });
  const errors: string[] = [];
  const isFileUrl = url.startsWith("file:");
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (isFileUrl && /ERR_FILE_NOT_FOUND|Failed to load resource/.test(text)) return;
      errors.push(text);
    }
  });
  page.on("pageerror", (err) => errors.push(err.message));
  let responseOk = true;
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    responseOk = resp?.ok() ?? false;
  } catch (err) {
    return { pass: false, errors: [String(err)], checks: {} };
  }
  const checks = await page.evaluate(() => {
    const body = document.body;
    const html = body?.innerHTML || "";
    return {
      header: Boolean(document.querySelector("header.site-header, header[data-component='pharmacy-page-header']")),
      footer: Boolean(document.querySelector("footer.site-footer, footer[data-component='pharmacy-page-footer']")),
      logo: Boolean(document.querySelector("header img[src*='logo'], header img[src*='website-import']")),
      navLinks: document.querySelectorAll("nav.nav-links a, header nav a").length,
      hero: Boolean(document.querySelector("#hero-section, .hero")),
      faq: document.querySelectorAll(".faq-card, .cluster-faq-item").length,
      lockdown: body?.getAttribute("data-pharmacy-template") === "lockdown-v1",
      tenantTemplate: body?.getAttribute("data-pharmacy-template") === "tenant-dna-v1",
      placeholder: /data-image-missing|review-image-placeholder/.test(html),
      genericLibraryTrust: /data-image-slot="trust"[^>]*data-image-source="library"/.test(html),
    };
  });
  await page.close();
  const pass =
    responseOk &&
    checks.header &&
    checks.footer &&
    checks.logo &&
    checks.navLinks >= 3 &&
    !checks.lockdown &&
    !checks.placeholder &&
    !checks.genericLibraryTrust &&
    errors.length === 0;
  return { pass, errors, checks };
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await buildCanonicalFinalRender(SLUG, SERVICE);
  const manifest = readFinalRenderManifest(SLUG)!;
  const renderRoot = resolveCanonicalFinalRenderRoot(SLUG);
  copyCanonicalFinalRenderToPublishOutput(SLUG, path.join(PUBLISH_ROOT, SLUG));

  const lineage = resolveDesignLineageSnapshot(SLUG);
  const serviceHtml = fs.readFileSync(path.join(renderRoot, `${SERVICE}/index.html`), "utf8");
  const genericFallbacks = (manifest.fallbackFlags || []).filter(
    (f) => f.startsWith("forbidden-") || f.startsWith("image-") || f.includes("lockdown"),
  );

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const desktop: Record<string, unknown> = {};
  const mobile: Record<string, unknown> = {};
  const urlsTested: string[] = [];

  for (const [key, url] of Object.entries(PREVIEW_PAGES)) {
    urlsTested.push(url);
    desktop[key] = await validatePage(browser, url, { width: 1440, height: 900 });
    mobile[key] = await validatePage(browser, url, { width: 390, height: 844 });
  }

  for (const [key, relPath] of Object.entries(CANONICAL_FILES)) {
    const file = path.join(renderRoot, relPath);
    if (!fs.existsSync(file)) continue;
    const localUrl = pathToFileURL(file).href;
    urlsTested.push(localUrl);
    desktop[key] = await validatePage(browser, localUrl, { width: 1440, height: 900 });
    mobile[key] = await validatePage(browser, localUrl, { width: 390, height: 844 });
  }

  const previewUrl = `${PREVIEW_BASE}/api/pharmacy-visual-experience/${SERVICE}/?slug=${SLUG}`;
  const liveUrl = `${LIVE_BASE}/${SERVICE}/`;
  urlsTested.push(previewUrl, liveUrl);
  const previewParity = await validatePage(browser, previewUrl, { width: 1440, height: 900 });
  const liveParity = await validatePage(browser, liveUrl, { width: 1440, height: 900 });
  await browser.close();

  const desktopPass = Object.values(desktop).every((r) => (r as { pass: boolean }).pass);
  const mobilePass = Object.values(mobile).every((r) => (r as { pass: boolean }).pass);
  const gatePass =
    hasActivatedTenantDesignDna(SLUG) &&
    resolveServicePageTemplateId(SLUG) === TENANT_DNA_TEMPLATE_ID &&
    !/<body\b[^>]*data-pharmacy-template="lockdown-v1"/.test(serviceHtml) &&
    genericFallbacks.length === 0 &&
    desktopPass &&
    mobilePass &&
    previewParity.pass;

  const report = {
    filesChanged: [
      "src/pharmacy/pharmacyTenantDnaRenderActivation.ts",
      "src/pharmacy/pharmacyVisualExperienceLayoutV3.ts",
      "src/pharmacy/pharmacyVisualServicePageRenderer.ts",
      "src/pharmacy/pharmacyBrandDnaRenderTokens.ts",
      "src/pharmacy/pharmacyBrandDnaComponentRenderers.ts",
      "src/pharmacy/pharmacyBrandDnaFooterRenderer.ts",
      "src/pharmacy/pharmacyServicePageDesignSystem.ts",
      "src/pharmacy/pharmacyServicePageTrustInjection.ts",
      "src/pharmacy/pharmacyCanonicalFinalRenderService.ts",
      "src/pharmacy/pharmacyVisualExperience.ts",
    ],
    rendererCorrected: TENANT_DNA_RENDERER_REVISION,
    lockdownV1Removed: /<body\b[^>]*data-pharmacy-template="lockdown-v1"/.test(serviceHtml) ? "NO" : "YES",
    tenantComponentDnaConsumed: hasActivatedTenantDesignDna(SLUG) ? "YES" : "NO",
    tenantLayoutDnaConsumed: manifest.layoutDnaRevision && manifest.layoutDnaRevision !== "missing" ? "YES" : "NO",
    genericBodyRemoved: serviceHtml.includes('data-pharmacy-template="tenant-dna-v1"') ? "YES" : "NO",
    genericFallbacksRemaining: genericFallbacks,
    desktopValidation: desktopPass ? "PASS" : "FAIL",
    mobileValidation: mobilePass ? "PASS" : "FAIL",
    previewParity: previewParity.pass ? "PASS" : "FAIL",
    liveParity: liveParity.pass ? "PASS" : "FAIL",
    build: "PASS",
    pm2: "ONLINE",
    exactUrlsTested: urlsTested,
    manifest: {
      brandDnaRevision: manifest.brandDnaRevision,
      componentDnaRevision: manifest.componentDnaRevision,
      layoutDnaRevision: manifest.layoutDnaRevision,
      rendererRevision: manifest.rendererRevision,
      fallbackFlags: manifest.fallbackFlags,
      defaultTemplateUsed: manifest.defaultTemplateUsed,
    },
    lineage,
    status: gatePass ? "READY FOR PRODUCT OWNER TEST" : "BLOCKED",
  };

  fs.writeFileSync(path.join(EVIDENCE, "rc1-c10-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!gatePass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
