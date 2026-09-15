/**
 * CPR-RESET-01 — structured imported evidence review (website + Google + comparison).
 */

export type ImportedEvidenceStatus = "Confirmed" | "Needs Review" | "Not Found";

export interface ImportedEvidenceRow {
  id: string;
  group: "business" | "brand" | "content" | "google";
  label: string;
  value: string;
  sourceUrl: string;
  extractionMethod: string;
  confidence: number | null;
  capturedAt: string | null;
  status: ImportedEvidenceStatus;
}

export interface WebsiteGoogleComparisonRow {
  id: string;
  label: string;
  websiteValue: string;
  googleValue: string;
  matchStatus: "match" | "difference" | "website_only" | "google_only" | "both_missing";
  productOwnerDecision: string | null;
}

export interface ImportTenantIsolationCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export interface ImportTenantIsolationGate {
  passed: boolean;
  blockers: string[];
  checks: ImportTenantIsolationCheck[];
}

export interface ImportedEvidenceCrawlCoverage {
  contentPagesAnalysed: number;
  sitemapFound: boolean;
  pages: Array<{
    url: string;
    discoverySource: string;
    category: string;
    fetchStatus: string;
    title: string;
    h1: string;
  }>;
}

export interface ImportedEvidenceQualityStatus {
  technicallyComplete: boolean;
  safeForBusinessProfileReview: boolean;
  blockers: string[];
  warnings: string[];
  contentPagesAnalysed: number;
  sitemapDocumentsExcluded: number;
  assessedAt: string | null;
}

export interface ImportedEvidenceReviewPayload {
  slug: string;
  pharmacyName: string;
  websiteUrl: string;
  websiteImported: boolean;
  googleImported: boolean;
  googleProfileState: string;
  websiteEvidence: ImportedEvidenceRow[];
  googleEvidence: ImportedEvidenceRow[];
  /** Profile/onboarding Google-related values — explicit non-import provenance. */
  googleProfileReconciliation?: ImportedEvidenceRow[];
  comparison: WebsiteGoogleComparisonRow[];
  comparisonState?: "available" | "suppressed" | "not_applicable";
  crawlCoverage?: ImportedEvidenceCrawlCoverage | null;
  evidenceQuality?: ImportedEvidenceQualityStatus | null;
  /**
   * When true, Re-import Website is the corrective/primary action (blocked evidence).
   * Invokes existing `rerun_website_import` — does not auto-run.
   */
  websiteReimportRequired?: boolean;
  /**
   * When true, Product Owner may deliberately re-import even if evidence is SAFE FOR REVIEW.
   * Optional control — does not change workflow readiness by itself.
   */
  websiteReimportAvailable?: boolean;
  websiteReimportActionId?: "rerun_website_import" | null;
  websiteReimportTargetUrl?: string;
  tenantIsolation: ImportTenantIsolationGate;
  googleCandidates: Array<{
    placeId: string;
    businessName: string;
    address: string;
    postcode: string;
    phone: string;
    website: string;
    rating: number | null;
    reviewCount: number;
    primaryCategory: string;
    googleMapsUrl: string;
    confidence: number;
  }>;
  branchSelection: import("./masterAdminWebsiteBranchResolutionModel.ts").WebsiteBranchSelectionPayload | null;
  summary: string;
}
