/**
 * Growth Engine — Website Intelligence V1 model.
 * Website understanding only — no SEO scores.
 */

export type WebsitePageCategory =
  | "homepage"
  | "about"
  | "contact"
  | "services"
  | "service-page"
  | "pricing"
  | "offer"
  | "landing"
  | "utility"
  | "locations"
  | "blog"
  | "guide"
  | "faq"
  | "policy"
  | "booking"
  | "news"
  | "resources"
  | "other";

export interface WebsitePageInventoryItem {
  url: string;
  path: string;
  title: string;
  category: WebsitePageCategory;
  detectedServiceIds: string[];
  /** How this URL entered the crawl queue (homepage, sitemap, nav, link, seed). */
  discoverySource?: string;
  /** Fetch outcome for forensic review. */
  fetchStatus?: "ok" | "empty" | "non-html" | "error" | "skipped-xml";
  h1?: string;
  /** True only for same-domain HTML business content pages that were analysed. */
  isContentPage?: boolean;
  evidenceCategories?: string[];
}

export interface WebsiteServiceDetection {
  serviceId: string;
  serviceName: string;
  detected: boolean;
  pageCount: number;
  mainPageUrl: string | null;
  supportingContent: {
    faqs: number;
    blogs: number;
    guides: number;
    localPages: number;
  };
}

export interface WebsiteContentInventory {
  totalPages: number;
  servicePages: number;
  blogArticles: number;
  patientGuides: number;
  faqPages: number;
  locationPages: number;
  caseStudies: number;
  newsArticles: number;
  videos: number;
  downloads: number;
  byCategory: Record<WebsitePageCategory, number>;
}

export interface WebsiteContentCoverageRow {
  serviceId: string;
  serviceName: string;
  profileEnabled: boolean;
  websiteDetected: boolean;
  mainPageUrl: string | null;
  supportingContent: WebsiteServiceDetection["supportingContent"];
  coverageStatus?: "dedicated-page" | "mentioned-only" | "not-found";
}

export interface WebsiteCanonicalReportCounts {
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

export interface WebsiteCanonicalServiceRecord {
  serviceId: string;
  serviceName: string;
  customerVisible: boolean;
  dedicatedPage: boolean;
  sourceUrl: string | null;
  detectionMethod: string;
  confidence: number;
  profileEnabled: boolean;
  coverageStatus: "dedicated-page" | "mentioned-only" | "not-found";
  diagnosticMatch: boolean;
  relatedPageCount: number;
  supportingContent: WebsiteServiceDetection["supportingContent"];
}

export interface WebsiteMissingContentItem {
  serviceId: string;
  serviceName: string;
  gap: string;
  evidence: string;
}

export interface WebsiteContentOpportunity {
  serviceId: string;
  serviceName: string;
  headline: string;
  detail: string;
  evidence: string;
}

export interface WebsiteTechnicalOverview {
  https: boolean;
  sitemapDetected: boolean;
  robotsDetected: boolean;
  schemaDetected: boolean;
  metaTitlesPresent: boolean;
  metaDescriptionsPresent: boolean;
  openGraphPresent: boolean;
  canonicalPresent: boolean;
  xmlSitemapUrl: string | null;
}

export interface WebsiteVisualSummary {
  currentWebsite: {
    totalPages: number;
    servicePages: number;
    blogs: number;
    faqs: number;
    guides: number;
  };
  recommendedEcosystem: {
    totalPages: number;
    enabledServices: number;
    localPagesPerService: number;
  };
  differencePages: number;
}

export interface WebsiteContentMapNode {
  id: string;
  label: string;
  count: number;
  children?: WebsiteContentMapNode[];
}

export interface WebsiteIntelligenceAnalysis {
  dataSource: "website-live" | "unavailable";
  summaryParagraphs: string[];
  pages: WebsitePageInventoryItem[];
  services: WebsiteServiceDetection[];
  inventory: WebsiteContentInventory;
  coverage: WebsiteContentCoverageRow[];
  missingContent: WebsiteMissingContentItem[];
  opportunities: WebsiteContentOpportunity[];
  technical: WebsiteTechnicalOverview;
  visualSummary: WebsiteVisualSummary;
  contentMap: WebsiteContentMapNode[];
  websiteUrl: string;
  understandingComplete: boolean;
  canonicalCounts?: WebsiteCanonicalReportCounts;
  canonicalServices?: WebsiteCanonicalServiceRecord[];
}

export interface GrowthEngineWebsiteIntelligenceSnapshot {
  version: number;
  slug: string;
  generatedAt: string;
  source: "website-live" | "no-website" | "fetch-failed";
  websiteUrl: string;
  analysis: WebsiteIntelligenceAnalysis | null;
}

export const WEBSITE_PAGE_CATEGORY_LABELS: Record<WebsitePageCategory, string> = {
  homepage: "Homepage",
  about: "About",
  contact: "Contact",
  services: "Services",
  "service-page": "Service Pages",
  pricing: "Pricing / Packages",
  offer: "Offers / Programmes",
  landing: "Landing Pages",
  utility: "Utility",
  locations: "Locations",
  blog: "Blogs",
  guide: "Guides",
  faq: "FAQs",
  policy: "Policies",
  booking: "Booking",
  news: "News",
  resources: "Resources",
  other: "Other",
};

export const WEBSITE_INTELLIGENCE_SNAPSHOT_VERSION = 1;

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function emptyWebsiteSnapshot(slug: string): GrowthEngineWebsiteIntelligenceSnapshot {
  return {
    version: WEBSITE_INTELLIGENCE_SNAPSHOT_VERSION,
    slug,
    generatedAt: new Date().toISOString(),
    source: "no-website",
    websiteUrl: "",
    analysis: null,
  };
}

export function normalizeWebsiteSnapshot(raw: unknown): GrowthEngineWebsiteIntelligenceSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Record<string, unknown>;
  const slug = str(doc.slug);
  if (!slug) return null;
  return {
    version: Number(doc.version) || WEBSITE_INTELLIGENCE_SNAPSHOT_VERSION,
    slug,
    generatedAt: str(doc.generatedAt) || new Date().toISOString(),
    source: (doc.source as GrowthEngineWebsiteIntelligenceSnapshot["source"]) || "fetch-failed",
    websiteUrl: str(doc.websiteUrl),
    analysis: doc.analysis && typeof doc.analysis === "object" ? (doc.analysis as WebsiteIntelligenceAnalysis) : null,
  };
}
