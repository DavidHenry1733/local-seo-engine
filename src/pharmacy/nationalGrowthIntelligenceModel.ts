/**
 * National Growth Intelligence Model V1
 *
 * NATIONAL counterpart to the Local Growth Engine opportunity layer.
 *
 * Opportunities must be evidence-backed.
 * Unknown metrics remain unknown.
 * No fabricated search volume, traffic, enquiries or rankings.
 */

export const NATIONAL_GROWTH_INTELLIGENCE_VERSION = 1 as const;

export type NationalGrowthPriority = "high" | "medium" | "later";

export type NationalGrowthOpportunityCategory =
  | "service"
  | "content"
  | "search"
  | "positioning"
  | "authority"
  | "conversion"
  | "offer"
  | "trust"
  | "technical";

export interface NationalGrowthOpportunity {
  opportunityId: string;

  category: NationalGrowthOpportunityCategory;

  priority: NationalGrowthPriority;

  title: string;
  description: string;

  currentState: string;
  competitorState: string;

  evidence: string[];

  recommendedAction: string;

  expectedOutcome: string;

  confidence: "high" | "medium" | "low" | "unknown";
}

export interface NationalGrowthRoadmap {
  high: NationalGrowthOpportunity[];
  medium: NationalGrowthOpportunity[];
  later: NationalGrowthOpportunity[];
}

export interface NationalGrowthIntelligenceSnapshot {
  version: typeof NATIONAL_GROWTH_INTELLIGENCE_VERSION;

  slug: string;

  growthPlatform: "national";

  generatedAt: string;

  opportunities: NationalGrowthOpportunity[];

  roadmap: NationalGrowthRoadmap;

  evidence: string[];

  status:
    | "draft"
    | "analysis_complete"
    | "ready_for_review";
}

export function emptyNationalGrowthIntelligenceSnapshot(
  slug: string,
): NationalGrowthIntelligenceSnapshot {
  return {
    version: NATIONAL_GROWTH_INTELLIGENCE_VERSION,

    slug,

    growthPlatform: "national",

    generatedAt: new Date().toISOString(),

    opportunities: [],

    roadmap: {
      high: [],
      medium: [],
      later: [],
    },

    evidence: [],

    status: "draft",
  };
}
