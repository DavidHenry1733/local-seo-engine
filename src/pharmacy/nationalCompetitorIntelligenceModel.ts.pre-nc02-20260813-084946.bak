/**
 * National Competitor Intelligence Model V1
 *
 * This model belongs exclusively to the NATIONAL Growth Platform.
 *
 * It must not inherit Local Growth Platform assumptions such as:
 * - Google Places place IDs
 * - distance from a branch
 * - nearby competitors
 * - local GBP review benchmarking
 * - local healthcare providers
 * - latitude / longitude
 *
 * The national model is based on commercial market competition:
 * - company / brand identity
 * - website / domain
 * - target customer
 * - services / offers
 * - positioning
 * - website architecture
 * - content coverage
 * - search / organic evidence when available
 * - commercial strengths / weaknesses
 * - evidence-backed gaps
 */

export const NATIONAL_COMPETITOR_INTELLIGENCE_VERSION = 1 as const;

export type NationalCompetitorDiscoverySource =
  | "operator_seed"
  | "website_search"
  | "organic_search"
  | "known_market_competitor"
  | "manual_review"
  | "unknown";

export type NationalCompetitorConfidence =
  | "high"
  | "medium"
  | "low"
  | "unknown";

export type NationalCompetitorRelationship =
  | "direct"
  | "partial"
  | "adjacent"
  | "unknown";

export interface NationalCompetitorServiceEvidence {
  name: string;
  slug?: string | null;
  url?: string | null;
  evidence: string[];
}

export interface NationalCompetitorOfferEvidence {
  title: string;
  description?: string | null;
  priceText?: string | null;
  url?: string | null;
  evidence: string[];
}

export interface NationalCompetitorContentEvidence {
  servicePageCount: number | null;
  blogPostCount: number | null;
  guideCount: number | null;
  faqCount: number | null;
  locationPageCount: number | null;
  pricingPageCount: number | null;
  offerPageCount: number | null;

  detectedTopics: string[];
  contentStrengths: string[];
  contentWeaknesses: string[];

  evidence: string[];
}

export interface NationalCompetitorSearchEvidence {
  indexedPages: number | null;
  rankedKeywords: number | null;
  estimatedOrganicTraffic: number | null;
  averagePosition: number | null;
  topKeywords: string[];

  source: string;
  capturedAt: string | null;

  /**
   * Important:
   * null means evidence is unavailable.
   * Never convert unavailable evidence into zero.
   */
  evidenceAvailable: boolean;

  evidence: string[];
}

export interface NationalCompetitorWebsiteEvidence {
  domain: string;
  canonicalWebsite: string;

  homepageTitle: string | null;
  homepageDescription: string | null;

  pagesAnalysed: number;
  sitemapDetected: boolean | null;
  robotsDetected: boolean | null;

  services: NationalCompetitorServiceEvidence[];
  offers: NationalCompetitorOfferEvidence[];
  content: NationalCompetitorContentEvidence;

  callsToAction: string[];
  trustSignals: string[];
  targetAudienceSignals: string[];
  positioningSignals: string[];

  evidence: string[];
}

export interface NationalCompetitorRecord {
  competitorId: string;

  businessName: string;
  domain: string;
  website: string;

  discoverySource: NationalCompetitorDiscoverySource;
  discoveryQuery?: string | null;

  relationship: NationalCompetitorRelationship;
  confidence: NationalCompetitorConfidence;

  targetCustomer: string[];
  sectors: string[];
  services: string[];

  positioning: string[];
  commercialStrengths: string[];
  commercialWeaknesses: string[];

  websiteEvidence: NationalCompetitorWebsiteEvidence | null;
  searchEvidence: NationalCompetitorSearchEvidence | null;

  evidence: string[];

  discoveredAt: string;
  analysedAt: string | null;
}

export interface NationalCompetitorGap {
  gapId: string;

  category:
    | "service"
    | "content"
    | "positioning"
    | "offer"
    | "search"
    | "authority"
    | "conversion"
    | "trust";

  title: string;
  description: string;

  competitorIds: string[];

  currentEvidence: string[];
  competitorEvidence: string[];

  recommendedAction: string;

  confidence: NationalCompetitorConfidence;
}

export interface NationalCompetitorIntelligenceSummary {
  competitorCount: number;

  directCompetitorCount: number;
  partialCompetitorCount: number;
  adjacentCompetitorCount: number;

  competitorsWithWebsiteEvidence: number;
  competitorsWithSearchEvidence: number;

  sharedServices: string[];
  commonPositioningThemes: string[];

  strongestCompetitorIds: string[];

  evidence: string[];
}

export interface NationalCompetitorIntelligenceSnapshot {
  version: typeof NATIONAL_COMPETITOR_INTELLIGENCE_VERSION;

  slug: string;

  growthPlatform: "national";

  marketCountry: string;
  targetCustomer: string[];
  marketDefinition: string;

  generatedAt: string;

  source: "national-competitor-intelligence-v1";

  competitors: NationalCompetitorRecord[];
  gaps: NationalCompetitorGap[];

  summary: NationalCompetitorIntelligenceSummary;

  evidence: string[];

  /**
   * Governance:
   * NATIONAL intelligence must not be treated as complete merely because
   * the object exists. The workflow must separately validate evidence.
   */
  status:
    | "draft"
    | "discovery_complete"
    | "analysis_complete"
    | "ready_for_review";
}

export function emptyNationalCompetitorIntelligenceSnapshot(
  slug: string,
): NationalCompetitorIntelligenceSnapshot {
  return {
    version: NATIONAL_COMPETITOR_INTELLIGENCE_VERSION,

    slug,

    growthPlatform: "national",

    marketCountry: "United Kingdom",
    targetCustomer: [],
    marketDefinition: "",

    generatedAt: new Date().toISOString(),

    source: "national-competitor-intelligence-v1",

    competitors: [],
    gaps: [],

    summary: {
      competitorCount: 0,

      directCompetitorCount: 0,
      partialCompetitorCount: 0,
      adjacentCompetitorCount: 0,

      competitorsWithWebsiteEvidence: 0,
      competitorsWithSearchEvidence: 0,

      sharedServices: [],
      commonPositioningThemes: [],

      strongestCompetitorIds: [],

      evidence: [],
    },

    evidence: [],

    status: "draft",
  };
}
