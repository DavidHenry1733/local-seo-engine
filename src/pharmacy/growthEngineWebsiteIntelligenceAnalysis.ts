/**
 * Growth Engine — Website Intelligence V1 analysis builder.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import type {
  WebsiteContentInventory,
  WebsiteContentMapNode,
  WebsiteContentOpportunity,
  WebsiteIntelligenceAnalysis,
  WebsiteMissingContentItem,
  WebsitePageInventoryItem,
  WebsiteServiceDetection,
  WebsiteTechnicalOverview,
  WebsiteVisualSummary,
  WebsiteContentCoverageRow,
} from "./growthEngineWebsiteIntelligenceModel.ts";
import { WEBSITE_PAGE_CATEGORY_LABELS, type WebsitePageCategory } from "./growthEngineWebsiteIntelligenceModel.ts";
import {
  detectAllServicesFromPages,
  serviceDisplayName,
  WEBSITE_SERVICE_PATTERNS,
} from "./growthEngineWebsiteServiceDetection.ts";
import {
  buildCanonicalWebsiteReportEvidence,
  type CanonicalWebsiteReportCounts,
} from "./growthEngineWebsiteReportCanonicalEvidence.ts";
import type { CustomerVisibleWebsiteService } from "./growthEngineWebsiteImportCustomerVisibleServices.ts";

const ECOSYSTEM_PAGES_PER_SERVICE = {
  servicePage: 1,
  guide: 1,
  faq: 1,
  blogs: 3,
};

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

function resolveEnabledServiceIds(profile: PharmacyProfileData): Array<{ id: string; name: string }> {
  const selected = profile.selectedServices || [];
  if (selected.length) {
    return selected.map((id) => {
      let name = serviceDisplayName(id);
      const meta = getServicePublishMeta(id);
      if (meta) name = meta.serviceName;
      return { id, name };
    });
  }
  return (profile.detectedWebsiteServices || []).map((s) => ({ id: s.serviceId, name: s.serviceName }));
}

export function buildContentInventory(pages: WebsitePageInventoryItem[]): WebsiteContentInventory {
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

function supportingForService(serviceId: string, pages: WebsitePageInventoryItem[]) {
  const related = pages.filter((p) => p.detectedServiceIds.includes(serviceId));
  return {
    faqs: related.filter((p) => p.category === "faq").length,
    blogs: related.filter((p) => p.category === "blog" || p.category === "news").length,
    guides: related.filter((p) => p.category === "guide").length,
    localPages: related.filter((p) => p.category === "locations").length,
  };
}

export function buildServiceDetections(pages: WebsitePageInventoryItem[]): WebsiteServiceDetection[] {
  const map = detectAllServicesFromPages(pages);
  const detections: WebsiteServiceDetection[] = [];

  for (const pattern of WEBSITE_SERVICE_PATTERNS) {
    const entry = map.get(pattern.id);
    const related = entry?.pages || [];
    const mainPage = related.find((p) => p.category === "service-page") || related[0];
    if (!related.length) continue;
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

export function buildContentCoverage(
  profile: PharmacyProfileData,
  pages: WebsitePageInventoryItem[],
  detections: WebsiteServiceDetection[],
): WebsiteContentCoverageRow[] {
  const enabled = resolveEnabledServiceIds(profile);
  const byId = new Map(detections.map((d) => [d.serviceId, d]));

  return enabled.map(({ id, name }) => {
    const det = byId.get(id);
    return {
      serviceId: id,
      serviceName: name,
      profileEnabled: true,
      websiteDetected: Boolean(det),
      mainPageUrl: det?.mainPageUrl || null,
      supportingContent: det?.supportingContent || { faqs: 0, blogs: 0, guides: 0, localPages: 0 },
    };
  });
}

export function buildMissingContent(coverage: WebsiteContentCoverageRow[]): WebsiteMissingContentItem[] {
  const missing: WebsiteMissingContentItem[] = [];
  for (const row of coverage) {
    if (!row.websiteDetected) {
      missing.push({
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        gap: "No service page detected",
        evidence: `${row.serviceName} is enabled in your Business Profile but was not found on your website.`,
      });
      continue;
    }
    if (row.supportingContent.faqs === 0) {
      missing.push({
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        gap: "No FAQs",
        evidence: `${row.serviceName} has a page on your website but no linked FAQ content was detected.`,
      });
    }
    if (row.supportingContent.guides === 0) {
      missing.push({
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        gap: "No patient guide",
        evidence: `No patient guide pages were detected for ${row.serviceName}.`,
      });
    }
    if (row.supportingContent.blogs === 0) {
      missing.push({
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        gap: "No blog support",
        evidence: `No blog or news articles referencing ${row.serviceName} were detected.`,
      });
    }
    if (row.supportingContent.localPages === 0) {
      missing.push({
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        gap: "No local pages",
        evidence: `No location or local area pages were detected for ${row.serviceName}.`,
      });
    }
  }
  return missing;
}

export function buildContentOpportunities(
  coverage: WebsiteContentCoverageRow[],
  missing: WebsiteMissingContentItem[],
): WebsiteContentOpportunity[] {
  const opps: WebsiteContentOpportunity[] = [];

  for (const row of coverage) {
    if (!row.websiteDetected) {
      opps.push({
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        headline: "Not detected on website",
        detail: "Recommended full PharmaConnect ecosystem for this enabled service.",
        evidence: `${row.serviceName} is enabled in your Business Profile but no matching website content was found.`,
      });
      continue;
    }

    const supportTotal =
      row.supportingContent.faqs + row.supportingContent.blogs + row.supportingContent.guides + row.supportingContent.localPages;
    if (supportTotal <= 1) {
      opps.push({
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        headline: row.supportingContent.guides === 0 ? "Needs supporting ecosystem" : "Existing — needs supporting ecosystem",
        detail: "Add FAQs, guides, blogs and local pages around this service.",
        evidence: `${row.serviceName} is present (${row.mainPageUrl || "detected"}) with limited supporting content (${supportTotal} supporting page(s) detected).`,
      });
    } else if (row.supportingContent.guides === 0) {
      opps.push({
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        headline: "No guides",
        detail: "Recommended patient guides for this service.",
        evidence: `${row.serviceName} has ${row.supportingContent.blogs} blog(s) and ${row.supportingContent.faqs} FAQ(s) but no guide pages.`,
      });
    }
  }

  for (const m of missing.slice(0, 10)) {
    if (opps.some((o) => o.serviceId === m.serviceId && o.headline.includes("Not detected"))) continue;
  }

  return opps.slice(0, 12);
}

export function estimateRecommendedEcosystemPages(profile: PharmacyProfileData): {
  totalPages: number;
  enabledServices: number;
  localPagesPerService: number;
} {
  const enabled = resolveEnabledServiceIds(profile);
  const areas = (profile.selectedAreas || []).filter((a) => a.selected !== false);
  const localPagesPerService = Math.min(Math.max(areas.length, (profile.rankingAreas || []).length, 1), 12);
  const perService =
    ECOSYSTEM_PAGES_PER_SERVICE.servicePage +
    ECOSYSTEM_PAGES_PER_SERVICE.guide +
    ECOSYSTEM_PAGES_PER_SERVICE.faq +
    ECOSYSTEM_PAGES_PER_SERVICE.blogs +
    localPagesPerService;

  const enabledCount = enabled.length || 1;
  const totalPages = enabledCount * perService + 1;
  return { totalPages, enabledServices: enabledCount, localPagesPerService };
}

export function buildVisualSummary(
  inventory: WebsiteContentInventory,
  profile: PharmacyProfileData,
): WebsiteVisualSummary {
  const recommended = estimateRecommendedEcosystemPages(profile);
  const currentTotal = inventory.totalPages;
  return {
    currentWebsite: {
      totalPages: currentTotal,
      servicePages: inventory.servicePages,
      blogs: inventory.blogArticles,
      faqs: inventory.faqPages,
      guides: inventory.patientGuides,
    },
    recommendedEcosystem: recommended,
    differencePages: Math.max(0, recommended.totalPages - currentTotal),
  };
}

export function buildContentMap(inventory: WebsiteContentInventory): WebsiteContentMapNode[] {
  return [
    {
      id: "home",
      label: "Home",
      count: inventory.byCategory.homepage,
      children: [
        {
          id: "services",
          label: "Services",
          count: inventory.byCategory.services + inventory.servicePages,
          children: [
            {
              id: "supporting",
              label: "Supporting Pages",
              count: inventory.byCategory.about + inventory.byCategory.contact + inventory.byCategory.booking,
              children: [
                { id: "blogs", label: "Blogs", count: inventory.blogArticles },
                { id: "guides", label: "Guides", count: inventory.patientGuides },
                { id: "faqs", label: "FAQs", count: inventory.faqPages },
                { id: "locations", label: "Locations", count: inventory.locationPages },
              ],
            },
          ],
        },
      ],
    },
  ];
}

export function buildWebsiteSummaryNarrative(
  pages: WebsitePageInventoryItem[],
  inventory: WebsiteContentInventory,
  coverage: WebsiteContentCoverageRow[],
  detections: WebsiteServiceDetection[],
): string[] {
  if (!pages.length) {
    return ["We could not analyse your website — check the URL in Business Intelligence and try again."];
  }

  const paragraphs: string[] = [];
  paragraphs.push(`We identified ${inventory.totalPages} page${inventory.totalPages === 1 ? "" : "s"} on your website.`);

  const strong = detections.find((d) => d.pageCount >= 2 && d.supportingContent.blogs + d.supportingContent.faqs >= 1);
  if (strong) {
    paragraphs.push(`Your website already contains ${strong.serviceName} information (${strong.pageCount} related page${strong.pageCount === 1 ? "" : "s"} detected).`);
  }

  const notDetected = coverage.filter((c) => c.profileEnabled && !c.websiteDetected);
  if (notDetected.length) {
    paragraphs.push(
      `${notDetected.slice(0, 3).map((c) => c.serviceName).join(", ")}${notDetected.length > 3 ? ` and ${notDetected.length - 3} more` : ""} ${notDetected.length === 1 ? "was" : "were"} not detected on your website.`,
    );
  }

  const thinSupport = coverage.filter(
    (c) => c.websiteDetected && c.supportingContent.faqs + c.supportingContent.blogs + c.supportingContent.guides <= 1,
  );
  if (thinSupport.length >= 2) {
    paragraphs.push("Several enabled services have little or no supporting content on your website.");
  } else if (inventory.servicePages > 0 && inventory.blogArticles === 0 && inventory.faqPages === 0) {
    paragraphs.push("Service pages exist but supporting blogs and FAQs were not detected.");
  }

  return paragraphs.slice(0, 5);
}

export function buildVisualSummaryFromStatistics(counts: CanonicalWebsiteReportCounts): WebsiteVisualSummary {
  return {
    currentWebsite: {
      totalPages: counts.contentPages,
      servicePages: counts.dedicatedServicePages,
      blogs: counts.blogArticles,
      faqs: counts.faqPages,
      guides: counts.patientGuides,
    },
    recommendedEcosystem: {
      totalPages: counts.recommendedEcosystemPages,
      enabledServices: counts.enabledBusinessProfileServices,
      localPagesPerService: counts.recommendedLocalPagesPerService,
    },
    differencePages: counts.ecosystemGapPages,
  };
}

export function buildWebsiteIntelligenceAnalysis(input: {
  websiteUrl: string;
  pages: WebsitePageInventoryItem[];
  technical: WebsiteTechnicalOverview;
  profile: PharmacyProfileData;
  customerVisibleServices?: CustomerVisibleWebsiteService[];
}): WebsiteIntelligenceAnalysis {
  const { websiteUrl, pages, technical, profile, customerVisibleServices } = input;
  const canonical = buildCanonicalWebsiteReportEvidence({
    pages,
    profile,
    customerVisibleServices,
  });
  const services = canonical.diagnosticServices;
  const visualSummary = buildVisualSummaryFromStatistics(canonical.counts);
  const contentMap = buildContentMap(canonical.inventory);

  return {
    dataSource: canonical.contentPages.length ? "website-live" : "unavailable",
    summaryParagraphs: canonical.summaryParagraphs,
    pages: canonical.contentPages,
    services,
    inventory: canonical.inventory,
    coverage: canonical.coverage,
    missingContent: canonical.missingContent,
    opportunities: canonical.opportunities,
    technical,
    visualSummary,
    contentMap,
    websiteUrl,
    understandingComplete: canonical.contentPages.length > 0 && Boolean(websiteUrl),
    canonicalCounts: canonical.counts,
    canonicalServices: canonical.services.map((record) => ({
      serviceId: record.serviceId,
      serviceName: record.serviceName,
      customerVisible: record.customerVisible,
      dedicatedPage: record.dedicatedPage,
      sourceUrl: record.sourceUrl,
      detectionMethod: record.detectionMethod,
      confidence: record.confidence,
      profileEnabled: record.profileEnabled,
      coverageStatus: record.coverageStatus,
      diagnosticMatch: record.diagnosticMatch,
      relatedPageCount: record.relatedPageCount,
      supportingContent: record.supportingContent,
    })),
  };
}

export function formatCategoryBreakdown(inventory: WebsiteContentInventory): string[] {
  return (Object.entries(inventory.byCategory) as [WebsitePageCategory, number][])
    .filter(([, n]) => n > 0)
    .map(([cat, n]) => `${WEBSITE_PAGE_CATEGORY_LABELS[cat]}: ${n}`);
}
