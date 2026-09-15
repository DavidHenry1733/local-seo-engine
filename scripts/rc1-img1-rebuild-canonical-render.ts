#!/usr/bin/env npx tsx
/**
 * RC1-IMG1 — Rebuild library assignments + canonical final render (no content/import changes).
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import {
  rebuildTenantLibraryContentImageAssignments,
  tracePageImageSlots,
} from "../src/pharmacy/pharmacyImageLibraryAssignmentService.ts";
import { buildCanonicalFinalRender } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";

const slug = process.argv[2] || "banner-cross-pharmacy";
const service = process.argv[3] || "pharmacy-first";

async function main() {
  const evidenceDir = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/commercial-publish",
    slug,
    "rc1-img1-evidence",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });

  const assignmentResult = rebuildTenantLibraryContentImageAssignments(slug, service);
  fs.writeFileSync(
    path.join(evidenceDir, "image-assignment-rebuild.json"),
    JSON.stringify(assignmentResult, null, 2),
  );

  const trace = tracePageImageSlots(slug, service);
  fs.writeFileSync(path.join(evidenceDir, "image-selection-trace.json"), JSON.stringify(trace, null, 2));

  const render = await buildCanonicalFinalRender(slug, service);
  fs.writeFileSync(
    path.join(evidenceDir, "final-render-manifest-snapshot.json"),
    JSON.stringify(
      {
        imageLibraryRevision: render.manifest.imageLibraryRevision,
        imageFiles: render.manifest.imageFiles,
        pageCount: render.pageCount,
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        slug,
        service,
        assignmentResult,
        renderRoot: render.renderRoot,
        pageCount: render.pageCount,
        imageLibraryRevision: render.manifest.imageLibraryRevision,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
