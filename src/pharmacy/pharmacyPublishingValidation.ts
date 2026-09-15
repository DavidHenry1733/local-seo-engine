/**
 * Pharmacy Publishing Foundation V1 — validation layer (read-only on generated JSON).
 */
import {
  auditPharmacyContentAssembly,
  formatContentAssemblyErrors,
} from "./pharmacyContentAssemblyValidation.ts";

export const DUPLICATE_RISK_THRESHOLD = 35;

export type PharmacyPageType = "service" | "service-area" | "service-hub";

export interface PharmacyValidationInput {
  pageType: PharmacyPageType;
  pageSlug: string;
  metaTitle?: string;
  metaDescription?: string;
  schema?: Record<string, unknown> | null;
  cta?: { primary?: string; secondary?: string; phonePrompt?: string; bookingPrompt?: string } | null;
  sections?: Array<{ type?: string }>;
  qualitySignals?: { duplicateRiskScore?: number; wordCount?: number };
  /** Serialised page text for placeholder scanning */
  bodyText?: string;
  /** Full page JSON for content assembly audit */
  page?: Record<string, unknown>;
}

export interface PharmacyValidationResult {
  pageSlug: string;
  pageType: PharmacyPageType;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

const PLACEHOLDER_PATTERNS: Array<{ id: string; test: (text: string) => boolean }> = [
  { id: "lorem ipsum", test: (t) => /lorem ipsum/i.test(t) },
  { id: "btook", test: (t) => /\bbtook\b/i.test(t) },
  {
    id: "brook",
    test: (t) => /\bbrook\b/i.test(t) && !/brook pharmacy/i.test(t),
  },
];

function hasSchema(schema: Record<string, unknown> | null | undefined): boolean {
  if (!schema || typeof schema !== "object") return false;
  if ("@graph" in schema && Array.isArray(schema["@graph"]) && schema["@graph"].length > 0) return true;
  if ("@type" in schema && schema["@type"]) return true;
  return Object.keys(schema).length > 0;
}

function hasCta(cta: PharmacyValidationInput["cta"]): boolean {
  if (!cta) return false;
  return Boolean(
    String(cta.primary || "").trim() ||
      String(cta.phonePrompt || "").trim() ||
      String(cta.bookingPrompt || "").trim(),
  );
}

function hasLocalContext(sections: PharmacyValidationInput["sections"]): boolean {
  return (sections || []).some((s) => s.type === "localContext");
}

export function findPlaceholders(text: string): string[] {
  const hay = String(text || "");
  const found: string[] = [];
  for (const pat of PLACEHOLDER_PATTERNS) {
    if (pat.test(hay)) found.push(pat.id);
  }
  return found;
}

export function validatePharmacyPage(input: PharmacyValidationInput): PharmacyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!String(input.metaTitle || "").trim()) errors.push("missing metaTitle");
  if (!String(input.metaDescription || "").trim()) errors.push("missing metaDescription");
  if (!hasSchema(input.schema)) errors.push("missing schema");
  if (!hasCta(input.cta)) errors.push("missing CTA");

  if (input.pageType === "service-area" && !hasLocalContext(input.sections)) {
    errors.push("missing localContext section");
  }

  if (input.pageType === "service-hub") {
    const hasCoverage = (input.sections || []).some((s) => s.type === "coverageAreas");
    if (!hasCoverage) warnings.push("missing coverageAreas section in hub JSON");
  }

  const dupRisk = input.qualitySignals?.duplicateRiskScore ?? 0;
  if (dupRisk > DUPLICATE_RISK_THRESHOLD) {
    errors.push(`duplicate risk ${dupRisk}% exceeds ${DUPLICATE_RISK_THRESHOLD}%`);
  }

  const placeholders = findPlaceholders(input.bodyText || "");
  if (placeholders.length) {
    errors.push(`placeholder content: ${placeholders.join(", ")}`);
  }

  if (input.page) {
    const assembly = auditPharmacyContentAssembly(input.page as Record<string, unknown>, input.pageType);
    if (!assembly.passed) {
      errors.push(...formatContentAssemblyErrors(assembly));
    }
  }

  return {
    pageSlug: input.pageSlug,
    pageType: input.pageType,
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

export function summariseValidation(results: PharmacyValidationResult[]) {
  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);
  return {
    total: results.length,
    passCount: passed.length,
    failCount: failed.length,
    passRate: results.length ? Math.round((passed.length / results.length) * 100) : 0,
    allPassed: failed.length === 0,
    passed,
    failed,
  };
}
