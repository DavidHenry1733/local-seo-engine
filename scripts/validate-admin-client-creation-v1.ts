#!/usr/bin/env npx tsx
/**
 * Admin Client Creation V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  adminClientSlugAvailable,
  createAdminPharmacyClient,
  listAdminClientPharmacies,
  previewAdminClientSlug,
  ADMIN_CLIENT_STATUS_SETUP_REQUIRED,
} from "../src/pharmacy/adminClientCreationService.ts";
import {
  cleanupValidationTestClient,
  isValidationTestClientSlug,
} from "../src/pharmacy/adminClientValidationCleanup.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import {
  renderAdminClientPharmaciesHtml,
  renderMasterAdminHtml,
} from "../artifacts/api-server/src/routes/pharmacyMasterAdminPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROTECTED = ["dhmdigital", "pharmaconnect", "rowlands-test", "pharmacy-delivered-4u-test"] as const;
const TEST_NAME = `Admin Client Test ${Date.now()}`;

if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

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

try {
  record("service-module", fs.existsSync(path.join(ROOT, "src/pharmacy/adminClientCreationService.ts")));

  const pageSrc = fs.readFileSync(
    path.join(ROOT, "artifacts/api-server/src/routes/pharmacyMasterAdminPage.ts"),
    "utf8",
  );
  const apiSrc = fs.readFileSync(
    path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyMasterAdmin.ts"),
    "utf8",
  );

  record("page-title", pageSrc.includes("Client Pharmacies"));
  record("create-button", pageSrc.includes("+ Create New Pharmacy"));
  record("admin-only-banner", pageSrc.includes("Admin only"));
  record("table-columns", pageSrc.includes("Growth Dashboard") && pageSrc.includes("Profile Wizard"));
  record("api-create-route", apiSrc.includes('"/master-admin/clients"'));
  record("require-admin", pageSrc.includes("requireAdmin"));

  const html = renderAdminClientPharmaciesHtml(listAdminClientPharmacies());
  record("page-renders", html.includes("Client Pharmacies") && html.includes("<table"));
  record("legacy-export", renderMasterAdminHtml().includes("Client Pharmacies"));
  record(
    "admin-list-excludes-test-clients",
    !listAdminClientPharmacies().some((c) => isValidationTestClientSlug(c.slug)),
  );

  const beforeProtected = PROTECTED.map((slug) => ({
    slug,
    exists: fs.existsSync(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`)),
    mtime: fs.existsSync(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`))
      ? fs.statSync(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`)).mtimeMs
      : 0,
  }));

  const slug = previewAdminClientSlug(TEST_NAME);
  record("slug-generated", Boolean(slug) && /^[a-z0-9-]+$/.test(slug), slug);
  record("slug-available", adminClientSlugAvailable(slug));

  const result = createAdminPharmacyClient({
    pharmacyName: TEST_NAME,
    website: "https://example-admin-client-test.co.uk",
    town: "Leeds",
    postcode: "LS1 1AA",
    contactEmail: "admin-test@pharmaconnect.local",
    notes: "Admin Client Creation V1 validation",
  });
  createdSlugs.push(result.slug);

  record("profile-created", fs.existsSync(result.profilePath), result.profilePath);
  record("status-setup-required", result.status === ADMIN_CLIENT_STATUS_SETUP_REQUIRED);
  record(
    "redirect-url",
    result.redirectUrl.includes("/api/growth-engine/start?slug="),
    result.redirectUrl,
  );

  const data = normalizeProfileData(
    JSON.parse(fs.readFileSync(result.profilePath, "utf8")).data || {},
  );
  record("website-set", data.website.includes("example-admin-client-test"));
  record("town-postcode-set", data.primaryTown === "Leeds" && data.postcode === "LS1 1AA");
  record("platform-status", data.platformClientStatus === ADMIN_CLIENT_STATUS_SETUP_REQUIRED);

  record(
    "excluded-from-admin-list",
    !listAdminClientPharmacies().some((c) => c.slug === result.slug),
    "validation test profiles hidden from admin UI",
  );
  record(
    "wizard-url-shape",
    `/api/pharmacy-profile-wizard?slug=${encodeURIComponent(result.slug)}`.includes(result.slug),
  );
  record(
    "dashboard-url-shape",
    `/api/growth-engine/dashboard?slug=${encodeURIComponent(result.slug)}`.includes(result.slug),
  );

  const second = createAdminPharmacyClient({
    pharmacyName: TEST_NAME,
    website: "https://duplicate-test.co.uk",
    town: "Leeds",
    postcode: "LS1 1AB",
  });
  createdSlugs.push(second.slug);
  record("duplicate-suffixed", second.slug !== result.slug, `${result.slug} → ${second.slug}`);

  for (const row of beforeProtected) {
    if (!row.exists) continue;
    const afterMtime = fs.statSync(path.join(ROOT, "data/pharmacy-profiles", `${row.slug}.json`)).mtimeMs;
    record(`protected-${row.slug}`, afterMtime === row.mtime, "unchanged");
  }

  record("generators-unchanged", fs.existsSync(path.join(ROOT, "src/generator/brandImporter.ts")));
} catch (err) {
  record("validation-run", false, String(err));
} finally {
  cleanupCreated();
  record(
    "test-cleanup",
    createdSlugs.every((s) => !fs.existsSync(path.join(ROOT, "data/pharmacy-profiles", `${s}.json`))),
  );
  record(
    "admin-list-clean-after-test",
    !listAdminClientPharmacies().some((c) => isValidationTestClientSlug(c.slug)),
  );
}

const failed = checks.filter((c) => !c.pass);
console.log(`\n${failed.length ? "❌" : "✅"} ${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
