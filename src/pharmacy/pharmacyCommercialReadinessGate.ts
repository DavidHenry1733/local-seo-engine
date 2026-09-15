/**
 * Commercial readiness gate.
 * Technical generation readiness answers "can the generator run?"
 * Commercial publishing readiness answers "is the pharmacy trust profile safe to publish?"
 */
import type { ContentEngineContractValidation } from "./contentEngine/contentEngineContract.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";

export interface CommercialReadinessField {
  id: keyof PharmacyProfileData | "reviewDate";
  label: string;
  value: string;
  required: boolean;
  status: "present" | "missing";
}

export interface CommercialPublishingReadiness {
  status: "READY" | "NOT READY";
  score: number;
  optionalEnrichmentScore: number;
  missingManualFields: string[];
  optionalMissingFields: string[];
  fields: CommercialReadinessField[];
  optionalFields: CommercialReadinessField[];
  publishingBlocked: boolean;
  neutralReviewState: string;
  namedProfessionalReviewAllowed: boolean;
}

export interface TechnicalGenerationReadiness {
  status: "PASS" | "FAIL";
  score: number;
  missingFields: string[];
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function field(
  id: CommercialReadinessField["id"],
  label: string,
  value: unknown,
  required = true,
): CommercialReadinessField {
  const resolved = text(value);
  return {
    id,
    label,
    value: resolved,
    required,
    status: resolved ? "present" : "missing",
  };
}

export const NEUTRAL_PHARMACY_TEAM_REVIEW_STATE =
  "Content prepared for review and approval by the pharmacy team before publishing.";

export function computeTechnicalGenerationReadiness(
  validation: ContentEngineContractValidation,
  hasDemoLeakage: boolean,
): TechnicalGenerationReadiness {
  const missingFields = [...validation.missingRequired];
  if (hasDemoLeakage) missingFields.push("demo leakage");
  return {
    status: validation.ok && !hasDemoLeakage ? "PASS" : "FAIL",
    score: validation.ok && !hasDemoLeakage ? 100 : 0,
    missingFields,
  };
}

export function computeCommercialPublishingReadiness(
  profile: PharmacyProfileData,
): CommercialPublishingReadiness {
  const fields = [
    field("pharmacyName", "Pharmacy name", profile.pharmacyName),
    field("addressLine1", "Address", profile.addressLine1),
    field("townCity", "Town", profile.townCity || profile.primaryTown),
    field("postcode", "Postcode", profile.postcode),
    field("phone", "Phone", profile.phone),
    field("website", "Website", profile.website),
    field("gphcNumber", "GPhC premises number", profile.gphcNumber),
  ];
  const optionalFields = [
    field("nhsProfileUrl", "NHS profile URL", profile.nhsProfileUrl, false),
    field("superintendentPharmacistName", "Superintendent Pharmacist name", profile.superintendentPharmacistName, false),
    field("reviewerName", "Reviewer name", profile.reviewerName, false),
    field("reviewerRole", "Reviewer role", profile.reviewerRole, false),
    field("reviewerQualifications", "Reviewer qualifications", profile.reviewerQualifications, false),
    field("reviewerGphcNumber", "Reviewer GPhC number", profile.reviewerGphcNumber, false),
    field("reviewDate", "Review date", profile.clinicalReviewDate, false),
    field("nextReviewDate", "Next Review Date", profile.nextReviewDate, false),
    field("awards", "Awards", profile.awards, false),
    field("accreditations", "Accreditations", profile.accreditations, false),
    field("reviewHighlights", "Review highlights", profile.reviewHighlights, false),
    field("testimonials", "Review quotes", profile.testimonials, false),
    field("numberOfPatients", "Number of patients served", profile.numberOfPatients, false),
  ];
  const required = fields.filter((item) => item.required);
  const missingManualFields = required.filter((item) => item.status === "missing").map((item) => item.label);
  const optionalMissingFields = optionalFields.filter((item) => item.status === "missing").map((item) => item.label);
  const complete = required.length - missingManualFields.length;
  const score = required.length ? Math.round((complete / required.length) * 100) : 100;
  const optionalComplete = optionalFields.length - optionalMissingFields.length;
  const optionalEnrichmentScore = optionalFields.length ? Math.round((optionalComplete / optionalFields.length) * 100) : 100;
  const namedProfessionalReviewAllowed = professionalReviewClaimsAllowed(profile);

  return {
    status: missingManualFields.length ? "NOT READY" : "READY",
    score,
    optionalEnrichmentScore,
    missingManualFields,
    optionalMissingFields,
    fields,
    optionalFields,
    publishingBlocked: missingManualFields.length > 0,
    neutralReviewState: namedProfessionalReviewAllowed ? "" : NEUTRAL_PHARMACY_TEAM_REVIEW_STATE,
    namedProfessionalReviewAllowed,
  };
}

export function professionalReviewClaimsAllowed(profile: PharmacyProfileData): boolean {
  return Boolean(
    text(profile.reviewerName) &&
      text(profile.reviewerRole) &&
      text(profile.reviewerQualifications) &&
      text(profile.reviewerGphcNumber) &&
      text(profile.clinicalReviewDate),
  );
}
