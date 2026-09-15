/**
 * Profile field classification — required vs optional for Growth Programme progress.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { hasOpeningHours } from "./pharmacyProfileHours.ts";

export type ProfileFieldTier = "required" | "optional";

export interface ProfileFieldCheck {
  id: string;
  label: string;
  tier: ProfileFieldTier;
  ok: boolean;
  section: string;
}

function hasBrandOrFallback(data: PharmacyProfileData): boolean {
  return Boolean(
    data.logoUrl ||
      data.brandPrimaryColor ||
      data.website ||
      data.websiteAnalysisAt,
  );
}

function hasSelectedAreas(data: PharmacyProfileData): boolean {
  const fromSelected = (data.selectedAreas || []).some((a) => a.selected !== false);
  if (fromSelected) return true;
  return (data.rankingAreas || []).length > 0 || (data.coverageAreas || []).length > 0;
}

function hasSelectedServices(data: PharmacyProfileData): boolean {
  return (data.selectedServices || []).length > 0;
}

export function buildProfileFieldChecks(data: PharmacyProfileData): ProfileFieldCheck[] {
  const reviewerName = data.reviewerName || data.superintendentPharmacistName;
  const reviewerRole = data.reviewerRole || (data.superintendentPharmacistName ? "Superintendent Pharmacist" : "");
  const town = data.townCity || data.primaryTown || data.primaryCity;
  const addressOk = Boolean(data.addressLine1 || town);

  return [
    { id: "pharmacyName", label: "Pharmacy name", tier: "required", ok: Boolean(data.pharmacyName), section: "Business Identity" },
    { id: "websiteOrBrand", label: "Website URL or manual brand", tier: "required", ok: hasBrandOrFallback(data), section: "Branding" },
    { id: "phone", label: "Phone number", tier: "required", ok: Boolean(data.phone), section: "Contact Details" },
    { id: "address", label: "Address and town/postcode", tier: "required", ok: addressOk && Boolean(town) && Boolean(data.postcode), section: "Location" },
    { id: "primaryTown", label: "Primary town", tier: "required", ok: Boolean(data.primaryTown || data.primaryCity || data.townCity), section: "Coverage" },
    { id: "selectedAreas", label: "At least one target area", tier: "required", ok: hasSelectedAreas(data), section: "Coverage" },
    { id: "reviewerName", label: "Reviewer or superintendent name", tier: "required", ok: Boolean(reviewerName), section: "Professional Review" },
    { id: "clinicalReviewDate", label: "Clinical review date", tier: "required", ok: Boolean(data.clinicalReviewDate), section: "Professional Review" },
    { id: "selectedServices", label: "At least one service", tier: "optional", ok: hasSelectedServices(data), section: "Services" },
    { id: "brand", label: "Logo or brand colours", tier: "optional", ok: hasBrandOrFallback(data), section: "Branding" },
    { id: "reviewerRole", label: "Reviewer role", tier: "optional", ok: Boolean(reviewerRole), section: "Professional Review" },
    { id: "nextReviewDate", label: "Next review date", tier: "optional", ok: Boolean(data.nextReviewDate), section: "Professional Review" },
    { id: "tradingName", label: "Trading name", tier: "optional", ok: Boolean(data.tradingName), section: "Business Identity" },
    { id: "companyName", label: "Company name", tier: "optional", ok: Boolean(data.companyName), section: "Business Identity" },
    { id: "companyRegistrationNumber", label: "Company registration number", tier: "optional", ok: Boolean(data.companyRegistrationNumber), section: "Business Identity" },
    { id: "socialLinks", label: "Social links", tier: "optional", ok: Boolean(data.socialFacebook || data.socialInstagram || data.socialLinkedIn || data.socialX || data.socialYouTube), section: "Social" },
    { id: "reviewerPhoto", label: "Reviewer photo", tier: "optional", ok: Boolean(data.reviewerPhoto), section: "Professional Review" },
    { id: "reviewerBio", label: "Extended reviewer biography", tier: "optional", ok: Boolean(data.reviewerBio), section: "Professional Review" },
    { id: "openingHours", label: "Opening hours", tier: "optional", ok: hasOpeningHours(data), section: "Opening Hours" },
    { id: "gphcNumber", label: "GPhC premises number", tier: "optional", ok: Boolean(data.gphcNumber) || data.gphcNumberMarkedMissing, section: "GPhC Details" },
    { id: "latitude", label: "Latitude / longitude", tier: "optional", ok: Boolean(data.latitude && data.longitude) || Boolean(data.googleMapsEmbedUrl), section: "Location" },
    { id: "footerLinks", label: "Footer extra links", tier: "optional", ok: (data.footerLinks || []).length > 0, section: "Footer" },
  ];
}

export function computeRequiredProfileCompleteness(data: PharmacyProfileData): {
  score: number;
  requiredTotal: number;
  requiredComplete: number;
  missingRequired: string[];
  optionalImprovements: string[];
} {
  const checks = buildProfileFieldChecks(data);
  const required = checks.filter((c) => c.tier === "required");
  const optional = checks.filter((c) => c.tier === "optional" && !c.ok);
  const requiredComplete = required.filter((c) => c.ok).length;
  const score = required.length ? Math.round((requiredComplete / required.length) * 100) : 0;
  return {
    score,
    requiredTotal: required.length,
    requiredComplete,
    missingRequired: required.filter((c) => !c.ok).map((c) => c.label),
    optionalImprovements: optional.map((c) => c.label),
  };
}

export function isRequiredProfileComplete(data: PharmacyProfileData): boolean {
  return computeRequiredProfileCompleteness(data).score >= 100;
}

/** Collected at later clinical content review — not in customer-facing Your Pharmacy. */
export const CLINICAL_CONTENT_REVIEW_FIELD_IDS = ["reviewerName", "clinicalReviewDate"] as const;

export function computeCampaignPharmacyReadiness(data: PharmacyProfileData): {
  score: number;
  requiredTotal: number;
  requiredComplete: number;
  missing: string[];
} {
  const checks = buildProfileFieldChecks(data).filter(
    (c) => c.tier === "required" && !(CLINICAL_CONTENT_REVIEW_FIELD_IDS as readonly string[]).includes(c.id),
  );
  const requiredComplete = checks.filter((c) => c.ok).length;
  return {
    score: checks.length ? Math.round((requiredComplete / checks.length) * 100) : 0,
    requiredTotal: checks.length,
    requiredComplete,
    missing: checks.filter((c) => !c.ok).map((c) => c.label),
  };
}

/** Pre-generation pharmacy gate: customer-accessible Your Pharmacy fields only. */
export function isCampaignPharmacyReady(data: PharmacyProfileData): boolean {
  return computeCampaignPharmacyReadiness(data).score >= 100;
}
