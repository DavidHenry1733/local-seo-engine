#!/usr/bin/env npx tsx
/**
 * Image Platform V1.2 — Pharmacy First render integration (Banner Cross).
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { rebuildBannerCrossProductionAssignments, previewProductionAssignments } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformBannerCrossAssignmentService.ts";
import { buildCanonicalFinalRender } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";

const SLUG = process.argv[2] || "banner-cross-pharmacy";
const SERVICE = "pharmacy-first";

async function main() {
  const evidenceDir = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/commercial-publish",
    SLUG,
    "rc1-v12-image-platform-integration",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });

  const assignment = rebuildBannerCrossProductionAssignments(SLUG, SERVICE);
  fs.writeFileSync(path.join(evidenceDir, "production-assignments.json"), JSON.stringify(assignment, null, 2));

  const crossTenant = {
    bannerCross: previewProductionAssignments("banner-cross-pharmacy", SERVICE),
    broomLane: previewProductionAssignments("broom-lane-pharmacy", SERVICE),
    pharmaconnect: previewProductionAssignments("pharmaconnect", SERVICE),
    stability: previewProductionAssignments("banner-cross-pharmacy", SERVICE),
  };
  fs.writeFileSync(path.join(evidenceDir, "cross-tenant-preview.json"), JSON.stringify(crossTenant, null, 2));

  const render = await buildCanonicalFinalRender(SLUG, SERVICE);
  fs.writeFileSync(
    path.join(evidenceDir, "final-render-manifest.json"),
    JSON.stringify(render.manifest, null, 2),
  );

  console.log(
    JSON.stringify(
      {
        slug: SLUG,
        assignmentRevision: assignment.revision,
        platformRevision: assignment.platformRevision,
        renderRoot: render.renderRoot,
        imagePlatformSlotMappings: render.manifest.imagePlatformSlotMappings,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
