#!/usr/bin/env npx tsx
/**
 * Admin Client Cleanup V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAllValidationTestClients,
  cleanupValidationTestClient,
  isValidationTestClientSlug,
  listValidationTestClientSlugs,
} from "../src/pharmacy/adminClientValidationCleanup.ts";
import {
  createAdminPharmacyClient,
  listAdminClientPharmacies,
} from "../src/pharmacy/adminClientCreationService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const PROTECTED = ["dhmdigital", "pharmaconnect", "rowlands-test", "pharmacy-delivered-4u-test"] as const;
const checks: Array<{ id: string; pass: boolean; detail?: string }> = [];
const createdSlugs: string[] = [];

function record(id: string, pass: boolean, detail?: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}${detail ? ` — ${detail}` : ""}`);
}

function cleanupCreated(): void {
  for (const slug of [...new Set(createdSlugs)]) {
    try {
      cleanupValidationTestClient(slug);
    } catch {
      /* best effort */
    }
  }
}

record("cleanup-module", fs.existsSync(path.join(ROOT, "src/pharmacy/adminClientValidationCleanup.ts")));

cleanupAllValidationTestClients();

const afterInitial = listAdminClientPharmacies();
record(
  "no-test-clients-listed",
  !afterInitial.some((c) => isValidationTestClientSlug(c.slug)),
  afterInitial.map((c) => c.slug).join(", "),
);

for (const slug of PROTECTED) {
  record(`protected-${slug}`, afterInitial.some((c) => c.slug === slug), slug);
}

try {
  const first = createAdminPharmacyClient({
    pharmacyName: `Admin Client Test ${Date.now()}`,
    website: "https://example-admin-client-test.co.uk",
    town: "Leeds",
    postcode: "LS1 1AA",
  });
  createdSlugs.push(first.slug);

  const second = createAdminPharmacyClient({
    pharmacyName: first.pharmacyName,
    website: "https://duplicate-test.co.uk",
    town: "Leeds",
    postcode: "LS1 1AB",
  });
  createdSlugs.push(second.slug);

  record("test-profiles-created", createdSlugs.every((s) => fs.existsSync(path.join(ROOT, "data/pharmacy-profiles", `${s}.json`))));
} catch (err) {
  record("test-profiles-created", false, String(err));
}

cleanupCreated();
record(
  "validation-cleanup-complete",
  createdSlugs.every((slug) => !fs.existsSync(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`))),
);

const finalClients = listAdminClientPharmacies();
record(
  "admin-list-clean-after-validation",
  !finalClients.some((c) => isValidationTestClientSlug(c.slug)),
  `${finalClients.length} clients`,
);

record(
  "slug-detection",
  isValidationTestClientSlug("admin-client-test-123") &&
    isValidationTestClientSlug("master-admin-test-123") &&
    !isValidationTestClientSlug("rowlands-test"),
);

record(
  "protected-slug-refused",
  !isValidationTestClientSlug("dhmdigital") && !isValidationTestClientSlug("pharmaconnect"),
);

try {
  cleanupValidationTestClient("dhmdigital");
  record("dhmdigital-not-removable", false);
} catch {
  record("dhmdigital-not-removable", true);
}

const failed = checks.filter((c) => !c.pass);
console.log(`\n${failed.length ? "❌" : "✅"} ${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
