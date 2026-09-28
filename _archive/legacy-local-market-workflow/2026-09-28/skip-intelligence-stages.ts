/**
 * SUPERSEDED 2026-09-28.
 * resolveWorkflowStage skipped competitor_analysis and local_market_intelligence
 * after Business Profile approval until Growth Intelligence existed.
 * The continue-workflow gate still required the previous stage, so the UI said
 * Growth Intelligence was ready while execution returned
 * "Previous stage incomplete: Local Market Intelligence".
 * Not imported, routed, bundled, or used as a fallback.
 */
export const SUPERSEDED_STAGE_SKIP =
  '(stageId === "competitor_analysis" || stageId === "local_market_intelligence") && isBusinessProfileReviewApproved(ctx.slug) && !isGrowthIntelligenceGenerated(ctx.slug)';
