/**
 * NI-03B — Customer ranking keywords + organic search competitor discovery.
 * Does not include keyword intersection/gap intelligence.
 */
import type {
  NationalEvidenceAuthority,
  NationalEvidenceSourceType,
  NationalIntelligenceEvidenceProvenance,
} from "./nationalIntelligenceEvidenceProvenance.ts";
import type { NationalIntelligenceCostLedger } from "./nationalIntelligenceCostLedger.ts";

export const NATIONAL_SEARCH_INTELLIGENCE_VERSION = 1 as const;

export const NI03B_LIMITS = {
  customerRankedKeywords: 40,
  serpQueries: 3,
  serpDepth: 10,
  competitorCandidates: 15,
} as const;

export type NationalSearchIntelligenceStatus =
  | "not_collected"
  | "collecting"
  | "collected"
  | "partial"
  | "empty"
  | "error";

export const PARTIAL_COLLECTION_CUSTOMER_MESSAGE =
  "Search intelligence was collected, but one or more search-engine requests could not be completed. Available evidence is shown below.";

export function isUsableNationalSearchIntelligenceStatus(
  status: NationalSearchIntelligenceStatus,
): boolean {
  return status === "collected" || status === "partial" || status === "empty";
}

export interface NationalCustomerRankingKeyword {
  keyword: string;
  position: number | null;
  rankingUrl: string | null;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  capturedAt: string;
  sourceEndpoint: string;
  evidenceSource: NationalEvidenceSourceType;
  calculated: false;
}

export interface NationalOrganicSearchCompetitor {
  domain: string;
  name: string;
  websiteUrl: string;
  whyIdentified: string[];
  sourceQueries: string[];
  bestSerpPosition: number | null;
  classification: "direct_competitor" | "adjacent_competitor" | "insufficient_evidence" | "excluded";
  qualification: "qualified" | "candidate" | "rejected";
  evidenceStatus: string;
  evidenceUrls: string[];
  capturedAt: string;
  evidenceSource: NationalEvidenceSourceType;
  verified: false;
}

export interface NationalSearchIntelligenceSnapshot {
  version: typeof NATIONAL_SEARCH_INTELLIGENCE_VERSION;
  tenantSlug: string;
  businessName: string;
  subjectDomain: string;
  primaryMarket: string;
  country: string;
  growthPlatform: "national";
  capturedAt: string;
  liveExecution: boolean;
  status: NationalSearchIntelligenceStatus;
  lastError: string | null;
  reusedExistingSnapshot: boolean;
  serpLocation: {
    country: string;
    locationCode: number;
  } | null;
  limits: typeof NI03B_LIMITS;
  endpoints: Array<{ endpoint: string; requests: number; tasks: number; cost: number }>;
  costs: { requests: number; tasks: number; totalCost: number };
  costLedger: NationalIntelligenceCostLedger;
  provenance: NationalIntelligenceEvidenceProvenance;
  authority: NationalEvidenceAuthority;
  customerKeywords: NationalCustomerRankingKeyword[];
  organicCompetitors: NationalOrganicSearchCompetitor[];
  serpAttempts: Array<{
    query: string;
    endpoint: string;
    taskId: string | null;
    taskStatusCode: number | null;
    taskStatusMessage: string | null;
    cost: number | null;
    successful: boolean;
    timedOut?: boolean;
    attemptNumber: number;
    capturedAt: string;
  }>;
  summary: {
    rankingKeywordCount: number;
    top10Count: number;
    top20Count: number;
    rankingPageCount: number;
    availableSearchDemand: number | null;
    organicCompetitorCount: number;
    directCompetitorCount: number;
    adjacentCompetitorCount: number;
    top10CountCalculated: true;
    top20CountCalculated: true;
    rankingPageCountCalculated: true;
    availableSearchDemandCalculated: true;
  };
  nextStage: {
    title: string;
    detail: string;
    implemented: false;
  };
}
