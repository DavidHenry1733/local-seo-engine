export const MARKET_OPPORTUNITY_INTELLIGENCE_VERSION = 1 as const;

export type MarketOpportunityPriority = "HIGH" | "MEDIUM" | "LOW";
export type MarketOpportunityGapType =
  | "untapped"
  | "weak_coverage"
  | "defend_improve"
  | "unknown";

export type MarketKeywordQualificationStatus =
  | "QUALIFIED"
  | "REJECTED"
  | "REVIEW";

export interface MarketOpportunityCompetitorInput {
  domain: string;
  classification: "direct_competitor" | "adjacent_competitor";
  confidence: number | null;
  keywordsAnalysed: number;
}

export interface MarketOpportunityRankingCompetitor {
  domain: string;
  classification: "direct_competitor" | "adjacent_competitor";
  position: number | null;
  rankingUrl: string | null;
}

export interface MarketKeywordOpportunity {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  commercialIntentScore: number;
  qualification: MarketKeywordQualificationStatus;
  qualificationReasons: string[];
  competitorCount: number;
  directCompetitorCount: number;
  adjacentCompetitorCount: number;
  competitorsRanking: MarketOpportunityRankingCompetitor[];
  bestCompetitorPosition: number | null;
  bestCompetitorDomain: string | null;
  bestRankingUrl: string | null;
  subjectPosition: number | null;
  subjectRankingUrl: string | null;
  gapType: MarketOpportunityGapType;
  opportunityScore: number;
  priority: MarketOpportunityPriority;
  reasons: string[];
}

export interface MarketOpportunityRankingPage {
  competitorDomain: string;
  url: string;
  keywordCount: number;
  relevantKeywordCount: number;
  searchDemand: number;
  bestPosition: number | null;
  strongestKeywords: Array<{
    keyword: string;
    position: number | null;
    searchVolume: number | null;
  }>;
}

export interface MarketOpportunitySummary {
  keywordUniverse: number;
  qualifiedCommercialKeywords: number;
  rejectedKeywords: number;
  reviewKeywords: number;
  uniqueQualifiedKeywords: number;
  untappedKeywords: number;
  weakCoverageKeywords: number;
  defendImproveKeywords: number;
  unknownGapKeywords: number;
  highPriorityOpportunities: number;
  mediumPriorityOpportunities: number;
  lowPriorityOpportunities: number;
  totalSearchDemand: number;
}

export interface MarketOpportunityDataForSeoUsage {
  requests: number;
  tasks: number;
  totalCost: number;
  endpoints: Array<{
    endpoint: string;
    requests: number;
    tasks: number;
    cost: number;
    purpose: string;
  }>;
}

export interface MarketOpportunityIntelligenceSnapshot {
  version: typeof MARKET_OPPORTUNITY_INTELLIGENCE_VERSION;
  generatedAt: string;
  market: string;
  country: string;
  subjectDomain: string;
  sourceProvider: string;
  sourceCompetitorCount: number;
  totalApiCost: number;
  dataForSeoUsage: MarketOpportunityDataForSeoUsage;
  competitors: MarketOpportunityCompetitorInput[];
  keywordOpportunities: MarketKeywordOpportunity[];
  rankingPages: MarketOpportunityRankingPage[];
  summary: MarketOpportunitySummary;
  dataQuality: {
    rawKeywords: number;
    qualified: number;
    rejected: number;
    review: number;
    topRejectionReasons: string[];
    subjectCoverageStatus: "available" | "not_available";
  };
}
