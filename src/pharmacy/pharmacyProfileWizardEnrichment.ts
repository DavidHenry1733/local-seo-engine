/**
 * Business Profile Wizard V2 — import status, local/competitor enrichment helpers.
 * Sprint 1 BI Optimisation V1 — per-field provenance and smart confirmation.
 */
import type { PharmacyProfileData, ProfileWizardCompetitor } from "./pharmacyProfileSchema.ts";
import type { DiscoveredCompetitor } from "./pharmacyCompetitorDiscovery.ts";
import type { ProfileLocalEntity } from "./pharmacyProfileLocalIntelligenceSelection.ts";
import { hasOpeningHours, OPENING_HOUR_DAYS } from "./pharmacyProfileHours.ts";

export type WizardFieldStatus = "imported" | "confirmed" | "missing" | "manual" | "review";

export interface WizardImportField {
  id: string;
  label: string;
  status: WizardFieldStatus;
  value: string;
  fieldKey: string;
  inputType: "text" | "url" | "tel" | "email" | "textarea";
  source: "website" | "google" | "manual" | "none";
}

export interface ImportBrandSummary {
  logoUrl: string;
  primaryColor: string;
  servicesDetected: number;
  navLinks: number;
  footerLinks: number;
  socialCount: number;
}

export interface LocalIntelPreview {
  googlePlaceFound: boolean;
  googlePlaceLabel: string;
  competitorCount: number;
  gpCount: number;
  healthCentreCount: number;
  hospitalCount: number;
  landmarkCount: number;
  enrichedAt: string;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function importedKeys(data: PharmacyProfileData): Set<string> {
  return new Set(data.websiteImportedFieldKeys || []);
}

function confirmedKeys(data: PharmacyProfileData): Set<string> {
  return new Set(Object.keys(data.profileFieldConfirmations || {}));
}

function resolveFieldStatus(fieldKey: string, value: string, data: PharmacyProfileData): WizardFieldStatus {
  if (!value) return "missing";
  if (confirmedKeys(data).has(fieldKey)) return "confirmed";
  if (importedKeys(data).has(fieldKey)) return "review";
  if (importedKeys(data).size === 0 && data.websiteAnalysisAt && value) return "imported";
  if (value) return "manual";
  return "missing";
}

function resolveSource(fieldKey: string, data: PharmacyProfileData): WizardImportField["source"] {
  if (importedKeys(data).has(fieldKey) || (data.websiteAnalysisAt && ["pharmacyName", "phone", "logoUrl"].includes(fieldKey))) {
    return "website";
  }
  if (["googlePlaceId", "googleBusinessProfileUrl", "googleBusinessRating"].includes(fieldKey)) return "google";
  return "none";
}

function openingHoursDisplay(data: PharmacyProfileData): string {
  if (hasOpeningHours(data)) {
    const days = OPENING_HOUR_DAYS.filter(({ key }) => str((data as Record<string, unknown>)[key])).length;
    return days ? `${days} days set` : "Set";
  }
  return "";
}

/** Build import/confirm/missing cards for step 1 & 2. */
export function buildWizardImportFields(data: PharmacyProfileData): WizardImportField[] {
  const fields: Array<Omit<WizardImportField, "status" | "source"> & { value: string }> = [
    { id: "pharmacyName", label: "Business name", fieldKey: "pharmacyName", value: str(data.pharmacyName), inputType: "text" },
    { id: "website", label: "Website", fieldKey: "website", value: str(data.website), inputType: "url" },
    { id: "phone", label: "Phone", fieldKey: "phone", value: str(data.phone), inputType: "tel" },
    { id: "businessEmail", label: "Email", fieldKey: "businessEmail", value: str(data.businessEmail), inputType: "email" },
    { id: "addressLine1", label: "Address", fieldKey: "addressLine1", value: str(data.addressLine1), inputType: "text" },
    { id: "townCity", label: "Town / city", fieldKey: "townCity", value: str(data.townCity || data.primaryTown), inputType: "text" },
    { id: "postcode", label: "Postcode", fieldKey: "postcode", value: str(data.postcode), inputType: "text" },
    { id: "businessDescription", label: "About / description", fieldKey: "businessDescription", value: str(data.businessDescription), inputType: "textarea" },
    { id: "logoUrl", label: "Logo", fieldKey: "logoUrl", value: str(data.logoUrl), inputType: "url" },
    { id: "openingHours", label: "Opening hours", fieldKey: "openingHours", value: openingHoursDisplay(data), inputType: "text" },
  ];

  return fields.map((f) => ({
    ...f,
    status: resolveFieldStatus(f.fieldKey, f.value, data),
    source: resolveSource(f.fieldKey, data),
  }));
}

export function buildImportBrandSummary(data: PharmacyProfileData): ImportBrandSummary {
  const social = [data.socialFacebook, data.socialInstagram, data.socialLinkedIn, data.socialX, data.socialYouTube].filter(Boolean);
  return {
    logoUrl: str(data.logoUrl),
    primaryColor: str(data.brandPrimaryColor),
    servicesDetected: (data.detectedWebsiteServices || []).length,
    navLinks: (data.headerNavLinks || []).length,
    footerLinks: (data.footerLinks || []).length,
    socialCount: social.length,
  };
}

export function buildLocalIntelPreview(data: PharmacyProfileData): LocalIntelPreview {
  const countSelected = (entities: ProfileLocalEntity[] | undefined) =>
    (entities || []).filter((e) => e.selected !== false).length;

  return {
    googlePlaceFound: Boolean(data.googlePlaceId),
    googlePlaceLabel: data.googlePlaceId ? str(data.pharmacyName) || "Google listing linked" : "Not linked yet",
    competitorCount: (data.profileCompetitors || []).filter((c) => c.selected).length || (data.profileCompetitors || []).length,
    gpCount: countSelected(data.gpSurgeries),
    healthCentreCount: countSelected(data.healthCentres),
    hospitalCount: countSelected(data.hospitals),
    landmarkCount: countSelected(data.landmarks),
    enrichedAt: str(data.profileWizardEnrichedAt),
  };
}

export function mergeWebsiteImportedFieldKeys(existing: string[], applied: string[]): string[] {
  return [...new Set([...existing, ...applied])];
}

export function wizardFieldsNeedingInput(fields: WizardImportField[]): WizardImportField[] {
  return fields.filter((f) => f.status === "missing" || f.status === "review" || f.status === "imported");
}

export function mapDiscoveredCompetitorsToProfile(
  competitors: DiscoveredCompetitor[],
  existing: ProfileWizardCompetitor[] = [],
): ProfileWizardCompetitor[] {
  const existingByPlace = new Map(existing.filter((c) => c.placeId).map((c) => [c.placeId, c]));
  return competitors.map((c, i) => {
    const prev = c.placeId ? existingByPlace.get(c.placeId) : undefined;
    return {
      id: prev?.id || c.placeId || `competitor-${i + 1}`,
      name: c.name,
      address: c.address,
      locality: c.address.split(",").slice(-2)[0]?.trim() || "",
      rating: c.rating,
      reviewCount: c.reviewCount,
      website: c.website,
      phone: c.phone,
      placeId: c.placeId,
      distanceKm: c.distanceKm,
      distanceLabel: c.distanceLabel,
      selected: prev?.selected ?? true,
      notes: prev?.notes || "",
      source: c.source,
    };
  });
}

export function mergeLocalEntitySelections(
  data: PharmacyProfileData,
  selections: Record<string, string[]>,
): Partial<PharmacyProfileData> {
  const patch: Partial<PharmacyProfileData> = {};
  const groupMap: Record<string, keyof PharmacyProfileData> = {
    gpSurgeries: "gpSurgeries",
    hospitals: "hospitals",
    healthCentres: "healthCentres",
    landmarks: "landmarks",
    transportLinks: "transportLinks",
  };

  const candidates = data.localIntelligenceCandidates || {};
  for (const [group, ids] of Object.entries(selections)) {
    const key = groupMap[group];
    if (!key) continue;
    const pool = (candidates[group] as ProfileLocalEntity[] | undefined) || (data[key] as ProfileLocalEntity[]) || [];
    const selected = pool.map((e) => ({ ...e, selected: ids.includes(e.id) }));
    (patch as Record<string, unknown>)[key] = selected;
  }
  return patch;
}

export function countImportSummary(fields: WizardImportField[]): {
  imported: number;
  confirmed: number;
  missing: number;
  review: number;
} {
  return {
    imported: fields.filter((f) => f.status === "imported").length,
    confirmed: fields.filter((f) => f.status === "confirmed").length,
    missing: fields.filter((f) => f.status === "missing").length,
    review: fields.filter((f) => f.status === "review").length,
  };
}

export function countConfirmedImportFields(data: PharmacyProfileData): number {
  return Object.keys(data.profileFieldConfirmations || {}).length;
}

/** Imported fields with values become confirmed once saved — avoids stale Needs Review badges. */
export function applyAutoConfirmOnSave(data: PharmacyProfileData): PharmacyProfileData {
  const confirmations = { ...(data.profileFieldConfirmations || {}) };
  const now = new Date().toISOString();
  let changed = false;

  for (const field of buildWizardImportFields(data)) {
    if (!field.value || field.status === "missing") continue;
    if (confirmations[field.fieldKey]) continue;
    confirmations[field.fieldKey] = now;
    changed = true;
  }

  if (!changed) return data;
  return { ...data, profileFieldConfirmations: confirmations };
}
