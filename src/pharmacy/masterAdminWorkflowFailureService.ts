/**
 * Master Admin Workflow Failure V1 — Issue Centre integration on stage failure.
 */
import { createMasterAdminIssue, generateCursorDefectBrief, refreshMasterAdminIssueDiagnostics } from "./masterAdminIssueService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { WORKFLOW_STAGE_DEFINITIONS, type WorkflowStageId } from "./masterAdminWorkflowModel.ts";

export interface WorkflowFailureTicket {
  issueId: string;
  cursorBrief: string;
}

export function handleWorkflowStageFailure(
  slug: string,
  operator: string,
  stageId: WorkflowStageId,
  actionId: string,
  errorMessage: string,
): WorkflowFailureTicket {
  const stageLabel = WORKFLOW_STAGE_DEFINITIONS[stageId]?.label || stageId;
  const issue = createMasterAdminIssue(
    {
      tenantSlug: slug,
      category: "Customer onboarding",
      severity: "high",
      title: `Workflow failed: ${stageLabel}`,
      description: errorMessage,
      expectedBehaviour: `Continue Workflow completes ${stageLabel} without error`,
      actualBehaviour: errorMessage,
      reproductionSteps: [
        "1. Open Master Admin customer record",
        `2. Customer slug: ${slug}`,
        `3. Click Continue Workflow at stage: ${stageLabel}`,
        `4. Action: ${actionId}`,
      ].join("\n"),
      serviceId: "pharmacy-first",
    },
    operator,
  );

  refreshMasterAdminIssueDiagnostics(issue.issueId, operator);
  const cursorBrief = generateCursorDefectBrief(issue.issueId, operator);

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "workflow_failure_ticket",
    status: "error",
    evidence: `Issue ${issue.issueId} created for failed ${stageLabel}`,
    errors: [errorMessage],
    meta: { issueId: issue.issueId, stageId, actionId },
  });

  return { issueId: issue.issueId, cursorBrief };
}
