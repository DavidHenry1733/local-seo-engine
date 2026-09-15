#!/usr/bin/env npx tsx
/**
 * Remove partial or demo pharmacy workspace files from canonical and legacy artifacts/ paths.
 *
 * Usage:
 *   npx tsx scripts/cleanup-partial-pharmacy-workspace.ts <slug>
 *   npx tsx scripts/cleanup-partial-pharmacy-workspace.ts <slug> --force
 */
import {
  deleteDemoPharmacyClient,
  readMasterAdminRegistry,
  removeMasterAdminRegistryEntry,
} from "../src/pharmacy/pharmacyMasterAdminService.ts";
import { rollbackPharmacyWorkspace } from "../src/pharmacy/pharmacyWorkspaceProvisionService.ts";
import { safePharmacySlug } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const slug = safePharmacySlug(process.argv[2] || "");
const force = process.argv.includes("--force");

if (!slug) {
  console.error("Usage: npx tsx scripts/cleanup-partial-pharmacy-workspace.ts <slug> [--force]");
  process.exit(1);
}

const registry = readMasterAdminRegistry();
const entry = registry.clients.find((c) => c.slug === slug);
const isDemo = entry?.isDemo === true || slug.includes("demo") || slug.includes("test") || slug.includes("self-provision");

if (!isDemo && !force) {
  console.error(
    `Refusing to cleanup "${slug}" — not marked demo/test. Re-run with --force to remove a production partial workspace.`,
  );
  process.exit(1);
}

console.log(`Cleaning partial pharmacy workspace: ${slug}`);

const removed: string[] = [];

try {
  const result = deleteDemoPharmacyClient(slug);
  removed.push(...result.deleted);
  console.log(`deleteDemoPharmacyClient removed ${result.deleted.length} path(s)`);
} catch (err) {
  console.log(`deleteDemoPharmacyClient skipped: ${String(err)}`);
  const rollback = rollbackPharmacyWorkspace(slug);
  removed.push(...rollback.removed);
  removeMasterAdminRegistryEntry(slug);
  console.log(`rollback removed ${rollback.removed.length} path(s)`);
}

console.log("\nRemoved paths:");
for (const p of removed) console.log(`  ${p}`);
console.log(`\nCleanup complete for ${slug}.`);
