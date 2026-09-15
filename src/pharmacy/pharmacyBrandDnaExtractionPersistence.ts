/**
 * Persist website-derived Brand DNA — preserves customer overrides.
 */
import fs from "node:fs";
import path from "node:path";
import type { BrandDnaExtractionReport } from "./pharmacyBrandDnaExtractionEvidence.ts";
import type { BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import {
  freezeBrandDna,
  getPharmacyBrandDnaOverridesPath,
  loadBrandDnaOverrides,
} from "./pharmacyBrandDnaStore.ts";
import { getPharmacyBrandDnaExtractionEvidencePath } from "./pharmacyWorkspacePaths.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { validateBrandDnaColours } from "./pharmacyBrandDnaWebsiteExtraction.ts";

export interface PersistWebsiteBrandDnaResult {
  slug: string;
  brandDnaPath: string;
  evidencePath: string;
  overridesPath: string;
  overridesPreserved: boolean;
  populatedCount: number;
  defaultCount: number;
  resolverPrimary: string;
}

export function persistWebsiteDerivedBrandDna(
  slug: string,
  dna: BrandDnaV1,
  report: BrandDnaExtractionReport,
): PersistWebsiteBrandDnaResult {
  const overridesBefore = loadBrandDnaOverrides(slug);
  const overridesPath = getPharmacyBrandDnaOverridesPath(slug);

  const validated = validateBrandDnaColours({ ...dna, slug });
  const brandDnaPath = freezeBrandDna(slug, validated);

  const evidencePath = getPharmacyBrandDnaExtractionEvidencePath(slug);
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, JSON.stringify(report, null, 2), "utf8");

  const overridesAfter = loadBrandDnaOverrides(slug);
  const resolved = resolveBrandDnaForRender(slug);

  return {
    slug,
    brandDnaPath,
    evidencePath,
    overridesPath,
    overridesPreserved: JSON.stringify(overridesBefore) === JSON.stringify(overridesAfter),
    populatedCount: report.populatedFromWebsite.length,
    defaultCount: report.usingDefaults.length,
    resolverPrimary: resolved.colours.primary,
  };
}
