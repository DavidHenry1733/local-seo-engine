/**
 * Pharmacy Publish Output V1 — orchestrates final static HTML from registry + generated JSON.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadPharmacyProfile,
  loadPharmacyContentBlueprint,
} from "./pharmacyContentBlueprintService.ts";
import { loadPharmacyServiceLibrary, normalizeServiceId } from "./pharmacyServiceLibraryService.ts";
import { loadGeneratedServicePage } from "./pharmacyServicePageGenerator.ts";
import { loadAllGeneratedServiceAreaPages } from "./pharmacyServiceAreaPageGenerator.ts";
import {
  MANIFEST_PATH,
  loadPharmacyPageRegistry,
  type PharmacyPageRegistry,
} from "./pharmacyPublishingFoundationService.ts";
import {
  renderPublishedAreaPage,
  renderPublishedServicePage,
  type PublishChromeContext,
} from "./pharmacyPublishOutputRenderer.ts";
import { loadGeneratedServiceHub } from "./pharmacyServiceHubGenerator.ts";
import {
  buildHubPreviewContext,
  renderPublishedServiceHubPage,
} from "./pharmacyServiceHubRenderer.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "config/pharmacy/service-library.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();
export const PUBLISH_ROOT = path.join(WORKSPACE_ROOT, "output/pharmacy-publish");

export interface PublishIndexEntry {
  pageSlug: string;
  pageType: "service" | "service-area" | "service-hub";
  serviceId: string;
  areaSlug: string | null;
  title: string;
  url: string;
  outputPath: string;
  generatedAt: string;
}

export interface PublishIndex {
  version: 1;
  slug: string;
  generatedAt: string;
  pageCount: number;
  servicePageCount: number;
  areaPageCount: number;
  hubPageCount: number;
  outputRoot: string;
  pages: PublishIndexEntry[];
  finalRenderManifest?: string;
  canonicalRenderVersion?: string;
}

export interface PublishOutputResult {
  slug: string;
  generatedAt: string;
  pageCount: number;
  servicePageCount: number;
  areaPageCount: number;
  hubPageCount: number;
  outputRoot: string;
  indexPath: string;
  index: PublishIndex;
  skippedCount: number;
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function publishOutputDir(slug: string, pageSlug: string): string {
  return path.join(PUBLISH_ROOT, slug, pageSlug);
}

export function publishOutputPath(slug: string, pageSlug: string): string {
  return path.join(publishOutputDir(slug, pageSlug), "index.html");
}

function loadRegistry(slug: string): PharmacyPageRegistry {
  const registry = loadPharmacyPageRegistry(slug);
  if (!registry || registry.slug !== slug) {
    throw new Error(`Registry not found for "${slug}". Run publishing foundation build first.`);
  }
  return registry;
}

function buildChromeContext(slug: string, localAreas: string[]): PublishChromeContext {
  const profile = loadPharmacyProfile(slug);
  const data = profile.data || {};
  const blueprint = loadPharmacyContentBlueprint(slug);

  const deliveryRaw = data.deliveryAvailable;
  const deliveryAvailable = Array.isArray(deliveryRaw)
    ? deliveryRaw.map(String)
    : deliveryRaw
      ? [String(deliveryRaw)]
      : [];

  return {
    slug,
    pharmacyName: String(data.pharmacyName || data.tradingName || blueprint?.pharmacyName || "Your Pharmacy").trim(),
    town: String(data.townCity || blueprint?.primaryLocation || "your area"),
    phone: String(data.phone || ""),
    gphcNumber: String(data.gphcNumber || ""),
    yearsServingCommunity: String(data.yearsServingCommunity || ""),
    deliveryAvailable,
    nhsServicesLabel: blueprint?.serviceOpportunities?.some((s) =>
      ["pharmacy-first", "blood-pressure-checks", "new-medicine-service", "smoking-cessation"].includes(
        normalizeServiceId(s.serviceKey),
      ),
    )
      ? "NHS clinical services available"
      : "Community pharmacy services",
    localAreas,
  };
}

function relatedServicesFor(slug: string, currentServiceId: string) {
  try {
    const lib = loadPharmacyServiceLibrary(slug);
    return lib.services
      .filter((s) => s.selected && normalizeServiceId(s.id) !== normalizeServiceId(currentServiceId))
      .slice(0, 4)
      .map((s) => ({
        serviceId: normalizeServiceId(s.id),
        serviceName: s.serviceName,
      }));
  } catch {
    return [];
  }
}

function urlMapFromRegistry(registry: PharmacyPageRegistry): Map<string, string> {
  return new Map(registry.pages.map((p) => [p.pageSlug, p.url]));
}

function urlForServiceId(registry: PharmacyPageRegistry, serviceId: string): string {
  const entry = registry.pages.find((p) => p.pageType === "service" && p.serviceId === serviceId);
  return entry?.url || `${registry.baseUrl.replace(/\/$/, "")}/${serviceId}/`;
}

export function generatePharmacyPublishOutput(slug: string): PublishOutputResult {
  const registry = loadRegistry(slug);
  const manifest = readJson<any>(MANIFEST_PATH, null);
  const publishReady = registry.pages.filter((p) => p.status === "publish-ready");

  if (!publishReady.length) {
    throw new Error(`No publish-ready pages in registry for "${slug}".`);
  }

  const urlByPageSlug = urlMapFromRegistry(registry);
  const publishedPageSlugs = new Set(publishReady.map((p) => p.pageSlug));
  const siteHomeUrl = `${registry.baseUrl.replace(/\/$/, "")}/`;

  const outputRoot = path.join(PUBLISH_ROOT, slug);
  fs.mkdirSync(outputRoot, { recursive: true });

  const indexEntries: PublishIndexEntry[] = [];
  let skipped = 0;

  const areaPagesBySlug = new Map(
    loadAllGeneratedServiceAreaPages(slug).pages.map((p) => [p.pageSlug, p]),
  );
  const hubCtx = buildHubPreviewContext(slug);
  hubCtx.baseUrl = registry.baseUrl.replace(/\/$/, "");

  for (const entry of publishReady) {
    const outPath = publishOutputPath(slug, entry.pageSlug);
    const urlForPageSlug = (pageSlug: string) => urlByPageSlug.get(pageSlug) || `${registry.baseUrl.replace(/\/$/, "")}/${pageSlug}/`;
    const renderOpts = {
      canonicalUrl: entry.url,
      relatedUrlForService: (serviceId: string) => urlForServiceId(registry, serviceId),
      relatedUrlForPageSlug: urlForPageSlug,
      publishedPageSlugs,
      siteHomeUrl,
    };

    let html: string;

    if (entry.pageType === "service") {
      const page = loadGeneratedServicePage(slug, entry.serviceId);
      if (!page) {
        skipped++;
        continue;
      }
      const ctx = buildChromeContext(slug, []);
      html = renderPublishedServicePage(page, {
        ...ctx,
        relatedServices: relatedServicesFor(slug, entry.serviceId),
      }, renderOpts);
    } else if (entry.pageType === "service-hub") {
      const hub = loadGeneratedServiceHub(slug, entry.serviceId);
      if (!hub) {
        skipped++;
        continue;
      }
      html = renderPublishedServiceHubPage(hub, hubCtx, entry.url);
    } else {
      const page = areaPagesBySlug.get(entry.pageSlug);
      if (!page) {
        skipped++;
        continue;
      }
      const ctx = buildChromeContext(slug, [page.area, ...page.nearbyAreas].filter(Boolean).slice(0, 6));
      html = renderPublishedAreaPage(page, { ...ctx, area: page.area }, renderOpts);
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");

    indexEntries.push({
      pageSlug: entry.pageSlug,
      pageType: entry.pageType,
      serviceId: entry.serviceId,
      areaSlug: entry.areaSlug,
      title: entry.title,
      url: entry.url,
      outputPath: path.relative(WORKSPACE_ROOT, outPath),
      generatedAt: entry.generatedAt,
    });
  }

  indexEntries.sort((a, b) => a.pageSlug.localeCompare(b.pageSlug));

  const now = new Date().toISOString();
  const index: PublishIndex = {
    version: 1,
    slug,
    generatedAt: now,
    pageCount: indexEntries.length,
    servicePageCount: indexEntries.filter((p) => p.pageType === "service").length,
    areaPageCount: indexEntries.filter((p) => p.pageType === "service-area").length,
    hubPageCount: indexEntries.filter((p) => p.pageType === "service-hub").length,
    outputRoot: path.relative(WORKSPACE_ROOT, outputRoot),
    pages: indexEntries,
  };

  const indexPath = path.join(outputRoot, "_publish-index.json");
  writeJson(indexPath, index);

  return {
    slug,
    generatedAt: now,
    pageCount: indexEntries.length,
    servicePageCount: index.servicePageCount,
    areaPageCount: index.areaPageCount,
    hubPageCount: index.hubPageCount,
    outputRoot,
    indexPath,
    index,
    skippedCount: skipped,
  };
}

export interface PublishOutputValidation {
  htmlPageCount: number;
  previewBannerCount: number;
  canonicalCount: number;
  schemaBlockCount: number;
  indexEntryCount: number;
  passed: boolean;
  errors: string[];
}

export function validatePublishOutput(slug: string): PublishOutputValidation {
  const index = readJson<PublishIndex | null>(
    path.join(PUBLISH_ROOT, slug, "_publish-index.json"),
    null,
  );
  const errors: string[] = [];

  if (!index) {
    return {
      htmlPageCount: 0,
      previewBannerCount: 0,
      canonicalCount: 0,
      schemaBlockCount: 0,
      indexEntryCount: 0,
      passed: false,
      errors: ["missing _publish-index.json"],
    };
  }

  let previewBannerCount = 0;
  let canonicalCount = 0;
  let schemaBlockCount = 0;
  let htmlPageCount = 0;

  for (const entry of index.pages) {
    const file = path.join(WORKSPACE_ROOT, entry.outputPath);
    if (!fs.existsSync(file)) {
      errors.push(`missing HTML: ${entry.outputPath}`);
      continue;
    }
    htmlPageCount++;
    const html = fs.readFileSync(file, "utf8");
    if (
      /<div class="preview-banner"/i.test(html) ||
      /class="dev-panel"/i.test(html) ||
      /noindex, nofollow/i.test(html)
    ) {
      previewBannerCount++;
    }
    if (html.includes(`href="${entry.url}"`) || html.includes(`href='${entry.url}'`)) canonicalCount++;
    if (html.includes('type="application/ld+json"')) schemaBlockCount++;
    if (!html.includes("<footer")) errors.push(`missing footer: ${entry.pageSlug}`);
    if (!html.includes("<title>")) errors.push(`missing title: ${entry.pageSlug}`);
    if (!html.includes('name="description"')) errors.push(`missing meta description: ${entry.pageSlug}`);
    if (!html.includes("<main")) errors.push(`missing main body: ${entry.pageSlug}`);
    if (!html.includes("cta-section") && !html.includes('data-component="cta-block"')) {
      errors.push(`missing CTA: ${entry.pageSlug}`);
    }
  }

  const expectedPageCount = index.pages.length;

  if (htmlPageCount !== expectedPageCount) {
    errors.push(`expected ${expectedPageCount} HTML pages, found ${htmlPageCount}`);
  }
  if (previewBannerCount > 0) errors.push(`found ${previewBannerCount} preview banners`);
  if (canonicalCount !== htmlPageCount) errors.push(`expected ${htmlPageCount} canonical URLs, found ${canonicalCount}`);
  if (schemaBlockCount !== htmlPageCount) errors.push(`expected ${htmlPageCount} schema blocks, found ${schemaBlockCount}`);
  if (index.pages.length !== htmlPageCount) errors.push("index entry count mismatch");

  return {
    htmlPageCount,
    previewBannerCount,
    canonicalCount,
    schemaBlockCount,
    indexEntryCount: index.pages.length,
    passed: errors.length === 0,
    errors,
  };
}

export function getPharmacyPublishOutputStatus(slug: string) {
  const index = readJson<PublishIndex | null>(
    path.join(PUBLISH_ROOT, slug, "_publish-index.json"),
    null,
  );
  const validation = index ? validatePublishOutput(slug) : null;

  return {
    ok: true,
    slug,
    hasPublishOutput: !!index,
    pageCount: index?.pageCount ?? 0,
    servicePageCount: index?.servicePageCount ?? 0,
    areaPageCount: index?.areaPageCount ?? 0,
    hubPageCount: index?.hubPageCount ?? 0,
    generatedAt: index?.generatedAt ?? null,
    outputRoot: index ? path.join(PUBLISH_ROOT, slug) : null,
    validation,
  };
}
