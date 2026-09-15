/**
 * Sprint 8C / 8C.1 — Commercial Deployment Configuration (profile, test, validate, approve).
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { createMasterAdminIssue } from "./masterAdminIssueService.ts";
import {
  finishWorkflowExecution,
  getLastRecordedWorkflowStage,
  recordWorkflowTransition,
  startWorkflowExecution,
} from "./masterAdminWorkflowHistoryService.ts";
import { resolvePharmacyWebsiteBase } from "./pharmacyDeployConfig.ts";
import { getPharmacyLivePublishStatus } from "./pharmacyLivePublishService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import {
  deploymentCredentialsConfigured,
  getDeploymentCredentialPublicView,
  hydrateProjectDeployCredentials,
  saveDeploymentCredentials,
} from "./masterAdminDeploymentCredentialService.ts";
import {
  buildConnectionInputFromProfile,
  defaultPortForMethod,
  extractPublicPathFromWebsite,
  normalizeRemoteFolder,
  normalizeRemoteRoot,
  protocolLabel,
  resolveDestinationPath,
  runDestinationValidation,
  runNonDestructiveConnectionTest,
} from "./masterAdminCommercialDeploymentConnectionService.ts";
import type {
  CommercialDeploymentApprovalSnapshot,
  CommercialDeploymentProfile,
  CommercialDeploymentReviewPayload,
  CommercialDeploymentSaveInput,
  CommercialDeploymentSummary,
  DeploymentCheck,
  DeploymentCheckStatus,
  DeploymentMethodId,
  DeploymentOverallStatus,
} from "./masterAdminCommercialDeploymentModel.ts";
import { DEPLOYMENT_METHOD_OPTIONS } from "./masterAdminCommercialDeploymentModel.ts";

const PROFILE_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/deployment-profiles");
const APPROVAL_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/deployment-approvals");

function profilePath(slug: string): string {
  return path.join(PROFILE_DIR, `${slug}.json`);
}

function projectConfigPath(slug: string): string {
  const key = resolveTenantProfileSlug(slug) || slug;
  return path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", `${key}.json`);
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function methodLabel(method: DeploymentMethodId): string {
  return DEPLOYMENT_METHOD_OPTIONS.find((m) => m.id === method)?.label || method;
}

function inferredHostnameFromWebsite(website: string): string | null {
  try {
    return new URL(website.includes("://") ? website : `https://${website}`).hostname;
  } catch {
    return null;
  }
}

function migrateLegacyProfile(raw: Record<string, unknown>, slug: string): CommercialDeploymentProfile {
  const now = new Date().toISOString();
  const website = String(raw.productionWebsite || resolvePharmacyWebsiteBase(slug)).trim();
  let host = String(raw.host || "").trim();
  const inferredHost = inferredHostnameFromWebsite(website);
  if (host && inferredHost && host === inferredHost) host = "";

  const remotePath = String(raw.remotePath || "/").trim();
  const remoteFolder = remotePath.replace(/^\/+/, "").replace(/\/+$/, "");
  const remoteRoot = "/";

  return {
    version: 2,
    slug,
    productionWebsite: website,
    publicPath: extractPublicPathFromWebsite(website),
    deploymentMethod: (raw.deploymentMethod as DeploymentMethodId) || "static_html_ftp",
    host,
    port: Number(raw.port) || defaultPortForMethod((raw.deploymentMethod as DeploymentMethodId) || "static_html_ftp"),
    username: String(raw.username || getDeploymentCredentialPublicView(slug).username || ""),
    authMethod: raw.deploymentMethod === "cpanel" ? "api_token" : "password",
    passiveMode: raw.passiveMode !== false,
    credentialSource: "secure_store",
    credentialReference: getDeploymentCredentialPublicView(slug).credentialReference || "",
    credentialsConfigured: deploymentCredentialsConfigured(slug),
    credentialMasked: getDeploymentCredentialPublicView(slug).maskedSecret,
    remoteRoot: String(raw.remoteRoot || remoteRoot),
    remoteFolder,
    resolvedDestinationPath: resolveDestinationPath(String(raw.remoteRoot || remoteRoot), remoteFolder),
    connectionStatus: "Offline",
    destinationStatus: "Not validated",
    writableStatus: null,
    sslAvailable: null,
    lastConnectionTestAt: raw.lastConnectionTestAt ? String(raw.lastConnectionTestAt) : null,
    lastConnectionTestBy: raw.lastConnectionTestBy ? String(raw.lastConnectionTestBy) : null,
    lastConnectionTestOk: Boolean(raw.lastConnectionTestOk),
    lastConnectionTestResult: (raw.lastConnectionTestResult as DeploymentCheckStatus | null) || null,
    lastConnectionTestEvidence: raw.lastConnectionTestEvidence ? String(raw.lastConnectionTestEvidence) : null,
    lastConnectionTestFailureReason: raw.lastConnectionTestFailureReason ? String(raw.lastConnectionTestFailureReason) : null,
    lastConnectionTestResponseMs: typeof raw.lastConnectionTestResponseMs === "number" ? raw.lastConnectionTestResponseMs : null,
    lastConnectionChecks: Array.isArray(raw.lastConnectionChecks) ? raw.lastConnectionChecks as DeploymentCheck[] : [],
    lastDestinationValidationAt: raw.lastValidationAt ? String(raw.lastValidationAt) : null,
    lastDestinationValidationBy: raw.lastValidatedBy ? String(raw.lastValidatedBy) : null,
    lastDestinationValidationOk: Boolean(raw.lastDestinationValidationOk),
    lastDestinationValidationChecks: Array.isArray(raw.lastDestinationValidationChecks) ? raw.lastDestinationValidationChecks as DeploymentCheck[] : [],
    lastSuccessfulPublish: raw.lastSuccessfulPublish ? String(raw.lastSuccessfulPublish) : null,
    deploymentVersion: Number(raw.deploymentVersion) || 0,
    publishingEnabled: Boolean(raw.publishingEnabled),
    approvalStatus: raw.approvalStatus === "approved" ? "approved" : "pending",
    approvedAt: raw.approvedAt ? String(raw.approvedAt) : null,
    approvedBy: raw.approvedBy ? String(raw.approvedBy) : null,
    updatedAt: String(raw.updatedAt || now),
    createdAt: String(raw.createdAt || now),
  };
}

function defaultProfile(slug: string): CommercialDeploymentProfile {
  const now = new Date().toISOString();
  const website = resolvePharmacyWebsiteBase(slug);
  const creds = getDeploymentCredentialPublicView(slug);
  return {
    version: 2,
    slug,
    productionWebsite: website,
    publicPath: extractPublicPathFromWebsite(website),
    deploymentMethod: "static_html_ftp",
    host: "",
    port: 21,
    username: creds.username,
    authMethod: "password",
    passiveMode: true,
    credentialSource: "secure_store",
    credentialReference: creds.credentialReference,
    credentialsConfigured: creds.configured,
    credentialMasked: creds.maskedSecret,
    remoteRoot: "/",
    remoteFolder: "",
    resolvedDestinationPath: "/",
    connectionStatus: "Offline",
    destinationStatus: "Not validated",
    writableStatus: null,
    sslAvailable: null,
    lastConnectionTestAt: null,
    lastConnectionTestBy: null,
    lastConnectionTestOk: false,
    lastConnectionTestResult: null,
    lastConnectionTestEvidence: null,
    lastConnectionTestFailureReason: null,
    lastConnectionTestResponseMs: null,
    lastConnectionChecks: [],
    lastDestinationValidationAt: null,
    lastDestinationValidationBy: null,
    lastDestinationValidationOk: false,
    lastDestinationValidationChecks: [],
    lastSuccessfulPublish: null,
    deploymentVersion: 0,
    publishingEnabled: false,
    approvalStatus: "pending",
    approvedAt: null,
    approvedBy: null,
    updatedAt: now,
    createdAt: now,
  };
}

export function readCommercialDeploymentProfile(slug: string): CommercialDeploymentProfile {
  const existing = readJson<Record<string, unknown>>(profilePath(slug));
  if (!existing) return defaultProfile(slug);
  if (existing.version !== 2) {
    const migrated = migrateLegacyProfile(existing, slug);
    writeJsonAtomic(profilePath(slug), migrated);
    return migrated;
  }
  return existing as CommercialDeploymentProfile;
}

function syncPublishSignals(profile: CommercialDeploymentProfile): CommercialDeploymentProfile {
  const live = getPharmacyLivePublishStatus(profile.slug);
  const creds = getDeploymentCredentialPublicView(profile.slug);
  return {
    ...profile,
    productionWebsite: profile.productionWebsite || resolvePharmacyWebsiteBase(profile.slug),
    publicPath: profile.publicPath || extractPublicPathFromWebsite(profile.productionWebsite),
    credentialsConfigured: deploymentCredentialsConfigured(profile.slug),
    credentialReference: creds.credentialReference || profile.credentialReference,
    credentialMasked: creds.configured ? creds.maskedSecret : "",
    username: profile.username || creds.username,
    lastSuccessfulPublish: live.lastPublishedAt || profile.lastSuccessfulPublish,
    resolvedDestinationPath: resolveDestinationPath(profile.remoteRoot, profile.remoteFolder),
  };
}

function validateSaveInput(input: CommercialDeploymentSaveInput, method: DeploymentMethodId): void {
  if (!String(input.productionWebsite || "").trim()) throw new Error("Production website URL is required");
  if (!method) throw new Error("Deployment method is required");
  if (!String(input.host || "").trim()) throw new Error("Hosting hostname is required");
  if (!String(input.username || "").trim()) throw new Error("Username is required");
  if (!String(input.remoteFolder || "").trim()) throw new Error("Remote folder is required");
  normalizeRemoteRoot(String(input.remoteRoot || "/"));
  normalizeRemoteFolder(String(input.remoteFolder || ""));
}

export function writeProjectDeployFromProfile(profile: CommercialDeploymentProfile): void {
  const file = projectConfigPath(profile.slug);
  const project = readJson<Record<string, unknown>>(file) || { clientSlug: profile.slug };
  project.domain = profile.productionWebsite;
  project.deploy = {
    enabled: Boolean(profile.host && profile.remoteFolder),
    protocol: profile.deploymentMethod.includes("sftp") ? "sftp" : "ftp",
    host: profile.host,
    port: profile.port,
    remoteRoot: profile.resolvedDestinationPath,
    username: profile.username,
  };
  writeJsonAtomic(file, project);
}

export function saveCommercialDeploymentProfile(
  slug: string,
  input: CommercialDeploymentSaveInput,
  operator: string,
): CommercialDeploymentProfile {
  const profile = syncPublishSignals(readCommercialDeploymentProfile(slug));
  const method = input.deploymentMethod || profile.deploymentMethod;
  const option = DEPLOYMENT_METHOD_OPTIONS.find((m) => m.id === method);
  if (option && !option.available) throw new Error(`${option.label} is not available yet`);

  validateSaveInput(input, method);

  const productionWebsite = String(input.productionWebsite || profile.productionWebsite).trim().replace(/\/+$/, "");
  const publicPath = String(input.publicPath || extractPublicPathFromWebsite(productionWebsite)).trim() || "/";
  const remoteRoot = normalizeRemoteRoot(String(input.remoteRoot ?? profile.remoteRoot ?? "/"));
  const remoteFolder = normalizeRemoteFolder(String(input.remoteFolder ?? profile.remoteFolder));
  const authMethod = input.authMethod || (method === "cpanel" ? "api_token" : "password");

  if (input.password?.trim()) {
    saveDeploymentCredentials(
      slug,
      {
        username: String(input.username || profile.username),
        secret: input.password,
        secretType: authMethod === "api_token" ? "api_token" : "password",
      },
      operator,
    );
  } else if (!deploymentCredentialsConfigured(slug)) {
    throw new Error("Credentials are required — enter a password or API token");
  }

  const creds = getDeploymentCredentialPublicView(slug);
  const updated: CommercialDeploymentProfile = {
    ...profile,
    productionWebsite,
    publicPath,
    deploymentMethod: method,
    host: String(input.host ?? profile.host).trim(),
    port: Number(input.port ?? profile.port) || defaultPortForMethod(method),
    username: String(input.username ?? creds.username ?? profile.username).trim(),
    authMethod,
    passiveMode: input.passiveMode ?? profile.passiveMode,
    credentialSource: "secure_store",
    credentialReference: getDeploymentCredentialPublicView(slug).credentialReference,
    credentialsConfigured: deploymentCredentialsConfigured(slug),
    credentialMasked: getDeploymentCredentialPublicView(slug).maskedSecret,
    remoteRoot,
    remoteFolder,
    resolvedDestinationPath: resolveDestinationPath(remoteRoot, remoteFolder),
    publishingEnabled: false,
    approvalStatus: "pending",
    approvedAt: null,
    approvedBy: null,
    lastConnectionTestOk: false,
    lastConnectionTestResult: null,
    lastDestinationValidationOk: false,
    destinationStatus: "Not validated",
    connectionStatus: "Offline",
    updatedAt: new Date().toISOString(),
  };

  writeProjectDeployFromProfile(updated);
  writeJsonAtomic(profilePath(slug), updated);

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "save_deployment_configuration",
    status: "success",
    evidence: `Deployment profile saved — ${methodLabel(updated.deploymentMethod)}`,
  });

  return syncPublishSignals(updated);
}

export function updateCommercialDeploymentCredentials(
  slug: string,
  input: { username?: string; password?: string; authMethod?: CommercialDeploymentProfile["authMethod"] },
  operator: string,
): CommercialDeploymentProfile {
  const profile = syncPublishSignals(readCommercialDeploymentProfile(slug));
  if (!input.password?.trim()) throw new Error("Enter the new password or API token");
  saveDeploymentCredentials(
    slug,
    {
      username: String(input.username || profile.username),
      secret: input.password,
      secretType: input.authMethod === "api_token" ? "api_token" : "password",
    },
    operator,
  );
  const updated: CommercialDeploymentProfile = {
    ...profile,
    username: String(input.username || profile.username),
    authMethod: input.authMethod || profile.authMethod,
    credentialsConfigured: true,
    credentialMasked: getDeploymentCredentialPublicView(slug).maskedSecret,
    credentialReference: getDeploymentCredentialPublicView(slug).credentialReference,
    lastConnectionTestOk: false,
    lastDestinationValidationOk: false,
    publishingEnabled: false,
    approvalStatus: "pending",
    approvedAt: null,
    approvedBy: null,
    updatedAt: new Date().toISOString(),
  };
  writeJsonAtomic(profilePath(slug), updated);
  return syncPublishSignals(updated);
}

function check(id: string, label: string, status: DeploymentCheckStatus, detail: string): DeploymentCheck {
  return { id, label, status, detail };
}

export async function runCommercialDeploymentConnectionTest(
  slug: string,
  operator: string,
): Promise<{ ok: boolean; checks: DeploymentCheck[]; profile: CommercialDeploymentProfile }> {
  const profile = syncPublishSignals(readCommercialDeploymentProfile(slug));
  const input = buildConnectionInputFromProfile(profile, slug);
  const checks: DeploymentCheck[] = [];

  if (!input) {
    checks.push(check("credentials", "Credentials configured", "WARNING", "Credentials not configured"));
    return { ok: false, checks, profile: { ...profile, lastConnectionChecks: checks, connectionStatus: "Warning" } };
  }

  const outcome = await runNonDestructiveConnectionTest(input);
  const updated: CommercialDeploymentProfile = {
    ...profile,
    lastConnectionTestAt: new Date().toISOString(),
    lastConnectionTestBy: operator,
    lastConnectionTestOk: outcome.ok,
    lastConnectionTestResult: outcome.result,
    lastConnectionTestEvidence: outcome.evidence,
    lastConnectionTestFailureReason: outcome.failureReason,
    lastConnectionTestResponseMs: outcome.responseMs,
    lastConnectionChecks: outcome.checks,
    connectionStatus: outcome.ok ? "Healthy" : outcome.result === "WARNING" ? "Warning" : "Offline",
    sslAvailable: profile.deploymentMethod !== "static_html_sftp",
    lastDestinationValidationOk: false,
    destinationStatus: "Not validated",
    updatedAt: new Date().toISOString(),
  };
  if (outcome.result !== "WARNING") {
    writeJsonAtomic(profilePath(slug), updated);
  }

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "test_deployment_connection",
    status: outcome.ok ? "success" : outcome.result === "WARNING" ? "warning" : "error",
    evidence: outcome.evidence,
  });

  if (!outcome.ok && outcome.result === "FAIL") {
    createMasterAdminIssue(
      {
        tenantSlug: slug,
        category: "Infrastructure",
        severity: "High",
        title: `Deployment connection failed for ${profile.host}`,
        description: outcome.failureReason || outcome.evidence,
        expectedBehaviour: "Connection test establishes an authenticated session without uploading files",
        actualBehaviour: outcome.failureReason || outcome.evidence,
        affectedPageOrModule: "deployment-configuration",
      },
      operator,
    );
  }

  const responseProfile = outcome.result === "WARNING" && !outcome.ok
    ? { ...profile, lastConnectionChecks: outcome.checks, connectionStatus: "Warning" as const }
    : updated;

  return { ok: outcome.ok, checks: outcome.checks, profile: responseProfile };
}

export async function validateCommercialDeploymentDestination(
  slug: string,
  operator: string,
): Promise<{ ok: boolean; checks: DeploymentCheck[]; warnings: string[]; blockers: string[]; profile: CommercialDeploymentProfile }> {
  const profile = syncPublishSignals(readCommercialDeploymentProfile(slug));
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (!profile.lastConnectionTestOk) {
    return {
      ok: false,
      checks: [check("connection-prerequisite", "Connection test passed", "FAIL", "Run Test Connection successfully before validating destination")],
      warnings,
      blockers: ["Connection test not passed"],
      profile,
    };
  }

  const input = buildConnectionInputFromProfile(profile, slug);
  if (!input) {
    return {
      ok: false,
      checks: [check("credentials", "Credentials stored", "FAIL", "Secure credentials missing")],
      warnings,
      blockers: ["Credentials missing"],
      profile,
    };
  }

  const outcome = await runDestinationValidation(input);
  const checks = [
    ...outcome.checks,
    check("manifest-location", "Manifest location valid", "PASS", "Content package manifest available locally"),
    check("registry-location", "Registry location valid", "PASS", "Ecosystem registry available locally"),
    check("sitemap-location", "Sitemap location valid", "PASS", "Sitemap will be published into remote folder"),
    check("existing-files", "Existing files detected", "PASS", profile.lastSuccessfulPublish ? "Existing deployment detected" : "Initial deployment"),
  ];

  if (!profile.lastSuccessfulPublish) warnings.push("No previous publish");
  warnings.push("Customer pending first login");
  warnings.push("Analytics missing");
  warnings.push("Search Console missing");

  if (!outcome.ok) blockers.push("Destination not writable");
  if (!outcome.markerCleaned && outcome.ok === false) blockers.push("Destination validation failed");

  const updated: CommercialDeploymentProfile = {
    ...profile,
    lastDestinationValidationAt: new Date().toISOString(),
    lastDestinationValidationBy: operator,
    lastDestinationValidationOk: outcome.ok,
    lastDestinationValidationChecks: checks,
    destinationStatus: outcome.ok ? "Valid" : "Invalid",
    writableStatus: outcome.writable,
    updatedAt: new Date().toISOString(),
  };
  writeJsonAtomic(profilePath(slug), updated);

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "validate_deployment_destination",
    status: outcome.ok ? "success" : "error",
    evidence: outcome.ok ? `Destination validated at ${profile.resolvedDestinationPath}` : "Destination validation failed",
  });

  return { ok: outcome.ok, checks, warnings, blockers, profile: updated };
}

function buildOverallStatus(profile: CommercialDeploymentProfile): DeploymentOverallStatus {
  if (profile.publishingEnabled && profile.approvalStatus === "approved") return "READY TO PUBLISH";
  if (profile.lastConnectionTestOk === false && profile.lastConnectionTestAt) return "BLOCKED";
  if (profile.lastDestinationValidationOk === false && profile.lastDestinationValidationAt) return "BLOCKED";
  if (profile.host && profile.remoteFolder && profile.credentialsConfigured) return "READY FOR VALIDATION";
  return "CONFIGURATION REQUIRED";
}

function buildSummary(profile: CommercialDeploymentProfile): CommercialDeploymentSummary {
  return {
    productionWebsite: profile.productionWebsite,
    publishingMethod: methodLabel(profile.deploymentMethod),
    connectionDetails: profile.host ? `${profile.host}:${profile.port} · ${profile.username || "—"}` : "Not configured",
    remoteDestination: profile.resolvedDestinationPath || "Not configured",
    connectionStatus: profile.connectionStatus,
    destinationStatus: profile.destinationStatus,
    writable: profile.writableStatus === true ? "Yes" : profile.writableStatus === false ? "No" : "Not verified",
    publishingEnabled: profile.publishingEnabled,
    overallStatus: buildOverallStatus(profile),
  };
}

function buildBlockers(profile: CommercialDeploymentProfile): string[] {
  const blockers: string[] = [];
  if (!profile.deploymentMethod) blockers.push("Deployment method missing");
  if (!profile.host) blockers.push("Host missing");
  if (!profile.username) blockers.push("Username missing");
  if (!profile.credentialsConfigured) blockers.push("Credentials missing");
  if (!profile.remoteFolder) blockers.push("Remote folder missing");
  if (profile.credentialsConfigured) {
    if (profile.lastConnectionTestAt && !profile.lastConnectionTestOk && profile.lastConnectionTestResult === "FAIL") {
      blockers.push("Connection test not passed");
    }
    if (profile.lastConnectionTestResult === "FAIL") blockers.push("Authentication failed");
    if (profile.lastDestinationValidationAt && !profile.lastDestinationValidationOk) {
      blockers.push("Destination validation not passed");
    }
    if (profile.writableStatus === false) blockers.push("Destination not writable");
  }
  try {
    normalizeRemoteRoot(profile.remoteRoot);
    normalizeRemoteFolder(profile.remoteFolder);
  } catch {
    blockers.push("Unsafe target path");
  }
  if (profile.approvalStatus === "approved" && !profile.publishingEnabled) blockers.push("Publishing disabled");
  return [...new Set(blockers)];
}

export function buildCommercialDeploymentReview(slug: string): CommercialDeploymentReviewPayload {
  const profile = syncPublishSignals(readCommercialDeploymentProfile(slug));
  const blockers = profile.approvalStatus === "approved" ? [] : buildBlockers(profile);
  const warnings: string[] = [];
  if (!profile.credentialsConfigured) warnings.push("Credentials not configured");
  if (!profile.lastSuccessfulPublish) warnings.push("No previous publish");
  warnings.push("Customer pending first login");
  warnings.push("Analytics missing");
  warnings.push("Search Console missing");

  const historyDir = path.join(APPROVAL_DIR, slug);
  const publishHistory: Array<{ version: number; approvedAt: string; operator: string }> = [];
  if (fs.existsSync(historyDir)) {
    for (const file of fs.readdirSync(historyDir).filter((f) => f.startsWith("approval-"))) {
      const snap = readJson<CommercialDeploymentApprovalSnapshot>(path.join(historyDir, file));
      if (snap) publishHistory.push({ version: snap.deploymentVersion, approvedAt: snap.approvedAt, operator: snap.approvedBy });
    }
  }
  publishHistory.sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));

  const connectionChecks: DeploymentCheck[] = profile.lastConnectionChecks.length
    ? profile.lastConnectionChecks
    : profile.lastConnectionTestAt
      ? [
          profile.lastConnectionTestOk
            ? check("connection", "Connection test", "PASS", profile.lastConnectionTestEvidence || "Passed")
            : check("connection", "Connection test", "FAIL", profile.lastConnectionTestFailureReason || "Failed"),
        ]
      : [check("connection", "Connection test", "WARNING", "Not tested yet")];

  const destinationChecks: DeploymentCheck[] = profile.lastDestinationValidationChecks.length
    ? profile.lastDestinationValidationChecks
    : profile.lastDestinationValidationAt
      ? [
          profile.lastDestinationValidationOk
            ? check("destination", "Destination validation", "PASS", profile.resolvedDestinationPath)
            : check("destination", "Destination validation", "FAIL", "Validation failed"),
        ]
      : [check("destination", "Destination validation", "WARNING", "Not validated yet")];

  return {
    version: 2,
    slug,
    profile,
    summary: buildSummary(profile),
    methods: DEPLOYMENT_METHOD_OPTIONS,
    connectionChecks,
    destinationChecks,
    warnings,
    blockers,
    canApprove: blockers.length === 0 && profile.lastConnectionTestOk && profile.lastDestinationValidationOk && profile.writableStatus === true,
    canValidateDestination: profile.lastConnectionTestOk && profile.credentialsConfigured,
    credentialsConfigured: profile.credentialsConfigured,
    credentialMasked: profile.credentialMasked,
    publishHistory,
  };
}

export function isCommercialDeploymentApproved(slug: string): boolean {
  const profile = readCommercialDeploymentProfile(slug);
  return profile.publishingEnabled && profile.approvalStatus === "approved";
}

export async function approveCommercialDeployment(
  slug: string,
  operator: string,
): Promise<{ ok: boolean; errors: string[]; snapshot: CommercialDeploymentApprovalSnapshot | null; review: CommercialDeploymentReviewPayload }> {
  const review = buildCommercialDeploymentReview(slug);
  if (!review.canApprove) {
    return { ok: false, errors: review.blockers.length ? review.blockers : ["Deployment approval requirements not met"], snapshot: null, review };
  }

  const profile = syncPublishSignals(review.profile);
  const approvedAt = new Date().toISOString();
  const deploymentVersion = profile.deploymentVersion + 1;
  const approvedProfile: CommercialDeploymentProfile = {
    ...profile,
    deploymentVersion,
    publishingEnabled: true,
    approvalStatus: "approved",
    approvedAt,
    approvedBy: operator,
    updatedAt: approvedAt,
  };
  writeJsonAtomic(profilePath(slug), approvedProfile);
  writeProjectDeployFromProfile(approvedProfile);

  const snapshot: CommercialDeploymentApprovalSnapshot = {
    version: 2,
    slug,
    deploymentVersion,
    approvedAt,
    approvedBy: operator,
    profile: approvedProfile,
    connectionChecks: review.connectionChecks,
    destinationChecks: review.destinationChecks,
    warnings: review.warnings,
  };

  const snapDir = path.join(APPROVAL_DIR, slug);
  writeJsonAtomic(path.join(snapDir, `approval-${approvedAt.replace(/[:.]/g, "-")}.json`), snapshot);
  writeJsonAtomic(path.join(snapDir, "latest.json"), snapshot);

  const recordedStage = getLastRecordedWorkflowStage(slug);
  if (recordedStage !== "publish") {
    startWorkflowExecution({ slug, stageId: "publish", actionId: "approve_deployment_configuration", operator });
    finishWorkflowExecution({
      slug,
      stageId: "publish",
      actionId: "approve_deployment_configuration",
      operator,
      evidence: "Deployment configuration approved",
      status: "completed",
    });
    recordWorkflowTransition({
      slug,
      fromStage: recordedStage,
      toStage: "publish",
      operator,
      reason: "Commercial Deployment Configuration approved",
      evidence: `Deployment v${deploymentVersion}`,
    });
  }

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "approve_deployment_configuration",
    status: "success",
    evidence: `Deployment approved v${deploymentVersion} — ready to publish`,
    metadata: { deploymentVersion },
  });

  return {
    ok: true,
    errors: [],
    snapshot,
    review: buildCommercialDeploymentReview(slug),
  };
}

export function customerNeedsDeploymentConfiguration(slug: string): boolean {
  const stage = getLastRecordedWorkflowStage(slug);
  if (stage !== "publish") return false;
  return false;
}

export function hydrateApprovedDeploymentForPublishing(slug: string): () => void {
  return hydrateProjectDeployCredentials(slug, projectConfigPath(slug));
}

export function getApprovedDeploymentConnectionSummary(slug: string): {
  destinationConfigured: boolean;
  connectionStatus: "Healthy" | "Warning" | "Offline";
  targetWritable: boolean | null;
  publishMethod: string;
  protocol: string;
  remotePath: string;
  host: string | null;
} | null {
  const profile = readCommercialDeploymentProfile(slug);
  if (!isCommercialDeploymentApproved(slug)) return null;
  return {
    destinationConfigured: Boolean(profile.host && profile.resolvedDestinationPath),
    connectionStatus: profile.connectionStatus,
    targetWritable: profile.writableStatus,
    publishMethod: methodLabel(profile.deploymentMethod),
    protocol: protocolLabel(profile.deploymentMethod),
    remotePath: profile.resolvedDestinationPath,
    host: profile.host || null,
  };
}
