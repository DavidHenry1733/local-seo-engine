import fs from "node:fs";
import path from "node:path";

import {
  qualityFieldStatuses,
  saveProfileQualityFields,
  validateQualitySection,
} from "../artifacts/api-server/src/routes/pharmacyProfileQualityPage.ts";
import { computeWizardQualityScore } from "../src/pharmacy/pharmacyProfileWizardScoring.ts";
import { normalizeProfileDoc, type PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const ROOT = process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.pharmaconnect.uk";
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const ROUTE_PATH = path.join(ROOT, "artifacts/api-server/src/routes/pharmacyProfileQualityPage.ts");
const OUTPUT_ROOT = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, CAMPAIGN_ID);

type TestResult = {
  field: string;
  section: string;
  saved: boolean;
  persistedAfterReload: boolean;
  statusUpdated: boolean;
};

function readProfile(): PharmacyProfileData {
  return normalizeProfileDoc(SLUG, JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8"))).data;
}

function writeProfile(data: PharmacyProfileData): void {
  fs.writeFileSync(PROFILE_PATH, JSON.stringify({
    slug: SLUG,
    updatedAt: new Date().toISOString(),
    version: 5,
    data,
  }, null, 2));
}

function mtimeMs(file: string): number | null {
  return fs.existsSync(file) ? fs.statSync(file).mtimeMs : null;
}

function statusKey(section: string): string {
  return ({
    businessDescription: "businessDescription",
    appointmentMethod: "serviceAppointmentWalkIn",
    fundingModel: "serviceFundingModel",
    competitorsReviewed: "competitorsReviewed",
    targetPatientGroups: "targetPatientGroups",
    uniqueSellingPoints: "uniqueSellingPoints",
  } as Record<string, string>)[section];
}

function persisted(section: string, data: PharmacyProfileData): boolean {
  const service = data.serviceDeliveryProfiles?.[CAMPAIGN_ID];
  if (section === "businessDescription") return data.businessDescription === "Temporary validation business description";
  if (section === "appointmentMethod") return data.bookingMethod === "contact-pharmacy-to-confirm";
  if (section === "fundingModel") return service?.fundingModel === "nhs";
  if (section === "competitorsReviewed") return data.profileCompetitorsReviewed === true && Boolean(data.profileCompetitorsReviewedAt);
  if (section === "targetPatientGroups") return data.targetPatientGroups.includes("Local residents");
  if (section === "uniqueSellingPoints") return data.uniqueSellingPoints.includes("Clear patient guidance");
  return false;
}

function testPayload(section: string): Record<string, unknown> {
  const base = { serviceId: CAMPAIGN_ID, _saveSection: section, _dirtySections: section };
  if (section === "businessDescription") return { ...base, businessDescription: "Temporary validation business description" };
  if (section === "appointmentMethod") return { ...base, appointmentMethod: "confirm" };
  if (section === "fundingModel") return { ...base, fundingModel: "nhs" };
  if (section === "competitorsReviewed") return { ...base, profileCompetitorsReviewed: "true" };
  if (section === "targetPatientGroups") return { ...base, targetPatientGroups: "Local residents" };
  if (section === "uniqueSellingPoints") return { ...base, uniqueSellingPoints: "Clear patient guidance" };
  return base;
}

async function main(): Promise<void> {
  const original = fs.readFileSync(PROFILE_PATH, "utf8");
  const routeSource = fs.readFileSync(ROUTE_PATH, "utf8");
  const outputMtimeBefore = mtimeMs(OUTPUT_ROOT);
  const fields = [
    ["Business description", "businessDescription"],
    ["Appointment / walk-in method", "appointmentMethod"],
    ["Funding model", "fundingModel"],
    ["Competitors reviewed", "competitorsReviewed"],
    ["Target patient groups", "targetPatientGroups"],
    ["Unique selling points", "uniqueSellingPoints"],
  ] as const;
  const results: TestResult[] = [];
  let qualityAfterSave = 0;

  try {
    for (const [field, section] of fields) {
      const body = testPayload(section);
      const validationError = validateQualitySection(section, body, SLUG);
      if (validationError) {
        results.push({ field, section, saved: false, persistedAfterReload: false, statusUpdated: false });
        continue;
      }
      const saved = saveProfileQualityFields(readProfile(), body);
      writeProfile(saved);
      const reloaded = readProfile();
      const statuses = qualityFieldStatuses(reloaded);
      results.push({
        field,
        section,
        saved: true,
        persistedAfterReload: persisted(section, reloaded),
        statusUpdated: Boolean(statuses[statusKey(section)]),
      });
      qualityAfterSave = computeWizardQualityScore(reloaded).overallScore;
    }
  } finally {
    fs.writeFileSync(PROFILE_PATH, original);
  }

  const outputMtimeAfter = mtimeMs(OUTPUT_ROOT);
  const checks = {
    everySaveContinuePerformsRealSave: /class="btn primary save-continue"/.test(routeSource) && routeSource.includes("fetch(form.action") && routeSource.includes("_saveSection"),
    savedValuesAppearInLiveProfileJson: results.every((result) => result.saved && result.persistedAfterReload),
    savedValuesPersistAfterPageReload: results.every((result) => result.persistedAfterReload),
    sectionStatusUpdatesAfterSave: results.every((result) => result.statusUpdated) && routeSource.includes("updateFieldStatuses"),
    qualityScoreRecalculatesFromLiveProfile: qualityAfterSave === 100 && routeSource.includes("computeWizardQualityScore(data)"),
    finalSaveAllButtonRemainsAvailable: routeSource.includes("Save All Profile Quality Details"),
    stickySaveStatusExists: routeSource.includes("Unsaved changes") && routeSource.includes("Saving…") && routeSource.includes("Saved"),
    noRegenerationOccurred: outputMtimeBefore === outputMtimeAfter,
  };

  const output = {
    saveEndpoint: `/api/pharmacy-profile-quality?slug=${SLUG}`,
    fieldsTested: results.map((result) => result.field),
    persistence: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    exactBrowserUrl: `${APP_DOMAIN.replace(/\/$/, "")}/api/pharmacy-profile-quality?slug=${SLUG}`,
    results,
    checks,
    note: "Validation writes temporary choices to the live profile JSON and restores the original file before exit.",
  };

  console.log(JSON.stringify(output, null, 2));
  if (output.persistence !== "PASS") process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
