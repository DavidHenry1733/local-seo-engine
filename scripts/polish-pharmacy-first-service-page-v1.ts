#!/usr/bin/env npx tsx
/**
 * Sprint 4B — polish browser-visible defects on the Pharmacy First service page only.
 * Does not regenerate or rebuild the visual experience pipeline.
 */
import { polishPharmacyFirstServicePageFile } from "../src/pharmacy/pharmacyFirstServicePagePolish.ts";

const slug = process.argv[2] || "broom-lane-pharmacy";
const serviceKey = process.argv[3] || "pharmacy-first";

const result = polishPharmacyFirstServicePageFile(slug, serviceKey);
console.log(JSON.stringify(result, null, 2));
