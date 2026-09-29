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
  privateServicesOffered: resolveServicePageGenerationFieldStatus(readiness.evidenceFields, "privateServicesOffered"),
  nhsPrivateStatusAbsent: !readiness.evidenceFields.some((field) => field.id === "nhsPrivateStatus"),
  pricing: resolveServicePageGenerationFieldStatus(readiness.evidenceFields, "pricing"),
  fonts: resolveServicePageGenerationFieldStatus(readiness.evidenceFields, "fonts"),
  growthIntelligenceExcluded: traces.find((t) => t.fieldId === "growth_intelligence")?.blocking === "NO",
  generationBlockers: readiness.blockers.length,
  readiness: readiness.readiness,
  dashboardBlockers: dashboard?.blockers.length ?? -1,
  preflightBlockers: preflight.blockers?.length ?? (preflight.ok ? 0 : -1),
  dashboardMatchesReadiness: JSON.stringify(dashboard?.blockers || []) === JSON.stringify(readiness.blockers),
  canGenerate: dashboard?.canGenerate === true,
  preflightBlocked: preflight.ok === false,
  privateServicesBlocksGeneration: readiness.blockers.some((blocker) =>
    blocker.includes("Private services offered must be confirmed as Yes or No"),
  ),
};

console.log(JSON.stringify({ traces, checks }, null, 2));

const passed =
  checks.approvedSnapshotLoaded &&
  checks.privateServicesOffered === "not_confirmed" &&
  checks.nhsPrivateStatusAbsent &&
  checks.pricing === "not_applicable" &&
  checks.fonts === "confirmed" &&
  checks.growthIntelligenceExcluded &&
  checks.privateServicesBlocksGeneration &&
  checks.readiness === "BLOCKED" &&
  checks.dashboardMatchesReadiness &&
  checks.preflightBlocked &&
  !checks.canGenerate;

process.exit(passed ? 0 : 1);
