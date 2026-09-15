#!/usr/bin/env npx tsx
/**
 * Long-form supporting content quality lockdown V1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateContentPackage, loadContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import {
  loadGenerationReport,
  packageCanBeApproved,
} from "../src/pharmacy/pharmacyGenerationIntegrityService.ts";
import {
  detectForbiddenHedging,
  detectDuplicateLeadAfterH1,
  longFormPlainText,
  SUPPORTING_PAGE_SLUGS,
  tenantDepthScore,
  validateSupportingPageTemplate,
} from "../src/pharmacy/contentEngine/pharmacyLongFormContentEngine.ts";
import { validateLongFormQuality } from "../src/pharmacy/contentEngine/pharmacyLongFormQualityValidation.ts";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

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

function readPage(slug: string, serviceId: string, pageSlug: string): string {
  const file = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    slug,
    serviceId,
    "pages",
    pageSlug,
    "index.html",
  );
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

async function validateTenant(slugArg: string, serviceId: string, expectedPharmacy: string) {
  const ctx = buildContentGenerationContext(slugArg, serviceId);
  const slug = ctx.resolvedSlug;
  const prefix = `${slug}/${serviceId}`;

  console.log(`\n=== ${prefix} ===\n`);

  await generateContentPackage(slugArg, serviceId);

  const quality = validateLongFormQuality(ctx);
  record(`${prefix}:long-form-quality`, quality.ok, quality.detail);
  record(`${prefix}:no-hedging`, quality.forbiddenHedgingDetected.length === 0, quality.forbiddenHedgingDetected.join(", ") || "none");
  record(`${prefix}:tenant-depth`, quality.longFormTenantDepthValidation.ok, quality.longFormTenantDepthValidation.detail);
  record(`${prefix}:cta-placement`, quality.ctaPlacementValidation.ok, quality.ctaPlacementValidation.detail);
  record(`${prefix}:reviewer-placement`, quality.reviewerPlacementValidation.ok, quality.reviewerPlacementValidation.detail);
  record(
    `${prefix}:template-parity`,
    quality.supportingTemplateValidation.ok,
    quality.supportingTemplateValidation.detail,
  );

  const report = loadGenerationReport(slugArg, serviceId);
  record(`${prefix}:report-long-form`, report?.longFormQualityValidation?.ok ?? false, report?.longFormQualityValidation?.detail || "missing");

  if (!report?.longFormQualityValidation?.ok) {
    const approval = packageCanBeApproved(report);
    record(
      `${prefix}:long-form-approval-blocked`,
      approval.message === "Some supporting content needs improving before this package can be approved.",
      approval.message,
    );
  } else {
    record(`${prefix}:long-form-approval-ready`, true, "long-form validation passed");
  }

  const blogHtml = readPage(slug, serviceId, `what-is-${serviceId}`);
  const blogText = longFormPlainText(blogHtml);
  const depth = tenantDepthScore(blogText, expectedPharmacy);

  record(`${prefix}:what-is-exists`, Boolean(blogHtml), "what-is blog");
  record(`${prefix}:what-is-no-hedging`, detectForbiddenHedging(blogText).length === 0, detectForbiddenHedging(blogText).join(", ") || "none");
  record(`${prefix}:what-is-tenant-middle`, depth.middle, `mentions in middle: ${depth.middle}`);
  record(`${prefix}:what-is-tenant-count`, (blogText.match(new RegExp(expectedPharmacy, "gi")) || []).length >= 3, `${(blogText.match(new RegExp(expectedPharmacy, "gi")) || []).length} mentions`);

  const guideHtml = readPage(slug, serviceId, `${serviceId}-guide`);
  record(`${prefix}:guide-sections`, (guideHtml.match(/<h2/gi) || []).length >= 8, `${(guideHtml.match(/<h2/gi) || []).length} sections`);

  const basePageHtml = readPage(slug, serviceId, serviceId);
  const baseText = longFormPlainText(basePageHtml);
  const baseDepth = tenantDepthScore(baseText, expectedPharmacy);
  const baseTemplate = validateSupportingPageTemplate(basePageHtml);
  record(`${prefix}:base-page-exists`, Boolean(basePageHtml), serviceId);
  record(`${prefix}:base-page-template`, baseTemplate.ok, baseTemplate.issues.join(", ") || "current long-form shell");
  record(`${prefix}:base-page-no-hero`, !basePageHtml.replace(/<style[\s\S]*?<\/style>/gi, "").includes('class="hero-a"'), "no hero-a in body");
  record(`${prefix}:base-page-no-hedging`, detectForbiddenHedging(baseText).length === 0, detectForbiddenHedging(baseText).join(", ") || "none");
  record(`${prefix}:base-page-tenant-middle`, baseDepth.middle, `mentions in middle: ${baseDepth.middle}`);
  record(`${prefix}:base-page-tenant-count`, (baseText.match(new RegExp(expectedPharmacy, "gi")) || []).length >= 3, `${(baseText.match(new RegExp(expectedPharmacy, "gi")) || []).length} mentions`);

  for (const pageSlug of SUPPORTING_PAGE_SLUGS(serviceId)) {
    const html = readPage(slug, serviceId, pageSlug);
    const template = validateSupportingPageTemplate(html);
    record(`${prefix}:template-${pageSlug}`, template.ok, template.issues.join(", ") || "ok");
    if (html.includes('class="eco-lead"')) {
      record(`${prefix}:no-duplicate-lead-${pageSlug}`, !detectDuplicateLeadAfterH1(html), detectDuplicateLeadAfterH1(html) ? "duplicate lead after H1" : "ok");
    }
  }

  const pkg = loadContentPackage(slugArg, serviceId);
  const guideIncluded = pkg?.assets?.some((a) => a.type === "guides" && a.included);
  const blogIncluded = pkg?.assets?.some((a) => a.type === "blog" && a.included);
  record(`${prefix}:long-form-assets-included`, Boolean(guideIncluded && blogIncluded), `guides=${guideIncluded}, blog=${blogIncluded}`);
}

async function main() {
  console.log("\n=== Long-Form Supporting Content Quality V1 ===\n");
  await validateTenant("dhmdigital", "blood-pressure-checks", "DHM Digital");
  await validateTenant("pharmaconnect", "blood-pressure-checks", "Brook Pharmacy");

  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n${passed}/${checks.length} checks passed\n`);
  const failed = checks.filter((c) => !c.pass);
  if (failed.length) {
    console.log("Failed checks:");
    for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
