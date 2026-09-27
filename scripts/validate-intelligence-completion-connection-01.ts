/**
 * Completed competitor analysis must derive Local Market Intelligence and Growth Intelligence.
 * No Google Places or DataForSEO calls. Acceptance and historical tenants stay untouched.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyServiceLibraryService.ts";
import { writeSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { writeCompetitorIntelligence, type CompetitorIntelligenceResult } from "../src/pharmacy/pharmacyCompetitorIntelligence.ts";
import { loadCompetitorSnapshot } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { loadGrowthOpportunityReport } from "../src/pharmacy/growthEngineOpportunityEngine.ts";
import { buildCommercialIntelligenceDashboard } from "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const ACCEPTANCE = "pharmaconnect-e2e-test-pharmacy";
const failures: string[] = [];

function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
  console.log(`${condition ? "PASS" : "FAIL"}  ${message}`);
}

function shaFile(file: string): string {
  if (!fs.existsSync(file)) return "ABSENT";
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function acceptanceHashes(): string {
  const files = [
    `data/pharmacy-profiles/${ACCEPTANCE}.json`,
    `data/pharmacy-competitor-intelligence/${ACCEPTANCE}.json`,
    `data/pharmacy-competitor-intelligence/${ACCEPTANCE}-intelligence.json`,
    `data/national-growth-engine/${ACCEPTANCE}-competitor-discovery.json`,
    `data/pharmacy-profiles/brook-pharmacy.json`,
    `data/pharmacy-profiles/banner-cross-pharmacy.json`,
  ];
  return files.map((rel) => `${rel}:${shaFile(path.join(WORKSPACE_ROOT, rel))}`).join("|");
}

function intelligence(slug: string, name: string): CompetitorIntelligenceResult {
  return {
    slug,
    generatedAt: "2026-09-27T12:00:00.000Z",
    source: "google-places-live",
    pharmacy: {
      name: `${name} Pharmacy`,
      address: "1 High Street, Exampletown, EX1 1AA",
      postcode: "EX1 1AA",
      latitude: 51.5,
      longitude: -0.1,
    },
    competitors: [
      {
        name: `${name} Neighbour Pharmacy`,
        address: "2 High Street",
        distanceKm: 0.4,
        distanceLabel: "0.4 km",
        rating: 4.2,
        reviewCount: 18,
        website: "https://example-neighbour.example",
        phone: "0100 000 000",
        placeId: `ChIJ${slug}`,
        latitude: 51.51,
        longitude: -0.11,
        source: "google-places",
        categories: ["Pharmacy"],
        types: ["pharmacy"],
        primaryType: "Pharmacy",
        gbpRating: 4.2,
        gbpReviewCount: 18,
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
      },
    ],
    competitorSummary: {
      count: 1,
      avgRating: 4.2,
      avgReviewCount: 18,
      nearestDistanceKm: 0.4,
      chainCount: 0,
      independentCount: 1,
      withWebsite: 1,
      withPhone: 1,
    },
  };
}

function writeTenant(slug: string, serviceId: string, name: string): void {
  writeSetupProfile(slug, normalizeProfileData({
    pharmacyName: `${name} Pharmacy`,
    tradingName: `${name} Pharmacy`,
    website: `https://${slug}.example`,
    businessEmail: `${slug}@example.com`,
    email: `${slug}@example.com`,
    phone: "0100 000 001",
    addressLine1: "1 High Street",
    townCity: "Exampletown",
    primaryTown: "Exampletown",
    postcode: "EX1 1AA",
    country: "United Kingdom",
    marketScope: "local_regional",
    googleProfileOnboardingState: "deferred",
    googlePlaceId: "Deferred",
    selectedServices: [serviceId],
    priorityServices: ["pharmacy-first"],
  }));
  writeCompetitorIntelligence(intelligence(slug, name));
}

function removeTenant(slug: string): void {
  for (const rel of [
    `data/pharmacy-profiles/${slug}.json`,
    `data/pharmacy-competitor-intelligence/${slug}-intelligence.json`,
    `data/pharmacy-competitor-intelligence/${slug}.json`,
    `data/growth-engine/${slug}-competitors.json`,
    `data/growth-engine/${slug}-opportunities.json`,
  ]) {
    fs.rmSync(path.join(WORKSPACE_ROOT, rel), { force: true });
  }
}

const originalFetch = globalThis.fetch;
globalThis.fetch = (async () => {
  throw new Error("external collection is not allowed in this regression");
}) as typeof fetch;

const before = acceptanceHashes();
const slugA = "intel-connection-fixture-a";
const slugB = "intel-connection-fixture-b";
const slugEmpty = "intel-connection-fixture-empty";

try {
  writeTenant(slugA, "travel-vaccinations", "Alpha");
  writeTenant(slugB, "flu-vaccinations", "Beta");
  writeSetupProfile(slugEmpty, normalizeProfileData({
    pharmacyName: "Empty Intelligence Pharmacy",
    website: "https://empty.example",
    primaryTown: "Exampletown",
    townCity: "Exampletown",
    postcode: "EX1 1AA",
    country: "United Kingdom",
    marketScope: "local_regional",
    googleProfileOnboardingState: "deferred",
    selectedServices: ["ear-wax-removal"],
  }));

  const dashA = buildCommercialIntelligenceDashboard(slugA);
  const snapA = loadCompetitorSnapshot(slugA);
  const reportA = loadGrowthOpportunityReport(slugA);
  const comparison = dashA.localMarketIntelligence.sections.find((section) => section.title === "Local Market Comparison");
  const matrixServices = dashA.growthIntelligence.serviceOpportunityAssessment?.services.map((row) => row.serviceId) || [];

  assert(dashA.competitorAnalysis.generated, "stored Google/local competitor analysis stays completed");
  assert(snapA?.source === "google-places-live", "local market snapshot is derived from stored Google evidence");
  assert(snapA?.competitors.length === 1, "derived local market keeps the stored competitor");
  assert(snapA?.competitors[0]?.businessName === "Alpha Neighbour Pharmacy", "derived competitor name comes from stored evidence");
  assert(snapA?.yourPharmacy == null, "deferred Google profile is not invented as your pharmacy");
  assert(
    Boolean(comparison && !comparison.items.some((item) => /discovery is pending/i.test(item))),
    "local market comparison does not say discovery is pending",
  );
  assert(Boolean(reportA), "growth intelligence report is derived");
  assert(matrixServices.length === 1 && matrixServices[0] === "travel-vaccinations", "service matrix contains only the explicit service");
  assert(!matrixServices.includes("pharmacy-first"), "priority-service default is not added to the matrix");
  assert(dashA.blockingIssues.every((issue) => issue.title !== "Local Market Intelligence incomplete"), "local market stage is no longer incomplete");
  assert(dashA.blockingIssues.every((issue) => issue.title !== "Intelligence generation incomplete"), "intelligence generation is no longer incomplete");
  assert(dashA.canApprove === true, "approve intelligence enables when required stages are derived");
  assert(dashA.approved === false, "approval is not recorded");

  const dashB = buildCommercialIntelligenceDashboard(slugB);
  const snapB = loadCompetitorSnapshot(slugB);
  assert(snapB?.competitors[0]?.businessName === "Beta Neighbour Pharmacy", "second tenant uses its own competitor evidence");
  assert(
    dashB.growthIntelligence.serviceOpportunityAssessment?.services[0]?.serviceId === "flu-vaccinations",
    "second tenant matrix uses its own explicit service",
  );
  assert(snapA?.competitors[0]?.placeId !== snapB?.competitors[0]?.placeId, "tenant competitor evidence does not leak");

  const dashEmpty = buildCommercialIntelligenceDashboard(slugEmpty);
  assert(loadCompetitorSnapshot(slugEmpty) == null, "missing competitor evidence does not invent a local market snapshot");
  assert(loadGrowthOpportunityReport(slugEmpty) == null, "missing competitor evidence does not invent growth intelligence");
  assert(dashEmpty.canApprove === false, "approve stays disabled when competitor evidence is absent");
  assert(
    dashEmpty.blockingIssues.some((issue) => issue.title === "Local Market Intelligence incomplete"),
    "local market stays incomplete without competitor evidence",
  );
} finally {
  globalThis.fetch = originalFetch;
  removeTenant(slugA);
  removeTenant(slugB);
  removeTenant(slugEmpty);
}

const after = acceptanceHashes();
assert(before === after, "acceptance and historical profile/competitor records stay unchanged");

if (failures.length) {
  console.error(`FAILED ${failures.length}`);
  process.exit(1);
}
console.log("PASS intelligence completion connection");
