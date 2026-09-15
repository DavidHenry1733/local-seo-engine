/**
 * NC-02 — National Competitor Discovery Model V1
 *
 * NATIONAL Growth Platform only.
 *
 * This model intentionally contains no:
 * - Google Places IDs
 * - latitude / longitude
 * - distance
 * - radius
 * - healthcare-provider proximity
 * - local map ranking
 */

export type NationalCompetitorDiscoverySource =
  | "search-engine"
  | "known-market-competitor"
  | "website-evidence"
  | "operator-confirmed";

export type NationalCompetitorQualification =
  | "qualified"
  | "candidate"
  | "rejected";

export interface NationalCompetitorDiscoveryQuery {
  id: string;
  query: string;
  marketCountry: string;
  targetCustomerMarket: string;
  serviceIntent: string;
  evidenceReason: string;
}

export interface NationalCompetitorServiceEvidence {
  service: string;
  evidenceUrl: string;
  evidenceText: string;
  confidence: number;
}

export interface NationalCompetitorDiscoveryCandidate {
  id: string;
  name: string;
  domain: string;
  websiteUrl: string;

  marketCountry: string;
  targetCustomerMarket: string;

  source: NationalCompetitorDiscoverySource;
  sourceQuery: string | null;

  qualification: NationalCompetitorQualification;
  qualificationReasons: string[];
  rejectionReasons: string[];

  serviceEvidence: NationalCompetitorServiceEvidence[];

  title: string | null;
  description: string | null;

  evidenceUrls: string[];
  capturedAt: string;
}

export interface NationalCompetitorDiscoveryResult {
  version: 1;
  platform: "national";
  slug: string;
  generatedAt: string;

  marketCountry: string;
  targetCustomerMarket: string;

  queries: NationalCompetitorDiscoveryQuery[];

  candidates: NationalCompetitorDiscoveryCandidate[];
  qualifiedCompetitors: NationalCompetitorDiscoveryCandidate[];
  rejectedCandidates: NationalCompetitorDiscoveryCandidate[];

  source: "national-competitor-discovery-v1";
  status:
    | "draft"
    | "running"
    | "complete"
    | "insufficient-evidence"
    | "failed";

  errors: string[];

  /** Optional local competitor-analysis organic-search run. Existing national artifacts omit this. */
  organicSearch?: OrganicSearchCompetitorRun;
  /**
   * Optional service-scoped organic-search runs (shared artifact model).
   * Preserves prior service evidence when a later campaign collects its own queries.
   */
  organicSearchByService?: Record<string, OrganicSearchCompetitorRun>;
}

export type CompetitorAnalysisProviderStatus =
  | "configured"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "not_configured"
  | "no_reliable_results";

export interface OrganicSearchCompetitorEvidence {
  domain: string;
  host: string;
  url: string;
  position: number | null;
  matchedQuery: string;
  title: string;
  description: string;
  overlapEvidence: string;
  capturedAt: string;
  provider: string;
  locationName: string;
  languageCode: string;
  taskId: string | null;
  provenance: string;
  freshness: string;
}

export interface OrganicSearchCompetitorRun {
  provider: "dataforseo-google-organic-live";
  status: CompetitorAnalysisProviderStatus;
  configured: boolean;
  generated: boolean;
  error: string | null;
  queryLimitation: string | null;
  locationName: string;
  languageCode: string;
  taskIds: string[];
  queries: string[];
  competitors: OrganicSearchCompetitorEvidence[];
  capturedAt: string | null;
}

export function emptyNationalCompetitorDiscoveryResult(
  slug: string,
  marketCountry = "United Kingdom",
  targetCustomerMarket = "UK community pharmacies",
): NationalCompetitorDiscoveryResult {
  return {
    version: 1,
    platform: "national",
    slug,
    generatedAt: new Date().toISOString(),

    marketCountry,
    targetCustomerMarket,

    queries: [],

    candidates: [],
    qualifiedCompetitors: [],
    rejectedCandidates: [],

    source: "national-competitor-discovery-v1",
    status: "draft",

    errors: [],
  };
}
