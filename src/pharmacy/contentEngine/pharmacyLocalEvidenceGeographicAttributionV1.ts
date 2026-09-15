/**
 * Generic geographic and category attribution for local evidence packs.
 * Resolves parent town / county / country / postcode / centroid from stored pharmacy records.
 * Does not hard-code tenant or area names into acceptance rules.
 */
import fs from "node:fs";
import path from "node:path";
import { haversineKm } from "../masterAdminLocalCoverageGeoService.ts";
import { normalizeProfileData } from "../pharmacyProfileSchema.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
import { slugifyArea } from "../pharmacyAreaNarrativeProfiles.ts";
import type {
  AreaAttributionContext,
  AttributionInput,
  PharmacyEvidenceCoordinates,
  SupportedLocalEvidenceCategory,
} from "./pharmacyLocalEvidencePackContractV1.ts";

/** Max km from an authoritative area centroid for proximity attribution. Must match the pack contract. */
const AREA_CENTROID_ATTRIBUTION_MAX_KM = 3;

export const DISTANT_HOMONYM_DEFAULT_MAX_KM = 20;
export const DISTANT_HOMONYM_ABSOLUTE_MAX_KM = 25;

const SCHOOL_TYPES = new Set(["school", "primary_school", "secondary_school", "university", "preschool"]);
const HEALTHCARE_TYPES = new Set([
  "doctor",
  "hospital",
  "health",
  "medical_clinic",
  "medical_center",
  "physiotherapist",
  "dentist",
]);
const TRANSPORT_TYPES = new Set([
  "train_station",
  "bus_station",
  "transit_station",
  "light_rail_station",
  "subway_station",
  "bus_stop",
]);
const LANDMARK_TYPES = new Set([
  "park",
  "tourist_attraction",
  "museum",
  "historical_landmark",
  "national_park",
  "monument",
  "church",
  "place_of_worship",
  "cemetery",
]);
const RETAIL_TYPES = new Set([
  "shopping_mall",
  "department_store",
  "supermarket",
  "grocery_or_supermarket",
  "shopping_center",
]);
const COMMUNITY_TYPES = new Set([
  "library",
  "community_center",
  "local_government_office",
  "sports_complex",
  "gym",
  "stadium",
  "city_hall",
]);

/** Ceremonial / administrative counties used only to detect a conflicting region, not to accept a named town. */
const UK_COUNTY_NAMES = [
  "bedfordshire", "berkshire", "bristol", "buckinghamshire", "cambridgeshire", "cheshire",
  "cornwall", "cumbria", "derbyshire", "devon", "dorset", "durham", "east riding of yorkshire",
  "east sussex", "essex", "gloucestershire", "greater london", "greater manchester", "hampshire",
  "herefordshire", "hertfordshire", "isle of wight", "kent", "lancashire", "leicestershire",
  "lincolnshire", "merseyside", "norfolk", "north yorkshire", "northamptonshire", "northumberland",
  "nottinghamshire", "oxfordshire", "rutland", "shropshire", "somerset", "south yorkshire",
  "staffordshire", "suffolk", "surrey", "tyne and wear", "warwickshire", "west midlands",
  "west sussex", "west yorkshire", "wiltshire", "worcestershire", "angus", "argyll", "fife",
  "highland", "lanarkshire", "lothian", "strathclyde", "tayside", "clwyd", "dyfed", "gwynedd",
  "powys", "antrim", "armagh", "down", "fermanagh", "londonderry", "tyrone",
];

const CATEGORY_TYPE_SETS: Record<SupportedLocalEvidenceCategory, Set<string>> = {
  healthcare: HEALTHCARE_TYPES,
  schools: SCHOOL_TYPES,
  transport: TRANSPORT_TYPES,
  landmarks: LANDMARK_TYPES,
  retail: RETAIL_TYPES,
  community: COMMUNITY_TYPES,
};

export interface AddressComponentLike {
  longText?: string;
  shortText?: string;
  types?: string[];
}

export interface ParsedEvidenceGeography {
  country: string;
  countryCode: string;
  locality: string;
  postalTown: string;
  adminArea: string;
  postcode: string;
  postcodeDistrict: string;
  postcodeArea: string;
}

export interface GeographicEvidenceContext extends AreaAttributionContext {
  parentTown: string;
  county: string;
  country: string;
  countryCode: string;
  pharmacyPostcode: string;
  pharmacyPostcodeArea: string;
  pharmacyPostcodeDistrict: string;
  pharmacyPostcodeVerified: boolean;
  maxDistanceFromPharmacyKm: number;
  queryPlaceLabel: string;
}

export type CategoryClassification =
  | {
      ok: true;
      category: SupportedLocalEvidenceCategory;
      reason: string;
    }
  | {
      ok: false;
      rejectionReason: string;
      actualCategory?: SupportedLocalEvidenceCategory;
    };

function readJson(file: string): unknown {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function wordBoundaryIncludes(haystack: string, needle: string): boolean {
  const text = String(haystack || "").toLowerCase();
  const area = String(needle || "").trim().toLowerCase();
  if (!text || !area) return false;
  const escaped = area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

export function finitePoint(value: { latitude?: unknown; longitude?: unknown } | null | undefined): {
  latitude: number;
  longitude: number;
} | null {
  const lat = Number(value?.latitude);
  const lng = Number(value?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat, longitude: lng };
}

export function normalizeCountryCode(value: string): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (/^(united kingdom|uk|gb|great britain|england|scotland|wales|northern ireland)$/.test(raw)) return "GB";
  if (/^(united states|united states of america|usa|us|u\.s\.a\.?)$/.test(raw)) return "US";
  if (/^[a-z]{2}$/.test(raw)) return raw.toUpperCase();
  return raw.toUpperCase();
}

export function extractUkPostcode(text: string): string {
  const compact = String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, " ").replace(/\s+/g, " ").trim();
  const spaced = compact.match(/\b([A-Z]{1,2}\d[A-Z\d]?) (\d[A-Z]{2})\b/);
  if (spaced) return `${spaced[1]} ${spaced[2]}`;
  const glued = compact.match(/\b([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})\b/);
  if (glued) return `${glued[1]} ${glued[2]}`;
  const outward = compact.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\b/);
  return outward ? outward[1] : "";
}

export function ukPostcodeDistrict(postcode: string): string {
  const extracted = extractUkPostcode(postcode);
  if (!extracted) return "";
  return extracted.split(" ")[0] || "";
}

export function ukPostcodeArea(postcode: string): string {
  const district = ukPostcodeDistrict(postcode);
  const match = district.match(/^([A-Z]{1,2})/);
  return match ? match[1] : "";
}

function componentValue(components: AddressComponentLike[] | undefined, type: string): string {
  const row = (components || []).find((c) => (c.types || []).includes(type));
  return String(row?.longText || row?.shortText || "").trim();
}

export function parseEvidenceGeography(input: {
  address?: string;
  locality?: string;
  addressComponents?: AddressComponentLike[];
}): ParsedEvidenceGeography {
  const components = input.addressComponents || [];
  const address = String(input.address || "").trim();
  const countryFromComponents = componentValue(components, "country");
  const countryCodeFromComponents = (() => {
    const row = components.find((c) => (c.types || []).includes("country"));
    return String(row?.shortText || "").trim();
  })();
  let country = countryFromComponents;
  let countryCode = normalizeCountryCode(countryCodeFromComponents || countryFromComponents);
  if (!countryCode) {
    if (/\b(united states|usa|u\.s\.a\.?)\b/i.test(address) || /,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(address)) {
      country = "United States";
      countryCode = "US";
    } else if (/\bcanada\b/i.test(address) || /\b(on|bc|ab|qc|ns|nb|mb|sk|pe|nl|nt|yt|nu)\s+[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(address)) {
      country = "Canada";
      countryCode = "CA";
    } else if (/\b(united kingdom|england|scotland|wales|northern ireland)\b/i.test(address) || /,\s*UK\s*$/i.test(address)) {
      country = "United Kingdom";
      countryCode = "GB";
    }
  }
  const postcode = extractUkPostcode(
    componentValue(components, "postal_code") || address,
  );
  return {
    country,
    countryCode,
    locality:
      componentValue(components, "locality")
      || componentValue(components, "sublocality_level_1")
      || componentValue(components, "sublocality")
      || String(input.locality || "").trim(),
    postalTown: componentValue(components, "postal_town"),
    adminArea:
      componentValue(components, "administrative_area_level_2")
      || componentValue(components, "administrative_area_level_1"),
    postcode,
    postcodeDistrict: ukPostcodeDistrict(postcode),
    postcodeArea: ukPostcodeArea(postcode),
  };
}

function detectUkCounty(text: string): string {
  const hay = String(text || "").toLowerCase();
  let found = "";
  for (const county of UK_COUNTY_NAMES) {
    if (wordBoundaryIncludes(hay, county) && county.length > found.length) found = county;
  }
  return found;
}

function countiesCompatible(entityCounty: string, contextCounty: string): boolean {
  const left = entityCounty.trim().toLowerCase();
  const right = contextCounty.trim().toLowerCase();
  if (!left || !right) return true;
  if (left === right) return true;
  if (right.includes(left) || left.includes(right)) return true;
  return false;
}

function countryTokenForQuery(country: string, countryCode: string): string {
  if (countryCode === "GB" || /united kingdom|uk/i.test(country)) return "UK";
  return country || countryCode;
}

export function addressContainsRequestedLocality(address: string, area: string): boolean {
  const areaName = String(area || "").trim();
  if (!areaName) return false;
  const escaped = areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const roadOnly = new RegExp(
    `^(?:\\d+[a-z]?\\s+)?${escaped}\\s+(rd|road|ln|lane|street|st|avenue|ave|way|drive|dr|close|crescent|grove|row|terrace|place|walk)\\.?$`,
    "i",
  );
  const parts = String(address || "").split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    if (!wordBoundaryIncludes(part, areaName)) continue;
    if (roadOnly.test(part)) continue;
    return true;
  }
  return false;
}

export function buildDisambiguatedEvidenceQuery(
  categoryPhrase: string,
  ctx: Pick<GeographicEvidenceContext, "areaName" | "parentTown" | "county" | "country" | "countryCode" | "queryPlaceLabel">,
): string {
  const place = String(ctx.queryPlaceLabel || "").trim() || [
    ctx.areaName,
    ctx.county,
    countryTokenForQuery(ctx.country, ctx.countryCode),
  ].filter(Boolean).join(", ");
  return `${categoryPhrase} in ${place}`;
}

function typesOf(types: string[] = []): string[] {
  return types.map((t) => String(t || "").toLowerCase()).filter(Boolean);
}

function hasType(types: string[], set: Set<string>): boolean {
  return typesOf(types).some((t) => set.has(t));
}

function schoolName(name: string): boolean {
  return /\b(primary school|secondary school|infant school|junior school|academy|high school|grammar school)\b/i.test(name);
}

export function categorySupportedByProviderTypes(
  category: SupportedLocalEvidenceCategory,
  types: string[] = [],
  name = "",
): boolean {
  const lower = typesOf(types);
  if (category === "landmarks" && (hasType(lower, SCHOOL_TYPES) || schoolName(name))) {
    return false;
  }
  if (hasType(lower, CATEGORY_TYPE_SETS[category])) return true;
  if (category === "healthcare" && /\b(surgery|medical centre|health centre|hospital|nhs)\b/i.test(name) && !schoolName(name)) {
    return true;
  }
  if (category === "schools" && schoolName(name)) return true;
  if (category === "transport" && /\b(railway station|train station|bus station|bus stop|interchange)\b/i.test(name)) {
    return true;
  }
  if (category === "community" && /\b(library|community centre|leisure centre|sports centre)\b/i.test(name)) {
    return true;
  }
  if (category === "landmarks" && /\b(memorial|monument|country park|nature reserve|war memorial)\b/i.test(name) && !schoolName(name)) {
    return true;
  }
  if (category === "retail" && /\b(retail park|shopping centre|shopping center|supermarket)\b/i.test(name)) {
    return true;
  }
  return false;
}

export function inferEvidenceCategoryFromTypes(
  types: string[] = [],
  name = "",
): SupportedLocalEvidenceCategory | null {
  const lower = typesOf(types);
  if (hasType(lower, SCHOOL_TYPES) || schoolName(name)) return "schools";
  if (hasType(lower, HEALTHCARE_TYPES) || (/\b(surgery|medical centre|health centre|hospital|nhs)\b/i.test(name) && !schoolName(name))) {
    return "healthcare";
  }
  if (hasType(lower, TRANSPORT_TYPES) || /\b(railway station|train station|bus station|bus stop|interchange)\b/i.test(name)) {
    return "transport";
  }
  if (hasType(lower, RETAIL_TYPES) || /\b(retail park|shopping centre|shopping center|supermarket)\b/i.test(name)) {
    return "retail";
  }
  if (
    (hasType(lower, LANDMARK_TYPES) || /\b(memorial|monument|country park|nature reserve|war memorial)\b/i.test(name))
    && !hasType(lower, SCHOOL_TYPES)
    && !schoolName(name)
  ) {
    return "landmarks";
  }
  if (hasType(lower, COMMUNITY_TYPES) || /\b(library|community centre|leisure centre|sports centre)\b/i.test(name)) {
    return "community";
  }
  return null;
}

export function classifyEvidenceForRequestedCategory(
  requested: SupportedLocalEvidenceCategory,
  types: string[] = [],
  name = "",
): CategoryClassification {
  if (categorySupportedByProviderTypes(requested, types, name)) {
    return { ok: true, category: requested, reason: "provider-types-match-requested-category" };
  }
  const actual = inferEvidenceCategoryFromTypes(types, name);
  if (actual && actual !== requested) {
    return {
      ok: false,
      rejectionReason: `category-mismatch:${actual}-not-${requested}`,
      actualCategory: actual,
    };
  }
  return { ok: false, rejectionReason: `category-mismatch:unsupported-for-${requested}` };
}

export function classifySupportedCategoryFromTypes(
  types: string[] = [],
  name = "",
): SupportedLocalEvidenceCategory {
  return inferEvidenceCategoryFromTypes(types, name) || "community";
}

export function evaluateGeographicCompatibility(
  entity: AttributionInput & { addressComponents?: AddressComponentLike[] },
  ctx: AreaAttributionContext & Partial<GeographicEvidenceContext>,
): { ok: true } | { ok: false; rejectionReason: string } {
  const name = String(entity.name || "").trim();
  const address = String(entity.address || "").trim();
  const hay = `${name} ${address}`;
  const geo = parseEvidenceGeography({
    address,
    locality: entity.locality,
    addressComponents: entity.addressComponents,
  });
  const area = String(ctx.areaName || "").trim();
  const siblings = (ctx.siblingAreaNames || []).filter((s) => s.trim().toLowerCase() !== area.toLowerCase());

  const ctxCountry = normalizeCountryCode(ctx.countryCode || ctx.country || "");
  if (ctxCountry && geo.countryCode && ctxCountry !== geo.countryCode) {
    return { ok: false, rejectionReason: "wrong-country" };
  }

  const ctxCounty = String(ctx.county || "").trim();
  const entityCounty = detectUkCounty(`${address} ${geo.adminArea}`);
  if (ctxCounty && entityCounty && !countiesCompatible(entityCounty, ctxCounty)) {
    return { ok: false, rejectionReason: "wrong-region" };
  }

  const pharmacyArea = String(ctx.pharmacyPostcodeArea || ukPostcodeArea(ctx.pharmacyPostcode || "")).trim();
  const areaNamedOnEntity =
    addressContainsRequestedLocality(address, area) ||
    addressContainsRequestedLocality(geo.locality, area) ||
    wordBoundaryIncludes(geo.locality, area) ||
    Boolean(
      entity.locality && addressContainsRequestedLocality(String(entity.locality), area),
    );
  const pharmacyPostcodeTrusted = ctx.pharmacyPostcodeVerified !== false;
  if (pharmacyArea && geo.postcodeArea && pharmacyArea !== geo.postcodeArea) {
    if (pharmacyPostcodeTrusted && !areaNamedOnEntity) {
      return { ok: false, rejectionReason: "incompatible-postcode" };
    }
  }

  const entityPoint = finitePoint(entity.location || null);
  const pharmacy = finitePoint(ctx.pharmacyCoordinates || null);
  const maxKm = Number(ctx.maxDistanceFromPharmacyKm);
  const distantLimit = Number.isFinite(maxKm) && maxKm > 0
    ? Math.min(maxKm, DISTANT_HOMONYM_ABSOLUTE_MAX_KM)
    : DISTANT_HOMONYM_DEFAULT_MAX_KM;
  let distanceToPharmacy: number | null = null;
  if (entityPoint && pharmacy) {
    distanceToPharmacy = haversineKm(pharmacy, entityPoint);
    if (distanceToPharmacy > distantLimit) {
      return { ok: false, rejectionReason: "distant-homonym" };
    }
  }

  const centroid = finitePoint(ctx.areaCentroid || null);
  if (entityPoint && centroid) {
    const km = haversineKm(centroid, entityPoint);
    if (km > AREA_CENTROID_ATTRIBUTION_MAX_KM && !wordBoundaryIncludes(hay, area)) {
      return { ok: false, rejectionReason: "outside-area-centroid" };
    }
  }

  const areaInName = wordBoundaryIncludes(name, area);
  const areaInAddress = addressContainsRequestedLocality(address, area);
  const areaInLocality = Boolean(entity.locality && addressContainsRequestedLocality(entity.locality, area));
  for (const sibling of siblings) {
    const siblingInName = wordBoundaryIncludes(name, sibling);
    const siblingInAddress = addressContainsRequestedLocality(address, sibling);
    if (siblingInName && !areaInName) {
      return { ok: false, rejectionReason: "attributed-to-sibling-area" };
    }
    if (siblingInAddress && !areaInAddress) {
      return { ok: false, rejectionReason: "attributed-to-sibling-area" };
    }
  }

  const parentTown = String(ctx.parentTown || "").trim();
  const parentInAddress = parentTown ? wordBoundaryIncludes(address, parentTown) : false;
  const countyInAddress = ctxCounty ? wordBoundaryIncludes(address, ctxCounty) : false;
  const postcodeCompatible = Boolean(pharmacyArea && geo.postcodeArea && pharmacyArea === geo.postcodeArea);
  const countryCompatible = Boolean(!ctxCountry || !geo.countryCode || ctxCountry === geo.countryCode);
  const nearPharmacy = distanceToPharmacy != null && distanceToPharmacy <= distantLimit;
  const nearCentroid = Boolean(entityPoint && centroid && haversineKm(centroid, entityPoint) <= AREA_CENTROID_ATTRIBUTION_MAX_KM);

  const hasCorroboration = Boolean(
    postcodeCompatible
    || parentInAddress
    || countyInAddress
    || nearCentroid
    || (nearPharmacy && (areaInAddress || areaInLocality || geo.locality && wordBoundaryIncludes(geo.locality, area)))
    || (countryCompatible && (areaInAddress || areaInLocality) && (postcodeCompatible || parentInAddress || nearPharmacy)),
  );

  if ((areaInName || areaInAddress) && !hasCorroboration && !nearCentroid) {
    if (!address && !entityPoint && !geo.postcode) {
      return { ok: false, rejectionReason: "geographic-ambiguity" };
    }
    if (!postcodeCompatible && !parentInAddress && !countyInAddress && !nearPharmacy && !nearCentroid) {
      return { ok: false, rejectionReason: "geographic-ambiguity" };
    }
  }

  return { ok: true };
}

function loadProfileData(slug: string): ReturnType<typeof normalizeProfileData> | null {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  const doc = readJson(file) as { data?: Record<string, unknown> } | null;
  if (!doc?.data) return null;
  return normalizeProfileData(doc.data);
}

export function resolveAreaCentroidFromProfile(
  slug: string,
  areaName: string,
): { latitude: number; longitude: number } | null {
  const data = loadProfileData(slug);
  if (!data) return null;
  const needle = areaName.trim().toLowerCase();
  const row = (data.selectedAreas || []).find((a) => String(a.areaName || "").trim().toLowerCase() === needle);
  const lat = Number(row?.latitude);
  const lng = Number(row?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { latitude: lat, longitude: lng };
}

export function resolveAreaCentroidFromRecordedReference(
  slug: string,
  areaSlug: string,
): { latitude: number; longitude: number; source: string } | null {
  if (!slug || !areaSlug) return null;
  const file = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-local-page-evidence-area-reference",
    slug,
    `${areaSlug}.json`,
  );
  const doc = readJson(file) as { latitude?: number; longitude?: number; source?: string } | null;
  const lat = Number(doc?.latitude);
  const lng = Number(doc?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return {
    latitude: lat,
    longitude: lng,
    source: String(doc?.source || "recorded-area-reference"),
  };
}

export function resolveGeographicEvidenceContext(input: {
  slug: string;
  areaName: string;
  areaSlug?: string;
  siblingAreaNames: string[];
  pharmacyCoordinates?: PharmacyEvidenceCoordinates | null;
}): GeographicEvidenceContext {
  const data = loadProfileData(input.slug);
  const areaName = input.areaName.trim();
  const parentTown = String(data?.primaryTown || data?.townCity || data?.primaryCity || "").trim();
  const county = String(data?.county || "").trim();
  const country = String(data?.country || "").trim();
  const countryCode = normalizeCountryCode(country);
  const pharmacyPostcode = String(data?.postcode || "").trim();
  const displayAddress = String(data?.displayAddress || data?.customerFacingAddress || data?.fullAddress || "").trim();
  const pharmacyPostcodeDistrict = ukPostcodeDistrict(pharmacyPostcode);
  const pharmacyPostcodeArea = ukPostcodeArea(pharmacyPostcode);
  const pharmacyPostcodeVerified = !/^DA5\b/i.test(pharmacyPostcode) &&
    !/demonstration listing|postal address not verified|not a live pharmacy/i.test(displayAddress);
  const selected = data?.selectedAreas || [];
  const campaignDistances = input.siblingAreaNames
    .map((name) => selected.find((row) => String(row.areaName || "").trim().toLowerCase() === name.trim().toLowerCase()))
    .map((row) => Number(row?.distanceKm))
    .filter((km) => Number.isFinite(km) && km >= 0);
  const maxStored = campaignDistances.length ? Math.max(...campaignDistances) : 0;
  const maxDistanceFromPharmacyKm = maxStored > 0
    ? Math.min(Math.max(maxStored + 6, 12), DISTANT_HOMONYM_ABSOLUTE_MAX_KM)
    : DISTANT_HOMONYM_DEFAULT_MAX_KM;
  const queryPlaceLabel = [
    areaName,
    county,
    countryTokenForQuery(country, countryCode),
  ].filter(Boolean).join(", ");

  return {
    areaName,
    areaSlug: input.areaSlug || slugifyArea(areaName),
    siblingAreaNames: input.siblingAreaNames,
    areaCentroid: resolveAreaCentroidFromProfile(input.slug, areaName),
    pharmacyCoordinates: input.pharmacyCoordinates || null,
    parentTown,
    county,
    country,
    countryCode,
    pharmacyPostcode,
    pharmacyPostcodeArea,
    pharmacyPostcodeDistrict,
    pharmacyPostcodeVerified,
    maxDistanceFromPharmacyKm,
    queryPlaceLabel,
  };
}

export function searchRadiusMeters(ctx: GeographicEvidenceContext): number {
  return Math.round(Math.min(Math.max(ctx.maxDistanceFromPharmacyKm, 12), DISTANT_HOMONYM_ABSOLUTE_MAX_KM) * 1000);
}

export function regionCodeFromContext(ctx: GeographicEvidenceContext): string | undefined {
  if (ctx.countryCode === "GB") return "GB";
  if (/^[A-Z]{2}$/.test(ctx.countryCode)) return ctx.countryCode;
  return undefined;
}
