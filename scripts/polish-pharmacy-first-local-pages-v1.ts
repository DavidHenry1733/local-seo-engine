#!/usr/bin/env npx tsx
/**
 * Sprint 4A RD015 — polish browser-visible commercial defects on Pharmacy First local pages.
 */
import { polishAllPharmacyFirstLocalPages } from "../src/pharmacy/pharmacyFirstLocalPagePolish.ts";

const slug = process.argv[2] || "broom-lane-pharmacy";
const serviceKey = process.argv[3] || "pharmacy-first";

const results = polishAllPharmacyFirstLocalPages(slug, serviceKey);
console.log(JSON.stringify({ slug, serviceKey, updated: results.filter((r) => r.ok).length, results }, null, 2));
