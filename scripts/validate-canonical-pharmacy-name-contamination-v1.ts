#!/usr/bin/env npx tsx
/**
 * Customer-facing pharmacy identity must not use keyword-stuffed Google listing titles.
 * Isolation candidates may still include the listing title. Does not write tenant data.
 */
import {
  confirmedTenantIdentityCandidates,
  isKeywordStuffedPharmacyListingName,
  replaceKeywordStuffedPharmacyListingNames,
  resolvePublicationPharmacyIdentity,
} from "../src/pharmacy/pharmacyServicePagePublicationQuality.ts";
import {
  assertValidGenerationPharmacyIdentity,
  resolveCanonicalPharmacyName,
  resolveCustomerFacingPharmacyName,
} from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { buildCprEvidenceFields } from "../src/pharmacy/masterAdminCoreProductRecoveryEvidenceService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import type { PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

const stuffedTitle =
  "Example Pharmacy | Ear Ache & Sore Throat Clinic | Sinusitis, Shingles Treatment | Infected Bites";

const stuffedProfile = {
  pharmacyName: stuffedTitle,
  tradingName: "Example Pharmacy",
  googleImportSnapshot: { businessName: stuffedTitle },
} as PharmacyProfileData;

record(
  "three-or-more-pipe-segments-are-stuffed",
  isKeywordStuffedPharmacyListingName(stuffedTitle) === true,
  stuffedTitle,
);

record(
  "unstuffed-google-name-is-not-flagged",
  isKeywordStuffedPharmacyListingName("Example Pharmacy") === false,
  "plain trading name",
);

record(
  "two-part-town-listing-is-not-flagged",
  isKeywordStuffedPharmacyListingName("Example Pharmacy | Derby") === false,
  "Pharmacy | Town remains a valid listing name",
);

record(
  "two-part-clinic-listing-is-stuffed",
  isKeywordStuffedPharmacyListingName("Example Pharmacy | Ear Wax Clinic") === true,
  "clinic/treatment tails are stuffed",
);

const stuffedIdentity = resolvePublicationPharmacyIdentity(stuffedProfile);
record(
  "stuffed-google-title-loses-to-trading-name",
  stuffedIdentity.pharmacyName === "Example Pharmacy",
  stuffedIdentity.pharmacyName,
);

const isolation = confirmedTenantIdentityCandidates(stuffedProfile);
record(
  "isolation-candidates-still-include-google-title",
  isolation.includes(stuffedTitle) && isolation.includes("Example Pharmacy"),
  isolation.join(" || "),
);

const cleanGoogle = resolvePublicationPharmacyIdentity({
  pharmacyName: "Legacy Label",
  tradingName: "Trading Label",
  googleImportSnapshot: { businessName: "Confirmed Google Pharmacy" },
} as PharmacyProfileData);
record(
  "unstuffed-google-name-still-wins",
  cleanGoogle.pharmacyName === "Confirmed Google Pharmacy",
  cleanGoogle.pharmacyName,
);

record(
  "evidence-handoff-skips-stuffed-google-business-name",
  resolveCustomerFacingPharmacyName(stuffedProfile, { businessName: stuffedTitle, tradingName: "Example Pharmacy" }) === "Example Pharmacy",
  "approved.businessName listing title is not the pharmacy name",
);

record(
  "html-replace-keeps-service-copy",
  replaceKeywordStuffedPharmacyListingNames(
    `<title>${stuffedTitle}</title><p>Treatment for sore throat and UTI is available.</p>`,
    stuffedProfile,
  ) === "<title>Example Pharmacy</title><p>Treatment for sore throat and UTI is available.</p>",
  "listing title replaced; condition copy retained",
);

try {
  assertValidGenerationPharmacyIdentity(stuffedTitle);
  record("generation-rejects-stuffed-listing-title", false, "expected throw");
} catch {
  record("generation-rejects-stuffed-listing-title", true, "stuffed listing title cannot enter generation");
}

const live = readSetupProfile("vision-pharmacy");
const liveIdentity = resolvePublicationPharmacyIdentity(live);
const liveCanonical = resolveCanonicalPharmacyName(live);
record(
  "live-vision-display-name-is-not-stuffed",
  liveIdentity.pharmacyName === "Vision Pharmacy"
    && liveCanonical.value === "Vision Pharmacy"
    && !liveIdentity.pharmacyName.includes("|"),
  `${liveIdentity.pharmacyName} / ${liveCanonical.value}`,
);
record(
  "live-vision-isolation-still-sees-google-title",
  confirmedTenantIdentityCandidates(live).some((name) => name.includes("|")),
  "Google listing title remains an isolation candidate",
);

const evidenceName = buildCprEvidenceFields("vision-pharmacy", "pharmacy-first").find((field) => field.id === "pharmacyName")?.value || "";
record(
  "live-vision-evidence-pharmacy-name-is-customer-facing",
  evidenceName === "Vision Pharmacy" && !evidenceName.includes("|"),
  evidenceName,
);

const failed = checks.filter((check) => !check.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
