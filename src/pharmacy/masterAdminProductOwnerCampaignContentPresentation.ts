/**
 * CPR-PRODUCT-OWNER-CAMPAIGN-UI-01 — campaign content-level presentation.
 * Reads existing tenantSlug + campaignId + serviceId artefacts only.
 * Does not change workflow progression, generation, or approval persistence.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import {
  isCampaignServicePageReviewApproved,
  isServicePageGeneratedForIdentity,
  readLocalityPageDecisionStore,
  readServicePageGenerationRecord,
} from "./masterAdminCoreProductRecoveryService.ts";
import { resolveCampaignPublishingContentApproval } from "./masterAdminCampaignPublishingApprovalResolver.ts";
import { resolveApprovedCurrentRunCandidatePublishReadiness } from "./pharmacyCurrentRunApprovedCandidatePublishAdapter.ts";
import { listMasterAdminJobs } from "./masterAdminJobService.ts";
import { readPharmacyCampaignStore } from "./pharmacyCampaignService.ts";

export type ServiceContentStatus = "Not Generated" | "Generated" | "Approved";
export type LocalityContentStatus =
  | "Not Generated"
  | "Generated"
  | "Partially Approved"
  | "Approved";

export interface ProductOwnerCampaignPublishingReadiness {
  ready: boolean;
  label: "Ready to Publish" | "Not Ready to Publish";
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

function toAreaSlug(areaName: string): string {
  return String(areaName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function listGeneratedLocalityAreaSlugs(slug: string, serviceId: string): string[] {
  const localDir = path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    safeAdminSlug(slug),
    serviceId,
    "local",
  );
  if (!fs.existsSync(localDir)) return [];
  try {
    return fs
      .readdirSync(localDir)
      .filter(
        (name) =>
          name !== "locations" &&
          name !== "revisions" &&
          fs.existsSync(path.join(localDir, name, "index.html")),
      )
      .sort();
  } catch {
    return [];
  }
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
    const serviceApproved = candidates.approvedServicePage;
    const localityApprovedCount = candidates.approvedLocalCount;
    const localityGeneratedCount = candidates.expectedLocalCount;
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
    const contentApproval = resolveCampaignPublishingContentApproval(slug, { campaignId, serviceId });
    const blockers: string[] = [];
    if (!campaignId || !serviceId) blockers.push("Campaign identity is incomplete");
    for (const b of contentApproval.blockers) blockers.push(b);
    const ready = blockers.length === 0 && Boolean(candidates.ready);
    return {
      serviceStatus,
      serviceRevision: candidates.candidateVersion,
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
        label: ready ? "Ready to Publish" : "Not Ready to Publish",
        blockers,
        publishActionVisible: true,
      },
    };
  }

  const serviceGenerated = isServicePageGeneratedForIdentity(slug, serviceId, campaignId);
  const record = serviceGenerated
    ? readServicePageGenerationRecord(slug, serviceId, campaignId)
    : null;
  const generationRevision = record?.imageAssignmentRevision || null;
  const serviceApproved =
    serviceGenerated &&
    isCampaignServicePageReviewApproved(slug, campaignId, serviceId, generationRevision);
  const serviceStatus: ServiceContentStatus = !serviceGenerated
    ? "Not Generated"
    : serviceApproved
      ? "Approved"
      : "Generated";
  const serviceRevision =
    (record?.imageAssignmentRevision && String(record.imageAssignmentRevision)) ||
    (record?.completedAt && String(record.completedAt)) ||
    (record?.jobId && String(record.jobId)) ||
    null;
  const servicePreviewUrl = serviceGenerated
    ? record?.previewUrl ||
      `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(slug)}`
    : null;

  const areaSlugs = listGeneratedLocalityAreaSlugs(slug, serviceId);
  const localityStore = readLocalityPageDecisionStore(slug, { campaignId, serviceId });
  const localityApprovedCount = areaSlugs.filter(
    (area) => localityStore?.decisions?.[area]?.decision === "approved",
  ).length;
  const localityGeneratedCount = areaSlugs.length;
  const localityRemainingCount = Math.max(0, localityGeneratedCount - localityApprovedCount);
  const localitiesGenerated = serviceGenerated && localityGeneratedCount > 0;

  let localityStatus: LocalityContentStatus = "Not Generated";
  if (localitiesGenerated) {
    if (localityRemainingCount === 0) localityStatus = "Approved";
    else if (localityApprovedCount > 0) localityStatus = "Partially Approved";
    else localityStatus = "Generated";
  }

  const campaign = readPharmacyCampaignStore(slug)?.campaigns.find((c) => c.id === campaignId);
  const selectedAreaSlugs = (campaign?.campaignAreas || [])
    .filter((a) => a.selected !== false)
    .map((a) => toAreaSlug(a.areaName))
    .filter(Boolean);
  const generatedSet = new Set(areaSlugs);
  const selectedMissing = selectedAreaSlugs.filter((a) => !generatedSet.has(a));
  const activeJobs = findActiveCampaignJobs(slug, campaignId, serviceId);
  const activeGeneration = activeJobs.filter((j) => GENERATION_JOB_ACTIONS.has(j.action));
  const activeRegeneration = activeJobs.filter((j) => REGENERATION_JOB_ACTIONS.has(j.action));

  // Shared approval source of truth with Publish Review.
  const contentApproval = resolveCampaignPublishingContentApproval(slug, { campaignId, serviceId });
  const blockers: string[] = [];
  if (!campaignId || !serviceId) blockers.push("Campaign identity is incomplete");
  for (const b of contentApproval.blockers) blockers.push(b);
  if (selectedAreaSlugs.length > 0 && selectedMissing.length) {
    blockers.push(`Selected locality pages missing: ${selectedMissing.join(", ")}`);
  }
  if (activeGeneration.length) blockers.push("A generation job is currently running");
  if (activeRegeneration.length) blockers.push("A regeneration job is currently running");

  const ready = blockers.length === 0;
  const publishing: ProductOwnerCampaignPublishingReadiness = {
    ready,
    label: ready ? "Ready to Publish" : "Not Ready to Publish",
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
