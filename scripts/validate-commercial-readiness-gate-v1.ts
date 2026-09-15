import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { validateContentGenerationContext } from "../src/pharmacy/contentEngine/contentEngineContract.ts";
import {
  computeCommercialPublishingReadiness,
  computeTechnicalGenerationReadiness,
  professionalReviewClaimsAllowed,
} from "../src/pharmacy/pharmacyCommercialReadinessGate.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const ROOT = process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine";
const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.pharmaconnect.uk";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const TRUST_SAMPLE = {
  gphcNumber: "9012345",
  nhsProfileUrl: "https://www.nhs.uk/services/pharmacy/sample-pharmacy/",
  superintendentPharmacistName: "Sample Superintendent",
  reviewerName: "Sample Reviewer",
  reviewerRole: "Superintendent Pharmacist",
  reviewerQualifications: "MPharm",
  reviewerGphcNumber: "2071234",
  clinicalReviewDate: "2026-07-12",
};
const BANNED = /brook|rowlands|\bdhm\b|pharmacy\.inboxingproweb|default pharmacy|fallback profile|demo superintendent|mock pharmacy/i;

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function hasDemoLeakage(value: unknown): boolean {
  return BANNED.test(JSON.stringify(value));
}

function currentTrustValues(data: ReturnType<typeof normalizeProfileData>): Record<string, string> {
  return {
    gphcNumber: data.gphcNumber,
    nhsProfileUrl: data.nhsProfileUrl,
    superintendentPharmacistName: data.superintendentPharmacistName,
    reviewerName: data.reviewerName,
    reviewerRole: data.reviewerRole,
    reviewerQualifications: data.reviewerQualifications,
    reviewerGphcNumber: data.reviewerGphcNumber,
    clinicalReviewDate: data.clinicalReviewDate,
  };
}

function contextTrustValues(ctx: ReturnType<typeof buildContentGenerationContext>): Record<string, string> {
  return {
    gphcNumber: ctx.profile.gphcNumber,
    nhsProfileUrl: ctx.profile.nhsProfileUrl,
    superintendentPharmacistName: ctx.profile.superintendentPharmacistName,
    reviewerName: ctx.reviewer.name,
    reviewerRole: ctx.reviewer.role,
    reviewerQualifications: ctx.reviewer.qualifications,
    reviewerGphcNumber: ctx.reviewer.gphcNumber,
    clinicalReviewDate: ctx.reviewer.clinicalReviewDate,
  };
}

function manualSavePreserved(data: ReturnType<typeof normalizeProfileData>): boolean {
  const saved = normalizeProfileData({ ...data, ...TRUST_SAMPLE });
  return Object.entries(TRUST_SAMPLE).every(([key, value]) => (saved as unknown as Record<string, string>)[key] === value);
}

async function main(): Promise<void> {
  const profilePath = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
  const profileDoc = readJson<{ slug?: string; data?: Record<string, unknown> }>(profilePath, {});
  const profile = normalizeProfileData(profileDoc.data || {});
  const ctx = buildContentGenerationContext(SLUG, CAMPAIGN_ID);
  const contract = validateContentGenerationContext(ctx);
  const demoLeakage = hasDemoLeakage({
    profile,
    context: {
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
    },
  });
  const technical = computeTechnicalGenerationReadiness(contract, demoLeakage);
  const commercial = computeCommercialPublishingReadiness(profile);
  const browserUrl = `${APP_DOMAIN.replace(/\/$/, "")}/api/pharmacy-profile-wizard?slug=${encodeURIComponent(SLUG)}#wizard-trust-professional-review`;
  const profileTrust = currentTrustValues(profile);
  const ctxTrust = contextTrustValues(ctx);
  const contextReceivesSavedTrustFields = Object.entries(profileTrust).every(([key, value]) => ctxTrust[key] === value);
  const noTrustInvented = commercial.missingManualFields.every((label) => {
    const lower = label.toLowerCase();
    if (lower.includes("gphc premises")) return !profile.gphcNumber;
    if (lower.includes("nhs profile")) return !profile.nhsProfileUrl;
    if (lower.includes("superintendent")) return !profile.superintendentPharmacistName;
    if (lower === "reviewer name") return !profile.reviewerName;
    if (lower.includes("reviewer role")) return !profile.reviewerRole;
    if (lower.includes("qualifications")) return !profile.reviewerQualifications;
    if (lower.includes("reviewer gphc")) return !profile.reviewerGphcNumber;
    if (lower.includes("review date")) return !profile.clinicalReviewDate;
    return true;
  });

  const output = {
    "Technical Generation Readiness": technical.status,
    "Commercial Publishing Readiness": commercial.status,
    missingManualFields: commercial.missingManualFields,
    exactBrowserUrl: browserUrl,
    scores: {
      technicalGenerationReadiness: technical.score,
      commercialPublishingReadiness: commercial.score,
    },
    validationChecks: {
      technicalAndCommercialReadinessAreSeparate: technical.status === "PASS" && commercial.status === "NOT READY",
      missingTrustFieldsListed: commercial.missingManualFields.length > 0,
      profileNotFalselyShownCommerciallyReady: commercial.status !== "READY",
      noTrustDataInvented: noTrustInvented,
      manualFieldsSaveCorrectly: manualSavePreserved(profile),
      generationContextReceivesSavedTrustFields: contextReceivesSavedTrustFields,
      publishingBlockedWhileTrustIncomplete: commercial.publishingBlocked,
      professionalReviewClaimsBlockedUntilConfirmed: !professionalReviewClaimsAllowed(profile),
      noDemoLeakage: !demoLeakage,
      tenantSlugCorrect: ctx.resolvedSlug === SLUG,
      campaignCorrect: ctx.serviceId === CAMPAIGN_ID,
      generationContextSerialisesSuccessfully: JSON.stringify(ctx).length > 0,
    },
    technical,
    commercial,
    customerCampaignGenerationContext: ctx,
  };

  console.log(JSON.stringify(output, null, 2));

  const ok = technical.status === "PASS" &&
    commercial.status === "NOT READY" &&
    Object.values(output.validationChecks).every(Boolean);
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
