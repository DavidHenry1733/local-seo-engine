#!/usr/bin/env npx tsx
/**
 * Rebind campaign intelligence — re-renders service page + ecosystem from frozen context.
 * Does not run generation engine or modify templates.
 */
import { buildBenchmarkServiceEcosystemFromSlug } from "../src/pharmacy/benchmarkServiceEcosystemBuilder.ts";
import { buildVisualExperiencePage } from "../src/pharmacy/pharmacyVisualExperience.ts";

const slug = process.argv[2] || "broom-lane-pharmacy";
const campaignId = process.argv[3] || "pharmacy-first";

const visual = buildVisualExperiencePage(slug, campaignId as "pharmacy-first");
const ecosystem = buildBenchmarkServiceEcosystemFromSlug(campaignId, slug);

console.log(
  JSON.stringify(
    {
      slug,
      campaignId,
      servicePage: visual.outputPath,
      ecosystemAssets: ecosystem.assets.length,
      localPages: ecosystem.assets.filter((a) => a.type === "Local cluster page").length,
    },
    null,
    2,
  ),
);
