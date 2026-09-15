/**
 * Master Admin — legacy auto-advance detection for tenants that skipped commercial review gates.
 */
import { loadContentPackage } from "./pharmacyContentPackageService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { loadGrowthOpportunityReport } from "./growthEngineOpportunityEngine.ts";
import {
  isWorkflowAcknowledged,
  writeWorkflowAcknowledgement,
} from "./masterAdminWorkflowAckService.ts";

const LEGACY_KEY = "legacy-auto-advance";

export function isLegacyAutoAdvance(slug: string): boolean {
  return isWorkflowAcknowledged(slug, LEGACY_KEY);
}

/** Mark tenants that auto-advanced before commercial review gates existed. Preserves ecosystem/history only — does NOT approve Commercial Intelligence. */
export function ensureLegacyAutoAdvance(slug: string, operator = "system"): boolean {
  if (isLegacyAutoAdvance(slug)) return true;

  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return false;

  const pkg = loadContentPackage(slug, ctx.serviceId);
  const ecosystemGenerated = Boolean(pkg?.generatedAt && pkg.status !== "missing" && pkg.status !== "error");
  const hadOldGiAck = isWorkflowAcknowledged(slug, "growth-intelligence");
  const giReport = loadGrowthOpportunityReport(slug);

  if (!ecosystemGenerated && !hadOldGiAck && !giReport) return false;

  writeWorkflowAcknowledgement(slug, LEGACY_KEY, operator);
  return true;
}

/** Legacy tenants with pre-existing ecosystem may skip intelligence regeneration — not Commercial Intelligence approval. */
export function legacyIntelligenceGenerationComplete(slug: string, contentGenerated: boolean): boolean {
  return isLegacyAutoAdvance(slug) && contentGenerated;
}

/** @deprecated Use legacyIntelligenceGenerationComplete — never satisfies commercial_intelligence approval. */
export function legacyIntelligenceStagesComplete(slug: string, contentGenerated: boolean): boolean {
  return legacyIntelligenceGenerationComplete(slug, contentGenerated);
}

export function legacyAutoAdvanceLabel(slug: string): string | null {
  return isLegacyAutoAdvance(slug)
    ? "Legacy Auto Advance — existing ecosystem preserved; Commercial Intelligence approval still required (NT-E2E-09B)"
    : null;
}
