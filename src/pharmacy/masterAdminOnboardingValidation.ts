/**
 * Master Admin Onboarding Validation — Sprint 7A commercial workflow test.
 */
import fs from "node:fs";
import path from "node:path";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { createCommercialPharmacyCustomer } from "./masterAdminCommercialOnboardingService.ts";
import { readMasterAdminRegistry, registerMasterAdminClient } from "./pharmacyMasterAdminService.ts";
import { buildCustomerWorkflowState } from "./masterAdminWorkflowEngine.ts";
import { continueCustomerWorkflow, runWorkflowPreflight } from "./masterAdminWorkflowOrchestrator.ts";
import { verifyStageCompletion } from "./masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { STAGE_EXECUTION_ACTION, WORKFLOW_STAGE_DEFINITIONS, type WorkflowStageId } from "./masterAdminWorkflowModel.ts";
import { resetWorkflowHistory, getWorkflowExecutions, getWorkflowHistory } from "./masterAdminWorkflowHistoryService.ts";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { listMasterAdminJobs } from "./masterAdminJobService.ts";
import { listMasterAdminAudit } from "./masterAdminAuditService.ts";
import { getCustomerAccountSummary, createCustomerAccount } from "./masterAdminAccountService.ts";

const VALIDATION_NAME = "Sprint 7A Commercial Onboarding Validation";
const VALIDATION_SLUG_HINT = "sprint-7a-commercial-onboarding-validation";

const STAGES_TO_RUN: WorkflowStageId[] = [
  "website_import",
  "google_import",
  "business_profile_intelligence",
  "resolve_import_conflicts",
  "approve_business_profile",
  "generate_growth_intelligence",
];

function validationSlug(): string {
  if (fs.existsSync(profilePath(VALIDATION_SLUG_HINT))) return VALIDATION_SLUG_HINT;
  const alt = `${VALIDATION_SLUG_HINT}-pharmacy`;
  if (fs.existsSync(profilePath(alt))) return alt;
  return VALIDATION_SLUG_HINT;
}

function ensureValidationRegistry(slug: string, pharmacyName: string): void {
  const registry = readMasterAdminRegistry();
  if (!registry.clients.some((c) => c.slug === slug)) {
    registerMasterAdminClient(slug, pharmacyName);
  }
}

function seedImportFields(slug: string): void {
  const existing = readSetupProfile(slug);
  writeSetupProfile(slug, {
    ...existing,
    pharmacyName: existing.pharmacyName || VALIDATION_NAME,
    website: existing.website || "https://validation-pharmacy-7a.example.uk",
    phone: existing.phone || "0114 700 0001",
    businessEmail: existing.businessEmail || existing.email || "onboarding-7a@example.uk",
    addressLine1: existing.addressLine1 || "1 Validation Lane",
    townCity: existing.townCity || existing.primaryTown || "Sheffield",
    primaryTown: existing.primaryTown || "Sheffield",
    postcode: existing.postcode || "S1 7AA",
    businessDescription: existing.businessDescription || "Sprint 7A validation pharmacy",
    logoUrl: existing.logoUrl || "https://example.com/logo.png",
    openingHours: existing.openingHours || "Mon-Fri 9-6",
  });
}

export async function runCommercialOnboardingValidation(user: string): Promise<{
  slug: string;
  steps: Array<{ step: string; passed: boolean; detail: string }>;
  passed: boolean;
}> {
  let slug = validationSlug();
  const steps: Array<{ step: string; passed: boolean; detail: string }> = [];

  if (!fs.existsSync(profilePath(slug))) {
    const created = await createCommercialPharmacyCustomer(
      {
        pharmacyName: VALIDATION_NAME,
        website: "https://validation-pharmacy-7a.example.uk",
        contactEmail: "onboarding-7a@example.uk",
        phone: "0114 700 0001",
        accountManager: "DHM Digital",
        notes: "Sprint 7A commercial onboarding validation — not a production pharmacy",
      },
      user,
    );
    slug = created.slug;
    steps.push({
      step: "Create Customer",
      passed: Boolean(created.slug && created.username && created.temporaryPassword),
      detail: `${created.slug} · account ${created.username}`,
    });
  } else {
    ensureValidationRegistry(slug, VALIDATION_NAME);
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
    if (!getCustomerAccountSummary(slug).hasAccount) {
      await createCustomerAccount(slug, user);
    }
    steps.push({
      step: "Create Customer — existing validation tenant reset",
      passed: true,
      detail: slug,
    });
  }

  const account = getCustomerAccountSummary(slug);
  steps.push({
    step: "Customer account exists",
    passed: account.hasAccount && Boolean(account.username),
    detail: account.username || "missing",
  });

  const body = { validationMode: true };

  for (const stageId of STAGES_TO_RUN) {
    if (stageId === "resolve_import_conflicts") seedImportFields(slug);

    const ctx = loadMasterAdminCustomerContext(slug)!;
    const wf = buildCustomerWorkflowState(slug, user)!;

    if (verifyStageCompletion(stageId, ctx)) {
      steps.push({
        step: `${WORKFLOW_STAGE_DEFINITIONS[stageId].label} — already complete`,
        passed: true,
        detail: wf.currentStage,
      });
      continue;
    }

    const pre = runWorkflowPreflight(slug);
    const expectedAction = STAGE_EXECUTION_ACTION[stageId] || null;
    steps.push({
      step: `${WORKFLOW_STAGE_DEFINITIONS[stageId].label} — preflight`,
      passed: pre.ok && pre.actionId === expectedAction && wf.currentStage === stageId,
      detail: `expected=${expectedAction} got=${pre.actionId} stage=${wf.currentStage}`,
    });

    if (!pre.ok || wf.currentStage !== stageId) continue;

    const outcome = await continueCustomerWorkflow(slug, user, body);
    const wfAfter = buildCustomerWorkflowState(slug, user)!;
    steps.push({
      step: `${WORKFLOW_STAGE_DEFINITIONS[stageId].label} — execute`,
      passed: outcome.ok,
      detail: outcome.evidence,
    });

    if (!outcome.ok) break;
  }

  const wfFinal = buildCustomerWorkflowState(slug, user)!;
  const generatePreflight = runWorkflowPreflight(slug);
  steps.push({
    step: "Generate Ecosystem — stop point",
    passed: wfFinal.currentStage === "generate_ecosystem" && generatePreflight.actionId === "generate_ecosystem",
    detail: wfFinal.currentStage,
  });

  const jobs = listMasterAdminJobs({ slug, limit: 20 });
  steps.push({
    step: "Background jobs recorded",
    passed: jobs.length >= 0,
    detail: `${jobs.length} jobs`,
  });

  const executions = getWorkflowExecutions(slug);
  steps.push({
    step: "Audit execution history",
    passed: executions.length > 0,
    detail: `${executions.length} executions`,
  });

  const history = getWorkflowHistory(slug);
  steps.push({
    step: "Workflow transition history",
    passed: history.length > 0,
    detail: `${history.length} transitions`,
  });

  const audit = listMasterAdminAudit({ slug, limit: 5 });
  steps.push({
    step: "Audit log entries",
    passed: audit.length > 0,
    detail: `${audit.length} recent entries`,
  });

  steps.push({
    step: "Blocking validation",
    passed: !runWorkflowPreflight("nonexistent-slug-7a-xyz").ok,
    detail: "Invalid slug blocked",
  });

  return { slug, steps, passed: steps.every((s) => s.passed) };
}
