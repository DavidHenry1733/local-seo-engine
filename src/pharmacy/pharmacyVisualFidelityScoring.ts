/**
 * Sprint 5H — deterministic fidelity scoring utilities.
 */
import type { VisualFidelityCheck, VisualFidelityDimension, VisualFidelityIssue } from "./pharmacyVisualFidelityTypes.ts";

export const COMMERCIAL_FIDELITY_TARGET = 95;

const DIMENSION_TARGETS: Partial<Record<VisualFidelityDimension, number>> = {
  headerFidelity: 95,
  footerFidelity: 95,
  typographyFidelity: 95,
  spacingFidelity: 95,
  layoutFidelity: 95,
  imageFidelity: 95,
  overallBrandFidelity: 95,
};

export function normalizeCompareValue(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return `${value}px`;
  const px = parsePx(value);
  if (px != null && String(value).trim().match(/^\d+$/)) return `${px}px`;
  return String(value ?? "").trim().toLowerCase();
}

export function parsePx(value: string | number | boolean): number | null {
  const match = String(value).match(/^([\d.]+)\s*px$/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export function variancePercent(imported: string | number | boolean, generated: string | number | boolean): number | undefined {
  const iPx = parsePx(imported);
  const gPx = parsePx(generated);
  if (iPx == null || gPx == null) return undefined;
  if (iPx === 0) return gPx === 0 ? 0 : 100;
  return Math.round((Math.abs(gPx - iPx) / iPx) * 100);
}

export function scoreExact(imported: string | number | boolean, generated: string | number | boolean): number {
  return normalizeCompareValue(imported) === normalizeCompareValue(generated) ? 100 : 0;
}

export function scoreNumeric(
  imported: string | number | boolean,
  generated: string | number | boolean,
  tolerancePercent = 12,
): number {
  const iPx = parsePx(imported);
  const gPx = parsePx(generated);
  if (iPx == null || gPx == null) return scoreExact(imported, generated);
  const variance = variancePercent(imported, generated) ?? 0;
  if (variance <= tolerancePercent) return Math.round(100 - variance * 0.4);
  return Math.max(0, Math.round(100 - variance));
}

export function scoreBoolean(expected: boolean, actual: boolean): number {
  return expected === actual ? 100 : 0;
}

export function scoreCount(expected: number, actual: number): number {
  if (expected === actual) return 100;
  if (expected === 0) return actual === 0 ? 100 : 0;
  const variance = Math.abs(actual - expected) / expected;
  return Math.max(0, Math.round(100 - variance * 100));
}

export function averageScores(scores: number[]): number {
  if (!scores.length) return 100;
  return Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length);
}

export function buildCheck(input: {
  id: string;
  component: VisualFidelityCheck["component"];
  dimension: VisualFidelityDimension;
  label: string;
  imported: string | number | boolean;
  generated: string | number | boolean;
  score: number;
  recommendation?: string;
}): VisualFidelityCheck {
  const match = normalizeCompareValue(input.imported) === normalizeCompareValue(input.generated);
  return {
    ...input,
    match,
    variancePercent: variancePercent(input.imported, input.generated),
  };
}

export function checkToIssue(check: VisualFidelityCheck): VisualFidelityIssue | null {
  if (check.match || check.score >= COMMERCIAL_FIDELITY_TARGET) return null;
  const variance =
    check.variancePercent != null
      ? `${check.variancePercent >= 0 ? (check.generated > check.imported ? "+" : "") : ""}${check.variancePercent}%`
      : undefined;
  return {
    component: check.component,
    dimension: check.dimension,
    label: check.label,
    imported: check.imported,
    generated: check.generated,
    variance,
    recommendation: check.recommendation || `Align generated ${check.label} with imported evidence.`,
  };
}

export function isCommercialReady(dimensions: Record<string, number>): boolean {
  for (const [key, target] of Object.entries(DIMENSION_TARGETS)) {
    const score = dimensions[key];
    if (typeof score === "number" && score < target) return false;
  }
  return true;
}
