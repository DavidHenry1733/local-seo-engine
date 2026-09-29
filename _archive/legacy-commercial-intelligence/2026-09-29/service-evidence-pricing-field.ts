/**
 * Classification: D SUPERSEDED / DEAD PRODUCTION
 * Checkpoint: 2026-09-29 Evidence approval auth hotfix and pricing cleanup.
 *
 * Removed from active Service Evidence Review, approval requirements,
 * and the service-page generation evidence contract.
 * Not imported, routed, bundled, or callable.
 *
 * The live field id was pricing, labelled "Pricing".
 * It was optional and could be confirmed or marked Not Applicable.
 * Pharmacy Evidence Review no longer asks a pricing question.
 * Historical field-decision records are left in place and are not active.
 */
export const REMOVED_EVIDENCE_FIELD = {
  id: "pricing",
  label: "Pricing",
} as const;
