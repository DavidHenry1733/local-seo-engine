/**
 * Explicit Growth Plan approval is required before a campaign can be created.
 * Approval is bound to the plan revision and the approved intelligence revision.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyServiceLibraryService.ts";
import { writeSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { writeCompetitorIntelligence } from "../src/pharmacy/pharmacyCompetitorIntelligence.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { approveCommercialIntelligence } from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";
import {
  decideGrowthPlan,
  resolveGrowthPlanReview,
} from "../src/pharmacy/masterAdminGrowthPlanConnectionService.ts";
import { buildOverviewAuthorityV1 } from "../src/pharmacy/masterAdminOverviewAuthorityService.ts";
import { createPharmacyCampaign } from "../src/pharmacy/pharmacyCampaignService.ts";

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
    `data/growth-engine/${slug}-competitors.json`,
    `data/pharmacy-competitor-intelligence/${slug}-intelligence.json`,
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
    opportunities: [{ id: `service-opportunity-${serviceId}`, serviceId, title: `${serviceName}: insufficient evidence`, category: "pharmacy-services", priority: "low" }],
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
    generatedAt: "2026-09-28T08:00:00.000Z",
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
  fs.writeFileSync(path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-competitors.json`), JSON.stringify({
    slug,
    generatedAt: "2026-09-28T08:05:00.000Z",
    source: "google-places-live",
    competitors: [{ placeId: `ChIJ${slug}`, businessName: `${serviceName} Neighbour`, source: "google-places" }],
    analysis: { competitorCount: 1, dataSource: "google-places-live" },
  }, null, 2));
  writeReport(slug, serviceId, serviceName, "2026-09-28T08:10:00.000Z");
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
    `data/pharmacy-campaigns/${slug}.json`,
    `data/pharmacy-campaign-launch-queue/${slug}.json`,
    `data/pharmacy-master-admin/active-service-campaign/${slug}.json`,
    `data/pharmacy-master-admin/workflow-history/${slug}.json`,
    `data/pharmacy-image-assignments/${slug}.json`,
    `data/pharmacy-content-packages/${slug}`,
  ]) {
    fs.rmSync(path.join(WORKSPACE_ROOT, rel), { recursive: true, force: true });
  }
}

function expectBlocked(slug: string, serviceId: string): boolean {
  try {
    createPharmacyCampaign(slug, { serviceId, campaignGoal: "Pharmacy Growth" });
    return false;
  } catch (err) {
    return err instanceof Error && /Growth Plan approval is required/.test(err.message);
  }
}

const originalFetch = globalThis.fetch;
globalThis.fetch = (async () => {
  throw new Error("external collection is not allowed");
}) as typeof fetch;

const historicalBefore = Object.fromEntries(HISTORICAL.map((slug) => [slug, recordSet(slug)]));
const liveBefore = recordSet(LIVE);
const slug = "gp-approval-campaign-fixture";

try {
  writeTenant(slug, "travel-vaccinations", "Travel Vaccinations");
  approveCommercialIntelligence(slug, "validator");
  const beforeDecision = resolveGrowthPlanReview(slug);
  const overviewBefore = buildOverviewAuthorityV1(slug);
  assert(beforeDecision.state === "ready_for_review", "new Growth Plan is ready for review");
  assert(beforeDecision.campaignCreationAllowed === false, "ready for review does not allow a campaign");
  assert(overviewBefore.growthPlan.startsWith("READY FOR REVIEW"), "overview uses the same ready-for-review authority");
  assert(overviewBefore.growthPlanDetail?.decision === "ready_for_review", "Growth Plan detail is not approved");
  assert(!fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-campaigns", `${slug}.json`)), "opening the plan does not create a campaign");
  assert(expectBlocked(slug, "travel-vaccinations"), "campaign creation is blocked before approval");

  const rejected = decideGrowthPlan(slug, "rejected", "validator");
  assert(rejected.state === "rejected", "explicit rejection is recorded");
  assert(expectBlocked(slug, "travel-vaccinations"), "a rejected plan cannot create a campaign");

  const approved = decideGrowthPlan(slug, "approved", "validator");
  assert(approved.state === "approved", "explicit approval is recorded for the current plan");
  assert(approved.campaignCreationAllowed === true, "approval allows campaign creation");
  const overviewApproved = buildOverviewAuthorityV1(slug);
  assert(overviewApproved.growthPlan.startsWith("APPROVED"), "overview reads the same approval");
  assert(overviewApproved.growthPlanDetail?.campaignCreationAllowed === true, "campaign screen authority matches the approval");

  let wrongServiceBlocked = false;
  try {
    createPharmacyCampaign(slug, { serviceId: "flu-vaccinations", campaignGoal: "Pharmacy Growth" });
  } catch (err) {
    wrongServiceBlocked = err instanceof Error && /must match the approved Growth Plan/.test(err.message);
  }
  assert(wrongServiceBlocked, "campaign service must be the approved plan service");

  const created = createPharmacyCampaign(slug, { serviceId: "travel-vaccinations", campaignGoal: "Pharmacy Growth" });
  assert(/^[0-9a-f-]{36}$/i.test(created.campaign.id), "campaign has a UUID");
  assert(created.campaign.serviceId === "travel-vaccinations", "campaign service comes from the approved plan");
  assert(created.campaign.sourceGrowthPlanRevision === approved.growthPlanRevision, "campaign records the Growth Plan revision");
  assert(created.campaign.sourceApprovedIntelligenceRevision === approved.approvedIntelligenceRevision, "campaign records the approved intelligence revision");
  assert((created.campaign.campaignAreas || []).length === 0, "no localities are fabricated");
  assert(!fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", slug)), "no content package is created");

  const planFile = path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-growth-plan.json`);
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  const revisionA = plan.generatedAt;
  plan.generatedAt = "2026-09-28T09:00:00.000Z";
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
  const revisionB = resolveGrowthPlanReview(slug);
  assert(revisionB.state === "ready_for_review", "revised plan B is not approved by decision A");
  assert(revisionB.previousDecisionStale === true, "decision A is stale for plan B");
  assert(revisionB.campaignCreationAllowed === false, "campaign creation from plan B is blocked");
  assert(expectBlocked(slug, "travel-vaccinations"), "creating a campaign from plan B throws");

  writeReport(slug, "travel-vaccinations", "Travel Vaccinations", "2026-09-28T10:00:00.000Z");
  const drifted = resolveGrowthPlanReview(slug);
  assert(drifted.state === "stale", "a new intelligence revision makes the previous plan approval stale");
  assert(drifted.campaignCreationAllowed === false, "the previous approval does not cover the new intelligence revision");
  assert(expectBlocked(slug, "travel-vaccinations"), "campaign creation stays blocked after intelligence drift");
} finally {
  globalThis.fetch = originalFetch;
  removeTenant(slug);
}

for (const historical of HISTORICAL) {
  assert(historicalBefore[historical] === recordSet(historical), `${historical} operational records stay unchanged`);
}
assert(liveBefore === recordSet(LIVE), "fresh tenant protected records stay unchanged");

if (failures.length) {
  console.error(`FAILED ${failures.length}`);
  process.exit(1);
}
console.log("PASS growth plan approval campaign");
