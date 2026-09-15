/**
 * CPR-14 — Shared service-page-only generation readiness contract.
 * Uses approved Evidence Review snapshot for both dashboard panel and job preflight.
 */
import { readLatestApprovalSnapshot } from "./masterAdminBusinessProfileReviewService.ts";
import { evaluateRequiredEvidenceGate, type RequiredEvidenceGateResult } from "./masterAdminCoreProductRecoveryEvidenceService.ts";
import { buildServicePageEvidenceFieldPipeline } from "./masterAdminCoreProductRecoveryEvidenceReviewService.ts";
import { currentBusinessProfileRevision } from "./masterAdminServicePageEvidenceDecisionService.ts";
import type { ServicePageEvidenceField } from "./masterAdminCoreProductRecoveryModel.ts";
import { runPreGenerationValidation, type PreGenerationDependencyCheck } from "./masterAdminPreGenerationValidation.ts";

export const SERVICE_PAGE_ONLY_EXCLUDED_PREFLIGHT_BLOCKER_IDS = new Set([
  "growth_intelligence",
  "input_local_areas",
]);

export interface ServicePageGenerationReadinessResult {
  readiness: "READY" | "BLOCKED";
  blockers: string[];
  warnings: string[];
  evidenceFields: ServicePageEvidenceField[];
  requiredEvidenceGate: RequiredEvidenceGateResult;
  evidenceReviewApproved: boolean;
  approvedSnapshotLoaded: boolean;
  businessProfileRevision: number;
  evidenceReviewRevision: number;
  preflightChecks: PreGenerationDependencyCheck[];
  preflightBlockers: string[];
  canGenerateEvidence: boolean;
}

function fieldStatus(fields: ServicePageEvidenceField[], id: string): ServicePageEvidenceField["status"] | "missing" {
  return fields.find((f) => f.id === id)?.status || "missing";
}

export function evaluateServicePageGenerationReadiness(slug: string, serviceId: string): ServicePageGenerationReadinessResult {
  const pipeline = buildServicePageEvidenceFieldPipeline(slug, serviceId);
  const { fields, imageSelections, seoPlan, futureLinkValidation, fieldStore, approval } = pipeline;

  const requiredEvidenceGate = evaluateRequiredEvidenceGate({
    slug,
    serviceId,
    evidenceFields: fields,
    imageSelections,
    canonicalUrl: seoPlan.canonicalUrl,
  });

  const pre = runPreGenerationValidation(slug);
  const preflightBlockers = pre.checks
    .filter(
      (c) =>
        c.severity === "blocker" &&
        !c.passed &&
        !SERVICE_PAGE_ONLY_EXCLUDED_PREFLIGHT_BLOCKER_IDS.has(c.id),
    )
    .map((c) => c.label);

  const blockers: string[] = [...preflightBlockers];
  if (!futureLinkValidation.passed) blockers.push(...futureLinkValidation.errors);

  const evidenceReviewApproved = approval.approved;
  const approvedSnapshotLoaded = evidenceReviewApproved && Object.keys(approval.fieldDecisions).length > 0;

  if (!evidenceReviewApproved) {
    blockers.push("Product Owner evidence review approval required before service page generation.");
  } else if (!approvedSnapshotLoaded) {
    blockers.push("Approved evidence review snapshot missing — re-approve evidence before generation.");
  } else {
    const currentProfileRevision = readLatestApprovalSnapshot(slug)?.profileRevision || 0;
    if (
      approval.businessProfileRevision !== null &&
      approval.businessProfileRevision !== currentProfileRevision
    ) {
      blockers.push("Business Profile changed since evidence review approval — re-approve evidence.");
    }
    if (
      approval.evidenceReviewRevision !== null &&
      approval.evidenceReviewRevision !== fieldStore.evidenceReviewRevision
    ) {
      blockers.push("Evidence review decisions changed since approval — re-approve evidence.");
    }
  }

  if (!requiredEvidenceGate.passed) {
    blockers.push(...requiredEvidenceGate.blockers);
  }

  const uniqueBlockers = [...new Set(blockers)];
  const canGenerateEvidence =
    evidenceReviewApproved && approvedSnapshotLoaded && requiredEvidenceGate.passed && uniqueBlockers.length === 0;

  return {
    readiness: canGenerateEvidence ? "READY" : "BLOCKED",
    blockers: uniqueBlockers,
    warnings: pre.warnings,
    evidenceFields: fields,
    requiredEvidenceGate,
    evidenceReviewApproved,
    approvedSnapshotLoaded,
    businessProfileRevision: currentBusinessProfileRevision(slug),
    evidenceReviewRevision: fieldStore.evidenceReviewRevision,
    preflightChecks: pre.checks,
    preflightBlockers,
    canGenerateEvidence,
  };
}

export function traceServicePageGenerationReadinessFields(
  slug: string,
  serviceId: string,
): Array<{
  fieldId: string;
  approvedStatus: string;
  persistedStatus: string;
  generationPanelStatus: string;
  preflightStatus: string;
  blocking: "YES" | "NO";
  sourceFile: string;
  revisionUsed: string;
}> {
  const readiness = evaluateServicePageGenerationReadiness(slug, serviceId);
  const pipeline = buildServicePageEvidenceFieldPipeline(slug, serviceId);
  const traceIds = ["nhsPrivateStatus", "pricing", "fonts"] as const;

  const traces = traceIds.map((fieldId) => {
    const field = readiness.evidenceFields.find((f) => f.id === fieldId);
    const persisted = pipeline.fieldStore.decisions[fieldId]?.decision || pipeline.approval.fieldDecisions[fieldId]?.status || "none";
    const approved = pipeline.approval.fieldDecisions[fieldId]?.status || (pipeline.approval.approved ? persisted : "pending");
    return {
      fieldId,
      approvedStatus: approved,
      persistedStatus: persisted,
      generationPanelStatus: field?.status || "missing",
      preflightStatus: field?.status || "missing",
      blocking: field?.status === "not_confirmed" && field.required ? "YES" : "NO",
      sourceFile: "data/pharmacy-master-admin/service-page-evidence-review/" + slug + "/field-decisions.json",
      revisionUsed: String(readiness.evidenceReviewRevision),
    };
  });

  const giCheck = readiness.preflightChecks.find((c) => c.id === "growth_intelligence");
  traces.push({
    fieldId: "growth_intelligence",
    approvedStatus: giCheck?.passed ? "PASS" : "not required for service-page-only",
    persistedStatus: giCheck?.evidence || "n/a",
    generationPanelStatus: SERVICE_PAGE_ONLY_EXCLUDED_PREFLIGHT_BLOCKER_IDS.has("growth_intelligence") ? "excluded" : giCheck?.passed ? "PASS" : "FAIL",
    preflightStatus: SERVICE_PAGE_ONLY_EXCLUDED_PREFLIGHT_BLOCKER_IDS.has("growth_intelligence") ? "NOT A BLOCKER" : giCheck?.passed ? "PASS" : "BLOCKER",
    blocking: SERVICE_PAGE_ONLY_EXCLUDED_PREFLIGHT_BLOCKER_IDS.has("growth_intelligence") ? "NO" : giCheck?.passed ? "NO" : "YES",
    sourceFile: "src/pharmacy/masterAdminPreGenerationValidation.ts",
    revisionUsed: String(readiness.businessProfileRevision),
  });

  return traces;
}

export function resolveServicePageGenerationFieldStatus(
  fields: ServicePageEvidenceField[],
  fieldId: string,
): ServicePageEvidenceField["status"] | "missing" {
  return fieldStatus(fields, fieldId);
}
