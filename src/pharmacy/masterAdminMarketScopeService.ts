/**
 * Shared commercial market-scope identity for Growth Engine onboarding.
 * Reuses project primaryLocation / serviceAreas as the national primary-market signal.
 */
import fs from "node:fs";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { getPharmacyProjectConfigPath } from "./pharmacyWorkspacePaths.ts";
import { safePharmacySlug } from "./pharmacyWorkspacePaths.ts";

export type MarketScope = "local_regional" | "national";

export const MARKET_SCOPE_LOCAL_REGIONAL: MarketScope = "local_regional";
export const MARKET_SCOPE_NATIONAL: MarketScope = "national";

const UK_NATION_TOKENS = new Set([
  "united kingdom",
  "uk",
  "great britain",
  "england",
  "scotland",
  "wales",
  "northern ireland",
]);

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function readProjectGeography(slug: string): {
  primaryLocation: string;
  serviceAreas: string[];
  locations: string[];
} {
  const file = getPharmacyProjectConfigPath(slug);
  if (!fs.existsSync(file)) {
    return { primaryLocation: "", serviceAreas: [], locations: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    return {
      primaryLocation: text(raw.primaryLocation),
      serviceAreas: Array.isArray(raw.serviceAreas) ? raw.serviceAreas.map((v) => text(v)).filter(Boolean) : [],
      locations: Array.isArray(raw.locations) ? raw.locations.map((v) => text(v)).filter(Boolean) : [],
    };
  } catch {
    return { primaryLocation: "", serviceAreas: [], locations: [] };
  }
}

function looksNationalGeography(project: {
  primaryLocation: string;
  serviceAreas: string[];
  locations: string[];
}): boolean {
  const primary = project.primaryLocation.toLowerCase();
  if (primary === "united kingdom" || primary === "uk" || primary === "great britain") return true;
  const pooled = [...project.serviceAreas, ...project.locations].map((v) => v.toLowerCase());
  if (!pooled.length) return false;
  const nationHits = pooled.filter((v) => UK_NATION_TOKENS.has(v));
  return nationHits.length >= 3;
}

export function normalizeMarketScope(raw: unknown): MarketScope | "" {
  const v = text(raw).toLowerCase().replace(/[\s-]+/g, "_");
  if (v === "national" || v === "nationwide") return MARKET_SCOPE_NATIONAL;
  if (
    v === "local_regional" ||
    v === "local" ||
    v === "regional" ||
    v === "local/regional" ||
    v === "local_or_regional"
  ) {
    return MARKET_SCOPE_LOCAL_REGIONAL;
  }
  return "";
}

/** Infer market scope from existing project primaryLocation / national serviceAreas when profile unset. */
export function inferMarketScopeFromProject(slug: string): MarketScope | "" {
  const project = readProjectGeography(safePharmacySlug(slug));
  if (looksNationalGeography(project)) return MARKET_SCOPE_NATIONAL;
  return "";
}

export function resolveMarketScope(
  slug: string,
  profile?: Pick<PharmacyProfileData, "marketScope"> | PharmacyProfileData | null,
): MarketScope {
  const explicit = normalizeMarketScope(profile?.marketScope);
  if (explicit) return explicit;
  const inferred = inferMarketScopeFromProject(slug);
  if (inferred) return inferred;
  return MARKET_SCOPE_LOCAL_REGIONAL;
}

export function isNationalMarketScope(
  slug: string,
  profile?: Pick<PharmacyProfileData, "marketScope"> | PharmacyProfileData | null,
): boolean {
  return resolveMarketScope(slug, profile) === MARKET_SCOPE_NATIONAL;
}

/**
 * Primary market for campaign strategy.
 * National reuses project primaryLocation (canonical), then profile country.
 */
export function resolvePrimaryMarket(
  slug: string,
  profile?:
    | Pick<PharmacyProfileData, "marketScope" | "country" | "primaryMarket" | "primaryTown" | "townCity">
    | PharmacyProfileData
    | null,
): string {
  const scope = resolveMarketScope(slug, profile);
  if (scope === MARKET_SCOPE_NATIONAL) {
    const explicit = text(profile?.primaryMarket);
    if (explicit) return explicit;
    const project = readProjectGeography(safePharmacySlug(slug));
    if (project.primaryLocation) return project.primaryLocation;
    return text(profile?.country) || "United Kingdom";
  }
  return (
    text(profile?.primaryMarket) ||
    text(profile?.primaryTown) ||
    text(profile?.townCity) ||
    text(profile?.country) ||
    ""
  );
}

export function marketScopeLabel(scope: MarketScope): string {
  return scope === MARKET_SCOPE_NATIONAL ? "NATIONAL" : "LOCAL / REGIONAL";
}

/** Clear locality campaign-strategy fields while retaining registered business address. */
export function clearLocalityCampaignStrategyFields(
  profile: PharmacyProfileData,
): Pick<
  PharmacyProfileData,
  | "selectedAreas"
  | "manualAreas"
  | "rankingAreas"
  | "coverageAreas"
  | "nearbyAreas"
  | "onboardingAreaDiscoveryRevision"
  | "areaDiscoverySource"
  | "areaDiscoveryUpdatedAt"
> {
  return {
    selectedAreas: [],
    manualAreas: [],
    rankingAreas: [],
    coverageAreas: [],
    nearbyAreas: [],
    onboardingAreaDiscoveryRevision: "",
    areaDiscoverySource: "",
    areaDiscoveryUpdatedAt: "",
  };
}

export function buildMarketScopeSummary(
  slug: string,
  profile: PharmacyProfileData,
): {
  marketScope: MarketScope;
  marketScopeLabel: string;
  primaryMarket: string;
  localityStrategyActive: boolean;
  localAreasRequired: boolean;
  localGenerationRequired: boolean;
} {
  const marketScope = resolveMarketScope(slug, profile);
  const national = marketScope === MARKET_SCOPE_NATIONAL;
  return {
    marketScope,
    marketScopeLabel: marketScopeLabel(marketScope),
    primaryMarket: resolvePrimaryMarket(slug, profile),
    localityStrategyActive: !national,
    localAreasRequired: !national,
    localGenerationRequired: !national,
  };
}
