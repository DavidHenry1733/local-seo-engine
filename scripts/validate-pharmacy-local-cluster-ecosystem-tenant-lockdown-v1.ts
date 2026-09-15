#!/usr/bin/env npx tsx
/**
 * Local Cluster & Ecosystem Tenant Lockdown V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  approveContentPackage,
  generateContentPackage,
  loadContentPackage,
} from "../src/pharmacy/pharmacyContentPackageService.ts";
import {
  loadGenerationReport,
  packageCanBeApproved,
  validateEcosystemTenant,
  validateInternalLinkMap,
  validateLocalClusterPages,
} from "../src/pharmacy/pharmacyGenerationIntegrityService.ts";
import { loadPharmacyProfile } from "../src/pharmacy/pharmacyContentBlueprintService.ts";
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function ecoRoot(slug: string, serviceId: string): string {
  return path.join(ROOT, "output/pharmacy-content-ecosystem", slug, serviceId);
}

async function validateTenant(slugArg: string, serviceId: string) {
  const slug = resolveTenantProfileSlug(slugArg) || slugArg;
  const prefix = `${slug}/${serviceId}`;
  const profile = loadPharmacyProfile(slug);
  const pharmacyName = profile?.data?.pharmacyName || "";
  const selectedAreas = (profile?.data?.selectedAreas || [])
    .filter((a) => a.selected !== false)
    .map((a) => a.areaName);

  console.log(`\n=== ${prefix} ===\n`);

  record(`${prefix}:ecosystem-dir`, fs.existsSync(ecoRoot(slug, serviceId)), ecoRoot(slug, serviceId));

  const gen = await generateContentPackage(slugArg, serviceId);
  record(`${prefix}:generation`, gen.ok, gen.ok ? "package valid" : gen.error || "failed");

  const report = loadGenerationReport(slug, serviceId);
  record(`${prefix}:generation-report`, Boolean(report?.generatedAt), report?.generatedAt || "missing");
  record(
    `${prefix}:ecosystem-tenant-validation`,
    Boolean(report?.ecosystemTenantValidation?.ok),
    report?.ecosystemTenantValidation?.detail || "missing",
  );
  record(
    `${prefix}:local-cluster-validation`,
    Boolean(report?.localClusterValidation?.ok),
    report?.localClusterValidation?.detail || "missing",
  );
  record(
    `${prefix}:local-count`,
    (report?.localClusterPagesGenerated || 0) === selectedAreas.length,
    `generated ${report?.localClusterPagesGenerated || 0}, expected ${selectedAreas.length}`,
  );
  record(
    `${prefix}:internal-link-validation`,
    Boolean(report?.internalLinkValidation?.ok),
    report?.internalLinkValidation?.detail || "missing",
  );
  record(
    `${prefix}:no-fallback-slug`,
    !report?.fallbackToDefaultSlugDetected,
    report?.fallbackToDefaultSlugDetected ? "pharmaconnect fallback detected" : "clean",
  );

  const ecoTenant = validateEcosystemTenant(slug, serviceId, pharmacyName);
  record(`${prefix}:no-brook-ecosystem`, ecoTenant.foreignTenantAssetsDetected.length === 0, ecoTenant.detail);

  if (slug !== "pharmaconnect") {
    const htmlFiles: string[] = [];
    for (const sub of ["pages", "local"]) {
      const dir = path.join(ecoRoot(slug, serviceId), sub);
      if (!fs.existsSync(dir)) continue;
      const walk = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, e.name);
          if (e.isDirectory()) walk(full);
          else if (e.name.endsWith(".html")) htmlFiles.push(full);
        }
      };
      walk(dir);
    }
    const hasPharmacyName =
      pharmacyName.length === 0 || htmlFiles.some((f) => fs.readFileSync(f, "utf8").includes(pharmacyName));
    record(`${prefix}:contains-pharmacy-name`, hasPharmacyName, pharmacyName || "n/a");
    record(
      `${prefix}:no-brook-in-files`,
      !htmlFiles.some((f) => /Brook Pharmacy/i.test(fs.readFileSync(f, "utf8"))),
      `${htmlFiles.length} html files scanned`,
    );
  }

  const localDir = path.join(ecoRoot(slug, serviceId), "local");
  if (selectedAreas.length > 0) {
    for (const area of selectedAreas) {
      const areaSlug = area.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const file = path.join(localDir, areaSlug, "index.html");
      const exists = fs.existsSync(file);
      record(`${prefix}:local-page-${areaSlug}`, exists, file);
      if (exists) {
        const html = fs.readFileSync(file, "utf8");
        record(`${prefix}:local-area-name-${areaSlug}`, html.includes(area), area);
      }
    }
  }

  const indexPath = path.join(ecoRoot(slug, serviceId), "_ecosystem-index.json");
  if (fs.existsSync(indexPath)) {
    const indexRaw = fs.readFileSync(indexPath, "utf8");
    record(`${prefix}:index-slug`, indexRaw.includes(`"slug": "${slug}"`), slug);
    record(
      `${prefix}:index-no-pharmaconnect`,
      slug === "pharmaconnect" || !indexRaw.includes("/pharmacy-content-ecosystem/pharmaconnect/"),
      "index paths tenant-scoped",
    );
  }

  const manifest = loadContentPackage(slug, serviceId);
  const localAsset = manifest?.assets.find((a) => a.type === "local-area-pages");
  record(
    `${prefix}:manifest-local-count`,
    localAsset?.count === selectedAreas.length,
    `manifest count ${localAsset?.count}, expected ${selectedAreas.length}`,
  );

  const linkCheck = validateInternalLinkMap(slug, serviceId);
  record(`${prefix}:link-map`, linkCheck.ok, linkCheck.detail);

  const approval = packageCanBeApproved(report);
  if (slug === "pharmaconnect") {
    record(`${prefix}:approval-allowed`, approval.ok, approval.message);
  } else {
    record(`${prefix}:approval-blocked-if-invalid`, !approval.ok || gen.ok, approval.message);
  }

  if (slug === "pharmaconnect" && gen.ok) {
    try {
      approveContentPackage(slug, serviceId, "validation-script");
      record(`${prefix}:brook-approve`, true, "approved");
    } catch (err) {
      record(`${prefix}:brook-approve`, false, String(err));
    }
  }
}

async function main() {
  await validateTenant("dhmdigital", "blood-pressure-checks");
  await validateTenant("dhm-digital", "blood-pressure-checks");
  await validateTenant("pharmaconnect", "blood-pressure-checks");

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
