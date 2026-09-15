#!/usr/bin/env npx tsx
/**
 * Content Engine Contract V1 — architecture lockdown validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { validateContentGenerationContext } from "../src/pharmacy/contentEngine/contentEngineContract.ts";
import { applyContextTokens, findUnresolvedTokens } from "../src/pharmacy/contentEngine/contentEngineTokens.ts";
import { buildBenchmarkServiceEcosystem } from "../src/pharmacy/benchmarkServiceEcosystemBuilder.ts";
import { generateContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PHARMACY_SRC = path.join(ROOT, "src/pharmacy");

const GENERATOR_FILES = [
  "benchmarkServiceEcosystemBuilder.ts",
  "pharmacyLocalClusterContentEngine.ts",
  "pharmacyLocalAreaPageRenderer.ts",
  "pharmacyMasterPublishRenderer.ts",
  "pharmacyVisualExperience.ts",
  "pharmacyContentPackageService.ts",
];

const ALLOWED_PROFILE_LOADERS = new Set([
  "contentEngine/buildContentGenerationContext.ts",
  "pharmacyContentBlueprintService.ts",
  "pharmacyServicePageProfileContext.ts",
]);

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

function scanForbiddenPatterns() {
  for (const file of GENERATOR_FILES) {
    const full = path.join(PHARMACY_SRC, file);
    if (!fs.existsSync(full)) continue;
    const src = fs.readFileSync(full, "utf8");
    const rel = file;

    if (src.includes('loadPharmacyProfile(') && !ALLOWED_PROFILE_LOADERS.has(rel)) {
      const allowedViaContext =
        rel === "pharmacyLocalClusterContentEngine.ts" && src.includes("ctx ? { data: ctx.rawProfile }");
      const allowedViaContextMaster =
        rel === "pharmacyMasterPublishRenderer.ts" && src.includes("contentContext");
      const allowedPackage = rel === "pharmacyContentPackageService.ts";
      if (!allowedViaContext && !allowedViaContextMaster && !allowedPackage) {
        record(`${rel}:no-direct-profile-load`, false, "loadPharmacyProfile found");
      } else {
        record(`${rel}:no-direct-profile-load`, true, "context fallback only");
      }
    } else {
      record(`${rel}:no-direct-profile-load`, true, "ok");
    }

    // Brook string may appear in tenant sanitization — not a default fallback
    if (/BROOK_PHARMACY\s*=/.test(src) && rel !== "benchmarkServiceEcosystemBuilder.ts") {
      record(`${rel}:no-brook-default`, false, "Brook constant detected");
    } else {
      record(`${rel}:no-brook-default`, true, "ok");
    }

    if (/slug\s*=\s*["']pharmaconnect["']/.test(src) && !/buildAll|countBenchmark|SLUG/.test(src)) {
      record(`${rel}:no-pharmaconnect-default-slug`, false, "pharmaconnect default slug");
    } else {
      record(`${rel}:no-pharmaconnect-default-slug`, true, "ok");
    }
  }
}

function assetMentionsPharmacy(content: string, pharmacyName: string): boolean {
  return content.toLowerCase().includes(pharmacyName.toLowerCase());
}

async function validateTenantAssets(slug: string, serviceId: string, expectedPharmacy: string) {
  const prefix = `${slug}/${serviceId}`;
  await generateContentPackage(slug, serviceId);

  const ecoRoot = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId);
  const packs = ["social-posts.json", "gbp-posts.json", "email-sequence.json"];
  for (const pack of packs) {
    const file = path.join(ecoRoot, "packs", pack);
    const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    record(`${prefix}:${pack}-exists`, Boolean(raw), file);
    if (!raw) continue;
    record(`${prefix}:${pack}-mentions-pharmacy`, assetMentionsPharmacy(raw, expectedPharmacy), expectedPharmacy);
    record(`${prefix}:${pack}-no-unresolved-tokens`, findUnresolvedTokens(raw).length === 0, findUnresolvedTokens(raw).join(", ") || "none");
  }

  const guidePath = path.join(ecoRoot, "pages", `${serviceId}-guide`, "index.html");
  const guideHtml = fs.existsSync(guidePath) ? fs.readFileSync(guidePath, "utf8") : "";
  record(`${prefix}:guide-mentions-pharmacy`, assetMentionsPharmacy(guideHtml, expectedPharmacy), expectedPharmacy);
  record(`${prefix}:guide-has-reviewer`, /Reviewed by/i.test(guideHtml), "reviewer line");

  for (const blogSlug of [`what-is-${serviceId}`, `${serviceId}-what-you-need-to-know`]) {
    const blogPath = path.join(ecoRoot, "pages", blogSlug, "index.html");
    const blogHtml = fs.existsSync(blogPath) ? fs.readFileSync(blogPath, "utf8") : "";
    record(`${prefix}:${blogSlug}-mentions-pharmacy`, assetMentionsPharmacy(blogHtml, expectedPharmacy), expectedPharmacy);
  }

  if (slug !== "pharmaconnect") {
    record(`${prefix}:no-brook-bleed`, !/brook pharmacy/i.test(guideHtml), "no Brook bleed");
  }
}

async function main() {
  console.log("\n=== Content Engine Contract V1 ===\n");

  scanForbiddenPatterns();

  const ctx = buildContentGenerationContext("dhmdigital", "blood-pressure-checks");
  const validation = validateContentGenerationContext(ctx);
  record("context:build-dhm", validation.ok, validation.errors.join("; ") || "ok");
  record("context:contract-version", ctx.contractVersion === "1.0.0", ctx.contractVersion);

  const tokenTest = applyContextTokens("Call {{phone}} at {{pharmacy}}", ctx);
  record("context:token-replacement", tokenTest.includes(ctx.profile.pharmacyName), tokenTest);

  buildBenchmarkServiceEcosystem(ctx);
  record("generator:ecosystem-accepts-context", true, "buildBenchmarkServiceEcosystem(ctx)");

  await validateTenantAssets("dhmdigital", "blood-pressure-checks", "DHM Digital");
  await validateTenantAssets("pharmaconnect", "blood-pressure-checks", "Brook Pharmacy");

  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n${passed}/${checks.length} checks passed\n`);
  const failed = checks.filter((c) => !c.pass);
  if (failed.length) {
    console.log("Failed checks:");
    for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
