/**
 * CPR-14 — Read-only service-page generation readiness validation.
 */
import { buildServicePageGenerationDashboard } from "../src/pharmacy/masterAdminCoreProductRecoveryService.ts";
import { assertServicePageGenerationAllowed } from "../src/pharmacy/masterAdminCoreProductRecoveryService.ts";
import {
  evaluateServicePageGenerationReadiness,
  traceServicePageGenerationReadinessFields,
  resolveServicePageGenerationFieldStatus,
} from "../src/pharmacy/masterAdminServicePageGenerationReadinessService.ts";

const SLUG = "cpa01r-clean-journey-pharmacy";
const SERVICE_ID = "pharmacy-first";

const readiness = evaluateServicePageGenerationReadiness(SLUG, SERVICE_ID);
const dashboard = buildServicePageGenerationDashboard(SLUG);
const preflight = assertServicePageGenerationAllowed(SLUG);
const traces = traceServicePageGenerationReadinessFields(SLUG, SERVICE_ID);

const checks = {
  approvedSnapshotLoaded: readiness.approvedSnapshotLoaded,
  nhsPrivateStatus: resolveServicePageGenerationFieldStatus(readiness.evidenceFields, "nhsPrivateStatus"),
  pricing: resolveServicePageGenerationFieldStatus(readiness.evidenceFields, "pricing"),
  fonts: resolveServicePageGenerationFieldStatus(readiness.evidenceFields, "fonts"),
  growthIntelligenceExcluded: traces.find((t) => t.fieldId === "growth_intelligence")?.blocking === "NO",
  generationBlockers: readiness.blockers.length,
  readiness: readiness.readiness,
  dashboardBlockers: dashboard?.blockers.length ?? -1,
  preflightBlockers: preflight.blockers?.length ?? (preflight.ok ? 0 : -1),
  dashboardPreflightParity:
    JSON.stringify(dashboard?.blockers || []) === JSON.stringify(preflight.blockers || []) &&
    dashboard?.canGenerate === preflight.ok,
  canGenerate: dashboard?.canGenerate === true,
};

console.log(JSON.stringify({ traces, checks }, null, 2));

const passed =
  checks.approvedSnapshotLoaded &&
  checks.nhsPrivateStatus === "confirmed" &&
  checks.pricing === "not_applicable" &&
  checks.fonts === "confirmed" &&
  checks.growthIntelligenceExcluded &&
  checks.generationBlockers === 0 &&
  checks.readiness === "READY" &&
  checks.dashboardPreflightParity &&
  checks.canGenerate;

process.exit(passed ? 0 : 1);
