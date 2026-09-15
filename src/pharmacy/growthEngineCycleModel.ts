/**
 * Growth Engine — Growth Cycle Manager V1 model.
 * Continuous pharmacy growth programme — not one-off campaigns.
 */

export const GROWTH_CYCLE_VERSION = 1;
export const GROWTH_MEMORY_VERSION = 1;

/** Lifecycle stages — every stage is timestamped when entered. */
export const GROWTH_CYCLE_STAGES = [
  "recommended",
  "approved",
  "generating",
  "generated",
  "quality-review",
  "approved-for-launch",
  "launch-plan-created",
  "publishing",
  "submitted",
  "index-monitoring",
  "performance-review",
  "completed",
] as const;

export type GrowthCycleStage = (typeof GROWTH_CYCLE_STAGES)[number];

export interface GrowthCycleStageRecord {
  stage: GrowthCycleStage;
  enteredAt: string;
  note?: string;
}

export type GrowthCycleStatus = "recommended" | "in_progress" | "completed" | "postponed" | "rejected";

export interface GrowthCycleAssetCounts {
  generated: number;
  published: number;
  indexed: number;
}

export interface GrowthCycleRankingSummary {
  servicesTracked: number;
  indexedPages: number;
  visibilityStatus: string;
  note: string;
}

export interface GrowthCycleReviewSummary {
  contentReviewed: boolean;
  qualityApproved: boolean;
  reviewedAt: string | null;
  approvedAt: string | null;
  note: string;
}

export interface GrowthCycleNextRecommendation {
  serviceId: string;
  serviceName: string;
  reason: string;
  evidenceSummary: string;
  considersPreviousCycles: boolean;
}

export interface GrowthCycle {
  cycleNumber: number;
  serviceId: string;
  recommendedService: string;
  status: GrowthCycleStatus;
  reasonRecommended: string;
  evidenceSources: string[];
  startDate: string | null;
  launchDate: string | null;
  completionDate: string | null;
  durationDays: number | null;
  currentStage: GrowthCycleStage;
  stageHistory: GrowthCycleStageRecord[];
  generatedAssets: GrowthCycleAssetCounts;
  publishedAssets: GrowthCycleAssetCounts;
  indexedAssets: GrowthCycleAssetCounts;
  rankingSummary: GrowthCycleRankingSummary;
  reviewSummary: GrowthCycleReviewSummary;
  completionNotes: string | null;
  lessonsLearned: string[];
  nextRecommendation: GrowthCycleNextRecommendation | null;
  launchPlanId: string | null;
  launchWeek: number | null;
}

export interface GrowthCycleStoreDoc {
  version: number;
  slug: string;
  updatedAt: string;
  cycles: GrowthCycle[];
}

/** Permanent growth memory — nothing forgotten. */
export type GrowthMemoryEventType =
  | "recommendation_created"
  | "recommendation_accepted"
  | "recommendation_rejected"
  | "recommendation_postponed"
  | "cycle_started"
  | "generation_complete"
  | "content_reviewed"
  | "quality_approved"
  | "launch_plan_created"
  | "page_published"
  | "url_submitted"
  | "page_indexed"
  | "launch_complete"
  | "cycle_completed";

export interface GrowthMemoryEvent {
  id: string;
  type: GrowthMemoryEventType;
  at: string;
  serviceId: string | null;
  cycleNumber: number | null;
  detail: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface GrowthMemoryDoc {
  version: number;
  slug: string;
  updatedAt: string;
  events: GrowthMemoryEvent[];
}

/** Adaptive launch plan — created only after generation, review, and approval. */
export interface LaunchPlanMilestone {
  week: number;
  title: string;
  tasks: string[];
}

export interface LaunchPlanSchedule {
  publishing: LaunchPlanMilestone[];
  sitemapUpdates: string[];
  searchConsolePlan: string[];
  priorityUrlReview: string[];
  gbpSchedule: string[];
  socialSchedule: string[];
  emailSchedule: string[];
  progressReviews: string[];
  recommendedWeeks: number;
  rationale: string;
}

export interface GrowthCycleLaunchPlan {
  id: string;
  cycleNumber: number;
  serviceId: string;
  serviceName: string;
  createdAt: string;
  schedule: LaunchPlanSchedule;
}

export interface GrowthTimelineFoundationStep {
  id: string;
  label: string;
  complete: boolean;
}

export interface GrowthTimelineCycleItem {
  cycleNumber: number;
  serviceName: string;
  serviceId: string;
  status: GrowthCycleStatus;
  currentStage: GrowthCycleStage;
  launchWeek: number | null;
  label: string;
}

export interface GrowthTimeline {
  foundationSteps: GrowthTimelineFoundationStep[];
  cycles: GrowthTimelineCycleItem[];
}

export interface GrowthJourneyView {
  version: number;
  slug: string;
  generatedAt: string;
  currentCycle: GrowthCycle | null;
  completedCycles: GrowthCycle[];
  timeline: GrowthTimeline;
  currentLaunchWeek: number | null;
  currentProgressPct: number;
  nextRecommendation: GrowthCycleNextRecommendation | null;
  expectedBusinessOutcome: string;
  consultantMessage: string;
  launchPlan: GrowthCycleLaunchPlan | null;
  memoryEventCount: number;
}

export const GROWTH_CYCLE_STAGE_LABELS: Record<GrowthCycleStage, string> = {
  recommended: "Recommended",
  approved: "Approved",
  generating: "Generating",
  generated: "Generated",
  "quality-review": "Quality Review",
  "approved-for-launch": "Approved For Launch",
  "launch-plan-created": "Launch Plan Created",
  publishing: "Publishing",
  submitted: "Submitted",
  "index-monitoring": "Index Monitoring",
  "performance-review": "Performance Review",
  completed: "Completed",
};
