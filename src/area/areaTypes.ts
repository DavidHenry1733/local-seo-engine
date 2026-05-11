/**
 * areaTypes.ts
 *
 * TypeScript types for the area intelligence engine.
 *
 * The area engine sits above the existing buildAreaPlan / buildPagePayload
 * layer. It converts rich geographic data (loaded from areaData/*.json)
 * into four outputs:
 *
 *   1. Ranked area list — which areas to target first
 *   2. Content signals  — what to tell the AI about each area
 *   3. Related-area map — which areas to cross-link
 *   4. Coverage report  — gaps and recommendations
 */

// ── Primitive unions ──────────────────────────────────────────────────────────

/** Relative search volume for the service in this area */
export type SearchDemandLevel = "high" | "medium" | "low";

/** How many established competitors serve this area */
export type CompetitionLevel = "high" | "medium" | "low";

/**
 * Broad affluence profile — used to tailor commercial messaging:
 *   premium     → premium pricing, ROI language, quality emphasis
 *   professional → business outcomes, efficiency, credibility
 *   mixed        → value + quality balance
 *   community    → accessibility, local trust, referral angle
 */
export type AffluenceTier = "premium" | "professional" | "mixed" | "community";

// ── Area data (matches areaData/*.json schema) ────────────────────────────────

/**
 * Rich profile for a single area within a city.
 * Stored in areaData/*.json and used by the area engine.
 */
export interface AreaProfile {
  /** Area name exactly as used in page titles and slugs */
  name:          string;
  /** Primary postcode district, e.g. "S11" */
  postcode:      string;
  /** Short descriptor of the area's character */
  character:     string;
  /** What the area is known for — used in local relevance copy */
  knownFor:      string;
  /** Dominant business type — steers commercial angle */
  businessType:  string;
  /**
   * Optional short phrase used in the deterministic supporting keyword
   * "web design for <keywordModifier> businesses in <area>".
   * Defaults to the first word of businessType when absent.
   * Example: "high street" → "web design for high street businesses in Hillsborough"
   */
  keywordModifier?: string;
  /** Named local landmarks for anchor copy and local signals */
  landmarks:     string[];
  /** Adjacent areas for internal linking and sibling context */
  nearbyAreas:   string[];
  /** Estimated local search demand for digital services */
  searchDemand:  SearchDemandLevel;
  /** Competitor density for digital services in this area */
  competition:   CompetitionLevel;
  /** Broad economic character of the area */
  affluenceTier: AffluenceTier;
  /** Approximate straight-line distance from city centre in km */
  distanceKm:    number;
  /**
   * Manual priority override (1 = highest).
   * Used to promote key commercial areas regardless of score.
   */
  priority:      number;
}

/**
 * Top-level structure of each areaData/*.json file.
 * One file per city / metropolitan area.
 */
export interface CityAreaData {
  city:           string;
  region:         string;
  /** Root postcode letter(s), e.g. "S" for Sheffield */
  postcodeRoot:   string;
  /** Free-text description of the overall market */
  marketContext:  string;
  areas:          AreaProfile[];
}

// ── Engine scoring ────────────────────────────────────────────────────────────

/** Tier assigned to an area based on its opportunity score */
export type AreaTier = "priority" | "secondary" | "tertiary" | "hub" | "cluster";

/** Scored and ranked entry for a single area */
export interface AreaScore {
  area:  string;
  /** Composite opportunity score: 0–100 */
  score: number;
  /** Rank within this city (1 = best opportunity) */
  rank:  number;
  tier:  AreaTier;
}

// ── Content signals ───────────────────────────────────────────────────────────

/**
 * Structured context produced by the engine for one area.
 * Feed directly into AI content generation prompts to localise copy
 * without re-explaining the scoring model.
 */
export interface AreaContentSignals {
  area:             string;
  postcode:         string;
  city:             string;
  character:        string;
  knownFor:         string;
  businessType:     string;
  /**
   * Optional short phrase used in deterministic keyword derivation.
   * Propagated from AreaProfile.keywordModifier.
   */
  keywordModifier?: string;
  landmarks:        string[];
  nearbyAreas:      string[];
  affluence:        AffluenceTier;
  /** One-sentence competition context for messaging tone */
  competitionNote:  string;
  /** One-sentence demand context for messaging tone */
  demandNote:       string;
  /**
   * Ready-to-use local context sentence for AI prompts.
   * Combines character, known-for, and area name.
   */
  localContext:     string;
  /**
   * Suggested competitive angle — how to differentiate copy
   * based on the competition level in this area.
   */
  competitorAngle:  string;
  /**
   * Suggested messaging register — which commercial tone to apply.
   * Derived from affluenceTier.
   */
  messagingRegister: string;
}

// ── Coverage report ───────────────────────────────────────────────────────────

export interface AreaCoverageReport {
  totalAreas:         number;
  priorityAreas:      string[];
  secondaryAreas:     string[];
  tertiaryAreas:      string[];
  /** High-demand areas that have no page yet */
  uncoveredHighDemand: string[];
  /** Human-readable recommendations for the operator */
  recommendations:    string[];
}

// ── Engine I/O ────────────────────────────────────────────────────────────────

export interface AreaEngineInput {
  /** City name, must match the `city` field in the JSON file */
  cityName:          string;
  /** Path to the city JSON file; defaults to the bundled areaData directory */
  cityDataPath?:     string;
  /** Service name used in content signal generation, e.g. "Web Design" */
  serviceName:       string;
  /** Max areas to place in the priority tier (default 5) */
  maxPriorityAreas?: number;
  /** Max areas to place in the secondary tier (default 5) */
  maxSecondaryAreas?: number;
}

export interface AreaEngineOutput {
  city:          string;
  region:        string;
  serviceName:   string;
  /** All areas sorted by opportunity score, highest first */
  rankedAreas:   AreaScore[];
  /** Map of area name → AreaContentSignals */
  contentSignals: Record<string, AreaContentSignals>;
  /** Map of area name → [up to 3 nearby area names] */
  relatedAreaMap: Record<string, string[]>;
  coverageReport: AreaCoverageReport;
}
