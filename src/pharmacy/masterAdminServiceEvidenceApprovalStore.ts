/**
 * Service Evidence approval identity — keyed by tenant + service + campaign.
 * Legacy tenant-level decision.json remains valid only for pharmacy-first.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { readPharmacyCampaignStore } from "./pharmacyCampaignService.ts";

export const SERVICE_EVIDENCE_APPROVAL_TYPE = "service-evidence" as const;

export interface ServiceEvidenceApprovalIdentity {
  tenantSlug: string;
  campaignId: string | null;
  serviceId: string;
  approvalType: typeof SERVICE_EVIDENCE_APPROVAL_TYPE;
}

const REVIEW_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-evidence-review");

export function legacyServiceEvidenceDecisionPath(slug: string): string {
  return path.join(REVIEW_DIR, safeAdminSlug(slug), "decision.json");
}

export function scopedServiceEvidenceDecisionPath(
  slug: string,
  serviceId: string,
  campaignId?: string | null,
): string {
  const safe = safeAdminSlug(slug);
  const sid = String(serviceId || "").trim() || "pharmacy-first";
  const cid = String(campaignId || "").trim();
  if (cid) {
    return path.join(REVIEW_DIR, safe, "by-campaign", cid, "decision.json");
  }
  return path.join(REVIEW_DIR, safe, "by-service", sid, "decision.json");
}

export function resolveCampaignIdForService(slug: string, serviceId: string): string | null {
  const safe = safeAdminSlug(slug);
  const selection = readActiveServiceCampaignSelection(safe);
  if (selection?.serviceId === serviceId && selection.campaignId) {
    return selection.campaignId;
  }
  const store = readPharmacyCampaignStore(safe);
  const match = (store?.campaigns || []).find(
    (c) => c.serviceId === serviceId && c.status === "active",
  );
  return match?.id || null;
}

export function resolveServiceEvidenceApprovalIdentity(
  slug: string,
  serviceId?: string,
  campaignId?: string | null,
): ServiceEvidenceApprovalIdentity {
  const tenantSlug = safeAdminSlug(slug);
  const sid = String(serviceId || "").trim() || "pharmacy-first";
  const cid =
    campaignId !== undefined
      ? String(campaignId || "").trim() || null
      : resolveCampaignIdForService(tenantSlug, sid);
  return {
    tenantSlug,
    campaignId: cid,
    serviceId: sid,
    approvalType: SERVICE_EVIDENCE_APPROVAL_TYPE,
  };
}

export function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

export function approvalRecordMatchesIdentity(
  raw: {
    serviceId?: string;
    campaignId?: string;
    approvalType?: string;
    slug?: string;
  },
  identity: ServiceEvidenceApprovalIdentity,
): boolean {
  if (raw.approvalType && raw.approvalType !== SERVICE_EVIDENCE_APPROVAL_TYPE) return false;
  if (raw.slug && safeAdminSlug(raw.slug) !== identity.tenantSlug) return false;
  if (raw.serviceId && raw.serviceId !== identity.serviceId) return false;
  if (identity.campaignId && raw.campaignId && raw.campaignId !== identity.campaignId) return false;
  return true;
}

/** Legacy tenant decision.json is only a valid Pharmacy First approval. */
export function legacyApprovalAppliesToService(serviceId: string): boolean {
  return serviceId === "pharmacy-first";
}

export function resolveServiceEvidenceDecisionFile(
  identity: ServiceEvidenceApprovalIdentity,
): { filePath: string; source: "campaign" | "service" | "legacy" | "none" } {
  if (identity.campaignId) {
    const campaignPath = scopedServiceEvidenceDecisionPath(
      identity.tenantSlug,
      identity.serviceId,
      identity.campaignId,
    );
    if (fs.existsSync(campaignPath)) {
      return { filePath: campaignPath, source: "campaign" };
    }
  }
  const servicePath = scopedServiceEvidenceDecisionPath(identity.tenantSlug, identity.serviceId, null);
  if (fs.existsSync(servicePath)) {
    return { filePath: servicePath, source: "service" };
  }
  if (legacyApprovalAppliesToService(identity.serviceId)) {
    const legacy = legacyServiceEvidenceDecisionPath(identity.tenantSlug);
    if (fs.existsSync(legacy)) {
      return { filePath: legacy, source: "legacy" };
    }
  }
  return { filePath: "", source: "none" };
}
