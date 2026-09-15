/**
 * Review Centre V2 — customer-facing campaign review after generation.
 */

export const REVIEW_CENTRE_VERSION = 1;

export type ReviewCentreGroupId =
  | "service-page"
  | "local-pages"
  | "patient-guide"
  | "faqs"
  | "blogs"
  | "gbp-posts"
  | "social-posts"
  | "emails"
  | "video"
  | "landing-page"
  | "images";

export type ReviewCentreAssetStatus = "ready" | "approved" | "needs-improvement";

export interface ReviewCentreGroupDef {
  id: ReviewCentreGroupId;
  label: string;
}

export const REVIEW_CENTRE_GROUPS: ReviewCentreGroupDef[] = [
  { id: "service-page", label: "Service Page" },
  { id: "local-pages", label: "Local Pages" },
  { id: "patient-guide", label: "Patient Guide" },
  { id: "faqs", label: "FAQs" },
  { id: "blogs", label: "Blogs" },
  { id: "gbp-posts", label: "GBP Posts" },
  { id: "social-posts", label: "Social Posts" },
  { id: "emails", label: "Emails" },
  { id: "video", label: "Video" },
  { id: "landing-page", label: "Landing Page" },
  { id: "images", label: "Images" },
];

export const REVIEW_CENTRE_ASSET_TYPE_TO_GROUP: Record<string, ReviewCentreGroupId> = {
  "service-page": "service-page",
  "local-area-pages": "local-pages",
  guides: "patient-guide",
  faq: "faqs",
  blog: "blogs",
  gbp: "gbp-posts",
  social: "social-posts",
  email: "emails",
  video: "video",
  "landing-page": "landing-page",
  images: "images",
};

export const REVIEW_CENTRE_CUSTOMER_TYPE_LABELS: Record<string, string> = {
  "service-page": "Service Page",
  "local-area-pages": "Local Pages",
  guides: "Patient Guide",
  faq: "FAQs",
  blog: "Blog",
  gbp: "Google Business Profile Post",
  social: "Social Post",
  email: "Email",
  video: "Video",
  "landing-page": "Landing Page",
  images: "Image",
};

export const REVIEW_CENTRE_OPTIONAL_DEFERRED_LABEL = "Optional — deferred";

export function reviewCentreStatusLabel(status: ReviewCentreAssetStatus): string {
  if (status === "approved") return "Approved";
  if (status === "needs-improvement") return "Needs Improvement";
  return "Ready for Review";
}

export interface ReviewCentreAssetItem {
  id: string;
  title: string;
  previewUrl: string | null;
  generated: boolean;
}

export interface ReviewCentreAsset {
  key: string;
  title: string;
  summary: string;
  typeLabel: string;
  groupId: ReviewCentreGroupId;
  groupLabel: string;
  status: ReviewCentreAssetStatus;
  statusLabel: string;
  previewUrl: string | null;
  count: number;
  selectedCount?: number;
  items?: ReviewCentreAssetItem[];
  improveMessage: string | null;
  required: boolean;
  optionalDeferred: boolean;
  candidateOnly?: boolean;
  copyExcerpt?: string | null;
  sourceFindings?: string[];
  validationLabel?: string | null;
  demonstrationPublish?: ReviewCentrePublicationPanel | null;
  currentCandidateVersion?: string | null;
  candidateHash?: string | null;
}

export type ReviewCentrePublicationPrimaryAction =
  | "publish-demonstration"
  | "view-published"
  | "update-demonstration"
  | "locked";

export interface ReviewCentrePublicationPanel {
  kind: "demonstration" | "genuine";
  enabled: boolean;
  pageType: "local-page" | "service-page";
  pageTypeLabel: string;
  area: string;
  areaLabel: string;
  pharmacyName: string;
  campaignName: string;
  apiPath: string;
  asset: string;
  candidateVersion: string;
  candidateHtmlSha256: string;
  candidateCopySha256: string;
  destinationBaseUrl: string;
  destinationUrl: string;
  publishedUrl: string | null;
  publicationStatus: "not-published" | "published-demonstration" | "published" | "update-available";
  publicationStatusLabel: string;
  approvalStatusLabel: string;
  indexingStatusLabel: string;
  primaryAction: ReviewCentrePublicationPrimaryAction;
  primaryActionLabel: string;
  demonstrationNotice: string | null;
  lockReason: string | null;
  clinicalApproval: boolean;
  campaignApproval: boolean;
  publicationAuthorised: boolean;
  indexingSubmitted: boolean;
  robots: "noindex, nofollow";
}

export interface ReviewCentreGroup {
  id: ReviewCentreGroupId;
  label: string;
  assets: ReviewCentreAsset[];
  required: boolean;
  optionalDeferred: boolean;
  pendingNote?: string | null;
}

export interface ReviewCentrePendingGeneration {
  typeLabel: string;
  names: string[];
  count: number;
}

export interface ReviewCentreNextAction {
  title: string;
  detail: string;
}

export interface ReviewCentreView {
  slug: string;
  campaignId: string;
  campaignName: string;
  campaignScope: "mvp-core-pages" | "service-page-only" | "full";
  totalAssets: number;
  requiredGroupCount: number;
  approvedCount: number;
  needsImprovementCount: number;
  readyCount: number;
  generated: boolean;
  allApproved: boolean;
  campaignLockReady: boolean;
  canPublish: boolean;
  canPublishToStaging: boolean;
  stagingPublishApiPath: string;
  nextAction: ReviewCentreNextAction;
  groups: ReviewCentreGroup[];
  optionalGroups: ReviewCentreGroup[];
  packageContentSelected: number;
  packageContentGenerated: number;
  campaignAssetCount: number;
  localCandidateCount: number;
  demoReferenceCount: number;
  pendingGeneration: ReviewCentrePendingGeneration[];
  requiredGenerationIncomplete: boolean;
  hasLocalPageCandidate: boolean;
  publishUrl: string;
  regenerateImprovementsVisible: boolean;
  regenerateImprovementsIntent: string;
  regenerateImprovementsApiPath: string;
  currentCandidateVersion?: string | null;
  currentCampaignRunId?: string | null;
  currentCampaignRunStatus?: string | null;
}

export interface ReviewCentreCampaignState {
  improvements: Record<string, string>;
}

export interface ReviewCentreSession {
  version: number;
  slug: string;
  updatedAt: string;
  campaigns: Record<string, ReviewCentreCampaignState>;
}

export const REVIEW_CENTRE_IMPROVE_MESSAGE = "We'll improve this before publishing.";

export const REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT =
  "regenerate the current campaign items marked as needing improvement";
