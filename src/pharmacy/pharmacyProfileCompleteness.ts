/**
 * Pharmacy Profile Dashboard V1 — completeness scoring and website analysis checklist.
 */
import type { BrandProfile } from "../generator/brandImporter.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { hasOpeningHours } from "./pharmacyProfileHours.ts";
import {
  buildProfileFieldChecks,
  computeRequiredProfileCompleteness,
  isRequiredProfileComplete,
} from "./pharmacyProfileFieldClassification.ts";

export { buildProfileFieldChecks, computeRequiredProfileCompleteness, isRequiredProfileComplete };

export interface ProfileCompletenessSection {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  missing: string[];
  status: "complete" | "partial" | "needs_completion";
}

export interface ProfileCompletenessResult {
  score: number;
  sections: ProfileCompletenessSection[];
  missingItems: string[];
}

export interface WebsiteAnalysisChecklistItem {
  label: string;
  status: "done" | "warn" | "required";
}

function sectionStatus(passed: number, total: number): ProfileCompletenessSection["status"] {
  if (passed >= total) return "complete";
  if (passed === 0) return "needs_completion";
  return "partial";
}

function section(
  id: string,
  label: string,
  checks: { label: string; ok: boolean }[],
  weight = 11.11,
): ProfileCompletenessSection {
  const passed = checks.filter((c) => c.ok).length;
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  const maxScore = weight;
  const score = checks.length ? Math.round((passed / checks.length) * maxScore) : 0;
  return {
    id,
    label,
    score,
    maxScore,
    missing,
    status: sectionStatus(passed, checks.length),
  };
}

export function computeProfileCompleteness(data: PharmacyProfileData, _slug = "pharmaconnect"): ProfileCompletenessResult {
  const required = computeRequiredProfileCompleteness(data);
  const fieldChecks = buildProfileFieldChecks(data);

  const sections: ProfileCompletenessSection[] = [
    section("business_identity", "Business Identity", [
      { label: "Pharmacy name (required)", ok: Boolean(data.pharmacyName) },
      { label: "Trading name (optional)", ok: Boolean(data.tradingName) },
      { label: "Website URL (required if no brand import)", ok: Boolean(data.website) || Boolean(data.logoUrl || data.brandPrimaryColor) },
      { label: "Company name (optional)", ok: Boolean(data.companyName) },
    ]),
    section("branding", "Branding", [
      { label: "Logo or brand import (required)", ok: Boolean(data.logoUrl || data.brandPrimaryColor || data.websiteAnalysisAt) },
      { label: "Primary colour (optional)", ok: Boolean(data.brandPrimaryColor) },
      { label: "CTA colour (optional)", ok: Boolean(data.brandCtaColor) },
      { label: "Heading font (optional)", ok: Boolean(data.fontHeading) },
    ]),
    section("navigation", "Navigation (optional)", [
      { label: "Header navigation", ok: (data.headerNavLinks || []).length > 0 },
      { label: "Primary CTA text", ok: Boolean(data.headerCtaText || data.preferredCta) },
      { label: "Primary CTA URL", ok: Boolean(data.headerCtaUrl) },
    ]),
    section("contact", "Contact Details", [
      { label: "Phone number (required)", ok: Boolean(data.phone) },
      { label: "Email address (optional)", ok: Boolean(data.businessEmail || data.email) },
    ]),
    section("location", "Location", [
      { label: "Address line 1 (required)", ok: Boolean(data.addressLine1) },
      { label: "Town / city (required)", ok: Boolean(data.townCity || data.primaryTown) },
      { label: "Postcode (required)", ok: Boolean(data.postcode) },
    ]),
    section("coverage", "Coverage & Services", [
      { label: "Primary town (required)", ok: Boolean(data.primaryTown || data.primaryCity || data.townCity) },
      { label: "Target areas (required)", ok: (data.selectedAreas || []).some((a) => a.selected !== false) || (data.rankingAreas || []).length > 0 },
      { label: "Selected services (required)", ok: (data.selectedServices || []).length > 0 },
    ]),
    section("professional_review", "Professional Review", [
      { label: "Reviewer name (required)", ok: Boolean(data.reviewerName || data.superintendentPharmacistName) },
      { label: "Reviewer role (required)", ok: Boolean(data.reviewerRole || data.superintendentPharmacistName) },
      { label: "Clinical review date (required)", ok: Boolean(data.clinicalReviewDate) },
      { label: "Next review date (optional)", ok: Boolean(data.nextReviewDate) },
      { label: "Reviewer biography (optional)", ok: Boolean(data.reviewerBio) },
    ]),
    section("opening_hours", "Opening Hours (optional)", [
      { label: "Opening hours configured", ok: hasOpeningHours(data) },
    ]),
    section("gphc", "GPhC Details (optional)", [
      { label: "GPhC premises number", ok: Boolean(data.gphcNumber) || data.gphcNumberMarkedMissing },
      { label: "GPhC registration URL", ok: Boolean(data.gphcPremisesUrl) },
      { label: "Superintendent pharmacist", ok: Boolean(data.superintendentPharmacistName) || data.superintendentPharmacistNameMarkedMissing },
    ]),
  ];

  const rawScore = required.score;
  const missingItems = [
    ...required.missingRequired.map((m) => `Required: ${m}`),
    ...required.optionalImprovements.slice(0, 6).map((m) => `Improve profile: ${m}`),
  ];

  return { score: rawScore, sections, missingItems };
}

export interface WebsiteAnalysisChecklistContext {
  brand: BrandProfile;
  location: { confidence: number };
  detectedServices: { serviceId: string; serviceName: string; confidence: number }[];
  socialLinks: Record<string, string>;
}

export function computeWebsiteAnalysisChecklist(
  data: PharmacyProfileData,
  ctx?: WebsiteAnalysisChecklistContext,
): WebsiteAnalysisChecklistItem[] {
  const items: WebsiteAnalysisChecklistItem[] = [];

  const done = (label: string) => items.push({ label, status: "done" });
  const warn = (label: string) => items.push({ label, status: "warn" });
  const required = (label: string) => items.push({ label, status: "required" });

  if (data.logoUrl || ctx?.brand.logoUrl) done("Logo imported");
  else warn("Logo needs manual upload");

  if (data.brandPrimaryColor || ctx?.brand.primaryColour) done("Brand colours imported");
  else warn("Brand colours need review");

  if ((data.headerNavLinks || []).length || (ctx?.brand.navigationLinks || []).length) done("Navigation imported");
  else warn("Navigation needs manual setup");

  if (data.phone || data.businessEmail || ctx?.brand.contact?.phone) done("Contact details imported");
  else warn("Contact details incomplete");

  if (data.townCity || data.primaryTown || (ctx?.location.confidence ?? 0) >= 50) {
    done("Primary town detected");
  } else {
    warn("Primary town not detected — enter manually");
  }

  if (hasOpeningHours(data)) done("Opening hours configured");
  else warn("Opening hours need confirmation");

  if (data.superintendentPharmacistName || data.superintendentPharmacistNameMarkedMissing) {
    done("Superintendent pharmacist recorded");
  } else {
    required("Superintendent pharmacist required");
  }

  if (data.reviewerBio) done("Reviewer biography provided");
  else required("Reviewer biography required");

  if (data.gphcNumber || data.gphcNumberMarkedMissing) done("GPhC registration recorded");
  else required("GPhC registration required");

  if (ctx?.detectedServices?.length) {
    warn(`${ctx.detectedServices.length} service(s) detected — review before enabling`);
  }

  return items;
}
