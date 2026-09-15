/**
 * Pharmacy Publishing Foundation V1 — registry, sitemap, manifest, status.
 */
import fs from "node:fs";
import path from "node:path";
import { loadAllGeneratedServiceAreaPages } from "./pharmacyServiceAreaPageGenerator.ts";
import { loadAllGeneratedServicePages } from "./pharmacyServicePageGenerator.ts";
import { loadAllGeneratedServiceHubs } from "./pharmacyServiceHubGenerator.ts";
import {
  summariseValidation,
  validatePharmacyPage,
  type PharmacyPageType,
  type PharmacyValidationResult,
} from "./pharmacyPublishingValidation.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";

export const REGISTRY_PATH = path.join(ROOT, "data/pharmacy-page-registry.json");
export const TENANT_REGISTRY_DIR = path.join(ROOT, "data/pharmacy-page-registries");
export const SITEMAP_PATH = path.join(ROOT, "output/pharmacy-sitemap.xml");
export const MANIFEST_PATH = path.join(ROOT, "output/pharmacy-publish-manifest.json");

export const CUSTOMER_REGISTRY_FOUNDATION_ERROR =
  "We could not start campaign generation because the local publishing foundation is not ready yet. Please try again shortly.";

export type PharmacyPageStatus = "generated" | "validated" | "failed" | "publish-ready" | "published";

export interface PharmacyRegistryEntry {
  slug: string;
  pageType: PharmacyPageType;
  serviceId: string;
  areaSlug: string | null;
  title: string;
  url: string;
  generatedAt: string;
  publishedAt: string | null;
  status: PharmacyPageStatus;
  wordCount: number;
  pageSlug: string;
}

export interface PharmacyPageRegistry {
  version: 1;
  updatedAt: string;
  slug: string;
  baseUrl: string;
  pageCount: number;
  pages: PharmacyRegistryEntry[];
}

export interface PharmacyPublishManifest {
  version: 1;
  generatedAt: string;
  slug: string;
  summary: {
    totalPages: number;
    publishableCount: number;
    failedCount: number;
    servicePageCount: number;
    areaPageCount: number;
    hubPageCount: number;
    validationPassCount: number;
    validationFailCount: number;
    passRate: number;
  };
  publishablePages: Array<PharmacyRegistryEntry & { validation: PharmacyValidationResult }>;
  failedPages: Array<PharmacyRegistryEntry & { validation: PharmacyValidationResult }>;
  validation: ReturnType<typeof summariseValidation>;
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function writeText(file: string, data: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data, "utf8");
}

function resolveBaseUrl(slug: string): string {
  const profile = readJson<any>(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`), {});
  const website = String(profile?.data?.website || profile?.website || "").trim();
  if (website) return website.replace(/\/$/, "");

  const project = readJson<any>(path.join(ROOT, "config/projects", `${slug}.json`), {});
  const domain = String(project?.domain || "").trim();
  if (domain) return domain.replace(/\/$/, "");

  return `https://${slug}.example.com`;
}

function buildPageUrl(baseUrl: string, pageSlug: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${pageSlug}/`;
}

export function pharmacyPageRegistryPath(slug: string): string {
  return path.join(TENANT_REGISTRY_DIR, `${slug}.json`);
}

function htmlWordCount(file: string): number {
  if (!fs.existsSync(file)) return 0;
  return fs
    .readFileSync(file, "utf8")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function areaLabelFromSlug(areaSlug: string): string {
  return areaSlug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fileGeneratedAt(file: string, fallback: string): string {
  try {
    return fs.statSync(file).mtime.toISOString();
  } catch {
    return fallback;
  }
}

/** Content Engine V1 local artefacts (visual + current locality pages). Never marks published. */
function collectContentEngineRegistryEntries(
  slug: string,
  baseUrl: string,
  now: string,
): PharmacyRegistryEntry[] {
  const entries: PharmacyRegistryEntry[] = [];
  const visualRoot = path.join(ROOT, "output/pharmacy-visual-experience", slug);
  if (fs.existsSync(visualRoot)) {
    for (const name of fs.readdirSync(visualRoot, { withFileTypes: true })) {
      if (!name.isDirectory() || name.name.startsWith("_")) continue;
      const indexFile = path.join(visualRoot, name.name, "index.html");
      if (!fs.existsSync(indexFile)) continue;
      const meta = getServicePublishMeta(name.name);
      entries.push({
        slug,
        pageType: "service",
        serviceId: name.name,
        areaSlug: null,
        title: meta ? `${meta.serviceName}` : name.name,
        url: buildPageUrl(baseUrl, name.name),
        generatedAt: fileGeneratedAt(indexFile, now),
        publishedAt: null,
        status: "generated",
        wordCount: htmlWordCount(indexFile),
        pageSlug: name.name,
      });
    }
  }

  const ecoRoot = path.join(ROOT, "output/pharmacy-content-ecosystem", slug);
  if (fs.existsSync(ecoRoot)) {
    for (const serviceDir of fs.readdirSync(ecoRoot, { withFileTypes: true })) {
      if (!serviceDir.isDirectory() || serviceDir.name.startsWith("_")) continue;
      const serviceId = serviceDir.name;
      const localRoot = path.join(ecoRoot, serviceId, "local");
      if (!fs.existsSync(localRoot)) continue;
      const meta = getServicePublishMeta(serviceId);
      const serviceName = meta?.serviceName || serviceId;
      for (const areaDir of fs.readdirSync(localRoot, { withFileTypes: true })) {
        if (!areaDir.isDirectory() || areaDir.name === "revisions" || areaDir.name.startsWith("_")) continue;
        const areaSlug = areaDir.name;
        const indexFile = path.join(localRoot, areaSlug, "index.html");
        if (!fs.existsSync(indexFile)) continue;
        const areaName = areaLabelFromSlug(areaSlug);
        entries.push({
          slug,
          pageType: "service-area",
          serviceId,
          areaSlug,
          title: `${serviceName} ${areaName}`,
          url: buildPageUrl(baseUrl, `${serviceId}-${areaSlug}`),
          generatedAt: fileGeneratedAt(indexFile, now),
          publishedAt: null,
          status: "generated",
          wordCount: htmlWordCount(indexFile),
          pageSlug: `${serviceId}-${areaSlug}`,
        });
      }
    }
  }

  return entries;
}

export interface PharmacyPageRegistryFoundationValidation {
  ok: boolean;
  errors: string[];
  registryPath: string;
}

export function validatePharmacyPageRegistryFoundation(
  slug: string,
  registry?: PharmacyPageRegistry | null,
): PharmacyPageRegistryFoundationValidation {
  const registryPath = pharmacyPageRegistryPath(slug);
  const errors: string[] = [];
  const doc = registry === undefined ? loadPharmacyPageRegistry(slug) : registry;
  if (!doc) {
    errors.push(`missing registry for ${slug}`);
    return { ok: false, errors, registryPath };
  }
  if (doc.version !== 1) errors.push("invalid registry version");
  if (doc.slug !== slug) errors.push("registry slug does not match tenant");
  if (typeof doc.baseUrl !== "string" || !doc.baseUrl) errors.push("missing registry baseUrl");
  if (!Array.isArray(doc.pages)) errors.push("registry pages must be an array");
  else if (doc.pageCount !== doc.pages.length) errors.push("registry pageCount does not match pages");
  if (Array.isArray(doc.pages)) {
    for (const page of doc.pages) {
      if (!page || typeof page !== "object") {
        errors.push("registry contains an invalid page entry");
        break;
      }
      if (page.slug !== slug) errors.push("registry page slug does not match tenant");
      if (typeof page.pageSlug !== "string" || !page.pageSlug) errors.push("registry page missing pageSlug");
      if (typeof page.serviceId !== "string" || !page.serviceId) errors.push("registry page missing serviceId");
      if (page.status === "published") {
        errors.push("local foundation registry must not mark pages published");
      }
    }
  }
  return { ok: errors.length === 0, errors, registryPath };
}

export function loadPharmacyPageRegistry(slug: string): PharmacyPageRegistry | null {
  const tenant = readJson<PharmacyPageRegistry | null>(pharmacyPageRegistryPath(slug), null);
  if (tenant?.slug === slug && Array.isArray(tenant.pages)) return tenant;
  const legacy = readJson<PharmacyPageRegistry | null>(REGISTRY_PATH, null);
  if (legacy?.slug === slug && Array.isArray(legacy.pages)) return legacy;
  return null;
}

export function persistPharmacyPageRegistry(registry: PharmacyPageRegistry): string {
  const file = pharmacyPageRegistryPath(registry.slug);
  writeJson(file, registry);
  return file;
}

/**
 * Local pre-publication registry only. Does not write sitemap, deploy, publish or index.
 */
export function ensurePharmacyPublishingRegistryFoundation(slug: string): PharmacyPageRegistry {
  const registry = buildPharmacyRegistry(slug);
  persistPharmacyPageRegistry(registry);
  const check = validatePharmacyPageRegistryFoundation(slug, registry);
  if (!check.ok) {
    throw new Error(CUSTOMER_REGISTRY_FOUNDATION_ERROR);
  }
  return registry;
}

function serialisePage(page: Record<string, unknown>): string {
  return JSON.stringify(page);
}

function registryStatus(
  validation: PharmacyValidationResult,
  publishedAt: string | null,
): PharmacyPageStatus {
  if (publishedAt) return "published";
  if (validation.passed) return "publish-ready";
  if (validation.errors.length) return "failed";
  return "generated";
}

function toValidationInput(
  page: Record<string, any>,
  pageType: PharmacyPageType,
): Parameters<typeof validatePharmacyPage>[0] {
  return {
    pageType,
    pageSlug: page.pageSlug,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    schema: page.schema,
    cta: page.cta,
    sections: page.sections,
    qualitySignals: page.qualitySignals,
    bodyText: serialisePage(page),
    page,
  };
}

export function buildPharmacyRegistry(slug: string): PharmacyPageRegistry {
  const baseUrl = resolveBaseUrl(slug);
  const { pages: servicePages } = loadAllGeneratedServicePages(slug);
  const { pages: areaPages } = loadAllGeneratedServiceAreaPages(slug);
  const now = new Date().toISOString();

  const entries: PharmacyRegistryEntry[] = [];

  for (const page of servicePages) {
    const validation = validatePharmacyPage(toValidationInput(page, "service"));
    entries.push({
      slug,
      pageType: "service",
      serviceId: page.serviceId,
      areaSlug: null,
      title: page.metaTitle || page.h1 || page.serviceName,
      url: buildPageUrl(baseUrl, page.pageSlug),
      generatedAt: page.generatedAt || now,
      publishedAt: null,
      status: registryStatus(validation, null),
      wordCount: page.qualitySignals?.wordCount ?? 0,
      pageSlug: page.pageSlug,
    });
  }

  for (const page of areaPages) {
    const validation = validatePharmacyPage(toValidationInput(page, "service-area"));
    entries.push({
      slug,
      pageType: "service-area",
      serviceId: page.serviceId,
      areaSlug: page.areaSlug,
      title: page.metaTitle || page.h1 || `${page.serviceName} ${page.area}`,
      url: buildPageUrl(baseUrl, page.pageSlug),
      generatedAt: page.generatedAt || now,
      publishedAt: null,
      status: registryStatus(validation, null),
      wordCount: page.qualitySignals?.wordCount ?? 0,
      pageSlug: page.pageSlug,
    });
  }

  const { pages: hubPages } = loadAllGeneratedServiceHubs(slug);
  for (const page of hubPages) {
    const validation = validatePharmacyPage(toValidationInput(page, "service-hub"));
    entries.push({
      slug,
      pageType: "service-hub",
      serviceId: page.serviceId,
      areaSlug: null,
      title: page.metaTitle || page.h1 || `${page.serviceName} Hub`,
      url: buildPageUrl(baseUrl, page.pageSlug),
      generatedAt: page.generatedAt || now,
      publishedAt: null,
      status: registryStatus(validation, null),
      wordCount: page.qualitySignals?.wordCount ?? 0,
      pageSlug: page.pageSlug,
    });
  }

  const seen = new Set(entries.map((entry) => entry.pageSlug));
  for (const extra of collectContentEngineRegistryEntries(slug, baseUrl, now)) {
    if (seen.has(extra.pageSlug)) continue;
    seen.add(extra.pageSlug);
    entries.push(extra);
  }

  entries.sort((a, b) => a.pageSlug.localeCompare(b.pageSlug));

  return {
    version: 1,
    updatedAt: now,
    slug,
    baseUrl,
    pageCount: entries.length,
    pages: entries,
  };
}

export function validateRegistryPages(slug: string): PharmacyValidationResult[] {
  const { pages: servicePages } = loadAllGeneratedServicePages(slug);
  const { pages: areaPages } = loadAllGeneratedServiceAreaPages(slug);

  const { pages: hubPages } = loadAllGeneratedServiceHubs(slug);

  const results: PharmacyValidationResult[] = [
    ...servicePages.map((p) => validatePharmacyPage(toValidationInput(p, "service"))),
    ...areaPages.map((p) => validatePharmacyPage(toValidationInput(p, "service-area"))),
    ...hubPages.map((p) => validatePharmacyPage(toValidationInput(p, "service-hub"))),
  ];

  return results.sort((a, b) => a.pageSlug.localeCompare(b.pageSlug));
}

export function buildPharmacySitemap(registry: PharmacyPageRegistry): string {
  const urls = registry.pages
    .filter((p) => p.status === "publish-ready" || p.status === "published")
    .map((p) => {
      const lastmod = (p.publishedAt || p.generatedAt || registry.updatedAt).slice(0, 10);
      return `  <url>
    <loc>${escapeXml(p.url)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

function escapeXml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildPharmacyPublishManifest(
  slug: string,
  registry: PharmacyPageRegistry,
  validationResults: PharmacyValidationResult[],
): PharmacyPublishManifest {
  const summary = summariseValidation(validationResults);
  const validationBySlug = new Map(validationResults.map((v) => [v.pageSlug, v]));

  const publishablePages = registry.pages
    .filter((p) => validationBySlug.get(p.pageSlug)?.passed)
    .map((p) => ({ ...p, validation: validationBySlug.get(p.pageSlug)! }));

  const failedPages = registry.pages
    .filter((p) => !validationBySlug.get(p.pageSlug)?.passed)
    .map((p) => ({ ...p, validation: validationBySlug.get(p.pageSlug)! }));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    slug,
    summary: {
      totalPages: registry.pageCount,
      publishableCount: publishablePages.length,
      failedCount: failedPages.length,
      servicePageCount: registry.pages.filter((p) => p.pageType === "service").length,
      areaPageCount: registry.pages.filter((p) => p.pageType === "service-area").length,
      hubPageCount: registry.pages.filter((p) => p.pageType === "service-hub").length,
      validationPassCount: summary.passCount,
      validationFailCount: summary.failCount,
      passRate: summary.passRate,
    },
    publishablePages,
    failedPages,
    validation: summary,
  };
}

export interface PharmacyPublishingBuildResult {
  registry: PharmacyPageRegistry;
  manifest: PharmacyPublishManifest;
  sitemapPath: string;
  registryPath: string;
  manifestPath: string;
  sitemapUrlCount: number;
}

export function buildPharmacyPublishingFoundation(slug: string): PharmacyPublishingBuildResult {
  const validationResults = validateRegistryPages(slug);
  const registry = buildPharmacyRegistry(slug);

  // Reconcile registry status from validation
  const validationBySlug = new Map(validationResults.map((v) => [v.pageSlug, v]));
  registry.pages = registry.pages.map((entry) => {
    const validation = validationBySlug.get(entry.pageSlug);
    if (!validation) return entry;
    return {
      ...entry,
      status: registryStatus(validation, entry.publishedAt),
    };
  });

  const manifest = buildPharmacyPublishManifest(slug, registry, validationResults);
  const sitemap = buildPharmacySitemap(registry);

  writeJson(REGISTRY_PATH, registry);
  writeJson(MANIFEST_PATH, manifest);
  writeText(SITEMAP_PATH, sitemap);

  const sitemapUrlCount = (sitemap.match(/<loc>/g) || []).length;

  return {
    registry,
    manifest,
    sitemapPath: SITEMAP_PATH,
    registryPath: REGISTRY_PATH,
    manifestPath: MANIFEST_PATH,
    sitemapUrlCount,
  };
}

export function getPharmacyPublishingStatus(slug: string) {
  const registry = loadPharmacyPageRegistry(slug);
  const manifest = readJson<PharmacyPublishManifest | null>(MANIFEST_PATH, null);

  const { pages: servicePages } = loadAllGeneratedServicePages(slug);
  const { pages: areaPages } = loadAllGeneratedServiceAreaPages(slug);

  const { pages: hubPages } = loadAllGeneratedServiceHubs(slug);

  let sitemapCount = 0;
  if (fs.existsSync(SITEMAP_PATH)) {
    const xml = fs.readFileSync(SITEMAP_PATH, "utf8");
    sitemapCount = (xml.match(/<loc>/g) || []).length;
  }

  const registryPages = registry?.slug === slug ? registry.pages : [];
  const registryCount = registryPages.length || servicePages.length + areaPages.length;

  return {
    ok: true,
    slug,
    servicePageCount: servicePages.length,
    areaPageCount: areaPages.length,
    hubPageCount: hubPages.length,
    totalPageCount: servicePages.length + areaPages.length + hubPages.length,
    registryCount,
    registryUpdatedAt: registry?.updatedAt || null,
    sitemapCount,
    sitemapPath: SITEMAP_PATH,
    registryPath: pharmacyPageRegistryPath(slug),
    manifestPath: MANIFEST_PATH,
    validationPassCount: manifest?.summary.validationPassCount ?? 0,
    validationFailCount: manifest?.summary.validationFailCount ?? 0,
    publishReadyCount: manifest?.summary.publishableCount ?? registryPages.filter((p) => p.status === "publish-ready").length,
    passRate: manifest?.summary.passRate ?? 0,
    manifestGeneratedAt: manifest?.generatedAt || null,
    expectedPages: {
      services: 5,
      hubs: 5,
      areas: 3,
      areaPages: 15,
      total: 25,
    },
  };
}
