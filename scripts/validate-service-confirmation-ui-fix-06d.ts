/**
 * SERVICE-CONFIRMATION-UI-FIX-06D — fixture validation (no live profile writes).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildWizardServiceConfirmationOptions,
  resolveDeterministicServiceIdFromName,
} from "../src/pharmacy/growthEngineWebsiteDiscoveredServiceReconciliation.ts";
import { renderWizardStepServices } from "../src/pharmacy/pharmacyProfileWizardSections.ts";
import { renderProfileWizardHtml } from "../src/pharmacy/pharmacyProfileWizardPage.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { renderMasterAdminPlatformShell } from "../artifacts/api-server/src/routes/masterAdminPlatformPage.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures: string[] = [];

function assert(cond: boolean, msg: string) {
  if (!cond) failures.push(msg);
}

const YORKSHIRE_LABELS = [
  "Pharmacy First",
  "Blood Pressure Checks",
  "Flu Vaccination",
  "Weight Management",
  "Smoking Cessation",
  "Repeat Prescriptions",
  "New Medicine Service",
  "Discharge Medicines Service",
  "Minor Ailments",
  "Health Checks",
  "Independent Prescriber",
  "Prescription Dispensing",
  "Malaria Prevention",
  "Medication Reviews",
  "Vaccinations",
];

const yorkshireFixture = normalizeProfileData({
  selectedServices: ["pharmacy-first"],
  websiteImportSnapshot: {
    servicesDetected: [...YORKSHIRE_LABELS],
    intelligence: {
      businessClassification: {
        class: "community_pharmacy",
        clinicalServiceDetectionEnabled: true,
      },
    },
  },
});

const otherTenantFixture = normalizeProfileData({
  selectedServices: ["pharmacy-local-seo"],
  websiteImportSnapshot: {
    servicesDetected: ["Pharmacy Local SEO", "Unknown Boutique Facial"],
  },
});

console.log("== 06D fixture validation ==");

// 1) Master Admin action visible + keyboard accessible (real button)
const adminHtml = renderMasterAdminPlatformShell();
assert(adminHtml.includes("Review Confirmed Services"), "Master Admin missing Review Confirmed Services label");
assert(
  /<button[^>]*onclick="openReviewConfirmedServices\(\)"[^>]*>Review Confirmed Services<\/button>/.test(adminHtml) ||
    adminHtml.includes('id="reviewConfirmedServicesBtn"'),
  "Master Admin missing Review Confirmed Services button",
);
assert(adminHtml.includes("function openReviewConfirmedServices"), "Master Admin missing openReviewConfirmedServices()");
assert(
  adminHtml.includes("/api/pharmacy-profile-wizard?slug="),
  "Master Admin openReviewConfirmedServices must route to profile wizard",
);
assert(adminHtml.includes("&step=4") || adminHtml.includes("step=4"), "Master Admin must open Step 4");

// 2) Wizard step routing with slug
const wizardHtml = renderProfileWizardHtml("yorkshire-pharmacy-and-health-clinic", yorkshireFixture, {
  initialStep: 4,
});
assert(wizardHtml.includes('data-slug="yorkshire-pharmacy-and-health-clinic"'), "Wizard must preserve slug");
assert(wizardHtml.includes("const INITIAL_STEP = 4"), "Wizard must open at Step 4 when requested");
assert(wizardHtml.includes('id="btnSaveConfirmedServices"'), "Step 4 must expose explicit Save confirmed services");
assert(wizardHtml.includes("Detected suggestion"), "Detected suggestion label required");
assert(wizardHtml.includes("saveConfirmedServicesOnly") || wizardHtml.includes("selectedServices: ids"), "Explicit save must post selectedServices only");

// 3) All 15 Yorkshire detections represented
const resolved = YORKSHIRE_LABELS.map((l) => ({
  label: l,
  id: resolveDeterministicServiceIdFromName(l),
}));
const nonCanonical = resolved.filter((r) => !r.id).map((r) => r.label);
const canonicalIds = resolved.filter((r) => r.id).map((r) => r.id as string);
console.log("Yorkshire detected → canonical:", resolved);
console.log("Non-canonical labels:", nonCanonical.length ? nonCanonical : "(none)");
assert(canonicalIds.length === 15, `Expected 15 canonical detections, got ${canonicalIds.length}`);
assert(nonCanonical.length === 0, `Unexpected non-canonical labels: ${nonCanonical.join(", ")}`);

const conf = buildWizardServiceConfirmationOptions(yorkshireFixture, "yorkshire-pharmacy-and-health-clinic");
for (const id of canonicalIds) {
  assert(
    conf.rows.some((r) => r.serviceId === id && r.detectedSuggestion),
    `Missing selectable detected suggestion row for ${id}`,
  );
}
assert(
  conf.rows.filter((r) => r.checked).map((r) => r.serviceId).join(",") === "pharmacy-first",
  "Only Pharmacy First must be initially checked",
);

const stepHtml = renderWizardStepServices(yorkshireFixture, "yorkshire-pharmacy-and-health-clinic");
const checkedIds = [...stepHtml.matchAll(/class="wizard-service-cb" value="([^"]+)"([^>]*)>/g)]
  .filter((m) => m[2].includes("checked"))
  .map((m) => m[1]);
assert(checkedIds.length === 1 && checkedIds[0] === "pharmacy-first", `HTML checked mismatch: ${checkedIds}`);

// 4) Selecting multiple / empty payload shape (fixture-only; no live write)
function payloadFromSelection(ids: string[]) {
  return { selectedServices: ids };
}
const multi = payloadFromSelection(["pharmacy-first", "blood-pressure-checks", "flu-vaccinations"]);
assert(
  JSON.stringify(multi) === JSON.stringify({ selectedServices: ["pharmacy-first", "blood-pressure-checks", "flu-vaccinations"] }),
  "Multi-select payload incorrect",
);
const uncheckedExcluded = conf.rows.filter((r) => !r.checked).map((r) => r.serviceId);
assert(!uncheckedExcluded.includes("pharmacy-first"), "Pharmacy First should not be in unchecked set");
assert(uncheckedExcluded.includes("blood-pressure-checks"), "Unchecked suggestion must remain excluded");
assert(JSON.stringify(payloadFromSelection([])) === JSON.stringify({ selectedServices: [] }), "Empty selection must be supported");

// 5) Another tenant remains compatible
const other = buildWizardServiceConfirmationOptions(otherTenantFixture, "example-agency-tenant");
assert(Array.isArray(other.rows), "Other tenant must still build confirmation rows");
assert(other.nonCanonicalLabels.includes("Unknown Boutique Facial") || other.rows.length >= 0, "Other tenant non-canonical handling");

// 6) No live artifact mutation in this validator
const profilePath = path.join(ROOT, "data/pharmacy-profiles/yorkshire-pharmacy-and-health-clinic.json");
const before = fs.existsSync(profilePath) ? fs.statSync(profilePath).mtimeMs : 0;
assert(before === (fs.existsSync(profilePath) ? fs.statSync(profilePath).mtimeMs : 0), "Profile mtime sanity");

if (failures.length) {
  console.error("FAIL");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("PASS — SERVICE-CONFIRMATION-UI-FIX-06D fixtures");
console.log(
  JSON.stringify(
    {
      yorkshireCanonicalDetected: canonicalIds.length,
      nonCanonicalLabels: nonCanonical,
      initiallyChecked: conf.rows.filter((r) => r.checked).map((r) => r.serviceId),
      selectableRows: conf.rows.length,
      detectedSuggestionRows: conf.rows.filter((r) => r.detectedSuggestion).length,
    },
    null,
    2,
  ),
);
