/**
 * Shared Local Coverage recommendation engine.
 * Ranks local areas from verified Google coordinates and haversine distance.
 * Does not use list position, score, index, or placeholder values as distance.
 */
import { loadCityAreaData } from "../area/loadCityAreaData.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { isNationalMarketScope, resolvePrimaryMarket } from "./masterAdminMarketScopeService.ts";
import {
  DISTANCE_CALCULATION_METHOD,
  DISTANCE_SOURCE,
  DISTANCE_UNAVAILABLE_LABEL,
  discoverNearbyLocalitiesViaGooglePlaces,
  formatVerifiedDistanceLabel,
  geocodeLocalityViaGooglePlaces,
  getLocalCoverageGoogleClient,
  haversineKm,
  isVerifiedGeoPoint,
  lookupLocalityCoordinates,
  rememberGeocodedLocality,
  resolvePharmacyGoogleLocation,
  roundDistanceKm,
  type GeocodedLocality,
  type PharmacyGoogleLocation,
} from "./masterAdminLocalCoverageGeoService.ts";
import { AREA_SUGGEST_LIMITS, type AreaSuggestLimit } from "./pharmacyAreaDiscoveryService.ts";
import type { PharmacyProfileData, ProfileAreaEntry } from "./pharmacyProfileSchema.ts";
import { safePharmacySlug } from "./pharmacyWorkspacePaths.ts";

export const LOCAL_COVERAGE_DEFAULT_LIMIT = 10;
export const LOCAL_COVERAGE_DEFAULT_RECOMMENDATION_LIMIT = 8;

export interface LocalCoverageDistanceProvenance {
  calculationMethod: typeof DISTANCE_CALCULATION_METHOD | "none";
  distanceSource: typeof DISTANCE_SOURCE | "unverified";
  limitation?: string;
  pharmacy?: {
    latitude: number;
    longitude: number;
    source: PharmacyGoogleLocation["source"];
    placeId: string;
  };
  locality?: {
    latitude: number;
    longitude: number;
    source: GeocodedLocality["source"];
    placeId: string;
  };
}

export interface LocalCoverageAreaRecommendation {
  areaName: string;
  areaType: string;
  distanceKm: number | null;
  distanceLabel: string;
  evidenceSource: string;
  confidence: number;
  selected: boolean;
  recommended: boolean;
  branchLocality: boolean;
  evidenceLimitation: string | null;
  distanceMethod: string;
  distanceProvenance: LocalCoverageDistanceProvenance;
}

export interface LocalCoverageRecommendationResult {
  primaryTown: string;
  primaryTownSource: string;
  branchLocality: string;
  areas: LocalCoverageAreaRecommendation[];
  discoverySource: string;
  marketScope?: string;
  primaryMarket?: string;
  localityStrategyActive?: boolean;
  pharmacyCoordinatesAvailable: boolean;
  evidenceLimitation: string | null;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeLimit(limit: number): AreaSuggestLimit {
  const n = Number(limit) || LOCAL_COVERAGE_DEFAULT_LIMIT;
  const allowed = AREA_SUGGEST_LIMITS as readonly number[];
  if (allowed.includes(n)) return n as AreaSuggestLimit;
  return allowed.reduce((best, cur) => (Math.abs(cur - n) < Math.abs(best - n) ? cur : best));
}

function areaKey(name: string): string {
  return name.trim().toLowerCase();
}

function unavailableProvenance(limitation: string): LocalCoverageDistanceProvenance {
  return {
    calculationMethod: "none",
    distanceSource: "unverified",
    limitation,
  };
}

function verifiedProvenance(
  pharmacy: PharmacyGoogleLocation,
  locality: GeocodedLocality,
): LocalCoverageDistanceProvenance {
  return {
    calculationMethod: DISTANCE_CALCULATION_METHOD,
    distanceSource: DISTANCE_SOURCE,
    pharmacy: {
      latitude: pharmacy.latitude,
      longitude: pharmacy.longitude,
      source: pharmacy.source,
      placeId: pharmacy.placeId,
    },
    locality: {
      latitude: locality.latitude,
      longitude: locality.longitude,
      source: locality.source,
      placeId: locality.placeId,
    },
  };
}

function measureDistance(
  pharmacy: PharmacyGoogleLocation | null,
  locality: GeocodedLocality | null,
): { km: number | null; label: string; provenance: LocalCoverageDistanceProvenance; limitation: string | null } {
  if (!pharmacy || !isVerifiedGeoPoint(pharmacy)) {
    const limitation = "Pharmacy Google coordinates are unavailable.";
    return {
      km: null,
      label: DISTANCE_UNAVAILABLE_LABEL,
      provenance: unavailableProvenance(limitation),
      limitation,
    };
  }
  if (!locality || !isVerifiedGeoPoint(locality)) {
    const limitation = "Locality Google coordinates are unavailable.";
    return {
      km: null,
      label: DISTANCE_UNAVAILABLE_LABEL,
      provenance: unavailableProvenance(limitation),
      limitation,
    };
  }
  const km = roundDistanceKm(haversineKm(pharmacy, locality));
  return {
    km,
    label: formatVerifiedDistanceLabel(km),
    provenance: verifiedProvenance(pharmacy, locality),
    limitation: null,
  };
}

function catalogAreaNames(town: string): string[] {
  if (!town) return [];
  try {
    return loadCityAreaData(town).areas.map((area) => area.name).filter(Boolean);
  } catch {
    return [];
  }
}

function collectCandidateNames(input: {
  slug: string;
  pharmacy: PharmacyGoogleLocation | null;
  profile: PharmacyProfileData;
  primaryTown: string;
  limit: number;
}): Array<{ areaName: string; areaType: string; source: string; branchLocality: boolean }> {
  const out: Array<{ areaName: string; areaType: string; source: string; branchLocality: boolean }> = [];
  const seen = new Set<string>();
  const add = (
    name: string,
    meta: { areaType: string; source: string; branchLocality?: boolean },
  ) => {
    const trimmed = text(name);
    if (!trimmed) return;
    const key = areaKey(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      areaName: trimmed,
      areaType: meta.areaType,
      source: meta.source,
      branchLocality: Boolean(meta.branchLocality),
    });
  };

  const branch = text(input.pharmacy?.branchLocality || "");
  if (branch) {
    add(branch, {
      areaType: "primary locality",
      source: "google-address-locality",
      branchLocality: true,
    });
  }

  const client = getLocalCoverageGoogleClient();
  if (client && input.pharmacy) {
    for (const nearby of client.discoverNearbyLocalities({
      origin: input.pharmacy,
      branchLocality: branch,
      regionHint: input.pharmacy.town || input.primaryTown,
      limit: input.limit,
    })) {
      rememberGeocodedLocality(input.slug, nearby);
      add(nearby.areaName, {
        areaType: "nearby locality",
        source: "google-places-nearby",
      });
    }
  }

  for (const name of catalogAreaNames(input.primaryTown || input.pharmacy?.town || "")) {
    const loc = lookupLocalityCoordinates(input.slug, name, input.pharmacy);
    if (!loc || !isVerifiedGeoPoint(loc)) continue;
    rememberGeocodedLocality(input.slug, loc);
    add(name, { areaType: "nearby locality", source: "google-places-geocode" });
  }

  for (const saved of input.profile.selectedAreas || []) {
    add(saved.areaName, {
      areaType: saved.areaType || "service area",
      source: saved.source || "saved-profile",
    });
  }

  return out;
}

function toRecommendation(input: {
  name: string;
  areaType: string;
  source: string;
  branchLocality: boolean;
  pharmacy: PharmacyGoogleLocation | null;
  locality: GeocodedLocality | null;
  saved?: ProfileAreaEntry;
}): LocalCoverageAreaRecommendation {
  const distance = measureDistance(input.pharmacy, input.locality);
  const verified = distance.km != null;
  return {
    areaName: input.name,
    areaType: input.branchLocality ? "primary locality" : input.areaType,
    distanceKm: distance.km,
    distanceLabel: distance.label,
    evidenceSource: input.source,
    confidence: verified ? 90 : 0,
    selected: input.saved ? input.saved.selected !== false : false,
    recommended: false,
    branchLocality: input.branchLocality,
    evidenceLimitation: distance.limitation,
    distanceMethod: distance.provenance.calculationMethod,
    distanceProvenance: distance.provenance,
  };
}

export function buildLocalCoverageRecommendations(
  slug: string,
  options?: { limit?: number; recommendationLimit?: number },
): LocalCoverageRecommendationResult {
  const safe = safePharmacySlug(slug);
  const profile = readSetupProfile(safe);
  if (isNationalMarketScope(safe, profile)) {
    return {
      primaryTown: "",
      primaryTownSource: "national-market-scope",
      branchLocality: "",
      areas: [],
      discoverySource: "national-market-scope",
      marketScope: "national",
      primaryMarket: resolvePrimaryMarket(safe, profile),
      localityStrategyActive: false,
      pharmacyCoordinatesAvailable: false,
      evidenceLimitation: null,
    };
  }

  const pharmacy = resolvePharmacyGoogleLocation(safe, profile);
  const primaryTown = text(profile.primaryTown) || text(profile.primaryCity) || text(profile.townCity) || text(pharmacy?.town);
  const primaryTownSource = text(profile.primaryTown) || text(profile.townCity)
    ? "approved profile"
    : pharmacy?.town
      ? "google-location-evidence"
      : "none";
  const limit = normalizeLimit(options?.limit ?? LOCAL_COVERAGE_DEFAULT_LIMIT);
  const recommendationLimit = Math.min(
    options?.recommendationLimit ?? LOCAL_COVERAGE_DEFAULT_RECOMMENDATION_LIMIT,
    limit,
  );

  if (!primaryTown && !pharmacy?.branchLocality) {
    return {
      primaryTown: "",
      primaryTownSource,
      branchLocality: "",
      areas: [],
      discoverySource: "none",
      localityStrategyActive: true,
      pharmacyCoordinatesAvailable: Boolean(pharmacy),
      evidenceLimitation: "Locality evidence unavailable",
    };
  }

  const existingSelected = new Map(
    (profile.selectedAreas || []).map((entry) => [areaKey(entry.areaName), entry]),
  );

  const candidates = collectCandidateNames({
    slug: safe,
    pharmacy,
    profile,
    primaryTown,
    limit,
  });

  const measured = candidates.map((candidate) => {
    const locality = lookupLocalityCoordinates(safe, candidate.areaName, pharmacy);
    if (locality) rememberGeocodedLocality(safe, locality);
    return toRecommendation({
      name: candidate.areaName,
      areaType: candidate.areaType,
      source: candidate.source,
      branchLocality: candidate.branchLocality,
      pharmacy,
      locality,
      saved: existingSelected.get(areaKey(candidate.areaName)),
    });
  });

  measured.sort((a, b) => {
    if (a.branchLocality !== b.branchLocality) return a.branchLocality ? -1 : 1;
    if (a.distanceKm == null && b.distanceKm == null) return a.areaName.localeCompare(b.areaName);
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return a.areaName.localeCompare(b.areaName);
  });

  let remainingRecommendations = recommendationLimit;
  for (const area of measured) {
    if (remainingRecommendations <= 0) break;
    if (area.distanceKm == null) continue;
    area.recommended = true;
    remainingRecommendations -= 1;
  }

  const pharmacyCoordinatesAvailable = Boolean(pharmacy && isVerifiedGeoPoint(pharmacy));
  const evidenceLimitation = pharmacyCoordinatesAvailable
    ? null
    : "Google coordinates were not available for this pharmacy. Automatic area recommendations are paused until location evidence is present. Manual area entry remains available.";

  return {
    primaryTown: primaryTown || pharmacy?.branchLocality || "",
    primaryTownSource,
    branchLocality: pharmacy?.branchLocality || "",
    areas: measured,
    discoverySource: "google-location-evidence",
    marketScope: "local_regional",
    localityStrategyActive: true,
    pharmacyCoordinatesAvailable,
    evidenceLimitation,
  };
}

export async function hydrateLocalCoverageGoogleLocalities(
  slug: string,
  options?: { limit?: number },
): Promise<void> {
  const safe = safePharmacySlug(slug);
  const profile = readSetupProfile(safe);
  if (isNationalMarketScope(safe, profile)) return;
  const pharmacy = resolvePharmacyGoogleLocation(safe, profile);
  if (!pharmacy || !isVerifiedGeoPoint(pharmacy)) return;

  const limit = normalizeLimit(options?.limit ?? LOCAL_COVERAGE_DEFAULT_LIMIT);
  const regionHint = pharmacy.town || text(profile.primaryTown) || text(profile.townCity);
  const names = new Set<string>();
  if (pharmacy.branchLocality) names.add(pharmacy.branchLocality);

  const nearby = await discoverNearbyLocalitiesViaGooglePlaces({
    origin: pharmacy,
    branchLocality: pharmacy.branchLocality || regionHint,
    regionHint,
    limit,
  });
  for (const locality of nearby) {
    rememberGeocodedLocality(safe, locality);
    names.add(locality.areaName);
  }

  for (const name of catalogAreaNames(regionHint)) names.add(name);
  for (const saved of profile.selectedAreas || []) {
    if (saved.areaName) names.add(saved.areaName);
  }

  for (const name of names) {
    if (lookupLocalityCoordinates(safe, name, pharmacy)) continue;
    const geocoded = await geocodeLocalityViaGooglePlaces(name, pharmacy, regionHint);
    if (geocoded) rememberGeocodedLocality(safe, geocoded);
  }
}

export function distanceForLocalCoverageArea(
  slug: string,
  areaName: string,
  pharmacy?: PharmacyGoogleLocation | null,
): { km: number | null; label: string; provenance: LocalCoverageDistanceProvenance } {
  const location = pharmacy === undefined ? resolvePharmacyGoogleLocation(slug) : pharmacy;
  const locality = lookupLocalityCoordinates(slug, areaName, location);
  const measured = measureDistance(location, locality);
  return { km: measured.km, label: measured.label, provenance: measured.provenance };
}
