/**
 * NT-E2E-05 — optional Google profile for Business Profile save/approval validation.
 */
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import {
  buildBusinessProfileReview,
  saveBusinessProfileReviewField,
} from "../src/pharmacy/masterAdminBusinessProfileReviewService.ts";
import {
  canApproveBusinessProfileWithGoogleState,
  canSaveBusinessProfileDraft,
  isGoogleIdentifierRequiredForBusinessProfile,
} from "../src/pharmacy/masterAdminBusinessProfileGoogleValidation.ts";
import { resolveGoogleProfileOnboardingState } from "../src/pharmacy/masterAdminGoogleProfileOnboardingService.ts";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";

const TEST_SLUG = "reliable-direct-pharmacy";

type Step = { name: string; passed: boolean; detail?: string };
function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

function assertGoogleContract(state: string, profile: ReturnType<typeof readSetupProfile>): Step[] {
  const steps: Step[] = [];
  steps.push(
    step(
      `Google ID required for ${state} (configured)`,
      isGoogleIdentifierRequiredForBusinessProfile("configured") === true,
      "configured",
    ),
  );
  steps.push(
    step(
      `Google ID required for ${state} (selected)`,
      isGoogleIdentifierRequiredForBusinessProfile("selected") === true,
      "selected",
    ),
  );
  steps.push(
    step(
      `Google ID not required for ${state} (no_profile)`,
      isGoogleIdentifierRequiredForBusinessProfile("no_profile") === false,
      "no_profile",
    ),
  );
  steps.push(
    step(
      `Google ID not required for ${state} (deferred)`,
      isGoogleIdentifierRequiredForBusinessProfile("deferred") === false,
      "deferred",
    ),
  );
  steps.push(step(`Draft save allowed for unknown`, canSaveBusinessProfileDraft("unknown")));
  const noProfileApproval = canApproveBusinessProfileWithGoogleState("no_profile", profile);
  steps.push(step(`Approval allowed for no_profile`, noProfileApproval.allowed, noProfileApproval.reason || ""));
  const deferredApproval = canApproveBusinessProfileWithGoogleState("deferred", profile);
  steps.push(step(`Approval allowed for deferred`, deferredApproval.allowed, deferredApproval.reason || ""));
  const unknownApproval = canApproveBusinessProfileWithGoogleState("unknown", profile);
  steps.push(step(`Approval blocked for unknown`, !unknownApproval.allowed, unknownApproval.reason || ""));
  const configuredBlank = canApproveBusinessProfileWithGoogleState("configured", {
    ...profile,
    googlePlaceId: "",
    googleBusinessProfileUrl: "",
  });
  steps.push(step(`Approval blocked for configured without ID`, !configuredBlank.allowed, configuredBlank.reason || ""));
  return steps;
}

function main() {
  const steps: Step[] = [];
  const profile = readSetupProfile(TEST_SLUG);
  const state = resolveGoogleProfileOnboardingState(profile);
  steps.push(step("Test customer Google state is no_profile or deferred", state === "no_profile" || state === "deferred", state));

  const review = buildBusinessProfileReview(TEST_SLUG);
  steps.push(step("Google Intelligence not in missingSources for no_profile", !review.missingSources.includes("Google Intelligence"), review.missingSources.join(", ") || "none"));
  const gp = review.fields.find((f) => f.id === "googlePlaceId");
  steps.push(step("googlePlaceId not action-required", gp ? !gp.requiresAction : false, gp?.reviewTier || "missing field"));
  steps.push(step("Google section status populated", Boolean(review.summary.googleSectionStatus), review.summary.googleSectionStatus || ""));
  steps.push(step("Google growth opportunity for no_profile", state === "no_profile" ? Boolean(review.summary.googleGrowthOpportunity) : true, review.summary.googleGrowthOpportunity || ""));

  try {
    saveBusinessProfileReviewField(TEST_SLUG, "consultationRoom", { action: "confirm", finalValue: "No" }, "nt-e2e-05");
    steps.push(step("Reliable Direct Business Profile field save", true));
  } catch (err) {
    steps.push(step("Reliable Direct Business Profile field save", false, err instanceof Error ? err.message : String(err)));
  }

  try {
    saveBusinessProfileReviewField(TEST_SLUG, "googlePlaceId", { action: "manual", finalValue: "" }, "nt-e2e-05");
    steps.push(step("Blank Google Place ID save allowed for no_profile", true));
  } catch (err) {
    steps.push(step("Blank Google Place ID save allowed for no_profile", false, err instanceof Error ? err.message : String(err)));
  }

  const configuredBlank = canApproveBusinessProfileWithGoogleState("configured", {
    ...profile,
    googlePlaceId: "",
    googleBusinessProfileUrl: "",
  });
  steps.push(step("Blank Google Place ID blocked for configured approval", !configuredBlank.allowed, configuredBlank.reason || ""));

  const afterReview = buildBusinessProfileReview(TEST_SLUG);
  const ready = afterReview.summary.readinessLabel === "READY TO APPROVE";
  const canApprove = canApproveBusinessProfileWithGoogleState(state, profile);
  steps.push(step("Reliable Direct Business Profile approval readiness", ready && canApprove.allowed, `${afterReview.summary.readinessLabel}; ${canApprove.reason || "ok"}`));

  steps.push(step("Website Import preserved", Boolean(profile.websiteImportSnapshot?.importedAt)));
  steps.push(step("Address preserved", Boolean(profile.addressLine1)));
  steps.push(step("Town or City preserved", Boolean(profile.primaryTown)));
  steps.push(step("Local areas preserved", (profile.selectedAreas || []).length > 0, String((profile.selectedAreas || []).length)));
  steps.push(step("Design Intelligence file exists", fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-component-dna", `${TEST_SLUG}.json`))));
  steps.push(step("No fake Google ID", !profile.googlePlaceId || profile.googlePlaceId.startsWith("ChI") === Boolean(profile.googlePlaceId)));

  const tenantHits: string[] = [];
  for (const file of [
    "src/pharmacy/masterAdminBusinessProfileGoogleValidation.ts",
    "src/pharmacy/masterAdminBusinessProfileReviewService.ts",
  ]) {
    const text = fs.readFileSync(path.join(WORKSPACE_ROOT, file), "utf8");
    if (text.includes("reliable-direct") || text.includes("Banner Cross")) tenantHits.push(file);
  }
  steps.push(step("No tenant-specific BPR Google code", tenantHits.length === 0, tenantHits.join("; ")));

  steps.push(...assertGoogleContract(state, profile));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-05 validation: FAIL (${failed.length})` : "\nNT-E2E-05 validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
