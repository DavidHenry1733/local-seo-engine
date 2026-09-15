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
} from "../growthEngineCampaignBuilderModel.ts";
import {
  loadCampaignBuilderSession,
  resolveCampaignBuilderAssetSelection,
} from "../growthEngineCampaignBuilderService.ts";
import { listEligibleCampaignStockPhotographs } from "../growthEngineCampaignBuilderImageStrategyService.ts";
import { resolveCanonicalPharmacyName } from "../pharmacyServicePageProfileContext.ts";
import { isApprovedBankRegisteredService } from "../pharmacyServiceVariantLibrary.ts";
import { withApprovedBankServicePageContract } from "../pharmacyApprovedBankCorePageContract.ts";
import { CUSTOMER_REGISTRY_FOUNDATION_ERROR } from "../pharmacyPublishingFoundationService.ts";
import { buildCampaignBuilderImagePlan, campaignImagePlanPath } from "../growthEngineCampaignBuilderImagePlanService.ts";
import {
  explicitConfirmedLocalityNames,
  rankStoredCampaignTargetAreas,
  resolveRecommendedCampaignTargetAreaCount,
} from "../growthEngineCampaignTargetAreaRankingService.ts";
import type { ProfileAreaEntry } from "../pharmacyProfileSchema.ts";
import {
  readOrganicSearchRun,
  type OrganicSearchDemandRow,
} from "../competitorAnalysisOrganicSearchService.ts";
import type { OrganicSearchCompetitorEvidence, OrganicSearchCompetitorRun } from "../nationalCompetitorDiscoveryModel.ts";

export const CUSTOMER_CAMPAIGN_CONTEXT_VERSION = "1.0.0" as const;

export interface CampaignOrganicSearchEvidence {
  provider: OrganicSearchCompetitorRun["provider"] | null;
  status: OrganicSearchCompetitorRun["status"] | null;
  serviceId: string;
  queries: string[];
  capturedAt: string | null;
  locationName: string | null;
  languageCode: string | null;
  /** Organic visibility rows from DataForSEO Google Organic Live. */
  competitors: OrganicSearchCompetitorEvidence[];
  /**
   * Search-demand fields. Organic Live does not return volume/CPC/competition —
   * those stay unavailable (null) unless a later supported endpoint supplies them.
   */
  keywordDemand: OrganicSearchDemandRow[];
  sourceArtifact: string;
}

export interface CustomerCampaignGenerationContext {
  version: typeof CUSTOMER_CAMPAIGN_CONTEXT_VERSION;
  frozenAt: string;
  slug: string;
  serviceId: string;
  campaignName: string;
  pharmacyName: string;
  targetAreaMode: CampaignBuilderTargetAreaMode;
  targetAreas: string[];
  assetSelection: CampaignBuilderAssetSelection;
  imageStrategy: CampaignBuilderImageStrategy;
  selectedStockImageIds: string[];
  requestAiImages: boolean;
  campaignImagePlan: CampaignBuilderImagePlan | null;
  campaignImagePlanPath: string | null;
  generationContext: ContentGenerationContext;
  /** Service-scoped DataForSEO organic/search evidence bound into this frozen brief. */
  organicSearchEvidence: CampaignOrganicSearchEvidence | null;
  sourceRefs: {
    businessProfileUpdatedAt: string | null;
    localMarketGeneratedAt: string | null;
    websiteIntelligenceUrl: string;
    localMarketUrl: string;
    businessProfileUrl: string;
    organicSearchCapturedAt: string | null;
    organicSearchQueries: string[];
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

export function resolveAuthoritativeCampaignTargetAreas(input: {
  selectedAreas?: ProfileAreaEntry[];
  primaryTown?: string;
  session: Pick<CampaignBuilderSession, "targetAreaMode" | "targetAreaNames">;
  ranked: Array<{ area: string; recommended: boolean }>;
  commercialAuthorised?: boolean;
}): { mode: CampaignBuilderTargetAreaMode; areas: string[]; primaryTown: string } {
  const primaryTown = String(input.primaryTown || "").trim();
  const confirmedAreas = explicitConfirmedLocalityNames(input.selectedAreas);

  if (input.commercialAuthorised) {
    if (!confirmedAreas.length) {
      throw new Error("Confirmed Business Profile local areas are required before authorised commercial generation.");
    }
    return {
      mode: input.session.targetAreaMode || "selectedAreas",
      areas: confirmedAreas,
      primaryTown,
    };
  }

  if (confirmedAreas.length) {
    const confirmedKeys = new Set(confirmedAreas.map((name) => name.toLowerCase()));
    const savedConfirmed = (input.session.targetAreaNames || [])
      .map((name) => String(name).trim())
      .filter((name) => confirmedKeys.has(name.toLowerCase()));
    if (savedConfirmed.length === confirmedAreas.length) {
      return { mode: "selected", areas: savedConfirmed, primaryTown };
    }
    return { mode: "selected", areas: confirmedAreas, primaryTown };
  }

  const poolKeys = new Set(input.ranked.map((row) => row.area.toLowerCase()));
  const savedInPool = (input.session.targetAreaNames || [])
    .map((name) => String(name).trim())
    .filter((name) => poolKeys.has(name.toLowerCase()));
  const required = resolveRecommendedCampaignTargetAreaCount(input.ranked.length);
  const recommended = input.ranked.filter((row) => row.recommended).map((row) => row.area);

  if (input.session.targetAreaMode !== "wholeTown" && savedInPool.length === required && required > 0) {
    return { mode: "selected", areas: savedInPool, primaryTown };
  }
  if (recommended.length === required && required > 0) {
    return { mode: "selected", areas: recommended, primaryTown };
  }
  throw new Error(`Select exactly ${required || "the required"} target areas before generating a campaign.`);
}

export function resolveCampaignBuilderTargetAreas(
  slug: string,
  session: CampaignBuilderSession,
  options?: { commercialAuthorised?: boolean },
): { mode: CampaignBuilderTargetAreaMode; areas: string[]; primaryTown: string } {
  const { data: profile } = loadProfileRaw(slug);
  const ranked = rankStoredCampaignTargetAreas(slug, profile.selectedAreas || [], profile.rankingAreas || []);
  return resolveAuthoritativeCampaignTargetAreas({
    selectedAreas: profile.selectedAreas,
    primaryTown: String(profile.primaryTown || profile.townCity || "").trim(),
    session,
    ranked,
    commercialAuthorised: options?.commercialAuthorised,
  });
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

function resolveHandoffStockImageIds(slug: string, session: CampaignBuilderSession): string[] {
  const eligible = new Set(
    listEligibleCampaignStockPhotographs(slug, session).map((row) => String(row.imageId)),
  );
  const saved = Array.isArray(session.selectedStockImageIds) ? session.selectedStockImageIds.map(String) : [];
  return saved.filter((id) => eligible.has(id));
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
  const pharmacyName =
    resolveCanonicalPharmacyName(profileDoc.data).value || generationContext.profile.pharmacyName;
  const encodedSlug = encodeURIComponent(slug);
  const imagePlan = buildCampaignBuilderImagePlan(slug, state);
  const organicRun = readOrganicSearchRun(slug, serviceId);
  const organicSearchEvidence = organicRun
    ? {
        provider: organicRun.provider,
        status: organicRun.status,
        serviceId,
        queries: organicRun.queries || [],
        capturedAt: organicRun.capturedAt,
        locationName: organicRun.locationName || null,
        languageCode: organicRun.languageCode || null,
        competitors: organicRun.competitors || [],
        keywordDemand: (organicRun.queries || []).map((query) => ({
          query,
          searchVolume: null,
          cpc: null,
          competition: null,
          unavailableReason:
            "DataForSEO Google Organic Live returns visibility rows only; search volume/CPC/competition were not returned for these queries.",
        })),
        sourceArtifact: `data/national-growth-engine/${slug}-competitor-discovery.json#organicSearchByService.${serviceId}`,
      }
    : null;

  return {
    version: CUSTOMER_CAMPAIGN_CONTEXT_VERSION,
    frozenAt: new Date().toISOString(),
    slug,
    serviceId,
    campaignName: meta.serviceName,
    pharmacyName,
    targetAreaMode: mode,
    targetAreas: areas,
    assetSelection: resolveCampaignBuilderAssetSelection(state),
    imageStrategy: state.imageStrategy || "mixed",
    selectedStockImageIds: resolveHandoffStockImageIds(slug, state),
    requestAiImages: state.requestAiImages === true,
    campaignImagePlan: imagePlan,
    campaignImagePlanPath: imagePlan ? campaignImagePlanPath(slug, serviceId) : null,
    generationContext: {
      ...generationContext,
      selectedAreas: selectedAreasOverride,
      profile: { ...generationContext.profile, pharmacyName },
      images: {
        ...generationContext.images,
        slots: imagePlan?.slots.map((s) => s.slot) || generationContext.images.slots,
        assignmentPath: imagePlan ? campaignImagePlanPath(slug, serviceId) : generationContext.images.assignmentPath,
        assignmentsLoaded: Boolean(imagePlan?.slots.some((s) => s.approvalState === "approved" || s.approvalState === "deferred")),
      },
    },
    organicSearchEvidence,
    sourceRefs: {
      businessProfileUpdatedAt: profileDoc.updatedAt,
      localMarketGeneratedAt: localMarketGeneratedAt(slug),
      websiteIntelligenceUrl: `/api/growth-engine/website-intelligence?slug=${encodedSlug}`,
      localMarketUrl: `/api/growth-engine/local-market?slug=${encodedSlug}`,
      businessProfileUrl: `/api/pharmacy-profile-wizard?slug=${encodedSlug}`,
      organicSearchCapturedAt: organicRun?.capturedAt || null,
      organicSearchQueries: organicRun?.queries || [],
    },
  };
}

export interface CustomerCampaignGenerationPayloadValidation {
  ok: boolean;
  errors: string[];
}

function missingRequiredFieldError(field: string): string {
  return `Campaign generation cannot start: missing required field ${field}.`;
}

/** Non-mutating payload contract check. Does not write files or start generation. */
export function validateCustomerCampaignGenerationPayload(
  ctx: CustomerCampaignGenerationContext,
): CustomerCampaignGenerationPayloadValidation {
  const errors: string[] = [];
  const missing = (field: string) => {
    errors.push(missingRequiredFieldError(field));
  };

  if (!String(ctx.pharmacyName || "").trim()) missing("pharmacyName");
  if (!String(ctx.serviceId || "").trim()) missing("serviceId");
  if (!String(ctx.campaignName || "").trim()) missing("campaignName");
  if (!Array.isArray(ctx.targetAreas)) missing("targetAreas");
  else if (!ctx.targetAreas.length) missing("targetAreas");
  if (!Array.isArray(ctx.selectedStockImageIds)) missing("selectedStockImageIds");
  if (typeof ctx.requestAiImages !== "boolean") missing("requestAiImages");
  if (!ctx.assetSelection || typeof ctx.assetSelection !== "object") missing("assetSelection");

  const gen = ctx.generationContext;
  if (!gen) {
    missing("generationContext");
    return { ok: false, errors };
  }
  if (!Array.isArray(gen.selectedAreas)) missing("generationContext.selectedAreas");
  else if (!gen.selectedAreas.length) missing("generationContext.selectedAreas");
  if (Array.isArray(ctx.targetAreas) && Array.isArray(gen.selectedAreas)) {
    const contextNames = gen.selectedAreas.map((area) => area.areaName);
    if (contextNames.join("\n") !== ctx.targetAreas.join("\n")) {
      errors.push(
        "Campaign generation cannot start: generationContext.selectedAreas does not match the saved target areas.",
      );
    }
  }
  if (gen.variantPack && isApprovedBankRegisteredService(gen.serviceId)) {
    try {
      const contract = withApprovedBankServicePageContract(gen.variantPack).servicePage;
      if (!Array.isArray(contract.sections)) missing("approved-bank servicePage.sections");
      if (!Array.isArray(contract.processSteps)) missing("approved-bank servicePage.processSteps");
      if (!Array.isArray(contract.faqs)) missing("approved-bank servicePage.faqs");
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertCustomerCampaignGenerationPayloadReady(ctx: CustomerCampaignGenerationContext): void {
  const result = validateCustomerCampaignGenerationPayload(ctx);
  if (!result.ok) throw new Error(result.errors[0]);
}

export function toCustomerFacingGenerationError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (
    err instanceof TypeError ||
    /^TypeError:/.test(message) ||
    /Cannot read propert(?:y|ies) of undefined \(reading 'length'\)/.test(message) ||
    /Registry not found/i.test(message) ||
    /Run publishing foundation build first/i.test(message)
  ) {
    if (/Registry not found/i.test(message) || /publishing foundation/i.test(message)) {
      return CUSTOMER_REGISTRY_FOUNDATION_ERROR;
    }
    return "Campaign generation cannot start: a required content field was missing. Check the campaign brief and try again.";
  }
  return message;
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
