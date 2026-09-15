/**
 * Business Profile field audit — Sprint 1 BI Optimisation V1.
 * Internal classification reference for wizard import and typing reduction.
 */
export type ProfileFieldInputType =
  | "imported-automatically"
  | "website-import"
  | "google-places"
  | "google-business-profile"
  | "search-console"
  | "checkbox"
  | "dropdown"
  | "toggle"
  | "multi-select"
  | "advanced"
  | "manual"
  | "remove";

export interface ProfileFieldAuditEntry {
  fieldKey: string;
  label: string;
  inputType: ProfileFieldInputType;
  wizardStep: number | null;
  tier: "required" | "optional" | "advanced" | "deprecated";
  notes?: string;
}

/** Master audit — governs import expansion and typing reduction priorities. */
export const PROFILE_FIELD_AUDIT: ProfileFieldAuditEntry[] = [
  { fieldKey: "pharmacyName", label: "Business name", inputType: "website-import", wizardStep: 1, tier: "required" },
  { fieldKey: "tradingName", label: "Trading name", inputType: "website-import", wizardStep: 1, tier: "optional" },
  { fieldKey: "website", label: "Website", inputType: "website-import", wizardStep: 1, tier: "required" },
  { fieldKey: "phone", label: "Phone", inputType: "website-import", wizardStep: 1, tier: "required" },
  { fieldKey: "businessEmail", label: "Email", inputType: "website-import", wizardStep: 1, tier: "optional" },
  { fieldKey: "addressLine1", label: "Address", inputType: "website-import", wizardStep: 1, tier: "required" },
  { fieldKey: "townCity", label: "Town / city", inputType: "website-import", wizardStep: 1, tier: "required" },
  { fieldKey: "primaryTown", label: "Primary town", inputType: "website-import", wizardStep: 5, tier: "required" },
  { fieldKey: "postcode", label: "Postcode", inputType: "website-import", wizardStep: 1, tier: "required" },
  { fieldKey: "county", label: "County", inputType: "website-import", wizardStep: 5, tier: "optional" },
  { fieldKey: "businessDescription", label: "About / description", inputType: "website-import", wizardStep: 1, tier: "optional", notes: "Meta / schema extraction" },
  { fieldKey: "logoUrl", label: "Logo", inputType: "website-import", wizardStep: 1, tier: "optional" },
  { fieldKey: "openingHours", label: "Opening hours", inputType: "website-import", wizardStep: 2, tier: "optional", notes: "Per-day schema.org extraction" },
  { fieldKey: "brandPrimaryColor", label: "Primary colour", inputType: "website-import", wizardStep: 3, tier: "optional" },
  { fieldKey: "brandSecondaryColor", label: "Secondary colour", inputType: "website-import", wizardStep: 3, tier: "optional" },
  { fieldKey: "fontHeading", label: "Heading font", inputType: "website-import", wizardStep: 3, tier: "optional" },
  { fieldKey: "fontBody", label: "Body font", inputType: "website-import", wizardStep: 3, tier: "optional" },
  { fieldKey: "headerNavLinks", label: "Header navigation", inputType: "website-import", wizardStep: 3, tier: "advanced" },
  { fieldKey: "footerLinks", label: "Footer links", inputType: "website-import", wizardStep: 3, tier: "optional" },
  { fieldKey: "socialFacebook", label: "Facebook", inputType: "website-import", wizardStep: 2, tier: "optional" },
  { fieldKey: "socialInstagram", label: "Instagram", inputType: "website-import", wizardStep: 2, tier: "optional" },
  { fieldKey: "detectedWebsiteServices", label: "Detected services", inputType: "website-import", wizardStep: 4, tier: "optional" },
  { fieldKey: "googlePlaceId", label: "Google Place ID", inputType: "google-places", wizardStep: 1, tier: "optional" },
  { fieldKey: "googleBusinessProfileUrl", label: "Google Business Profile URL", inputType: "google-business-profile", wizardStep: 1, tier: "optional" },
  { fieldKey: "googleBusinessRating", label: "Google rating", inputType: "google-places", wizardStep: 1, tier: "optional" },
  { fieldKey: "selectedServices", label: "Enabled services", inputType: "checkbox", wizardStep: 4, tier: "optional" },
  { fieldKey: "targetPatientGroups", label: "Patient groups", inputType: "checkbox", wizardStep: 6, tier: "optional" },
  { fieldKey: "accreditations", label: "Accreditations", inputType: "checkbox", wizardStep: 7, tier: "optional" },
  { fieldKey: "nhsServicesAvailable", label: "NHS pharmacy", inputType: "toggle", wizardStep: 7, tier: "optional" },
  { fieldKey: "consultationRoomAvailable", label: "Consultation room", inputType: "toggle", wizardStep: 7, tier: "optional" },
  { fieldKey: "bookingMethod", label: "Booking method", inputType: "dropdown", wizardStep: 8, tier: "optional" },
  { fieldKey: "tone", label: "Content tone", inputType: "dropdown", wizardStep: 8, tier: "optional" },
  { fieldKey: "selectedAreas", label: "Target areas", inputType: "multi-select", wizardStep: 5, tier: "required" },
  { fieldKey: "gpSurgeries", label: "GP surgeries", inputType: "google-places", wizardStep: 5, tier: "optional" },
  { fieldKey: "healthCentres", label: "Health centres", inputType: "google-places", wizardStep: 5, tier: "optional" },
  { fieldKey: "hospitals", label: "Hospitals", inputType: "google-places", wizardStep: 5, tier: "optional" },
  { fieldKey: "landmarks", label: "Landmarks", inputType: "google-places", wizardStep: 5, tier: "optional" },
  { fieldKey: "profileCompetitors", label: "Local competitors", inputType: "google-places", wizardStep: 5, tier: "optional" },
  { fieldKey: "reviewerName", label: "Reviewer name", inputType: "manual", wizardStep: 7, tier: "required" },
  { fieldKey: "clinicalReviewDate", label: "Clinical review date", inputType: "manual", wizardStep: 7, tier: "required" },
  { fieldKey: "nextReviewDate", label: "Next review date", inputType: "manual", wizardStep: 7, tier: "optional" },
  { fieldKey: "email", label: "Email (legacy)", inputType: "remove", wizardStep: null, tier: "deprecated", notes: "Use businessEmail" },
];

export function auditEntriesByInputType(type: ProfileFieldInputType): ProfileFieldAuditEntry[] {
  return PROFILE_FIELD_AUDIT.filter((e) => e.inputType === type);
}

export function websiteImportFieldKeys(): string[] {
  return PROFILE_FIELD_AUDIT.filter((e) => e.inputType === "website-import").map((e) => e.fieldKey);
}
