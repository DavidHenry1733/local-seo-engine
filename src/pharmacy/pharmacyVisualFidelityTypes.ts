/**
 * Sprint 5H — Visual Fidelity Engine types.
 * Compares imported website evidence (Brand DNA) vs generated renderer output.
 */

export type VisualFidelityComponent =
  | "header"
  | "hero"
  | "content"
  | "footer"
  | "map"
  | "image"
  | "responsive";

export type VisualFidelityDimension =
  | "headerFidelity"
  | "footerFidelity"
  | "typographyFidelity"
  | "colourFidelity"
  | "spacingFidelity"
  | "layoutFidelity"
  | "cardFidelity"
  | "heroFidelity"
  | "imageFidelity"
  | "responsiveFidelity"
  | "overallBrandFidelity";

export interface VisualFidelityMetricValue {
  label: string;
  value: string | number | boolean;
  unit?: string;
}

export interface VisualFidelityCheck {
  id: string;
  component: VisualFidelityComponent;
  dimension: VisualFidelityDimension;
  label: string;
  imported: string | number | boolean;
  generated: string | number | boolean;
  match: boolean;
  variancePercent?: number;
  score: number;
  recommendation?: string;
}

export interface VisualFidelityComponentComparison {
  component: VisualFidelityComponent;
  checks: VisualFidelityCheck[];
  score: number;
  issues: VisualFidelityIssue[];
}

export interface VisualFidelityIssue {
  component: VisualFidelityComponent;
  dimension: VisualFidelityDimension;
  label: string;
  imported: string | number | boolean;
  generated: string | number | boolean;
  variance?: string;
  recommendation: string;
}

export interface VisualFidelityDimensionScores {
  headerFidelity: number;
  footerFidelity: number;
  typographyFidelity: number;
  colourFidelity: number;
  spacingFidelity: number;
  layoutFidelity: number;
  cardFidelity: number;
  heroFidelity: number;
  imageFidelity: number;
  responsiveFidelity: number;
  overallBrandFidelity: number;
}

export interface VisualFidelityReport {
  slug: string;
  serviceId: string;
  htmlPath: string;
  sourceUrl: string;
  comparedAt: string;
  components: VisualFidelityComponentComparison[];
  dimensions: VisualFidelityDimensionScores;
  issues: VisualFidelityIssue[];
  commercialReady: boolean;
  deterministicHash: string;
}

export interface ImportedVisualBaseline {
  header: Record<string, string | number | boolean>;
  hero: Record<string, string | number | boolean>;
  content: Record<string, string | number | boolean>;
  footer: Record<string, string | number | boolean>;
  map: Record<string, string | number | boolean>;
  image: Record<string, string | number | boolean>;
  responsive: Record<string, string | number | boolean>;
  colours: Record<string, string>;
  typography: Record<string, string>;
}

export interface GeneratedVisualMetrics {
  header: Record<string, string | number | boolean>;
  hero: Record<string, string | number | boolean>;
  content: Record<string, string | number | boolean>;
  footer: Record<string, string | number | boolean>;
  map: Record<string, string | number | boolean>;
  image: Record<string, string | number | boolean>;
  responsive: Record<string, string | number | boolean>;
  colours: Record<string, string>;
  typography: Record<string, string>;
  cssVariables: Record<string, string>;
}
