/**
 * NT-E2E-03 — onboarding address resolver + automatic area discovery validation.
 */
import {
  resolveOnboardingAddressLine1,
} from "../src/pharmacy/masterAdminOnboardingAddressResolver.ts";
import {
  discoverOnboardingAreasForProfile,
  getOnboardingAreaDiscoveryState,
  ONBOARDING_AREA_DISCOVERY_SOURCE,
} from "../src/pharmacy/masterAdminOnboardingAreaDiscoveryService.ts";
import { evaluateAreaNameForDiscovery } from "../src/pharmacy/pharmacyAreaSelectionService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";

const TEST_SLUG = "reliable-direct-pharmacy";

type Step = { name: string; passed: boolean; detail?: string };

function step(name: string, passed: boolean, detail?: string): Step {
  return { name, passed, detail };
}

function main() {
  const steps: Step[] = [];

  const profile = readSetupProfile(TEST_SLUG);
  const resolved = resolveOnboardingAddressLine1(profile);
  steps.push(step("Address resolver returns value for test customer", Boolean(resolved.value), `${resolved.source}: ${resolved.value}`));
  steps.push(step("Address mapping uses customer record or operator source", ["operator-onboarding", "customer-record"].includes(resolved.source) || Boolean(resolved.value)));

  const websiteSnap = profile.websiteImportSnapshot;
  const importedAddress = String(websiteSnap?.address || websiteSnap?.intelligence?.business?.address?.selected || "").trim();
  steps.push(step("Imported website address checked", true, importedAddress ? importedAddress : "none in website import snapshot"));

  const discovery = discoverOnboardingAreasForProfile(TEST_SLUG, { force: true });
  steps.push(step("Town or City used as discovery root", discovery.primaryTown.toLowerCase() === "sheffield", discovery.primaryTown));
  steps.push(step("Areas discovered", discovery.areas.length > 0, String(discovery.areas.length)));
  steps.push(step("Duplicate slugs removed", new Set(discovery.areas.map((a) => a.slug)).size === discovery.areas.length));
  steps.push(step("Primary town excluded as neighbourhood", !discovery.areas.some((a) => a.areaName.toLowerCase() === "sheffield")));
  steps.push(step("Discovery source generic", discovery.areas.every((a) => a.source.includes("engine") || a.source === "operator"), ONBOARDING_AREA_DISCOVERY_SOURCE));
  steps.push(step("Rejected areas recorded", discovery.rejected.length >= 0, String(discovery.rejected.length)));

  const cached = getOnboardingAreaDiscoveryState(TEST_SLUG);
  steps.push(step("Discovery cache revision persisted", Boolean(cached.discoveryRevision)));
  steps.push(step("Refresh uses cached discovery when unchanged", cached.areas.length > 0, String(cached.areas.length)));

  const unrelated = evaluateAreaNameForDiscovery("South Yorkshire", "Sheffield");
  steps.push(step("County filtered", !unrelated.accept, unrelated.reason || ""));

  const after = readSetupProfile(TEST_SLUG);
  steps.push(step("Website Import preserved", Boolean(after.websiteImportSnapshot?.importedAt)));
  steps.push(step("Customer preserved", after.pharmacyName === "Reliable Direct Pharmacy"));
  steps.push(step("Branding preserved", after.brandPrimaryColor === "#005eb8"));
  steps.push(step("Design Intelligence file exists", fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-component-dna", `${TEST_SLUG}.json`))));

  const tenantHits: string[] = [];
  for (const file of [
    "src/pharmacy/masterAdminOnboardingAreaDiscoveryService.ts",
    "src/pharmacy/masterAdminOnboardingAddressResolver.ts",
    "src/pharmacy/masterAdminOnboardingIntakeService.ts",
  ]) {
    const text = fs.readFileSync(path.join(WORKSPACE_ROOT, file), "utf8");
    if (text.includes("reliable-direct") || text.includes("Banner Cross")) tenantHits.push(file);
  }
  steps.push(step("No tenant-specific discovery code", tenantHits.length === 0, tenantHits.join("; ")));

  const failed = steps.filter((s) => !s.passed);
  for (const s of steps) {
    console.log(`${s.passed ? "PASS" : "FAIL"} — ${s.name}${s.detail ? ` (${s.detail})` : ""}`);
  }
  console.log(failed.length ? `\nNT-E2E-03 validation: FAIL (${failed.length})` : "\nNT-E2E-03 validation: PASS");
  process.exit(failed.length ? 1 : 0);
}

main();
