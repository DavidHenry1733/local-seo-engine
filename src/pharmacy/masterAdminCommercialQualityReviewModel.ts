/**
 * Sprint 8B — Commercial Quality Review model (read-only validation of generated output).
 */
export type CommercialQualityCheckStatus = "PASS" | "WARNING" | "FAIL";

export interface CommercialQualityCheck {
  id: string;
  label: string;
  status: CommercialQualityCheckStatus;
  detail: string;
}

export interface CommercialQualityContentTotals {
  websitePages: number;
  servicePages: number;
  locationPages: number;
  blogPosts: number;
  patientGuides: number;
  faqPages: number;
  images: number;
  schemas: number;
  internalLinks: number;
  sitemap: number;
  registry: number;
  manifest: number;
}

export interface CommercialQualityPreviewLink {
  label: string;
  url: string;
  pageType: string;
}

export interface CommercialQualityLocationBreakdown {
  hubCount: number;
  clusterCount: number;
  areaPageCount: number;
}

export interface CommercialQualityReviewSummary {
  contentGenerated: boolean;
  contentGeneratedLabel: string;
  pagesGenerated: number;
  imagesGenerated: number;
  internalLinksLabel: string;
  schemaValidationLabel: string;
  seoValidationLabel: string;
  missingAssets: number;
  criticalErrors: number;
  estimatedReviewMinutes: number;
  overallStatus: "READY FOR PUBLISHING" | "BLOCKED";
  publishingReadiness: "Ready" | "Blocked";
  navigationValidationLabel: string;
  contentQualityScore: number;
}

export interface CommercialQualityReviewPayload {
  version: 1;
  slug: string;
  serviceId: string;
  serviceName: string;
  generatedAt: string | null;
  generatorVersion: string | null;
  previewUrl: string;
  summary: CommercialQualityReviewSummary;
  contentTotals: CommercialQualityContentTotals;
  checks: CommercialQualityCheck[];
  warnings: string[];
  blockers: string[];
  approvalStatus: "pending" | "approved";
  approvedAt: string | null;
  approvedBy: string | null;
  canApprove: boolean;
  loadError?: string;
  authorisedGenerationJobId?: string | null;
  authorisedGenerationRevision?: string | null;
  productOwnerAuthorised?: boolean;
  locationBreakdown?: CommercialQualityLocationBreakdown;
  previewLinks?: CommercialQualityPreviewLink[];
  productOwnerQualityAudit?: import("./masterAdminProductOwnerQualityAuditModel.ts").ProductOwnerQualityAuditPayload | null;
  pageInspectionWorkspace?: import("./masterAdminQualityReviewPageInspectionModel.ts").QualityReviewPageInspectionWorkspace | null;
  imagePlatformWorkspace?: {
    platformStatus: string;
    uniqueApprovedAssets: number;
    pageSlotAssignments: number;
    assignmentsComplete: boolean;
    missingAssignments: number;
    placeholderFallbacks: number;
    brokenAssets: number;
    crossTenantAssets: number;
    pagesUsingProductionPhotography: number;
    imageCompletenessStatus: string;
    perPage: Array<{
      pageSlug: string;
      pageType: string;
      requiredRoles: string[];
      assignedAssets: string[];
      imageStatus: string;
    }>;
  } | null;
}

export interface CommercialQualityApprovalSnapshot {
  version: 1;
  slug: string;
  serviceId: string;
  approvedAt: string;
  approvedBy: string;
  generatedAt: string | null;
  generatorVersion: string | null;
  tenant: string;
  summary: CommercialQualityReviewSummary;
  contentTotals: CommercialQualityContentTotals;
  checks: CommercialQualityCheck[];
  warnings: string[];
  blockers: string[];
  validationEvidence: Record<string, unknown>;
}
