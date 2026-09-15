/**
 * Customer generation input completeness.
 * Separates fields we can safely auto-import from fields that need a real human
 * professional identity before they should appear in generated content.
 */
import type { PharmacyProfileData, ProfileAreaEntry } from "./pharmacyProfileSchema.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";

export type GenerationInputGroup =
  | "Business Identity"
  | "Brand"
  | "Google Import"
  | "Website Import"
  | "Local Market"
  | "Trust & Credentials"
  | "Professional Review"
  | "Images"
  | "Campaign Settings"
  | "Contact Details";

export type GenerationInputFieldStatus = "present" | "auto_imported" | "action_required" | "missing";

export interface GenerationInputFieldAudit {
  group: GenerationInputGroup;
  field: string;
  label: string;
  status: GenerationInputFieldStatus;
  source: "existing profile" | "google import" | "website import" | "local market" | "campaign settings" | "image assignments" | "manual input" | "none";
  value: string;
}

export interface GenerationInputGroupAudit {
  group: GenerationInputGroup;
  status: "AUTO IMPORTED" | "ACTION REQUIRED";
  fields: GenerationInputFieldAudit[];
  actionRequired: string[];
}

export interface AutoPopulationResult {
  data: PharmacyProfileData;
  autoPopulated: string[];
}

export interface CampaignBuilderLike {
  selectedServiceId?: string;
  assetSelection?: Record<string, boolean>;
}

export interface ImageAssignmentsLike {
  assignments?: Record<string, unknown>;
}

const MANUAL_FIELD_LABELS = new Map<string, string>([
  ["superintendentPharmacistName", "Superintendent Pharmacist"],
  ["reviewerName", "Reviewer Name"],
  ["reviewerQualifications", "Reviewer Qualifications"],
  ["reviewerGphcNumber", "GPhC Number"],
  ["gphcNumber", "GPhC Premises Number"],
  ["nhsProfileUrl", "NHS Profile URL"],
]);

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function has(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => str(item) && str(item) !== "[]");
  return Boolean(str(value));
}

function first(...values: unknown[]): string {
  for (const value of values) {
    const text = str(value);
    if (text) return text;
  }
  return "";
}

function snapshot(data: PharmacyProfileData, key: "googleImportSnapshot" | "websiteImportSnapshot"): Record<string, unknown> {
  const value = data[key] as unknown;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function cleanArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => str(v)).filter((v) => v && v !== "[]"))];
}

function parseGoogleAddress(address: string): { addressLine1: string; townCity: string; postcode: string } {
  const postcodeMatch = address.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i);
  const postcode = postcodeMatch ? postcodeMatch[0].toUpperCase().replace(/\s+/, " ") : "";
  const withoutCountry = address.replace(/,\s*UK\s*$/i, "").trim();
  const withoutPostcode = postcode ? withoutCountry.replace(postcodeMatch?.[0] || "", "").trim() : withoutCountry;
  const parts = withoutPostcode.split(",").map((p) => p.trim()).filter(Boolean);
  const townCity = parts.length > 1 ? parts[parts.length - 1] : "";
  const addressLine1 = parts.length > 1 ? parts.slice(0, -1).join(", ") : withoutPostcode;
  return { addressLine1, townCity, postcode };
}

function openingHoursLines(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => str(item)).filter(Boolean) : [];
}

function selectedArea(areaName: string): ProfileAreaEntry {
  return {
    areaName,
    areaType: "primary-town",
    priority: 1,
    order: 1,
    selected: true,
    source: "auto-imported-profile",
    confidence: 90,
  };
}

function setIfMissing(
  patch: Record<string, unknown>,
  data: PharmacyProfileData,
  key: keyof PharmacyProfileData,
  value: unknown,
  label: string,
  changed: string[],
): void {
  if (has(data[key])) return;
  if (!has(value)) return;
  patch[key as string] = value;
  changed.push(label);
}

export function autoPopulateGenerationProfileFields(
  data: PharmacyProfileData,
  campaign?: CampaignBuilderLike | null,
): AutoPopulationResult {
  const google = snapshot(data, "googleImportSnapshot");
  const website = snapshot(data, "websiteImportSnapshot");
  const patch: Record<string, unknown> = {};
  const changed: string[] = [];
  const addressParts = parseGoogleAddress(first(google.address));

  setIfMissing(patch, data, "phone", first(google.phone, website.phone), "Contact Details: phone", changed);
  setIfMissing(patch, data, "businessEmail", first(website.email), "Contact Details: business email", changed);
  setIfMissing(patch, data, "addressLine1", addressParts.addressLine1, "Contact Details: address line 1", changed);
  setIfMissing(patch, data, "townCity", first(data.townCity, google.town, website.town, addressParts.townCity), "Local Market: town/city", changed);
  setIfMissing(patch, data, "primaryTown", first(data.primaryTown, google.town, website.town, addressParts.townCity), "Local Market: primary town", changed);
  setIfMissing(patch, data, "postcode", first(google.postcode, website.postcode, addressParts.postcode), "Contact Details: postcode", changed);
  setIfMissing(patch, data, "latitude", first(google.latitude), "Google Import: latitude", changed);
  setIfMissing(patch, data, "longitude", first(google.longitude), "Google Import: longitude", changed);

  const openingHours = openingHoursLines(google.openingHours);
  if (!has(data.openingHours) && openingHours.length) {
    patch.openingHours = openingHours.join("; ");
    changed.push("Google Import: opening hours");
  }

  const detectedServices = (website.customerVisibleServices as Array<{ serviceId?: string }> | undefined) || [];
  const serviceIds = cleanArray([
    ...(data.selectedServices || []),
    campaign?.selectedServiceId,
    ...detectedServices.map((service) => service.serviceId),
  ]);
  if (!data.selectedServices?.length && serviceIds.length) {
    patch.selectedServices = serviceIds;
    changed.push("Campaign Settings: selected services");
  }

  const town = first(data.primaryTown, data.townCity, patch.primaryTown, patch.townCity, google.town, website.town);
  if (!data.selectedAreas?.some((area) => area.selected !== false) && town) {
    patch.selectedAreas = [selectedArea(town)];
    patch.rankingAreas = cleanArray([...(data.rankingAreas || []), town]);
    patch.coverageAreas = cleanArray([...(data.coverageAreas || []), town]);
    changed.push("Local Market: selected area");
  }

  if (!has(data.preferredCta) && (has(data.phone) || has(patch.phone))) {
    patch.preferredCta = "Call Pharmacy";
    patch.preferredCtaWording = "Call Pharmacy";
    changed.push("Campaign Settings: preferred CTA");
  }

  if (!has(data.headerCtaText) && (has(data.phone) || has(patch.phone))) {
    patch.headerCtaText = "Call Pharmacy";
    changed.push("Campaign Settings: header CTA text");
  }

  if (!has(data.headerCtaUrl)) {
    const phone = first(data.phone, patch.phone);
    const websiteUrl = first(data.website, website.websiteUrl);
    if (phone) {
      patch.headerCtaUrl = `tel:${phone.replace(/\D/g, "")}`;
      changed.push("Campaign Settings: header CTA URL");
    } else if (websiteUrl) {
      patch.headerCtaUrl = websiteUrl;
      changed.push("Campaign Settings: header CTA URL");
    }
  }

  patch.accreditations = cleanArray(data.accreditations);
  patch.targetPatientGroups = cleanArray(data.targetPatientGroups);

  return {
    data: normalizeProfileData({ ...data, ...patch }),
    autoPopulated: changed,
  };
}

function field(
  group: GenerationInputGroup,
  fieldName: string,
  label: string,
  value: unknown,
  source: GenerationInputFieldAudit["source"],
): GenerationInputFieldAudit {
  const present = has(value);
  const manual = MANUAL_FIELD_LABELS.has(fieldName);
  return {
    group,
    field: fieldName,
    label,
    status: present ? "present" : manual ? "action_required" : "missing",
    source: present ? source : manual ? "manual input" : "none",
    value: present ? (Array.isArray(value) ? cleanArray(value).join(", ") : str(value)) : "",
  };
}

export function auditGenerationInputFields(
  data: PharmacyProfileData,
  imageAssignments?: ImageAssignmentsLike | null,
): GenerationInputGroupAudit[] {
  const imageCount = Object.keys(imageAssignments?.assignments || {}).length;
  const fields: GenerationInputFieldAudit[] = [
    field("Business Identity", "pharmacyName", "Pharmacy name", data.pharmacyName, "existing profile"),
    field("Business Identity", "tradingName", "Trading name", data.tradingName, "existing profile"),
    field("Brand", "brandPrimaryColor", "Primary colour", data.brandPrimaryColor, "website import"),
    field("Brand", "brandCtaColor", "CTA colour", data.brandCtaColor, "website import"),
    field("Brand", "fontHeading", "Heading font", data.fontHeading, "existing profile"),
    field("Google Import", "googlePlaceId", "Google Place ID", data.googlePlaceId, "google import"),
    field("Google Import", "googleBusinessProfileUrl", "Google Business Profile URL", data.googleBusinessProfileUrl, "google import"),
    field("Google Import", "openingHours", "Opening hours", data.openingHours, "google import"),
    field("Website Import", "website", "Website", data.website, "website import"),
    field("Website Import", "detectedWebsiteServices", "Detected website services", data.detectedWebsiteServices?.map((s) => s.serviceName), "website import"),
    field("Local Market", "primaryTown", "Primary town", data.primaryTown || data.townCity, "local market"),
    field("Local Market", "selectedAreas", "Selected target areas", data.selectedAreas?.map((a) => a.areaName), "local market"),
    field("Trust & Credentials", "nhsServicesAvailable", "NHS services available", data.nhsServicesAvailable ? "yes" : "", "existing profile"),
    field("Trust & Credentials", "gphcNumber", "GPhC premises number", data.gphcNumber, "manual input"),
    field("Trust & Credentials", "nhsProfileUrl", "NHS profile URL", data.nhsProfileUrl, "manual input"),
    field("Professional Review", "superintendentPharmacistName", "Superintendent Pharmacist", data.superintendentPharmacistName, "manual input"),
    field("Professional Review", "reviewerName", "Reviewer Name", data.reviewerName, "manual input"),
    field("Professional Review", "reviewerQualifications", "Reviewer Qualifications", data.reviewerQualifications, "manual input"),
    field("Professional Review", "reviewerGphcNumber", "Reviewer GPhC Number", data.reviewerGphcNumber, "manual input"),
    field("Images", "imageAssignments", "Campaign image assignments", imageCount ? `${imageCount} assignments` : "", "image assignments"),
    field("Campaign Settings", "selectedServices", "Selected services", data.selectedServices, "campaign settings"),
    field("Campaign Settings", "preferredCta", "Preferred CTA", data.preferredCta || data.preferredCtaWording, "campaign settings"),
    field("Contact Details", "phone", "Phone", data.phone, "google import"),
    field("Contact Details", "businessEmail", "Email", data.businessEmail, "website import"),
    field("Contact Details", "addressLine1", "Address", data.addressLine1, "google import"),
    field("Contact Details", "postcode", "Postcode", data.postcode, "google import"),
  ];

  const groups = new Map<GenerationInputGroup, GenerationInputFieldAudit[]>();
  for (const item of fields) {
    groups.set(item.group, [...(groups.get(item.group) || []), item]);
  }

  return Array.from(groups.entries()).map(([group, groupFields]) => {
    const actionRequired = groupFields.filter((f) => f.status === "action_required").map((f) => f.label);
    const hasMissingAuto = groupFields.some((f) => f.status === "missing");
    return {
      group,
      status: actionRequired.length || hasMissingAuto ? "ACTION REQUIRED" : "AUTO IMPORTED",
      fields: groupFields,
      actionRequired,
    };
  });
}

export function generationInputCompletenessPercent(groups: GenerationInputGroupAudit[]): number {
  const fields = groups.flatMap((group) => group.fields);
  const autoResolvable = fields.filter((field) => field.status !== "action_required");
  const complete = autoResolvable.filter((field) => field.status === "present").length;
  return autoResolvable.length ? Math.round((complete / autoResolvable.length) * 100) : 100;
}
