import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { validateContentGenerationContext } from "../src/pharmacy/contentEngine/contentEngineContract.ts";
import {
  computeCommercialPublishingReadiness,
  computeTechnicalGenerationReadiness,
} from "../src/pharmacy/pharmacyCommercialReadinessGate.ts";
import { computeWizardQualityScore } from "../src/pharmacy/pharmacyProfileWizardScoring.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { renderProfileWizardHtml } from "../src/pharmacy/pharmacyProfileWizardPage.ts";

const ROOT = process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine";
const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.pharmaconnect.uk";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const OUTPUT_ROOT = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, CAMPAIGN_ID);
const WIZARD_SECTIONS_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardSections.ts");
const WIZARD_PAGE_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardPage.ts");
const SCORING_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardScoring.ts");
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

async function main(): Promise<void> {
  const profileDoc = readJson<{ data?: Record<string, unknown> }>(PROFILE_PATH, {});
  const profile = normalizeProfileData(profileDoc.data || {});
  const outputMtimeBefore = mtimeMs(OUTPUT_ROOT);
  const ctx = buildContentGenerationContext(SLUG, CAMPAIGN_ID);
  const outputMtimeAfter = mtimeMs(OUTPUT_ROOT);
  const technical = computeTechnicalGenerationReadiness(validateContentGenerationContext(ctx), demoLeakageContext(ctx));
  const commercial = computeCommercialPublishingReadiness(profile);
  const quality = computeWizardQualityScore(profile);
  const html = renderProfileWizardHtml(SLUG, profile);
  const wizardSectionsSource = read(WIZARD_SECTIONS_SOURCE);
  const wizardPageSource = read(WIZARD_PAGE_SOURCE);
  const scoringSource = read(SCORING_SOURCE);
  const browserUrl = `${APP_DOMAIN.replace(/\/$/, "")}/api/pharmacy-profile-wizard?slug=${encodeURIComponent(SLUG)}#wizardStepHost`;
  const requiredIncompleteFields = quality.requiredQualityFields.filter((field) => !field.ok);
  const requiredActionLabels = [...new Set(requiredIncompleteFields.map((field) => field.actionLabel))];
  const completedProfile = normalizeProfileData({
    ...profile,
    businessDescription: profile.businessDescription || "A local pharmacy serving patients in Rotherham with accessible NHS and private healthcare support.",
    serviceDeliveryProfiles: Object.fromEntries(
      (profile.selectedServices || [CAMPAIGN_ID]).map((serviceId) => [
        serviceId,
        {
          ...(profile.serviceDeliveryProfiles?.[serviceId] || {}),
          serviceId,
          serviceName: serviceId,
          fundingModel: "nhs",
          appointmentRequired: true,
          walkInAvailable: true,
        },
      ]),
    ),
    selectedAreas: profile.selectedAreas?.length
      ? profile.selectedAreas
      : [{ areaName: "Rotherham", priority: 1, order: 1, selected: true, source: "validation" }],
    gpSurgeries: [{ id: "validation-gp", name: "Local GP Surgery", selected: true, source: "validation" }],
    competitorReviewConfirmed: true,
    targetPatientGroups: ["Families", "Older adults"],
    uniqueSellingPoints: ["Fast local access"],
    footerLinks: [],
  });
  const completedQuality = computeWizardQualityScore(completedProfile);

  const output = {
    "Technical Generation Readiness": technical.status,
    "Commercial Publishing Readiness": commercial.status,
    "Campaign Content Quality": `${quality.overallScore}%`,
    requiredIncompleteFields: quality.requiredQualityIncomplete,
    optionalIncompleteFields: quality.optionalQualityIncomplete,
    exactBrowserUrl: browserUrl,
    validationChecks: {
      campaignQualityLabelShown:
        html.includes(`Campaign Content Quality: ${quality.overallScore}%`) &&
        html.includes("Campaign Content Quality") &&
        !html.includes(`${quality.overallScore}% ready`),
      technicalReadinessShownSeparately: html.includes("Technical Generation Readiness") && html.includes(technical.status),
      commercialReadinessShownSeparately: html.includes("Commercial Publishing Readiness") && html.includes(commercial.status),
      footerLinksAreOptional:
        quality.optionalQualityFields.some((field) => field.id === "footerLinks") &&
        !quality.requiredQualityFields.some((field) => field.id === "footerLinks") &&
        completedQuality.overallScore === 100,
      sevenQualityFieldsClearlyIdentified:
        quality.requiredQualityFields.length === 7 &&
        [
          "businessDescription",
          "serviceAppointmentWalkIn",
          "serviceFundingModel",
          "localEntitiesAreas",
          "competitorsReviewed",
          "targetPatientGroups",
          "uniqueSellingPoints",
        ].every((id) => quality.requiredQualityFields.some((field) => field.id === id)),
      eachIncompleteFieldHasWorkingWizardAction:
        requiredActionLabels.every((label) => html.includes(label)) &&
        requiredIncompleteFields.every((field) => html.includes(`data-wizard-action-step="${field.actionStep}"`)),
      noCustomerFacingLegacyProfileLink:
        !html.includes("Open legacy full profile form") &&
        !html.includes("/api/pharmacy-profile-dashboard?slug="),
      completionCanBeAchievedThroughGuidedWizard:
        completedQuality.requiredQualityIncomplete.length === 0 &&
        completedQuality.overallScore === 100,
      guidedControlsExist:
        wizardSectionsSource.includes("businessDescription") &&
        wizardSectionsSource.includes("wizard-svc-funding") &&
        wizardSectionsSource.includes("wizard-svc-appt") &&
        wizardSectionsSource.includes("wizard-svc-walkin") &&
        wizardSectionsSource.includes("competitorReviewConfirmed") &&
        wizardSectionsSource.includes("wizard-patient-cb") &&
        wizardSectionsSource.includes("wizard-usp-cb"),
      guidedActionsAreWired: wizardPageSource.includes("data-wizard-action-step") && wizardPageSource.includes("goToStep(Number(actionJump"),
      qualityModelSourceIsSevenFieldModel:
        scoringSource.includes("buildCampaignContentQualityFields") &&
        scoringSource.includes("requiredQualityFields") &&
        scoringSource.includes("optionalQualityFields"),
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
