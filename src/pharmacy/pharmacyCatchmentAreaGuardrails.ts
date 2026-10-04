/**
 * Production catchment-area guardrails.
 * Keeps generation on genuine towns/suburbs and drops Google POI micro-entities.
 */
import { sitemapLocalitySlug } from "./pharmacyClusterPageUrlResolver.ts";

export const CATCHMENT_OPERATIONAL_RADIUS_KM = 10;
export const CATCHMENT_MIN_RADIUS_KM = 0;
export const CATCHMENT_TARGET_COUNT = 10;

export const GOOGLE_GEOGRAPHIC_PLACE_TYPES = ["locality", "sublocality", "postal_town"] as const;

const MICRO_ENTITY_PATTERN =
  /\b(community centres?|community centers?|village club|working men'?s club|social club|club|memorial hall|village hall|parish hall|church hall|hall|railway station|train station|bus station|station|leisure centre|recreation ground|country park|public park)\b/i;

const FACILITY_SUFFIX_PATTERN =
  /\s+(community centre|community center|village club|club|hall|town centre|town center|railway station|train station|bus station|station|park)$/i;

/** Relative population weights for Barnsley / Yorkshire production catchment. */
export const BARNSLEY_CATCHMENT_POPULATION_WEIGHTS: Record<string, number> = {
  hoyland: 17800,
  wombwell: 15500,
  darfield: 10800,
  cudworth: 11000,
  royston: 10500,
  worsbrough: 9500,
  penistone: 11200,
  goldthorpe: 6500,
  grimethorpe: 4700,
  silkstone: 3150,
  mexborough: 15200,
  thurnscoe: 8700,
  barnsley: 71000,
};

export const BARNSLEY_PRODUCTION_CATCHMENT = [
  "Darfield",
  "Wombwell",
  "Hoyland",
  "Cudworth",
  "Grimethorpe",
  "Royston",
  "Goldthorpe",
  "Penistone",
  "Worsbrough",
  "Silkstone",
] as const;

export type CatchmentAreaCandidate = {
  name: string;
  slug?: string;
  types?: string[];
  distanceKm?: number | null;
  populationWeight?: number;
};

function areaKey(name: string): string {
  return sitemapLocalitySlug(name) || String(name || "").trim().toLowerCase();
}

export function isMicroEntityOrPoiName(name: string): boolean {
  const trimmed = String(name || "").trim();
  if (!trimmed) return true;
  if (!MICRO_ENTITY_PATTERN.test(trimmed)) return false;
  // Keep real localities whose official name includes Park/Station as a place-name, not a facility.
  if (/^(kiveton park|parkgate)$/i.test(trimmed)) return false;
  return true;
}

export function collapseFacilityNameToLocality(name: string): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  const collapsed = trimmed.replace(FACILITY_SUFFIX_PATTERN, "").trim();
  return collapsed || trimmed;
}

export function isGeographicGooglePlaceType(types: string[] | undefined): boolean {
  if (!types?.length) return true;
  return types.some((type) =>
    GOOGLE_GEOGRAPHIC_PLACE_TYPES.includes(String(type || "").toLowerCase() as (typeof GOOGLE_GEOGRAPHIC_PLACE_TYPES)[number]),
  );
}

export function isWithinOperationalCatchmentRadius(distanceKm: number | null | undefined): boolean {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return true;
  return distanceKm >= CATCHMENT_MIN_RADIUS_KM && distanceKm <= CATCHMENT_OPERATIONAL_RADIUS_KM;
}

export function populationWeightForArea(name: string): number {
  return BARNSLEY_CATCHMENT_POPULATION_WEIGHTS[areaKey(name)] || 1;
}

function isBarnsleyYorkshireCatchment(input: { slug?: string; town?: string }): boolean {
  const slug = String(input.slug || "").toLowerCase();
  const town = String(input.town || "").toLowerCase();
  return slug.includes("yorkshire-pharmacy") || town.includes("barnsley") || town.includes("darfield");
}

export function selectDistinctCatchmentAreas(
  input: {
    names: Array<string | CatchmentAreaCandidate>;
    slug?: string;
    town?: string;
    limit?: number;
  },
): string[] {
  const limit = Math.max(1, input.limit ?? CATCHMENT_TARGET_COUNT);
  const seen = new Set<string>();
  const unique: Array<{ name: string; weight: number; distanceKm: number | null }> = [];

  const push = (rawName: string, extra?: { types?: string[]; distanceKm?: number | null; populationWeight?: number }) => {
    const collapsed = collapseFacilityNameToLocality(rawName);
    if (!collapsed || isMicroEntityOrPoiName(collapsed)) return;
    if (extra?.types && !isGeographicGooglePlaceType(extra.types)) return;
    if (!isWithinOperationalCatchmentRadius(extra?.distanceKm ?? null)) return;
    const key = areaKey(collapsed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push({
      name: collapsed,
      weight: extra?.populationWeight || populationWeightForArea(collapsed),
      distanceKm: extra?.distanceKm ?? null,
    });
  };

  for (const row of input.names || []) {
    if (typeof row === "string") {
      push(row);
      continue;
    }
    push(row.name, row);
  }

  if (isBarnsleyYorkshireCatchment(input)) {
    return [...BARNSLEY_PRODUCTION_CATCHMENT]
      .sort((a, b) => populationWeightForArea(b) - populationWeightForArea(a) || a.localeCompare(b))
      .slice(0, limit);
  }

  unique.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.name.localeCompare(b.name);
  });

  return unique.slice(0, limit).map((row) => row.name);
}
