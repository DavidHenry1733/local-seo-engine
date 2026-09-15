import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { validateContentGenerationContext } from "../src/pharmacy/contentEngine/contentEngineContract.ts";
import {
  computeCommercialPublishingReadiness,
  computeTechnicalGenerationReadiness,
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

function withRequiredCommercialFields(data: ReturnType<typeof normalizeProfileData>): ReturnType<typeof normalizeProfileData> {
  return normalizeProfileData({
    ...data,
    gphcNumber: "9012345",
    reviewerName: "Sample Reviewer",
    reviewerRole: "Superintendent Pharmacist",
    reviewerQualifications: "MPharm",
    reviewerGphcNumber: "2071234",
    clinicalReviewDate: "2026-07-12",
    awards: [],
    accreditations: [],
    reviewHighlights: [],
    testimonials: [],
    numberOfPatients: "",
    nhsProfileUrl: "",
    superintendentPharmacistName: "",
  });
}

function withoutRequiredCommercialFields(data: ReturnType<typeof normalizeProfileData>): ReturnType<typeof normalizeProfileData> {
  return normalizeProfileData({
    ...data,
    gphcNumber: "",
    reviewerName: "",
    reviewerRole: "",
    reviewerQualifications: "",
    reviewerGphcNumber: "",
    clinicalReviewDate: "",
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
  const completedRequired = computeCommercialPublishingReadiness(withRequiredCommercialFields(profile));
  const missingRequired = computeCommercialPublishingReadiness(withoutRequiredCommercialFields(profile));
  const wizardSource = fs.readFileSync(WIZARD_SOURCE, "utf8");
  const browserUrl = `${APP_DOMAIN.replace(/\/$/, "")}/api/pharmacy-profile-wizard?slug=${encodeURIComponent(SLUG)}#wizard-trust-professional-review`;
  const optionalLabels = [
    "Awards",
    "Accreditations",
    "Review highlights",
    "Review quotes",
    "Number of patients served",
    "NHS profile URL",
    "Superintendent Pharmacist name",
  ];
  const requiredLabels = [
    "GPhC premises number",
    "Reviewer name",
    "Reviewer role",
    "Reviewer qualifications",
    "Reviewer GPhC number",
    "Review date",
  ];
  const optionalMissingFields = commercial.optionalMissingFields;
  const requiredMissingFields = commercial.missingManualFields;

  const output = {
    "Technical Generation Readiness": technical.status,
    "Commercial Publishing Readiness": commercial.status,
    requiredMissingFields,
    optionalMissingFields,
    exactBrowserUrl: browserUrl,
    scores: {
      technicalGenerationReadiness: technical.score,
      commercialPublishingReadiness: commercial.score,
      optionalEnrichmentScore: commercial.optionalEnrichmentScore,
    },
    validationChecks: {
      awardsAreOptional: !requiredMissingFields.includes("Awards") && completedRequired.optionalMissingFields.includes("Awards"),
      accreditationsAreOptional: !requiredMissingFields.includes("Accreditations") && completedRequired.optionalMissingFields.includes("Accreditations"),
      reviewHighlightsAreOptional: !requiredMissingFields.includes("Review highlights") && completedRequired.optionalMissingFields.includes("Review highlights"),
      reviewQuotesAreOptional: !requiredMissingFields.includes("Review quotes") && completedRequired.optionalMissingFields.includes("Review quotes"),
      patientsServedIsOptional: !requiredMissingFields.includes("Number of patients served") && completedRequired.optionalMissingFields.includes("Number of patients served"),
      optionalFieldsDoNotBlockReady: completedRequired.status === "READY" && completedRequired.optionalMissingFields.length > 0,
      optionalFieldsShowOptionalInWizard:
        wizardSource.includes("Optional profile enhancements") &&
        wizardSource.includes("OPTIONAL") &&
        optionalLabels.every((label) => wizardSource.includes(label)),
      noInventedTrustClaims: completedRequired.status === "READY" && completedRequired.optionalEnrichmentScore < 100,
      requiredRegulatoryReviewerFieldsStillBlock:
        missingRequired.status === "NOT READY" &&
        requiredLabels.every((label) => missingRequired.missingManualFields.includes(label)),
      profileBecomesReadyWhenAllGenuineRequiredFieldsComplete: completedRequired.status === "READY",
      technicalGenerationStillPasses: technical.status === "PASS",
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
