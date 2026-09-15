/**
 * PharmaConnect atomic workspace provisioning — verify, rollback, and canonical paths.
 */
import fs from "node:fs";
import path from "node:path";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import {
  emptyAssignmentsDoc,
  saveImageAssignments,
  uploadDir,
} from "./pharmacyImageOperatingSystem.ts";
import {
  loadPharmacyPublishingSettings,
  saveServicePublishingSettings,
} from "./pharmacyPublishingSettingsService.ts";
import { refreshPlatformAfterEnhancementComplete } from "./pharmacyEnhancementWorkspaceService.ts";
import { refreshPharmacyVisibility } from "./pharmacyVisibilityBridgeService.ts";
import { writeGrowthJourneyDashboardJson } from "./pharmacyGrowthJourneyService.ts";
import { loadEnhancementWorkspaceStore } from "./pharmacyEnhancementWorkspaceService.ts";
import type { PharmacyRegistry } from "./pharmacyIndexingBridgeService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { readPharmacyCampaignStore } from "./pharmacyCampaignService.ts";
import { loadPharmacyAuthorityReadiness } from "./pharmacyAuthorityReadinessService.ts";
import { buildPharmacyPlatformDashboard } from "./pharmacyPlatformDashboardService.ts";
import {
  ensureDir,
  getAllRequiredPharmacyWorkspacePaths,
  getPharmacyAuthorityPath,
  getPharmacyCampaignStorePath,
  getPharmacyEnhancementWorkspacePath,
  getPharmacyEnhancementsPath,
  getPharmacyGrowthActionsPath,
  getPharmacyGrowthJourneyPath,
  getPharmacyImageAssignmentsPath,
  getPharmacyIndexingPath,
  getPharmacyLaunchQueuePath,
  getPharmacyProfilePath,
  getPharmacyProjectConfigPath,
  getPharmacyPublishingSettingsPath,
  getPharmacyRegistryPath,
  getPharmacyVisibilityPath,
  PHARMACY_WORKSPACE_ROOT,
  REQUIRED_PHARMACY_WORKSPACE_DIR_KEYS,
  safePharmacySlug,
  tracePharmacyWorkspacePaths,
} from "./pharmacyWorkspacePaths.ts";

export {
  ensureDir,
  getPharmacyAuthorityPath,
  getPharmacyCampaignStorePath,
  getPharmacyEnhancementsPath,
  getPharmacyGrowthActionsPath,
  getPharmacyGrowthJourneyPath,
  getPharmacyImageAssignmentsPath,
  getPharmacyLaunchQueuePath,
  getPharmacyProfilePath,
  getPharmacyProjectConfigPath,
  getPharmacyPublishingSettingsPath,
  getPharmacyVisibilityPath,
  getAllRequiredPharmacyWorkspacePaths,
  tracePharmacyWorkspacePaths,
} from "./pharmacyWorkspacePaths.ts";

export const REQUIRED_WORKSPACE_FILES = [
  "profile",
  "projectConfig",
  "campaignStore",
  "launchQueue",
  "authority",
  "enhancements",
  "growthActions",
  "imageAssignments",
  "publishingSettings",
  "enhancementWorkspace",
  "registry",
  "indexing",
  "visibility",
  "growthJourney",
] as const;

export const REQUIRED_WORKSPACE_DIRS = REQUIRED_PHARMACY_WORKSPACE_DIR_KEYS;

export interface ProvisionVerificationCheck {
  resource: string;
  pass: boolean;
  reason?: string;
  recovery?: string;
  path?: string;
}

export interface ProvisioningVerificationResult {
  slug: string;
  ready: boolean;
  checks: ProvisionVerificationCheck[];
  diagnostics: string[];
}

export interface ProvisioningReport extends ProvisioningVerificationResult {
  phase: string;
  rolledBack: boolean;
}

export class WorkspaceProvisioningError extends Error {
  readonly report: ProvisioningReport;

  constructor(message: string, report: Omit<ProvisioningReport, "rolledBack"> & { rolledBack?: boolean }) {
    super(message);
    this.name = "WorkspaceProvisioningError";
    this.report = { ...report, rolledBack: report.rolledBack ?? false };
  }
}

export interface WorkspaceAuditResult {
  slug: string;
  complete: boolean;
  missingFiles: string[];
  missingDirs: string[];
  presentFiles: string[];
  presentDirs: string[];
}

function relPath(abs: string): string {
  if (abs.startsWith(PHARMACY_WORKSPACE_ROOT)) {
    return path.relative(PHARMACY_WORKSPACE_ROOT, abs).split(path.sep).join("/");
  }
  return abs;
}

function check(
  resource: string,
  pass: boolean,
  filePath: string,
  reason?: string,
  recovery?: string,
): ProvisionVerificationCheck {
  const display = relPath(filePath);
  return {
    resource,
    pass,
    path: filePath,
    reason: pass ? undefined : reason || `Missing: ${display}`,
    recovery: pass ? undefined : recovery || "Delete the partial client in Master Admin and create the pharmacy again.",
  };
}

function readJsonFile<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function auditPharmacyWorkspace(slug: string): WorkspaceAuditResult {
  const paths = getAllRequiredPharmacyWorkspacePaths(slug);
  const missingFiles: string[] = [];
  const missingDirs: string[] = [];
  const presentFiles: string[] = [];
  const presentDirs: string[] = [];

  for (const key of REQUIRED_WORKSPACE_FILES) {
    const p = paths[key];
    const label = relPath(p);
    if (fs.existsSync(p)) presentFiles.push(label);
    else missingFiles.push(label);
  }

  for (const key of REQUIRED_WORKSPACE_DIRS) {
    const p = paths[key];
    const label = relPath(p);
    if (fs.existsSync(p)) presentDirs.push(label);
    else missingDirs.push(label);
  }

  return {
    slug: paths.slug,
    complete: missingFiles.length === 0 && missingDirs.length === 0,
    missingFiles,
    missingDirs,
    presentFiles,
    presentDirs,
  };
}

export function verifyPharmacyWorkspaceReady(slug: string): ProvisioningVerificationResult {
  const paths = getAllRequiredPharmacyWorkspacePaths(slug);
  const s = paths.slug;
  const checks: ProvisionVerificationCheck[] = [];
  const diagnostics: string[] = [
    `workspaceRoot=${PHARMACY_WORKSPACE_ROOT}`,
    `dataRoot=${PHARMACY_WORKSPACE_ROOT}`,
    `profilePath=${paths.profile}`,
    `projectConfigPath=${paths.projectConfig}`,
    `campaignStorePath=${paths.campaignStore}`,
    `launchQueuePath=${paths.launchQueue}`,
    `growthActionsPath=${paths.growthActions}`,
    `publishingSettingsPath=${paths.publishingSettings}`,
    `visibilityPath=${paths.visibility}`,
    `growthJourneyPath=${paths.growthJourney}`,
  ];

  try {
    const doc = loadPharmacyProfile(s);
    const name = String(doc.data?.pharmacyName || doc.data?.tradingName || "").trim();
    checks.push(
      check(
        "profile",
        Boolean(name),
        paths.profile,
        name ? undefined : "Profile file exists but pharmacy name is empty",
        "Re-run Add New Pharmacy with a valid pharmacy name.",
      ),
    );
  } catch (err) {
    checks.push(
      check(
        "profile",
        false,
        paths.profile,
        `Profile not loadable: ${String(err)}`,
        "Workspace provisioning did not complete. Create the pharmacy again from Master Admin.",
      ),
    );
  }

  const project = readJsonFile<{ clientSlug?: string }>(paths.projectConfig);
  checks.push(
    check(
      "project-config",
      Boolean(project?.clientSlug),
      paths.projectConfig,
      project ? `${relPath(paths.projectConfig)} missing clientSlug` : `${relPath(paths.projectConfig)} not found`,
    ),
  );

  const campaigns = readPharmacyCampaignStore(s);
  const activeCount = campaigns?.campaigns.filter((c) => c.status === "active").length || 0;
  checks.push(
    check(
      "campaign-store",
      activeCount >= 1,
      paths.campaignStore,
      activeCount ? undefined : `No active campaigns in ${relPath(paths.campaignStore)}`,
      "Ensure at least one service is selected in the wizard.",
    ),
  );

  const authority = loadPharmacyAuthorityReadiness(s);
  checks.push(
    check(
      "authority-readiness",
      Boolean(authority?.services?.length),
      paths.authority,
      authority ? `${relPath(paths.authority)} has no services` : `${relPath(paths.authority)} missing`,
    ),
  );

  const publishing = loadPharmacyPublishingSettings(s);
  checks.push(
    check(
      "publishing-settings",
      publishing.services.length >= 1,
      paths.publishingSettings,
      `${relPath(paths.publishingSettings)} not seeded for selected services`,
    ),
  );

  const audit = auditPharmacyWorkspace(s);
  for (const missing of audit.missingFiles) {
    const abs = path.join(PHARMACY_WORKSPACE_ROOT, missing);
    checks.push(check(`file:${missing}`, false, abs, `Required workspace file missing: ${missing}`));
  }
  for (const missing of audit.missingDirs) {
    const abs = path.join(PHARMACY_WORKSPACE_ROOT, missing);
    checks.push(check(`dir:${missing}`, false, abs, `Required workspace folder missing: ${missing}`));
  }

  try {
    buildPharmacyPlatformDashboard(s);
    checks.push(check("growth-programme-dashboard", true, paths.profile));
  } catch (err) {
    checks.push(
      check(
        "growth-programme-dashboard",
        false,
        paths.profile,
        String(err),
        "Fix the failed resources above, then recreate the pharmacy workspace.",
      ),
    );
  }

  const ready = checks.every((c) => c.pass);
  if (!ready) {
    diagnostics.push(`failedResources=${checks.filter((c) => !c.pass).map((c) => c.resource).join(",")}`);
    for (const failed of checks.filter((c) => !c.pass && c.path)) {
      diagnostics.push(`missing:${failed.resource}=${failed.path}`);
    }
  }

  return { slug: s, ready, checks, diagnostics };
}

export function isPharmacyWorkspaceReady(slug: string): boolean {
  return verifyPharmacyWorkspaceReady(slug).ready;
}

export function rollbackPharmacyWorkspace(slug: string): { removed: string[] } {
  const paths = getAllRequiredPharmacyWorkspacePaths(slug);
  const removed: string[] = [];
  const targets = new Set<string>();

  for (const key of [...REQUIRED_WORKSPACE_FILES, ...REQUIRED_WORKSPACE_DIRS]) {
    targets.add(paths[key]);
  }
  targets.add(paths.brandProfile);

  // Legacy mistaken artifacts/ writes from bundled api-server
  const legacyRoot = path.join(PHARMACY_WORKSPACE_ROOT, "artifacts");
  if (fs.existsSync(legacyRoot)) {
    for (const key of [...REQUIRED_WORKSPACE_FILES, ...REQUIRED_WORKSPACE_DIRS]) {
      const rel = relPath(paths[key]);
      targets.add(path.join(legacyRoot, rel));
    }
    targets.add(path.join(legacyRoot, "config/projects", `${paths.slug}.json`));
    targets.add(path.join(legacyRoot, "config/projects", paths.slug));
  }

  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    try {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(target);
    } catch {
      /* best effort */
    }
  }

  return { removed };
}

function writeEmptyRegistry(slug: string): string {
  const file = getPharmacyRegistryPath(slug);
  const s = safePharmacySlug(slug);
  const registry: PharmacyRegistry = {
    version: 1,
    slug: s,
    generatedAt: new Date().toISOString(),
    pages: [],
  };
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(registry, null, 2));
  return file;
}

function writeEmptyIndexingSummary(slug: string): string {
  const file = getPharmacyIndexingPath(slug);
  const s = safePharmacySlug(slug);
  const summary = {
    version: 1,
    slug: s,
    totalRegistered: 0,
    notRegistered: 0,
    submitted: 0,
    indexed: 0,
    not_indexed: 0,
    failed: 0,
    sitemapUrl: null,
    lastUpdated: new Date().toISOString(),
  };
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(summary, null, 2));
  return file;
}

function writeEnhancementWorkspaceStore(slug: string): string {
  const store = loadEnhancementWorkspaceStore(slug);
  const file = getPharmacyEnhancementWorkspacePath(slug);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
  return file;
}

function seedPublishingSettings(slug: string, serviceIds: string[], website?: string): string {
  const s = safePharmacySlug(slug);
  loadPharmacyPublishingSettings(s);
  const base = website?.replace(/\/$/, "") || `https://${s}.pharmacy.local`;
  for (const serviceId of serviceIds) {
    const meta = getServicePublishMeta(serviceId);
    const existing = loadPharmacyPublishingSettings(s).services.find((x) => x.serviceId === serviceId);
    if (!existing) {
      saveServicePublishingSettings(s, serviceId, {
        canonicalUrl: `${base}${meta?.urlPath || `/${serviceId}/`}`,
        noindex: false,
        structuredDataEnabled: true,
      });
    }
  }
  return getPharmacyPublishingSettingsPath(s);
}

export interface WorkspaceProvisionResult {
  slug: string;
  filesCreated: string[];
  dirsCreated: string[];
  refreshedAt: string;
  verification: ProvisioningVerificationResult;
  pathTrace: ReturnType<typeof tracePharmacyWorkspacePaths>;
}

export function finalizePharmacyWorkspaceProvisioning(
  slug: string,
  serviceIds: string[],
  website?: string,
): WorkspaceProvisionResult {
  const paths = getAllRequiredPharmacyWorkspacePaths(slug);
  const s = paths.slug;
  const filesCreated: string[] = [];
  const dirsCreated: string[] = [];
  const diagnostics: string[] = [];

  for (const key of REQUIRED_WORKSPACE_DIRS) {
    const dir = paths[key];
    if (!fs.existsSync(dir)) {
      ensureDir(dir);
      dirsCreated.push(relPath(dir));
    }
  }

  uploadDir(s);

  filesCreated.push(saveImageAssignments(s, emptyAssignmentsDoc(s)));
  if (!fs.existsSync(getPharmacyImageAssignmentsPath(s))) {
    throw new WorkspaceProvisioningError("Workspace provisioning failed.", {
      slug: s,
      phase: "image-assignments",
      ready: false,
      checks: [check("image-assignments", false, getPharmacyImageAssignmentsPath(s))],
      diagnostics,
    });
  }

  filesCreated.push(writeEmptyRegistry(s));
  filesCreated.push(writeEmptyIndexingSummary(s));
  filesCreated.push(writeEnhancementWorkspaceStore(s));
  filesCreated.push(seedPublishingSettings(s, serviceIds, website));

  try {
    refreshPlatformAfterEnhancementComplete(s);
  } catch (err) {
    diagnostics.push(`authorityRefreshFailed=${String(err)}`);
    throw new WorkspaceProvisioningError("Workspace provisioning failed.", {
      slug: s,
      phase: "authority-refresh",
      ready: false,
      checks: [
        check("authority-refresh", false, getPharmacyAuthorityPath(s), String(err)),
        check("launch-queue", fs.existsSync(getPharmacyLaunchQueuePath(s)), getPharmacyLaunchQueuePath(s)),
        check("growth-actions", fs.existsSync(getPharmacyGrowthActionsPath(s)), getPharmacyGrowthActionsPath(s)),
        check("enhancements", fs.existsSync(getPharmacyEnhancementsPath(s)), getPharmacyEnhancementsPath(s)),
      ],
      diagnostics,
    });
  }

  try {
    refreshPharmacyVisibility(s);
  } catch (err) {
    diagnostics.push(`visibilityRefreshFailed=${String(err)}`);
    throw new WorkspaceProvisioningError("Workspace provisioning failed.", {
      slug: s,
      phase: "visibility-refresh",
      ready: false,
      checks: [check("visibility-report", false, getPharmacyVisibilityPath(s), String(err))],
      diagnostics,
    });
  }

  try {
    writeGrowthJourneyDashboardJson(s);
  } catch (err) {
    diagnostics.push(`growthJourneyFailed=${String(err)}`);
    throw new WorkspaceProvisioningError("Workspace provisioning failed.", {
      slug: s,
      phase: "growth-journey",
      ready: false,
      checks: [check("growth-journey", false, getPharmacyGrowthJourneyPath(s), String(err))],
      diagnostics,
    });
  }

  const pathTrace = tracePharmacyWorkspacePaths(s);
  for (const entry of pathTrace.files) {
    diagnostics.push(`afterWrite:${entry.resource} exists=${entry.exists} path=${entry.expectedPath}`);
  }

  const verification = verifyPharmacyWorkspaceReady(s);
  if (!verification.ready) {
    throw new WorkspaceProvisioningError("Workspace provisioning failed.", {
      slug: s,
      phase: "post-provision-verification",
      ready: false,
      checks: verification.checks,
      diagnostics: [...diagnostics, ...verification.diagnostics],
    });
  }

  return {
    slug: s,
    filesCreated,
    dirsCreated,
    refreshedAt: new Date().toISOString(),
    verification,
    pathTrace,
  };
}

export function pharmacyProfilesDir(): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles");
}

export function pharmacyProfileFilePath(slug: string): string {
  return getPharmacyProfilePath(slug);
}

/** @deprecated use getAllRequiredPharmacyWorkspacePaths */
export function getPharmacyWorkspacePaths(slug: string) {
  const p = getAllRequiredPharmacyWorkspacePaths(slug);
  return {
    profile: p.profile,
    project: p.projectConfig,
    brandDir: p.brandDir,
    brandProfile: p.brandProfile,
    campaigns: p.campaignStore,
    registry: path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/registry.json"),
  };
}

/** @deprecated use relPath via audit */
export function resolveWorkspacePath(template: string, slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, template.replace("{slug}", safePharmacySlug(slug)));
}
