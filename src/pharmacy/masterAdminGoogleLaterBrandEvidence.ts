/**
 * HOTFIX-01 — Google "connect later" is a resolved onboarding choice.
 * It does not connect Google. It unlocks Business Profile Review and, when
 * website import did not succeed, a Product Owner confirmation of brand
 * source from the business information already captured at intake.
 */
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import {
  resolveGoogleProfileOnboardingState,
  type GoogleProfileOnboardingState,
} from "./masterAdminGoogleProfileOnboardingService.ts";
import { websiteImportStageComplete } from "./masterAdminWebsiteBranchSelectionService.ts";

export const MANUAL_BRAND_SOURCE_VALUE_KEY = "manualBrandSourceValue";
export const MANUAL_BRAND_SOURCE_CONFIRMED_AT_KEY = "manualBrandSourceConfirmedAt";
export const MANUAL_BRAND_SOURCE_CONFIRMED_BY_KEY = "manualBrandSourceConfirmedBy";
export const MANUAL_BRAND_SOURCE_PREFIX = "product-owner-confirmed-onboarding-brand";

const BUSINESS_PROFILE_REVIEW_STAGES = new Set([
  "business_profile_intelligence",
  "resolve_import_conflicts",
  "approve_business_profile",
]);

function text(value: unknown): string {
  return String(value ?? "").trim();
}

/** Deferred or no-profile. Not "connected", and not an unfinished Google Import. */
export function isGoogleOnboardingResolvedWithoutImport(state: GoogleProfileOnboardingState): boolean {
  return state === "deferred" || state === "no_profile";
}

export function businessProfileReviewOpenAllowed(input: {
  workflowStage?: string | null;
  googleProfileState?: string | null;
}): boolean {
  const stage = text(input.workflowStage);
  if (BUSINESS_PROFILE_REVIEW_STAGES.has(stage)) return true;
  return isGoogleOnboardingResolvedWithoutImport(text(input.googleProfileState) as GoogleProfileOnboardingState);
}

export function describeManualOnboardingBrandSource(input: {
  pharmacyName?: string | null;
  website?: string | null;
}): string | null {
  const pharmacyName = text(input.pharmacyName);
  const website = text(input.website);
  if (!pharmacyName || !website) return null;
  return `${MANUAL_BRAND_SOURCE_PREFIX} · pharmacy=${pharmacyName} · website=${website}`;
}

export function readManualOnboardingBrandSource(slug: string): string | null {
  const profile = readSetupProfile(slug);
  const value = text(profile.profileFieldConfirmations?.[MANUAL_BRAND_SOURCE_VALUE_KEY]);
  if (!value.startsWith(MANUAL_BRAND_SOURCE_PREFIX)) return null;
  return value;
}

export interface ManualBrandConfirmationOffer {
  available: boolean;
  confirmed: boolean;
  value: string | null;
  reason: string | null;
  googleProfileState: GoogleProfileOnboardingState;
}

export function manualBrandConfirmationOffer(slug: string): ManualBrandConfirmationOffer {
  const profile = readSetupProfile(slug);
  const googleProfileState = resolveGoogleProfileOnboardingState(profile);
  const existing = readManualOnboardingBrandSource(slug);
  if (existing) {
    return { available: false, confirmed: true, value: existing, reason: null, googleProfileState };
  }
  if (!isGoogleOnboardingResolvedWithoutImport(googleProfileState)) {
    return {
      available: false,
      confirmed: false,
      value: null,
      reason: "Google Import remains required because Google was not deferred.",
      googleProfileState,
    };
  }
  if (websiteImportStageComplete(slug)) {
    return {
      available: false,
      confirmed: false,
      value: null,
      reason: "Website import already supplies brand evidence.",
      googleProfileState,
    };
  }
  const described = describeManualOnboardingBrandSource(profile);
  if (!described) {
    return {
      available: false,
      confirmed: false,
      value: null,
      reason: "Pharmacy name and website are required before brand source can be confirmed.",
      googleProfileState,
    };
  }
  return { available: true, confirmed: false, value: described, reason: null, googleProfileState };
}

/**
 * Records the Product Owner's confirmation of brand source from intake
 * identity and website. Does not create Brand DNA, a website import snapshot,
 * or a Google connection.
 */
export function confirmManualOnboardingBrandSource(
  slug: string,
  operator: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const offer = manualBrandConfirmationOffer(slug);
  if (offer.confirmed && offer.value) return { ok: true, value: offer.value };
  if (!offer.available || !offer.value) {
    return { ok: false, error: offer.reason || "Manual brand confirmation is not available." };
  }

  const profile = readSetupProfile(slug);
  const googleBefore = resolveGoogleProfileOnboardingState(profile);
  const websiteSnapshotBefore = profile.websiteImportSnapshot;
  const googleSnapshotBefore = profile.googleImportSnapshot;
  writeSetupProfile(slug, {
    ...profile,
    googleProfileOnboardingState: googleBefore,
    websiteImportSnapshot: websiteSnapshotBefore,
    googleImportSnapshot: googleSnapshotBefore,
    profileFieldConfirmations: {
      ...(profile.profileFieldConfirmations || {}),
      [MANUAL_BRAND_SOURCE_VALUE_KEY]: offer.value,
      [MANUAL_BRAND_SOURCE_CONFIRMED_AT_KEY]: new Date().toISOString(),
      [MANUAL_BRAND_SOURCE_CONFIRMED_BY_KEY]: text(operator) || "product-owner",
    },
  });
  return { ok: true, value: offer.value };
}
