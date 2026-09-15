/**
 * Sprint 8C — Commercial Publish Review model.
 */
export type CommercialPublishCheckStatus = "PASS" | "WARNING" | "FAIL";

export interface CommercialPublishCheck {
  id: string;
  label: string;
  status: CommercialPublishCheckStatus;
  detail: string;
}

export interface CommercialPublishDestination {
  publicWebsite: string;
  customerEcosystemUrl: string | null;
  managedTargetUrl: string | null;
  internalManagedUrl: string | null;
  dnsStatus: string | null;
  sslStatus: string | null;
  publishMethod: string;
  protocol: string;
  remotePath: string;
  host: string | null;
  lastConnectionTestAt: string | null;
  lastConnectionTestOk: boolean;
  connectionStatus: "Healthy" | "Warning" | "Offline";
  lastSuccessfulPublish: string | null;
  currentLiveVersion: string | null;
  proposedVersion: string;
  credentialsConfigured: boolean;
  destinationConfigured: boolean;
  targetWritable: boolean | null;
}

export interface CommercialPublishChangeSummary {
  mode: "initial_publish" | "incremental_publish";
  totalFiles: number;
  newFiles: number;
  changedFiles: number;
  unchangedFiles: number;
  deletedFiles: number;
  pages: number;
  images: number;
  sitemap: boolean;
  registry: boolean;
  manifest: boolean;
  redirects: number;
}

export interface CommercialPublishReviewSummary {
  qualityReviewApproved: boolean;
  generatedOutputComplete: boolean;
  publishingDestinationConfirmed: boolean;
  deploymentConnection: "Healthy" | "Warning" | "Offline";
  filesReady: number;
  pagesReady: number;
  assetsReady: number;
  lastGenerated: string | null;
  publishingReadiness: "READY TO PUBLISH" | "BLOCKED";
}

/** Sprint 8D — Commercial Publish stage summary panel. */
export interface CommercialPublishStageSummary {
  stageLabel: "Publish";
  generatedPackage: string;
  currentRelease: string;
  managedHostname: string | null;
  managedUrl: string | null;
  publishingStatus: string;
  previousRelease: string;
  publishingReadiness:
    | "READY TO PUBLISH"
    | "READY FOR INTERNAL PUBLISH"
    | "READY FOR CUSTOMER SUBDOMAIN"
    | "PUBLISHED & VERIFIED"
    | "BLOCKED";
  overallStatus:
    | "READY TO PUBLISH"
    | "READY FOR INTERNAL PUBLISH"
    | "READY FOR CUSTOMER SUBDOMAIN"
    | "PUBLISHED & VERIFIED"
    | "BLOCKED";
  customerEcosystemUrl: string | null;
  dnsStatus: string | null;
  sslStatus: string | null;
}

export type PublishedAssetEvidenceStatus = "PASS" | "FAIL" | "UNKNOWN";

/** Per-page Product Owner published-asset evidence for the current release. */
export interface CommercialPublishPublishedAsset {
  title: string;
  pageType: "Service Page" | "Locality Page";
  locality: string | null;
  url: string;
  pageSlug: string;
  serviceId: string;
  campaignId: string | null;
  releaseId: string;
  deploymentStatus: PublishedAssetEvidenceStatus;
  liveUrlStatus: PublishedAssetEvidenceStatus;
  registryStatus: PublishedAssetEvidenceStatus;
  sitemapStatus: PublishedAssetEvidenceStatus;
}

/** Shared post-publication verification summary for Publish Review. */
export interface CommercialPublishPublicationVerification {
  status: "PASS" | "FAIL" | "NOT_PUBLISHED";
  label: "PUBLISHED & VERIFIED" | "PUBLICATION INCOMPLETE" | "NOT PUBLISHED";
  publishedRelease: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  previousRelease: string | null;
  rollbackTarget: string | null;
  campaignPages: { ready: number; total: number };
  servicePages: { ready: number; total: number };
  localityPages: { ready: number; total: number };
  deployed: { ready: number; total: number };
  liveUrls: { ready: number; total: number };
  registry: { ready: number; total: number };
  sitemap: { ready: number; total: number };
  completedPublishJobId: string | null;
  assets: CommercialPublishPublishedAsset[];
}

/** Sprint 8D — Release metadata shown before and after publish. */
export interface CommercialPublishReleaseManagement {
  currentRelease: string | null;
  previousRelease: string | null;
  publishedVersion: number;
  publishedAt: string | null;
  publishedBy: string | null;
  publishDurationMs: number | null;
  rollbackTarget: string | null;
  rollbackAvailable: boolean;
}

export interface CommercialPublishProgressStage {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
}

export interface CommercialPublishReviewPayload {
  version: 1;
  slug: string;
  serviceId: string;
  generatedAt: string | null;
  summary: CommercialPublishReviewSummary;
  publishStageSummary: CommercialPublishStageSummary;
  releaseManagement: CommercialPublishReleaseManagement;
  destination: CommercialPublishDestination;
  checks: CommercialPublishCheck[];
  warnings: string[];
  blockers: string[];
  changeSummary: CommercialPublishChangeSummary;
  previewUrl: string;
  /** Next-release package inventory (composer). Used for Campaign Pages Ready / change summary. */
  pageList: Array<{ title: string; url: string; pageSlug: string }>;
  /**
   * Current published release campaign pages (FinalRenderManifest for currentRelease).
   * Used by Product Owner View Page List — not generated/unpublished inventory.
   */
  publishedPageList: Array<{
    title: string;
    pageType: "Service Page" | "Locality Page";
    locality: string | null;
    url: string;
    pageSlug: string;
    serviceId: string;
    campaignId: string | null;
    releaseId: string;
  }>;
  /** Post-publication evidence for the current completed campaign release. */
  publicationVerification: CommercialPublishPublicationVerification;
  qaApprovalReference: string | null;
  manifestPath: string | null;
  publishManifestPath: string | null;
  canApprove: boolean;
  activePublishJob: {
    id: string;
    status: string;
    progress: number;
    progressLabel: string;
    startedAt?: string;
    completedAt?: string;
    retryCount: number;
    publishProgress?: Record<string, unknown>;
  } | null;
  loadError?: string;
}

export interface CommercialPublishApprovalSnapshot {
  version: 1;
  slug: string;
  serviceId: string;
  releaseVersion: string;
  releaseId: string;
  generationVersion: string | null;
  qualityReviewApprovalReference: string;
  manifestHash: string;
  registryHash: string;
  sitemapHash: string;
  fileTotals: CommercialPublishChangeSummary;
  destination: CommercialPublishDestination;
  publishMethod: string;
  operator: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  publishedVersion: number;
  currentRelease: string;
  previousRelease: string | null;
  rollbackTarget: string | null;
  liveVerification: Record<string, unknown>;
  rollbackReference: string | null;
  jobId: string;
}
