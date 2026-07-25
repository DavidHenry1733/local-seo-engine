/**
 * CustomerCampaignGenerationContext — frozen orchestration input for campaign generation.
 * Built exclusively from Campaign Builder session + canonical Business Profile / Local Market.
 * Generation engines consume ContentGenerationContext only; this layer prepares and freezes it.
 */
import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "./buildContentGenerationContext.ts";
import type { ContentGenerationContext, ContentGenerationArea } from "./contentGenerationContextTypes.ts";
import { slugifyArea } from "../pharmacyAreaNarrativeProfiles.ts";
import { getServicePublishMeta } from "../pharmacyMasterPublishConfig.ts";
import { normalizeProfileData } from "../pharmacyProfileSchema.ts";
import { WORKSPACE_ROOT } from "../pharmacyCompetitorDiscovery.ts";
import {
  type CampaignBuilderAssetSelection,
  type CampaignBuilderImageStrategy,
  type CampaignBuilderSession,
  type CampaignBuilderTargetAreaMode,
  type CampaignBuilderImagePlan,
  DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION,
} from "../growthEngineCampaignBuilderModel.ts";
import { loadCampaignBuilderSession } from "../growthEngineCampaignBuilderService.ts";
import { buildCampaignBuilderImagePlan, campaignImagePlanPath } from "../growthEngineCampaignBuilderImagePlanService.ts";
import { resolveCampaignBuilderSelectedAreaNames } from "../growthEngineCampaignBuilderAreaDiscoveryService.ts";
import type { ProfileAreaEntry } from "../pharmacyProfileSchema.ts";

export const CUSTOMER_CAMPAIGN_CONTEXT_VERSION = "1.0.0" as const;

export interface CustomerCampaignGenerationContext {
  version: typeof CUSTOMER_CAMPAIGN_CONTEXT_VERSION;
  frozenAt: string;
  slug: string;
  serviceId: string;
  campaignName: string;
  targetAreaMode: CampaignBuilderTargetAreaMode;
  targetAreas: string[];
  assetSelection: CampaignBuilderAssetSelection;
  imageStrategy: CampaignBuilderImageStrategy;
  campaignImagePlan: CampaignBuilderImagePlan | null;
  campaignImagePlanPath: string | null;
  generationContext: ContentGenerationContext;
  sourceRefs: {
    businessProfileUpdatedAt: string | null;
    localMarketGeneratedAt: string | null;
    websiteIntelligenceUrl: string;
    localMarketUrl: string;
    businessProfileUrl: string;
  };
}

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
}

function loadProfileRaw(slug: string) {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return { data: normalizeProfileData({}), updatedAt: null as string | null };
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    data: normalizeProfileData(doc.data || {}),
    updatedAt: String(doc.updatedAt || "") || null,
  };
}

function localMarketGeneratedAt(slug: string): string | null {
  const file = path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-competitors.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    return String(doc.generatedAt || "") || null;
  } catch {
    return null;
  }
}

function contextFilePath(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-campaign-generation-context-${serviceId}.json`);
}

function resolveConfirmedProfileAreaNames(profile: ReturnType<typeof normalizeProfileData>): string[] {
  const fromSelected = (profile.selectedAreas || []).filter((a: ProfileAreaEntry) => a.selected !== false);
  if (fromSelected.length) return fromSelected.map((a: ProfileAreaEntry) => a.areaName).filter(Boolean);
  const legacy = (profile.selectedLocalAreas || profile.localAreas || profile.nearbyAreas || []) as Array<
    string | ProfileAreaEntry
  >;
  return legacy
    .map((a) => (typeof a === "string" ? a : a.areaName || ""))
    .filter(Boolean);
}

export function resolveCampaignBuilderTargetAreas(
  slug: string,
  session: CampaignBuilderSession,
  options?: { commercialAuthorised?: boolean },
): { mode: CampaignBuilderTargetAreaMode; areas: string[]; primaryTown: string } {
  const { data: profile } = loadProfileRaw(slug);
  const primaryTown = String(profile.primaryTown || profile.townCity || "").trim();
  const confirmedAreas = resolveConfirmedProfileAreaNames(profile);

  if (options?.commercialAuthorised) {
    if (!confirmedAreas.length) {
      throw new Error("Confirmed Business Profile local areas are required before authorised commercial generation.");
    }
    return {
      mode: session.targetAreaMode || "selectedAreas",
      areas: confirmedAreas,
      primaryTown,
    };
  }

  if (session.targetAreaMode === "wholeTown") {
    if (!primaryTown) {
      throw new Error("Primary town or city is required before generating a campaign.");
    }
    if (confirmedAreas.length) {
      return { mode: "wholeTown", areas: confirmedAreas, primaryTown };
    }
    return { mode: "wholeTown", areas: [primaryTown], primaryTown };
  }

  const selected = resolveCampaignBuilderSelectedAreaNames(session);
  if (!selected.length) {
    throw new Error("Select at least one target area, or choose whole town coverage.");
  }
  return { mode: session.targetAreaMode, areas: selected, primaryTown };
}

function toGenerationAreas(names: string[]): ContentGenerationArea[] {
  return names.map((areaName, index) => ({
    areaName,
    areaSlug: slugifyArea(areaName),
    selected: true,
    order: index + 1,
    priority: index + 1,
  }));
}

function resolveAssetSelection(session: CampaignBuilderSession): CampaignBuilderAssetSelection {
  if (session.mode === "all") return { ...DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION };
  return { ...DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION, ...session.assetSelection };
}

export function buildCustomerCampaignGenerationContext(
  slug: string,
  serviceId: string,
  session?: CampaignBuilderSession,
  options?: { commercialAuthorised?: boolean },
): CustomerCampaignGenerationContext {
  const state = session || loadCampaignBuilderSession(slug);
  if (!state.selectedServiceId || state.selectedServiceId !== serviceId) {
    throw new Error("Campaign Builder session must have the selected campaign before generation.");
  }

  const meta = getServicePublishMeta(serviceId);
  if (!meta) {
    throw new Error(`Unknown campaign service "${serviceId}".`);
  }

  const { areas, mode, primaryTown } = resolveCampaignBuilderTargetAreas(slug, state, options);
  const selectedAreasOverride = toGenerationAreas(areas);
  const localArea = areas[0] || primaryTown;
  const generationContext = buildContentGenerationContext(slug, serviceId, {
    localArea,
    selectedAreasOverride,
  });

  const profileDoc = loadProfileRaw(slug);
  const encodedSlug = encodeURIComponent(slug);
  const imagePlan = buildCampaignBuilderImagePlan(slug, state);

  return {
    version: CUSTOMER_CAMPAIGN_CONTEXT_VERSION,
    frozenAt: new Date().toISOString(),
    slug,
    serviceId,
    campaignName: meta.serviceName,
    targetAreaMode: mode,
    targetAreas: areas,
    assetSelection: resolveAssetSelection(state),
    imageStrategy: state.imageStrategy || "mixed",
    campaignImagePlan: imagePlan,
    campaignImagePlanPath: imagePlan ? campaignImagePlanPath(slug, serviceId) : null,
    generationContext: {
      ...generationContext,
      images: {
        ...generationContext.images,
        slots: imagePlan?.slots.map((s) => s.slot) || generationContext.images.slots,
        assignmentPath: imagePlan ? campaignImagePlanPath(slug, serviceId) : generationContext.images.assignmentPath,
        assignmentsLoaded: Boolean(imagePlan?.slots.some((s) => s.approvalState === "approved" || s.approvalState === "deferred")),
      },
    },
    sourceRefs: {
      businessProfileUpdatedAt: profileDoc.updatedAt,
      localMarketGeneratedAt: localMarketGeneratedAt(slug),
      websiteIntelligenceUrl: `/api/growth-engine/website-intelligence?slug=${encodedSlug}`,
      localMarketUrl: `/api/growth-engine/local-market?slug=${encodedSlug}`,
      businessProfileUrl: `/api/pharmacy-profile-wizard?slug=${encodedSlug}`,
    },
  };
}

export function freezeCustomerCampaignGenerationContext(
  ctx: CustomerCampaignGenerationContext,
): string {
  const file = contextFilePath(ctx.slug, ctx.serviceId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ctx, null, 2));
  return file;
}

export function loadFrozenCustomerCampaignGenerationContext(
  slug: string,
  serviceId: string,
): CustomerCampaignGenerationContext | null {
  const file = contextFilePath(slug, serviceId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as CustomerCampaignGenerationContext;
  } catch {
    return null;
  }
}
