/**
 * Stale campaign detection — compares profile updates to generated content timestamps.
 */
import fs from "node:fs";
import path from "node:path";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { readPharmacyCampaignStore, type PharmacyCampaign } from "./pharmacyCampaignService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";

export interface CampaignStaleStatus {
  campaignId: string;
  serviceId: string;
  serviceName: string;
  isStale: boolean;
  profileUpdatedAt: string | null;
  contentGeneratedAt: string | null;
  regeneratedAt: string | null;
  message: string | null;
  regenerateUrl: string;
}

function safeSlug(slug: string): string {
  return (
    String(slug || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

function parseTs(v: string | null | undefined): number {
  if (!v) return 0;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function contentGeneratedAt(slug: string, serviceId: string, fallback: string): string {
  const ecoPath = path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    safeSlug(slug),
    serviceId,
    "_ecosystem-index.json",
  );
  if (!fs.existsSync(ecoPath)) return fallback;
  try {
    const eco = JSON.parse(fs.readFileSync(ecoPath, "utf8")) as { generatedAt?: string };
    return eco.generatedAt || fallback;
  } catch {
    return fallback;
  }
}

export function getCampaignStaleStatus(
  slug: string,
  campaign: PharmacyCampaign & { regeneratedAt?: string },
): CampaignStaleStatus {
  const s = safeSlug(slug);
  const profileDoc = loadPharmacyProfile(s);
  const profile = normalizeProfileData((profileDoc?.data || profileDoc || {}) as Record<string, unknown>);
  const profileUpdatedAt = profile.updatedAt || null;
  const contentGeneratedAtTs = contentGeneratedAt(s, campaign.serviceId, campaign.createdAt);
  const regeneratedAt = campaign.regeneratedAt || null;

  const latestContent = Math.max(parseTs(contentGeneratedAtTs), parseTs(regeneratedAt), parseTs(campaign.createdAt));
  const profileTs = parseTs(profileUpdatedAt);
  const isStale = profileTs > 0 && latestContent > 0 && profileTs > latestContent;

  return {
    campaignId: campaign.id,
    serviceId: campaign.serviceId,
    serviceName: campaign.serviceName,
    isStale,
    profileUpdatedAt,
    contentGeneratedAt: contentGeneratedAtTs,
    regeneratedAt,
    message: isStale ? "Profile updated — campaign requires regeneration." : null,
    regenerateUrl: `/api/pharmacy-campaigns?slug=${s}&campaignId=${campaign.id}#regenerate`,
  };
}

export function listStaleCampaigns(slug: string): CampaignStaleStatus[] {
  const store = readPharmacyCampaignStore(safeSlug(slug));
  if (!store) return [];
  return store.campaigns
    .filter((c) => c.status === "active")
    .map((c) => getCampaignStaleStatus(slug, c as PharmacyCampaign & { regeneratedAt?: string }))
    .filter((s) => s.isStale);
}

export function anyCampaignStale(slug: string): boolean {
  return listStaleCampaigns(slug).length > 0;
}
