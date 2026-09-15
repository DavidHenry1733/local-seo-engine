/**
 * NT-E2E-26 — Quality Review page inspection workspace model.
 */
export type QualityReviewPageReviewStatus = "not_reviewed" | "approved" | "needs_changes";

export interface QualityReviewPageInspectionRow {
  pageId: string;
  pageSlug: string;
  pageType: string;
  pageName: string;
  sortOrder: number;
  generationStatus: "generated" | "missing";
  reviewStatus: QualityReviewPageReviewStatus;
  notes: string;
}

export interface QualityReviewPageInspectionProgress {
  total: number;
  reviewed: number;
  approved: number;
  needsChanges: number;
  progressPercent: number;
}

export interface QualityReviewPageInspectionWorkspace {
  version: 1;
  slug: string;
  authorisedJobId: string | null;
  pages: QualityReviewPageInspectionRow[];
  progress: QualityReviewPageInspectionProgress;
  canApproveQuality: boolean;
  approvalBlockers: string[];
}

export interface QualityReviewPageInspectionStore {
  version: 1;
  slug: string;
  authorisedJobId: string | null;
  packageRevision: string | null;
  updatedAt: string;
  pages: Record<string, { reviewStatus: QualityReviewPageReviewStatus; notes: string; updatedAt: string }>;
}
