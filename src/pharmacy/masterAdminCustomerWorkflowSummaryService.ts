/**
 * NT-E2E-32B — Fast customer workflow summary (persisted JSON/state reads only).
 * Heavy panel construction loads lazily via existing panel routes.
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { readMasterAdminRegistry, safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { buildCustomerWorkflowState } from "./masterAdminWorkflowEngine.ts";
import type { CustomerWorkflowState } from "./masterAdminWorkflowModel.ts";
import { readCommercialIntelligenceApproval } from "./masterAdminWorkflowAckService.ts";
import { listMasterAdminJobs } from "./masterAdminJobService.ts";
import { getWorkflowHistory, getWorkflowExecutions } from "./masterAdminWorkflowHistoryService.ts";
import { listMasterAdminAudit } from "./masterAdminAuditService.ts";
import type { MasterAdminJob } from "./masterAdminJobService.ts";
import { isCompetitorAnalysisGenerated } from "./masterAdminCommercialIntelligenceWorkflowService.ts";
import { isCoreProductRecoveryMode } from "./masterAdminCoreProductRecoveryService.ts";
import { isBusinessProfileReviewApproved } from "./masterAdminBusinessProfileReviewService.ts";

export interface PersistedPanelSummary {
  status: string;
  capturedAt: string | null;
  refreshAvailable: boolean;
  [key: string]: unknown;
}

export interface MasterAdminCustomerWorkflowSummary {
  slug: string;
  customerName: string;
  currentStage: string;
  currentStageLabel: string;
  nextAction: string;
  workflowReadinessStatus: string;
  capturedAt: string;
  commercialIntelligence: PersistedPanelSummary;
  canonicalPlan: PersistedPanelSummary;
  authorisedGeneration: PersistedPanelSummary;
  productOwnerAcceptance: PersistedPanelSummary;
  imagePlatform: PersistedPanelSummary;
  qualityReview: PersistedPanelSummary;
  latestPackage: PersistedPanelSummary;
  publish: PersistedPanelSummary;
  indexing: PersistedPanelSummary;
  activeGenerationJob: {
    jobId: string;
    status: string;
    action: string;
    progress: number;
    progressLabel: string;
    updatedAt: string;
  } | null;
  panels: {
    generateEcosystem: string;
    qualityReview: string;
    commercialIntelligence: string;
    technicalLog: string;
    publishing: string;
    indexing: string;
  };
}

export interface MasterAdminTechnicalLogPayload {
  slug: string;
  capturedAt: string;
  transitions: ReturnType<typeof getWorkflowHistory>;
  executions: ReturnType<typeof getWorkflowExecutions>;
  jobs: MasterAdminJob[];
  auditEntries: ReturnType<typeof listMasterAdminAudit>;
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function unavailableSummary(extra: Record<string, unknown> = {}): PersistedPanelSummary {
  return {
    status: "unavailable",
    capturedAt: null,
    refreshAvailable: true,
    ...extra,
  };
}

function panelUrl(slug: string, panel: string): string {
  return `/api/admin/master?customer=${encodeURIComponent(slug)}&panel=${encodeURIComponent(panel)}`;
}

function apiPanelPath(slug: string, segment: string): string {
  return `/api/master-admin-platform/customers/${encodeURIComponent(slug)}/${segment}`;
}

function readCanonicalPlanSummary(slug: string): PersistedPanelSummary {
  const file = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/canonical-ecosystem-plans",
    slug,
    "latest.json",
  );
  const doc = readJsonFile<{
    planId?: string;
    generatedAt?: string;
    coreEcosystem?: { totalPages?: number; inventoryTotal?: number };
  }>(file);
  if (!doc) return unavailableSummary();
  const inventoryCount = doc.coreEcosystem?.inventoryTotal ?? doc.coreEcosystem?.totalPages ?? null;
  return {
    status: "available",
    capturedAt: doc.generatedAt || null,
    refreshAvailable: true,
    planId: doc.planId || null,
    inventoryCount,
  };
}

function readAuthorisedGenerationSummary(slug: string): PersistedPanelSummary {
  const file = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/authorised-ecosystem-generation",
    slug,
    "latest.json",
  );
  const doc = readJsonFile<{
    status?: string;
    jobId?: string;
    initiatedAt?: string;
    completedAt?: string;
    packageRevision?: string;
    pageCount?: number;
    qualityReviewReady?: boolean;
  }>(file);
  if (!doc) return unavailableSummary();
  return {
    status: doc.status || "available",
    capturedAt: doc.completedAt || doc.initiatedAt || null,
    refreshAvailable: true,
    jobId: doc.jobId || null,
    packageRevision: doc.packageRevision || null,
    pageCount: doc.pageCount ?? null,
    qualityReviewReady: doc.qualityReviewReady ?? null,
  };
}

function readProductOwnerAcceptanceSummary(slug: string): PersistedPanelSummary {
  const file = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/product-owner-acceptance-generation",
    slug,
    "contract.json",
  );
  const doc = readJsonFile<{
    enabled?: boolean;
    mode?: string;
    enabledAt?: string;
    activeStageLabel?: string;
    preservedHistoricalPackageJobIds?: string[];
    dashboardExternalPackages?: unknown[];
  }>(file);
  if (!doc) return unavailableSummary();
  return {
    status: doc.enabled ? "enabled" : "disabled",
    capturedAt: doc.enabledAt || null,
    refreshAvailable: false,
    mode: doc.mode || null,
    activeStageLabel: doc.activeStageLabel || null,
    preservedHistoricalPackageJobIds: doc.preservedHistoricalPackageJobIds || [],
    previousPackages: doc.dashboardExternalPackages || [],
  };
}

function readImagePlatformSummary(slug: string): PersistedPanelSummary {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-canonical-image-inventory", `${slug}.json`);
  const doc = readJsonFile<{
    generatedAt?: string;
    counts?: { pageSlotAssignments?: number; uniqueApprovedAssets?: number; assigned?: number; missing?: number };
  }>(file);
  if (!doc) return unavailableSummary();
  const counts = doc.counts || {};
  const assignmentCount = counts.pageSlotAssignments ?? 0;
  const uniqueApprovedAssets = counts.uniqueApprovedAssets ?? 0;
  const missing = counts.missing ?? 0;
  const parityStatus = missing === 0 && assignmentCount > 0 ? "PASS" : assignmentCount > 0 ? "FAIL" : "unavailable";
  return {
    status: parityStatus,
    capturedAt: doc.generatedAt || null,
    refreshAvailable: true,
    assignmentCount,
    uniqueApprovedAssets,
    missingAssignments: missing,
    parityStatus,
  };
}

function readQualityReviewSummary(slug: string): PersistedPanelSummary {
  const approvalFile = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/commercial-quality-review",
    slug,
    "latest.json",
  );
  const approval = readJsonFile<{ approvedAt?: string; status?: string; overallStatus?: string }>(approvalFile);
  if (approval) {
    return {
      status: approval.overallStatus || approval.status || "available",
      capturedAt: approval.approvedAt || null,
      refreshAvailable: true,
    };
  }
  const auditFile = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/product-owner-quality-audit",
    slug,
    "latest.json",
  );
  const audit = readJsonFile<{
    auditedAt?: string;
    pagesAudited?: number;
    overallQualityScore?: number;
    criticalIssueCount?: number;
  }>(auditFile);
  if (!audit) return unavailableSummary();
  return {
    status: "available",
    capturedAt: audit.auditedAt || null,
    refreshAvailable: true,
    pagesAudited: audit.pagesAudited ?? null,
    overallQualityScore: audit.overallQualityScore ?? null,
    criticalIssueCount: audit.criticalIssueCount ?? null,
  };
}

function readPublishSummary(slug: string): PersistedPanelSummary {
  const file = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/commercial-publish-review",
    slug,
    "latest.json",
  );
  const doc = readJsonFile<{ capturedAt?: string; publishedAt?: string; status?: string; overallStatus?: string }>(file);
  if (!doc) return unavailableSummary();
  return {
    status: doc.overallStatus || doc.status || "available",
    capturedAt: doc.publishedAt || doc.capturedAt || null,
    refreshAvailable: true,
  };
}

function readIndexingSummary(slug: string): PersistedPanelSummary {
  const file = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/commercial-indexing-review",
    slug,
    "latest.json",
  );
  const doc = readJsonFile<{ requestedAt?: string; status?: string; overallStatus?: string }>(file);
  if (!doc) return unavailableSummary();
  return {
    status: doc.overallStatus || doc.status || "available",
    capturedAt: doc.requestedAt || null,
    refreshAvailable: true,
  };
}

function readCommercialIntelligenceSummary(slug: string): PersistedPanelSummary {
  const approval = readCommercialIntelligenceApproval(slug);
  const generated = isCompetitorAnalysisGenerated(slug);
  const historySaysComplete = getWorkflowHistory(slug).some(
    (h) => h.fromStage === "commercial_intelligence" || h.fromStage === "competitor_analysis",
  );
  const stageMarkedComplete =
    Boolean(approval) ||
    historySaysComplete ||
    (isCoreProductRecoveryMode(slug) && isBusinessProfileReviewApproved(slug));

  if (generated && approval) {
    return {
      status: "approved",
      capturedAt: approval.approvedAt,
      refreshAvailable: true,
      approvalStatus: "approved",
      approvedBy: approval.approvedBy,
      approvedVersion: approval.approvedVersion,
    };
  }
  if (stageMarkedComplete && !generated) {
    return {
      status: "stale",
      capturedAt: approval?.approvedAt || null,
      refreshAvailable: true,
      approvalStatus: "stale",
      detail:
        "Workflow marked Commercial Intelligence complete, but Competitor Analysis artifact is missing.",
    };
  }
  if (generated) {
    return {
      status: "generated",
      capturedAt: null,
      refreshAvailable: true,
      approvalStatus: "generated",
    };
  }
  return {
    status: "not_generated",
    capturedAt: null,
    refreshAvailable: true,
    approvalStatus: "not generated",
  };
}

function resolveLatestPackageSummary(slug: string, authorised: PersistedPanelSummary): PersistedPanelSummary {
  if (authorised.status !== "unavailable" && authorised.capturedAt) {
    return {
      status: String(authorised.status),
      capturedAt: authorised.capturedAt,
      refreshAvailable: true,
      jobId: authorised.jobId ?? null,
      packageRevision: authorised.packageRevision ?? null,
      pageCount: authorised.pageCount ?? null,
    };
  }
  return unavailableSummary();
}

function resolveActiveGenerationJob(slug: string): MasterAdminCustomerWorkflowSummary["activeGenerationJob"] {
  const active =
    listMasterAdminJobs({ slug, limit: 10 }).find(
      (job) => job.action === "generate_ecosystem" && (job.status === "queued" || job.status === "running"),
    ) || null;
  if (!active) return null;
  return {
    jobId: active.id,
    status: active.status,
    action: active.action,
    progress: active.progress,
    progressLabel: active.progressLabel,
    updatedAt: active.updatedAt,
  };
}

export function buildMasterAdminCustomerWorkflowSummary(
  slug: string,
  workflowOverride?: CustomerWorkflowState | null,
): MasterAdminCustomerWorkflowSummary | null {
  const safe = safeAdminSlug(slug);
  const registry = readMasterAdminRegistry();
  const entry = registry.clients.find((c) => c.slug === safe);
  if (!entry) return null;

  const profile = readSetupProfile(safe);
  const workflow = workflowOverride === undefined ? buildCustomerWorkflowState(safe) : workflowOverride;
  if (!workflow) return null;

  const commercialIntelligence = readCommercialIntelligenceSummary(safe);
  const canonicalPlan = readCanonicalPlanSummary(safe);
  const authorisedGeneration = readAuthorisedGenerationSummary(safe);
  const productOwnerAcceptance = readProductOwnerAcceptanceSummary(safe);
  const imagePlatform = readImagePlatformSummary(safe);
  const qualityReview = readQualityReviewSummary(safe);
  const latestPackage = resolveLatestPackageSummary(safe, authorisedGeneration);
  const publish = readPublishSummary(safe);
  const indexing = readIndexingSummary(safe);

  const orchestration = workflow.orchestration;
  const workflowReadinessStatus = orchestration?.canContinue
    ? "ready"
    : orchestration?.blockingReason
      ? "blocked"
      : "pending";

  return {
    slug: safe,
    customerName: profile.pharmacyName || entry.pharmacyName || safe,
    currentStage: workflow.currentStage,
    currentStageLabel: workflow.currentStageLabel,
    nextAction: workflow.nextAction?.label || "—",
    workflowReadinessStatus,
    capturedAt: new Date().toISOString(),
    commercialIntelligence,
    canonicalPlan,
    authorisedGeneration,
    productOwnerAcceptance,
    imagePlatform,
    qualityReview,
    latestPackage,
    publish,
    indexing,
    activeGenerationJob: resolveActiveGenerationJob(safe),
    panels: {
      generateEcosystem: apiPanelPath(safe, "commercial-ecosystem-generation"),
      qualityReview: apiPanelPath(safe, "commercial-quality-review"),
      commercialIntelligence: apiPanelPath(safe, "commercial-intelligence-dashboard"),
      technicalLog: apiPanelPath(safe, "technical-log"),
      publishing: apiPanelPath(safe, "commercial-publish-review"),
      indexing: apiPanelPath(safe, "commercial-indexing-review"),
    },
  };
}

export function buildMasterAdminTechnicalLogLite(slug: string): MasterAdminTechnicalLogPayload | null {
  const safe = safeAdminSlug(slug);
  const registry = readMasterAdminRegistry();
  if (!registry.clients.some((c) => c.slug === safe)) return null;
  return {
    slug: safe,
    capturedAt: new Date().toISOString(),
    transitions: getWorkflowHistory(safe),
    executions: getWorkflowExecutions(safe),
    jobs: listMasterAdminJobs({ slug: safe, limit: 50 }),
    auditEntries: listMasterAdminAudit({ slug: safe, limit: 50 }),
  };
}

export function profileMasterAdminCustomerWorkflowSummaryLoad(slug: string): { totalMs: number } {
  const start = performance.now();
  buildMasterAdminCustomerWorkflowSummary(slug);
  return { totalMs: performance.now() - start };
}
