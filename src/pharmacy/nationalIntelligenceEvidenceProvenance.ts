/**
 * NI-03A — National Intelligence Evidence provenance contract.
 * Distinguishes live, persisted, recovered, fixture, calculated, and fallback evidence.
 * Does not upgrade confidence. Does not treat fixtures as live.
 */

export type NationalEvidenceSourceType =
  | "DATAFORSEO_LIVE"
  | "DATAFORSEO_PERSISTED"
  | "WEBSITE_IMPORT"
  | "WEBSITE_INTELLIGENCE"
  | "PROJECT_CONFIG"
  | "CALCULATED"
  | "RECOVERED"
  | "FIXTURE"
  | "FALLBACK";

export type NationalEvidenceAuthority =
  | "LIVE_PROVEN"
  | "PERSISTED_PROVEN"
  | "RECOVERED_EVIDENCE"
  | "FIXTURE_ONLY"
  | "INSUFFICIENT_EVIDENCE";

export interface NationalIntelligenceEvidenceProvenance {
  tenantSlug: string;
  subjectDomain: string;
  capturedAt: string;
  evidenceSource: NationalEvidenceSourceType;
  sourceSystem: string;
  sourceEndpoint: string | null;
  sourceSnapshot: string | null;
  liveExecution: boolean;
  calculated: boolean;
  calculationMethod: string | null;
  confidenceBasis: string;
  costContribution: number | null;
}

export function evidenceSourceFromSnapshot(input: {
  liveExecution: boolean;
  recovered?: boolean;
  fixture?: boolean;
  calculated?: boolean;
}): NationalEvidenceSourceType {
  if (input.calculated) return "CALCULATED";
  if (input.liveExecution) return "DATAFORSEO_LIVE";
  if (input.recovered) return "RECOVERED";
  if (input.fixture) return "FIXTURE";
  return "DATAFORSEO_PERSISTED";
}

export function authorityFromProvenance(input: {
  liveExecution: boolean;
  fixture: boolean;
  recovered: boolean;
  hasAuthoritativeGapEvidence: boolean;
}): NationalEvidenceAuthority {
  if (input.fixture && !input.liveExecution) return "FIXTURE_ONLY";
  if (input.recovered && !input.liveExecution) return "RECOVERED_EVIDENCE";
  if (input.liveExecution && input.hasAuthoritativeGapEvidence) return "LIVE_PROVEN";
  if (!input.fixture && !input.recovered) return "PERSISTED_PROVEN";
  return "INSUFFICIENT_EVIDENCE";
}

export function hasAuthoritativeGapEvidence(sources: string[] | undefined): boolean {
  return Array.isArray(sources) && sources.includes("domain_intersection_gap");
}

export function buildProvenance(input: {
  tenantSlug: string;
  subjectDomain: string;
  capturedAt?: string;
  evidenceSource: NationalEvidenceSourceType;
  sourceSystem?: string;
  sourceEndpoint?: string | null;
  sourceSnapshot?: string | null;
  liveExecution: boolean;
  calculated?: boolean;
  calculationMethod?: string | null;
  confidenceBasis: string;
  costContribution?: number | null;
}): NationalIntelligenceEvidenceProvenance {
  return {
    tenantSlug: input.tenantSlug,
    subjectDomain: input.subjectDomain,
    capturedAt: input.capturedAt || new Date().toISOString(),
    evidenceSource: input.evidenceSource,
    sourceSystem: input.sourceSystem || "national-intelligence-evidence-layer-v1",
    sourceEndpoint: input.sourceEndpoint ?? null,
    sourceSnapshot: input.sourceSnapshot ?? null,
    liveExecution: input.liveExecution,
    calculated: Boolean(input.calculated),
    calculationMethod: input.calculationMethod ?? null,
    confidenceBasis: input.confidenceBasis,
    costContribution: input.costContribution ?? null,
  };
}
