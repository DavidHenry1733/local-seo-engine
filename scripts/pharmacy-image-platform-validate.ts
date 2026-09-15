#!/usr/bin/env npx tsx
/**
 * Validate image platform library and emit reports.
 */
import fs from "node:fs";
import path from "node:path";
import { validateImagePlatformLibrary } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformValidationService.ts";
import { generateLibraryManifest } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformManifestService.ts";
import {
  buildLibraryHealthReport,
  buildMissingAssetsReport,
} from "../src/pharmacy/imagePlatform/pharmacyImagePlatformReportService.ts";
import { healthReportAbs } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformPaths.ts";

function main() {
  const validation = validateImagePlatformLibrary();
  const manifest = generateLibraryManifest();
  const health = buildLibraryHealthReport();
  const missing = buildMissingAssetsReport();

  const out = {
    validation,
    platformRevision: manifest.platformRevision,
    health,
    missing,
    reports: {
      health: healthReportAbs(),
      missing: path.join(path.dirname(healthReportAbs()), "missing-assets.json"),
    },
  };

  fs.writeFileSync(
    path.join(path.dirname(healthReportAbs()), "latest-validation.json"),
    JSON.stringify(out, null, 2),
  );

  console.log(JSON.stringify(out, null, 2));
  if (!validation.valid) process.exit(1);
}

main();
