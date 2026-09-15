export const GROWTH_PLAN_STRATEGY_VERSION = 1 as const;

export type GrowthPlanActionType =
  | "SERVICE_PAGE"
  | "SERVICE_HUB"
  | "COMMERCIAL_LANDING_PAGE"
  | "SUPPORTING_GUIDE"
  | "BLOG_ARTICLE"
  | "CONTENT_CLUSTER"
  | "EXISTING_PAGE_IMPROVEMENT"
  | "MARKET_EXPANSION_REVIEW"
  | "NO_ACTION";

export type GrowthPlanActionPriority = "HIGH" | "MEDIUM" | "LOW";

export interface GrowthPlanAction {
  id: string;
  actionType: GrowthPlanActionType;
  title: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  marketScope: string;
  growthPlanRole: string;
  gapEvidenceStatus: string;
  gapConfidence: string;
  priority: GrowthPlanActionPriority;
  actionScore: number;
  searchVolume: number | null;
  combinedSearchDemand: number;
  cpc: number | null;
  competitorCount: number;
  bestCompetitorDomain: string | null;
  bestCompetitorPosition: number | null;
  bestRankingUrl: string | null;
  subjectPosition: number | null;
  subjectRankingUrl: string | null;
  rationale: string;
  evidenceReasons: string[];
  recommendedPageType: string;
  recommendedIntent: string;
  recommendedNextStep: string;
  dependencies: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface GrowthPlanIntelligenceSnapshot {
  version: typeof GROWTH_PLAN_STRATEGY_VERSION;
  generatedAt: string;
  subjectDomain: string;
  market: string;
  intelligenceSourceVersion: string;
  inheritedDataForSeoCost: number;
  summary: {
    totalActions: number;
    highPriorityActions: number;
    mediumPriorityActions: number;
    lowPriorityActions: number;
    primaryCommercialDemand: number;
    supportingDemand: number;
    provenUntappedCount: number;
    insufficientEvidenceCount: number;
  };
  actions: GrowthPlanAction[];
  roadmap: {
    immediate: GrowthPlanAction[];
    next: GrowthPlanAction[];
    later: GrowthPlanAction[];
  };
}

/** Lower is better. Evidence quality is an explicit ranking dimension — status is never upgraded. */
export function gapEvidenceStatusRank(status: string): number {
  switch (status) {
    case "PROVEN_UNTAPPED":
      return 1;
    case "PROVEN_WEAK_COVERAGE":
      return 2;
    case "PROVEN_DEFEND_IMPROVE":
      return 3;
    case "NEW_MARKET_EVIDENCE":
      return 4;
    case "INSUFFICIENT_EVIDENCE":
      return 5;
    case "NOT_APPLICABLE":
      return 6;
    default:
      return 7;
  }
}

/** Higher is better. HIGH is required for the strongest PROVEN_UNTAPPED rank. */
export function gapConfidenceRank(confidence: string): number {
  switch (confidence) {
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    case "NONE":
      return 0;
    default:
      return 0;
  }
}

export interface GapEvidenceFields {
  gapEvidenceStatus: string;
  gapConfidence: string;
}

/** Negative when `a` has stronger truthful evidence than `b`. Does not fabricate or upgrade status. */
export function compareGapEvidenceQuality(a: GapEvidenceFields, b: GapEvidenceFields): number {
  const statusDelta = gapEvidenceStatusRank(a.gapEvidenceStatus) - gapEvidenceStatusRank(b.gapEvidenceStatus);
  if (statusDelta) return statusDelta;
  return gapConfidenceRank(b.gapConfidence) - gapConfidenceRank(a.gapConfidence);
}
