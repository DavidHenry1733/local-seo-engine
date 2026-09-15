#!/usr/bin/env npx tsx
/**
 * Sprint 4A RD016 — re-render local cluster visual shell from frozen context,
 * preserving existing narrative HTML.
 */
import { rebindPharmacyFirstLocalClusterPages } from "../src/pharmacy/rebindPharmacyFirstLocalPages.ts";

const slug = process.argv[2] || "broom-lane-pharmacy";
const campaignId = process.argv[3] || "pharmacy-first";

const result = rebindPharmacyFirstLocalClusterPages(slug, campaignId, {
  preserveExistingNarrative: true,
});
console.log(JSON.stringify(result, null, 2));
