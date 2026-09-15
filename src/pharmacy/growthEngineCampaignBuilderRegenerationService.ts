/**
 * Campaign Builder new-campaign preview.
 * Plans a fresh campaign from the saved pharmacy profile.
 * Does not read previous run jobs or candidates. Does not write, publish, or index.
 */
import fs from "node:fs";
import path from "node:path";

import {
  AI_LOCAL_COPY_ATTEMPT_LOG_DIRNAME,
  AI_LOCAL_COPY_PILOT_DIRNAME,
  AI_LOCAL_PAGE_PILOT_DIRNAME,
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import {
  buildCampaignBuilderList,
  loadCampaignBuilderSession,
} from "./growthEngineCampaignBuilderService.ts";
import type { CampaignBuilderListItem } from "./growthEngineCampaignBuilderModel.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import {
  readPharmacyCampaignStore,
  type PharmacyCampaign,
} from "./pharmacyCampaignService.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { resolveCanonicalPharmacyName } from "./pharmacyServicePageProfileContext.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const CAMPAIGN_REGENERATION_CANDIDATE_SERVICE = "generateOneLocalPageCandidate";
export const CAMPAIGN_REGENERATION_WRITER = "generateAiLocalCopyPilotV3";
export const CAMPAIGN_REGENERATION_RENDERER = "assemblePharmacyAiLocalPagePilotsV3";

export type CampaignRegenerationCandidateJob = {
  areaName: string;
  areaSlug: string;
  candidateService: typeof CAMPAIGN_REGENERATION_CANDIDATE_SERVICE;
  writer: typeof CAMPAIGN_REGENERATION_WRITER;
  renderer: typeof CAMPAIGN_REGENERATION_RENDERER;
  candidateVersion: string;
  replaceExistingCandidate: false;
  reuseSavedEvidence: false;
  publish: false;
  index: false;
};

export type CampaignRegenerationPreview = {
  slug: string;
  pharmacyName: string;
  serviceId: string;
  serviceName: string;
  existingCampaignId: string;
  existingCampaignName: string;
  existingCampaignVersion: string;
  existingCandidateVersion: string;
  newCandidateVersion: string;
  assetsToRegenerate: Array<{ count: number; label: string }>;
  savedEvidenceReused: [];
  candidateJobs: CampaignRegenerationCandidateJob[];
  preserve: string[];
  publish: false;
  index: false;
  generated: false;
};

function loadProfileData(slug: string) {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { data?: Record<string, unknown> };
    return normalizeProfileData(doc.data || {});
  } catch {
    return normalizeProfileData({});
  }
}

function parseVersionNumber(folder: string): number | null {
  const match = /^v(\d+)$/.exec(folder);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function versionFoldersIn(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && parseVersionNumber(entry.name) != null)
    .map((entry) => entry.name);
}

export function listExistingCandidateVersions(slug: string, serviceId: string): string[] {
  const versions = new Set<string>([
    ...versionFoldersIn(path.join(PHARMACY_WORKSPACE_ROOT, AI_LOCAL_COPY_PILOT_DIRNAME, slug, serviceId)),
    ...versionFoldersIn(path.join(PHARMACY_WORKSPACE_ROOT, AI_LOCAL_PAGE_PILOT_DIRNAME, slug, serviceId)),
    ...versionFoldersIn(path.join(PHARMACY_WORKSPACE_ROOT, AI_LOCAL_COPY_ATTEMPT_LOG_DIRNAME, slug, serviceId)),
  ]);
  return [...versions].sort((a, b) => (parseVersionNumber(a) || 0) - (parseVersionNumber(b) || 0));
}

export function nextCandidateVersion(existingVersions: string[]): string {
  const numbers = existingVersions
    .map((version) => parseVersionNumber(version))
    .filter((n): n is number => n != null);
  if (!numbers.length) return AI_LOCAL_PILOT_CONTRACT_VERSION_V3;
  return `v${Math.max(...numbers) + 1}`;
}

export function findActivePharmacyCampaignForService(
  slug: string,
  serviceId: string,
): PharmacyCampaign | null {
  const store = readPharmacyCampaignStore(slug);
  if (!store) return null;
  return (
    (store.campaigns || []).find(
      (campaign) => campaign.status === "active" && campaign.serviceId === serviceId,
    ) || null
  );
}

function uniqueAreaNames(slug: string, campaign: PharmacyCampaign | null): { areaName: string; areaSlug: string }[] {
  const session = loadCampaignBuilderSession(slug);
  const names = new Map<string, string>();
  for (const raw of session.targetAreaNames || []) {
    const areaName = String(raw || "").trim();
    const areaSlug = slugifyArea(areaName);
    if (areaName && areaSlug) names.set(areaSlug, areaName);
  }
  if (names.size) {
    return [...names.entries()].map(([areaSlug, areaName]) => ({ areaSlug, areaName }));
  }
  for (const area of campaign?.campaignAreas || []) {
    if (!area.selected) continue;
    const areaName = String(area.areaName || "").trim();
    const areaSlug = String(area.areaSlug || slugifyArea(areaName) || "").trim();
    if (areaName && areaSlug) names.set(areaSlug, areaName);
  }
  return [...names.entries()].map(([areaSlug, areaName]) => ({ areaSlug, areaName }));
}

export function buildCampaignRegenerationPreview(
  slug: string,
  serviceId: string,
  listItem?: CampaignBuilderListItem | null,
  options?: { requireExistingCampaign?: boolean },
): CampaignRegenerationPreview | null {
  const campaign = findActivePharmacyCampaignForService(slug, serviceId);
  const requireExisting = options?.requireExistingCampaign !== false;
  const item = listItem || buildCampaignBuilderList(slug).find((row) => row.serviceId === serviceId) || null;
  if (requireExisting && !campaign) return null;
  if (!campaign && !item) return null;
  const profile = loadProfileData(slug);
  const pharmacyName = resolveCanonicalPharmacyName(profile).value || String(profile.pharmacyName || slug);

  const store = readPharmacyCampaignStore(slug);
  const existingVersions = listExistingCandidateVersions(slug, serviceId);
  const existingCandidateVersion = existingVersions[existingVersions.length - 1] || "none";
  const newCandidateVersion = nextCandidateVersion(existingVersions);
  const areas = uniqueAreaNames(slug, campaign);
  const assetsToRegenerate = (item?.packageItems || []).filter((row) => row.count > 0);

  return {
    slug,
    pharmacyName,
    serviceId,
    serviceName: item?.serviceName || campaign?.serviceName || serviceId,
    existingCampaignId: campaign?.id || "saved-profile",
    existingCampaignName: campaign?.name || item?.serviceName || serviceId,
    existingCampaignVersion: String(store?.version ?? 1),
    existingCandidateVersion,
    newCandidateVersion,
    assetsToRegenerate,
    savedEvidenceReused: [],
    candidateJobs: areas.map((area) => ({
      areaName: area.areaName,
      areaSlug: area.areaSlug,
      candidateService: CAMPAIGN_REGENERATION_CANDIDATE_SERVICE,
      writer: CAMPAIGN_REGENERATION_WRITER,
      renderer: CAMPAIGN_REGENERATION_RENDERER,
      candidateVersion: newCandidateVersion,
      replaceExistingCandidate: false,
      reuseSavedEvidence: false,
      publish: false,
      index: false,
    })),
    preserve: ["previous-runs", "previous-candidates", "inactive-history"],
    publish: false,
    index: false,
    generated: false,
  };
}

export function confirmCampaignBuilderVersionedRegeneration(opts: {
  slug: string;
  serviceId: string;
  confirmed: boolean;
}):
  | { ok: false; generated: false; published: false; indexed: false; error: string }
  | { ok: true; generated: false; published: false; indexed: false; preview: CampaignRegenerationPreview } {
  const preview = buildCampaignRegenerationPreview(opts.slug, opts.serviceId);
  if (!preview) {
    return {
      ok: false,
      generated: false,
      published: false,
      indexed: false,
      error: "No existing campaign was found for this service.",
    };
  }
  if (!opts.confirmed) {
    return {
      ok: false,
      generated: false,
      published: false,
      indexed: false,
      error: "Confirmation is required. Nothing was created.",
    };
  }
  return {
    ok: true,
    generated: false,
    published: false,
    indexed: false,
    preview,
  };
}
