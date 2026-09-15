/**
 * Explicit fallback policy for website design import (RC1-C07).
 */
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";

const CRITICAL_FIELDS = [
  "logo",
  "primary-colours",
  "typography",
  "header",
  "navigation",
  "footer",
  "buttons",
  "primary-imagery",
] as const;

export interface DesignFallbackAssessment {
  criticalFallbackCount: number;
  criticalFallbackPercentage: number;
  blocked: boolean;
  reasons: string[];
  genericTemplateFallback: boolean;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function assessDesignImportFallbacks(evidence: WebsiteDesignEvidence | null): DesignFallbackAssessment {
  if (!evidence) {
    return {
      criticalFallbackCount: CRITICAL_FIELDS.length,
      criticalFallbackPercentage: 100,
      blocked: true,
      reasons: ["design-evidence-missing"],
      genericTemplateFallback: true,
    };
  }

  const criticalFallbacks = evidence.fallbacks.filter((f) => f.severity === "critical");
  const fieldHits = new Set<string>();
  for (const fallback of criticalFallbacks) {
    for (const field of CRITICAL_FIELDS) {
      if (fallback.field.includes(field)) fieldHits.add(field);
    }
  }

  if (!str(evidence.header.logoUrl)) fieldHits.add("logo");
  if (!evidence.colourSystem.primary.length) fieldHits.add("primary-colours");
  if (!str(evidence.typography.body.fontFamily) && !str(evidence.typography.heading.fontFamily)) {
    fieldHits.add("typography");
  }
  if (evidence.header.completeness < 95) fieldHits.add("header");
  if (evidence.navigation.completeness < 95) fieldHits.add("navigation");
  if (evidence.footer.completeness < 95) fieldHits.add("footer");
  if (evidence.layout.completeness < 95) fieldHits.add("layout");
  if (!evidence.buttons.length) fieldHits.add("buttons");
  if (!evidence.imagery.length) fieldHits.add("primary-imagery");

  const count = fieldHits.size;
  const percentage = Math.round((count / CRITICAL_FIELDS.length) * 100);
  const blocked = percentage > 10 || count > 0;
  const reasons: string[] = [];
  if (blocked) reasons.push(`critical-fallback-threshold-exceeded:${percentage}%`);
  for (const hit of fieldHits) reasons.push(`missing-or-fallback:${hit}`);

  return {
    criticalFallbackCount: count,
    criticalFallbackPercentage: percentage,
    blocked,
    reasons,
    genericTemplateFallback: count >= CRITICAL_FIELDS.length - 1,
  };
}
