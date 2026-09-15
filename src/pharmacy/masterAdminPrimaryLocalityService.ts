/**
 * Primary locality — single resolver for onboarding, profile, and local hierarchy.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { writeSetupProfile, readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";

export interface PrimaryLocalityMeta {
  value: string;
  source: string;
  confirmedByOperator: boolean;
  confirmedAt: string;
  confidence: number;
  postcodeRelationship: string;
}

export function readPrimaryLocalityMeta(data: PharmacyProfileData): PrimaryLocalityMeta | null {
  const raw = data.primaryLocalityMeta as PrimaryLocalityMeta | undefined;
  if (raw?.value) return raw;
  const value = String(data.primaryTown || data.townCity || "").trim();
  if (!value) return null;
  return {
    value,
    source: "profile.primaryTown",
    confirmedByOperator: Boolean(data.onboardingIntakeCompletedAt),
    confirmedAt: data.onboardingIntakeCompletedAt || "",
    confidence: 80,
    postcodeRelationship: data.postcode || "",
  };
}

export function resolvePrimaryLocalityValue(data: PharmacyProfileData): string {
  return resolveTenantLocality(data).value || "";
}

export type TenantLocalitySource =
  | "operator-confirmed-primary-locality"
  | "business-profile-town"
  | "onboarding-primary-town"
  | "address-locality"
  | "missing";

export interface TenantLocalityResolution {
  value: string | null;
  source: TenantLocalitySource;
  sourceField: string;
  confirmedByOperator: boolean;
  available: boolean;
  provenanceLabel: string;
}

/** Hard-coded agency/project fallbacks that must never enter tenant recommendations. */
export const FORBIDDEN_DEFAULT_LOCALITY_FALLBACKS = ["Rotherham"] as const;

export function resolveTenantLocality(data: PharmacyProfileData): TenantLocalityResolution {
  const meta = readPrimaryLocalityMeta(data);
  if (meta?.confirmedByOperator && meta.value) {
    return {
      value: meta.value,
      source: "operator-confirmed-primary-locality",
      sourceField: "primaryLocalityMeta.value",
      confirmedByOperator: true,
      available: true,
      provenanceLabel: `${meta.value} (operator-confirmed · ${meta.source})`,
    };
  }
  const profileTown = String(data.primaryTown || data.townCity || data.localHierarchyRoot || "").trim();
  if (profileTown) {
    const fromOnboarding = Boolean(meta?.value && meta.value === profileTown);
    return {
      value: profileTown,
      source: fromOnboarding ? "onboarding-primary-town" : "business-profile-town",
      sourceField: fromOnboarding ? "primaryTown/townCity" : "primaryTown/townCity/localHierarchyRoot",
      confirmedByOperator: Boolean(meta?.confirmedByOperator),
      available: true,
      provenanceLabel: `${profileTown} (${fromOnboarding ? "onboarding" : "business profile"})`,
    };
  }
  if (meta?.value) {
    return {
      value: meta.value,
      source: "onboarding-primary-town",
      sourceField: "primaryLocalityMeta.value",
      confirmedByOperator: Boolean(meta.confirmedByOperator),
      available: true,
      provenanceLabel: `${meta.value} (onboarding metadata)`,
    };
  }
  return {
    value: null,
    source: "missing",
    sourceField: "",
    confirmedByOperator: false,
    available: false,
    provenanceLabel: "Locality evidence unavailable",
  };
}

export function localityUnavailableLabel(): string {
  return "Locality evidence unavailable";
}

export function textContainsForeignLocality(text: string, tenantLocality: string): boolean {
  const lower = String(text || "").toLowerCase();
  const tenant = tenantLocality.toLowerCase();
  for (const fallback of FORBIDDEN_DEFAULT_LOCALITY_FALLBACKS) {
    const fb = fallback.toLowerCase();
    if (lower.includes(fb) && fb !== tenant) return true;
  }
  return false;
}

export function persistPrimaryLocality(
  slug: string,
  input: {
    townOrCity: string;
    postcode?: string;
    source?: string;
    confirmedByOperator?: boolean;
    confidence?: number;
  },
): PharmacyProfileData {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const town = String(input.townOrCity || "").trim();
  if (!town) throw new Error("Town or City is required");
  const now = new Date().toISOString();
  const meta: PrimaryLocalityMeta = {
    value: town,
    source: input.source || "operator-onboarding",
    confirmedByOperator: input.confirmedByOperator !== false,
    confirmedAt: now,
    confidence: input.confidence ?? 95,
    postcodeRelationship: String(input.postcode || data.postcode || "").trim(),
  };
  const next: PharmacyProfileData = {
    ...data,
    primaryTown: town,
    primaryCity: town,
    townCity: town,
    localHierarchyRoot: town,
    primaryLocalityMeta: meta,
  };
  writeSetupProfile(safe, next);
  return next;
}
