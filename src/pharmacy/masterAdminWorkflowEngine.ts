/**
 * Master Admin Workflow Engine V2 — workflow state + orchestration signals.
 */
import { listMasterAdminAudit } from "./masterAdminAuditService.ts";
import { loadMasterAdminCustomerContext, type MasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import {
  getStageTransitionMeta,
  getWorkflowExecutions,
  getWorkflowHistory,
  recordWorkflowTransition,
  getLastRecordedWorkflowStage,
} from "./masterAdminWorkflowHistoryService.ts";
import { getOrchestrationPreview, runWorkflowPreflight } from "./masterAdminWorkflowOrchestrator.ts";
import { resolveWorkflowStage, verifyStageCompletion, isCommercialIntelligenceWorkflowStageComplete } from "./masterAdminWorkflowStageExecutor.ts";
import {
  COMMERCIAL_INTELLIGENCE_GENERATION_STAGES,
  OPERATOR_WORKFLOW_DISPLAY_ORDER,
  STAGE_EXECUTION_ACTION,
  WORKFLOW_ACTION_LABELS,
  WORKFLOW_STAGE_DEFINITIONS,
  WORKFLOW_STAGE_ORDER,
  type CustomerWorkflowState,
  type WorkflowStageId,
  type WorkflowStageStatus,
  type WorkflowStageView,
} from "./masterAdminWorkflowModel.ts";
import {
  resolveGoogleProfileOnboardingState,
  shouldRunGoogleImport,
} from "./masterAdminGoogleProfileOnboardingService.ts";
import { isBusinessProfileReviewApproved } from "./masterAdminBusinessProfileReviewService.ts";
import { resolveCommercialWorkflowNextAction } from "./masterAdminCommercialEcosystemGenerationService.ts";
import {
  isCoreProductRecoveryMode,
  isServicePageEvidenceReviewApproved,
} from "./masterAdminCoreProductRecoveryService.ts";
import { ensureLegacyAutoAdvance } from "./masterAdminWorkflowLegacyService.ts";

const OPERATOR_HIDDEN_WORKFLOW_STAGES: WorkflowStageId[] = [
  "resolve_import_conflicts",
  "approve_business_profile",
  "create_customer",
  "google_import",
  ...COMMERCIAL_INTELLIGENCE_GENERATION_STAGES,
];
const BUSINESS_PROFILE_REVIEW_STAGES: WorkflowStageId[] = [
  "business_profile_intelligence",
  "resolve_import_conflicts",
  "approve_business_profile",
];

function operatorStageLabel(stageId: WorkflowStageId): string {
  if (stageId === "business_profile_intelligence") return "Business Profile Review";
  if (stageId === "commercial_intelligence") return "Commercial Intelligence";
  if (stageId === "request_indexing") return "Indexing";
  if (stageId === "initialise_rank_tracking") return "Performance Dashboard";
  return WORKFLOW_STAGE_DEFINITIONS[stageId].label;
}

function resolveOperatorCurrentStage(currentStage: WorkflowStageId): WorkflowStageId {
  if (COMMERCIAL_INTELLIGENCE_GENERATION_STAGES.includes(currentStage as (typeof COMMERCIAL_INTELLIGENCE_GENERATION_STAGES)[number])) {
    return "commercial_intelligence";
  }
  if (BUSINESS_PROFILE_REVIEW_STAGES.includes(currentStage)) return "business_profile_intelligence";
  if (currentStage === "create_customer" || currentStage === "google_import") return "website_import";
  if (currentStage === "monitoring") return "initialise_rank_tracking";
  return currentStage;
}

function isOperatorStageComplete(stageId: WorkflowStageId, ctx: MasterAdminCustomerContext): boolean {
  if (isCoreProductRecoveryMode(ctx.slug) && isBusinessProfileReviewApproved(ctx.slug)) {
    if (stageId === "commercial_intelligence") return isCommercialIntelligenceWorkflowStageComplete(ctx);
    if (stageId === "generate_ecosystem") {
      return verifyStageCompletion("generate_ecosystem", ctx);
    }
  }
  if (stageId === "website_import") return verifyStageCompletion("website_import", ctx);
  if (stageId === "business_profile_intelligence") return isBusinessProfileReviewApproved(ctx.slug);
  if (stageId === "commercial_intelligence") return isCommercialIntelligenceWorkflowStageComplete(ctx);
  return verifyStageCompletion(stageId, ctx);
}

function syncWorkflowHistory(ctx: MasterAdminCustomerContext, currentStage: WorkflowStageId): void {
  const previous = getLastRecordedWorkflowStage(ctx.slug);
  if (previous === currentStage) return;

  const lastTransition = getWorkflowHistory(ctx.slug)[0];
  const durationMs = lastTransition ? Date.now() - new Date(lastTransition.timestamp).getTime() : null;
  const audit = listMasterAdminAudit({ slug: ctx.slug, limit: 1 })[0];

  recordWorkflowTransition({
    slug: ctx.slug,
    fromStage: previous,
    toStage: currentStage,
    operator: audit?.user || "system",
    durationMs,
    reason: "Workflow stage derived from stored tenant signals",
    evidence: audit?.evidence || `Stage advanced to ${WORKFLOW_STAGE_DEFINITIONS[currentStage].label}`,
  });
}

function buildStageViews(ctx: MasterAdminCustomerContext, currentStage: WorkflowStageId): WorkflowStageView[] {
  const operatorCurrent = resolveOperatorCurrentStage(currentStage);
  return OPERATOR_WORKFLOW_DISPLAY_ORDER.map((stageId) => {
    const complete = isOperatorStageComplete(stageId, ctx);
    let status: WorkflowStageStatus = "pending";
    if (complete) status = "complete";
    else if (stageId === operatorCurrent) status = "current";
    else if (
      OPERATOR_WORKFLOW_DISPLAY_ORDER.indexOf(stageId) >
      OPERATOR_WORKFLOW_DISPLAY_ORDER.indexOf(operatorCurrent as (typeof OPERATOR_WORKFLOW_DISPLAY_ORDER)[number])
    )
      status = "blocked";

    const metaStage =
      stageId === "commercial_intelligence" &&
      COMMERCIAL_INTELLIGENCE_GENERATION_STAGES.includes(currentStage as (typeof COMMERCIAL_INTELLIGENCE_GENERATION_STAGES)[number])
        ? currentStage
        : stageId === "business_profile_intelligence" && BUSINESS_PROFILE_REVIEW_STAGES.includes(currentStage)
          ? currentStage
          : stageId;
    const meta = getStageTransitionMeta(ctx.slug, metaStage);
    return {
      id: stageId,
      label: operatorStageLabel(stageId),
      status,
      timestamp: complete ? meta.timestamp : stageId === operatorCurrent ? ctx.profileUpdatedAt : null,
      operator: meta.operator,
      durationMs: meta.durationMs,
      evidence: meta.evidence,
    };
  });
}

function resolveNextWorkflowStage(ctx: MasterAdminCustomerContext, currentStage: WorkflowStageId): WorkflowStageId | null {
  if (currentStage === "live_customer" || currentStage === "archived" || currentStage === "suspended") {
    return null;
  }
  if (!verifyStageCompletion(currentStage, ctx)) {
    return currentStage;
  }
  const currentIndex = WORKFLOW_STAGE_ORDER.indexOf(currentStage as (typeof WORKFLOW_STAGE_ORDER)[number]);
  for (let i = currentIndex + 1; i < WORKFLOW_STAGE_ORDER.length; i++) {
    const stageId = WORKFLOW_STAGE_ORDER[i]!;
    if (stageId === "google_import") {
      const state = resolveGoogleProfileOnboardingState(ctx.data);
      if (!shouldRunGoogleImport(state)) continue;
    }
    return stageId;
  }
  return null;
}

function computeWorkflowCore(ctx: MasterAdminCustomerContext) {
  const currentStage = resolveWorkflowStage(ctx);
  const currentIndex = WORKFLOW_STAGE_ORDER.indexOf(currentStage as (typeof WORKFLOW_STAGE_ORDER)[number]);
  const completedStages = WORKFLOW_STAGE_ORDER.filter((s) => verifyStageCompletion(s, ctx));
  const stageDef = WORKFLOW_STAGE_DEFINITIONS[currentStage];
  const stageActionId = STAGE_EXECUTION_ACTION[currentStage] || null;
  const preflight = runWorkflowPreflight(ctx.slug);
  const commercialNextAction = resolveCommercialWorkflowNextAction(ctx.slug, currentStage);
  const operatorCurrent = resolveOperatorCurrentStage(currentStage);
  const operatorCurrentLabel = operatorStageLabel(operatorCurrent);
  const nextStage = resolveNextWorkflowStage(ctx, currentStage);

  return {
    currentStage,
    currentStageLabel: operatorCurrentLabel,
    previousStage: currentIndex > 0 ? WORKFLOW_STAGE_ORDER[currentIndex - 1]! : null,
    nextStage,
    nextAction: commercialNextAction
      ? { id: "commercial_dashboard_action", label: commercialNextAction }
      : stageActionId
        ? { id: "continue_workflow", label: WORKFLOW_ACTION_LABELS[stageActionId] || stageActionId }
        : currentStage === "live_customer"
          ? null
          : { id: "continue_workflow", label: "Continue Workflow" },
    completedStages,
    blockedStages: WORKFLOW_STAGE_ORDER.filter((s) => {
      const idx = WORKFLOW_STAGE_ORDER.indexOf(s);
      return idx > currentIndex && !verifyStageCompletion(s, ctx);
    }),
    outstandingActions: [],
    completionPct: Math.round((completedStages.length / WORKFLOW_STAGE_ORDER.length) * 100),
    estimatedMinutesRemaining: WORKFLOW_STAGE_ORDER.reduce(
      (sum, stageId) => sum + (verifyStageCompletion(stageId, ctx) ? 0 : WORKFLOW_STAGE_DEFINITIONS[stageId].estimatedMinutes),
      0,
    ),
    guidance: stageDef.guidance,
    stages: buildStageViews(ctx, currentStage),
    orchestration: {
      ...getOrchestrationPreview(ctx.slug),
      canContinue: preflight.ok,
      blockingReason: preflight.ok ? null : preflight.reason || null,
    },
  };
}

export function buildCustomerWorkflowSummaryLite(slug: string): Pick<
  CustomerWorkflowState,
  "currentStage" | "currentStageLabel" | "nextAction" | "completionPct" | "estimatedMinutesRemaining"
> | null {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return null;
  const core = computeWorkflowCore(ctx);
  return {
    currentStage: core.currentStage,
    currentStageLabel: core.currentStageLabel,
    nextAction: core.nextAction,
    completionPct: core.completionPct,
    estimatedMinutesRemaining: core.estimatedMinutesRemaining,
  };
}

export function buildCustomerWorkflowState(slug: string, _operator = "system"): CustomerWorkflowState | null {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return null;

  ensureLegacyAutoAdvance(slug);
  const ctxFresh = loadMasterAdminCustomerContext(slug)!;
  const core = computeWorkflowCore(ctxFresh);
  syncWorkflowHistory(ctxFresh, core.currentStage);

  return {
    slug,
    ...core,
    currentStage: core.currentStage,
    currentStageLabel: core.currentStageLabel,
    previousStage: core.previousStage as WorkflowStageId | null,
    nextStage: core.nextStage as WorkflowStageId | null,
    nextStageLabel: core.nextStage
      ? operatorStageLabel(
          resolveOperatorCurrentStage(core.nextStage as WorkflowStageId),
        )
      : null,
    completedStages: core.completedStages as WorkflowStageId[],
    blockedStages: core.blockedStages as WorkflowStageId[],
    history: getWorkflowHistory(slug),
    executions: getWorkflowExecutions(slug),
    orchestration: core.orchestration,
  };
}

export function getWorkflowActionsForCustomer(slug: string): Array<{ id: string; label: string; group: string; enabled: boolean; reason?: string }> {
  const pre = runWorkflowPreflight(slug);
  return [
    {
      id: "continue_workflow",
      label: pre.actionId ? `Continue — ${WORKFLOW_ACTION_LABELS[pre.actionId] || pre.actionId}` : "Continue Workflow",
      group: "Orchestration",
      enabled: pre.ok,
      reason: pre.reason,
    },
  ];
}
