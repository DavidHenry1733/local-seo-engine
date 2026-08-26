/**
 * Generic local area resolution — evidence-backed hierarchy for all tenants.
 */
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import { resolveClusterPageSlug } from "./pharmacyClusterPageUrlResolver.ts";
import type { PharmacyProfileData, ProfileAreaEntry } from "./pharmacyProfileSchema.ts";
import {
  areaDiscoveryForName,
  loadAreaDiscoverySnapshot,
  loadFrozenCampaignSelectedAreas,
  loadLocalMarketSnapshot,
  type AreaDiscoverySnapshot,
} from "./pharmacyLocalMarketSnapshot.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import path from "node:path";

export type LocalAreaNodeType =
  | "primary-locality"
  | "city-town-hub"
  | "district-cluster"
  | "neighbourhood-area"
  | "nearby-locality";

export interface LocalAreaEvidenceRecord {
  areaId: string;
  name: string;
  slug: string;
  type: LocalAreaNodeType;
  parentAreaId: string | null;
  source: string;
  evidence: string[];
  serviceIds: string[];
  generationEligible: boolean;
  generationReason: string;
  approved: boolean;
  distanceLabel?: string;
  relationship?: string;
  priority?: number;
  order?: number;
}

export interface LocalLocationHierarchy {
  ok: boolean;
  blockedReason?: string;
  primaryLocality: string;
  primaryLocalitySlug: string;
  hub: LocalAreaEvidenceRecord | null;
  clusters: LocalAreaEvidenceRecord[];
  areas: LocalAreaEvidenceRecord[];
  /** Flat list for ContentGenerationContext.selectedAreas */
  generationAreas: LocalAreaEvidenceRecord[];
  trace: LocalAreaResolutionTrace;
}

export interface LocalAreaResolutionTrace {
  profilePath: string;
  tenantSlug: string;
  primaryLocation: string;
  postcode: string;
  townCity: string;
  storedServiceAreas: string[];
  storedNeighbourhoods: string[];
  importedLocationEvidence: string[];
  googleLocationEvidence: string[];
  localIntelligenceAreas: string[];
  selectedAreasSource: string;
  selectedAreasFilters: string[];
  rejectedAreas: Array<{ name: string; reason: string }>;
  rejectionReasons: string[];
  firstEmptySelectionDecision?: string;
  responsibleFile?: string;
  responsibleFunction?: string;
  responsibleLine?: number;
  areasConsidered: string[];
}

/** Minimum fallback when profile area typing is absent — not a production maximum. */
export const MIN_CLUSTER_FALLBACK = 2;

/** @deprecated RC1 uses cluster pages only — retained for legacy script references. */
export const MIN_AREA_FALLBACK = 4;

function profilePathForSlug(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function areaKey(name: string): string {
  return normalizeName(name).toLowerCase();
}

function entryEvidence(entry: ProfileAreaEntry, discovery: AreaDiscoverySnapshot | null): string[] {
  const out: string[] = [];
  if (entry.source) out.push(`profile.source:${entry.source}`);
  if (entry.areaType) out.push(`profile.areaType:${entry.areaType}`);
  if (entry.confidence != null) out.push(`profile.confidence:${entry.confidence}`);
  if (entry.tier) out.push(`profile.tier:${entry.tier}`);
  const disc = areaDiscoveryForName(discovery, entry.areaName);
  if (disc) {
    out.push(`area-discovery:${disc.reason || "candidate"}`);
    out.push(...disc.evidence.slice(0, 4));
    if (disc.distanceLabel) out.push(`distance:${disc.distanceLabel}`);
  }
  return out.filter(Boolean);
}

interface RawCandidate {
  name: string;
  slug: string;
  source: string;
  evidence: string[];
  priority: number;
  order: number;
  areaType: string;
  approved: boolean;
  distanceLabel?: string;
}

function collectCandidates(input: {
  slug: string;
  serviceId: string;
  profile: PharmacyProfileData;
  discovery: AreaDiscoverySnapshot | null;
}): { candidates: RawCandidate[]; trace: Partial<LocalAreaResolutionTrace> } {
  const { profile, discovery, slug, serviceId } = input;
  const rejected: Array<{ name: string; reason: string }> = [];
  const seen = new Map<string, RawCandidate>();

  const add = (raw: Omit<RawCandidate, "slug"> & { slug?: string }) => {
    const name = normalizeName(raw.name);
    if (!name || name.length < 2) {
      rejected.push({ name: raw.name || "(empty)", reason: "empty location name" });
      return;
    }
    const key = areaKey(name);
    const slug = raw.slug || slugifyArea(name);
    if (seen.has(key)) return;
    seen.set(key, {
      name,
      slug,
      source: raw.source,
      evidence: raw.evidence,
      priority: raw.priority,
      order: raw.order,
      areaType: raw.areaType,
      approved: raw.approved,
      distanceLabel: raw.distanceLabel,
    });
  };

  const frozen = loadFrozenCampaignSelectedAreas(slug, serviceId);
  const frozenSelected = (frozen || []).filter((a) => a.selected !== false);
  const profileSelected = (profile.selectedAreas || []).filter((a) => a.selected !== false);
  let selectedSource = "profile.selectedAreas";
  const hasExplicitSavedSelection = profileSelected.length > 0 || frozenSelected.length > 0;

  if (profileSelected.length) {
    selectedSource = "profile.selectedAreas";
    for (const entry of profileSelected) {
      add({
        name: entry.areaName,
        slug: entry.areaId || slugifyArea(entry.areaName),
        source: "operator-confirmed:profile.selectedAreas",
        evidence: entryEvidence(entry, discovery),
        priority: entry.priority ?? 50,
        order: entry.order ?? 99,
        areaType: entry.areaType || "neighbourhood",
        approved: true,
        distanceLabel: entry.distanceLabel,
      });
    }
  } else if (frozenSelected.length) {
    selectedSource = `frozen-campaign:${serviceId}`;
    for (const a of frozenSelected) {
      add({
        name: a.areaName,
        slug: a.areaSlug,
        source: selectedSource,
        evidence: [`frozen-campaign-generation-context`, `areaSlug:${a.areaSlug}`],
        priority: a.priority ?? 50,
        order: a.order ?? 99,
        areaType: "operator-confirmed",
        approved: true,
      });
    }
  }

  if (!hasExplicitSavedSelection) {
    for (const name of profile.coverageAreas || []) {
      add({
        name: String(name),
        source: "business-profile:coverageAreas",
        evidence: ["business-profile coverageAreas"],
        priority: 40,
        order: 100,
        areaType: "coverage",
        approved: true,
      });
    }

    for (const name of profile.rankingAreas || []) {
      add({
        name: String(name),
        source: "business-profile:rankingAreas",
        evidence: ["business-profile rankingAreas"],
        priority: 35,
        order: 110,
        areaType: "ranking",
        approved: true,
      });
    }

    if (discovery?.areas.length) {
      for (const row of discovery.areas) {
        if (row.selected === false) {
          rejected.push({ name: row.areaName, reason: "area discovery not selected for generation" });
          continue;
        }
        add({
          name: row.areaName,
          source: "local-intelligence:area-discovery",
          evidence: [`discovery:${row.reason}`, ...row.evidence.slice(0, 3)],
          priority: row.rank != null ? 100 - row.rank : 30,
          order: row.rank ?? 120,
          areaType: row.tier || row.priorityLabel || "discovery",
          approved: true,
          distanceLabel: row.distanceLabel,
        });
      }
    }
  }

  const primaryTown = normalizeName(String(profile.primaryTown || profile.townCity || ""));
  if (primaryTown) {
    const pk = areaKey(primaryTown);
    if (!seen.has(pk)) {
      add({
        name: primaryTown,
        source: "business-profile:primaryTown",
        evidence: ["primaryTown/primaryCity on business profile"],
        priority: 100,
        order: 0,
        areaType: "primary-locality",
        approved: true,
      });
    }
  }

  const sorted = [...seen.values()].sort((a, b) => a.order - b.order || b.priority - a.priority || a.name.localeCompare(b.name));

  return {
    candidates: sorted,
    trace: {
      storedServiceAreas: [...(profile.coverageAreas || []).map(String)],
      storedNeighbourhoods: [...(profile.nearbyAreas || []).map(String)],
      selectedAreasSource: selectedSource,
      rejectedAreas: rejected,
      areasConsidered: sorted.map((c) => c.name),
    },
  };
}

export function traceLocalAreaSelection(slug: string, serviceId: string, profile: PharmacyProfileData): LocalAreaResolutionTrace {
  const discovery = loadAreaDiscoverySnapshot(slug);
  const localMarket = loadLocalMarketSnapshot(slug);
  const { trace } = collectCandidates({ slug, serviceId, profile, discovery });
  const primaryTown = normalizeName(String(profile.primaryTown || profile.townCity || ""));

  const filters: string[] = [];
  const legacyFilter =
    serviceId === "pharmacy-first"
      ? "benchmarkServiceEcosystemBuilder filters pharmacy-first areas against PHARMACY_FIRST_ACTIVE_LOCAL_SLUGS (Broom Lane manifest)"
      : "none";
  filters.push(legacyFilter);

  const profileSelected = (profile.selectedAreas || []).filter((a) => a.selected !== false).map((a) => a.areaName);
  const firstEmpty =
    profileSelected.length > 0 && serviceId === "pharmacy-first"
      ? "All operator-selected areas removed by PHARMACY_FIRST_ACTIVE_LOCAL_SLUGS allow-list in buildBenchmarkServiceEcosystem"
      : profileSelected.length === 0
        ? "profile.selectedAreas empty after resolveSelectedAreas fallback"
        : undefined;

  return {
    profilePath: profilePathForSlug(slug),
    tenantSlug: slug,
    primaryLocation: primaryTown,
    postcode: String(profile.postcode || ""),
    townCity: primaryTown,
    storedServiceAreas: trace.storedServiceAreas || [],
    storedNeighbourhoods: trace.storedNeighbourhoods || [],
    importedLocationEvidence: (profile.websiteImportedFieldKeys || []).slice(0, 20).map(String),
    googleLocationEvidence: [
      profile.googlePlaceId ? `googlePlaceId:${profile.googlePlaceId}` : "",
      profile.displayAddress ? `displayAddress:${profile.displayAddress}` : "",
      localMarket?.yourPharmacy?.address ? `competitorsSnapshot:${localMarket.yourPharmacy.address}` : "",
    ].filter(Boolean),
    localIntelligenceAreas: (discovery?.areas || []).map((a) => a.areaName),
    selectedAreasSource: trace.selectedAreasSource || "unknown",
    selectedAreasFilters: filters,
    rejectedAreas: trace.rejectedAreas || [],
    rejectionReasons: (trace.rejectedAreas || []).map((r) => `${r.name}: ${r.reason}`),
    firstEmptySelectionDecision: firstEmpty,
    responsibleFile: firstEmpty?.includes("PHARMACY_FIRST")
      ? "src/pharmacy/benchmarkServiceEcosystemBuilder.ts"
      : undefined,
    responsibleFunction: firstEmpty?.includes("PHARMACY_FIRST") ? "buildBenchmarkServiceEcosystem" : undefined,
    responsibleLine: firstEmpty?.includes("PHARMACY_FIRST") ? 647 : undefined,
    areasConsidered: trace.areasConsidered || [],
  };
}

export function resolveLocalLocationHierarchy(
  slug: string,
  serviceId: string,
  profile: PharmacyProfileData,
): LocalLocationHierarchy {
  const discovery = loadAreaDiscoverySnapshot(slug);
  const { candidates, trace: partialTrace } = collectCandidates({ slug, serviceId, profile, discovery });
  const trace = traceLocalAreaSelection(slug, serviceId, profile);

  const primaryLocality = normalizeName(String(profile.primaryTown || profile.townCity || ""));
  const primarySlug = primaryLocality ? slugifyArea(primaryLocality) : "";

  const withoutPrimary = candidates.filter((c) => areaKey(c.name) !== areaKey(primaryLocality));
  const eligible = withoutPrimary.filter((c) => c.approved && c.name.length >= 2);

  if (!primaryLocality) {
    return {
      ok: false,
      blockedReason: "missing primary town on business profile",
      primaryLocality: "",
      primaryLocalitySlug: "",
      hub: null,
      clusters: [],
      areas: [],
      generationAreas: [],
      trace,
    };
  }

  if (eligible.length < 1) {
    return {
      ok: false,
      blockedReason: `insufficient evidenced areas (${eligible.length}); need at least one approved area for cluster page generation`,
      primaryLocality,
      primaryLocalitySlug: primarySlug,
      hub: null,
      clusters: [],
      areas: [],
      generationAreas: [],
      trace: {
        ...trace,
        areasConsidered: partialTrace.areasConsidered || trace.areasConsidered,
        rejectedAreas: [...(partialTrace.rejectedAreas || []), ...(trace.rejectedAreas || [])],
      },
    };
  }

  const hubRecord: LocalAreaEvidenceRecord = {
    areaId: `hub:${primarySlug}`,
    name: primaryLocality,
    slug: "hub",
    type: "city-town-hub",
    parentAreaId: null,
    source: "business-profile:primaryTown",
    evidence: ["Primary town/city hub for service coverage"],
    serviceIds: [serviceId],
    generationEligible: true,
    generationReason: "primary locality hub",
    approved: true,
  };

  const clusterCandidates = eligible.length ? eligible : [];

  const clusters: LocalAreaEvidenceRecord[] = clusterCandidates.map((c, idx) => ({
    areaId: `cluster:${resolveClusterPageSlug(c.slug || c.name)}`,
    name: c.name,
    slug: resolveClusterPageSlug(c.slug || c.name),
    type: "district-cluster",
    parentAreaId: hubRecord.areaId,
    source: c.source,
    evidence: c.evidence,
    serviceIds: [serviceId],
    generationEligible: true,
    generationReason: `RC1 cluster page ${idx + 1} for approved area`,
    approved: true,
    distanceLabel: c.distanceLabel,
    relationship: `local guidance for patients around ${primaryLocality}`,
    priority: c.priority,
    order: c.order,
  }));

  const areas: LocalAreaEvidenceRecord[] = [];

  return {
    ok: true,
    primaryLocality,
    primaryLocalitySlug: primarySlug,
    hub: hubRecord,
    clusters,
    areas,
    generationAreas: [...clusters, ...areas],
    trace,
  };
}

export function hierarchyToContentGenerationAreas(hierarchy: LocalLocationHierarchy) {
  return hierarchy.clusters.map((a) => ({
    areaName: a.name,
    areaSlug: a.slug,
    selected: true,
    priority: a.priority,
    order: a.order,
  }));
}
