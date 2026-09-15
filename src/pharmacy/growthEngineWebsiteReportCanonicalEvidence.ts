/**
 * Website Report — canonical page and service evidence model.
 * One inventory drives every report section.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import type { CustomerVisibleWebsiteService } from "./growthEngineWebsiteImportCustomerVisibleServices.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import type {
  WebsiteContentCoverageRow,
  WebsiteContentInventory,
  WebsiteContentOpportunity,
  WebsiteMissingContentItem,
  WebsitePageInventoryItem,
  WebsiteServiceDetection,
  WebsitePageCategory,
} from "./growthEngineWebsiteIntelligenceModel.ts";
import { WEBSITE_PAGE_CATEGORY_LABELS } from "./growthEngineWebsiteIntelligenceModel.ts";
import {
  detectAllServicesFromPages,
  detectServicesInUrl,
  serviceDisplayName,
  servicePatternById,
  WEBSITE_SERVICE_PATTERNS,
} from "./growthEngineWebsiteServiceDetection.ts";

const STATIC_ASSET_RE = /\.(css|js|mjs|map|json|xml|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|mp4|webm|pdf|avif)(\?|$)/i;
const ASSET_PATH_RE = /^\/assets(?:\/|$)/i;

function emptyCategoryCounts(): Record<WebsitePageCategory, number> {
  return {
    homepage: 0,
    about: 0,
    contact: 0,
    services: 0,
    "service-page": 0,
    pricing: 0,
    offer: 0,
    landing: 0,
    utility: 0,
    locations: 0,
    blog: 0,
    guide: 0,
    faq: 0,
    policy: 0,
    booking: 0,
    news: 0,
    resources: 0,
    other: 0,
  };
}

function buildContentInventory(pages: WebsitePageInventoryItem[]): WebsiteContentInventory {
  const byCategory = emptyCategoryCounts();
  for (const p of pages) byCategory[p.category] = (byCategory[p.category] || 0) + 1;

  const countVideos = pages.filter((p) => /video|watch/i.test(p.path) || /video/i.test(p.title)).length;
  const countDownloads = pages.filter((p) => p.category === "resources" && /download|pdf|leaflet/i.test(p.path)).length;
  const countCaseStudies = pages.filter((p) => /case-study|case study/i.test(p.title + p.path)).length;

  return {
    totalPages: pages.length,
    servicePages: byCategory["service-page"],
    blogArticles: byCategory.blog,
    patientGuides: byCategory.guide,
    faqPages: byCategory.faq,
    locationPages: byCategory.locations,
    caseStudies: countCaseStudies,
    newsArticles: byCategory.news,
    videos: countVideos,
    downloads: countDownloads,
    byCategory,
  };
}

export type WebsiteCoverageStatus = "dedicated-page" | "mentioned-only" | "not-found";

export interface CanonicalWebsiteServiceRecord {
  serviceId: string;
  serviceName: string;
  customerVisible: boolean;
  dedicatedPage: boolean;
  sourceUrl: string | null;
  detectionMethod: string;
  confidence: number;
  profileEnabled: boolean;
  coverageStatus: WebsiteCoverageStatus;
  diagnosticMatch: boolean;
  relatedPageCount: number;
  supportingContent: WebsiteServiceDetection["supportingContent"];
}

export interface CanonicalWebsiteReportCounts {
  contentPages: number;
  dedicatedServicePages: number;
  blogArticles: number;
  faqPages: number;
  patientGuides: number;
  locationPages: number;
  newsArticles: number;
  customerVisibleServices: number;
  diagnosticServiceMatches: number;
  enabledBusinessProfileServices: number;
  recommendedEcosystemPages: number;
  recommendedLocalPagesPerService: number;
  ecosystemGapPages: number;
}

export interface CanonicalWebsiteReportEvidence {
  contentPages: WebsitePageInventoryItem[];
  inventory: WebsiteContentInventory;
  services: CanonicalWebsiteServiceRecord[];
  diagnosticServices: WebsiteServiceDetection[];
  counts: CanonicalWebsiteReportCounts;
  coverage: WebsiteContentCoverageRow[];
  missingContent: WebsiteMissingContentItem[];
  opportunities: WebsiteContentOpportunity[];
  summaryParagraphs: string[];
}

function normalizePath(path: string): string {
  const trimmed = String(path || "").trim();
  if (!trimmed || trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "") || "/";
}

export function isWebsiteContentPage(page: WebsitePageInventoryItem): boolean {
  const path = normalizePath(page.path).toLowerCase();
  if (path === "/") return true;
  if (STATIC_ASSET_RE.test(path)) return false;
  if (ASSET_PATH_RE.test(path)) return false;
  if (/\/fonts?\//i.test(path)) return false;
  return true;
}

export function canonicalizeWebsiteContentPages(pages: WebsitePageInventoryItem[]): WebsitePageInventoryItem[] {
  const filtered = pages.filter(isWebsiteContentPage);
  const seen = new Set<string>();
  const out: WebsitePageInventoryItem[] = [];
  for (const page of filtered) {
    const key = normalizePath(page.path);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...page, path: key });
  }
  return out;
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function resolveCanonicalServiceId(serviceId: string, serviceName = ""): string {
  const id = String(serviceId || "").trim();
  if (servicePatternById(id)) return id;

  const nameNorm = normalizeToken(serviceName);
  for (const pattern of WEBSITE_SERVICE_PATTERNS) {
    if (normalizeToken(pattern.name) === nameNorm || pattern.id === id) return pattern.id;
  }

  for (const pattern of WEBSITE_SERVICE_PATTERNS) {
    const patternNorm = normalizeToken(pattern.name);
    if (nameNorm && (nameNorm.includes(patternNorm) || patternNorm.includes(nameNorm))) return pattern.id;
    if (pattern.urlPatterns.some((re) => re.test(id) || re.test(serviceName))) return pattern.id;
  }

  return id || nameNorm.replace(/\s+/g, "-") || "unknown-service";
}

function resolveEnabledProfileServices(profile: PharmacyProfileData): Array<{ id: string; name: string }> {
  const selected = profile.selectedServices || [];
  if (selected.length) {
    return selected.map((id) => {
      let name = serviceDisplayName(id);
      const meta = getServicePublishMeta(id);
      if (meta) name = meta.serviceName;
      return { id: resolveCanonicalServiceId(id, name), name };
    });
  }

  const seen = new Set<string>();
  const out: Array<{ id: string; name: string }> = [];
  for (const row of profile.detectedWebsiteServices || []) {
    const canonicalId = resolveCanonicalServiceId(row.serviceId, row.serviceName);
    if (seen.has(canonicalId)) continue;
    seen.add(canonicalId);
    out.push({ id: canonicalId, name: row.serviceName || serviceDisplayName(canonicalId) });
  }
  return out;
}

function supportingForService(serviceId: string, pages: WebsitePageInventoryItem[]) {
  const related = pages.filter((p) => {
    const ids = new Set([
      ...p.detectedServiceIds.map((id) => resolveCanonicalServiceId(id)),
      ...detectServicesInUrl(p.path).map((id) => resolveCanonicalServiceId(id)),
    ]);
    return ids.has(serviceId);
  });
  return {
    faqs: related.filter((p) => p.category === "faq").length,
    blogs: related.filter((p) => p.category === "blog" || p.category === "news").length,
    guides: related.filter((p) => p.category === "guide").length,
    localPages: related.filter((p) => p.category === "locations").length,
  };
}

function buildDiagnosticServices(pages: WebsitePageInventoryItem[]): WebsiteServiceDetection[] {
  const map = detectAllServicesFromPages(pages);
  const detections: WebsiteServiceDetection[] = [];

  for (const pattern of WEBSITE_SERVICE_PATTERNS) {
    const entry = map.get(pattern.id);
    const related = entry?.pages || [];
    if (!related.length) continue;
    const mainPage =
      related.find((p) => p.category === "service-page") ||
      related.find((p) => detectServicesInUrl(p.path).includes(pattern.id)) ||
      related[0];
    detections.push({
      serviceId: pattern.id,
      serviceName: pattern.name,
      detected: true,
      pageCount: related.length,
      mainPageUrl: mainPage?.url || null,
      supportingContent: supportingForService(pattern.id, pages),
    });
  }

  return detections.sort((a, b) => b.pageCount - a.pageCount);
}

function dedicatedPageForService(serviceId: string, pages: WebsitePageInventoryItem[]): WebsitePageInventoryItem | null {
  const pattern = servicePatternById(serviceId);
  if (!pattern) return null;
  return (
    pages.find(
      (p) =>
        (p.category === "service-page" || p.category === "services") &&
        pattern.urlPatterns.some((re) => re.test(p.path)),
    ) || null
  );
}

function applyUmbrellaDedupe(services: CanonicalWebsiteServiceRecord[]): CanonicalWebsiteServiceRecord[] {
  const ids = new Set(services.map((s) => s.serviceId));
  let result = services;
  if (ids.has("flu-vaccinations") || ids.has("covid-vaccinations") || ids.has("travel-vaccinations")) {
    if (ids.has("vaccinations")) {
      result = result.filter((s) => s.serviceId !== "vaccinations" || !s.dedicatedPage);
    }
  }
  if (ids.has("repeat-prescriptions") && ids.has("prescription-dispensing")) {
    result = result.filter((s) => s.serviceId !== "prescription-dispensing" || !s.dedicatedPage);
  }
  return result;
}

function buildCanonicalServices(
  pages: WebsitePageInventoryItem[],
  profile: PharmacyProfileData,
  customerVisibleServices: CustomerVisibleWebsiteService[],
): CanonicalWebsiteServiceRecord[] {
  const diagnostic = buildDiagnosticServices(pages);
  const diagnosticById = new Map(diagnostic.map((d) => [d.serviceId, d]));
  const enabled = resolveEnabledProfileServices(profile);
  const enabledIds = new Set(enabled.map((s) => s.id));
  const byId = new Map<string, CanonicalWebsiteServiceRecord>();

  for (const det of diagnostic) {
    const dedicated = dedicatedPageForService(det.serviceId, pages);
    byId.set(det.serviceId, {
      serviceId: det.serviceId,
      serviceName: det.serviceName,
      customerVisible: false,
      dedicatedPage: Boolean(dedicated),
      sourceUrl: dedicated?.url || det.mainPageUrl,
      detectionMethod: dedicated ? "dedicated-page" : "diagnostic-match",
      confidence: dedicated ? 90 : 78,
      profileEnabled: enabledIds.has(det.serviceId),
      coverageStatus: dedicated ? "dedicated-page" : "mentioned-only",
      diagnosticMatch: true,
      relatedPageCount: det.pageCount,
      supportingContent: det.supportingContent,
    });
  }

  for (const visible of customerVisibleServices) {
    const canonicalId = resolveCanonicalServiceId(visible.serviceId, visible.serviceName);
    const existing = byId.get(canonicalId);
    const dedicated = dedicatedPageForService(canonicalId, pages);
    byId.set(canonicalId, {
      serviceId: canonicalId,
      serviceName: visible.serviceName || serviceDisplayName(canonicalId),
      customerVisible: true,
      dedicatedPage: true,
      sourceUrl: visible.sourceUrl || dedicated?.url || existing?.sourceUrl || null,
      detectionMethod: visible.detectionMethod || "dedicated-page",
      confidence: visible.confidence || existing?.confidence || 90,
      profileEnabled: enabledIds.has(canonicalId) || existing?.profileEnabled || false,
      coverageStatus: "dedicated-page",
      diagnosticMatch: Boolean(existing?.diagnosticMatch),
      relatedPageCount: existing?.relatedPageCount || 1,
      supportingContent: existing?.supportingContent || supportingForService(canonicalId, pages),
    });
  }

  for (const enabledService of enabled) {
    if (byId.has(enabledService.id)) {
      const row = byId.get(enabledService.id)!;
      row.profileEnabled = true;
      continue;
    }
    byId.set(enabledService.id, {
      serviceId: enabledService.id,
      serviceName: enabledService.name,
      customerVisible: false,
      dedicatedPage: false,
      sourceUrl: null,
      detectionMethod: "not-found",
      confidence: 0,
      profileEnabled: true,
      coverageStatus: "not-found",
      diagnosticMatch: false,
      relatedPageCount: 0,
      supportingContent: { faqs: 0, blogs: 0, guides: 0, localPages: 0 },
    });
  }

  return applyUmbrellaDedupe([...byId.values()]).sort((a, b) => {
    if (a.customerVisible !== b.customerVisible) return a.customerVisible ? -1 : 1;
    if (a.dedicatedPage !== b.dedicatedPage) return a.dedicatedPage ? -1 : 1;
    return a.serviceName.localeCompare(b.serviceName);
  });
}

function coverageStatusLabel(status: WebsiteCoverageStatus): string {
  if (status === "dedicated-page") return "Dedicated page found";
  if (status === "mentioned-only") return "Mentioned only";
  return "Not found";
}

function buildCoverage(services: CanonicalWebsiteServiceRecord[]): WebsiteContentCoverageRow[] {
  return services
    .filter((s) => s.profileEnabled)
    .map((s) => ({
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      profileEnabled: true,
      websiteDetected: s.coverageStatus !== "not-found",
      mainPageUrl: s.sourceUrl,
      supportingContent: s.supportingContent,
      coverageStatus: s.coverageStatus,
    }));
}

function buildMissingContent(services: CanonicalWebsiteServiceRecord[]): WebsiteMissingContentItem[] {
  const missing: WebsiteMissingContentItem[] = [];
  for (const service of services.filter((s) => s.profileEnabled)) {
    if (service.coverageStatus === "not-found") {
      missing.push({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        gap: "No dedicated service page detected",
        evidence: `${service.serviceName} is enabled in your Business Profile but no dedicated page was found on your website.`,
      });
      continue;
    }

    if (service.coverageStatus === "mentioned-only") {
      missing.push({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        gap: "Mentioned only — no dedicated page",
        evidence: `${service.serviceName} appears in broader website content but does not have its own dedicated service page.`,
      });
    }

    if (service.dedicatedPage && service.supportingContent.guides === 0) {
      missing.push({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        gap: "No patient guide",
        evidence: `Dedicated service page found for ${service.serviceName}. Supporting patient guide content is missing.`,
      });
    }
    if (service.dedicatedPage && service.supportingContent.blogs === 0) {
      missing.push({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        gap: "No blog support",
        evidence: `Dedicated service page found for ${service.serviceName}. Supporting blog content is missing.`,
      });
    }
    if (service.dedicatedPage && service.supportingContent.localPages === 0) {
      missing.push({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        gap: "No local pages",
        evidence: `Dedicated service page found for ${service.serviceName}. Local area supporting pages are missing.`,
      });
    }
    if (service.dedicatedPage && service.supportingContent.faqs === 0) {
      missing.push({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        gap: "No service-specific FAQs",
        evidence: `Dedicated service page found for ${service.serviceName}. Service-specific FAQ content is missing.`,
      });
    }
  }
  return missing;
}

function buildOpportunities(services: CanonicalWebsiteServiceRecord[]): WebsiteContentOpportunity[] {
  const opps: WebsiteContentOpportunity[] = [];
  for (const service of services.filter((s) => s.profileEnabled)) {
    if (service.coverageStatus === "not-found") {
      opps.push({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        headline: "Add a dedicated service page",
        detail: "Create a patient-facing service page so this enabled service can be found on your website.",
        evidence: `${service.serviceName} is enabled in your Business Profile but was not found on your website.`,
      });
      continue;
    }

    if (service.coverageStatus === "mentioned-only") {
      opps.push({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        headline: "Upgrade to a dedicated service page",
        detail: "This service is mentioned on your website but does not yet have its own dedicated page.",
        evidence: `${service.serviceName} was detected in broader website content only.`,
      });
      continue;
    }

    const supportTotal =
      service.supportingContent.faqs +
      service.supportingContent.blogs +
      service.supportingContent.guides +
      service.supportingContent.localPages;
    if (supportTotal <= 1) {
      opps.push({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        headline: "Add supporting patient content",
        detail: "Dedicated service page found. Supporting patient guide, blog and local content are missing.",
        evidence: `${service.serviceName} has a dedicated page (${service.sourceUrl || "detected"}) with limited supporting content.`,
      });
    }
  }
  return opps.slice(0, 12);
}

function buildSummary(
  counts: CanonicalWebsiteReportCounts,
  services: CanonicalWebsiteServiceRecord[],
  inventory: WebsiteContentInventory,
): string[] {
  const paragraphs: string[] = [];
  paragraphs.push(`We identified ${counts.contentPages} content page${counts.contentPages === 1 ? "" : "s"} on your website.`);
  paragraphs.push(
    `${counts.dedicatedServicePages} dedicated service page${counts.dedicatedServicePages === 1 ? "" : "s"}, ${counts.customerVisibleServices} customer-visible service${counts.customerVisibleServices === 1 ? "" : "s"}, ${counts.diagnosticServiceMatches} broader diagnostic match${counts.diagnosticServiceMatches === 1 ? "" : "es"}, and ${counts.enabledBusinessProfileServices} enabled Business Profile service${counts.enabledBusinessProfileServices === 1 ? "" : "s"}.`,
  );

  const notFound = services.filter((s) => s.profileEnabled && s.coverageStatus === "not-found");
  if (notFound.length) {
    paragraphs.push(
      `${notFound.slice(0, 3).map((s) => s.serviceName).join(", ")}${notFound.length > 3 ? ` and ${notFound.length - 3} more` : ""} ${notFound.length === 1 ? "is" : "are"} enabled in your Business Profile but do not have dedicated website pages.`,
    );
  }

  const thinSupport = services.filter(
    (s) => s.dedicatedPage && s.supportingContent.faqs + s.supportingContent.blogs + s.supportingContent.guides <= 1,
  );
  if (thinSupport.length >= 2) {
    paragraphs.push("Several services with dedicated pages still need supporting patient content such as guides, blogs or local pages.");
  } else if (inventory.servicePages > 0 && inventory.blogArticles === 0 && inventory.patientGuides === 0) {
    paragraphs.push("Dedicated service pages exist but supporting blogs and patient guides were not detected.");
  }

  return paragraphs.slice(0, 5);
}

const ECOSYSTEM_PAGES_PER_SERVICE = {
  servicePage: 1,
  guide: 1,
  faq: 1,
  blogs: 3,
};

/** Single statistics model for every Website Report displayed count. */
export function buildWebsiteReportStatistics(input: {
  contentPages: WebsitePageInventoryItem[];
  inventory: WebsiteContentInventory;
  diagnosticServices: WebsiteServiceDetection[];
  services: CanonicalWebsiteServiceRecord[];
  profile: PharmacyProfileData;
}): CanonicalWebsiteReportCounts {
  const enabled = resolveEnabledProfileServices(input.profile);
  const enabledCount = enabled.length || 1;
  const areas = (input.profile.selectedAreas || []).filter((a) => a.selected !== false);
  const localPagesPerService = Math.min(Math.max(areas.length, (input.profile.rankingAreas || []).length, 1), 12);
  const perService =
    ECOSYSTEM_PAGES_PER_SERVICE.servicePage +
    ECOSYSTEM_PAGES_PER_SERVICE.guide +
    ECOSYSTEM_PAGES_PER_SERVICE.faq +
    ECOSYSTEM_PAGES_PER_SERVICE.blogs +
    localPagesPerService;
  const contentPages = input.contentPages.length;
  const recommendedEcosystemPages = enabledCount * perService + 1;

  return {
    contentPages,
    dedicatedServicePages: input.contentPages.filter((p) => p.category === "service-page").length,
    blogArticles: input.inventory.blogArticles,
    faqPages: input.inventory.faqPages,
    patientGuides: input.inventory.patientGuides,
    locationPages: input.inventory.locationPages,
    newsArticles: input.inventory.newsArticles,
    customerVisibleServices: input.services.filter((s) => s.customerVisible).length,
    diagnosticServiceMatches: input.diagnosticServices.length,
    enabledBusinessProfileServices: enabled.length,
    recommendedEcosystemPages,
    recommendedLocalPagesPerService: localPagesPerService,
    ecosystemGapPages: Math.max(0, recommendedEcosystemPages - contentPages),
  };
}

export function buildCanonicalWebsiteReportEvidence(input: {
  pages: WebsitePageInventoryItem[];
  profile: PharmacyProfileData;
  customerVisibleServices?: CustomerVisibleWebsiteService[];
}): CanonicalWebsiteReportEvidence {
  const contentPages = canonicalizeWebsiteContentPages(input.pages);
  const inventory = buildContentInventory(contentPages);
  const customerVisibleServices = input.customerVisibleServices || [];
  const services = buildCanonicalServices(contentPages, input.profile, customerVisibleServices);
  const diagnosticServices = buildDiagnosticServices(contentPages);
  const counts = buildWebsiteReportStatistics({
    contentPages,
    inventory,
    diagnosticServices,
    services,
    profile: input.profile,
  });

  return {
    contentPages,
    inventory,
    services,
    diagnosticServices,
    counts,
    coverage: buildCoverage(services),
    missingContent: buildMissingContent(services),
    opportunities: buildOpportunities(services),
    summaryParagraphs: buildSummary(counts, services, inventory),
  };
}

export function canonicalServiceToDetection(record: CanonicalWebsiteServiceRecord): WebsiteServiceDetection {
  return {
    serviceId: record.serviceId,
    serviceName: record.serviceName,
    detected: record.coverageStatus !== "not-found",
    pageCount: record.relatedPageCount,
    mainPageUrl: record.sourceUrl,
    supportingContent: record.supportingContent,
  };
}

export { coverageStatusLabel };
