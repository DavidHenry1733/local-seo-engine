/**
 * Google-local competitor evidence contract.
 *
 * Place Details must use places/{placeId}. Missing fields stay unknown.
 * Demo reviews, demo hours, inferred clinical services and inferred
 * categories are never treated as Google evidence — including on older
 * stored artifacts at read time.
 */
export const GOOGLE_PLACE_DETAILS_BASE_URL = "https://places.googleapis.com/v1";

export const GOOGLE_PLACE_DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "primaryType",
  "types",
  "businessStatus",
  "regularOpeningHours",
  "currentOpeningHours",
  "photos",
].join(",");

export const INFERRED_CATEGORY_VOCABULARY = [
  "Pharmacy",
  "Health",
  "Chemist",
  "Travel Clinic",
  "NHS Services",
] as const;

export const DEMO_OPENING_HOURS_WEEKDAYS = [
  "Monday: 9:00 AM – 6:00 PM",
  "Tuesday: 9:00 AM – 6:00 PM",
  "Wednesday: 9:00 AM – 6:00 PM",
  "Thursday: 9:00 AM – 7:00 PM",
  "Friday: 9:00 AM – 6:00 PM",
  "Saturday: 9:00 AM – 5:00 PM",
  "Sunday: Closed",
] as const;

export const DEMO_REVIEW_AUTHORS = ["Local patient", "Verified visitor", "Community member"] as const;

export const INFERRED_CLINICAL_SERVICE_IDS = [
  "prescription-dispensing",
  "repeat-prescriptions",
  "pharmacy-first",
  "blood-pressure-checks",
  "flu-vaccinations",
  "covid-vaccinations",
  "travel-vaccinations",
  "travel-health-consultations",
  "smoking-cessation",
  "weight-management",
  "ear-wax-removal",
  "new-medicine-service",
  "emergency-contraception",
  "pharmacy-contraception-service",
  "minor-ailments",
  "malaria-prevention",
  "vitamin-b12-injections",
  "health-checks",
  "medication-reviews",
  "nhs-services",
] as const;

export interface GooglePlacePhotoRef {
  name: string;
  widthPx: number | null;
  heightPx: number | null;
}

export interface GooglePlaceReviewEvidence {
  rating: number | null;
  text: string;
  relativeTime: string;
  author: string;
}

export interface GooglePlaceOpeningHoursEvidence {
  weekdayDescriptions: string[];
  openNow: boolean | null;
}

export interface ParsedGooglePlaceDetails {
  displayName: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingCount: number | null;
  nationalPhoneNumber: string | null;
  internationalPhoneNumber: string | null;
  websiteUri: string | null;
  googleMapsUri: string | null;
  primaryType: string | null;
  types: string[];
  categories: string[];
  businessStatus: string | null;
  regularOpeningHours: GooglePlaceOpeningHoursEvidence | null;
  currentOpeningHours: GooglePlaceOpeningHoursEvidence | null;
  reviews: GooglePlaceReviewEvidence[];
  photos: GooglePlacePhotoRef[] | null;
  photoCount: number | null;
  photosCaptured: boolean;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function googlePlaceDetailsResourceName(placeId: string): string {
  const id = clean(placeId);
  if (!id) return "";
  return id.startsWith("places/") ? id : `places/${id}`;
}

export function googlePlaceDetailsUrl(placeId: string): string {
  const resource = googlePlaceDetailsResourceName(placeId);
  return resource ? `${GOOGLE_PLACE_DETAILS_BASE_URL}/${resource}` : "";
}

export function isGooglePhotoReference(value: unknown): boolean {
  const row = asRecord(value);
  if (!row) return false;
  const name = clean(row.name || row.photo_reference);
  if (!name) return false;
  if (row.thumbnailUrl === null && (row.count === 0 || row.count == null)) return false;
  return name.startsWith("places/") || Boolean(row.photo_reference) || /\/photos\//.test(name);
}

export function evidenceBackedPhotoCount(
  count: unknown,
  photos?: unknown,
  photosCaptured?: unknown,
): number | null {
  const n = finiteNumber(count);
  const photoRefs = Array.isArray(photos) ? photos.filter(isGooglePhotoReference) : null;
  if (photosCaptured === true) {
    if (photoRefs) return photoRefs.length;
    return n;
  }
  if (photoRefs && photoRefs.length > 0) return photoRefs.length;
  if (n == null) return null;
  if (n > 0) return n;
  return null;
}

function parseOpeningHours(value: unknown): GooglePlaceOpeningHoursEvidence | null {
  const row = asRecord(value);
  if (!row) return null;
  const weekdayDescriptions = Array.isArray(row.weekdayDescriptions)
    ? row.weekdayDescriptions.map((item) => clean(item)).filter(Boolean)
    : [];
  const openNow = typeof row.openNow === "boolean" ? row.openNow : null;
  if (!weekdayDescriptions.length && openNow == null) return null;
  return { weekdayDescriptions, openNow };
}

function parseReview(value: unknown): GooglePlaceReviewEvidence | null {
  const row = asRecord(value);
  if (!row) return null;
  const textObj = asRecord(row.text);
  const original = asRecord(row.originalText);
  const authorObj = asRecord(row.authorAttribution);
  const text = clean(textObj?.text || original?.text || row.text);
  if (!text) return null;
  return {
    rating: finiteNumber(row.rating),
    text,
    relativeTime: clean(row.relativePublishTimeDescription || row.publishTime),
    author: clean(authorObj?.displayName || row.author),
  };
}

function parsePhoto(value: unknown): GooglePlacePhotoRef | null {
  if (!isGooglePhotoReference(value)) return null;
  const row = asRecord(value)!;
  return {
    name: clean(row.name || row.photo_reference),
    widthPx: finiteNumber(row.widthPx ?? row.width),
    heightPx: finiteNumber(row.heightPx ?? row.height),
  };
}

function formatGoogleType(value: unknown): string {
  return clean(value).replace(/_/g, " ");
}

export function parseGooglePlaceDetails(payload: unknown): ParsedGooglePlaceDetails {
  const p = asRecord(payload) || {};
  const display = asRecord(p.displayName);
  const location = asRecord(p.location);
  const types = Array.isArray(p.types) ? p.types.map((t) => clean(t)).filter(Boolean) : [];
  const primaryType = clean(p.primaryType) || null;
  const categories = [
    ...(primaryType ? [formatGoogleType(primaryType)] : []),
    ...types.filter((t) => t !== primaryType).map(formatGoogleType),
  ].filter(Boolean);
  const photosPresent = hasOwn(p, "photos");
  const photos = photosPresent && Array.isArray(p.photos) ? p.photos.map(parsePhoto).filter((item): item is GooglePlacePhotoRef => Boolean(item)) : null;

  return {
    displayName: clean(display?.text || p.displayName) || null,
    formattedAddress: clean(p.formattedAddress) || null,
    latitude: finiteNumber(location?.latitude),
    longitude: finiteNumber(location?.longitude),
    rating: finiteNumber(p.rating),
    userRatingCount: finiteNumber(p.userRatingCount),
    nationalPhoneNumber: clean(p.nationalPhoneNumber) || null,
    internationalPhoneNumber: clean(p.internationalPhoneNumber) || null,
    websiteUri: clean(p.websiteUri) || null,
    googleMapsUri: clean(p.googleMapsUri) || null,
    primaryType,
    types,
    categories,
    businessStatus: clean(p.businessStatus) || null,
    regularOpeningHours: parseOpeningHours(p.regularOpeningHours),
    currentOpeningHours: parseOpeningHours(p.currentOpeningHours),
    reviews: Array.isArray(p.reviews)
      ? p.reviews.map(parseReview).filter((item): item is GooglePlaceReviewEvidence => Boolean(item))
      : [],
    photos,
    photoCount: photosPresent ? (photos ? photos.length : null) : null,
    photosCaptured: photosPresent,
  };
}

export function isDemoReviewText(text: string, name?: string): boolean {
  const value = clean(text);
  if (!value) return false;
  if (/Helpful team at .+ — quick prescription collection and friendly advice\./i.test(value)) return true;
  if (name && value === `Helpful team at ${name} — quick prescription collection and friendly advice.`) return true;
  if (value === "Convenient location and reasonable wait times for a booked service.") return true;
  if (value === "Professional pharmacy service — would recommend for routine healthcare needs.") return true;
  return false;
}

export function isDemoReviewAuthor(author: string): boolean {
  return (DEMO_REVIEW_AUTHORS as readonly string[]).includes(clean(author));
}

export function isDemoReviewEvidence(
  review: { text?: string; author?: string; relativeTime?: string },
  name?: string,
): boolean {
  const demoTime =
    review.relativeTime === "2 weeks ago" ||
    review.relativeTime === "1 month ago" ||
    review.relativeTime === "2 months ago";
  return isDemoReviewText(String(review.text || ""), name) && (isDemoReviewAuthor(String(review.author || "")) || demoTime);
}

export function isDemoOpeningHoursEvidence(hours: { weekdayDescriptions?: string[] } | null | undefined): boolean {
  const days = hours?.weekdayDescriptions || [];
  if (days.length !== DEMO_OPENING_HOURS_WEEKDAYS.length) return false;
  return DEMO_OPENING_HOURS_WEEKDAYS.every((day, index) => day === days[index]);
}

export function isInferredGoogleCategorySet(categories: string[] | null | undefined): boolean {
  const values = (categories || []).map(clean).filter(Boolean);
  if (values.length < 2) return false;
  const vocab = new Set<string>(INFERRED_CATEGORY_VOCABULARY);
  if (!values.every((value) => vocab.has(value))) return false;
  return values.includes("Pharmacy") && values.includes("Health");
}

export function isInferredClinicalServiceId(serviceId: string): boolean {
  return (INFERRED_CLINICAL_SERVICE_IDS as readonly string[]).includes(clean(serviceId));
}

export function looksLikeInferredClinicalServices(services: string[] | null | undefined): boolean {
  const values = (services || []).map(clean).filter(Boolean);
  if (!values.length) return false;
  return values.every(isInferredClinicalServiceId);
}

export interface SanitizableGoogleLocalCompetitor {
  name?: string;
  categories?: string[] | null;
  types?: string[] | null;
  primaryType?: string | null;
  reviews?: Array<{ rating?: number | null; text?: string; relativeTime?: string; author?: string }> | null;
  services?: string[] | null;
  openingHours?: { weekdayDescriptions?: string[]; openNow?: boolean | null } | null;
  currentOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean | null } | null;
  photoCount?: number | null;
  photos?: unknown;
  photosCaptured?: boolean | null;
  mapsUrl?: string | null;
  googleMapsUri?: string | null;
  businessStatus?: string | null;
  internationalPhone?: string | null;
  [key: string]: unknown;
}

export function sanitizeGoogleLocalCompetitorEvidence<T extends SanitizableGoogleLocalCompetitor>(
  competitor: T,
): T {
  const name = clean(competitor.name);
  const reviews = Array.isArray(competitor.reviews)
    ? competitor.reviews.filter((review) => !isDemoReviewEvidence(review, name) && clean(review.text))
    : [];
  const openingHours = isDemoOpeningHoursEvidence(competitor.openingHours) ? null : competitor.openingHours || null;
  const currentOpeningHours = isDemoOpeningHoursEvidence(competitor.currentOpeningHours)
    ? null
    : competitor.currentOpeningHours || null;
  const rawCategories = Array.isArray(competitor.categories) ? competitor.categories.map(clean).filter(Boolean) : [];
  const types = Array.isArray(competitor.types) ? competitor.types.map(clean).filter(Boolean) : [];
  const categories = isInferredGoogleCategorySet(rawCategories) ? types.map((t) => t.replace(/_/g, " ")).filter(Boolean) : rawCategories;
  const services = looksLikeInferredClinicalServices(competitor.services) ? [] : (competitor.services || []).map(clean).filter(Boolean);
  const photoCount = evidenceBackedPhotoCount(competitor.photoCount, competitor.photos, competitor.photosCaptured);

  return {
    ...competitor,
    categories,
    types,
    reviews,
    services,
    openingHours,
    currentOpeningHours,
    photoCount,
    photos: Array.isArray(competitor.photos) ? competitor.photos.filter(isGooglePhotoReference) : competitor.photos ?? null,
  };
}
