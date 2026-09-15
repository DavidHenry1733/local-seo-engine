/**
 * Campaign Control Centre — enriches campaigns with asset checklist, image slots, and launch queue.
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildPharmacyCampaignDashboard,
  buildOutputs,
  type PharmacyCampaign,
  type PharmacyCampaignDashboard,
} from "./pharmacyCampaignService.ts";
import type { PharmacyCampaignWithExecution } from "./pharmacyCampaignExecutionService.ts";
import {
  readPharmacyCampaignLaunchQueue,
  type CampaignLaunchQueueEntry,
} from "./pharmacyCampaignLaunchQueueService.ts";
import {
  getCampaignImageSlotStatus,
  getCampaignImageSummary,
  type CampaignImageSlotStatus,
  type ImageSourceBreakdown,
} from "./pharmacyCampaignImageStatusService.ts";
import {
  buildCampaignOperatingSystem,
  type CampaignOperatingSystem,
} from "./pharmacyCampaignOperatingSystemService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  buildPlatformOperationalWorkflow,
  type PlatformOperationalWorkflow,
} from "./pharmacyPlatformOperationalWorkflowService.ts";
import { readPharmacyGrowthActionPlan } from "./pharmacyGrowthActionPlanService.ts";
import {
  getAuthoritySummaryForCampaign,
  refreshPharmacyAuthorityReadiness,
  type AuthorityReadinessLabel,
  type PublishGate,
} from "./pharmacyAuthorityReadinessService.ts";
import {
  getEnhancementSummaryForCampaign,
  refreshPharmacyAuthorityEnhancement,
  type EnhancementRecommendation,
} from "./pharmacyAuthorityEnhancementService.ts";
import {
  getEnhancementWorkspaceProgress,
} from "./pharmacyEnhancementWorkspaceService.ts";

export interface CampaignAssetChecklistItem {
  id: string;
  label: string;
  status: "complete" | "pending" | "missing";
  detail: string;
  link: string | null;
}

export interface PharmacyCampaignEnriched extends PharmacyCampaignWithExecution {
  imageSlots: CampaignImageSlotStatus[];
  imageAssignedCount: number;
  imageTotalSlots: number;
  imageSourceBreakdown: ImageSourceBreakdown;
  imageLibraryUrl: string;
  imageMissingSlots: string[];
  authorityScore: number;
  authorityLabel: AuthorityReadinessLabel;
  authorityPublishGate: PublishGate;
  authorityMissingTop3: string[];
  authorityCriticalTop3: string[];
  authorityTopBlockers: string[];
  authorityLaunchImpact: string;
  authorityAuditUrl: string;
  authorityLivePublishReady: boolean;
  enhancementCurrentScore: number;
  enhancementPotentialScore: number;
  enhancementTotalRecommendations: number;
  enhancementEasyWins: number;
  enhancementHighImpact: number;
  enhancementEstimatedImprovement: number;
  enhancementTopRecommendations: EnhancementRecommendation[];
  enhancementUrl: string;
  enhancementWorkspaceUrl: string;
  enhancementProgressCurrent: number;
  enhancementProgressProjected: number;
  enhancementProgressPotential: number;
  enhancementProgressCompleted: number;
  enhancementProgressRealCompleted: number;
  enhancementProgressRemaining: number;
  enhancementProgressPublishGate: PublishGate;
  enhancementNextRealActionLabel: string;
  enhancementNextRealActionUrl: string;
  enhancementProgressEasyWins: number;
  enhancementProgressHighImpact: number;
  assetChecklist: CampaignAssetChecklistItem[];
  launchQueue: CampaignLaunchQueueEntry | null;
  operatingSystem: CampaignOperatingSystem;
  detailUrl: string;
}

export interface PharmacyCampaignControlCentre extends Omit<PharmacyCampaignDashboard, "campaigns"> {
  campaigns: PharmacyCampaignEnriched[];
  primaryCampaign: PharmacyCampaignEnriched | null;
  platformWorkflow: PlatformOperationalWorkflow;
}

export interface PharmacyCampaignDetailView {
  slug: string;
  pharmacyName: string;
  brandPrimaryColor: string;
  campaign: PharmacyCampaignEnriched;
  campaignPicker: Array<{ id: string; name: string; serviceName: string }>;
  staleFallbackWarning?: string;
}

export const BENCHMARK_CAMPAIGN_SERVICE_IDS = [
  "blood-pressure-checks",
  "pharmacy-first",
  "travel-vaccinations",
  "emergency-contraception",
] as const;

export interface ResolvedActiveCampaign {
  campaignId: string | null;
  campaign: PharmacyCampaignEnriched | null;
  fallbackUsed: boolean;
  staleRequestedId?: string;
  warning?: string;
}

export interface CampaignOsRouteResult {
  mode: "detail" | "portfolio";
  detail: PharmacyCampaignDetailView | null;
  staleFallbackWarning?: string;
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

function ecosystemIndexPath(slug: string, serviceId: string): string {
  return path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    safeSlug(slug),
    serviceId,
    "_ecosystem-index.json",
  );
}

function buildAssetChecklist(
  slug: string,
  campaign: PharmacyCampaign,
  imageAssignedCount: number,
  authority: ReturnType<typeof getAuthoritySummaryForCampaign>,
): CampaignAssetChecklistItem[] {
  const s = safeSlug(slug);
  const outputs = buildOutputs(slug, campaign.serviceId);
  const ecoExists = fs.existsSync(ecosystemIndexPath(s, campaign.serviceId));
  const meta = getServicePublishMeta(campaign.serviceId);
  const masterPath = meta
    ? path.join(WORKSPACE_ROOT, "docs/pharmacy-master-library", meta.masterFile)
    : "";
  const masterExists = masterPath ? fs.existsSync(masterPath) : false;
  const growthPlan = readPharmacyGrowthActionPlan(s);
  const growthPending = (growthPlan?.pendingActions ?? 0) > 0;

  const outputStatus = (id: string): CampaignAssetChecklistItem["status"] => {
    const item = outputs.find((o) => o.id === id);
    if (!item) return "missing";
    if (item.available && item.count > 0) return "complete";
    if (item.count > 0) return "pending";
    return "missing";
  };

  return [
    {
      id: "master",
      label: "Master library",
      status: masterExists ? "complete" : "missing",
      detail: masterExists ? "Master source available" : "Master file not found",
      link: null,
    },
    {
      id: "ecosystem",
      label: "Content ecosystem",
      status: ecoExists ? "complete" : "missing",
      detail: ecoExists ? "Ecosystem generated" : "Generate ecosystem first",
      link: campaign.links.ecosystem,
    },
    {
      id: "service-page",
      label: "Service page",
      status: outputStatus("service-page"),
      detail: `${campaign.assetCounts.servicePage} linked`,
      link: campaign.links.publishedPage,
    },
    {
      id: "authority-readiness",
      label: "Authority & AI readiness",
      status:
        authority.publishGate === "PASS"
          ? "complete"
          : authority.publishGate === "PASS_WITH_RECOMMENDATIONS"
            ? "pending"
            : "missing",
      detail: `${authority.overallScore}/100 · ${authority.label} · ${authority.publishGate.replace(/_/g, " ")}`,
      link: authority.auditUrl,
    },
    {
      id: "images",
      label: "Image library (4 slots)",
      status: imageAssignedCount >= 4 ? "complete" : imageAssignedCount > 0 ? "pending" : "missing",
      detail: `${imageAssignedCount}/4 assigned`,
      link: `/api/pharmacy-image-library?slug=${s}&service=${campaign.serviceId}`,
    },
    {
      id: "publishing",
      label: "Publishing",
      status: campaign.publishingStatus === "published" ? "complete" : campaign.publishingStatus === "partial" ? "pending" : "missing",
      detail: `${campaign.publishedPages} pages · ${campaign.publishingStatus}`,
      link: `/api/pharmacy-executive-dashboard?slug=${s}`,
    },
    {
      id: "indexing",
      label: "Indexing",
      status: campaign.indexingStatus === "indexed" ? "complete" : campaign.indexingStatus === "submitted" ? "pending" : "missing",
      detail: campaign.indexingStatus.replace(/_/g, " "),
      link: campaign.links.indexing,
    },
    {
      id: "visibility",
      label: "Visibility",
      status: campaign.visibilityStatus === "visible" ? "complete" : campaign.visibilityStatus === "building" ? "pending" : "missing",
      detail: campaign.visibilityStatus.replace(/_/g, " "),
      link: campaign.links.visibility,
    },
    {
      id: "growth-actions",
      label: "Growth actions",
      status: growthPending ? "pending" : growthPlan?.totalActions ? "complete" : "missing",
      detail: growthPlan
        ? `${growthPlan.pendingActions} pending · ${growthPlan.completeActions} complete`
        : "Generate growth action plan",
      link: `/api/pharmacy-growth-actions?slug=${s}`,
    },
  ];
}

function enrichCampaign(
  slug: string,
  campaign: PharmacyCampaignWithExecution,
  launchQueue: CampaignLaunchQueueEntry | null,
): PharmacyCampaignEnriched {
  const s = safeSlug(slug);
  const imageSummary = getCampaignImageSummary(s, campaign.serviceId, campaign.id);
  const authority = getAuthoritySummaryForCampaign(s, campaign.serviceId);
  const enhancement = getEnhancementSummaryForCampaign(s, campaign.serviceId);
  const workspaceProgress = getEnhancementWorkspaceProgress(s, campaign.serviceId);
  return {
    ...campaign,
    imageSlots: imageSummary.slots,
    imageAssignedCount: imageSummary.assignedCount,
    imageTotalSlots: imageSummary.totalSlots,
    imageSourceBreakdown: imageSummary.sourceBreakdown,
    imageLibraryUrl: imageSummary.imageLibraryUrl,
    imageMissingSlots: imageSummary.missingSlots,
    authorityScore: authority.overallScore,
    authorityLabel: authority.label,
    authorityPublishGate: authority.publishGate,
    authorityMissingTop3: authority.topMissingSignals,
    authorityCriticalTop3: authority.topCriticalIssues,
    authorityTopBlockers: authority.topBlockers,
    authorityLaunchImpact: authority.launchImpact,
    authorityAuditUrl: authority.auditUrl,
    authorityLivePublishReady: authority.livePublishReady,
    enhancementCurrentScore: enhancement.currentScore,
    enhancementPotentialScore: enhancement.potentialScore,
    enhancementTotalRecommendations: enhancement.totalRecommendations,
    enhancementEasyWins: enhancement.easyWins,
    enhancementHighImpact: enhancement.highImpactImprovements,
    enhancementEstimatedImprovement: enhancement.estimatedImprovement,
    enhancementTopRecommendations: enhancement.topRecommendations,
    enhancementUrl: enhancement.enhancementUrl,
    enhancementWorkspaceUrl: workspaceProgress.workspaceUrl,
    enhancementProgressCurrent: workspaceProgress.currentScore,
    enhancementProgressProjected: workspaceProgress.projectedScore,
    enhancementProgressPotential: workspaceProgress.potentialScore,
    enhancementProgressCompleted: workspaceProgress.completed,
    enhancementProgressRealCompleted: workspaceProgress.realCompleted,
    enhancementProgressRemaining: workspaceProgress.remaining,
    enhancementProgressPublishGate: workspaceProgress.publishGate,
    enhancementNextRealActionLabel: workspaceProgress.nextRecommendedRealAction?.label || "",
    enhancementNextRealActionUrl: workspaceProgress.nextRecommendedRealAction?.url || "",
    enhancementProgressEasyWins: workspaceProgress.easyWinsRemaining,
    enhancementProgressHighImpact: workspaceProgress.highImpactRemaining,
    assetChecklist: buildAssetChecklist(s, campaign, imageSummary.assignedCount, authority),
    launchQueue,
    operatingSystem: buildCampaignOperatingSystem(s, campaign, launchQueue),
    detailUrl: `/api/pharmacy-campaigns?slug=${s}&campaignId=${campaign.id}`,
  };
}

export function buildPharmacyCampaignControlCentre(slug: string): PharmacyCampaignControlCentre {
  refreshPharmacyAuthorityReadiness(slug);
  refreshPharmacyAuthorityEnhancement(slug);
  const dashboard = buildPharmacyCampaignDashboard(slug);
  const queueStore = readPharmacyCampaignLaunchQueue(slug);
  const queueByCampaign = new Map((queueStore?.campaigns || []).map((q) => [q.campaignId, q]));

  const campaigns = dashboard.campaigns.map((c) =>
    enrichCampaign(slug, c, queueByCampaign.get(c.id) || null),
  );
  const primaryCampaign =
    campaigns.find((c) => c.status === "active") || campaigns[0] || null;

  return {
    ...dashboard,
    campaigns,
    primaryCampaign,
    primaryExecution: primaryCampaign,
    primaryLaunchQueue: primaryCampaign?.launchQueue || dashboard.primaryLaunchQueue,
    platformWorkflow: buildPlatformOperationalWorkflow(slug, primaryCampaign?.serviceId),
  };
}

export function buildPharmacyCampaignDetailView(
  slug: string,
  campaignId: string,
): PharmacyCampaignDetailView | null {
  const centre = buildPharmacyCampaignControlCentre(slug);
  const campaign = centre.campaigns.find((c) => c.id === campaignId && c.status === "active");
  if (!campaign) return null;

  return {
    slug: centre.slug,
    pharmacyName: centre.pharmacyName,
    brandPrimaryColor: centre.brandPrimaryColor,
    campaign,
    campaignPicker: centre.campaigns
      .filter((c) => c.status === "active")
      .map((c) => ({ id: c.id, name: c.name, serviceName: c.serviceName })),
  };
}

const STALE_CAMPAIGN_WARNING =
  "Requested campaign was not found or has been archived. Showing the active campaign instead.";

/** Resolve primary active campaign — ignores archived; used for nav fallback and Campaign OS routing. */
export function resolvePrimaryActiveCampaign(
  slug: string,
  requestedCampaignId?: string | null,
): ResolvedActiveCampaign {
  const centre = buildPharmacyCampaignControlCentre(slug);
  const active = centre.campaigns.filter((c) => c.status === "active");
  const requested = String(requestedCampaignId ?? "").trim();

  if (requested) {
    const match = active.find((c) => c.id === requested);
    if (match) {
      return { campaignId: match.id, campaign: match, fallbackUsed: false };
    }
  }

  const warning = requested ? STALE_CAMPAIGN_WARNING : undefined;

  const bpc = active.find((c) => c.serviceId === "blood-pressure-checks");
  if (bpc) {
    return {
      campaignId: bpc.id,
      campaign: bpc,
      fallbackUsed: Boolean(requested),
      staleRequestedId: requested || undefined,
      warning,
    };
  }

  for (const serviceId of BENCHMARK_CAMPAIGN_SERVICE_IDS) {
    const match = active.find((c) => c.serviceId === serviceId);
    if (match) {
      return {
        campaignId: match.id,
        campaign: match,
        fallbackUsed: Boolean(requested),
        staleRequestedId: requested || undefined,
        warning,
      };
    }
  }

  const first = active[0];
  if (first) {
    return {
      campaignId: first.id,
      campaign: first,
      fallbackUsed: Boolean(requested),
      staleRequestedId: requested || undefined,
      warning,
    };
  }

  return {
    campaignId: null,
    campaign: null,
    fallbackUsed: Boolean(requested),
    staleRequestedId: requested || undefined,
    warning,
  };
}

/** Campaign OS route — detail view or portfolio; never fatal for stale/missing campaignId. */
export function resolveCampaignOsRoute(slug: string, requestedCampaignId?: string): CampaignOsRouteResult {
  const requested = String(requestedCampaignId ?? "").trim();
  if (requested) {
    const direct = buildPharmacyCampaignDetailView(slug, requested);
    if (direct) {
      return { mode: "detail", detail: direct };
    }
  }

  const resolved = resolvePrimaryActiveCampaign(slug, requested || undefined);
  if (resolved.campaignId) {
    const detail = buildPharmacyCampaignDetailView(slug, resolved.campaignId);
    if (detail) {
      return {
        mode: "detail",
        detail: {
          ...detail,
          staleFallbackWarning: resolved.fallbackUsed ? resolved.warning : undefined,
        },
        staleFallbackWarning: resolved.fallbackUsed ? resolved.warning : undefined,
      };
    }
  }

  return {
    mode: "portfolio",
    detail: null,
    staleFallbackWarning: resolved.warning,
  };
}

export { getCampaignImageSlotStatus, getCampaignImageSummary };
export type { CampaignOperatingSystem } from "./pharmacyCampaignOperatingSystemService.ts";
export { buildCampaignOperatingSystem } from "./pharmacyCampaignOperatingSystemService.ts";
