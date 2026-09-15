/**
 * Defect 042 — normalisation, classification and action-required logic.
 */
import type { ConflictClassification, ReviewFieldInputType, ReviewFieldTier } from "./masterAdminBusinessProfileReviewModel.ts";
import {
  GOOGLE_IDENTITY_REVIEW_FIELD_IDS,
  isGoogleIdentityFieldRequiredForBusinessProfile,
} from "./masterAdminBusinessProfileGoogleValidation.ts";
import type { GoogleProfileOnboardingState } from "./masterAdminGoogleProfileOnboardingService.ts";

export type FieldMatchKind = "text" | "phone" | "postcode" | "url" | "business_name" | "address" | "opening_hours";

export interface FieldMeta {
  inputType: ReviewFieldInputType;
  matchKind: FieldMatchKind;
  humanConfirmationOnly: boolean;
  lowRiskAutoAccept: boolean;
}

export const FIELD_META: Record<string, FieldMeta> = {
  businessName: { inputType: "text", matchKind: "business_name", humanConfirmationOnly: false, lowRiskAutoAccept: false },
  tradingName: { inputType: "text", matchKind: "text", humanConfirmationOnly: false, lowRiskAutoAccept: true },
  gphcNumber: { inputType: "text", matchKind: "text", humanConfirmationOnly: true, lowRiskAutoAccept: false },
  address: { inputType: "address", matchKind: "address", humanConfirmationOnly: false, lowRiskAutoAccept: false },
  postcode: { inputType: "postcode", matchKind: "postcode", humanConfirmationOnly: false, lowRiskAutoAccept: false },
  telephone: { inputType: "telephone", matchKind: "phone", humanConfirmationOnly: false, lowRiskAutoAccept: false },
  email: { inputType: "email", matchKind: "text", humanConfirmationOnly: false, lowRiskAutoAccept: true },
  website: { inputType: "url", matchKind: "url", humanConfirmationOnly: false, lowRiskAutoAccept: false },
  googlePlaceId: { inputType: "text", matchKind: "text", humanConfirmationOnly: false, lowRiskAutoAccept: false },
  googleMapsUrl: { inputType: "url", matchKind: "url", humanConfirmationOnly: false, lowRiskAutoAccept: true },
  primaryCategory: { inputType: "text", matchKind: "text", humanConfirmationOnly: false, lowRiskAutoAccept: true },
  openingHoursSummary: { inputType: "opening_hours", matchKind: "opening_hours", humanConfirmationOnly: false, lowRiskAutoAccept: false },
  pharmacyFirstAvailability: { inputType: "yes_no", matchKind: "text", humanConfirmationOnly: true, lowRiskAutoAccept: false },
  consultationRoom: { inputType: "yes_no", matchKind: "text", humanConfirmationOnly: true, lowRiskAutoAccept: false },
  appointmentMethod: { inputType: "text", matchKind: "text", humanConfirmationOnly: true, lowRiskAutoAccept: false },
  primaryCtaDestination: { inputType: "url", matchKind: "url", humanConfirmationOnly: true, lowRiskAutoAccept: false },
  logo: { inputType: "url", matchKind: "url", humanConfirmationOnly: false, lowRiskAutoAccept: true },
  brandPrimaryColor: { inputType: "text", matchKind: "text", humanConfirmationOnly: false, lowRiskAutoAccept: true },
};

/** Only these fields may appear in Business Profile Review as operator decisions. */
export const BUSINESS_DECISION_FIELD_IDS = new Set([
  "pharmacyFirstAvailability",
  "consultationRoom",
  "appointmentMethod",
  "primaryCtaDestination",
  "gphcNumber",
  "privateServices",
  "languagesSpoken",
  "parkingAvailable",
  "accessibilityFeatures",
  "deliveryService",
]);

/** Imported identity/contact fields auto-verified when sources agree or Google is trusted. */
export const IMPORT_PROVEN_FIELD_IDS = new Set([
  "businessName",
  "tradingName",
  "address",
  "postcode",
  "telephone",
  "email",
  "website",
  "googlePlaceId",
  "googleMapsUrl",
  "primaryCategory",
  "logo",
  "brandPrimaryColor",
]);

export function normText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u202f/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normPhone(value: unknown): string {
  return normText(value).replace(/[^\d+]/g, "");
}

export function normPostcode(value: unknown): string {
  return normText(value).replace(/\s+/g, "").toUpperCase();
}

export function formatPostcode(value: unknown): string {
  const p = normPostcode(value);
  if (p.length >= 5) return `${p.slice(0, -3)} ${p.slice(-3)}`.trim();
  return p;
}

export function normUrl(value: unknown): string {
  return normText(value)
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function normBusinessName(value: unknown): string {
  return normText(value)
    .toLowerCase()
    .replace(/[^\w\s&+/-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normAddress(value: unknown): string {
  return normText(value)
    .toLowerCase()
    .replace(/\broad\b/g, "rd")
    .replace(/\bstreet\b/g, "st")
    .replace(/\blane\b/g, "ln")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normOpeningHours(value: unknown): string {
  return normText(value)
    .toLowerCase()
    .replace(/\u2013|\u2014|–|—/g, "-")
    .replace(/\s+/g, " ")
    .replace(/am|pm/g, (m) => m.toUpperCase());
}

export function valuesMateriallyMatch(
  a: unknown,
  b: unknown,
  kind: FieldMatchKind,
): { match: boolean; normalisation: string | null } {
  const left = normText(a);
  const right = normText(b);
  if (!left && !right) return { match: true, normalisation: null };
  if (!left || !right) return { match: false, normalisation: null };

  if (kind === "phone") {
    const match = normPhone(left) === normPhone(right);
    return { match, normalisation: match ? "telephone digits normalised" : null };
  }
  if (kind === "postcode") {
    const match = normPostcode(left) === normPostcode(right);
    return { match, normalisation: match ? "postcode spacing normalised" : null };
  }
  if (kind === "url") {
    const match = normUrl(left) === normUrl(right) || normUrl(left).endsWith(normUrl(right)) || normUrl(right).endsWith(normUrl(left));
    return { match, normalisation: match ? "URL protocol/trailing slash normalised" : null };
  }
  if (kind === "business_name") {
    const nl = normBusinessName(left);
    const nr = normBusinessName(right);
    const match = nl === nr || nr.includes(nl) || nl.includes(nr);
    return { match, normalisation: match ? "business name punctuation/substring normalised" : null };
  }
  if (kind === "address") {
    const nl = normAddress(left);
    const nr = normAddress(right);
    const match = nl === nr || nl.includes(nr) || nr.includes(nl);
    return { match, normalisation: match ? "address abbreviation normalised" : null };
  }
  if (kind === "opening_hours") {
    const match = normOpeningHours(left) === normOpeningHours(right);
    return { match, normalisation: match ? "opening hours formatting normalised" : null };
  }
  const match = left.toLowerCase() === right.toLowerCase();
  return { match, normalisation: match ? "exact text match" : null };
}

export function isGarbageWebsiteValue(value: string | null): boolean {
  if (!value) return false;
  return value.includes("wptestimonial") || value.includes(".css") || value.length > 180;
}

export function classifyEvidence(
  fieldId: string,
  websiteValue: string | null,
  googleValue: string | null,
  canonicalValue: string | null,
  meta: FieldMeta,
): { classification: ConflictClassification; normalisationApplied: string | null } {
  const website =
    fieldId === "openingHoursSummary"
      ? websiteValue && /wptestimonial|\.css/i.test(websiteValue)
        ? null
        : websiteValue
      : isGarbageWebsiteValue(websiteValue)
        ? null
        : websiteValue;
  const hasW = Boolean(website);
  const hasG = Boolean(googleValue);
  const hasC = Boolean(canonicalValue);

  if (meta.humanConfirmationOnly) {
    if (hasW || hasG) {
      if (hasW && hasG) {
        const { match, normalisation } = valuesMateriallyMatch(website, googleValue, meta.matchKind);
        if (match) return { classification: "CONFIRMATION_REQUIRED", normalisationApplied: normalisation };
        return { classification: "CONFIRMATION_REQUIRED", normalisationApplied: null };
      }
      return { classification: "CONFIRMATION_REQUIRED", normalisationApplied: null };
    }
    if (hasC) return { classification: "CONFIRMATION_REQUIRED", normalisationApplied: null };
    return { classification: "MISSING", normalisationApplied: null };
  }

  if (fieldId === "businessName" && hasW && hasG) {
    const { match, normalisation } = valuesMateriallyMatch(website, googleValue, "business_name");
    if (match) return { classification: "MATCH", normalisationApplied: normalisation };
  }

  if (fieldId === "website" && hasC && hasG) {
    const branch = normUrl(canonicalValue);
    const google = normUrl(googleValue);
    const branchDepth = branch.split("/").filter(Boolean).length;
    const googleDepth = google.split("/").filter(Boolean).length;
    if (branchDepth > googleDepth || (branch !== google && branch.includes("/"))) {
      return { classification: "MATCH", normalisationApplied: "canonical branch URL preferred over group hub" };
    }
  }

  if (fieldId === "googlePlaceId" && hasG && hasC && normText(googleValue) === normText(canonicalValue)) {
    return { classification: "MATCH", normalisationApplied: "Place ID matches confirmed identity" };
  }

  if (hasW && hasG) {
    const { match, normalisation } = valuesMateriallyMatch(website, googleValue, meta.matchKind);
    if (match) return { classification: "MATCH", normalisationApplied: normalisation };
    if (fieldId === "telephone" || fieldId === "address" || fieldId === "openingHoursSummary") {
      return { classification: "CONFLICT", normalisationApplied: null };
    }
    if (meta.humanConfirmationOnly) return { classification: "CONFIRMATION_REQUIRED", normalisationApplied: null };
    return { classification: "CONFLICT", normalisationApplied: null };
  }

  if (!hasW && !hasG && !hasC) return { classification: "MISSING", normalisationApplied: null };
  if (hasW && !hasG) {
    return {
      classification: meta.humanConfirmationOnly ? "CONFIRMATION_REQUIRED" : "WEBSITE_ONLY",
      normalisationApplied: null,
    };
  }
  if (!hasW && hasG) {
    return {
      classification: meta.humanConfirmationOnly ? "CONFIRMATION_REQUIRED" : "GOOGLE_ONLY",
      normalisationApplied: null,
    };
  }
  if (hasC && hasG && valuesMateriallyMatch(canonicalValue, googleValue, meta.matchKind).match) {
    return { classification: "MATCH", normalisationApplied: "canonical matches Google" };
  }
  return { classification: "MATCH", normalisationApplied: null };
}

export function isSafeToAutoAccept(
  fieldId: string,
  classification: ConflictClassification,
  meta: FieldMeta,
  hasOperatorDecision: boolean,
): boolean {
  if (hasOperatorDecision) return false;
  if (meta.humanConfirmationOnly) return false;
  if (classification === "MATCH") return true;
  if (meta.lowRiskAutoAccept && (classification === "WEBSITE_ONLY" || classification === "GOOGLE_ONLY")) return true;
  if (
    classification === "GOOGLE_ONLY" &&
    ["postcode", "googlePlaceId", "googleMapsUrl", "primaryCategory", "email", "address"].includes(fieldId)
  ) {
    return fieldId !== "address" || true;
  }
  if (classification === "WEBSITE_ONLY" && meta.lowRiskAutoAccept) return true;
  if (fieldId.startsWith("openingHours_") && classification === "GOOGLE_ONLY") return true;
  if (fieldId === "website" && classification === "GOOGLE_ONLY") return false;
  return false;
}

export function isGarbagePhoneValue(value: string | null): boolean {
  if (!value) return false;
  const digits = normPhone(value);
  return digits.length < 10 || digits.length > 13 || /^0{6,}/.test(digits);
}

export function pickTrustedValue(
  fieldId: string,
  websiteValue: string | null,
  googleValue: string | null,
  canonicalValue: string | null,
  recommendedValue: string | null,
): string | null {
  const website = isGarbageWebsiteValue(websiteValue) ? null : websiteValue;
  const google = googleValue || null;
  if (fieldId === "telephone") {
    const wGarbage = isGarbagePhoneValue(website);
    if (google && (wGarbage || !website)) return google;
    if (website && google) {
      if (normPhone(website) === normPhone(google)) return google;
      return google;
    }
  }
  if (IMPORT_PROVEN_FIELD_IDS.has(fieldId)) {
    if (website && google && valuesMateriallyMatch(website, google, FIELD_META[fieldId]?.matchKind || "text").match) {
      return google || website;
    }
    if (google && ["telephone", "address", "postcode", "primaryCategory", "googlePlaceId", "googleMapsUrl"].includes(fieldId)) {
      return google;
    }
    if (website && !google) return website;
    if (google && !website) return google;
  }
  return recommendedValue || canonicalValue || google || website || null;
}

export function resolveReviewTier(input: {
  fieldId: string;
  classification: ConflictClassification;
  meta: FieldMeta;
  autoResolved: boolean;
  websiteValue: string | null;
  googleValue: string | null;
  canonicalValue: string | null;
  decision: { action: string; finalValue?: string } | null;
  blocking: boolean;
  googleProfileState?: GoogleProfileOnboardingState;
}): { tier: ReviewFieldTier; requiresAction: boolean; autoResolved: boolean } {
  const { fieldId, classification, meta, websiteValue, googleValue, canonicalValue, decision, blocking, googleProfileState } = input;
  if (
    googleProfileState &&
    GOOGLE_IDENTITY_REVIEW_FIELD_IDS.has(fieldId) &&
    !isGoogleIdentityFieldRequiredForBusinessProfile(fieldId, googleProfileState)
  ) {
    return { tier: "verified", requiresAction: false, autoResolved: true };
  }
  const isBusinessDecision = BUSINESS_DECISION_FIELD_IDS.has(fieldId);
  const hasDecision = Boolean(decision && ["confirm", "reject", "manual", "use_website", "use_google", "auto_accept"].includes(decision.action));
  const hasValue = Boolean(normText(decision?.finalValue) || pickTrustedValue(fieldId, websiteValue, googleValue, canonicalValue, null));

  if (isBusinessDecision) {
    if (fieldId === "gphcNumber" && !hasValue && !googleValue && !websiteValue && !canonicalValue) {
      return { tier: "verified", requiresAction: false, autoResolved: true };
    }
    if (!blocking && !hasValue && !googleValue && !websiteValue && !canonicalValue) {
      return { tier: "verified", requiresAction: false, autoResolved: true };
    }
    if (classification === "MISSING" || (!hasValue && !googleValue && !websiteValue && !canonicalValue)) {
      return { tier: "missing", requiresAction: !hasDecision, autoResolved: false };
    }
    if (!hasDecision) {
      return { tier: "needs_confirmation", requiresAction: true, autoResolved: false };
    }
    return { tier: "verified", requiresAction: false, autoResolved: true };
  }

  if (fieldId.startsWith("openingHours_")) {
    return { tier: "verified", requiresAction: false, autoResolved: true };
  }

  if (fieldId === "openingHoursSummary") {
    const hoursDecision = Boolean(
      decision &&
        ["confirm", "use_website", "use_google", "manual", "auto_accept"].includes(decision.action) &&
        (normText(decision.finalValue) || googleValue || websiteValue),
    );
    if (hoursDecision) return { tier: "verified", requiresAction: false, autoResolved: true };
    if (!googleValue && !websiteValue && !canonicalValue) {
      return { tier: "missing", requiresAction: true, autoResolved: false };
    }
    return { tier: "needs_confirmation", requiresAction: true, autoResolved: false };
  }

  if (classification === "MATCH" || input.autoResolved || IMPORT_PROVEN_FIELD_IDS.has(fieldId)) {
    const trusted = pickTrustedValue(fieldId, websiteValue, googleValue, canonicalValue, null);
    if (trusted || classification === "MATCH" || input.autoResolved) {
      return { tier: "verified", requiresAction: false, autoResolved: true };
    }
  }

  if (classification === "CONFLICT" && IMPORT_PROVEN_FIELD_IDS.has(fieldId)) {
    const trusted = pickTrustedValue(fieldId, websiteValue, googleValue, canonicalValue, null);
    if (trusted) return { tier: "verified", requiresAction: false, autoResolved: true };
  }

  if (classification === "WEBSITE_ONLY" || classification === "GOOGLE_ONLY") {
    if (isSafeToAutoAccept(fieldId, classification, meta, hasDecision)) {
      return { tier: "verified", requiresAction: false, autoResolved: true };
    }
    return { tier: "recommended", requiresAction: false, autoResolved: false };
  }

  if (classification === "MISSING") {
    return { tier: blocking ? "missing" : "verified", requiresAction: blocking && !hasDecision, autoResolved: !blocking };
  }

  return { tier: "verified", requiresAction: false, autoResolved: true };
}

export function tierDisplayStatus(tier: ReviewFieldTier): string {
  if (tier === "verified") return "Verified";
  if (tier === "recommended") return "Recommended";
  if (tier === "needs_confirmation") return "Needs Confirmation";
  return "Missing Information";
}

export function buildDisplayStatus(
  classification: ConflictClassification,
  requiresAction: boolean,
  autoResolved: boolean,
  fieldId?: string,
  tier?: ReviewFieldTier,
): string {
  if (tier) return tierDisplayStatus(tier);
  if (autoResolved && !requiresAction) return "Verified";
  if (!requiresAction) return "Verified";
  if (classification === "CONFIRMATION_REQUIRED") return "Needs Confirmation";
  if (classification === "MISSING") return "Missing Information";
  if (classification === "WEBSITE_ONLY" || classification === "GOOGLE_ONLY") return "Recommended";
  if (classification === "CONFLICT") return "Needs Review";
  return "Needs Confirmation";
}

export function buildCommercialActionLabel(field: {
  id: string;
  label: string;
  classification: ConflictClassification;
  approvalBlockReason: string | null;
}): string {
  if (field.approvalBlockReason) return field.approvalBlockReason.replace(/\.$/, "");
  if (field.classification === "CONFLICT") {
    if (field.id === "telephone") return "Confirm branch telephone";
    return `Review ${field.label.toLowerCase()} — sources disagree`;
  }
  if (field.classification === "MISSING") return `Enter ${field.label.toLowerCase()}`;
  return `Confirm ${field.label.toLowerCase()}`;
}

export function fieldApprovalBlockReason(field: {
  label: string;
  blocking: boolean;
  requiresAction: boolean;
  id: string;
  classification: ConflictClassification;
}): string | null {
  if (!field.blocking || !field.requiresAction) return null;
  if (field.id === "openingHoursSummary") {
    if (field.classification === "MISSING") return "Enter opening hours (full week).";
    if (field.classification === "CONFLICT") return "Review opening hours — sources disagree.";
    return "Confirm hours.";
  }
  if (!BUSINESS_DECISION_FIELD_IDS.has(field.id)) return null;
  if (field.id === "pharmacyFirstAvailability") return "Confirm Pharmacy First availability.";
  if (field.id === "consultationRoom") return "Confirm consultation room availability.";
  if (field.id === "gphcNumber") return "Confirm the GPhC premises number.";
  if (field.id === "telephone") return "Confirm the branch telephone.";
  if (field.id === "address" || field.id === "postcode") return `Confirm the branch ${field.label.toLowerCase()}.`;
  if (field.id.startsWith("openingHours_")) return `Resolve ${field.label} opening hours.`;
  if (field.id === "openingHoursSummary") return "Confirm opening hours.";
  if (field.id === "primaryCtaDestination") return "Confirm the primary CTA destination.";
  if (field.id === "appointmentMethod") return "Confirm appointment or walk-in method.";
  if (field.id === "businessName") return "Confirm the branch business display name.";
  if (field.classification === "MISSING") return `Enter ${field.label.toLowerCase()}.`;
  return `Resolve ${field.label.toLowerCase()}.`;
}
