/**
 * Sprint 7A Defect 036 — customer account visibility validation.
 */
import fs from "node:fs";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { createCommercialPharmacyCustomer } from "./masterAdminCommercialOnboardingService.ts";
import { getCustomerAccountDetail } from "./masterAdminAccountService.ts";
import { buildMasterAdminCustomerRecord } from "./masterAdminPlatformService.ts";
import { resolveWorkflowStage } from "./masterAdminWorkflowStageExecutor.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";

const VALIDATION_SLUG = "sprint-7a-defect-036-account-validation";
const VALIDATION_NAME = "Sprint 7A Defect 036 Account Validation";

export async function runAccountVisibilityValidation(operator: string): Promise<{
  slug: string;
  trace: ReturnType<typeof getCustomerAccountDetail>;
  passed: boolean;
  checks: Array<{ label: string; passed: boolean; detail: string }>;
}> {
  if (fs.existsSync(profilePath(VALIDATION_SLUG))) {
    throw new Error(`Validation slug already exists: ${VALIDATION_SLUG}. Remove manually before re-run.`);
  }

  const created = await createCommercialPharmacyCustomer(
    {
      pharmacyName: VALIDATION_NAME,
      website: "https://defect-036-validation.example.uk",
      contactEmail: "defect036@example.uk",
      phone: "0114 800 0036",
      accountManager: "DHM Digital",
      notes: "Sprint 7A Defect 036 account visibility validation",
    },
    operator,
  );

  const trace = getCustomerAccountDetail(created.slug);
  const record = buildMasterAdminCustomerRecord(created.slug);
  const ctx = loadMasterAdminCustomerContext(created.slug);
  const stage = ctx ? resolveWorkflowStage(ctx) : null;

  const checks = [
    {
      label: "Customer account created",
      passed: trace.hasAccount,
      detail: trace.username || "missing",
    },
    {
      label: "Credentials visible (temp password)",
      passed: Boolean(trace.temporaryPassword),
      detail: trace.temporaryPassword ? "present" : "missing",
    },
    {
      label: "Dashboard URL generated",
      passed: Boolean(trace.dashboardUrl && trace.dashboardUrl.includes(created.slug)),
      detail: trace.dashboardUrl,
    },
    {
      label: "Welcome email draft generated",
      passed: Boolean(trace.welcomeEmailDraft),
      detail: trace.welcomeEmailDraft ? "prepared" : "missing",
    },
    {
      label: "Password reset token issued",
      passed: Boolean(trace.passwordResetToken),
      detail: trace.passwordResetToken ? "present" : "missing",
    },
    {
      label: "Customer record exposes customerAccount",
      passed: Boolean(record?.customerAccount?.hasAccount),
      detail: record?.customerAccount?.username || "missing",
    },
    {
      label: "Workflow at website_import (unchanged)",
      passed: stage === "website_import",
      detail: stage || "unknown",
    },
  ];

  console.log("DEFECT 036 TRACE", JSON.stringify(trace, null, 2));

  return {
    slug: created.slug,
    trace,
    passed: checks.every((c) => c.passed),
    checks,
  };
}
