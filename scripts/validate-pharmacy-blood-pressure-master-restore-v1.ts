#!/usr/bin/env npx tsx
/**
 * Blood Pressure Checks master restore validation V1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildBenchmarkServiceEcosystemFromSlug } from "../src/pharmacy/benchmarkServiceEcosystemBuilder.ts";
import {
  generateContentPackage,
  loadContentPackage,
} from "../src/pharmacy/pharmacyContentPackageService.ts";
import {
  loadGenerationReport,
  PHARMACY_FIRST_BODY_PHRASES,
  validateServiceBodyContent,
} from "../src/pharmacy/pharmacyGenerationIntegrityService.ts";
import {
  countWords,
  loadMasterLibraryFile,
  parseMasterLibraryMarkdown,
} from "../src/pharmacy/pharmacyMasterLibraryParser.ts";
import { resolveVisualExperienceHtmlPath } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MASTER = path.join(ROOT, "docs/pharmacy-master-library/blood-pressure-checks-master-v1.md");

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

console.log("\nBlood Pressure Master Restore V1\n");

record("master-exists", fs.existsSync(MASTER), MASTER);
const md = fs.existsSync(MASTER) ? fs.readFileSync(MASTER, "utf8") : "";
record("master-blood-pressure", /blood pressure/i.test(md), "service-specific copy");
record("master-no-pharmacy-first-body", !PHARMACY_FIRST_BODY_PHRASES.some((p) => md.toLowerCase().includes(p.toLowerCase())), "no PF body phrases");
record("master-no-brook-hardcode", !/Brook Pharmacy/i.test(md), "uses tokens not Brook");
record("master-has-tokens", /\{\{phone\}\}/.test(md) && /\{\{town\}\}/.test(md), "{{phone}} and {{town}}");

const parsed = parseMasterLibraryMarkdown(md, "blood-pressure-checks", "Blood Pressure Checks");
record("master-sections", parsed.sections.length >= 13, `${parsed.sections.length} sections`);
record("master-faqs", parsed.faqs.length >= 7, `${parsed.faqs.length} FAQs`);
record("master-word-count", countWords(md) >= 2500, `${countWords(md)} words`);

try {
  buildBenchmarkServiceEcosystemFromSlug("blood-pressure-checks", "pharmaconnect");
  record("ecosystem-pharmaconnect", true, "ecosystem built from master");
} catch (err) {
  record("ecosystem-pharmaconnect", false, String(err));
}

for (const slugArg of ["pharmaconnect", "dhmdigital"]) {
  const slug = resolveTenantProfileSlug(slugArg) || slugArg;
  const prefix = slug;

  await generateContentPackage(slug, "blood-pressure-checks");
  const report = loadGenerationReport(slug, "blood-pressure-checks");
  const manifest = loadContentPackage(slug, "blood-pressure-checks");
  const visualPath = resolveVisualExperienceHtmlPath("blood-pressure-checks", slug);
  const html = visualPath && fs.existsSync(visualPath) ? fs.readFileSync(visualPath, "utf8") : "";

  record(`${prefix}:no-missing-master-warning`, !report?.warnings.some((w) => w.includes("Markdown master missing")), report?.serviceMasterPath || "master path set");
  record(`${prefix}:service-master-path`, Boolean(report?.serviceMasterPath?.includes("blood-pressure-checks-master-v1.md")), report?.serviceMasterPath || "missing");
  record(`${prefix}:no-clinical-fallback-only`, !report?.warnings.some((w) => w.includes("clinical reference")), "primary source is master markdown");

  if (html) {
    const body = validateServiceBodyContent(html, "blood-pressure-checks");
    record(`${prefix}:visual-body-ok`, body.ok, body.foreignServiceContentDetected.join(", ") || "ok");
    if (slug !== "pharmaconnect") {
      record(`${prefix}:tenant-name`, html.includes("DHM Digital"), "DHM Digital present");
      record(`${prefix}:no-brook`, !/Brook Pharmacy/i.test(html), "no Brook in tenant output");
    }
  }

  const ecoDir = path.join(ROOT, "output/pharmacy-content-ecosystem", slug, "blood-pressure-checks");
  const faqAsset = manifest?.assets.find((a) => a.type === "faq");
  const guideAsset = manifest?.assets.find((a) => a.type === "guides");
  const blogAsset = manifest?.assets.find((a) => a.type === "blog");
  const gbpAsset = manifest?.assets.find((a) => a.type === "gbp");
  record(`${prefix}:faq-asset`, Boolean(faqAsset?.included), faqAsset?.outputPath || faqAsset?.status || "planned");
  record(`${prefix}:guide-asset`, Boolean(guideAsset?.included), guideAsset?.outputPath || guideAsset?.status || "planned");
  record(`${prefix}:blog-asset`, Boolean(blogAsset?.included), blogAsset?.count ? `${blogAsset.count} posts` : blogAsset?.status || "planned");
  record(`${prefix}:gbp-asset`, Boolean(gbpAsset?.included), gbpAsset?.status || "planned");

  const servicePage = manifest?.assets.find((a) => a.type === "service-page");
  record(`${prefix}:manifest-service-included`, Boolean(servicePage?.included), servicePage?.status || "missing");
  record(`${prefix}:package-valid`, report?.packageValidation.ok === true, report?.packageValidation.detail || "invalid");
}

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) {
  for (const f of failed) console.error(`  - ${f.id}: ${f.detail}`);
  process.exit(1);
}
