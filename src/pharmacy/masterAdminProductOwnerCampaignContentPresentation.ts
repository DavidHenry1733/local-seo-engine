/**
 * CPR-PRODUCT-OWNER-CAMPAIGN-UI-01 — campaign content-level presentation.
 * Reads existing tenantSlug + campaignId + serviceId artefacts only.
 * Does not change workflow progression, generation, or approval persistence.
 */
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import {
  isServicePageGeneratedForIdentity,
  readServicePageGenerationRecord,
} from "./masterAdminCoreProductRecoveryService.ts";
import { resolveCampaignPublishingContentApproval } from "./masterAdminCampaignPublishingApprovalResolver.ts";
import { resolveCanonicalPublicationState } from "./canonicalCampaignPublishingService.ts";
import { resolveCanonicalCampaignMembership } from "./canonicalCampaignLifecycleResolver.ts";
import { resolveApprovedCurrentRunCandidatePublishReadiness } from "./pharmacyCurrentRunApprovedCandidatePublishAdapter.ts";
import { listMasterAdminJobs } from "./masterAdminJobService.ts";

export type ServiceContentStatus = "Not Generated" | "Generated" | "Approved";
export type LocalityContentStatus =
  | "Not Generated"
  | "Generated"
  | "Partially Approved"
  | "Approved";

export interface ProductOwnerCampaignPublishingReadiness {
  ready: boolean;
  label: "Ready to Publish" | "Not Ready to Publish" | "Published" | "New revision requires approval";
  blockers: string[];
  publishActionVisible: boolean;
}

export interface ProductOwnerCampaignContentPresentation {
  serviceStatus: ServiceContentStatus;
  serviceRevision: string | null;
  servicePreviewUrl: string | null;
  serviceApproved: boolean;
  serviceGenerated: boolean;
  localityStatus: LocalityContentStatus;
  localityGeneratedCount: number;
  localityApprovedCount: number;
  localityRemainingCount: number;
  localitiesGenerated: boolean;
  publishing: ProductOwnerCampaignPublishingReadiness;
}

const ACTIVE_JOB_STATUSES = new Set(["queued", "claimed", "running"]);
const GENERATION_JOB_ACTIONS = new Set(["generate_service_page", "generate_local_cluster_pages"]);
const REGENERATION_JOB_ACTIONS = new Set([
  "regenerate_local_cluster_page",
  "regenerate_all_local_cluster_pages",
]);

function findActiveCampaignJobs(slug: string, campaignId: string, serviceId: string) {
  return listMasterAdminJobs({ slug, limit: 40 }).filter(
    (j) =>
      ACTIVE_JOB_STATUSES.has(j.status) &&
      (!j.serviceId || j.serviceId === serviceId) &&
      (!j.campaignId || j.campaignId === campaignId),
  );
}

function publicationLabel(state: ReturnType<typeof resolveCanonicalPublicationState>["state"]): ProductOwnerCampaignPublishingReadiness["label"] {
  if (state === "READY_TO_PUBLISH") return "Ready to Publish";
  if (state === "PUBLISHED") return "Published";
  if (state === "NEW_REVISION_REQUIRES_APPROVAL") return "New revision requires approval";
  return "Not Ready to Publish";
}

export function resolveProductOwnerCampaignContentPresentation(input: {
  slug: string;
  campaignId: string;
  serviceId: string;
}): ProductOwnerCampaignContentPresentation {
  const slug = safeAdminSlug(input.slug);
  const campaignId = String(input.campaignId || "").trim();
  const serviceId = String(input.serviceId || "").trim();
  const candidates = resolveApprovedCurrentRunCandidatePublishReadiness(slug, serviceId);

  if (candidates?.active) {
    const membership = resolveCanonicalCampaignMembership({ tenantSlug: slug, campaignId });
    const contentApproval = resolveCampaignPublishingContentApproval(slug, { campaignId, serviceId });
    const serviceApproved = contentApproval.servicePageApproved;
    const localityApprovedCount = contentApproval.localityApprovedCount;
    const localityGeneratedCount = membership.resolved ? membership.areaSlugs.length : 0;
    const localityRemainingCount = Math.max(0, localityGeneratedCount - localityApprovedCount);
    const serviceStatus: ServiceContentStatus = serviceApproved
      ? "Approved"
      : candidates.candidateVersion
        ? "Generated"
        : "Not Generated";
    let localityStatus: LocalityContentStatus = "Not Generated";
    if (localityGeneratedCount > 0) {
      localityStatus =
        localityRemainingCount === 0
          ? "Approved"
          : localityApprovedCount > 0
            ? "Partially Approved"
            : "Generated";
    }
    const publication = resolveCanonicalPublicationState({ tenantSlug: slug, campaignId });
    const blockers = publication.blockers.slice();
    if (!campaignId || !serviceId) blockers.unshift("Campaign identity is incomplete");
    const ready = publication.ready && blockers.length === 0;
    const label = publicationLabel(publication.state);
    return {
      serviceStatus,
      serviceRevision: contentApproval.serviceRevision,
      servicePreviewUrl: `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(serviceId)}&asset=service-page`,
      serviceApproved,
      serviceGenerated: Boolean(candidates.candidateVersion),
      localityStatus,
      localityGeneratedCount,
      localityApprovedCount,
      localityRemainingCount,
      localitiesGenerated: localityGeneratedCount > 0,
      publishing: {
        ready,
        label,
        blockers,
        publishActionVisible: true,
      },
    };
  }

  const contentApproval = resolveCampaignPublishingContentApproval(slug, { campaignId, serviceId });
  const generationRecorded = isServicePageGeneratedForIdentity(slug, serviceId, campaignId);
  const record = generationRecorded
    ? readServicePageGenerationRecord(slug, serviceId, campaignId)
    : null;
  const serviceApproved = contentApproval.servicePageApproved;
  const serviceGenerated = Boolean(contentApproval.serviceRevision) || generationRecorded;
  const serviceStatus: ServiceContentStatus = !serviceGenerated
    ? "Not Generated"
    : serviceApproved
      ? "Approved"
      : "Generated";
  const serviceRevision = contentApproval.serviceRevision;
  const servicePreviewUrl = serviceGenerated
    ? record?.previewUrl ||
      `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(slug)}`
    : null;

  const membership = resolveCanonicalCampaignMembership({ tenantSlug: slug, campaignId });
  const localityGeneratedCount = membership.resolved && membership.serviceId === serviceId ? membership.areaSlugs.length : 0;
  const localityApprovedCount = contentApproval.localityApprovedCount;
  const localityRemainingCount = Math.max(0, localityGeneratedCount - localityApprovedCount);
  const localitiesGenerated =
    localityGeneratedCount > 0 && membership.localityStates.every((area) => area.contentState === "PRESENT");

  let localityStatus: LocalityContentStatus = "Not Generated";
  if (localityGeneratedCount > 0 && localitiesGenerated) {
    if (localityRemainingCount === 0) localityStatus = "Approved";
    else if (localityApprovedCount > 0) localityStatus = "Partially Approved";
    else localityStatus = "Generated";
  }

  const activeJobs = findActiveCampaignJobs(slug, campaignId, serviceId);
  const activeGeneration = activeJobs.filter((j) => GENERATION_JOB_ACTIONS.has(j.action));
  const activeRegeneration = activeJobs.filter((j) => REGENERATION_JOB_ACTIONS.has(j.action));

  const publication = resolveCanonicalPublicationState({ tenantSlug: slug, campaignId });
  const blockers = publication.blockers.slice();
  if (!campaignId || !serviceId) blockers.unshift("Campaign identity is incomplete");
  if (activeGeneration.length) blockers.push("A generation job is currently running");
  if (activeRegeneration.length) blockers.push("A regeneration job is currently running");

  const ready = publication.ready && blockers.length === 0;
  const publishing: ProductOwnerCampaignPublishingReadiness = {
    ready,
    label: publicationLabel(publication.state),
    blockers,
    publishActionVisible: true,
  };

  return {
    serviceStatus,
    serviceRevision,
    servicePreviewUrl,
    serviceApproved,
    serviceGenerated,
    localityStatus,
    localityGeneratedCount,
    localityApprovedCount,
    localityRemainingCount,
    localitiesGenerated,
    publishing,
  };
}
