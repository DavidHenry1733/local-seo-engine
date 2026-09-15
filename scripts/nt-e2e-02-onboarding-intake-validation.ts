/**
 * NT-E2E-02 — onboarding intake + conditional Google workflow validation.
 */
import {
  resolvePostWebsiteImportNextStage,
  validateOnboardingIntake,
  validateStoredOnboardingIntake,
} from "../src/pharmacy/masterAdminOnboardingIntakeService.ts";
import {
  normalizeGoogleProfileStateInput,
  resolveGoogleProfileOnboardingState,
  shouldRunGoogleImport,
} from "../src/pharmacy/masterAdminGoogleProfileOnboardingService.ts";
import { resolveWorkflowStage, verifyStageCompletion } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { runWorkflowPreflight } from "../src/pharmacy/masterAdminWorkflowOrchestrator.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";

const TEST_SLUG = "reliable-direct-pharmacy";

type Step = { name: string; passed: boolean; detail?: string };

function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

function baseIntake(overrides: Record<string, unknown> = {}) {
  return {
    pharmacyName: "Example Pharmacy",
    website: "https://example-pharmacy.test",
    contactEmail: "ops@example.test",
    addressLine1: "1 High Street",
    townOrCity: "Sheffield",
    postcode: "S1 1AA",
    country: "United Kingdom",
    primaryServiceId: "pharmacy-first",
    googleProfileState: "no_profile",
    areas: [{ areaName: "City Centre", selected: true, source: "operator" }],
    ...overrides,
  };
}

function runScenarioTests(): Step[] {
  const steps: Step[] = [];

  steps.push(
    step(
      "Scenario A — configured → Google Import",
      resolvePostWebsiteImportNextStage("configured") === "google_import",
    ),
  );
  steps.push(
    step(
      "Scenario B — no_profile → Business Profile Review",
      resolvePostWebsiteImportNextStage("no_profile") === "business_profile_intelligence",
    ),
  );
  steps.push(
    step(
      "Scenario C — deferred → Business Profile Review",
      resolvePostWebsiteImportNextStage("deferred") === "business_profile_intelligence",
    ),
  );
  steps.push(
    step(
      "Scenario D — missing town blocked",
      !validateOnboardingIntake(baseIntake({ townOrCity: "" })).ok,
    ),
  );
  steps.push(
    step(
      "Scenario D — unknown Google blocked",
      !validateOnboardingIntake(baseIntake({ googleProfileState: "unknown" })).ok,
    ),
  );
  steps.push(
    step(
      "Unknown state requires operator choice",
      normalizeGoogleProfileStateInput("unknown", false) === "unknown",
    ),
  );
  steps.push(
    step(
      "Blank Google fields ≠ no_profile",
      resolveGoogleProfileOnboardingState(normalizeProfileData({})) === "unknown",
    ),
  );
  steps.push(
    step(
      "shouldRunGoogleImport only configured/selected",
      shouldRunGoogleImport("configured") &&
        shouldRunGoogleImport("selected") &&
        !shouldRunGoogleImport("no_profile") &&
        !shouldRunGoogleImport("deferred"),
    ),
  );

  return steps;
}

function runTestCustomerChecks(): Step[] {
  const steps: Step[] = [];
  const profilePath = path.join(WORKSPACE_ROOT, "data", "pharmacy-profiles", `${TEST_SLUG}.json`);
  steps.push(step("Test customer profile exists", fs.existsSync(profilePath)));
  if (!fs.existsSync(profilePath)) return steps;

  const doc = JSON.parse(fs.readFileSync(profilePath, "utf8")) as { data?: Record<string, unknown> };
  const data = normalizeProfileData(doc.data || {});
  steps.push(
    step(
      "Website Import preserved on profile",
      Boolean(data.websiteImportSnapshot),
    ),
  );

  const ctx = loadMasterAdminCustomerContext(TEST_SLUG);
  if (ctx) {
    const stage = resolveWorkflowStage(ctx);
    const googleState = resolveGoogleProfileOnboardingState(ctx.data);
    const showGoogleImport =
      stage === "google_import" && shouldRunGoogleImport(googleState) && !verifyStageCompletion("google_import", ctx);
    steps.push(
      step(
        "No incorrect Google Import stage when no profile configured",
        !(googleState === "unknown" && showGoogleImport) &&
          !(googleState === "no_profile" && showGoogleImport),
        `stage=${stage}; googleState=${googleState}`,
      ),
    );
    const pre = runWorkflowPreflight(TEST_SLUG);
    steps.push(
      step(
        "Workflow blocked until intake completed (current test customer)",
        !pre.ok && Boolean(pre.reason),
        pre.reason || "",
      ),
    );
  }

  const intakeInvalid = validateStoredOnboardingIntake(readSetupProfile(TEST_SLUG));
  steps.push(
    step(
      "Test customer needs PO onboarding confirmation",
      !intakeInvalid.ok,
      intakeInvalid.errors.join("; "),
    ),
  );

  return steps;
}

function scanTenantSpecificCode(): Step[] {
  const changedModules = [
    "masterAdminGoogleProfileOnboardingService.ts",
    "masterAdminPrimaryLocalityService.ts",
    "masterAdminOnboardingIntakeService.ts",
    "masterAdminWorkflowStageExecutor.ts",
    "masterAdminOnboardingBatchService.ts",
    "masterAdminCommercialOnboardingService.ts",
    "masterAdminWorkflowOrchestrator.ts",
    "masterAdminPlatformPage.ts",
    "pharmacyProfileSchema.ts",
  ];
  const needles = [
    "reliable-direct-pharmacy",
    "Banner Cross",
    "Brook Pharmacy",
    "banner-cross",
    "brook-pharmacy",
  ];
  const hits: string[] = [];
  const roots = [
    path.join(WORKSPACE_ROOT, "src", "pharmacy"),
    path.join(WORKSPACE_ROOT, "artifacts", "api-server", "src", "routes"),
  ];
  for (const root of roots) {
    for (const mod of changedModules) {
      const file = walkFind(root, mod);
      if (!file) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const n of needles) {
        if (text.includes(n)) hits.push(`${n} in ${file}`);
      }
    }
  }
  return [step("No tenant-specific onboarding branches in changed modules", hits.length === 0, hits.join("; "))];
}

function walkFind(dir: string, name: string): string | null {
  if (!fs.existsSync(dir)) return null;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      const hit = walkFind(p, name);
      if (hit) return hit;
    } else if (ent.name === name) return p;
  }
  return null;
}

function main() {
  const all = [...runScenarioTests(), ...runTestCustomerChecks(), ...scanTenantSpecificCode()];
  const failed = all.filter((s) => !s.passed);
  for (const s of all) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-02 validation: FAIL (${failed.length})` : "\nNT-E2E-02 validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
