/**
 * PharmaConnect Platform Operating System V1 — workflow orchestration layer.
 * Reads module state only; owns sequencing, locking and next-step resolution.
 */
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { computeRequiredProfileCompleteness, isRequiredProfileComplete } from "./pharmacyProfileFieldClassification.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import {
  buildPharmacyCampaignControlCentre,
  resolvePrimaryActiveCampaign,
  type PharmacyCampaignEnriched,
} from "./pharmacyCampaignControlCentreService.ts";
import { getServicePublishingSettings } from "./pharmacyPublishingSettingsService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { readPharmacyIndexingSummary } from "./pharmacyIndexingBridgeService.ts";
import { readPharmacyGrowthActionPlan } from "./pharmacyGrowthActionPlanService.ts";
import {
  getServiceAssetWorkflow,
  hasAnyApprovedAsset,
  isBrandImagesReady,
  isServiceAreaComplete,
} from "./pharmacyAssetWorkflowService.ts";
import {
  contentPackageApproved,
  contentPackageGenerated,
  contentPackageReviewed,
} from "./pharmacyContentPackageService.ts";

export type PlatformOsStepStatus =
  | "NOT_STARTED"
  | "READY"
  | "IN_PROGRESS"
  | "WAITING"
  | "BLOCKED"
  | "COMPLETE";

export type PlatformOsMode = "BUILD" | "GROWTH";

export interface PlatformOsStepState {
  id: string;
  stepNumber: number;
  title: string;
  explanation: string;
  completionPct: number;
  status: PlatformOsStepStatus;
  url: string;
  blockingIssues: string[];
  lastUpdated: string | null;
  locked: boolean;
  lockReason: string | null;
}

export interface PlatformOsGrowthCard {
  id: string;
  label: string;
  value: string;
  detail: string;
  url: string;
}

export interface PlatformOperatingSystem {
  mode: PlatformOsMode;
  overallCompletionPct: number;
  steps: PlatformOsStepState[];
  nextStep: PlatformOsStepState | null;
  currentStep: PlatformOsStepState | null;
  hideGrowthMetrics: boolean;
  assetPhaseLabel: string;
  growthCards: PlatformOsGrowthCard[];
  currentCampaignServiceId: string;
  currentCampaignName: string | null;
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

function pctFromParts(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

function resolveStepStatus(
  completionPct: number,
  opts: { blocked?: boolean; waiting?: boolean; inProgress?: boolean },
): PlatformOsStepStatus {
  if (opts.blocked) return "BLOCKED";
  if (completionPct >= 100) return "COMPLETE";
  if (opts.waiting) return "WAITING";
  if (opts.inProgress || (completionPct > 0 && completionPct < 100)) return "IN_PROGRESS";
  if (completionPct === 0) return "READY";
  return "NOT_STARTED";
}

function buildGrowthCards(input: {
  slug: string;
  serviceId: string;
  campaign: PharmacyCampaignEnriched | null;
  visibility: ReturnType<typeof readPharmacyVisibilityReport>;
  growth: ReturnType<typeof readPharmacyGrowthActionPlan>;
  indexing: ReturnType<typeof readPharmacyIndexingSummary>;
}): PlatformOsGrowthCard[] {
  const { slug, serviceId, campaign, visibility, growth, indexing } = input;
  const s = safeSlug(slug);
  const svc = visibility?.services.find((v) => v.serviceId === serviceId);

  return [
    {
      id: "indexed-pages",
      label: "Indexed Pages",
      value: String(visibility?.indexedPageCount ?? indexing?.indexed ?? 0),
      detail: campaign?.indexingStatus?.replace(/_/g, " ") || "Not tracked",
      url: `/api/pharmacy-growth-dashboard?slug=${s}#indexing`,
    },
    {
      id: "visibility",
      label: "Search Visibility",
      value: String(visibility?.estimatedVisibilityScore ?? 0),
      detail: `${visibility?.visiblePageCount ?? 0} visible pages`,
      url: `/api/pharmacy-growth-dashboard?slug=${s}#visibility`,
    },
    {
      id: "rankings",
      label: "Rankings",
      value: svc?.estimatedPosition != null ? `#${svc.estimatedPosition}` : "—",
      detail: svc?.primaryKeyword || "Primary keyword",
      url: `/api/pharmacy-growth-dashboard?slug=${s}#visibility`,
    },
    {
      id: "impressions",
      label: "Impressions",
      value: String(svc?.impressions ?? 0),
      detail: "Estimated monthly impressions",
      url: `/api/pharmacy-growth-dashboard?slug=${s}#visibility`,
    },
    {
      id: "clicks",
      label: "Clicks",
      value: String(svc?.clicks ?? 0),
      detail: "Estimated monthly clicks",
      url: `/api/pharmacy-growth-dashboard?slug=${s}#visibility`,
    },
    {
      id: "growth-actions",
      label: "Recommended Improvements",
      value: String(growth?.pendingActions ?? 0),
      detail: `${growth?.totalActions ?? 0} total actions`,
      url: `/api/pharmacy-growth-actions?slug=${s}`,
    },
    {
      id: "opportunities",
      label: "Opportunities",
      value: String(visibility?.topKeywordOpportunities?.length ?? 0),
      detail: visibility?.competitorGap?.slice(0, 60) || "Review keyword gaps",
      url: `/api/pharmacy-growth-dashboard?slug=${s}#visibility`,
    },
    {
      id: "recent-changes",
      label: "Recent Changes",
      value: visibility?.lastCheckedAt?.slice(0, 10) || indexing?.lastUpdated?.slice(0, 10) || "—",
      detail: growth?.topPriorityActions?.[0]?.title || "Monitor monthly",
      url: `/api/pharmacy-growth-actions?slug=${s}`,
    },
  ];
}

function buildOsSteps(input: {
  slug: string;
  serviceId: string;
  profile: ReturnType<typeof normalizeProfileData>;
  campaign: PharmacyCampaignEnriched | null;
  publishing: ReturnType<typeof getServicePublishingSettings>;
}): PlatformOsStepState[] {
  const { slug, serviceId, profile, campaign, publishing } = input;
  const s = safeSlug(slug);
  const profileUrl = `/api/pharmacy-profile-wizard?slug=${s}`;
  const requiredProfile = computeRequiredProfileCompleteness(profile);
  const profileComplete = isRequiredProfileComplete(profile);
  const wf = getServiceAssetWorkflow(s, serviceId);
  const serviceAreaComplete = isServiceAreaComplete(profile, campaign);
  const brandImagesReady = isBrandImagesReady(s, serviceId, profile, campaign);
  const packageGenerated = contentPackageGenerated(s, serviceId);
  const contentReviewed = contentPackageReviewed(s, serviceId);
  const assetApproved = contentPackageApproved(s, serviceId);
  const published = campaign?.publishingStatus === "published";
  const indexingStatus = campaign?.indexingStatus || "not_started";
  const indexSubmitted = ["submitted", "indexed", "ready_to_submit"].includes(indexingStatus);

  const createPackageUrl = `/api/pharmacy-content-package?slug=${encodeURIComponent(s)}&service=${encodeURIComponent(serviceId)}`;
  const reviewUrl = `/api/pharmacy-asset-review?slug=${s}&service=${serviceId}`;
  const campaignsUrl = `/api/pharmacy-campaigns?slug=${s}`;
  const imageUrl = `/api/pharmacy-image-library?slug=${s}&service=${serviceId}`;
  const publishUrl = `/api/pharmacy-publishing-settings?slug=${s}&service=${serviceId}`;
  const indexUrl = `/api/pharmacy-growth-dashboard?slug=${s}#indexing`;
  const trackUrl = `/api/pharmacy-growth-dashboard?slug=${s}`;

  type StepDef = PlatformOsStepState & {
    unlockAfter?: () => boolean;
  };

  const defs: StepDef[] = [
    {
      id: "create-profile",
      stepNumber: 1,
      title: "Create Profile",
      explanation: "Add your pharmacy name, contact details, town, areas and reviewer information.",
      completionPct: requiredProfile.score,
      status: resolveStepStatus(requiredProfile.score, {
        inProgress: requiredProfile.score > 0 && requiredProfile.score < 100,
      }),
      url: profileUrl,
      blockingIssues: profileComplete ? [] : requiredProfile.missingRequired.slice(0, 3),
      lastUpdated: profile.websiteAnalysisAt || null,
      locked: false,
      lockReason: null,
      unlockAfter: () => true,
    },
    {
      id: "choose-service-area",
      stepNumber: 2,
      title: "Choose Service & Area",
      explanation: "Select your first service, main town and local cluster areas — or continue an existing asset.",
      completionPct: serviceAreaComplete ? 100 : profileComplete ? 30 : 0,
      status: resolveStepStatus(serviceAreaComplete ? 100 : profileComplete ? 30 : 0, {
        inProgress: profileComplete && !serviceAreaComplete,
      }),
      url: `${campaignsUrl}#choose-service`,
      blockingIssues: serviceAreaComplete ? [] : ["Choose a service and at least one local area"],
      lastUpdated: null,
      locked: false,
      lockReason: null,
      unlockAfter: () => profileComplete,
    },
    {
      id: "confirm-brand-images",
      stepNumber: 3,
      title: "Confirm Brand & Images",
      explanation: "Confirm branding, reviewer details and images. Stock images are fine — uploading your own is recommended.",
      completionPct: brandImagesReady ? 100 : serviceAreaComplete ? 40 : 0,
      status: resolveStepStatus(brandImagesReady ? 100 : serviceAreaComplete ? 40 : 0, {
        inProgress: serviceAreaComplete && !brandImagesReady,
      }),
      url: imageUrl,
      blockingIssues: brandImagesReady ? [] : ["Confirm brand and image choices in Image Library"],
      lastUpdated: wf.brandImagesConfirmedAt,
      locked: false,
      lockReason: null,
      unlockAfter: () => serviceAreaComplete,
    },
    {
      id: "generate-asset",
      stepNumber: 4,
      title: "Create Content Package",
      explanation: "Generate your full content package — service page, local pages, FAQs, guides and supporting assets.",
      completionPct: packageGenerated ? 100 : brandImagesReady ? 20 : 0,
      status: resolveStepStatus(packageGenerated ? 100 : brandImagesReady ? 20 : 0, {
        inProgress: brandImagesReady && !packageGenerated,
      }),
      url: createPackageUrl,
      blockingIssues: packageGenerated ? [] : ["Create your content package"],
      lastUpdated: null,
      locked: false,
      lockReason: null,
      unlockAfter: () => brandImagesReady,
    },
    {
      id: "review-content",
      stepNumber: 5,
      title: "Review Content Package",
      explanation: "Review everything created — service page, local pages, FAQs, guides and supporting content.",
      completionPct: contentReviewed ? 100 : packageGenerated ? 50 : 0,
      status: resolveStepStatus(contentReviewed ? 100 : packageGenerated ? 50 : 0, {
        inProgress: packageGenerated && !contentReviewed,
      }),
      url: reviewUrl,
      blockingIssues: contentReviewed ? [] : ["Review your content package"],
      lastUpdated: wf.contentReviewedAt,
      locked: false,
      lockReason: null,
      unlockAfter: () => packageGenerated,
    },
    {
      id: "approve-asset",
      stepNumber: 6,
      title: "Approve Content Package",
      explanation: "Confirm you have reviewed the content package and approve it for publishing.",
      completionPct: assetApproved ? 100 : contentReviewed ? 50 : 0,
      status: resolveStepStatus(assetApproved ? 100 : contentReviewed ? 50 : 0, {
        inProgress: contentReviewed && !assetApproved,
      }),
      url: `${reviewUrl}#approve`,
      blockingIssues: assetApproved ? [] : ["Approve your content package"],
      lastUpdated: wf.assetApprovedAt,
      locked: false,
      lockReason: null,
      unlockAfter: () => contentReviewed,
    },
    {
      id: "publish",
      stepNumber: 7,
      title: "Publish",
      explanation: "Publish your approved content package when you are ready to go live.",
      completionPct: published && assetApproved ? 100 : assetApproved ? 30 : 0,
      status: resolveStepStatus(published && assetApproved ? 100 : assetApproved ? 30 : 0, {
        inProgress: assetApproved && !published,
      }),
      url: publishUrl,
      blockingIssues: published && assetApproved ? [] : assetApproved ? ["Publish your content package"] : ["Approve your content package first"],
      lastUpdated: publishing?.updatedAt || null,
      locked: false,
      lockReason: null,
      unlockAfter: () => assetApproved,
    },
    {
      id: "submit-to-google",
      stepNumber: 8,
      title: "Submit To Google",
      explanation: "Submit your published page for Google indexing.",
      completionPct: indexSubmitted && assetApproved ? 100 : published && assetApproved ? 40 : 0,
      status: resolveStepStatus(indexSubmitted && assetApproved ? 100 : published && assetApproved ? 40 : 0, {
        waiting: indexingStatus === "submitted",
        inProgress: published && assetApproved && !indexSubmitted,
      }),
      url: indexUrl,
      blockingIssues: published && assetApproved ? [] : ["Publish your asset first"],
      lastUpdated: null,
      locked: false,
      lockReason: null,
      unlockAfter: () => published && assetApproved,
    },
    {
      id: "track-results",
      stepNumber: 9,
      title: "Track Results",
      explanation: "Monitor indexing, visibility, rankings and recommended improvements.",
      completionPct:
        published && assetApproved && indexSubmitted
          ? Math.min(100, 50 + (indexingStatus === "indexed" ? 50 : 20))
          : 0,
      status: resolveStepStatus(
        published && assetApproved && indexSubmitted ? (indexingStatus === "indexed" ? 100 : 60) : 0,
        { inProgress: published && assetApproved && indexSubmitted && indexingStatus !== "indexed" },
      ),
      url: trackUrl,
      blockingIssues: indexSubmitted && assetApproved ? [] : ["Submit your page to Google first"],
      lastUpdated: null,
      locked: false,
      lockReason: null,
      unlockAfter: () => indexSubmitted && assetApproved,
    },
  ];

  return defs.map((step) => {
    const unlocked = step.unlockAfter?.() ?? true;
    const locked = !unlocked && step.completionPct < 100;
    const lockReason = locked
      ? step.stepNumber === 2
        ? "Complete your profile first (Step 1)."
        : step.stepNumber === 3
          ? "Choose your service and areas first (Step 2)."
          : step.stepNumber === 4
            ? "Confirm brand and images first (Step 3)."
            : step.stepNumber === 5
              ? "Create your content package first (Step 4)."
              : step.stepNumber === 6
                ? "Review your content package first (Step 5)."
                : step.stepNumber === 7
                  ? "Approve your content package first (Step 6)."
                  : step.stepNumber === 8
                    ? "Publish your content package first (Step 7)."
                    : "Submit to Google first (Step 8)."
      : null;

    let status = step.status;
    if (locked && status !== "COMPLETE") status = "BLOCKED";

    return {
      id: step.id,
      stepNumber: step.stepNumber,
      title: step.title,
      explanation: step.explanation,
      completionPct: step.completionPct,
      status,
      url: step.url,
      blockingIssues: step.blockingIssues,
      lastUpdated: step.lastUpdated,
      locked,
      lockReason,
    };
  });
}

export function resolveNextOsStep(steps: PlatformOsStepState[]): PlatformOsStepState | null {
  for (const step of steps) {
    if (step.status === "COMPLETE") continue;
    if (step.locked) continue;
    if (step.status === "WAITING") continue;
    return step;
  }
  return steps.find((s) => s.status === "WAITING" && !s.locked) || null;
}

export function buildPlatformOperatingSystem(
  slug: string,
  options?: { primaryServiceId?: string; primaryCampaignId?: string },
): PlatformOperatingSystem {
  const s = safeSlug(slug);
  const profileDoc = loadPharmacyProfile(s);
  const profile = normalizeProfileData((profileDoc?.data || profileDoc || {}) as Record<string, unknown>);
  const centre = buildPharmacyCampaignControlCentre(s);
  const resolved = resolvePrimaryActiveCampaign(s, options?.primaryCampaignId);
  const campaign =
    resolved.campaign ||
    centre.campaigns.find((c) => c.status === "active") ||
    centre.primaryCampaign ||
    null;
  const serviceId = campaign?.serviceId || options?.primaryServiceId || "blood-pressure-checks";
  const publishing = getServicePublishingSettings(s, serviceId);
  const visibility = readPharmacyVisibilityReport(s);
  const indexing = readPharmacyIndexingSummary(s);
  const growth = readPharmacyGrowthActionPlan(s);

  const steps = buildOsSteps({
    slug: s,
    serviceId,
    profile,
    campaign,
    publishing,
  });

  const wf = getServiceAssetWorkflow(s, serviceId);
  const assetApproved = Boolean(wf.assetApprovedAt);
  const published = campaign?.publishingStatus === "published";
  const hasApproved = hasAnyApprovedAsset(s);
  const mode: PlatformOsMode = hasApproved && published ? "GROWTH" : "BUILD";
  const nextStep = resolveNextOsStep(steps);
  const currentStep = nextStep || steps.find((st) => st.status === "IN_PROGRESS") || steps.find((st) => st.status === "READY") || null;
  const overallCompletionPct = Math.round(steps.reduce((sum, st) => sum + st.completionPct, 0) / steps.length);

  return {
    mode,
    overallCompletionPct,
    steps,
    nextStep,
    currentStep,
    hideGrowthMetrics: !assetApproved,
    assetPhaseLabel: hasApproved ? "Growth Programme" : "Content Package",
    growthCards: assetApproved
      ? buildGrowthCards({ slug: s, serviceId, campaign, visibility, growth, indexing })
      : [],
    currentCampaignServiceId: serviceId,
    currentCampaignName: campaign?.name || null,
  };
}
