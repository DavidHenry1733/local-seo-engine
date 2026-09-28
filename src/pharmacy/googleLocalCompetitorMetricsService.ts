/**
 * Shared Google/local competitor metrics reader.
 *
 * Google Profile Metrics and Gap Analysis must use the same stored Google Places
 * artifact that already supplies the visible Google/local competitor table:
 *   1. pharmacy-competitor-intelligence/{slug}-intelligence.json
 *   2. growth-engine/{slug}-competitors.json (live Google Places snapshot)
 *
 * Calculations use competitor rows, not precomputed snapshot.analysis.comparisons.
 * Missing evidence stays unavailable — it is never converted to zero.
 */
import { loadCompetitorIntelligence, type CompetitorIntelligenceResult } from "./pharmacyCompetitorIntelligence.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import type { GrowthEngineCompetitorSnapshot } from "./growthEngineCompetitorModel.ts";
import { resolveGoogleProfileOnboardingState } from "./masterAdminGoogleProfileOnboardingService.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import {
  evidenceBackedPhotoCount,
  isInferredGoogleCategorySet,
} from "./googleLocalCompetitorEvidence.ts";
import { qualifyCommercialEvidenceCandidate } from "./organicSearchEvidenceClassification.ts";

export interface GoogleLocalProfileMetric {
  id: string;
  label: string;
  yourPharmacy: string;
  localAverage: string;
  highestCompetitor: string;
  gap: string;
  recommendedTarget: string;
  opportunity: string;
  sampleSize: number;
  sampleSizeLabel: string;
}

export const INSUFFICIENT_GOOGLE_PLACES_BENCHMARK =
  "Insufficient verified Google Places evidence to calculate this benchmark.";

export const NOT_AVAILABLE = "Not Available";

export type CanonicalGoogleLocalCompetitorArtifact =
  | { kind: "intelligence"; source: string; capturedAt: string | null; intel: CompetitorIntelligenceResult }
  | { kind: "snapshot"; source: string; capturedAt: string | null; snap: GrowthEngineCompetitorSnapshot };

export interface GoogleLocalMetricRecord {
  name: string;
  placeId: string;
  source: string;
  rating: number | null;
  reviewCount: number | null;
  photoCount: number | null;
  categoryCount: number | null;
}

export interface OwnGoogleProfileMetrics {
  rating: number | null;
  reviewCount: number | null;
  photoCount: number | null;
  categoryCount: number | null;
  present: boolean;
}

function isDemoPlaceId(placeId: string | undefined | null): boolean {
  return Boolean(placeId && String(placeId).startsWith("demo-"));
}

function isVerifiedGooglePlacesCompetitor(source: string | undefined, placeId: string | undefined | null): boolean {
  return source === "google-places" && Boolean(placeId) && !isDemoPlaceId(placeId);
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Same artifact preference as the visible Google/local competitor table.
 * Does not read DataForSEO / national organic-search artifacts.
 */
export function loadCanonicalGoogleLocalCompetitorArtifact(
  slug: string,
): CanonicalGoogleLocalCompetitorArtifact | null {
  const intel = loadCompetitorIntelligence(slug);
  if (intel?.competitors.length) {
    return {
      kind: "intelligence",
      source: intel.source || "Google Places",
      capturedAt: intel.generatedAt || null,
      intel,
    };
  }
  const snap = loadCompetitorSnapshot(slug);
  if (snap?.competitors.length && snap.source === "google-places-live") {
    return {
      kind: "snapshot",
      source: snap.source,
      capturedAt: snap.generatedAt || null,
      snap,
    };
  }
  return null;
}

export function googleLocalArtifactConfidence(artifact: CanonicalGoogleLocalCompetitorArtifact | null): string {
  if (!artifact) return "Unknown";
  const source = artifact.source || "";
  if (/google-places-live/i.test(source) || source === "google-places") return "High";
  if (/google/i.test(source) && !/demo/i.test(source)) return "High";
  if (/demo/i.test(source)) return "Unknown";
  return "Medium";
}

export function googleLocalMetricRecords(
  artifact: CanonicalGoogleLocalCompetitorArtifact | null,
): GoogleLocalMetricRecord[] {
  if (!artifact) return [];
  if (artifact.kind === "intelligence") {
    return artifact.intel.competitors.filter((c) =>
      qualifyCommercialEvidenceCandidate({
        name: c.name,
        source: c.source || artifact.source,
        provider: "google-places",
        placeId: c.placeId,
        primaryCategory: c.primaryType,
        categories: c.categories,
        distanceKm: c.distanceKm,
        url: c.website,
        discoveryAccepted: true,
      }).evidenceClass === "LOCAL_COMMERCIAL_COMPETITOR",
    ).map((c) => {
      const extra = c as {
        photoCount?: number | null;
        photos?: unknown;
        photosCaptured?: boolean;
        rating?: number | null;
        reviewCount?: number | null;
      };
      const photo = evidenceBackedPhotoCount(extra.photoCount, extra.photos, extra.photosCaptured);
      const categories = Array.isArray(c.categories) && !isInferredGoogleCategorySet(c.categories) ? c.categories : [];
      return {
        name: c.name,
        placeId: c.placeId || "",
        source: c.source,
        rating: finiteNumber(c.gbpRating ?? extra.rating),
        reviewCount: finiteNumber(c.gbpReviewCount ?? extra.reviewCount),
        photoCount: photo,
        categoryCount: categories.length ? categories.length : null,
      };
    });
  }
  return artifact.snap.competitors.filter((c) =>
    qualifyCommercialEvidenceCandidate({
      name: c.businessName,
      source: c.source || artifact.source,
      provider: "google-places",
      placeId: c.placeId,
      primaryCategory: c.primaryCategory,
      categories: [c.primaryCategory, ...(c.secondaryCategories || [])],
      distanceKm: c.distanceKm,
      url: c.website,
      discoveryAccepted: true,
    }).evidenceClass === "LOCAL_COMMERCIAL_COMPETITOR",
  ).map((c) => {
    const categoryCount =
      c.primaryCategory || (c.secondaryCategories || []).length
        ? 1 + (c.secondaryCategories || []).length
        : null;
    return {
      name: c.businessName,
      placeId: c.placeId || "",
      source: c.source,
      rating: finiteNumber(c.rating),
      reviewCount: finiteNumber(c.reviewCount),
      photoCount: finiteNumber(c.photoCount),
      categoryCount,
    };
  });
}

/** Only verified Google Places rows participate in metric maths. */
export function verifiedGoogleLocalMetricRecords(
  artifact: CanonicalGoogleLocalCompetitorArtifact | null,
): GoogleLocalMetricRecord[] {
  const rows = googleLocalMetricRecords(artifact);
  if (!artifact) return [];
  if (artifact.kind === "snapshot" && artifact.snap.source === "google-places-live") {
    return rows.filter((c) => Boolean(c.placeId) && !isDemoPlaceId(c.placeId));
  }
  return rows.filter((c) => isVerifiedGooglePlacesCompetitor(c.source, c.placeId));
}

function valuesPresent(records: GoogleLocalMetricRecord[], key: keyof GoogleLocalMetricRecord): number[] {
  const out: number[] = [];
  for (const row of records) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) out.push(value);
  }
  return out;
}

function fmtNum(n: number, decimals: number): string {
  if (decimals <= 0) return String(Math.round(n));
  const factor = 10 ** decimals;
  return (Math.round((n + Number.EPSILON) * factor) / factor).toFixed(decimals);
}

function sampleLabel(n: number): string {
  return n > 0 ? `n=${n}` : NOT_AVAILABLE;
}

export function resolveOwnGoogleProfileMetrics(
  profile: PharmacyProfileData,
  snap: GrowthEngineCompetitorSnapshot | null,
): OwnGoogleProfileMetrics {
  const state = resolveGoogleProfileOnboardingState(profile);
  const yours = snap?.yourPharmacy;
  const importSnap = profile.googleImportSnapshot;

  if (importSnap?.placeId) {
    return {
      rating: finiteNumber(importSnap.rating),
      reviewCount: finiteNumber(importSnap.reviewCount),
      photoCount: evidenceBackedPhotoCount(importSnap.photoCount, (importSnap as { photos?: unknown }).photos),
      categoryCount: Array.isArray(importSnap.categories) && importSnap.categories.length ? importSnap.categories.length : null,
      present: true,
    };
  }

  if (yours?.placeId && yours.source === "google-places") {
    const categoryCount =
      yours.primaryCategory || (yours.secondaryCategories || []).length
        ? 1 + (yours.secondaryCategories || []).length
        : null;
    return {
      rating: finiteNumber(yours.rating),
      reviewCount: finiteNumber(yours.reviewCount),
      photoCount: evidenceBackedPhotoCount(yours.photoCount, (yours as { photos?: unknown }).photos, true),
      categoryCount,
      present: true,
    };
  }

  if (profile.googlePlaceId && (profile.googleBusinessRating != null || Number(profile.googleBusinessReviewCount) > 0)) {
    return {
      rating: finiteNumber(profile.googleBusinessRating),
      reviewCount: finiteNumber(profile.googleBusinessReviewCount),
      photoCount: null,
      categoryCount: null,
      present: true,
    };
  }

  if (state === "no_profile") {
    return { rating: 0, reviewCount: 0, photoCount: 0, categoryCount: 0, present: true };
  }

  return { rating: null, reviewCount: null, photoCount: null, categoryCount: null, present: false };
}

function formatOwn(value: number | null, decimals: number): string {
  if (value == null) return NOT_AVAILABLE;
  return fmtNum(value, decimals);
}

function metricOpportunity(
  metricId: string,
  gap: number | null,
  sampleSize: number,
  ownPresent: boolean,
): string {
  if (sampleSize <= 0 || !ownPresent || gap == null) {
    return INSUFFICIENT_GOOGLE_PLACES_BENCHMARK;
  }
  if (gap <= 0) {
    return "You are at or above the local benchmark for this metric — PharmaConnect will help you maintain visibility and trust.";
  }
  const actions: Record<string, string> = {
    reviews:
      "Review count influences patient trust and map click-through. PharmaConnect will improve Google Business Profile completeness and support structured review growth.",
    rating:
      "Rating gaps affect comparison shopping in local search. PharmaConnect will strengthen service delivery signals and reputation visibility on Google.",
    photos:
      "Photo-rich profiles earn more engagement on Google Maps. PharmaConnect will guide profile media completion and on-brand pharmacy imagery.",
    categories:
      "Category coverage helps Google match patient intent to your services. PharmaConnect will align your Google categories with your enabled pharmacy services.",
  };
  return actions[metricId] || "Closing this gap will improve local competitiveness. PharmaConnect will address it through profile and content improvements.";
}

export function buildGoogleLocalProfileMetrics(
  profile: PharmacyProfileData,
  snap: GrowthEngineCompetitorSnapshot | null,
  artifact: CanonicalGoogleLocalCompetitorArtifact | null,
): GoogleLocalProfileMetric[] {
  const pool = verifiedGoogleLocalMetricRecords(artifact);
  const yours = resolveOwnGoogleProfileMetrics(profile, snap);

  const defs = [
    { id: "reviews", label: "Google Reviews", key: "reviewCount" as const, yours: yours.reviewCount, decimals: 0, ownPresent: yours.reviewCount != null },
    { id: "rating", label: "Average Rating", key: "rating" as const, yours: yours.rating, decimals: 1, ownPresent: yours.rating != null },
    { id: "photos", label: "Photos", key: "photoCount" as const, yours: yours.photoCount, decimals: 0, ownPresent: yours.photoCount != null },
    { id: "categories", label: "Categories", key: "categoryCount" as const, yours: yours.categoryCount, decimals: 0, ownPresent: yours.categoryCount != null },
  ];

  return defs.map((def) => {
    const values = valuesPresent(pool, def.key);
    const sampleSize = values.length;
    const average = sampleSize ? values.reduce((a, b) => a + b, 0) / sampleSize : null;
    const highest = sampleSize ? Math.max(...values) : null;
    const ownDisplay = formatOwn(def.yours, def.decimals);
    const localAverage = average == null ? NOT_AVAILABLE : `${fmtNum(average, def.decimals)} (${sampleLabel(sampleSize)})`;
    const highestCompetitor = highest == null ? NOT_AVAILABLE : fmtNum(highest, def.decimals);
    const gapNum =
      def.yours != null && highest != null
        ? highest - def.yours
        : def.yours != null && average != null
          ? average - def.yours
          : null;
    const gap = gapNum == null ? NOT_AVAILABLE : fmtNum(gapNum, def.decimals);
    const recommendedTarget =
      highest != null ? fmtNum(highest, def.decimals) : average != null ? fmtNum(average, def.decimals) : NOT_AVAILABLE;

    return {
      id: def.id,
      label: def.label,
      yourPharmacy: ownDisplay,
      localAverage,
      highestCompetitor,
      gap,
      recommendedTarget,
      opportunity: metricOpportunity(def.id, gapNum, sampleSize, def.ownPresent),
      sampleSize,
      sampleSizeLabel: sampleLabel(sampleSize),
    };
  });
}
