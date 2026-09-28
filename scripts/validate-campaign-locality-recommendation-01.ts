/**
 * Campaign setup receives persisted locality recommendations from stored
 * locality evidence. Recommendations are not campaign membership until saved.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyServiceLibraryService.ts";
import { writeSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { writeCompetitorIntelligence } from "../src/pharmacy/pharmacyCompetitorIntelligence.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { approveCommercialIntelligence } from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";
import { decideGrowthPlan } from "../src/pharmacy/masterAdminGrowthPlanConnectionService.ts";
import {
  buildLocalAreaRecommendations,
  saveGenerationSetupLocalAreas,
} from "../src/pharmacy/masterAdminGenerationSetupService.ts";
import { hydrateLocalCoverageGoogleLocalities } from "../src/pharmacy/masterAdminLocalCoverageRecommendationService.ts";
import { createPharmacyCampaign, readPharmacyCampaignStore } from "../src/pharmacy/pharmacyCampaignService.ts";

const LIVE = "pharmaconnect-e2e-test-pharmacy";
const HISTORICAL = [
  "brook-pharmacy",
  "yorkshire-pharmacy-and-health-clinic",
  "leeds-pharmacy",
  "vision-pharmacy",
  "banner-cross-pharmacy",
];
const failures: string[] = [];

function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
  console.log(`${condition ? "PASS" : "FAIL"}  ${message}`);
}

function shaFile(rel: string): string {
  const file = path.join(WORKSPACE_ROOT, rel);
  if (!fs.existsSync(file)) return "ABSENT";
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function recordSet(slug: string): string {
  return [
    `data/pharmacy-profiles/${slug}.json`,
    `data/pharmacy-campaigns/${slug}.json`,
    `data/growth-engine/${slug}-growth-plan.json`,
    `data/growth-engine/${slug}-workflow.json`,
    `data/growth-engine/${slug}-opportunities.json`,
    `data/pharmacy-competitor-intelligence/${slug}-intelligence.json`,
    `data/pharmacy-local-coverage/${slug}-recommendations.json`,
  ].map((rel) => `${rel}:${shaFile(rel)}`).join("|");
}

function writeReport(slug: string): void {
  const file = path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-opportunities.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    version: 1,
    slug,
    generatedAt: "2026-09-28T11:00:00.000Z",
    overview: { total: 1, high: 0, medium: 0, low: 1 },
    opportunities: [{
      id: "service-opportunity-travel-vaccinations",
      serviceId: "travel-vaccinations",
      title: "Travel Vaccinations: insufficient evidence",
      category: "pharmacy-services",
      priority: "low",
    }],
    serviceOpportunityAssessment: {
      slug,
      generatedAt: "2026-09-28T11:00:00.000Z",
      confirmedServiceCount: 1,
      services: [{
        serviceId: "travel-vaccinations",
        serviceName: "Travel Vaccinations",
        opportunityClassification: "insufficient-evidence",
        demand: { demandEvidenceStatus: "unknown", canonicalQueryVolume: null },
        recommendedAction: "No dedicated Travel Vaccinations page yet.",
      }],
      topPriorityServices: [{ serviceId: "travel-vaccinations", serviceName: "Travel Vaccinations" }],
      evidenceLimitations: ["Search demand artifact missing — demand metrics unavailable."],
    },
  }, null, 2));
}

function writeTenant(slug: string, withOrigin: boolean): void {
  writeSetupProfile(slug, normalizeProfileData({
    pharmacyName: "Exampleford Fixture Pharmacy",
    website: `https://${slug}.example`,
    primaryTown: "Exampleford",
    townCity: "Exampleford",
    postcode: "EX1 1AA",
    country: "United Kingdom",
    marketScope: "local_regional",
    googleProfileOnboardingState: "deferred",
    googlePlaceId: "Deferred",
    selectedServices: ["travel-vaccinations"],
    priorityServices: ["pharmacy-first"],
    selectedAreas: [],
  }));
  if (!withOrigin) return;
  writeCompetitorIntelligence({
    slug,
    generatedAt: "2026-09-28T11:05:00.000Z",
    source: "google-places-live",
    pharmacy: {
      name: "Exampleford Fixture Pharmacy",
      address: "1 High Street, Exampleford, EX1 1AA",
      postcode: "EX1 1AA",
      latitude: 53.8,
      longitude: -1.5,
    },
    competitors: [{
      name: "Exampleford Neighbour Pharmacy",
      address: "2 High Street, Exampleford, EX1 1AB",
      distanceKm: 0.2,
      distanceLabel: "0.2 km",
      rating: 4,
      reviewCount: 3,
      website: "https://neighbour.example",
      phone: "0100",
      placeId: `ChIJ${slug}`,
      latitude: 53.801,
      longitude: -1.501,
      source: "google-places",
      categories: ["Pharmacy"],
      types: ["pharmacy"],
      primaryType: "Pharmacy",
      gbpRating: 4,
      gbpReviewCount: 3,
      reviews: [],
      services: [],
      openingHours: null,
      currentOpeningHours: null,
      businessStatus: "OPERATIONAL",
      internationalPhone: null,
      mapsUrl: null,
      photos: null,
      photoCount: null,
      photosCaptured: false,
      chainBrand: null,
      independent: true,
      hasWebsite: true,
      hasPhone: true,
    }],
    competitorSummary: {
      count: 1,
      avgRating: 4,
      avgReviewCount: 3,
      nearestDistanceKm: 0.2,
      chainCount: 0,
      independentCount: 1,
      withWebsite: 1,
      withPhone: 1,
    },
  });
  fs.writeFileSync(path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-competitors.json`), JSON.stringify({
    slug,
    generatedAt: "2026-09-28T11:05:00.000Z",
    source: "google-places-live",
    competitors: [{ placeId: `ChIJ${slug}`, businessName: "Exampleford Neighbour Pharmacy", source: "google-places" }],
    analysis: { competitorCount: 1, dataSource: "google-places-live" },
  }, null, 2));
  writeReport(slug);
}

function removeTenant(slug: string): void {
  for (const rel of [
    `data/pharmacy-profiles/${slug}.json`,
    `data/pharmacy-competitor-intelligence/${slug}-intelligence.json`,
    `data/growth-engine/${slug}-competitors.json`,
    `data/growth-engine/${slug}-opportunities.json`,
    `data/growth-engine/${slug}-growth-plan.json`,
    `data/growth-engine/${slug}-workflow.json`,
    `data/growth-engine/${slug}-campaign-builder.json`,
    `data/growth-engine/${slug}-campaign-generation-context-travel-vaccinations.json`,
    `data/pharmacy-campaigns/${slug}.json`,
    `data/pharmacy-campaign-launch-queue/${slug}.json`,
    `data/pharmacy-master-admin/active-service-campaign/${slug}.json`,
    `data/pharmacy-master-admin/workflow-history/${slug}.json`,
    `data/pharmacy-local-coverage/${slug}-recommendations.json`,
    `data/pharmacy-content-packages/${slug}`,
  ]) {
    fs.rmSync(path.join(WORKSPACE_ROOT, rel), { recursive: true, force: true });
  }
}

const originalFetch = globalThis.fetch;
const originalPlacesKey = process.env.GOOGLE_PLACES_API_KEY;
process.env.GOOGLE_PLACES_API_KEY = "locality-recommendation-test-key";
let nearbyCalls = 0;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const target = String(input);
  if (target.includes("places:searchNearby")) {
    nearbyCalls += 1;
    return new Response(JSON.stringify({
      places: [
        { id: "places/northbridge", displayName: { text: "Northbridge" }, formattedAddress: "Northbridge, Exampleford, UK", location: { latitude: 53.82, longitude: -1.5 }, types: ["locality"] },
        { id: "places/southbridge", displayName: { text: "Southbridge" }, formattedAddress: "Southbridge, Exampleford, UK", location: { latitude: 53.78, longitude: -1.5 }, types: ["locality"] },
        { id: "places/westbridge", displayName: { text: "Westbridge" }, formattedAddress: "Westbridge, Exampleford, UK", location: { latitude: 53.8, longitude: -1.55 }, types: ["locality"] },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (target.includes("places.googleapis.com")) {
    return new Response(JSON.stringify({ places: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  throw new Error(`external collection is not allowed: ${target}`);
}) as typeof fetch;

const historicalBefore = Object.fromEntries(HISTORICAL.map((slug) => [slug, recordSet(slug)]));
const liveBefore = recordSet(LIVE);
const registryPath = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/registry.json");
const registryBefore = fs.existsSync(registryPath) ? fs.readFileSync(registryPath) : null;
const readySlug = "locality-recommendation-ready-fixture";
const emptySlug = "locality-recommendation-empty-fixture";

try {
  writeTenant(readySlug, true);
  const approved = approveCommercialIntelligence(readySlug, "validator");
  assert(approved.ok === true, "commercial intelligence approval creates the growth plan prerequisite");
  decideGrowthPlan(readySlug, "approved", "validator");
  await hydrateLocalCoverageGoogleLocalities(readySlug);
  const first = buildLocalAreaRecommendations(readySlug);
  const recommended = first.areas.filter((area) => area.recommended);
  assert(first.primaryTown === "Exampleford", "primary locality comes from the approved profile");
  assert(first.recommendationStatus === "available", "recommendations are available from stored locality evidence");
  assert(recommended.length > 0, "recommended areas are greater than zero");
  assert(recommended.every((area) => area.distanceKm != null && area.evidenceSource), "each recommendation keeps distance and source");
  assert(!recommended.some((area) => area.selected), "recommendations are not selected automatically");
  const profile = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${readySlug}.json`), "utf8"));
  assert(!(profile.selectedAreas || []).length, "opening recommendations does not write profile selection");
  assert(!fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-campaigns", `${readySlug}.json`)), "recommendations do not create a campaign");
  assert(nearbyCalls === 1, "discovery runs once");

  createPharmacyCampaign(readySlug, { serviceId: "travel-vaccinations", campaignGoal: "Pharmacy Growth" });
  const chosen = recommended.filter((area) => area.areaName !== "Westbridge").map((area) => area.areaName);
  saveGenerationSetupLocalAreas(readySlug, {
    primaryTown: "Exampleford",
    areas: [
      ...first.areas.map((area) => ({ areaName: area.areaName, selected: chosen.includes(area.areaName) })),
      { areaName: "Operator Meadow", selected: true },
    ],
    manualAreas: ["Operator Meadow"],
  });
  const store = readPharmacyCampaignStore(readySlug);
  const campaign = store?.campaigns?.[0];
  const slugs = (campaign?.campaignAreas || []).map((area) => area.areaSlug);
  assert(Boolean(campaign?.id), "save projects onto the campaign UUID");
  assert(slugs.includes("northbridge") && slugs.includes("southbridge"), "accepted areas become campaignAreas");
  assert(slugs.includes("operator-meadow"), "manual add remains possible");
  assert(!slugs.includes("westbridge"), "an unselected recommendation does not become membership");
  assert(!fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", readySlug)), "no content package is created");

  const membership = JSON.stringify(campaign?.campaignAreas || []);
  await hydrateLocalCoverageGoogleLocalities(readySlug);
  const second = buildLocalAreaRecommendations(readySlug);
  const reopened = readPharmacyCampaignStore(readySlug)?.campaigns?.[0];
  assert(nearbyCalls === 1, "reopening does not discover again");
  assert(second.areas.filter((area) => area.recommended).length === recommended.length, "reopening returns the same recommendations");
  assert(JSON.stringify(reopened?.campaignAreas || []) === membership, "reopening does not duplicate campaign membership");

  const nearbyBeforeEmpty = nearbyCalls;
  writeTenant(emptySlug, false);
  await hydrateLocalCoverageGoogleLocalities(emptySlug);
  const missing = buildLocalAreaRecommendations(emptySlug);
  assert(nearbyCalls === nearbyBeforeEmpty, "unavailable evidence does not call discovery");
  assert(!missing.areas.some((area) => area.recommended), "no areas are fabricated");
  assert(missing.recommendationStatus === "insufficient" || missing.recommendationStatus === "unavailable", "unavailable state is explicit");
  assert(Boolean(missing.evidenceLimitation), "the unavailable state explains the gap");
  assert(!fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-campaigns", `${emptySlug}.json`)), "unavailable evidence does not create membership");
  assert(nearbyCalls === 1, "discovery stays on the stubbed Places response");
} finally {
  globalThis.fetch = originalFetch;
  if (originalPlacesKey == null) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = originalPlacesKey;
  removeTenant(readySlug);
  removeTenant(emptySlug);
  if (registryBefore) fs.writeFileSync(registryPath, registryBefore);
}

for (const historical of HISTORICAL) {
  assert(historicalBefore[historical] === recordSet(historical), `${historical} operational records stay unchanged`);
}
assert(liveBefore === recordSet(LIVE), "fresh tenant protected records stay unchanged");

if (failures.length) {
  console.error(`FAILED ${failures.length}`);
  process.exit(1);
}
console.log("PASS campaign locality recommendation");
