/**
 * Campaign Builder V1 — customer-facing campaign creation workflow.
 */

export const CAMPAIGN_BUILDER_VERSION = 1;

export type CampaignBuilderStep =
  | "choose"
  | "areas"
  | "settings"
  | "images"
  | "overview"
  | "approval"
  | "review";

export type CampaignBuilderPriority = "Critical" | "High" | "Medium" | "Low";

export type CampaignBuilderMode = "all" | "manual";

/** Whole primary town, engine-recommended set, or individually selected areas. */
export type CampaignBuilderTargetAreaMode = "wholeTown" | "recommended" | "selected";

export type CampaignBuilderAreaPriorityLabel = "Primary" | "High" | "Medium" | "Low";

export type CampaignBuilderAreaDiscoveryStatus = "idle" | "ready" | "failed";

export interface CampaignBuilderAreaCandidate {
  areaName: string;
  priorityLabel: CampaignBuilderAreaPriorityLabel;
  reason: string;
  distanceLabel: string | null;
  selected: boolean;
  recommended: boolean;
  score: number;
  rank: number;
  tier: string;
  source: string;
  evidence: string[];
}

/** Existing tenant images, AI generation, uploads, or a mixed strategy. */
export type CampaignBuilderImageStrategy = "existing" | "upload" | "ai" | "mixed";

export type CampaignImageLocalMode = "shared" | "area-specific";

export type CampaignBuilderImageSlotId = "hero" | "support" | "trust" | "conversion" | "local";

export interface CampaignBuilderImageSlotPlan {
  slot: CampaignBuilderImageSlotId;
  label: string;
  hint: string;
  previewUrl: string | null;
  filePath: string | null;
  sourceType: "library" | "upload" | "ai" | "shared-stock" | "missing";
  approvalState: "approved" | "pending" | "missing" | "deferred";
  tenantStatus: "tenant" | "shared" | "invalid";
  libraryRef: string | null;
  uploadId: string | null;
  aiRequestId: string | null;
  mimeType: string | null;
  dimensions: string | null;
  assignedAt: string | null;
  deferPublishingNote: boolean;
}

export interface CampaignBuilderImagePlan {
  campaignId: string;
  serviceId: string;
  strategy: CampaignBuilderImageStrategy;
  localImageMode: CampaignImageLocalMode;
  slots: CampaignBuilderImageSlotPlan[];
  updatedAt: string;
  confirmedAt: string | null;
}

export interface CampaignBuilderAreaOption {
  area: string;
  source: string;
  score?: number;
  grade?: string;
  reason?: string;
  distanceLabel?: string | null;
  selected?: boolean;
  recommended?: boolean;
  evidence?: string[];
}

export interface CampaignBuilderAssetSelection {
  servicePage: boolean;
  guides: boolean;
  blogs: boolean;
  faqs: boolean;
  gbp: boolean;
  social: boolean;
  emails: boolean;
  images: boolean;
  landingPages: boolean;
  videos: boolean;
  landingPage: boolean;
}

export const DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION: CampaignBuilderAssetSelection = {
  servicePage: true,
  guides: true,
  blogs: true,
  faqs: true,
  gbp: true,
  social: true,
  emails: true,
  images: true,
  landingPages: true,
  videos: true,
  landingPage: true,
};

export type CampaignBuilderServiceContext = "existing" | "missing";

export interface CampaignBuilderListItem {
  serviceId: string;
  serviceName: string;
  priority: CampaignBuilderPriority;
  reason: string;
  estimatedOpportunity: string;
  estimatedCompletionTime: string;
  expectedAssetCount: number;
  packageItems?: Array<{ count: number; label: string }>;
  recommended: boolean;
  score: number;
  /** True when the pharmacy chose this service on the Growth Plan. */
  customerSelected?: boolean;
  /** True when sourced from website/import evidence instead of Growth Plan Intelligence. */
  isFallback?: boolean;
  /** Whether this campaign strengthens an existing website service or fills a gap. */
  serviceContext?: CampaignBuilderServiceContext;
  /** Customer-facing badge on campaign cards. */
  contextBadge?: string;
  contextLabel?: string;
}

export interface CampaignBuilderOverviewAsset {
  key: string;
  label: string;
  included: boolean;
  count: number;
}

export interface CampaignBuilderTotals {
  pages: number;
  posts: number;
  images: number;
  emails: number;
}

export interface CampaignBuilderOverview {
  serviceId: string;
  campaignName: string;
  assets: CampaignBuilderOverviewAsset[];
  totals: CampaignBuilderTotals;
  estimatedCompletionTime: string;
  estimatedSeoStrength: string;
  estimatedCustomerValue: string;
  campaignObjective: string;
  expectedOutcome: string;
}

export interface CampaignBuilderApprovalSummary {
  campaignName: string;
  serviceId: string;
  estimatedAssets: number;
  estimatedTime: string;
  campaignObjective: string;
  expectedOutcome: string;
  targetAreaMode: CampaignBuilderTargetAreaMode;
  targetAreas: string[];
  imageStrategy: CampaignBuilderImageStrategy;
  assetSelection: CampaignBuilderAssetSelection;
  sourceRefs: {
    businessProfileUrl: string;
    websiteIntelligenceUrl: string;
    localMarketUrl: string;
  };
  imagePlan: ReturnType<typeof buildCampaignBuilderImagePlan>;
}

export interface CampaignBuilderReviewItem {
  key: string;
  title: string;
  type: string;
  qualityScore: number;
  qualityLabel: string;
  previewUrl: string | null;
  approved: boolean;
  approvedAt: string | null;
  count: number;
}

export interface CampaignBuilderSession {
  version: number;
  slug: string;
  updatedAt: string;
  step: CampaignBuilderStep;
  selectedServiceId: string | null;
  mode: CampaignBuilderMode;
  assetSelection: CampaignBuilderAssetSelection;
  targetAreaMode: CampaignBuilderTargetAreaMode;
  targetAreaNames: string[];
  discoveredAreaCandidates: CampaignBuilderAreaCandidate[];
  areaDiscoveryStatus: CampaignBuilderAreaDiscoveryStatus;
  areaDiscoveredAt: string | null;
  areaDiscoverySource: string | null;
  areaDiscoveryError: string | null;
  imageStrategy: CampaignBuilderImageStrategy;
  localImageMode: CampaignImageLocalMode;
  imageDeferredSlots: Record<string, boolean>;
  /** Eligible stock photograph IDs included for this campaign. null = all eligible stock. */
  selectedStockImageIds: string[] | null;
  /** Explicit customer choice to record campaign-specific AI image requests (not generate). */
  requestAiImages: boolean;
  imagePlanConfirmedAt: string | null;
  contextFrozenAt: string | null;
  generationStartedAt: string | null;
  generationCompletedAt: string | null;
  approvedAssets: Record<string, string>;
}
