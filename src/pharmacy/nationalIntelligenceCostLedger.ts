/**
 * NI-03A — Canonical DataForSEO cost ledger from persisted task costs.
 * Does not hard-code inherited cost. Does not call DataForSEO.
 */
import type { NationalEvidenceSourceType } from "./nationalIntelligenceEvidenceProvenance.ts";

export interface NationalIntelligenceCostEntry {
  tenantSlug: string;
  snapshotId: string;
  endpoint: string;
  requestCount: number;
  taskCount: number;
  cost: number;
  capturedAt: string;
  sourceSnapshot: string | null;
  evidenceSource: NationalEvidenceSourceType;
}

export interface NationalIntelligenceCostLedger {
  tenantSlug: string;
  snapshotId: string;
  capturedAt: string;
  totalCost: number;
  requestCount: number;
  taskCount: number;
  evidenceSource: NationalEvidenceSourceType;
  entries: NationalIntelligenceCostEntry[];
}

export function buildCostLedgerFromEndpoints(input: {
  tenantSlug: string;
  snapshotId: string;
  capturedAt?: string;
  sourceSnapshot?: string | null;
  liveExecution: boolean;
  fixture?: boolean;
  recovered?: boolean;
  endpoints: Array<{ endpoint: string; requests?: number; tasks?: number; cost?: number }>;
}): NationalIntelligenceCostLedger {
  const capturedAt = input.capturedAt || new Date().toISOString();
  const evidenceSource: NationalEvidenceSourceType = input.liveExecution
    ? "DATAFORSEO_LIVE"
    : input.recovered
      ? "RECOVERED"
      : input.fixture
        ? "FIXTURE"
        : "DATAFORSEO_PERSISTED";
  const entries = input.endpoints.map((endpoint) => ({
    tenantSlug: input.tenantSlug,
    snapshotId: input.snapshotId,
    endpoint: endpoint.endpoint,
    requestCount: Number(endpoint.requests || 0),
    taskCount: Number(endpoint.tasks || 0),
    cost: Number(endpoint.cost || 0),
    capturedAt,
    sourceSnapshot: input.sourceSnapshot ?? null,
    evidenceSource,
  }));
  return {
    tenantSlug: input.tenantSlug,
    snapshotId: input.snapshotId,
    capturedAt,
    totalCost: entries.reduce((sum, row) => sum + row.cost, 0),
    requestCount: entries.reduce((sum, row) => sum + row.requestCount, 0),
    taskCount: entries.reduce((sum, row) => sum + row.taskCount, 0),
    evidenceSource,
    entries,
  };
}

export function inheritPersistedDataForSeoCost(input: {
  ledger?: NationalIntelligenceCostLedger | null;
  totalCost?: number | null;
}): { cost: number; derived: boolean; evidenceSource: NationalEvidenceSourceType | "FALLBACK" } {
  if (input.ledger && Number.isFinite(input.ledger.totalCost)) {
    return { cost: input.ledger.totalCost, derived: true, evidenceSource: input.ledger.evidenceSource };
  }
  if (typeof input.totalCost === "number" && Number.isFinite(input.totalCost)) {
    return { cost: input.totalCost, derived: true, evidenceSource: "DATAFORSEO_PERSISTED" };
  }
  return { cost: 0, derived: false, evidenceSource: "FALLBACK" };
}
