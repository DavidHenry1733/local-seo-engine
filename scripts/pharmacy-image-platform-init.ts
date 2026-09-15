#!/usr/bin/env npx tsx
/**
 * Initialize PharmaConnect Image Platform V1 directory structure and service catalogs.
 */
import { IMAGE_PLATFORM_DIRECTORY_STRUCTURE } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformPaths.ts";
import { listPlatformServiceIds, writeAllServiceCatalogs } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformRequirements.ts";
import { generateLibraryManifest } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformManifestService.ts";
import {
  buildLibraryHealthReport,
  buildMissingAssetsReport,
} from "../src/pharmacy/imagePlatform/pharmacyImagePlatformReportService.ts";
import { buildBrowserValidationPlan } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformBrowserValidationSupport.ts";

function main() {
  const catalogs = writeAllServiceCatalogs();
  const manifest = generateLibraryManifest();
  const health = buildLibraryHealthReport();
  const missing = buildMissingAssetsReport();
  buildBrowserValidationPlan("pharmacy-first");

  console.log(
    JSON.stringify(
      {
        status: "READY FOR IMAGE POPULATION",
        services: listPlatformServiceIds().length,
        catalogsWritten: catalogs.length,
        platformRevision: manifest.platformRevision,
        approvedContentAssets: health.approvedContentAssets,
        totalMissingSlots: missing.totalMissingSlots,
        directoryStructure: IMAGE_PLATFORM_DIRECTORY_STRUCTURE,
      },
      null,
      2,
    ),
  );
}

main();
