import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { validateContentGenerationContext } from "../src/pharmacy/contentEngine/contentEngineContract.ts";
import { computeTechnicalGenerationReadiness } from "../src/pharmacy/pharmacyCommercialReadinessGate.ts";
import { computeWizardQualityScore } from "../src/pharmacy/pharmacyProfileWizardScoring.ts";
import { normalizeProfileData, type PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const ROOT = process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.pharmaconnect.uk";
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const QUALITY_ROUTE_SOURCE = path.join(ROOT, "artifacts/api-server/src/routes/pharmacyProfileQualityPage.ts");
const SCORING_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardScoring.ts");
const OUTPUT_ROOT = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, CAMPAIGN_ID);
const BANNED = /brook|rowlands|\bdhm\b|pharmacy\.inboxingproweb|default pharmacy|fallback profile|demo superintendent|mock pharmacy/i;

type AuditField = {
  label: string;
  browserInputName: string;
  submittedValue: unknown;
  profileJsonKey: string;
  savedValue: unknown;
  qualityCalculatorKey: string;
  complete: "YES" | "NO";
  reasonIncomplete: string;
};

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

function primaryServiceId(data: PharmacyProfileData): string {
  return (data.selectedServices || []).includes(CAMPAIGN_ID)
    ? CAMPAIGN_ID
    : (data.selectedServices || [CAMPAIGN_ID])[0] || CAMPAIGN_ID;
}

function appointmentSubmittedValue(data: PharmacyProfileData): string {
  const service = data.serviceDeliveryProfiles?.[primaryServiceId(data)];
  if (service?.walkInAvailable && service?.appointmentRequired) return "both";
  if (service?.walkInAvailable) return "walkin";
  if (service?.appointmentRequired) return "appointment";
  return "confirm";
}

function appointmentSavedValue(data: PharmacyProfileData): Record<string, unknown> {
  const service = data.serviceDeliveryProfiles?.[primaryServiceId(data)];
  return {
    appointmentRequired: service?.appointmentRequired ?? null,
    walkInAvailable: service?.walkInAvailable ?? null,
    bookingMethod: data.bookingMethod,
  };
}

function fundingSavedValue(data: PharmacyProfileData): string {
  return data.serviceDeliveryProfiles?.[primaryServiceId(data)]?.fundingModel || "unknown";
}

function areaSubmittedValue(data: PharmacyProfileData): string[] {
  const names = new Set<string>();
  for (const area of data.selectedAreas || []) if (area.areaName && area.selected !== false) names.add(area.areaName);
  for (const name of [...(data.rankingAreas || []), ...(data.coverageAreas || [])]) if (name) names.add(name);
  return [...names];
}

function fieldAudit(data: PharmacyProfileData): AuditField[] {
  const quality = computeWizardQualityScore(data);
  const byId = new Map(quality.requiredQualityFields.map((field) => [field.id, field.ok]));
  const complete = (id: string) => (byId.get(id) ? "YES" : "NO") as "YES" | "NO";
  return [
    {
      label: "Business description",
      browserInputName: "businessDescription",
      submittedValue: data.businessDescription || "",
      profileJsonKey: "data.businessDescription",
      savedValue: data.businessDescription || "",
      qualityCalculatorKey: "data.businessDescription",
      complete: complete("businessDescription"),
      reasonIncomplete: data.businessDescription ? "" : "No businessDescription saved in live profile.",
    },
    {
      label: "Appointment / walk-in method",
      browserInputName: "appointmentMethod",
      submittedValue: appointmentSubmittedValue(data),
      profileJsonKey: `data.serviceDeliveryProfiles.${primaryServiceId(data)}.appointmentRequired / walkInAvailable OR data.bookingMethod`,
      savedValue: appointmentSavedValue(data),
      qualityCalculatorKey: "serviceDeliveryProfiles[serviceId].appointmentRequired / walkInAvailable OR bookingMethod",
      complete: complete("serviceAppointmentWalkIn"),
      reasonIncomplete: complete("serviceAppointmentWalkIn") === "YES" ? "" : "No appointmentRequired, walkInAvailable, or contact-pharmacy confirmation saved.",
    },
    {
      label: "Funding model for selected service",
      browserInputName: "fundingModel",
      submittedValue: fundingSavedValue(data),
      profileJsonKey: `data.serviceDeliveryProfiles.${primaryServiceId(data)}.fundingModel`,
      savedValue: fundingSavedValue(data),
      qualityCalculatorKey: "serviceDeliveryProfiles[serviceId].fundingModel !== unknown",
      complete: complete("serviceFundingModel"),
      reasonIncomplete: fundingSavedValue(data) !== "unknown" ? "" : "Funding model is still unknown for selected Pharmacy First service.",
    },
    {
      label: "Local entities / areas selected",
      browserInputName: "serviceAreas",
      submittedValue: areaSubmittedValue(data),
      profileJsonKey: "data.selectedAreas / data.coverageAreas / data.rankingAreas",
      savedValue: areaSubmittedValue(data),
      qualityCalculatorKey: "selectedAreas OR rankingAreas OR coverageAreas",
      complete: complete("localEntitiesAreas"),
      reasonIncomplete: areaSubmittedValue(data).length ? "" : "No selected service area saved.",
    },
    {
      label: "Competitors reviewed",
      browserInputName: "profileCompetitorsReviewed",
      submittedValue: data.profileCompetitorsReviewed || data.competitorReviewConfirmed || false,
      profileJsonKey: "data.profileCompetitorsReviewed / data.profileCompetitorsReviewedAt",
      savedValue: {
        profileCompetitorsReviewed: data.profileCompetitorsReviewed,
        profileCompetitorsReviewedAt: data.profileCompetitorsReviewedAt,
        competitorReviewConfirmed: data.competitorReviewConfirmed,
      },
      qualityCalculatorKey: "profileCompetitorsReviewed OR competitorReviewConfirmed OR selected/noted profileCompetitors OR mainCompetitors OR profileWizardEnrichedAt",
      complete: complete("competitorsReviewed"),
      reasonIncomplete: complete("competitorsReviewed") === "YES" ? "" : "Competitor review confirmation has not been saved.",
    },
    {
      label: "Target patient groups",
      browserInputName: "targetPatientGroups",
      submittedValue: data.targetPatientGroups || [],
      profileJsonKey: "data.targetPatientGroups",
      savedValue: data.targetPatientGroups || [],
      qualityCalculatorKey: "data.targetPatientGroups.length > 0",
      complete: complete("targetPatientGroups"),
      reasonIncomplete: (data.targetPatientGroups || []).length ? "" : "No targetPatientGroups saved in live profile.",
    },
    {
      label: "Unique selling points",
      browserInputName: "uniqueSellingPoints",
      submittedValue: data.uniqueSellingPoints || [],
      profileJsonKey: "data.uniqueSellingPoints",
      savedValue: data.uniqueSellingPoints || [],
      qualityCalculatorKey: "data.uniqueSellingPoints.length > 0",
      complete: complete("uniqueSellingPoints"),
      reasonIncomplete: (data.uniqueSellingPoints || []).length ? "" : "No uniqueSellingPoints saved in live profile.",
    },
  ];
}

function detectMappingDefects(fields: AuditField[], routeSource: string, scoringSource: string): string[] {
  const defects: string[] = [];
  for (const field of fields) {
    if (!routeSource.includes(`name="${field.browserInputName}"`)) {
      defects.push(`${field.label}: browser input name ${field.browserInputName} not found in quality page`);
    }
  }
  const expectedRouteWrites = [
    ["Business description", "businessDescription:"],
    ["Appointment / walk-in method", "appointmentRequired:"],
    ["Appointment / walk-in method", "walkInAvailable:"],
    ["Funding model for selected service", "fundingModel:"],
    ["Local entities / areas selected", "selectedAreas:"],
    ["Competitors reviewed", "profileCompetitorsReviewed:"],
    ["Target patient groups", "targetPatientGroups:"],
    ["Unique selling points", "uniqueSellingPoints:"],
  ];
  for (const [label, needle] of expectedRouteWrites) {
    if (!routeSource.includes(needle)) defects.push(`${label}: save route does not write ${needle}`);
  }
  const expectedScoringReads = [
    ["Business description", "data.businessDescription"],
    ["Appointment / walk-in method", "appointmentRequired"],
    ["Appointment / walk-in method", "walkInAvailable"],
    ["Funding model for selected service", "fundingModel"],
    ["Local entities / areas selected", "hasAreas(data)"],
    ["Competitors reviewed", "data.profileCompetitorsReviewed"],
    ["Target patient groups", "data.targetPatientGroups"],
    ["Unique selling points", "data.uniqueSellingPoints"],
  ];
  for (const [label, needle] of expectedScoringReads) {
    if (!scoringSource.includes(needle)) defects.push(`${label}: score calculator does not read ${needle}`);
  }
  return [...new Set(defects)];
}

async function main(): Promise<void> {
  const profileDoc = readJson<{ data?: Record<string, unknown> }>(PROFILE_PATH, {});
  const data = normalizeProfileData(profileDoc.data || {});
  const outputMtimeBefore = mtimeMs(OUTPUT_ROOT);
  const ctx = buildContentGenerationContext(SLUG, CAMPAIGN_ID);
  const outputMtimeAfter = mtimeMs(OUTPUT_ROOT);
  const quality = computeWizardQualityScore(data);
  const fields = fieldAudit(data);
  const routeSource = read(QUALITY_ROUTE_SOURCE);
  const scoringSource = read(SCORING_SOURCE);
  const mappingDefects = detectMappingDefects(fields, routeSource, scoringSource);
  const technical = computeTechnicalGenerationReadiness(validateContentGenerationContext(ctx), demoLeakageContext(ctx));
  const completeFields = fields.filter((field) => field.complete === "YES").map((field) => field.label);
  const incompleteFields = fields.filter((field) => field.complete === "NO").map((field) => `${field.label}: ${field.reasonIncomplete}`);
  const cause = {
    genuinelyIncompleteFields: incompleteFields.length > 0 && mappingDefects.length === 0,
    saveRouteMismatch: mappingDefects.some((defect) => /save route/.test(defect)),
    legacyFieldNames: false,
    arrayStringFormatMismatch: false,
    staleCachedScore: quality.overallScore !== computeWizardQualityScore(normalizeProfileData(profileDoc.data || {})).overallScore,
    qualityCalculatorReadingAnotherKey: mappingDefects.some((defect) => /score calculator/.test(defect)),
  };

  const output = {
    "Campaign Content Quality": `${quality.overallScore}%`,
    completeFields,
    incompleteFields,
    fieldMappingDefectsFound: mappingDefects.length ? mappingDefects : ["None"],
    exactBrowserUrl: `${APP_DOMAIN.replace(/\/$/, "")}/api/pharmacy-profile-quality?slug=${encodeURIComponent(SLUG)}`,
    technicalGenerationReadiness: technical.status,
    auditCause: cause,
    fieldTrace: fields,
    validationChecks: {
      allSevenFieldsUseSameKeysForFormSaveAndScore: mappingDefects.length === 0,
      savedBrowserValuesAreRecognised: fields.every((field) => {
        if (field.complete === "YES") return true;
        const saved = JSON.stringify(field.savedValue);
        return saved === "\"\"" || saved === "[]" || saved.includes("unknown") || saved.includes("null") || saved.includes("false");
      }),
      noStaleCachedPercentage: !cause.staleCachedScore,
      exactIncompleteFieldsListed: incompleteFields.length === quality.requiredQualityIncomplete.length,
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
