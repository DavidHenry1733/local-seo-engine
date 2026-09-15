import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { validateContentGenerationContext } from "../src/pharmacy/contentEngine/contentEngineContract.ts";
import {
  computeCommercialPublishingReadiness,
  computeTechnicalGenerationReadiness,
} from "../src/pharmacy/pharmacyCommercialReadinessGate.ts";
import { computeWizardQualityScore } from "../src/pharmacy/pharmacyProfileWizardScoring.ts";
import { normalizeProfileData, type PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const ROOT = process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine";
const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.pharmaconnect.uk";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const QUALITY_ROUTE_SOURCE = path.join(ROOT, "artifacts/api-server/src/routes/pharmacyProfileQualityPage.ts");
const ROUTE_INDEX_SOURCE = path.join(ROOT, "artifacts/api-server/src/routes/index.ts");
const SCORING_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardScoring.ts");
const OUTPUT_ROOT = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, CAMPAIGN_ID);
const BANNED = /brook|rowlands|\bdhm\b|pharmacy\.inboxingproweb|default pharmacy|fallback profile|demo superintendent|mock pharmacy/i;

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(read(file)) as T;
}

function mtimeMs(file: string): number | null {
  return fs.existsSync(file) ? fs.statSync(file).mtimeMs : null;
}

function demoLeakageContext(ctx: ReturnType<typeof buildContentGenerationContext>): boolean {
  return BANNED.test(JSON.stringify({
    slug: ctx.slug,
    resolvedSlug: ctx.resolvedSlug,
    serviceId: ctx.serviceId,
    profile: ctx.profile,
    rawProfile: ctx.rawProfile,
    brand: ctx.brand,
    reviewer: ctx.reviewer,
    cta: ctx.cta,
    map: ctx.map,
    selectedAreas: ctx.selectedAreas,
    primaryTown: ctx.primaryTown,
    localArea: ctx.localArea,
    coverageAreas: ctx.coverageAreas,
    tokens: ctx.tokens,
    businessProfileIntelligence: ctx.businessProfileIntelligence,
  }));
}

function completedProfile(profile: PharmacyProfileData): PharmacyProfileData {
  const serviceId = (profile.selectedServices || []).includes(CAMPAIGN_ID)
    ? CAMPAIGN_ID
    : (profile.selectedServices || [CAMPAIGN_ID])[0] || CAMPAIGN_ID;
  return normalizeProfileData({
    ...profile,
    businessDescription:
      profile.businessDescription ||
      "Customer confirmed business description for campaign quality completion.",
    serviceDeliveryProfiles: {
      ...(profile.serviceDeliveryProfiles || {}),
      [serviceId]: {
        ...(profile.serviceDeliveryProfiles?.[serviceId] || {}),
        serviceId,
        serviceName: "Pharmacy First",
        fundingModel: "nhs",
        appointmentRequired: true,
        walkInAvailable: true,
      },
    },
    selectedAreas: profile.selectedAreas?.length
      ? profile.selectedAreas
      : [{ areaName: profile.primaryTown || profile.townCity || "Rotherham", priority: 1, order: 1, selected: true, source: "customer-confirmed" }],
    profileCompetitorsReviewed: true,
    profileCompetitorsReviewedAt: new Date().toISOString(),
    targetPatientGroups: ["Families with children", "Older adults"],
    uniqueSellingPoints: ["Convenient local access", "Fast response by phone"],
    footerLinks: [],
    awards: [],
    testimonials: [],
    numberOfPatients: "",
  });
}

async function main(): Promise<void> {
  const profileDoc = readJson<{ data?: Record<string, unknown> }>(PROFILE_PATH, {});
  const profile = normalizeProfileData(profileDoc.data || {});
  const outputMtimeBefore = mtimeMs(OUTPUT_ROOT);
  const ctx = buildContentGenerationContext(SLUG, CAMPAIGN_ID);
  const outputMtimeAfter = mtimeMs(OUTPUT_ROOT);
  const technical = computeTechnicalGenerationReadiness(validateContentGenerationContext(ctx), demoLeakageContext(ctx));
  const commercial = computeCommercialPublishingReadiness(profile);
  const currentQuality = computeWizardQualityScore(profile);
  const completeQuality = computeWizardQualityScore(completedProfile(profile));
  const routeSource = read(QUALITY_ROUTE_SOURCE);
  const routeIndexSource = read(ROUTE_INDEX_SOURCE);
  const scoringSource = read(SCORING_SOURCE);
  const competitorReportPath = path.join(ROOT, "data/growth-engine", `${SLUG}-competitors.json`);
  const browserUrl = `${APP_DOMAIN.replace(/\/$/, "")}/api/pharmacy-profile-quality?slug=${encodeURIComponent(SLUG)}`;
  const sevenFieldStatuses = Object.fromEntries(currentQuality.requiredQualityFields.map((field) => [field.label, field.ok ? "Complete" : "Incomplete"]));

  const output = {
    browserUrl,
    currentCampaignContentQuality: `${currentQuality.overallScore}%`,
    sevenFieldStatuses,
    "Technical Generation Readiness": technical.status,
    "Commercial Publishing Readiness": commercial.status,
    validationChecks: {
      allSevenFieldsCanBeCompletedInBrowser:
        routeSource.includes("/pharmacy-profile-quality") &&
        routeSource.includes("Save Profile Quality Details") &&
        ["businessDescription", "appointmentMethod", "fundingModel", "serviceAreas", "profileCompetitorsReviewed", "targetPatientGroups", "uniqueSellingPoints"].every((name) =>
          routeSource.includes(`name="${name}"`),
        ),
      importedSuggestionsAreNotSilentlyAccepted:
        routeSource.includes("Suggested from website") &&
        routeSource.includes("Use Suggested Description") &&
        routeSource.includes("This is not accepted until you save") &&
        !routeSource.includes("businessDescription: websiteSuggestedDescription"),
      noDataInvented:
        routeSource.includes("websiteImportSnapshot?.description") &&
        routeSource.includes("websiteImportSnapshot?.intelligence?.identity?.metaDescription") &&
        routeSource.includes("uspOptions(data: PharmacyProfileData)") &&
        !routeSource.includes("value=\"Private consultation available\" checked"),
      competitorReviewCanBeConfirmedFromExistingLocalMarketData:
        fs.existsSync(competitorReportPath) &&
        routeSource.includes("Local competitor report available") &&
        routeSource.includes("name=\"profileCompetitorsReviewed\"") &&
        routeSource.includes("profileCompetitorsReviewed: competitorsReviewed") &&
        routeSource.includes("profileCompetitorsReviewedAt"),
      patientGroupsUsePresets:
        ["Families with children", "Older adults", "Working adults", "People managing long-term conditions", "Patients needing fast access to care", "People who find GP appointments difficult", "Local residents", "Carers"].every((label) =>
          routeSource.includes(label),
        ),
      uspsUseConfirmedFactsOnly:
        routeSource.includes("if (data.consultationRoomAvailable) options.push(\"Private consultation available\")") &&
        routeSource.includes("if (data.phone) options.push(\"Fast response by phone\")") &&
        routeSource.includes("websiteImportSnapshot?.customerVisibleServices"),
      qualityScoreReaches100: completeQuality.overallScore === 100 && completeQuality.requiredQualityIncomplete.length === 0,
      technicalReadinessRemainsPass: technical.status === "PASS",
      commercialReadinessRemainsReady: commercial.status === "READY",
      optionalFieldsDoNotBlock100:
        completeQuality.overallScore === 100 &&
        scoringSource.includes("optionalQualityFields") &&
        !completeQuality.requiredQualityFields.some((field) => field.id === "footerLinks"),
      routeRegistered: routeIndexSource.includes("pharmacyProfileQualityPageRouter"),
      noRegenerationOccurred: outputMtimeBefore === outputMtimeAfter,
    },
  };

  console.log(JSON.stringify(output, null, 2));

  if (!Object.values(output.validationChecks).every(Boolean)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
