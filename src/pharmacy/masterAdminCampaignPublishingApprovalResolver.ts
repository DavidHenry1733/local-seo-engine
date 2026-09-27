/**
 * CPR-PUBLISH-READINESS-HOTFIX-01 — shared publishing content-approval resolver.
 *
 * Campaign workflow and Publish Review must resolve the same persisted
 * campaign-scoped Product Owner approvals (service-page-review + locality pages).
 * Does not create approval records, snapshots, or publish anything.
 */
import {
  isCampaignServicePageReviewApproved,
  isServicePageGeneratedForIdentity,
  readCampaignServicePageReviewDecision,
  readLocalityPageDecisionStore,
  readServicePageGenerationRecord,
} from "./masterAdminCoreProductRecoveryService.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { resolveCanonicalCampaignMembership } from "./canonicalCampaignLifecycleResolver.ts";
import { resolveApprovedCurrentRunCandidatePublishReadiness } from "./pharmacyCurrentRunApprovedCandidatePublishAdapter.ts";
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
  const serviceGenerated = isServicePageGeneratedForIdentity(slug, serviceId, campaignId);
  const record = serviceGenerated
    ? readServicePageGenerationRecord(slug, serviceId, campaignId)
    : null;
  const generationRevision = record?.imageAssignmentRevision || null;
  const servicePageApproved =
    serviceGenerated &&
    isCampaignServicePageReviewApproved(slug, campaignId, serviceId, generationRevision);

  const membership = resolveCanonicalCampaignMembership({ tenantSlug: slug, campaignId });
  const selectedAreaSlugs =
    membership.resolved && membership.serviceId === serviceId ? membership.areaSlugs : [];
  const localityStore = readLocalityPageDecisionStore(slug, { campaignId, serviceId });
  const localityExpectedCount = selectedAreaSlugs.length;
  const localityApprovedCount = selectedAreaSlugs.filter(
    (area) => localityStore?.decisions?.[area]?.decision === "approved",
  ).length;
  const selectedUnapproved = selectedAreaSlugs.filter(
    (a) => localityStore?.decisions?.[a]?.decision !== "approved",
  );
  const missingCanonical = membership.localityStates
    .filter((area) => area.contentState !== "PRESENT")
    .map((area) => area.areaSlug);
  const allSelectedLocalitiesApproved =
    localityExpectedCount > 0 && selectedUnapproved.length === 0;

  const blockers: string[] = [];
  if (!membership.resolved || membership.serviceId !== serviceId) {
    blockers.push("Campaign membership is unresolved");
  }
  if (missingCanonical.length) {
    blockers.push(`Missing canonical locality pages: ${missingCanonical.join(", ")}`);
  }
  if (!serviceGenerated) blockers.push("Service page is not generated");
  else if (!servicePageApproved) {
    blockers.push("Service page is not approved for the current revision");
  }
  if (localityExpectedCount === 0) {
    blockers.push("No locality pages are selected for this campaign");
  } else if (!allSelectedLocalitiesApproved) {
    blockers.push(`Selected locality pages not approved: ${selectedUnapproved.length} remaining`);
  }

  const approved = blockers.length === 0;
  const serviceDecision = readCampaignServicePageReviewDecision(slug, campaignId);
  const approvalReference = approved
    ? String(serviceDecision?.decidedAt || record?.completedAt || generationRevision || campaignId)
    : null;

  return {
    mode: "campaign-scoped-product-owner",
    approved,
    servicePageApproved: Boolean(servicePageApproved),
    localityApprovedCount,
    localityExpectedCount,
    allSelectedLocalitiesApproved,
    serviceRevision: generationRevision ? String(generationRevision) : null,
    campaignId,
    serviceId,
    approvalReference,
    blockers,
    detail: approved
      ? `Campaign-scoped Product Owner approvals (${serviceId}; service revision ${generationRevision}; localities ${localityApprovedCount}/${localityExpectedCount})`
      : blockers[0] || "Campaign-scoped Product Owner approvals incomplete",
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
  const candidates = serviceId
    ? resolveApprovedCurrentRunCandidatePublishReadiness(slug, serviceId)
    : null;
  if (candidates?.active && campaignId) {
    const membership = resolveCanonicalCampaignMembership({ tenantSlug: slug, campaignId });
    const expected = membership.resolved && membership.serviceId === serviceId ? membership.areaSlugs : [];
    const approvedAreas = new Set(
      candidates.pages
        .filter((page) => page.pageType === "local" && page.approved && page.areaSlug)
        .map((page) => String(page.areaSlug)),
    );
    const localityApprovedCount = expected.filter((area) => approvedAreas.has(area)).length;
    const missingCanonical = membership.localityStates
      .filter((area) => area.contentState !== "PRESENT")
      .map((area) => area.areaSlug);
    const blockers: string[] = [];
    if (!membership.resolved || membership.serviceId !== serviceId) {
      blockers.push("Campaign membership is unresolved");
    }
    if (!candidates.approvedServicePage) {
      blockers.push("Approved current-run service-page candidate is missing");
    }
    if (expected.length === 0) {
      blockers.push("No locality pages are selected for this campaign");
    } else if (localityApprovedCount !== expected.length) {
      blockers.push(
        `Approve remaining current-run local candidates (${localityApprovedCount}/${expected.length})`,
      );
    }
    if (missingCanonical.length) {
      blockers.push(`Missing canonical locality pages: ${missingCanonical.join(", ")}`);
    }
    const ready = blockers.length === 0;
    return {
      mode: "campaign-scoped-product-owner",
      approved: ready,
      servicePageApproved: candidates.approvedServicePage,
      localityApprovedCount,
      localityExpectedCount: expected.length,
      allSelectedLocalitiesApproved: expected.length > 0 && localityApprovedCount === expected.length,
      serviceRevision: candidates.candidateVersion,
      campaignId,
      serviceId,
      approvalReference: ready
        ? `${candidates.candidateVersion || "current"}:${candidates.runId || "run"}:${localityApprovedCount}`
        : null,
      blockers,
      detail: ready
        ? `Current-run Product Owner approvals (${serviceId}; ${candidates.candidateVersion}; ${localityApprovedCount}/${expected.length} canonical localities)`
        : blockers[0] || "Current-run Product Owner approvals incomplete",
    };
  }

  if (campaignId && serviceId) {
    return resolveCampaignScopedProductOwnerApproval(slug, campaignId, serviceId);
  }

  const legacy = readLatestCommercialQualityApproval(slug);
  if (legacy?.approvedAt) {
    return {
      mode: "legacy-commercial-quality",
      approved: true,
      servicePageApproved: true,
      localityApprovedCount: 0,
      localityExpectedCount: 0,
      allSelectedLocalitiesApproved: true,
      serviceRevision: null,
      campaignId: null,
      serviceId: null,
      approvalReference: String(legacy.approvedAt),
      blockers: [],
      detail: `Legacy Commercial Quality Review approved ${legacy.approvedAt}`,
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
