/**
 * Campaign Builder area discovery — reuses migrated Local SEO Engine area ranking.
 */
import fs from "node:fs";
import path from "node:path";

import type { AreaProfile, AreaTier } from "../area/areaTypes.ts";
import { loadCityAreaData } from "../area/loadCityAreaData.ts";
import {
  discoverPharmacyAreas,
  type DiscoverPharmacyAreasResult,
} from "./pharmacyAreaDiscoveryService.ts";
import type {
  CampaignBuilderAreaCandidate,
  CampaignBuilderAreaPriorityLabel,
  CampaignBuilderSession,
} from "./growthEngineCampaignBuilderModel.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";

const RECOMMENDED_AREA_COUNT = 8;

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
}

function loadProfile(slug: string) {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

export function campaignAreaDiscoverySnapshotPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-campaign-area-discovery.json`);
}

function customerPriorityLabel(tier: AreaTier, rank: number): CampaignBuilderAreaPriorityLabel {
  if (tier === "priority" || rank <= 2) return "Primary";
  if (tier === "secondary" && rank <= 5) return "High";
  if (tier === "secondary") return "Medium";
  return "Low";
}

function demandLabel(level: AreaProfile["searchDemand"]): string {
  if (level === "high") return "Strong local search interest";
  if (level === "medium") return "Steady local search interest";
  return "Supporting local search interest";
}

function competitionLabel(level: AreaProfile["competition"]): string {
  if (level === "low") return "Room to stand out locally";
  if (level === "medium") return "Moderate local competition";
  return "Competitive local market";
}

function distanceLabel(profile: AreaProfile, primaryTown: string): string | null {
  if (!Number.isFinite(profile.distanceKm) || profile.distanceKm <= 0) return null;
  return `Approx. ${profile.distanceKm} km from ${primaryTown} town centre`;
}

function buildCustomerReason(profile: AreaProfile, primaryTown: string): string {
  const parts = [
    `${profile.name} is ${profile.character} near ${primaryTown}`,
    profile.knownFor ? `known for ${profile.knownFor}` : "",
    demandLabel(profile.searchDemand),
    competitionLabel(profile.competition),
  ].filter(Boolean);
  return parts.join(" · ");
}

function buildEvidence(profile: AreaProfile, primaryTown: string): string[] {
  const evidence: string[] = [];
  const distance = distanceLabel(profile, primaryTown);
  if (distance) evidence.push(distance);
  evidence.push(`Part of the ${primaryTown} local market`);
  evidence.push(demandLabel(profile.searchDemand));
  if (profile.character) evidence.push(profile.character);
  return evidence;
}

function preserveSelectionMap(session?: CampaignBuilderSession): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const row of session?.discoveredAreaCandidates || []) {
    map.set(row.areaName.toLowerCase(), row.selected);
  }
  return map;
}

export function discoverCampaignBuilderAreaCandidates(
  slug: string,
  session?: CampaignBuilderSession,
  limit = 10,
): {
  primaryTown: string;
  candidates: CampaignBuilderAreaCandidate[];
  discovery: DiscoverPharmacyAreasResult;
} {
  const profile = loadProfile(slug);
  const primaryTown = String(profile.primaryTown || profile.townCity || "").trim();
  if (!primaryTown) {
    throw new Error("Primary town or city is required before discovering target areas.");
  }

  const preserve = preserveSelectionMap(session);
  const preserveSelection = (session?.discoveredAreaCandidates || []).map((row) => ({
    areaName: row.areaName,
    areaType: row.tier,
    priority: row.rank,
    order: row.rank,
    selected: row.selected,
    source: row.source,
    confidence: row.score,
    score: row.score,
    tier: row.tier,
  }));

  const discovery = discoverPharmacyAreas({
    town: primaryTown,
    limit,
    preserveSelection: preserveSelection.length ? preserveSelection : undefined,
  });

  const cityData = loadCityAreaData(primaryTown);
  const profileMap = new Map(cityData.areas.map((area) => [area.name.toLowerCase(), area]));

  const candidates: CampaignBuilderAreaCandidate[] = discovery.areas.map((entry, index) => {
    const areaProfile = profileMap.get(entry.areaName.toLowerCase());
    const rank = entry.priority || index + 1;
    const tier = String(entry.tier || "secondary");
    const recommended = index < RECOMMENDED_AREA_COUNT;
    const wasSelected = preserve.has(entry.areaName.toLowerCase())
      ? preserve.get(entry.areaName.toLowerCase())!
      : recommended;

    return {
      areaName: entry.areaName,
      priorityLabel: customerPriorityLabel(tier as AreaTier, rank),
      reason: areaProfile
        ? buildCustomerReason(areaProfile, primaryTown)
        : `Recognised neighbourhood within the ${primaryTown} area`,
      distanceLabel: areaProfile ? distanceLabel(areaProfile, primaryTown) : null,
      selected: wasSelected,
      recommended,
      score: Number(entry.score || entry.confidence || 0),
      rank,
      tier,
      source: discovery.source,
      evidence: areaProfile ? buildEvidence(areaProfile, primaryTown) : [`Part of the ${primaryTown} local market`],
    };
  });

  return { primaryTown, candidates, discovery };
}

export function saveCampaignAreaDiscoverySnapshot(
  slug: string,
  payload: {
    discoveredAt: string;
    primaryTown: string;
    source: string;
    candidates: CampaignBuilderAreaCandidate[];
  },
): string {
  const file = campaignAreaDiscoverySnapshotPath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        version: 1,
        slug,
        ...payload,
      },
      null,
      2,
    ),
  );
  return file;
}

export function resolveCampaignBuilderSelectedAreaNames(session: CampaignBuilderSession): string[] {
  return (session.targetAreaNames || []).map((a) => String(a).trim()).filter(Boolean);
}
