/**
 * Neutral service-page generation identity resolver.
 * Shared by CPR generation state, post-generation identity repair, and preview.
 * Does not import Core Product Recovery or generation stores.
 */
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { resolveCampaignIdForService } from "./masterAdminServiceEvidenceApprovalStore.ts";

export interface ServicePageGenerationIdentity {
  tenantSlug: string;
  campaignId: string | null;
  serviceId: string;
  generationType: "service-page";
}

/**
 * Resolve tenant + campaign + service identity for service-page generation.
 * When serviceId is provided, never substitutes another service.
 * Campaign id prefers explicit argument, then matching active selection, then service mapping.
 */
export function resolveServicePageGenerationIdentity(
  slug: string,
  serviceId: string,
  campaignId?: string | null,
): ServicePageGenerationIdentity {
  const tenantSlug = resolveTenantProfileSlug(slug) || slug;
  const sid = String(serviceId || "").trim();
  if (!sid) {
    throw new Error("resolveServicePageGenerationIdentity requires serviceId");
  }
  const selection = readActiveServiceCampaignSelection(tenantSlug);
  const resolvedCampaignId =
    (campaignId !== undefined && campaignId !== null && String(campaignId).trim()
      ? String(campaignId).trim()
      : null) ||
    (selection?.serviceId === sid ? selection.campaignId : null) ||
    resolveCampaignIdForService(tenantSlug, sid) ||
    null;
  return {
    tenantSlug,
    campaignId: resolvedCampaignId,
    serviceId: sid,
    generationType: "service-page",
  };
}
