/**
 * Shared Business Profile Review field applicability.
 * Resolves REQUIRED / OPTIONAL / NOT APPLICABLE from canonical business context.
 * Does not hardcode tenant slugs.
 */
import type { BusinessProfileReviewField } from "./masterAdminBusinessProfileReviewModel.ts";

export type BprFieldApplicability = "required" | "optional" | "not_applicable";

export interface BprApplicabilityContext {
  clinicalCatalogueEligible: boolean;
  businessClassificationClass?: string | null;
  clinicalServiceDetectionEnabled?: boolean;
  marketScope?: string | null;
}

/** Clinical / dispensing access fields — required only when clinical catalogue applies. */
const CLINICAL_ACCESS_FIELD_IDS = new Set([
  "pharmacyFirstAvailability",
  "consultationRoom",
  "appointmentMethod",
]);

/**
 * Opening hours: required for clinical/community pharmacy tenants (patient access).
 * Optional for non-clinical commercial tenants — useful contact evidence but not an intrinsic
 * Growth Engine approval gate (wizard completeness already treats hours as non-blocking).
 * NATIONAL marketScope alone does not remove hours — classification/clinical eligibility does.
 */
function isOpeningHoursField(fieldId: string): boolean {
  return fieldId === "openingHoursSummary" || fieldId.startsWith("openingHours_");
}

/** Conversion destination — required for site-bearing tenants regardless of clinical class. */
const ALWAYS_REQUIRED_WHEN_PRESENT_IN_SPECS = new Set(["primaryCtaDestination"]);

/**
 * Returns an applicability override, or null when FIELD_SPECS / enrich semantics should stand.
 */
export function resolveBprFieldApplicability(
  fieldId: string,
  ctx: BprApplicabilityContext,
): BprFieldApplicability | null {
  const clinical = ctx.clinicalCatalogueEligible === true;

  if (CLINICAL_ACCESS_FIELD_IDS.has(fieldId)) {
    return clinical ? "required" : "not_applicable";
  }

  if (isOpeningHoursField(fieldId)) {
    return clinical ? "required" : "optional";
  }

  if (ALWAYS_REQUIRED_WHEN_PRESENT_IN_SPECS.has(fieldId)) {
    return "required";
  }

  return null;
}

export function applyBprFieldApplicability(
  field: BusinessProfileReviewField,
  applicability: BprFieldApplicability,
  reason: string,
): BusinessProfileReviewField {
  field.applicability = applicability;

  if (applicability === "not_applicable") {
    field.blocking = false;
    field.regulatory = false;
    field.requiresAction = false;
    field.requiresHumanConfirmation = false;
    field.autoResolved = true;
    field.reviewTier = "verified";
    field.displayStatus = "Not applicable";
    // Review presentation only — do not treat inherited clinical defaults as confirmed answers.
    field.finalValue = "Not applicable";
    field.approvalBlockReason = null;
    field.commercialActionLabel = null;
    field.recommendedValue = "Not applicable";
    field.evidenceSource = reason || field.evidenceSource;
    return field;
  }

  if (applicability === "optional") {
    field.blocking = false;
    field.requiresAction = false;
    field.requiresHumanConfirmation = false;
    field.approvalBlockReason = null;
    field.commercialActionLabel = null;
    if (field.reviewTier === "missing" || field.reviewTier === "needs_confirmation") {
      field.reviewTier = "recommended";
      field.displayStatus = "Optional";
      field.autoResolved = false;
    }
    if (!/optional/i.test(field.evidenceSource || "")) {
      field.evidenceSource = reason || field.evidenceSource;
    }
    return field;
  }

  // required — keep enrichReviewField outcome
  return field;
}

export function bprApplicabilityReason(
  fieldId: string,
  applicability: BprFieldApplicability,
  ctx: BprApplicabilityContext,
): string {
  const cls = ctx.businessClassificationClass || "unknown";
  if (applicability === "not_applicable") {
    if (fieldId === "consultationRoom") {
      return `Not applicable — consultation room is a clinical/pharmacy access claim; business classification (${cls}) is non-clinical.`;
    }
    if (fieldId === "appointmentMethod") {
      return `Not applicable — appointment/walk-in fulfilment is a pharmacy access model; business classification (${cls}) is non-clinical.`;
    }
    if (fieldId === "pharmacyFirstAvailability") {
      return `Not applicable — Pharmacy First is incompatible with non-clinical business classification (${cls}).`;
    }
    return `Not applicable for business classification (${cls}).`;
  }
  if (applicability === "optional" && isOpeningHoursField(fieldId)) {
    return `Optional for non-clinical commercial tenants — opening hours are useful contact evidence but not required for Growth Engine approval (${cls}).`;
  }
  if (fieldId === "primaryCtaDestination") {
    return "Required — trusted conversion destination for campaigns and generated content.";
  }
  return fieldId;
}
