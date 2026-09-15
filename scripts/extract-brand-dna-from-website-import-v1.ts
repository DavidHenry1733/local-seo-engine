#!/usr/bin/env npx tsx
/**
 * Sprint 5B — populate tenant brand-dna.json from Website Import evidence.
 */
import fs from "node:fs";
import { extractBrandDnaFromWebsiteEvidence } from "../src/pharmacy/pharmacyBrandDnaWebsiteExtraction.ts";
import { persistWebsiteDerivedBrandDna } from "../src/pharmacy/pharmacyBrandDnaExtractionPersistence.ts";
import { loadWebsiteImportSources } from "../src/pharmacy/pharmacyBrandDnaWebsiteImportSources.ts";
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";

const slug = resolveTenantProfileSlug(process.argv[2] || "broom-lane-pharmacy") || process.argv[2] || "broom-lane-pharmacy";

async function main() {
  const sources = loadWebsiteImportSources(slug);
  if (!sources) {
    console.log(JSON.stringify({ ok: false, slug, error: "No website import sources for tenant" }, null, 2));
    process.exit(1);
  }

  const extracted = await extractBrandDnaFromWebsiteEvidence(slug);
  if (!extracted) {
    console.log(JSON.stringify({ ok: false, slug, error: "Extraction failed" }, null, 2));
    process.exit(1);
  }

  const result = persistWebsiteDerivedBrandDna(slug, extracted.dna, extracted.report);
  const saved = JSON.parse(fs.readFileSync(result.brandDnaPath, "utf8"));

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug,
        sourceUrl: sources.sourceUrl,
        brandDnaPath: result.brandDnaPath,
        evidencePath: result.evidencePath,
        populatedCount: result.populatedCount,
        defaultCount: result.defaultCount,
        primary: saved.colours.primary,
        secondary: saved.colours.secondary,
        accent: saved.colours.accent,
        logoUrl: saved.logoUrl,
        headingFont: saved.typography.headingFont,
        bodyFont: saved.typography.bodyFont,
        navigationCount: saved.navigationLinks.length,
        footerCount: saved.footerLinks.length,
        resolverPrimary: result.resolverPrimary,
        overridesPreserved: result.overridesPreserved,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
