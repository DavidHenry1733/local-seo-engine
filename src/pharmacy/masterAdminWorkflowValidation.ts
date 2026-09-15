/**
 * Master Admin Workflow Validation — Sprint 6D orchestration validation customer.
 */
import fs from "node:fs";
import { createAdminPharmacyClient } from "./adminClientCreationService.ts";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import path from "node:path";
import { buildCustomerWorkflowState } from "./masterAdminWorkflowEngine.ts";
import { continueCustomerWorkflow, runWorkflowPreflight } from "./masterAdminWorkflowOrchestrator.ts";
import { verifyStageCompletion } from "./masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { STAGE_EXECUTION_ACTION, WORKFLOW_STAGE_DEFINITIONS, type WorkflowStageId } from "./masterAdminWorkflowModel.ts";
import { resetWorkflowHistory } from "./masterAdminWorkflowHistoryService.ts";

const STAGES_TO_RUN: WorkflowStageId[] = [
  "website_import",
  "google_import",
  "business_profile_intelligence",
  "resolve_import_conflicts",
  "approve_business_profile",
  "generate_growth_intelligence",
];

function ensureValidationSlug(): string {
  const base = "sprint-6d-orchestration-validation";
  if (!fs.existsSync(profilePath(base)) && !fs.existsSync(profilePath(`${base}-pharmacy`))) {
    return createAdminPharmacyClient({
      pharmacyName: "Sprint 6D Orchestration Validation",
      website: "https://example-pharmacy.co.uk",
      town: "Sheffield",
      postcode: "S1 2AA",
      contactEmail: "validation@example.com",
      phone: "0114 000 0001",
      notes: "Sprint 6D orchestration validation — no production defect",
    }).slug;
  }
  return fs.existsSync(profilePath(`${base}-pharmacy`)) ? `${base}-pharmacy` : base;
}

function seedImportFields(slug: string): void {
  const existing = readSetupProfile(slug);
  writeSetupProfile(slug, {
    ...existing,
    pharmacyName: existing.pharmacyName || "Sprint 6D Orchestration Validation",
    website: existing.website || "https://example-pharmacy.co.uk",
    phone: existing.phone || "0114 000 0001",
    businessEmail: existing.businessEmail || existing.email || "validation@example.com",
    addressLine1: existing.addressLine1 || "1 Validation Street",
    townCity: existing.townCity || existing.primaryTown || "Sheffield",
    primaryTown: existing.primaryTown || "Sheffield",
    postcode: existing.postcode || "S1 2AA",
    businessDescription: existing.businessDescription || "Validation pharmacy profile",
    logoUrl: existing.logoUrl || "https://example.com/logo.png",
    openingHours: existing.openingHours || "Mon-Fri 9-6",
  });
}

export async function runOrchestrationValidationCustomer(user: string): Promise<{
  slug: string;
  steps: Array<{ step: string; actionId: string | null; currentStage: string; passed: boolean; detail: string }>;
  passed: boolean;
}> {
  const slug = ensureValidationSlug();
  resetWorkflowHistory(slug);
  const ackFile = path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-workflow.json`);
  if (fs.existsSync(ackFile)) fs.unlinkSync(ackFile);

  writeSetupProfile(slug, {
    ...readSetupProfile(slug),
    platformClientStatus: "setup_required",
    profileFieldConfirmations: undefined,
    websiteImportSnapshot: null,
    googleImportSnapshot: null,
    customerSetupGoogleMatchStatus: "none",
  });

  const steps: Array<{ step: string; actionId: string | null; currentStage: string; passed: boolean; detail: string }> = [];
  const body = { validationMode: true };

  let wf = buildCustomerWorkflowState(slug, user)!;
  steps.push({
    step: "Create Customer",
    actionId: null,
    currentStage: wf.currentStage,
    passed: wf.currentStage === "website_import",
    detail: wf.currentStage,
  });

  for (const stageId of STAGES_TO_RUN) {
    if (stageId === "resolve_import_conflicts") seedImportFields(slug);

    const ctx = loadMasterAdminCustomerContext(slug)!;
    wf = buildCustomerWorkflowState(slug, user)!;

    if (verifyStageCompletion(stageId, ctx)) {
      steps.push({
        step: `${WORKFLOW_STAGE_DEFINITIONS[stageId].label} — already complete`,
        actionId: STAGE_EXECUTION_ACTION[stageId] || null,
        currentStage: wf.currentStage,
        passed: true,
        detail: "Stage prerequisites already satisfied",
      });
      continue;
    }

    const pre = runWorkflowPreflight(slug);
    const expectedAction = STAGE_EXECUTION_ACTION[stageId] || null;

    steps.push({
      step: `${WORKFLOW_STAGE_DEFINITIONS[stageId].label} — preflight`,
      actionId: pre.actionId,
      currentStage: wf.currentStage,
      passed: pre.ok && pre.actionId === expectedAction && wf.currentStage === stageId,
      detail: `expected=${expectedAction} got=${pre.actionId} stage=${wf.currentStage}`,
    });

    if (!pre.ok || wf.currentStage !== stageId) continue;

    const outcome = await continueCustomerWorkflow(slug, user, body);
    wf = buildCustomerWorkflowState(slug, user)!;

    steps.push({
      step: `${WORKFLOW_STAGE_DEFINITIONS[stageId].label} — execute`,
      actionId: expectedAction,
      currentStage: wf.currentStage,
      passed: outcome.ok,
      detail: outcome.evidence,
    });
  }

  wf = buildCustomerWorkflowState(slug, user)!;
  const generatePreflight = runWorkflowPreflight(slug);
  steps.push({
    step: "Generate Ecosystem — stop point",
    actionId: generatePreflight.actionId,
    currentStage: wf.currentStage,
    passed: wf.currentStage === "generate_ecosystem" && generatePreflight.actionId === "generate_ecosystem",
    detail: wf.currentStage,
  });

  steps.push({
    step: "Workflow history recorded",
    actionId: null,
    currentStage: wf.currentStage,
    passed: wf.history.length > 0,
    detail: `${wf.history.length} transitions`,
  });
  steps.push({
    step: "Execution history recorded",
    actionId: null,
    currentStage: wf.currentStage,
    passed: wf.executions.length > 0,
    detail: `${wf.executions.length} executions`,
  });
  steps.push({
    step: "Completion updated",
    actionId: null,
    currentStage: wf.currentStage,
    passed: wf.completionPct >= 40,
    detail: `${wf.completionPct}%`,
  });
  steps.push({
    step: "Blocking validation",
    actionId: null,
    currentStage: wf.currentStage,
    passed: !runWorkflowPreflight("nonexistent-slug-xyz").ok,
    detail: "Invalid slug blocked",
  });

  return { slug, steps, passed: steps.every((s) => s.passed) };
}
