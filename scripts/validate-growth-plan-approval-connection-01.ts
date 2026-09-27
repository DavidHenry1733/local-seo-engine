/**
 * Approved Commercial Intelligence creates a persisted Growth Plan that Master Admin reads.
 * An unapproved or newer intelligence revision does not become the current plan.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyServiceLibraryService.ts";
import { writeSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { writeCompetitorIntelligence } from "../src/pharmacy/pharmacyCompetitorIntelligence.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { approveCommercialIntelligence } from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";
import { buildOverviewAuthorityV1 } from "../src/pharmacy/masterAdminOverviewAuthorityService.ts";
import { readPersistedGrowthPlan } from "../src/pharmacy/masterAdminGrowthPlanConnectionService.ts";

const ACCEPTANCE = "pharmaconnect-e2e-test-pharmacy";
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

function acceptanceHashes(): string {
  return [
    `data/pharmacy-profiles/${ACCEPTANCE}.json`,
    `data/pharmacy-competitor-intelligence/${ACCEPTANCE}-intelligence.json`,
    `data/national-growth-engine/${ACCEPTANCE}-competitor-discovery.json`,
    `data/growth-engine/${ACCEPTANCE}-competitors.json`,
    `data/growth-engine/${ACCEPTANCE}-opportunities.json`,
    `data/growth-engine/${ACCEPTANCE}-workflow.json`,
    `data/pharmacy-campaigns/${ACCEPTANCE}.json`,
  ].map((rel) => `${rel}:${shaFile(rel)}`).join("|");
}

function writeReport(slug: string, serviceId: string, serviceName: string, generatedAt: string): void {
  const file = path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-opportunities.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    version: 1,
    slug,
    generatedAt,
    overview: { total: 1, high: 0, medium: 0, low: 1 },
    opportunities: [{
      id: `service-opportunity-${serviceId}`,
      serviceId,
      title: `${serviceName}: insufficient evidence`,
      category: "pharmacy-services",
      priority: "low",
    }],
    serviceOpportunityAssessment: {
      slug,
      generatedAt,
      confirmedServiceCount: 1,
      services: [{
        serviceId,
        serviceName,
        opportunityClassification: "insufficient-evidence",
        demand: { demandEvidenceStatus: "unknown", canonicalQueryVolume: null },
        recommendedAction: `No dedicated ${serviceName} page yet.`,
      }],
      topPriorityServices: [{ serviceId, serviceName }],
      evidenceLimitations: ["Search demand artifact missing — demand metrics unavailable."],
    },
  }, null, 2));
}

function writeTenant(slug: string, serviceId: string, serviceName: string): void {
  writeSetupProfile(slug, normalizeProfileData({
    pharmacyName: `${serviceName} Fixture`,
    website: `https://${slug}.example`,
    primaryTown: "Exampletown",
    townCity: "Exampletown",
    postcode: "EX1 1AA",
    country: "United Kingdom",
    marketScope: "local_regional",
    googleProfileOnboardingState: "deferred",
    googlePlaceId: "Deferred",
    selectedServices: [serviceId],
    priorityServices: ["pharmacy-first"],
  }));
  writeCompetitorIntelligence({
    slug,
    generatedAt: "2026-09-27T12:00:00.000Z",
    source: "google-places-live",
    pharmacy: { name: `${serviceName} Fixture`, address: "1 High Street", postcode: "EX1 1AA", latitude: 51.5, longitude: -0.1 },
    competitors: [{
      name: `${serviceName} Neighbour`,
      address: "2 High Street",
      distanceKm: 0.4,
      distanceLabel: "0.4 km",
      rating: 4,
      reviewCount: 3,
      website: "https://neighbour.example",
      phone: "0100",
      placeId: `ChIJ${slug}`,
      latitude: 51.51,
      longitude: -0.11,
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
    competitorSummary: { count: 1, avgRating: 4, avgReviewCount: 3, nearestDistanceKm: 0.4, chainCount: 0, independentCount: 1, withWebsite: 1, withPhone: 1 },
  });
  const snap = path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-competitors.json`);
  fs.writeFileSync(snap, JSON.stringify({
    slug,
    generatedAt: "2026-09-27T12:05:00.000Z",
    source: "google-places-live",
    competitors: [{ placeId: `ChIJ${slug}`, businessName: `${serviceName} Neighbour`, source: "google-places" }],
    analysis: { competitorCount: 1, dataSource: "google-places-live" },
  }, null, 2));
  writeReport(slug, serviceId, serviceName, "2026-09-27T12:10:00.000Z");
}

function removeTenant(slug: string): void {
  for (const rel of [
    `data/pharmacy-profiles/${slug}.json`,
    `data/pharmacy-competitor-intelligence/${slug}-intelligence.json`,
    `data/growth-engine/${slug}-competitors.json`,
    `data/growth-engine/${slug}-opportunities.json`,
    `data/growth-engine/${slug}-growth-plan.json`,
    `data/growth-engine/${slug}-workflow.json`,
    `data/pharmacy-master-admin/workflow-history/${slug}.json`,
    `data/pharmacy-campaigns/${slug}.json`,
  ]) {
    fs.rmSync(path.join(WORKSPACE_ROOT, rel), { force: true });
  }
}

const originalFetch = globalThis.fetch;
globalThis.fetch = (async () => {
  throw new Error("external collection is not allowed");
}) as typeof fetch;

const before = acceptanceHashes();
const slugA = "gp-connection-fixture-a";
const slugB = "gp-connection-fixture-b";
const slugC = "gp-connection-fixture-c";

try {
  writeTenant(slugA, "travel-vaccinations", "Travel Vaccinations");
  writeTenant(slugB, "flu-vaccinations", "Flu Vaccinations");
  writeTenant(slugC, "ear-wax-removal", "Ear Wax Removal");

  const unapproved = buildOverviewAuthorityV1(slugC);
  assert(unapproved.growthPlan === "NOT AVAILABLE", "unapproved intelligence does not make a Growth Plan available");
  assert(readPersistedGrowthPlan(slugC) == null, "unapproved intelligence does not persist a Growth Plan");

  const approved = approveCommercialIntelligence(slugA, "validator");
  assert(approved.ok === true, "approval workflow succeeds for completed intelligence");
  const overviewA = buildOverviewAuthorityV1(slugA);
  const planA = readPersistedGrowthPlan(slugA);
  assert(Boolean(planA), "approval persists a Growth Plan");
  assert(planA?.status === "ready_for_review", "Growth Plan is ready for review and not approved");
  assert(planA?.priorityServiceId === "travel-vaccinations", "priority service comes from approved intelligence");
  assert(!JSON.stringify(planA).includes("pharmacy-first"), "priority-service default is not added to the plan");
  assert(planA?.evidenceLimitations.some((line) => /demand/i.test(line)), "unknown demand stays an evidence limitation");
  assert(planA?.evidenceLimitations.some((line) => /deferred/i.test(line)), "deferred Google profile stays an evidence limitation");
  assert(!JSON.stringify(planA).includes("searchVolume"), "the plan does not invent demand numbers");
  assert(overviewA.growthPlan.includes("READY FOR REVIEW"), "Master Admin reads the persisted Growth Plan");
  assert(overviewA.growthPlanDetail?.priorityServiceName === "Travel Vaccinations", "Master Admin shows the priority service");
  assert(overviewA.growthPlanDetail?.approvedIntelligenceRevision === planA?.approvedIntelligenceRevision, "Master Admin shows the approved intelligence revision");
  assert(!fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-campaigns", `${slugA}.json`)), "approval does not create a campaign");

  approveCommercialIntelligence(slugB, "validator");
  const planB = readPersistedGrowthPlan(slugB);
  assert(planB?.priorityServiceId === "flu-vaccinations", "second tenant plan uses its own approved service");
  assert(planA?.approvedIntelligenceRevision !== planB?.approvedIntelligenceRevision || planA?.priorityServiceId !== planB?.priorityServiceId, "tenant plans do not leak");

  const revisionA = planA?.approvedIntelligenceRevision;
  writeReport(slugA, "travel-vaccinations", "Travel Vaccinations", "2026-09-27T18:00:00.000Z");
  const drifted = buildOverviewAuthorityV1(slugA);
  const storedAfterDrift = readPersistedGrowthPlan(slugA);
  assert(storedAfterDrift?.approvedIntelligenceRevision === revisionA, "a newer unapproved revision does not replace Growth Plan A");
  assert(drifted.growthPlan === "NOT AVAILABLE", "Growth Plan A is not presented as the plan for unapproved revision B");
  assert(drifted.growthPlanDetail == null, "Master Admin does not attach revision A to unapproved revision B");
} finally {
  globalThis.fetch = originalFetch;
  removeTenant(slugA);
  removeTenant(slugB);
  removeTenant(slugC);
}

assert(before === acceptanceHashes(), "acceptance intelligence, plan inputs, and campaign records stay unchanged");

if (failures.length) {
  console.error(`FAILED ${failures.length}`);
  process.exit(1);
}
console.log("PASS growth plan approval connection");
