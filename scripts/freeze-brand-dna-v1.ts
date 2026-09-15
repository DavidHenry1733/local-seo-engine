#!/usr/bin/env npx tsx
/**
 * Sprint 4C — extract and freeze canonical Brand DNA from Website Import.
 */
import { extractBrandDnaFromWebsiteImport, validateBrandDnaColours } from "../src/pharmacy/pharmacyBrandDnaExtractor.ts";
import { freezeBrandDna } from "../src/pharmacy/pharmacyBrandDnaStore.ts";

const slug = process.argv[2] || "broom-lane-pharmacy";

const extracted = extractBrandDnaFromWebsiteImport(slug);
if (!extracted) {
  console.log(JSON.stringify({ ok: false, slug, error: "No website import brand signals available" }, null, 2));
  process.exit(1);
}

const dna = validateBrandDnaColours(extracted);
const path = freezeBrandDna(slug, dna);
console.log(JSON.stringify({ ok: true, slug, path, frozenAt: dna.frozenAt, source: dna.source }, null, 2));
