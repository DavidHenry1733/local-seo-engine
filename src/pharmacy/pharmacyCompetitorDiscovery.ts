/**
 * Pharmacy Competitor Discovery V1 —
 * finds nearest pharmacy competitors using Google Places or demo fallback.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyPlacesHttpError,
  hasGooglePlacesApiKey,
  missingApiKeyError,
  type GooglePlacesConnectionError,
} from "./googlePlacesConnection.ts";
import { normalizeProfileData, type PharmacyProfileData } from "./pharmacyProfileSchema.ts";

const LOCALITY_UNAVAILABLE = "Locality evidence unavailable";

function resolveDiscoveryTown(profile: PharmacyProfileData): string {
  const meta = profile.primaryLocalityMeta as { value?: string } | undefined;
  if (meta?.value) return String(meta.value).trim();
  return String(profile.primaryTown || profile.townCity || profile.localHierarchyRoot || "").trim();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isWorkspaceRoot(root: string): boolean {
  const markers = [
    "config/pharmacy/service-library.json",
    "config/pharmacy/service-authority-library.json",
    "data/pharmacy-profiles",
  ];
  return markers.some((marker) => fs.existsSync(path.join(root, marker)));
}

function resolveWorkspaceRoot(): string {
  const envRoot = process.env.WORKSPACE_ROOT?.trim();
  if (envRoot && fs.existsSync(envRoot)) {
    return path.resolve(envRoot);
  }

  const candidates = [
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    path.resolve(__dirname, "../../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];

  for (const root of candidates) {
    if (isWorkspaceRoot(root)) return root;
  }

  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();
export const COMPETITOR_INTEL_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-competitor-intelligence");

export interface CompetitorDiscoveryInput {
  pharmacyName: string;
  address: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  town?: string;
}

export interface DiscoveredCompetitor {
  name: string;
  address: string;
  distanceKm: number;
  distanceLabel: string;
  rating: number | null;
  reviewCount: number;
  website: string;
  phone: string;
  placeId: string;
  latitude: number | null;
  longitude: number | null;
  source: "google-places" | "demo-fallback";
}

export interface CompetitorDiscoveryResult {
  slug: string;
  generatedAt: string;
  source: "google-places-live" | "demo-fallback" | "demo-no-google-key";
  targetCount: number;
  pharmacy: {
    name: string;
    address: string;
    postcode: string;
    latitude: number | null;
    longitude: number | null;
  };
  competitors: DiscoveredCompetitor[];
  competitorCount: number;
  placesError?: GooglePlacesConnectionError | null;
}

const TARGET_COMPETITORS = 10;
/** Extra Places candidates so category/name filtering can still fill the target list. */
const CANDIDATE_POOL = 20;

const COMMUNITY_PHARMACY_NAME = /\b(pharmac(?:y|ies)|chemists?)\b/i;
const EXCLUDED_NON_COMMUNITY_NAME =
  /\b(steroids?|anabolic|pharma\s*lab|research\s*lab|compounding\s*lab)\b/i;
const SUPERSTORE_WITHOUT_PHARMACY = /\b(superstore|supermarket|grocery(\s+store)?)\b/i;
const NON_PHARMACY_PRIMARY =
  /\b(supermarket|grocery store|grocery|hospital|doctor|dentist|optometrist|optical)\b/i;

/**
 * Direct commercial pharmacy competitors only.
 * Adjacent retailers, labs, hospitals and clinics are not promoted merely to fill the list.
 * Name-only rows (pre-details) are kept unless the name itself is excluded.
 */
export function isDirectCommunityPharmacyCompetitor(input: {
  name?: string;
  businessName?: string;
  primaryCategory?: string;
}): boolean {
  const name = String(input.businessName || input.name || "").trim();
  if (!name) return false;
  if (EXCLUDED_NON_COMMUNITY_NAME.test(name)) return false;
  const namedPharmacy = COMMUNITY_PHARMACY_NAME.test(name);
  if (SUPERSTORE_WITHOUT_PHARMACY.test(name) && !namedPharmacy) return false;

  const primary = String(input.primaryCategory || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .trim();
  if (!primary) return true;
  if (NON_PHARMACY_PRIMARY.test(primary) && !namedPharmacy) return false;
  if (namedPharmacy) return true;
  return primary === "pharmacy" || primary === "drugstore" || primary === "chemist";
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number | null): string {
  if (km == null || Number.isNaN(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function parseCoord(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isOwnPharmacy(candidateName: string, pharmacyName: string): boolean {
  const a = normalizeName(candidateName);
  const b = normalizeName(pharmacyName);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function dedupeByName(competitors: DiscoveredCompetitor[]): DiscoveredCompetitor[] {
  const seen = new Set<string>();
  const out: DiscoveredCompetitor[] = [];
  for (const c of competitors) {
    const key = normalizeName(c.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

interface RawPlaceResult {
  name: string;
  address: string;
  placeId: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewCount: number;
  website: string;
  phone: string;
}

interface PharmacySearchOutcome {
  places: RawPlaceResult[];
  error: GooglePlacesConnectionError | null;
}

async function googlePlacesPharmacySearch(
  query: string,
  maxResultCount = 20,
): Promise<PharmacySearchOutcome> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { places: [], error: missingApiKeyError() };

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber,places.types",
      },
      body: JSON.stringify({ textQuery: query, maxResultCount }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { places: [], error: classifyPlacesHttpError(res.status, body) };
    }

    const data: any = await res.json();
    return {
      places: (data.places || [])
        .map((p: any) => ({
          name: p.displayName?.text || "",
          address: p.formattedAddress || "",
          placeId: p.id || "",
          latitude: p.location?.latitude ?? null,
          longitude: p.location?.longitude ?? null,
          rating: p.rating ?? null,
          reviewCount: p.userRatingCount ?? 0,
          website: p.websiteUri || "",
          phone: p.nationalPhoneNumber || "",
        }))
        .filter((p: RawPlaceResult) => p.name),
      error: null,
    };
  } catch (err: unknown) {
    return {
      places: [],
      error: {
        code: "unknown-api-error",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export async function resolveDiscoveryCoordinates(input: CompetitorDiscoveryInput): Promise<{
  latitude: number | null;
  longitude: number | null;
  source: string;
}> {
  if (input.latitude != null && input.longitude != null) {
    return { latitude: input.latitude, longitude: input.longitude, source: "profile-coordinates" };
  }
  const postcode = String(input.postcode || "")
    .trim()
    .replace(/\s+/g, " ");
  if (postcode.length >= 5) {
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ""))}`,
      );
      const data = (await res.json()) as {
        status?: number;
        result?: { latitude?: number; longitude?: number };
      };
      if (data.status === 200 && data.result?.latitude != null && data.result?.longitude != null) {
        return {
          latitude: data.result.latitude,
          longitude: data.result.longitude,
          source: "postcode-geocode",
        };
      }
    } catch {
      /* fall through */
    }
  }
  return { latitude: null, longitude: null, source: "unresolved" };
}

function demoCompetitors(
  input: CompetitorDiscoveryInput,
  lat: number,
  lng: number,
): DiscoveredCompetitor[] {
  const town = input.town || LOCALITY_UNAVAILABLE;
  const seeds: Array<Omit<DiscoveredCompetitor, "distanceKm" | "distanceLabel" | "source">> = [
    { name: "Boots Pharmacy", address: `Parkgate, ${town} S62 6JE`, rating: 4.1, reviewCount: 87, website: "https://www.boots.com", phone: "01709 555101", placeId: "demo-boots-parkgate", latitude: lat + 0.012, longitude: lng + 0.008 },
    { name: "Lloyds Pharmacy", address: `Effingham Square, ${town} S65 1AP`, rating: 3.9, reviewCount: 54, website: "https://www.lloydspharmacy.com", phone: "01709 555102", placeId: "demo-lloyds-effingham", latitude: lat + 0.006, longitude: lng - 0.004 },
    { name: "Well Pharmacy", address: `Rawmarsh, ${town} S62 6LN`, rating: 4.0, reviewCount: 41, website: "https://www.well.co.uk", phone: "01709 555103", placeId: "demo-well-rawmarsh", latitude: lat + 0.018, longitude: lng + 0.014 },
    { name: "Superdrug Pharmacy", address: `Allendale Square, ${town} S65 1HT`, rating: 3.8, reviewCount: 62, website: "https://www.superdrug.com", phone: "01709 555104", placeId: "demo-superdrug-allendale", latitude: lat - 0.003, longitude: lng + 0.005 },
    { name: "ASDA Pharmacy", address: `Kiln Lane, ${town} S65 1SH`, rating: 4.2, reviewCount: 73, website: "https://www.asda.com", phone: "01709 555105", placeId: "demo-asda-kiln", latitude: lat - 0.009, longitude: lng - 0.011 },
    { name: "Rowlands Pharmacy", address: `Brampton Bierlow, ${town} S63 6AN`, rating: 4.3, reviewCount: 29, website: "https://www.rowlandspharmacy.co.uk", phone: "01709 555106", placeId: "demo-rowlands-brampton", latitude: lat + 0.021, longitude: lng - 0.016 },
    { name: "Whitworth Chemists", address: `Kimberworth, ${town} S61 3AH`, rating: 4.5, reviewCount: 36, website: "", phone: "01709 555107", placeId: "demo-whitworth-kimberworth", latitude: lat - 0.014, longitude: lng + 0.019 },
    { name: "Hodgson Pharmacy", address: `Wath upon Dearne, ${town} S63 7LG`, rating: 4.6, reviewCount: 48, website: "", phone: "01709 555108", placeId: "demo-hodgson-wath", latitude: lat + 0.025, longitude: lng + 0.022 },
    { name: "Tesco Pharmacy", address: `Drummond Street, ${town} S65 1DA`, rating: 4.0, reviewCount: 55, website: "https://www.tesco.com", phone: "01709 555109", placeId: "demo-tesco-drummond", latitude: lat - 0.007, longitude: lng - 0.006 },
    { name: "Day Lewis Pharmacy", address: `Thurcroft, ${town} S66 9HQ`, rating: 4.4, reviewCount: 22, website: "https://www.daylewis.co.uk", phone: "01709 555110", placeId: "demo-daylewis-thurcroft", latitude: lat + 0.028, longitude: lng - 0.020 },
    { name: "Cohens Chemist", address: `Maltby, ${town} S66 7NQ`, rating: 4.1, reviewCount: 31, website: "", phone: "01709 555111", placeId: "demo-cohens-maltby", latitude: lat + 0.032, longitude: lng + 0.010 },
    { name: "Morrisons Pharmacy", address: `Catcliffe, ${town} S60 5TR`, rating: 3.9, reviewCount: 44, website: "https://www.morrisons.com", phone: "01709 555112", placeId: "demo-morrisons-catcliffe", latitude: lat - 0.019, longitude: lng - 0.018 },
  ];

  return seeds
    .filter((s) => !isOwnPharmacy(s.name, input.pharmacyName))
    .map((s) => {
      const distanceKm =
        s.latitude != null && s.longitude != null
          ? haversineKm(lat, lng, s.latitude, s.longitude)
          : 0;
      return {
        ...s,
        distanceKm: Math.round(distanceKm * 100) / 100,
        distanceLabel: formatDistance(distanceKm),
        source: "demo-fallback" as const,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, TARGET_COMPETITORS);
}

function mapRawToCompetitors(
  raw: RawPlaceResult[],
  input: CompetitorDiscoveryInput,
  lat: number,
  lng: number,
): DiscoveredCompetitor[] {
  return raw
    .filter((p) => !isOwnPharmacy(p.name, input.pharmacyName))
    .filter((p) => isDirectCommunityPharmacyCompetitor({ name: p.name }))
    .map((p) => {
      const distanceKm =
        p.latitude != null && p.longitude != null
          ? haversineKm(lat, lng, p.latitude, p.longitude)
          : 999;
      return {
        name: p.name,
        address: p.address,
        distanceKm: Math.round(distanceKm * 100) / 100,
        distanceLabel: formatDistance(distanceKm),
        rating: p.rating,
        reviewCount: p.reviewCount,
        website: p.website,
        phone: p.phone,
        placeId: p.placeId,
        latitude: p.latitude,
        longitude: p.longitude,
        source: "google-places" as const,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function discoverCompetitors(
  slug: string,
  input: CompetitorDiscoveryInput,
): Promise<CompetitorDiscoveryResult> {
  const coords = await resolveDiscoveryCoordinates(input);
  const lat = coords.latitude;
  const lng = coords.longitude;
  const town = input.town || input.postcode || LOCALITY_UNAVAILABLE;
  let source: CompetitorDiscoveryResult["source"] = "demo-no-google-key";
  let competitors: DiscoveredCompetitor[] = [];
  let placesError: GooglePlacesConnectionError | null = null;

  if (!hasGooglePlacesApiKey()) {
    placesError = missingApiKeyError();
  } else if (lat == null || lng == null) {
    placesError = {
      code: "no-coordinates",
      message:
        "Branch coordinates could not be resolved from profile or postcode. Confirm address, town and postcode.",
    };
  } else {
    const queries = [
      `pharmacy chemist near ${input.postcode}`,
      `pharmacy near ${town}`,
      `chemist near ${input.postcode}`,
    ];
    const batches = await Promise.all(queries.map((q) => googlePlacesPharmacySearch(q, 15)));
    for (const batch of batches) {
      if (batch.error && !placesError) placesError = batch.error;
    }
    const raw = dedupeByName(
      mapRawToCompetitors(
        batches.flatMap((batch) => batch.places),
        input,
        lat,
        lng,
      ) as unknown as DiscoveredCompetitor[],
    );
    competitors = raw.slice(0, CANDIDATE_POOL);
    if (competitors.length >= 5) {
      source = "google-places-live";
      placesError = null;
    } else if (!placesError && competitors.length === 0) {
      placesError = {
        code: "no-place-found",
        message: `No pharmacy competitors found near ${input.postcode || town}.`,
      };
    }
  }

  return {
    slug,
    generatedAt: new Date().toISOString(),
    source,
    targetCount: TARGET_COMPETITORS,
    pharmacy: {
      name: input.pharmacyName,
      address: input.address,
      postcode: input.postcode,
      latitude: lat,
      longitude: lng,
    },
    competitors: competitors.slice(0, CANDIDATE_POOL),
    competitorCount: Math.min(competitors.length, CANDIDATE_POOL),
    placesError,
  };
}

export function loadPharmacyDiscoveryInput(slug: string): CompetitorDiscoveryInput {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) {
    return {
      pharmacyName: "Pharmacy",
      address: "",
      postcode: "",
      latitude: null,
      longitude: null,
    };
  }
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const profile = normalizeProfileData(doc.data || {});
  const localityTown = resolveDiscoveryTown(profile);
  const address = [profile.addressLine1, profile.addressLine2, localityTown, profile.postcode]
    .filter(Boolean)
    .join(", ");
  return {
    pharmacyName: String(profile.pharmacyName || profile.tradingName || "Pharmacy"),
    address,
    postcode: String(profile.postcode || ""),
    latitude: parseCoord(profile.latitude),
    longitude: parseCoord(profile.longitude),
    town: localityTown,
  };
}

export function writeCompetitorDiscoveryResult(result: CompetitorDiscoveryResult): string {
  fs.mkdirSync(COMPETITOR_INTEL_DIR, { recursive: true });
  const file = path.join(COMPETITOR_INTEL_DIR, `${result.slug}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  return file;
}

export function loadCompetitorDiscoveryResult(slug: string): CompetitorDiscoveryResult | null {
  const file = path.join(COMPETITOR_INTEL_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
