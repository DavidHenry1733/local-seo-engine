#!/usr/bin/env npx tsx
/**
 * Reconnect Local Market Intelligence (LMI) from existing Google-local competitor intelligence.
 *
 * Read-only (no discovery), no Google Places calls.
 * Writes only the existing Local Market Intelligence artifact:
 *   data/growth-engine/{slug}-competitors.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { emptyHealthcareSnapshot } from "../src/pharmacy/growthEngineHealthcareModel.ts";
import {
  buildYourPharmacyFromCanonicalProfile,
  loadProfileDataForLocalMarket,
  writeCompetitorSnapshot,
  LOCAL_MARKET_SNAPSHOT_VERSION,
} from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { emptyFutureMetrics, type GrowthEngineCompetitor, type GrowthEngineCompetitorSnapshot } from "../src/pharmacy/growthEngineCompetitorModel.ts";
import { buildLocalMarketAnalysis } from "../src/pharmacy/growthEngineLocalMarketAnalysis.ts";
import { loadCompetitorIntelligence } from "../src/pharmacy/pharmacyCompetitorIntelligence.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage(): never {
  throw new Error(`Usage: tsx scripts/reconnect-local-market-intelligence-from-google-competitor-intelligence-v1.ts <slug>`);
}

function encodePlaceId(placeId: string): string {
  return encodeURIComponent(placeId);
}

function openingStatusFromEvidence(
  openingNow: boolean | null | undefined,
  businessStatus: string | null | undefined,
): string {
  if (openingNow === true) return "Open now";
  if (openingNow === false) return "Closed now";
  if (businessStatus) {
    if (businessStatus === "OPERATIONAL") return "Hours available";
    return String(businessStatus).replace(/_/g, " ");
  }
  return "";
}

function toOpeningHoursArray(
  hours:
    | { weekdayDescriptions?: string[]; openNow?: boolean | null }
    | { weekdayDescriptions?: string[]; openNow?: boolean | null }
    | null
    | undefined,
): string[] {
  if (!hours) return [];
  const days = Array.isArray(hours.weekdayDescriptions) ? hours.weekdayDescriptions : [];
  return days.map(String).filter(Boolean);
}

function mapCompetitorIntelligenceToGrowthEngineCompetitor(
  c: (ReturnType<typeof loadCompetitorIntelligence> extends infer T ? (T extends any ? any : never) : never) & {
    photoCount?: number | null;
    photosCaptured?: boolean;
    openingHours?: { weekdayDescriptions?: string[]; openNow?: boolean | null } | null;
    currentOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean | null } | null;
    businessStatus?: string | null;
    mapsUrl?: string | null;
  },
): GrowthEngineCompetitor {
  const categories = Array.isArray(c.categories) ? c.categories : [];
  const primaryCategory = categories[0] ? String(categories[0]).replace(/_/g, " ") : "";
  const secondaryCategories = categories.slice(1).map((x) => String(x).replace(/_/g, " "));

  // Fix-03: preserve unknown photos as unknown (negative sentinel), never fabricate 0.
  // intel sanitization already ensures photoCount is either number or null.
  const photoCount = c.photoCount == null ? -1 : c.photoCount;

  const openingNow =
    c.currentOpeningHours?.openNow ??
    c.openingHours?.openNow ??
    null;

  const openingHoursArr = toOpeningHoursArray(c.currentOpeningHours || c.openingHours);

  const placeId = String(c.placeId || "");
  return {
    placeId,
    businessName: String(c.name || ""),
    distanceKm: c.distanceKm ?? null,
    distanceLabel: String(c.distanceLabel || ""),
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    address: String(c.address || ""),
    phone: String(c.phone || ""),
    website: String(c.website || ""),
    primaryCategory,
    secondaryCategories,
    rating: c.gbpRating ?? c.rating ?? null,
    reviewCount: c.gbpReviewCount ?? c.reviewCount ?? 0,
    photoCount,
    businessStatus: (c.businessStatus ?? null) as string | null,
    openingStatus: openingStatusFromEvidence(openingNow, c.businessStatus ?? null),
    openingHours: openingHoursArr,
    attributes: [],
    businessDescription: "",
    directionsUrl: placeId ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodePlaceId(placeId)}` : "",
    googleMapsUrl: String(c.mapsUrl || ""),
    notes: "",
    source: c.source === "google-places" ? "google-places" : "demo-fallback",
    future: emptyFutureMetrics(),
  } as GrowthEngineCompetitor;
}

async function main(): Promise<void> {
  const slug = process.argv[2];
  if (!slug) usage();

  const intel = loadCompetitorIntelligence(slug);
  if (!intel?.competitors?.length) {
    throw new Error(`Competitor intelligence missing for slug=${slug}`);
  }
  if (intel.competitors.length !== 10) {
    throw new Error(`Expected 10 competitors, found ${intel.competitors.length}`);
  }

  const profileData = loadProfileDataForLocalMarket(slug);
  const yourPharmacy = buildYourPharmacyFromCanonicalProfile(profileData);

  const competitors = intel.competitors.map(mapCompetitorIntelligenceToGrowthEngineCompetitor);

  // LMI analysis must only use live Google competitor evidence.
  const analysis = buildLocalMarketAnalysis(yourPharmacy, competitors, "google-places-live");

  const snapshot: GrowthEngineCompetitorSnapshot = {
    version: LOCAL_MARKET_SNAPSHOT_VERSION,
    slug,
    generatedAt: intel.generatedAt || new Date().toISOString(),
    source: "google-places-live",
    targetCount: 10,
    pharmacy: {
      name: intel.pharmacy?.name || "",
      address: intel.pharmacy?.address || "",
      postcode: intel.pharmacy?.postcode || "",
      latitude: intel.pharmacy?.latitude ?? null,
      longitude: intel.pharmacy?.longitude ?? null,
    },
    yourPharmacy,
    competitors,
    analysis,
    healthcare: emptyHealthcareSnapshot(),
    placesError: null,
    lastDiscoverAttemptAt: intel.generatedAt || new Date().toISOString(),
  };

  writeCompetitorSnapshot(snapshot);
  console.log(`Wrote LMI snapshot from Google-local intelligence: data/growth-engine/${slug}-competitors.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

