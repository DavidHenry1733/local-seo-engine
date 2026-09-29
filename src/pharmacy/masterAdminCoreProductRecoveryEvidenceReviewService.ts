/**
 * CPR-03 — Phase 3 Product Owner evidence review (approval required before generation).
 */
import fs from "node:fs";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { resolveCustomerFacingPharmacyName } from "./pharmacyServicePageProfileContext.ts";
import { readLatestApprovalSnapshot } from "./masterAdminBusinessProfileReviewService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import {
  applyBusinessProfileApprovalEvidenceInheritance,
  buildCprEvidenceFields,
  enrichEvidenceFieldsWithSeo,
  enrichImageEvidenceFields,
  enrichReviewableEvidenceFields,
  evaluateRequiredEvidenceGate,
  requiresServicePageProductOwnerConfirmation,
} from "./masterAdminCoreProductRecoveryEvidenceService.ts";
import { buildServicePageSeoPlan, readServicePageSeoPlan } from "./masterAdminCoreProductRecoverySeoService.ts";
import { validateFutureClusterLinkPlan } from "./masterAdminCoreProductRecoveryFutureLinkPlanService.ts";
import { buildImageSelectionsForDashboard } from "./masterAdminCoreProductRecoveryService.ts";
import type { ServicePageEvidenceField } from "./masterAdminCoreProductRecoveryModel.ts";
import {
  readMergedProductOwnerEvidenceDecisionStore,
  readProductOwnerEvidenceDecisionStore,
  restoreProductOwnerEvidenceFieldDecisions,
  saveProductOwnerEvidenceFieldDecision,
  traceProductOwnerEvidenceDecisionFields,
  type ProductOwnerEvidenceDecisionStore,
  type ProductOwnerEvidenceFieldDecision,
} from "./masterAdminServicePageEvidenceDecisionService.ts";
import {
  approvalRecordMatchesIdentity,
  legacyServiceEvidenceDecisionPath,
  resolveServiceEvidenceApprovalIdentity,
  resolveServiceEvidenceDecisionFile,
  scopedServiceEvidenceDecisionPath,
  writeJsonAtomic as writeApprovalJsonAtomic,
  type ServiceEvidenceApprovalIdentity,
} from "./masterAdminServiceEvidenceApprovalStore.ts";

export interface EvidenceReviewSection {
  id: "business" | "brand" | "images" | "service" | "trust" | "seo";
  label: string;
  fields: ServicePageEvidenceField[];
  confirmedCount: number;
  totalCount: number;
  ready: boolean;
}

export interface ServicePageEvidenceReviewPayload {
  version: 1;
  slug: string;
  customerName: string;
  primaryService: string;
  primaryServiceName: string;
  sections: EvidenceReviewSection[];
  summary: string;
  canApprove: boolean;
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  blockers: string[];
  businessProfileRevision: number;
  evidenceReviewRevision: number;
}

interface EvidenceFieldDecisionRecord {
  fieldId: string;
  status: "confirmed" | "not_applicable";
  decidedBy: string;
  decidedAt: string;
}

function mapStoreDecision(decision: ProductOwnerEvidenceFieldDecision): EvidenceFieldDecisionRecord {
  return {
    fieldId: decision.fieldId,
    status: decision.decision,
    decidedBy: decision.decidedBy,
    decidedAt: decision.decidedAt,
  };
}

function readFieldDecisionStore(slug: string): ProductOwnerEvidenceDecisionStore {
  return readProductOwnerEvidenceDecisionStore(slug);
}

function resolveServiceId(slug: string): string {
  const ctx = loadMasterAdminCustomerContext(slug);
  return ctx?.serviceId || "pharmacy-first";
}

function currentBusinessProfileRevision(slug: string): number {
  return readLatestApprovalSnapshot(slug)?.profileRevision || 0;
}

function emptyApprovalRecord(): {
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  businessProfileRevision: number | null;
  evidenceReviewRevision: number | null;
  fieldDecisions: Record<string, EvidenceFieldDecisionRecord>;
  identity: ServiceEvidenceApprovalIdentity | null;
  approvalSource: "campaign" | "service" | "legacy" | "none";
} {
  return {
    approved: false,
    approvedAt: null,
    approvedBy: null,
    businessProfileRevision: null,
    evidenceReviewRevision: null,
    fieldDecisions: {},
    identity: null,
    approvalSource: "none",
  };
}

function readApprovalRecord(
  slug: string,
  serviceId?: string,
  campaignId?: string | null,
): {
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  businessProfileRevision: number | null;
  evidenceReviewRevision: number | null;
  fieldDecisions: Record<string, EvidenceFieldDecisionRecord>;
  identity: ServiceEvidenceApprovalIdentity | null;
  approvalSource: "campaign" | "service" | "legacy" | "none";
} {
  const identity = resolveServiceEvidenceApprovalIdentity(slug, serviceId || resolveServiceId(slug), campaignId);
  const resolved = resolveServiceEvidenceDecisionFile(identity);
  if (resolved.source === "none" || !resolved.filePath) {
    return { ...emptyApprovalRecord(), identity };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(resolved.filePath, "utf8")) as {
      decision?: string;
      approvedAt?: string;
      approvedBy?: string;
      businessProfileRevision?: number;
      evidenceReviewRevision?: number;
      fieldDecisions?: Record<string, EvidenceFieldDecisionRecord>;
      serviceId?: string;
      campaignId?: string;
      approvalType?: string;
      slug?: string;
    };
    // Scoped records must match identity; legacy PF records have no serviceId and apply only via path rules.
    if (resolved.source !== "legacy" && !approvalRecordMatchesIdentity(raw, identity)) {
      return { ...emptyApprovalRecord(), identity };
    }
    if (resolved.source === "legacy" && identity.serviceId !== "pharmacy-first") {
      return { ...emptyApprovalRecord(), identity };
    }
    return {
      approved: raw.decision === "approved",
      approvedAt: raw.approvedAt || null,
      approvedBy: raw.approvedBy || null,
      businessProfileRevision: raw.businessProfileRevision ?? null,
      evidenceReviewRevision: raw.evidenceReviewRevision ?? null,
      fieldDecisions: raw.fieldDecisions || {},
      identity,
      approvalSource: resolved.source,
    };
  } catch {
    return { ...emptyApprovalRecord(), identity };
  }
}

function readApproval(
  slug: string,
  serviceId?: string,
  campaignId?: string | null,
): { approved: boolean; approvedAt: string | null; approvedBy: string | null } {
  const record = readApprovalRecord(slug, serviceId, campaignId);
  return { approved: record.approved, approvedAt: record.approvedAt, approvedBy: record.approvedBy };
}

function approvalWritePath(identity: ServiceEvidenceApprovalIdentity): string {
  return scopedServiceEvidenceDecisionPath(identity.tenantSlug, identity.serviceId, identity.campaignId);
}

export function readServicePageEvidenceFieldDecisionStore(slug: string): ProductOwnerEvidenceDecisionStore {
  return readProductOwnerEvidenceDecisionStore(slug);
}

export function applyServicePageEvidenceFieldDecisions(
  fields: ServicePageEvidenceField[],
  store: ProductOwnerEvidenceDecisionStore,
  slug: string,
): ServicePageEvidenceField[] {
  return restoreProductOwnerEvidenceFieldDecisions(slug, fields, store).fields;
}

function prepareEvidenceReviewFields(slug: string, serviceId: string): ServicePageEvidenceField[] {
  const imageSelections = buildImageSelectionsForDashboard(slug, serviceId);
  const seoPlan = readServicePageSeoPlan(slug) || buildServicePageSeoPlan(slug, serviceId);
  const futureLinkValidation = validateFutureClusterLinkPlan(slug, serviceId);
  let fields = enrichEvidenceFieldsWithSeo(buildCprEvidenceFields(slug, serviceId), {
    title: seoPlan.title,
    metaDescription: seoPlan.metaDescription,
    canonicalUrl: seoPlan.canonicalUrl,
    schemaTypes: seoPlan.schemaTypes,
    validLinks: seoPlan.validLinks,
    futureLinkPlanReady: futureLinkValidation.passed,
  });
  fields = enrichImageEvidenceFields(fields, imageSelections);
  fields = enrichReviewableEvidenceFields(slug, fields, serviceId);
  fields = finalizeEvidenceReviewFields(fields);
  return applyBusinessProfileApprovalEvidenceInheritance(slug, fields, serviceId);
}

export function buildServicePageEvidenceFieldPipeline(slug: string, serviceId: string): {
  fields: ServicePageEvidenceField[];
  imageSelections: ReturnType<typeof buildImageSelectionsForDashboard>;
  seoPlan: ReturnType<typeof readServicePageSeoPlan>;
  futureLinkValidation: ReturnType<typeof validateFutureClusterLinkPlan>;
  fieldStore: ProductOwnerEvidenceDecisionStore;
  approval: ReturnType<typeof readApprovalRecord>;
} {
  const imageSelections = buildImageSelectionsForDashboard(slug, serviceId);
  const seoPlan = readServicePageSeoPlan(slug) || buildServicePageSeoPlan(slug, serviceId);
  const futureLinkValidation = validateFutureClusterLinkPlan(slug, serviceId);
  let fields = prepareEvidenceReviewFields(slug, serviceId);
  const fieldStore = readMergedProductOwnerEvidenceDecisionStore(slug, serviceId, fields);
  const approval = readApprovalRecord(slug, serviceId);
  const persistServiceId = serviceId === "pharmacy-first" ? null : serviceId;
  fields = restoreProductOwnerEvidenceFieldDecisions(slug, fields, fieldStore, {
    // Never mutate legacy Pharmacy First field-decisions while reviewing another service.
    persistInvalidations: serviceId === "pharmacy-first",
    persistServiceId,
  }).fields;
  return { fields, imageSelections, seoPlan, futureLinkValidation, fieldStore, approval };
}

function text(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v || null;
}

function isEvidenceReviewApplicableField(field: ServicePageEvidenceField): boolean {
  if (field.status === "not_applicable") return false;
  if (
    field.status === "not_confirmed" &&
    !field.required &&
    !field.allowNotApplicable &&
    !text(field.value)
  ) {
    return false;
  }
  return true;
}

function evidenceFieldBlocksApproval(field: ServicePageEvidenceField): boolean {
  if (!isEvidenceReviewApplicableField(field)) return false;
  if (
    field.status === "not_confirmed" &&
    !field.required &&
    field.allowNotApplicable &&
    field.group === "trust" &&
    !text(field.value) &&
    !field.productOwnerDecided
  ) {
    return false;
  }
  return field.status !== "confirmed" && field.status !== "not_applicable";
}

/** Optional Trust placeholders with no evidence are not missing required evidence. */
function normalizeInformationalEvidenceFields(fields: ServicePageEvidenceField[]): void {
  for (const field of fields) {
    if (
      field.status === "not_confirmed" &&
      !field.required &&
      !text(field.value) &&
      !field.productOwnerDecided &&
      (!field.allowNotApplicable || field.group === "trust")
    ) {
      field.status = "not_applicable";
    }
  }
}

function resolveDerivedServiceEvidenceFromBusinessFields(fields: ServicePageEvidenceField[]): void {
  const get = (id: string) => fields.find((field) => field.id === id);
  const patchDerived = (id: string, value: string | null) => {
    const field = get(id);
    if (!field || field.productOwnerDecided || text(field.value) || !value) return;
    field.value = value;
    field.source = "derived-from-business-evidence";
    if (requiresServicePageProductOwnerConfirmation(field.id, String(field.group))) {
      field.status = "not_confirmed";
      return;
    }
    field.status = "confirmed";
    field.productOwnerDecided = true;
  };

  const phone = text(get("telephone")?.value);
  const website = text(get("website")?.value);
  const phoneConfirmed = get("telephone")?.status === "confirmed";
  const websiteConfirmed = get("website")?.status === "confirmed";

  const primaryCta =
    websiteConfirmed && website && /^https?:\/\//i.test(website)
      ? website
      : phoneConfirmed && phone
        ? `tel:${phone.replace(/[^\d+]/g, "")}`
        : null;
  patchDerived("primaryCta", primaryCta);

  const accessMethod =
    phoneConfirmed && websiteConfirmed
      ? `Telephone ${phone} or website ${website}`
      : phoneConfirmed
        ? `Telephone ${phone}`
        : websiteConfirmed
          ? `Website ${website}`
          : null;
  patchDerived("accessMethod", accessMethod);

  const accessValue = text(get("accessMethod")?.value);
  if (get("accessMethod")?.status === "confirmed" && accessValue) {
    patchDerived("walkInPolicy", accessValue);
    patchDerived("appointmentPolicy", accessValue);
    patchDerived("bookingRoute", accessValue);
  }
}

function finalizeEvidenceReviewFields(fields: ServicePageEvidenceField[]): ServicePageEvidenceField[] {
  resolveDerivedServiceEvidenceFromBusinessFields(fields);
  normalizeInformationalEvidenceFields(fields);
  return fields;
}

function buildSection(id: EvidenceReviewSection["id"], label: string, fields: ServicePageEvidenceField[]): EvidenceReviewSection {
  const applicable = fields.filter(isEvidenceReviewApplicableField);
  const confirmed = applicable.filter((f) => f.status === "confirmed");
  return {
    id,
    label,
    fields,
    confirmedCount: confirmed.length,
    totalCount: applicable.length,
    ready: applicable.length === 0 || confirmed.length === applicable.length,
  };
}

function collectReviewBlockers(fields: ServicePageEvidenceField[]): string[] {
  const blockers: string[] = [];
  for (const field of fields) {
    if (!evidenceFieldBlocksApproval(field)) continue;
    if (field.required) {
      blockers.push(`${field.label} must be confirmed before approval.`);
    } else if (field.allowNotApplicable) {
      blockers.push(`${field.label} must be confirmed or marked Not Applicable.`);
    } else {
      blockers.push(`${field.label} evidence incomplete — confirm before approval.`);
    }
  }
  return blockers;
}

export function buildServicePageEvidenceReview(slug: string): ServicePageEvidenceReviewPayload | null {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return null;
  const profile = readSetupProfile(slug);
  const serviceId = resolveServiceId(slug);
  const meta = getServicePublishMeta(serviceId);
  const { fields, imageSelections, seoPlan, futureLinkValidation: futureValidation, fieldStore } =
    buildServicePageEvidenceFieldPipeline(slug, serviceId);
  const requiredEvidenceGate = evaluateRequiredEvidenceGate({
    slug,
    serviceId,
    evidenceFields: fields,
    imageSelections,
    canonicalUrl: seoPlan.canonicalUrl,
  });

  const sections = [
    buildSection("business", "Business", fields.filter((f) => f.group === "business")),
    buildSection("brand", "Brand", fields.filter((f) => f.group === "brand")),
    buildSection("images", "Images", fields.filter((f) => f.group === "images")),
    buildSection("service", "Service", fields.filter((f) => f.group === "service")),
    buildSection("trust", "Trust", fields.filter((f) => f.group === "trust")),
    buildSection("seo", "SEO", fields.filter((f) => f.group === "seo")),
  ];

  const blockers = collectReviewBlockers(fields);
  for (const section of sections) {
    if (!section.ready) blockers.push(`${section.label} evidence incomplete — confirm all required fields before approval.`);
  }
  if (!requiredEvidenceGate.passed) {
    blockers.push(...requiredEvidenceGate.blockers);
  }

  const approval = readApproval(slug, serviceId);
  const allSectionsReady = sections.every((s) => s.ready);
  const uniqueBlockers = [...new Set(blockers)];

  return {
    version: 1,
    slug,
    customerName: resolveCustomerFacingPharmacyName(profile) || slug,
    primaryService: serviceId,
    primaryServiceName: meta?.serviceName || serviceId,
    sections,
    summary: approval.approved
      ? "Product Owner approved evidence — service page generation is enabled."
      : allSectionsReady && requiredEvidenceGate.passed
        ? "Evidence complete — Product Owner review and approval required before generation."
        : "Complete Product Owner evidence decisions before approval.",
    canApprove: allSectionsReady && requiredEvidenceGate.passed && !approval.approved,
    approved: approval.approved,
    approvedAt: approval.approvedAt,
    approvedBy: approval.approvedBy,
    blockers: uniqueBlockers,
    businessProfileRevision: currentBusinessProfileRevision(slug),
    evidenceReviewRevision: fieldStore.evidenceReviewRevision,
  };
}

export function traceServicePageEvidenceFieldDecisions(slug: string, fieldIds: string[]) {
  const serviceId = resolveServiceId(slug);
  const prepared = prepareEvidenceReviewFields(slug, serviceId);
  const restored = buildServicePageEvidenceFieldPipeline(slug, serviceId).fields;
  return {
    prepared: traceProductOwnerEvidenceDecisionFields(slug, prepared, fieldIds),
    restored: traceProductOwnerEvidenceDecisionFields(slug, restored, fieldIds),
  };
}

export function decideServicePageEvidenceReviewField(
  slug: string,
  fieldId: string,
  action: "confirm" | "not_applicable" | "edit_value",
  operator: string,
  editedValue?: string,
): ServicePageEvidenceReviewPayload | null {
  const review = buildServicePageEvidenceReview(slug);
  if (!review || review.approved) return null;

  const serviceId = resolveServiceId(slug);
  const field = prepareEvidenceReviewFields(slug, serviceId).find((entry) => entry.id === fieldId);
  if (!field) return null;

  if (field.id === "privateServicesOffered") {
    if (action === "not_applicable") return null;
    const nextValue = action === "edit_value" ? text(editedValue) : text(field.value);
    if (nextValue !== "Yes" && nextValue !== "No") return null;
    field.value = nextValue;
    field.source = "product-owner-edit";
    saveProductOwnerEvidenceFieldDecision({
      slug,
      serviceId,
      field: { ...field, value: nextValue, status: "confirmed" },
      decision: "confirmed",
      decidedBy: operator,
    });
    return buildServicePageEvidenceReview(slug);
  }

  if (action === "edit_value") {
    const nextValue = text(editedValue);
    if (!nextValue) return null;
    field.value = nextValue;
    field.source = "product-owner-edit";
    saveProductOwnerEvidenceFieldDecision({
      slug,
      serviceId,
      field: { ...field, status: "confirmed" },
      decision: "confirmed",
      decidedBy: operator,
    });
    return buildServicePageEvidenceReview(slug);
  }

  if (action === "not_applicable") {
    if (!field.allowNotApplicable) return null;
  } else if (!field.value && field.id !== "fonts") {
    return null;
  }

  saveProductOwnerEvidenceFieldDecision({
    slug,
    serviceId,
    field,
    decision: action === "confirm" ? "confirmed" : "not_applicable",
    decidedBy: operator,
  });
  return buildServicePageEvidenceReview(slug);
}

export function isServicePageEvidenceReviewApproved(
  slug: string,
  serviceId?: string,
  campaignId?: string | null,
): boolean {
  const sid = serviceId || resolveServiceId(slug);
  return readApproval(slug, sid, campaignId).approved;
}

export function approveServicePageEvidenceReview(slug: string, operator: string): ServicePageEvidenceReviewPayload | null {
  const review = buildServicePageEvidenceReview(slug);
  if (!review || !review.canApprove) return null;
  const serviceId = resolveServiceId(slug);
  const identity = resolveServiceEvidenceApprovalIdentity(slug, serviceId);
  const fieldStore = readMergedProductOwnerEvidenceDecisionStore(slug, serviceId, review.sections.flatMap((s) => s.fields));
  const payload = {
    slug,
    serviceId: identity.serviceId,
    campaignId: identity.campaignId,
    approvalType: identity.approvalType,
    decision: "approved",
    operator,
    approvedAt: new Date().toISOString(),
    approvedBy: operator,
    sections: review.sections.map((s) => s.id),
    businessProfileRevision: currentBusinessProfileRevision(slug),
    evidenceReviewRevision: fieldStore.evidenceReviewRevision,
    fieldDecisions: Object.fromEntries(
      Object.entries(fieldStore.decisions).map(([fieldId, decision]) => [fieldId, mapStoreDecision(decision)]),
    ),
  };
  writeApprovalJsonAtomic(approvalWritePath(identity), payload);
  // Keep legacy Pharmacy First decision.json in sync for older consumers.
  if (identity.serviceId === "pharmacy-first") {
    writeApprovalJsonAtomic(legacyServiceEvidenceDecisionPath(slug), payload);
  }
  return buildServicePageEvidenceReview(slug);
}

export function rejectServicePageEvidenceReview(slug: string, operator: string, notes: string): ServicePageEvidenceReviewPayload | null {
  const review = buildServicePageEvidenceReview(slug);
  if (!review) return null;
  const serviceId = resolveServiceId(slug);
  const identity = resolveServiceEvidenceApprovalIdentity(slug, serviceId);
  const payload = {
    slug,
    serviceId: identity.serviceId,
    campaignId: identity.campaignId,
    approvalType: identity.approvalType,
    decision: "needs_changes",
    operator,
    notes,
    decidedAt: new Date().toISOString(),
  };
  writeApprovalJsonAtomic(approvalWritePath(identity), payload);
  if (identity.serviceId === "pharmacy-first") {
    writeApprovalJsonAtomic(legacyServiceEvidenceDecisionPath(slug), payload);
  }
  return buildServicePageEvidenceReview(slug);
}
