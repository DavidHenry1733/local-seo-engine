/**
 * Growth Engine — competitor ownership classification from Google business name only.
 * Do not guess — only classify when name matches a known pattern.
 */
import type { GrowthEngineCompetitor } from "./growthEngineCompetitorModel.ts";
import type { ClassifiedCompetitor, CompetitorOwnershipType } from "./growthEngineHealthcareModel.ts";

const NATIONAL_CHAIN_PATTERNS: Array<[RegExp, string]> = [
  [/boots/i, "Boots"],
  [/superdrug/i, "Superdrug"],
  [/lloyds/i, "Lloyds"],
  [/well pharmacy/i, "Well"],
  [/asda/i, "ASDA"],
  [/tesco/i, "Tesco"],
  [/morrisons/i, "Morrisons"],
];

const REGIONAL_CHAIN_PATTERNS: Array<[RegExp, string]> = [
  [/rowlands/i, "Rowlands"],
  [/day lewis/i, "Day Lewis"],
  [/cohens/i, "Cohens"],
  [/paydens/i, "Paydens"],
  [/right medicine/i, "Right Medicine"],
  [/peak pharmacy/i, "Peak Pharmacy"],
];

export function classifyCompetitorOwnership(name: string): {
  ownershipType: CompetitorOwnershipType;
  chainBrand: string | null;
} {
  for (const [pattern, brand] of NATIONAL_CHAIN_PATTERNS) {
    if (pattern.test(name)) return { ownershipType: "national", chainBrand: brand };
  }
  for (const [pattern, brand] of REGIONAL_CHAIN_PATTERNS) {
    if (pattern.test(name)) return { ownershipType: "regional", chainBrand: brand };
  }
  if (/pharmacy|chemist/i.test(name)) {
    return { ownershipType: "independent", chainBrand: null };
  }
  return { ownershipType: "unknown", chainBrand: null };
}

export function classifyCompetitors(competitors: GrowthEngineCompetitor[]): ClassifiedCompetitor[] {
  return competitors.map((c) => {
    const { ownershipType, chainBrand } = classifyCompetitorOwnership(c.businessName);
    return { ...c, ownershipType, chainBrand };
  });
}

export function countCompetitorOwnership(competitors: ClassifiedCompetitor[]): {
  independent: number;
  regional: number;
  national: number;
  unknown: number;
} {
  return {
    independent: competitors.filter((c) => c.ownershipType === "independent").length,
    regional: competitors.filter((c) => c.ownershipType === "regional").length,
    national: competitors.filter((c) => c.ownershipType === "national").length,
    unknown: competitors.filter((c) => c.ownershipType === "unknown").length,
  };
}

export const OWNERSHIP_LABELS: Record<CompetitorOwnershipType, string> = {
  independent: "Independent Pharmacies",
  regional: "Regional Groups",
  national: "National Chains",
  unknown: "Unclassified",
};
