#!/usr/bin/env npx tsx
/**
 * PharmaConnect Content Package Generation Pipeline Lockdown V1 — validation.
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
  PHARMACY_FIRST_BODY_PHRASES,
  validateSectionCompleteness,
  validateServiceBodyContent,
} from "../src/pharmacy/pharmacyGenerationIntegrityService.ts";
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";
import { resolveVisualExperienceHtmlPath } from "../src/pharmacy/pharmacyVisualExperience.ts";

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

function readRoute(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function readVisualHtml(slug: string, serviceId: string): string | null {
  const p = resolveVisualExperienceHtmlPath(serviceId as never, slug);
  if (!p || !fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

async function validateTenantService(slugArg: string, serviceId: string) {
  const slug = resolveTenantProfileSlug(slugArg) || slugArg;
  const prefix = `${slug}/${serviceId}`;

  console.log(`\n=== ${prefix} ===\n`);

  const pkgService = readRoute("src/pharmacy/pharmacyContentPackageService.ts");
  record(
    `${prefix}:no-pharmacy-first-fallback`,
    !pkgService.includes('"pharmacy-first-master-v1.md"'),
    "resolveMasterLibraryPath must not fall back to pharmacy-first",
  );

  const gen = await generateContentPackage(slug, serviceId);
  record(`${prefix}:generation`, gen.ok, gen.ok ? "package valid" : gen.error || "failed");

  const report = loadGenerationReport(slug, serviceId);
  record(`${prefix}:generation-report`, Boolean(report?.generatedAt), report?.generatedAt || "missing");
  record(
    `${prefix}:report-service-id`,
    report?.serviceId === serviceId,
    `report.serviceId=${report?.serviceId}`,
  );
  record(
    `${prefix}:report-paths`,
    Boolean(report?.masterPublishPath || report?.clinicalReferencePath),
    report?.masterPublishPath || report?.clinicalReferencePath || "no master path",
  );
  if (serviceId === "blood-pressure-checks") {
    record(
      `${prefix}:report-master-path`,
      Boolean(report?.serviceMasterPath?.includes("blood-pressure-checks-master-v1.md")),
      report?.serviceMasterPath || "missing",
    );
    record(
      `${prefix}:no-missing-master-warning`,
      !report?.warnings.some((w) => w.includes("Markdown master missing") || w.includes("Master file not found")),
      report?.warnings.filter((w) => w.includes("master") || w.includes("Master file")).join("; ") || "clean",
    );
  }

  const manifest = loadContentPackage(slug, serviceId);
  record(`${prefix}:manifest-validation`, Boolean(manifest?.packageValidation), manifest?.packageValidation?.detail || "missing");

  const servicePage = manifest?.assets.find((a) => a.type === "service-page");
  if (servicePage?.outputPath && servicePage.included) {
    record(`${prefix}:manifest-file-exists`, fs.existsSync(servicePage.outputPath), servicePage.outputPath);
  } else {
    record(`${prefix}:manifest-file-exists`, !servicePage?.included, "not marked included");
  }

  const html = readVisualHtml(slug, serviceId);
  if (html) {
    const body = validateServiceBodyContent(html, serviceId);
    record(
      `${prefix}:correct-body`,
      body.ok,
      body.errors.join(", ") || "service body ok",
    );
    if (serviceId !== "pharmacy-first") {
      const foreign = PHARMACY_FIRST_BODY_PHRASES.filter((p) => html.toLowerCase().includes(p.toLowerCase()));
      record(`${prefix}:no-pharmacy-first-body`, foreign.length === 0, foreign.join(", ") || "clean");
    }
    const sections = validateSectionCompleteness(html, serviceId);
    record(
      `${prefix}:sections-populated`,
      sections.ok,
      sections.sectionsMissing.join(", ") || sections.emptySections.join(", ") || "all required sections ok",
    );
    if (slug !== "pharmaconnect") {
      record(`${prefix}:no-brook`, !/Brook Pharmacy/i.test(html), "tenant isolation");
    }
  } else {
    record(`${prefix}:visual-html`, false, "visual page missing");
  }

  const approval = packageCanBeApproved(report);
  record(`${prefix}:approval-gate`, approval.ok === gen.ok, approval.message);

  if (gen.ok) {
    try {
      approveContentPackage(slug, serviceId, "lockdown-validation");
      record(`${prefix}:approve-valid`, true, "approved when valid");
    } catch (err) {
      record(`${prefix}:approve-valid`, false, String(err));
    }
  } else {
    let blocked = false;
    try {
      approveContentPackage(slug, serviceId, "lockdown-validation");
    } catch {
      blocked = true;
    }
    record(`${prefix}:approve-blocked`, blocked, blocked ? "approval blocked" : "should have blocked");
  }
}

const reviewPage = readRoute("artifacts/api-server/src/routes/pharmacyAssetReviewPage.ts");
const createPage = readRoute("artifacts/api-server/src/routes/pharmacyContentPackagePage.ts");
record("review-technical-details", reviewPage.includes("Technical details (admin)"), "generation report on review");
record("create-technical-details", createPage.includes("Technical details (admin)"), "generation report on create");
record("integrity-service", fs.existsSync(path.join(ROOT, "src/pharmacy/pharmacyGenerationIntegrityService.ts")), "integrity service exists");
record(
  "blood-pressure-master-exists",
  fs.existsSync(path.join(ROOT, "docs/pharmacy-master-library/blood-pressure-checks-master-v1.md")),
  "blood-pressure-checks-master-v1.md",
);

await validateTenantService("pharmaconnect", "pharmacy-first");
await validateTenantService("pharmaconnect", "blood-pressure-checks");
await validateTenantService("dhmdigital", "blood-pressure-checks");

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) {
  console.error("\nFailed checks:");
  for (const f of failed) console.error(`  - ${f.id}: ${f.detail}`);
  process.exit(1);
}
