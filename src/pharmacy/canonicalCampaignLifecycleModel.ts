/**
 * Canonical campaign lifecycle contract (CP01).
 * Identity is the existing pharmacy campaign UUID.
 * Missing facts stay unresolved. This module does not invent state.
 */

export const CANONICAL_CAMPAIGN_LIFECYCLE_VERSION = 1 as const;

export type CanonicalLifecycleEvidenceScope =
  | "CANONICAL"
  | "HISTORICAL"
  | "LEGACY"
  | "UNSCOPED"
  | "UNRESOLVED";

export type CanonicalLifecycleCheckStatus = "PASS" | "WARN" | "FAIL";

export type CanonicalResultsJoinStatus = "joined" | "unscoped" | "stale" | "ambiguous" | "missing";

export type CanonicalRevisionStatus = "resolved" | "unresolved";

export type CanonicalApprovalAuthorityName =
  | "NONE"
  | "AMBIGUOUS"
  | "CAMPAIGN_SERVICE_PAGE_DECISION"
  | "REVIEW_CENTRE_APPROVED_ASSETS"
  | "MASTER_ADMIN_LOCALITY_DECISIONS";

export const CANONICAL_LIFECYCLE_REASON = {
  packageAreaSetDiffers: "PACKAGE_AREA_SET_DIFFERS",
  renderedAreaSetDiffers: "RENDERED_AREA_SET_DIFFERS",
  candidateAreaSetDiffers: "CANDIDATE_AREA_SET_DIFFERS",
  candidateRevisionUnresolved: "CANDIDATE_REVISION_UNRESOLVED",
  unattachedRenderedOutput: "UNATTACHED_RENDERED_OUTPUT",
  missingRenderedOutput: "MISSING_RENDERED_OUTPUT",
  membershipAreaSlugMissing: "MEMBERSHIP_AREA_SLUG_MISSING",
  renderedOutputUnscoped: "RENDERED_OUTPUT_UNSCOPED",
  packageAreaSetUnresolved: "PACKAGE_AREA_SET_UNRESOLVED",
  packageMissing: "PACKAGE_MISSING",
  packageCampaignIdMissing: "PACKAGE_CAMPAIGN_ID_MISSING",
  packageCampaignIdMismatch: "PACKAGE_CAMPAIGN_ID_MISMATCH",
  contentRevisionUnresolved: "CONTENT_REVISION_UNRESOLVED",
  servicePageOutputMissing: "SERVICE_PAGE_OUTPUT_MISSING",
  multipleApprovalAuthorities: "MULTIPLE_APPROVAL_AUTHORITIES",
  approvalRevisionUnresolved: "APPROVAL_REVISION_UNRESOLVED",
  approvalStoreCampaignMismatch: "APPROVAL_STORE_CAMPAIGN_MISMATCH",
  servicePageApprovalUnscoped: "SERVICE_PAGE_APPROVAL_UNSCOPED",
  servicePageDecisionServiceMismatch: "SERVICE_PAGE_DECISION_SERVICE_MISMATCH",
  localityApprovalAbsent: "LOCALITY_APPROVAL_ABSENT",
  publishIndexMissingCampaignId: "PUBLISH_INDEX_MISSING_CAMPAIGN_ID",
  publishIndexMissingContentHash: "PUBLISH_INDEX_MISSING_CONTENT_HASH",
  publishIndexMissingServiceId: "PUBLISH_INDEX_MISSING_SERVICE_ID",
  campaignPublishStatusMismatch: "CAMPAIGN_PUBLISH_STATUS_MISMATCH",
  sitemapNotCampaignScoped: "SITEMAP_NOT_CAMPAIGN_SCOPED",
  indexingStoreMissing: "INDEXING_STORE_MISSING",
  indexingStoreUnscoped: "INDEXING_STORE_UNSCOPED",
  indexingStoreStale: "INDEXING_STORE_STALE",
  searchConsoleAuthorityMissing: "SEARCH_CONSOLE_AUTHORITY_MISSING",
  indexDashboardMissing: "INDEX_DASHBOARD_MISSING",
  indexDashboardUnscoped: "INDEX_DASHBOARD_UNSCOPED",
  indexDashboardStale: "INDEX_DASHBOARD_STALE",
  resultsNotCampaignScoped: "RESULTS_NOT_CAMPAIGN_SCOPED",
  resultsRevisionUnresolved: "RESULTS_REVISION_UNRESOLVED",
  gscSummaryMissing: "GSC_SUMMARY_MISSING",
  gscSummaryUnscoped: "GSC_SUMMARY_UNSCOPED",
  gscSummaryStale: "GSC_SUMMARY_STALE",
  rankTrackingMissing: "RANK_TRACKING_MISSING",
  rankTrackingUnscoped: "RANK_TRACKING_UNSCOPED",
  rankTrackingStale: "RANK_TRACKING_STALE",
  visibilityMissing: "VISIBILITY_MISSING",
  visibilityUnscoped: "VISIBILITY_UNSCOPED",
  visibilityStale: "VISIBILITY_STALE",
  campaignNotFound: "CAMPAIGN_NOT_FOUND",
  identityUnresolved: "IDENTITY_UNRESOLVED",
} as const;

export type CanonicalLifecycleReasonCode =
  (typeof CANONICAL_LIFECYCLE_REASON)[keyof typeof CANONICAL_LIFECYCLE_REASON];

export interface CanonicalLifecycleHealthCheck {
  status: CanonicalLifecycleCheckStatus;
  reasons: CanonicalLifecycleReasonCode[];
}

export interface CanonicalCampaignLifecycleHealth {
  identity: CanonicalLifecycleHealthCheck;
  membership: CanonicalLifecycleHealthCheck;
  content: CanonicalLifecycleHealthCheck;
  approval: CanonicalLifecycleHealthCheck;
  publishing: CanonicalLifecycleHealthCheck;
  indexing: CanonicalLifecycleHealthCheck;
  results: CanonicalLifecycleHealthCheck;
}

export type CanonicalPageType = "service" | "locality" | "supporting";

export interface CanonicalCampaignPageRevision {
  pageType: CanonicalPageType;
  serviceId: string | null;
  areaSlug: string | null;
  sourcePath: string | null;
  /** SHA-256 of the current file bytes when the file exists. Observation only. */
  observedContentHash: string | null;
  revisionId: string | null;
  revisionStatus: CanonicalRevisionStatus;
  generatedAt: string | null;
  scope: CanonicalLifecycleEvidenceScope;
}

export interface CanonicalApprovalStamp {
  status: string | null;
  source: string;
  scope: CanonicalLifecycleEvidenceScope;
  approvedAt: string | null;
  revisionId: string | null;
  revisionStatus: CanonicalRevisionStatus;
  areaSlugs: string[];
}

export interface CanonicalPublishIndexPage {
  pageType: string | null;
  serviceId: string | null;
  areaSlug: string | null;
  campaignId: string | null;
  contentHash: string | null;
  revisionId: string | null;
  canonicalUrl: string | null;
  scope: CanonicalLifecycleEvidenceScope;
}

export interface CanonicalResultsSource {
  id: string;
  path: string;
  present: boolean;
  resultsJoinStatus: CanonicalResultsJoinStatus;
  measuredAt: string | null;
  reasons: CanonicalLifecycleReasonCode[];
}

export interface CanonicalMembershipConflict {
  code: CanonicalLifecycleReasonCode;
  detail: string;
}

export interface CanonicalCandidateEvidenceSet {
  sourcePath: string;
  scope: CanonicalLifecycleEvidenceScope;
  areaSlugs: string[];
}

export interface CanonicalCampaignLifecycle {
  version: typeof CANONICAL_CAMPAIGN_LIFECYCLE_VERSION;
  identity: {
    tenantSlug: string | null;
    campaignId: string | null;
    serviceId: string | null;
    campaignStatus: string | null;
    scope: CanonicalLifecycleEvidenceScope;
  };
  membership: {
    campaignAreaSlugs: string[];
    packageAreaSlugs: string[] | null;
    renderedAreaSlugs: string[];
    renderedScope: CanonicalLifecycleEvidenceScope;
    candidateSets: CanonicalCandidateEvidenceSet[];
    membershipAgreement: boolean;
    unattachedOutputs: string[];
    missingOutputs: string[];
    conflicts: CanonicalMembershipConflict[];
  };
  content: {
    servicePage: CanonicalCampaignPageRevision | null;
    localityPages: CanonicalCampaignPageRevision[];
    supportingPages: CanonicalCampaignPageRevision[];
    packagePath: string | null;
    packagePresent: boolean;
    packageCampaignId: string | null;
    packageCampaignScope: CanonicalLifecycleEvidenceScope;
    packageGeneratedAt: string | null;
    currentRun: {
      present: boolean;
      path: string;
      scope: CanonicalLifecycleEvidenceScope;
      kind: string | null;
      runId: string | null;
      candidateVersion: string | null;
      published: boolean | null;
      indexed: boolean | null;
    };
    legacyRunPaths: string[];
    revisionStatus: CanonicalRevisionStatus;
  };
  approval: {
    currentApprovalAuthority: CanonicalApprovalAuthorityName;
    competingApprovalAuthorities: CanonicalApprovalAuthorityName[];
    approvalRevisionMatch: "matched" | "mismatched" | "unresolved";
    approvalAmbiguity: boolean;
    servicePage: CanonicalApprovalStamp | null;
    unscopedServicePage: CanonicalApprovalStamp | null;
    reviewCentre: CanonicalApprovalStamp | null;
    localityDecisions: CanonicalApprovalStamp | null;
    localityApprovedCount: number;
    localityExpectedCount: number;
    imageAssignmentStamp: "matched" | "mismatched" | "absent";
    historical: Array<{ path: string; scope: "HISTORICAL"; explicitNonApproval: boolean | null }>;
  };
  publishing: {
    publishingStatus: string | null;
    publishedPages: number | null;
    publishIndexPresent: boolean;
    publishIndexPath: string;
    pages: CanonicalPublishIndexPage[];
    sitemapPresent: boolean;
    sitemapPath: string;
    sitemapScope: CanonicalLifecycleEvidenceScope | null;
  };
  indexing: {
    sources: CanonicalResultsSource[];
  };
  results: {
    sources: CanonicalResultsSource[];
  };
  health: CanonicalCampaignLifecycleHealth;
  inspectedPaths: string[];
}
