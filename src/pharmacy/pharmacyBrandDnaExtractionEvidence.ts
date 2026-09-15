/**
 * Brand DNA extraction evidence — per-field provenance (separate from engine model).
 */
export type BrandDnaEvidenceSource =
  | "website-import"
  | "website-css"
  | "website-html"
  | "website-intelligence"
  | "platform-default";

export interface BrandDnaFieldEvidence {
  value: string | number | boolean | null;
  source: BrandDnaEvidenceSource;
  evidenceSource: string;
  extractionMethod: string;
  confidence: number;
  importedAt: string;
  selectorOrProperty?: string;
}

export interface BrandDnaExtractionReport {
  version: "brand-dna-extraction-v1";
  slug: string;
  sourceUrl: string;
  extractedAt: string;
  fields: Record<string, BrandDnaFieldEvidence>;
  populatedFromWebsite: string[];
  usingDefaults: string[];
  styleEvidence?: import("./pharmacyBrandDnaSemanticTypes.ts").BrandDnaStyleEvidenceSample[];
  conflicts?: import("./pharmacyBrandDnaSemanticTypes.ts").BrandDnaConflict[];
  completeness?: import("./pharmacyBrandDnaSemanticTypes.ts").BrandDnaCompletenessScore;
}

export function fieldEvidence(
  value: string | number | boolean | null,
  source: BrandDnaEvidenceSource,
  evidenceSource: string,
  extractionMethod: string,
  confidence: number,
  importedAt: string,
  selectorOrProperty?: string,
): BrandDnaFieldEvidence {
  return {
    value,
    source,
    evidenceSource,
    extractionMethod,
    confidence,
    importedAt,
    selectorOrProperty,
  };
}

export function emptyExtractionReport(slug: string, sourceUrl: string): BrandDnaExtractionReport {
  return {
    version: "brand-dna-extraction-v1",
    slug,
    sourceUrl,
    extractedAt: new Date().toISOString(),
    fields: {},
    populatedFromWebsite: [],
    usingDefaults: [],
  };
}
