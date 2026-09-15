/**
 * Pharmacy area discovery — wraps Local SEO Engine area/cluster ranking.
 */
import { rankAreasFromCityData } from "../area/areaEngine.ts";
import { loadCityAreaData } from "../area/loadCityAreaData.ts";
import type { AreaTier } from "../area/areaTypes.ts";
import type { PharmacyProfileData, ProfileAreaEntry } from "./pharmacyProfileSchema.ts";

export const AREA_SUGGEST_LIMITS = [5, 10, 15, 20, 30] as const;
export type AreaSuggestLimit = (typeof AREA_SUGGEST_LIMITS)[number];

export interface DiscoverPharmacyAreasInput {
  town: string;
  limit?: number;
  serviceName?: string;
  preserveSelection?: ProfileAreaEntry[];
}

export interface DiscoverPharmacyAreasResult {
  town: string;
  primaryCity: string;
  limit: number;
  areas: ProfileAreaEntry[];
  source: string;
  generatedAt: string;
}

function normalizeLimit(limit: number): AreaSuggestLimit {
  const n = Number(limit) || 10;
  const allowed = AREA_SUGGEST_LIMITS as readonly number[];
  if (allowed.includes(n)) return n as AreaSuggestLimit;
  return allowed.reduce((best, cur) => (Math.abs(cur - n) < Math.abs(best - n) ? cur : best));
}

function tierLabel(tier: AreaTier): string {
  if (tier === "priority") return "priority cluster";
  if (tier === "secondary") return "secondary cluster";
  return "supporting cluster";
}

function confidenceFromScore(score: number): number {
  return Math.min(100, Math.max(20, Math.round(score)));
}

export function discoverPharmacyAreas(input: DiscoverPharmacyAreasInput): DiscoverPharmacyAreasResult {
  const town = String(input.town || "").trim();
  if (!town) throw new Error("Main town/city is required.");

  const limit = normalizeLimit(input.limit ?? 10);
  const preserve = new Map(
    (input.preserveSelection || []).map((a) => [a.areaName.trim().toLowerCase(), a.selected]),
  );

  const cityData = loadCityAreaData(town);
  const maxPriority = Math.min(5, limit);
  const maxSecondary = Math.max(0, limit - maxPriority);

  const ranked = rankAreasFromCityData(cityData, maxPriority, maxSecondary).slice(0, limit);

  const profileMap = new Map(cityData.areas.map((a) => [a.name.toLowerCase(), a]));

  const areas: ProfileAreaEntry[] = ranked.map((row, idx) => {
    const profile = profileMap.get(row.area.toLowerCase());
    const key = row.area.toLowerCase();
    const wasSelected = preserve.has(key) ? preserve.get(key)! : idx < Math.min(8, limit);
    return {
      areaName: row.area,
      areaType: tierLabel(row.tier),
      priority: row.rank,
      order: idx + 1,
      selected: wasSelected,
      source: "engine",
      confidence: confidenceFromScore(row.score),
      score: row.score,
      tier: row.tier,
      postcode: profile?.postcode || "",
    };
  });

  return {
    town: cityData.city,
    primaryCity: cityData.city,
    limit,
    areas,
    source: "local-seo-engine-area-engine",
    generatedAt: new Date().toISOString(),
  };
}

export function mergeManualAreas(
  suggested: ProfileAreaEntry[],
  manualNames: string[],
): ProfileAreaEntry[] {
  const out = [...suggested];
  const seen = new Set(out.map((a) => a.areaName.toLowerCase()));
  let order = out.length;

  for (const raw of manualNames) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    order += 1;
    out.push({
      areaName: name,
      areaType: "manual",
      priority: order,
      order,
      selected: true,
      source: "manual",
      confidence: 100,
    });
  }

  return out;
}

/** Keep legacy rankingAreas / nearbyAreas / coverageAreas in sync for existing consumers. */
export function syncProfileAreaCompatibility(data: Partial<PharmacyProfileData>): Partial<PharmacyProfileData> {
  const entries = [...(data.selectedAreas || [])];
  const byName = new Map<string, ProfileAreaEntry>();
  for (const entry of entries) {
    if (entry?.areaName) byName.set(entry.areaName.toLowerCase(), entry);
  }

  const merged = [...byName.values()].sort((a, b) => a.order - b.order || a.priority - b.priority);
  const selected = merged.filter((a) => a.selected !== false);
  const allNames = merged.map((a) => a.areaName).filter(Boolean);
  const selectedNames = selected.map((a) => a.areaName);
  const manualNames = (data.manualAreas || []).filter(Boolean);

  const coverageAreas = [...new Set([...selectedNames, ...manualNames])];
  const rankingAreas = selectedNames.length ? selectedNames : coverageAreas;
  const nearbyAreas = [...new Set([...allNames, ...manualNames])];

  return {
    ...data,
    selectedAreas: merged,
    coverageAreas,
    rankingAreas,
    nearbyAreas,
    primaryTown: data.primaryTown || data.primaryCity || data.townCity || "",
    primaryCity: data.primaryCity || data.primaryTown || data.townCity || "",
    townCity: data.townCity || data.primaryTown || data.primaryCity || "",
  };
}

export function applyAreaDiscoveryToProfile(
  profile: Partial<PharmacyProfileData>,
  discovery: DiscoverPharmacyAreasResult,
): Partial<PharmacyProfileData> {
  const manual = (profile.manualAreas || []).filter(Boolean);
  const manualEntries = mergeManualAreas([], manual);
  const merged = mergeManualAreas(discovery.areas, manual);
  for (const m of manualEntries) {
    const existing = merged.find((a) => a.areaName.toLowerCase() === m.areaName.toLowerCase());
    if (existing) existing.selected = true;
  }

  return syncProfileAreaCompatibility({
    ...profile,
    primaryTown: discovery.primaryCity,
    primaryCity: discovery.primaryCity,
    townCity: discovery.primaryCity,
    selectedAreas: merged,
    areaDiscoverySource: discovery.source,
    areaDiscoveryUpdatedAt: discovery.generatedAt,
  });
}

export function resolveProfileCampaignAreas(
  profile: Partial<PharmacyProfileData>,
): Array<{ areaName: string; selected: boolean; source: string; priority: number }> {
  const synced = syncProfileAreaCompatibility(profile);
  const entries = synced.selectedAreas?.length
    ? synced.selectedAreas.filter((a) => a.selected !== false)
    : (synced.rankingAreas || []).map((name, i) => ({
        areaName: name,
        selected: true,
        source: "profile",
        priority: i + 1,
        order: i + 1,
        areaType: "",
      }));

  return (entries || []).map((a) => ({
    areaName: a.areaName,
    selected: a.selected !== false,
    source: a.source || "profile",
    priority: a.priority || a.order || 0,
  }));
}
