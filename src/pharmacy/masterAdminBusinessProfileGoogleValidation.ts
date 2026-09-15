/**
 * NT-E2E-05 — Business Profile Review Google state contract (save vs approval).
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import {
  googleProfileStateRequiresOperatorChoice,
  resolveGoogleProfileOnboardingState,
  type GoogleProfileOnboardingState,
} from "./masterAdminGoogleProfileOnboardingService.ts";

export const GOOGLE_IDENTITY_REVIEW_FIELD_IDS = new Set([
  "googlePlaceId",
  "googleMapsUrl",
  "primaryCategory",
]);

export interface BusinessProfileGoogleSection {
  state: GoogleProfileOnboardingState;
  statusLabel: string;
  statusDetail: string;
  primaryActionLabel: string;
  secondaryActionLabel: string | null;
  growthOpportunity: string | null;
  placeId: string | null;
  profileUrl: string | null;
  businessName: string | null;
  importStatus: string;
  metricsAvailable: boolean;
  connectLaterAvailable: boolean;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function isGoogleIdentifierRequiredForBusinessProfile(
  state: GoogleProfileOnboardingState,
): boolean {
  return state === "configured" || state === "selected";
}

export function isGoogleIntelligenceRequiredForBusinessProfile(
  state: GoogleProfileOnboardingState,
): boolean {
  return state === "configured" || state === "selected";
}

export function isGoogleIdentityFieldRequiredForBusinessProfile(
  fieldId: string,
  state: GoogleProfileOnboardingState,
): boolean {
  if (!GOOGLE_IDENTITY_REVIEW_FIELD_IDS.has(fieldId)) return false;
  return isGoogleIdentifierRequiredForBusinessProfile(state);
}

export function canSaveBusinessProfileDraft(state: GoogleProfileOnboardingState): boolean {
  return true;
}

export function canApproveBusinessProfileWithGoogleState(
  state: GoogleProfileOnboardingState,
  profile: PharmacyProfileData,
): { allowed: boolean; reason: string | null } {
  if (googleProfileStateRequiresOperatorChoice(state)) {
    return {
      allowed: false,
      reason:
        "Choose a Google Business Profile option — connect a profile, confirm no profile, or defer connection.",
    };
  }
  if (!isGoogleIdentifierRequiredForBusinessProfile(state)) {
    return { allowed: true, reason: null };
  }
  const placeId = text(profile.googlePlaceId);
  const profileUrl = text(profile.googleBusinessProfileUrl);
  if (!placeId && !profileUrl) {
    return {
      allowed: false,
      reason: "Google Business Profile URL or Place ID is required when Google is connected.",
    };
  }
  if (state === "selected" && !placeId) {
    return {
      allowed: false,
      reason: "Selected Google Place ID is required before approval.",
    };
  }
  return { allowed: true, reason: null };
}

export function validateBusinessProfileGoogleFieldSave(input: {
  fieldId: string;
  state: GoogleProfileOnboardingState;
  finalValue: string;
}): string | null {
  if (!GOOGLE_IDENTITY_REVIEW_FIELD_IDS.has(input.fieldId)) return null;
  if (!isGoogleIdentifierRequiredForBusinessProfile(input.state)) return null;
  if (input.fieldId === "googlePlaceId" && !text(input.finalValue)) {
    return "Google Business Profile Place ID is required when Google is connected.";
  }
  if (input.fieldId === "googleMapsUrl" && !text(input.finalValue)) {
    return "Google Business Profile URL is required when Google is connected.";
  }
  return null;
}

export function buildBusinessProfileGoogleSection(
  profile: PharmacyProfileData,
  opts?: {
    googleBusinessName?: string | null;
    googleImportStatus?: string | null;
  },
): BusinessProfileGoogleSection {
  const state = resolveGoogleProfileOnboardingState(profile);
  const placeId = text(profile.googlePlaceId) || null;
  const profileUrl = text(profile.googleBusinessProfileUrl) || null;
  const importStatus = text(opts?.googleImportStatus) || "Not connected";
  const businessName = text(opts?.googleBusinessName) || null;

  if (state === "no_profile") {
    return {
      state,
      statusLabel: "No Google Business Profile currently connected",
      statusDetail: "Business Profile save and approval do not require Google.",
      primaryActionLabel: "Search for or connect a profile",
      secondaryActionLabel: "Confirm this pharmacy does not currently have a profile",
      growthOpportunity: "Create or claim a Google Business Profile",
      placeId,
      profileUrl,
      businessName,
      importStatus: "Not connected",
      metricsAvailable: false,
      connectLaterAvailable: true,
    };
  }

  if (state === "deferred") {
    return {
      state,
      statusLabel: "Google Business Profile connection deferred",
      statusDetail: "You can connect a Google profile later without blocking approval.",
      primaryActionLabel: "Connect profile now",
      secondaryActionLabel: null,
      growthOpportunity: "Connect Google Business Profile later",
      placeId,
      profileUrl,
      businessName,
      importStatus: "Deferred",
      metricsAvailable: false,
      connectLaterAvailable: true,
    };
  }

  if (state === "unknown") {
    return {
      state,
      statusLabel: "Google Business Profile decision required",
      statusDetail: "Save draft changes, then choose connect, no profile, or connect later before approval.",
      primaryActionLabel: "Connect a Google profile",
      secondaryActionLabel: "Confirm no profile or connect later in onboarding",
      growthOpportunity: null,
      placeId,
      profileUrl,
      businessName,
      importStatus: "Unknown",
      metricsAvailable: false,
      connectLaterAvailable: true,
    };
  }

  return {
    state,
    statusLabel: placeId || profileUrl ? "Google Business Profile connected" : "Google connection incomplete",
    statusDetail:
      importStatus === "Complete"
        ? "Google Intelligence imported for Business Profile Review."
        : importStatus === "Missing" && (placeId || profileUrl)
          ? "Run Google Import to load Google Intelligence before approval."
          : placeId || profileUrl
            ? "Google identifier present — complete Google Import before approval."
            : "Google identifier required before approval.",
    primaryActionLabel: placeId || profileUrl ? "Change Google Business Profile" : "Add Google Business Profile",
    secondaryActionLabel: "Search for Google profile",
    growthOpportunity: null,
    placeId,
    profileUrl,
    businessName,
    importStatus,
    metricsAvailable: Boolean(placeId || profileUrl),
    connectLaterAvailable: true,
  };
}

export function googleIdentityUnavailableLabel(state: GoogleProfileOnboardingState): string {
  if (state === "no_profile") return "Not connected";
  if (state === "deferred") return "Deferred";
  if (state === "unknown") return "Unknown";
  return "Not available";
}
