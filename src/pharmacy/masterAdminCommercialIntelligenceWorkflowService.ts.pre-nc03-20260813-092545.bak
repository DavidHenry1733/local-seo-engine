import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
/**
 * Master Admin — commercial intelligence workflow orchestration (wiring only).
 */
import { runCompetitorIntelligencePipeline } from "./pharmacyCompetitorIntelligenceService.ts";
import { loadCompetitorIntelligence } from "./pharmacyCompetitorIntelligence.ts";
import {
  discoverLocalMarketCompetitors,
  loadCompetitorSnapshot,
} from "./growthEngineLocalMarketService.ts";
import { loadGrowthOpportunityReport } from "./growthEngineOpportunityEngine.ts";
import { listMasterAdminJobs, type MasterAdminJob } from "./masterAdminJobService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import {
  isWorkflowAcknowledged,
  readCommercialIntelligenceApproval,
  writeCommercialIntelligenceApproval,
  type CommercialIntelligenceApprovalRecord,
} from "./masterAdminWorkflowAckService.ts";
import {
  finishWorkflowExecution,
  getLastRecordedWorkflowStage,
  recordWorkflowTransition,
  startWorkflowExecution,
} from "./masterAdminWorkflowHistoryService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { resolveTenantLocality } from "./masterAdminPrimaryLocalityService.ts";

export interface CommercialIntelligenceWorkflowResult {
  ok: boolean;
  evidence: string;
  errors: string[];
  idempotent?: boolean;
  activeJobId?: string;
  approval?: ReturnType<typeof readCommercialIntelligenceApproval>;
}

const COMPETITOR_JOB_ACTIONS = new Set(["orchestrate_competitor_analysis"]);
const LOCAL_MARKET_JOB_ACTIONS = new Set(["orchestrate_local_market_intelligence"]);

export function isCompetitorAnalysisGenerated(slug: string): boolean {
  return loadCompetitorIntelligence(slug) !== null;
}

export function isLocalMarketIntelligenceGenerated(slug: string): boolean {
  const snap = loadCompetitorSnapshot(slug);
  return Boolean(snap?.generatedAt && (snap.competitors.length > 0 || snap.analysis));
}

export function isGrowthIntelligenceGenerated(slug: string): boolean {
  return loadGrowthOpportunityReport(slug) !== null;
}

export function isGrowthIntelligenceJobOutputComplete(slug: string): boolean {
  return isGrowthIntelligenceGenerated(slug);
}

export function isCommercialIntelligenceGenerated(slug: string): boolean {
  /*
   * NATIONAL is a separate intelligence product.
   *
   * Do not satisfy NATIONAL readiness with LOCAL artefacts.
   * Until National Competitor / Market / Growth Intelligence exists,
   * NATIONAL correctly remains not generated.
   */
  if (isNationalGrowthPlatform(slug)) return false;

  return (
    isCompetitorAnalysisGenerated(slug) &&
    isLocalMarketIntelligenceGenerated(slug) &&
    isGrowthIntelligenceGenerated(slug)
  );
}

/** All intelligence artefacts present with traceable evidence — required before approval. */
export function isCommercialIntelligenceReadyForReview(slug: string): boolean {
  return isCommercialIntelligenceGenerated(slug);
}

export function isCommercialIntelligenceEvidenceComplete(slug: string): boolean {
  /*
   * NATIONAL evidence completeness must be supplied by the National
   * Growth Engine. Locality, Google Places and Local Market Intelligence
   * are not valid substitutes.
   */
  if (isNationalGrowthPlatform(slug)) return false;

  const profile = readSetupProfile(slug);
  const locality = resolveTenantLocality(profile);
  const intel = loadCompetitorIntelligence(slug);
  const snap = loadCompetitorSnapshot(slug);
  const hasCompetitors =
    (intel?.competitors.length || 0) > 0 ||
    (snap?.source === "google-places-live" && (snap.competitors.length || 0) > 0);

  return (
    locality.available &&
    Boolean(locality.value) &&
    hasCompetitors &&
    isLocalMarketIntelligenceGenerated(slug) &&
    isGrowthIntelligenceGenerated(slug)
  );
}

export function isCommercialIntelligenceApproved(slug: string): boolean {
  return isWorkflowAcknowledged(slug, "commercial-intelligence-approved");
}

/** @deprecated Use isCommercialIntelligenceApproved */
export function isGrowthIntelligenceApproved(slug: string): boolean {
  return isCommercialIntelligenceApproved(slug);
}

export function commercialIntelligenceApprovedVersion(slug: string): string {
  const report = loadGrowthOpportunityReport(slug);
  const intel = loadCompetitorIntelligence(slug);
  const snap = loadCompetitorSnapshot(slug);
  const parts = [report?.generatedAt, intel?.generatedAt, snap?.generatedAt].filter(Boolean);
  return parts.length ? parts.sort().join("|") : "1";
}

export function readCommercialIntelligenceApprovalExtended(slug: string): CommercialIntelligenceApprovalRecord | null {
  return readCommercialIntelligenceApproval(slug);
}

function intelligenceRevisionBundle(slug: string) {
  const report = loadGrowthOpportunityReport(slug);
  const intel = loadCompetitorIntelligence(slug);
  const snap = loadCompetitorSnapshot(slug);
  return {
    intelligenceEvidenceRevision: commercialIntelligenceApprovedVersion(slug),
    competitorEvidenceRevision: intel?.generatedAt || null,
    localMarketRevision: snap?.generatedAt || null,
    growthIntelligenceRevision: report?.generatedAt || null,
  };
}

export function findActiveCommercialIntelligenceJob(
  slug: string,
  actions: Set<string>,
): MasterAdminJob | null {
  return (
    listMasterAdminJobs({ slug, limit: 20 }).find(
      (j) => actions.has(j.action) && (j.status === "queued" || j.status === "running"),
    ) || null
  );
}

export async function runCompetitorAnalysisWorkflowAction(
  slug: string,
  operator: string,
): Promise<CommercialIntelligenceWorkflowResult> {
  if (isNationalGrowthPlatform(slug)) {
    return {
      ok: false,
      evidence:
        "National Competitor Intelligence required — LOCAL competitor analysis was not executed.",
      errors: [
        "National Growth Engine competitor discovery has not yet been generated.",
      ],
    };
  }
  const active = findActiveCommercialIntelligenceJob(slug, COMPETITOR_JOB_ACTIONS);
  if (active) {
    return {
      ok: true,
      evidence: `Competitor Analysis job already ${active.status}`,
      errors: [],
      idempotent: true,
      activeJobId: active.id,
    };
  }
  if (isCompetitorAnalysisGenerated(slug)) {
    const intel = loadCompetitorIntelligence(slug)!;
    return {
      ok: true,
      evidence: `Competitor Analysis already complete — ${intel.competitors.length} competitors`,
      errors: [],
      idempotent: true,
    };
  }
  try {
    const result = await runCompetitorIntelligencePipeline(slug);
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "orchestrate_competitor_analysis",
      status: "success",
      evidence: `Competitor Analysis generated — ${result.discovery.competitorCount} competitors`,
    });
    return {
      ok: true,
      evidence: `Competitor Analysis generated — ${result.discovery.competitorCount} competitors`,
      errors: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "orchestrate_competitor_analysis",
      status: "error",
      evidence: message,
      errors: [message],
    });
    return { ok: false, evidence: message, errors: [message] };
  }
}

export async function runLocalMarketIntelligenceWorkflowAction(
  slug: string,
  operator: string,
): Promise<CommercialIntelligenceWorkflowResult> {
  if (isNationalGrowthPlatform(slug)) {
    return {
      ok: false,
      evidence:
        "Local Market Intelligence is not applicable to the NATIONAL Growth Platform.",
      errors: [
        "National Market Intelligence is required instead. No Google Places or local healthcare discovery was executed.",
      ],
    };
  }
  const active = findActiveCommercialIntelligenceJob(slug, LOCAL_MARKET_JOB_ACTIONS);
  if (active) {
    return {
      ok: true,
      evidence: `Local Market Intelligence job already ${active.status}`,
      errors: [],
      idempotent: true,
      activeJobId: active.id,
    };
  }
  if (isLocalMarketIntelligenceGenerated(slug)) {
    const snap = loadCompetitorSnapshot(slug)!;
    return {
      ok: true,
      evidence: `Local Market Intelligence already complete — ${snap.competitors.length} competitors analysed`,
      errors: [],
      idempotent: true,
    };
  }
  try {
    const snap = await discoverLocalMarketCompetitors(slug);
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "orchestrate_local_market_intelligence",
      status: "success",
      evidence: `Local Market Intelligence generated — ${snap.competitors.length} competitors`,
    });
    return {
      ok: true,
      evidence: `Local Market Intelligence generated — ${snap.competitors.length} competitors`,
      errors: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "orchestrate_local_market_intelligence",
      status: "error",
      evidence: message,
      errors: [message],
    });
    return { ok: false, evidence: message, errors: [message] };
  }
}

export function approveCommercialIntelligence(
  slug: string,
  operator: string,
): CommercialIntelligenceWorkflowResult {
  if (isNationalGrowthPlatform(slug)) {
    return {
      ok: false,
      evidence: "National Commercial Intelligence not ready for review",
      errors: [
        "Generate National Competitor Intelligence, National Market Intelligence and National Growth Intelligence first",
      ],
    };
  }
  if (!isCommercialIntelligenceReadyForReview(slug)) {
    return {
      ok: false,
      evidence: "Commercial Intelligence not ready for review",
      errors: ["Generate Competitor Analysis, Local Market Intelligence and Growth Intelligence first"],
    };
  }
  if (!isCommercialIntelligenceEvidenceComplete(slug)) {
    const locality = resolveTenantLocality(readSetupProfile(slug));
    const errors: string[] = [];
    if (!locality.available) errors.push("Tenant locality not verified");
    if (!isCompetitorAnalysisGenerated(slug)) errors.push("Competitor Analysis missing");
    if (!isLocalMarketIntelligenceGenerated(slug)) errors.push("Local Market Intelligence missing");
    return {
      ok: false,
      evidence: "Commercial Intelligence evidence incomplete",
      errors: errors.length ? errors : ["Competitor evidence or locality provenance incomplete"],
    };
  }
  if (isCommercialIntelligenceApproved(slug)) {
    return {
      ok: true,
      evidence: "Commercial Intelligence already approved",
      errors: [],
      idempotent: true,
      approval: readCommercialIntelligenceApproval(slug),
    };
  }
  const version = commercialIntelligenceApprovedVersion(slug);
  const revisions = intelligenceRevisionBundle(slug);
  const approval = writeCommercialIntelligenceApproval(slug, operator, version, {
    intelligenceEvidenceRevision: revisions.intelligenceEvidenceRevision,
    competitorEvidenceRevision: revisions.competitorEvidenceRevision || undefined,
    localMarketRevision: revisions.localMarketRevision || undefined,
    growthIntelligenceRevision: revisions.growthIntelligenceRevision || undefined,
  });

  const recorded = getLastRecordedWorkflowStage(slug);
  if (recorded === "commercial_intelligence" || recorded === "generate_growth_intelligence") {
    startWorkflowExecution({
      slug,
      stageId: "commercial_intelligence",
      actionId: "approve_commercial_intelligence",
      operator,
    });
    finishWorkflowExecution({
      slug,
      stageId: "commercial_intelligence",
      actionId: "approve_commercial_intelligence",
      operator,
      evidence: `Commercial Intelligence approved (${approval.approvedAt})`,
      status: "completed",
    });
    recordWorkflowTransition({
      slug,
      fromStage: "commercial_intelligence",
      toStage: "generate_ecosystem",
      operator,
      reason: "Commercial Intelligence approved by Product Owner",
      evidence: `approvedVersion=${approval.approvedVersion}`,
    });
  }

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "approve_commercial_intelligence",
    status: "success",
    evidence: `Commercial Intelligence approved at ${approval.approvedAt} (version ${approval.approvedVersion})`,
  });
  return {
    ok: true,
    evidence: `Commercial Intelligence approved (${approval.approvedAt})`,
    errors: [],
    approval,
  };
}
