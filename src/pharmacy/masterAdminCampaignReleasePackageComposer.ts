/**
 * CPR-PUBLISH-HOTFIX-02 — shared campaign release-package composition.
 *
 * Canonical publish package for a service campaign =
 *   current approved service page revision
 *   + every selected locality page approved for the same campaign identity.
 *
 * Resolves strictly by tenantSlug + campaignId + serviceId.
 * Does not regenerate HTML, approve content, publish, or mutate v1 releases.
 */
import fs from "node:fs";
import path from "node:path";
import {
  isCampaignServicePageReviewApproved,
  isServicePageGeneratedForIdentity,
  readServicePageGenerationRecord,
} from "./masterAdminCoreProductRecoveryService.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { readPharmacyCampaignStore } from "./pharmacyCampaignService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { VISUAL_EXPERIENCE_ROOT } from "./pharmacyVisualExperienceConfig.ts";
import { canonicalPageSlugForLocalUrlPath } from "./pharmacyLocalLocationGenerationService.ts";
import {
  resolveApprovedCurrentRunCandidatePublishReadiness,
  resolveCurrentRunCandidateServiceId,
} from "./pharmacyCurrentRunApprovedCandidatePublishAdapter.ts";
import { loadCampaignBuilderSession } from "./growthEngineCampaignBuilderService.ts";
import {
  AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
  aiLocalPagePilotHtmlPath,
  latestAiLocalCopyPilotVersion,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";

export interface CampaignReleasePackagePagePlan {
  pageSlug: string;
  pageType: "service" | "location-area";
  areaSlug: string | null;
  relativePath: string;
  sourcePath: string;
  sourceRenderer?: "review-preview";
  previewAsset?: string;
  campaignId: string;
  serviceId: string;
  generationRevision: string | null;
  approved: boolean;
}

export interface CampaignReleasePackagePlan {
  slug: string;
  campaignId: string;
  serviceId: string;
  serviceRevision: string | null;
  contentManifestRevision: string;
  servicePage: CampaignReleasePackagePagePlan | null;
  localityPages: CampaignReleasePackagePagePlan[];
  /** Campaign content pages only (service + approved localities). Excludes homepage redirect. */
  totalCampaignPages: number;
  blockers: string[];
  otherServicePathsExcluded: string[];
}

function toAreaSlug(areaName: string): string {
  return String(areaName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function visualServicePagePath(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, VISUAL_EXPERIENCE_ROOT, slug, serviceId, "index.html");
}

function localitySourcePath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    slug,
    serviceId,
    "local",
    areaSlug,
    "index.html",
  );
}

function reviewCentreLocalityApprovalKey(areaSlug: string): string {
  return `${AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET}:${areaSlug}`;
}

function isReviewCentreLocalityApproved(approvedAssets: Record<string, unknown>, areaSlug: string): boolean {
  return Boolean(approvedAssets[reviewCentreLocalityApprovalKey(areaSlug)]);
}

function resolveApprovedLocalitySourcePath(slug: string, serviceId: string, areaSlug: string, reviewCentreApproved: boolean): string {
  if (reviewCentreApproved) {
    const version = latestAiLocalCopyPilotVersion(slug, serviceId, areaSlug);
    const candidatePath = aiLocalPagePilotHtmlPath(slug, serviceId, areaSlug, version);
    if (fs.existsSync(candidatePath)) return candidatePath;
  }
  return localitySourcePath(slug, serviceId, areaSlug);
}

function resolveIdentity(
  slug: string,
  identity?: { campaignId?: string; serviceId?: string },
): { campaignId: string; serviceId: string } {
  const selection = readActiveServiceCampaignSelection(slug);
  const campaignId = String(identity?.campaignId || selection?.campaignId || "").trim();
  const serviceId = String(identity?.serviceId || selection?.serviceId || "").trim();
  return { campaignId, serviceId };
}

/**
 * READ-ONLY dry-run composition of the next campaign publish package.
 * Does not write files, create releases, or modify v1.
 */
export function resolveCampaignReleasePackagePlan(
  slugInput: string,
  identity?: { campaignId?: string; serviceId?: string },
): CampaignReleasePackagePlan {
  const slug = safeAdminSlug(slugInput);
  const selection = readActiveServiceCampaignSelection(slug);
  const requestedService = String(
    resolveCurrentRunCandidateServiceId(slug, identity?.serviceId || selection?.serviceId) ||
      identity?.serviceId ||
      selection?.serviceId ||
      "",
  ).trim();
  const currentRunCandidates = requestedService
    ? resolveApprovedCurrentRunCandidatePublishReadiness(slug, requestedService)
    : null;
  if (currentRunCandidates?.active) {
    const campaignId = requestedService;
    const serviceId = requestedService;
    const candidateBlockers: string[] = [];
    if (!currentRunCandidates.approvedServicePage) {
      candidateBlockers.push("Approved current-run service-page candidate is missing");
    }
    for (const page of currentRunCandidates.pages.filter((row) => row.pageType === "local")) {
      if (!page.approved) candidateBlockers.push(`Approved current-run local candidate missing: ${page.areaSlug}`);
    }
    const servicePage: CampaignReleasePackagePagePlan | null = currentRunCandidates.approvedServicePage
      ? {
          pageSlug: serviceId,
          pageType: "service",
          areaSlug: null,
          relativePath: `${serviceId}/index.html`,
          sourcePath: "",
          sourceRenderer: "review-preview",
          previewAsset: "service-page",
          campaignId,
          serviceId,
          generationRevision: currentRunCandidates.candidateVersion,
          approved: true,
        }
      : null;
    const localityPages: CampaignReleasePackagePagePlan[] = currentRunCandidates.pages
      .filter((page) => page.pageType === "local" && page.approved && page.areaSlug)
      .map((page) => {
        const areaSlug = String(page.areaSlug);
        const pageSlug = canonicalPageSlugForLocalUrlPath(`/local/${areaSlug}/`);
        return {
          pageSlug,
          pageType: "location-area" as const,
          areaSlug,
          relativePath: `${pageSlug}/index.html`,
          sourcePath: "",
          sourceRenderer: "review-preview" as const,
          previewAsset: page.previewAsset,
          campaignId,
          serviceId,
          generationRevision: currentRunCandidates.candidateVersion,
          approved: true,
        };
      });
    const totalCampaignPages = (servicePage ? 1 : 0) + localityPages.length;
    return {
      slug,
      campaignId,
      serviceId,
      serviceRevision: currentRunCandidates.candidateVersion,
      contentManifestRevision: `current-run-approved-candidates:${campaignId}:${serviceId}:${currentRunCandidates.candidateVersion || "none"}:${totalCampaignPages}`,
      servicePage,
      localityPages,
      totalCampaignPages,
      blockers: candidateBlockers,
      otherServicePathsExcluded: [
        "pharmacy-first",
        "travel-vaccinations",
        "blood-pressure-checks",
        "prescription-dispensing",
      ].filter((id) => id !== serviceId),
    };
  }

  const { campaignId, serviceId } = resolveIdentity(slug, identity);
  const blockers: string[] = [];
  if (!campaignId || !serviceId) {
    return {
      slug,
      campaignId,
      serviceId,
      serviceRevision: null,
      contentManifestRevision: "incomplete-identity",
      servicePage: null,
      localityPages: [],
      totalCampaignPages: 0,
      blockers: ["Campaign identity is incomplete"],
      otherServicePathsExcluded: [],
    };
  }

  const serviceGenerated = isServicePageGeneratedForIdentity(slug, serviceId, campaignId);
  const record = serviceGenerated
    ? readServicePageGenerationRecord(slug, serviceId, campaignId)
    : null;
  const generationRevision = record?.imageAssignmentRevision
    ? String(record.imageAssignmentRevision)
    : null;
  const serviceApproved =
    serviceGenerated &&
    isCampaignServicePageReviewApproved(slug, campaignId, serviceId, generationRevision);
  const serviceSource = visualServicePagePath(slug, serviceId);
  if (!serviceGenerated) blockers.push("Service page is not generated");
  else if (!serviceApproved) blockers.push("Service page is not approved for the current revision");
  else if (!fs.existsSync(serviceSource)) blockers.push("Approved service page visual output missing");

  const campaign = readPharmacyCampaignStore(slug)?.campaigns.find((c) => c.id === campaignId);
  if (campaign && campaign.serviceId && campaign.serviceId !== serviceId) {
    blockers.push("Campaign service identity mismatch");
  }
  const selectedAreaSlugs = (campaign?.campaignAreas || [])
    .filter((a) => a.selected !== false)
    .map((a) => toAreaSlug(a.areaName))
    .filter(Boolean);

  // Non-current-run locality authority is Review Centre / Campaign Builder
  // approvedAssets["ai-local-area-page-pilot-v3:{areaSlug}"]. This path does not
  // read, write, or copy cluster-page-review.
  const reviewCentreApprovals = loadCampaignBuilderSession(slug).approvedAssets || {};
  const localityPages: CampaignReleasePackagePagePlan[] = [];
  for (const areaSlug of selectedAreaSlugs) {
    const approved = isReviewCentreLocalityApproved(reviewCentreApprovals, areaSlug);
    const sourcePath = resolveApprovedLocalitySourcePath(slug, serviceId, areaSlug, approved);
    const pageSlug = canonicalPageSlugForLocalUrlPath(`/local/${areaSlug}/`);
    if (!approved) {
      blockers.push(`Selected locality not approved: ${areaSlug}`);
      continue;
    }
    if (!fs.existsSync(sourcePath)) {
      blockers.push(`Approved locality page missing on disk: ${areaSlug}`);
      continue;
    }
    localityPages.push({
      pageSlug,
      pageType: "location-area",
      areaSlug,
      relativePath: `${pageSlug}/index.html`,
      sourcePath,
      campaignId,
      serviceId,
      generationRevision: null,
      approved: true,
    });
  }

  const servicePage: CampaignReleasePackagePagePlan | null =
    serviceApproved && fs.existsSync(serviceSource)
      ? {
          pageSlug: serviceId,
          pageType: "service",
          areaSlug: null,
          relativePath: `${serviceId}/index.html`,
          sourcePath: serviceSource,
          campaignId,
          serviceId,
          generationRevision,
          approved: true,
        }
      : null;

  const totalCampaignPages = (servicePage ? 1 : 0) + localityPages.length;
  const contentManifestRevision =
    localityPages.length > 0
      ? `campaign-approved-content:${campaignId}:${serviceId}:${generationRevision || "norev"}:${localityPages.length}`
      : "service-page-only";

  // Explicitly exclude other known service trees from this campaign package plan.
  const otherServicePathsExcluded = [
    "pharmacy-first",
    "travel-vaccinations",
    "blood-pressure-checks",
    "prescription-dispensing",
  ].filter((id) => id !== serviceId);

  return {
    slug,
    campaignId,
    serviceId,
    serviceRevision: generationRevision,
    contentManifestRevision,
    servicePage,
    localityPages,
    totalCampaignPages,
    blockers: [...new Set(blockers)],
    otherServicePathsExcluded,
  };
}
