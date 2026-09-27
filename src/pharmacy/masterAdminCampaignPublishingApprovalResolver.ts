/**
 * CPR-PUBLISH-READINESS-HOTFIX-01 — shared publishing content-approval resolver.
 *
 * Campaign workflow and Publish Review must resolve the same persisted
 * campaign-scoped Product Owner approvals (service-page-review + locality pages).
 * Does not create approval records, snapshots, or publish anything.
 */
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { resolveCanonicalCampaignMembership } from "./canonicalCampaignLifecycleResolver.ts";
import { CANONICAL_LIFECYCLE_REASON } from "./canonicalCampaignLifecycleModel.ts";
import { resolveCanonicalCampaignApproval } from "./canonicalCampaignApprovalService.ts";
import { readLatestCommercialQualityApproval } from "./masterAdminCommercialQualityReviewService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";

export type CampaignPublishingApprovalMode =
  | "campaign-scoped-product-owner"
  | "legacy-commercial-quality"
  | "none";

export interface CampaignPublishingContentApproval {
  mode: CampaignPublishingApprovalMode;
  approved: boolean;
  servicePageApproved: boolean;
  localityApprovedCount: number;
  localityExpectedCount: number;
  allSelectedLocalitiesApproved: boolean;
  serviceRevision: string | null;
  campaignId: string | null;
  serviceId: string | null;
  approvalReference: string | null;
  blockers: string[];
  detail: string;
}

function resolveCampaignScopedProductOwnerApproval(
  slug: string,
  campaignId: string,
  serviceId: string,
): CampaignPublishingContentApproval {
  const membership = resolveCanonicalCampaignMembership({ tenantSlug: slug, campaignId });
  const approval = resolveCanonicalCampaignApproval({ tenantSlug: slug, campaignId });
  const selectedAreaSlugs =
    membership.resolved && membership.serviceId === serviceId ? membership.areaSlugs : [];
  const localityExpectedCount = selectedAreaSlugs.length;
  const localityApprovedCount = (approval.localities || []).filter((page) => page.decision === "APPROVED").length;
  const notCurrent = (approval.localities || []).filter((page) => page.decision !== "APPROVED");
  const stale = (approval.localities || []).filter((page) => page.decision === "STALE").map((page) => page.areaSlug);
  const missingCanonical = membership.localityStates
    .filter((area) => area.contentState !== "PRESENT")
    .map((area) => area.areaSlug);
  const servicePageApproved = approval.service?.decision === "APPROVED";
  const allSelectedLocalitiesApproved = localityExpectedCount > 0 && notCurrent.length === 0;

  const blockers: string[] = [];
  if (!membership.resolved || membership.serviceId !== serviceId) {
    blockers.push("Campaign membership is unresolved");
  }
  if (missingCanonical.length) {
    blockers.push(`Missing canonical locality pages: ${missingCanonical.join(", ")}`);
  }
  if (membership.servicePageState === "MISSING") blockers.push("Service page is not generated");
  else if (approval.service?.decision === "STALE") {
    blockers.push("Service page approval is stale for the current revision");
  } else if (!servicePageApproved) {
    blockers.push("Service page is not approved for the current revision");
  }
  if (stale.length) {
    blockers.push(`Stale locality approval is not approval of the current revision: ${stale.join(", ")}`);
  }
  if (membership.conflicts.some((conflict) => conflict.code === CANONICAL_LIFECYCLE_REASON.membershipAreaSlugMissing)) {
    blockers.push("Campaign areas are missing areaSlug and were not added to canonical membership");
  } else if (localityExpectedCount === 0) {
    blockers.push("No locality pages are selected for this campaign");
  } else if (!allSelectedLocalitiesApproved) {
    blockers.push(`Selected locality pages not approved: ${notCurrent.length} remaining`);
  }

  const approved = blockers.length === 0;
  const serviceRevision = approval.service?.contentRevision || null;
  return {
    mode: "campaign-scoped-product-owner",
    approved,
    servicePageApproved,
    localityApprovedCount,
    localityExpectedCount,
    allSelectedLocalitiesApproved,
    serviceRevision,
    campaignId,
    serviceId,
    approvalReference: approved ? `${serviceRevision}:${localityApprovedCount}` : null,
    blockers,
    detail: approved
      ? `Canonical current-revision approvals (${serviceId}; ${serviceRevision}; localities ${localityApprovedCount}/${localityExpectedCount})`
      : blockers[0] || "Canonical current-revision approvals incomplete",
  };
}

/**
 * Shared content-approval truth for publishing readiness.
 * Prefer campaign-scoped Product Owner approvals when campaign identity is known.
 * Legacy Commercial Quality Review is only used when no active campaign identity exists.
 */
export function resolveCampaignPublishingContentApproval(
  slugInput: string,
  identity?: { campaignId?: string; serviceId?: string },
): CampaignPublishingContentApproval {
  const slug = safeAdminSlug(slugInput);
  const selection = readActiveServiceCampaignSelection(slug);
  const campaignId = String(identity?.campaignId || selection?.campaignId || "").trim();
  const serviceId = String(identity?.serviceId || selection?.serviceId || "").trim();
  if (campaignId && serviceId) {
    return resolveCampaignScopedProductOwnerApproval(slug, campaignId, serviceId);
  }

  const legacy = readLatestCommercialQualityApproval(slug);
  if (legacy?.approvedAt) {
    return {
      mode: "legacy-commercial-quality",
      approved: false,
      servicePageApproved: false,
      localityApprovedCount: 0,
      localityExpectedCount: 0,
      allSelectedLocalitiesApproved: false,
      serviceRevision: null,
      campaignId: null,
      serviceId: null,
      approvalReference: null,
      blockers: ["Legacy quality approval is not approval of the current campaign revision"],
      detail: `Legacy Commercial Quality Review record ${legacy.approvedAt} is historical evidence`,
    };
  }

  return {
    mode: "none",
    approved: false,
    servicePageApproved: false,
    localityApprovedCount: 0,
    localityExpectedCount: 0,
    allSelectedLocalitiesApproved: false,
    serviceRevision: null,
    campaignId: null,
    serviceId: null,
    approvalReference: null,
    blockers: ["Content approval missing"],
    detail: "No campaign-scoped Product Owner approval or legacy Quality Review approval",
  };
}
