/**
 * NT-E2E-15 — Commercial Ecosystem Generation dashboard (authorised vs historical).
 */
import fs from "node:fs";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { loadContentPackage } from "./pharmacyContentPackageService.ts";
import { getPharmacyImageAssignmentsPath } from "./pharmacyWorkspacePaths.ts";
import {
  isCommercialIntelligenceApproved,
  readCommercialIntelligenceApprovalExtended,
} from "./masterAdminCommercialIntelligenceWorkflowService.ts";
import { listMasterAdminJobs, createMasterAdminJob, runMasterAdminJobAsync } from "./masterAdminJobService.ts";
import { startWorkflowExecution } from "./masterAdminWorkflowHistoryService.ts";
import { buildGenerationSetupState } from "./masterAdminGenerationSetupService.ts";
import { runPreGenerationValidation } from "./masterAdminPreGenerationValidation.ts";
import { resolveGoogleGenerationReadiness } from "./masterAdminGoogleGenerationReadinessService.ts";
import { buildGoogleSourceSummary, readGoogleIntelligenceRecord } from "./masterAdminCanonicalGoogleService.ts";
import {
  assertAuthorisedEcosystemGenerationAllowed,
  beginAuthorisedEcosystemGeneration,
  isAuthorisedEcosystemGenerated,
  isAuthorisedEcosystemQualityReviewReady,
  readAuthorisedEcosystemGenerationRecord,
  readHistoricalEcosystemPackage,
  type HistoricalEcosystemPackageRecord,
  type AuthorisedEcosystemGenerationRecord,
} from "./masterAdminAuthorisedEcosystemGenerationService.ts";
import {
  buildCanonicalEcosystemGenerationPlan,
  freezeCanonicalEcosystemGenerationPlan,
  readCanonicalEcosystemGenerationPlan,
  getCanonicalPlanSchedulerPageCount,
  resolveConfirmedProfileAreas,
  type CanonicalEcosystemGenerationPlan,
  type CanonicalRecommendationEntry,
} from "./masterAdminCanonicalEcosystemGenerationPlanService.ts";

export interface CommercialEcosystemGoogleReadiness {
  state: string;
  statusLabel: string;
  impactLabel: string;
  generationLabel: string;
  recommendedNextStep: string | null;
  placeId: string | null;
  profileUrl: string | null;
  importStatus: string;
}

export interface CommercialEcosystemGenerationReadiness {
  pharmacyName: string;
  approvedIntelligenceRevision: string | null;
  primaryService: string;
  primaryServiceName: string;
  additionalServices: string[];
  confirmedTown: string;
  selectedLocalAreas: string[];
  designIntelligenceStatus: string;
  imagePlatformReadiness: string;
  googleBusinessProfile: CommercialEcosystemGoogleReadiness;
  expectedHomepageCount: number;
  expectedServiceHubCount: number;
  approvedAreaCount: number;
  clusterPagesToGenerate: number;
  expectedGuideCount: number;
  expectedBlogCount: number;
  expectedFaqCount: number;
  expectedTotalPageCount: number;
  requiredImageCount: number;
  warnings: string[];
  opportunities: string[];
  blockingIssues: string[];
  estimatedGenerationMinutes: number;
  canonicalPlanId: string | null;
  canonicalPlanRevision: string | null;
  canonicalPlanChecksum: string | null;
  schedulerPageCount: number;
  coreEcosystemInventory: CanonicalEcosystemGenerationPlan["coreEcosystem"] | null;
  recommendedFutureContent: CanonicalRecommendationEntry[];
  areaClassifications: Array<{
    area: string;
    classification: string;
    parentServiceHub: string | null;
    pageType: string | null;
    clusterPageUrl: string | null;
    inclusionStatus: string;
    exclusionReason: string | null;
  }>;
}

export interface CommercialEcosystemGenerationProgress {
  percent: number;
  currentStage: string;
  elapsedMs: number | null;
  warnings: string[];
}

export interface CommercialEcosystemGenerationDashboard {
  version: 2;
  slug: string;
  intelligenceApproved: boolean;
  authorisedEcosystemGenerated: boolean;
  canGenerate: boolean;
  generationInProgress: boolean;
  activeAction: "approve_intelligence" | "generate_approved_ecosystem" | "generating_approved_ecosystem" | "review_generated_ecosystem";
  readiness: CommercialEcosystemGenerationReadiness;
  historicalPackage: HistoricalEcosystemPackageRecord | null;
  authorisedGeneration: AuthorisedEcosystemGenerationRecord | null;
  generationProgress: CommercialEcosystemGenerationProgress | null;
  summary: string;
  nextStep: string;
  activeJobId: string | null;
}

const ESTIMATED_MINUTES = 30;

export function buildCommercialEcosystemGenerationDashboard(slug: string): CommercialEcosystemGenerationDashboard {
  const ctx = loadMasterAdminCustomerContext(slug);
  const profile = readSetupProfile(slug);
  const setup = buildGenerationSetupState(slug);
  const serviceId = ctx?.serviceId || "pharmacy-first";
  const pkg = ctx ? loadContentPackage(slug, serviceId) : null;
  const intelligenceApproved = isCommercialIntelligenceApproved(slug);
  const ciApproval = readCommercialIntelligenceApprovalExtended(slug);
  const authorisedGenerated = isAuthorisedEcosystemQualityReviewReady(slug);
  const hasCompletedGeneration = isAuthorisedEcosystemGenerated(slug);
  const canonicalPlan = readCanonicalEcosystemGenerationPlan(slug) || buildCanonicalEcosystemGenerationPlan(slug);
  const confirmedAreas = resolveConfirmedProfileAreas(profile).map((a) => a.areaName);
  const historicalPackage = readHistoricalEcosystemPackage(slug);
  const authorisedGeneration = readAuthorisedEcosystemGenerationRecord(slug);
  const pre = runPreGenerationValidation(slug);
  const googleIntel = readGoogleIntelligenceRecord(slug);
  const googleSummary = buildGoogleSourceSummary(slug);
  const googleReadiness = resolveGoogleGenerationReadiness({
    profile,
    hasGoogleImport: Boolean(googleIntel?.importedAt || googleSummary.googleImported),
    googleImportStatus: googleIntel?.importedAt ? "Imported" : googleSummary.importState || "Not connected",
  });

  const activeJob =
    listMasterAdminJobs({ slug, limit: 5 }).find(
      (j) => j.action === "generate_ecosystem" && (j.status === "queued" || j.status === "running"),
    ) || null;

  const selectedAreas = (profile.selectedLocalAreas || profile.localAreas || profile.nearbyAreas || []) as Array<
    string | { areaName?: string }
  >;
  const areaNames = selectedAreas
    .map((a) => (typeof a === "object" && a && "areaName" in a ? a.areaName : String(a)))
    .filter(Boolean);

  const readiness: CommercialEcosystemGenerationReadiness = {
    pharmacyName: profile.pharmacyName || profile.businessName || ctx?.displayName || slug,
    approvedIntelligenceRevision: ciApproval?.approvedVersion || null,
    primaryService: serviceId,
    primaryServiceName: pkg?.serviceName || serviceId,
    additionalServices: (profile.selectedServices || []).slice(1).map(String),
    confirmedTown: setup.primaryTown || profile.primaryTown || profile.townCity || "Not confirmed",
    selectedLocalAreas: confirmedAreas.length ? confirmedAreas : areaNames,
    designIntelligenceStatus: setup.componentDnaReady ? "Ready" : "Not ready",
    imagePlatformReadiness: fs.existsSync(getPharmacyImageAssignmentsPath(slug)) ? "Ready" : "Not ready",
    googleBusinessProfile: {
      state: googleReadiness.state,
      statusLabel: googleReadiness.statusLabel,
      impactLabel: googleReadiness.impactLabel,
      generationLabel: googleReadiness.generationLabel,
      recommendedNextStep: googleReadiness.recommendedNextStep,
      placeId: googleReadiness.placeId,
      profileUrl: googleReadiness.profileUrl,
      importStatus: googleReadiness.importStatus,
    },
    expectedHomepageCount: canonicalPlan.coreEcosystem.homepage,
    expectedServiceHubCount: canonicalPlan.coreEcosystem.serviceHubs,
    approvedAreaCount: canonicalPlan.coreEcosystem.approvedAreas,
    clusterPagesToGenerate: canonicalPlan.coreEcosystem.clusterPages,
    expectedGuideCount: canonicalPlan.coreEcosystem.guides,
    expectedBlogCount: canonicalPlan.coreEcosystem.blogs,
    expectedFaqCount: canonicalPlan.coreEcosystem.faqs,
    expectedTotalPageCount: canonicalPlan.coreEcosystem.totalPages,
    requiredImageCount: canonicalPlan.coreEcosystem.requiredImageRoles,
    warnings: [...pre.warnings, ...canonicalPlan.warnings],
    opportunities: pre.opportunities,
    blockingIssues: [...pre.blockers, ...canonicalPlan.blockers],
    estimatedGenerationMinutes: canonicalPlan.expectedDurationMinutes || ESTIMATED_MINUTES,
    canonicalPlanId: canonicalPlan.planId,
    canonicalPlanRevision: canonicalPlan.planRevision,
    canonicalPlanChecksum: canonicalPlan.checksum,
    schedulerPageCount: getCanonicalPlanSchedulerPageCount(canonicalPlan),
    coreEcosystemInventory: canonicalPlan.coreEcosystem,
    recommendedFutureContent: canonicalPlan.recommendedFutureContent,
    areaClassifications: canonicalPlan.areaEntries.map((a) => ({
      area: a.areaName,
      classification: a.classification,
      parentServiceHub: a.parentServiceHub,
      pageType: a.pageType,
      clusterPageUrl: a.expectedUrlPath,
      inclusionStatus: a.inclusionStatus,
      exclusionReason: a.exclusionReason,
    })),
  };

  const gate = assertAuthorisedEcosystemGenerationAllowed(slug);
  const canGenerate = intelligenceApproved && gate.ok;
  const generationInProgress = Boolean(activeJob) || authorisedGeneration?.status === "running";

  let activeAction: CommercialEcosystemGenerationDashboard["activeAction"] = "approve_intelligence";
  if (!intelligenceApproved) activeAction = "approve_intelligence";
  else if (generationInProgress) activeAction = "generating_approved_ecosystem";
  else if (authorisedGenerated) activeAction = "review_generated_ecosystem";
  else if (hasCompletedGeneration) activeAction = "generate_approved_ecosystem";
  else activeAction = "generate_approved_ecosystem";

  let summary = "Approve Commercial Intelligence to begin the authorised commercial workflow.";
  if (intelligenceApproved && historicalPackage && !hasCompletedGeneration) {
    summary =
      "A historical ecosystem package exists from an accidental pre-approval generation. It is preserved for audit and is not the approved release candidate. Generate the first Product Owner-authorised ecosystem when ready.";
  } else if (intelligenceApproved && canGenerate) {
    summary = "Commercial Intelligence is approved. Review readiness, then confirm to generate the first Product Owner-authorised ecosystem.";
  } else if (authorisedGenerated) {
    summary = "Product Owner-authorised ecosystem generated. Open Quality Review to inspect the new release candidate.";
  } else if (hasCompletedGeneration && authorisedGeneration?.completenessStatus === "INCOMPLETE_AGAINST_CANONICAL_PLAN") {
    summary =
      "The authorised ecosystem package is preserved but incomplete against the canonical generation plan. Review the corrected plan, then confirm a new Product Owner-authorised generation.";
  } else if (generationInProgress) {
    summary = "Generating approved ecosystem…";
  }

  let nextStep = "Approve Intelligence";
  if (intelligenceApproved && canGenerate) nextStep = "Generate Approved Ecosystem";
  else if (generationInProgress) nextStep = "Generating Approved Ecosystem…";
  else if (authorisedGenerated) nextStep = "Review Generated Ecosystem";

  let generationProgress: CommercialEcosystemGenerationProgress | null = null;
  if (generationInProgress && activeJob) {
    const initiatedAt = authorisedGeneration?.initiatedAt || activeJob.startedAt || activeJob.createdAt;
    generationProgress = {
      percent: activeJob.progress ?? 0,
      currentStage: activeJob.progressLabel || authorisedGeneration?.currentStep || "Running",
      elapsedMs: initiatedAt ? Date.now() - new Date(initiatedAt).getTime() : null,
      warnings: authorisedGeneration?.warnings || [],
    };
  }

  return {
    version: 2,
    slug,
    intelligenceApproved,
    authorisedEcosystemGenerated: authorisedGenerated,
    canGenerate,
    generationInProgress,
    activeAction,
    readiness,
    historicalPackage,
    authorisedGeneration,
    generationProgress,
    summary,
    nextStep,
    activeJobId: activeJob?.id || authorisedGeneration?.jobId || null,
  };
}

export function assertEcosystemGenerationAllowed(slug: string): { ok: boolean; error?: string; blockers?: string[] } {
  return assertAuthorisedEcosystemGenerationAllowed(slug);
}

export function resolveCommercialWorkflowNextAction(
  slug: string,
  currentStage: string,
): string | null {
  if (currentStage === "commercial_intelligence") {
    return isCommercialIntelligenceApproved(slug) ? "Generate Approved Ecosystem" : "Approve Intelligence";
  }
  if (currentStage === "generate_ecosystem") {
    const activeJob =
      listMasterAdminJobs({ slug, limit: 3 }).find(
        (j) => j.action === "generate_ecosystem" && (j.status === "queued" || j.status === "running"),
      ) || null;
    const authorisedRecord = readAuthorisedEcosystemGenerationRecord(slug);
    if (activeJob || authorisedRecord?.status === "running") return "Generating Approved Ecosystem…";
    if (isAuthorisedEcosystemQualityReviewReady(slug)) return "Review Generated Ecosystem";
    return "Generate Approved Ecosystem";
  }
  if (currentStage === "quality_review" && isAuthorisedEcosystemQualityReviewReady(slug)) {
    return "Review Generated Ecosystem";
  }
  return null;
}

export function confirmAuthorisedEcosystemGeneration(
  slug: string,
  operator: string,
): { ok: boolean; error?: string; jobId?: string; blockers?: string[] } {
  const gate = assertAuthorisedEcosystemGenerationAllowed(slug);
  if (!gate.ok) {
    return { ok: false, error: gate.error, blockers: gate.blockers };
  }

  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return { ok: false, error: "Customer not found" };

  const activeJob =
    listMasterAdminJobs({ slug, limit: 5 }).find(
      (j) => j.action === "generate_ecosystem" && (j.status === "queued" || j.status === "running"),
    ) || null;
  if (activeJob) {
    return { ok: true, jobId: activeJob.id };
  }

  const plan = readCanonicalEcosystemGenerationPlan(slug) || buildCanonicalEcosystemGenerationPlan(slug);
  freezeCanonicalEcosystemGenerationPlan(slug, plan.planId);

  const job = createMasterAdminJob({
    slug,
    action: "generate_ecosystem",
    user: operator,
    workflowStage: "generate_ecosystem",
  });
  beginAuthorisedEcosystemGeneration(slug, operator, job.id);
  startWorkflowExecution({
    slug,
    stageId: "generate_ecosystem",
    actionId: "generate_ecosystem",
    operator,
    jobId: job.id,
  });
  runMasterAdminJobAsync(job.id, { operatorConfirmed: true }, { workflowStage: "generate_ecosystem" });

  return { ok: true, jobId: job.id };
}
