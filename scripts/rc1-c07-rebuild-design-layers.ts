#!/usr/bin/env npx tsx
import { applyWebsiteImportDesignPipeline } from "../src/pharmacy/pharmacyWebsiteImportDesignPipeline.ts";
import { buildCanonicalFinalRender } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { preparePharmacyPublishOutput } from "../src/pharmacy/pharmacyLivePublishService.ts";
import { resolveDesignLineageSnapshot } from "../src/pharmacy/pharmacyDesignLineageRevisionService.ts";

const slug = process.argv[2] || "banner-cross-pharmacy";
const service = process.argv[3] || "pharmacy-first";

async function main() {
  const pipeline = await applyWebsiteImportDesignPipeline(slug);
  console.log("pipeline", pipeline);
  await buildCanonicalFinalRender(slug, service);
  preparePharmacyPublishOutput(slug, service);
  console.log("lineage", resolveDesignLineageSnapshot(slug));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
