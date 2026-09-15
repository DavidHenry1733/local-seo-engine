/**
 * Growth Engine — Local Market Intelligence V1 analysis (real Google Places data only).
 */
import type { GrowthEngineCompetitor, GrowthEngineYourPharmacy } from "./growthEngineCompetitorModel.ts";

export interface ComparisonRow {
  id: string;
  label: string;
  yourPharmacy: string;
  competitorAverage: string;
  highestCompetitor: string;
  hasData: boolean;
}

export interface LocalMarketAnalysis {
  competitorCount: number;
  dataSource: "google-places-live" | "unavailable";
  comparisons: ComparisonRow[];
  summaryParagraphs: string[];
  opportunities: string[];
  yourPharmacyComplete: boolean;
}

function fmtNum(n: number, decimals = 0): string {
  if (decimals === 0) return String(Math.round(n));
  return n.toFixed(decimals);
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function max(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.max(...nums);
}

function unavailable(): string {
  return "Not available";
}

function yourPharmacyHasVerifiedGoogleProfile(yours: GrowthEngineYourPharmacy | null): boolean {
  return Boolean(yours?.placeId && yours.source === "google-places");
}

function yourPharmacyMetric(
  value: number | null | undefined,
  yours: GrowthEngineYourPharmacy | null,
  decimals = 0,
): string {
  if (!yourPharmacyHasVerifiedGoogleProfile(yours)) return unavailable();
  if (value == null || value < 0) return unavailable();
  return fmtNum(value, decimals);
}

function pharmacyPhotoCountKnown(yours: GrowthEngineYourPharmacy | null): boolean {
  return yourPharmacyHasVerifiedGoogleProfile(yours) && yours != null && yours.photoCount >= 0;
}

/** Only competitors with verified Google Places source participate in maths. */
export function realGoogleCompetitors(competitors: GrowthEngineCompetitor[]): GrowthEngineCompetitor[] {
  return competitors.filter((c) => c.source === "google-places" && c.placeId && !c.placeId.startsWith("demo-"));
}

export function buildComparisonPanel(
  yours: GrowthEngineYourPharmacy | null,
  competitors: GrowthEngineCompetitor[],
): ComparisonRow[] {
  const pool = realGoogleCompetitors(competitors);
  const rows: ComparisonRow[] = [];

  const reviewCounts = pool.map((c) => c.reviewCount).filter((n) => n >= 0);
  const ratings = pool.map((c) => c.rating).filter((r): r is number => r != null);
  const photos = pool.map((c) => c.photoCount).filter((n) => n >= 0);
  const categoryCounts = pool.map((c) => 1 + c.secondaryCategories.length);

  const yourReviews = yourPharmacyHasVerifiedGoogleProfile(yours) ? (yours?.reviewCount ?? null) : null;
  const yourRating = yourPharmacyHasVerifiedGoogleProfile(yours) ? (yours?.rating ?? null) : null;
  const yourPhotos = yourPharmacyHasVerifiedGoogleProfile(yours) ? (yours?.photoCount ?? null) : null;
  const yourCats = yourPharmacyHasVerifiedGoogleProfile(yours) && yours ? 1 + yours.secondaryCategories.length : null;

  rows.push({
    id: "reviews",
    label: "Google Reviews",
    yourPharmacy: yourPharmacyMetric(yourReviews, yours),
    competitorAverage: reviewCounts.length ? fmtNum(avg(reviewCounts)!, 0) : unavailable(),
    highestCompetitor: reviewCounts.length ? fmtNum(max(reviewCounts)!) : unavailable(),
    hasData: reviewCounts.length > 0,
  });

  rows.push({
    id: "rating",
    label: "Average Rating",
    yourPharmacy: yourPharmacyMetric(yourRating, yours, 1),
    competitorAverage: ratings.length ? fmtNum(avg(ratings)!, 1) : unavailable(),
    highestCompetitor: ratings.length ? fmtNum(max(ratings)!, 1) : unavailable(),
    hasData: ratings.length > 0,
  });

  rows.push({
    id: "photos",
    label: "Photos",
    yourPharmacy: yourPharmacyMetric(yourPhotos, yours),
    competitorAverage: photos.length ? fmtNum(avg(photos)!, 0) : unavailable(),
    highestCompetitor: photos.length ? fmtNum(max(photos)!) : unavailable(),
    // Competitor photo maths may still be available; own-pharmacy unknown blocks gap comparisons.
    hasData: photos.length > 0 && pharmacyPhotoCountKnown(yours),
  });

  rows.push({
    id: "categories",
    label: "Categories",
    yourPharmacy: yourPharmacyMetric(yourCats, yours, 1),
    competitorAverage: categoryCounts.length ? fmtNum(avg(categoryCounts)!, 1) : unavailable(),
    highestCompetitor: categoryCounts.length ? fmtNum(max(categoryCounts)!) : unavailable(),
    hasData: categoryCounts.length > 0,
  });

  return rows;
}

export function buildMarketSummary(
  yours: GrowthEngineYourPharmacy | null,
  competitors: GrowthEngineCompetitor[],
): string[] {
  const pool = realGoogleCompetitors(competitors);
  if (!pool.length) {
    return ["No live Google Places competitor data is available yet. Run discovery when your Google Places API key is configured."];
  }

  const paragraphs: string[] = [];
  paragraphs.push(`We found ${pool.length} pharmacies within your target area.`);

  const reviewAvg = avg(pool.map((c) => c.reviewCount));
  const ratingAvg = avg(pool.map((c) => c.rating).filter((r): r is number => r != null));
  // Photo evidence may be represented as "unknown" using a negative sentinel.
  const photoAvg = avg(pool.map((c) => c.photoCount).filter((n) => n >= 0));

  const avgParts: string[] = [];
  if (reviewAvg != null) avgParts.push(`${fmtNum(reviewAvg)} Google reviews`);
  if (ratingAvg != null) avgParts.push(`${fmtNum(ratingAvg, 1)} rating`);
  if (photoAvg != null) avgParts.push(`${fmtNum(photoAvg)} photos`);

  if (avgParts.length) {
    paragraphs.push(`The average pharmacy has: ${avgParts.join(", ")}.`);
  }

  if (yours) {
    const yourParts: string[] = [];
    if (yours.reviewCount != null && yours.reviewCount >= 0) yourParts.push(`${fmtNum(yours.reviewCount)} reviews`);
    if (yours.rating != null) yourParts.push(`${fmtNum(yours.rating, 1)} rating`);
    if (yours.photoCount != null && yours.photoCount >= 0) yourParts.push(`${fmtNum(yours.photoCount)} photos`);

    if (yourParts.length) {
      paragraphs.push(`Your pharmacy currently has: ${yourParts.join(", ")}.`);
    } else {
      paragraphs.push("Your pharmacy Google Business data could not be loaded — add your Google Place ID in the profile wizard to compare.");
    }
  } else {
    paragraphs.push("Your pharmacy Google Business listing was not found — confirm your address and Google Place ID in Business Intelligence.");
  }

  return paragraphs;
}

export function buildOpportunityHighlights(
  yours: GrowthEngineYourPharmacy | null,
  competitors: GrowthEngineCompetitor[],
): string[] {
  const pool = realGoogleCompetitors(competitors);
  const opportunities: string[] = [];
  if (!pool.length || !yours) return opportunities;

  const reviewAvg = avg(pool.map((c) => c.reviewCount));
  const ratingAvg = avg(pool.map((c) => c.rating).filter((r): r is number => r != null));
  const photoAvg = avg(pool.map((c) => c.photoCount).filter((n) => n >= 0));
  const maxRating = max(pool.map((c) => c.rating).filter((r): r is number => r != null));

  if (reviewAvg != null && yours.reviewCount < reviewAvg) {
    opportunities.push("You currently have fewer Google reviews than the local average.");
  }

  if (
    yours.rating != null &&
    ratingAvg != null &&
    yours.rating >= ratingAvg &&
    (maxRating == null || yours.rating >= maxRating - 0.05)
  ) {
    opportunities.push("You have one of the highest average ratings among nearby pharmacies.");
  }

  if (photoAvg != null && yours.photoCount >= 0 && yours.photoCount < photoAvg) {
    const significantlyMore = pool.filter((c) => c.photoCount >= 0 && c.photoCount > yours.photoCount + 10).length;
    if (significantlyMore >= 2) {
      opportunities.push("Several competitors have significantly more photos on Google.");
    } else if (yours.photoCount < photoAvg) {
      opportunities.push("Your Google Business profile has fewer photos than the local average.");
    }
  }

  if (yours.rating != null && ratingAvg != null && yours.rating < ratingAvg) {
    opportunities.push("Your Google rating is below the local average — reputation growth may help visibility.");
  }

  if (!yours.website && pool.filter((c) => c.website).length >= pool.length / 2) {
    opportunities.push("Many local competitors list a website on Google — ensure yours is linked to your Google Business Profile.");
  }

  return opportunities;
}

export function buildLocalMarketAnalysis(
  yours: GrowthEngineYourPharmacy | null,
  competitors: GrowthEngineCompetitor[],
  dataSource: "google-places-live" | "demo-fallback" | "demo-no-google-key",
): LocalMarketAnalysis {
  const pool = realGoogleCompetitors(competitors);
  const live = dataSource === "google-places-live" && pool.length > 0;

  return {
    competitorCount: pool.length,
    dataSource: live ? "google-places-live" : "unavailable",
    comparisons: live ? buildComparisonPanel(yours, competitors) : buildComparisonPanel(null, []),
    summaryParagraphs: live ? buildMarketSummary(yours, competitors) : [
      "Live Google Places data is required for local market comparison.",
      "Configure GOOGLE_PLACES_API_KEY and run Discover Competitors to load real pharmacy data.",
    ],
    opportunities: live ? buildOpportunityHighlights(yours, competitors) : [],
    yourPharmacyComplete: Boolean(yours?.placeId && yours.source === "google-places"),
  };
}
