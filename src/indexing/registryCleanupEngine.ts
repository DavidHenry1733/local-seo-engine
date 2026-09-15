import fs from "node:fs";
import path from "node:path";
import { buildUrlHealthAudit } from "./urlHealthAuditEngine";
import { buildUrlLifecycle } from "./urlLifecycleEngine";
import type { RegistryCleanupAudit, RegistryCleanupRecord } from "./registryCleanupAuditEngine";

interface RegistryPage {
  url: string;
  slug?: string;
  remotePath?: string;
  campaignId?: string;
  label?: string;
  type?: string;
  status?: string;
  includedInSitemap?: boolean;
  priority?: number;
  lastSeenAt?: string;
  lastDeployedAt?: string;
  indexed?: boolean;
  lastIndexCheckedAt?: string;
  source?: string;
}

interface RegistryFile {
  projectSlug?: string;
  updatedAt?: string;
  pages?: RegistryPage[];
}

export interface RegistryCleanupApplyResult {
  projectSlug: string;
  appliedAt: string;
  registryPath: string;
  backupPath: string;
  auditPath: string;
  registryCountBefore: number;
  registryCountAfter: number;
  urlsRemoved: string[];
  urlsRepaired: Array<{
    from: string;
    to: string;
  }>;
  validation: {
    removedUrlsRemaining: string[];
    repairedUrlsMissing: string[];
    duplicateUrls: string[];
    manualReviewUrlsTouched: string[];
    passed: boolean;
  };
  lifecycleRebuilt: boolean;
  healthAuditRebuilt: boolean;
}

export interface ApplyRegistryCleanupOptions {
  outputDir?: string;
  refreshSearchAnalytics?: boolean;
}

function projectDir(projectSlug: string, outputDir: string): string {
  return path.join(outputDir, projectSlug);
}

function registryPath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "page-registry.json");
}

function backupPath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "page-registry.backup.json");
}

function auditPath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "registry-cleanup-audit.json");
}

function readJson<T>(file: string): T {
  if (!fs.existsSync(file)) throw new Error(`Required cleanup input missing: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
    return parsed.toString();
  } catch {
    return String(url || "").trim();
  }
}

function remotePathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname || "/";
    return pathname.endsWith("/") ? pathname : `${pathname}/`;
  } catch {
    return "/";
  }
}

function slugFromRemotePath(remotePath: string): string {
  return remotePath.replace(/^\/|\/$/g, "") || "home";
}

function duplicateUrls(pages: RegistryPage[]): string[] {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const key = normaliseUrl(page.url);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([url]) => url);
}

function assertAllowedAuditShape(audit: RegistryCleanupAudit): void {
  const invalidRemove = audit.urlsToRemoveFromRegistry.filter(
    (record) => record.recommendation !== "REMOVE_FROM_REGISTRY",
  );
  if (invalidRemove.length) {
    throw new Error(`Cleanup audit has invalid remove candidates: ${invalidRemove.map((r) => r.url).join(", ")}`);
  }

  const invalidRepair = audit.safeAutoFixCandidates.filter(
    (record) => record.recommendation !== "SAFE_AUTO_FIX" || !record.canonicalTarget,
  );
  if (invalidRepair.length) {
    throw new Error(`Cleanup audit has invalid safe auto-fix candidates: ${invalidRepair.map((r) => r.url).join(", ")}`);
  }
}

function repairPage(page: RegistryPage, candidate: RegistryCleanupRecord): RegistryPage {
  const to = candidate.canonicalTarget;
  if (!to) throw new Error(`Safe auto-fix candidate missing canonical target: ${candidate.url}`);
  const remotePath = remotePathFromUrl(to);
  return {
    ...page,
    url: to,
    slug: slugFromRemotePath(remotePath),
    remotePath,
  };
}

export async function applyRegistryCleanup(
  projectSlug: string,
  options: ApplyRegistryCleanupOptions = {},
): Promise<RegistryCleanupApplyResult> {
  const outputDir = options.outputDir || "output";
  const regPath = registryPath(projectSlug, outputDir);
  const bakPath = backupPath(projectSlug, outputDir);
  const cleanAuditPath = auditPath(projectSlug, outputDir);
  const registry = readJson<RegistryFile>(regPath);
  const audit = readJson<RegistryCleanupAudit>(cleanAuditPath);
  assertAllowedAuditShape(audit);

  const pages = registry.pages || [];
  const beforePages = pages.map((page) => ({ ...page }));
  const beforeManualUrls = new Set(audit.manualReviewCandidates.map((record) => normaliseUrl(record.url)));
  const removeUrls = new Set(audit.urlsToRemoveFromRegistry.map((record) => normaliseUrl(record.url)));
  const repairByUrl = new Map(
    audit.safeAutoFixCandidates.map((record) => [normaliseUrl(record.url), record]),
  );

  fs.copyFileSync(regPath, bakPath);

  const rebuiltPages: RegistryPage[] = [];
  const urlsRemoved: string[] = [];
  const urlsRepaired: Array<{ from: string; to: string }> = [];

  for (const page of pages) {
    const key = normaliseUrl(page.url);
    if (removeUrls.has(key)) {
      urlsRemoved.push(page.url);
      continue;
    }

    const repair = repairByUrl.get(key);
    if (repair) {
      const repaired = repairPage(page, repair);
      rebuiltPages.push(repaired);
      urlsRepaired.push({ from: page.url, to: repaired.url });
      continue;
    }

    rebuiltPages.push(page);
  }

  registry.pages = rebuiltPages;
  registry.updatedAt = new Date().toISOString();
  fs.writeFileSync(regPath, JSON.stringify(registry, null, 2), "utf8");

  const afterUrls = new Set(rebuiltPages.map((page) => normaliseUrl(page.url)));
  const removedUrlsRemaining = [...removeUrls].filter((url) => afterUrls.has(url));
  const repairedUrlsMissing = urlsRepaired
    .map((repair) => normaliseUrl(repair.to))
    .filter((url) => !afterUrls.has(url));
  const duplicates = duplicateUrls(rebuiltPages);

  const changedUrls = new Set<string>();
  for (const before of beforePages) {
    const after = rebuiltPages.find((page) => page.slug === before.slug || page.remotePath === before.remotePath);
    if (!after || normaliseUrl(after.url) !== normaliseUrl(before.url)) {
      changedUrls.add(normaliseUrl(before.url));
    }
  }
  const manualReviewUrlsTouched = [...beforeManualUrls].filter((url) => changedUrls.has(url));

  const validation = {
    removedUrlsRemaining,
    repairedUrlsMissing,
    duplicateUrls: duplicates,
    manualReviewUrlsTouched,
    passed: removedUrlsRemaining.length === 0 &&
      repairedUrlsMissing.length === 0 &&
      duplicates.length === 0 &&
      manualReviewUrlsTouched.length === 0,
  };

  let lifecycleRebuilt = false;
  let healthAuditRebuilt = false;
  if (validation.passed) {
    await buildUrlLifecycle(projectSlug, {
      outputDir,
      refreshSearchAnalytics: options.refreshSearchAnalytics ?? true,
    });
    lifecycleRebuilt = true;
    buildUrlHealthAudit(projectSlug, { outputDir });
    healthAuditRebuilt = true;
  }

  return {
    projectSlug,
    appliedAt: new Date().toISOString(),
    registryPath: regPath,
    backupPath: bakPath,
    auditPath: cleanAuditPath,
    registryCountBefore: beforePages.length,
    registryCountAfter: rebuiltPages.length,
    urlsRemoved,
    urlsRepaired,
    validation,
    lifecycleRebuilt,
    healthAuditRebuilt,
  };
}
