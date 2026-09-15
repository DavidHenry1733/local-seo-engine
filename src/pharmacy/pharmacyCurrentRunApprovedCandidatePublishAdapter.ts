/**
 * Connects Review Centre approved current-run candidates to the existing
 * publishing workflow. Authority is the saved candidate records plus
 * campaign-builder approvals — not ecosystem packages, launch-queue
 * manual completion, legacy candidates, or generated HTML.
 * Does not publish, index, or generate content.
 */
import {
  AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
  isAuthorisedAiLocalPilotV3Area,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { loadCampaignBuilderSession } from "./growthEngineCampaignBuilderService.ts";
import { loadCampaignRegenerationRun } from "./growthEngineCampaignBuilderRegenerationRunService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import fs from "node:fs";
import path from "node:path";
import { SERVICE_PAGE_CANDIDATE_KEY } from "./growthEngineReviewCentreService.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import { evaluateLocalityEvidenceSufficiencyForCampaignAreas } from "./contentEngine/pharmacyLocalityEvidenceSufficiencyGateV1.ts";

export interface ApprovedCurrentRunCandidatePage {
  key: string;
  pageType: "service" | "local";
  areaSlug: string | null;
  previewAsset: string;
  approved: boolean;
}

export interface ApprovedCurrentRunCandidatePublishReadiness {
  active: boolean;
  ready: boolean;
  candidateVersion: string | null;
  runId: string | null;
  serviceId: string;
  approvedServicePage: boolean;
  approvedLocalCount: number;
  expectedLocalCount: number;
  approvedCount: number;
  expectedCount: number;
  pages: ApprovedCurrentRunCandidatePage[];
  published: boolean;
  indexed: boolean;
  publishSettingsUrl: string;
}

function localCandidateKey(areaSlug: string): string {
  return `${AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET}:${areaSlug}`;
}

export function resolveCurrentRunCandidateServiceId(slug: string, preferredServiceId?: string): string | null {
  const preferred = String(preferredServiceId || "").trim().toLowerCase();
  if (preferred && loadCampaignRegenerationRun(slug, preferred)) return preferred;
  const root = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-local-page-campaign-runs", slug);
  if (!fs.existsSync(root)) return null;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (loadCampaignRegenerationRun(slug, entry.name)) return entry.name;
  }
  return null;
}

export function resolveApprovedCurrentRunCandidatePublishReadiness(
  slug: string,
  serviceId: string,
): ApprovedCurrentRunCandidatePublishReadiness | null {
  const campaignId = String(serviceId || "").trim().toLowerCase();
  if (!slug || !campaignId) return null;
  const run = loadCampaignRegenerationRun(slug, campaignId);
  if (!run) return null;

  const session = loadCampaignBuilderSession(slug);
  const approvedAssets = session.approvedAssets || {};
  const pages: ApprovedCurrentRunCandidatePage[] = [];

  const serviceApproved = Boolean(approvedAssets[SERVICE_PAGE_CANDIDATE_KEY]);
  pages.push({
    key: SERVICE_PAGE_CANDIDATE_KEY,
    pageType: "service",
    areaSlug: null,
    previewAsset: "service-page",
    approved: serviceApproved,
  });

  const fromJobs = (run.jobs || [])
    .filter((job) => job.kind === "local-page" && job.status === "completed" && job.areaSlug)
    .map((job) => ({
      areaName: String(job.areaName || job.areaSlug),
      areaSlug: String(job.areaSlug),
    }));
  const fromSession = (session.selectedServiceId === campaignId ? session.targetAreaNames || [] : [])
    .map((name) => ({ areaName: name, areaSlug: slugifyArea(String(name || "")) }))
    .filter((row) => row.areaSlug);
  const locals = (fromJobs.length ? fromJobs : fromSession).filter((row) =>
    isAuthorisedAiLocalPilotV3Area(slug, row.areaSlug),
  );
  const sufficiencyByArea = evaluateLocalityEvidenceSufficiencyForCampaignAreas({
    slug,
    serviceId: campaignId,
    areas: locals,
  });
  const seen = new Set<string>();
  for (const local of locals) {
    if (seen.has(local.areaSlug)) continue;
    seen.add(local.areaSlug);
    const key = localCandidateKey(local.areaSlug);
    const evidence = sufficiencyByArea.get(local.areaSlug);
    pages.push({
      key,
      pageType: "local",
      areaSlug: local.areaSlug,
      previewAsset: AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
      approved: Boolean(approvedAssets[key]) && Boolean(evidence?.publishable),
    });
  }

  const approvedLocalCount = pages.filter((page) => page.pageType === "local" && page.approved).length;
  const expectedLocalCount = pages.filter((page) => page.pageType === "local").length;
  const approvedCount = pages.filter((page) => page.approved).length;
  const expectedCount = pages.length;
  const ready =
    run.status === "completed" &&
    expectedCount > 0 &&
    serviceApproved &&
    expectedLocalCount > 0 &&
    approvedCount === expectedCount;

  return {
    active: true,
    ready,
    candidateVersion: run.candidateVersion || null,
    runId: run.runId || null,
    serviceId: campaignId,
    approvedServicePage: serviceApproved,
    approvedLocalCount,
    expectedLocalCount,
    approvedCount,
    expectedCount,
    pages,
    published: Boolean(run.published),
    indexed: Boolean(run.indexed),
    publishSettingsUrl: `/api/admin/master?customer=${encodeURIComponent(slug)}&panel=commercial-publish-review`,
  };
}
