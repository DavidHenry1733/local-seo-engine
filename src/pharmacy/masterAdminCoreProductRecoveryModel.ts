/**
 * CPR-01 — Core Product Recovery acceptance mode (service page only).
 */
import type { ServicePageJobContract } from "./masterAdminServicePageJobService.ts";
import type { BrandResolutionAudit } from "./pharmacyServicePageTenantContextService.ts";
import type { BrandResolutionAudit } from "./pharmacyServicePageTenantContextService.ts";

export type CoreProductRecoveryMode = "cpr01_service_page_only";

export interface CoreProductRecoveryContract {
  version: 1;
  slug: string;
  mode: CoreProductRecoveryMode;
  enabled: true;
  enabledAt: string;
  enabledBy: string;
  generateActionLabel: "Generate Service Page";
  servicePageGenerated: boolean;
  servicePageJobId: string | null;
  servicePageGeneratedAt: string | null;
}

export type ServicePageEvidenceGroup =
  | "business"
  | "service"
  | "trust"
  | "brand"
  | "images"
  | "seo";

export interface ServicePageEvidenceField {
  id: string;
  label: string;
  group: ServicePageEvidenceGroup | string;
  value: string | null;
  status: "confirmed" | "not_confirmed" | "not_applicable";
  required?: boolean;
  source: string | null;
  allowNotApplicable?: boolean;
  requiresBusinessProfile?: boolean;
  productOwnerDecided?: boolean;
  decisionInvalidatedReason?: string | null;
  confidence?: number | null;
  capturedAt?: string | null;
}

export interface ServicePageImageSelection {
  slot: string;
  role: string;
  approvedAssetId: string | null;
  filePath: string | null;
  selectionReason: string;
  sourceType?: string | null;
  altText?: string | null;
  dimensions?: string | null;
  status: "assigned" | "missing" | "unavailable";
}

export interface ServicePageSeoPlan {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  robots: string;
  openGraph: { title: string; description: string; url: string; type: string };
  twitter: { card: string; title: string; description: string };
  schemaTypes: string[];
  faqSchemaIncluded: boolean;
  h1: string;
  headingHierarchy: string[];
  manifestRecord: string;
  registryRecord: string;
  sitemapReadyRecord: string;
  validLinks: boolean;
}

export interface ServicePageFutureLinkEntry {
  areaId: string;
  areaName: string;
  areaSlug: string;
  serviceId: string;
  futurePageTitle: string;
  futureCanonicalUrl: string;
  plannedAnchorText: string;
  parentServicePage: string;
  status: "pending_generation";
}

export interface ServicePageRequiredEvidenceGate {
  passed: boolean;
  blockers: string[];
}

export interface ServicePageGenerationPlan {
  pageTitle: string;
  plannedUrl: string;
  canonicalUrl: string;
  serviceId: string;
  serviceName: string;
  townOrCity: string | null;
  expectedWordRange: { min: number; max: number };
  schemaTypes: string[];
  seoElements: string[];
}

export interface ServicePageFutureLinkPlan {
  serviceHubUrl: string;
  entries: ServicePageFutureLinkEntry[];
  note: string;
  persistedAt?: string;
  /** @deprecated use entries */
  clusterPageUrls?: string[];
}

export interface ServicePageGenerationDashboard {
  version: 1;
  slug: string;
  customerName: string;
  primaryService: string;
  primaryServiceName: string;
  townOrCity: string | null;
  canGenerate: boolean;
  generationInProgress: boolean;
  servicePageGenerated: boolean;
  activeJobId: string | null;
  activeAction: "generate_service_page_only";
  generateActionLabel: "Generate Service Page";
  evidenceComplete: boolean;
  evidenceFields: ServicePageEvidenceField[];
  imageSelections: ServicePageImageSelection[];
  plan: ServicePageGenerationPlan;
  seoPlan: ServicePageSeoPlan;
  futureLinkPlan: ServicePageFutureLinkPlan;
  requiredEvidenceGate: ServicePageRequiredEvidenceGate;
  evidenceReviewApproved: boolean;
  blockers: string[];
  warnings: string[];
  summary: string;
  nextStep: string;
  activeJobContract?: ServicePageJobContract | null;
  generationProgress?: { percent: number; stage: string; status: string } | null;
  generationError?: string | null;
  canRetryGeneration?: boolean;
}

export interface ServicePageGenerationRecord {
  version: 1;
  slug: string;
  serviceId: string;
  /** Active Campaign OS campaign identity for multi-service isolation. */
  campaignId?: string | null;
  generationType?: "service-page";
  jobId: string;
  initiatedBy: string;
  initiationSource?: "product_owner_dashboard" | string;
  initiatedAt: string;
  completedAt: string | null;
  status: "queued" | "running" | "completed" | "failed";
  pageTitle: string | null;
  canonicalUrl: string | null;
  outputPath: string | null;
  previewUrl: string | null;
  wordCount: number | null;
  imageAssignmentRevision: string | null;
  manifestPath: string | null;
  errors: string[];
  warnings: string[];
}

export interface CommercialChecklistItemView {
  id: string;
  category: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface CommercialServicePageChecklistView {
  passedCount: number;
  failedCount: number;
  allPassed: boolean;
  items: CommercialChecklistItemView[];
  grouped: Array<{ category: string; items: CommercialChecklistItemView[] }>;
}

export interface ServicePageEvidenceReviewPayload {
  version: 1;
  slug: string;
  customerName: string;
  primaryService: string;
  primaryServiceName: string;
  sections: Array<{
    id: string;
    label: string;
    fields: ServicePageEvidenceField[];
    confirmedCount: number;
    totalCount: number;
    ready: boolean;
  }>;
  summary: string;
  canApprove: boolean;
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  blockers: string[];
}

export interface ServicePageReviewPayload {
  version: 1;
  slug: string;
  customerName: string;
  campaignId?: string | null;
  serviceId: string;
  serviceName: string;
  townOrCity: string | null;
  scope: "service-page-only";
  pageTitle: string;
  canonicalUrl: string;
  previewUrl: string;
  wordCount: number | null;
  evidenceFields: ServicePageEvidenceField[];
  evidenceBySection: Array<{ section: string; fields: ServicePageEvidenceField[] }>;
  imageSelections: ServicePageImageSelection[];
  metadata: {
    title: string | null;
    description: string | null;
    canonical: string | null;
    robots: string | null;
    openGraph?: { title?: string; description?: string; url?: string };
    twitter?: { card?: string; title?: string; description?: string };
  };
  schemaTypes: string[];
  schemaJsonLd?: string | null;
  internalLinks: Array<{ label: string; href: string; status: "ok" | "missing" | "future" }>;
  futureLinkPlan: ServicePageFutureLinkPlan;
  responsiveResults: { desktop: string; tablet: string; mobile: string };
  warnings: string[];
  errors: string[];
  canApprove: boolean;
  reviewStatus: "pending_product_owner_review" | "approved" | "needs_changes";
  approvedAt?: string | null;
  clusterEligible?: boolean;
  qualityChecks?: Array<{ id: string; label: string; passed: boolean; detail?: string }>;
  seoChecks?: Array<{ id: string; label: string; passed: boolean; detail?: string }>;
  commercialChecklist?: CommercialServicePageChecklistView;
  frameworkLocked?: boolean;
  frameworkVersion?: string | null;
  jobId?: string | null;
  generationRevision?: string | null;
  productOwnerNotes?: string | null;
  brandResolution?: BrandResolutionAudit;
}
