#!/usr/bin/env npx tsx
/**
 * RC1-R1 — Rebuild canonical render from existing content + Design Intelligence only.
 * Does not rerun Website Import or alter design-intelligence.json.
 */
import { buildCanonicalFinalRender } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { preparePharmacyPublishOutput } from "../src/pharmacy/pharmacyLivePublishService.ts";
import { requireDesignIntelligence, printDesignIntelligenceSummary } from "../src/pharmacy/pharmacyDesignIntelligenceResolver.ts";

const slug = process.argv[2] || "banner-cross-pharmacy";
const service = process.argv[3] || "pharmacy-first";

async function main() {
  const manifest = requireDesignIntelligence(slug);
  printDesignIntelligenceSummary(manifest);
  const result = await buildCanonicalFinalRender(slug, service);
  preparePharmacyPublishOutput(slug, service);
  console.log("canonical render rebuilt", {
    renderRoot: result.renderRoot,
    pageCount: result.pageCount,
    designIntelligenceRevision: result.manifest.designIntelligenceRevision,
    rendererRevision: result.manifest.rendererRevision,
    fallbackBlocks: result.manifest.fallbackBlocks,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
