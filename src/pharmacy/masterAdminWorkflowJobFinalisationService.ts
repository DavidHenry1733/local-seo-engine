/**
 * Master Admin Workflow Job Finalisation — sync completion signals and advance workflow
 * after background jobs complete successfully.
 */
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import {
  loadCampaignBuilderSession,
  saveCampaignBuilderSession,
} from "./growthEngineCampaignBuilderService.ts";
import { getMasterAdminJob, type MasterAdminJob } from "./masterAdminJobService.ts";
import { contentPackageGenerated, loadContentPackage } from "./pharmacyContentPackageService.ts";
import { readLatestCommercialPublishSnapshot } from "./masterAdminCommercialPublishReviewService.ts";
import { handleWorkflowStageFailure } from "./masterAdminWorkflowFailureService.ts";
import {
  finishWorkflowExecution,
  getLastRecordedWorkflowStage,
  recordWorkflowTransition,
} from "./masterAdminWorkflowHistoryService.ts";
import { finalizeCommercialOnboardingCompletion } from "./masterAdminCommercialOnboardingService.ts";
import { WORKFLOW_STAGE_ORDER, type WorkflowStageId } from "./masterAdminWorkflowModel.ts";
import { resolveWorkflowStage, verifyStageCompletion } from "./masterAdminWorkflowStageExecutor.ts";
import {
  completeAuthorisedEcosystemGeneration,
  isAuthorisedEcosystemGenerated,
} from "./masterAdminAuthorisedEcosystemGenerationService.ts";
import {
  isCprLocalClusterGenerationComplete,
  readServicePageGenerationRecord,
} from "./masterAdminCoreProductRecoveryService.ts";
import {
  isCompetitorAnalysisGenerated,
  isGrowthIntelligenceJobOutputComplete,
  isLocalMarketIntelligenceGenerated,
} from "./masterAdminCommercialIntelligenceWorkflowService.ts";

export interface WorkflowJobFinalisationResult {
  ok: boolean;
  jobId: string;
  slug: string;
  actionId: string;
  workflowStage: WorkflowStageId;
  jobStatus: MasterAdminJob["status"] | null;
  syncApplied: boolean;
  executionFinalised: boolean;
  workflowAdvanced: boolean;
  alreadyFinalised: boolean;
  recordedStageBefore: WorkflowStageId;
  recordedStageAfter: WorkflowStageId;
  resolvedStageAfter: WorkflowStageId;
  reason?: string;
  error?: string;
}

function stageIndex(stageId: WorkflowStageId): number {
  return WORKFLOW_STAGE_ORDER.indexOf(stageId as (typeof WORKFLOW_STAGE_ORDER)[number]);
}

function syncGenerateEcosystemCompletionSignals(job: MasterAdminJob): boolean {
  const ctx = loadMasterAdminCustomerContext(job.slug);
  if (!ctx?.contentGenerated) return false;

  const session = loadCampaignBuilderSession(job.slug);
  if (session.generationCompletedAt) return false;

  const pkg = loadContentPackage(job.slug, ctx.serviceId);
  const completedAt = job.completedAt || pkg?.generatedAt || new Date().toISOString();
  const startedAt = job.startedAt || session.generationStartedAt || completedAt;

  saveCampaignBuilderSession({
    ...session,
    generationStartedAt: session.generationStartedAt || startedAt,
    generationCompletedAt: completedAt,
    step: session.step || "review",
  });
  return true;
}

/** Sync workflow completion signals from persisted job output (no regeneration). */
export function syncWorkflowCompletionSignalsFromJob(job: MasterAdminJob): boolean {
  switch (job.action) {
    case "generate_ecosystem":
      return syncGenerateEcosystemCompletionSignals(job);
    case "generate_service_page":
      return false;
    case "generate_local_cluster_pages":
      return false;
    case "orchestrate_growth_intelligence":
    case "generate_growth_intelligence":
      return false;
    default:
      return false;
  }
}

function verifyJobOutputEvidence(job: MasterAdminJob): { ok: boolean; reason?: string } {
  if (job.status !== "completed") return { ok: false, reason: "Job not completed" };
  if (!job.completedAt) return { ok: false, reason: "Job missing completedAt" };

  switch (job.action) {
    case "generate_ecosystem": {
      const ctx = loadMasterAdminCustomerContext(job.slug);
      if (!ctx) return { ok: false, reason: "Customer context missing" };
      if (!contentPackageGenerated(job.slug, ctx.serviceId)) {
        return { ok: false, reason: "Content package output missing" };
      }
      const pkg = loadContentPackage(job.slug, ctx.serviceId);
      if (pkg?.status === "error") return { ok: false, reason: "Content package marked error" };
      if (!isAuthorisedEcosystemGenerated(job.slug)) {
        return { ok: false, reason: "Authorised ecosystem generation record missing" };
      }
      return { ok: true };
    }
    case "generate_service_page": {
      const ctx = loadMasterAdminCustomerContext(job.slug);
      if (!ctx) return { ok: false, reason: "Customer context missing" };
      const serviceId = job.serviceId || ctx.serviceId;
      if (!contentPackageGenerated(job.slug, serviceId)) {
        return { ok: false, reason: "Service page content package missing" };
      }
      const record = readServicePageGenerationRecord(job.slug, serviceId);
      if (record?.status !== "completed") {
        return { ok: false, reason: "Service page generation record incomplete" };
      }
      return { ok: true };
    }
    case "generate_local_cluster_pages": {
      if (!isCprLocalClusterGenerationComplete(job.slug)) {
        return { ok: false, reason: "Local cluster page output missing" };
      }
      return { ok: true };
    }
    case "publish": {
      const ctx = loadMasterAdminCustomerContext(job.slug);
      if (!ctx?.live.lastPublishedAt) return { ok: false, reason: "Publish completion signal missing" };
      const snapshot = readLatestCommercialPublishSnapshot(job.slug);
      if (!snapshot?.completedAt) return { ok: false, reason: "Commercial publish snapshot missing" };
      return { ok: true };
    }
    case "orchestrate_growth_intelligence":
    case "generate_growth_intelligence": {
      if (!isGrowthIntelligenceJobOutputComplete(job.slug)) {
        return { ok: false, reason: "Growth Intelligence report missing" };
      }
      return { ok: true };
    }
    case "orchestrate_competitor_analysis": {
      if (!isCompetitorAnalysisGenerated(job.slug)) {
        return { ok: false, reason: "Competitor Analysis output missing" };
      }
      return { ok: true };
    }
    case "orchestrate_local_market_intelligence": {
      if (!isLocalMarketIntelligenceGenerated(job.slug)) {
        return { ok: false, reason: "Local Market Intelligence output missing" };
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

function advanceWorkflowAfterCompletedJob(
  job: MasterAdminJob,
  operator: string,
  reconciliationReason?: string,
): { workflowAdvanced: boolean; recordedStageBefore: WorkflowStageId; recordedStageAfter: WorkflowStageId; resolvedStageAfter: WorkflowStageId } {
  const slug = job.slug;
  const stageId = job.workflowStage as WorkflowStageId;
  const actionId = job.action;
  const recordedStageBefore = getLastRecordedWorkflowStage(slug);

  finishWorkflowExecution({
    slug,
    stageId,
    actionId,
    operator,
    evidence: String((job.result as { message?: string })?.message || job.progressLabel || "Job completed"),
    warnings: [],
    errors: [],
    status: "completed",
    jobId: job.id,
  });

  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) {
    return {
      workflowAdvanced: false,
      recordedStageBefore,
      recordedStageAfter: recordedStageBefore,
      resolvedStageAfter: recordedStageBefore,
    };
  }

  const resolvedStageAfter = resolveWorkflowStage(ctx);
  let workflowAdvanced = false;
  let recordedStageAfter = recordedStageBefore;

  if (verifyStageCompletion(stageId, ctx) && recordedStageBefore !== resolvedStageAfter) {
    recordWorkflowTransition({
      slug,
      fromStage: recordedStageBefore,
      toStage: resolvedStageAfter,
      operator,
      reason:
        reconciliationReason ||
        `Background job completed: ${actionId}`,
      evidence: job.progressLabel || job.evidence || `Job ${job.id}`,
    });
    workflowAdvanced = true;
    recordedStageAfter = resolvedStageAfter;
    if (resolvedStageAfter === "live_customer") {
      void finalizeCommercialOnboardingCompletion(slug, operator);
    }
  }

  return { workflowAdvanced, recordedStageBefore, recordedStageAfter, resolvedStageAfter };
}

/**
 * Finalise a completed workflow job: sync signals, finish execution, advance workflow.
 * Idempotent — safe to retry when workflow already advanced.
 */
export function finalizeCompletedWorkflowJob(
  jobId: string,
  opts: { operator?: string; reconciliationReason?: string } = {},
): WorkflowJobFinalisationResult {
  const job = getMasterAdminJob(jobId);
  if (!job || !job.workflowStage) {
    return {
      ok: false,
      jobId,
      slug: job?.slug || "",
      actionId: job?.action || "",
      workflowStage: (job?.workflowStage as WorkflowStageId) || "create_customer",
      jobStatus: job?.status || null,
      syncApplied: false,
      executionFinalised: false,
      workflowAdvanced: false,
      alreadyFinalised: false,
      recordedStageBefore: "create_customer",
      recordedStageAfter: "create_customer",
      resolvedStageAfter: "create_customer",
      error: "Missing job or workflow stage",
    };
  }

  const slug = job.slug;
  const stageId = job.workflowStage as WorkflowStageId;
  const operator = opts.operator || job.user || "system";
  const recordedStageBefore = getLastRecordedWorkflowStage(slug);

  if (job.status === "failed") {
    finishWorkflowExecution({
      slug,
      stageId,
      actionId: job.action,
      operator,
      evidence: job.error || "Job failed",
      warnings: [],
      errors: [job.error || "Job failed"],
      status: "failed",
      jobId: job.id,
    });
    handleWorkflowStageFailure(slug, operator, stageId, job.action, job.error || "Job failed");
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "continue_workflow",
      status: "error",
      evidence: job.error || "Job failed",
      errors: [job.error || "Job failed"],
    });
    return {
      ok: false,
      jobId,
      slug,
      actionId: job.action,
      workflowStage: stageId,
      jobStatus: job.status,
      syncApplied: false,
      executionFinalised: true,
      workflowAdvanced: false,
      alreadyFinalised: false,
      recordedStageBefore,
      recordedStageAfter: getLastRecordedWorkflowStage(slug),
      resolvedStageAfter: resolveWorkflowStage(loadMasterAdminCustomerContext(slug)!),
      error: job.error || "Job failed",
    };
  }

  if (job.status !== "completed") {
    return {
      ok: false,
      jobId,
      slug,
      actionId: job.action,
      workflowStage: stageId,
      jobStatus: job.status,
      syncApplied: false,
      executionFinalised: false,
      workflowAdvanced: false,
      alreadyFinalised: false,
      recordedStageBefore,
      recordedStageAfter: recordedStageBefore,
      resolvedStageAfter: recordedStageBefore,
      error: `Job status is ${job.status}, not completed`,
    };
  }

  const ctxBefore = loadMasterAdminCustomerContext(slug);
  if (!ctxBefore) {
    return {
      ok: false,
      jobId,
      slug,
      actionId: job.action,
      workflowStage: stageId,
      jobStatus: job.status,
      syncApplied: false,
      executionFinalised: false,
      workflowAdvanced: false,
      alreadyFinalised: false,
      recordedStageBefore,
      recordedStageAfter: recordedStageBefore,
      resolvedStageAfter: recordedStageBefore,
      error: "Customer context missing",
    };
  }

  try {
    if (job.action === "generate_ecosystem" && job.status === "completed") {
      completeAuthorisedEcosystemGeneration(job.slug, job);
    }
    const evidence = verifyJobOutputEvidence(job);
    if (!evidence.ok) {
      return {
        ok: false,
        jobId,
        slug,
        actionId: job.action,
        workflowStage: stageId,
        jobStatus: job.status,
        syncApplied: false,
        executionFinalised: false,
        workflowAdvanced: false,
        alreadyFinalised: false,
        recordedStageBefore,
        recordedStageAfter: recordedStageBefore,
        resolvedStageAfter: resolveWorkflowStage(ctxBefore),
        error: evidence.reason,
      };
    }

    const syncApplied = syncWorkflowCompletionSignalsFromJob(job);
    const ctxAfterSync = loadMasterAdminCustomerContext(slug)!;
    const resolvedAfterSync = resolveWorkflowStage(ctxAfterSync);
    const recordedAfterSync = getLastRecordedWorkflowStage(slug);

    if (
      verifyStageCompletion(stageId, ctxAfterSync) &&
      recordedAfterSync === resolvedAfterSync &&
      stageIndex(resolvedAfterSync) > stageIndex(stageId)
    ) {
      return {
        ok: true,
        jobId,
        slug,
        actionId: job.action,
        workflowStage: stageId,
        jobStatus: job.status,
        syncApplied,
        executionFinalised: false,
        workflowAdvanced: false,
        alreadyFinalised: true,
        recordedStageBefore,
        recordedStageAfter: recordedAfterSync,
        resolvedStageAfter: resolvedAfterSync,
        reason: "Workflow already advanced past completed job stage",
      };
    }

    const advance = advanceWorkflowAfterCompletedJob(job, operator, opts.reconciliationReason);

    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "continue_workflow",
      status: "success",
      evidence: opts.reconciliationReason || `Job ${jobId} completed — ${job.action}`,
    });

    return {
      ok: true,
      jobId,
      slug,
      actionId: job.action,
      workflowStage: stageId,
      jobStatus: job.status,
      syncApplied,
      executionFinalised: true,
      workflowAdvanced: advance.workflowAdvanced,
      alreadyFinalised: false,
      recordedStageBefore: advance.recordedStageBefore,
      recordedStageAfter: advance.recordedStageAfter,
      resolvedStageAfter: advance.resolvedStageAfter,
      reason: opts.reconciliationReason,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("Workflow job finalisation failed", { jobId, message, stack });
    return {
      ok: false,
      jobId,
      slug,
      actionId: job.action,
      workflowStage: stageId,
      jobStatus: job.status,
      syncApplied: false,
      executionFinalised: false,
      workflowAdvanced: false,
      alreadyFinalised: false,
      recordedStageBefore,
      recordedStageAfter: getLastRecordedWorkflowStage(slug),
      resolvedStageAfter: ctxBefore ? resolveWorkflowStage(ctxBefore) : recordedStageBefore,
      error: stack ? `${message}\n${stack}` : message,
    };
  }
}

/** Idempotent recovery for a completed job whose workflow did not advance. */
export function reconcileCompletedWorkflowJob(jobId: string, operator = "system"): WorkflowJobFinalisationResult {
  return finalizeCompletedWorkflowJob(jobId, {
    operator,
    reconciliationReason: `Completed job finalisation recovery (job ${jobId})`,
  });
}
