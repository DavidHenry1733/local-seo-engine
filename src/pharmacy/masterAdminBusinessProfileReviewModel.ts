/**
 * Sprint 7B / Defect 042 — Business Profile Review model.
 */

export type ReviewFieldTier = "verified" | "recommended" | "needs_confirmation" | "missing";

export type ConflictClassification =
  | "MATCH"
  | "WEBSITE_ONLY"
  | "GOOGLE_ONLY"
  | "CONFLICT"
  | "MISSING"
  | "CONFIRMATION_REQUIRED";

export type ReviewFieldInputType =
  | "text"
  | "telephone"
  | "email"
  | "url"
  | "address"
  | "postcode"
  | "yes_no"
  | "opening_hours"
  | "select";

export type OperatorDecisionAction =
  | "use_website"
  | "use_google"
  | "keep_canonical"
  | "manual"
  | "unavailable"
  | "defer"
  | "confirm"
  | "reject"
  | "auto_accept";

export type ReviewFieldCategory =
  | "identity"
  | "contact"
  | "opening_hours"
  | "google_identity"
  | "services"
  | "trust_access"
  | "brand_website";

export interface ReviewFieldDecision {
  action: OperatorDecisionAction;
  finalValue: string;
  note?: string;
  decidedAt: string;
  decidedBy: string;
}

export type ReviewFieldApplicability = "required" | "optional" | "not_applicable";

export interface BusinessProfileReviewField {
  id: string;
  label: string;
  category: ReviewFieldCategory;
  blocking: boolean;
  regulatory: boolean;
  inputType: ReviewFieldInputType;
  websiteValue: string | null;
  googleValue: string | null;
  canonicalValue: string | null;
  recommendedValue: string | null;
  evidenceSource: string;
  confidence: number | null;
  freshness: string | null;
  classification: ConflictClassification;
  normalisationApplied: string | null;
  autoResolved: boolean;
  requiresAction: boolean;
  requiresHumanConfirmation: boolean;
  displayStatus: string;
  finalValue: string | null;
  decision: ReviewFieldDecision | null;
  deferred: boolean;
  approvalBlockReason: string | null;
  commercialActionLabel: string | null;
  reviewTier: ReviewFieldTier;
  /** Context-aware applicability — approval readiness uses required only. */
  applicability?: ReviewFieldApplicability;
  weeklyHours?: import("./masterAdminBusinessProfileOpeningHoursService.ts").WeeklyOpeningHoursEvidence;
}

export interface CompletenessSection {
  id: string;
  label: string;
  complete: boolean;
  missingFields: string[];
}

export type ReadinessLabel =
  | "READY TO APPROVE"
  | `NEEDS ${number} CONFIRMATIONS`
  | `NEEDS ${number} CONFLICTS RESOLVED`
  | `MISSING ${number} REQUIRED FIELDS`;

export interface BusinessProfileReviewSummary {
  pharmacyName: string;
  canonicalWebsite: string | null;
  googleBusinessProfile: string | null;
  googlePlaceId: string | null;
  websiteImportStatus: string;
  googleImportStatus: string;
  fieldsChecked: number;
  matches: number;
  confirmationsRequired: number;
  conflicts: number;
  missingBlocking: number;
  autoResolved: number;
  overallCompleteness: CompletenessSection[];
  readinessLabel: ReadinessLabel;
  readinessDetail: string;
  approvalDisabledReason: string | null;
  blockingFields: string[];
  nonBlockingWarnings: string[];
  approvalStatus: "draft" | "approved";
  profileRevision: number;
  approvedAt: string | null;
  approvedBy: string | null;
  /** Defect 043 — operator-facing commercial summary */
  automaticallyVerified: number;
  needsAttention: number;
  criticalIssues: number;
  estimatedReviewMinutes: number;
  approvalChecklist: string[];
  /** Sprint 7D — auto-merge tiers */
  verifiedCount: number;
  recommendedCount: number;
  needsConfirmationCount: number;
  missingInformationCount: number;
  /** Field confirmations + unconfirmed proposed canonical services. */
  remainingConfirmations: number;
  canonicalProfileMerged: boolean;
  /** NT-E2E-05 — optional Google profile section (always visible in review) */
  googleProfileState?: string;
  googleSectionStatus?: string;
  googleSectionDetail?: string;
  googleGrowthOpportunity?: string | null;
  googleConnectLaterAvailable?: boolean;
}

export interface BusinessProfileReviewStore {
  version: 1;
  slug: string;
  updatedAt: string;
  savedAt: string | null;
  savedBy: string | null;
  profileRevision: number;
  approvalStatus: "draft" | "approved";
  approvedAt: string | null;
  approvedBy: string | null;
  decisions: Record<string, ReviewFieldDecision>;
  deferredFields: string[];
  websiteEvidenceVersion: string | null;
  googleEvidenceVersion: string | null;
}

export interface BusinessProfileApprovalSnapshot {
  version: 1;
  slug: string;
  profileRevision: number;
  approvedAt: string;
  approvedBy: string;
  finalValues: Record<string, string>;
  fields: BusinessProfileReviewField[];
  websiteEvidenceVersion: string | null;
  googleEvidenceVersion: string | null;
  conflictDecisions: Record<string, ReviewFieldDecision>;
  deferredFields: string[];
  warnings: string[];
  sourceTimestamps: {
    websiteImportedAt: string | null;
    googleImportedAt: string | null;
    profileUpdatedAt: string | null;
  };
}

export interface BusinessProfileServiceReconciliationRow {
  canonicalServiceId: string;
  canonicalServiceName: string;
  configuredServiceName: string | null;
  websiteDiscoveredLabel: string | null;
  websiteSourceUrl: string | null;
  matchState: string;
  matchStateLabel: string;
  proposedForCanonical: boolean;
  matchReason: string;
}

export interface BusinessProfileServiceReconciliation {
  websiteSnapshotImportedAt: string | null;
  businessClassificationClass: string | null;
  clinicalCatalogueEligible: boolean;
  proposedCanonicalServiceIds: string[];
  excludedIncompatibleServiceIds: string[];
  downstreamTrusted: boolean;
  trustedDownstreamServiceIds: string[];
  pendingConfirmationCount: number;
  proposalConfirmed: boolean;
  rows: BusinessProfileServiceReconciliationRow[];
}

export interface BusinessProfileReviewPayload {
  summary: BusinessProfileReviewSummary;
  fields: BusinessProfileReviewField[];
  /** @deprecated use needsConfirmation */
  actionRequired: BusinessProfileReviewField[];
  reviewedAutomatically: BusinessProfileReviewField[];
  needsConfirmation: BusinessProfileReviewField[];
  missingInformation: BusinessProfileReviewField[];
  recommendedValues: BusinessProfileReviewField[];
  verifiedFields: BusinessProfileReviewField[];
  /** Context-aware: optional applicable fields (non-blocking). */
  optionalFields?: BusinessProfileReviewField[];
  /** Context-aware: not applicable for this business classification. */
  notApplicableFields?: BusinessProfileReviewField[];
  categories: Array<{ id: ReviewFieldCategory; label: string; fieldCount: number }>;
  store: BusinessProfileReviewStore | null;
  loadError: string | null;
  missingSources: string[];
  /** Visible when Google was deferred and website import did not supply brand evidence. */
  manualBrandConfirmation?: {
    available: boolean;
    confirmed: boolean;
    value: string | null;
    reason: string | null;
    googleProfileState: string;
  };
  /** Shared WI ↔ configured service reconciliation (review only — not auto-approved). */
  serviceReconciliation?: BusinessProfileServiceReconciliation | null;
}
