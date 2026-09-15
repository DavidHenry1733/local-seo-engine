/**
 * Master Admin Workflow Orchestrator V1 — Continue Workflow engine.
 */
import { buildMasterAdminCustomerIssueSummary } from "./masterAdminIssueService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { executeMasterAdminAction } from "./masterAdminPlatformService.ts";
import {
  createMasterAdminJob,
  listMasterAdminJobs,
  runMasterAdminJobAsync,
} from "./masterAdminJobService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { buildCustomerWorkflowState } from "./masterAdminWorkflowEngine.ts";
import {
  finishWorkflowExecution,
  getActiveWorkflowExecution,
  getLastWorkflowExecution,
  recordWorkflowTransition,
  startWorkflowExecution,
} from "./masterAdminWorkflowHistoryService.ts";
import {
  LONG_RUNNING_STAGE_ACTIONS,
  STAGE_EXECUTION_ACTION,
  WORKFLOW_ACTION_LABELS,
  WORKFLOW_STAGE_DEFINITIONS,
  WORKFLOW_STAGE_ORDER,
  type WorkflowStageId,
} from "./masterAdminWorkflowModel.ts";
import {
  executeWorkflowStageAction,
  resolveWorkflowStage,
  verifyStageCompletion,
} from "./masterAdminWorkflowStageExecutor.ts";
import { handleWorkflowStageFailure } from "./masterAdminWorkflowFailureService.ts";
import { finalizeCompletedWorkflowJob } from "./masterAdminWorkflowJobFinalisationService.ts";
import {
  isCoreProductRecoveryMode,
  isCprClusterGenerationEligible,
  isServicePageEvidenceReviewApproved,
  isServicePageReviewApproved,
  isCprLocalClusterGenerationComplete,
  readCoreProductRecoveryContract,
} from "./masterAdminCoreProductRecoveryService.ts";
import {
  findActiveLocalClusterJob,
  LOCAL_CLUSTER_JOB_ACTION,
  queueLocalClusterPagesJob,
} from "./masterAdminLocalClusterJobService.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { finalizeCommercialOnboardingCompletion } from "./masterAdminCommercialOnboardingService.ts";
import { isBusinessProfileReviewApproved } from "./masterAdminBusinessProfileReviewService.ts";
import { ensureComponentDnaPersisted } from "./masterAdminComponentDnaPersistenceService.ts";
import { buildGenerationSetupState } from "./masterAdminGenerationSetupService.ts";
import { validateStoredOnboardingIntake } from "./masterAdminOnboardingIntakeService.ts";
import {
  googleProfileStateRequiresOperatorChoice,
  resolveGoogleProfileOnboardingState,
  shouldRunGoogleImport,
} from "./masterAdminGoogleProfileOnboardingService.ts";
import { resolveWorkflowIssueBlockers } from "./masterAdminWorkflowIssueBlockerService.ts";
import { findActiveGrowthIntelligenceJob } from "./masterAdminGrowthIntelligenceWorkflowService.ts";
import {
  findActiveCommercialIntelligenceJob,
  isCommercialIntelligenceApproved,
} from "./masterAdminCommercialIntelligenceWorkflowService.ts";
import { readLatestCommercialQualityApproval } from "./masterAdminCommercialQualityReviewService.ts";
import { readLatestCommercialIndexingApproval } from "./masterAdminCommercialIndexingReviewService.ts";
import { readLatestCommercialPerformanceAcknowledgement } from "./masterAdminCommercialPerformanceDashboardService.ts";
import { assertEcosystemGenerationAllowed } from "./masterAdminCommercialEcosystemGenerationService.ts";
import {
  beginAuthorisedEcosystemGeneration,
  isAuthorisedEcosystemQualityReviewReady,
} from "./masterAdminAuthorisedEcosystemGenerationService.ts";
import { loadContentPackage } from "./pharmacyContentPackageService.ts";

const MANUAL_REVIEW_STAGE_MESSAGES: Partial<Record<WorkflowStageId, string>> = {
  commercial_intelligence: "Open the Commercial Intelligence Dashboard and click Approve Intelligence before continuing",
  generate_ecosystem: "Open Generation Readiness and click Generate Approved Ecosystem before continuing",
  quality_review: "Open Quality Review and click Approve Quality before continuing",
  publish: "Open Publish Review and confirm publishing before continuing",
  request_indexing: "Open Indexing Dashboard and confirm Request Indexing before continuing",
  initialise_rank_tracking: "Open Performance Dashboard to review results and complete the commercial workflow",
};

export interface PreflightResult {
  ok: boolean;
  reason?: string;
  stageId: WorkflowStageId;
  actionId: string | null;
}

export interface ContinueWorkflowResult {
  ok: boolean;
  blocked?: boolean;
  async?: boolean;
  jobId?: string;
  error?: string;
  preflight?: PreflightResult;
  stageBefore: WorkflowStageId;
  stageAfter: WorkflowStageId;
  actionId: string | null;
  evidence: string;
  warnings: string[];
  errors: string[];
  workflow: ReturnType<typeof buildCustomerWorkflowState>;
}

function previousStageIndex(stageId: WorkflowStageId): WorkflowStageId | null {
  const idx = WORKFLOW_STAGE_ORDER.indexOf(stageId as (typeof WORKFLOW_STAGE_ORDER)[number]);
  if (idx <= 0) return null;
  return WORKFLOW_STAGE_ORDER[idx - 1]!;
}

/** CPR cluster phase uses service-page review (quality_review), not legacy commercial_intelligence ordering. */
function resolvePreflightPreviousStage(ctx: MasterAdminCustomerContext, stageId: WorkflowStageId): WorkflowStageId | null {
  if (isCoreProductRecoveryMode(ctx.slug) && stageId === "generate_ecosystem") {
    const contract = readCoreProductRecoveryContract(ctx.slug);
    if (contract?.servicePageGenerated) {
      return "quality_review";
    }
    return "commercial_intelligence";
  }
  return previousStageIndex(stageId);
}

export function runWorkflowPreflight(slug: string): PreflightResult {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return { ok: false, reason: "Customer not found", stageId: "create_customer", actionId: null };
  if (ctx.archived) return { ok: false, reason: "Customer is archived", stageId: "archived", actionId: null };
  if (ctx.suspended) return { ok: false, reason: "Customer is suspended", stageId: "suspended", actionId: null };

  const activeExecution = getActiveWorkflowExecution(slug);
  if (activeExecution) {
    return {
      ok: false,
      reason: `Workflow job in progress: ${activeExecution.actionId} (${activeExecution.status})`,
      stageId: activeExecution.stageId,
      actionId: activeExecution.actionId,
    };
  }

  const activeJob = listMasterAdminJobs({ slug, limit: 5 }).find((j) => j.status === "queued" || j.status === "running");
  if (activeJob) {
    return {
      ok: false,
      reason: `Background job running: ${activeJob.action} (${activeJob.status})`,
      stageId: resolveWorkflowStage(ctx),
      actionId: activeJob.action,
    };
  }

  const stageId = resolveWorkflowStage(ctx);
  const intakeValidation = validateStoredOnboardingIntake(ctx.data, slug);
  if (!intakeValidation.ok) {
    return {
      ok: false,
      reason: intakeValidation.errors[0] || "Complete onboarding setup on the first screen",
      stageId,
      actionId: null,
    };
  }

  const googleState = resolveGoogleProfileOnboardingState(ctx.data);
  if (googleProfileStateRequiresOperatorChoice(googleState) && verifyStageCompletion("website_import", ctx)) {
    return {
      ok: false,
      reason: "Complete onboarding setup: choose a Google Business Profile option",
      stageId: resolveWorkflowStage(ctx),
      actionId: null,
    };
  }

  if (stageId === "live_customer") {
    return { ok: false, reason: "Customer is already Live", stageId, actionId: null };
  }

  const prev = resolvePreflightPreviousStage(ctx, stageId);
  if (prev && !verifyStageCompletion(prev, ctx)) {
    return { ok: false, reason: `Previous stage incomplete: ${WORKFLOW_STAGE_DEFINITIONS[prev].label}`, stageId, actionId: null };
  }

  const issueBlockers = resolveWorkflowIssueBlockers(slug, stageId);
  if (issueBlockers.blocked) {
    return {
      ok: false,
      reason: issueBlockers.reason || "Outstanding critical/high support issues block workflow progression",
      stageId,
      actionId: null,
    };
  }

  const actionId = STAGE_EXECUTION_ACTION[stageId] || null;
  if (stageId === "create_customer") {
    return { ok: true, stageId, actionId: null };
  }
  if (stageId === "monitoring") {
    return { ok: true, stageId, actionId: null };
  }
  if (stageId === "generate_ecosystem" && isCoreProductRecoveryMode(slug)) {
    const contract = readCoreProductRecoveryContract(slug);
    if (!contract?.servicePageGenerated) {
      return {
        ok: false,
        reason: !isServicePageEvidenceReviewApproved(slug)
          ? "Open Evidence Review and approve evidence before generating the service page"
          : "Open Service Page Generation and confirm generation",
        stageId,
        actionId: null,
      };
    }
    if (!isServicePageReviewApproved(slug)) {
      return {
        ok: false,
        reason: "Open Service Page Review and approve the service page before cluster generation",
        stageId: "quality_review",
        actionId: null,
      };
    }
    if (!isCprLocalClusterGenerationComplete(slug)) {
      return { ok: true, stageId, actionId: LOCAL_CLUSTER_JOB_ACTION };
    }
    return { ok: true, stageId, actionId: null };
  }
  if (stageId === "quality_review" && isCoreProductRecoveryMode(slug)) {
    if (!isServicePageReviewApproved(slug)) {
      return {
        ok: false,
        reason: "Open Service Page Review and approve the service page before continuing",
        stageId,
        actionId: null,
      };
    }
    return { ok: true, stageId, actionId: null };
  }
  if (MANUAL_REVIEW_STAGE_MESSAGES[stageId]) {
    return {
      ok: false,
      reason: MANUAL_REVIEW_STAGE_MESSAGES[stageId]!,
      stageId,
      actionId: null,
    };
  }
  if (!actionId) {
    return { ok: false, reason: `No orchestration action for stage: ${WORKFLOW_STAGE_DEFINITIONS[stageId].label}`, stageId, actionId: null };
  }

  if (stageId === "website_import" && !ctx.website) {
    return { ok: false, reason: "Website URL required before import", stageId, actionId };
  }

  if (stageId === "google_import" && !shouldRunGoogleImport(googleState)) {
    return {
      ok: false,
      reason: "Google Import is not required for this customer — continue to Business Profile Review",
      stageId,
      actionId: null,
    };
  }

  if (
    (stageId === "business_profile_intelligence" ||
      stageId === "resolve_import_conflicts" ||
      stageId === "approve_business_profile") &&
    !isBusinessProfileReviewApproved(slug)
  ) {
    return {
      ok: false,
      reason: "Complete Business Profile Review and approve the canonical profile before continuing",
      stageId,
      actionId: null,
    };
  }

  if (stageId === "generate_ecosystem") {
    ensureComponentDnaPersisted(slug);
    const setup = buildGenerationSetupState(slug);
    if (!setup.componentDnaReady) {
      return {
        ok: false,
        reason: "Unable to continue — please contact support if this persists",
        stageId,
        actionId,
      };
    }
  }

  if (stageId === "quality_review") {
    if (isCoreProductRecoveryMode(slug)) {
      if (!isServicePageReviewApproved(slug)) {
        return {
          ok: false,
          reason: "Open Service Page Review and approve the service page before continuing",
          stageId,
          actionId: null,
        };
      }
    } else if (!isAuthorisedEcosystemQualityReviewReady(slug)) {
      return {
        ok: false,
        reason: "Generate Approved Ecosystem must complete against the canonical plan before Quality Review",
        stageId,
        actionId: null,
      };
    }
  }

  if (stageId === "generate_ecosystem") {
    if (!isCommercialIntelligenceApproved(slug)) {
      return {
        ok: false,
        reason: "Approve Intelligence on the Commercial Intelligence Dashboard before generating the ecosystem",
        stageId,
        actionId: null,
      };
    }
    const setup = buildGenerationSetupState(slug);
    if (!isCoreProductRecoveryMode(slug) && !setup.areasConfirmed) {
      return {
        ok: false,
        reason: "Confirm local coverage — choose and save at least 3 local areas before continuing",
        stageId,
        actionId,
      };
    }
  }

  return { ok: true, stageId, actionId };
}

async function advanceAfterExecution(
  slug: string,
  operator: string,
  stageId: WorkflowStageId,
  actionId: string,
  exec: { ok: boolean; evidence: string; warnings: string[]; errors: string[]; jobId?: string },
): Promise<ContinueWorkflowResult> {
  const ctxBefore = loadMasterAdminCustomerContext(slug)!;
  const stageBefore = resolveWorkflowStage(ctxBefore);

  if (exec.jobId) {
    startWorkflowExecution({ slug, stageId, actionId, operator, jobId: exec.jobId });
    return {
      ok: true,
      async: true,
      jobId: exec.jobId,
      stageBefore,
      stageAfter: stageBefore,
      actionId,
      evidence: exec.evidence,
      warnings: exec.warnings,
      errors: exec.errors,
      workflow: buildCustomerWorkflowState(slug, operator),
    };
  }

  if (!exec.ok) {
    finishWorkflowExecution({
      slug,
      stageId,
      actionId,
      operator,
      evidence: exec.evidence,
      warnings: exec.warnings,
      errors: exec.errors,
      status: "failed",
    });
    const failureError = exec.errors[0] || exec.evidence || "Stage execution failed";
    handleWorkflowStageFailure(slug, operator, stageId, actionId, failureError);
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "continue_workflow",
      status: "error",
      evidence: exec.evidence,
      errors: exec.errors,
    });
    return {
      ok: false,
      blocked: true,
      stageBefore,
      stageAfter: stageBefore,
      actionId,
      error: exec.errors[0] || exec.evidence,
      evidence: exec.evidence,
      warnings: exec.warnings,
      errors: exec.errors,
      workflow: buildCustomerWorkflowState(slug, operator),
    };
  }

  startWorkflowExecution({ slug, stageId, actionId, operator });
  finishWorkflowExecution({
    slug,
    stageId,
    actionId,
    operator,
    evidence: exec.evidence,
    warnings: exec.warnings,
    errors: exec.errors,
    status: "completed",
  });

  const ctxAfter = loadMasterAdminCustomerContext(slug)!;
  const stageAfter = resolveWorkflowStage(ctxAfter);
  if (stageAfter !== stageBefore) {
    recordWorkflowTransition({
      slug,
      fromStage: stageBefore,
      toStage: stageAfter,
      operator,
      reason: `Orchestrated ${WORKFLOW_ACTION_LABELS[actionId] || actionId}`,
      evidence: exec.evidence,
    });
    if (stageAfter === "live_customer") {
      await finalizeCommercialOnboardingCompletion(slug, operator);
    }
  }

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "continue_workflow",
    status: exec.warnings.length ? "warning" : "success",
    evidence: `${WORKFLOW_ACTION_LABELS[actionId] || actionId}: ${exec.evidence}`,
    errors: exec.errors,
  });

  return {
    ok: true,
    stageBefore,
    stageAfter,
    actionId,
    evidence: exec.evidence,
    warnings: exec.warnings,
    errors: exec.errors,
    workflow: buildCustomerWorkflowState(slug, operator),
  };
}

export async function continueCustomerWorkflow(
  slug: string,
  operator: string,
  body: Record<string, unknown> = {},
): Promise<ContinueWorkflowResult> {
  const preflight = runWorkflowPreflight(slug);
  if (!preflight.ok) {
    const ctx = loadMasterAdminCustomerContext(slug);
    return {
      ok: false,
      blocked: true,
      preflight,
      stageBefore: preflight.stageId,
      stageAfter: preflight.stageId,
      actionId: preflight.actionId,
      error: preflight.reason,
      evidence: preflight.reason || "Preflight failed",
      warnings: [],
      errors: preflight.reason ? [preflight.reason] : [],
      workflow: ctx ? buildCustomerWorkflowState(slug, operator) : null,
    };
  }

  const ctx = loadMasterAdminCustomerContext(slug)!;
  const stageId = preflight.stageId;
  const stageBefore = stageId;

  if (stageId === "create_customer" || stageId === "monitoring") {
    const stageAfter = resolveWorkflowStage(ctx);
    if (stageAfter !== stageBefore) {
      recordWorkflowTransition({
        slug,
        fromStage: stageBefore,
        toStage: stageAfter,
        operator,
        reason: "Auto-advance — no execution required",
        evidence: `Advanced from ${WORKFLOW_STAGE_DEFINITIONS[stageBefore].label}`,
      });
    }
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "continue_workflow",
      status: "success",
      evidence: `Auto-advanced to ${WORKFLOW_STAGE_DEFINITIONS[stageAfter].label}`,
    });
    return {
      ok: true,
      stageBefore,
      stageAfter: resolveWorkflowStage(loadMasterAdminCustomerContext(slug)!),
      actionId: null,
      evidence: "Stage auto-advanced",
      warnings: [],
      errors: [],
      workflow: buildCustomerWorkflowState(slug, operator),
    };
  }

  const requestedActionId =
    typeof body.actionId === "string" && body.actionId.trim() ? body.actionId.trim() : null;
  if (requestedActionId && preflight.actionId && requestedActionId !== preflight.actionId) {
    return {
      ok: false,
      blocked: true,
      preflight,
      stageBefore,
      stageAfter: stageBefore,
      actionId: preflight.actionId,
      error: `Requested action ${requestedActionId} does not match workflow action ${preflight.actionId}`,
      evidence: "Action mismatch",
      warnings: [],
      errors: [`Requested action ${requestedActionId} does not match workflow action ${preflight.actionId}`],
      workflow: buildCustomerWorkflowState(slug, operator),
    };
  }

  const actionId = requestedActionId || preflight.actionId;
  if (!actionId) {
    return {
      ok: false,
      blocked: true,
      preflight,
      stageBefore,
      stageAfter: stageBefore,
      actionId: null,
      error: "No workflow action available for current stage",
      evidence: "No workflow action available for current stage",
      warnings: [],
      errors: ["No workflow action available for current stage"],
      workflow: buildCustomerWorkflowState(slug, operator),
    };
  }
  const validationMode = Boolean(body.validationMode);

  if (actionId === LOCAL_CLUSTER_JOB_ACTION && !validationMode) {
    if (!isCprClusterGenerationEligible(slug)) {
      return {
        ok: false,
        blocked: true,
        stageBefore,
        stageAfter: stageBefore,
        actionId,
        error: "Cluster generation is not eligible",
        evidence: "Cluster generation is not eligible",
        warnings: [],
        errors: ["Cluster generation is not eligible"],
        workflow: buildCustomerWorkflowState(slug, operator),
      };
    }
    const activeCluster = findActiveLocalClusterJob(slug);
    if (activeCluster) {
      if (activeCluster.status === "queued") {
        runMasterAdminJobAsync(activeCluster.id, activeCluster.executionPayload || {}, {
          workflowStage: stageId,
        });
      }
      return advanceAfterExecution(slug, operator, stageId, actionId, {
        ok: true,
        evidence: `Cluster generation job already ${activeCluster.status}`,
        warnings: [],
        errors: [],
        jobId: activeCluster.id,
      });
    }
    // Campaign-scoped identity — never fall back to another service's cluster record.
    const activeCampaign = readActiveServiceCampaignSelection(slug);
    const serviceId = activeCampaign?.serviceId || undefined;
    const campaignId = activeCampaign?.campaignId || undefined;
    const job = queueLocalClusterPagesJob({
      slug,
      operator,
      serviceId,
      campaignId,
      workflowStage: stageId,
      executionPayload: {
        operatorConfirmed: body.operatorConfirmed === true || requestedActionId === LOCAL_CLUSTER_JOB_ACTION,
        requestedActionId: actionId,
        serviceId,
        campaignId,
      },
    });
    return advanceAfterExecution(slug, operator, stageId, actionId, {
      ok: true,
      evidence: `${WORKFLOW_ACTION_LABELS[actionId] || actionId} queued`,
      warnings: [],
      errors: [],
      jobId: job.id,
    });
  }

  if (actionId === "orchestrate_growth_intelligence" && !validationMode) {
    const activeGiJob = findActiveGrowthIntelligenceJob(slug);
    if (activeGiJob) {
      return advanceAfterExecution(slug, operator, stageId, actionId, {
        ok: true,
        evidence: `Growth Intelligence job already ${activeGiJob.status}`,
        warnings: [],
        errors: [],
        jobId: activeGiJob.id,
      });
    }
  }

  if (actionId === "orchestrate_competitor_analysis" && !validationMode) {
    const active = findActiveCommercialIntelligenceJob(slug, new Set(["orchestrate_competitor_analysis"]));
    if (active) {
      return advanceAfterExecution(slug, operator, stageId, actionId, {
        ok: true,
        evidence: `Competitor Analysis job already ${active.status}`,
        warnings: [],
        errors: [],
        jobId: active.id,
      });
    }
  }

  if (actionId === "orchestrate_local_market_intelligence" && !validationMode) {
    const active = findActiveCommercialIntelligenceJob(slug, new Set(["orchestrate_local_market_intelligence"]));
    if (active) {
      return advanceAfterExecution(slug, operator, stageId, actionId, {
        ok: true,
        evidence: `Local Market Intelligence job already ${active.status}`,
        warnings: [],
        errors: [],
        jobId: active.id,
      });
    }
  }

  if (LONG_RUNNING_STAGE_ACTIONS.has(actionId) && !validationMode) {
    if (actionId === "generate_ecosystem") {
      const gate = assertEcosystemGenerationAllowed(slug);
      if (!gate.ok) {
        return {
          ok: false,
          blocked: true,
          stageBefore,
          stageAfter: stageBefore,
          actionId,
          error: gate.error || "Ecosystem generation not allowed",
          evidence: gate.error || "blocked",
          warnings: [],
          errors: [gate.error || "Ecosystem generation not allowed"],
          workflow: buildCustomerWorkflowState(slug, operator),
        };
      }
      const activeGen = listMasterAdminJobs({ slug, limit: 5 }).find(
        (j) => j.action === "generate_ecosystem" && (j.status === "queued" || j.status === "running"),
      );
      if (activeGen) {
        return advanceAfterExecution(slug, operator, stageId, actionId, {
          ok: true,
          evidence: `Authorised ecosystem generation already ${activeGen.status}`,
          warnings: [],
          errors: [],
          jobId: activeGen.id,
        });
      }
    }
    const job = createMasterAdminJob({ slug, action: actionId, user: operator, workflowStage: stageId });
    if (actionId === "generate_ecosystem") {
      beginAuthorisedEcosystemGeneration(slug, operator, job.id);
    }
    runMasterAdminJobAsync(job.id, body, { workflowStage: stageId });
    return advanceAfterExecution(slug, operator, stageId, actionId, {
      ok: true,
      evidence: `${WORKFLOW_ACTION_LABELS[actionId] || actionId} queued`,
      warnings: [],
      errors: [],
      jobId: job.id,
    });
  }

  if (
    validationMode ||
    actionId.startsWith("orchestrate_") ||
    actionId === "approve_profile"
  ) {
    const stageResult = await executeWorkflowStageAction(stageId, actionId, ctx, operator, body);
    if (!stageResult.ok && stageResult.redirectUrl) {
      return {
        ok: false,
        blocked: true,
        stageBefore,
        stageAfter: stageBefore,
        actionId,
        error: stageResult.errors[0] || "Manual resolution required",
        evidence: stageResult.evidence,
        warnings: stageResult.warnings,
        errors: stageResult.errors,
        workflow: buildCustomerWorkflowState(slug, operator),
      };
    }
    return advanceAfterExecution(slug, operator, stageId, actionId, stageResult);
  }

  if (
    actionId === "publish" ||
    actionId === "generate_ecosystem" ||
    actionId === "request_indexing" ||
    actionId === "init_rank_tracking"
  ) {
    if (actionId === "generate_ecosystem") {
      const gate = assertEcosystemGenerationAllowed(slug);
      if (!gate.ok) {
        return {
          ok: false,
          blocked: true,
          stageBefore,
          stageAfter: stageBefore,
          actionId,
          error: gate.error || "Ecosystem generation not allowed",
          evidence: gate.error || "blocked",
          warnings: [],
          errors: [gate.error || "Ecosystem generation not allowed"],
          workflow: buildCustomerWorkflowState(slug, operator),
        };
      }
    }
    const outcome = await executeMasterAdminAction(actionId, slug, operator, body);
    return advanceAfterExecution(slug, operator, stageId, actionId, {
      ok: outcome.ok,
      evidence: outcome.audit.evidence || actionId,
      warnings: outcome.ok ? [] : [],
      errors: outcome.error ? [outcome.error] : outcome.audit.errors || [],
    });
  }

  const stageResult = await executeWorkflowStageAction(stageId, actionId, ctx, operator, body);
  if (!stageResult.ok && stageResult.redirectUrl) {
    return {
      ok: false,
      blocked: true,
      stageBefore,
      stageAfter: stageBefore,
      actionId,
      error: stageResult.errors[0] || "Manual resolution required",
      evidence: stageResult.evidence,
      warnings: stageResult.warnings,
      errors: stageResult.errors,
      workflow: buildCustomerWorkflowState(slug, operator),
    };
  }

  return advanceAfterExecution(slug, operator, stageId, actionId, stageResult);
}

export function finalizeWorkflowJob(jobId: string): void {
  finalizeCompletedWorkflowJob(jobId);
}

export function getOrchestrationPreview(slug: string) {
  const preflight = runWorkflowPreflight(slug);
  const lastExecution = getLastWorkflowExecution(slug);
  const activeJob = listMasterAdminJobs({ slug, limit: 3 }).find((j) => j.status === "queued" || j.status === "running") || null;
  return {
    canContinue: preflight.ok,
    continueLabel: preflight.actionId
      ? `Continue — ${WORKFLOW_ACTION_LABELS[preflight.actionId] || preflight.actionId}`
      : preflight.stageId === "live_customer"
        ? "Live Customer"
        : "Continue Workflow",
    blockingReason: preflight.ok ? null : preflight.reason || null,
    stageActionId: preflight.actionId,
    stageActionLabel: preflight.actionId ? WORKFLOW_ACTION_LABELS[preflight.actionId] || preflight.actionId : null,
    activeJob: activeJob
      ? {
          id: activeJob.id,
          status: activeJob.status,
          progress: activeJob.progress,
          progressLabel: activeJob.progressLabel,
          action: activeJob.action,
        }
      : null,
    lastExecution,
  };
}
