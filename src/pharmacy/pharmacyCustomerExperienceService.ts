/**
 * PharmaConnect Customer Experience V1 — asset-first presentation layer.
 */
import type { PharmacyPlatformDashboard } from "./pharmacyPlatformDashboardService.ts";
import type { PlatformOsStepState } from "./pharmacyPlatformOperatingSystemService.ts";

export type GrowthPlanTier = "starter" | "professional" | "complete";

export interface CustomerOutstandingTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  whyItMatters: string;
  continueUrl: string;
}

export interface GrowthPlanTierInfo {
  id: GrowthPlanTier;
  label: string;
  tagline: string;
  active: boolean;
}

export interface AdvancedToolLink {
  id: string;
  label: string;
  url: string;
}

export interface CustomerExperienceView {
  showWelcome: boolean;
  outstandingTasks: CustomerOutstandingTask[];
  growthPlanName: string | null;
  growthPlanService: string | null;
  growthPlanUrl: string;
  growthProgressPct: number;
  growthJourneyLabel: string;
  performanceSummary: {
    visibilityScore: number;
    indexedLabel: string;
    pendingImprovements: number;
  };
  growthPlanTier: GrowthPlanTier;
  growthPlanTiers: GrowthPlanTierInfo[];
  advancedTools: AdvancedToolLink[];
}

const STEP_MINUTES: Record<string, number> = {
  "create-profile": 15,
  "choose-service-area": 10,
  "confirm-brand-images": 15,
  "generate-asset": 10,
  "review-content": 12,
  "approve-asset": 5,
  publish: 10,
  "submit-to-google": 5,
  "track-results": 5,
};

const CUSTOMER_STEP_TITLES: Record<string, string> = {
  "create-profile": "Create Profile",
  "choose-service-area": "Choose Service & Area",
  "confirm-brand-images": "Confirm Brand & Images",
  "generate-asset": "Create Content Package",
  "review-content": "Review Content Package",
  "approve-asset": "Approve Content Package",
  publish: "Publish",
  "submit-to-google": "Submit To Google",
  "track-results": "Track Results",
};

function customerTitle(step: PlatformOsStepState): string {
  return CUSTOMER_STEP_TITLES[step.id] || step.title;
}

function buildOutstandingFromSteps(steps: PlatformOsStepState[]): CustomerOutstandingTask[] {
  return steps
    .filter((s) => s.status !== "COMPLETE" && !s.locked && s.status !== "WAITING")
    .slice(0, 3)
    .map((s) => ({
      id: s.id,
      title: customerTitle(s),
      estimatedMinutes: STEP_MINUTES[s.id] || 10,
      whyItMatters: s.explanation,
      continueUrl: s.url,
    }));
}

function resolveGrowthTier(d: PharmacyPlatformDashboard): GrowthPlanTier {
  if (d.operatingSystem.mode === "GROWTH") return "complete";
  const pct = d.operatingSystem.overallCompletionPct;
  if (pct >= 60) return "professional";
  return "starter";
}

function buildTierComparison(active: GrowthPlanTier): GrowthPlanTierInfo[] {
  return [
    { id: "starter", label: "First Service Page", tagline: "Create and approve your first branded service asset.", active: active === "starter" },
    { id: "professional", label: "Service Asset", tagline: "Review, publish and submit your service page.", active: active === "professional" },
    { id: "complete", label: "Growth Programme", tagline: "Track results and ongoing improvements.", active: active === "complete" },
  ];
}

function buildAdvancedTools(slug: string, serviceId: string): AdvancedToolLink[] {
  const s = slug;
  return [
    { id: "campaign-os", label: "Campaign Management", url: `/api/pharmacy-campaigns?slug=${s}` },
    { id: "images", label: "Image Library", url: `/api/pharmacy-image-library?slug=${s}&service=${serviceId}` },
    { id: "content-review", label: "Content Review", url: `/api/pharmacy-authority-readiness?slug=${s}&service=${serviceId}` },
    { id: "improvements", label: "Recommended Improvements", url: `/api/pharmacy-growth-actions?slug=${s}` },
    { id: "visibility", label: "Search Visibility", url: `/api/pharmacy-growth-dashboard?slug=${s}#visibility` },
    { id: "indexing", label: "Indexing", url: `/api/pharmacy-growth-dashboard?slug=${s}#indexing` },
    { id: "reports", label: "Reports", url: `/api/pharmacy-growth-dashboard?slug=${s}` },
    { id: "profile", label: "Profile Dashboard", url: `/api/pharmacy-profile-dashboard?slug=${s}` },
  ];
}

export function buildCustomerExperienceView(d: PharmacyPlatformDashboard): CustomerExperienceView {
  const os = d.operatingSystem;
  const serviceId = os.currentCampaignServiceId;
  const tier = resolveGrowthTier(d);
  const hideEarly = os.hideGrowthMetrics;

  const staleTasks: CustomerOutstandingTask[] = hideEarly
    ? []
    : d.staleCampaigns.map((s) => ({
        id: `stale-${s.campaignId}`,
        title: "Refresh Your Service Page",
        estimatedMinutes: 10,
        whyItMatters: "Your profile changed — regenerate so your page stays accurate.",
        continueUrl: `/api/pharmacy-campaigns?slug=${d.slug}&campaignId=${s.campaignId}#regenerate`,
      }));

  const outstandingTasks = [...staleTasks, ...buildOutstandingFromSteps(os.steps)].slice(0, 4);

  const campaign = d.currentCampaign;
  const journeyPhase = hideEarly
    ? "Creating your content package"
    : os.mode === "GROWTH"
      ? "Tracking results and growing your presence"
      : "Publishing and submitting your content package";

  return {
    showWelcome: hideEarly,
    outstandingTasks,
    growthPlanName: campaign?.name || null,
    growthPlanService: campaign?.serviceName || null,
    growthPlanUrl: campaign?.detailUrl || `/api/pharmacy-campaigns?slug=${d.slug}#choose-service`,
    growthProgressPct: os.overallCompletionPct,
    growthJourneyLabel: journeyPhase,
    performanceSummary: hideEarly
      ? { visibilityScore: 0, indexedLabel: "Not yet", pendingImprovements: 0 }
      : {
          visibilityScore: d.results.visibilityScore,
          indexedLabel: d.results.indexedStatus.replace(/_/g, " "),
          pendingImprovements: d.results.growthActionsPending,
        },
    growthPlanTier: tier,
    growthPlanTiers: buildTierComparison(tier),
    advancedTools: buildAdvancedTools(d.slug, serviceId),
  };
}

export const GROWTH_PROGRAMME_TIMELINE = [
  { phase: "Step 1–3", items: ["Create Profile", "Choose Service & Area", "Confirm Brand & Images"] },
  { phase: "Step 4–6", items: ["Create Content Package", "Review Content Package", "Approve Content Package"] },
  { phase: "Step 7–9", items: ["Publish", "Submit To Google", "Track Results"] },
] as const;
