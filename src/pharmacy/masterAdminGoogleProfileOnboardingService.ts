/**
 * Commercial onboarding — Google Business Profile intake state (generic, tenant-agnostic).
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";

export type GoogleProfileOnboardingState =
  | "configured"
  | "selected"
  | "no_profile"
  | "deferred"
  | "unknown";

export function resolveGoogleProfileOnboardingState(data: PharmacyProfileData): GoogleProfileOnboardingState {
  const explicit = String(data.googleProfileOnboardingState || "").trim() as GoogleProfileOnboardingState;
  if (
    explicit === "configured" ||
    explicit === "selected" ||
    explicit === "no_profile" ||
    explicit === "deferred" ||
    explicit === "unknown"
  ) {
    return explicit;
  }
  const url = String(data.googleBusinessProfileUrl || "").trim();
  const placeId = String(data.googlePlaceId || "").trim();
  if (url || placeId) return "configured";
  return "unknown";
}

export function shouldRunGoogleImport(state: GoogleProfileOnboardingState): boolean {
  return state === "configured" || state === "selected";
}

export function isGoogleImportWorkflowStageComplete(
  data: PharmacyProfileData,
  opts: { hasGoogleImportSnapshot?: boolean; googleMatchConfirmed?: boolean; batchGoogleSkipped?: boolean },
): boolean {
  const state = resolveGoogleProfileOnboardingState(data);
  if (opts.batchGoogleSkipped) return true;
  if (state === "no_profile" || state === "deferred") return true;
  if (state === "unknown") return false;
  if (opts.hasGoogleImportSnapshot) return true;
  if (opts.googleMatchConfirmed) return true;
  return false;
}

export function googleProfileStateRequiresOperatorChoice(state: GoogleProfileOnboardingState): boolean {
  return state === "unknown";
}

export function normalizeGoogleProfileStateInput(raw: unknown, hasUrlOrPlace: boolean): GoogleProfileOnboardingState {
  const v = String(raw || "").trim() as GoogleProfileOnboardingState;
  if (v === "no_profile" || v === "deferred" || v === "configured" || v === "selected" || v === "unknown") {
    return v;
  }
  if (hasUrlOrPlace) return "configured";
  return "unknown";
}
