#!/usr/bin/env npx tsx
/**
 * Local Cluster Quality Lockdown V2 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateContentPackage,
  loadContentPackage,
} from "../src/pharmacy/pharmacyContentPackageService.ts";
import {
  loadGenerationReport,
  packageCanBeApproved,
  validateDesignMapLockdown,
} from "../src/pharmacy/pharmacyGenerationIntegrityService.ts";
import { validateLocalClusterQuality } from "../src/pharmacy/pharmacyLocalClusterQualityValidation.ts";
import {
  detectEmptyLocalClusterSections,
  localClusterPageHasImage,
} from "../src/pharmacy/pharmacyLocalAreaPageDiagnostics.ts";
import { isInvalidGenericMapEmbedUrl, validateMapInHtml } from "../src/pharmacy/pharmacyMapResolver.ts";
import { slugifyArea } from "../src/pharmacy/pharmacyAreaNarrativeProfiles.ts";
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";
import { resolveVisualExperienceHtmlPath } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { loadPharmacyProfile } from "../src/pharmacy/pharmacyContentBlueprintService.ts";

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

function readLocalPage(slug: string, serviceId: string, areaSlug: string): string | null {
  const file = path.join(
    ROOT,
    "output/pharmacy-content-ecosystem",
    slug,
    serviceId,
    "local",
    areaSlug,
    "index.html",
  );
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}

function selectedAreas(slug: string): string[] {
  const key = resolveTenantProfileSlug(slug) || slug;
  const doc = loadPharmacyProfile(key);
  return (doc?.data?.selectedAreas || [])
    .filter((a) => a.selected !== false)
    .map((a) => a.areaName);
}

async function validateTenant(slugArg: string, serviceId: string) {
  const slug = resolveTenantProfileSlug(slugArg) || slugArg;
  const prefix = `${slug}/${serviceId}`;
  const profile = buildPharmacyServicePageProfile(slug);
  const areas = selectedAreas(slugArg);

  console.log(`\n=== ${prefix} (${areas.length} areas) ===\n`);

  await generateContentPackage(slugArg, serviceId);

  const visualPath = resolveVisualExperienceHtmlPath(serviceId as never, slug);
  const visualHtml = visualPath && fs.existsSync(visualPath) ? fs.readFileSync(visualPath, "utf8") : "";
  record(`${prefix}:visual-exists`, Boolean(visualHtml), visualPath || "missing");

  const quality = validateLocalClusterQuality(slugArg, serviceId, areas, visualHtml);
  record(`${prefix}:local-count`, quality.localPagesGenerated === quality.localPagesExpected, `${quality.localPagesGenerated}/${quality.localPagesExpected}`);
  record(`${prefix}:local-images`, quality.localPagesWithImages === quality.localPagesExpected, `${quality.localPagesWithImages} with images`);
  record(`${prefix}:local-business-map`, quality.localPagesWithBusinessMap === quality.localPagesExpected, `${quality.localPagesWithBusinessMap} business maps`);
  record(`${prefix}:local-area-copy`, quality.localPagesWithAreaSpecificCopy === quality.localPagesExpected, `${quality.localPagesWithAreaSpecificCopy} unique pages`);
  record(`${prefix}:local-internal-links`, quality.localPagesWithInternalLinks === quality.localPagesExpected, `${quality.localPagesWithInternalLinks} with links`);
  record(`${prefix}:local-money-links`, quality.localPagesWithMoneyLinks === quality.localPagesExpected, `${quality.localPagesWithMoneyLinks} with money links`);
  record(`${prefix}:no-duplicate-copy`, quality.duplicateCopyWarnings.length === 0, quality.duplicateCopyWarnings.join(", ") || "none");
  record(`${prefix}:no-empty-sections`, quality.emptySectionsDetected.length === 0, quality.emptySectionsDetected.join(", ") || "none");
  record(`${prefix}:service-links-local`, quality.servicePageLinksAllLocalAreas, "service page links all local areas");

  for (const areaName of areas.slice(0, 3)) {
    const areaSlug = slugifyArea(areaName);
    const localHtml = readLocalPage(slug, serviceId, areaSlug);
    record(`${prefix}:${areaSlug}-exists`, Boolean(localHtml), areaName);
    if (!localHtml) continue;

    record(`${prefix}:${areaSlug}-dhm`, localHtml.includes(profile.pharmacyName), profile.pharmacyName);
    record(`${prefix}:${areaSlug}-area`, localHtml.toLowerCase().includes(areaName.toLowerCase()), areaName);
    record(`${prefix}:${areaSlug}-image`, localClusterPageHasImage(localHtml), "has img");
    record(`${prefix}:${areaSlug}-design`, localHtml.includes("data-publish-source=\"local-area-v1\""), "local-area-v1");
    record(`${prefix}:${areaSlug}-main-link`, /pharmacy-visual-experience|Main .* page/i.test(localHtml), "main service link");

    const localMap = validateMapInHtml(localHtml);
    record(`${prefix}:${areaSlug}-map-ok`, localMap.ok, localMap.detail);
    const src = localHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1] || "";
    if (src) {
      record(
        `${prefix}:${areaSlug}-map-not-area`,
        !decodeURIComponent(src).toLowerCase().includes(areaName.toLowerCase().split(" ")[0]!),
        "map not centred on area only",
      );
      record(`${prefix}:${areaSlug}-map-src-valid`, !isInvalidGenericMapEmbedUrl(src), src.slice(0, 100));
    }

    const empty = detectEmptyLocalClusterSections(localHtml);
    record(`${prefix}:${areaSlug}-sections-complete`, empty.length === 0, empty.join(", ") || "ok");

    if (slug !== "pharmaconnect") {
      record(`${prefix}:${areaSlug}-no-brook`, !/Brook Pharmacy/i.test(localHtml), "no Brook");
      record(`${prefix}:${areaSlug}-no-pf-body`, !/Pharmacy First is an NHS advanced service/i.test(localHtml), "no PF body");
    }
  }

  if (visualHtml && areas.length) {
    for (const areaName of areas) {
      const areaSlug = slugifyArea(areaName);
      record(
        `${prefix}:service-link-${areaSlug}`,
        visualHtml.includes(`local/${areaSlug}`),
        `service → ${areaName}`,
      );
    }
  }

  const sampleLocal = readLocalPage(slug, serviceId, slugifyArea(areas[0] || "ecclesall"));
  const design = validateDesignMapLockdown(slug, serviceId, visualHtml, sampleLocal);
  record(`${prefix}:design-map-lockdown`, design.ok, design.detail);
  record(`${prefix}:local-quality-gate`, quality.ok, quality.detail);

  const report = loadGenerationReport(slug, serviceId);
  record(`${prefix}:report-quality-metrics`, Boolean(report?.localClusterQualityValidation), report?.localClusterQualityValidation?.detail || "missing");

  const manifest = loadContentPackage(slug, serviceId);
  record(`${prefix}:package-generated`, manifest?.status === "generated", manifest?.status || "missing");

  const approval = packageCanBeApproved(report);
  record(`${prefix}:approval-gate`, approval.ok, approval.message);
}

async function main() {
  await validateTenant("dhmdigital", "blood-pressure-checks");
  await validateTenant("pharmaconnect", "blood-pressure-checks");

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) {
    console.log("\nFailed checks:");
    for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
