/**
 * Website Import — customer-visible service detection accuracy V1.
 * Filters raw crawl detections to services with direct website evidence.
 */
import type { WebsitePageInventoryItem } from "./growthEngineWebsiteIntelligenceModel.ts";
import type { WebsiteIntelligenceServiceV2 } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import { fetchWebsiteHtml } from "./growthEngineWebsiteCrawler.ts";
import { servicePatternById } from "./growthEngineWebsiteServiceDetection.ts";

export interface CustomerVisibleWebsiteService {
  serviceId: string;
  serviceName: string;
  sourceUrl: string;
  matchedSnippet: string;
  detectionMethod: string;
  confidence: number;
}

export interface CustomerVisibleServiceAuditRow extends CustomerVisibleWebsiteService {
  included: boolean;
  exclusionReason?: string;
}

export interface BuildCustomerVisibleServicesInput {
  serviceRows: WebsiteIntelligenceServiceV2[];
  pages: WebsitePageInventoryItem[];
  homepageUrl: string;
  homepageHtml?: string;
}

const CMS_TEMPLATE_LABEL = /pages\s*&\s*content/i;
const GENERIC_SHARED_PATHS = new Set([
  "/head-office",
  "/health-az",
  "/health-news",
  "/medicine-az",
  "/testimonials",
  "/leaflets",
  "/privacy-policy",
  "/register",
  "/blogs",
  "/branches",
]);

const STRONG_HOMEPAGE_COPY: Record<string, RegExp> = {
  "pharmacy-first":
    /pharmacy first now available|receive treatment from your local pharmacist without having to book/i,
  "blood-pressure-checks":
    /blood pressure check this service is a free nhs consultation from your pharmacist/i,
  "pharmacy-contraception-service":
    /contraception service if you have a question about your contraception/i,
  "repeat-prescriptions":
    /repeat prescription collection service|easily handle your repeat prescriptions|order your repeat prescription online/i,
  "flu-vaccinations": /eligible for a free nhs flu jab|free flu jab vaccination/i,
  "travel-vaccinations": /travel clinic(?: service| consultation| vaccination)/i,
  "covid-vaccinations": /covid(?:-19)? vaccin(?:ation|e service)/i,
};

const UMBRELLA_VACCINATION_IDS = new Set(["flu-vaccinations", "covid-vaccinations", "travel-vaccinations"]);

function plainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function snippetAround(text: string, index: number, radius = 70): string {
  return text.slice(Math.max(0, index - radius), index + radius).trim();
}

function findSnippet(text: string, patterns: RegExp[]): { snippet: string; index: number } | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m.index != null) return { snippet: snippetAround(text, m.index), index: m.index };
  }
  return null;
}

function dedicatedPages(serviceId: string, pages: WebsitePageInventoryItem[]): WebsitePageInventoryItem[] {
  const pattern = servicePatternById(serviceId);
  if (!pattern) return [];
  return pages.filter((p) => {
    if (serviceId === "repeat-prescriptions" && p.path === "/prescriptions") return true;
    return (
      pattern.urlPatterns.some((re) => re.test(p.path)) &&
      !GENERIC_SHARED_PATHS.has(p.path) &&
      (p.category === "service-page" || p.category === "services" || p.path === "/prescriptions")
    );
  });
}

function strongHomepageEvidence(
  serviceId: string,
  homepageText: string,
): { snippet: string; confidence: number } | null {
  const strong = STRONG_HOMEPAGE_COPY[serviceId];
  if (!strong) return null;
  const hit = findSnippet(homepageText, [strong]);
  if (!hit || CMS_TEMPLATE_LABEL.test(hit.snippet)) return null;
  return { snippet: hit.snippet, confidence: 82 };
}

function servicesPageEvidence(
  serviceId: string,
  servicesText: string,
  serviceName: string,
): { snippet: string; confidence: number; method: string } | null {
  const pattern = servicePatternById(serviceId);
  const nameRe = new RegExp(serviceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const patterns = pattern?.htmlPatterns || [nameRe];
  const hit = findSnippet(servicesText, patterns);
  if (!hit) return null;
  if (CMS_TEMPLATE_LABEL.test(hit.snippet)) return null;
  if (/seasonal services \(such as nhs flu/i.test(hit.snippet)) return null;
  if (/what do you want to do\?/i.test(hit.snippet)) return null;
  if (/collection service we manage the whole repeat prescription/i.test(hit.snippet)) {
    return { snippet: hit.snippet, confidence: 88, method: "service-section" };
  }
  return { snippet: hit.snippet, confidence: 74, method: "service-listing" };
}

function isGlobalBulkOnly(serviceId: string, pages: WebsitePageInventoryItem[]): boolean {
  const related = pages.filter((p) => p.detectedServiceIds.includes(serviceId));
  if (related.length < 8) return false;
  const nonGeneric = related.filter((p) => !GENERIC_SHARED_PATHS.has(p.path) && p.path !== "/");
  return nonGeneric.length <= 1;
}

function evaluateService(
  row: WebsiteIntelligenceServiceV2,
  pages: WebsitePageInventoryItem[],
  homepageText: string,
  servicesText: string,
  prescriptionsText: string,
): CustomerVisibleServiceAuditRow {
  const base: CustomerVisibleServiceAuditRow = {
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    sourceUrl: row.url || "",
    matchedSnippet: "",
    detectionMethod: row.evidence.detectionMethod || "page-crawl",
    confidence: row.evidence.confidence || 0,
    included: false,
  };

  if (!row.exists) {
    return { ...base, exclusionReason: "not-detected" };
  }

  const dedicated = dedicatedPages(row.serviceId, pages);
  if (dedicated.length) {
    const path = dedicated[0];
    const pageText =
      path.path === "/prescriptions"
        ? prescriptionsText
        : path.path === "/services"
          ? servicesText
          : homepageText;
    const pattern = servicePatternById(row.serviceId);
    const hit = findSnippet(pageText, pattern?.htmlPatterns || []);
    if (hit && !CMS_TEMPLATE_LABEL.test(hit.snippet)) {
      return {
        ...base,
        included: true,
        sourceUrl: path.url,
        matchedSnippet: hit.snippet,
        detectionMethod: "dedicated-page",
        confidence: 90,
      };
    }
  }

  const homepageHit = strongHomepageEvidence(row.serviceId, homepageText);
  if (homepageHit) {
    if (
      row.serviceId === "flu-vaccinations" &&
      /health news \d{2}\/\d{2}\/\d{4}/i.test(homepageHit.snippet) &&
      !dedicatedPages(row.serviceId, pages).length
    ) {
      // Historical news article mention — not an active service page.
    } else {
      return {
        ...base,
        included: true,
        sourceUrl: pages.find((p) => p.path === "/")?.url || base.sourceUrl,
        matchedSnippet: homepageHit.snippet,
        detectionMethod: "homepage-service-copy",
        confidence: homepageHit.confidence,
      };
    }
  }

  const servicesHit = servicesPageEvidence(row.serviceId, servicesText, row.serviceName);
  if (servicesHit) {
    return {
      ...base,
      included: true,
      sourceUrl: pages.find((p) => p.path === "/services")?.url || base.sourceUrl,
      matchedSnippet: servicesHit.snippet,
      detectionMethod: servicesHit.method,
      confidence: servicesHit.confidence,
    };
  }

  if (isGlobalBulkOnly(row.serviceId, pages)) {
    return { ...base, exclusionReason: "global-navigation-only" };
  }

  return { ...base, exclusionReason: "weak-global-detection" };
}

function applyUmbrellaDedupe(services: CustomerVisibleWebsiteService[]): CustomerVisibleWebsiteService[] {
  const ids = new Set(services.map((s) => s.serviceId));
  let result = services;
  if ([...UMBRELLA_VACCINATION_IDS].some((id) => ids.has(id)) && ids.has("vaccinations")) {
    result = result.filter((s) => s.serviceId !== "vaccinations");
  }
  if (ids.has("repeat-prescriptions") && ids.has("prescription-dispensing")) {
    result = result.filter((s) => s.serviceId !== "prescription-dispensing");
  }
  return result;
}

export async function buildCustomerVisibleWebsiteServices(
  input: BuildCustomerVisibleServicesInput,
): Promise<CustomerVisibleWebsiteService[]> {
  const homepageUrl = input.homepageUrl.replace(/\/$/, "") || input.homepageUrl;
  const homepageHtml = input.homepageHtml || (await fetchWebsiteHtml(homepageUrl)) || "";
  const [servicesHtml, prescriptionsHtml] = await Promise.all([
    fetchWebsiteHtml(`${homepageUrl}/services`),
    fetchWebsiteHtml(`${homepageUrl}/prescriptions`),
  ]);

  const homepageText = plainText(homepageHtml);
  const servicesText = plainText(servicesHtml || "");
  const prescriptionsText = plainText(prescriptionsHtml || "");

  const audited = input.serviceRows
    .filter((r) => r.exists)
    .map((row) => evaluateService(row, input.pages, homepageText, servicesText, prescriptionsText));

  return applyUmbrellaDedupe(
    audited
      .filter((row) => row.included)
      .map(({ serviceId, serviceName, sourceUrl, matchedSnippet, detectionMethod, confidence }) => ({
        serviceId,
        serviceName,
        sourceUrl,
        matchedSnippet,
        detectionMethod,
        confidence,
      })),
  );
}

export async function auditWebsiteImportServiceDetections(
  input: BuildCustomerVisibleServicesInput,
): Promise<CustomerVisibleServiceAuditRow[]> {
  const homepageUrl = input.homepageUrl.replace(/\/$/, "") || input.homepageUrl;
  const homepageHtml = input.homepageHtml || (await fetchWebsiteHtml(homepageUrl)) || "";
  const [servicesHtml, prescriptionsHtml] = await Promise.all([
    fetchWebsiteHtml(`${homepageUrl}/services`),
    fetchWebsiteHtml(`${homepageUrl}/prescriptions`),
  ]);
  const homepageText = plainText(homepageHtml);
  const servicesText = plainText(servicesHtml || "");
  const prescriptionsText = plainText(prescriptionsHtml || "");

  const visibleIds = new Set(
    (
      await buildCustomerVisibleWebsiteServices({
        ...input,
        homepageHtml,
      })
    ).map((s) => s.serviceId),
  );

  return input.serviceRows
    .filter((r) => r.exists)
    .map((row) => {
      const audit = evaluateService(row, input.pages, homepageText, servicesText, prescriptionsText);
      if (audit.included && !visibleIds.has(row.serviceId)) {
        return { ...audit, included: false, exclusionReason: "umbrella-duplicate" };
      }
      return audit;
    });
}
