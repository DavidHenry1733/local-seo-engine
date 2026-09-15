/**
 * Versioned UK local-page content contract.
 * Connects one content-role set to the existing evidence planner and V3 AI writer.
 * Tenant- and area-independent. Allestree is the first acceptance case, not a hard-coded generator.
 */
import path from "node:path";
import { haversineKm } from "../masterAdminLocalCoverageGeoService.ts";
import { DATAFORSEO_SERP_ENDPOINT } from "../dataForSeoNationalSearchAdapter.ts";
import {
  buildDisambiguatedEvidenceQuery,
  finitePoint,
  type GeographicEvidenceContext,
} from "./pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
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
}): UkLocalPageDistancePlan {
  const pharmacy = finitePoint(opts.pharmacyCoordinates);
  const area = finitePoint(opts.areaCentroid);
  const postalAddressVerified = !premisesAddressLooksUnverified(opts.displayAddress || "");
  const blockDemoOrigin = demoPostalMustNotBeOrigin(opts.slug, opts.postcode, opts.displayAddress);
  const missingPremisesCoordinates = !pharmacy;
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
      detail: `Canonical pharmacy coordinates are missing for ${opts.areaName}. Straight-line distance cannot be calculated.`,
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
      detail: `No recorded area reference point for ${opts.areaName}. Distance stays unstated until a locality reference is retrieved. Do not substitute the pharmacy postal address.`,
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
    detail: `Approximate straight-line distance from the recorded ${opts.areaName} reference point to canonical pharmacy coordinates is ${distanceKm} km. Not travel distance.`,
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
      heroIntroduction: "service-led-introduction",
      localIntroduction: "recognisable-local-context",
      localContextParagraphs: "recognisable-local-context",
      relationshipToPharmacy: "location-and-access",
      localAccessIntroduction: "location-and-access",
      localFaqs: "optional-local-questions",
      clinicalSections: "renderer-owned-not-ai-fields",
    },
    roles: {
      "service-led-introduction":
        "Use the selected local audience and the allowed Pharmacy First sentence only. Lead with Pharmacy First can help with eligible common conditions, not convenience, delay, evaluative claims, eligibility or geographic access.",
      "recognisable-local-context":
        "Select two or three useful, sourced details and weave them into connected prose. Keep named organisations, boards or groups from the supplied statements. Do not force a minimum when evidence is insufficient. No landmark inventory, invented resident habits, invented local character, empty community labels or generic filler. Do not locate the pharmacy at the premises locality in this role; that belongs to location-and-access. A sourced fact that the selected area sits in a parent town may still name that town.",
      "local-primary-care":
        "Use up to three verified GP practices in or around the area. Verify identity, address and official source. Do not imply patient registration, referrals or partnerships. Use nearest only with a defined origin and defensible comparison; otherwise use accurate non-ranking wording. Do not invent practices or force names into unsuitable sections.",
      "location-and-access":
        "Identify the actual consultation premises and verified contact step. Name the premises locality here so the reader knows where consultations take place. If a recorded area reference point and canonical pharmacy coordinates exist, state the approximate straight-line distance once in a separate sentence that names the pharmacy, the selected area and the kilometre figure. Label it as approximate straight-line, not travel. Do not mention coordinates or a recorded area reference point in the sentence. No inferred routes, journey times, parking or availability.",
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
