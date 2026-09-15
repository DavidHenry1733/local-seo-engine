/**
 * Campaign Operating System V1 — health score, timeline, inventory, performance, readiness.
 * Reads existing bridge data only — no content generation.
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildOutputs,
  type PharmacyCampaign,
  type CampaignOutputItem,
} from "./pharmacyCampaignService.ts";
import { computeProfileCompleteness } from "./pharmacyProfileCompleteness.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { readPharmacyRegistry } from "./pharmacyIndexingBridgeService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { readPharmacyGrowthActionPlan } from "./pharmacyGrowthActionPlanService.ts";
import { getCampaignImageSummary } from "./pharmacyCampaignImageStatusService.ts";
import type { CampaignLaunchQueueEntry } from "./pharmacyCampaignLaunchQueueService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  getAuthorityPublishGateSnapshot,
  type AuthorityReadinessLabel,
  type PublishGate,
} from "./pharmacyAuthorityReadinessService.ts";

export type CampaignHealthLabel = "Excellent" | "Good" | "Building" | "Needs Attention";

export interface CampaignHealthFactor {
  id: string;
  label: string;
  score: number;
  maxScore: number;
}

export interface CampaignHealthScore {
  score: number;
  label: CampaignHealthLabel;
  factors: CampaignHealthFactor[];
}

export interface CampaignTimelineStage {
  id: string;
  label: string;
  status: "complete" | "current" | "pending";
  dateAchieved: string | null;
  nextMilestone: string | null;
}

export interface CampaignAssetInventoryItem {
  id: string;
  label: string;
  status: "available" | "missing";
  source: CampaignOutputItem["source"];
  count: number;
}

export interface CampaignPerformanceSummary {
  publishedPages: number;
  indexedPages: number;
  visibilityScore: number;
  visibilityStatus: string;
  openActions: number;
  totalActions: number;
  links: {
    publishing: string;
    indexing: string;
    visibility: string;
    growthActions: string;
  };
}

export interface CampaignReadiness {
  status: "ready_to_launch" | "blocked" | "preview_ready";
  label: string;
  blockers: string[];
  livePublishReady: boolean;
  livePublishLabel: string;
}

export interface CampaignAuthorityReadiness {
  score: number;
  label: AuthorityReadinessLabel;
  publishGate: PublishGate;
  launchImpact: string;
  topBlockers: string[];
  auditUrl: string;
}

export interface CampaignOperatingSystem {
  health: CampaignHealthScore;
  timeline: CampaignTimelineStage[];
  assetInventory: CampaignAssetInventoryItem[];
  performance: CampaignPerformanceSummary;
  authority: CampaignAuthorityReadiness;
  readiness: CampaignReadiness;
}

const INVENTORY_MAP: Array<{ id: string; label: string; outputId: string }> = [
  { id: "service-page", label: "Service Page", outputId: "service-page" },
  { id: "local-page", label: "Local Page", outputId: "local-service-page" },
  { id: "faq", label: "FAQ", outputId: "faq-page" },
  { id: "patient-guide", label: "Patient Guide", outputId: "patient-guide" },
  { id: "blogs", label: "Blogs", outputId: "blog-posts" },
  { id: "social-pack", label: "Social Pack", outputId: "social-posts" },
  { id: "gbp-pack", label: "GBP Pack", outputId: "gbp-posts" },
  { id: "email-pack", label: "Email Pack", outputId: "email-sequence" },
  { id: "video-script", label: "Video Script", outputId: "video-script" },
];

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

function healthLabel(score: number): CampaignHealthLabel {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 45) return "Building";
  return "Needs Attention";
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function computeHealthScore(input: {
  profileScore: number;
  imagesAssigned: number;
  imageTotal: number;
  ecosystemComplete: boolean;
  published: boolean;
  publishingPartial: boolean;
  indexed: boolean;
  indexingSubmitted: boolean;
  visibilityActive: boolean;
  visibilityBuilding: boolean;
  launchQueuePct: number;
}): CampaignHealthScore {
  const imageScore = input.imageTotal ? Math.round((input.imagesAssigned / input.imageTotal) * 100) : 0;
  const publishScore = input.published ? 100 : input.publishingPartial ? 50 : 0;
  const indexScore = input.indexed ? 100 : input.indexingSubmitted ? 50 : 0;
  const visibilityScore = input.visibilityActive ? 100 : input.visibilityBuilding ? 50 : 0;

  const factors: CampaignHealthFactor[] = [
    { id: "profile", label: "Profile completeness", score: input.profileScore, maxScore: 100 },
    { id: "images", label: "Images assigned", score: imageScore, maxScore: 100 },
    { id: "ecosystem", label: "Ecosystem complete", score: input.ecosystemComplete ? 100 : 0, maxScore: 100 },
    { id: "published", label: "Published", score: publishScore, maxScore: 100 },
    { id: "indexed", label: "Indexed", score: indexScore, maxScore: 100 },
    { id: "visibility", label: "Visibility active", score: visibilityScore, maxScore: 100 },
    { id: "launch-queue", label: "Launch queue completion", score: input.launchQueuePct, maxScore: 100 },
  ];

  const score = Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length);
  return { score, label: healthLabel(score), factors };
}

function buildAssetInventory(slug: string, serviceId: string): CampaignAssetInventoryItem[] {
  const outputs = buildOutputs(slug, serviceId);
  const byId = new Map(outputs.map((o) => [o.id, o]));

  return INVENTORY_MAP.map(({ id, label, outputId }) => {
    const output = byId.get(outputId);
    const available = Boolean(output?.available && (output.count ?? 0) > 0);
    return {
      id,
      label,
      status: available ? "available" : "missing",
      source: output?.source || "blueprint",
      count: output?.count ?? 0,
    };
  });
}

function assetsReady(inventory: CampaignAssetInventoryItem[]): boolean {
  return inventory.every((item) => item.status === "available");
}

function resolveTimeline(input: {
  createdAt: string;
  ecosystemGeneratedAt: string | null;
  assetsReady: boolean;
  publishedAt: string | null;
  submittedAt: string | null;
  indexedAt: string | null;
  visibleAt: string | null;
  visibilityActive: boolean;
  optimised: boolean;
  optimisedAt: string | null;
}): CampaignTimelineStage[] {
  const stages: Omit<CampaignTimelineStage, "status" | "nextMilestone">[] = [
    { id: "created", label: "Campaign Created", dateAchieved: input.createdAt },
    { id: "assets-ready", label: "Assets Ready", dateAchieved: input.assetsReady ? input.ecosystemGeneratedAt : null },
    { id: "published", label: "Published", dateAchieved: input.publishedAt },
    { id: "submitted", label: "Submitted", dateAchieved: input.submittedAt },
    { id: "indexed", label: "Indexed", dateAchieved: input.indexedAt },
    { id: "visible", label: "Visible", dateAchieved: input.visibilityActive ? input.visibleAt : null },
    { id: "optimised", label: "Optimised", dateAchieved: input.optimised ? input.optimisedAt : null },
  ];

  const completeFlags = [
    true,
    input.assetsReady,
    Boolean(input.publishedAt),
    Boolean(input.submittedAt),
    Boolean(input.indexedAt),
    input.visibilityActive,
    input.optimised,
  ];

  let currentIdx = completeFlags.findIndex((done, i) => !done);
  if (currentIdx === -1) currentIdx = stages.length - 1;

  return stages.map((stage, i) => {
    const complete = completeFlags[i]!;
    const status: CampaignTimelineStage["status"] = complete
      ? "complete"
      : i === currentIdx
        ? "current"
        : "pending";
    const next = stages[i + 1];
    return {
      ...stage,
      status,
      nextMilestone: status === "current" && next ? next.label : null,
    };
  });
}

function computeReadiness(input: {
  profileComplete: boolean;
  imagesComplete: boolean;
  published: boolean;
  indexed: boolean;
  authorityPublishGate: PublishGate;
  authorityBlockers: string[];
}): CampaignReadiness {
  const blockers: string[] = [];
  if (!input.profileComplete) blockers.push("Missing profile data");
  if (!input.imagesComplete) blockers.push("Missing images");
  if (!input.published) blockers.push("Missing publishing");
  if (!input.indexed) blockers.push("Missing indexing");

  const authorityBlocked = input.authorityPublishGate === "FAIL";
  const livePublishReady = !authorityBlocked;

  if (authorityBlocked) {
    const authorityBlockers =
      input.authorityBlockers.length > 0 ? input.authorityBlockers : ["Authority & AI Readiness publish gate failed"];
    const previewReady = input.profileComplete && input.imagesComplete;
    return {
      status: previewReady && blockers.length <= 2 ? "preview_ready" : "blocked",
      label: "Not Ready For Live Publish",
      blockers: authorityBlockers,
      livePublishReady: false,
      livePublishLabel: "Not Ready For Live Publish",
    };
  }

  if (blockers.length === 0) {
    return {
      status: "ready_to_launch",
      label: "Ready To Launch",
      blockers: [],
      livePublishReady: true,
      livePublishLabel: "Ready For Live Publish",
    };
  }
  return {
    status: "blocked",
    label: "Blocked",
    blockers,
    livePublishReady: true,
    livePublishLabel: input.authorityPublishGate === "PASS_WITH_RECOMMENDATIONS" ? "Live Publish With Recommendations" : "Ready For Live Publish",
  };
}

export function buildCampaignOperatingSystem(
  slug: string,
  campaign: PharmacyCampaign,
  launchQueue: CampaignLaunchQueueEntry | null,
): CampaignOperatingSystem {
  const s = safeSlug(slug);
  const { serviceId } = campaign;

  const profileDoc = loadPharmacyProfile(s);
  const profileData = normalizeProfileData((profileDoc?.data || profileDoc || {}) as Record<string, unknown>);
  const profile = computeProfileCompleteness(profileData, s);
  const imageSummary = getCampaignImageSummary(s, serviceId);
  const ecoPath = ecosystemIndexPath(s, serviceId);
  const eco = readJson<{ generatedAt?: string }>(ecoPath);
  const ecosystemComplete = fs.existsSync(ecoPath);

  const publishIndex = readJson<{ pages: Array<{ serviceId: string; generatedAt?: string; pageType: string }> }>(
    publishIndexPath(s),
  );
  const publishPages = (publishIndex?.pages || []).filter((p) => p.serviceId === serviceId);
  const publishedAt =
    publishPages.reduce<string | null>((latest, p) => {
      if (!p.generatedAt) return latest;
      return !latest || p.generatedAt > latest ? p.generatedAt : latest;
    }, null) || null;

  const registry = readPharmacyRegistry(s);
  const rootPage =
    registry?.pages.find((p) => p.serviceId === serviceId && p.pageType === "service") ||
    registry?.pages.find((p) => p.serviceId === serviceId) ||
    null;

  const visibilityReport = readPharmacyVisibilityReport(s);
  const visibilityService = visibilityReport?.services.find((svc) => svc.serviceId === serviceId);
  const growthPlan = readPharmacyGrowthActionPlan(s);

  const serviceActions = (growthPlan?.actions || []).filter(
    (a) => a.linkedUrl.includes(serviceId) || a.evidence.some((e) => e.includes(serviceId)),
  );
  const openActions = serviceActions.filter((a) => a.status === "pending" || a.status === "in_progress").length;
  const totalActions = serviceActions.length || growthPlan?.totalActions || 0;
  const pendingFallback = growthPlan?.pendingActions ?? 0;

  const assetInventory = buildAssetInventory(s, serviceId);
  const allAssetsReady = assetsReady(assetInventory);
  const launchQueuePct = launchQueue?.progressPct ?? 0;
  const optimised = launchQueuePct >= 100 && (growthPlan?.totalActions ?? 0) > 0;

  const published = campaign.publishingStatus === "published" || campaign.publishedPages > 0;
  const indexed = campaign.indexingStatus === "indexed";
  const indexingSubmitted = campaign.indexingStatus === "submitted" || indexed;
  const visibilityActive = campaign.visibilityStatus === "visible";
  const visibilityBuilding = campaign.visibilityStatus === "building";

  const health = computeHealthScore({
    profileScore: profile.score,
    imagesAssigned: imageSummary.assignedCount,
    imageTotal: imageSummary.totalSlots,
    ecosystemComplete,
    published: campaign.publishingStatus === "published",
    publishingPartial: campaign.publishingStatus === "partial",
    indexed,
    indexingSubmitted,
    visibilityActive,
    visibilityBuilding,
    launchQueuePct,
  });

  const timeline = resolveTimeline({
    createdAt: campaign.createdAt,
    ecosystemGeneratedAt: eco?.generatedAt || null,
    assetsReady: allAssetsReady && imageSummary.allAssigned,
    publishedAt,
    submittedAt: rootPage?.submittedAt || null,
    indexedAt: rootPage?.indexedAt || null,
    visibleAt: visibilityReport?.lastCheckedAt || null,
    visibilityActive,
    optimised,
    optimisedAt: growthPlan?.lastUpdated || null,
  });

  const performance: CampaignPerformanceSummary = {
    publishedPages: campaign.publishedPages,
    indexedPages: campaign.indexedPages,
    visibilityScore: visibilityReport?.estimatedVisibilityScore ?? 0,
    visibilityStatus: visibilityService?.visibilityStatus || campaign.visibilityStatus,
    openActions: openActions || pendingFallback,
    totalActions,
    links: {
      publishing: `/api/pharmacy-executive-dashboard?slug=${s}`,
      indexing: campaign.links.indexing,
      visibility: campaign.links.visibility,
      growthActions: `/api/pharmacy-growth-actions?slug=${s}`,
    },
  };

  const authoritySnapshot = getAuthorityPublishGateSnapshot(s, serviceId);
  const authority: CampaignAuthorityReadiness = {
    score: authoritySnapshot.overallScore,
    label: authoritySnapshot.label,
    publishGate: authoritySnapshot.publishGate,
    launchImpact: authoritySnapshot.launchImpact,
    topBlockers: authoritySnapshot.topBlockers,
    auditUrl: authoritySnapshot.auditUrl,
  };

  const readiness = computeReadiness({
    profileComplete: profile.score >= 80,
    imagesComplete: imageSummary.allAssigned,
    published: published && campaign.publishingStatus !== "pending",
    indexed,
    authorityPublishGate: authority.publishGate,
    authorityBlockers: authority.topBlockers,
  });

  return { health, timeline, assetInventory, performance, authority, readiness };
}

export function formatOperatingSystemDate(iso: string | null): string {
  return formatDate(iso) || "—";
}
