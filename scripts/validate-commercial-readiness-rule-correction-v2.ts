import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { validateContentGenerationContext } from "../src/pharmacy/contentEngine/contentEngineContract.ts";
import {
  computeCommercialPublishingReadiness,
  computeTechnicalGenerationReadiness,
  NEUTRAL_PHARMACY_TEAM_REVIEW_STATE,
  professionalReviewClaimsAllowed,
} from "../src/pharmacy/pharmacyCommercialReadinessGate.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const ROOT = process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine";
const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.pharmaconnect.uk";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const WIZARD_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardSections.ts");
const BANNED = /brook|rowlands|\bdhm\b|pharmacy\.inboxingproweb|default pharmacy|fallback profile|demo superintendent|mock pharmacy/i;

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
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

function withoutOptionalTrust(data: ReturnType<typeof normalizeProfileData>): ReturnType<typeof normalizeProfileData> {
  return normalizeProfileData({
    ...data,
    nhsProfileUrl: "",
    superintendentPharmacistName: "",
    reviewerName: "",
    reviewerRole: "",
    reviewerQualifications: "",
    reviewerGphcNumber: "",
    clinicalReviewDate: "",
    awards: [],
    accreditations: [],
    reviewHighlights: [],
    testimonials: [],
    numberOfPatients: "",
  });
}

function withoutGphc(data: ReturnType<typeof normalizeProfileData>): ReturnType<typeof normalizeProfileData> {
  return normalizeProfileData({ ...data, gphcNumber: "" });
}

function withGphcOnly(data: ReturnType<typeof normalizeProfileData>): ReturnType<typeof normalizeProfileData> {
  return normalizeProfileData({
    ...withoutOptionalTrust(data),
    gphcNumber: data.gphcNumber || "9012345",
  });
}

async function main(): Promise<void> {
  const profilePath = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
  const profileDoc = readJson<{ data?: Record<string, unknown> }>(profilePath, {});
  const profile = normalizeProfileData(profileDoc.data || {});
  const ctx = buildContentGenerationContext(SLUG, CAMPAIGN_ID);
  const contract = validateContentGenerationContext(ctx);
  const technical = computeTechnicalGenerationReadiness(contract, demoLeakageContext(ctx));
  const commercial = computeCommercialPublishingReadiness(profile);
  const noOptional = computeCommercialPublishingReadiness(withoutOptionalTrust(profile));
  const missingGphc = computeCommercialPublishingReadiness(withoutGphc(profile));
  const gphcOnly = computeCommercialPublishingReadiness(withGphcOnly(profile));
  const wizardSource = fs.readFileSync(WIZARD_SOURCE, "utf8");
  const browserUrl = `${APP_DOMAIN.replace(/\/$/, "")}/api/pharmacy-profile-wizard?slug=${encodeURIComponent(SLUG)}#wizard-trust-professional-review`;
  const optionalLabels = [
    "NHS profile URL",
    "Superintendent Pharmacist name",
    "Reviewer name",
    "Reviewer role",
    "Reviewer qualifications",
    "Reviewer GPhC number",
    "Review date",
    "Awards",
    "Accreditations",
    "Review highlights",
    "Review quotes",
    "Number of patients served",
  ];

  const output = {
    "Technical Generation Readiness": technical.status,
    "Commercial Publishing Readiness": commercial.status,
    requiredMissingFields: commercial.missingManualFields,
    optionalMissingFields: commercial.optionalMissingFields,
    exactBrowserUrl: browserUrl,
    scores: {
      technicalGenerationReadiness: technical.score,
      commercialPublishingReadiness: commercial.score,
      optionalEnrichmentScore: commercial.optionalEnrichmentScore,
    },
    validationChecks: {
      technicalReadinessRemainsPass: technical.status === "PASS",
      onlyGphcPremisesNumberCanBlockCommercialReadiness:
        missingGphc.status === "NOT READY" &&
        missingGphc.missingManualFields.length === 1 &&
        missingGphc.missingManualFields[0] === "GPhC premises number",
      nhsProfileUrlIsOptional: noOptional.optionalMissingFields.includes("NHS profile URL") && noOptional.status === "READY",
      superintendentNameIsOptional: noOptional.optionalMissingFields.includes("Superintendent Pharmacist name") && noOptional.status === "READY",
      reviewerFieldsAreOptional:
        ["Reviewer name", "Reviewer role", "Reviewer qualifications", "Reviewer GPhC number", "Review date"].every((field) =>
          noOptional.optionalMissingFields.includes(field),
        ) && noOptional.status === "READY",
      awardsAccreditationsReviewsPatientCountAreOptional:
        ["Awards", "Accreditations", "Review highlights", "Review quotes", "Number of patients served"].every((field) =>
          noOptional.optionalMissingFields.includes(field),
        ) && noOptional.status === "READY",
      optionalFieldsShowOptionalInWizard:
        wizardSource.includes("Optional trust and professional details") &&
        wizardSource.includes("OPTIONAL") &&
        optionalLabels.every((label) => wizardSource.includes(label)),
      noNamedPharmacistReviewClaimWithoutConfirmedReviewerData:
        !professionalReviewClaimsAllowed(withoutOptionalTrust(profile)) &&
        !computeCommercialPublishingReadiness(withoutOptionalTrust(profile)).namedProfessionalReviewAllowed,
      neutralPharmacyTeamReviewWordingUsedWhenReviewerAbsent:
        computeCommercialPublishingReadiness(withoutOptionalTrust(profile)).neutralReviewState === NEUTRAL_PHARMACY_TEAM_REVIEW_STATE,
      publishingReadinessBecomesReadyWhenGphcPremisesNumberIsSaved:
        gphcOnly.status === "READY" && gphcOnly.missingManualFields.length === 0,
      tenantSlugCorrect: ctx.resolvedSlug === SLUG,
      campaignCorrect: ctx.serviceId === CAMPAIGN_ID,
      generationContextSerialisesSuccessfully: JSON.stringify(ctx).length > 0,
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
