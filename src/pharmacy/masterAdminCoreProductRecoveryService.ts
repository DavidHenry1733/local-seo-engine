/**
 * CPR-01 — Core Product Recovery: controlled service-page-only generation.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { resolveCustomerFacingPharmacyName } from "./pharmacyServicePageProfileContext.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { readLatestApprovalSnapshot } from "./masterAdminBusinessProfileReviewService.ts";
import { buildGenerationSetupState } from "./masterAdminGenerationSetupService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { buildProductionPageSlotInventory } from "./imagePlatform/pharmacyProductionImageSlotInventoryService.ts";
import {
  isPharmacyFirstProductionLibraryReady,
  loadProductionLibraryRevision,
  selectDeterministicProductionAsset,
  type ProductionSlotCriteria,
} from "./imagePlatform/pharmacyImagePlatformProductionResolver.ts";
import { mapSlotPageType } from "./imagePlatform/pharmacyProductionImageSlotInventoryService.ts";
import type { ProductionImageSlotPlan } from "./imagePlatform/pharmacyProductionImageSlotInventoryService.ts";
import { loadImageAssignments } from "./pharmacyImageOperatingSystem.ts";
import { loadContentPackage } from "./pharmacyContentPackageService.ts";
import { listMasterAdminJobs, runMasterAdminJobAsync } from "./masterAdminJobService.ts";
import { queueServicePageOnlyJob, SERVICE_PAGE_ONLY_SCOPE, buildServicePageJobContract } from "./masterAdminServicePageJobService.ts";
import { evaluateServicePageGenerationReadiness } from "./masterAdminServicePageGenerationReadinessService.ts";
import { isLockedCommercialSupportedService } from "./masterAdminLockedCommercialServiceCatalog.ts";
import {
  buildCprEvidenceFields,
  enrichEvidenceFieldsWithSeo,
  enrichImageEvidenceFields,
  evaluateRequiredEvidenceGate,
} from "./masterAdminCoreProductRecoveryEvidenceService.ts";
import { buildServicePageSeoPlan, preferCustomerFacingSeoTitle, readServicePageSeoPlan, validateServicePageSeoContract } from "./masterAdminCoreProductRecoverySeoService.ts";
import {
  buildFutureClusterLinkPlan,
  readFutureClusterLinkPlan,
  validateFutureClusterLinkPlan,
} from "./masterAdminCoreProductRecoveryFutureLinkPlanService.ts";
import { isServicePageEvidenceReviewApproved } from "./masterAdminCoreProductRecoveryEvidenceReviewService.ts";
import { evaluateCommercialServicePageChecklist, lockServicePageFrameworkV1, readServicePageFrameworkLock } from "./masterAdminCoreProductRecoveryCommercialChecklistService.ts";
import { assertCommercialPageContractV1ForGeneration } from "./masterAdminCommercialPageContractV1Service.ts";
import { validateServicePageOutputScope } from "./masterAdminCoreProductRecoveryOutputScopeService.ts";
import { resolveBrandResolutionAudit } from "./pharmacyServicePageTenantContextService.ts";
import { repairServicePagePostGenerationIdentity } from "./masterAdminServicePagePostGenerationIdentityService.ts";
import {
  resolveServicePageGenerationIdentity as resolveServicePageGenerationIdentityCore,
  type ServicePageGenerationIdentity,
} from "./masterAdminServicePageGenerationIdentity.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { resolveCanonicalCampaignMembership } from "./canonicalCampaignLifecycleResolver.ts";
import {
  recordCanonicalCampaignPageDecision,
  resolveCanonicalPageApproval,
} from "./canonicalCampaignApprovalService.ts";
import { readPharmacyCampaignStore } from "./pharmacyCampaignService.ts";
import { buildContentEcosystemLocalPreviewUrl } from "./pharmacyClusterPageUrlResolver.ts";
import {
  finishWorkflowExecution,
  getLastRecordedWorkflowStage,
  recordWorkflowTransition,
  startWorkflowExecution,
} from "./masterAdminWorkflowHistoryService.ts";
import type {
  CoreProductRecoveryContract,
  ServicePageEvidenceField,
  ServicePageGenerationDashboard,
  ServicePageGenerationRecord,
  ServicePageImageSelection,
  ServicePageReviewPayload,
} from "./masterAdminCoreProductRecoveryModel.ts";
import { evaluateLocalityHtmlDuplicationGate } from "./pharmacyLocalityPageDuplicationGateV1.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { resolveApprovedCurrentRunCandidatePublishReadiness } from "./pharmacyCurrentRunApprovedCandidatePublishAdapter.ts";

/** Explicit Product Owner locality review scope — never invents Pharmacy First / primary service. */
export type LocalityReviewScope = {
  campaignId?: string | null;
  serviceId?: string | null;
};

const CONTRACT_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/core-product-recovery");
const GENERATION_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-generation");
const REVIEW_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-review");

function reviewDecisionPath(slug: string): string {
  return path.join(REVIEW_DIR, slug, "decision.json");
}

/** Campaign-scoped Product Owner service-page approval — never tenant-only. */
export type CampaignServicePageReviewDecision = {
  version: 1;
  approvalType: "service-page-review";
  slug: string;
  campaignId: string;
  serviceId: string;
  generationRevision: string;
  decision: "approved" | "needs_changes" | "pending_product_owner_review";
  operator?: string | null;
  decidedAt?: string | null;
  history?: Array<{
    generationRevision: string;
    decision: string;
    operator?: string | null;
    decidedAt?: string | null;
  }>;
};

export type ServicePageReviewScope = {
  campaignId?: string | null;
  serviceId?: string | null;
};

function campaignServiceReviewDecisionPath(slug: string, campaignId: string): string {
  return path.join(REVIEW_DIR, slug, "by-campaign", campaignId, "decision.json");
}

export function readServicePageReviewDecision(
  slug: string,
): { decision: string; decidedAt?: string; operator?: string } | null {
  const file = reviewDecisionPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as { decision: string; decidedAt?: string; operator?: string };
  } catch {
    return null;
  }
}

export function readCampaignServicePageReviewDecision(
  slug: string,
  campaignId: string,
): CampaignServicePageReviewDecision | null {
  const cid = String(campaignId || "").trim();
  if (!cid) return null;
  const file = campaignServiceReviewDecisionPath(slug, cid);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as CampaignServicePageReviewDecision;
    if (!raw || raw.campaignId !== cid) return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * True only when a campaign-scoped approval matches tenant + campaign + service + current revision.
 * Never uses tenant-level decision.json to approve another campaign/service/revision.
 */
export function isCampaignServicePageReviewApproved(
  slug: string,
  campaignId: string,
  serviceId: string,
  generationRevision: string | null | undefined,
): boolean {
  const decision = readCampaignServicePageReviewDecision(slug, campaignId);
  if (!decision || decision.decision !== "approved") return false;
  if (decision.approvalType && decision.approvalType !== "service-page-review") return false;
  if (decision.serviceId !== serviceId) return false;
  const rev = String(generationRevision || "").trim();
  if (!rev || String(decision.generationRevision || "").trim() !== rev) return false;
  return true;
}

export function isServicePageReviewApproved(slug: string): boolean {
  return readServicePageReviewDecision(slug)?.decision === "approved";
}

function resolveCprPrimaryServiceId(slug: string): string {
  const ctx = loadMasterAdminCustomerContext(slug);
  return ctx?.serviceId || "pharmacy-first";
}

function listGeneratedLocalClusterAreaDirs(localDir: string): string[] {
  if (!fs.existsSync(localDir)) return [];
  const names = fs
    .readdirSync(localDir)
    .filter((name) => fs.existsSync(path.join(localDir, name, "index.html")));
  // Current RC1 layout writes local/{area}/; legacy writes local/cluster-{area}/.
  const current = names.filter((name) => !name.startsWith("cluster-"));
  return (current.length ? current : names.filter((name) => name.startsWith("cluster-"))).sort();
}

/** Read-only signal — does not run cluster generation. */
export function isCprLocalClusterGenerationComplete(slug: string): boolean {
  if (!isCoreProductRecoveryMode(slug)) return false;
  const serviceId = resolveCprPrimaryServiceId(slug);
  const ecoRoot = path.join(WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId);
  for (const indexName of ["index.json", "_ecosystem-index.json"]) {
    const indexPath = path.join(ecoRoot, indexName);
    if (!fs.existsSync(indexPath)) continue;
    try {
      const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as { localClusterPagesGenerated?: number };
      if ((index.localClusterPagesGenerated ?? 0) > 0) return true;
    } catch {
      /* ignore */
    }
  }
  const localDir = path.join(ecoRoot, "local");
  return listGeneratedLocalClusterAreaDirs(localDir).length > 0;
}

export function isCprClusterGenerationEligible(slug: string): boolean {
  const serviceId = resolveCprPrimaryServiceId(slug);
  return (
    isCoreProductRecoveryMode(slug) &&
    isServicePageGeneratedForIdentity(slug, serviceId) &&
    isServicePageReviewApproved(slug) &&
    !isCprLocalClusterGenerationComplete(slug)
  );
}

const CLUSTER_REVIEW_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/cluster-page-review");

function clusterReviewDecisionPath(slug: string): string {
  return path.join(CLUSTER_REVIEW_DIR, slug, "decision.json");
}

export function readCprClusterReviewDecision(
  slug: string,
): { decision: string; decidedAt?: string; operator?: string } | null {
  const file = clusterReviewDecisionPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as { decision: string; decidedAt?: string; operator?: string };
  } catch {
    return null;
  }
}

export function isCprClusterReviewApproved(slug: string): boolean {
  return readCprClusterReviewDecision(slug)?.decision === "approved";
}

export function isCprClusterReviewPending(slug: string): boolean {
  return (
    isCoreProductRecoveryMode(slug) &&
    isServicePageReviewApproved(slug) &&
    isCprLocalClusterGenerationComplete(slug) &&
    !isCprClusterReviewApproved(slug)
  );
}

const LOCALITY_JOB_ACTIONS = new Set([
  "generate_local_cluster_pages",
  "regenerate_all_local_cluster_pages",
  "regenerate_local_cluster_page",
]);

/**
 * Resolve locality review identity from explicit campaign scope or active campaign selection.
 * Does not fall back to Pharmacy First, primary service, or tenant-level cluster state.
 */
export function resolveLocalityReviewIdentity(
  slug: string,
  scope?: LocalityReviewScope,
): { campaignId: string; serviceId: string } | null {
  const active = readActiveServiceCampaignSelection(slug);
  const campaignId = String(scope?.campaignId || active?.campaignId || "").trim();
  if (!campaignId) return null;

  const store = readPharmacyCampaignStore(slug);
  const campaign = store?.campaigns.find((c) => c.id === campaignId);
  const campaignServiceId = String(campaign?.serviceId || "").trim();
  if (!campaignServiceId) return null;

  const requestedServiceId = String(scope?.serviceId || "").trim();
  if (requestedServiceId && requestedServiceId !== campaignServiceId) return null;

  return { campaignId, serviceId: campaignServiceId };
}

export function findActiveLocalClusterGenerationJob(slug: string, scope?: LocalityReviewScope) {
  const identity = resolveLocalityReviewIdentity(slug, scope);
  return (
    listMasterAdminJobs({ slug, limit: 20 }).find(
      (j) =>
        LOCALITY_JOB_ACTIONS.has(j.action) &&
        (j.status === "queued" || j.status === "claimed" || j.status === "running") &&
        (!identity || ((!j.serviceId || j.serviceId === identity.serviceId) &&
          (!j.campaignId || j.campaignId === identity.campaignId))),
    ) || null
  );
}

export function findCompletedLocalClusterGenerationJob(slug: string, scope?: LocalityReviewScope) {
  const identity = resolveLocalityReviewIdentity(slug, scope);
  if (!identity) return null;
  return (
    listMasterAdminJobs({ slug, limit: 40 }).find(
      (j) =>
        LOCALITY_JOB_ACTIONS.has(j.action) &&
        j.status === "completed" &&
        j.serviceId === identity.serviceId &&
        (!j.campaignId || j.campaignId === identity.campaignId),
    ) || null
  );
}

export type LocalityPageReviewDecision = "pending" | "approved" | "rejected";

export type LocalityPageDecisionRecord = {
  areaSlug: string;
  decision: LocalityPageReviewDecision;
  decidedAt: string | null;
  operator: string | null;
};

type LocalityPageDecisionStore = {
  version: 1;
  slug: string;
  campaignId: string;
  serviceId: string;
  decisions: Record<string, LocalityPageDecisionRecord>;
  updatedAt: string;
};

function localityPageDecisionsPath(slug: string, campaignId: string): string {
  return path.join(CLUSTER_REVIEW_DIR, slug, "by-campaign", campaignId, "localities.json");
}

export function readLocalityPageDecisionStore(
  slug: string,
  scope?: LocalityReviewScope,
): LocalityPageDecisionStore | null {
  const identity = resolveLocalityReviewIdentity(slug, scope);
  if (!identity) return null;
  const file = localityPageDecisionsPath(slug, identity.campaignId);
  if (!fs.existsSync(file)) {
    return {
      version: 1,
      slug,
      campaignId: identity.campaignId,
      serviceId: identity.serviceId,
      decisions: {},
      updatedAt: "",
    };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as LocalityPageDecisionStore;
    if (!raw || raw.campaignId !== identity.campaignId) return null;
    return {
      version: 1,
      slug,
      campaignId: identity.campaignId,
      serviceId: identity.serviceId,
      decisions: raw.decisions || {},
      updatedAt: raw.updatedAt || "",
    };
  } catch {
    return null;
  }
}

function localityDuplicationGateForPages(
  slug: string,
  pages: Array<{ areaSlug: string; label: string; outputPath: string }>,
): ReturnType<typeof evaluateLocalityHtmlDuplicationGate> {
  const pharmacyName = buildPharmacyServicePageProfile(slug).pharmacyName;
  const loaded = pages
    .filter((p) => p.outputPath && fs.existsSync(p.outputPath))
    .map((p) => ({
      areaSlug: p.areaSlug,
      areaName: p.label,
      html: fs.readFileSync(p.outputPath, "utf8"),
    }));
  return evaluateLocalityHtmlDuplicationGate({ pages: loaded, pharmacyName });
}

/**
 * Persist a single locality approval/rejection for tenant + campaign + service + locality.
 * Does not approve the service page, other localities, publish, or regenerate.
 */
export function decideLocalityPageReview(
  slug: string,
  areaSlug: string,
  decision: "approved" | "rejected",
  operator: string,
  scope?: LocalityReviewScope,
): ReturnType<typeof buildCprClusterReviewDashboard> {
  const identity = resolveLocalityReviewIdentity(slug, scope);
  if (!identity) return null;
  const candidates = resolveApprovedCurrentRunCandidatePublishReadiness(slug, identity.serviceId);
  if (candidates?.active) {
    return buildCprClusterReviewDashboard(slug, identity);
  }
  const area = String(areaSlug || "")
    .trim()
    .toLowerCase();
  if (!area) return null;

  const membership = resolveCanonicalCampaignMembership({
    tenantSlug: slug,
    campaignId: identity.campaignId,
  });
  if (!membership.resolved || membership.serviceId !== identity.serviceId || !membership.areaSlugs.includes(area)) {
    return null;
  }
  const pages = listCprClusterPagePreviews(slug, identity).filter((page) =>
    membership.areaSlugs.includes(page.areaSlug),
  );
  if (!pages.some((p) => p.areaSlug === area)) return null;

  if (decision === "approved") {
    const gate = localityDuplicationGateForPages(slug, pages);
    if (!gate.ok) {
      const dashboard = buildCprClusterReviewDashboard(slug, identity);
      return dashboard;
    }
  }

  const existing = readLocalityPageDecisionStore(slug, identity) || {
    version: 1 as const,
    slug,
    campaignId: identity.campaignId,
    serviceId: identity.serviceId,
    decisions: {},
    updatedAt: "",
  };

  const decidedAt = new Date().toISOString();
  const next: LocalityPageDecisionStore = {
    version: 1,
    slug,
    campaignId: identity.campaignId,
    serviceId: identity.serviceId,
    updatedAt: decidedAt,
    decisions: {
      ...existing.decisions,
      [area]: {
        areaSlug: area,
        decision,
        decidedAt,
        operator: operator || null,
      },
    },
  };
  writeJsonAtomic(localityPageDecisionsPath(slug, identity.campaignId), next);
  recordCanonicalCampaignPageDecision({
    tenantSlug: slug,
    campaignId: identity.campaignId,
    serviceId: identity.serviceId,
    pageType: "locality",
    areaSlug: area,
    decision,
    reviewer: operator || null,
    source: "master-admin",
    reviewedAt: decidedAt,
  });
  return buildCprClusterReviewDashboard(slug, identity);
}

export function listCprClusterPagePreviews(
  slug: string,
  scope?: LocalityReviewScope,
): Array<{
  areaSlug: string;
  label: string;
  previewUrl: string;
  outputPath: string;
}> {
  const identity = resolveLocalityReviewIdentity(slug, scope);
  if (!identity) return [];
  const localDir = path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    slug,
    identity.serviceId,
    "local",
  );
  return listGeneratedLocalClusterAreaDirs(localDir).map((areaSlug) => ({
    areaSlug,
    label: areaSlug.replace(/^cluster-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    previewUrl: buildContentEcosystemLocalPreviewUrl(identity.serviceId, areaSlug, slug),
    outputPath: path.join(localDir, areaSlug, "index.html"),
  }));
}

/**
 * Product Owner Locality Review loader — campaign-scoped registry only.
 * Availability is based on tenantSlug + campaignId + serviceId locality artefacts,
 * not tenant service-page review approval or primary-service cluster completeness.
 */
export function buildCprClusterReviewDashboard(
  slug: string,
  scope?: LocalityReviewScope,
): {
  slug: string;
  campaignId: string;
  serviceId: string;
  clusterComplete: boolean;
  clusterReviewApproved: boolean;
  reviewStatus: "pending" | "approved";
  approvedAt: string | null;
  completedJobId: string | null;
  activeJobId: string | null;
  pages: Array<{
    areaSlug: string;
    label: string;
    previewUrl: string;
    outputPath: string;
    decision: LocalityPageReviewDecision;
    decidedAt: string | null;
  }>;
  pageCount: number;
  approvedLocalityCount: number;
  remainingLocalityCount: number;
  canApprove: boolean;
  nextActionLabel: string;
  candidateAuthority?: boolean;
  duplicationGate?: {
    ok: boolean;
    message: string;
    failedPairs: Array<{ a: string; b: string; reason: string }>;
  };
} | null {
  if (!isCoreProductRecoveryMode(slug)) return null;
  const identity = resolveLocalityReviewIdentity(slug, scope);
  if (!identity) return null;

  const membership = resolveCanonicalCampaignMembership({
    tenantSlug: slug,
    campaignId: identity.campaignId,
  });
  const canonicalAreas =
    membership.resolved && membership.serviceId === identity.serviceId ? membership.areaSlugs : null;
  const candidates = resolveApprovedCurrentRunCandidatePublishReadiness(slug, identity.serviceId);
  if (candidates?.active && canonicalAreas) {
    const pages = canonicalAreas.map((areaSlug) => {
      const canonical = resolveCanonicalPageApproval({
        tenantSlug: slug,
        campaignId: identity.campaignId,
        serviceId: identity.serviceId,
        pageType: "locality",
        areaSlug,
      });
      const approved = canonical.decision === "APPROVED";
      const previewAsset =
        candidates.pages.find((page) => page.pageType === "local" && page.areaSlug === areaSlug)?.previewAsset ||
        "ai-local-area-page-pilot-v3";
      return {
        areaSlug,
        label: areaSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        previewUrl: `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(identity.serviceId)}&asset=${encodeURIComponent(previewAsset)}&area=${encodeURIComponent(areaSlug)}`,
        outputPath: "",
        decision: (canonical.decision === "REJECTED" ? "rejected" : approved ? "approved" : "pending") as LocalityPageReviewDecision,
        decidedAt: canonical.reviewedAt,
      };
    });
    const approvedLocalityCount = pages.filter((page) => page.decision === "approved").length;
    const remainingLocalityCount = pages.length - approvedLocalityCount;
    const allLocalitiesApproved = pages.length > 0 && remainingLocalityCount === 0;
    return {
      slug,
      campaignId: identity.campaignId,
      serviceId: identity.serviceId,
      clusterComplete: pages.length > 0,
      clusterReviewApproved: allLocalitiesApproved,
      reviewStatus: allLocalitiesApproved ? "approved" : "pending",
      approvedAt: allLocalitiesApproved ? candidates.candidateVersion : null,
      completedJobId: candidates.runId,
      activeJobId: null,
      pages,
      pageCount: pages.length,
      approvedLocalityCount,
      remainingLocalityCount,
      canApprove: false,
      candidateAuthority: true,
      nextActionLabel: allLocalitiesApproved
        ? "Ready to Publish"
        : "Approve remaining candidates in Review Centre",
      duplicationGate: { ok: true, message: "", failedPairs: [] },
    };
  }

  const completed = findCompletedLocalClusterGenerationJob(slug, identity);
  const active = findActiveLocalClusterGenerationJob(slug, identity);
  if (!canonicalAreas && !active) return null;
  const reviewAreas = canonicalAreas || [];
  if (reviewAreas.length === 0 && !active) return null;

  const rendered = new Map(listCprClusterPagePreviews(slug, identity).map((page) => [page.areaSlug, page]));
  const pages = reviewAreas.map((areaSlug) => {
    const preview = rendered.get(areaSlug);
    const canonical = resolveCanonicalPageApproval({
      tenantSlug: slug,
      campaignId: identity.campaignId,
      serviceId: identity.serviceId,
      pageType: "locality",
      areaSlug,
    });
    const decision: LocalityPageReviewDecision =
      canonical.decision === "APPROVED" ? "approved" : canonical.decision === "REJECTED" ? "rejected" : "pending";
    return {
      areaSlug,
      label: preview?.label || areaSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      previewUrl: preview?.previewUrl || "",
      outputPath: preview?.outputPath || "",
      decision,
      decidedAt: canonical.reviewedAt,
    };
  });
  const approvedLocalityCount = pages.filter((p) => p.decision === "approved").length;
  const remainingLocalityCount = pages.length - approvedLocalityCount;
  const allLocalitiesApproved = pages.length > 0 && remainingLocalityCount === 0;
  const duplicationGate = localityDuplicationGateForPages(slug, pages);
  return {
    slug,
    campaignId: identity.campaignId,
    serviceId: identity.serviceId,
    clusterComplete: pages.length > 0,
    clusterReviewApproved: allLocalitiesApproved,
    reviewStatus: allLocalitiesApproved ? "approved" : "pending",
    approvedAt: allLocalitiesApproved
      ? pages.map((p) => p.decidedAt).filter(Boolean).sort().slice(-1)[0] || null
      : null,
    completedJobId: completed?.id || null,
    activeJobId: active?.id || null,
    pages,
    pageCount: pages.length,
    approvedLocalityCount,
    remainingLocalityCount,
    canApprove: pages.length > 0 && remainingLocalityCount >= 2 && duplicationGate.ok,
    nextActionLabel: duplicationGate.ok ? "Review Locality Pages" : "Resolve locality duplication before approval",
    duplicationGate: {
      ok: duplicationGate.ok,
      message: duplicationGate.message,
      failedPairs: duplicationGate.pairs.filter((p) => p.blocked).map((p) => ({ a: p.a, b: p.b, reason: p.reason })),
    },
  };
}

export const CPR01_GENERATE_ACTION_LABEL = "Generate Service Page" as const;
export const CPR_CLUSTER_GENERATE_ACTION_LABEL = "Generate Cluster Pages" as const;
export const CPR_CLUSTER_IN_PROGRESS_ACTION_LABEL = "Cluster Generation in Progress" as const;
export const CPR_CLUSTER_REVIEW_ACTION_LABEL = "Review Cluster Pages" as const;
export const CPR_OPEN_PUBLISH_REVIEW_ACTION_LABEL = "Open Publish Review" as const;
export const CPR_DASHBOARD_INITIATION_SOURCE = "product_owner_dashboard" as const;
export const CPR01_CONFIRMATION_MESSAGE =
  "This will generate exactly one gold-standard service page using approved Business Profile evidence, Design Intelligence, Brand DNA, Component DNA, and Image Platform assets.\n\nNo cluster pages, blogs, guides, FAQs, or ecosystem packages will be created.";

function contractPath(slug: string): string {
  return path.join(CONTRACT_DIR, slug, "contract.json");
}

function legacyGenerationRecordPath(slug: string): string {
  return path.join(GENERATION_DIR, slug, "latest.json");
}

function scopedServiceGenerationRecordPath(slug: string, serviceId: string): string {
  return path.join(GENERATION_DIR, slug, "by-service", serviceId, "latest.json");
}

function scopedCampaignGenerationRecordPath(slug: string, campaignId: string): string {
  return path.join(GENERATION_DIR, slug, "by-campaign", campaignId, "latest.json");
}

export type { ServicePageGenerationIdentity };

/** Resolve generation identity; optional serviceId falls back to active/primary service only when omitted. */
export function resolveServicePageGenerationIdentity(
  slug: string,
  serviceId?: string,
  campaignId?: string | null,
): ServicePageGenerationIdentity {
  const sid = serviceId || resolvePrimaryServiceId(slug);
  return resolveServicePageGenerationIdentityCore(slug, sid, campaignId);
}

function readGenerationRecordFile(filePath: string): ServicePageGenerationRecord | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ServicePageGenerationRecord;
  } catch {
    return null;
  }
}

/** True when the active tenant+campaign+service identity already has a completed service page. */
export function isServicePageGeneratedForIdentity(
  slug: string,
  serviceId?: string,
  campaignId?: string | null,
): boolean {
  const identity = resolveServicePageGenerationIdentity(slug, serviceId, campaignId);
  const record = readServicePageGenerationRecord(slug, identity.serviceId, identity.campaignId);
  if (!record || record.status !== "completed") return false;
  if (record.serviceId && record.serviceId !== identity.serviceId) return false;
  if (identity.campaignId && record.campaignId && record.campaignId !== identity.campaignId) return false;
  return true;
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function field(
  id: string,
  label: string,
  group: string,
  value: string | null | undefined,
  required = false,
  source?: string | null,
): ServicePageEvidenceField {
  const v = value?.trim() || null;
  let status: ServicePageEvidenceField["status"] = "unknown";
  if (v) status = "confirmed";
  else if (required) status = "missing";
  return { id, label, group, value: v, status, source: source || null };
}

function slotCriteria(plan: ProductionImageSlotPlan): ProductionSlotCriteria {
  const editorialUse =
    plan.role.includes("guide-editorial") ? ("guide" as const) : plan.role.includes("blog-editorial") ? ("blog" as const) : null;
  return {
    serviceId: plan.serviceId,
    pageType: mapSlotPageType(plan.pageType, plan.role) as ProductionSlotCriteria["pageType"],
    slot: plan.slot as ProductionSlotCriteria["slot"],
    editorialUse,
    minWidth: plan.slot === "hero" ? 1200 : 800,
    minHeight: plan.slot === "hero" ? 675 : 600,
  };
}

export function readCoreProductRecoveryContract(slug: string): CoreProductRecoveryContract | null {
  const file = contractPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as CoreProductRecoveryContract;
    return raw?.enabled ? raw : null;
  } catch {
    return null;
  }
}

export function isCoreProductRecoveryMode(slug: string): boolean {
  return Boolean(readCoreProductRecoveryContract(slug));
}

export function enableCoreProductRecoveryContract(slug: string, operator: string): CoreProductRecoveryContract {
  const contract: CoreProductRecoveryContract = {
    version: 1,
    slug,
    mode: "cpr01_service_page_only",
    enabled: true,
    enabledAt: new Date().toISOString(),
    enabledBy: operator,
    generateActionLabel: CPR01_GENERATE_ACTION_LABEL,
    servicePageGenerated: false,
    servicePageJobId: null,
    servicePageGeneratedAt: null,
  };
  writeJsonAtomic(contractPath(slug), contract);
  return contract;
}

export function readServicePageGenerationRecord(
  slug: string,
  serviceId?: string,
  campaignId?: string | null,
): ServicePageGenerationRecord | null {
  const identity = resolveServicePageGenerationIdentity(slug, serviceId, campaignId);
  if (identity.campaignId) {
    const byCampaign = readGenerationRecordFile(
      scopedCampaignGenerationRecordPath(slug, identity.campaignId),
    );
    if (
      byCampaign &&
      (!byCampaign.serviceId || byCampaign.serviceId === identity.serviceId)
    ) {
      return byCampaign;
    }
  }
  const byService = readGenerationRecordFile(
    scopedServiceGenerationRecordPath(slug, identity.serviceId),
  );
  if (byService && (!byService.serviceId || byService.serviceId === identity.serviceId)) {
    if (
      identity.campaignId &&
      byService.campaignId &&
      byService.campaignId !== identity.campaignId
    ) {
      // Different campaign owns this service-scoped record.
    } else {
      return byService;
    }
  }
  // Legacy tenant-level latest.json is valid only for Pharmacy First.
  if (identity.serviceId === "pharmacy-first") {
    const legacy = readGenerationRecordFile(legacyGenerationRecordPath(slug));
    if (!legacy) return null;
    if (legacy.serviceId && legacy.serviceId !== "pharmacy-first") return null;
    return legacy;
  }
  return null;
}

export function writeServicePageGenerationRecord(record: ServicePageGenerationRecord): void {
  const sid = record.serviceId || "pharmacy-first";
  const identity = resolveServicePageGenerationIdentity(record.slug, sid, record.campaignId);
  const next: ServicePageGenerationRecord = {
    ...record,
    serviceId: sid,
    campaignId: identity.campaignId,
    generationType: "service-page",
  };
  if (identity.campaignId) {
    writeJsonAtomic(scopedCampaignGenerationRecordPath(record.slug, identity.campaignId), next);
  }
  writeJsonAtomic(scopedServiceGenerationRecordPath(record.slug, sid), next);
  // Preserve legacy Pharmacy First path for existing CPR consumers only.
  if (sid === "pharmacy-first") {
    writeJsonAtomic(legacyGenerationRecordPath(record.slug), next);
  }
}

function buildEvidenceFields(slug: string, serviceId: string): ServicePageEvidenceField[] {
  return buildCprEvidenceFields(slug, serviceId);
}

export function buildImageSelectionsForDashboard(slug: string, serviceId: string): ServicePageImageSelection[] {
  const slots = buildProductionPageSlotInventory(slug, serviceId, null).filter(
    (p) => p.pageSlug === serviceId && p.pageType === "service",
  );
  const doc = loadImageAssignments(slug);
  const used = new Set<string>();
  const selections: ServicePageImageSelection[] = [];

  for (const plan of slots) {
    const key = `${plan.pageSlug}:${plan.serviceId}:${plan.slot}`;
    const existing = doc.assignments[key] as { assetId?: string; filePath?: string; sourceType?: string } | undefined;
    if (existing?.filePath && existing.sourceType === "image-platform") {
      selections.push({
        slot: plan.slot,
        role: plan.role,
        approvedAssetId: existing.assetId || null,
        filePath: existing.filePath,
        selectionReason: `Persisted Image Platform assignment for ${plan.role}`,
        sourceType: existing.sourceType || "image-platform",
        altText: (existing as { altText?: string }).altText || `${plan.role} — ${serviceId}`,
        dimensions: plan.slot === "hero" ? "1200×675 min" : "800×600 min",
        status: "assigned",
      });
      if (existing.assetId) used.add(existing.assetId);
      continue;
    }
    if (!isPharmacyFirstProductionLibraryReady()) {
      selections.push({
        slot: plan.slot,
        role: plan.role,
        approvedAssetId: null,
        filePath: null,
        selectionReason: "Image Platform library not ready",
        status: "unavailable",
      });
      continue;
    }
    const asset = selectDeterministicProductionAsset(slotCriteria(plan), key, used);
    if (asset) {
      used.add(asset.assetId);
      selections.push({
        slot: plan.slot,
        role: plan.role,
        approvedAssetId: asset.assetId,
        filePath: asset.filePath,
        selectionReason: `Deterministic production asset for ${plan.role} (${asset.assetId})`,
        sourceType: "image-platform",
        altText: asset.altText || `${plan.role} — ${serviceId}`,
        dimensions: asset.width && asset.height ? `${asset.width}×${asset.height}` : plan.slot === "hero" ? "1200×675 min" : "800×600 min",
        status: "assigned",
      });
    } else {
      selections.push({
        slot: plan.slot,
        role: plan.role,
        approvedAssetId: null,
        filePath: null,
        selectionReason: `No approved asset available for ${plan.role}`,
        status: "missing",
      });
    }
  }
  return selections;
}

function resolvePrimaryServiceId(slug: string): string {
  const ctx = loadMasterAdminCustomerContext(slug);
  return ctx?.serviceId || "pharmacy-first";
}

export function buildServicePageGenerationDashboard(slug: string): ServicePageGenerationDashboard | null {
  const contract = readCoreProductRecoveryContract(slug);
  if (!contract) return null;
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return null;

  const profile = readSetupProfile(slug);
  const serviceId = resolvePrimaryServiceId(slug);
  const meta = getServicePublishMeta(serviceId);
  const seoPlan = readServicePageSeoPlan(slug, serviceId) || buildServicePageSeoPlan(slug, serviceId);
  const futureLinkPlan =
    readFutureClusterLinkPlan(slug) ||
    buildFutureClusterLinkPlan(slug, serviceId);
  const readiness = evaluateServicePageGenerationReadiness(slug, serviceId);
  const evidenceFields = readiness.evidenceFields;
  const imageSelections = buildImageSelectionsForDashboard(slug, serviceId);
  const requiredEvidenceGate = readiness.requiredEvidenceGate;
  const blockers = readiness.blockers;
  const warnings = readiness.warnings;

  const jobMatchesService = (j: { serviceId?: string | null }) =>
    j.serviceId === serviceId || (!j.serviceId && serviceId === "pharmacy-first");
  const activeJob =
    listMasterAdminJobs({ slug, limit: 5 }).find(
      (j) =>
        j.action === "generate_service_page" &&
        j.scope === SERVICE_PAGE_ONLY_SCOPE &&
        jobMatchesService(j) &&
        (j.status === "queued" || j.status === "claimed" || j.status === "running"),
    ) || null;
  const identity = resolveServicePageGenerationIdentity(slug, serviceId);
  const record = readServicePageGenerationRecord(slug, serviceId, identity.campaignId);
  // Never use tenant-level contract.servicePageGenerated for eligibility.
  const servicePageGenerated = isServicePageGeneratedForIdentity(
    slug,
    serviceId,
    identity.campaignId,
  );

  const evidenceReviewApproved = readiness.evidenceReviewApproved;
  const evidenceComplete = readiness.canGenerateEvidence;
  const canGenerate = evidenceComplete && !servicePageGenerated && !activeJob;
  const failedJob =
    listMasterAdminJobs({ slug, limit: 10 }).find(
      (j) =>
        j.action === "generate_service_page" &&
        j.scope === SERVICE_PAGE_ONLY_SCOPE &&
        jobMatchesService(j) &&
        j.status === "failed",
    ) || null;
  const activeJobContract = activeJob ? buildServicePageJobContract(activeJob) : null;
  const town = profile.primaryTown || profile.townCity || null;
  const serviceName = meta?.serviceName || serviceId;
  const plannedUrl = meta?.urlPath || `/${serviceId}/`;

  return {
    version: 1,
    slug,
    customerName: resolveCustomerFacingPharmacyName(profile) || slug,
    primaryService: serviceId,
    primaryServiceName: serviceName,
    townOrCity: town,
    canGenerate,
    generationInProgress: Boolean(activeJob),
    servicePageGenerated,
    activeJobId: activeJob?.id || null,
    activeJobContract,
    generationProgress: activeJob
      ? {
          percent: activeJob.progress ?? 0,
          stage: activeJob.stage || activeJob.progressLabel || activeJob.status || "queued",
          status: activeJob.status,
        }
      : null,
    generationError: !activeJob && failedJob && !servicePageGenerated ? failedJob.error || "Generation failed" : null,
    canRetryGeneration: Boolean(!activeJob && failedJob && !servicePageGenerated && evidenceComplete),
    activeAction: "generate_service_page_only",
    generateActionLabel: CPR01_GENERATE_ACTION_LABEL,
    evidenceComplete,
    evidenceFields,
    imageSelections,
    plan: {
      pageTitle: seoPlan.title,
      plannedUrl,
      canonicalUrl: seoPlan.canonicalUrl,
      serviceId,
      serviceName,
      townOrCity: town,
      expectedWordRange: { min: 1000, max: 1500 },
      schemaTypes: seoPlan.schemaTypes,
      seoElements: ["title", "meta description", "canonical", "robots", "OpenGraph", "Twitter"],
    },
    seoPlan,
    futureLinkPlan,
    requiredEvidenceGate,
    evidenceReviewApproved,
    blockers: [...blockers],
    warnings,
    summary: servicePageGenerated
      ? "Gold-standard service page generated — open Service Page Review for Product Owner inspection."
      : canGenerate
        ? "Ready to Generate — approved evidence complete."
        : !evidenceReviewApproved
          ? "Complete Product Owner evidence review before generating the service page."
          : blockers.length
            ? "Resolve blockers before generating the service page."
            : "Complete required evidence before generating the service page.",
    nextStep: servicePageGenerated
      ? "Open Service Page Review"
      : !evidenceReviewApproved
        ? "Open Evidence Review"
        : canGenerate
          ? CPR01_GENERATE_ACTION_LABEL
          : "Resolve blockers",
  };
}

export function assertServicePageGenerationAllowed(
  slug: string,
  serviceId?: string,
  campaignId?: string | null,
): { ok: boolean; error?: string; blockers?: string[] } {
  if (!isCoreProductRecoveryMode(slug)) {
    return { ok: false, error: "core_product_recovery_not_enabled", blockers: ["CPR-01 mode not enabled for this customer"] };
  }
  const contract = readCoreProductRecoveryContract(slug);
  if (!contract) return { ok: false, error: "customer_not_found" };
  const identity = resolveServicePageGenerationIdentity(slug, serviceId, campaignId);
  if (isServicePageGeneratedForIdentity(slug, identity.serviceId, identity.campaignId)) {
    return {
      ok: false,
      error: "service_page_already_generated",
      blockers: [
        `Service page already generated for ${identity.serviceId}` +
          (identity.campaignId ? ` (campaign ${identity.campaignId})` : ""),
      ],
    };
  }
  const readiness = evaluateServicePageGenerationReadiness(slug, identity.serviceId);
  if (!readiness.canGenerateEvidence) {
    return { ok: false, error: "evidence_incomplete", blockers: readiness.blockers };
  }
  return { ok: true };
}

export function confirmServicePageGeneration(
  slug: string,
  operator: string,
  options: { operatorConfirmed?: boolean; initiationSource?: string } = {},
): { ok: boolean; error?: string; jobId?: string; blockers?: string[] } {
  if (options.initiationSource !== CPR_DASHBOARD_INITIATION_SOURCE) {
    return {
      ok: false,
      error: "dashboard_only_required",
      blockers: ["Service page generation must be initiated from the Product Owner dashboard"],
    };
  }
  const gate = assertServicePageGenerationAllowed(slug);
  if (!gate.ok) return { ok: false, error: gate.error, blockers: gate.blockers };

  const identity = resolveServicePageGenerationIdentity(slug);
  const serviceId = identity.serviceId;
  const campaignId = identity.campaignId;
  const activeJob =
    listMasterAdminJobs({ slug, limit: 5 }).find(
      (j) =>
        j.action === "generate_service_page" &&
        j.scope === SERVICE_PAGE_ONLY_SCOPE &&
        (j.serviceId === serviceId || (!j.serviceId && serviceId === "pharmacy-first")) &&
        (j.status === "queued" || j.status === "claimed" || j.status === "running"),
    ) || null;
  if (activeJob) {
    if (activeJob.status === "queued") {
      runMasterAdminJobAsync(activeJob.id, activeJob.executionPayload || {});
    }
    return { ok: true, jobId: activeJob.id };
  }

  const job = queueServicePageOnlyJob({
    slug,
    operator,
    serviceId,
    campaignId: campaignId || undefined,
    executionPayload: {
      operatorConfirmed: options.operatorConfirmed === true,
      scope: SERVICE_PAGE_ONLY_SCOPE,
      initiationSource: CPR_DASHBOARD_INITIATION_SOURCE,
      serviceId,
      campaignId,
      generationType: "service-page",
    },
  });

  // Tenant contract job pointer remains Pharmacy First compatibility only.
  const contract = readCoreProductRecoveryContract(slug)!;
  if (serviceId === "pharmacy-first") {
    contract.servicePageJobId = job.id;
    writeJsonAtomic(contractPath(slug), contract);
  }

  return { ok: true, jobId: job.id };
}

export function markServicePageGenerationComplete(
  slug: string,
  patch: Partial<ServicePageGenerationRecord>,
): ServicePageGenerationRecord | null {
  const identity = resolveServicePageGenerationIdentity(slug, patch.serviceId, patch.campaignId);
  const serviceId = identity.serviceId;
  const record = readServicePageGenerationRecord(slug, serviceId, identity.campaignId);
  if (!record) return null;
  const status = patch.status || record.status;

  if (status === "completed") {
    const visualPath =
      patch.outputPath ||
      path.join(WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
    const html = fs.existsSync(visualPath) ? fs.readFileSync(visualPath, "utf8") : "";
    const checklist = evaluateCommercialServicePageChecklist(slug, serviceId);
    if (!checklist.allPassed) {
      const failed: ServicePageGenerationRecord = {
        ...record,
        ...patch,
        serviceId,
        campaignId: identity.campaignId,
        generationType: "service-page",
        status: "failed",
        completedAt: patch.completedAt || new Date().toISOString(),
        errors: checklist.generationErrors.length ? checklist.generationErrors : ["Commercial checklist failed"],
      };
      writeServicePageGenerationRecord(failed);
      return failed;
    }
    if (html) assertCommercialPageContractV1ForGeneration(html);
  }

  const next = {
    ...record,
    ...patch,
    serviceId,
    campaignId: identity.campaignId,
    generationType: "service-page" as const,
    status,
    errors: patch.errors ?? (status === "completed" ? [] : record.errors),
  };
  writeServicePageGenerationRecord(next);
  if (next.status === "completed") {
    repairServicePagePostGenerationIdentity({
      slug,
      serviceId,
      campaignId: identity.campaignId,
      jobId: next.jobId,
      previewUrl: next.previewUrl,
      outputPath: next.outputPath,
      scope: "service-page-only",
    });
  }
  const contract = readCoreProductRecoveryContract(slug);
  // Tenant-level CPR contract flag remains Pharmacy First compatibility only.
  if (contract && next.status === "completed" && serviceId === "pharmacy-first") {
    contract.servicePageGenerated = true;
    contract.servicePageGeneratedAt = next.completedAt || new Date().toISOString();
    writeJsonAtomic(contractPath(slug), contract);
  }
  return next;
}

function resolveServicePageReviewIdentity(
  slug: string,
  scope?: ServicePageReviewScope,
): { campaignId: string | null; serviceId: string } {
  const active = readActiveServiceCampaignSelection(slug);
  const requestedCampaignId = String(scope?.campaignId || "").trim();
  const requestedServiceId = String(scope?.serviceId || "").trim();
  let campaignId = requestedCampaignId || active?.campaignId || null;
  let serviceId =
    requestedServiceId ||
    (campaignId && active?.campaignId === campaignId ? active.serviceId : "") ||
    active?.serviceId ||
    resolvePrimaryServiceId(slug);
  serviceId = String(serviceId || "").trim();
  // Campaign-scoped approval requires the generated artifact's campaign identity.
  // Do not leave review approvable while approval_blocked because the dashboard
  // active-campaign file is missing.
  if (!campaignId && serviceId) {
    const record = readServicePageGenerationRecord(slug, serviceId, null);
    const recordCampaignId = String(record?.campaignId || "").trim();
    if (
      recordCampaignId &&
      record?.status === "completed" &&
      (!record.serviceId || record.serviceId === serviceId)
    ) {
      campaignId = recordCampaignId;
    }
  }
  return { campaignId, serviceId };
}

export function buildServicePageReview(
  slug: string,
  scope?: ServicePageReviewScope,
): ServicePageReviewPayload | null {
  if (!isCoreProductRecoveryMode(slug)) return null;
  const identity = resolveServicePageReviewIdentity(slug, scope);
  const serviceId = identity.serviceId;
  const campaignId = identity.campaignId;
  const record = readServicePageGenerationRecord(slug, serviceId, campaignId);
  const dashboard = buildServicePageGenerationDashboard(slug);
  if (!dashboard || !record || record.status !== "completed") return null;
  if (record.serviceId && record.serviceId !== serviceId) return null;

  const profile = readSetupProfile(slug);
  const previewUrl =
    record.previewUrl ||
    `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(slug)}`;
  const visualPath = path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-visual-experience",
    slug,
    serviceId,
    "index.html",
  );
  let wordCount = record.wordCount;
  let html = "";
  if (fs.existsSync(visualPath)) {
    html = fs.readFileSync(visualPath, "utf8");
    if (!wordCount) {
      wordCount = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    }
  }
  const seoPlan = dashboard.seoPlan;
  const seoValidation = validateServicePageSeoContract(slug, serviceId, html || undefined);
  const scopeValidation = validateServicePageOutputScope(slug, serviceId);
  const groups = ["business", "service", "trust", "brand", "images", "seo"] as const;
  const evidenceBySection = groups.map((section) => ({
    section,
    fields: dashboard.evidenceFields.filter((f) => f.group === section),
  }));
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);

  const errors = [...record.errors, ...seoValidation.errors];
  if (scopeValidation.status === "FAILED_SCOPE") {
    errors.push(...scopeValidation.forbidden.map((f) => `Forbidden output: ${f.kind} — ${f.path}`));
  }
  const commercialChecklist = evaluateCommercialServicePageChecklist(slug, serviceId);
  const frameworkLock = readServicePageFrameworkLock();
  const grouped = ["BRANDING", "CONTENT", "SEO", "IMAGES", "LINKS", "TECHNICAL"].map((category) => ({
    category,
    items: commercialChecklist.items.filter((i) => i.category === category),
  }));

  const generationRevision = record.imageAssignmentRevision || null;
  let reviewStatus: ServicePageReviewPayload["reviewStatus"] = "pending_product_owner_review";
  let approvedAt: string | null = null;
  if (campaignId) {
    // Campaign identity available — never fall back to tenant-level / primary-service approval.
    const campDecision = readCampaignServicePageReviewDecision(slug, campaignId);
    if (
      isCampaignServicePageReviewApproved(slug, campaignId, serviceId, generationRevision)
    ) {
      reviewStatus = "approved";
      approvedAt = campDecision?.decidedAt || null;
    } else if (
      campDecision?.decision === "needs_changes" &&
      campDecision.serviceId === serviceId &&
      String(campDecision.generationRevision || "") === String(generationRevision || "")
    ) {
      reviewStatus = "needs_changes";
    }
  } else {
    const decision = readServicePageReviewDecision(slug);
    if (decision?.decision === "approved") {
      reviewStatus = "approved";
      approvedAt = decision.decidedAt || null;
    } else if (decision?.decision === "needs_changes") {
      reviewStatus = "needs_changes";
    }
  }

  const gateCanApprove =
    scopeValidation.ok &&
    seoValidation.passed &&
    commercialChecklist.allPassed &&
    Boolean(wordCount && wordCount >= 200) &&
    dashboard.imageSelections.filter((i) => i.status === "assigned").length >= 4 &&
    Boolean(record.pageTitle && record.canonicalUrl);

  return {
    version: 1,
    slug,
    customerName: resolveCustomerFacingPharmacyName(profile) || slug,
    campaignId,
    serviceId,
    serviceName: dashboard.primaryServiceName,
    townOrCity: dashboard.townOrCity,
    scope: "service-page-only",
    pageTitle: preferCustomerFacingSeoTitle(record.pageTitle, seoPlan.title),
    canonicalUrl: record.canonicalUrl || seoPlan.canonicalUrl,
    previewUrl,
    wordCount,
    jobId: record.jobId,
    generationRevision: record.imageAssignmentRevision,
    evidenceFields: dashboard.evidenceFields,
    evidenceBySection,
    imageSelections: dashboard.imageSelections,
    metadata: {
      title: preferCustomerFacingSeoTitle(record.pageTitle, seoPlan.title),
      description: seoPlan.metaDescription,
      canonical: record.canonicalUrl || seoPlan.canonicalUrl,
      robots: seoPlan.robots,
      openGraph: seoPlan.openGraph,
      twitter: seoPlan.twitter,
    },
    schemaTypes: seoPlan.schemaTypes,
    schemaJsonLd: jsonLdMatch?.[1]?.trim() || null,
    internalLinks: [
      { label: "Service page", href: dashboard.plan.plannedUrl, status: "ok" },
      ...(dashboard.futureLinkPlan.entries || []).map((e) => ({
        label: e.plannedAnchorText,
        href: e.futureCanonicalUrl,
        status: "future" as const,
      })),
    ],
    futureLinkPlan: dashboard.futureLinkPlan,
    responsiveResults: {
      desktop: previewUrl ? "Preview available — open in new tab" : "Not available",
      tablet: previewUrl ? "Preview available — open in new tab" : "Not available",
      mobile: previewUrl ? "Preview available — open in new tab" : "Not available",
    },
    warnings: record.warnings,
    errors,
    seoChecks: seoValidation.checks,
    commercialChecklist: {
      passedCount: commercialChecklist.passedCount,
      failedCount: commercialChecklist.failedCount,
      allPassed: commercialChecklist.allPassed,
      items: commercialChecklist.items,
      grouped,
    },
    frameworkLocked: frameworkLock.locked,
    frameworkVersion: frameworkLock.version,
    brandResolution: resolveBrandResolutionAudit(slug),
    canApprove: reviewStatus === "pending_product_owner_review" && gateCanApprove,
    reviewStatus,
    approvedAt,
    clusterEligible: isCprClusterGenerationEligible(slug),
  };
}

export function resolveServicePageGenerationActionLabel(slug: string): string | null {
  if (!isCoreProductRecoveryMode(slug)) return null;
  const dashboard = buildServicePageGenerationDashboard(slug);
  if (!dashboard) return null;
  if (!dashboard.servicePageGenerated) {
    if (!dashboard.evidenceReviewApproved) return "Open Evidence Review";
    return CPR01_GENERATE_ACTION_LABEL;
  }
  if (!isServicePageReviewApproved(slug)) return "Open Service Page Review";
  if (findActiveLocalClusterGenerationJob(slug)) return CPR_CLUSTER_IN_PROGRESS_ACTION_LABEL;
  if (!isCprLocalClusterGenerationComplete(slug)) return CPR_CLUSTER_GENERATE_ACTION_LABEL;
  if (!isCprClusterReviewApproved(slug)) return CPR_CLUSTER_REVIEW_ACTION_LABEL;
  return CPR_OPEN_PUBLISH_REVIEW_ACTION_LABEL;
}

export function approveCprClusterReview(
  slug: string,
  operator: string,
  scope?: LocalityReviewScope,
): ReturnType<typeof buildCprClusterReviewDashboard> {
  const dashboard = buildCprClusterReviewDashboard(slug, scope);
  if (!dashboard) return dashboard;
  if (dashboard.candidateAuthority) return dashboard;
  if (!dashboard.canApprove) return dashboard;

  const identity = {
    campaignId: dashboard.campaignId,
    serviceId: dashboard.serviceId,
  };
  const existing = readLocalityPageDecisionStore(slug, identity) || {
    version: 1 as const,
    slug,
    campaignId: identity.campaignId,
    serviceId: identity.serviceId,
    decisions: {},
    updatedAt: "",
  };
  const decidedAt = new Date().toISOString();
  const decisions: Record<string, LocalityPageDecisionRecord> = { ...existing.decisions };
  for (const page of dashboard.pages) {
    const prev = decisions[page.areaSlug];
    if (prev?.decision === "approved") {
      // Preserve existing individual approval revision/state (e.g. Headingley).
      decisions[page.areaSlug] = prev;
      continue;
    }
    decisions[page.areaSlug] = {
      areaSlug: page.areaSlug,
      decision: "approved",
      decidedAt,
      operator: operator || null,
    };
  }
  writeJsonAtomic(localityPageDecisionsPath(slug, identity.campaignId), {
    version: 1,
    slug,
    campaignId: identity.campaignId,
    serviceId: identity.serviceId,
    updatedAt: decidedAt,
    decisions,
  });

  writeJsonAtomic(clusterReviewDecisionPath(slug), {
    slug,
    campaignId: dashboard.campaignId,
    serviceId: dashboard.serviceId,
    decision: "approved",
    operator,
    decidedAt,
    completedJobId: dashboard.completedJobId,
    pageCount: dashboard.pageCount,
    approvedLocalityCount: dashboard.pageCount,
  });
  return buildCprClusterReviewDashboard(slug, identity);
}

export {
  buildServicePageEvidenceReview,
  approveServicePageEvidenceReview,
  rejectServicePageEvidenceReview,
  decideServicePageEvidenceReviewField,
  isServicePageEvidenceReviewApproved,
} from "./masterAdminCoreProductRecoveryEvidenceReviewService.ts";
export { evaluateCommercialServicePageChecklist, readServicePageFrameworkLock } from "./masterAdminCoreProductRecoveryCommercialChecklistService.ts";
export { listLockedCommercialSupportedServices, assertLockedCommercialServiceCatalog } from "./masterAdminLockedCommercialServiceCatalog.ts";

export function evaluateServicePageQualityGate(
  slug: string,
  reviewScope?: ServicePageReviewScope,
): { passed: boolean; checks: Array<{ id: string; label: string; passed: boolean; detail?: string }>; errors: string[] } {
  const review = buildServicePageReview(slug, reviewScope);
  const checks: Array<{ id: string; label: string; passed: boolean; detail?: string }> = [];
  const errors: string[] = [];
  if (!review) {
    return { passed: false, checks: [{ id: "review", label: "Service page review available", passed: false }], errors: ["Service page review not available"] };
  }
  const outputScope = validateServicePageOutputScope(slug, review.serviceId);
  checks.push({ id: "scope", label: "Service-page-only scope", passed: outputScope.ok, detail: outputScope.status });
  checks.push({ id: "images", label: "Four image roles assigned", passed: (review.imageSelections || []).filter((i) => i.status === "assigned").length >= 4, detail: `${(review.imageSelections || []).filter((i) => i.status === "assigned").length}/4` });
  checks.push({ id: "metadata", label: "Metadata present", passed: Boolean(review.metadata?.title && review.metadata?.canonical) });
  checks.push({ id: "schema", label: "Schema types declared", passed: (review.schemaTypes || []).length > 0 });
  checks.push({ id: "links", label: "Internal links valid", passed: !(review.internalLinks || []).some((l) => l.status === "broken") });
  checks.push(...(review.seoChecks || []).map((c) => ({ id: `seo_${c.id}`, label: c.label, passed: c.passed, detail: c.detail })));
  for (const c of checks) if (!c.passed) errors.push(c.label);
  if (!outputScope.ok) errors.push(...outputScope.forbidden.map((f) => `Forbidden output: ${f.kind}`));
  return { passed: errors.length === 0, checks, errors };
}

export function approveServicePageReview(
  slug: string,
  operator: string,
  scope?: ServicePageReviewScope,
): ServicePageReviewPayload | null {
  const identity = resolveServicePageReviewIdentity(slug, scope);
  if (!identity.campaignId || !identity.serviceId) return null;
  const reviewScope = { campaignId: identity.campaignId, serviceId: identity.serviceId };
  const gate = evaluateServicePageQualityGate(slug, reviewScope);
  const review = buildServicePageReview(slug, reviewScope);
  if (!review || !gate.passed || !review.commercialChecklist?.allPassed) return null;

  const generationRevision = String(review.generationRevision || "").trim();
  if (!generationRevision) return null;

  lockServicePageFrameworkV1(slug, operator, evaluateCommercialServicePageChecklist(slug, review.serviceId));
  const decidedAt = new Date().toISOString();
  const existing = readCampaignServicePageReviewDecision(slug, identity.campaignId);
  const history = [...(existing?.history || [])];
  if (
    existing &&
    existing.decision === "approved" &&
    existing.generationRevision &&
    existing.generationRevision !== generationRevision
  ) {
    history.push({
      generationRevision: existing.generationRevision,
      decision: existing.decision,
      operator: existing.operator || null,
      decidedAt: existing.decidedAt || null,
    });
  }

  // Persist campaign-scoped approval only. Do not rewrite legacy tenant decision.json.
  const campaignDecision: CampaignServicePageReviewDecision = {
    version: 1,
    approvalType: "service-page-review",
    slug,
    campaignId: identity.campaignId,
    serviceId: identity.serviceId,
    generationRevision,
    decision: "approved",
    operator,
    decidedAt,
    history,
  };
  writeJsonAtomic(campaignServiceReviewDecisionPath(slug, identity.campaignId), campaignDecision);
  recordCanonicalCampaignPageDecision({
    tenantSlug: slug,
    campaignId: identity.campaignId,
    serviceId: identity.serviceId,
    pageType: "service",
    decision: "approved",
    reviewer: operator || null,
    source: "master-admin",
    reviewedAt: decidedAt,
  });

  const recorded = getLastRecordedWorkflowStage(slug);
  if (recorded === "quality_review" || isCoreProductRecoveryMode(slug)) {
    startWorkflowExecution({
      slug,
      stageId: "quality_review",
      actionId: "approve_service_page_review",
      operator,
    });
    finishWorkflowExecution({
      slug,
      stageId: "quality_review",
      actionId: "approve_service_page_review",
      operator,
      evidence: "Service Page Review approved for CPR acceptance",
      status: "completed",
    });
    recordWorkflowTransition({
      slug,
      fromStage: "quality_review",
      toStage: "generate_ecosystem",
      operator,
      reason: "Service Page Review approved — cluster generation stage",
      evidence: `Service page review decision ${decidedAt}`,
    });
  }
  return {
    ...review,
    campaignId: identity.campaignId,
    canApprove: false,
    reviewStatus: "approved",
    approvedAt: decidedAt,
    clusterEligible: isCprClusterGenerationEligible(slug),
    qualityChecks: gate.checks,
    errors: gate.errors,
    frameworkLocked: true,
    frameworkVersion: "SERVICE PAGE FRAMEWORK V1",
  };
}

export function rejectServicePageReview(slug: string, operator: string, notes: string): ServicePageReviewPayload | null {
  const review = buildServicePageReview(slug);
  if (!review) return null;
  writeJsonAtomic(reviewDecisionPath(slug), {
    slug,
    decision: "needs_changes",
    operator,
    notes,
    decidedAt: new Date().toISOString(),
  });
  return { ...review, canApprove: false, reviewStatus: "needs_changes", productOwnerNotes: notes };
}
