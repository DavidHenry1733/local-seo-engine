/**
 * Canonical pharmacy workspace paths — single root resolver for provisioning, loaders, and verification.
 * Bundled api-server code must NOT resolve to the `artifacts/` subdirectory as workspace root.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export function safePharmacySlug(slug: string): string {
  return (
    String(slug || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmacy"
  );
}

function isArtifactsRoot(root: string): boolean {
  return path.basename(path.resolve(root)) === "artifacts";
}

function hasWorkspaceMarker(root: string): boolean {
  return (
    fs.existsSync(path.join(root, "data/pharmacy-approved-service-banks/registry.json")) ||
    fs.existsSync(path.join(root, "data/pharmacy-profiles")) ||
    fs.existsSync(path.join(root, "config/pharmacy/service-expertise-library.json")) ||
    fs.existsSync(path.join(root, "output/pharmacy-blueprint/service-intelligence.json"))
  );
}

export function resolvePharmacyWorkspaceRoot(): string {
  const envRoot = process.env.WORKSPACE_ROOT?.trim();
  if (envRoot) {
    const resolved = path.resolve(envRoot);
    if (!isArtifactsRoot(resolved) && hasWorkspaceMarker(resolved)) {
      return resolved;
    }
    // WORKSPACE_ROOT may point at a wrapper repo — fall through to canonical discovery
  }

  const candidates: string[] = [];

  if (fs.existsSync("/home/inboxingproweb/pharmaconnect-growth-engine")) {
    candidates.push("/home/inboxingproweb/pharmaconnect-growth-engine");
  }

  // Source: src/pharmacy → repo root
  candidates.push(path.resolve(MODULE_DIR, "../.."));
  // Bundled: dist → repo root (three levels up, not two — two levels is artifacts/)
  candidates.push(path.resolve(MODULE_DIR, "../../.."));
  candidates.push(path.resolve(MODULE_DIR, "../../../.."));
  candidates.push(process.cwd());

  for (const root of candidates) {
    if (isArtifactsRoot(root)) continue;
    if (hasWorkspaceMarker(root)) return root;
  }

  for (const root of candidates) {
    if (!isArtifactsRoot(root)) return root;
  }

  return path.resolve(MODULE_DIR, "../..");
}

export const PHARMACY_WORKSPACE_ROOT = resolvePharmacyWorkspaceRoot();
export const WORKSPACE_ROOT = PHARMACY_WORKSPACE_ROOT;

export function getPharmacyProfilePath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyProjectConfigPath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyProjectBrandDir(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", safePharmacySlug(slug));
}

export function getPharmacyBrandProfilePath(slug: string): string {
  return path.join(getPharmacyProjectBrandDir(slug), "brand-profile.json");
}

export function getPharmacyBrandDnaPath(slug: string): string {
  return path.join(getPharmacyProjectBrandDir(slug), "brand-dna.json");
}

export function getPharmacyBrandDnaOverridesPath(slug: string): string {
  return path.join(getPharmacyProjectBrandDir(slug), "brand-dna-overrides.json");
}

export function getPharmacyBrandDnaExtractionEvidencePath(slug: string): string {
  return path.join(getPharmacyProjectBrandDir(slug), "brand-dna-extraction-evidence.json");
}

export function getPharmacyTenantBrandIdentityPath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-tenant-brand", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyTenantImageLibraryPath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-tenant-image-library", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyCampaignImageSelectionPath(slug: string, serviceId: string, runId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-campaign-image-selections",
    safePharmacySlug(slug),
    `${String(serviceId || "").replace(/[^a-z0-9-]+/gi, "-")}-${String(runId || "").replace(/[^a-z0-9-]+/gi, "-")}.json`,
  );
}

export function getPharmacyCampaignStorePath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyLaunchQueuePath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaign-launch-queue", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyGrowthActionsPath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-growth-actions", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyPublishingSettingsPath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-publishing-settings", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyVisibilityPath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-visibility", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyGrowthJourneyPath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-growth-journey", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyImageAssignmentsPath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-image-assignments", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyAuthorityPath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-authority-readiness", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyEnhancementsPath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-authority-enhancements", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyEnhancementWorkspacePath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-enhancement-workspace", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyRegistryPath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-registry", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyIndexingPath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-indexing", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyUploadDir(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "assets/pharmacy-uploads", safePharmacySlug(slug));
}

export const REQUIRED_PHARMACY_WORKSPACE_DIR_KEYS = [
  "brandDir",
  "uploadDir",
  "visualExperienceDir",
  "contentEcosystemDir",
  "publishDir",
] as const;

export function getAllRequiredPharmacyWorkspacePaths(slug: string) {
  const s = safePharmacySlug(slug);
  return {
    slug: s,
    workspaceRoot: PHARMACY_WORKSPACE_ROOT,
    profile: getPharmacyProfilePath(s),
    projectConfig: getPharmacyProjectConfigPath(s),
    brandDir: getPharmacyProjectBrandDir(s),
    brandProfile: getPharmacyBrandProfilePath(s),
    brandDna: getPharmacyBrandDnaPath(s),
    brandDnaOverrides: getPharmacyBrandDnaOverridesPath(s),
    campaignStore: getPharmacyCampaignStorePath(s),
    launchQueue: getPharmacyLaunchQueuePath(s),
    growthActions: getPharmacyGrowthActionsPath(s),
    publishingSettings: getPharmacyPublishingSettingsPath(s),
    visibility: getPharmacyVisibilityPath(s),
    growthJourney: getPharmacyGrowthJourneyPath(s),
    imageAssignments: getPharmacyImageAssignmentsPath(s),
    authority: getPharmacyAuthorityPath(s),
    enhancements: getPharmacyEnhancementsPath(s),
    enhancementWorkspace: getPharmacyEnhancementWorkspacePath(s),
    registry: getPharmacyRegistryPath(s),
    indexing: getPharmacyIndexingPath(s),
    uploadDir: getPharmacyUploadDir(s),
    visualExperienceDir: path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", s),
    contentEcosystemDir: path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", s),
    publishDir: path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", s),
  };
}

export interface WorkspacePathTraceEntry {
  resource: string;
  expectedPath: string;
  exists: boolean;
}

export function tracePharmacyWorkspacePaths(slug: string): {
  slug: string;
  workspaceRoot: string;
  dataRoot: string;
  profilePath: string;
  projectConfigPath: string;
  campaignStorePath: string;
  launchQueuePath: string;
  growthActionsPath: string;
  publishingSettingsPath: string;
  visibilityPath: string;
  growthJourneyPath: string;
  files: WorkspacePathTraceEntry[];
  dirs: WorkspacePathTraceEntry[];
} {
  const paths = getAllRequiredPharmacyWorkspacePaths(slug);
  const fileKeys = [
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

  const files = fileKeys.map((key) => ({
    resource: key,
    expectedPath: paths[key],
    exists: fs.existsSync(paths[key]),
  }));

  const dirs = REQUIRED_PHARMACY_WORKSPACE_DIR_KEYS.map((key) => ({
    resource: key,
    expectedPath: paths[key],
    exists: fs.existsSync(paths[key]),
  }));

  return {
    slug: paths.slug,
    workspaceRoot: paths.workspaceRoot,
    dataRoot: paths.workspaceRoot,
    profilePath: paths.profile,
    projectConfigPath: paths.projectConfig,
    campaignStorePath: paths.campaignStore,
    launchQueuePath: paths.launchQueue,
    growthActionsPath: paths.growthActions,
    publishingSettingsPath: paths.publishingSettings,
    visibilityPath: paths.visibility,
    growthJourneyPath: paths.growthJourney,
    files,
    dirs,
  };
}

export function getContentEcosystemDir(slug: string, serviceId: string): string {
  const s = safePharmacySlug(slug);
  const svc = safePharmacySlug(serviceId);
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", s, svc);
}

export function getContentEcosystemIndexPath(slug: string, serviceId: string): string {
  return path.join(getContentEcosystemDir(slug, serviceId), "_ecosystem-index.json");
}

/** Resolve canonical on-disk ecosystem index for a tenant + service. */
export function resolveContentEcosystemIndexPath(
  rawSlug: string,
  rawServiceId: string,
  resolveTenant?: (raw: unknown) => string | null,
): string | null {
  const serviceId = safePharmacySlug(rawServiceId);
  const slugCandidates = new Set<string>();
  const resolved = resolveTenant?.(rawSlug);
  if (resolved) slugCandidates.add(resolved);
  slugCandidates.add(safePharmacySlug(rawSlug));

  for (const slug of slugCandidates) {
    const indexPath = getContentEcosystemIndexPath(slug, serviceId);
    if (fs.existsSync(indexPath)) return indexPath;
  }

  return null;
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
