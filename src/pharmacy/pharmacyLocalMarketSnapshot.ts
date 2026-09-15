/**
 * Local Market snapshot loader — read-only binding from growth-engine data.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";

export interface LocalMarketHealthcareProvider {
  placeId: string;
  businessName: string;
  category: string;
  groupKey: string;
  distanceKm: number;
  distanceLabel: string;
  address: string;
  phone?: string;
  website?: string;
}

export interface LocalMarketYourPharmacy {
  placeId: string;
  businessName: string;
  latitude: number;
  longitude: number;
  address: string;
  phone: string;
  website: string;
}

export interface LocalMarketSnapshot {
  slug: string;
  generatedAt: string;
  yourPharmacy: LocalMarketYourPharmacy | null;
  healthcareProviders: LocalMarketHealthcareProvider[];
  nearbyPharmacies: Array<{ businessName: string; address: string; distanceLabel: string }>;
}

export interface AreaDiscoveryArea {
  areaName: string;
  distanceLabel: string;
  reason: string;
  evidence: string[];
  selected: boolean;
  priorityLabel?: string;
  rank?: number;
  tier?: string;
  score?: number;
}

export interface AreaDiscoverySnapshot {
  slug: string;
  primaryTown: string;
  areas: AreaDiscoveryArea[];
}

function workspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), ".."),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "data/growth-engine"))) return root;
  }
  return process.cwd();
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function normalizeDistanceKm(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 25) return Number.POSITIVE_INFINITY;
  return n;
}

export function loadLocalMarketSnapshot(slug: string): LocalMarketSnapshot | null {
  const key = resolveTenantProfileSlug(slug) || slug;
  const file = path.join(workspaceRoot(), "data/growth-engine", `${key}-competitors.json`);
  const raw = readJson<{
    slug?: string;
    generatedAt?: string;
    yourPharmacy?: Record<string, unknown>;
    healthcare?: { providers?: Array<Record<string, unknown>> };
    competitors?: Array<Record<string, unknown>>;
  }>(file);
  if (!raw) return null;

  const yourRaw = raw.yourPharmacy;
  const yourPharmacy: LocalMarketYourPharmacy | null = yourRaw
    ? {
        placeId: String(yourRaw.placeId || ""),
        businessName: String(yourRaw.businessName || ""),
        latitude: Number(yourRaw.latitude) || 0,
        longitude: Number(yourRaw.longitude) || 0,
        address: String(yourRaw.address || ""),
        phone: String(yourRaw.phone || ""),
        website: String(yourRaw.website || ""),
      }
    : null;

  const healthcareProviders = (raw.healthcare?.providers || [])
    .map((p) => ({
      placeId: String(p.placeId || ""),
      businessName: String(p.businessName || ""),
      category: String(p.category || ""),
      groupKey: String(p.groupKey || ""),
      distanceKm: normalizeDistanceKm(p.distanceKm),
      distanceLabel: String(p.distanceLabel || ""),
      address: String(p.address || ""),
      phone: String(p.phone || ""),
      website: String(p.website || ""),
    }))
    .filter((p) => p.businessName && Number.isFinite(p.distanceKm))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearbyPharmacies = (raw.competitors || [])
    .map((p) => ({
      businessName: String(p.businessName || ""),
      address: String(p.address || ""),
      distanceLabel: String(p.distanceLabel || ""),
      distanceKm: normalizeDistanceKm(p.distanceKm),
    }))
    .filter((p) => p.businessName && Number.isFinite(p.distanceKm))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5)
    .map(({ businessName, address, distanceLabel }) => ({ businessName, address, distanceLabel }));

  return {
    slug: key,
    generatedAt: String(raw.generatedAt || ""),
    yourPharmacy,
    healthcareProviders,
    nearbyPharmacies,
  };
}

export function loadAreaDiscoverySnapshot(slug: string): AreaDiscoverySnapshot | null {
  const key = resolveTenantProfileSlug(slug) || slug;
  const file = path.join(workspaceRoot(), "data/growth-engine", `${key}-campaign-area-discovery.json`);
  const raw = readJson<{
    slug?: string;
    primaryTown?: string;
    candidates?: Array<Record<string, unknown>>;
  }>(file);
  if (!raw?.candidates?.length) return null;

  const areas = raw.candidates
    .map((c) => ({
      areaName: String(c.areaName || "").trim(),
      distanceLabel: String(c.distanceLabel || "").trim(),
      reason: String(c.reason || "").trim(),
      evidence: Array.isArray(c.evidence) ? c.evidence.map(String).filter(Boolean) : [],
      selected: c.selected !== false,
      priorityLabel: String(c.priorityLabel || "").trim() || undefined,
      rank: typeof c.rank === "number" ? c.rank : undefined,
      score: typeof c.score === "number" ? c.score : undefined,
    }))
    .filter((a) => a.areaName);

  return {
    slug: key,
    primaryTown: String(raw.primaryTown || "").trim(),
    areas,
  };
}

export function loadFrozenCampaignSelectedAreas(
  slug: string,
  campaignId: string,
): Array<{ areaName: string; areaSlug: string; selected: boolean; order?: number; priority?: number }> | null {
  const key = resolveTenantProfileSlug(slug) || slug;
  const file = path.join(
    workspaceRoot(),
    "data/growth-engine",
    `${key}-campaign-generation-context-${campaignId}.json`,
  );
  const raw = readJson<{ generationContext?: { selectedAreas?: Array<Record<string, unknown>> } }>(file);
  const areas = raw?.generationContext?.selectedAreas;
  if (!areas?.length) return null;
  const mapped = areas
    .map((a) => {
      const areaName = String(a.areaName || "").trim();
      const areaSlug = String(a.areaSlug || "").trim() || areaName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return {
        areaName,
        areaSlug,
        selected: a.selected !== false,
        order: typeof a.order === "number" ? a.order : undefined,
        priority: typeof a.priority === "number" ? a.priority : undefined,
      };
    })
    .filter((a) => a.areaName && a.areaSlug && a.selected);
  return mapped.length ? mapped : null;
}

const NON_GP_HEALTHCARE_NAME =
  /dental|dentist|implant|tooth|foot clinic|podiatr|optician|eye clinic|chiropod|physio|eyecare|feet therapy|optometr|hearing aid/i;

export function isCredibleHealthcareProvider(provider: LocalMarketHealthcareProvider): boolean {
  const label = `${provider.category} ${provider.businessName}`.toLowerCase();
  if (NON_GP_HEALTHCARE_NAME.test(label)) return false;
  const allowedGroups = new Set(["gpSurgeries", "healthCentres", "communityClinics", "hospitals"]);
  if (!allowedGroups.has(provider.groupKey)) return false;
  if (provider.groupKey === "gpSurgeries") {
    return isCredibleGpProvider(provider);
  }
  if (provider.groupKey === "healthCentres") {
    return /health centre|medical centre|gp surgery|doctor/i.test(label);
  }
  if (provider.groupKey === "communityClinics") {
    return /urgent|emergency|uecc|walk.in|medical centre|health centre|nhs/i.test(label);
  }
  if (provider.groupKey === "hospitals") {
    return /hospital|nhs trust|emergency|queensway|district general/i.test(label);
  }
  return false;
}

function isCredibleGpProvider(provider: LocalMarketHealthcareProvider): boolean {
  if (provider.groupKey !== "gpSurgeries") return false;
  const label = `${provider.category} ${provider.businessName}`;
  if (NON_GP_HEALTHCARE_NAME.test(label)) return false;
  return /gp surgery|medical centre|doctor|health centre|surgery|dr\s/i.test(label);
}

export function providersForArea(
  snapshot: LocalMarketSnapshot | null | undefined,
  areaName: string,
  options?: { groupKeys?: string[]; limit?: number },
): LocalMarketHealthcareProvider[] {
  if (!snapshot?.healthcareProviders.length) return [];
  const groupKeys = options?.groupKeys;
  const limit = options?.limit ?? 3;
  const areaLower = areaName.toLowerCase();

  const areaMatched = snapshot.healthcareProviders.filter((p) => {
    if (groupKeys && !groupKeys.includes(p.groupKey)) return false;
    if (!isCredibleHealthcareProvider(p)) return false;
    if (groupKeys?.includes("gpSurgeries") && p.groupKey === "gpSurgeries" && !isCredibleGpProvider(p)) {
      return false;
    }
    if (p.address.toLowerCase().includes(areaLower)) return true;
    if (p.groupKey === "gpSurgeries" && /gp surgery|medical centre/i.test(p.category)) {
      return p.businessName.toLowerCase().includes(areaLower);
    }
    return false;
  });

  const coLocated = snapshot.healthcareProviders.filter((p) => {
    if (!isCredibleHealthcareProvider(p)) return false;
    if (groupKeys?.includes("gpSurgeries") && p.groupKey === "gpSurgeries" && !isCredibleGpProvider(p)) {
      return false;
    }
    return p.distanceKm === 0 && (!groupKeys || groupKeys.includes(p.groupKey));
  });

  const general = snapshot.healthcareProviders.filter((p) => {
    if (!isCredibleHealthcareProvider(p)) return false;
    if (groupKeys?.includes("gpSurgeries") && p.groupKey === "gpSurgeries" && !isCredibleGpProvider(p)) {
      return false;
    }
    return !groupKeys || groupKeys.includes(p.groupKey);
  });

  const merged: LocalMarketHealthcareProvider[] = [];
  const seen = new Set<string>();
  for (const provider of [...areaMatched, ...coLocated, ...general]) {
    const key = provider.placeId || provider.businessName;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(provider);
    if (merged.length >= limit) break;
  }
  return merged;
}

export function areaDiscoveryForName(
  snapshot: AreaDiscoverySnapshot | null | undefined,
  areaName: string,
): AreaDiscoveryArea | null {
  if (!snapshot?.areas.length) return null;
  return snapshot.areas.find((a) => a.areaName.toLowerCase() === areaName.toLowerCase()) || null;
}
