/**
 * Pharmacy Competitor Intelligence V1 —
 * enriches discovered competitors with Google Place Details.
 * Distances, identities, coordinates, ratings and review counts from
 * discovery are preserved. Missing Place Details stay unknown.
 */
import fs from "node:fs";
import path from "node:path";
import {
  COMPETITOR_INTEL_DIR,
  type CompetitorDiscoveryResult,
  type DiscoveredCompetitor,
  loadCompetitorDiscoveryResult,
} from "./pharmacyCompetitorDiscovery.ts";
import {
  GOOGLE_PLACE_DETAILS_FIELD_MASK,
  googlePlaceDetailsUrl,
  parseGooglePlaceDetails,
  sanitizeGoogleLocalCompetitorEvidence,
  type GooglePlaceOpeningHoursEvidence,
  type GooglePlacePhotoRef,
  type GooglePlaceReviewEvidence,
  type ParsedGooglePlaceDetails,
} from "./googleLocalCompetitorEvidence.ts";

export interface CompetitorReview {
  rating: number | null;
  text: string;
  relativeTime: string;
  author: string;
}

export interface CompetitorOpeningHours {
  weekdayDescriptions: string[];
  openNow: boolean | null;
}

export interface EnrichedCompetitor extends DiscoveredCompetitor {
  categories: string[];
  types: string[];
  primaryType: string | null;
  gbpRating: number | null;
  gbpReviewCount: number | null;
  reviews: CompetitorReview[];
  services: string[];
  openingHours: CompetitorOpeningHours | null;
  currentOpeningHours: CompetitorOpeningHours | null;
  businessStatus: string | null;
  internationalPhone: string | null;
  mapsUrl: string | null;
  photos: GooglePlacePhotoRef[] | null;
  photoCount: number | null;
  photosCaptured: boolean;
  chainBrand: string | null;
  independent: boolean;
  hasWebsite: boolean;
  hasPhone: boolean;
}

export interface CompetitorIntelligenceResult {
  slug: string;
  generatedAt: string;
  source: string;
  pharmacy: CompetitorDiscoveryResult["pharmacy"];
  competitors: EnrichedCompetitor[];
  competitorSummary: {
    count: number;
    avgRating: number;
    avgReviewCount: number;
    nearestDistanceKm: number;
    chainCount: number;
    independentCount: number;
    withWebsite: number;
    withPhone: number;
  };
}

const CHAIN_PATTERNS: Array<[RegExp, string]> = [
  [/boots/i, "Boots"],
  [/lloyds/i, "Lloyds"],
  [/well pharmacy/i, "Well"],
  [/superdrug/i, "Superdrug"],
  [/asda/i, "ASDA"],
  [/tesco/i, "Tesco"],
  [/morrisons/i, "Morrisons"],
  [/rowlands/i, "Rowlands"],
  [/day lewis/i, "Day Lewis"],
  [/cohens/i, "Cohens"],
];

/** @deprecated Not used as Google evidence. Retained for existing importers. */
export const SERVICE_KEYWORDS: Record<string, string[]> = {
  "prescription-dispensing": ["prescription", "dispensing", "nhs prescription"],
  "repeat-prescriptions": ["repeat prescription", "repeat medicines"],
  "pharmacy-first": ["pharmacy first", "minor illness", "nhs consultation"],
  "blood-pressure-checks": ["blood pressure", "hypertension screening"],
  "flu-vaccinations": ["flu jab", "flu vaccination", "influenza"],
  "covid-vaccinations": ["covid", "coronavirus vaccination"],
  "travel-vaccinations": ["travel vaccination", "travel clinic", "travel jab"],
  "travel-health-consultations": ["travel health", "malaria", "travel advice"],
  "smoking-cessation": ["stop smoking", "smoking cessation", "quit smoking"],
  "weight-management": ["weight management", "weight loss"],
  "ear-wax-removal": ["ear wax", "microsuction"],
  "new-medicine-service": ["new medicine service", "nms"],
  "emergency-contraception": ["emergency contraception", "morning after"],
  "pharmacy-contraception-service": ["contraception", "pill consultation"],
  "minor-ailments": ["minor ailments", "common conditions"],
  "malaria-prevention": ["malaria", "antimalarial"],
  "vitamin-b12-injections": ["b12", "vitamin b12"],
  "health-checks": ["health check", "health screening"],
  "medication-reviews": ["medication review", "medicines use review"],
  "nhs-services": ["nhs services", "nhs pharmacy"],
};

function detectChain(name: string): { chainBrand: string | null; independent: boolean } {
  for (const [pattern, brand] of CHAIN_PATTERNS) {
    if (pattern.test(name)) return { chainBrand: brand, independent: false };
  }
  return { chainBrand: null, independent: true };
}

export type PlaceDetailsFetch = (placeId: string) => Promise<Record<string, unknown> | null>;

export async function fetchGooglePlaceDetails(
  placeId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown> | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const url = googlePlaceDetailsUrl(placeId);
  if (!key || !url || placeId.startsWith("demo-")) return null;

  const res = await fetchImpl(url, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": GOOGLE_PLACE_DETAILS_FIELD_MASK,
    },
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as unknown;
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
}

function hoursFromDetails(
  hours: GooglePlaceOpeningHoursEvidence | null,
): CompetitorOpeningHours | null {
  if (!hours) return null;
  return {
    weekdayDescriptions: hours.weekdayDescriptions,
    openNow: hours.openNow,
  };
}

function reviewsFromDetails(reviews: GooglePlaceReviewEvidence[]): CompetitorReview[] {
  return reviews
    .filter((review) => Boolean(review.text))
    .map((review) => ({
      rating: review.rating,
      text: review.text,
      relativeTime: review.relativeTime,
      author: review.author,
    }));
}

export function enrichCompetitorFromDiscovery(competitor: DiscoveredCompetitor): EnrichedCompetitor {
  const { chainBrand, independent } = detectChain(competitor.name);
  return {
    ...competitor,
    categories: [],
    types: [],
    primaryType: null,
    gbpRating: competitor.rating,
    gbpReviewCount: competitor.reviewCount ?? null,
    reviews: [],
    services: [],
    openingHours: null,
    currentOpeningHours: null,
    businessStatus: null,
    internationalPhone: null,
    mapsUrl: null,
    photos: null,
    photoCount: null,
    photosCaptured: false,
    chainBrand,
    independent,
    hasWebsite: Boolean(competitor.website),
    hasPhone: Boolean(competitor.phone),
  };
}

export function applyPlaceDetailsToCompetitor(
  competitor: EnrichedCompetitor,
  details: ParsedGooglePlaceDetails,
): EnrichedCompetitor {
  return {
    ...competitor,
    name: details.displayName || competitor.name,
    address: details.formattedAddress || competitor.address,
    latitude: competitor.latitude,
    longitude: competitor.longitude,
    distanceKm: competitor.distanceKm,
    distanceLabel: competitor.distanceLabel,
    placeId: competitor.placeId,
    gbpRating: details.rating ?? competitor.gbpRating,
    rating: details.rating ?? competitor.rating,
    gbpReviewCount: details.userRatingCount ?? competitor.gbpReviewCount,
    reviewCount: details.userRatingCount ?? competitor.reviewCount,
    website: details.websiteUri || competitor.website,
    phone: details.nationalPhoneNumber || competitor.phone,
    internationalPhone: details.internationalPhoneNumber,
    mapsUrl: details.googleMapsUri,
    primaryType: details.primaryType,
    types: details.types,
    categories: details.categories,
    businessStatus: details.businessStatus,
    openingHours: hoursFromDetails(details.regularOpeningHours),
    currentOpeningHours: hoursFromDetails(details.currentOpeningHours),
    reviews: reviewsFromDetails(details.reviews),
    services: [],
    photos: details.photos,
    photoCount: details.photoCount,
    photosCaptured: details.photosCaptured,
    hasWebsite: Boolean(details.websiteUri || competitor.website),
    hasPhone: Boolean(details.nationalPhoneNumber || competitor.phone),
  };
}

export function buildCompetitorSummary(
  competitors: EnrichedCompetitor[],
): CompetitorIntelligenceResult["competitorSummary"] {
  const ratings = competitors.map((c) => c.gbpRating).filter((r): r is number => r != null);
  const reviews = competitors.map((c) => c.gbpReviewCount).filter((r): r is number => r != null);
  const distances = competitors.map((c) => c.distanceKm);
  return {
    count: competitors.length,
    avgRating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0,
    avgReviewCount: reviews.length ? Math.round(reviews.reduce((a, b) => a + b, 0) / reviews.length) : 0,
    nearestDistanceKm: distances.length ? Math.min(...distances) : 0,
    chainCount: competitors.filter((c) => !c.independent).length,
    independentCount: competitors.filter((c) => c.independent).length,
    withWebsite: competitors.filter((c) => c.hasWebsite).length,
    withPhone: competitors.filter((c) => c.hasPhone).length,
  };
}

export async function buildCompetitorIntelligence(
  discovery: CompetitorDiscoveryResult,
  options?: { fetchPlaceDetails?: PlaceDetailsFetch },
): Promise<CompetitorIntelligenceResult> {
  const fetchDetails = options?.fetchPlaceDetails;
  const competitors: EnrichedCompetitor[] = [];

  for (const base of discovery.competitors) {
    let enriched = enrichCompetitorFromDiscovery(base);
    const canFetch = Boolean(base.placeId) && !String(base.placeId).startsWith("demo-");
    if (canFetch && (fetchDetails || process.env.GOOGLE_PLACES_API_KEY)) {
      const payload = fetchDetails
        ? await fetchDetails(base.placeId)
        : await fetchGooglePlaceDetails(base.placeId);
      if (payload) {
        enriched = applyPlaceDetailsToCompetitor(enriched, parseGooglePlaceDetails(payload));
      }
    }
    competitors.push(enriched);
  }

  return {
    slug: discovery.slug,
    generatedAt: new Date().toISOString(),
    source: discovery.source,
    pharmacy: discovery.pharmacy,
    competitors,
    competitorSummary: buildCompetitorSummary(competitors),
  };
}

export function inferCompetitorHasService(competitor: EnrichedCompetitor, _serviceId: string): boolean {
  void competitor;
  void _serviceId;
  return false;
}

export function writeCompetitorIntelligence(result: CompetitorIntelligenceResult): string {
  fs.mkdirSync(COMPETITOR_INTEL_DIR, { recursive: true });
  const file = path.join(COMPETITOR_INTEL_DIR, `${result.slug}-intelligence.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  return file;
}

export function loadCompetitorIntelligence(slug: string): CompetitorIntelligenceResult | null {
  const file = path.join(COMPETITOR_INTEL_DIR, `${slug}-intelligence.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as CompetitorIntelligenceResult;
    return {
      ...parsed,
      competitors: (parsed.competitors || []).map((row) => sanitizeGoogleLocalCompetitorEvidence(row)),
    };
  } catch {
    return null;
  }
}

export async function runCompetitorIntelligencePipeline(
  slug: string,
): Promise<CompetitorIntelligenceResult> {
  const discovery = loadCompetitorDiscoveryResult(slug);
  if (!discovery) throw new Error(`Competitor discovery not found for ${slug}`);
  return buildCompetitorIntelligence(discovery);
}
