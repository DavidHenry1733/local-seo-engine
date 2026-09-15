#!/usr/bin/env npx tsx
/**
 * Sprint 5E — generic Brand DNA fidelity validation.
 */
import fs from "node:fs";
import { extractBrandDnaFromWebsiteEvidence } from "../src/pharmacy/pharmacyBrandDnaWebsiteExtraction.ts";
import { persistWebsiteDerivedBrandDna } from "../src/pharmacy/pharmacyBrandDnaExtractionPersistence.ts";
import { resolveBrandDnaForRender } from "../src/pharmacy/pharmacyBrandDnaEngine.ts";
import { isBrandDnaFallbackOnly } from "../src/pharmacy/pharmacyBrandDnaEngine.ts";
import { getPharmacyBrandDnaPath } from "../src/pharmacy/pharmacyBrandDnaStore.ts";
import { resolveSemanticFromLegacyColours } from "../src/pharmacy/pharmacyBrandDnaSemanticColours.ts";

const broomSlug = "broom-lane-pharmacy";
const archwaySlug = "archway-pharmcy";
const fallbackSlug = "pharmaconnect";

async function extractTenant(slug: string) {
  const extracted = await extractBrandDnaFromWebsiteEvidence(slug);
  if (!extracted) return null;
  persistWebsiteDerivedBrandDna(slug, extracted.dna, extracted.report);
  return extracted;
}

async function main() {
  const broom = await extractTenant(broomSlug);
  const archway = await extractTenant(archwaySlug);
  const broomDna = resolveBrandDnaForRender(broomSlug);
  const archwayDna = fs.existsSync(getPharmacyBrandDnaPath(archwaySlug))
    ? resolveBrandDnaForRender(archwaySlug)
    : null;
  const fallbackOnly = isBrandDnaFallbackOnly(fallbackSlug);

  const broomSemantic = broomDna.semanticColours || resolveSemanticFromLegacyColours(broomDna.colours);
  const archwaySemantic = archwayDna
    ? archwayDna.semanticColours || resolveSemanticFromLegacyColours(archwayDna.colours)
    : null;

  const broomHeadingDark = broomSemantic.headingPrimary.toLowerCase() === "#0e0c0a";
  const broomHeaderWhite = broomSemantic.headerBackground.toLowerCase() === "#ffffff" || broomSemantic.headerBackground.toLowerCase() === "#f8f9fa";
  const broomTopBarGreen = broomSemantic.topBarBackground.toLowerCase() === "#66a960";
  const broomActionGreen = broomSemantic.primaryAction.toLowerCase() === "#66a960";
  const broomNavSeparated = (broom?.dna.detectedServiceLinks?.length || 0) > 0 && (broom?.dna.navigation?.confirmedItems?.length || 0) === 5;
  const broomSecondaryCta = Boolean(broom?.dna.navigation?.secondaryCta?.href?.includes("nominate"));
  const tenantsDiffer = archwaySemantic ? broomSemantic.primaryAction !== archwaySemantic.primaryAction : false;
  const noSlugConditions = !fs.readFileSync(
    `${process.cwd()}/src/pharmacy/pharmacyBrandDnaSemanticColours.ts`,
    "utf8",
  ).includes('slug === "broom-lane-pharmacy"');

  console.log(
    JSON.stringify(
      {
        broomLane: {
          extracted: Boolean(broom),
          completeness: broom?.report.completeness?.overall,
          semanticHeadingDark: broomHeadingDark,
          headerWhite: broomHeaderWhite,
          topBarGreen: broomTopBarGreen,
          actionGreen: broomActionGreen,
          navSeparated: broomNavSeparated,
          secondaryCta: broomSecondaryCta,
          styleEvidenceCount: broom?.report.styleEvidence?.length || 0,
          conflictCount: broom?.report.conflicts?.length || 0,
        },
        archway: {
          extracted: Boolean(archway),
          primary: archwayDna?.colours.primary,
          completeness: archway?.report.completeness?.overall,
        },
        genericValidation: {
          noSlugConditions,
          tenantsDiffer,
          fallbackOnly,
          pass: broomHeadingDark && broomHeaderWhite && broomTopBarGreen && broomActionGreen && broomNavSeparated && tenantsDiffer && fallbackOnly && noSlugConditions,
        },
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
