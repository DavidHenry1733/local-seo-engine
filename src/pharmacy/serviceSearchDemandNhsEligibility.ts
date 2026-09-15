/**
 * NHS-prefixed demand query eligibility.
 * Requires explicit shared catalogue commissioning OR tenant service-delivery funding.
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import type { ProfileServiceFundingModel } from "./pharmacyProfileV2Fields.ts";

export const SHARED_CATALOGUE_NHS_FIELD = "nationallyCommissionedNhsCommunityPharmacyService" as const;

/** Shared catalogue — nationally commissioned NHS community-pharmacy services only. */
export const NATIONALLY_COMMISSIONED_NHS_COMMUNITY_PHARMACY_SERVICES: Readonly<
  Record<string, { commissioningLabel: string }>
> = {
  "pharmacy-first": { commissioningLabel: "NHS Pharmacy First" },
  "blood-pressure-checks": { commissioningLabel: "NHS Hypertension Case-Finding Service" },
  "discharge-medicines-service": { commissioningLabel: "NHS Discharge Medicines Service" },
  "flu-vaccinations": { commissioningLabel: "NHS seasonal flu vaccination (community pharmacy)" },
  "new-medicine-service": { commissioningLabel: "NHS New Medicine Service" },
  "prescription-dispensing": { commissioningLabel: "NHS prescription dispensing (core contract)" },
  "repeat-prescriptions": { commissioningLabel: "NHS repeat prescription / EPS (core contract)" },
  "smoking-cessation": { commissioningLabel: "NHS stop smoking support (community pharmacy)" },
};

export type NhsDemandQueryEligibilitySource =
  | {
      kind: "shared-catalogue";
      field: typeof SHARED_CATALOGUE_NHS_FIELD;
      serviceId: string;
      commissioningLabel: string;
    }
  | {
      kind: "tenant-service-delivery";
      field: "serviceDeliveryProfiles[serviceId].fundingModel";
      serviceId: string;
      slug: string;
      fundingModel: Extract<ProfileServiceFundingModel, "nhs" | "mixed">;
    };

export type NhsDemandQueryEligibility = {
  eligible: boolean;
  source: NhsDemandQueryEligibilitySource | null;
};

const NHS_FUNDING_MODELS = new Set<ProfileServiceFundingModel>(["nhs", "mixed"]);

function clean(value: unknown): string {
  return String(value || "").trim();
}

export function isNationallyCommissionedNhsCommunityPharmacyService(serviceId: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    NATIONALLY_COMMISSIONED_NHS_COMMUNITY_PHARMACY_SERVICES,
    clean(serviceId),
  );
}

function resolveTenantNhsFunding(
  slug: string,
  serviceId: string,
): NhsDemandQueryEligibilitySource | null {
  const id = clean(serviceId);
  const tenantSlug = clean(slug);
  if (!id || !tenantSlug) return null;

  const profile = readSetupProfile(tenantSlug);
  const delivery = profile.serviceDeliveryProfiles?.[id];
  const fundingModel = clean(delivery?.fundingModel).toLowerCase() as ProfileServiceFundingModel;
  if (!NHS_FUNDING_MODELS.has(fundingModel)) return null;

  return {
    kind: "tenant-service-delivery",
    field: "serviceDeliveryProfiles[serviceId].fundingModel",
    serviceId: id,
    slug: tenantSlug,
    fundingModel: fundingModel as "nhs" | "mixed",
  };
}

/**
 * NHS demand queries require explicit shared commissioning metadata or
 * tenant-confirmed NHS/mixed funding on the service-delivery profile.
 */
export function resolveNhsDemandQueryEligibility(input: {
  serviceId: string;
  slug?: string;
}): NhsDemandQueryEligibility {
  const serviceId = clean(input.serviceId);
  if (!serviceId) return { eligible: false, source: null };

  const shared = NATIONALLY_COMMISSIONED_NHS_COMMUNITY_PHARMACY_SERVICES[serviceId];
  if (shared) {
    return {
      eligible: true,
      source: {
        kind: "shared-catalogue",
        field: SHARED_CATALOGUE_NHS_FIELD,
        serviceId,
        commissioningLabel: shared.commissioningLabel,
      },
    };
  }

  const tenantSource = input.slug ? resolveTenantNhsFunding(input.slug, serviceId) : null;
  if (tenantSource) {
    return { eligible: true, source: tenantSource };
  }

  return { eligible: false, source: null };
}

export function listNationallyCommissionedNhsCommunityPharmacyServiceIds(): string[] {
  return Object.keys(NATIONALLY_COMMISSIONED_NHS_COMMUNITY_PHARMACY_SERVICES).sort();
}
