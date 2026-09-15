/**
 * Customer Setup — Google Business Profile matching (Step 1/2 only).
 * Never silently applies low-confidence Google listings to the pharmacy profile.
 */
import fs from "node:fs";
import path from "node:path";
import {
  normalizeProfileData,
  PROFILE_SCHEMA_VERSION,
  type CustomerSetupGoogleCandidate,
  type CustomerSetupGoogleListing,
  type CustomerSetupGoogleMatchStatus,
  type PharmacyProfileData,
} from "./pharmacyProfileSchema.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import {
  classifyPlacesHttpError,
  hasGooglePlacesApiKey,
  type GooglePlacesConnectionError,
} from "./googlePlacesConnection.ts";
import {
  loadCompetitorSnapshot,
  writeCompetitorSnapshot,
  LOCAL_MARKET_SNAPSHOT_VERSION,
} from "./growthEngineLocalMarketService.ts";
import { buildLocalMarketAnalysis } from "./growthEngineLocalMarketAnalysis.ts";
import { buildHealthcareAnalysis } from "./growthEngineHealthcareAnalysis.ts";
import { buildHealthcareMapModel } from "./growthEngineHealthcareMapModel.ts";
import type { GrowthEngineYourPharmacy } from "./growthEngineCompetitorModel.ts";

/** Extract Google Place ID from Maps / Business Profile URLs when present. */
export function parseGooglePlaceIdFromUrl(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return "";

  const placeIdParam = raw.match(/[?&]query_place_id=([^&]+)/i)?.[1] || raw.match(/[?&]place_id=([^&]+)/i)?.[1];
  if (placeIdParam) return decodeURIComponent(placeIdParam);

  const chij = raw.match(/(ChI[A-Za-z0-9_-]{20,})/)?.[1];
  if (chij) return chij;

  const placesPath = raw.match(/\/place\/[^/]+\/(ChI[A-Za-z0-9_-]+)/i)?.[1];
  if (placesPath) return placesPath;

  return "";
}

const PROFILE_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles");

export const GOOGLE_MATCH_AUTO_CONFIRM_THRESHOLD = 85;
export const GOOGLE_MATCH_POSSIBLE_THRESHOLD = 55;

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
].join(",");

const SEARCH_TEXT_FIELD_MASK = PLACE_DETAIL_FIELDS.split(",")
  .map((field) => `places.${field}`)
  .join(",");

const NATIONAL_CHAIN_HOSTS = [
  "rowlandspharmacy.co.uk",
  "boots.com",
  "lloydspharmacy.com",
  "well.co.uk",
  "superdrug.com",
  "tesco.com",
  "asda.com",
  "morrisons.com",
  "coop.co.uk",
  "numarknet.com",
  "pharmacy2u.co.uk",
];

export interface GoogleMatchHints {
  pharmacyName: string;
  town: string;
  postcode: string;
  phone?: string;
  website?: string;
  googlePlaceId?: string;
  googleBusinessUrl?: string;
  /** Google Search kgmid entity from share-link redirect (e.g. /g/11b5pj59m8). */
  kgMid?: string;
  /** q= parameter from resolved Google Search URL. */
  searchQueryFromUrl?: string;
}

export interface GoogleListingSearchResult {
  candidates: CustomerSetupGoogleCandidate[];
  rawKgMidCandidates: CustomerSetupGoogleCandidate[];
  kgMidSearchQuery: string;
  filteredOut: Array<{ candidate: CustomerSetupGoogleCandidate; reason: string }>;
}

export interface GoogleMatchRunResult {
  status: CustomerSetupGoogleMatchStatus;
  candidates: CustomerSetupGoogleCandidate[];
  nationalWebsiteDetected: boolean;
  autoConfirmed: boolean;
  warnings: string[];
}

function profileFile(slug: string): string {
  return path.join(PROFILE_DIR, `${slug}.json`);
}

export function readSetupProfile(slug: string): PharmacyProfileData {
  const file = profileFile(slug);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function writeProfile(slug: string, data: PharmacyProfileData): void {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  fs.writeFileSync(
    profileFile(slug),
    JSON.stringify(
      {
        slug,
        updatedAt: new Date().toISOString(),
        version: PROFILE_SCHEMA_VERSION,
        data: normalizeProfileData(data),
      },
      null,
      2,
    ),
  );
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizePostcode(v: string): string {
  return String(v || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function extractPostcodeFromAddress(address: string): string {
  const match = String(address || "").match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
  return match ? normalizePostcode(match[1]) : "";
}

function normalizePhone(v: string): string {
  return String(v || "").replace(/\D/g, "").slice(-10);
}

function normalizeName(v: string): string {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function websiteHost(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function detectNationalChainWebsite(url: string): boolean {
  const host = websiteHost(url);
  if (!host) return false;
  return NATIONAL_CHAIN_HOSTS.some((chain) => host === chain || host.endsWith(`.${chain}`));
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const ta = a.toLowerCase().split(/\s+/).filter(Boolean);
  const tb = b.toLowerCase().split(/\s+/).filter(Boolean);
  const overlap = ta.filter((t) => tb.includes(t)).length;
  return overlap / Math.max(ta.length, tb.length, 1);
}

function isLikelyPharmacy(candidate: Pick<CustomerSetupGoogleCandidate, "businessName" | "primaryCategory">): boolean {
  const cat = candidate.primaryCategory.toLowerCase();
  const name = candidate.businessName.toLowerCase();
  return /pharmacy|chemist|dispensary|drugstore|health/i.test(cat) || /pharmacy|chemist|rowlands|boots|lloyd|well/i.test(name);
}

function isSuspiciousMatchName(name: string, allowDelivered = false): boolean {
  if (allowDelivered && /pharmacy\s+delivered/i.test(name)) return false;
  return /delivered|delivery only|online only|mail order|warehouse|head office|corporate|distribution/i.test(name);
}

export function buildKgMidSearchQuery(hints: GoogleMatchHints): string {
  const terms = [hints.searchQueryFromUrl, hints.pharmacyName, hints.town, hints.postcode, "pharmacy"].filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    for (const word of term.split(/\s+/)) {
      const key = word.toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(word);
      }
    }
  }
  return out.join(" ");
}

export function isPlausibleKgMidTextSearchCandidate(
  candidate: Pick<
    CustomerSetupGoogleCandidate,
    "businessName" | "address" | "postcode" | "phone" | "website" | "primaryCategory"
  >,
  hints: GoogleMatchHints,
): boolean {
  const q = hints.searchQueryFromUrl || "";
  const qNameMatch = q ? nameSimilarity(q, candidate.businessName) >= 0.65 : false;
  const baselineNameMatch = nameSimilarity(hints.pharmacyName, candidate.businessName) >= 0.55;
  const allowDeliveredName = qNameMatch || baselineNameMatch;

  if (!isLikelyPharmacy(candidate) && !qNameMatch && !baselineNameMatch) return false;
  if (!allowDeliveredName && isSuspiciousMatchName(candidate.businessName)) return false;

  const hintPc = normalizePostcode(hints.postcode);
  const candPc = normalizePostcode(candidate.postcode || extractPostcodeFromAddress(candidate.address));
  if (hintPc && candPc && hintPc === candPc) return true;

  const town = hints.town.toLowerCase();
  if (town && candidate.address.toLowerCase().includes(town)) return true;

  return qNameMatch || baselineNameMatch;
}

export function explainCandidateFilterReason(
  candidate: CustomerSetupGoogleCandidate,
  hints: GoogleMatchHints,
  explicitPlaceId: string,
): string {
  if (explicitPlaceId && candidate.placeId === explicitPlaceId) return "kept (explicit place ID)";
  if (candidate.confidence >= GOOGLE_MATCH_POSSIBLE_THRESHOLD) return "kept (confidence threshold met)";
  if (hints.kgMid && isPlausibleKgMidTextSearchCandidate(candidate, hints)) {
    return "kept (kgmid/q plausible single match)";
  }
  if (!isLikelyPharmacy(candidate)) return "rejected: not pharmacy/health category";
  if (isSuspiciousMatchName(candidate.businessName) && !isPlausibleKgMidTextSearchCandidate(candidate, hints)) {
    return "rejected: suspicious business name";
  }
  return `rejected: confidence ${candidate.confidence}% below ${GOOGLE_MATCH_POSSIBLE_THRESHOLD}%`;
}

export function scoreGoogleListingCandidate(
  candidate: Pick<
    CustomerSetupGoogleCandidate,
    "placeId" | "businessName" | "address" | "postcode" | "phone" | "website" | "primaryCategory" | "rating" | "reviewCount"
  >,
  hints: GoogleMatchHints,
): number {
  let score = 0;

  if (!isLikelyPharmacy(candidate)) return Math.min(score, 25);
  if (isSuspiciousMatchName(candidate.businessName, nameSimilarity(hints.pharmacyName, candidate.businessName) >= 0.55)) score -= 45;

  score += Math.round(nameSimilarity(hints.pharmacyName, candidate.businessName) * 30);

  const hintPc = normalizePostcode(hints.postcode);
  const candPc = normalizePostcode(candidate.postcode || extractPostcodeFromAddress(candidate.address));
  if (hintPc && candPc) {
    if (hintPc === candPc) score += 25;
    else score -= 40;
  } else if (hintPc && candidate.address.toUpperCase().replace(/\s+/g, "").includes(hintPc.replace(/\s+/g, ""))) {
    score += 12;
  }

  const town = hints.town.toLowerCase();
  if (town && candidate.address.toLowerCase().includes(town)) score += 15;

  if (hints.phone && candidate.phone && normalizePhone(hints.phone) === normalizePhone(candidate.phone)) {
    score += 15;
  }

  if (hints.website && candidate.website) {
    const hintHost = websiteHost(hints.website);
    const candHost = websiteHost(candidate.website);
    if (hintHost && candHost && (hintHost === candHost || candHost.endsWith(hintHost) || hintHost.endsWith(candHost))) {
      score += detectNationalChainWebsite(hints.website) ? 3 : 10;
    }
  }

  const explicitPlaceId = hints.googlePlaceId || parseGooglePlaceIdFromUrl(hints.googleBusinessUrl || "");
  if (explicitPlaceId && candidate.placeId === explicitPlaceId) {
    return Math.max(score, 92);
  }

  if (candidate.rating != null && candidate.reviewCount > 0) score += 5;

  return Math.max(0, Math.min(100, score));
}

export function shouldAutoConfirmGoogleMatch(
  candidates: CustomerSetupGoogleCandidate[],
  nationalWebsite: boolean,
  explicitPlaceId: boolean,
): boolean {
  if (nationalWebsite) return false;
  if (!candidates.length) return false;

  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const best = sorted[0];
  const second = sorted[1];

  if (explicitPlaceId && best.confidence >= 75) return true;
  if (best.confidence >= GOOGLE_MATCH_AUTO_CONFIRM_THRESHOLD && (!second || best.confidence - second.confidence >= 15)) {
    return true;
  }
  return false;
}

export function isPlausibleGoogleImportCandidate(
  candidate: CustomerSetupGoogleCandidate,
  hints: GoogleMatchHints,
): boolean {
  return (
    candidate.confidence >= GOOGLE_MATCH_POSSIBLE_THRESHOLD ||
    isPlausibleKgMidTextSearchCandidate(candidate, hints)
  );
}

export function hasStrongBaselineLocationConflict(
  candidate: Pick<CustomerSetupGoogleCandidate, "address" | "postcode">,
  hints: GoogleMatchHints,
): boolean {
  const hintPc = normalizePostcode(hints.postcode);
  const candPc = normalizePostcode(candidate.postcode || extractPostcodeFromAddress(candidate.address));
  const town = hints.town.toLowerCase().trim();
  if (!hintPc && !town) return false;

  const townMatch = !town || candidate.address.toLowerCase().includes(town);
  if (hintPc && candPc && hintPc !== candPc && !townMatch) return true;
  if (town && hintPc && !townMatch && candPc && hintPc !== candPc) return true;
  return false;
}

/** Direct import when user supplied a Google URL and exactly one plausible listing matches baseline. */
export function shouldDirectImportFromGoogleUrl(
  candidates: CustomerSetupGoogleCandidate[],
  hints: GoogleMatchHints,
  nationalWebsite: boolean,
): boolean {
  if (nationalWebsite) return false;
  const plausible = candidates.filter((c) => isPlausibleGoogleImportCandidate(c, hints));
  if (plausible.length !== 1) return false;
  return !hasStrongBaselineLocationConflict(plausible[0], hints);
}

export async function fetchEnrichedGoogleImportCandidate(
  candidate: CustomerSetupGoogleCandidate,
  hints: GoogleMatchHints,
): Promise<{
  candidate: CustomerSetupGoogleCandidate;
  openingHours: string[];
  latitude: number | null;
  longitude: number | null;
}> {
  const { place } = await fetchPlaceRecord(candidate.placeId);
  if (!place) {
    return { candidate, openingHours: [], latitude: null, longitude: null };
  }

  const enriched = candidateFromPlace(place, hints);
  const regular = place.regularOpeningHours as Record<string, unknown> | undefined;
  const lat = (place.location as Record<string, unknown> | undefined)?.latitude;
  const lng = (place.location as Record<string, unknown> | undefined)?.longitude;

  return {
    candidate: {
      ...candidate,
      ...enriched,
      confidence: Math.max(candidate.confidence, enriched.confidence),
    },
    openingHours: formatWeekdayDescriptions(regular),
    latitude: lat != null && lat !== "" ? Number(lat) : null,
    longitude: lng != null && lng !== "" ? Number(lng) : null,
  };
}

function formatWeekdayDescriptions(hours: Record<string, unknown> | undefined): string[] {
  if (!hours) return [];
  const desc = hours.weekdayDescriptions;
  if (Array.isArray(desc)) return desc.map(String).filter(Boolean);
  return [];
}

function mapPlaceToCandidate(p: Record<string, unknown>): Omit<CustomerSetupGoogleCandidate, "confidence" | "distanceKm" | "distanceLabel"> {
  const types = Array.isArray(p.types) ? p.types.map(String) : [];
  const primaryType = String(p.primaryType || types[0] || "").replace(/_/g, " ");
  const pid = String(p.id || "").replace(/^places\//, "");
  const address = String(p.formattedAddress || "");
  const ratingRaw = p.rating;

  return {
    placeId: pid,
    businessName: String((p.displayName as Record<string, unknown>)?.text || ""),
    address,
    postcode: extractPostcodeFromAddress(address),
    phone: String(p.nationalPhoneNumber || p.internationalPhoneNumber || ""),
    website: String(p.websiteUri || ""),
    rating:
      ratingRaw === null || ratingRaw === undefined || ratingRaw === ""
        ? null
        : Math.min(5, Math.max(0, Number(ratingRaw) || 0)),
    reviewCount: Math.max(0, Number(p.userRatingCount) || 0),
    photoCount: Array.isArray(p.photos) ? p.photos.length : 0,
    primaryCategory: primaryType || "Pharmacy",
    googleMapsUrl: String(
      p.googleMapsUri || (pid ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(pid)}` : ""),
    ),
  };
}

async function fetchPlaceRecord(
  placeId: string,
): Promise<{ place: Record<string, unknown> | null; error: GooglePlacesConnectionError | null }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !placeId) return { place: null, error: null };

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
      return { place: null, error: classifyPlacesHttpError(res.status, body) };
    }
    return { place: (await res.json()) as Record<string, unknown>, error: null };
  } catch (err: unknown) {
    return {
      place: null,
      error: {
        code: "unknown-api-error",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function searchPlacesText(query: string, maxResultCount = 5): Promise<Record<string, unknown>[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !query.trim()) return [];

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": SEARCH_TEXT_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, maxResultCount }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { places?: Record<string, unknown>[] };
    return data.places || [];
  } catch {
    return [];
  }
}

function candidateFromPlace(
  place: Record<string, unknown>,
  hints: GoogleMatchHints,
): CustomerSetupGoogleCandidate {
  const base = mapPlaceToCandidate(place);
  return {
    ...base,
    distanceKm: null,
    distanceLabel: "—",
    confidence: scoreGoogleListingCandidate(base, hints),
  };
}

function listingFromCandidate(candidate: CustomerSetupGoogleCandidate, openingHours: string[] = []): CustomerSetupGoogleListing {
  return {
    placeId: candidate.placeId,
    businessName: candidate.businessName,
    address: candidate.address,
    postcode: candidate.postcode,
    phone: candidate.phone,
    website: candidate.website,
    rating: candidate.rating,
    reviewCount: candidate.reviewCount,
    photoCount: candidate.photoCount,
    primaryCategory: candidate.primaryCategory,
    openingHours,
    googleMapsUrl: candidate.googleMapsUrl,
    latitude: null,
    longitude: null,
    confirmedAt: new Date().toISOString(),
  };
}

function listingFromPlace(place: Record<string, unknown>): CustomerSetupGoogleListing {
  const candidate = mapPlaceToCandidate(place);
  const regular = place.regularOpeningHours as Record<string, unknown> | undefined;
  const lat = (place.location as Record<string, unknown>)?.latitude;
  const lng = (place.location as Record<string, unknown>)?.longitude;
  return {
    ...listingFromCandidate({
      ...candidate,
      distanceKm: null,
      distanceLabel: "—",
      confidence: 100,
    }, formatWeekdayDescriptions(regular)),
    latitude: lat != null ? Number(lat) : null,
    longitude: lng != null ? Number(lng) : null,
  };
}

function yourPharmacyFromListing(listing: CustomerSetupGoogleListing): GrowthEngineYourPharmacy {
  return {
    placeId: listing.placeId,
    businessName: listing.businessName,
    distanceKm: 0,
    distanceLabel: "Your location",
    latitude: listing.latitude,
    longitude: listing.longitude,
    address: listing.address,
    phone: listing.phone,
    website: listing.website,
    primaryCategory: listing.primaryCategory,
    secondaryCategories: [],
    rating: listing.rating,
    reviewCount: listing.reviewCount,
    photoCount: listing.photoCount,
    businessStatus: "OPERATIONAL",
    openingStatus: listing.openingHours.length ? "Hours available" : "",
    openingHours: listing.openingHours,
    attributes: [],
    businessDescription: "",
    directionsUrl: listing.googleMapsUrl,
    googleMapsUrl: listing.googleMapsUrl,
    notes: "",
    source: "google-places",
    isYourPharmacy: true,
  };
}

function upsertSnapshotYourPharmacy(slug: string, listing: CustomerSetupGoogleListing): void {
  const existing = loadCompetitorSnapshot(slug);
  const yourPharmacy = yourPharmacyFromListing(listing);
  if (existing) {
    writeCompetitorSnapshot({ ...existing, yourPharmacy, generatedAt: new Date().toISOString() });
    return;
  }
  writeCompetitorSnapshot({
    version: LOCAL_MARKET_SNAPSHOT_VERSION,
    slug,
    generatedAt: new Date().toISOString(),
    source: "demo-no-google-key",
    targetCount: 10,
    pharmacy: {
      name: listing.businessName,
      address: listing.address,
      postcode: listing.postcode,
      latitude: listing.latitude,
      longitude: listing.longitude,
    },
    yourPharmacy,
    competitors: [],
    analysis: buildLocalMarketAnalysis(yourPharmacy, [], "demo-no-google-key"),
    healthcare: {
      version: 1,
      generatedAt: new Date().toISOString(),
      providers: [],
      analysis: buildHealthcareAnalysis([], [], yourPharmacy, "demo-no-google-key"),
      mapModel: buildHealthcareMapModel(yourPharmacy, [], []),
    },
    placesError: null,
    lastDiscoverAttemptAt: new Date().toISOString(),
  });
}

function applyConfirmedListingToProfile(
  data: PharmacyProfileData,
  listing: CustomerSetupGoogleListing,
): PharmacyProfileData {
  const now = new Date().toISOString();
  const googleImportedFieldKeys = [
    "googlePlaceId",
    "googleBusinessProfileUrl",
    "googleBusinessRating",
    "googleBusinessReviewCount",
    "googleCategory",
    "googlePhotoCount",
  ];

  return normalizeProfileData({
    ...data,
    googlePlaceId: listing.placeId,
    googleBusinessProfileUrl: listing.googleMapsUrl,
    googleBusinessRating: listing.rating,
    googleBusinessReviewCount: listing.reviewCount,
    latitude: listing.latitude != null ? String(listing.latitude) : data.latitude,
    longitude: listing.longitude != null ? String(listing.longitude) : data.longitude,
    customerSetupGoogleListing: listing,
    customerSetupGoogleMatchStatus: "confirmed",
    customerSetupGoogleCandidates: [],
    googleImportedFieldKeys,
    profileFieldConfirmations: {
      ...(data.profileFieldConfirmations || {}),
      googlePlaceId: now,
      googleBusinessProfileUrl: now,
      googleBusinessRating: now,
      googleBusinessReviewCount: now,
    },
  });
}

export async function searchGoogleListingCandidatesDetailed(hints: GoogleMatchHints): Promise<GoogleListingSearchResult> {
  const explicitPlaceId = hints.googlePlaceId || parseGooglePlaceIdFromUrl(hints.googleBusinessUrl || "");
  const byId = new Map<string, CustomerSetupGoogleCandidate>();
  const filteredOut: Array<{ candidate: CustomerSetupGoogleCandidate; reason: string }> = [];
  let rawKgMidCandidates: CustomerSetupGoogleCandidate[] = [];
  const kgMidSearchQuery = hints.kgMid ? buildKgMidSearchQuery(hints) : "";

  if (explicitPlaceId) {
    const { place, error } = await fetchPlaceRecord(explicitPlaceId);
    if (place) {
      const candidate = candidateFromPlace(place, hints);
      byId.set(candidate.placeId, candidate);
    } else if (error) {
      filteredOut.push({
        candidate: {
          placeId: explicitPlaceId,
          businessName: "",
          address: "",
          postcode: "",
          phone: "",
          website: "",
          rating: null,
          reviewCount: 0,
          photoCount: 0,
          primaryCategory: "",
          googleMapsUrl: "",
          distanceKm: null,
          distanceLabel: "—",
          confidence: 0,
        },
        reason: `place details failed: ${error.message}`,
      });
    }
  }

  if (hasGooglePlacesApiKey() && hints.kgMid && kgMidSearchQuery) {
    const places = await searchPlacesText(kgMidSearchQuery, 5);
    rawKgMidCandidates = places
      .map((place) => candidateFromPlace(place, hints))
      .filter((c) => c.placeId);

    if (rawKgMidCandidates.length === 1) {
      const only = { ...rawKgMidCandidates[0] };
      if (isPlausibleKgMidTextSearchCandidate(only, hints)) {
        only.confidence = Math.max(only.confidence, GOOGLE_MATCH_POSSIBLE_THRESHOLD);
        byId.set(only.placeId, only);
      } else {
        filteredOut.push({
          candidate: only,
          reason: explainCandidateFilterReason(only, hints, explicitPlaceId),
        });
      }
    } else {
      for (const candidate of rawKgMidCandidates) {
        if (isPlausibleKgMidTextSearchCandidate(candidate, hints)) {
          const boosted = {
            ...candidate,
            confidence: Math.max(candidate.confidence, GOOGLE_MATCH_POSSIBLE_THRESHOLD),
          };
          byId.set(boosted.placeId, boosted);
        } else {
          filteredOut.push({
            candidate,
            reason: explainCandidateFilterReason(candidate, hints, explicitPlaceId),
          });
        }
      }
    }
  }

  if (hasGooglePlacesApiKey()) {
    const queries = [
      kgMidSearchQuery,
      [hints.pharmacyName, "pharmacy", hints.postcode].filter(Boolean).join(" "),
      [hints.pharmacyName, hints.town, hints.postcode].filter(Boolean).join(" "),
      hints.phone ? [hints.pharmacyName, hints.phone, hints.town].filter(Boolean).join(" ") : "",
    ].filter(Boolean);

    const seenQueries = new Set<string>();
    for (const query of queries) {
      const key = query.toLowerCase();
      if (seenQueries.has(key)) continue;
      seenQueries.add(key);

      const places = await searchPlacesText(query, 5);
      for (const place of places) {
        const candidate = candidateFromPlace(place, hints);
        if (!candidate.placeId) continue;
        const existing = byId.get(candidate.placeId);
        if (!existing || candidate.confidence > existing.confidence) {
          byId.set(candidate.placeId, candidate);
        }
      }
    }
  }

  const allCandidates = [...byId.values()];
  const candidates = allCandidates
    .filter((c) => {
      const keep =
        c.confidence >= GOOGLE_MATCH_POSSIBLE_THRESHOLD ||
        explicitPlaceId === c.placeId ||
        (hints.kgMid && rawKgMidCandidates.length === 1 && isPlausibleKgMidTextSearchCandidate(c, hints));
      if (!keep) {
        filteredOut.push({ candidate: c, reason: explainCandidateFilterReason(c, hints, explicitPlaceId) });
      }
      return keep;
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  return { candidates, rawKgMidCandidates, kgMidSearchQuery, filteredOut };
}

export async function searchGoogleListingCandidates(hints: GoogleMatchHints): Promise<CustomerSetupGoogleCandidate[]> {
  const result = await searchGoogleListingCandidatesDetailed(hints);
  return result.candidates;
}

export async function runCustomerSetupGoogleMatch(slug: string): Promise<GoogleMatchRunResult> {
  const data = readSetupProfile(slug);
  const hints: GoogleMatchHints = {
    pharmacyName: data.pharmacyName || data.tradingName || "",
    town: data.primaryTown || data.townCity || "",
    postcode: data.postcode || "",
    phone: data.phone || "",
    website: data.website || "",
    googlePlaceId: data.googlePlaceId || "",
    googleBusinessUrl: data.googleBusinessProfileUrl || "",
  };

  const nationalWebsiteDetected = detectNationalChainWebsite(hints.website || "");
  const explicitPlaceId = Boolean(hints.googlePlaceId || parseGooglePlaceIdFromUrl(hints.googleBusinessUrl || ""));
  const warnings: string[] = [];
  let candidates = await searchGoogleListingCandidates(hints);

  if (!candidates.length && !hasGooglePlacesApiKey()) {
    const patch = normalizeProfileData({
      ...data,
      customerSetupGoogleMatchStatus: "not_found",
      customerSetupGoogleCandidates: [],
      customerSetupNationalWebsiteDetected: nationalWebsiteDetected,
      googlePlaceId: explicitPlaceId ? data.googlePlaceId : "",
    });
    writeProfile(slug, patch);
    return { status: "not_found", candidates: [], nationalWebsiteDetected, autoConfirmed: false, warnings };
  }

  if (!candidates.length) {
    const patch = normalizeProfileData({
      ...data,
      customerSetupGoogleMatchStatus: "not_found",
      customerSetupGoogleCandidates: [],
      customerSetupNationalWebsiteDetected: nationalWebsiteDetected,
      googlePlaceId: "",
    });
    writeProfile(slug, patch);
    return { status: "not_found", candidates: [], nationalWebsiteDetected, autoConfirmed: false, warnings };
  }

  const autoConfirm = shouldAutoConfirmGoogleMatch(candidates, nationalWebsiteDetected, explicitPlaceId);

  if (autoConfirm) {
    const best = candidates[0];
    const { place } = await fetchPlaceRecord(best.placeId);
    const listing = place ? listingFromPlace(place) : listingFromCandidate(best);
    const confirmed = applyConfirmedListingToProfile(data, listing);
    writeProfile(slug, confirmed);
    upsertSnapshotYourPharmacy(slug, listing);
    return {
      status: "confirmed",
      candidates: [],
      nationalWebsiteDetected,
      autoConfirmed: true,
      warnings,
    };
  }

  const patch = normalizeProfileData({
    ...data,
    customerSetupGoogleMatchStatus: "possible_match",
    customerSetupGoogleCandidates: candidates,
    customerSetupNationalWebsiteDetected: nationalWebsiteDetected,
    customerSetupGoogleListing: null,
    googlePlaceId: "",
    googleBusinessRating: null,
    googleBusinessReviewCount: 0,
    googleImportedFieldKeys: [],
  });
  writeProfile(slug, patch);

  return {
    status: "possible_match",
    candidates,
    nationalWebsiteDetected,
    autoConfirmed: false,
    warnings,
  };
}

export async function confirmCustomerSetupGoogleListing(
  slug: string,
  placeId: string,
): Promise<{ ok: boolean; listing: CustomerSetupGoogleListing | null }> {
  const data = readSetupProfile(slug);
  const hints: GoogleMatchHints = {
    pharmacyName: data.pharmacyName || "",
    town: data.primaryTown || data.townCity || "",
    postcode: data.postcode || "",
    phone: data.phone || "",
    website: data.website || "",
    googlePlaceId: placeId,
  };

  const { place } = await fetchPlaceRecord(placeId);
  if (!place) {
    const fromCandidates = (data.customerSetupGoogleCandidates || []).find((c) => c.placeId === placeId);
    if (!fromCandidates) throw new Error("Could not load the selected Google listing.");
    const listing = listingFromCandidate(fromCandidates);
    const confirmed = applyConfirmedListingToProfile(data, listing);
    writeProfile(slug, confirmed);
    upsertSnapshotYourPharmacy(slug, listing);
    return { ok: true, listing };
  }

  const listing = listingFromPlace(place);
  if (scoreGoogleListingCandidate(listing, hints) < 40 && !parseGooglePlaceIdFromUrl(data.googleBusinessProfileUrl || "")) {
    throw new Error("This listing does not closely match your pharmacy details.");
  }

  const confirmed = applyConfirmedListingToProfile(data, listing);
  writeProfile(slug, confirmed);
  upsertSnapshotYourPharmacy(slug, listing);
  return { ok: true, listing };
}

export function rejectCustomerSetupGoogleListing(slug: string, placeId?: string): { ok: boolean } {
  const data = readSetupProfile(slug);
  if (placeId) {
    const remaining = (data.customerSetupGoogleCandidates || []).filter((c) => c.placeId !== placeId);
    if (remaining.length) {
      writeProfile(
        slug,
        normalizeProfileData({
          ...data,
          customerSetupGoogleMatchStatus: "possible_match",
          customerSetupGoogleCandidates: remaining,
        }),
      );
      return { ok: true };
    }
  }

  writeProfile(
    slug,
    normalizeProfileData({
      ...data,
      customerSetupGoogleMatchStatus: "rejected",
      customerSetupGoogleCandidates: [],
      customerSetupGoogleListing: null,
      googlePlaceId: "",
      googleBusinessRating: null,
      googleBusinessReviewCount: 0,
      googleImportedFieldKeys: [],
    }),
  );
  return { ok: true };
}

export async function searchAgainCustomerSetupGoogleListings(
  slug: string,
  input?: { googleBusinessUrl?: string },
): Promise<GoogleMatchRunResult> {
  const data = readSetupProfile(slug);
  const mapsUrl = str(input?.googleBusinessUrl);
  const placeId = parseGooglePlaceIdFromUrl(mapsUrl);

  const patch = normalizeProfileData({
    ...data,
    googleBusinessProfileUrl: mapsUrl || data.googleBusinessProfileUrl,
    googlePlaceId: placeId || (mapsUrl ? "" : data.googlePlaceId),
    customerSetupGoogleMatchStatus: "none",
    customerSetupGoogleCandidates: [],
    customerSetupGoogleListing: null,
  });
  writeProfile(slug, patch);
  return runCustomerSetupGoogleMatch(slug);
}

/** Build a scored candidate for tests without calling Google APIs. */
export function buildScoredGoogleCandidate(
  partial: Partial<CustomerSetupGoogleCandidate> & Pick<CustomerSetupGoogleCandidate, "placeId" | "businessName" | "address">,
  hints: GoogleMatchHints,
): CustomerSetupGoogleCandidate {
  const candidate: CustomerSetupGoogleCandidate = {
    placeId: partial.placeId,
    businessName: partial.businessName,
    address: partial.address,
    postcode: partial.postcode || extractPostcodeFromAddress(partial.address),
    phone: partial.phone || "",
    website: partial.website || "",
    rating: partial.rating ?? null,
    reviewCount: partial.reviewCount ?? 0,
    photoCount: partial.photoCount ?? 0,
    primaryCategory: partial.primaryCategory || "Pharmacy",
    googleMapsUrl: partial.googleMapsUrl || "",
    distanceKm: partial.distanceKm ?? null,
    distanceLabel: partial.distanceLabel || "—",
    confidence: 0,
  };
  candidate.confidence = scoreGoogleListingCandidate(candidate, hints);
  return candidate;
}
