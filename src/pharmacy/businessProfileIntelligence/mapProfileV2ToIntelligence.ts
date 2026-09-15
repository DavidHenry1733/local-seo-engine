/**
 * Business Profile Intelligence V2 — profile field mapping helpers.
 * Used by buildBusinessProfileIntelligence when Phase 2 profile fields are present.
 */
import type { PharmacyProfileData } from "../pharmacyProfileSchema.ts";
import type { ProfileServiceDeliveryProfile } from "../pharmacyProfileV2Fields.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function profileHasV2Fields(data: PharmacyProfileData): boolean {
  return Boolean(
    str(data.tagline) ||
      str(data.businessDescription) ||
      Object.keys(data.serviceDeliveryProfiles || {}).some((id) => {
        const p = data.serviceDeliveryProfiles?.[id];
        return p && (str(p.pricing) || str(p.resultsProcess) || p.fundingModel !== "unknown");
      }) ||
      (data.contentIntelligence && str(data.contentIntelligence.toneOfVoice)),
  );
}

export function resolveServiceDeliveryFromProfile(
  data: PharmacyProfileData,
  serviceId: string,
): ProfileServiceDeliveryProfile | undefined {
  return data.serviceDeliveryProfiles?.[serviceId];
}
