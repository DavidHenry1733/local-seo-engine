/**
 * Growth Engine — Local Healthcare Intelligence V1 discovery (Google Places only).
 */
import type { HealthcareProviderEntity, HealthcareProviderGroupKey } from "./growthEngineHealthcareModel.ts";
import {
  hasGooglePlacesApiKey,
  missingApiKeyError,
  placesApiFetch,
  type GooglePlacesConnectionError,
} from "./googlePlacesConnection.ts";

/** Same nearby radius as local-coverage Google Places searches (15 km). */
const LOCAL_NETWORK_RADIUS_M = 15_000;

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.types",
  "places.primaryType",
  "places.businessStatus",
  "places.currentOpeningHours",
  "places.googleMapsUri",
].join(",");

export interface DiscoveryContext {
  pharmacyLat: number;
  pharmacyLng: number;
  postcode: string;
  town: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function formatDistance(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function openingStatus(p: Record<string, unknown>): string {
  const current = p.currentOpeningHours as Record<string, unknown> | undefined;
  if (current?.openNow === true) return "Open now";
  if (current?.openNow === false) return "Closed now";
  const status = String(p.businessStatus || "");
  if (status === "OPERATIONAL") return "Operational";
  if (status) return status.replace(/_/g, " ");
  return "";
}

function isPharmacyName(name: string): boolean {
  return /pharmacy|chemist|boots|rowlands|lloyds|superdrug|well pharmacy/i.test(name);
}

function typeTokens(types: string[], primaryType: string): string[] {
  return [...types, primaryType]
    .map((t) => String(t || "").toLowerCase().replace(/_/g, " ").trim())
    .filter(Boolean);
}

function hasTypeToken(tokens: string[], ...needles: string[]): boolean {
  return tokens.some((t) => needles.some((n) => t === n || t.includes(n)));
}

const SPECIALIST_SURGERY_NAME =
  /nail\s+surgery|podiatr|chiropod|oral\s+surgery|dental\s+surgery|cosmetic\s+surgery|plastic\s+surgery|laser\s+surgery|eye\s+surgery|vet(?:erinary)?|orthopaedic\s+surgery/i;

function isEducationOrTrainingFacility(name: string): boolean {
  return /education|training centre|training center|college|teaching centre|teaching center/i.test(name);
}

function isHealthOrMedicalCentreName(name: string): boolean {
  return /health(?:\s+and\s+social)?\s*centr|medical\s*centr/i.test(name);
}

function isStandaloneClinicOrTreatmentName(name: string): boolean {
  if (/\bhospital\b|\binfirmary\b/i.test(name)) return false;
  return (
    /\bclinic\b/i.test(name) ||
    /\btreatments?\b/i.test(name) ||
    /\bhealth suite\b/i.test(name)
  );
}

function looksLikeDentist(name: string, tokens: string[]): boolean {
  return hasTypeToken(tokens, "dentist") || /dentist|dental(\s|$)|orthodont/i.test(name);
}

function looksLikeOptician(name: string, tokens: string[]): boolean {
  return (
    hasTypeToken(tokens, "optician", "optometrist") ||
    /optician|optometrist|opticals?|eye care|eyecare|\boptics\b/i.test(name)
  );
}

function looksLikePhysio(name: string, tokens: string[]): boolean {
  return hasTypeToken(tokens, "physiotherapist") || /physio|physiotherap/i.test(name);
}

function looksLikePodiatry(name: string, tokens: string[]): boolean {
  return (
    hasTypeToken(tokens, "podiatrist") ||
    /podiatr|chiropod|foot clinic|fungal nail|nail clinic|nail surgery/i.test(name)
  );
}

function looksLikeMentalHealth(name: string): boolean {
  return /counsell|psycholog|psychiatr|mental health|talking therapies|\biapt\b|wellbeing.{0,40}counsell/i.test(
    name,
  );
}

function looksLikeUrgentCare(name: string): boolean {
  return /urgent treatment|urgent care|minor injuries/i.test(name);
}

function looksLikeGpSurgery(name: string): boolean {
  if (SPECIALIST_SURGERY_NAME.test(name) || looksLikePodiatry(name, []) || looksLikeMentalHealth(name)) {
    return false;
  }
  if (isHealthOrMedicalCentreName(name)) return false;
  if (
    /private\s+gp|\bgp\s+surgery|\bgp\s+practice|\bgps?\b|doctors?\s+surgery|medical\s+practice|family\s+practice|general\s+practice/i.test(
      name,
    )
  ) {
    return true;
  }
  return /\bsurgery\b/i.test(name) && !SPECIALIST_SURGERY_NAME.test(name) && !/\bnail\b/i.test(name);
}

function looksLikeGenuineHospital(name: string, tokens: string[]): boolean {
  if (isEducationOrTrainingFacility(name)) return false;
  if (isHealthOrMedicalCentreName(name)) return false;
  if (looksLikeUrgentCare(name)) return false;
  if (looksLikePodiatry(name, tokens) || looksLikePhysio(name, tokens) || looksLikeMentalHealth(name)) return false;
  if (isStandaloneClinicOrTreatmentName(name)) return false;

  if (/\bhospital\b|\binfirmary\b|accident and emergency|a\s*&\s*e\b|emergency department|same day emergency|\bsdec\b/i.test(name)) {
    return true;
  }

  const typedHospital = hasTypeToken(tokens, "hospital");
  if (!typedHospital) return false;
  return !/\bclinic\b|\btreatments?\b|\bsuite\b|\bcentre\b|\bcenter\b/i.test(name);
}

export function classifyHealthcareProvider(
  name: string,
  types: string[],
  primaryType: string,
): { groupKey: HealthcareProviderGroupKey; category: string } | null {
  const lower = name.toLowerCase();
  const tokens = typeTokens(types, primaryType);

  if (isPharmacyName(name)) return null;
  if (/\biheart\b|out[\s-]*of[\s-]*hours/i.test(lower)) return null;

  if (looksLikeDentist(name, tokens)) {
    return { groupKey: "dentists", category: "Dentist" };
  }
  if (looksLikeOptician(name, tokens)) {
    return { groupKey: "opticians", category: "Optician" };
  }
  if (looksLikePhysio(name, tokens)) {
    return { groupKey: "physiotherapists", category: "Physiotherapist" };
  }
  if (looksLikePodiatry(name, tokens)) {
    return { groupKey: "podiatrists", category: "Podiatrist" };
  }
  if (looksLikeMentalHealth(name)) {
    return { groupKey: "mentalHealthServices", category: "Mental Health Service" };
  }
  if (/care home|nursing home|residential care/i.test(lower)) {
    return { groupKey: "careHomes", category: "Care Home" };
  }
  if (looksLikeUrgentCare(name)) {
    return { groupKey: "urgentTreatmentCentres", category: "Urgent Treatment Centre" };
  }
  if (/walk-in|walk in centre|walk-in centre/i.test(lower)) {
    return { groupKey: "walkInCentres", category: "Walk-in Centre" };
  }
  if (isEducationOrTrainingFacility(name)) {
    return { groupKey: "communityClinics", category: "Community Clinic" };
  }
  if (isHealthOrMedicalCentreName(name)) {
    return { groupKey: "healthCentres", category: "Health Centre" };
  }
  if (looksLikeGenuineHospital(name, tokens)) {
    return { groupKey: "hospitals", category: "Hospital" };
  }
  if (looksLikeGpSurgery(name)) {
    return { groupKey: "gpSurgeries", category: "GP Surgery" };
  }
  if (
    hasTypeToken(tokens, "medical center", "medical centre") &&
    !isStandaloneClinicOrTreatmentName(name)
  ) {
    return { groupKey: "healthCentres", category: "Health Centre" };
  }
  if (/community clinic|community health|primary care network|\bpcn\b/i.test(lower)) {
    return { groupKey: "communityClinics", category: "Community Clinic" };
  }
  if (isStandaloneClinicOrTreatmentName(name)) {
    return { groupKey: "communityClinics", category: "Community Clinic" };
  }

  if (
    tokens.some((t) =>
      ["doctor", "hospital", "health", "medical", "dentist", "physiotherapist", "clinic"].some((k) => t.includes(k)),
    )
  ) {
    const cat = String(primaryType || "").replace(/_/g, " ") || "Healthcare";
    return { groupKey: "communityClinics", category: cat };
  }

  return null;
}

export function reclassifyHealthcareProviders(
  providers: HealthcareProviderEntity[],
): HealthcareProviderEntity[] {
  return providers.map((provider) => {
    const classified = classifyHealthcareProvider(provider.businessName, [], "");
    if (classified) {
      return { ...provider, groupKey: classified.groupKey, category: classified.category };
    }
    if (provider.groupKey === "gpSurgeries" || provider.groupKey === "hospitals") {
      return { ...provider, groupKey: "communityClinics", category: "Community Clinic" };
    }
    return provider;
  });
}

function mapPlaceToProvider(
  p: Record<string, unknown>,
  ctx: DiscoveryContext,
  groupKey: HealthcareProviderGroupKey,
  category: string,
): HealthcareProviderEntity | null {
  const pid = String(p.id || "").replace(/^places\//, "");
  if (!pid) return null;

  const lat = (p.location as Record<string, unknown>)?.latitude;
  const lng = (p.location as Record<string, unknown>)?.longitude;
  const latitude = lat != null ? Number(lat) : null;
  const longitude = lng != null ? Number(lng) : null;

  let distanceKm: number | null = null;
  if (latitude != null && longitude != null) {
    distanceKm = haversineKm(ctx.pharmacyLat, ctx.pharmacyLng, latitude, longitude);
  }

  const businessName = String((p.displayName as Record<string, unknown>)?.text || "");
  if (!businessName) return null;

  const ratingRaw = p.rating;
  const rating =
    ratingRaw === null || ratingRaw === undefined ? null : Math.min(5, Math.max(0, Number(ratingRaw) || 0));

  return {
    placeId: pid,
    businessName,
    category,
    groupKey,
    distanceKm,
    distanceLabel: formatDistance(distanceKm),
    address: String(p.formattedAddress || ""),
    rating,
    reviewCount: p.userRatingCount != null ? Number(p.userRatingCount) : 0,
    phone: String(p.nationalPhoneNumber || p.internationalPhoneNumber || ""),
    website: String(p.websiteUri || ""),
    openingStatus: openingStatus(p),
    googleMapsUrl: String(
      p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(pid)}`,
    ),
    latitude,
    longitude,
    source: "google-places",
  };
}

async function searchHealthcarePlaces(
  query: string,
  ctx: DiscoveryContext,
  maxResultCount = 8,
): Promise<Record<string, unknown>[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount,
        locationBias: {
          circle: {
            center: { latitude: ctx.pharmacyLat, longitude: ctx.pharmacyLng },
            radius: LOCAL_NETWORK_RADIUS_M,
          },
        },
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { places?: Record<string, unknown>[] };
    return data.places || [];
  } catch {
    return [];
  }
}

const HEALTHCARE_QUERIES: Array<{ query: string; fallbackGroup?: HealthcareProviderGroupKey; category?: string }> = [
  { query: "GP surgery doctor medical practice" },
  { query: "health centre walk-in centre" },
  { query: "hospital" },
  { query: "urgent treatment centre urgent care" },
  { query: "care home nursing home" },
  { query: "dentist dental practice" },
  { query: "optician optometrist" },
  { query: "physiotherapist physiotherapy" },
  { query: "podiatrist chiropodist" },
  { query: "mental health clinic counselling" },
  { query: "community clinic medical centre" },
];

export async function discoverHealthcareProviders(ctx: DiscoveryContext): Promise<HealthcareProviderEntity[]> {
  if (!process.env.GOOGLE_PLACES_API_KEY) return [];

  const location = [ctx.town, ctx.postcode].filter(Boolean).join(" ");
  const seen = new Set<string>();
  const providers: HealthcareProviderEntity[] = [];

  for (const { query } of HEALTHCARE_QUERIES) {
    const places = await searchHealthcarePlaces(`${query} near ${location}`, ctx, 8);
    for (const place of places) {
      const name = String((place.displayName as Record<string, unknown>)?.text || "");
      const types = Array.isArray(place.types) ? place.types.map(String) : [];
      const primaryType = String(place.primaryType || types[0] || "");
      const classified = classifyHealthcareProvider(name, types, primaryType);
      if (!classified) continue;

      const pid = String(place.id || "").replace(/^places\//, "");
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);

      const provider = mapPlaceToProvider(place, ctx, classified.groupKey, classified.category);
      if (provider) providers.push(provider);
    }
  }

  return providers.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

export function realHealthcareProviders(providers: HealthcareProviderEntity[]): HealthcareProviderEntity[] {
  return providers.filter(
    (p): p is HealthcareProviderEntity =>
      Boolean(p) && p.source === "google-places" && Boolean(p.placeId) && !p.placeId.startsWith("demo-"),
  );
}

export const LOCAL_HEALTHCARE_DISCOVERY_LIMITS = {
  gpSurgeries: 6,
  healthCentres: 4,
  hospitals: 4,
  landmarks: 6,
} as const;

export type LocalNetworkEntityType = keyof typeof LOCAL_HEALTHCARE_DISCOVERY_LIMITS;

export interface LocalNetworkPlaceRecord {
  name: string;
  typeLabel: string;
  classifiedType: string;
  entityType: LocalNetworkEntityType;
  distanceKm: number | null;
  distanceLabel: string;
  source: "Google Places";
  discoveredAt: string;
  website: string;
  googleMapsUrl: string;
  openingStatus: string;
  operational: boolean;
  providerIdentity: string;
}

export interface LocalHealthcareLandmarkDiscovery {
  ok: boolean;
  error: GooglePlacesConnectionError | null;
  callsMade: number;
  gpSurgeries: LocalNetworkPlaceRecord[];
  healthCentres: LocalNetworkPlaceRecord[];
  hospitals: LocalNetworkPlaceRecord[];
  landmarks: LocalNetworkPlaceRecord[];
}

const REJECT_NAME =
  /pharmacy|chemist|boots\b|dentist|dental|veterinary|vet practice|\bvets\b|supermarket|tesco|asda|sainsbury|aldi|lidl|shopping centre|shopping center|retail park|mcdonald|takeaway|garage|petrol/i;
const LANDMARK_TYPE = new Set(["park", "tourist_attraction", "museum", "historical_landmark"]);
const LANDMARK_NAME = /park|memorial|stadium|colliery|market square|clock tower|\bmill\b|\bcommon\b/i;
const SHOP_TYPE = /store|supermarket|shopping_mall|restaurant|cafe|pharmacy|dentist|veterinary|car_dealer|gas_station/;

function publicActionUrl(url: unknown): string {
  const value = String(url || "").trim();
  if (!/^https?:\/\//i.test(value)) return "";
  if (/query_place_id=|place_id=/i.test(value)) return "";
  if (/ChIJ[A-Za-z0-9_-]{10,}/.test(value)) return "";
  return value;
}

function isClosedStatus(status: string): boolean {
  const s = status.toUpperCase().replace(/\s+/g, "_");
  return s === "CLOSED_PERMANENTLY" || s === "CLOSED" || s === "CLOSED_TEMPORARILY";
}

function classifyLandmark(name: string, types: string[]): boolean {
  if (REJECT_NAME.test(name)) return false;
  if (/hospital|surgery|clinic|dentist|pharmacy|health centre|medical centre/i.test(name)) return false;
  if (types.some((t) => SHOP_TYPE.test(t))) return false;
  if (types.some((t) => LANDMARK_TYPE.has(t))) return true;
  return LANDMARK_NAME.test(name);
}

function toNetworkRecord(
  place: Record<string, unknown>,
  ctx: DiscoveryContext,
  entityType: LocalNetworkEntityType,
  typeLabel: string,
  discoveredAt: string,
): LocalNetworkPlaceRecord | null {
  const name = String((place.displayName as Record<string, unknown> | undefined)?.text || "").trim();
  if (!name || REJECT_NAME.test(name)) return null;
  const status = String(place.businessStatus || "");
  if (isClosedStatus(status)) return null;
  const pid = String(place.id || "").replace(/^places\//, "");
  if (!pid || pid.startsWith("demo-")) return null;

  const lat = Number((place.location as Record<string, unknown> | undefined)?.latitude);
  const lng = Number((place.location as Record<string, unknown> | undefined)?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const distanceKm = haversineKm(ctx.pharmacyLat, ctx.pharmacyLng, lat, lng);
  const maxKm = LOCAL_NETWORK_RADIUS_M / 1000;
  if (!Number.isFinite(distanceKm) || distanceKm > maxKm) return null;

  return {
    name,
    typeLabel,
    classifiedType: typeLabel,
    entityType,
    distanceKm,
    distanceLabel: formatDistance(distanceKm),
    source: "Google Places",
    discoveredAt,
    website: publicActionUrl(place.websiteUri),
    googleMapsUrl: publicActionUrl(place.googleMapsUri),
    openingStatus: openingStatus(place),
    operational: status.toUpperCase() === "OPERATIONAL" || status === "",
    providerIdentity: pid,
  };
}

async function searchLocalNetworkPlaces(
  query: string,
  ctx: DiscoveryContext,
  maxResultCount: number,
): Promise<{ places: Record<string, unknown>[]; error: GooglePlacesConnectionError | null }> {
  if (!hasGooglePlacesApiKey()) return { places: [], error: missingApiKeyError() };
  const result = await placesApiFetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY || "",
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount,
      locationBias: {
        circle: {
          center: { latitude: ctx.pharmacyLat, longitude: ctx.pharmacyLng },
          radius: LOCAL_NETWORK_RADIUS_M,
        },
      },
    }),
  });
  if (!result.ok) return { places: [], error: result.error };
  const places = Array.isArray((result.data as { places?: unknown }).places)
    ? ((result.data as { places: Record<string, unknown>[] }).places)
    : [];
  return { places, error: null };
}

function namesOverlap(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function takeNearest(records: LocalNetworkPlaceRecord[], limit: number): LocalNetworkPlaceRecord[] {
  const seen = new Set<string>();
  const identityDeduped: LocalNetworkPlaceRecord[] = [];
  for (const record of [...records].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))) {
    const identity = record.providerIdentity || record.name.toLowerCase();
    const nameKey = record.name.toLowerCase();
    if (seen.has(identity) || seen.has(nameKey)) continue;
    seen.add(identity);
    seen.add(nameKey);
    identityDeduped.push(record);
  }
  const collapsed: LocalNetworkPlaceRecord[] = [];
  for (const record of [...identityDeduped].sort((a, b) => a.name.length - b.name.length || (a.distanceKm ?? 999) - (b.distanceKm ?? 999))) {
    if (collapsed.some((kept) => namesOverlap(kept.name, record.name))) continue;
    collapsed.push(record);
  }
  return collapsed
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, limit);
}

export function gateLocalNetworkRecord(record: LocalNetworkPlaceRecord): boolean {
  if (!record.name.trim() || REJECT_NAME.test(record.name)) return false;
  if (!record.classifiedType.trim() || record.source !== "Google Places") return false;
  if (record.distanceKm == null || !Number.isFinite(record.distanceKm)) return false;
  if (record.distanceKm > LOCAL_NETWORK_RADIUS_M / 1000) return false;
  const visible = `${record.name} ${record.typeLabel} ${record.distanceLabel} ${record.website} ${record.googleMapsUrl}`;
  if (/ChIJ[A-Za-z0-9_-]{10,}/.test(visible)) return false;
  if (/query_place_id=|place_id=/i.test(visible)) return false;
  if (record.entityType === "gpSurgeries" && /pharmacy|dentist|veterinary/i.test(record.name)) return false;
  if (record.entityType === "healthCentres" && /dentist|veterinary|pharmacy/i.test(record.name)) return false;
  if (record.entityType === "landmarks" && /pharmacy|dentist|hospital|surgery|clinic/i.test(record.name)) return false;
  return true;
}

export async function discoverLocalHealthcareAndLandmarks(
  ctx: DiscoveryContext,
): Promise<LocalHealthcareLandmarkDiscovery> {
  const discoveredAt = new Date().toISOString();
  const empty: LocalHealthcareLandmarkDiscovery = {
    ok: false,
    error: null,
    callsMade: 0,
    gpSurgeries: [],
    healthCentres: [],
    hospitals: [],
    landmarks: [],
  };
  if (!hasGooglePlacesApiKey()) {
    return { ...empty, error: missingApiKeyError() };
  }

  const location = [ctx.town, ctx.postcode].filter(Boolean).join(" ");
  const queries: Array<{
    query: string;
    pick: (place: Record<string, unknown>) => LocalNetworkPlaceRecord | null;
  }> = [
    {
      query: `GP surgery doctor medical practice near ${location}`,
      pick: (place) => {
        const name = String((place.displayName as Record<string, unknown> | undefined)?.text || "");
        const types = Array.isArray(place.types) ? place.types.map(String) : [];
        const classified = classifyHealthcareProvider(name, types, String(place.primaryType || types[0] || ""));
        if (classified?.groupKey !== "gpSurgeries") return null;
        return toNetworkRecord(place, ctx, "gpSurgeries", "GP surgery", discoveredAt);
      },
    },
    {
      query: `health centre medical centre near ${location}`,
      pick: (place) => {
        const name = String((place.displayName as Record<string, unknown> | undefined)?.text || "");
        const types = Array.isArray(place.types) ? place.types.map(String) : [];
        if (types.some((t) => /dentist|veterinary/i.test(t))) return null;
        const classified = classifyHealthcareProvider(name, types, String(place.primaryType || types[0] || ""));
        if (classified?.groupKey !== "healthCentres") return null;
        return toNetworkRecord(place, ctx, "healthCentres", "Health centre", discoveredAt);
      },
    },
    {
      query: `hospital near ${location}`,
      pick: (place) => {
        const name = String((place.displayName as Record<string, unknown> | undefined)?.text || "");
        const types = Array.isArray(place.types) ? place.types.map(String) : [];
        const classified = classifyHealthcareProvider(name, types, String(place.primaryType || types[0] || ""));
        if (classified?.groupKey !== "hospitals") return null;
        return toNetworkRecord(place, ctx, "hospitals", "Hospital", discoveredAt);
      },
    },
    {
      query: `park tourist attraction memorial near ${location}`,
      pick: (place) => {
        const name = String((place.displayName as Record<string, unknown> | undefined)?.text || "");
        const types = Array.isArray(place.types) ? place.types.map(String) : [];
        if (!classifyLandmark(name, types.map((t) => t.toLowerCase()))) return null;
        return toNetworkRecord(place, ctx, "landmarks", "Landmark", discoveredAt);
      },
    },
  ];

  const buckets: Record<LocalNetworkEntityType, LocalNetworkPlaceRecord[]> = {
    gpSurgeries: [],
    healthCentres: [],
    hospitals: [],
    landmarks: [],
  };
  let callsMade = 0;

  for (const item of queries) {
    const searched = await searchLocalNetworkPlaces(item.query, ctx, 8);
    callsMade += 1;
    if (searched.error) {
      return { ...empty, callsMade, error: searched.error };
    }
    for (const place of searched.places) {
      const record = item.pick(place);
      if (!record || !gateLocalNetworkRecord(record)) continue;
      buckets[record.entityType].push(record);
    }
  }

  return {
    ok: true,
    error: null,
    callsMade,
    gpSurgeries: takeNearest(buckets.gpSurgeries, LOCAL_HEALTHCARE_DISCOVERY_LIMITS.gpSurgeries),
    healthCentres: takeNearest(buckets.healthCentres, LOCAL_HEALTHCARE_DISCOVERY_LIMITS.healthCentres),
    hospitals: takeNearest(buckets.hospitals, LOCAL_HEALTHCARE_DISCOVERY_LIMITS.hospitals),
    landmarks: takeNearest(buckets.landmarks, LOCAL_HEALTHCARE_DISCOVERY_LIMITS.landmarks),
  };
}
