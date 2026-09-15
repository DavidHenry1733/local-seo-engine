/**
 * CPR-RESET-08 — Shared Product Owner evidence decision persistence and restoration.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { readLatestApprovalSnapshot } from "./masterAdminBusinessProfileReviewService.ts";
import {
  isOptionalProductOwnerEvidenceField,
} from "./masterAdminCoreProductRecoveryEvidenceService.ts";
import type { ServicePageEvidenceField } from "./masterAdminCoreProductRecoveryModel.ts";

const REVIEW_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-evidence-review");

export type ProductOwnerEvidenceDecision = "confirmed" | "not_applicable";

export interface ProductOwnerEvidenceFieldDecision {
  customerSlug: string;
  fieldId: string;
  decision: ProductOwnerEvidenceDecision;
  evidenceFingerprint: string;
  evidenceValueAtDecision: string | null;
  sourceRevision: string | null;
  decidedBy: string;
  decidedAt: string;
  invalidatedAt?: string | null;
  invalidationReason?: string | null;
}

export interface ProductOwnerEvidenceDecisionAuditEntry {
  customerSlug: string;
  fieldId: string;
  decision: ProductOwnerEvidenceDecision;
  evidenceFingerprint: string;
  evidenceValueAtDecision: string | null;
  sourceRevision: string | null;
  decidedBy: string;
  decidedAt: string;
  invalidatedAt: string;
  invalidationReason: string;
}

export interface ProductOwnerEvidenceDecisionStore {
  version: 2;
  slug: string;
  evidenceReviewRevision: number;
  decisions: Record<string, ProductOwnerEvidenceFieldDecision>;
  auditHistory: ProductOwnerEvidenceDecisionAuditEntry[];
}

export interface ProductOwnerEvidenceDecisionRestoreResult {
  fieldId: string;
  restored: boolean;
  reason: string | null;
  decision: ProductOwnerEvidenceFieldDecision | null;
}

function fieldDecisionsPath(slug: string, serviceId?: string | null): string {
  const sid = String(serviceId || "").trim();
  if (sid && sid !== "pharmacy-first") {
    return path.join(REVIEW_DIR, slug, "by-service", sid, "field-decisions.json");
  }
  return path.join(REVIEW_DIR, slug, "field-decisions.json");
}

const INHERITABLE_EVIDENCE_GROUPS = new Set(["business", "brand", "images", "seo"]);

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function text(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v || null;
}

export function buildProductOwnerEvidenceFieldFingerprint(field: Pick<
  ServicePageEvidenceField,
  "id" | "value" | "source" | "required" | "allowNotApplicable"
>): string {
  const payload = JSON.stringify({
    id: field.id,
    value: text(field.value),
    source: text(field.source),
    required: Boolean(field.required),
    allowNotApplicable: Boolean(field.allowNotApplicable),
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function emptyStore(slug: string): ProductOwnerEvidenceDecisionStore {
  return {
    version: 2,
    slug,
    evidenceReviewRevision: 0,
    decisions: {},
    auditHistory: [],
  };
}

function normalizeDecisionRecord(
  slug: string,
  fieldId: string,
  raw: Record<string, unknown>,
): ProductOwnerEvidenceFieldDecision | null {
  const decision =
    raw.decision === "not_applicable" || raw.status === "not_applicable"
      ? "not_applicable"
      : raw.decision === "confirmed" || raw.status === "confirmed"
        ? "confirmed"
        : null;
  if (!decision) return null;
  return {
    customerSlug: typeof raw.customerSlug === "string" ? raw.customerSlug : slug,
    fieldId,
    decision,
    evidenceFingerprint: typeof raw.evidenceFingerprint === "string" ? raw.evidenceFingerprint : "",
    evidenceValueAtDecision:
      typeof raw.evidenceValueAtDecision === "string" ? raw.evidenceValueAtDecision : null,
    sourceRevision: typeof raw.sourceRevision === "string" ? raw.sourceRevision : null,
    decidedBy: typeof raw.decidedBy === "string" ? raw.decidedBy : "unknown",
    decidedAt: typeof raw.decidedAt === "string" ? raw.decidedAt : new Date(0).toISOString(),
    invalidatedAt: typeof raw.invalidatedAt === "string" ? raw.invalidatedAt : null,
    invalidationReason: typeof raw.invalidationReason === "string" ? raw.invalidationReason : null,
  };
}

function readStoreFile(slug: string, file: string): ProductOwnerEvidenceDecisionStore {
  if (!fs.existsSync(file)) return emptyStore(slug);
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      version?: number;
      slug?: string;
      evidenceReviewRevision?: number;
      decisions?: Record<string, Record<string, unknown>>;
      auditHistory?: ProductOwnerEvidenceDecisionAuditEntry[];
    };
    const decisions: Record<string, ProductOwnerEvidenceFieldDecision> = {};
    for (const [fieldId, entry] of Object.entries(raw.decisions || {})) {
      const normalized = normalizeDecisionRecord(slug, fieldId, entry || {});
      if (normalized) decisions[fieldId] = normalized;
    }
    return {
      version: 2,
      slug,
      evidenceReviewRevision: raw.evidenceReviewRevision || 0,
      decisions,
      auditHistory: Array.isArray(raw.auditHistory) ? raw.auditHistory : [],
    };
  } catch {
    return emptyStore(slug);
  }
}

export function readProductOwnerEvidenceDecisionStore(
  slug: string,
  serviceId?: string | null,
): ProductOwnerEvidenceDecisionStore {
  return readStoreFile(slug, fieldDecisionsPath(slug, serviceId));
}

/** Merge service-scoped decisions with inherited business/brand/image/seo decisions from legacy PF store. */
export function readMergedProductOwnerEvidenceDecisionStore(
  slug: string,
  serviceId: string,
  fields: Array<Pick<ServicePageEvidenceField, "id" | "group">>,
): ProductOwnerEvidenceDecisionStore {
  const scoped = readProductOwnerEvidenceDecisionStore(slug, serviceId);
  if (!serviceId || serviceId === "pharmacy-first") {
    return readProductOwnerEvidenceDecisionStore(slug);
  }
  const legacy = readProductOwnerEvidenceDecisionStore(slug);
  const merged = emptyStore(slug);
  merged.evidenceReviewRevision = Math.max(
    scoped.evidenceReviewRevision || 0,
    legacy.evidenceReviewRevision || 0,
  );
  merged.auditHistory = [...(scoped.auditHistory || [])];
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  for (const field of fields) {
    if (scoped.decisions[field.id]) {
      merged.decisions[field.id] = scoped.decisions[field.id];
      continue;
    }
    if (INHERITABLE_EVIDENCE_GROUPS.has(String(field.group)) && legacy.decisions[field.id]) {
      merged.decisions[field.id] = legacy.decisions[field.id];
    }
  }
  // Keep scoped-only decisions even if field list temporarily omits them.
  for (const [fieldId, decision] of Object.entries(scoped.decisions)) {
    if (!merged.decisions[fieldId]) merged.decisions[fieldId] = decision;
  }
  void fieldById;
  return merged;
}

function writeProductOwnerEvidenceDecisionStore(
  store: ProductOwnerEvidenceDecisionStore,
  serviceId?: string | null,
): void {
  writeJsonAtomic(fieldDecisionsPath(store.slug, serviceId), store);
}

function legacyFingerprintMatches(
  field: ServicePageEvidenceField,
  decision: ProductOwnerEvidenceFieldDecision,
): boolean {
  const currentValue = text(field.value);
  const storedValue = text(decision.evidenceValueAtDecision);
  if (decision.decision === "not_applicable") {
    return !currentValue && !storedValue;
  }
  if (storedValue !== null) return storedValue === currentValue;
  return Boolean(currentValue);
}

function fingerprintMatches(
  slug: string,
  field: ServicePageEvidenceField,
  decision: ProductOwnerEvidenceFieldDecision,
): boolean {
  if (decision.fieldId !== field.id) return false;
  if (decision.customerSlug && decision.customerSlug !== slug) return false;
  const currentFingerprint = buildProductOwnerEvidenceFieldFingerprint(field);
  if (decision.evidenceFingerprint) {
    return decision.evidenceFingerprint === currentFingerprint;
  }
  return legacyFingerprintMatches(field, decision);
}

function canApplyDecision(field: ServicePageEvidenceField, decision: ProductOwnerEvidenceFieldDecision): boolean {
  if (decision.decision === "not_applicable") {
    return isOptionalProductOwnerEvidenceField(field.id);
  }
  return (
    field.id === "fonts" ||
    Boolean(text(field.value)) ||
    Boolean(field.required) ||
    isOptionalProductOwnerEvidenceField(field.id)
  );
}

export function evaluateProductOwnerEvidenceDecisionRestore(
  slug: string,
  field: ServicePageEvidenceField,
  decision: ProductOwnerEvidenceFieldDecision | null,
): ProductOwnerEvidenceDecisionRestoreResult {
  if (!decision) {
    return { fieldId: field.id, restored: false, reason: "no_persisted_decision", decision: null };
  }
  if (decision.customerSlug && decision.customerSlug !== slug) {
    return { fieldId: field.id, restored: false, reason: "customer_slug_mismatch", decision };
  }
  if (!fingerprintMatches(slug, field, decision)) {
    return { fieldId: field.id, restored: false, reason: "evidence_fingerprint_changed", decision };
  }
  if (!canApplyDecision(field, decision)) {
    return { fieldId: field.id, restored: false, reason: "decision_not_applicable_to_current_field", decision };
  }
  return { fieldId: field.id, restored: true, reason: null, decision };
}

export function restoreProductOwnerEvidenceFieldDecisions(
  slug: string,
  fields: ServicePageEvidenceField[],
  store: ProductOwnerEvidenceDecisionStore = readProductOwnerEvidenceDecisionStore(slug),
  options?: { persistInvalidations?: boolean; persistServiceId?: string | null },
): {
  fields: ServicePageEvidenceField[];
  results: ProductOwnerEvidenceDecisionRestoreResult[];
  store: ProductOwnerEvidenceDecisionStore;
} {
  const results: ProductOwnerEvidenceDecisionRestoreResult[] = [];
  let storeChanged = false;
  const persistInvalidations = options?.persistInvalidations !== false;

  for (const field of fields) {
    const decision = store.decisions[field.id];
    const evaluated = evaluateProductOwnerEvidenceDecisionRestore(slug, field, decision || null);
    results.push(evaluated);
    if (!decision) continue;
    if (!evaluated.restored) {
      if (evaluated.reason === "evidence_fingerprint_changed") {
        field.status = "not_confirmed";
        field.productOwnerDecided = false;
        field.decisionInvalidatedReason =
          "Underlying evidence changed since the Product Owner decision — review and confirm again.";
        if (persistInvalidations && !decision.invalidatedAt) {
          store.auditHistory.push({
            customerSlug: slug,
            fieldId: field.id,
            decision: decision.decision,
            evidenceFingerprint: decision.evidenceFingerprint,
            evidenceValueAtDecision: decision.evidenceValueAtDecision,
            sourceRevision: decision.sourceRevision,
            decidedBy: decision.decidedBy,
            decidedAt: decision.decidedAt,
            invalidatedAt: new Date().toISOString(),
            invalidationReason: field.decisionInvalidatedReason,
          });
          delete store.decisions[field.id];
          storeChanged = true;
        }
      }
      continue;
    }
    field.status = decision.decision;
    field.productOwnerDecided = true;
    field.decisionInvalidatedReason = null;
    if (decision.evidenceValueAtDecision && decision.decision === "confirmed") {
      field.value = decision.evidenceValueAtDecision;
    }
    if (persistInvalidations && !decision.evidenceFingerprint) {
      store.decisions[field.id] = {
        ...decision,
        customerSlug: slug,
        evidenceFingerprint: buildProductOwnerEvidenceFieldFingerprint(field),
        evidenceValueAtDecision: text(field.value),
        sourceRevision: text(field.source),
      };
      storeChanged = true;
    }
  }

  if (storeChanged && persistInvalidations) {
    writeProductOwnerEvidenceDecisionStore(store, options?.persistServiceId);
  }

  return { fields, results, store };
}

export function saveProductOwnerEvidenceFieldDecision(input: {
  slug: string;
  field: ServicePageEvidenceField;
  decision: ProductOwnerEvidenceDecision;
  decidedBy: string;
  serviceId?: string | null;
}): ProductOwnerEvidenceDecisionStore {
  const serviceId = input.serviceId || null;
  const store = readProductOwnerEvidenceDecisionStore(input.slug, serviceId);
  const fingerprint = buildProductOwnerEvidenceFieldFingerprint(input.field);
  store.decisions[input.field.id] = {
    customerSlug: input.slug,
    fieldId: input.field.id,
    decision: input.decision,
    evidenceFingerprint: fingerprint,
    evidenceValueAtDecision: text(input.field.value),
    sourceRevision: text(input.field.source),
    decidedBy: input.decidedBy,
    decidedAt: new Date().toISOString(),
    invalidatedAt: null,
    invalidationReason: null,
  };
  store.evidenceReviewRevision = (store.evidenceReviewRevision || 0) + 1;
  writeProductOwnerEvidenceDecisionStore(store, serviceId);
  return store;
}

export function currentBusinessProfileRevision(slug: string): number {
  return readLatestApprovalSnapshot(slug)?.profileRevision || 0;
}

export function traceProductOwnerEvidenceDecisionFields(
  slug: string,
  fields: ServicePageEvidenceField[],
  fieldIds: string[],
): Array<Record<string, unknown>> {
  const store = readProductOwnerEvidenceDecisionStore(slug);
  const profileRevision = currentBusinessProfileRevision(slug);

  return fieldIds.map((fieldId) => {
    const field = fields.find((entry) => entry.id === fieldId);
    const decision = store.decisions[fieldId] || null;
    const restore = field ? evaluateProductOwnerEvidenceDecisionRestore(slug, field, decision) : null;
    const currentFingerprint = field ? buildProductOwnerEvidenceFieldFingerprint(field) : null;
    return {
      fieldId,
      currentEvidenceReviewValue: field?.value ?? null,
      currentDisplayedStatus: field?.status ?? "missing",
      existingPersistedDecision: decision ? decision.decision : null,
      persistedDecisionValue: decision?.evidenceValueAtDecision ?? null,
      persistedCustomerSlug: decision?.customerSlug ?? slug,
      persistedFieldId: decision?.fieldId ?? null,
      persistedBusinessProfileRevision: null,
      persistedEvidenceReviewRevision: store.evidenceReviewRevision,
      currentBusinessProfileRevision: profileRevision,
      currentEvidenceReviewRevision: store.evidenceReviewRevision,
      currentFieldEvidenceFingerprint: currentFingerprint,
      persistedFieldEvidenceFingerprint: decision?.evidenceFingerprint ?? null,
      restoredIntoEvidenceReview: restore?.restored ? "YES" : "NO",
      reasonNotRestored: restore?.reason ?? "field_missing",
    };
  });
}
