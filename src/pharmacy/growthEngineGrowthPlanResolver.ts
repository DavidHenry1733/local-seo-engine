/**
 * Growth Plan product resolver — honours existing growthPlatform discriminator.
 * LOCAL keeps the pharmacy campaign engine. NATIONAL uses persisted GP-01 snapshot.
 */
import { isNationalGrowthPlatform, resolveGrowthPlatform } from "./growthPlatformResolverService.ts";
import {
  buildGrowthPlanIntelligence,
  type GrowthPlanIntelligence,
} from "./growthEngineCampaignRecommendationEngine.ts";
import {
  buildNationalGrowthPlanView,
  type NationalGrowthPlanView,
} from "./growthEngineNationalGrowthPlanService.ts";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";

export type ResolvedGrowthPlan =
  | { platform: "local"; plan: GrowthPlanIntelligence }
  | { platform: "national"; plan: NationalGrowthPlanView };

function serviceDisplayName(serviceId: string): string {
  return getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function listEnabledPharmacyServices(slug: string): Array<{ serviceId: string; serviceName: string }> {
  const profile = readSetupProfile(slug);
  const ids = [...new Set((profile.selectedServices || []).map((id) => String(id || "").trim()).filter(Boolean))];
  return ids.map((serviceId) => ({ serviceId, serviceName: serviceDisplayName(serviceId) }));
}

export function saveAuthoritativeCampaignPriority(
  slug: string,
  serviceId: string,
): { ok: true; serviceId: string } | { ok: false; error: string } {
  const id = String(serviceId || "").trim();
  const enabled = listEnabledPharmacyServices(slug);
  if (!id || !enabled.some((s) => s.serviceId === id)) {
    return { ok: false, error: "Choose a service from the list." };
  }
  const existing = readSetupProfile(slug);
  writeSetupProfile(slug, { ...existing, priorityServices: [id] }, { bumpPresentationRevision: false });
  return { ok: true, serviceId: id };
}

/** Campaign priority only when it is one of this pharmacy's explicit services. */
export function resolveAuthoritativeCampaignPriority(slug: string): string | null {
  const profile = readSetupProfile(slug);
  const explicit = new Set(
    (profile.selectedServices || []).map((id) => String(id || "").trim()).filter(Boolean),
  );
  const selected = (profile.priorityServices || [])
    .map((id) => String(id || "").trim())
    .filter((id) => explicit.has(id));
  return selected[0] || null;
}

export function resolveGrowthPlan(slug: string): ResolvedGrowthPlan {
  const resolved = resolveGrowthPlatform(slug);
  if (resolved.platform === "national" || isNationalGrowthPlatform(slug)) {
    return { platform: "national", plan: buildNationalGrowthPlanView(slug) };
  }
  return { platform: "local", plan: buildGrowthPlanIntelligence(slug) };
}
