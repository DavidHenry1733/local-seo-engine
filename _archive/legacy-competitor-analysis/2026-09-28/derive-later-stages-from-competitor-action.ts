/**
 * CLASSIFICATION D — SUPERSEDED / DEAD PRODUCTION
 * Archived 2026-09-28.
 *
 * runCompetitorAnalysisWorkflowAction and the Commercial Intelligence dashboard
 * called ensureCommercialIntelligenceDerivedFromStoredCompetitors during
 * Competitor Analysis. That wrote Local Market Intelligence and Growth
 * Intelligence, then Core Product Recovery treated Growth Intelligence as
 * permission to jump to generate_ecosystem. Preflight then returned:
 * "Open Evidence Review and approve evidence before generating the service page".
 *
 * The derivation function remains for the Local Market Intelligence action.
 * These call sites are not imported, routed, bundled, or called.
 */
export const supersededCompetitorActionDerivation = `
ensureCommercialIntelligenceDerivedFromStoredCompetitors(slug, operator);
`;
