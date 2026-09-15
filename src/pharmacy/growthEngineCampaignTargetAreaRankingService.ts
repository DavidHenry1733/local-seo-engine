/**
 * Evidence-backed Target Area ranking for Campaign Builder.
 * Uses stored pharmacy, Local Market and Local Intelligence records only.
 * Does not discover areas, write records, or expose internal scores to customers.
 */
import { BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS } from "./growthEngineCampaignModel.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import type { ProfileAreaEntry } from "./pharmacyProfileSchema.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import fs from "node:fs";
import path from "node:path";

export const RECOMMENDED_CAMPAIGN_TARGET_AREA_COUNT =
  BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.recommendedTargetAreas;

/** Explicit Product Owner / customer locality selection. Named-but-unselected rows are not selected. */
export function explicitConfirmedLocalityNames(areas: ProfileAreaEntry[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of areas || []) {
    if (entry.selected !== true) continue;
    const name = String(entry.areaName || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function hasExplicitLocalitySelection(areas: ProfileAreaEntry[] | undefined): boolean {
  return explicitConfirmedLocalityNames(areas).length > 0;
}

export type CustomerAreaOpportunityGrade =
  | "High priority"
  | "Good opportunity"
  | "Additional area"
  | "More evidence needed";

export interface RankedCampaignTargetArea {
  area: string;
  distanceLabel: string | null;
  grade: CustomerAreaOpportunityGrade;
  recommended: boolean;
  confirmedTarget: boolean;
}

function normalizeKey(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function areaMentioned(haystack: string, areaName: string): boolean {
  const text = String(haystack || "").trim();
  const area = String(areaName || "").trim();
  if (!text || !area) return false;
  const escaped = area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, "i").test(text);
}

function hasRecordedDistance(entry: ProfileAreaEntry): boolean {
  const method = String(entry.distanceMethod || "").trim().toLowerCase();
  if (method === "none") return false;
  const label = String(entry.distanceLabel || "").toLowerCase();
  if (label.includes("unavailable")) return false;
  return typeof entry.distanceKm === "number" && Number.isFinite(entry.distanceKm) && entry.distanceKm >= 0;
}

function countMentions(texts: string[], areaName: string): number {
  let count = 0;
  for (const text of texts) {
    if (areaMentioned(text, areaName)) count += 1;
  }
  return count;
}

function loadCompetitorTexts(slug: string): string[] {
  try {
    const snapshot = loadCompetitorSnapshot(slug);
    return (snapshot?.competitors || []).flatMap((row) => [
      String(row.businessName || ""),
      String(row.address || ""),
    ]);
  } catch {
    return [];
  }
}

function loadPlaceTexts(slug: string): string[] {
  const texts: string[] = [];
  try {
    const snapshot = loadCompetitorSnapshot(slug);
    for (const provider of snapshot?.healthcare?.providers || []) {
      texts.push(String(provider.businessName || ""));
      texts.push(String((provider as { address?: string }).address || ""));
    }
  } catch {
    // Optional Local Market healthcare evidence.
  }
  try {
    const file = path.join(WORKSPACE_ROOT, "data/pharmacy-local-intelligence", `${slug}.json`);
    if (!fs.existsSync(file)) return texts;
    const intel = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    const groups = [
      intel.gpSurgeries,
      intel.outOfHoursGpServices,
      intel.healthCentres,
      intel.hospitals,
      intel.landmarks,
      intel.localGps,
      intel.localHealthcareLocations,
      intel.localHospitals,
      intel.localLandmarks,
    ];
    for (const group of groups) {
      for (const item of (group as unknown[]) || []) {
        if (typeof item === "string") {
          texts.push(item);
          continue;
        }
        const row = item as { name?: string; businessName?: string; address?: string };
        texts.push(String(row.name || row.businessName || ""));
        texts.push(String(row.address || ""));
      }
    }
  } catch {
    // Local Intelligence file may be absent.
  }
  return texts.filter((text) => text.trim());
}

function customerGrade(input: {
  confirmed: boolean;
  hasProximity: boolean;
  distanceKm: number | null;
  competitorHits: number;
  placeHits: number;
}): CustomerAreaOpportunityGrade {
  const close = input.hasProximity && input.distanceKm != null && input.distanceKm <= 2.5;
  const localMarketSupport = input.competitorHits > 0 || input.placeHits > 0;
  if (!input.confirmed && !input.hasProximity && !localMarketSupport) {
    return "More evidence needed";
  }
  if (input.confirmed && (close || localMarketSupport)) {
    return "High priority";
  }
  if (input.confirmed && input.hasProximity) {
    return "Good opportunity";
  }
  if (input.hasProximity) {
    return "Additional area";
  }
  if (localMarketSupport) {
    return "Good opportunity";
  }
  return "More evidence needed";
}

export function resolveRecommendedCampaignTargetAreaCount(
  storedAreaCount: number,
  maxClusterPages = BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.maxClusterPages,
): number {
  if (storedAreaCount <= 0) return 0;
  return Math.min(RECOMMENDED_CAMPAIGN_TARGET_AREA_COUNT, storedAreaCount, maxClusterPages);
}

export function rankStoredCampaignTargetAreas(
  slug: string,
  storedAreas: ProfileAreaEntry[],
  rankingAreas: string[] = [],
): RankedCampaignTargetArea[] {
  const competitorTexts = loadCompetitorTexts(slug);
  const placeTexts = loadPlaceTexts(slug);
  const rankingKeys = new Set(rankingAreas.map((name) => normalizeKey(name)).filter(Boolean));
  const confirmedNames = explicitConfirmedLocalityNames(storedAreas);
  const namedCount = storedAreas.filter((entry) => String(entry.areaName || "").trim()).length;
  const required = confirmedNames.length
    ? Math.min(confirmedNames.length, BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.maxClusterPages)
    : resolveRecommendedCampaignTargetAreaCount(namedCount);

  const ranked = storedAreas
    .map((entry, index) => {
      const area = String(entry.areaName || "").trim();
      if (!area) return null;
      const confirmed = entry.selected === true;
      const proximity = hasRecordedDistance(entry);
      const distanceKm = proximity ? Number(entry.distanceKm) : null;
      const competitorHits = countMentions(competitorTexts, area);
      const placeHits = countMentions(placeTexts, area);
      const order = Number.isFinite(entry.order)
        ? entry.order
        : Number.isFinite(entry.priority)
          ? entry.priority
          : index + 1;
      let rankScore = 0;
      if (confirmed) rankScore += 100;
      if (entry.tier === "priority" || rankingKeys.has(normalizeKey(area))) rankScore += 25;
      if (competitorHits) rankScore += Math.min(competitorHits, 3) * 12;
      if (placeHits) rankScore += Math.min(placeHits, 2) * 8;
      if (proximity && distanceKm != null) rankScore += Math.max(0, Math.round((20 - distanceKm) * 2));
      rankScore -= order * 0.01;
      return {
        area,
        distanceLabel: entry.distanceLabel || (proximity && distanceKm != null ? `${distanceKm} km` : null),
        grade: customerGrade({
          confirmed,
          hasProximity: proximity,
          distanceKm,
          competitorHits,
          placeHits,
        }),
        recommended: false,
        confirmedTarget: confirmed,
        rankScore,
        order,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => b.rankScore - a.rankScore || a.order - b.order);

  const recommendedKeys = confirmedNames.length
    ? new Set(confirmedNames.map((name) => normalizeKey(name)))
    : new Set(ranked.slice(0, required).map((row) => normalizeKey(row.area)));
  return ranked.map(({ rankScore, order, ...row }) => {
    void rankScore;
    void order;
    return {
      ...row,
      recommended: recommendedKeys.has(normalizeKey(row.area)),
    };
  });
}
