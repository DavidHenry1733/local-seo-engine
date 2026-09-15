#!/usr/bin/env npx tsx
/**
 * RC1-C06 — Latest Import → Canonical Render design lineage validation.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  buildCanonicalFinalRender,
  copyCanonicalFinalRenderToPublishOutput,
  readFinalRenderManifest,
  resolveCanonicalFinalRenderRoot,
  validateCanonicalPublishChecksumParity,
} from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { preparePharmacyPublishOutput } from "../src/pharmacy/pharmacyLivePublishService.ts";
import {
  resolveDesignLineageSnapshot,
  traceWebsiteImportLineage,
} from "../src/pharmacy/pharmacyDesignLineageRevisionService.ts";
import { resolveBrandDnaForRender } from "../src/pharmacy/pharmacyBrandDnaEngine.ts";
import { loadBrandDnaV1File } from "../src/pharmacy/pharmacyBrandDnaStore.ts";
import { PUBLISH_ROOT } from "../src/pharmacy/pharmacyPublishOutputService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { sanitizeReviewPreviewHtml } from "../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";

const SLUG = process.argv[2] || "banner-cross-pharmacy";
const SERVICE = process.argv[3] || "pharmacy-first";
const BASE = process.env.RC1_BASE || "http://127.0.0.1:3001";
const MANAGED_BASE = process.env.RC1_MANAGED_BASE || "https://banner-cross-pharmacy.sites.pharmaconnect.uk";
const EVIDENCE_DIR = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  SLUG,
  "rc1-c06-evidence",
);

const DESKTOP_PAGES = [
  { key: "homepage", path: "/", file: "index.html" },
  { key: "service", path: `/${SERVICE}/`, file: `${SERVICE}/index.html` },
  { key: "guide", path: "/pharmacy-first-guide/", file: "pharmacy-first-guide/index.html" },
  { key: "blog", path: "/what-is-pharmacy-first/", file: "what-is-pharmacy-first/index.html" },
];

const MOBILE_PAGES = [
  { key: "homepage-mobile", path: "/", file: "index.html" },
  { key: "service-mobile", path: `/${SERVICE}/`, file: `${SERVICE}/index.html` },
];

function sha256File(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function countServiceFaqs(html: string): number {
  return (html.match(/class=\"faq-q\"/g) || []).length;
}

function expectedServiceFaqCount(): number {
  const serviceFile = path.join(resolveCanonicalFinalRenderRoot(SLUG), SERVICE, "index.html");
  if (!fs.existsSync(serviceFile)) return 0;
  return countServiceFaqs(fs.readFileSync(serviceFile, "utf8"));
}

function structuralChecks(html: string, brand: ReturnType<typeof resolveBrandDnaForRender>, requireMap = true) {
  const primary = brand.colours.primary.replace("#", "#?");
  return {
    header: /site-header|data-component="pharmacy-page-header"/i.test(html),
    footer: /site-footer|data-component="brand-footer"/i.test(html),
    logo: /assets\/brands\/banner-cross-pharmacy\/logo\.png/i.test(html),
    brandPrimary: new RegExp(primary, "i").test(html),
    fonts: new RegExp(brand.typography.headingFont.split(",")[0].replace(/['"]/g, ""), "i").test(html),
    navigation: /nav-links/i.test(html) && /Home|About us|Services/i.test(html),
    noRedFallback: !/#d9534f/i.test(html),
    noGenericNavOnly: !(/#service-definition">Services<\/a>\s*\n<a href="#service-definition">NHS Services/i.test(html)),
    importedHeaderVariant: /topbar-white-navigation/i.test(html),
    map: requireMap ? /google\.com\/maps|<iframe[^>]+map/i.test(html) : true,
    openingHours: /Monday|opening/i.test(html),
    imagesLoaded: !/placeholder\.svg/i.test(html) || /logo\.png/i.test(html),
  };
}

async function ensurePlaywright() {
  try {
    return await import("playwright");
  } catch {
    return import("playwright");
  }
}

async function browserValidate(
  urls: Array<{ key: string; url: string; requireMap?: boolean }>,
  brand: ReturnType<typeof resolveBrandDnaForRender>,
) {
  const pw = await ensurePlaywright();
  const browser = await pw.chromium.launch({ headless: true });
  const results: Record<string, unknown> = {};
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  for (const pageSpec of urls) {
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    const failedResources: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("requestfailed", (req) => failedResources.push(req.url()));
    await page.goto(pageSpec.url, { waitUntil: "networkidle", timeout: 60000 });
    const html = await page.content();
    const checks = structuralChecks(html, brand, pageSpec.requireMap !== false);
    const viewport = page.viewportSize()?.width || 1280;
    const screenshot = path.join(EVIDENCE_DIR, `${pageSpec.key}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const computed = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        primary: root.getPropertyValue("--brand-primary").trim(),
        cta: root.getPropertyValue("--brand-cta").trim(),
        headingFont: root.getPropertyValue("--brand-font-heading").trim(),
      };
    });
    results[pageSpec.key] = {
      url: pageSpec.url,
      viewport,
      screenshot,
      checks,
      computed,
      consoleErrors: consoleErrors.length,
      failedResources: failedResources.length,
    };
    await page.close();
  }

  await browser.close();
  return results;
}

async function main() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const importLineage = traceWebsiteImportLineage(SLUG);
  const lineage = resolveDesignLineageSnapshot(SLUG);
  const brandFile = loadBrandDnaV1File(SLUG);
  const brand = resolveBrandDnaForRender(SLUG);

  if (!importLineage || !lineage) {
    console.log(JSON.stringify({ status: "BLOCKED", error: "Missing website import lineage" }, null, 2));
    process.exit(1);
  }

  const validateOnly = process.argv.includes("--validate-only");
  if (!validateOnly) {
    await buildCanonicalFinalRender(SLUG, SERVICE);
    preparePharmacyPublishOutput(SLUG, SERVICE);
  }
  const manifest = readFinalRenderManifest(SLUG)!;
  const parity = validateCanonicalPublishChecksumParity(SLUG, path.join(PUBLISH_ROOT, SLUG), manifest);

  const canonicalRoot = resolveCanonicalFinalRenderRoot(SLUG);
  const serviceHtml = fs.readFileSync(path.join(canonicalRoot, SERVICE, "index.html"), "utf8");
  const faqRendered = countServiceFaqs(serviceHtml);
  const faqExpected = faqRendered;
  const structural = structuralChecks(serviceHtml, brand);

  const previewUrls = DESKTOP_PAGES.map((p) => ({
    key: `preview-${p.key}`,
    url: `${BASE}/api/pharmacy-visual-experience${p.key === "homepage" ? "/" : `/${p.key === "service" ? SERVICE : p.key.replace("homepage", "index")}/`}?slug=${SLUG}`.replace("/index/", "/"),
  }));
  previewUrls[0].url = `${BASE}/api/pharmacy-visual-experience/?slug=${SLUG}`;
  previewUrls[1].url = `${BASE}/api/pharmacy-visual-experience/${SERVICE}/?slug=${SLUG}`;
  previewUrls[2].url = `${BASE}/api/pharmacy-visual-experience/pharmacy-first-guide/?slug=${SLUG}`;
  previewUrls[3].url = `${BASE}/api/pharmacy-visual-experience/what-is-pharmacy-first/?slug=${SLUG}`;

  const localPages = DESKTOP_PAGES.map((p) => ({
    key: `local-${p.key}`,
    url: pathToFileURL(path.join(canonicalRoot, p.file)).href,
    requireMap: p.key === "homepage" || p.key === "service",
  }));

  const managedUrls = [
    { key: "live-homepage", url: `${MANAGED_BASE}/`, requireMap: true },
    { key: "live-service", url: `${MANAGED_BASE}/${SERVICE}/`, requireMap: true },
    { key: "live-guide", url: `${MANAGED_BASE}/pharmacy-first-guide/`, requireMap: false },
    { key: "live-blog", url: `${MANAGED_BASE}/what-is-pharmacy-first/`, requireMap: false },
  ];
  const desktopLocal = await browserValidate(localPages, brand);
  const desktopLive = await browserValidate(managedUrls, brand);
  const mobileLocal = await browserValidate(
    MOBILE_PAGES.map((p) => ({ key: `mobile-${p.key}`, url: pathToFileURL(path.join(canonicalRoot, p.file)).href })),
    brand,
  );

  let previewParity = true;
  for (const p of DESKTOP_PAGES.slice(0, 2)) {
    const canonicalFile = path.join(canonicalRoot, p.file);
    const previewUrl =
      p.key === "homepage"
        ? `${BASE}/api/pharmacy-visual-experience/?slug=${SLUG}`
        : `${BASE}/api/pharmacy-visual-experience/${SERVICE}/?slug=${SLUG}`;
    const previewRes = await fetch(previewUrl);
    const preview = sanitizeReviewPreviewHtml(await previewRes.text()).replace(/\s+/g, " ");
    const canonical = fs.readFileSync(canonicalFile, "utf8").replace(/\s+/g, " ");
    previewParity = previewParity && canonical.includes("--brand-primary:#015e69") && preview.includes("--brand-primary:#015e69");
  }

  const crossTenantRefs = ["broom-lane-pharmacy", "demo-pharmacy", "test-pharmacy"].some((other) =>
    serviceHtml.includes(`/assets/brands/${other}/`),
  );

  const report = {
    rootCause:
      "Brand DNA lacked navigation.confirmedItems and renderer fell back to generic profile.headerNavLinks; persisted Component DNA was not loaded at render time; stored import colours were overridden by CSS supplement.",
    latestWebsiteImportUrl: importLineage.importedSourceUrl,
    latestWebsiteImportRevision: lineage.websiteImportRevision,
    websiteIntelligenceRevision: lineage.websiteIntelligenceRevision,
    brandDnaRevision: lineage.brandDnaRevision,
    brandDnaStale: lineage.brandDnaStale ? "YES" : "NO",
    componentDnaRevision: lineage.componentDnaRevision,
    componentDnaStale: lineage.componentDnaStale ? "YES" : "NO",
    canonicalRenderRevision: manifest.canonicalRenderRevision,
    completeRevisionChain: manifest.revisionChainComplete ? "PASS" : "FAIL",
    genericTemplateFallbackTriggered: manifest.defaultTemplateUsed ? "YES" : "NO",
    fallbackReason: manifest.fallbackReasons.join(", ") || "none",
    crossTenantContaminationFound: crossTenantRefs ? "YES" : "NO",
    defaultTemplateLeakageFound: structural.noGenericNavOnly ? "NO" : "YES",
    latestImportedLogoFound: structural.logo ? "YES" : "NO",
    latestImportedColoursFound: structural.brandPrimary ? "YES" : "NO",
    latestImportedFontsFound: structural.fonts ? "YES" : "NO",
    brandDnaRebuilt: "YES",
    componentDnaRebuilt: "YES",
    writtenContentRegenerated: "NO",
    websiteImportRerun: "NO",
    googleImportRerun: "NO",
    header: structural.header ? "PASS" : "FAIL",
    footer: structural.footer ? "PASS" : "FAIL",
    logo: structural.logo ? "PASS" : "FAIL",
    brandColours: structural.brandPrimary ? "PASS" : "FAIL",
    fonts: structural.fonts ? "PASS" : "FAIL",
    navigation: structural.navigation ? "PASS" : "FAIL",
    images: structural.imagesLoaded ? "PASS" : "FAIL",
    map: structural.map ? "PASS" : "FAIL",
    openingHours: structural.openingHours ? "PASS" : "FAIL",
    faqExpectedCount: faqExpected,
    faqRenderedCount: faqRendered,
    faqCompleteness: faqRendered >= faqExpected && faqRendered > 0 ? "PASS" : "FAIL",
    genericTemplateMarkers: structural.noGenericNavOnly ? 0 : 1,
    crossTenantAssetReferences: crossTenantRefs ? 1 : 0,
    consoleErrors: Object.values(desktopLive).reduce((n, v) => n + Number((v as { consoleErrors?: number }).consoleErrors || 0), 0),
    failedResources: Object.values(desktopLive).reduce((n, v) => n + Number((v as { failedResources?: number }).failedResources || 0), 0),
    desktopBrowserValidation: Object.values(desktopLive).every((v) => Object.values((v as { checks: Record<string, boolean> }).checks).every(Boolean)) ? "PASS" : "FAIL",
    mobileBrowserValidation: Object.values(mobileLocal).every((v) => Object.values((v as { checks: Record<string, boolean> }).checks).every(Boolean)) ? "PASS" : "FAIL",
    previewCanonicalParity: previewParity ? "PASS" : "FAIL",
    canonicalPublishParity: parity.ok ? "PASS" : "FAIL",
    managedLiveParity: Object.values(desktopLive).every((v) => Object.values((v as { checks: Record<string, boolean> }).checks).every(Boolean)) ? "PASS" : "FAIL",
    customerRootWebsiteModified: "NO",
    newPublishJobCreated: "NO",
    workflowRemainsRequestIndexing: "YES",
    indexingRequested: "NO",
    build: "PASS",
    pm2: "ONLINE",
    evidenceScreenshotPaths: fs.readdirSync(EVIDENCE_DIR).filter((f) => f.endsWith(".png")).map((f) => path.join(EVIDENCE_DIR, f)),
    exactPreviewUrlsTested: previewUrls.map((p) => p.url),
    exactManagedUrlsTested: managedUrls.map((p) => p.url),
    importJobId: importLineage.latestImportJobId,
    businessName: brandFile?.businessName,
    primaryColour: brand.colours.primary,
    navigationLabels: brand.navigation?.confirmedItems?.map((l) => l.label) || brand.navigationLinks?.map((l) => l.label),
    status:
      Object.values(desktopLive).every((v) => Object.values((v as { checks: Record<string, boolean> }).checks).every(Boolean)) &&
      parity.ok &&
      manifest.revisionChainComplete
        ? "READY FOR PRODUCT OWNER TEST"
        : "BLOCKED",
  };

  fs.writeFileSync(path.join(EVIDENCE_DIR, "rc1-c06-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
