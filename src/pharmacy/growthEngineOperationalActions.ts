/**
 * Growth Engine — Operational Completion V1.
 * Computes today's tasks and next actions from existing platform state (read-only).
 */
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import type { GrowthEngineStepId } from "./growthEngineFrameworkService.ts";
import { buildGrowthJourneyView } from "./growthEngineCycleManagerService.ts";
import type { GrowthCycleStage, GrowthJourneyView } from "./growthEngineCycleModel.ts";
import { GROWTH_CYCLE_STAGE_LABELS } from "./growthEngineCycleModel.ts";
import { loadWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import {
  contentPackageApproved,
  contentPackageGenerated,
  contentPackageReviewed,
} from "./pharmacyContentPackageService.ts";
import { readPharmacyIndexingSummary } from "./pharmacyIndexingBridgeService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { growthEngineContentPackageUrl } from "./growthEngineFrameworkService.ts";
import { hasLiveGscIndexingData, hasLiveRankTrackingData } from "./growthEngineLiveIntegrationProofService.ts";
import { getPharmacyLivePublishStatus } from "./pharmacyLivePublishService.ts";
import { loadPharmacyDeployConfig } from "./pharmacyDeployConfig.ts";

export interface OperationalTask {
  id: string;
  label: string;
  detail: string;
  href: string | null;
  action: "navigate" | "api" | "info";
  apiMethod?: "POST";
  apiPath?: string;
  apiBody?: Record<string, unknown>;
  confirmMessage?: string;
  priority: "primary" | "secondary";
}

export interface OperationalProgress {
  indexing: { indexed: number; readyToSubmit: number; notIndexed: number; live: boolean };
  rankings: {
    visiblePages: number;
    trackedKeywords: number;
    visibilityStatus: string;
    live: boolean;
  };
  latestNote: string;
}

export interface OperationalHome {
  slug: string;
  headline: string;
  currentStageLabel: string;
  nextMilestone: string;
  recommendedAction: string;
  todaysTasks: OperationalTask[];
  progress: OperationalProgress;
}

const READINESS_LABEL_MAP: Record<string, string> = {
  "Business Profile complete": "Your Pharmacy complete",
  "Website analysed": "Your Website Report complete",
  "Local Healthcare analysed": "Your Local Market complete",
  "Growth Intelligence complete": "Evidence reviewed",
  "Generator available": "Content creation ready",
};

export function customerReadinessLabel(label: string): string {
  return READINESS_LABEL_MAP[label] || label.replace(/generator/gi, "content creation").replace(/registry/gi, "page tracker");
}

function growthStepHref(slug: string, id: GrowthEngineStepId): string {
  const map: Record<GrowthEngineStepId, string> = {
    "business-intelligence": `/api/growth-engine/business-intelligence?slug=${encodeURIComponent(slug)}`,
    "local-market": `/api/growth-engine/local-market?slug=${encodeURIComponent(slug)}`,
    "website-intelligence": `/api/growth-engine/website-intelligence?slug=${encodeURIComponent(slug)}`,
    "growth-intelligence": `/api/growth-engine/growth-intelligence?slug=${encodeURIComponent(slug)}`,
    "growth-plan": `/api/growth-engine/growth-plan?slug=${encodeURIComponent(slug)}`,
    generate: `/api/growth-engine/generate?slug=${encodeURIComponent(slug)}`,
    dashboard: `/api/growth-engine/dashboard?slug=${encodeURIComponent(slug)}`,
  };
  return map[id];
}

function tasksForFoundation(slug: string): OperationalTask[] {
  const framework = buildGrowthEngineFramework(slug);
  const tasks: OperationalTask[] = [];

  for (const step of framework.steps) {
    if (step.status === "complete") continue;
    if (step.id === "dashboard") continue;
    tasks.push({
      id: `foundation-${step.id}`,
      label: `Complete ${step.title}`,
      detail: step.summary,
      href: growthStepHref(slug, step.id),
      action: "navigate",
      priority: step.id === framework.currentStep ? "primary" : "secondary",
    });
    if (step.id === framework.currentStep) break;
  }

  return tasks;
}

function tasksForCycleStage(slug: string, serviceId: string, stage: GrowthCycleStage): OperationalTask[] {
  const contentUrl = growthEngineContentPackageUrl(slug, serviceId);
  const reviewUrl = `/api/pharmacy-asset-review?slug=${encodeURIComponent(slug)}&service=${encodeURIComponent(serviceId)}`;
  const publishUrl = `/api/pharmacy-publishing-settings?slug=${encodeURIComponent(slug)}&service=${encodeURIComponent(serviceId)}`;
  const indexingUrl = `/api/pharmacy-growth-dashboard?slug=${encodeURIComponent(slug)}#indexing`;

  const generated = contentPackageGenerated(slug, serviceId);
  const reviewed = contentPackageReviewed(slug, serviceId);
  const approved = contentPackageApproved(slug, serviceId);
  const indexing = readPharmacyIndexingSummary(slug);

  const tasks: OperationalTask[] = [];

  if (!generated || stage === "recommended" || stage === "approved" || stage === "generating") {
    tasks.push({
      id: "generate-content",
      label: generated ? "Review your content" : "Create your content",
      detail: generated ? "Your content is ready for review." : "Build your service pages, guides, and supporting content.",
      href: generated ? reviewUrl : contentUrl,
      action: "navigate",
      priority: "primary",
    });
  }

  if (generated && !reviewed) {
    tasks.push({
      id: "review-content",
      label: "Review content quality",
      detail: "Check pages read well for patients before approving for launch.",
      href: reviewUrl,
      action: "navigate",
      priority: "primary",
    });
  }

  if (reviewed && !approved) {
    tasks.push({
      id: "approve-content",
      label: "Approve content for launch",
      detail: "Sign off content so your launch plan can be created.",
      href: reviewUrl,
      action: "navigate",
      priority: "primary",
    });
  }

  if (approved && ["approved-for-launch", "launch-plan-created", "publishing"].includes(stage)) {
    const livePub = getPharmacyLivePublishStatus(slug);
    const deploy = loadPharmacyDeployConfig(slug);
    const ftpReady = deploy.configured && deploy.credentialsPresent;

    if (!livePub.staticOutputReady) {
      tasks.push({
        id: "prepare-publish",
        label: "Prepare pages for publishing",
        detail: "Build static HTML and sitemap from your approved content.",
        href: null,
        action: "api",
        apiMethod: "POST",
        apiPath: `/api/pharmacy-publishing/${encodeURIComponent(slug)}/prepare`,
        apiBody: { serviceId },
        priority: "primary",
      });
    } else if (!livePub.lastFtpTestOk && ftpReady) {
      tasks.push({
        id: "ftp-test",
        label: "Test FTP connection",
        detail: "Safe connection test before live publish.",
        href: null,
        action: "api",
        apiMethod: "POST",
        apiPath: `/api/pharmacy-publishing/${encodeURIComponent(slug)}/ftp-test`,
        priority: "primary",
      });
    } else if (!livePub.lastPublishedAt && ftpReady) {
      tasks.push({
        id: "publish-live",
        label: "Publish to your website",
        detail: `${livePub.pageCount} pages ready — upload to your live website.`,
        href: null,
        action: "api",
        apiMethod: "POST",
        apiPath: `/api/pharmacy-publishing/${encodeURIComponent(slug)}/publish`,
        apiBody: { serviceId, confirm: true },
        confirmMessage: "Publish prepared content to your live website now?",
        priority: "primary",
      });
    } else if (!livePub.lastPublishedAt) {
      tasks.push({
        id: "publish-content",
        label: "Configure publishing connection",
        detail: "FTP credentials required before live publish.",
        href: publishUrl,
        action: "navigate",
        priority: "primary",
      });
    } else {
      const pubDetail = `Last published ${livePub.lastPublishedAt.slice(0, 10)}${livePub.lastPublishedUrl ? ` · ${livePub.lastPublishedUrl}` : ""}`;
      tasks.push({
        id: "publish-content",
        label: "Review live publishing",
        detail: pubDetail,
        href: publishUrl,
        action: "navigate",
        priority: "secondary",
      });
    }
  }

  if (approved && indexing && (indexing.readyToSubmit > 0 || indexing.totalRegistered === 0)) {
    tasks.push({
      id: "register-indexing",
      label: "Register pages for search indexing",
      detail: "Add published pages to your search indexing tracker.",
      href: null,
      action: "api",
      apiMethod: "POST",
      apiPath: `/api/pharmacy-indexing/${encodeURIComponent(slug)}/register`,
      priority: indexing.totalRegistered === 0 ? "primary" : "secondary",
    });
  }

  if (indexing && indexing.readyToSubmit > 0) {
    tasks.push({
      id: "submit-indexing",
      label: "Submit pages to Search Console",
      detail: `${indexing.readyToSubmit} page${indexing.readyToSubmit === 1 ? "" : "s"} ready to submit.`,
      href: null,
      action: "api",
      apiMethod: "POST",
      apiPath: `/api/pharmacy-indexing/${encodeURIComponent(slug)}/submit`,
      priority: "primary",
    });
  }

  if (indexing && indexing.totalRegistered > 0) {
    tasks.push({
      id: "refresh-indexing",
      label: "Check indexing progress",
      detail: `${indexing.indexed} indexed · ${indexing.notIndexed} awaiting indexing`,
      href: null,
      action: "api",
      apiMethod: "POST",
      apiPath: `/api/pharmacy-indexing/${encodeURIComponent(slug)}/refresh`,
      priority: "secondary",
    });
  }

  if (["index-monitoring", "performance-review", "submitted", "publishing"].includes(stage)) {
    tasks.push({
      id: "monitor-rankings",
      label: "Review search visibility",
      detail: "See how your pages are performing in search.",
      href: indexingUrl,
      action: "navigate",
      priority: "secondary",
    });
    tasks.push({
      id: "refresh-visibility",
      label: "Refresh ranking data",
      detail: "Update visibility and keyword tracking.",
      href: null,
      action: "api",
      apiMethod: "POST",
      apiPath: `/api/pharmacy-visibility/${encodeURIComponent(slug)}/refresh`,
      priority: "secondary",
    });
  }

  return tasks;
}

function nextMilestoneForStage(stage: GrowthCycleStage, serviceName: string): string {
  const map: Partial<Record<GrowthCycleStage, string>> = {
    recommended: `Approve your Growth Plan for ${serviceName}`,
    approved: `Create content for ${serviceName}`,
    generating: `Finish creating content for ${serviceName}`,
    generated: "Review content quality",
    "quality-review": "Approve content for launch",
    "approved-for-launch": "Create your launch plan",
    "launch-plan-created": "Publish pages to your website",
    publishing: "Submit pages to Search Console",
    submitted: "Monitor indexing progress",
    "index-monitoring": "Review search performance",
    "performance-review": "Complete this Growth Cycle",
    completed: "Start your next Growth Cycle",
  };
  return map[stage] || "Continue your growth programme";
}

export function buildOperationalHome(slug: string, journey?: GrowthJourneyView): OperationalHome {
  const view = journey || buildGrowthJourneyView(slug);
  const framework = buildGrowthEngineFramework(slug);
  const indexing = readPharmacyIndexingSummary(slug);
  const visibility = readPharmacyVisibilityReport(slug);
  const cycle = view.currentCycle;

  let todaysTasks: OperationalTask[] = [];
  let currentStageLabel = "Getting started";
  let nextMilestone = "Complete Your Pharmacy";
  let recommendedAction = "Open Your Pharmacy and confirm what we imported.";

  const foundationIncomplete = framework.steps.some(
    (s) => s.id !== "dashboard" && s.status !== "complete" && ["business-intelligence", "local-market", "website-intelligence", "growth-intelligence", "growth-plan"].includes(s.id),
  );

  if (foundationIncomplete) {
    todaysTasks = tasksForFoundation(slug);
    const current = framework.steps.find((s) => s.id === framework.currentStep);
    currentStageLabel = current?.title || "Foundation setup";
    nextMilestone = current?.subtitle || "Complete foundation steps";
    recommendedAction = todaysTasks[0]?.detail || recommendedAction;
  } else if (cycle) {
    currentStageLabel = `${cycle.recommendedService} — ${GROWTH_CYCLE_STAGE_LABELS[cycle.currentStage]}`;
    nextMilestone = nextMilestoneForStage(cycle.currentStage, cycle.recommendedService);
    todaysTasks = tasksForCycleStage(slug, cycle.serviceId, cycle.currentStage);
    recommendedAction = todaysTasks.find((t) => t.priority === "primary")?.label || nextMilestone;
  } else if (view.nextRecommendation) {
    currentStageLabel = "Ready for next Growth Cycle";
    nextMilestone = `Review recommendation: ${view.nextRecommendation.serviceName}`;
    recommendedAction = view.nextRecommendation.reason;
    todaysTasks = [
      {
        id: "review-plan",
        label: "Review your Growth Plan",
        detail: view.nextRecommendation.reason,
        href: growthStepHref(slug, "growth-plan"),
        action: "navigate",
        priority: "primary",
      },
    ];
  }

  if (!todaysTasks.length) {
    todaysTasks = [
      {
        id: "open-dashboard",
        label: "Review your progress",
        detail: "Check timeline and monitoring below.",
        href: growthStepHref(slug, "dashboard"),
        action: "info",
        priority: "secondary",
      },
    ];
  }

  const indexingLive = hasLiveGscIndexingData(slug);
  const visibilityLive = hasLiveRankTrackingData(slug);

  return {
    slug,
    headline: "What should I do today?",
    currentStageLabel,
    nextMilestone,
    recommendedAction,
    todaysTasks: todaysTasks.slice(0, 8),
    progress: {
      indexing: {
        indexed: indexing?.indexed || 0,
        readyToSubmit: indexing?.readyToSubmit || 0,
        notIndexed: indexing?.notIndexed || 0,
        live: indexingLive,
      },
      rankings: {
        visiblePages: visibility?.visiblePageCount || 0,
        trackedKeywords: visibility?.trackedKeywords || 0,
        visibilityStatus: visibility?.visibilityStatus || "Not yet tracked",
        live: visibilityLive,
      },
      latestNote: cycle?.reviewSummary.note || framework.steps.find((s) => s.id === framework.currentStep)?.summary || "",
    },
  };
}

export function isWebsiteIntelligenceComplete(slug: string): boolean {
  const snap = loadWebsiteIntelligenceSnapshot(slug);
  return snap?.analysis?.understandingComplete === true;
}
