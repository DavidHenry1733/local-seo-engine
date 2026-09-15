/**
 * Master Admin — Growth Intelligence workflow execution (orchestration wiring only).
 */
import {
  buildGrowthOpportunityReport,
  loadGrowthOpportunityReport,
  saveGrowthOpportunityReport,
} from "./growthEngineOpportunityEngine.ts";
import { listMasterAdminJobs, type MasterAdminJob } from "./masterAdminJobService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import {
  isCommercialIntelligenceApproved,
  isGrowthIntelligenceGenerated,
  isGrowthIntelligenceJobOutputComplete,
} from "./masterAdminCommercialIntelligenceWorkflowService.ts";

export interface GrowthIntelligenceWorkflowResult {
  ok: boolean;
  evidence: string;
  errors: string[];
  reportPath?: string;
  opportunityCount?: number;
  idempotent?: boolean;
  activeJobId?: string;
}

const GI_JOB_ACTIONS = new Set(["orchestrate_growth_intelligence", "generate_growth_intelligence"]);

export function findActiveGrowthIntelligenceJob(slug: string): MasterAdminJob | null {
  return (
    listMasterAdminJobs({ slug, limit: 20 }).find(
      (j) => GI_JOB_ACTIONS.has(j.action) && (j.status === "queued" || j.status === "running"),
    ) || null
  );
}

export function isGrowthIntelligenceWorkflowComplete(slug: string): boolean {
  return isGrowthIntelligenceJobOutputComplete(slug) && isCommercialIntelligenceApproved(slug);
}

export function runGrowthIntelligenceWorkflowAction(
  slug: string,
  operator: string,
): GrowthIntelligenceWorkflowResult {
  const active = findActiveGrowthIntelligenceJob(slug);
  if (active) {
    return {
      ok: true,
      evidence: `Growth Intelligence job already ${active.status}`,
      errors: [],
      idempotent: true,
      activeJobId: active.id,
    };
  }

  if (isGrowthIntelligenceGenerated(slug)) {
    const existing = loadGrowthOpportunityReport(slug);
    return {
      ok: true,
      evidence: "Growth Intelligence already generated — review and approve before continuing",
      errors: [],
      idempotent: true,
      opportunityCount: existing?.opportunities.length || 0,
    };
  }

  try {
    const report = buildGrowthOpportunityReport(slug);
    const reportPath = saveGrowthOpportunityReport(report);

    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "orchestrate_growth_intelligence",
      status: "success",
      evidence: `Growth Intelligence generated — ${report.opportunities.length} opportunities`,
      metadata: { opportunityCount: report.opportunities.length, reportPath },
    });

    return {
      ok: true,
      evidence: `Growth Intelligence generated — ${report.opportunities.length} opportunities`,
      errors: [],
      reportPath,
      opportunityCount: report.opportunities.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "orchestrate_growth_intelligence",
      status: "error",
      evidence: message,
      errors: [message],
    });
    return { ok: false, evidence: message, errors: [message] };
  }
}
