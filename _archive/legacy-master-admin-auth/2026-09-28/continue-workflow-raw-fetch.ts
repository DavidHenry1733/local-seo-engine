/**
 * SUPERSEDED 2026-09-28.
 * Generate Growth Intelligence called continue-workflow with a raw fetch that
 * omitted the Master Admin login handoff (_t). Authenticated pages that only
 * had the handoff token received HTTP 401 "Session expired".
 * Not imported, routed, bundled, or used as a fallback.
 *
 * Replaced by continueWorkflow() calling withAuthHandoff(...) before fetch,
 * the same credential contract as api().
 */
export const SUPERSEDED_CONTINUE_WORKFLOW_FETCH =
  "fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/continue-workflow'";
