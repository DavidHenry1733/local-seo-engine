/**
 * Growth Engine — Local Market Intelligence V1 competitor & pharmacy model.
 */
import type { GrowthEngineHealthcareSnapshot } from "./growthEngineHealthcareModel.ts";
import { emptyHealthcareSnapshot, normalizeHealthcareSnapshot } from "./growthEngineHealthcareModel.ts";
import type { GooglePlacesConnectionError } from "./googlePlacesConnection.ts";

export type GrowthEngineCompetitorSource = "google-places" | "demo-fallback";

export interface GrowthEngineCompetitorFutureMetrics {
  indexedPages: number | null;
  servicePages: number | null;
  blogCount: number | null;
  schemaPresent: boolean | null;
  domainAuthority: number | null;
  authorityScore: number | null;
  contentScore: number | null;
  seoScore: number | null;
  visibilityScore: number | null;
}

export interface GrowthEnginePlaceEntity {
  placeId: string;
  businessName: string;
  distanceKm: number | null;
  distanceLabel: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
  phone: string;
  website: string;
  primaryCategory: string;
  secondaryCategories: string[];
  rating: number | null;
  reviewCount: number;
  photoCount: number;
  businessStatus: string;
  openingStatus: string;
  openingHours: string[];
  attributes: string[];
  businessDescription: string;
  directionsUrl: string;
  googleMapsUrl: string;
  notes: string;
  source: GrowthEngineCompetitorSource;
}

export interface GrowthEngineCompetitor extends GrowthEnginePlaceEntity {
  future: GrowthEngineCompetitorFutureMetrics;
}

export interface GrowthEngineYourPharmacy extends GrowthEnginePlaceEntity {
  isYourPharmacy: true;
}

export interface LocalMarketAnalysisSnapshot {
  competitorCount: number;
  dataSource: "google-places-live" | "unavailable";
  comparisons: Array<{
    id: string;
    label: string;
    yourPharmacy: string;
    competitorAverage: string;
    highestCompetitor: string;
    hasData: boolean;
  }>;
  summaryParagraphs: string[];
  opportunities: string[];
  yourPharmacyComplete: boolean;
}

export interface GrowthEngineCompetitorSnapshot {
  version: number;
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
  yourPharmacy: GrowthEngineYourPharmacy | null;
  competitors: GrowthEngineCompetitor[];
  analysis: LocalMarketAnalysisSnapshot | null;
  /** Sprint 2 — Local Healthcare Intelligence V1 */
  healthcare?: GrowthEngineHealthcareSnapshot | null;
  /** Set when the latest discovery attempt failed (live data only — no demo fallback). */
  placesError?: GooglePlacesConnectionError | null;
  lastDiscoverAttemptAt?: string;
  /** Hash of the qualified local competitor set this snapshot was built from. */
  qualificationRevision?: string;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function emptyFutureMetrics(): GrowthEngineCompetitorFutureMetrics {
  return {
    indexedPages: null,
    servicePages: null,
    blogCount: null,
    schemaPresent: null,
    domainAuthority: null,
    authorityScore: null,
    contentScore: null,
    seoScore: null,
    visibilityScore: null,
  };
}

function normalizePlaceEntity(raw: Record<string, unknown>): GrowthEnginePlaceEntity | null {
  const businessName = str(raw.businessName || raw.name);
  if (!businessName) return null;

  const placeId = str(raw.placeId);
  const ratingRaw = raw.rating;
  const rating =
    ratingRaw === null || ratingRaw === undefined || ratingRaw === ""
      ? null
      : Math.min(5, Math.max(0, Number(ratingRaw) || 0));

  const secondary = Array.isArray(raw.secondaryCategories)
    ? raw.secondaryCategories.map(String).filter(Boolean)
    : [];

  const primary = str(raw.primaryCategory) || secondary[0] || "";

  return {
    placeId,
    businessName,
    distanceKm: numOrNull(raw.distanceKm),
    distanceLabel: str(raw.distanceLabel),
    latitude: numOrNull(raw.latitude),
    longitude: numOrNull(raw.longitude),
    address: str(raw.address),
    phone: str(raw.phone),
    website: str(raw.website),
    primaryCategory: primary,
    secondaryCategories: secondary.filter((c) => c !== primary),
    rating,
    reviewCount: Math.max(0, Number(raw.reviewCount) || 0),
    // Photo evidence uses Fix-03 / 07A semantics: unknown is a negative sentinel (e.g. -1).
    // Never coerce missing/null photo evidence to 0 — 0 is reserved for a verified empty photos array.
    photoCount: (() => {
      const rawPhoto = raw.photoCount;
      if (rawPhoto === null || rawPhoto === undefined || rawPhoto === "") return -1;
      const n = typeof rawPhoto === "number" ? rawPhoto : Number(rawPhoto);
      return Number.isFinite(n) ? n : -1;
    })(),
    businessStatus: str(raw.businessStatus) || "UNKNOWN",
    openingStatus: str(raw.openingStatus),
    openingHours: Array.isArray(raw.openingHours) ? raw.openingHours.map(String).filter(Boolean) : [],
    attributes: Array.isArray(raw.attributes) ? raw.attributes.map(String).filter(Boolean) : [],
    businessDescription: str(raw.businessDescription),
    directionsUrl: str(raw.directionsUrl),
    googleMapsUrl: str(raw.googleMapsUrl) || str(raw.directionsUrl),
    notes: str(raw.notes),
    source: raw.source === "google-places" ? "google-places" : "demo-fallback",
  };
}

export function normalizeGrowthEngineCompetitor(raw: unknown): GrowthEngineCompetitor | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const base = normalizePlaceEntity(item);
  if (!base) return null;

  const futureRaw = (item.future || {}) as Record<string, unknown>;
  return {
    ...base,
    directionsUrl:
      base.directionsUrl ||
      (base.placeId ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(base.placeId)}` : ""),
    googleMapsUrl:
      base.googleMapsUrl ||
      (base.placeId ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(base.placeId)}` : ""),
    future: {
      indexedPages: numOrNull(futureRaw.indexedPages),
      servicePages: numOrNull(futureRaw.servicePages),
      blogCount: numOrNull(futureRaw.blogCount),
      schemaPresent: futureRaw.schemaPresent === true ? true : futureRaw.schemaPresent === false ? false : null,
      domainAuthority: numOrNull(futureRaw.domainAuthority),
      authorityScore: numOrNull(futureRaw.authorityScore),
      contentScore: numOrNull(futureRaw.contentScore),
      seoScore: numOrNull(futureRaw.seoScore),
      visibilityScore: numOrNull(futureRaw.visibilityScore),
    },
  };
}

export function normalizeYourPharmacy(raw: unknown): GrowthEngineYourPharmacy | null {
  if (!raw || typeof raw !== "object") return null;
  const base = normalizePlaceEntity(raw as Record<string, unknown>);
  if (!base) return null;
  return { ...base, isYourPharmacy: true as const };
}

export function normalizeCompetitorSnapshot(raw: unknown): GrowthEngineCompetitorSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Record<string, unknown>;
  const slug = str(doc.slug);
  if (!slug) return null;
  const pharmacy = (doc.pharmacy || {}) as Record<string, unknown>;
  const competitors = Array.isArray(doc.competitors)
    ? doc.competitors.map(normalizeGrowthEngineCompetitor).filter(Boolean) as GrowthEngineCompetitor[]
    : [];
  const source = doc.source as GrowthEngineCompetitorSnapshot["source"];
  return {
    version: Number(doc.version) || 1,
    slug,
    generatedAt: str(doc.generatedAt) || new Date().toISOString(),
    source: source || "demo-no-google-key",
    targetCount: Number(doc.targetCount) || 10,
    pharmacy: {
      name: str(pharmacy.name),
      address: str(pharmacy.address),
      postcode: str(pharmacy.postcode),
      latitude: numOrNull(pharmacy.latitude),
      longitude: numOrNull(pharmacy.longitude),
    },
    yourPharmacy: doc.yourPharmacy ? normalizeYourPharmacy(doc.yourPharmacy) : null,
    competitors,
    analysis: doc.analysis && typeof doc.analysis === "object" ? (doc.analysis as LocalMarketAnalysisSnapshot) : null,
    healthcare: doc.healthcare ? normalizeHealthcareSnapshot(doc.healthcare) : emptyHealthcareSnapshot(),
    placesError:
      doc.placesError && typeof doc.placesError === "object"
        ? (doc.placesError as GooglePlacesConnectionError)
        : null,
    lastDiscoverAttemptAt: str(doc.lastDiscoverAttemptAt) || undefined,
    qualificationRevision: str(doc.qualificationRevision) || undefined,
  };
}
