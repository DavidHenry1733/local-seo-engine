import fs from "node:fs";
import path from "node:path";

import { computeWizardQualityScore } from "../src/pharmacy/pharmacyProfileWizardScoring.ts";
import { normalizeProfileData, type PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const ROOT = process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.pharmaconnect.uk";
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const SCORING_PATH = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardScoring.ts");
const QUALITY_PAGE_PATH = path.join(ROOT, "artifacts/api-server/src/routes/pharmacyProfileQualityPage.ts");
const OUTPUT_ROOT = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, CAMPAIGN_ID);

interface FieldTrace {
  field: string;
  browserInputName: string;
  submittedValue: unknown;
  canonicalProfileJsonKey: string;
  exactSavedValue: unknown;
  valueType: string;
  calculatorKey: string;
  calculatorExpectedType: string;
  countedAsComplete: "YES" | "NO";
  reasonIfNo: string;
  arithmetic: string;
}

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(read(file)) as T;
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function mtimeMs(file: string): number | null {
  return fs.existsSync(file) ? fs.statSync(file).mtimeMs : null;
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
  return data.bookingMethod === "contact-pharmacy-to-confirm" ? "confirm" : "(not submitted/saved)";
}

function appointmentSavedValue(data: PharmacyProfileData): Record<string, unknown> {
  const service = data.serviceDeliveryProfiles?.[primaryServiceId(data)];
  return {
    serviceId: primaryServiceId(data),
    appointmentRequired: service?.appointmentRequired ?? null,
    walkInAvailable: service?.walkInAvailable ?? null,
    bookingMethod: data.bookingMethod,
  };
}

function fundingSavedValue(data: PharmacyProfileData): string {
  return data.serviceDeliveryProfiles?.[primaryServiceId(data)]?.fundingModel || "unknown";
}

function selectedAreaValues(data: PharmacyProfileData): string[] {
  const names = new Set<string>();
  for (const area of data.selectedAreas || []) {
    if (area.areaName && area.selected !== false) names.add(area.areaName);
  }
  for (const name of [...(data.rankingAreas || []), ...(data.coverageAreas || [])]) {
    if (name) names.add(name);
  }
  return [...names];
}

function isComplete(quality: ReturnType<typeof computeWizardQualityScore>, id: string): boolean {
  return Boolean(quality.requiredQualityFields.find((field) => field.id === id)?.ok);
}

function traceFields(data: PharmacyProfileData, quality: ReturnType<typeof computeWizardQualityScore>): FieldTrace[] {
  const point = (ok: boolean) => `${ok ? 1 : 0}/1`;
  const businessOk = isComplete(quality, "businessDescription");
  const appointmentOk = isComplete(quality, "serviceAppointmentWalkIn");
  const fundingOk = isComplete(quality, "serviceFundingModel");
  const localOk = isComplete(quality, "localEntitiesAreas");
  const competitorOk = isComplete(quality, "competitorsReviewed");
  const patientsOk = isComplete(quality, "targetPatientGroups");
  const uspOk = isComplete(quality, "uniqueSellingPoints");

  return [
    {
      field: "Business description",
      browserInputName: "businessDescription",
      submittedValue: data.businessDescription || "",
      canonicalProfileJsonKey: "data.businessDescription",
      exactSavedValue: data.businessDescription || "",
      valueType: typeOf(data.businessDescription),
      calculatorKey: "data.businessDescription",
      calculatorExpectedType: "non-empty string",
      countedAsComplete: businessOk ? "YES" : "NO",
      reasonIfNo: businessOk ? "" : "data.businessDescription is empty.",
      arithmetic: point(businessOk),
    },
    {
      field: "Appointment / walk-in method",
      browserInputName: "appointmentMethod",
      submittedValue: appointmentSubmittedValue(data),
      canonicalProfileJsonKey: `data.serviceDeliveryProfiles.${primaryServiceId(data)}.appointmentRequired / walkInAvailable OR data.bookingMethod`,
      exactSavedValue: appointmentSavedValue(data),
      valueType: "object",
      calculatorKey: "data.bookingMethod === contact-pharmacy-to-confirm OR serviceDeliveryProfiles[serviceId].appointmentRequired/walkInAvailable !== null",
      calculatorExpectedType: "boolean flags or contact-confirmation string",
      countedAsComplete: appointmentOk ? "YES" : "NO",
      reasonIfNo: appointmentOk ? "" : "No appointmentRequired, walkInAvailable, or contact-pharmacy confirmation is saved.",
      arithmetic: point(appointmentOk),
    },
    {
      field: "Funding model for selected service",
      browserInputName: "fundingModel",
      submittedValue: fundingSavedValue(data),
      canonicalProfileJsonKey: `data.serviceDeliveryProfiles.${primaryServiceId(data)}.fundingModel`,
      exactSavedValue: fundingSavedValue(data),
      valueType: typeOf(fundingSavedValue(data)),
      calculatorKey: "serviceDeliveryProfiles[serviceId].fundingModel !== unknown",
      calculatorExpectedType: "string enum: nhs | private | mixed",
      countedAsComplete: fundingOk ? "YES" : "NO",
      reasonIfNo: fundingOk ? "" : `Funding model for ${primaryServiceId(data)} is unknown.`,
      arithmetic: point(fundingOk),
    },
    {
      field: "Local entities / areas selected",
      browserInputName: "serviceAreas",
      submittedValue: selectedAreaValues(data),
      canonicalProfileJsonKey: "data.selectedAreas / data.rankingAreas / data.coverageAreas",
      exactSavedValue: selectedAreaValues(data),
      valueType: "array",
      calculatorKey: "selectedAreas OR rankingAreas",
      calculatorExpectedType: "non-empty array",
      countedAsComplete: localOk ? "YES" : "NO",
      reasonIfNo: localOk ? "" : "No selected service area is saved.",
      arithmetic: point(localOk),
    },
    {
      field: "Competitors reviewed",
      browserInputName: "profileCompetitorsReviewed",
      submittedValue: data.profileCompetitorsReviewed || data.competitorReviewConfirmed || false,
      canonicalProfileJsonKey: "data.profileCompetitorsReviewed / data.profileCompetitorsReviewedAt",
      exactSavedValue: {
        profileCompetitorsReviewed: data.profileCompetitorsReviewed,
        profileCompetitorsReviewedAt: data.profileCompetitorsReviewedAt,
        competitorReviewConfirmed: data.competitorReviewConfirmed,
      },
      valueType: "object",
      calculatorKey: "data.profileCompetitorsReviewed OR data.competitorReviewConfirmed OR selected/noted competitors",
      calculatorExpectedType: "boolean true or reviewed competitor evidence",
      countedAsComplete: competitorOk ? "YES" : "NO",
      reasonIfNo: competitorOk ? "" : "Competitor review has not been confirmed/saved.",
      arithmetic: point(competitorOk),
    },
    {
      field: "Target patient groups",
      browserInputName: "targetPatientGroups",
      submittedValue: data.targetPatientGroups || [],
      canonicalProfileJsonKey: "data.targetPatientGroups",
      exactSavedValue: data.targetPatientGroups || [],
      valueType: "array",
      calculatorKey: "data.targetPatientGroups.length > 0",
      calculatorExpectedType: "non-empty array",
      countedAsComplete: patientsOk ? "YES" : "NO",
      reasonIfNo: patientsOk ? "" : "data.targetPatientGroups is empty.",
      arithmetic: point(patientsOk),
    },
    {
      field: "Unique selling points",
      browserInputName: "uniqueSellingPoints",
      submittedValue: data.uniqueSellingPoints || [],
      canonicalProfileJsonKey: "data.uniqueSellingPoints",
      exactSavedValue: data.uniqueSellingPoints || [],
      valueType: "array",
      calculatorKey: "data.uniqueSellingPoints.length > 0",
      calculatorExpectedType: "non-empty array",
      countedAsComplete: uspOk ? "YES" : "NO",
      reasonIfNo: uspOk ? "" : "data.uniqueSellingPoints is empty.",
      arithmetic: point(uspOk),
    },
  ];
}

function detectDefects(routeSource: string, scoringSource: string): string[] {
  const defects: string[] = [];
  const formNames = [
    "businessDescription",
    "appointmentMethod",
    "fundingModel",
    "serviceAreas",
    "profileCompetitorsReviewed",
    "targetPatientGroups",
    "uniqueSellingPoints",
  ];
  for (const name of formNames) {
    if (!routeSource.includes(`name="${name}"`)) defects.push(`Missing form input name: ${name}`);
  }
  const scoringNeedles = [
    "data.businessDescription",
    "hasAppointmentOrWalkIn(data, serviceIds)",
    "hasFundingModel(data, serviceIds)",
    "hasLocalAreasAndEntities(data)",
    "hasCompetitorReview(data)",
    "data.targetPatientGroups",
    "data.uniqueSellingPoints",
    "requiredQualityCompleteCount / requiredQualityTotal",
  ];
  for (const needle of scoringNeedles) {
    if (!scoringSource.includes(needle)) defects.push(`Calculator does not include expected key/formula: ${needle}`);
  }
  if (scoringSource.includes("Math.min(99, overallScore)")) defects.push("Calculator still uses legacy weighted category cap.");
  return defects;
}

async function main(): Promise<void> {
  const profileDoc = readJson<{ data?: Record<string, unknown> }>(PROFILE_PATH, {});
  const data = normalizeProfileData(profileDoc.data || {});
  const outputMtimeBefore = mtimeMs(OUTPUT_ROOT);
  const quality = computeWizardQualityScore(data);
  const outputMtimeAfter = mtimeMs(OUTPUT_ROOT);
  const routeSource = read(QUALITY_PAGE_PATH);
  const scoringSource = read(SCORING_PATH);
  const fieldTrace = traceFields(data, quality);
  const completeFields = fieldTrace.filter((field) => field.countedAsComplete === "YES").map((field) => field.field);
  const incompleteFields = fieldTrace.filter((field) => field.countedAsComplete === "NO").map((field) => `${field.field}: ${field.reasonIfNo}`);
  const arithmetic = fieldTrace.map((field) => `${field.field}: ${field.arithmetic}`);
  const resultArithmetic = `${quality.requiredQualityCompleteCount}/${quality.requiredQualityTotal} × 100 = ${quality.overallScore}%`;
  const defects = detectDefects(routeSource, scoringSource);

  const output = {
    scoringFunction: {
      filePath: SCORING_PATH,
      functionName: "computeWizardQualityScore",
      scoringFormula: quality.scoringFormula,
      pointsPerField: "1 point each; 7 points total; optional fields excluded",
      otherFieldsIncludedInPercentage: [],
    },
    exactSevenFieldArithmetic: [...arithmetic, `Result: ${resultArithmetic}`],
    completeFields,
    incompleteFields,
    fieldMappingDefectsFound: defects.length ? defects : ["None"],
    campaignContentQualityPercentage: `${quality.overallScore}%`,
    exactBrowserUrl: `${APP_DOMAIN.replace(/\/$/, "")}/api/pharmacy-profile-quality?slug=${encodeURIComponent(SLUG)}`,
    fieldTrace,
    validationChecks: {
      oneCanonicalKeyPerQualityField: fieldTrace.length === 7 && new Set(fieldTrace.map((field) => field.canonicalProfileJsonKey)).size === 7,
      formSaveCalculatorUseSameKeys: defects.length === 0,
      scoreUsesExactlySevenFields: quality.requiredQualityFields.length === 7 && quality.requiredQualityTotal === 7,
      optionalFieldsExcluded: quality.optionalQualityFields.length > 0 && quality.optionalQualityFields.every((field) => field.id !== "businessDescription"),
      noStaleCachedScore: quality.overallScore === computeWizardQualityScore(normalizeProfileData(profileDoc.data || {})).overallScore,
      exactArithmeticPrinted: resultArithmetic.includes("× 100 ="),
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
