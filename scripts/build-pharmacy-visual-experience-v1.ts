#!/usr/bin/env npx tsx
/**
 * Build all benchmark pharmacy visual experience pages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAllVisualExperiencePages,
  renderVisualExperienceIndex,
  PHARMACY_VISUAL_PIPELINE_VERSION,
} from "../src/pharmacy/pharmacyVisualExperience.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";

const results = buildAllVisualExperiencePages(slug);
const outDir = path.join(ROOT, "output/pharmacy-visual-experience", slug);
fs.mkdirSync(outDir, { recursive: true });

const indexPath = path.join(outDir, "index.html");
fs.writeFileSync(indexPath, renderVisualExperienceIndex(slug, results), "utf8");

const manifest = {
  version: 2,
  pipelineVersion: PHARMACY_VISUAL_PIPELINE_VERSION,
  generatedAt: new Date().toISOString(),
  slug,
  results,
};
fs.writeFileSync(path.join(outDir, "_visual-experience-index.json"), JSON.stringify(manifest, null, 2), "utf8");

console.log(`Built ${results.length} visual pages (${PHARMACY_VISUAL_PIPELINE_VERSION}) for ${slug}`);
for (const r of results) {
  console.log(`  ✓ ${r.serviceId} → ${r.outputPath}`);
}
