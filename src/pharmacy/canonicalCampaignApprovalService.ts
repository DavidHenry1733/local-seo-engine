/**
 * CP03 canonical approval authority.
 * One campaign-scoped decision log bound to the current publishable page revision.
 * Historical approval stores are read as evidence and are not rewritten.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  resolveCanonicalCampaignIdForService,
  resolveCanonicalCampaignMembership,
} from "./canonicalCampaignLifecycleResolver.ts";
import {
  resolveCanonicalPageContentRevision,
  type CanonicalPublishablePageType,
} from "./canonicalCampaignContentRevision.ts";

export const CANONICAL_APPROVAL_STORE_VERSION = 1 as const;

export type CanonicalApprovalDecisionState = "PENDING" | "APPROVED" | "REJECTED" | "STALE";

export type CanonicalApprovalWriteSource = "review-centre" | "master-admin";

export type CanonicalApprovalEvidenceClass =
  | "AUTHORITATIVE"
  | "COMPATIBILITY"
  | "HISTORICAL"
  | "UNSCOPED"
  | "AMBIGUOUS";

export interface CanonicalApprovalEvidence {
  mechanism: string;
  classification: CanonicalApprovalEvidenceClass;
  code:
    | "CURRENT_REVISION_APPROVED"
    | "LEGACY_APPROVAL_REVISION_UNRESOLVED"
    | "STALE_APPROVAL"
    | "UNATTACHED_APPROVAL"
    | null;
  detail: string;
}

export interface CanonicalPageApproval {
  tenantSlug: string;
  campaignId: string;
  serviceId: string;
  pageType: CanonicalPublishablePageType;
  areaSlug: string | null;
  contentRevision: string | null;
  decision: CanonicalApprovalDecisionState;
  reviewedAt: string | null;
  reviewer: string | null;
  source: CanonicalApprovalWriteSource | null;
  evidence: CanonicalApprovalEvidence[];
}

export interface CanonicalCampaignApproval {
  resolved: boolean;
  tenantSlug: string | null;
  campaignId: string | null;
  serviceId: string | null;
  service: CanonicalPageApproval | null;
  localities: CanonicalPageApproval[];
  ready: boolean;
  evidence: CanonicalApprovalEvidence[];
}

interface StoredDecision {
  pageType: CanonicalPublishablePageType;
  areaSlug: string | null;
  contentRevision: string;
  decision: "approved" | "rejected";
  reviewedAt: string;
  reviewer: string | null;
  source: CanonicalApprovalWriteSource;
}

interface ApprovalStore {
  version: typeof CANONICAL_APPROVAL_STORE_VERSION;
  tenantSlug: string;
  campaignId: string;
  serviceId: string;
  decisions: StoredDecision[];
}

const REVIEW_CENTRE_SERVICE_KEY = "service-page-candidate";
const REVIEW_CENTRE_LOCALITY_PREFIX = "ai-local-area-page-pilot-v3:";

export function canonicalApprovalStorePath(tenantSlug: string, campaignId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/canonical-campaign-approval",
    tenantSlug,
    `${campaignId}.json`,
  );
}

export function recordCanonicalCampaignPageDecision(input: {
  tenantSlug: string;
  campaignId: string;
  serviceId: string;
  pageType: CanonicalPublishablePageType;
  areaSlug?: string | null;
  decision: "approved" | "rejected";
  reviewer?: string | null;
  source: CanonicalApprovalWriteSource;
  reviewedAt?: string;
}): CanonicalPageApproval {
  const membership = resolveCanonicalCampaignMembership({
    tenantSlug: input.tenantSlug,
    campaignId: input.campaignId,
  });
  if (!membership.resolved || !membership.campaignId || !membership.serviceId) {
    throw new Error("Campaign membership is unresolved");
  }
  if (membership.serviceId !== input.serviceId) {
    throw new Error("Campaign service does not match the approval request");
  }
  const areaSlug = input.pageType === "locality" ? String(input.areaSlug || "").trim().toLowerCase() : null;
  if (input.pageType === "locality" && (!areaSlug || !membership.areaSlugs.includes(areaSlug))) {
    throw new Error("Locality is outside canonical campaign membership");
  }
  const revision = resolveCanonicalPageContentRevision({
    tenantSlug: membership.tenantSlug || input.tenantSlug,
    serviceId: membership.serviceId,
    pageType: input.pageType,
    areaSlug,
  });
  if (!revision.contentRevision) {
    throw new Error("Current publishable page revision is unresolved");
  }
  const store = readStore(membership.tenantSlug || input.tenantSlug, membership.campaignId) || {
    version: CANONICAL_APPROVAL_STORE_VERSION,
    tenantSlug: membership.tenantSlug || input.tenantSlug,
    campaignId: membership.campaignId,
    serviceId: membership.serviceId,
    decisions: [],
  };
  store.decisions.push({
    pageType: input.pageType,
    areaSlug,
    contentRevision: revision.contentRevision,
    decision: input.decision,
    reviewedAt: input.reviewedAt || new Date().toISOString(),
    reviewer: input.reviewer || null,
    source: input.source,
  });
  writeStore(store);
  return resolveCanonicalPageApproval({
    tenantSlug: store.tenantSlug,
    campaignId: store.campaignId,
    serviceId: store.serviceId,
    pageType: input.pageType,
    areaSlug,
  });
}

export function resolveCanonicalPageApproval(input: {
  tenantSlug: string;
  campaignId: string;
  serviceId: string;
  pageType: CanonicalPublishablePageType;
  areaSlug?: string | null;
}): CanonicalPageApproval {
  const membership = resolveCanonicalCampaignMembership({
    tenantSlug: input.tenantSlug,
    campaignId: input.campaignId,
  });
  const tenantSlug = membership.tenantSlug || String(input.tenantSlug || "");
  const campaignId = membership.campaignId || String(input.campaignId || "");
  const serviceId = membership.serviceId || String(input.serviceId || "");
  const areaSlug = input.pageType === "locality" ? String(input.areaSlug || "").trim().toLowerCase() : null;
  const revision = resolveCanonicalPageContentRevision({
    tenantSlug,
    serviceId,
    pageType: input.pageType,
    areaSlug,
  });
  const store = readStore(tenantSlug, campaignId);
  const pageDecisions = (store?.decisions || []).filter(
    (decision) => decision.pageType === input.pageType && (decision.areaSlug || null) === areaSlug,
  );
  const current = revision.contentRevision
    ? [...pageDecisions].reverse().find((decision) => decision.contentRevision === revision.contentRevision) || null
    : null;
  const earlier = [...pageDecisions].reverse().find((decision) => decision.decision === "approved") || null;
  let decision: CanonicalApprovalDecisionState = "PENDING";
  if (current?.decision === "approved") decision = "APPROVED";
  else if (current?.decision === "rejected") decision = "REJECTED";
  else if (earlier && earlier.contentRevision !== revision.contentRevision) decision = "STALE";
  const evidence = classifyPageEvidence({
    tenantSlug,
    campaignId,
    serviceId,
    pageType: input.pageType,
    areaSlug,
    contentRevision: revision.contentRevision,
    decision,
    inMembership: input.pageType === "service" || Boolean(areaSlug && membership.areaSlugs.includes(areaSlug)),
  });
  return {
    tenantSlug,
    campaignId,
    serviceId,
    pageType: input.pageType,
    areaSlug,
    contentRevision: revision.contentRevision,
    decision,
    reviewedAt: current?.reviewedAt || (decision === "STALE" ? earlier?.reviewedAt || null : null),
    reviewer: current?.reviewer || (decision === "STALE" ? earlier?.reviewer || null : null),
    source: current?.source || (decision === "STALE" ? earlier?.source || null : null),
    evidence,
  };
}

export function resolveCanonicalCampaignApproval(input: {
  tenantSlug: string;
  campaignId: string;
}): CanonicalCampaignApproval {
  const membership = resolveCanonicalCampaignMembership(input);
  if (!membership.resolved || !membership.tenantSlug || !membership.campaignId || !membership.serviceId) {
    return { resolved: false, tenantSlug: null, campaignId: null, serviceId: null, service: null, localities: [], ready: false, evidence: [] };
  }
  const service = resolveCanonicalPageApproval({
    tenantSlug: membership.tenantSlug,
    campaignId: membership.campaignId,
    serviceId: membership.serviceId,
    pageType: "service",
  });
  const localities = membership.areaSlugs.map((areaSlug) =>
    resolveCanonicalPageApproval({
      tenantSlug: membership.tenantSlug || "",
      campaignId: membership.campaignId || "",
      serviceId: membership.serviceId || "",
      pageType: "locality",
      areaSlug,
    }),
  );
  const evidence = [
    ...service.evidence,
    ...localities.flatMap((page) => page.evidence),
    ...unattachedApprovalEvidence(membership.tenantSlug, membership.campaignId, membership.areaSlugs),
  ];
  const ready = service.decision === "APPROVED" && localities.every((page) => page.decision === "APPROVED");
  return {
    resolved: true,
    tenantSlug: membership.tenantSlug,
    campaignId: membership.campaignId,
    serviceId: membership.serviceId,
    service,
    localities,
    ready,
    evidence,
  };
}

export function resolveReviewCentreCampaignPage(input: {
  tenantSlug: string;
  campaignOrServiceId: string;
  assetKey: string;
}): { campaignId: string; serviceId: string; pageType: CanonicalPublishablePageType; areaSlug: string | null } | null {
  const assetKey = String(input.assetKey || "").trim();
  const pageType: CanonicalPublishablePageType | null = assetKey === REVIEW_CENTRE_SERVICE_KEY
    ? "service"
    : assetKey.startsWith(REVIEW_CENTRE_LOCALITY_PREFIX)
      ? "locality"
      : null;
  if (!pageType) return null;
  const areaSlug = pageType === "locality" ? assetKey.slice(REVIEW_CENTRE_LOCALITY_PREFIX.length).trim().toLowerCase() : null;
  if (pageType === "locality" && !areaSlug) return null;
  const direct = resolveCanonicalCampaignMembership({
    tenantSlug: input.tenantSlug,
    campaignId: input.campaignOrServiceId,
  });
  if (direct.resolved && direct.campaignId && direct.serviceId) {
    if (pageType === "locality" && !direct.areaSlugs.includes(String(areaSlug))) return null;
    return { campaignId: direct.campaignId, serviceId: direct.serviceId, pageType, areaSlug };
  }
  const campaignId = resolveCanonicalCampaignIdForService(input.tenantSlug, input.campaignOrServiceId, null);
  if (!campaignId) return null;
  const membership = resolveCanonicalCampaignMembership({ tenantSlug: input.tenantSlug, campaignId });
  if (!membership.resolved || !membership.serviceId) return null;
  if (pageType === "locality" && !membership.areaSlugs.includes(String(areaSlug))) return null;
  return { campaignId, serviceId: membership.serviceId, pageType, areaSlug };
}

function classifyPageEvidence(input: {
  tenantSlug: string;
  campaignId: string;
  serviceId: string;
  pageType: CanonicalPublishablePageType;
  areaSlug: string | null;
  contentRevision: string | null;
  decision: CanonicalApprovalDecisionState;
  inMembership: boolean;
}): CanonicalApprovalEvidence[] {
  const evidence: CanonicalApprovalEvidence[] = [];
  if (input.decision === "APPROVED") {
    evidence.push({
      mechanism: "canonical-campaign-approval",
      classification: "AUTHORITATIVE",
      code: "CURRENT_REVISION_APPROVED",
      detail: "Canonical approval matches the current publishable page revision",
    });
  }
  if (input.decision === "STALE") {
    evidence.push({
      mechanism: "canonical-campaign-approval",
      classification: "HISTORICAL",
      code: "STALE_APPROVAL",
      detail: "An earlier revision was approved. The current revision is not approved",
    });
  }
  if (!input.inMembership && input.areaSlug) {
    evidence.push({
      mechanism: "campaign-membership",
      classification: "UNSCOPED",
      code: "UNATTACHED_APPROVAL",
      detail: `${input.areaSlug} is outside canonical campaign membership`,
    });
  }
  if (input.pageType === "service") {
    const decision = readJson(serviceDecisionPath(input.tenantSlug, input.campaignId));
    const generationRevision = String(decision?.generationRevision || "");
    if (decision?.decision === "approved") {
      const equivalent = Boolean(input.contentRevision) && generationRevision === input.contentRevision;
      evidence.push({
        mechanism: "service-page-campaign-decision",
        classification: equivalent ? "AUTHORITATIVE" : "HISTORICAL",
        code: equivalent ? null : "LEGACY_APPROVAL_REVISION_UNRESOLVED",
        detail: equivalent
          ? "Service-page decision revision matches the current content revision"
          : "Service-page decision is preserved. Its revision is not the current content hash",
      });
    }
  } else if (input.areaSlug) {
    const store = readJson(localityDecisionPath(input.tenantSlug, input.campaignId));
    const decisions = (store?.decisions || {}) as Record<string, { decision?: string }>;
    if (decisions[input.areaSlug]?.decision === "approved") {
      evidence.push({
        mechanism: "master-admin-locality-decisions",
        classification: "HISTORICAL",
        code: "LEGACY_APPROVAL_REVISION_UNRESOLVED",
        detail: "Locality decision has no content revision and was not promoted",
      });
    }
  }
  return evidence;
}

function unattachedApprovalEvidence(tenantSlug: string, campaignId: string, areaSlugs: string[]): CanonicalApprovalEvidence[] {
  const evidence: CanonicalApprovalEvidence[] = [];
  const builder = readJson(path.join(PHARMACY_WORKSPACE_ROOT, "data/growth-engine", `${tenantSlug}-campaign-builder.json`));
  const approvedAssets = (builder?.approvedAssets || {}) as Record<string, unknown>;
  for (const key of Object.keys(approvedAssets)) {
    if (!key.startsWith(REVIEW_CENTRE_LOCALITY_PREFIX)) continue;
    const areaSlug = key.slice(REVIEW_CENTRE_LOCALITY_PREFIX.length);
    if (!areaSlugs.includes(areaSlug)) {
      evidence.push({
        mechanism: "review-centre-approved-assets",
        classification: "UNSCOPED",
        code: "UNATTACHED_APPROVAL",
        detail: `${areaSlug} approval evidence is outside canonical campaign membership`,
      });
    } else {
      evidence.push({
        mechanism: "review-centre-approved-assets",
        classification: "UNSCOPED",
        code: "LEGACY_APPROVAL_REVISION_UNRESOLVED",
        detail: `${areaSlug} Review Centre approval has no content revision and was not promoted`,
      });
    }
  }
  if (approvedAssets[REVIEW_CENTRE_SERVICE_KEY]) {
    evidence.push({
      mechanism: "review-centre-approved-assets",
      classification: "UNSCOPED",
      code: "LEGACY_APPROVAL_REVISION_UNRESOLVED",
      detail: "Review Centre service-page approval has no content revision and was not promoted",
    });
  }
  const checkpointDir = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-ai-local-copy-checkpoints",
    tenantSlug,
  );
  if (fs.existsSync(checkpointDir)) {
    evidence.push({
      mechanism: "historical-checkpoints",
      classification: "HISTORICAL",
      code: "LEGACY_APPROVAL_REVISION_UNRESOLVED",
      detail: "Historical checkpoints remain evidence and are not current approval",
    });
  }
  const packageFile = findPackage(tenantSlug, campaignId);
  if (packageFile && String(readJson(packageFile)?.approvalStatus || "") === "approved") {
    evidence.push({
      mechanism: "package-approval-status",
      classification: "UNSCOPED",
      code: "LEGACY_APPROVAL_REVISION_UNRESOLVED",
      detail: "Package approval status is not approval of the current page revision",
    });
  }
  return evidence;
}

function findPackage(tenantSlug: string, campaignId: string): string | null {
  const dir = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", tenantSlug);
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(dir, name);
    const doc = readJson(file);
    if (String(doc?.campaignId || "") === campaignId) return file;
  }
  return null;
}

function readStore(tenantSlug: string, campaignId: string): ApprovalStore | null {
  const doc = readJson(canonicalApprovalStorePath(tenantSlug, campaignId));
  if (!doc || !Array.isArray(doc.decisions)) return null;
  return doc as unknown as ApprovalStore;
}

function writeStore(store: ApprovalStore): void {
  const file = canonicalApprovalStorePath(store.tenantSlug, store.campaignId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, file);
}

function serviceDecisionPath(tenantSlug: string, campaignId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/service-page-review",
    tenantSlug,
    "by-campaign",
    campaignId,
    "decision.json",
  );
}

function localityDecisionPath(tenantSlug: string, campaignId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/cluster-page-review",
    tenantSlug,
    "by-campaign",
    campaignId,
    "localities.json",
  );
}

function readJson(file: string): Record<string, unknown> | null {
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
