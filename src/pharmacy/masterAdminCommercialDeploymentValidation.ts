/**
 * Sprint 8C.1 — Commercial Deployment Configuration structural validation.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { buildMasterAdminCustomerRecord } from "./masterAdminPlatformService.ts";
import { getLastRecordedWorkflowStage } from "./masterAdminWorkflowHistoryService.ts";
import { listMasterAdminJobs } from "./masterAdminJobService.ts";
import { deploymentCredentialsConfigured, readDeploymentCredentialRecord } from "./masterAdminDeploymentCredentialService.ts";
import {
  buildCommercialDeploymentReview,
  readCommercialDeploymentProfile,
} from "./masterAdminCommercialDeploymentService.ts";
import { DEPLOYMENT_METHOD_FIELDS } from "./masterAdminCommercialDeploymentModel.ts";
import { inferredHostnameFromWebsite } from "./masterAdminCommercialDeploymentValidationHelpers.ts";

const BANNER_CROSS_SLUG = "banner-cross-pharmacy";

export interface CommercialDeploymentValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  evidence: string;
}

export interface CommercialDeploymentValidationResult {
  slug: string;
  passed: boolean;
  passCount: number;
  totalChecks: number;
  checks: CommercialDeploymentValidationCheck[];
  reviewUrl: string;
  summary: ReturnType<typeof buildCommercialDeploymentReview>["summary"];
  profile: ReturnType<typeof readCommercialDeploymentProfile>;
  warnings: string[];
  blockers: string[];
  notPublished: boolean;
}

export async function runCommercialDeploymentValidation(
  _operator: string,
): Promise<CommercialDeploymentValidationResult> {
  const slug = BANNER_CROSS_SLUG;
  const checks: CommercialDeploymentValidationCheck[] = [];
  const review = buildCommercialDeploymentReview(slug);
  const profile = readCommercialDeploymentProfile(slug);
  const profilePath = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/deployment-profiles", `${slug}.json`);
  const secretPath = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/deployment-credentials", `${slug}.secrets.json`);
  const customer = buildMasterAdminCustomerRecord(slug);
  const publishJobs = listMasterAdminJobs({ slug, limit: 20 }).filter((j) => j.action === "publish");
  const secretRecord = readDeploymentCredentialRecord(slug);
  const inferredHost = inferredHostnameFromWebsite(profile.productionWebsite);

  checks.push({
    id: "public_website_separated",
    label: "Public website separated from hosting server",
    passed: Boolean(profile.productionWebsite) && profile.host !== inferredHost,
    evidence: `website=${profile.productionWebsite} host=${profile.host || "empty"}`,
  });
  checks.push({
    id: "deployment_methods",
    label: "Deployment methods",
    passed: review.methods.some((m) => m.available) && review.methods.filter((m) => !m.available).length >= 3,
    evidence: review.methods.map((m) => `${m.id}:${m.available ? "on" : "off"}`).join(", "),
  });
  checks.push({
    id: "ftp_fields",
    label: "FTP fields",
    passed: DEPLOYMENT_METHOD_FIELDS.static_html_ftp.some((f) => f.id === "host") && DEPLOYMENT_METHOD_FIELDS.static_html_ftp.some((f) => f.id === "remoteFolder"),
    evidence: DEPLOYMENT_METHOD_FIELDS.static_html_ftp.map((f) => f.id).join(", "),
  });
  checks.push({
    id: "sftp_fields",
    label: "SFTP fields",
    passed: DEPLOYMENT_METHOD_FIELDS.static_html_sftp.some((f) => f.id === "port") && DEPLOYMENT_METHOD_FIELDS.static_html_sftp.some((f) => f.id === "password"),
    evidence: DEPLOYMENT_METHOD_FIELDS.static_html_sftp.map((f) => f.id).join(", "),
  });
  checks.push({
    id: "cpanel_fields",
    label: "cPanel fields",
    passed: DEPLOYMENT_METHOD_FIELDS.cpanel.some((f) => f.id === "host") && DEPLOYMENT_METHOD_FIELDS.cpanel.some((f) => f.id === "remoteFolder"),
    evidence: DEPLOYMENT_METHOD_FIELDS.cpanel.map((f) => f.id).join(", "),
  });
  checks.push({
    id: "secure_credential_storage",
    label: "Secure credential storage",
    passed: fs.existsSync(secretPath) ? Boolean(secretRecord?.secret?.ciphertext && !secretRecord.secret.ciphertext.includes("password")) : !deploymentCredentialsConfigured(slug),
    evidence: fs.existsSync(secretPath) ? "encrypted secrets file present" : "awaiting PO credentials",
  });
  checks.push({
    id: "secrets_not_in_profile",
    label: "Secrets not stored in deployment profile JSON",
    passed: !("password" in profile) && !("secret" in profile) && !JSON.stringify(profile).includes("ciphertext"),
    evidence: "profile contains references only",
  });
  checks.push({
    id: "approval_blocked_without_validation",
    label: "Approval blocked until real validation passes",
    passed: review.canApprove === false,
    evidence: `canApprove=${review.canApprove}`,
  });
  checks.push({
    id: "publish_review_integration",
    label: "Publish Review consumes approved deployment profile",
    passed: typeof customer?.deploymentConfiguration?.approved === "boolean",
    evidence: `approved=${customer?.deploymentConfiguration?.approved}`,
  });
  checks.push({
    id: "not_published",
    label: "Banner Cross not published",
    passed: publishJobs.every((j) => j.status !== "completed") && !profile.lastSuccessfulPublish,
    evidence: `${publishJobs.length} publish job(s)`,
  });
  checks.push({
    id: "workflow_publish_stage",
    label: "Workflow at Publish stage",
    passed: getLastRecordedWorkflowStage(slug) === "publish",
    evidence: getLastRecordedWorkflowStage(slug),
  });

  const passCount = checks.filter((c) => c.passed).length;
  return {
    slug,
    passed: passCount === checks.length,
    passCount,
    totalChecks: checks.length,
    checks,
    reviewUrl: `/api/admin/master?customer=${encodeURIComponent(slug)}&panel=deployment-configuration`,
    summary: review.summary,
    profile,
    warnings: review.warnings,
    blockers: review.blockers,
    notPublished: !profile.lastSuccessfulPublish,
  };
}
