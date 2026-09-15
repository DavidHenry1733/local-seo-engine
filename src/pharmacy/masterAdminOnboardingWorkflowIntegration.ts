/**
 * Onboarding batch workflow integration — prevents duplicate manual import stages.
 */
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { buildCustomerWorkflowState } from "./masterAdminWorkflowEngine.ts";
import {
  continueCustomerWorkflow,
  type ContinueWorkflowResult,
  finalizeWorkflowJob,
} from "./masterAdminWorkflowOrchestrator.ts";
import { resolveWorkflowStage, verifyStageCompletion } from "./masterAdminWorkflowStageExecutor.ts";
import { recordWorkflowTransition } from "./masterAdminWorkflowHistoryService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import {
  assessGoogleImportReadiness,
  type GoogleConfirmationPreview,
} from "./masterAdminCanonicalGoogleService.ts";
import {
  isGoogleImportCompleteForRevision,
  isWebsiteImportCompleteForRevision,
} from "./masterAdminSourceJobGuardService.ts";
import {
  readOnboardingBatch,
  refreshOnboardingBatchStatus,
  resumeOnboardingBatchAfterGoogleConfirm,
  startOnboardingBatchImports,
} from "./masterAdminOnboardingBatchService.ts";
import { completeMasterAdminJobIdempotently, listMasterAdminJobs } from "./masterAdminJobService.ts";
import { startWorkflowExecution } from "./masterAdminWorkflowHistoryService.ts";

export interface ContinueWorkflowWithOnboardingResult extends ContinueWorkflowResult {
  confirmationRequired?: boolean;
  googleConfirmation?: GoogleConfirmationPreview | null;
  batchState?: string;
}

function advanceIfImportStageComplete(
  slug: string,
  operator: string,
  stageId: "website_import" | "google_import",
): ContinueWorkflowWithOnboardingResult | null {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx || !verifyStageCompletion(stageId, ctx)) return null;

  const stageAfter = resolveWorkflowStage(ctx);
  if (stageAfter !== stageId) {
    recordWorkflowTransition({
      slug,
      fromStage: stageId,
      toStage: stageAfter,
      operator,
      reason: "Import evidence already present — idempotent advance",
      evidence: `${stageId} complete without re-import`,
    });
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "continue_workflow",
      status: "success",
      evidence: `Skipped duplicate ${stageId} — evidence already stored`,
    });
    return {
      ok: true,
      stageBefore: stageId,
      stageAfter,
      actionId: stageId === "website_import" ? "import_website" : "import_google",
      evidence: "Import already complete",
      warnings: [],
      errors: [],
      workflow: buildCustomerWorkflowState(slug, operator),
    };
  }
  return null;
}

export function advanceWebsiteImportAfterBranchResolution(slug: string, operator: string): void {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return;
  if (!verifyStageCompletion("website_import", ctx)) return;
  const stageAfter = resolveWorkflowStage(ctx);
  if (stageAfter === "website_import") return;
  recordWorkflowTransition({
    slug,
    fromStage: "website_import",
    toStage: stageAfter,
    operator,
    reason: "Website import complete after branch selection",
    evidence: "Branch confirmed — website import stage complete",
  });
  refreshOnboardingBatchStatus(slug);
}

export async function continueCustomerWorkflowWithOnboardingBatch(
  slug: string,
  operator: string,
  body: Record<string, unknown> = {},
): Promise<ContinueWorkflowWithOnboardingResult> {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) {
    return {
      ok: false,
      blocked: true,
      stageBefore: "create_customer",
      stageAfter: "create_customer",
      actionId: null,
      error: "Customer not found",
      evidence: "Customer not found",
      warnings: [],
      errors: ["Customer not found"],
      workflow: null,
    };
  }

  refreshOnboardingBatchStatus(slug);
  const batch = readOnboardingBatch(slug);
  const stageId = resolveWorkflowStage(ctx);

  if (stageId === "website_import" && !body.validationMode) {
    const advanced = advanceIfImportStageComplete(slug, operator, "website_import");
    if (advanced) return advanced;

    if (batch && (batch.website.importState === "queued" || batch.website.importState === "running")) {
      return {
        ok: false,
        blocked: true,
        batchState: batch.overallState,
        stageBefore: stageId,
        stageAfter: stageId,
        actionId: "import_website",
        error: "Automated Website Import is in progress",
        evidence: batch.latestEvidence,
        warnings: [],
        errors: ["Automated Website Import is in progress"],
        workflow: buildCustomerWorkflowState(slug, operator),
      };
    }

    if (
      batch &&
      (batch.website.importState === "not_started" || batch.website.importState === "failed")
    ) {
      const queueResult = startOnboardingBatchImports(slug, operator);
      refreshOnboardingBatchStatus(slug);

      if (queueResult.website.skipped) {
        const advanced = advanceIfImportStageComplete(slug, operator, "website_import");
        if (advanced) return advanced;
      }

      const job = queueResult.website.job;
      if (job) {
        startWorkflowExecution({
          slug,
          stageId: "website_import",
          actionId: "import_website",
          operator,
          jobId: job.id,
        });
        recordMasterAdminAudit({
          user: operator,
          slug,
          action: "continue_workflow",
          status: "success",
          evidence: `Website import queued (${job.id})`,
        });
        return {
          ok: true,
          async: true,
          jobId: job.id,
          batchState: readOnboardingBatch(slug)?.overallState,
          stageBefore: stageId,
          stageAfter: stageId,
          actionId: "import_website",
          evidence: queueResult.website.reason || "Website import queued",
          warnings: [],
          errors: [],
          workflow: buildCustomerWorkflowState(slug, operator),
        };
      }
    }

    if (batch && batch.website.importState !== "completed" && batch.website.importState !== "skipped") {
      return {
        ok: false,
        blocked: true,
        batchState: batch.overallState,
        stageBefore: stageId,
        stageAfter: stageId,
        actionId: "import_website",
        error: "Website Import could not be queued — retry from onboarding sources",
        evidence: batch.blockingAction || batch.latestEvidence,
        warnings: [],
        errors: ["Website Import could not be queued"],
        workflow: buildCustomerWorkflowState(slug, operator),
      };
    }
  }

  if (stageId === "google_import" && !body.validationMode && !body.skipGoogleConfirmation) {
    const batchGoogleRevision = batch?.google.sourceRevision || "";
    const batchPlaceId = batch?.google.placeId || ctx.data.googlePlaceId || "";
    if (
      batchGoogleRevision &&
      isGoogleImportCompleteForRevision(slug, batchGoogleRevision, String(batchPlaceId))
    ) {
      const queued = listMasterAdminJobs({ slug, limit: 10 }).find(
        (j) => j.action === "import_google" && j.status === "queued",
      );
      if (queued) {
        completeMasterAdminJobIdempotently(
          queued.id,
          "Google Intelligence already stored — job completed idempotently",
        );
        finalizeWorkflowJob(queued.id);
      }
      const advanced = advanceIfImportStageComplete(slug, operator, "google_import");
      if (advanced) return advanced;
    }

    const gate = assessGoogleImportReadiness(slug);
    if (!gate.canProceed) {
      return {
        ok: false,
        blocked: true,
        confirmationRequired: gate.confirmationRequired,
        googleConfirmation: gate.preview,
        batchState: batch?.overallState,
        stageBefore: stageId,
        stageAfter: stageId,
        actionId: "import_google",
        error: gate.reason || "Google Business Profile confirmation required",
        evidence: gate.reason || "Google Business Profile confirmation required",
        warnings: [],
        errors: [gate.reason || "Google Business Profile confirmation required"],
        workflow: buildCustomerWorkflowState(slug, operator),
      };
    }

    const advanced = advanceIfImportStageComplete(slug, operator, "google_import");
    if (advanced) return advanced;

    if (batch && (batch.google.importState === "queued" || batch.google.importState === "running")) {
      return {
        ok: false,
        blocked: true,
        batchState: batch.overallState,
        stageBefore: stageId,
        stageAfter: stageId,
        actionId: "import_google",
        error: "Automated Google Import is in progress",
        evidence: batch.latestEvidence,
        warnings: [],
        errors: ["Automated Google Import is in progress"],
        workflow: buildCustomerWorkflowState(slug, operator),
      };
    }

    if (batch && batch.google.importState !== "completed" && batch.google.importState !== "skipped") {
      return {
        ok: false,
        blocked: true,
        batchState: batch.overallState,
        stageBefore: stageId,
        stageAfter: stageId,
        actionId: "import_google",
        error: "Google Import is handled by the automated onboarding batch",
        evidence: batch.blockingAction || batch.latestEvidence,
        warnings: [],
        errors: ["Manual Google Import disabled — automated batch active"],
        workflow: buildCustomerWorkflowState(slug, operator),
      };
    }
  }

  return continueCustomerWorkflow(slug, operator, body);
}

export async function confirmGoogleAndResumeBatch(slug: string, operator: string): Promise<void> {
  await resumeOnboardingBatchAfterGoogleConfirm(slug, operator);
}
