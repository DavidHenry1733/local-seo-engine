/**
 * Website Intelligence Import V2 — production setup import engine (Step 1 only).
 */
import type { BrandProfile } from "../generator/brandImporter.ts";
import type { CustomerSetupAdminBaseline } from "./pharmacyProfileSchema.ts";
import { normalizeProfileData, type PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import {
  analyzeWebsiteForPharmacy,
  extractFooterHtmlFromHomepage,
  extractWebsiteAddressCandidates,
  selectCanonicalWebsiteAddressCandidate,
} from "./pharmacyWebsiteAnalysisService.ts";
import {
  crawlWebsite,
  extractInternalLinks,
  extractTechnicalSignals,
  fetchWebsiteHtml,
} from "./growthEngineWebsiteCrawler.ts";
import {
  buildContentInventory,
  buildServiceDetections,
} from "./growthEngineWebsiteIntelligenceAnalysis.ts";
import {
  buildCustomerVisibleWebsiteServices,
  type CustomerVisibleWebsiteService,
} from "./growthEngineWebsiteImportCustomerVisibleServices.ts";
import type { WebsitePageInventoryItem } from "./growthEngineWebsiteIntelligenceModel.ts";
import {
  CLINICAL_PHARMACY_SERVICE_PATTERNS,
  detectServicesInHtml,
  detectServicesInUrl,
  serviceDisplayName,
} from "./growthEngineWebsiteServiceDetection.ts";
import {
  WEBSITE_INTELLIGENCE_IMPORT_V2_VERSION,
  type WebsiteImportEvidence,
  type WebsiteImportFieldCandidate,
  type WebsiteImportFieldValue,
  type WebsiteAddressCandidate,
  type WebsiteIntelligenceImportV2,
  type WebsiteIntelligenceServiceV2,
} from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import type { GrowthEngineWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceModel.ts";
import { WEBSITE_INTELLIGENCE_SNAPSHOT_VERSION } from "./growthEngineWebsiteIntelligenceModel.ts";
import { buildWebsiteIntelligenceAnalysis } from "./growthEngineWebsiteIntelligenceAnalysis.ts";
import { captureWebsiteDesignEvidence, designEvidenceHasUsableContent, loadWebsiteDesignEvidence } from "./pharmacyWebsiteDesignCaptureService.ts";
import { importDesignEvidenceAssets } from "./pharmacyWebsiteDesignAssetImporter.ts";
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import {
  extractBusinessNameCandidatesFromHtml,
  selectCorroboratedBusinessName,
} from "./growthEngineWebsiteBusinessIdentity.ts";
import { validateWebsitePhoneCandidate } from "./growthEngineWebsitePhoneValidation.ts";
import { classifyWebsiteBusinessType } from "./growthEngineWebsiteBusinessClassification.ts";
import { buildCommercialServiceEvidenceFromPages } from "./growthEngineWebsiteCommercialServiceEvidence.ts";
import {
  buildAudienceEvidenceFromPages,
  buildCtaEvidenceFromPages,
  buildOfferEvidenceFromPages,
  buildPricingEvidenceFromPages,
  buildSocialProfileEvidenceFromPages,
  buildTrustEvidenceFromPages,
  extractEmailCandidatesFromHtml,
} from "./growthEngineWebsiteBusinessIntelligenceEvidence.ts";
import { assessWebsiteImportEvidenceQuality } from "./growthEngineWebsiteEvidenceQualityGate.ts";

const AUTO_SELECT_CONFIDENCE = 55;
const PROVIDER_BLOCK =
  /wordpress\.com|wix\.com|squarespace|shopify|godaddy|ionos|hostinger|digital\s+agency|web\s+design\s+agency|powered\s+by\s+(wordpress|wix|squarespace)|\bBrook Pharmacy\b|\bBroom Lane Pharmacy\b|\bReliable Direct Pharmacy\b|\bBanner Cross Pharmacy\b|\bInboxingProWeb\b|\bPharmacy Delivered\b/i;
const NHS_LINK_RE = /href=["'](https?:\/\/(?:www\.)?nhs\.uk[^"']+)["']/gi;

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeUrl(raw: string): string {
  const trimmed = str(raw);
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function evidence(sourceUrl: string, confidence: number, method: string): WebsiteImportEvidence {
  return { sourceUrl, confidence, detectionMethod: method, detectedAt: nowIso() };
}

function isGenericSiteTitle(title: string): boolean {
  const t = title.toLowerCase().trim();
  return !t || t === "home" || t === "welcome" || t === "homepage" || t.length < 4;
}

function isProviderValue(value: string): boolean {
  return PROVIDER_BLOCK.test(value);
}

function buildField(candidates: WebsiteImportFieldCandidate[]): WebsiteImportFieldValue {
  const filtered = candidates.filter((c) => c.value && !isProviderValue(c.value));
  const sorted = [...filtered].sort((a, b) => b.confidence - a.confidence);
  const best = sorted[0];
  const selected = best && best.confidence >= AUTO_SELECT_CONFIDENCE ? best.value : "";
  return {
    selected,
    confidence: best?.confidence ?? 0,
    candidates: sorted.slice(0, 5),
    evidence: best ? evidence(best.sourceUrl, best.confidence, best.detectionMethod) : null,
  };
}

function extractTitle(html: string): string {
  return (
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim()
    || html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || ""
  );
}

function extractMetaDescription(html: string): string {
  return (
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]
    ?? ""
  ).trim();
}

function detectCms(html: string): string {
  if (/wp-content|wordpress/i.test(html)) return "WordPress";
  if (/cdn\.shopify|shopify\.com/i.test(html)) return "Shopify";
  if (/wix\.com|static\.wixstatic/i.test(html)) return "Wix";
  if (/squarespace/i.test(html)) return "Squarespace";
  const gen = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i)?.[1];
  return gen ? gen.trim() : "Custom / unknown";
}

function detectAnalytics(html: string): string[] {
  const found = new Set<string>();
  if (/googletagmanager\.com|GTM-[A-Z0-9]+/i.test(html)) found.add("Google Tag Manager");
  if (/gtag\(|G-[A-Z0-9]{6,}|google-analytics\.com|GA4/i.test(html)) found.add("GA4");
  return [...found];
}

function detectFacebookPixel(html: string): boolean {
  return /fbq\s*\(|facebook\.net\/en_US\/fbevents/i.test(html);
}

function detectCookiePlatform(html: string): string {
  if (/cookiebot/i.test(html)) return "Cookiebot";
  if (/onetrust/i.test(html)) return "OneTrust";
  if (/cookieyes/i.test(html)) return "CookieYes";
  if (/cookie-consent|cookieconsent/i.test(html)) return "Cookie consent banner";
  return "";
}

function extractPhones(html: string, sourceUrl: string): {
  candidates: WebsiteImportFieldCandidate[];
  rejected: Array<{ value: string; reason: string; sourceUrl?: string; detectionMethod?: string }>;
} {
  const candidates: WebsiteImportFieldCandidate[] = [];
  const rejected: Array<{ value: string; reason: string; sourceUrl?: string; detectionMethod?: string }> = [];
  const consider = (value: string, confidence: number, method: string) => {
    const check = validateWebsitePhoneCandidate(value);
    if (!check.valid) {
      rejected.push({ value: check.normalised || value, reason: check.reason, sourceUrl, detectionMethod: method });
      return;
    }
    candidates.push({
      value: check.normalised,
      confidence,
      sourceUrl,
      detectionMethod: method,
    });
  };
  const telLinks = [...html.matchAll(/href=["']tel:([^"']+)["']/gi)];
  for (const m of telLinks) {
    consider(m[1].replace(/\s+/g, " ").trim(), 86, "tel-link");
  }
  const schemaPhone = html.match(/"telephone"\s*:\s*"([^"]+)"/i)?.[1];
  if (schemaPhone) consider(schemaPhone.trim(), 90, "schema.org");
  // Visible UK-style numbers in contact blocks (avoid short fragments)
  const visible = [...html.matchAll(/(?:(?:tel|telephone|phone|call us)[^0-9+]{0,24})?(\+?44[\d\s()-]{9,16}|0\d[\d\s()-]{8,14})/gi)];
  for (const m of visible.slice(0, 8)) {
    consider(m[1].replace(/\s+/g, " ").trim(), 72, "visible-text");
  }
  return { candidates, rejected };
}

function buildPhoneField(
  candidates: WebsiteImportFieldCandidate[],
  rejected: Array<{ value: string; reason: string; sourceUrl?: string; detectionMethod?: string }>,
): WebsiteImportFieldValue {
  const filtered = candidates.filter((c) => c.value && validateWebsitePhoneCandidate(c.value).valid);
  const sorted = [...filtered].sort((a, b) => b.confidence - a.confidence);
  const best = sorted[0];
  const selected = best && best.confidence >= AUTO_SELECT_CONFIDENCE ? best.value : "";
  return {
    selected,
    confidence: selected ? best?.confidence ?? 0 : 0,
    candidates: sorted.slice(0, 5),
    evidence: selected && best ? evidence(best.sourceUrl, best.confidence, best.detectionMethod) : null,
    selectionReasoning: selected
      ? `Selected validated website telephone from ${best?.detectionMethod}`
      : rejected.length
        ? `No valid website telephone; rejected ${rejected.length} candidate(s)`
        : "No website telephone candidates found",
    rejectedCandidates: rejected.slice(0, 8),
  };
}

function extractEmails(html: string, sourceUrl: string, host: string): WebsiteImportFieldCandidate[] {
  return extractEmailCandidatesFromHtml(html, sourceUrl, host);
}

function extractNhsLinks(html: string): string[] {
  const links = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(NHS_LINK_RE.source, NHS_LINK_RE.flags);
  while ((m = re.exec(html))) links.add(m[1]);
  return [...links].slice(0, 8);
}

function extractEmergencyNumber(html: string, sourceUrl: string): WebsiteImportFieldCandidate[] {
  const m = html.match(/(?:out\s+of\s+hours|emergency)[^<]{0,80}(\d[\d\s]{8,12}\d)/i);
  if (!m) return [];
  const value = m[1].replace(/\s+/g, " ").trim();
  if (!validateWebsitePhoneCandidate(value).valid) return [];
  return [{ value, confidence: 65, sourceUrl, detectionMethod: "emergency-text" }];
}

function countWords(html: string): number {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.split(" ").length : 0;
}

function analyzeServicePageContent(html: string, url: string): WebsiteIntelligenceServiceV2["content"] {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const images = (html.match(/<img\b/gi) || []).length;
  const internalLinks = extractInternalLinks(html, new URL(url)).length;
  const booking =
    html.match(/href=["'](https?:\/\/[^"']*(?:book|appointment|calendly)[^"']*)["']/i)?.[1]
    || html.match(/href=["']([^"']*book(?:ing)?[^"']*)["']/i)?.[1]
    || "";
  const lastUpdated =
    html.match(/<meta[^>]+property=["']article:modified_time["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1]
    || "";

  return {
    approximateWordCount: countWords(html),
    imageCount: images,
    hasFaqSection: /faq|frequently asked|accordion/i.test(text),
    internalLinkCount: internalLinks,
    hasCallToAction: /book now|contact us|get in touch|call us|request/i.test(text),
    bookingLink: booking,
    hasNhsReferences: /nhs\.uk|nhs inform/i.test(text),
    lastUpdated,
  };
}

function contentQualityEstimate(content: WebsiteIntelligenceServiceV2["content"]): WebsiteIntelligenceServiceV2["contentQualityEstimate"] {
  if (!content.approximateWordCount) return "Unknown";
  if (content.approximateWordCount >= 800) return "Strong";
  if (content.approximateWordCount >= 300) return "Good";
  return "Needs improvement";
}

function applyClinicalDetectionsToPages(
  pages: WebsitePageInventoryItem[],
  pageHtmlByUrl: Record<string, string>,
  clinicalEnabled: boolean,
): WebsitePageInventoryItem[] {
  if (!clinicalEnabled) {
    return pages.map((p) => ({ ...p, detectedServiceIds: [] }));
  }
  return pages.map((p) => {
    const html = pageHtmlByUrl[p.url] || "";
    const ids = [
      ...detectServicesInUrl(p.path, { clinicalEnabled: true }),
      ...(html ? detectServicesInHtml(html, { clinicalEnabled: true }) : []),
    ];
    return { ...p, detectedServiceIds: [...new Set(ids)] };
  });
}

async function buildServiceRows(
  pages: WebsitePageInventoryItem[],
  homepageUrl: string,
  pageHtmlByUrl: Record<string, string>,
  clinicalEnabled: boolean,
): Promise<WebsiteIntelligenceServiceV2[]> {
  if (!clinicalEnabled) return [];

  const detections = buildServiceDetections(pages);
  const byId = new Map(detections.map((d) => [d.serviceId, d]));
  const rows: WebsiteIntelligenceServiceV2[] = [];

  for (const pattern of CLINICAL_PHARMACY_SERVICE_PATTERNS) {
    const det = byId.get(pattern.id);
    const url = det?.mainPageUrl || "";
    let content: WebsiteIntelligenceServiceV2["content"] = {
      approximateWordCount: 0,
      imageCount: 0,
      hasFaqSection: false,
      internalLinkCount: 0,
      hasCallToAction: false,
      bookingLink: "",
      hasNhsReferences: false,
      lastUpdated: "",
    };

    if (url) {
      const html = pageHtmlByUrl[url] || (await fetchWebsiteHtml(url));
      if (html) content = analyzeServicePageContent(html, url);
    }

    rows.push({
      serviceId: pattern.id,
      serviceName: pattern.name,
      exists: Boolean(det),
      url,
      contentQualityEstimate: det ? contentQualityEstimate(content) : "Unknown",
      content,
      evidence: evidence(url || homepageUrl, det ? 78 : 0, det ? "page-crawl" : "not-detected"),
    });
  }

  return rows;
}

function buildSeoSnapshot(
  inventory: ReturnType<typeof buildContentInventory>,
  services: WebsiteIntelligenceServiceV2[],
  pages: WebsitePageInventoryItem[],
  clinicalServiceDetectionEnabled: boolean,
): WebsiteIntelligenceImportV2["seoSnapshot"] {
  const detected = services.filter((s) => s.exists);
  // Clinical missing-page gaps only when clinical dictionaries are active for this tenant.
  const missingServicePages = clinicalServiceDetectionEnabled
    ? CLINICAL_PHARMACY_SERVICE_PATTERNS.filter(
        (p) => !detected.some((d) => d.serviceId === p.id),
      ).map((p) => p.name)
    : [];

  const pagesWithEnoughContent = detected.filter(
    (s) => s.content.approximateWordCount >= 300 || s.contentQualityEstimate === "Good" || s.contentQualityEstimate === "Strong",
  ).length;

  const pagesNeedingImprovement = detected.filter((s) => s.contentQualityEstimate === "Needs improvement").length;
  const missingGuides = inventory.patientGuides === 0 && detected.length ? Math.max(1, detected.length) : 0;
  const missingFaqs = inventory.faqPages === 0 && detected.length ? Math.max(1, Math.ceil(detected.length / 2)) : 0;

  const structureScore = Math.min(40, inventory.totalPages * 2);
  const serviceScore = Math.min(40, detected.length * 4);
  const contentScore = Math.min(20, pagesWithEnoughContent * 3);
  const overallCompletenessPercent = Math.min(100, structureScore + serviceScore + contentScore);

  const summaryLines = detected.length
    ? [
        `${inventory.totalPages} HTML content pages analysed.`,
        `${detected.length} clinical pharmacy services detected.`,
        pagesWithEnoughContent
          ? `${pagesWithEnoughContent} service pages have enough content for patients to understand the offering.`
          : "Several service pages may need more patient-friendly content.",
        missingServicePages.length
          ? `${missingServicePages.length} common pharmacy services were not found — competitors covering these may appear more helpful online.`
          : "Good coverage of common pharmacy services.",
        `Overall website completeness: ${overallCompletenessPercent}%.`,
      ]
    : [
        `${inventory.totalPages} HTML content pages analysed.`,
        "Clinical pharmacy service dictionaries were not applied for this business classification.",
        `Overall website completeness: ${Math.min(100, structureScore + contentScore)}%.`,
      ];

  return {
    pagesIndexedEstimate: pages.length || null,
    pagesWithEnoughContent,
    pagesNeedingImprovement,
    missingServicePages: missingServicePages.slice(0, 12),
    missingGuides,
    missingFaqs,
    overallCompletenessPercent,
    summaryLines,
  };
}

function buildCustomerSummary(
  inventory: ReturnType<typeof buildContentInventory>,
  services: WebsiteIntelligenceServiceV2[],
  seo: WebsiteIntelligenceImportV2["seoSnapshot"],
): WebsiteIntelligenceImportV2["customerSummary"] {
  const alreadyHas: string[] = [];
  if (inventory.totalPages > 0) alreadyHas.push(`${inventory.totalPages} website pages analysed`);
  const detectedClinical = services.filter((s) => s.exists);
  if (detectedClinical.length) alreadyHas.push(`${detectedClinical.length} clinical pharmacy services`);
  if (inventory.blogArticles) alreadyHas.push(`${inventory.blogArticles} blog articles`);
  if (inventory.faqPages) alreadyHas.push(`${inventory.faqPages} FAQ pages`);
  if (inventory.patientGuides) alreadyHas.push(`${inventory.patientGuides} guides`);

  const missing: string[] = [];
  if (!inventory.faqPages) missing.push("FAQ pages");
  if (detectedClinical.length && !inventory.patientGuides) missing.push("Patient guides");
  if (detectedClinical.length && seo.missingServicePages.length) {
    missing.push(`Service pages for: ${seo.missingServicePages.slice(0, 4).join(", ")}`);
  }
  if (seo.pagesNeedingImprovement) {
    missing.push(`${seo.pagesNeedingImprovement} service pages need more content`);
  }

  const competitorNote = detectedClinical.length
    ? missing.length > 0
      ? "Pharmacies with fuller service pages, FAQs and guides often appear more helpful in local search — patients compare websites before choosing where to book."
      : "Your website covers many common pharmacy services — keep content fresh to stay ahead of local competitors."
    : "Website evidence captured for Product Owner reconciliation — commercial services remain Product Owner controlled.";

  return { alreadyHas, missing, competitorNote };
}

function pageHtmlForCategory(
  crawl: Awaited<ReturnType<typeof crawlWebsite>>,
  category: WebsitePageInventoryItem["category"],
): { url: string; html: string } | null {
  const page = crawl.pages.find((p) => p.category === category);
  if (!page) return null;
  const html = crawl.pageHtmlByUrl[page.url] || "";
  return html ? { url: page.url, html } : null;
}

function addressFieldCandidate(
  value: string,
  candidate: WebsiteAddressCandidate,
): WebsiteImportFieldCandidate {
  return {
    value,
    confidence: candidate.confidence,
    sourceUrl: candidate.sourceUrl,
    detectionMethod: candidate.sourceType,
  };
}

export interface WebsiteIntelligenceImportOptions {
  slug?: string;
  skipDesignCapture?: boolean;
}

export interface WebsiteIntelligenceImportV2Result {
  intelligence: WebsiteIntelligenceImportV2;
  brand: BrandProfile;
  legacy: {
    logoUrl: string;
    brandPrimaryColor: string;
    brandSecondaryColor: string;
    brandAccentColor: string;
    brandBackgroundColor: string;
    brandTextColor: string;
    phone: string;
    email: string;
    address: string;
    town: string;
    postcode: string;
    socialLinks: string[];
    footerLinks: string[];
    servicesDetected: string[];
    customerVisibleServices: CustomerVisibleWebsiteService[];
    description: string;
    openingHours: string;
  };
  hasData: boolean;
  designEvidence?: WebsiteDesignEvidence | null;
}

export async function buildWebsiteIntelligenceImportV2(
  websiteUrl: string,
  baseline?: CustomerSetupAdminBaseline | null,
  options?: WebsiteIntelligenceImportOptions,
): Promise<WebsiteIntelligenceImportV2Result> {
  const inputUrl = normalizeUrl(websiteUrl);
  const importedAt = nowIso();

  const analysis = await analyzeWebsiteForPharmacy(inputUrl, normalizeProfileData({}));
  const brand = analysis.brand;
  const patch = analysis.profilePatch;

  const crawl = await crawlWebsite(inputUrl, []);
  const homepageHtml = crawl.homepageHtml || (await fetchWebsiteHtml(inputUrl));
  const resolved = crawl.pages[0]?.url || inputUrl;
  const baseHost = new URL(resolved).hostname;

  const technical = extractTechnicalSignals(
    homepageHtml,
    inputUrl,
    crawl.sitemapUrls.length > 0,
    crawl.robotsDetected,
  );

  const businessClassification = classifyWebsiteBusinessType({
    host: baseHost,
    homepageHtml,
    pageHtmlByUrl: crawl.pageHtmlByUrl,
    pagePaths: crawl.pages.map((p) => p.path),
  });

  const pagesWithClinical = applyClinicalDetectionsToPages(
    crawl.pages,
    crawl.pageHtmlByUrl,
    businessClassification.clinicalServiceDetectionEnabled,
  );
  // Keep crawl.pages in sync for downstream inventory
  crawl.pages = pagesWithClinical;

  const inventory = buildContentInventory(crawl.pages);
  const serviceRows = await buildServiceRows(
    crawl.pages,
    resolved,
    crawl.pageHtmlByUrl,
    businessClassification.clinicalServiceDetectionEnabled,
  );
  const commercialServiceEvidence = buildCommercialServiceEvidenceFromPages(crawl.pages, crawl.pageHtmlByUrl);
  const audienceEvidence = buildAudienceEvidenceFromPages(
    crawl.pages,
    crawl.pageHtmlByUrl,
    extractMetaDescription(homepageHtml),
    crawl.pages[0]?.url || inputUrl,
  );
  const commercialPricingEvidence = buildPricingEvidenceFromPages(crawl.pages, crawl.pageHtmlByUrl);
  const commercialOfferEvidence = buildOfferEvidenceFromPages(crawl.pages, crawl.pageHtmlByUrl);
  const ctaEvidenceRows = buildCtaEvidenceFromPages(crawl.pages, crawl.pageHtmlByUrl);
  const trustEvidence = buildTrustEvidenceFromPages(crawl.pages, crawl.pageHtmlByUrl);
  const socialProfileEvidence = buildSocialProfileEvidenceFromPages(
    crawl.pages,
    crawl.pageHtmlByUrl,
    homepageHtml,
    crawl.pages[0]?.url || inputUrl,
  );
  const seoSnapshot = buildSeoSnapshot(
    inventory,
    serviceRows,
    crawl.pages,
    businessClassification.clinicalServiceDetectionEnabled,
  );
  const customerSummary = buildCustomerSummary(inventory, serviceRows, seoSnapshot);
  const contactPage = pageHtmlForCategory(crawl, "contact");
  const aboutPage = pageHtmlForCategory(crawl, "about");
  const footerHtml = extractFooterHtmlFromHomepage(homepageHtml);
  const websiteAddressCandidates = extractWebsiteAddressCandidates([
    { html: homepageHtml, sourceUrl: resolved, sourceType: "schema" },
    contactPage ? { html: contactPage.html, sourceUrl: contactPage.url, sourceType: "contact-page" } : null,
    footerHtml ? { html: footerHtml, sourceUrl: resolved, sourceType: "footer" } : null,
    aboutPage ? { html: aboutPage.html, sourceUrl: aboutPage.url, sourceType: "about-page" } : null,
  ].filter(Boolean) as Parameters<typeof extractWebsiteAddressCandidates>[0]);
  const canonicalAddress = selectCanonicalWebsiteAddressCandidate(websiteAddressCandidates);

  const title = extractTitle(homepageHtml) || str(brand.businessName);
  const metaDescription = extractMetaDescription(homepageHtml) || str(patch.businessDescription);

  const businessNameCandidates: WebsiteImportFieldCandidate[] = [];
  // Brand-importer / og:site_name are weak alone — demote relative to corroborated identity signals.
  if (str(brand.businessName) && !isProviderValue(brand.businessName) && !isGenericSiteTitle(brand.businessName)) {
    businessNameCandidates.push({
      value: str(brand.businessName),
      confidence: 58,
      sourceUrl: resolved,
      detectionMethod: "brand-importer",
    });
  }
  businessNameCandidates.push(...extractBusinessNameCandidatesFromHtml(homepageHtml, resolved, "homepage"));
  if (aboutPage) {
    businessNameCandidates.push(...extractBusinessNameCandidatesFromHtml(aboutPage.html, aboutPage.url, "about"));
  }
  if (contactPage) {
    businessNameCandidates.push(...extractBusinessNameCandidatesFromHtml(contactPage.html, contactPage.url, "contact"));
  }
  // Additional analysed pages for corroboration (bounded)
  for (const page of crawl.pages.slice(0, 12)) {
    if (page.url === resolved || page.category === "about" || page.category === "contact") continue;
    const html = crawl.pageHtmlByUrl[page.url];
    if (!html) continue;
    businessNameCandidates.push(...extractBusinessNameCandidatesFromHtml(html, page.url, page.category));
  }
  // Baseline is reconciliation-only — low confidence, never silently becomes website identity alone
  if (baseline?.pharmacyName && !isProviderValue(baseline.pharmacyName)) {
    businessNameCandidates.push({
      value: baseline.pharmacyName,
      confidence: 35,
      sourceUrl: resolved,
      detectionMethod: "admin-baseline",
    });
  }
  const businessNameSelection = selectCorroboratedBusinessName(businessNameCandidates, baseHost);

  const phoneRejected: Array<{ value: string; reason: string; sourceUrl?: string; detectionMethod?: string }> = [];
  const phoneCandidates: WebsiteImportFieldCandidate[] = [];
  const phoneSources: Array<{ html: string; url: string }> = [
    { html: homepageHtml, url: resolved },
    contactPage ? { html: contactPage.html, url: contactPage.url } : null,
    aboutPage ? { html: aboutPage.html, url: aboutPage.url } : null,
    footerHtml ? { html: footerHtml, url: resolved } : null,
  ].filter(Boolean) as Array<{ html: string; url: string }>;
  // Bounded scan of other analysed pages for tel: links / schema telephone.
  for (const page of crawl.pages.slice(0, 20)) {
    if (phoneSources.some((s) => s.url === page.url)) continue;
    const html = crawl.pageHtmlByUrl[page.url];
    if (!html) continue;
    if (!/tel:|"telephone"\s*:/i.test(html)) continue;
    phoneSources.push({ html, url: page.url });
  }
  for (const src of phoneSources) {
    const extracted = extractPhones(src.html, src.url);
    phoneCandidates.push(...extracted.candidates);
    phoneRejected.push(...extracted.rejected);
  }
  // Do NOT inject brand/profile/onboarding phone into website import evidence.

  const emailCandidates: WebsiteImportFieldCandidate[] = [];
  const emailSources: Array<{ html: string; url: string }> = [
    { html: homepageHtml, url: resolved },
    contactPage ? { html: contactPage.html, url: contactPage.url } : null,
    aboutPage ? { html: aboutPage.html, url: aboutPage.url } : null,
    footerHtml ? { html: footerHtml, url: resolved } : null,
  ].filter(Boolean) as Array<{ html: string; url: string }>;
  for (const page of crawl.pages.slice(0, 20)) {
    if (emailSources.some((s) => s.url === page.url)) continue;
    const html = crawl.pageHtmlByUrl[page.url];
    if (!html) continue;
    if (!/mailto:|@[a-z0-9.-]+\.[a-z]{2,}/i.test(html)) continue;
    emailSources.push({ html, url: page.url });
  }
  for (const src of emailSources) {
    emailCandidates.push(...extractEmails(src.html, src.url, baseHost));
  }
  // Email from brand scrape of the same website HTML is acceptable as website-derived (not profile).
  const emailPatch = str(patch.businessEmail || patch.email || brand.contact?.email);
  if (emailPatch && !isProviderValue(emailPatch)) {
    emailCandidates.push({ value: emailPatch, confidence: 70, sourceUrl: resolved, detectionMethod: "website-scrape-email" });
  }

  const addressCandidates: WebsiteImportFieldCandidate[] = [];
  const loc = analysis.location;
  if (canonicalAddress) {
    addressCandidates.push(addressFieldCandidate(canonicalAddress.addressLine1, canonicalAddress));
  }
  if (loc.addressLine1 && loc.confidence >= AUTO_SELECT_CONFIDENCE) {
    addressCandidates.push({ value: loc.addressLine1, confidence: loc.confidence, sourceUrl: resolved, detectionMethod: "schema.org" });
  }
  // Do not inject profile/onboarding address as website evidence.

  const townCandidates: WebsiteImportFieldCandidate[] = [];
  if (canonicalAddress) {
    townCandidates.push(addressFieldCandidate(canonicalAddress.town, canonicalAddress));
  }
  if (loc.primaryTown && loc.confidence >= AUTO_SELECT_CONFIDENCE) {
    townCandidates.push({ value: loc.primaryTown, confidence: loc.confidence, sourceUrl: resolved, detectionMethod: "schema.org" });
  }
  // Baseline town/postcode are reconciliation-only (low confidence) — not website-confirmed.
  if (baseline?.town) {
    townCandidates.push({ value: baseline.town, confidence: 30, sourceUrl: resolved, detectionMethod: "admin-baseline" });
  }

  const postcodeCandidates: WebsiteImportFieldCandidate[] = [];
  if (canonicalAddress) {
    postcodeCandidates.push(addressFieldCandidate(canonicalAddress.postcode, canonicalAddress));
  }
  if (loc.postcode && loc.confidence >= AUTO_SELECT_CONFIDENCE) {
    postcodeCandidates.push({ value: loc.postcode, confidence: loc.confidence, sourceUrl: resolved, detectionMethod: "schema.org" });
  }
  if (baseline?.postcode) {
    postcodeCandidates.push({ value: baseline.postcode, confidence: 30, sourceUrl: resolved, detectionMethod: "admin-baseline" });
  }

  const hoursCandidates: WebsiteImportFieldCandidate[] = [];
  const hoursSummary = str(patch.openingHours || patch.openingHoursMonday);
  if (hoursSummary) hoursCandidates.push({ value: hoursSummary, confidence: 75, sourceUrl: resolved, detectionMethod: "schema.org" });

  const mapsCandidates: WebsiteImportFieldCandidate[] = [];
  if (analysis.googleMapsUrl) {
    mapsCandidates.push({ value: analysis.googleMapsUrl, confidence: 90, sourceUrl: resolved, detectionMethod: "google-maps-link" });
  }

  const business = {
    businessName: businessNameSelection.field,
    phone: buildPhoneField(phoneCandidates, phoneRejected),
    email: buildField(emailCandidates),
    address: buildField(addressCandidates),
    town: buildField(townCandidates),
    postcode: buildField(postcodeCandidates),
    addressCandidates: websiteAddressCandidates,
    openingHours: buildField(hoursCandidates),
    emergencyNumber: buildField(extractEmergencyNumber(homepageHtml, resolved)),
    nhsLinks: extractNhsLinks(homepageHtml),
    googleMapsLink: buildField(mapsCandidates),
  };

  const evidenceQuality = assessWebsiteImportEvidenceQuality({
    pages: crawl.pages,
    businessName: business.businessName,
    phone: business.phone,
    skippedNonContentUrls: crawl.skippedNonContentUrls,
    homepageHtml,
  });

  const socialFromProfiles = socialProfileEvidence.map((s) => s.url);
  const socialFromAnalysis = Object.values(analysis.socialLinks || {}).filter(Boolean).map(String);
  const social = [...new Set([...socialFromProfiles, ...socialFromAnalysis])];
  const footer = (patch.footerLinks || []).map((l) => l.label || l.url).filter(Boolean).slice(0, 8);

  const contentPageCount = crawl.pages.filter((p) => p.isContentPage !== false).length;

  const intelligence: WebsiteIntelligenceImportV2 = {
    version: WEBSITE_INTELLIGENCE_IMPORT_V2_VERSION,
    importedAt,
    identity: {
      websiteUrl: inputUrl,
      resolvedUrl: resolved,
      title,
      metaDescription: metaDescription.slice(0, 500),
      faviconUrl: str(brand.faviconUrl || patch.faviconUrl),
      logoUrl: str(brand.logoUrl || patch.logoUrl),
      brandPrimaryColor: str(brand.primaryColour || patch.brandPrimaryColor),
      brandSecondaryColor: str(brand.secondaryColour || patch.brandSecondaryColor),
      brandAccentColor: str(brand.accentColour || patch.brandAccentColor),
      brandBackgroundColor: str(brand.backgroundColour || patch.brandBackgroundColor),
      brandTextColor: str(brand.bodyTextColour || patch.brandTextColor),
      cmsDetected: detectCms(homepageHtml),
      analyticsDetected: detectAnalytics(homepageHtml),
      facebookPixelDetected: detectFacebookPixel(homepageHtml),
      cookiePlatform: detectCookiePlatform(homepageHtml),
    },
    business,
    structure: {
      totalPages: contentPageCount,
      servicePages: inventory.servicePages,
      blogArticles: inventory.blogArticles,
      guides: inventory.patientGuides,
      faqPages: inventory.faqPages,
      newsPages: inventory.newsArticles,
      policyPages: inventory.byCategory.policy,
      contactPages: inventory.byCategory.contact,
      aboutPages: inventory.byCategory.about,
      landingPages:
        (inventory.byCategory.landing || 0)
        + inventory.byCategory.booking
        + (inventory.byCategory.other || 0),
      sitemapFound: technical.sitemapDetected,
      robotsTxtFound: technical.robotsDetected,
      pages: crawl.pages,
    },
    services: serviceRows,
    commercialServiceEvidence,
    audienceEvidence,
    commercialPricingEvidence,
    commercialOfferEvidence,
    ctaEvidence: ctaEvidenceRows,
    trustEvidence,
    socialProfileEvidence,
    businessClassification,
    evidenceQuality,
    seoSnapshot,
    customerSummary,
    evidence: [
      evidence(resolved, 90, "homepage-crawl"),
      evidence(resolved, technical.sitemapDetected ? 85 : 0, "sitemap-discovery"),
      evidence(resolved, technical.robotsDetected ? 85 : 0, "robots-discovery"),
      ...crawl.pages.slice(0, 12).map((p) =>
        evidence(p.url, 80, `content-page:${p.category}:${p.discoverySource || "crawl"}`),
      ),
    ].filter((e) => e.confidence > 0),
  };

  const customerVisibleServices = await buildCustomerVisibleWebsiteServices({
    serviceRows,
    pages: crawl.pages,
    homepageUrl: resolved,
    homepageHtml,
  });

  const legacy = {
    logoUrl: intelligence.identity.logoUrl,
    brandPrimaryColor: intelligence.identity.brandPrimaryColor,
    brandSecondaryColor: intelligence.identity.brandSecondaryColor,
    brandAccentColor: intelligence.identity.brandAccentColor,
    brandBackgroundColor: intelligence.identity.brandBackgroundColor,
    brandTextColor: intelligence.identity.brandTextColor,
    phone: business.phone.selected,
    email: business.email.selected,
    address: business.address.selected,
    town: business.town.selected,
    postcode: business.postcode.selected,
    socialLinks: social,
    footerLinks: footer,
    servicesDetected: [
      ...serviceRows.filter((s) => s.exists).map((s) => s.serviceName),
      ...commercialServiceEvidence.map((s) => s.serviceName),
    ],
    customerVisibleServices,
    description: metaDescription.slice(0, 500),
    openingHours: business.openingHours.selected,
  };

  const hasData = Boolean(
    legacy.logoUrl ||
      legacy.brandPrimaryColor ||
      legacy.phone ||
      legacy.description ||
      serviceRows.some((s) => s.exists) ||
      commercialServiceEvidence.length > 0 ||
      contentPageCount >= 1,
  );

  let designEvidence: WebsiteDesignEvidence | null = null;
  if (options?.slug && !options.skipDesignCapture) {
    try {
      designEvidence = await captureWebsiteDesignEvidence({
        slug: options.slug,
        primaryUrl: inputUrl,
      });
    } catch (err) {
      console.warn(
        `[website-import-v2] design capture failed slug=${options.slug} ${err instanceof Error ? err.message : String(err)}`,
      );
      designEvidence = loadWebsiteDesignEvidence(options.slug);
    }

    if (designEvidenceHasUsableContent(designEvidence)) {
      const assetResult = await importDesignEvidenceAssets(options.slug, designEvidence!);
      designEvidence!.assets = assetResult.assets;

      if (designEvidence!.header.logoUrl) {
        intelligence.identity.logoUrl = designEvidence!.header.logoUrl;
        legacy.logoUrl = designEvidence!.header.logoUrl;
      }
      const primaryColour = designEvidence!.colourSystem.primary[0]?.hex;
      const secondaryColour = designEvidence!.colourSystem.secondary[0]?.hex;
      const accentColour = designEvidence!.colourSystem.accent[0]?.hex;
      if (primaryColour) {
        intelligence.identity.brandPrimaryColor = primaryColour;
        legacy.brandPrimaryColor = primaryColour;
      }
      if (secondaryColour) {
        intelligence.identity.brandSecondaryColor = secondaryColour;
        legacy.brandSecondaryColor = secondaryColour;
      }
      if (accentColour) {
        intelligence.identity.brandAccentColor = accentColour;
        legacy.brandAccentColor = accentColour;
      }
      const headerBg = designEvidence!.header.backgroundColour;
      const headerText = designEvidence!.header.textColour;
      if (headerBg) intelligence.identity.brandBackgroundColor = headerBg;
      if (headerText) intelligence.identity.brandTextColor = headerText;

      intelligence.designEvidence = designEvidence;
    } else if (designEvidence?.warnings.length) {
      console.warn(
        `[website-import-v2] design capture incomplete slug=${options.slug} warnings=${designEvidence.warnings.join("; ")}`,
      );
    }
  }

  return { intelligence, brand: analysis.brand, legacy, hasData, designEvidence };
}

/** Adapt setup import snapshot for Website Report rendering (read-only bridge). */
export function websiteImportSnapshotToGrowthEngineSnapshot(
  slug: string,
  snap: { websiteUrl: string; importedAt: string; intelligence?: WebsiteIntelligenceImportV2 | null },
  profileInput?: PharmacyProfileData,
): GrowthEngineWebsiteIntelligenceSnapshot | null {
  const intel = snap.intelligence;
  if (!intel?.structure.pages.length) return null;

  const profile = profileInput || (normalizeProfileData({}) as PharmacyProfileData);
  const technical = {
    https: intel.identity.resolvedUrl.startsWith("https://"),
    sitemapDetected: intel.structure.sitemapFound,
    robotsDetected: intel.structure.robotsTxtFound,
    schemaDetected: false,
    metaTitlesPresent: Boolean(intel.identity.title),
    metaDescriptionsPresent: Boolean(intel.identity.metaDescription),
    openGraphPresent: false,
    canonicalPresent: false,
    xmlSitemapUrl: intel.structure.sitemapFound ? new URL("/sitemap.xml", intel.identity.resolvedUrl).href : null,
  };

  const analysis = buildWebsiteIntelligenceAnalysis({
    websiteUrl: snap.websiteUrl,
    pages: intel.structure.pages,
    technical,
    profile,
    customerVisibleServices: snap.customerVisibleServices || [],
  });

  return {
    version: WEBSITE_INTELLIGENCE_SNAPSHOT_VERSION,
    slug,
    generatedAt: snap.importedAt,
    source: "website-live",
    websiteUrl: snap.websiteUrl,
    analysis,
  };
}

export { serviceDisplayName };
