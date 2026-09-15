/**
 * Real Enhancement Actions V1 — validation and classification for workspace completion.
 */
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { normalizeProfileData, type PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { buildPageSlotCards } from "./pharmacyImageOperatingSystem.ts";
import { getServicePublishingSettings } from "./pharmacyPublishingSettingsService.ts";
import type { EnhancementRecommendation } from "./pharmacyAuthorityEnhancementService.ts";

export type RealEnhancementActionType =
  | "reviewer_profile"
  | "clinical_review_date"
  | "next_review_date"
  | "image_assignment"
  | "canonical"
  | "noindex";

export const REAL_ENHANCEMENT_ACTION_TYPES: RealEnhancementActionType[] = [
  "reviewer_profile",
  "clinical_review_date",
  "next_review_date",
  "image_assignment",
  "canonical",
  "noindex",
];

const SIGNAL_ACTION_MAP: Record<string, RealEnhancementActionType> = {
  "he-named-accountability": "reviewer_profile",
  "he-reviewer-bio": "reviewer_profile",
  "he-patient-trust-wording": "reviewer_profile",
  "he-professional-review-panel": "reviewer_profile",
  "ct-clinical-review": "clinical_review_date",
  "he-review-frequency": "clinical_review_date",
  "ct-review-schedule": "next_review_date",
  "tq-images-assigned": "image_assignment",
  "cd-images-present": "image_assignment",
  "he-professional-photo": "image_assignment",
  "tq-alt-text": "image_assignment",
  "tq-canonical": "canonical",
  "tq-no-noindex": "noindex",
};

export function classifyRealEnhancementAction(
  recommendation: Pick<EnhancementRecommendation, "signalId" | "title">,
): RealEnhancementActionType | null {
  const mapped = SIGNAL_ACTION_MAP[recommendation.signalId];
  if (mapped) return mapped;

  const title = recommendation.title.toLowerCase();
  if (title.includes("reviewer") || title.includes("named accountability")) return "reviewer_profile";
  if (title.includes("next review")) return "next_review_date";
  if (title.includes("clinical review") || (title.includes("review date") && !title.includes("next"))) {
    return "clinical_review_date";
  }
  if (title.includes("canonical")) return "canonical";
  if (title.includes("noindex") || title.includes("indexable")) return "noindex";
  if (title.includes("image") || title.includes("photo")) return "image_assignment";

  return null;
}

export function isReviewerProfileComplete(profile: PharmacyProfileData): boolean {
  return Boolean(
    String(profile.reviewerName || "").trim() &&
      String(profile.reviewerRole || "").trim() &&
      String(profile.reviewerBio || "").trim(),
  );
}

export function loadNormalizedProfile(slug: string): PharmacyProfileData {
  const doc = loadPharmacyProfile(slug);
  return normalizeProfileData((doc?.data || doc || {}) as Record<string, unknown>);
}

export function validateRealEnhancementAction(
  slug: string,
  serviceId: string,
  recommendation: Pick<EnhancementRecommendation, "signalId" | "title">,
): { valid: boolean; actionType: RealEnhancementActionType | null; message: string } {
  const actionType = classifyRealEnhancementAction(recommendation);
  if (!actionType) {
    return { valid: true, actionType: null, message: "Test mode — no real validation required." };
  }

  const profile = loadNormalizedProfile(slug);
  const publishing = getServicePublishingSettings(slug, serviceId);

  switch (actionType) {
    case "reviewer_profile":
      if (!isReviewerProfileComplete(profile)) {
        return {
          valid: false,
          actionType,
          message: "Action not complete yet — please complete reviewerName, reviewerRole and reviewerBio in Profile Dashboard.",
        };
      }
      return { valid: true, actionType, message: "Reviewer profile complete." };

    case "clinical_review_date":
      if (!String(profile.clinicalReviewDate || "").trim()) {
        return {
          valid: false,
          actionType,
          message: "Action not complete yet — please set clinicalReviewDate in Profile Dashboard.",
        };
      }
      return { valid: true, actionType, message: "Clinical review date set." };

    case "next_review_date":
      if (!String(profile.nextReviewDate || "").trim()) {
        return {
          valid: false,
          actionType,
          message: "Action not complete yet — please set nextReviewDate in Profile Dashboard.",
        };
      }
      return { valid: true, actionType, message: "Next review date set." };

    case "canonical":
      if (!String(publishing?.canonicalUrl || "").trim()) {
        return {
          valid: false,
          actionType,
          message: "Action not complete yet — please save canonicalUrl in Publishing Settings.",
        };
      }
      return { valid: true, actionType, message: "Canonical URL configured." };

    case "noindex":
      if (publishing?.noindex !== false) {
        return {
          valid: false,
          actionType,
          message: "Action not complete yet — set noindex to false in Publishing Settings.",
        };
      }
      return { valid: true, actionType, message: "Page marked indexable in publishing settings." };

    case "image_assignment": {
      const slots = buildPageSlotCards(slug, serviceId);
      const assigned = slots.filter((s) => s.status === "assigned").length;
      if (assigned < 3) {
        return {
          valid: false,
          actionType,
          message: `Action not complete yet — assign at least 3/4 image slots (${assigned}/4 assigned).`,
        };
      }
      return { valid: true, actionType, message: `${assigned}/4 image slots assigned.` };
    }

    default:
      return { valid: true, actionType, message: "OK" };
  }
}

export function resolveImageSlotForSignal(signalId: string): string | null {
  if (signalId === "he-professional-photo") return "trust";
  if (signalId.includes("hero")) return "hero";
  return null;
}

export class EnhancementCompletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnhancementCompletionError";
  }
}
