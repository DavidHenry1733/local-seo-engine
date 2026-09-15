/**
 * Sprint 8A / Defect 048 — Generation Setup (Component DNA + Local Areas confirmation).
 */
import fs from "node:fs";
import path from "node:path";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { readLatestApprovalSnapshot } from "./masterAdminBusinessProfileReviewService.ts";
import { readGoogleIntelligenceRecord } from "./masterAdminCanonicalGoogleService.ts";
import { syncProfileAreaCompatibility } from "./pharmacyAreaDiscoveryService.ts";
import {
  buildLocalCoverageRecommendations,
  type LocalCoverageAreaRecommendation,
} from "./masterAdminLocalCoverageRecommendationService.ts";
import { DISTANCE_UNAVAILABLE_LABEL } from "./masterAdminLocalCoverageGeoService.ts";
import type { PharmacyProfileData, ProfileAreaEntry } from "./pharmacyProfileSchema.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import { projectCanonicalSelectionOntoCampaign } from "./masterAdminSavedLocalitySelectionService.ts";
import { getPharmacyProfilePath, safePharmacySlug, WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  ensureComponentDnaPersisted,
  hasCanonicalComponentDna,
  type ComponentDnaPersistenceResult,
} from "./masterAdminComponentDnaPersistenceService.ts";
import { runPreGenerationValidation } from "./masterAdminPreGenerationValidation.ts";
import { isNationalMarketScope, resolvePrimaryMarket } from "./masterAdminMarketScopeService.ts";

export const LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES = 3;

export interface LocalAreaRecommendation {
  areaName: string;
  areaType: string;
  distanceKm: number | null;
  distanceLabel: string;
  evidenceSource: string;
  confidence: number;
  selected: boolean;
  recommended: boolean;
  branchLocality?: boolean;
  evidenceLimitation?: string | null;
  distanceMethod?: string;
  distanceProvenance?: LocalCoverageAreaRecommendation["distanceProvenance"];
}

export interface GenerationSetupState {
  slug: string;
  componentDnaReady: boolean;
  componentDnaPath: string;
  generationSetupRequired: boolean;
  primaryTown: string;
  primaryTownSource: string;
  recommendedAreas: LocalAreaRecommendation[];
  recommendedCount: number;
  selectedCount: number;
  areasConfirmed: boolean;
  localPageReady: boolean;
  servicePageReady: boolean;
  localPageLimitation: string | null;
  minimumAreaRulePass: boolean;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function parseAddressTown(address: string): string {
  const postcodeMatch = address.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i);
  const withoutCountry = address.replace(/,\s*UK\s*$/i, "").trim();
  const withoutPostcode = postcodeMatch
    ? withoutCountry.replace(postcodeMatch[0] || "", "").trim().replace(/,\s*$/, "")
    : withoutCountry;
  const parts = withoutPostcode.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1]! : "";
}

function resolvePrimaryTown(profile: PharmacyProfileData, slug: string): { town: string; source: string } {
  const fromProfile = text(profile.primaryTown) || text(profile.primaryCity) || text(profile.townCity);
  if (fromProfile) return { town: fromProfile, source: "approved profile" };

  const approval = readLatestApprovalSnapshot(slug);
  const approvalAddress = text(approval?.finalValues?.address);
  if (approvalAddress) {
    const town = parseAddressTown(approvalAddress);
    if (town) return { town, source: "approved business profile address" };
  }

  const displayAddress = text(profile.displayAddress);
  if (displayAddress) {
    const town = parseAddressTown(displayAddress);
    if (town) return { town, source: "approved business profile address" };
  }

  const google = readGoogleIntelligenceRecord(slug);
  if (google?.address) {
    const town = parseAddressTown(String(google.address));
    if (town) return { town, source: "google intelligence address" };
  }
  if (text(google?.town)) return { town: text(google?.town), source: "google intelligence" };

  const liPath = path.join(WORKSPACE_ROOT, "data/pharmacy-local-intelligence", `${safePharmacySlug(slug)}.json`);
  if (fs.existsSync(liPath)) {
    try {
      const li = JSON.parse(fs.readFileSync(liPath, "utf8")) as { primaryTown?: string; town?: string };
      const town = text(li.primaryTown) || text(li.town);
      if (town) return { town, source: "local intelligence" };
    } catch {
      /* fall through */
    }
  }

  return { town: "", source: "none" };
}

function mapCoverageArea(area: LocalCoverageAreaRecommendation): LocalAreaRecommendation {
  return {
    areaName: area.areaName,
    areaType: area.areaType,
    distanceKm: area.distanceKm,
    distanceLabel: area.distanceLabel,
    evidenceSource: area.evidenceSource,
    confidence: area.confidence,
    selected: area.selected,
    recommended: area.recommended,
    branchLocality: area.branchLocality,
    evidenceLimitation: area.evidenceLimitation,
    distanceMethod: area.distanceMethod,
    distanceProvenance: area.distanceProvenance,
  };
}

export function buildLocalAreaRecommendations(slug: string): {
  primaryTown: string;
  primaryTownSource: string;
  areas: LocalAreaRecommendation[];
  discoverySource: string;
  marketScope?: string;
  primaryMarket?: string;
  localityStrategyActive?: boolean;
} {
  const safe = safePharmacySlug(slug);
  const profile = readSetupProfile(safe);
  if (isNationalMarketScope(safe, profile)) {
    return {
      primaryTown: "",
      primaryTownSource: "national-market-scope",
      areas: [],
      discoverySource: "national-market-scope",
      marketScope: "national",
      primaryMarket: resolvePrimaryMarket(safe, profile),
      localityStrategyActive: false,
    };
  }
  const { town, source: primaryTownSource } = resolvePrimaryTown(profile, safe);
  const coverage = buildLocalCoverageRecommendations(safe);
  if (!town && !coverage.branchLocality && !coverage.areas.length) {
    return { primaryTown: "", primaryTownSource, areas: [], discoverySource: "none", localityStrategyActive: true };
  }

  return {
    primaryTown: coverage.primaryTown || town,
    primaryTownSource: coverage.primaryTownSource || primaryTownSource,
    areas: coverage.areas.map(mapCoverageArea),
    discoverySource: coverage.discoverySource,
    marketScope: coverage.marketScope,
    primaryMarket: coverage.primaryMarket,
    localityStrategyActive: coverage.localityStrategyActive,
  };
}

export function countSelectedAreas(areas: LocalAreaRecommendation[]): number {
  return areas.filter((a) => a.selected).length;
}

export function hasConfirmedLocalAreas(profile: PharmacyProfileData, slug?: string): boolean {
  if (slug && isNationalMarketScope(slug, profile)) return true;
  const town = text(profile.primaryTown) || text(profile.primaryCity) || text(profile.townCity);
  if (!town) return false;
  const selected = (profile.selectedAreas || []).filter((a) => a.selected !== false);
  return selected.length >= LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES;
}

export function buildGenerationSetupState(slug: string): GenerationSetupState {
  const safe = safePharmacySlug(slug);
  const profile = readSetupProfile(safe);
  const componentDnaPath = path.join(WORKSPACE_ROOT, "data", "pharmacy-component-dna", `${safe}.json`);
  const componentDnaReady = hasCanonicalComponentDna(safe);
  const national = isNationalMarketScope(safe, profile);

  if (national) {
    const primaryMarket = resolvePrimaryMarket(safe, profile);
    return {
      slug: safe,
      componentDnaReady,
      componentDnaPath,
      generationSetupRequired: !componentDnaReady,
      primaryTown: text(profile.primaryTown) || text(profile.townCity),
      primaryTownSource: "registered-address",
      recommendedAreas: [],
      recommendedCount: 0,
      selectedCount: 0,
      areasConfirmed: true,
      localPageReady: false,
      servicePageReady: true,
      localPageLimitation: `National market (${primaryMarket}) — locality page generation is not part of campaign strategy.`,
      minimumAreaRulePass: true,
    };
  }

  const { primaryTown, primaryTownSource, areas } = buildLocalAreaRecommendations(safe);
  const selectedCount = countSelectedAreas(areas);
  const recommendedCount = areas.filter((a) => a.recommended).length;
  const areasConfirmed = hasConfirmedLocalAreas(profile, safe);
  const townReady = Boolean(text(profile.primaryTown) || text(profile.townCity) || primaryTown);
  const localPageReady = areasConfirmed;
  const servicePageReady = townReady;
  const minimumAreaRulePass = areasConfirmed || selectedCount >= LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES;

  let localPageLimitation: string | null = null;
  if (townReady && selectedCount > 0 && selectedCount < LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES) {
    localPageLimitation = `Only ${selectedCount} local area(s) selected — Service Page generation allowed; Local Page generation requires at least ${LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES} selected areas.`;
  } else if (townReady && selectedCount === 0) {
    localPageLimitation = `No local areas confirmed — Service Page generation allowed after primary town is set; Local Page generation requires at least ${LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES} selected areas.`;
  }

  const generationSetupRequired = !componentDnaReady || !areasConfirmed;

  return {
    slug: safe,
    componentDnaReady,
    componentDnaPath,
    generationSetupRequired,
    primaryTown: text(profile.primaryTown) || text(profile.townCity) || primaryTown,
    primaryTownSource,
    recommendedAreas: areas,
    recommendedCount,
    selectedCount,
    areasConfirmed,
    localPageReady,
    servicePageReady,
    localPageLimitation,
    minimumAreaRulePass,
  };
}

export function saveGenerationSetupLocalAreas(
  slug: string,
  input: { primaryTown?: string; areas: Array<{ areaName: string; selected: boolean }>; manualAreas?: string[] },
): GenerationSetupState {
  const safe = safePharmacySlug(slug);
  const profile = readSetupProfile(safe);
  if (isNationalMarketScope(safe, profile)) {
    throw new Error("Local area selection is not required for National market scope.");
  }
  const town = text(input.primaryTown) || resolvePrimaryTown(profile, safe).town;
  if (!town) throw new Error("Primary town or city is required before saving local areas.");

  const byName = new Map(
    buildLocalAreaRecommendations(safe).areas.map((a) => [a.areaName.toLowerCase(), a]),
  );

  const selectedAreas: ProfileAreaEntry[] = input.areas
    .filter((a) => text(a.areaName))
    .map((a, idx) => {
      const known = byName.get(a.areaName.toLowerCase());
      const areaName = a.areaName.trim();
      const knownRec = known as (typeof known & {
        latitude?: number | null;
        longitude?: number | null;
        distanceMethod?: string;
        distanceProvenance?: Record<string, unknown>;
      }) | undefined;
      return {
        areaName,
        areaId: slugifyArea(areaName),
        areaType: known?.areaType || "neighbourhood",
        priority: idx + 1,
        order: idx + 1,
        selected: a.selected !== false,
        source: known?.evidenceSource || "generation-setup",
        confidence: known?.confidence ?? 70,
        tier: known?.branchLocality ? "priority" : "secondary",
        distanceKm: known?.distanceKm ?? null,
        distanceLabel: known?.distanceLabel || DISTANCE_UNAVAILABLE_LABEL,
        distanceMethod: known?.distanceMethod || knownRec?.distanceMethod || "none",
        latitude: knownRec?.latitude ?? null,
        longitude: knownRec?.longitude ?? null,
        distanceProvenance: knownRec?.distanceProvenance,
      } satisfies ProfileAreaEntry;
    });

  const manualAreas = (input.manualAreas || []).map((m) => text(m)).filter(Boolean);
  const synced = syncProfileAreaCompatibility({
    ...profile,
    primaryTown: town,
    primaryCity: town,
    townCity: town,
    selectedAreas,
    manualAreas,
    areaDiscoverySource: "master-admin-generation-setup",
    areaDiscoveryUpdatedAt: new Date().toISOString(),
  });

  writeSetupProfile(safe, synced as PharmacyProfileData);
  projectCanonicalSelectionOntoCampaign(safe);
  return buildGenerationSetupState(safe);
}

export function acceptRecommendedLocalAreas(slug: string): GenerationSetupState {
  const safe = safePharmacySlug(slug);
  const profile = readSetupProfile(safe);
  if (isNationalMarketScope(safe, profile)) {
    throw new Error("Local area selection is not required for National market scope.");
  }
  const rec = buildLocalAreaRecommendations(slug);
  if (!rec.primaryTown) throw new Error("Unable to resolve primary town from onboarding evidence.");
  return saveGenerationSetupLocalAreas(slug, {
    primaryTown: rec.primaryTown,
    areas: rec.areas.map((a) => ({
      areaName: a.areaName,
      selected: a.recommended,
    })),
  });
}

export function prepareGenerationSetup(slug: string): {
  componentDna: ComponentDnaPersistenceResult;
  setup: GenerationSetupState;
  validation: ReturnType<typeof runPreGenerationValidation>;
} {
  const componentDna = ensureComponentDnaPersisted(slug);
  const setup = buildGenerationSetupState(slug);
  const validation = runPreGenerationValidation(slug);
  return { componentDna, setup, validation };
}

export function generationSetupProfilePath(slug: string): string {
  return getPharmacyProfilePath(slug);
}
