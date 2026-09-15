/**
 * Pharmacy Campaign Execution V1 — live stage detection from existing bridge data only.
 */
import fs from "node:fs";
import path from "node:path";
import {
  type PharmacyCampaign,
} from "./pharmacyCampaignService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { readPharmacyIndexingSummary, type PharmacyRegistry } from "./pharmacyIndexingBridgeService.ts";
import { readPharmacyGrowthActionPlan } from "./pharmacyGrowthActionPlanService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";

export type CampaignExecutionStage =
  | "draft"
  | "ready"
  | "publishing"
  | "published"
  | "indexing"
  | "visible"
  | "complete";

export const STAGE_PROGRESS: Record<CampaignExecutionStage, number> = {
  draft: 5,
  ready: 15,
  publishing: 35,
  published: 55,
  indexing: 75,
  visible: 90,
  complete: 100,
};

export interface CampaignExecutionTrack {
  label: string;
  status: string;
  count: number;
  lastUpdated: string | null;
}

export interface CampaignExecutionState {
  stage: CampaignExecutionStage;
  progressPct: number;
  nextAction: string;
  statusBadge: string;
  tracks: {
    contentAssets: CampaignExecutionTrack;
    publishing: CampaignExecutionTrack;
    indexing: CampaignExecutionTrack;
    visibility: CampaignExecutionTrack;
  };
}

export interface PharmacyCampaignWithExecution extends PharmacyCampaign {
  execution: CampaignExecutionState;
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

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
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

function publishIndexPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-publish", safeSlug(slug), "_publish-index.json");
}

function registryPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-registry", `${safeSlug(slug)}.json`);
}

interface PublishIndex {
  generatedAt: string;
  pages: Array<{ serviceId: string; pageType: string; generatedAt: string }>;
}

interface EcosystemIndex {
  generatedAt?: string;
}

function resolveLiveCounts(slug: string, serviceId: string) {
  const s = safeSlug(slug);
  const publishIndex = readJson<PublishIndex>(publishIndexPath(s));
  const publishPages = (publishIndex?.pages || []).filter((p) => p.serviceId === serviceId);
  const rootPublished = publishPages.some((p) => p.pageType === "service");
  const publishedPages = publishPages.length;
  const publishUpdated = publishPages.reduce<string | null>((latest, p) => {
    if (!p.generatedAt) return latest;
    if (!latest || p.generatedAt > latest) return p.generatedAt;
    return latest;
  }, publishIndex?.generatedAt || null);

  const registry = readJson<PharmacyRegistry>(registryPath(s));
  const serviceRegistryPages = (registry?.pages || []).filter((p) => p.serviceId === serviceId);
  const rootPage = serviceRegistryPages.find((p) => p.pageType === "service") || serviceRegistryPages[0] || null;
  const indexedPages = serviceRegistryPages.filter((p) => p.indexingStatus === "indexed").length;

  const visibilityReport = readPharmacyVisibilityReport(s);
  const visibilityService = visibilityReport?.services.find((svc) => svc.serviceId === serviceId);
  const visiblePages =
    visibilityService?.visibilityStatus === "visible" || visibilityService?.indexedStatus === "indexed"
      ? Math.max(indexedPages, visibilityService?.visibilityStatus === "visible" ? 1 : 0)
      : 0;

  let publishingStatus: "published" | "partial" | "pending" = "pending";
  if (rootPublished && publishedPages > 1) publishingStatus = "published";
  else if (rootPublished) publishingStatus = "partial";

  const ecoPath = ecosystemIndexPath(s, serviceId);
  const eco = readJson<EcosystemIndex>(ecoPath);
  const meta = getServicePublishMeta(serviceId);
  const masterPath = meta
    ? path.join(WORKSPACE_ROOT, "docs/pharmacy-master-library", meta.masterFile)
    : "";

  return {
    publishedPages,
    indexedPages,
    visiblePages: visibilityService?.visibilityStatus === "visible" ? Math.max(visiblePages, 1) : visiblePages,
    publishingStatus,
    indexingStatus: rootPage?.indexingStatus || "not_registered",
    visibilityStatus: visibilityService?.visibilityStatus || visibilityService?.indexedStatus || "unknown",
    ecosystemAvailable: Boolean(eco),
    ecosystemAssetCount: eco ? readJson<{ assets: unknown[] }>(ecoPath)?.assets.length ?? 0 : 0,
    masterReady: masterPath ? fs.existsSync(masterPath) : false,
    contentLastUpdated: eco?.generatedAt || null,
    publishLastUpdated: publishUpdated,
    indexingLastUpdated: rootPage?.lastCheckedAt || readPharmacyIndexingSummary(s)?.lastUpdated || null,
    visibilityLastUpdated: visibilityReport?.lastCheckedAt || null,
  };
}

export function detectCampaignExecutionStage(input: {
  ecosystemAvailable: boolean;
  masterReady: boolean;
  publishingStatus: "published" | "partial" | "pending";
  publishedPages: number;
  indexingStatus: string;
  indexedPages: number;
  visibilityStatus: string;
  visiblePages: number;
}): CampaignExecutionStage {
  const {
    ecosystemAvailable,
    masterReady,
    publishingStatus,
    publishedPages,
    indexingStatus,
    indexedPages,
    visibilityStatus,
    visiblePages,
  } = input;

  if (
    publishingStatus === "published" &&
    indexedPages > 0 &&
    visibilityStatus === "visible" &&
    visiblePages > 0
  ) {
    return "complete";
  }
  if (publishingStatus === "published" && visibilityStatus === "visible" && visiblePages > 0) {
    return "visible";
  }
  if (
    publishingStatus === "published" &&
    (indexingStatus === "submitted" ||
      indexingStatus === "not_indexed" ||
      indexingStatus === "indexed" ||
      indexedPages > 0)
  ) {
    if (indexingStatus === "indexed" || indexedPages > 0) {
      return visibilityStatus === "visible" ? "visible" : "indexing";
    }
    return "indexing";
  }
  if (publishingStatus === "published") {
    return "published";
  }
  if (publishingStatus === "partial" || publishedPages > 0) {
    return "publishing";
  }
  if (ecosystemAvailable || masterReady) {
    return "ready";
  }
  return "draft";
}

function defaultNextAction(stage: CampaignExecutionStage, serviceName: string): string {
  switch (stage) {
    case "draft":
      return `Review content assets for ${serviceName}`;
    case "ready":
      return "Publish service pages";
    case "publishing":
      return `Complete publishing for ${serviceName} pages`;
    case "published":
      return "Submit pages for indexing";
    case "indexing":
      return "Refresh visibility tracking";
    case "visible":
      return "Review growth opportunities";
    case "complete":
      return "Monitor campaign performance";
    default:
      return "Review campaign status";
  }
}

function resolveNextAction(slug: string, serviceId: string, serviceName: string, stage: CampaignExecutionStage): string {
  const plan = readPharmacyGrowthActionPlan(slug);
  if (plan?.topPriorityActions.length) {
    const match =
      plan.topPriorityActions.find(
        (a) =>
          a.linkedUrl.includes(serviceId) ||
          a.title.toLowerCase().includes(serviceName.toLowerCase()) ||
          (stage === "indexing" && a.category === "Indexing") ||
          (stage === "visible" && a.category === "Visibility") ||
          (stage === "published" && a.category === "Publishing") ||
          (stage === "ready" && a.category === "Content"),
      ) || plan.topPriorityActions[0];
    if (match?.recommendedNextStep) return match.recommendedNextStep;
    if (match?.title) return match.title;
  }
  return defaultNextAction(stage, serviceName);
}

export function computeCampaignExecution(
  slug: string,
  campaign: Pick<
    PharmacyCampaign,
    "serviceId" | "serviceName" | "campaignGoal" | "createdAt" | "assetCounts"
  >,
): CampaignExecutionState {
  const live = resolveLiveCounts(slug, campaign.serviceId);
  const stage = detectCampaignExecutionStage(live);
  const progressPct = STAGE_PROGRESS[stage];

  return {
    stage,
    progressPct,
    nextAction: resolveNextAction(slug, campaign.serviceId, campaign.serviceName, stage),
    statusBadge: stage.charAt(0).toUpperCase() + stage.slice(1),
    tracks: {
      contentAssets: {
        label: "Content Assets",
        status: live.ecosystemAvailable ? "available" : live.masterReady ? "master ready" : "draft",
        count: live.ecosystemAvailable ? live.ecosystemAssetCount : campaign.assetCounts.total,
        lastUpdated: live.contentLastUpdated,
      },
      publishing: {
        label: "Publishing",
        status: live.publishingStatus,
        count: live.publishedPages,
        lastUpdated: live.publishLastUpdated,
      },
      indexing: {
        label: "Indexing",
        status: live.indexingStatus,
        count: live.indexedPages,
        lastUpdated: live.indexingLastUpdated,
      },
      visibility: {
        label: "Visibility",
        status: live.visibilityStatus,
        count: live.visiblePages,
        lastUpdated: live.visibilityLastUpdated,
      },
    },
  };
}

export function enrichCampaignWithExecution(slug: string, campaign: PharmacyCampaign): PharmacyCampaignWithExecution {
  const live = resolveLiveCounts(slug, campaign.serviceId);
  const execution = computeCampaignExecution(slug, campaign);
  return {
    ...campaign,
    publishedPages: live.publishedPages,
    indexedPages: live.indexedPages,
    visiblePages: live.visiblePages,
    publishingStatus: live.publishingStatus,
    indexingStatus: live.indexingStatus,
    visibilityStatus: live.visibilityStatus,
    execution,
  };
}

export function enrichCampaignsWithExecution(
  slug: string,
  campaigns: PharmacyCampaign[],
): PharmacyCampaignWithExecution[] {
  return campaigns.map((c) => enrichCampaignWithExecution(slug, c));
}
