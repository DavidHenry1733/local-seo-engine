/**
 * areaEngine.ts
 *
 * Area intelligence engine for the local SEO page builder.
 *
 * Entry point:
 *   runAreaEngine(input: AreaEngineInput): AreaEngineOutput
 *
 * Responsibilities:
 *   1. Load rich geographic data from areaData/*.json
 *   2. Score and rank areas by opportunity (demand × competition × affluence × priority)
 *   3. Produce per-area content signals ready for AI prompt injection
 *   4. Build a related-area map for internal linking
 *   5. Generate a coverage report with gap analysis and recommendations
 */

import fs   from "node:fs";
import path from "node:path";

import type {
  AffluenceTier,
  AreaContentSignals,
  AreaCoverageReport,
  AreaEngineInput,
  AreaEngineOutput,
  AreaProfile,
  AreaScore,
  AreaTier,
  CityAreaData,
  CompetitionLevel,
  SearchDemandLevel,
} from "./areaTypes";

// ── Default data directory ─────────────────────────────────────────────────────

const DEFAULT_DATA_DIR = path.join(__dirname, "areaData");

// ── Data loader ───────────────────────────────────────────────────────────────

/**
 * Loads the city JSON file.
 * Looks first in the supplied path, then in the bundled areaData directory.
 */
function loadCityData(cityName: string, cityDataPath?: string): CityAreaData {
  let filePath: string;

  if (cityDataPath) {
    filePath = path.resolve(cityDataPath);
  } else {
    const slug = cityName.toLowerCase().replace(/\s+/g, "-");
    filePath = path.join(DEFAULT_DATA_DIR, `${slug}.json`);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Area data file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as CityAreaData;
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

/**
 * Converts SearchDemandLevel → points (0–30).
 * High demand = most points.
 */
function demandPoints(level: SearchDemandLevel): number {
  return { high: 30, medium: 20, low: 10 }[level];
}

/**
 * Converts CompetitionLevel → opportunity points (0–20).
 * Low competition = highest opportunity score.
 */
function competitionPoints(level: CompetitionLevel): number {
  return { low: 20, medium: 12, high: 5 }[level];
}

/**
 * Converts AffluenceTier → commercial potential points (0–25).
 * Premium areas offer higher-value clients.
 */
function affluencePoints(tier: AffluenceTier): number {
  return { premium: 25, professional: 20, mixed: 13, community: 8 }[tier];
}

/**
 * Converts manual priority (1 = best) → score boost (0–25).
 * Priority 1 → 25pts, priority 2 → 20pts, … priority 6+ → 0pts.
 */
function priorityPoints(priority: number): number {
  return Math.max(0, 25 - (priority - 1) * 5);
}

/**
 * Composite opportunity score for a single area.
 *   Demand     : 30 pts max — is there search demand?
 *   Competition: 20 pts max — is there room in the market?
 *   Affluence  : 25 pts max — are clients worth winning?
 *   Priority   : 25 pts max — operator-defined importance
 *   Total      : 100 pts max
 */
function scoreArea(profile: AreaProfile): number {
  return (
    demandPoints(profile.searchDemand) +
    competitionPoints(profile.competition) +
    affluencePoints(profile.affluenceTier) +
    priorityPoints(profile.priority)
  );
}

// ── Tier assignment ───────────────────────────────────────────────────────────

function assignTier(
  score: number,
  rank:  number,
  maxPriority:  number,
  maxSecondary: number
): AreaTier {
  if (rank <= maxPriority)                  return "priority";
  if (rank <= maxPriority + maxSecondary)   return "secondary";
  return "tertiary";
}

// ── Area ranking ──────────────────────────────────────────────────────────────

function rankAreas(
  profiles:     AreaProfile[],
  maxPriority:  number,
  maxSecondary: number
): AreaScore[] {
  const scored = profiles
    .map((p) => ({ area: p.name, score: scoreArea(p) }))
    .sort((a, b) => b.score - a.score);

  return scored.map((item, i) => ({
    area:  item.area,
    score: item.score,
    rank:  i + 1,
    tier:  assignTier(item.score, i + 1, maxPriority, maxSecondary),
  }));
}

// ── Content signal builders ───────────────────────────────────────────────────

function buildCompetitionNote(level: CompetitionLevel, serviceName: string): string {
  switch (level) {
    case "high":
      return `${serviceName} is a competitive market in this area — differentiation through quality, trust signals and local specificity is essential.`;
    case "medium":
      return `${serviceName} has moderate competition in this area — a well-optimised page with strong local relevance can stand out clearly.`;
    case "low":
      return `${serviceName} has relatively few established competitors in this area — a strong first-mover presence can capture significant organic traffic.`;
  }
}

function buildDemandNote(level: SearchDemandLevel, serviceName: string, area: string): string {
  switch (level) {
    case "high":
      return `Search demand for ${serviceName} in ${area} is high — customers are actively looking, so visibility directly translates into enquiries.`;
    case "medium":
      return `Search demand for ${serviceName} in ${area} is consistent — steady local interest makes this a reliable target for organic lead generation.`;
    case "low":
      return `Search demand for ${serviceName} in ${area} is currently lower — pages should emphasise local relevance and trust to maximise conversion of available traffic.`;
  }
}

function buildLocalContext(profile: AreaProfile, city: string): string {
  return `${profile.name} is ${profile.character} in ${city}, known for ${profile.knownFor}. ` +
    `The area's businesses are predominantly ${profile.businessType}.`;
}

function buildCompetitorAngle(level: CompetitionLevel): string {
  switch (level) {
    case "high":
      return "Emphasise proven results, named local clients (where permitted), response speed and a clearly defined process. Avoid generic claims.";
    case "medium":
      return "Lead with local expertise and a clear value proposition. Highlight what makes the service distinct from volume agencies.";
    case "low":
      return "Position as the established local specialist. Build authority through content depth and local signals before competitors arrive.";
  }
}

function buildMessagingRegister(tier: AffluenceTier): string {
  switch (tier) {
    case "premium":
      return "Premium register: emphasise quality, ROI, and brand credibility. Avoid discount language. Target decision-makers who value outcomes over price.";
    case "professional":
      return "Professional register: business outcomes, efficiency, and credibility. Speak to busy owners who need reliable results.";
    case "mixed":
      return "Balanced register: quality and value in equal measure. Acknowledge cost sensitivity without underselling the service.";
    case "community":
      return "Community register: accessibility, trust, and local understanding. Referral and relationship language performs well here.";
  }
}

/**
 * Builds a full AreaContentSignals object for one area.
 * The output is ready to paste into an AI system prompt or
 * content generation template.
 */
function buildContentSignals(
  profile:     AreaProfile,
  city:        string,
  serviceName: string
): AreaContentSignals {
  return {
    area:             profile.name,
    postcode:         profile.postcode,
    city,
    character:        profile.character,
    knownFor:         profile.knownFor,
    businessType:     profile.businessType,
    keywordModifier:  profile.keywordModifier,
    landmarks:        profile.landmarks,
    nearbyAreas:      profile.nearbyAreas,
    affluence:        profile.affluenceTier,
    competitionNote:  buildCompetitionNote(profile.competition, serviceName),
    demandNote:       buildDemandNote(profile.searchDemand, serviceName, profile.name),
    localContext:     buildLocalContext(profile, city),
    competitorAngle:  buildCompetitorAngle(profile.competition),
    messagingRegister: buildMessagingRegister(profile.affluenceTier),
  };
}

// ── Related-area map ──────────────────────────────────────────────────────────

/**
 * For each area, returns its declared nearby areas (capped at 3).
 * Falls back to the 3 geographically closest areas if none declared.
 * Used by the anchor engine and internal-links builder.
 */
function buildRelatedAreaMap(
  profiles: AreaProfile[]
): Record<string, string[]> {
  const allNames = new Set(profiles.map((p) => p.name));
  const map: Record<string, string[]> = {};

  for (const profile of profiles) {
    // Filter nearby areas to only those that exist in this dataset
    const valid = profile.nearbyAreas
      .filter((n) => allNames.has(n))
      .slice(0, 3);

    if (valid.length > 0) {
      map[profile.name] = valid;
    } else {
      // Fallback: nearest areas by distanceKm difference
      const sorted = profiles
        .filter((p) => p.name !== profile.name)
        .sort((a, b) =>
          Math.abs(a.distanceKm - profile.distanceKm) -
          Math.abs(b.distanceKm - profile.distanceKm)
        )
        .slice(0, 3)
        .map((p) => p.name);
      map[profile.name] = sorted;
    }
  }

  return map;
}

// ── Coverage report ───────────────────────────────────────────────────────────

function buildCoverageReport(
  profiles:    AreaProfile[],
  ranked:      AreaScore[],
  serviceName: string
): AreaCoverageReport {
  const byTier = (tier: AreaTier) =>
    ranked.filter((r) => r.tier === tier).map((r) => r.area);

  const priorityAreas   = byTier("priority");
  const secondaryAreas  = byTier("secondary");
  const tertiaryAreas   = byTier("tertiary");

  // High-demand areas not in the priority tier
  const highDemandNames = profiles
    .filter((p) => p.searchDemand === "high")
    .map((p) => p.name);

  const uncoveredHighDemand = highDemandNames.filter(
    (n) => !priorityAreas.includes(n)
  );

  // Recommendations
  const recommendations: string[] = [];

  if (priorityAreas.length === 0) {
    recommendations.push("No priority areas found — check scoring thresholds or add more areas.");
  } else {
    recommendations.push(
      `Build ${serviceName} hub and cluster pages for priority areas first: ${priorityAreas.slice(0, 3).join(", ")}.`
    );
  }

  if (uncoveredHighDemand.length > 0) {
    recommendations.push(
      `High-demand areas outside priority tier: ${uncoveredHighDemand.join(", ")}. Consider adding these to the priority list.`
    );
  }

  const lowCompHighDemand = profiles.filter(
    (p) => p.searchDemand === "high" && p.competition === "low"
  );
  if (lowCompHighDemand.length > 0) {
    recommendations.push(
      `Best first-mover opportunities (high demand, low competition): ${lowCompHighDemand.map((p) => p.name).join(", ")}.`
    );
  }

  const premiumUnworked = profiles.filter(
    (p) => p.affluenceTier === "premium" && p.competition !== "high"
  );
  if (premiumUnworked.length > 0) {
    recommendations.push(
      `Premium areas with manageable competition: ${premiumUnworked.map((p) => p.name).join(", ")}. Prioritise for high-value client acquisition.`
    );
  }

  if (tertiaryAreas.length > 4) {
    recommendations.push(
      `${tertiaryAreas.length} tertiary areas identified. Consider building thin supporting pages for these once priority coverage is complete.`
    );
  }

  return {
    totalAreas:         profiles.length,
    priorityAreas,
    secondaryAreas,
    tertiaryAreas,
    uncoveredHighDemand,
    recommendations,
  };
}

// ── Main engine ───────────────────────────────────────────────────────────────

export function runAreaEngine(input: AreaEngineInput): AreaEngineOutput {
  const maxPriority  = input.maxPriorityAreas  ?? 5;
  const maxSecondary = input.maxSecondaryAreas ?? 5;

  // ── Load data ──────────────────────────────────────────────────────────────
  const cityData = loadCityData(input.cityName, input.cityDataPath);

  if (cityData.areas.length === 0) {
    throw new Error(`No areas found in data file for city: ${input.cityName}`);
  }

  // ── Rank ───────────────────────────────────────────────────────────────────
  const rankedAreas = rankAreas(cityData.areas, maxPriority, maxSecondary);

  // ── Content signals ────────────────────────────────────────────────────────
  const contentSignals: Record<string, AreaContentSignals> = {};
  for (const profile of cityData.areas) {
    contentSignals[profile.name] = buildContentSignals(
      profile,
      cityData.city,
      input.serviceName
    );
  }

  // ── Related-area map ───────────────────────────────────────────────────────
  const relatedAreaMap = buildRelatedAreaMap(cityData.areas);

  // ── Coverage report ────────────────────────────────────────────────────────
  const coverageReport = buildCoverageReport(
    cityData.areas,
    rankedAreas,
    input.serviceName
  );

  return {
    city:        cityData.city,
    region:      cityData.region,
    serviceName: input.serviceName,
    rankedAreas,
    contentSignals,
    relatedAreaMap,
    coverageReport,
  };
}

// ── Convenience exports ───────────────────────────────────────────────────────

/**
 * Returns the AreaContentSignals for a single area.
 * Useful for injecting into a single-page generator without running the full engine.
 */
export function getAreaSignals(
  cityName:     string,
  areaName:     string,
  serviceName:  string,
  cityDataPath?: string
): AreaContentSignals {
  const cityData = loadCityData(cityName, cityDataPath);
  const profile  = cityData.areas.find(
    (a) => a.name.toLowerCase() === areaName.toLowerCase()
  );
  if (!profile) {
    throw new Error(`Area "${areaName}" not found in city data for "${cityName}".`);
  }
  return buildContentSignals(profile, cityData.city, serviceName);
}

/**
 * Returns the ranked list of areas for a city without running the full engine.
 * Lightweight — no signals or coverage report.
 */
export function getRankedAreas(
  cityName:      string,
  serviceName:   string,
  cityDataPath?: string,
  maxPriority    = 5,
  maxSecondary   = 5
): AreaScore[] {
  const cityData = loadCityData(cityName, cityDataPath);
  return rankAreas(cityData.areas, maxPriority, maxSecondary);
}

/** Rank areas from pre-loaded city data (supports config/areas simple format). */
export function rankAreasFromCityData(
  cityData: CityAreaData,
  maxPriority = 5,
  maxSecondary = 5,
): AreaScore[] {
  return rankAreas(cityData.areas, maxPriority, maxSecondary);
}
