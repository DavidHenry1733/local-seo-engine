/**
 * Business Profile Wizard V2 — weighted quality score (display only; not used in generation).
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { hasOpeningHours } from "./pharmacyProfileHours.ts";
import { collectServiceIdsFromProfile } from "./pharmacyProfileV2Fields.ts";
import { isRequiredProfileComplete, computeRequiredProfileCompleteness } from "./pharmacyProfileFieldClassification.ts";
import { countHealthcareEntities } from "./pharmacyProfileLocalIntelligenceSelection.ts";
import { buildWizardImportFields, countImportSummary, countConfirmedImportFields, buildImportBrandSummary } from "./pharmacyProfileWizardEnrichment.ts";
import { WIZARD_TOTAL_STEPS } from "./pharmacyProfileWizardSteps.ts";

export type WizardQualityBand = "poor" | "good" | "excellent";

export interface WizardQualityCategory {
  id: string;
  label: string;
  weight: number;
  score: number;
  maxScore: number;
  percent: number;
  missing: string[];
  status: "complete" | "partial" | "needs_completion";
}

export interface WizardQualityResult {
  overallScore: number;
  scoringFormula: string;
  band: WizardQualityBand;
  bandLabel: string;
  categories: WizardQualityCategory[];
  readyToGenerate: boolean;
  missingRequired: string[];
  requiredQualityFields: WizardQualityField[];
  optionalQualityFields: WizardQualityField[];
  requiredQualityCompleteCount: number;
  requiredQualityTotal: number;
  requiredQualityIncomplete: string[];
  optionalQualityIncomplete: string[];
  recommendedImprovements: string[];
  estimatedMinutesRemaining: number;
  importSummary?: { imported: number; confirmed: number; missing: number };
}

export interface WizardQualityField {
  id: string;
  label: string;
  ok: boolean;
  actionLabel: string;
  actionStep: number;
}

function pct(passed: number, total: number): number {
  if (!total) return 0;
  return Math.round((passed / total) * 100);
}

function category(
  id: string,
  label: string,
  weight: number,
  checks: { label: string; ok: boolean }[],
): WizardQualityCategory {
  const passed = checks.filter((c) => c.ok).length;
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  const percent = pct(passed, checks.length);
  const maxScore = weight;
  const score = Math.round((percent / 100) * maxScore);
  const status: WizardQualityCategory["status"] =
    percent >= 100 ? "complete" : percent === 0 ? "needs_completion" : "partial";
  return { id, label, weight, score, maxScore, percent, missing, status };
}

function hasBrand(data: PharmacyProfileData): boolean {
  return Boolean(data.logoUrl || data.brandPrimaryColor || data.websiteAnalysisAt);
}

function hasAreas(data: PharmacyProfileData): boolean {
  return (
    (data.selectedAreas || []).some((a) => a.selected !== false) ||
    (data.rankingAreas || []).length > 0
  );
}

function serviceProfilesComplete(data: PharmacyProfileData): boolean {
  const ids = collectServiceIdsFromProfile(data as unknown as Record<string, unknown>);
  if (!ids.length) return false;
  return ids.every((id) => {
    const p = data.serviceDeliveryProfiles?.[id];
    return Boolean(p && (p.pricing || p.fundingModel !== "unknown" || p.consultationLengthLabel));
  });
}

function hasAppointmentOrWalkIn(data: PharmacyProfileData, serviceIds: string[]): boolean {
  if (data.bookingMethod === "contact-pharmacy-to-confirm") return true;
  return serviceIds.some((id) => {
    const p = data.serviceDeliveryProfiles?.[id];
    return Boolean(p && (p.appointmentRequired !== null || p.walkInAvailable !== null));
  });
}

function hasFundingModel(data: PharmacyProfileData, serviceIds: string[]): boolean {
  return serviceIds.some((id) => {
    const p = data.serviceDeliveryProfiles?.[id];
    return Boolean(p && p.fundingModel !== "unknown");
  });
}

function hasLocalAreasAndEntities(data: PharmacyProfileData): boolean {
  return hasAreas(data);
}

function hasCompetitorReview(data: PharmacyProfileData): boolean {
  return Boolean(
    data.profileCompetitorsReviewed ||
      data.competitorReviewConfirmed ||
      (data.profileCompetitors || []).some((c) => c.selected || c.notes) ||
      (data.mainCompetitors || []).length > 0 ||
      data.profileWizardEnrichedAt,
  );
}

export function buildCampaignContentQualityFields(data: PharmacyProfileData): {
  required: WizardQualityField[];
  optional: WizardQualityField[];
} {
  const serviceIds = collectServiceIdsFromProfile(data as unknown as Record<string, unknown>);
  return {
    required: [
      {
        id: "businessDescription",
        label: "Business description",
        ok: Boolean(data.businessDescription),
        actionLabel: "Complete Business Description",
        actionStep: 1,
      },
      {
        id: "serviceAppointmentWalkIn",
        label: "Appointment / walk-in method",
        ok: hasAppointmentOrWalkIn(data, serviceIds),
        actionLabel: "Complete Service Delivery",
        actionStep: 4,
      },
      {
        id: "serviceFundingModel",
        label: "Funding model for selected service",
        ok: hasFundingModel(data, serviceIds),
        actionLabel: "Complete Service Delivery",
        actionStep: 4,
      },
      {
        id: "localEntitiesAreas",
        label: "Local entities / areas selected",
        ok: hasLocalAreasAndEntities(data),
        actionLabel: "Complete Local Intelligence",
        actionStep: 5,
      },
      {
        id: "competitorsReviewed",
        label: "Competitors reviewed",
        ok: hasCompetitorReview(data),
        actionLabel: "Complete Local Intelligence",
        actionStep: 5,
      },
      {
        id: "targetPatientGroups",
        label: "Target patient groups",
        ok: (data.targetPatientGroups || []).length > 0,
        actionLabel: "Complete Patient Groups",
        actionStep: 6,
      },
      {
        id: "uniqueSellingPoints",
        label: "Unique selling points",
        ok: (data.uniqueSellingPoints || []).length > 0,
        actionLabel: "Complete Unique Selling Points",
        actionStep: 6,
      },
    ],
    optional: [
      {
        id: "footerLinks",
        label: "Footer links imported",
        ok: (data.footerLinks || []).length > 0,
        actionLabel: "Review Footer Links",
        actionStep: 1,
      },
    ],
  };
}

export function computeWizardQualityScore(data: PharmacyProfileData): WizardQualityResult {
  const required = computeRequiredProfileCompleteness(data);
  const serviceIds = collectServiceIdsFromProfile(data as unknown as Record<string, unknown>);
  const importFields = buildWizardImportFields(data);
  const importSummary = countImportSummary(importFields);
  const confirmedCount = countConfirmedImportFields(data);
  const brandSummary = buildImportBrandSummary(data);
  const qualityFields = buildCampaignContentQualityFields(data);

  const categories: WizardQualityCategory[] = [
    category("business", "Business & Import", 15, [
      { label: "Pharmacy name", ok: Boolean(data.pharmacyName) },
      { label: "Phone number", ok: Boolean(data.phone) },
      { label: "Website or email", ok: Boolean(data.website || data.businessEmail) },
      { label: "Address", ok: Boolean(data.addressLine1 && data.postcode) },
      { label: "Opening hours", ok: hasOpeningHours(data) },
      { label: "Website import completed", ok: Boolean(data.websiteAnalysisAt) },
      { label: "Imported fields confirmed", ok: confirmedCount >= 3 || importSummary.missing === 0 },
      { label: "Business description", ok: Boolean(data.businessDescription) },
    ]),
    category("brand", "Brand & Website", 15, [
      { label: "Logo or brand import", ok: hasBrand(data) },
      { label: "Primary brand colour", ok: Boolean(data.brandPrimaryColor) },
      { label: "Header/footer colours", ok: Boolean(data.brandHeaderBackgroundColor || data.brandFooterBackgroundColor || data.websiteAnalysisAt) },
      { label: "Footer links imported", ok: (data.footerLinks || []).length > 0 },
      { label: "Fonts configured", ok: Boolean(data.fontHeading && data.fontBody) },
      { label: "Brand elements from import", ok: brandSummary.logoUrl !== "" || brandSummary.primaryColor !== "" },
    ]),
    category("services", "Services", 20, [
      { label: "At least one service selected", ok: (data.selectedServices || []).length > 0 || serviceIds.length > 0 },
      { label: "Service delivery details started", ok: serviceIds.length > 0 && Object.keys(data.serviceDeliveryProfiles || {}).length > 0 },
      { label: "Appointment or walk-in specified", ok: serviceIds.some((id) => {
        const p = data.serviceDeliveryProfiles?.[id];
        return p && (p.appointmentRequired !== null || p.walkInAvailable !== null);
      }) },
      { label: "Funding model noted", ok: serviceIds.some((id) => {
        const p = data.serviceDeliveryProfiles?.[id];
        return p && p.fundingModel !== "unknown";
      }) },
    ]),
    category("local", "Local Intelligence", 15, [
      { label: "Primary town set", ok: Boolean(data.primaryTown || data.townCity) },
      { label: "Target areas selected", ok: hasAreas(data) },
      { label: "Local entities selected", ok: countHealthcareEntities(data as unknown as Record<string, unknown>) > 0 },
      { label: "Competitors reviewed", ok: (data.profileCompetitors || []).some((c) => c.selected) || (data.mainCompetitors || []).length > 0 },
      { label: "Local enrichment loaded", ok: Boolean(data.profileWizardEnrichedAt || data.localIntelligenceGenerated) },
    ]),
    category("patients", "Patient Groups", 10, [
      { label: "Target patient groups", ok: (data.targetPatientGroups || []).length > 0 },
      { label: "Unique selling points", ok: (data.uniqueSellingPoints || []).length > 0 },
    ]),
    category("trust", "Trust & Proof", 15, [
      { label: "Reviewer or superintendent", ok: Boolean(data.superintendentPharmacistName || data.reviewerName) },
      { label: "Clinical review date", ok: Boolean(data.clinicalReviewDate) },
      { label: "GPhC or accreditations", ok: Boolean(data.gphcNumber || (data.accreditations || []).length) },
      { label: "NHS or consultation room", ok: data.nhsServicesAvailable || data.consultationRoomAvailable },
      { label: "Accreditation presets selected", ok: (data.accreditations || []).length > 0 },
    ]),
    category("marketing", "Marketing & Readiness", 10, [
      { label: "Preferred CTA", ok: Boolean(data.preferredCta || data.preferredCtaWording || data.headerCtaText) },
      { label: "Booking method or URL", ok: Boolean(data.bookingMethod || data.bookingUrl || data.headerCtaUrl) },
      { label: "Content tone", ok: Boolean(data.contentIntelligence?.toneOfVoice || data.tone) },
    ]),
  ];

  const requiredQualityIncomplete = qualityFields.required.filter((f) => !f.ok).map((f) => f.label);
  const optionalQualityIncomplete = qualityFields.optional.filter((f) => !f.ok).map((f) => f.label);
  const requiredQualityTotal = qualityFields.required.length;
  const requiredQualityCompleteCount = qualityFields.required.filter((f) => f.ok).length;
  const campaignQualityScore = requiredQualityTotal
    ? (requiredQualityCompleteCount / requiredQualityTotal) * 100
    : 0;
  const band: WizardQualityBand = campaignQualityScore >= 80 ? "excellent" : campaignQualityScore >= 50 ? "good" : "poor";
  const bandLabel = band === "excellent" ? "Excellent" : band === "good" ? "Good" : "Poor";

  const recommendedImprovements = categories
    .flatMap((c) => c.missing.slice(0, 2).map((m) => `${c.label}: ${m}`))
    .slice(0, 10);

  const incompleteCategories = categories.filter((c) => c.status !== "complete").length;
  const reviewRemaining = importSummary.review + importSummary.imported;
  const estimatedMinutesRemaining = Math.max(2, Math.min(15, incompleteCategories * 2 + (reviewRemaining > 0 ? 2 : 0)));

  return {
    overallScore: campaignQualityScore,
    scoringFormula: `${requiredQualityCompleteCount}/${requiredQualityTotal} required quality fields complete × 100`,
    band,
    bandLabel,
    categories,
    readyToGenerate: isRequiredProfileComplete(data),
    missingRequired: required.missingRequired,
    requiredQualityFields: qualityFields.required,
    optionalQualityFields: qualityFields.optional,
    requiredQualityCompleteCount,
    requiredQualityTotal,
    requiredQualityIncomplete,
    optionalQualityIncomplete,
    recommendedImprovements,
    estimatedMinutesRemaining,
    importSummary,
  };
}

export function wizardProgressPercent(currentStep: number, totalSteps = WIZARD_TOTAL_STEPS): number {
  if (currentStep <= 1) return 0;
  return Math.min(100, Math.round(((currentStep - 1) / (totalSteps - 1)) * 100));
}

/** Programme card percentage: wizard quality 40% + required fields 60%. Not a completion record. */
export function computePharmacyProgrammeCompletionPct(data: PharmacyProfileData): number {
  const wizard = computeWizardQualityScore(data);
  const required = computeRequiredProfileCompleteness(data);
  return Math.round(wizard.overallScore * 0.4 + required.score * 0.6);
}
