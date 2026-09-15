/**
 * PharmaConnect Platform Dashboard V1 — orchestrates existing module data into one user-facing view.
 * No content generation; read-only aggregation only.
 */
import fs from "node:fs";
import path from "node:path";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { normalizeProfileData, auditPharmacyProfile } from "./pharmacyProfileSchema.ts";
import { computeProfileCompleteness } from "./pharmacyProfileCompleteness.ts";
import { isRequiredProfileComplete } from "./pharmacyProfileFieldClassification.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import {
  buildPharmacyCampaignControlCentre,
  resolvePrimaryActiveCampaign,
  type PharmacyCampaignEnriched,
} from "./pharmacyCampaignControlCentreService.ts";
import { buildOutputs } from "./pharmacyCampaignService.ts";
import { getServicePublishingSettings } from "./pharmacyPublishingSettingsService.ts";
import {
  isReviewerProfileComplete,
  validateRealEnhancementAction,
  type RealEnhancementActionType,
} from "./pharmacyRealEnhancementActionsService.ts";
import { getEnhancementWorkspaceProgress } from "./pharmacyEnhancementWorkspaceService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { readPharmacyRegistry, readPharmacyIndexingSummary } from "./pharmacyIndexingBridgeService.ts";
import { readPharmacyGrowthActionPlan } from "./pharmacyGrowthActionPlanService.ts";
import { getServiceAuthorityAudit, type PublishGate, type ServiceAuthorityAudit } from "./pharmacyAuthorityReadinessService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  buildPlatformOperatingSystem,
  type PlatformOperatingSystem,
  type PlatformOsStepState,
  type PlatformOsStepStatus,
} from "./pharmacyPlatformOperatingSystemService.ts";
import {
  getCampaignCoverageSummary,
  type CampaignCoverageSummary,
} from "./pharmacyCampaignService.ts";
import { listStaleCampaigns, type CampaignStaleStatus } from "./pharmacyCampaignStaleService.ts";

export const PRIMARY_PLATFORM_SERVICE_ID = "blood-pressure-checks";
/** @deprecated Resolve via resolvePrimaryActiveCampaign() — do not use in navigation links. */
export const PRIMARY_PLATFORM_CAMPAIGN_ID = "2e5cf653-7df3-4918-96f8-c99d687b764b";

export type WorkflowStepStatus = "complete" | "in_progress" | "blocked" | "not_started";
export type AssetRowStatus = "available" | "missing" | "review_needed";

export interface PlatformDashboardIdentity {
  logoUrl: string;
  pharmacyName: string;
  town: string;
  phone: string;
  profileCompletenessPct: number;
  trustStatus: "verified" | "needs_attention" | "demo";
  trustLabel: string;
  launchReadiness: PublishGate;
  launchReadinessLabel: string;
}

export interface PlatformDashboardNextAction {
  label: string;
  description: string;
  url: string;
  priority: number;
}

export interface PlatformDashboardWorkflowStep {
  id: string;
  label: string;
  status: WorkflowStepStatus;
  detail: string;
  url: string | null;
}

export interface PlatformDashboardBlocker {
  id: string;
  source: string;
  summary: string;
  url: string | null;
}

export interface PlatformDashboardQuickLink {
  id: string;
  label: string;
  url: string;
}

export interface PlatformDashboardAssetRow {
  id: string;
  label: string;
  status: AssetRowStatus;
  count: number;
}

export interface PlatformDashboardCurrentCampaign {
  id: string;
  name: string;
  serviceId: string;
  serviceName: string;
  status: string;
  areas: string[];
  completionPct: number;
  publishGate: PublishGate;
  authorityScore: number;
  visibilityStatus: string;
  indexingStatus: string;
  publishingStatus: string;
  detailUrl: string;
}

export interface PlatformDashboardResults {
  indexedStatus: string;
  visibilityScore: number;
  trackedKeywords: number;
  growthActionsPending: number;
  growthActionsTotal: number;
  lastRefresh: string | null;
  nextMonitoringAction: string;
}

export interface PlatformDashboardOperatorNotes {
  loginUrl: string;
  previewUrl: string;
  testCampaign: string;
  testServiceId: string;
  warnings: string[];
}

export type { PlatformOsStepStatus, PlatformOsStepState, PlatformOperatingSystem };
export { buildPlatformOperatingSystem, resolveNextOsStep };

export interface PharmacyPlatformDashboard {
  slug: string;
  pharmacyName: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandCtaColor: string;
  identity: PlatformDashboardIdentity;
  setupHeadline: string;
  currentCampaign: PlatformDashboardCurrentCampaign | null;
  nextAction: PlatformDashboardNextAction;
  operatingSystem: PlatformOperatingSystem;
  campaignCoverage: CampaignCoverageSummary;
  staleCampaigns: CampaignStaleStatus[];
  workflow: PlatformDashboardWorkflowStep[];
  blockers: PlatformDashboardBlocker[];
  quickLinks: PlatformDashboardQuickLink[];
  assets: PlatformDashboardAssetRow[];
  results: PlatformDashboardResults;
  operatorNotes: PlatformDashboardOperatorNotes;
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

function ecosystemExists(slug: string, serviceId: string): boolean {
  return fs.existsSync(
    path.join(WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", safeSlug(slug), serviceId, "_ecosystem-index.json"),
  );
}

function realEnhancementPending(slug: string, serviceId: string): { pending: boolean; label: string; url: string } {
  const progress = getEnhancementWorkspaceProgress(slug, serviceId);
  if (progress.nextRecommendedRealAction) {
    return {
      pending: true,
      label: progress.nextRecommendedRealAction.label,
      url: progress.nextRecommendedRealAction.url,
    };
  }
  const types: RealEnhancementActionType[] = [
    "reviewer_profile",
    "clinical_review_date",
    "next_review_date",
    "image_assignment",
    "canonical",
    "noindex",
  ];
  for (const actionType of types) {
    const result = validateRealEnhancementAction(slug, serviceId, {
      signalId: actionType === "canonical" ? "tq-canonical" : actionType === "noindex" ? "tq-no-noindex" : `he-${actionType}`,
      title: actionType.replace(/_/g, " "),
    });
    if (!result.valid) {
      const urls: Record<RealEnhancementActionType, string> = {
        reviewer_profile: `/api/pharmacy-profile-dashboard?slug=${slug}#section-professional-review`,
        clinical_review_date: `/api/pharmacy-profile-dashboard?slug=${slug}#section-professional-review`,
        next_review_date: `/api/pharmacy-profile-dashboard?slug=${slug}#section-professional-review`,
        image_assignment: `/api/pharmacy-image-library?slug=${slug}&service=${serviceId}`,
        canonical: `/api/pharmacy-publishing-settings?slug=${slug}&service=${serviceId}`,
        noindex: `/api/pharmacy-publishing-settings?slug=${slug}&service=${serviceId}`,
      };
      const labels: Record<RealEnhancementActionType, string> = {
        reviewer_profile: "Complete Professional Review",
        clinical_review_date: "Set Clinical Review Date",
        next_review_date: "Set Next Review Date",
        image_assignment: "Assign Images",
        canonical: "Set Canonical URL",
        noindex: "Remove Noindex",
      };
      return { pending: true, label: labels[actionType], url: urls[actionType] };
    }
  }
  return { pending: false, label: "", url: "" };
}

function resolveNextBestAction(input: {
  slug: string;
  serviceId: string;
  profile: ReturnType<typeof normalizeProfileData>;
  completeness: ReturnType<typeof computeProfileCompleteness>;
  campaign: PharmacyCampaignEnriched | null;
  publishing: ReturnType<typeof getServicePublishingSettings>;
  audit: ReturnType<typeof getServiceAuthorityAudit>;
  growth: ReturnType<typeof readPharmacyGrowthActionPlan>;
}): PlatformDashboardNextAction {
  const { slug, serviceId, profile, completeness, campaign, publishing, audit, growth } = input;
  const s = safeSlug(slug);

  type Candidate = PlatformDashboardNextAction & { test: () => boolean };
  const candidates: Candidate[] = [
    {
      priority: 1,
      label: "Complete Profile",
      description: "Finish required pharmacy profile fields before launching your campaign.",
      url: `/api/pharmacy-profile-dashboard?slug=${s}`,
      test: () => !isRequiredProfileComplete(profile),
    },
    {
      priority: 2,
      label: "Complete Trust Profile",
      description: "Verify GPhC, superintendent and trust credentials in your profile.",
      url: `/api/pharmacy-profile-dashboard?slug=${s}#section-trust`,
      test: () =>
        profile.demoMode ||
        !profile.gphcNumber ||
        !profile.superintendentPharmacistName ||
        profile.trustDataStatus === "mock",
    },
    {
      priority: 3,
      label: "Create Campaign",
      description: "Create a service campaign to begin your growth workflow.",
      url: `/api/pharmacy-campaigns?slug=${s}`,
      test: () => !campaign,
    },
    {
      priority: 4,
      label: "Select Coverage Areas",
      description: "Add ranking and nearby areas so local pages can target the right patients.",
      url: `/api/pharmacy-profile-dashboard?slug=${s}#section-coverage`,
      test: () => profile.rankingAreas.length === 0,
    },
    {
      priority: 5,
      label: "Assign Images",
      description: "Assign hero, support, trust and conversion images for your service page.",
      url: `/api/pharmacy-image-library?slug=${s}&service=${serviceId}`,
      test: () => (campaign?.imageAssignedCount ?? 0) < 4,
    },
    {
      priority: 6,
      label: "Review Content Ecosystem",
      description: "Open your content ecosystem and confirm supporting assets are available.",
      url: `/api/pharmacy-content-ecosystem-preview/${serviceId}/?slug=${s}`,
      test: () => !ecosystemExists(s, serviceId),
    },
    {
      priority: 7,
      label: "Review Authority Recommendations",
      description: "Resolve authority publish gate blockers before live publish.",
      url: `/api/pharmacy-authority-readiness?slug=${s}&service=${serviceId}`,
      test: () => audit.publishGate === "FAIL",
    },
    {
      priority: 8,
      label: "Complete Enhancement Action",
      description: "Finish the next real enhancement action in your workspace.",
      url: `/api/pharmacy-enhancement-workspace?slug=${s}&service=${serviceId}`,
      test: () => realEnhancementPending(s, serviceId).pending,
    },
    {
      priority: 9,
      label: "Set Canonical URL",
      description: "Configure the live canonical URL for this service page.",
      url: `/api/pharmacy-publishing-settings?slug=${s}&service=${serviceId}`,
      test: () => !publishing?.canonicalUrl,
    },
    {
      priority: 10,
      label: "Remove Noindex",
      description: "Allow search engines to index your published service page.",
      url: `/api/pharmacy-publishing-settings?slug=${s}&service=${serviceId}`,
      test: () => publishing?.noindex !== false,
    },
    {
      priority: 11,
      label: "Review Launch Blockers",
      description: "Clear remaining launch queue blockers before going live.",
      url: `/api/pharmacy-campaign-launch-queue?slug=${s}`,
      test: () => audit.publishGate === "FAIL" || audit.criticalIssues.length > 0,
    },
    {
      priority: 12,
      label: "Publish Campaign",
      description: "Publish your service page and supporting assets.",
      url: campaign?.id
        ? `/api/pharmacy-campaigns?slug=${s}&campaignId=${campaign.id}`
        : `/api/pharmacy-campaigns?slug=${s}`,
      test: () => campaign != null && campaign.publishingStatus !== "published",
    },
    {
      priority: 13,
      label: "Submit For Indexing",
      description: "Submit your published page to the indexing queue.",
      url: `/api/pharmacy-growth-dashboard?slug=${s}#indexing`,
      test: () =>
        campaign != null &&
        !["submitted", "indexed"].includes(campaign.indexingStatus) &&
        campaign.indexingStatus !== "ready_to_submit",
    },
    {
      priority: 14,
      label: "Refresh Indexing Status",
      description: "Check whether Google has indexed your service page.",
      url: `/api/pharmacy-growth-dashboard?slug=${s}#indexing`,
      test: () => campaign != null && campaign.indexingStatus === "submitted",
    },
    {
      priority: 15,
      label: "Refresh Visibility",
      description: "Update keyword visibility tracking for this service.",
      url: `/api/pharmacy-growth-dashboard?slug=${s}#visibility`,
      test: () => campaign != null && campaign.visibilityStatus !== "visible",
    },
    {
      priority: 16,
      label: "Review Growth Actions",
      description: "Work through pending growth actions to improve local visibility.",
      url: `/api/pharmacy-growth-actions?slug=${s}`,
      test: () => (growth?.pendingActions ?? 0) > 0,
    },
  ];

  for (const c of candidates.sort((a, b) => a.priority - b.priority)) {
    if (c.test()) {
      if (c.priority === 8) {
        const real = realEnhancementPending(s, serviceId);
        return {
          priority: c.priority,
          label: real.label || c.label,
          description: c.description,
          url: real.url || c.url,
        };
      }
      return { priority: c.priority, label: c.label, description: c.description, url: c.url };
    }
  }

  return {
    priority: 99,
    label: "Review Growth Monitoring",
    description: "Your campaign workflow is complete — review visibility and growth monitoring.",
    url: `/api/pharmacy-growth-dashboard?slug=${s}`,
  };
}

function buildWorkflowSteps(input: {
  slug: string;
  serviceId: string;
  profile: ReturnType<typeof normalizeProfileData>;
  completeness: ReturnType<typeof computeProfileCompleteness>;
  campaign: PharmacyCampaignEnriched | null;
  publishing: ReturnType<typeof getServicePublishingSettings>;
  audit: ReturnType<typeof getServiceAuthorityAudit>;
  growth: ReturnType<typeof readPharmacyGrowthActionPlan>;
}): PlatformDashboardWorkflowStep[] {
  const { slug, serviceId, profile, completeness, campaign, publishing, audit, growth } = input;
  const s = safeSlug(slug);
  const realPending = realEnhancementPending(s, serviceId).pending;
  const eco = ecosystemExists(s, serviceId);

  const step = (
    id: string,
    label: string,
    status: WorkflowStepStatus,
    detail: string,
    url: string | null,
  ): PlatformDashboardWorkflowStep => ({ id, label, status, detail, url });

  return [
    step(
      "profile",
      "Profile",
      completeness.score >= 100 ? "complete" : completeness.score >= 70 ? "in_progress" : "not_started",
      `${completeness.score}% complete`,
      `/api/pharmacy-profile-dashboard?slug=${s}`,
    ),
    step(
      "campaign",
      "Campaign",
      campaign ? "complete" : "not_started",
      campaign?.name || "No campaign",
      `/api/pharmacy-campaigns?slug=${s}`,
    ),
    step(
      "areas",
      "Areas",
      profile.rankingAreas.length > 0 ? "complete" : "not_started",
      profile.rankingAreas.join(", ") || "No areas selected",
      `/api/pharmacy-profile-dashboard?slug=${s}#section-coverage`,
    ),
    step(
      "images",
      "Images",
      (campaign?.imageAssignedCount ?? 0) >= 4 ? "complete" : (campaign?.imageAssignedCount ?? 0) > 0 ? "in_progress" : "not_started",
      `${campaign?.imageAssignedCount ?? 0}/4 slots`,
      `/api/pharmacy-image-library?slug=${s}&service=${serviceId}`,
    ),
    step(
      "content",
      "Content Review",
      eco ? "complete" : "not_started",
      eco ? "Ecosystem available" : "Ecosystem not generated",
      `/api/pharmacy-content-ecosystem-preview/${serviceId}/?slug=${s}`,
    ),
    step(
      "qa",
      "QA",
      campaign && campaign.publishingStatus === "published" ? "complete" : campaign ? "in_progress" : "not_started",
      campaign?.publishingStatus || "pending",
      campaign?.id
        ? `/api/pharmacy-campaigns?slug=${s}&campaignId=${campaign.id}`
        : `/api/pharmacy-campaigns?slug=${s}`,
    ),
    step(
      "authority",
      "Authority",
      audit.publishGate === "PASS" ? "complete" : audit.publishGate === "FAIL" ? "blocked" : "in_progress",
      `Score ${audit.overallScore} · ${audit.publishGate.replace(/_/g, " ")}`,
      `/api/pharmacy-authority-readiness?slug=${s}&service=${serviceId}`,
    ),
    step(
      "enhancements",
      "Enhancements",
      realPending ? "in_progress" : "complete",
      realPending ? "Real actions pending" : "Real actions complete",
      `/api/pharmacy-enhancement-workspace?slug=${s}&service=${serviceId}`,
    ),
    step(
      "publish",
      "Publish",
      campaign?.publishingStatus === "published" ? "complete" : audit.criticalIssues.length > 0 ? "blocked" : "in_progress",
      campaign?.publishingStatus || "pending",
      `/api/pharmacy-publishing-settings?slug=${s}&service=${serviceId}`,
    ),
    step(
      "index",
      "Index",
      campaign?.indexingStatus === "indexed" ? "complete" : campaign?.indexingStatus === "submitted" ? "in_progress" : "not_started",
      campaign?.indexingStatus?.replace(/_/g, " ") || "not started",
      `/api/pharmacy-growth-dashboard?slug=${s}#indexing`,
    ),
    step(
      "visibility",
      "Visibility",
      campaign?.visibilityStatus === "visible" ? "complete" : campaign?.visibilityStatus === "building" ? "in_progress" : "not_started",
      campaign?.visibilityStatus?.replace(/_/g, " ") || "not tracked",
      `/api/pharmacy-growth-dashboard?slug=${s}#visibility`,
    ),
    step(
      "growth",
      "Growth Monitoring",
      (growth?.pendingActions ?? 0) === 0 && (growth?.totalActions ?? 0) > 0 ? "complete" : (growth?.pendingActions ?? 0) > 0 ? "in_progress" : "not_started",
      growth ? `${growth.pendingActions} pending actions` : "No plan",
      `/api/pharmacy-growth-actions?slug=${s}`,
    ),
  ];
}

function collectBlockers(input: {
  slug: string;
  serviceId: string;
  profile: ReturnType<typeof normalizeProfileData>;
  completeness: ReturnType<typeof computeProfileCompleteness>;
  campaign: PharmacyCampaignEnriched | null;
  publishing: ReturnType<typeof getServicePublishingSettings>;
  audit: ReturnType<typeof getServiceAuthorityAudit>;
}): PlatformDashboardBlocker[] {
  const { slug, serviceId, profile, completeness, campaign, publishing, audit } = input;
  const s = safeSlug(slug);
  const blockers: PlatformDashboardBlocker[] = [];

  for (const item of completeness.missingItems.slice(0, 3)) {
    blockers.push({
      id: `profile-${blockers.length}`,
      source: "Profile Completeness",
      summary: item,
      url: `/api/pharmacy-profile-dashboard?slug=${s}`,
    });
  }
  if (profile.demoMode) {
    blockers.push({
      id: "trust-demo",
      source: "Trust Profile",
      summary: "Profile still marked as demo mode",
      url: `/api/pharmacy-profile-dashboard?slug=${s}#section-trust`,
    });
  }
  for (const issue of audit.criticalIssues) {
    blockers.push({
      id: `authority-${blockers.length}`,
      source: "Authority Publish Gate",
      summary: issue,
      url: `/api/pharmacy-authority-readiness?slug=${s}&service=${serviceId}`,
    });
  }
  if (campaign?.launchQueue) {
    for (const task of campaign.launchQueue.tasks.filter((t) => t.status === "blocked").slice(0, 4)) {
      blockers.push({
        id: `launch-${task.id}`,
        source: "Launch Queue",
        summary: task.blockedReason || task.title,
        url: `/api/pharmacy-campaign-launch-queue?slug=${s}`,
      });
    }
  }
  if (!publishing?.canonicalUrl) {
    blockers.push({
      id: "pub-canonical",
      source: "Publishing Settings",
      summary: "Canonical URL not configured",
      url: `/api/pharmacy-publishing-settings?slug=${s}&service=${serviceId}`,
    });
  }
  if (publishing?.noindex !== false) {
    blockers.push({
      id: "pub-noindex",
      source: "Publishing Settings",
      summary: "Page marked noindex — not indexable for live publish",
      url: `/api/pharmacy-publishing-settings?slug=${s}&service=${serviceId}`,
    });
  }
  if ((campaign?.imageAssignedCount ?? 0) < 4) {
    blockers.push({
      id: "images-missing",
      source: "Image Readiness",
      summary: `${campaign?.imageAssignedCount ?? 0}/4 image slots assigned`,
      url: `/api/pharmacy-image-library?slug=${s}&service=${serviceId}`,
    });
  }

  return blockers;
}

function buildQuickLinks(slug: string, serviceId: string): PlatformDashboardQuickLink[] {
  const s = safeSlug(slug);
  return [
    { id: "platform-dashboard", label: "Platform Dashboard", url: `/api/pharmacy-dashboard?slug=${s}` },
    { id: "profile", label: "Profile Dashboard", url: `/api/pharmacy-profile-dashboard?slug=${s}` },
    { id: "campaign-os", label: "Campaign OS", url: `/api/pharmacy-campaigns?slug=${s}` },
    { id: "images", label: "Image Library", url: `/api/pharmacy-image-library?slug=${s}&service=${serviceId}` },
    { id: "authority", label: "Content Review", url: `/api/pharmacy-authority-readiness?slug=${s}&service=${serviceId}` },
    { id: "enhancement", label: "Campaign Improvements", url: `/api/pharmacy-enhancement-workspace?slug=${s}&service=${serviceId}` },
    { id: "growth-dashboard", label: "Growth Dashboard", url: `/api/pharmacy-growth-dashboard?slug=${s}` },
    { id: "publishing", label: "Ready To Publish", url: `/api/pharmacy-publishing-settings?slug=${s}&service=${serviceId}` },
    { id: "indexing", label: "Indexing", url: `/api/pharmacy-growth-dashboard?slug=${s}#indexing` },
    { id: "visibility", label: "Search Visibility", url: `/api/pharmacy-growth-dashboard?slug=${s}#visibility` },
    { id: "growth", label: "Recommended Improvements", url: `/api/pharmacy-growth-actions?slug=${s}` },
  ];
}

function mapAssetStatus(id: string, available: boolean, count: number): AssetRowStatus {
  if (!available || count === 0) return "missing";
  if (id === "service-page" || id === "local-service-page") return "available";
  return count > 0 ? "available" : "review_needed";
}

export function buildPharmacyPlatformDashboard(
  slug: string,
  options?: { primaryServiceId?: string; primaryCampaignId?: string },
): PharmacyPlatformDashboard {
  const s = safeSlug(slug);
  const serviceId = options?.primaryServiceId || PRIMARY_PLATFORM_SERVICE_ID;

  const profileDoc = loadPharmacyProfile(s);
  const profile = normalizeProfileData((profileDoc?.data || profileDoc || {}) as Record<string, unknown>);
  const pageProfile = buildPharmacyServicePageProfile(s);
  const completeness = computeProfileCompleteness(profile, s);
  const profileAudit = auditPharmacyProfile(s, profile);
  const centre = buildPharmacyCampaignControlCentre(s);
  const resolvedCampaign = resolvePrimaryActiveCampaign(s, options?.primaryCampaignId);
  const campaign =
    resolvedCampaign.campaign ||
    centre.campaigns.find((c) => c.serviceId === serviceId && c.status === "active") ||
    centre.primaryCampaign ||
    null;
  const publishing = getServicePublishingSettings(s, serviceId);
  const auditRaw = getServiceAuthorityAudit(s, serviceId);
  const audit = auditRaw || {
    serviceId,
    serviceName: serviceId,
    pageUrl: "",
    overallScore: 0,
    label: "Not Ready" as const,
    publishGate: "FAIL" as PublishGate,
    categoryScores: {} as ServiceAuthorityAudit["categoryScores"],
    missingSignals: [],
    criticalIssues: ["Authority audit not available"],
    recommendedEnhancements: [],
    evidence: {} as ServiceAuthorityAudit["evidence"],
    lastAuditedAt: "",
  };
  const growth = readPharmacyGrowthActionPlan(s);
  const visibility = readPharmacyVisibilityReport(s);
  const indexing = readPharmacyIndexingSummary(s);
  const visibilitySvc = visibility?.services.find((svc) => svc.serviceId === serviceId);

  const trustStatus: PlatformDashboardIdentity["trustStatus"] = profile.demoMode
    ? "demo"
    : profileAudit.passed && isReviewerProfileComplete(profile)
      ? "verified"
      : "needs_attention";

  const identity: PlatformDashboardIdentity = {
    logoUrl: profile.logoUrl,
    pharmacyName: profile.pharmacyName || pageProfile.pharmacyName,
    town: profile.townCity || pageProfile.town,
    phone: profile.phone || pageProfile.phone,
    profileCompletenessPct: completeness.score,
    trustStatus,
    trustLabel: trustStatus === "verified" ? "Verified" : trustStatus === "demo" ? "Demo" : "Needs attention",
    launchReadiness: audit.publishGate,
    launchReadinessLabel: audit.publishGate.replace(/_/g, " "),
  };

  const completionPct = campaign?.operatingSystem?.health?.score ?? campaign?.execution?.progressPct ?? 0;

  const currentCampaign: PlatformDashboardCurrentCampaign | null = campaign
    ? {
        id: campaign.id,
        name: campaign.name,
        serviceId: campaign.serviceId,
        serviceName: campaign.serviceName,
        status: campaign.status,
        areas: profile.rankingAreas.slice(0, 6),
        completionPct,
        publishGate: campaign.authorityPublishGate,
        authorityScore: campaign.authorityScore,
        visibilityStatus: campaign.visibilityStatus,
        indexingStatus: campaign.indexingStatus,
        publishingStatus: campaign.publishingStatus,
        detailUrl: campaign.detailUrl,
      }
    : null;

  const shared = { slug: s, serviceId, profile, completeness, campaign, publishing, audit, growth };
  const operatingSystem = buildPlatformOperatingSystem(s, {
    primaryServiceId: serviceId,
    primaryCampaignId: options?.primaryCampaignId,
  });
  const campaignCoverage = getCampaignCoverageSummary(s);
  const staleCampaigns = listStaleCampaigns(s);
  const osNext = operatingSystem.nextStep;
  const nextAction: PlatformDashboardNextAction = osNext
    ? {
        priority: osNext.stepNumber,
        label: `Continue: ${osNext.title}`,
        description: osNext.explanation,
        url: osNext.url,
      }
    : {
        priority: 99,
        label: "Review Results",
        description: "Your campaign workflow is complete — monitor growth and visibility.",
        url: `/api/pharmacy-growth-dashboard?slug=${s}`,
      };
  const workflow = buildWorkflowSteps(shared);
  const blockers = collectBlockers(shared);
  const quickLinks = buildQuickLinks(s, serviceId);

  const outputIds = [
    "service-page",
    "local-service-page",
    "patient-guide",
    "faq-page",
    "blog-posts",
    "social-posts",
    "gbp-posts",
    "email-sequence",
    "video-script",
  ];
  const outputs = buildOutputs(s, serviceId);
  const assets: PlatformDashboardAssetRow[] = outputIds.map((id) => {
    const row = outputs.find((o) => o.id === id);
    return {
      id,
      label: row?.label || id,
      status: mapAssetStatus(id, row?.available ?? false, row?.count ?? 0),
      count: row?.count ?? 0,
    };
  });

  const results: PlatformDashboardResults = {
    indexedStatus: campaign?.indexingStatus || visibilitySvc?.indexedStatus || "unknown",
    visibilityScore: visibility?.estimatedVisibilityScore ?? 0,
    trackedKeywords: visibility?.trackedKeywords ?? 0,
    growthActionsPending: growth?.pendingActions ?? 0,
    growthActionsTotal: growth?.totalActions ?? 0,
    lastRefresh: visibility?.lastCheckedAt || indexing?.lastUpdated || null,
    nextMonitoringAction:
      growth?.topPriorityActions?.[0]?.title ||
      visibilitySvc?.recommendedAction ||
      "Review growth actions and refresh visibility monthly",
  };

  const operatorNotes: PlatformDashboardOperatorNotes = {
    loginUrl: "/api/login",
    previewUrl: `/api/pharmacy-visual-experience/${serviceId}/?slug=${s}`,
    testCampaign: campaign?.name || "Blood Pressure Checks — Increase Visibility",
    testServiceId: serviceId,
    warnings: [
      ...(blockers.length ? [`${blockers.length} launch blockers detected`] : []),
      ...(campaign?.launchQueue?.blockedTasks ? [`${campaign.launchQueue.blockedTasks} launch queue tasks blocked`] : []),
      "Operator section — not shown to pharmacy customers in production",
    ],
  };

  const setupHeadline =
    operatingSystem.mode === "GROWTH"
      ? "Your service asset is live — track results and recommended improvements."
      : operatingSystem.nextStep
        ? `Current step: ${operatingSystem.nextStep.title}`
        : "Complete your first service page step by step.";

  return {
    slug: s,
    pharmacyName: identity.pharmacyName,
    brandPrimaryColor: profile.brandPrimaryColor || "#005eb8",
    brandSecondaryColor: profile.brandSecondaryColor || "#003087",
    brandCtaColor: profile.brandCtaColor || "#005eb8",
    identity,
    setupHeadline,
    currentCampaign,
    nextAction,
    operatingSystem,
    campaignCoverage,
    staleCampaigns,
    workflow,
    blockers,
    quickLinks,
    assets,
    results,
    operatorNotes,
  };
}
