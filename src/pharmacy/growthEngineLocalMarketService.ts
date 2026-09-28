/**
 * Growth Engine — Local Market Intelligence V1 (Google Places real data only).
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { qualifyCommercialEvidenceCandidate } from "./organicSearchEvidenceClassification.ts";
import {
  discoverCompetitors,
  isDirectCommunityPharmacyCompetitor,
  loadPharmacyDiscoveryInput,
  type DiscoveredCompetitor,
} from "./pharmacyCompetitorDiscovery.ts";
import {
  loadCompetitorIntelligence,
  type EnrichedCompetitor,
} from "./pharmacyCompetitorIntelligence.ts";
import { resolveGoogleProfileOnboardingState } from "./masterAdminGoogleProfileOnboardingService.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import {
  emptyFutureMetrics,
  normalizeCompetitorSnapshot,
  type GrowthEngineCompetitor,
  type GrowthEngineCompetitorSnapshot,
  type GrowthEngineYourPharmacy,
} from "./growthEngineCompetitorModel.ts";
import { buildLocalMarketAnalysis } from "./growthEngineLocalMarketAnalysis.ts";
import {
  discoverHealthcareProviders,
  reclassifyHealthcareProviders,
} from "./growthEngineHealthcareDiscovery.ts";
import type { HealthcareProviderEntity } from "./growthEngineHealthcareModel.ts";
import { buildHealthcareAnalysis } from "./growthEngineHealthcareAnalysis.ts";
import { buildHealthcareMapModel } from "./growthEngineHealthcareMapModel.ts";
import {
  classifyPlacesHttpError,
  formatPlacesErrorForDisplay,
  hasGooglePlacesApiKey,
  type GooglePlacesConnectionError,
} from "./googlePlacesConnection.ts";
import {
  branchLocationRequiredError,
  profileHasBranchLocation,
  LOCAL_MARKET_BRANCH_REQUIRED_MESSAGE,
} from "./localMarketBranchLocation.ts";
import { normalizeProfileData, type PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { evidenceBackedPhotoCount } from "./googleLocalCompetitorEvidence.ts";

export const GROWTH_ENGINE_DIR = path.join(WORKSPACE_ROOT, "data/growth-engine");
export const LOCAL_MARKET_SNAPSHOT_VERSION = 3;
const TARGET = 10;

const PLACE_DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "websiteUri",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "types",
  "primaryType",
  "businessStatus",
  "photos",
  "editorialSummary",
  "regularOpeningHours",
  "currentOpeningHours",
  "googleMapsUri",
  "accessibilityOptions",
].join(",");

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
}

function parseProfileCoord(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function loadProfileDataForLocalMarket(slug: string): PharmacyProfileData {
  if (!fs.existsSync(profilePath(slug))) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(profilePath(slug), "utf8"));
  return normalizeProfileData(doc.data || {});
}

/** Canonical Business Profile → Local Market "your pharmacy" (no competitor snapshot fallback). */
export function buildYourPharmacyFromCanonicalProfile(data: PharmacyProfileData): GrowthEngineYourPharmacy | null {
  const placeId = String(data.googlePlaceId || "").trim();
  if (!placeId) return null;

  const googleSnap = data.googleImportSnapshot;
  const address = [data.addressLine1, data.addressLine2, data.townCity, data.postcode].filter(Boolean).join(", ");
  const categories = googleSnap?.categories || [];
  const primaryCategory = categories[0] ? String(categories[0]).replace(/_/g, " ") : "Pharmacy";

  // Own-pharmacy photos: 0 only when Google returned an explicit empty photos array (photosCaptured).
  // Otherwise preserve unknown as the LMI sentinel (-1). Never invent a gap from a default 0.
  const verifiedPhotoCount = evidenceBackedPhotoCount(
    googleSnap?.photoCount,
    (googleSnap as { photos?: unknown } | null | undefined)?.photos,
    (googleSnap as { photosCaptured?: unknown } | null | undefined)?.photosCaptured,
  );

  return {
    placeId,
    businessName: String(data.pharmacyName || data.tradingName || googleSnap?.businessName || ""),
    distanceKm: 0,
    distanceLabel: "Your location",
    latitude: parseProfileCoord(data.latitude) ?? googleSnap?.latitude ?? null,
    longitude: parseProfileCoord(data.longitude) ?? googleSnap?.longitude ?? null,
    address: address || String(googleSnap?.address || ""),
    phone: String(data.phone || googleSnap?.phone || ""),
    website: String(data.website || googleSnap?.website || ""),
    primaryCategory,
    secondaryCategories: categories.slice(1).map((c) => String(c).replace(/_/g, " ")),
    rating: data.googleBusinessRating ?? googleSnap?.rating ?? null,
    reviewCount: data.googleBusinessReviewCount ?? googleSnap?.reviewCount ?? 0,
    photoCount: verifiedPhotoCount == null ? -1 : verifiedPhotoCount,
    businessStatus: "UNKNOWN",
    openingStatus: "",
    openingHours: googleSnap?.openingHours || [],
    attributes: [],
    businessDescription: "",
    directionsUrl: `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`,
    googleMapsUrl: String(data.googleBusinessProfileUrl || googleSnap?.googleMapsUrl || ""),
    notes: "",
    source: "google-places",
    isYourPharmacy: true,
  };
}

export function resolveLocalMarketYourPharmacy(
  slug: string,
  snapshot: GrowthEngineCompetitorSnapshot | null,
): GrowthEngineYourPharmacy | null {
  if (snapshot?.yourPharmacy?.placeId) return snapshot.yourPharmacy;
  return buildYourPharmacyFromCanonicalProfile(loadProfileDataForLocalMarket(slug));
}

export function profileCanRunLocalMarketDiscovery(
  data: Pick<PharmacyProfileData, "googlePlaceId" | "latitude" | "longitude" | "postcode" | "addressLine1">,
): boolean {
  return Boolean(String(data.googlePlaceId || "").trim()) || profileHasBranchLocation(data);
}

function hydrateDiscoveryInputFromYourPharmacy(
  input: ReturnType<typeof loadPharmacyDiscoveryInput>,
  yourPharmacy: GrowthEngineYourPharmacy | null,
  profileData: PharmacyProfileData,
): ReturnType<typeof loadPharmacyDiscoveryInput> {
  if (input.latitude != null && input.longitude != null) return input;
  const lat = yourPharmacy?.latitude ?? parseProfileCoord(profileData.latitude);
  const lng = yourPharmacy?.longitude ?? parseProfileCoord(profileData.longitude);
  if (lat == null || lng == null) return input;
  return { ...input, latitude: lat, longitude: lng };
}

function loadProfilePlaceHints(slug: string): {
  pharmacyName: string;
  googlePlaceId: string;
  address: string;
  postcode: string;
  website: string;
  phone: string;
} {
  const d = loadProfileDataForLocalMarket(slug);
  const address = [d.addressLine1, d.addressLine2, d.townCity, d.postcode].filter(Boolean).join(", ");
  return {
    pharmacyName: String(d.pharmacyName || d.tradingName || ""),
    googlePlaceId: String(d.googlePlaceId || ""),
    address,
    postcode: String(d.postcode || ""),
    website: String(d.website || ""),
    phone: String(d.phone || ""),
  };
}

function formatWeekdayDescriptions(hours: Record<string, unknown> | undefined): string[] {
  if (!hours) return [];
  const desc = hours.weekdayDescriptions;
  if (Array.isArray(desc)) return desc.map(String).filter(Boolean);
  return formatOpeningHours(hours.periods);
}

function formatOpeningHours(periods: unknown): string[] {
  if (!Array.isArray(periods)) return [];
  return periods
    .map((p) => {
      const row = p as Record<string, unknown>;
      const open = row.open as Record<string, unknown> | undefined;
      const close = row.close as Record<string, unknown> | undefined;
      if (!open) return "";
      const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][Number(open.day) || 0] || "Day";
      const oh = String(open.hour ?? "").padStart(2, "0");
      const om = String(open.minute ?? "0").padStart(2, "0");
      const ch = close ? String(close.hour ?? "").padStart(2, "0") : "";
      const cm = close ? String(close.minute ?? "0").padStart(2, "0") : "";
      if (!close) return `${day}: ${oh}:${om}–open`;
      return `${day}: ${oh}:${om}–${ch}:${cm}`;
    })
    .filter(Boolean);
}

function openingStatusFromPlace(p: Record<string, unknown>): string {
  const current = p.currentOpeningHours as Record<string, unknown> | undefined;
  if (current?.openNow === true) return "Open now";
  if (current?.openNow === false) return "Closed now";
  const status = String(p.businessStatus || "");
  if (status === "OPERATIONAL") return "Hours available";
  if (status) return status.replace(/_/g, " ");
  return "Unknown";
}

function attributesFromPlace(p: Record<string, unknown>): string[] {
  const attrs: string[] = [];
  const access = p.accessibilityOptions as Record<string, unknown> | undefined;
  if (access) {
    if (access.wheelchairAccessibleEntrance) attrs.push("Wheelchair accessible entrance");
    if (access.wheelchairAccessibleParking) attrs.push("Wheelchair accessible parking");
    if (access.wheelchairAccessibleRestroom) attrs.push("Wheelchair accessible restroom");
  }
  return attrs;
}

function mapGooglePlaceToEntity(
  p: Record<string, unknown>,
  extras: Partial<GrowthEngineCompetitor> = {},
): Partial<GrowthEngineCompetitor> {
  const types = Array.isArray(p.types) ? p.types.map(String) : [];
  const primaryType = String(p.primaryType || types[0] || "").replace(/_/g, " ");
  const summary = p.editorialSummary as Record<string, unknown> | undefined;
  const regular = p.regularOpeningHours as Record<string, unknown> | undefined;
  const pid = String(p.id || "").replace(/^places\//, "");
  const lat = (p.location as Record<string, unknown>)?.latitude;
  const lng = (p.location as Record<string, unknown>)?.longitude;

  return {
    placeId: pid,
    businessName: String((p.displayName as Record<string, unknown>)?.text || extras.businessName || ""),
    address: String(p.formattedAddress || extras.address || ""),
    latitude: lat != null ? Number(lat) : extras.latitude ?? null,
    longitude: lng != null ? Number(lng) : extras.longitude ?? null,
    rating: p.rating != null ? Number(p.rating) : extras.rating ?? null,
    reviewCount: p.userRatingCount != null ? Number(p.userRatingCount) : extras.reviewCount ?? 0,
    website: String(p.websiteUri || extras.website || ""),
    phone: String(p.nationalPhoneNumber || p.internationalPhoneNumber || extras.phone || ""),
    primaryCategory: primaryType || "Pharmacy",
    secondaryCategories: types.filter((t) => t !== String(p.primaryType)).map((t) => t.replace(/_/g, " ")),
    photoCount: Array.isArray(p.photos)
      ? p.photos.length
      : evidenceBackedPhotoCount(extras.photoCount, (extras as { photos?: unknown }).photos, (extras as { photosCaptured?: unknown }).photosCaptured) ?? -1,
    businessStatus: String(p.businessStatus || "UNKNOWN"),
    openingStatus: openingStatusFromPlace(p),
    openingHours: formatWeekdayDescriptions(regular).length
      ? formatWeekdayDescriptions(regular)
      : formatOpeningHours(regular?.periods),
    businessDescription: String(summary?.text || summary?.overview || ""),
    googleMapsUrl: String(p.googleMapsUri || ""),
    directionsUrl: String(
      p.googleMapsUri || (pid ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(pid)}` : ""),
    ),
    attributes: attributesFromPlace(p),
    source: "google-places",
    ...extras,
  };
}

async function fetchPlaceDetails(
  placeId: string,
): Promise<{ details: Partial<GrowthEngineCompetitor>; error: GooglePlacesConnectionError | null }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !placeId || placeId.startsWith("demo-")) return { details: {}, error: null };

  const id = placeId.startsWith("places/") ? placeId : `places/${placeId}`;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/${id}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": PLACE_DETAIL_FIELDS,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      return { details: {}, error: classifyPlacesHttpError(res.status, body) };
    }
    return { details: mapGooglePlaceToEntity((await res.json()) as Record<string, unknown>), error: null };
  } catch (err: unknown) {
    return {
      details: {},
      error: {
        code: "unknown-api-error",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function searchYourPharmacyPlace(
  name: string,
  postcode: string,
  address: string,
): Promise<{ details: Partial<GrowthEngineCompetitor>; error: GooglePlacesConnectionError | null }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { details: {}, error: null };

  const query = [name, "pharmacy", postcode || address].filter(Boolean).join(" ");
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": PLACE_DETAIL_FIELDS,
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 3 }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { details: {}, error: classifyPlacesHttpError(res.status, body) };
    }
    const data = (await res.json()) as { places?: Record<string, unknown>[] };
    const match = (data.places || []).find((p) => {
      const n = String((p.displayName as Record<string, unknown>)?.text || "").toLowerCase();
      return n.includes(name.toLowerCase().split(" ")[0]) || /pharmacy|chemist/i.test(n);
    }) || data.places?.[0];
    if (!match) return { details: {}, error: null };
    return { details: mapGooglePlaceToEntity(match), error: null };
  } catch (err: unknown) {
    return {
      details: {},
      error: {
        code: "unknown-api-error",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export async function fetchYourPharmacyFromGoogle(slug: string): Promise<GrowthEngineYourPharmacy | null> {
  const hints = loadProfilePlaceHints(slug);
  if (!hints.pharmacyName) return null;

  let details: Partial<GrowthEngineCompetitor> = {};
  if (hints.googlePlaceId) {
    const fetched = await fetchPlaceDetails(hints.googlePlaceId);
    details = fetched.details;
  }
  if (!details.placeId) {
    const searched = await searchYourPharmacyPlace(hints.pharmacyName, hints.postcode, hints.address);
    details = searched.details;
  }
  if (!details.placeId && !details.businessName) {
    return null;
  }

  const verifiedGoogle = details.source === "google-places" && Boolean(details.placeId);

  const entity: GrowthEngineYourPharmacy = {
    placeId: details.placeId || "",
    businessName: details.businessName || hints.pharmacyName,
    distanceKm: 0,
    distanceLabel: "Your location",
    latitude: details.latitude ?? null,
    longitude: details.longitude ?? null,
    address: details.address || hints.address,
    phone: details.phone || hints.phone,
    website: details.website || hints.website,
    primaryCategory: details.primaryCategory || "",
    secondaryCategories: details.secondaryCategories || [],
    rating: verifiedGoogle ? (details.rating ?? null) : null,
    reviewCount: verifiedGoogle ? (details.reviewCount ?? 0) : 0,
    photoCount: verifiedGoogle
      ? evidenceBackedPhotoCount(
          details.photoCount,
          (details as { photos?: unknown }).photos,
          (details as { photosCaptured?: unknown }).photosCaptured,
        ) ?? -1
      : -1,
    businessStatus: details.businessStatus || "UNKNOWN",
    openingStatus: details.openingStatus || "",
    openingHours: details.openingHours || [],
    attributes: details.attributes || [],
    businessDescription: details.businessDescription || "",
    directionsUrl: details.directionsUrl || "",
    googleMapsUrl: details.googleMapsUrl || details.directionsUrl || "",
    notes: "",
    source: details.source === "google-places" ? "google-places" : "demo-fallback",
    isYourPharmacy: true,
  };

  return entity.source === "google-places" ? entity : null;
}

function mapDiscoveredToGrowthEngine(c: DiscoveredCompetitor): GrowthEngineCompetitor {
  return {
    placeId: c.placeId,
    businessName: c.name,
    distanceKm: c.distanceKm,
    distanceLabel: c.distanceLabel,
    latitude: c.latitude,
    longitude: c.longitude,
    address: c.address,
    phone: c.phone,
    website: c.website,
    primaryCategory: "",
    secondaryCategories: [],
    rating: c.rating,
    reviewCount: c.reviewCount,
    photoCount: 0,
    businessStatus: "UNKNOWN",
    openingStatus: "",
    openingHours: [],
    attributes: [],
    businessDescription: "",
    directionsUrl: c.placeId
      ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(c.placeId)}`
      : "",
    googleMapsUrl: c.placeId
      ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(c.placeId)}`
      : "",
    notes: "",
    source: c.source,
    future: emptyFutureMetrics(),
  };
}

function isLiveSnapshot(snapshot: GrowthEngineCompetitorSnapshot): boolean {
  return snapshot.source === "google-places-live" && snapshot.competitors.length >= 5;
}

function preserveExistingLiveSnapshot(
  existing: GrowthEngineCompetitorSnapshot | null,
  placesError: GooglePlacesConnectionError | null,
): GrowthEngineCompetitorSnapshot | null {
  if (!existing || !isLiveSnapshot(existing)) return null;
  const preserved: GrowthEngineCompetitorSnapshot = {
    ...existing,
    placesError,
    lastDiscoverAttemptAt: new Date().toISOString(),
  };
  writeCompetitorSnapshot(preserved);
  return preserved;
}

function isStoredGooglePlaceId(placeId: string): boolean {
  const value = String(placeId || "").trim();
  if (!value || value.startsWith("demo-")) return false;
  if (/^(deferred|no_profile|unknown|none|null)$/i.test(value)) return false;
  return true;
}

function mapStoredCompetitorToLocalMarket(competitor: EnrichedCompetitor): GrowthEngineCompetitor | null {
  if (competitor.source !== "google-places" || !isStoredGooglePlaceId(competitor.placeId)) return null;
  const photoCount = evidenceBackedPhotoCount(competitor.photoCount, competitor.photos, competitor.photosCaptured);
  const categories = (competitor.categories || []).map((category) => String(category || "").trim()).filter(Boolean);
  const primaryCategory = String(competitor.primaryType || categories[0] || "").trim();
  const placeId = competitor.placeId;
  return {
    placeId,
    businessName: competitor.name,
    distanceKm: competitor.distanceKm,
    distanceLabel: competitor.distanceLabel,
    latitude: competitor.latitude,
    longitude: competitor.longitude,
    address: competitor.address,
    phone: competitor.phone || competitor.internationalPhone || "",
    website: competitor.website,
    primaryCategory,
    secondaryCategories: categories.filter((category) => category !== primaryCategory),
    rating: competitor.gbpRating ?? competitor.rating,
    reviewCount: competitor.gbpReviewCount ?? competitor.reviewCount,
    photoCount: photoCount == null ? -1 : photoCount,
    businessStatus: competitor.businessStatus || "UNKNOWN",
    openingStatus: "",
    openingHours: competitor.openingHours?.weekdayDescriptions || [],
    attributes: [],
    businessDescription: "",
    directionsUrl: competitor.mapsUrl || `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`,
    googleMapsUrl: competitor.mapsUrl || "",
    notes: "",
    source: "google-places",
    future: emptyFutureMetrics(),
  };
}

/**
 * Build the Local Market snapshot from competitor analysis that has already completed.
 * Does not call Google Places or DataForSEO.
 */
export function deriveLocalMarketSnapshotFromStoredCompetitorAnalysis(
  slug: string,
  options?: { rebuild?: boolean },
): GrowthEngineCompetitorSnapshot | null {
  const existing = loadCompetitorSnapshot(slug);
  if (!options?.rebuild && existing?.generatedAt && (existing.competitors.length > 0 || existing.analysis)) return existing;

  const intel = loadCompetitorIntelligence(slug);
  if (!intel || intel.source !== "google-places-live") return null;
  const competitors = intel.competitors
    .map(mapStoredCompetitorToLocalMarket)
    .filter((row): row is GrowthEngineCompetitor => Boolean(row))
    .filter((row) =>
      qualifyCommercialEvidenceCandidate({
        name: row.businessName,
        source: row.source,
        provider: "google-places",
        placeId: row.placeId,
        primaryCategory: row.primaryCategory,
        categories: [row.primaryCategory, ...(row.secondaryCategories || [])],
        distanceKm: row.distanceKm,
        url: row.website,
        discoveryAccepted: true,
        sourceRevision: intel.generatedAt,
      }).evidenceClass === "LOCAL_COMMERCIAL_COMPETITOR",
    );
  if (!competitors.length) return null;

  const profileData = loadProfileDataForLocalMarket(slug);
  const googleState = resolveGoogleProfileOnboardingState(profileData);
  const yourPharmacy =
    googleState === "configured" || googleState === "selected"
      ? buildYourPharmacyFromCanonicalProfile(profileData)
      : null;
  const verifiedYourPharmacy =
    yourPharmacy && isStoredGooglePlaceId(yourPharmacy.placeId) ? yourPharmacy : null;

  const analysis = buildLocalMarketAnalysis(verifiedYourPharmacy, competitors, "google-places-live");
  const healthcareProviders: HealthcareProviderEntity[] = [];
  const healthcareAnalysis = buildHealthcareAnalysis(
    healthcareProviders,
    competitors,
    verifiedYourPharmacy,
    "google-places-live",
  );
  const mapModel = buildHealthcareMapModel(verifiedYourPharmacy, healthcareProviders, competitors);
  const snapshot: GrowthEngineCompetitorSnapshot = {
    version: LOCAL_MARKET_SNAPSHOT_VERSION,
    slug,
    generatedAt: new Date().toISOString(),
    source: "google-places-live",
    targetCount: TARGET,
    pharmacy: intel.pharmacy,
    yourPharmacy: verifiedYourPharmacy,
    competitors,
    analysis: {
      competitorCount: analysis.competitorCount,
      dataSource: analysis.dataSource,
      comparisons: analysis.comparisons,
      summaryParagraphs: analysis.summaryParagraphs,
      opportunities: analysis.opportunities,
      yourPharmacyComplete: analysis.yourPharmacyComplete,
    },
    healthcare: {
      version: 1,
      generatedAt: new Date().toISOString(),
      providers: healthcareProviders,
      analysis: healthcareAnalysis,
      mapModel,
    },
    placesError: null,
    lastDiscoverAttemptAt: intel.generatedAt,
    qualificationRevision: createHash("sha256")
      .update(competitors.map((row) => row.placeId).filter(Boolean).sort().join("|"))
      .digest("hex")
      .slice(0, 16),
  };
  writeCompetitorSnapshot(snapshot);
  return snapshot;
}

export async function discoverLocalMarketCompetitors(slug: string): Promise<GrowthEngineCompetitorSnapshot> {
  const existing = loadCompetitorSnapshot(slug);
  const profileData = normalizeProfileData(
    fs.existsSync(profilePath(slug))
      ? JSON.parse(fs.readFileSync(profilePath(slug), "utf8")).data || {}
      : {},
  );

  if (!profileCanRunLocalMarketDiscovery(profileData)) {
    const placesError = branchLocationRequiredError();
    const preserved = preserveExistingLiveSnapshot(existing, placesError);
    if (preserved) return preserved;
    const emptySnapshot: GrowthEngineCompetitorSnapshot = {
      version: LOCAL_MARKET_SNAPSHOT_VERSION,
      slug,
      generatedAt: new Date().toISOString(),
      source: "demo-no-google-key",
      targetCount: TARGET,
      pharmacy: {
        name: profileData.pharmacyName || profileData.tradingName || "",
        address: [profileData.addressLine1, profileData.addressLine2, profileData.townCity, profileData.postcode]
          .filter(Boolean)
          .join(", "),
        postcode: profileData.postcode || "",
        latitude: null,
        longitude: null,
      },
      yourPharmacy: null,
      competitors: [],
      analysis: buildLocalMarketAnalysis(null, [], "demo-no-google-key"),
      healthcare: {
        version: 1,
        generatedAt: new Date().toISOString(),
        providers: [],
        analysis: buildHealthcareAnalysis([], [], null, "demo-no-google-key"),
        mapModel: buildHealthcareMapModel(null, [], []),
      },
      placesError,
      lastDiscoverAttemptAt: new Date().toISOString(),
    };
    writeCompetitorSnapshot(emptySnapshot);
    return emptySnapshot;
  }

  const yourPharmacy = await fetchYourPharmacyFromGoogle(slug);
  const input = hydrateDiscoveryInputFromYourPharmacy(loadPharmacyDiscoveryInput(slug), yourPharmacy, profileData);
  const discovery = await discoverCompetitors(slug, input);
  let placesError = discovery.placesError || null;

  const enriched: GrowthEngineCompetitor[] = [];
  for (const c of discovery.competitors) {
    if (enriched.length >= TARGET) break;
    if (c.source !== "google-places" || !c.placeId) continue;
    let row = mapDiscoveredToGrowthEngine(c);
    const { details } = await fetchPlaceDetails(c.placeId);
    row = {
      ...row,
      ...details,
      distanceKm: row.distanceKm,
      distanceLabel: row.distanceLabel,
      source: "google-places",
      future: emptyFutureMetrics(),
    } as GrowthEngineCompetitor;
    if (yourPharmacy?.placeId && row.placeId === yourPharmacy.placeId) continue;
    if (
      !isDirectCommunityPharmacyCompetitor({
        businessName: row.businessName,
        primaryCategory: row.primaryCategory,
      })
    ) {
      continue;
    }
    enriched.push(row);
  }

  const live = enriched.length >= 5 && discovery.source === "google-places-live";
  if (!live && !placesError && !hasGooglePlacesApiKey()) {
    placesError = {
      code: "api-key-missing",
      message: "Google Places API key is not configured. Set GOOGLE_PLACES_API_KEY in the server environment.",
    };
  }

  if (!live) {
    const preserved = preserveExistingLiveSnapshot(existing, placesError);
    if (preserved) return preserved;
  }

  const analysis = buildLocalMarketAnalysis(yourPharmacy, enriched, live ? "google-places-live" : discovery.source);

  let healthcareProviders: Awaited<ReturnType<typeof discoverHealthcareProviders>> = [];
  const lat = yourPharmacy?.latitude ?? discovery.pharmacy.latitude;
  const lng = yourPharmacy?.longitude ?? discovery.pharmacy.longitude;
  if (live && lat != null && lng != null) {
    healthcareProviders = await discoverHealthcareProviders({
      pharmacyLat: lat,
      pharmacyLng: lng,
      postcode: discovery.pharmacy.postcode,
      town: input.town || "",
    });
  }

  const healthcareAnalysis = buildHealthcareAnalysis(
    healthcareProviders,
    live ? enriched : [],
    yourPharmacy,
    live ? "google-places-live" : discovery.source,
  );
  const mapModel = buildHealthcareMapModel(yourPharmacy, healthcareProviders, live ? enriched : []);

  const snapshot: GrowthEngineCompetitorSnapshot = {
    version: LOCAL_MARKET_SNAPSHOT_VERSION,
    slug,
    generatedAt: new Date().toISOString(),
    source: live ? "google-places-live" : discovery.source,
    targetCount: TARGET,
    pharmacy: discovery.pharmacy,
    yourPharmacy,
    competitors: live ? enriched.slice(0, TARGET) : [],
    analysis: {
      competitorCount: analysis.competitorCount,
      dataSource: analysis.dataSource,
      comparisons: analysis.comparisons,
      summaryParagraphs: analysis.summaryParagraphs,
      opportunities: analysis.opportunities,
      yourPharmacyComplete: analysis.yourPharmacyComplete,
    },
    healthcare: {
      version: 1,
      generatedAt: new Date().toISOString(),
      providers: healthcareProviders,
      analysis: healthcareAnalysis,
      mapModel,
    },
    placesError: live ? null : placesError,
    lastDiscoverAttemptAt: new Date().toISOString(),
  };

  writeCompetitorSnapshot(snapshot);
  return snapshot;
}

export function formatLocalMarketPlacesError(snapshot: GrowthEngineCompetitorSnapshot | null): string | null {
  if (!snapshot?.placesError) return null;
  return formatPlacesErrorForDisplay(snapshot.placesError);
}

export function localMarketBranchRequired(snapshot: GrowthEngineCompetitorSnapshot | null, slug: string): boolean {
  if (snapshot?.placesError?.code === "branch-location-required") {
    const profileData = loadProfileDataForLocalMarket(slug);
    if (profileCanRunLocalMarketDiscovery(profileData)) return false;
    return true;
  }
  return !profileCanRunLocalMarketDiscovery(loadProfileDataForLocalMarket(slug));
}

export { LOCAL_MARKET_BRANCH_REQUIRED_MESSAGE };

export function competitorSnapshotPath(slug: string): string {
  return path.join(GROWTH_ENGINE_DIR, `${slug}-competitors.json`);
}

export function writeCompetitorSnapshot(snapshot: GrowthEngineCompetitorSnapshot): string {
  fs.mkdirSync(GROWTH_ENGINE_DIR, { recursive: true });
  const file = competitorSnapshotPath(snapshot.slug);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  return file;
}

export function loadCompetitorSnapshot(slug: string): GrowthEngineCompetitorSnapshot | null {
  const file = competitorSnapshotPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return normalizeCompetitorSnapshot(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

/** Recompute analysis from stored snapshot (e.g. after model upgrade). */
export function refreshSnapshotAnalysis(snapshot: GrowthEngineCompetitorSnapshot): GrowthEngineCompetitorSnapshot {
  const providers = reclassifyHealthcareProviders(snapshot.healthcare?.providers || []);
  const analysis = buildLocalMarketAnalysis(
    snapshot.yourPharmacy,
    snapshot.competitors,
    snapshot.source,
  );
  const healthcareAnalysis = buildHealthcareAnalysis(
    providers,
    snapshot.competitors,
    snapshot.yourPharmacy,
    snapshot.source,
  );
  const mapModel = buildHealthcareMapModel(
    snapshot.yourPharmacy,
    providers,
    snapshot.competitors,
  );
  return {
    ...snapshot,
    version: LOCAL_MARKET_SNAPSHOT_VERSION,
    analysis: {
      competitorCount: analysis.competitorCount,
      dataSource: analysis.dataSource,
      comparisons: analysis.comparisons,
      summaryParagraphs: analysis.summaryParagraphs,
      opportunities: analysis.opportunities,
      yourPharmacyComplete: analysis.yourPharmacyComplete,
    },
    healthcare: {
      version: 1,
      generatedAt: snapshot.healthcare?.generatedAt || new Date().toISOString(),
      providers,
      analysis: healthcareAnalysis,
      mapModel,
    },
  };
}

/** Rediscover healthcare providers only — leave competitors and other intelligence unchanged. */
export async function refreshLocalMarketHealthcare(slug: string): Promise<GrowthEngineCompetitorSnapshot | null> {
  const existing = loadCompetitorSnapshot(slug);
  if (!existing) return null;

  const lat = existing.yourPharmacy?.latitude ?? existing.pharmacy.latitude;
  const lng = existing.yourPharmacy?.longitude ?? existing.pharmacy.longitude;
  const profileData = loadProfileDataForLocalMarket(slug);
  const town = String(profileData.primaryTown || profileData.townCity || "").trim();

  let healthcareProviders = reclassifyHealthcareProviders(existing.healthcare?.providers || []);
  if (hasGooglePlacesApiKey() && lat != null && lng != null) {
    const discovered = await discoverHealthcareProviders({
      pharmacyLat: lat,
      pharmacyLng: lng,
      postcode: existing.pharmacy.postcode || profileData.postcode || "",
      town,
    });
    if (discovered.length) healthcareProviders = discovered;
  }

  const snapshot: GrowthEngineCompetitorSnapshot = {
    ...existing,
    healthcare: {
      version: 1,
      generatedAt: new Date().toISOString(),
      providers: healthcareProviders,
      analysis: buildHealthcareAnalysis(
        healthcareProviders,
        existing.competitors,
        existing.yourPharmacy,
        existing.source,
      ),
      mapModel: buildHealthcareMapModel(existing.yourPharmacy, healthcareProviders, existing.competitors),
    },
  };
  writeCompetitorSnapshot(snapshot);
  return snapshot;
}
