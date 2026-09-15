#!/usr/bin/env npx tsx
/**
 * Rebind Pharmacy First local cluster pages only (8 frozen areas).
 * Does not regenerate service page, guide, blogs, or other ecosystem assets.
 */
import { rebindPharmacyFirstLocalClusterPages } from "../src/pharmacy/rebindPharmacyFirstLocalPages.ts";

const slug = process.argv[2] || "broom-lane-pharmacy";
const campaignId = process.argv[3] || "pharmacy-first";

const result = rebindPharmacyFirstLocalClusterPages(slug, campaignId);
console.log(JSON.stringify(result, null, 2));
