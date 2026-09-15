/**
 * Google Business Profile identity gate for Continue Workflow — does not modify Workflow Engine.
 */
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { buildCustomerWorkflowState } from "./masterAdminWorkflowEngine.ts";
import {
  continueCustomerWorkflow,
  type ContinueWorkflowResult,
} from "./masterAdminWorkflowOrchestrator.ts";
import { resolveWorkflowStage } from "./masterAdminWorkflowStageExecutor.ts";
import {
  assessGoogleImportReadiness,
  type GoogleConfirmationPreview,
} from "./masterAdminCanonicalGoogleService.ts";

export interface ContinueWorkflowWithGoogleResult extends ContinueWorkflowResult {
  confirmationRequired?: boolean;
  googleConfirmation?: GoogleConfirmationPreview | null;
}

export async function continueCustomerWorkflowWithGoogleIdentity(
  slug: string,
  operator: string,
  body: Record<string, unknown> = {},
): Promise<ContinueWorkflowWithGoogleResult> {
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

  const stageId = resolveWorkflowStage(ctx);
  if (stageId === "google_import" && !body.validationMode && !body.skipGoogleConfirmation) {
    const gate = assessGoogleImportReadiness(slug);
    if (!gate.canProceed) {
      return {
        ok: false,
        blocked: true,
        confirmationRequired: gate.confirmationRequired,
        googleConfirmation: gate.preview,
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
  }

  return continueCustomerWorkflow(slug, operator, body);
}
