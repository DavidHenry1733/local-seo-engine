/**
 * Admin Client Cleanup V1 — remove validation test tenants from admin client list.
 */
import fs from "node:fs";
import path from "node:path";
import {
  deleteDemoPharmacyClient,
  readMasterAdminRegistry,
  removeMasterAdminRegistryEntry,
  safeAdminSlug,
} from "./pharmacyMasterAdminService.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { pharmacyProfilesDir } from "./pharmacyWorkspaceProvisionService.ts";
import { rollbackPharmacyWorkspace } from "./pharmacyWorkspaceProvisionService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

const PROTECTED_SLUGS = new Set(["dhmdigital", "pharmaconnect", "rowlands-test", "pharmacy-delivered-4u-test"]);

export function isValidationTestClientSlug(raw: string): boolean {
  const slug = safeAdminSlug(raw);
  if (!slug || PROTECTED_SLUGS.has(slug)) return false;
  return slug.startsWith("admin-client-test") || slug.startsWith("master-admin-test");
}

export function listValidationTestClientSlugs(): string[] {
  const slugs = new Set<string>();
  const dir = pharmacyProfilesDir();
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const slug = file.replace(/\.json$/, "");
      if (isValidationTestClientSlug(slug)) slugs.add(slug);
    }
  }

  scanForValidationTestArtifactSlugs(PHARMACY_WORKSPACE_ROOT).forEach((slug) => slugs.add(slug));
  readMasterAdminRegistry()
    .clients.map((c) => c.slug)
    .filter((slug) => isValidationTestClientSlug(slug))
    .forEach((slug) => slugs.add(slug));

  return [...slugs].sort();
}

function scanForValidationTestArtifactSlugs(root: string): string[] {
  const slugs = new Set<string>();
  const dataRoot = path.join(root, "data");
  const configRoot = path.join(root, "config");
  for (const base of [dataRoot, configRoot]) {
    if (!fs.existsSync(base)) continue;
    walkValidationArtifactFiles(base, slugs);
  }
  return [...slugs];
}

function walkValidationArtifactFiles(dir: string, slugs: Set<string>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isValidationTestClientSlug(entry.name)) slugs.add(safeAdminSlug(entry.name));
      walkValidationArtifactFiles(full, slugs);
      continue;
    }
    if (!entry.name.endsWith(".json")) continue;
    const slug = entry.name.replace(/\.json$/, "");
    if (isValidationTestClientSlug(slug)) slugs.add(safeAdminSlug(slug));
  }
}

function removeValidationTestArtifacts(slug: string): string[] {
  const removed: string[] = [];
  const targets = new Set<string>();

  for (const base of [path.join(PHARMACY_WORKSPACE_ROOT, "data"), path.join(PHARMACY_WORKSPACE_ROOT, "config")]) {
    if (!fs.existsSync(base)) continue;
    collectValidationArtifactPaths(base, slug, targets);
  }

  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    removed.push(target);
  }

  return removed;
}

function collectValidationArtifactPaths(dir: string, slug: string, targets: Set<string>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === slug) targets.add(full);
      collectValidationArtifactPaths(full, slug, targets);
      continue;
    }
    if (entry.name === `${slug}.json`) targets.add(full);
  }
}

export function cleanupValidationTestClient(slug: string): { slug: string; removed: string[] } {
  const s = safeAdminSlug(slug);
  if (!isValidationTestClientSlug(s)) {
    throw new Error(`Refusing to remove non-test client slug: ${slug}`);
  }

  const removed: string[] = [];
  const profile = profilePath(s);
  const hasProfile = fs.existsSync(profile);

  if (s.startsWith("master-admin-test") && hasProfile) {
    try {
      const result = deleteDemoPharmacyClient(s);
      removed.push(...result.deleted);
      return { slug: s, removed };
    } catch {
      /* fall through to manual cleanup */
    }
  }

  if (hasProfile || s.startsWith("master-admin-test")) {
    const rolled = rollbackPharmacyWorkspace(s);
    removed.push(...rolled.removed);
  }

  if (fs.existsSync(profile)) {
    fs.unlinkSync(profile);
    removed.push(profile);
  }

  if (removeMasterAdminRegistryEntry(s)) {
    removed.push(`registry:${s}`);
  }

  removed.push(...removeValidationTestArtifacts(s));

  return { slug: s, removed };
}

export function cleanupAllValidationTestClients(): {
  removedSlugs: string[];
  details: Array<{ slug: string; removed: string[] }>;
} {
  const profileSlugs = listValidationTestClientSlugs();
  const registrySlugs = readMasterAdminRegistry()
    .clients.map((c) => c.slug)
    .filter((slug) => isValidationTestClientSlug(slug));
  const slugs = [...new Set([...profileSlugs, ...registrySlugs])].sort();

  const details: Array<{ slug: string; removed: string[] }> = [];
  for (const slug of slugs) {
    details.push(cleanupValidationTestClient(slug));
  }

  return { removedSlugs: slugs, details };
}
