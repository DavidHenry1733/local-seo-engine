/**
 * National Market Intelligence Model V1
 *
 * Separate from Local Market Intelligence.
 *
 * This model describes the NATIONAL commercial market and must not depend on
 * physical branch locality, Google Places proximity or local healthcare data.
 */

export const NATIONAL_MARKET_INTELLIGENCE_VERSION = 1 as const;

export interface NationalMarketSegment {
  segmentId: string;
  label: string;
  description: string;

  customerTypes: string[];
  relevantServices: string[];

  evidence: string[];
}

export interface NationalMarketIntelligenceSnapshot {
  version: typeof NATIONAL_MARKET_INTELLIGENCE_VERSION;

  slug: string;

  growthPlatform: "national";

  country: string;

  marketName: string;
  marketDefinition: string;

  targetCustomer: string[];
  customerSegments: NationalMarketSegment[];

  relevantServices: string[];

  competitorCount: number;

  marketStrengths: string[];
  marketWeaknesses: string[];

  opportunities: string[];
  risks: string[];

  evidence: string[];

  generatedAt: string;

  status:
    | "draft"
    | "evidence_collected"
    | "analysis_complete"
    | "ready_for_review";
}

export function emptyNationalMarketIntelligenceSnapshot(
  slug: string,
): NationalMarketIntelligenceSnapshot {
  return {
    version: NATIONAL_MARKET_INTELLIGENCE_VERSION,

    slug,

    growthPlatform: "national",

    country: "United Kingdom",

    marketName: "",
    marketDefinition: "",

    targetCustomer: [],
    customerSegments: [],

    relevantServices: [],

    competitorCount: 0,

    marketStrengths: [],
    marketWeaknesses: [],

    opportunities: [],
    risks: [],

    evidence: [],

    generatedAt: new Date().toISOString(),

    status: "draft",
  };
}
