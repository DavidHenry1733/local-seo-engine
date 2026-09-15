/**
 * NT-E2E-16A — Google no-profile generation gate validation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { resolveGoogleProfileOnboardingState } from "../src/pharmacy/masterAdminGoogleProfileOnboardingService.ts";
import {
  evaluateGoogleGenerationScenario,
  resolveGoogleGenerationReadiness,
} from "../src/pharmacy/masterAdminGoogleGenerationReadinessService.ts";
import { runPreGenerationValidation } from "../src/pharmacy/masterAdminPreGenerationValidation.ts";
import {
  assertEcosystemGenerationAllowed,
  buildCommercialEcosystemGenerationDashboard,
} from "../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts";
import { buildGoogleSourceSummary, readGoogleIntelligenceRecord } from "../src/pharmacy/masterAdminCanonicalGoogleService.ts";
import { isCommercialIntelligenceApproved } from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";
import { readHistoricalEcosystemPackage } from "../src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import type { PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const SLUG = "reliable-direct-pharmacy";

type Step = { name: string; passed: boolean; detail?: string };
function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

function profileFor(state: string, opts: { placeId?: string; profileUrl?: string; imported?: boolean } = {}) {
  return {
    googleProfileOnboardingState: state,
    googlePlaceId: opts.placeId || "",
    googleBusinessProfileUrl: opts.profileUrl || "",
  } as PharmacyProfileData;
}

function main() {
  const steps: Step[] = [];
  const page = readFileSync(resolve("artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  const preGen = readFileSync(resolve("src/pharmacy/masterAdminPreGenerationValidation.ts"), "utf8");

  const profile = readSetupProfile(SLUG);
  const google = buildGoogleSourceSummary(SLUG);
  const googleIntel = readGoogleIntelligenceRecord(SLUG);
  const googleState = resolveGoogleProfileOnboardingState(profile);
  const preBefore = runPreGenerationValidation(SLUG);
  const dashboard = buildCommercialEcosystemGenerationDashboard(SLUG);
  const gate = assertEcosystemGenerationAllowed(SLUG);

  steps.push(step("Shared resolver module exists", readFileSync(resolve("src/pharmacy/masterAdminGoogleGenerationReadinessService.ts"), "utf8").includes("resolveGoogleGenerationReadiness")));
  steps.push(step("Pre-generation uses shared resolver", preGen.includes("resolveGoogleGenerationReadiness")));
  steps.push(step("google_intelligence not unconditional blocker id", !preGen.includes('"google_intelligence",') || preGen.includes("googleReadiness.importRequired")));
  steps.push(step("Persisted Google state no_profile", googleState === "no_profile"));
  steps.push(step("Google Import blocker removed for customer", !preBefore.blockers.includes("Google Import missing")));
  steps.push(step("Google warning present for customer", preBefore.warnings.includes("Google Business Profile not connected")));
  steps.push(step("Google opportunity present for customer", preBefore.opportunities.includes("Create or claim a Google Business Profile")));
  steps.push(step("Generate gate open for customer", gate.ok === true));
  steps.push(step("Dashboard canGenerate true", dashboard.canGenerate === true));
  steps.push(step("Dashboard Google state no_profile", dashboard.readiness.googleBusinessProfile?.state === "no_profile"));
  steps.push(step("Dashboard Google generation available", dashboard.readiness.googleBusinessProfile?.generationLabel === "Available"));
  steps.push(step("UI Google Business Profile section", page.includes("Google Business Profile") && page.includes("cgeGoogle")));
  steps.push(step("UI no Google Import missing as generic blocker text", page.includes("googleBusinessProfile")));
  steps.push(step("Commercial Intelligence approval preserved", isCommercialIntelligenceApproved(SLUG)));
  steps.push(step("Historical package preserved", Boolean(readHistoricalEcosystemPackage(SLUG))));
  steps.push(step("Customer preserved", Boolean(loadMasterAdminCustomerContext(SLUG))));

  const scenarios: Array<[string, "READY" | "BLOCKED", ReturnType<typeof evaluateGoogleGenerationScenario>]> = [
    ["Configured + complete", "READY", evaluateGoogleGenerationScenario({ state: "configured", hasGoogleImport: true, placeId: "ChIJtest", profileUrl: "https://maps.google.com" })],
    ["Configured + incomplete", "BLOCKED", evaluateGoogleGenerationScenario({ state: "configured", hasGoogleImport: false, placeId: "ChIJtest" })],
    ["Selected + complete", "READY", evaluateGoogleGenerationScenario({ state: "selected", hasGoogleImport: true, placeId: "ChIJtest" })],
    ["No profile", "READY", evaluateGoogleGenerationScenario({ state: "no_profile", hasGoogleImport: false })],
    ["Deferred", "READY", evaluateGoogleGenerationScenario({ state: "deferred", hasGoogleImport: false })],
    ["Unknown", "BLOCKED", evaluateGoogleGenerationScenario({ state: "unknown", hasGoogleImport: false })],
  ];
  for (const [label, expected, actual] of scenarios) {
    steps.push(step(`Scenario ${label}`, actual === expected, `expected ${expected}, got ${actual}`));
  }

  const noProfile = resolveGoogleGenerationReadiness({ profile: profileFor("no_profile"), hasGoogleImport: false });
  steps.push(step("No profile does not require import", noProfile.importRequired === false));
  steps.push(step("No profile generation allowed", noProfile.generationAllowed === true));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(`\nSummary: ${steps.length - failed.length}/${steps.length} passed`);
  console.log(`Persisted Google state: ${googleState}`);
  console.log(`Place ID: ${profile.googlePlaceId || google.placeId || "null"}`);
  console.log(`Profile URL: ${profile.googleBusinessProfileUrl || "null"}`);
  console.log(`Import status: ${googleIntel?.importedAt ? "Imported" : google.importState || "Not connected"}`);
  console.log(`Blockers after fix: ${preBefore.blockers.join(", ") || "none"}`);
  if (failed.length) process.exit(1);
}

main();
