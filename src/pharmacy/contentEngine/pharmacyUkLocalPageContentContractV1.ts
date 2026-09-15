/**
 * Versioned UK local-page content contract.
 * Connects one content-role set to the existing evidence planner and V3 AI writer.
 * Tenant- and area-independent. Allestree is the first acceptance case, not a hard-coded generator.
 */
import path from "node:path";
import { haversineKm } from "../masterAdminLocalCoverageGeoService.ts";
import { DATAFORSEO_SERP_ENDPOINT } from "../dataForSeoNationalSearchAdapter.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
import {
  addressContainsRequestedLocality,
  buildDisambiguatedEvidenceQuery,
  finitePoint,
  parseEvidenceGeography,
  regionCodeFromContext,
  wordBoundaryIncludes,
  type AddressComponentLike,
  type GeographicEvidenceContext,
} from "./pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { FIELD_OWNERSHIP } from "./pharmacyContentGenerationFieldPolicyV1.ts";
import type { SupportedLocalEvidenceCategory } from "./pharmacyLocalEvidencePackContractV1.ts";

export const UK_LOCAL_PAGE_CONTENT_CONTRACT_ID = "pharmacy-uk-local-page-content-v1";
export const UK_LOCAL_PAGE_CONTENT_CONTRACT_VERSION = "v1";
export const UK_LOCAL_PAGE_CONTENT_CONTRACT_PATH =
  "src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts";
export const UK_LOCAL_PAGE_CONTENT_CONTRACT_ARTIFACT =
  "data/pharmacy-uk-local-page-content-contracts/v1/uk-local-page-content-contract.json";

export const GOOGLE_PLACES_SEARCH_TEXT_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
export const GOOGLE_PLACES_SEARCH_TEXT_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.types,places.location,places.googleMapsUri,places.addressComponents";

/** Public Google Maps Platform list price for Text Search Pro (SKU 4FDA-34B1-A910), first paid band. */
export const PLACES_TEXT_SEARCH_PRO_LIST_USD = 0.032;
export const PLACES_TEXT_SEARCH_PRO_FREE_MONTHLY_CAP = 5000;
export const DATAFORSEO_ORGANIC_LIVE_ADVANCED_RECORDED_USD = 0.002;
export const PAGE_RETRIEVAL_USD = 0;

export const UK_LOCAL_PAGE_CONTENT_ROLES = [
  "service-led-introduction",
  "recognisable-local-context",
  "local-primary-care",
  "location-and-access",
  "clinical-sections",
  "optional-local-questions",
] as const;

export type UkLocalPageContentRole = (typeof UK_LOCAL_PAGE_CONTENT_ROLES)[number];

export type UkLocalPagePlacesSearchSpec = {
  id: string;
  category: SupportedLocalEvidenceCategory;
  phrase: string;
  maxResultCount: number;
  contentRole: UkLocalPageContentRole;
  required: boolean;
  storeAsPackEntities: boolean;
};

export type UkLocalPageEditorialSearchSpec = {
  topic: string;
  query: string;
  contentRole: UkLocalPageContentRole;
  required: boolean;
};

export type UkLocalPageSourceFieldMapping = {
  contentRole: UkLocalPageContentRole;
  required: boolean;
  adapters: string[];
  storedFields: string[];
  notes: string;
};

export const UK_LOCAL_PAGE_SOURCE_FIELD_MAPPING: UkLocalPageSourceFieldMapping[] = [
  {
    contentRole: "service-led-introduction",
    required: true,
    adapters: ["canonical-pharmacy-profile", "approved-service-bank"],
    storedFields: [
      "pharmacyName",
      "displayAddress",
      "phone",
      "website",
      "latitude",
      "longitude",
      "offer.serviceName",
      "offer.serviceId",
    ],
    notes: "Lead with the reader’s need and approved Pharmacy First information. Use the selected local audience and the pharmacy’s actual premises. No paid search.",
  },
  {
    contentRole: "recognisable-local-context",
    required: false,
    adapters: ["dataforseo-google-organic-live-advanced", "safe-html-fetch"],
    storedFields: [
      "editorial.searches.query",
      "editorial.retrievedPages.publisher",
      "editorial.retrievedPages.url",
      "editorial.retrievedPages.textSample",
      "editorial.retrievedPages.retrievedAt",
      "editorial.geographicContext",
      "editorial.facts.normalizedStatement",
      "editorial.facts.sourceClass",
      "editorial.facts.permittedCopyRole",
    ],
    notes: "One targeted official-locality search and retrieved page bodies. Select two or three useful sourced details when they exist. Do not force a minimum. Places names/categories and search snippets are not descriptive evidence. Extra category searches are not proposed when this role is thin.",
  },
  {
    contentRole: "local-primary-care",
    required: true,
    adapters: ["google-places-search-text", "dataforseo-google-organic-live-advanced", "safe-html-fetch"],
    storedFields: [
      "localPack.healthcare.name",
      "localPack.healthcare.address",
      "localPack.healthcare.placeId",
      "localPack.healthcare.sourceRef",
      "localPack.healthcare.retrievedAt",
      "editorial.retrievedPages.publisher",
      "editorial.retrievedPages.url",
      "editorial.retrievedPages.textSample",
      "editorial.facts.normalizedStatement",
    ],
    notes: "Research up to three relevant GP practices in or around the area. Verify identity, address and official source from retrieved page bodies. Do not imply registration, referrals or partnerships. Do not invent practices.",
  },
  {
    contentRole: "location-and-access",
    required: true,
    adapters: ["canonical-pharmacy-profile", "haversine-local-computation", "google-places-search-text"],
    storedFields: [
      "pharmacyCoordinates.latitude",
      "pharmacyCoordinates.longitude",
      "pharmacyCoordinates.source",
      "areaCentroid",
      "distanceKm",
      "distanceMethod",
      "phone",
    ],
    notes: "Actual consultation premises and verified contact from the canonical profile. Approximate straight-line distance from a recorded area reference point to canonical pharmacy coordinates. Label the basis and state the distance once. No routes, journey times, parking or availability. If the area reference is missing, one locality Places search is required; the postal address must not be used as a substitute origin.",
  },
  {
    contentRole: "clinical-sections",
    required: true,
    adapters: ["approved-renderer-owned-clinical-bank"],
    storedFields: [
      "PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.conditionSet",
      "PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.suitability",
      "PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.process",
      "PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.safety",
    ],
    notes: "Preserve existing approved renderer-owned clinical content. The AI must not be required to repeat it in supplemental fields.",
  },
  {
    contentRole: "optional-local-questions",
    required: false,
    adapters: ["editorial-facts"],
    storedFields: ["editorial.facts.permittedCopyRole", "copy.localFaqs"],
    notes: "Include only useful, supported questions not answered elsewhere. Omission must not produce fallback filler or empty sections. No extra paid search.",
  },
];

export const UK_LOCAL_PAGE_EVIDENCE_QUALITY_RULES = [
  "Places names and categories alone are not descriptive evidence.",
  "Search snippets alone must not establish factual support.",
  "Record publisher, URL, retrieved body, retrieval date, geographic attribution and supported facts.",
  "Distinguish historical information from current information.",
  "Omit uncertain statistics.",
  "Do not collect organisations simply to increase evidence volume.",
  "Missing optional facts must not force unnecessary paid searches.",
  "Ambiguous geography or missing premises coordinates must be explicit.",
];

export const UK_LOCAL_PAGE_COST_BASIS = {
  googlePlaces: {
    endpoint: GOOGLE_PLACES_SEARCH_TEXT_ENDPOINT,
    fieldMask: GOOGLE_PLACES_SEARCH_TEXT_FIELD_MASK,
    sku: "Places API Text Search Pro",
    skuId: "4FDA-34B1-A910",
    publicListUsdPerRequest: PLACES_TEXT_SEARCH_PRO_LIST_USD,
    monthlyFreeCap: PLACES_TEXT_SEARCH_PRO_FREE_MONTHLY_CAP,
    remainingFreeQuota: "unverified",
    verification:
      "Public Google Maps Platform pricing list plus the configured searchText field mask (displayName, formattedAddress, types, location, addressComponents, googleMapsUri are Pro fields). No billing API or test call was made.",
    uncertainty:
      "This project’s remaining monthly free Pro quota and the SKU actually billed in Google Cloud are unverified. List price $0.032 applies only after the 5,000 monthly free Pro requests, if that cap still applies to this project.",
  },
  dataForSeo: {
    endpoint: DATAFORSEO_SERP_ENDPOINT,
    recordedLiveUsdPerSearch: DATAFORSEO_ORGANIC_LIVE_ADVANCED_RECORDED_USD,
    verification:
      "This project’s stored live Google Organic Live Advanced task costs on the configured endpoint are $0.002 (see Yorkshire editorial packs). No new DataForSEO call was made.",
    uncertainty:
      "Current public DataForSEO list price was not independently fetched in this task. The estimate uses recorded live costs for the configured endpoint and depth.",
  },
  pageRetrieval: {
    adapter: "safe-html-fetch",
    usd: PAGE_RETRIEVAL_USD,
    verification: "Not a paid search API.",
  },
  distance: {
    adapter: "haversine-local-computation",
    usd: 0,
    verification: "Local straight-line calculation. Not a provider call.",
  },
};

export function ukLocalPageContentContractArtifactPath(): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, UK_LOCAL_PAGE_CONTENT_CONTRACT_ARTIFACT);
}

export function premisesAddressLooksUnverified(address: string): boolean {
  return /demonstration listing|postal address not verified|not a live pharmacy/i.test(String(address || ""));
}

export function demoPostalMustNotBeOrigin(slug: string, postcode = "", displayAddress = ""): boolean {
  if (slug === "brook-pharmacy-demo-derby") return true;
  if (/^DA5\b/i.test(String(postcode || "").trim())) return true;
  return premisesAddressLooksUnverified(displayAddress);
}

export function ukLocalPagePlacesSearchSpecs(
  geo: GeographicEvidenceContext,
): UkLocalPagePlacesSearchSpec[] {
  const specs: UkLocalPagePlacesSearchSpec[] = [
    {
      id: "places-gp-practices",
      category: "healthcare",
      phrase: "NHS GP surgery medical practice",
      maxResultCount: 5,
      contentRole: "local-primary-care",
      required: true,
      storeAsPackEntities: true,
    },
    {
      id: "places-hospitals",
      category: "healthcare",
      phrase: "NHS hospital health centre",
      maxResultCount: 3,
      contentRole: "recognisable-local-context",
      required: false,
      storeAsPackEntities: true,
    },
    {
      id: "places-landmarks",
      category: "landmarks",
      phrase: "parks landmarks memorial",
      maxResultCount: 3,
      contentRole: "recognisable-local-context",
      required: false,
      storeAsPackEntities: true,
    },
    {
      id: "places-community",
      category: "community",
      phrase: "libraries community centres leisure centres",
      maxResultCount: 3,
      contentRole: "recognisable-local-context",
      required: false,
      storeAsPackEntities: true,
    },
  ];
  if (!finitePoint(geo.areaCentroid || null)) {
    specs.push({
      id: "places-area-reference",
      category: "community",
      phrase: `${geo.areaName} locality`,
      maxResultCount: 3,
      contentRole: "location-and-access",
      required: true,
      storeAsPackEntities: false,
    });
  }
  return specs;
}

/** Focused area, county/administrative region and country. Pharmacy city is never asserted as a parent locality. */
export function buildUkLocalPageAreaReferenceQuery(geo: GeographicEvidenceContext): string {
  const area = String(geo.areaName || "").trim();
  const county = String(geo.county || "").trim();
  const country =
    geo.countryCode === "GB" || /united kingdom|\buk\b/i.test(String(geo.country || ""))
      ? "UK"
      : String(geo.country || geo.countryCode || "").trim();
  return [area ? `${area} locality` : "locality", county, country].filter(Boolean).join(", ");
}

export type UkLocalPageAreaReferenceProviderRequest = {
  provider: "google-places";
  endpoint: typeof GOOGLE_PLACES_SEARCH_TEXT_ENDPOINT;
  textQuery: string;
  regionCode?: string;
  maxResultCount: number;
  locationBias: null;
  areaName: string;
  areaSlug: string;
};

/** Selected area determines the Places area-reference request. Pharmacy/sibling coordinates are not a bias. */
export function buildUkLocalPageAreaReferenceProviderRequest(
  geo: GeographicEvidenceContext,
): UkLocalPageAreaReferenceProviderRequest {
  const areaName = String(geo.areaName || "").trim();
  const areaSlug = String(geo.areaSlug || "").trim();
  return {
    provider: "google-places",
    endpoint: GOOGLE_PLACES_SEARCH_TEXT_ENDPOINT,
    textQuery: buildUkLocalPageAreaReferenceQuery(geo),
    regionCode: regionCodeFromContext(geo),
    maxResultCount: 3,
    locationBias: null,
    areaName,
    areaSlug,
  };
}

const AREA_REFERENCE_LOCALITY_TYPES = new Set([
  "locality",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "neighborhood",
  "colloquial_area",
  "postal_town",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
]);

const AREA_REFERENCE_ORGANISATION_TYPES = new Set([
  "doctor",
  "hospital",
  "health",
  "medical_clinic",
  "medical_center",
  "pharmacy",
  "drugstore",
  "school",
  "primary_school",
  "secondary_school",
  "university",
  "store",
  "supermarket",
  "shopping_mall",
  "point_of_interest",
  "establishment",
]);

export type PlacesAreaReferenceHit = {
  name?: string;
  address?: string;
  locality?: string;
  types?: string[];
  location?: unknown;
  placeId?: string;
  addressComponents?: AddressComponentLike[];
};

export type PlacesAreaReferenceResolution =
  | {
      ok: true;
      latitude: number;
      longitude: number;
      source: "places-area-reference";
      name: string;
      address: string;
      placeId: string;
      types: string[];
    }
  | { ok: false; reason: "zero-results" | "unsupported" | "wrong-area" | "ambiguous"; detail: string };

export function parsePlacesProviderCoordinates(value: unknown): { latitude: number; longitude: number } | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  return finitePoint(rec) || finitePoint((rec.latLng || rec.latlng || rec.location) as { latitude?: unknown; longitude?: unknown } | null);
}

function hitTypes(hit: PlacesAreaReferenceHit): string[] {
  return (hit.types || []).map((row) => String(row || "").toLowerCase()).filter(Boolean);
}

function hitLooksLikeOrganisation(hit: PlacesAreaReferenceHit): boolean {
  const types = hitTypes(hit);
  if (types.some((row) => AREA_REFERENCE_LOCALITY_TYPES.has(row))) return false;
  return types.some((row) => AREA_REFERENCE_ORGANISATION_TYPES.has(row));
}

function hitLooksLikeGeographicArea(hit: PlacesAreaReferenceHit): boolean {
  const types = hitTypes(hit);
  if (hitLooksLikeOrganisation(hit)) return false;
  if (types.some((row) => AREA_REFERENCE_LOCALITY_TYPES.has(row))) return true;
  const name = String(hit.name || "").trim();
  return Boolean(name) && types.includes("political");
}

function administrativeGeographyIdentifiesCounty(
  hit: PlacesAreaReferenceHit,
  parsed: ReturnType<typeof parseEvidenceGeography>,
  county: string,
  pharmacyCityHint = "",
): boolean {
  const wanted = String(county || "").trim();
  if (!wanted) return true;
  const admin = String(parsed.adminArea || "").trim();
  if (!admin) return true;
  if (wordBoundaryIncludes(admin, wanted) || wordBoundaryIncludes(wanted, admin)) return true;
  const hay = [hit.address, parsed.postalTown, parsed.locality].filter(Boolean).join(", ");
  if (wordBoundaryIncludes(hay, wanted)) return true;
  const hint = String(pharmacyCityHint || "").trim();
  if (!hint) return false;
  return (
    wordBoundaryIncludes(admin, hint) ||
    wordBoundaryIncludes(hint, admin) ||
    wordBoundaryIncludes(String(parsed.postalTown || ""), hint)
  );
}

function hitIdentifiesFocusedArea(
  hit: PlacesAreaReferenceHit,
  opts: {
    areaName: string;
    county: string;
    countryCode: string;
    siblingAreaNames: string[];
    pharmacyCityHint?: string;
  },
): "match" | "wrong-area" | "unsupported" {
  if (!hitLooksLikeGeographicArea(hit)) return "unsupported";
  const point = parsePlacesProviderCoordinates(hit.location);
  if (!point) return "unsupported";
  const areaName = String(opts.areaName || "").trim();
  if (!areaName) return "unsupported";
  const parsed = parseEvidenceGeography({
    address: hit.address,
    locality: hit.locality,
    addressComponents: hit.addressComponents,
  });
  const name = String(hit.name || "").trim();
  const hay = [name, hit.address, hit.locality, parsed.locality, parsed.postalTown, parsed.adminArea]
    .filter(Boolean)
    .join(", ");
  const nameIsArea = name.toLowerCase() === areaName.toLowerCase();
  const areaInLocality =
    wordBoundaryIncludes(parsed.locality, areaName) ||
    wordBoundaryIncludes(parsed.postalTown, areaName) ||
    wordBoundaryIncludes(parsed.adminArea, areaName) ||
    addressContainsRequestedLocality(String(hit.address || ""), areaName) ||
    wordBoundaryIncludes(hay, areaName);
  if (!nameIsArea && !areaInLocality) return "wrong-area";
  for (const sibling of opts.siblingAreaNames || []) {
    const other = String(sibling || "").trim();
    if (!other || other.toLowerCase() === areaName.toLowerCase()) continue;
    if (name.toLowerCase() === other.toLowerCase()) return "wrong-area";
  }
  if (!administrativeGeographyIdentifiesCounty(hit, parsed, opts.county, opts.pharmacyCityHint)) return "wrong-area";
  const countryCode = String(opts.countryCode || "").trim().toUpperCase();
  if (countryCode && parsed.countryCode && parsed.countryCode !== countryCode) return "wrong-area";
  if (countryCode === "GB" && parsed.countryCode && parsed.countryCode !== "GB") return "wrong-area";
  return "match";
}

export function resolveUkLocalPagePlacesAreaReference(opts: {
  areaName: string;
  county?: string;
  administrativeRegion?: string;
  countryCode?: string;
  siblingAreaNames?: string[];
  /** Optional pharmacy-city hint only. Never required and never asserted as a parent locality. */
  pharmacyCityHint?: string;
  parentTown?: string;
  hits: PlacesAreaReferenceHit[] | null | undefined;
}): PlacesAreaReferenceResolution {
  const hits = Array.isArray(opts.hits) ? opts.hits : [];
  if (!hits.length) {
    return {
      ok: false,
      reason: "zero-results",
      detail: `No Places area-reference results were stored for ${opts.areaName}.`,
    };
  }
  const classified = hits.map((hit) => ({
    hit,
    verdict: hitIdentifiesFocusedArea(hit, {
      areaName: opts.areaName,
      county: String(opts.county || opts.administrativeRegion || ""),
      countryCode: String(opts.countryCode || ""),
      siblingAreaNames: opts.siblingAreaNames || [],
      pharmacyCityHint: String(opts.pharmacyCityHint || opts.parentTown || ""),
    }),
  }));
  const matches = classified.filter((row) => row.verdict === "match");
  if (!matches.length) {
    if (classified.some((row) => row.verdict === "wrong-area")) {
      return {
        ok: false,
        reason: "wrong-area",
        detail: `Places area-reference results did not clearly identify ${opts.areaName}. Wrong-area hits were rejected.`,
      };
    }
    return {
      ok: false,
      reason: "unsupported",
      detail: `Places area-reference results for ${opts.areaName} were organisations or lacked usable locality coordinates.`,
    };
  }
  const points = matches
    .map((row) => ({ row, point: parsePlacesProviderCoordinates(row.hit.location) }))
    .filter((row): row is { row: (typeof matches)[number]; point: { latitude: number; longitude: number } } => Boolean(row.point));
  if (points.length < 2) {
    const chosen = points[0];
    if (!chosen) {
      return {
        ok: false,
        reason: "unsupported",
        detail: `Places area-reference results for ${opts.areaName} lacked provider-supplied coordinates.`,
      };
    }
    return {
      ok: true,
      latitude: chosen.point.latitude,
      longitude: chosen.point.longitude,
      source: "places-area-reference",
      name: String(chosen.row.hit.name || opts.areaName),
      address: String(chosen.row.hit.address || ""),
      placeId: String(chosen.row.hit.placeId || ""),
      types: hitTypes(chosen.row.hit),
    };
  }
  const origin = points[0].point;
  const spread = points.some(
    (row) => Math.abs(row.point.latitude - origin.latitude) > 1e-4 || Math.abs(row.point.longitude - origin.longitude) > 1e-4,
  );
  if (spread) {
    return {
      ok: false,
      reason: "ambiguous",
      detail: `Places returned more than one ${opts.areaName} locality point. The area reference stays unstated.`,
    };
  }
  const chosen = points[0];
  return {
    ok: true,
    latitude: chosen.point.latitude,
    longitude: chosen.point.longitude,
    source: "places-area-reference",
    name: String(chosen.row.hit.name || opts.areaName),
    address: String(chosen.row.hit.address || ""),
    placeId: String(chosen.row.hit.placeId || ""),
    types: hitTypes(chosen.row.hit),
  };
}

export function buildUkLocalPageEditorialSearchQueries(
  geo: GeographicEvidenceContext,
): UkLocalPageEditorialSearchSpec[] {
  return [
    {
      topic: "official-gp-practices",
      query: buildDisambiguatedEvidenceQuery("NHS GP surgery practice official", geo),
      contentRole: "local-primary-care",
      required: true,
    },
    {
      topic: "descriptive-locality",
      query: buildDisambiguatedEvidenceQuery("official council parish ward community information", geo),
      contentRole: "recognisable-local-context",
      required: true,
    },
    {
      topic: "official-community",
      query: buildDisambiguatedEvidenceQuery("official council park library leisure community", geo),
      contentRole: "recognisable-local-context",
      required: false,
    },
    {
      topic: "official-healthcare",
      query: buildDisambiguatedEvidenceQuery("NHS hospital health centre official", geo),
      contentRole: "recognisable-local-context",
      required: false,
    },
  ];
}

export type UkLocalPageDistancePlan = {
  contentRole: "location-and-access";
  method: "haversine-straight-line";
  pharmacyCoordinates: { latitude: number; longitude: number; source: string } | null;
  areaReferencePoint: { latitude: number; longitude: number; source: string } | null;
  areaReferenceStatus: "recorded" | "missing";
  distanceKm: number | null;
  postalAddressVerified: boolean;
  demoPostalMustNotBeOrigin: boolean;
  originWarning: string | null;
  missingPremisesCoordinates: boolean;
  ambiguousGeography: boolean;
  detail: string;
};

export function planUkLocalPageStraightLineDistance(opts: {
  slug: string;
  areaName: string;
  pharmacyCoordinates: { latitude: number; longitude: number; source?: string } | null;
  areaCentroid: { latitude: number; longitude: number; source?: string } | null;
  displayAddress?: string;
  postcode?: string;
  queryPlaceLabel?: string;
  pharmacyName?: string;
}): UkLocalPageDistancePlan {
  const pharmacy = finitePoint(opts.pharmacyCoordinates);
  const area = finitePoint(opts.areaCentroid);
  const postalAddressVerified = !premisesAddressLooksUnverified(opts.displayAddress || "");
  const blockDemoOrigin = demoPostalMustNotBeOrigin(opts.slug, opts.postcode, opts.displayAddress);
  const missingPremisesCoordinates = !pharmacy;
  const pharmacyLabel = String(opts.pharmacyName || "").trim() || "the pharmacy";
  const originWarning = blockDemoOrigin
    ? "Displayed demo postal address and inconsistent DA5 postcode must not be used as the distance origin or marked verified. Use canonical pharmacy map/Google coordinates."
    : null;
  if (missingPremisesCoordinates) {
    return {
      contentRole: "location-and-access",
      method: "haversine-straight-line",
      pharmacyCoordinates: null,
      areaReferencePoint: area ? { ...area, source: opts.areaCentroid?.source || "recorded-area-reference" } : null,
      areaReferenceStatus: area ? "recorded" : "missing",
      distanceKm: null,
      postalAddressVerified,
      demoPostalMustNotBeOrigin: blockDemoOrigin,
      originWarning,
      missingPremisesCoordinates: true,
      ambiguousGeography: !area,
      detail: `Canonical pharmacy coordinates are missing for ${opts.areaName}. Approximate straight-line (haversine) distance from ${pharmacyLabel} to ${opts.areaName} cannot be calculated.`,
    };
  }
  if (!area) {
    return {
      contentRole: "location-and-access",
      method: "haversine-straight-line",
      pharmacyCoordinates: {
        latitude: pharmacy.latitude,
        longitude: pharmacy.longitude,
        source: opts.pharmacyCoordinates?.source || "canonical-pharmacy-coordinates",
      },
      areaReferencePoint: null,
      areaReferenceStatus: "missing",
      distanceKm: null,
      postalAddressVerified,
      demoPostalMustNotBeOrigin: blockDemoOrigin,
      originWarning,
      missingPremisesCoordinates: false,
      ambiguousGeography: true,
      detail: `No recorded area reference point for ${opts.areaName}. Approximate straight-line (haversine) distance from ${pharmacyLabel} to ${opts.areaName} stays unstated until a verified locality reference is retrieved. Do not substitute the pharmacy postal address.`,
    };
  }
  const distanceKm = Number(haversineKm(area, pharmacy).toFixed(1));
  return {
    contentRole: "location-and-access",
    method: "haversine-straight-line",
    pharmacyCoordinates: {
      latitude: pharmacy.latitude,
      longitude: pharmacy.longitude,
      source: opts.pharmacyCoordinates?.source || "canonical-pharmacy-coordinates",
    },
    areaReferencePoint: { ...area, source: opts.areaCentroid?.source || "recorded-area-reference" },
    areaReferenceStatus: "recorded",
    distanceKm,
    postalAddressVerified,
    demoPostalMustNotBeOrigin: blockDemoOrigin,
    originWarning,
    missingPremisesCoordinates: false,
    ambiguousGeography: false,
    detail: `Approximate straight-line distance from ${pharmacyLabel} to ${opts.areaName} is ${distanceKm} km. Method: haversine straight-line. Not travel distance.`,
  };
}

export function buildUkLocalPageWriterContractPayload(opts: {
  areaName: string;
  addressVerified: boolean;
  distancePlan?: Pick<UkLocalPageDistancePlan, "method" | "areaReferenceStatus" | "distanceKm"> | null;
}): Record<string, unknown> {
  return {
    contentContractId: UK_LOCAL_PAGE_CONTENT_CONTRACT_ID,
    contentContractVersion: UK_LOCAL_PAGE_CONTENT_CONTRACT_VERSION,
    layoutVariantsAllowed: true,
    identicalProseNotRequired: true,
    sectionRoles: {
      heroIntroduction: FIELD_OWNERSHIP.DETERMINISTIC,
      localIntroduction: FIELD_OWNERSHIP.EVIDENCE_BOUND,
      localContextParagraphs: FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND,
      relationshipToPharmacy: FIELD_OWNERSHIP.DETERMINISTIC,
      localAccessIntroduction: FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND,
      localFaqs: FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND,
      clinicalSections: FIELD_OWNERSHIP.RENDERER_OWNED,
    },
    roles: {
      "service-led-introduction":
        "Deterministic. Combine the approved service introductory meaning with the canonical selected-area name. OpenAI must not compose or paraphrase this field.",
      "recognisable-local-context":
        "Evidence-bound local introduction in localIntroduction. Write 150–250 words of fluent British English from this area’s verified facts, following the assigned reusable writing structure. Use only facts supplied in that area’s validated evidence pack and confirmed pharmacy-profile facts. Keep named organisations, boards or groups. Do not invent resident habits, local character, empty community labels, convenience, availability, travel or local relationships. Cite each local factual sentence’s supplied factId internally for validation; never show identifiers to customers. Never write evidence-listing language such as “orient yourself”, “is listed as”, “is recorded as”, “named on the provider page”, or “recorded healthcare setting”. Do not locate the pharmacy at the premises locality in this role; that belongs to location-and-access. Do not infer that the selected area is part of a parent town unless a verified editorial fact statement says so. localContextParagraphs may be omitted when localIntroduction already holds the locally informed account.",
      "local-primary-care":
        "Use up to three verified GP practices in or around the area. Verify identity, address and official source. Do not imply patient registration, referrals or partnerships. Use nearest only with a defined origin and defensible comparison; otherwise use accurate non-ranking wording. Do not invent practices or force names into unsuitable sections.",
      "location-and-access":
        "Deterministic for relationshipToPharmacy. relationshipToPharmacy uses the confirmed pharmacy name, confirmed premises locality, selected-area name, saved approximate distance and straight-line method. Omit any unavailable value rather than infer it. Never infer travel time, route, access, convenience or availability. OpenAI must not compose or paraphrase this field. localIntroduction is not this role: it is the evidence-bound locally informed account.",
      "clinical-sections":
        "Preserve existing approved renderer-owned clinical content. Do not repeat it in supplemental fields.",
      "optional-local-questions":
        "Include only useful, supported questions not answered elsewhere. Omission must not produce fallback filler or empty sections.",
    },
    premises: {
      addressVerified: opts.addressVerified,
      doNotMarkUnverifiedPostalAddressVerified: true,
    },
    distance: {
      method: opts.distancePlan?.method || "haversine-straight-line",
      areaReferenceStatus: opts.distancePlan?.areaReferenceStatus || "missing",
      distanceKm: opts.distancePlan?.distanceKm ?? null,
      stateOnce: true,
      labelBasis: true,
    },
    clinicalBoundary:
      "Clinical eligibility, suitability, process, safety, geographic access and the condition list stay with the renderer. AI fields write local content only. Waiting, delay, and alternative-to-GP claims are not in the locked clinical facts.",
    gpBoundary:
      "Do not imply the pharmacy registers patients, receives GP referrals, or has a partnership with named practices.",
  };
}

export function discoverableUkLocalPageContentContract(): Record<string, unknown> {
  return {
    contractId: UK_LOCAL_PAGE_CONTENT_CONTRACT_ID,
    version: UK_LOCAL_PAGE_CONTENT_CONTRACT_VERSION,
    sourcePath: UK_LOCAL_PAGE_CONTENT_CONTRACT_PATH,
    artifactPath: UK_LOCAL_PAGE_CONTENT_CONTRACT_ARTIFACT,
    roles: [...UK_LOCAL_PAGE_CONTENT_ROLES],
    sourceToFieldMapping: UK_LOCAL_PAGE_SOURCE_FIELD_MAPPING,
    evidenceQualityRules: UK_LOCAL_PAGE_EVIDENCE_QUALITY_RULES,
    costBasis: UK_LOCAL_PAGE_COST_BASIS,
    adapters: {
      places: {
        endpoint: GOOGLE_PLACES_SEARCH_TEXT_ENDPOINT,
        fieldMask: GOOGLE_PLACES_SEARCH_TEXT_FIELD_MASK,
        targetedCategories: ["healthcare GP practices", "area reference point when centroid missing"],
        notUsedUnlessRoleRequires: ["schools", "community inventory", "landmarks", "retail", "transport"],
      },
      dataForSeo: {
        endpoint: DATAFORSEO_SERP_ENDPOINT,
        targetedTopics: ["official-gp-practices", "descriptive-locality"],
      },
      pageBodies: "safe-html-fetch after search; snippets are not facts",
      distance: "haversine between recorded area reference and canonical pharmacy coordinates",
      clinical: "approved renderer-owned bank; not an AI generation field",
    },
  };
}
