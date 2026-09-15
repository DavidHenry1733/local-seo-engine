/**
 * NT-E2E-16A — Google-state contract for ecosystem generation readiness (shared resolver).
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import {
  googleProfileStateRequiresOperatorChoice,
  resolveGoogleProfileOnboardingState,
  shouldRunGoogleImport,
  type GoogleProfileOnboardingState,
} from "./masterAdminGoogleProfileOnboardingService.ts";

export type GoogleGenerationReadinessClassification = "blocker" | "warning" | "opportunity" | "ready";

export interface GoogleGenerationReadinessResult {
  state: GoogleProfileOnboardingState;
  importRequired: boolean;
  identifierRequired: boolean;
  generationAllowed: boolean;
  readiness: "READY" | "BLOCKED";
  blockers: string[];
  warnings: string[];
  opportunities: string[];
  statusLabel: string;
  impactLabel: string;
  generationLabel: string;
  recommendedNextStep: string | null;
  placeId: string | null;
  profileUrl: string | null;
  importStatus: string;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function resolveGoogleGenerationReadiness(input: {
  profile: PharmacyProfileData;
  hasGoogleImport: boolean;
  googleImportStatus?: string | null;
}): GoogleGenerationReadinessResult {
  const state = resolveGoogleProfileOnboardingState(input.profile);
  const placeId = text(input.profile.googlePlaceId) || null;
  const profileUrl = text(input.profile.googleBusinessProfileUrl) || null;
  const hasGoogleImport = Boolean(input.hasGoogleImport);
  const importRequired = shouldRunGoogleImport(state);
  const identifierRequired = importRequired;
  const importStatus = text(input.googleImportStatus) || (hasGoogleImport ? "Imported" : "Not connected");

  const blockers: string[] = [];
  const warnings: string[] = [];
  const opportunities: string[] = [];

  if (googleProfileStateRequiresOperatorChoice(state)) {
    blockers.push("Google Business Profile decision required");
    return {
      state,
      importRequired,
      identifierRequired,
      generationAllowed: false,
      readiness: "BLOCKED",
      blockers,
      warnings,
      opportunities,
      statusLabel: "Google Business Profile decision required",
      impactLabel: "Operator must choose connect profile, no profile, or connect later before generation.",
      generationLabel: "Blocked",
      recommendedNextStep: "Choose a Google Business Profile option in onboarding or Business Profile Review.",
      placeId,
      profileUrl,
      importStatus: "Unknown",
    };
  }

  if (state === "no_profile") {
    warnings.push("Google Business Profile not connected");
    opportunities.push("Create or claim a Google Business Profile");
    return {
      state,
      importRequired: false,
      identifierRequired: false,
      generationAllowed: true,
      readiness: "READY",
      blockers,
      warnings,
      opportunities,
      statusLabel: "No Google Business Profile currently connected",
      impactLabel: "Google reviews, photos, categories and profile insights are unavailable.",
      generationLabel: "Available",
      recommendedNextStep: "Create or claim a Google Business Profile after generation.",
      placeId,
      profileUrl,
      importStatus: "Not connected",
    };
  }

  if (state === "deferred") {
    warnings.push("Google Business Profile connection deferred");
    opportunities.push("Connect Google Business Profile later");
    return {
      state,
      importRequired: false,
      identifierRequired: false,
      generationAllowed: true,
      readiness: "READY",
      blockers,
      warnings,
      opportunities,
      statusLabel: "Google Business Profile connection deferred",
      impactLabel: "Google reviews, photos, categories and profile insights are unavailable until connected.",
      generationLabel: "Available",
      recommendedNextStep: "Connect Google Business Profile when ready.",
      placeId,
      profileUrl,
      importStatus: "Deferred",
    };
  }

  if (state === "selected" && !placeId) {
    blockers.push("Selected Google Place ID required before generation");
  }
  if (identifierRequired && !placeId && !profileUrl) {
    blockers.push("Google Business Profile URL or Place ID required");
  }
  if (importRequired && !hasGoogleImport) {
    blockers.push("Google Import missing");
  }

  const generationAllowed = blockers.length === 0;
  return {
    state,
    importRequired,
    identifierRequired,
    generationAllowed,
    readiness: generationAllowed ? "READY" : "BLOCKED",
    blockers,
    warnings,
    opportunities,
    statusLabel: generationAllowed ? "Google Business Profile connected" : "Google connection incomplete",
    impactLabel: generationAllowed
      ? "Google profile evidence is available for generation."
      : "Google identifier and import are required before generation.",
    generationLabel: generationAllowed ? "Available" : "Blocked",
    recommendedNextStep: generationAllowed ? null : "Complete Google Import before generating the ecosystem.",
    placeId,
    profileUrl,
    importStatus,
  };
}

export function evaluateGoogleGenerationScenario(input: {
  state: GoogleProfileOnboardingState;
  hasGoogleImport: boolean;
  placeId?: string | null;
  profileUrl?: string | null;
}): "READY" | "BLOCKED" {
  return resolveGoogleGenerationReadiness({
    profile: {
      googleProfileOnboardingState: input.state,
      googlePlaceId: input.placeId || "",
      googleBusinessProfileUrl: input.profileUrl || "",
    } as PharmacyProfileData,
    hasGoogleImport: input.hasGoogleImport,
  }).readiness;
}
