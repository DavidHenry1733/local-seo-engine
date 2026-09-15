/**
 * Brand DNA completeness score — never report 100% when defaults fill important roles.
 */
import type { BrandDnaExtractionReport } from "./pharmacyBrandDnaExtractionEvidence.ts";
import type { BrandDnaCompletenessCategory, BrandDnaCompletenessScore } from "./pharmacyBrandDnaSemanticTypes.ts";
import type { BrandDnaStyleEvidenceSample } from "./pharmacyBrandDnaSemanticTypes.ts";
import type { BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";

function categoryStatus(populated: string[], defaults: string[], prefix: string): BrandDnaCompletenessCategory["status"] {
  const pop = populated.filter((k) => k.startsWith(prefix)).length;
  const def = defaults.filter((k) => k.startsWith(prefix)).length;
  if (pop >= 3 && def === 0) return "extracted";
  if (pop >= 1) return "partial";
  if (def > 0) return "default-fallback";
  return "customer-confirmation-required";
}

function scoreCategory(status: BrandDnaCompletenessCategory["status"]): number {
  switch (status) {
    case "extracted":
      return 100;
    case "partial":
      return 65;
    case "default-fallback":
      return 25;
    default:
      return 0;
  }
}

export function computeBrandDnaCompletenessScore(
  dna: BrandDnaV1,
  report: BrandDnaExtractionReport,
  styleSamples: BrandDnaStyleEvidenceSample[],
  conflictCount: number,
): BrandDnaCompletenessScore {
  const populated = report.populatedFromWebsite;
  const defaults = report.usingDefaults;

  const categories: BrandDnaCompletenessCategory[] = [
    { category: "identity", status: dna.logoUrl ? "extracted" : "default-fallback", score: dna.logoUrl ? 100 : 20 },
    {
      category: "semantic colours",
      status: dna.semanticColours ? "extracted" : categoryStatus(populated, defaults, "colours."),
      score: dna.semanticColours ? 95 : scoreCategory(categoryStatus(populated, defaults, "colours.")),
    },
    {
      category: "typography",
      status: dna.typographyRoles ? "extracted" : categoryStatus(populated, defaults, "typography."),
      score: dna.typographyRoles ? 90 : scoreCategory(categoryStatus(populated, defaults, "typography.")),
    },
    {
      category: "header/navigation",
      status: dna.navigation?.confirmedItems?.length ? "extracted" : "partial",
      score: dna.navigation?.confirmedItems?.length ? 95 : 40,
    },
    {
      category: "CTAs",
      status: dna.navigation?.primaryCta ? "extracted" : "partial",
      score: dna.navigation?.primaryCta ? 90 : 50,
    },
    {
      category: "hero",
      status: categoryStatus(populated, defaults, "layout.hero"),
      score: scoreCategory(categoryStatus(populated, defaults, "layout.")),
    },
    {
      category: "section rhythm",
      status: dna.components?.sectionFlowVariant ? "extracted" : "default-fallback",
      score: dna.components?.sectionFlowVariant ? 85 : 30,
    },
    {
      category: "cards",
      status: categoryStatus(populated, defaults, "surfaces."),
      score: scoreCategory(categoryStatus(populated, defaults, "surfaces.")),
    },
    {
      category: "imagery",
      status: dna.components?.imageTreatmentVariant ? "extracted" : "default-fallback",
      score: dna.components?.imageTreatmentVariant ? 80 : 30,
    },
    {
      category: "footer",
      status: dna.footerEvidence ? "extracted" : categoryStatus(populated, defaults, "colours.footer"),
      score: dna.footerEvidence ? 88 : scoreCategory(categoryStatus(populated, defaults, "colours.footer")),
    },
    {
      category: "responsive behaviour",
      status: styleSamples.some((s) => s.role === "mobile-navigation") ? "partial" : "default-fallback",
      score: styleSamples.some((s) => s.role === "mobile-navigation") ? 55 : 25,
    },
  ];

  if (conflictCount > 0) {
    categories.push({
      category: "conflicts",
      status: "customer-confirmation-required",
      score: Math.max(0, 100 - conflictCount * 15),
      notes: `${conflictCount} field conflict(s) require customer confirmation`,
    });
  }

  const overall = Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length);

  return {
    overall: Math.min(overall, defaults.length > 8 ? 92 : overall),
    categories,
    computedAt: new Date().toISOString(),
  };
}
