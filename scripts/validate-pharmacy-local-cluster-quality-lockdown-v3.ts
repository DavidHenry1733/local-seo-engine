#!/usr/bin/env npx tsx
/**
 * Local Cluster Quality Lockdown V3 — validation.
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
import {
  LOCAL_PAGE_MIN_WORD_COUNT,
  validateLocalClusterQuality,
} from "../src/pharmacy/pharmacyLocalClusterQualityValidation.ts";
import {
  countNearbyAreaLinks,
  detectEmptyLocalClusterSections,
  localClusterPageHasImage,
  localClusterPageHasIrrelevantHeartSection,
  localPageWordCount,
} from "../src/pharmacy/pharmacyLocalAreaPageDiagnostics.ts";
import { detectAreaPrefixParagraphs } from "../src/pharmacy/pharmacyLocalClusterVariantFamilies.ts";
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
  const file = path.join(ROOT, "output/pharmacy-content-ecosystem", slug, serviceId, "local", areaSlug, "index.html");
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
  record(`${prefix}:no-area-prefix`, quality.areaPrefixDetected.length === 0, quality.areaPrefixDetected.join(", ") || "none");
  record(`${prefix}:copy-depth`, quality.localCopyDepthValidation.ok, quality.localCopyDepthValidation.detail);
  record(`${prefix}:no-duplicate-similarity`, quality.duplicateCopyWarnings.length === 0, quality.duplicateCopyWarnings.join(", ") || "none");
  record(`${prefix}:nearby-links-min`, quality.localNearbyLinksCount >= Math.min(6, Math.max(0, areas.length - 1)), `${quality.localNearbyLinksCount} nearby links`);
  record(`${prefix}:map-business-location`, quality.mapUsesBusinessLocation, quality.mapUsesBusinessLocation ? "ok" : "failed");
  record(`${prefix}:no-heart-section`, quality.irrelevantSectionsDetected.length === 0, quality.irrelevantSectionsDetected.join(", ") || "none");
  record(`${prefix}:service-local-links`, quality.servicePageLocalLinksCount >= areas.length, `${quality.servicePageLocalLinksCount}/${areas.length}`);

  for (const areaName of areas.slice(0, 3)) {
    const areaSlug = slugifyArea(areaName);
    const localHtml = readLocalPage(slug, serviceId, areaSlug);
    record(`${prefix}:${areaSlug}-exists`, Boolean(localHtml), areaName);
    if (!localHtml) continue;

    const words = localPageWordCount(localHtml);
    record(`${prefix}:${areaSlug}-word-count`, words >= LOCAL_PAGE_MIN_WORD_COUNT, `${words} words`);
    record(`${prefix}:${areaSlug}-no-prefix`, detectAreaPrefixParagraphs(localHtml, [areaName]).length === 0, "no Area: prefix");
    record(`${prefix}:${areaSlug}-no-heart`, !localClusterPageHasIrrelevantHeartSection(localHtml), "no heart section");
    record(`${prefix}:${areaSlug}-nearby-count`, countNearbyAreaLinks(localHtml) >= areas.length - 1, `${countNearbyAreaLinks(localHtml)} links`);
    record(`${prefix}:${areaSlug}-image`, localClusterPageHasImage(localHtml), "has img");

    const src = localHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1] || "";
    if (src) {
      const decoded = decodeURIComponent(src.replace(/&amp;/g, "&")).toLowerCase();
      record(`${prefix}:${areaSlug}-map-not-area`, !decoded.includes(areaName.toLowerCase().split(" ")[0]!), "business map");
      record(`${prefix}:${areaSlug}-map-coords-or-address`, /53\.|s60|moorgate|rotherham|\d+\.\d+,-?\d+\.\d+/i.test(decoded), decoded.slice(0, 80));
      record(`${prefix}:${areaSlug}-map-valid`, !isInvalidGenericMapEmbedUrl(src), "valid embed");
    }

    record(`${prefix}:${areaSlug}-sections`, detectEmptyLocalClusterSections(localHtml).length === 0, "complete");
    if (slug !== "pharmaconnect") {
      record(`${prefix}:${areaSlug}-dhm`, localHtml.includes(profile.pharmacyName), profile.pharmacyName);
    }
  }

  if (visualHtml) {
    const serviceSrc = visualHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1] || "";
    if (serviceSrc) {
      const decoded = decodeURIComponent(serviceSrc.replace(/&amp;/g, "&"));
      record(`${prefix}:service-map-valid`, !isInvalidGenericMapEmbedUrl(serviceSrc), validateMapInHtml(visualHtml).detail);
      record(`${prefix}:service-map-business`, /53\.|s60|moorgate|\d+\.\d+,-?\d+\.\d+/i.test(decoded), decoded.slice(0, 80));
    }
  }

  const design = validateDesignMapLockdown(slug, serviceId, visualHtml, readLocalPage(slug, serviceId, slugifyArea(areas[0] || "ecclesall")));
  record(`${prefix}:design-map-lockdown`, design.ok, design.detail);
  record(`${prefix}:local-quality-gate`, quality.ok, quality.detail);

  const report = loadGenerationReport(slug, serviceId);
  record(`${prefix}:report-v3-metrics`, Boolean(report?.localClusterQualityValidation?.localCopyDepthValidation), report?.localClusterQualityValidation?.detail || "missing");

  const manifest = loadContentPackage(slug, serviceId);
  record(`${prefix}:package-generated`, manifest?.status === "generated", manifest?.status || "missing");
  record(`${prefix}:approval-gate`, packageCanBeApproved(report).ok, packageCanBeApproved(report).message);
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
