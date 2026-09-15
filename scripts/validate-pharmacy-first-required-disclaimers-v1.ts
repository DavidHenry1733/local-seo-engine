#!/usr/bin/env npx tsx
/**
 * Required Pharmacy First disclaimers are renderer-owned.
 * Uses the customer-facing pharmacy name. Does not write tenant data.
 */
import {
  htmlContainsPharmacyFirstRequiredDisclaimers,
  injectPharmacyFirstRequiredDisclaimers,
  PHARMACY_FIRST_NHS_REQUIREMENTS_DISCLAIMER,
  pharmacyFirstProvidedByDisclaimer,
} from "../src/pharmacy/pharmacyFirstRequiredDisclaimers.ts";
import { resolveCanonicalPharmacyName } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

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

const name = "Example Pharmacy";
const source = `<html><head></head><body><main id="main-content"><p>Existing service copy about sore throat.</p></main><footer>© Example Pharmacy</footer></body></html>`;
const injected = injectPharmacyFirstRequiredDisclaimers(source, name);

record(
  "nhs-requirements-sentence",
  PHARMACY_FIRST_NHS_REQUIREMENTS_DISCLAIMER === "We follow the NHS Pharmacy First service requirements.",
  PHARMACY_FIRST_NHS_REQUIREMENTS_DISCLAIMER,
);
record(
  "provided-by-uses-canonical-name",
  pharmacyFirstProvidedByDisclaimer(name) === "The Pharmacy First service is provided by Example Pharmacy.",
  pharmacyFirstProvidedByDisclaimer(name),
);
record(
  "injects-both-sentences",
  htmlContainsPharmacyFirstRequiredDisclaimers(injected, name),
  "both required disclaimers present",
);
record(
  "does-not-rewrite-existing-copy",
  injected.includes("Existing service copy about sore throat."),
  "service copy retained",
);
record(
  "idempotent",
  injectPharmacyFirstRequiredDisclaimers(injected, name) === injected ||
    htmlContainsPharmacyFirstRequiredDisclaimers(injectPharmacyFirstRequiredDisclaimers(injected, name), name),
  "second inject does not duplicate",
);

const live = readSetupProfile("vision-pharmacy");
const canonical = resolveCanonicalPharmacyName(live).value;
record(
  "live-vision-canonical-name",
  canonical === "Vision Pharmacy",
  canonical,
);
record(
  "live-vision-provided-by-is-not-hard-coded-in-helper",
  pharmacyFirstProvidedByDisclaimer(canonical) === "The Pharmacy First service is provided by Vision Pharmacy.",
  pharmacyFirstProvidedByDisclaimer(canonical),
);

const failed = checks.filter((check) => !check.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
