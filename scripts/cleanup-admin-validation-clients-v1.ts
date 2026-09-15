#!/usr/bin/env npx tsx
/**
 * Admin Client Cleanup V1 — remove validation test profiles from admin client list.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  cleanupAllValidationTestClients,
  isValidationTestClientSlug,
  listValidationTestClientSlugs,
} from "../src/pharmacy/adminClientValidationCleanup.ts";
import { listAdminClientPharmacies } from "../src/pharmacy/adminClientCreationService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

console.log("\n=== Admin Client Cleanup V1 ===\n");

const before = listValidationTestClientSlugs();
console.log(`Validation test profiles found: ${before.length}`);
for (const slug of before) console.log(`  - ${slug}`);

const result = cleanupAllValidationTestClients();
console.log(`\nRemoved ${result.removedSlugs.length} validation test client(s).`);

const clients = listAdminClientPharmacies();
console.log(`\nAdmin client list (${clients.length}):`);
for (const c of clients) {
  console.log(`  - ${c.pharmacyName} (${c.slug})`);
}

const leaked = clients.filter((c) => isValidationTestClientSlug(c.slug));
if (leaked.length) {
  console.error(`\n❌ ${leaked.length} validation test client(s) still listed`);
  process.exit(1);
}

console.log("\n✅ Admin page client list is clean\n");
