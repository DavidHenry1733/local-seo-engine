/**
 * Shared Local Coverage geography — Google coordinates and haversine distance.
 * Geography is resolved from Google location evidence only.
 */
import {
  readGoogleIdentityRecord,
  readGoogleIntelligenceRecord,
} from "./masterAdminCanonicalGoogleService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { safePharmacySlug } from "./pharmacyWorkspacePaths.ts";
import type { GoogleImportSnapshot, PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { hasGooglePlacesApiKey } from "./googlePlacesConnection.ts";

export const DISTANCE_UNAVAILABLE_LABEL = "Distance unavailable";
export const DISTANCE_CALCULATION_METHOD = "haversine";
export const DISTANCE_SOURCE = "google-coordinates";
export const EARTH_RADIUS_KM = 6371;
export const LOCAL_COVERAGE_NEARBY_RADIUS_M = 15_000;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export type PharmacyCoordinateSource =
  | "google-import-snapshot"
  | "google-intelligence"
  | "google-identity";

export interface PharmacyGoogleLocation extends GeoPoint {
  placeId: string;
  address: string;
  town: string;
  postcode: string;
  branchLocality: string | null;
  source: PharmacyCoordinateSource;
}

export interface GeocodedLocality extends GeoPoint {
  areaName: string;
  placeId: string;
  formattedAddress: string;
  source: "google-places-geocode" | "pharmacy-google-location" | "test-stub";
}

export interface LocalCoverageGoogleClient {
  geocodeLocality(query: string, bias: GeoPoint): GeocodedLocality | null;
  discoverNearbyLocalities(input: {
    origin: GeoPoint;
    branchLocality: string;
    regionHint: string;
    limit: number;
  }): GeocodedLocality[];
}

const geocodeCache = new Map<string, GeocodedLocality>();
let testGoogleClient: LocalCoverageGoogleClient | null = null;

export function setLocalCoverageGoogleClientForTests(client: LocalCoverageGoogleClient | null): void {
  testGoogleClient = client;
  geocodeCache.clear();
}

export function getLocalCoverageGoogleClient(): LocalCoverageGoogleClient | null {
  return testGoogleClient;
}

export function resetLocalCoverageGeoCacheForTests(): void {
  geocodeCache.clear();
}

export function parseFiniteCoordinate(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) > 180) return null;
  return n;
}

export function isVerifiedGeoPoint(point: { latitude?: unknown; longitude?: unknown } | null | undefined): point is GeoPoint {
  const latitude = parseFiniteCoordinate(point?.latitude);
  const longitude = parseFiniteCoordinate(point?.longitude);
  if (latitude == null || longitude == null) return false;
  if (Math.abs(latitude) > 90) return false;
  return true;
}

/** Straight-line distance in kilometres. Does not use list position, score, or placeholders. */
export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function roundDistanceKm(km: number): number {
  return Math.round(km * 10) / 10;
}

export function formatVerifiedDistanceLabel(km: number): string {
  const rounded = roundDistanceKm(km);
  if (rounded === 0) return "0 km (branch locality)";
  return `${rounded} km`;
}

/**
 * UK-style formatted address: street, locality, town, postcode.
 * Prefers the more specific locality when the address includes both locality and town.
 */
export function parseLocalityFromFormattedAddress(address: string): string | null {
  let text = String(address || "").trim();
  if (!text) return null;
  text = text.replace(/,\s*(United Kingdom|UK|England|Scotland|Wales|Northern Ireland)\s*$/i, "");
  text = text.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i, "").replace(/[,\s]+$/g, "").trim();
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2] || null;
  if (parts.length === 2) return parts[1] || null;
  if (parts.length === 1 && parts[0] && !/\d/.test(parts[0])) return parts[0];
  return null;
}

function cacheKey(slug: string, areaName: string): string {
  return `${safePharmacySlug(slug)}::${areaName.trim().toLowerCase()}`;
}

export function rememberGeocodedLocality(slug: string, locality: GeocodedLocality): void {
  if (!isVerifiedGeoPoint(locality) || !locality.areaName.trim()) return;
  geocodeCache.set(cacheKey(slug, locality.areaName), locality);
}

export function recallGeocodedLocality(slug: string, areaName: string): GeocodedLocality | null {
  return geocodeCache.get(cacheKey(slug, areaName)) || null;
}

function asPoint(latitude: unknown, longitude: unknown): GeoPoint | null {
  const lat = parseFiniteCoordinate(latitude);
  const lng = parseFiniteCoordinate(longitude);
  if (lat == null || lng == null || Math.abs(lat) > 90) return null;
  return { latitude: lat, longitude: lng };
}

export function resolvePharmacyGoogleLocation(
  slug: string,
  profile?: PharmacyProfileData,
): PharmacyGoogleLocation | null {
  const safe = safePharmacySlug(slug);
  const data = profile || readSetupProfile(safe);
  const snap = data.googleImportSnapshot as GoogleImportSnapshot | null | undefined;
  const intel = readGoogleIntelligenceRecord(safe);
  const identity = readGoogleIdentityRecord(safe);

  const snapshotPoint = asPoint(snap?.latitude, snap?.longitude);
  const intelPoint = asPoint(intel?.coordinates?.latitude, intel?.coordinates?.longitude);
  const identityPoint = asPoint(
    identity?.urlResolution?.coordinates?.latitude,
    identity?.urlResolution?.coordinates?.longitude,
  );

  let point: GeoPoint | null = null;
  let source: PharmacyCoordinateSource | null = null;
  if (snapshotPoint) {
    point = snapshotPoint;
    source = "google-import-snapshot";
  } else if (intelPoint) {
    point = intelPoint;
    source = "google-intelligence";
  } else if (identityPoint) {
    point = identityPoint;
    source = "google-identity";
  }
  if (!point || !source) return null;

  const address = String(snap?.address || intel?.address || identity?.preview?.address || data.displayAddress || "").trim();
  const town = String(snap?.town || intel?.town || data.primaryTown || data.townCity || "").trim();
  const branchLocality = parseLocalityFromFormattedAddress(address) || (town || null);
  const placeId = String(
    snap?.placeId || intel?.placeId || identity?.placeId || data.googlePlaceId || "",
  ).trim();

  return {
    latitude: point.latitude,
    longitude: point.longitude,
    placeId,
    address,
    town,
    postcode: String(snap?.postcode || intel?.postcode || data.postcode || "").trim(),
    branchLocality,
    source,
  };
}

function localityNameMatches(areaName: string, candidate: { displayName?: string; formattedAddress?: string }): boolean {
  const needle = areaName.trim().toLowerCase();
  if (!needle) return false;
  const hay = `${candidate.displayName || ""} ${candidate.formattedAddress || ""}`.toLowerCase();
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(hay);
}

function placeToLocality(areaName: string, place: Record<string, unknown>): GeocodedLocality | null {
  const location = place.location as { latitude?: unknown; longitude?: unknown } | undefined;
  const point = asPoint(location?.latitude, location?.longitude);
  if (!point) return null;
  const displayName =
    (place.displayName as { text?: string } | undefined)?.text ||
    String(place.displayName || areaName);
  const formattedAddress = String(place.formattedAddress || "");
  if (!localityNameMatches(areaName, { displayName, formattedAddress })) return null;
  return {
    areaName,
    latitude: point.latitude,
    longitude: point.longitude,
    placeId: String(place.id || "").replace(/^places\//, ""),
    formattedAddress,
    source: "google-places-geocode",
  };
}

async function googleSearchText(
  query: string,
  bias: GeoPoint,
  includedType?: string,
): Promise<Record<string, unknown>[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key || !query.trim()) return [];
  try {
    const body: Record<string, unknown> = {
      textQuery: query,
      maxResultCount: 5,
      locationBias: {
        circle: {
          center: { latitude: bias.latitude, longitude: bias.longitude },
          radius: LOCAL_COVERAGE_NEARBY_RADIUS_M,
        },
      },
    };
    if (includedType) body.includedType = includedType;
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { places?: Record<string, unknown>[] };
    return data.places || [];
  } catch {
    return [];
  }
}

async function googleSearchNearby(origin: GeoPoint, limit: number): Promise<Record<string, unknown>[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) return [];
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types",
      },
      body: JSON.stringify({
        includedTypes: ["locality", "sublocality", "neighborhood"],
        maxResultCount: Math.min(Math.max(limit, 1), 20),
        locationRestriction: {
          circle: {
            center: { latitude: origin.latitude, longitude: origin.longitude },
            radius: LOCAL_COVERAGE_NEARBY_RADIUS_M,
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

export async function geocodeLocalityViaGooglePlaces(
  areaName: string,
  bias: GeoPoint,
  regionHint: string,
): Promise<GeocodedLocality | null> {
  if (testGoogleClient) return testGoogleClient.geocodeLocality(areaName, bias);
  if (!hasGooglePlacesApiKey()) return null;
  const query = regionHint ? `${areaName}, ${regionHint}, UK` : `${areaName}, UK`;
  const places = await googleSearchText(query, bias, "locality");
  for (const place of places) {
    const mapped = placeToLocality(areaName, place);
    if (mapped) return mapped;
  }
  const fallback = await googleSearchText(query, bias);
  for (const place of fallback) {
    const mapped = placeToLocality(areaName, place);
    if (mapped) return mapped;
  }
  return null;
}

export async function discoverNearbyLocalitiesViaGooglePlaces(input: {
  origin: GeoPoint;
  branchLocality: string;
  regionHint: string;
  limit: number;
}): Promise<GeocodedLocality[]> {
  if (testGoogleClient) return testGoogleClient.discoverNearbyLocalities(input);
  if (!hasGooglePlacesApiKey()) return [];
  const out: GeocodedLocality[] = [];
  const seen = new Set<string>();
  const push = (locality: GeocodedLocality | null) => {
    if (!locality) return;
    const key = locality.areaName.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(locality);
  };

  const nearby = await googleSearchNearby(input.origin, input.limit);
  for (const place of nearby) {
    const name =
      (place.displayName as { text?: string } | undefined)?.text ||
      parseLocalityFromFormattedAddress(String(place.formattedAddress || "")) ||
      "";
    if (!name) continue;
    push(placeToLocality(name, place) || {
      areaName: name,
      latitude: Number((place.location as { latitude?: number })?.latitude),
      longitude: Number((place.location as { longitude?: number })?.longitude),
      placeId: String(place.id || "").replace(/^places\//, ""),
      formattedAddress: String(place.formattedAddress || ""),
      source: "google-places-geocode",
    });
  }

  if (out.length < input.limit && input.branchLocality) {
    const query = `towns and villages near ${input.branchLocality} ${input.regionHint}`.trim();
    const places = await googleSearchText(query, input.origin, "locality");
    for (const place of places) {
      const name =
        (place.displayName as { text?: string } | undefined)?.text ||
        parseLocalityFromFormattedAddress(String(place.formattedAddress || "")) ||
        "";
      push(placeToLocality(name, place));
    }
  }
  return out.filter((row) => isVerifiedGeoPoint(row)).slice(0, input.limit);
}

export function lookupLocalityCoordinates(
  slug: string,
  areaName: string,
  pharmacy: PharmacyGoogleLocation | null,
): GeocodedLocality | null {
  const name = areaName.trim();
  if (!name) return null;
  const client = getLocalCoverageGoogleClient();
  if (client && pharmacy) {
    const fromClient = client.geocodeLocality(name, pharmacy);
    if (fromClient && isVerifiedGeoPoint(fromClient)) return fromClient;
  }
  const cached = recallGeocodedLocality(slug, name);
  if (cached) return cached;
  if (
    pharmacy &&
    pharmacy.branchLocality &&
    name.toLowerCase() === pharmacy.branchLocality.toLowerCase()
  ) {
    return {
      areaName: pharmacy.branchLocality,
      latitude: pharmacy.latitude,
      longitude: pharmacy.longitude,
      placeId: pharmacy.placeId,
      formattedAddress: pharmacy.address,
      source: "pharmacy-google-location",
    };
  }
  return null;
}
