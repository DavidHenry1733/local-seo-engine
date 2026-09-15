#!/usr/bin/env npx tsx
/**
 * Resolve and persist Component DNA to brand-dna.json (Sprint 5G).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveComponentsFromWebsiteEvidence } from "../src/pharmacy/pharmacyBrandDnaComponentResolver.ts";
import { resolveComponentDna } from "../src/pharmacy/pharmacyComponentDnaResolver.ts";
import { normalizeComponentDna } from "../src/pharmacy/pharmacyComponentDnaNormalize.ts";
import { getPharmacyBrandDnaPath } from "../src/pharmacy/pharmacyBrandDnaStore.ts";
import type { BrandDnaV1 } from "../src/pharmacy/pharmacyBrandDnaTypes.ts";

const slug = process.argv[2] || "broom-lane-pharmacy";
const dnaPath = getPharmacyBrandDnaPath(slug);
const evidencePath = path.join(path.dirname(dnaPath), "brand-dna-extraction-evidence.json");

if (!fs.existsSync(dnaPath)) {
  console.error(JSON.stringify({ ok: false, error: "brand-dna.json missing", dnaPath }));
  process.exit(1);
}

const brand = JSON.parse(fs.readFileSync(dnaPath, "utf8")) as BrandDnaV1;
const evidence = fs.existsSync(evidencePath)
  ? (JSON.parse(fs.readFileSync(evidencePath, "utf8")).fields as Record<string, { confidence?: number; extractionMethod?: string; source?: string; value?: unknown }>)
  : {};

const resolved = resolveComponentsFromWebsiteEvidence(slug, evidence, brand);
const withComponents: BrandDnaV1 = { ...brand, components: resolved.components, componentEvidence: resolved.componentEvidence };
const componentDna = normalizeComponentDna(resolveComponentDna(withComponents));

const updated: BrandDnaV1 = {
  ...withComponents,
  componentDna,
  frozenAt: new Date().toISOString(),
};

fs.writeFileSync(dnaPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      ok: true,
      slug,
      dnaPath,
      componentDnaKeys: Object.keys(componentDna),
      variants: componentDna.variants,
    },
    null,
    2,
  ),
);
