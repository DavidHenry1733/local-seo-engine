/**
 * Commercial Intelligence DataForSEO adapter.
 *
 * Wraps Keywords Data Google Ads search_volume/live for the active service
 * cluster (clinical + catchment queries). Zero/low hyper-local volume is
 * smoothed with a catchment incidence model. Overlapping brand queries are
 * never summed.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { safePharmacySlug } from "./pharmacyWorkspacePaths.ts";
import { ACTIVE_SERVICE_IDS, activeServiceLabel } from "./pharmacyServiceRegistry.ts";
import { WEIGHT_LOSS_DEMAND_QUERIES } from "./tenantsConfig.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { resolveTenantLocality } from "./masterAdminPrimaryLocalityService.ts";
import {
  isDataForSeoConfigured,
  parseSearchVolumeLiveResponse,
  postGoogleAdsSearchVolumeLive,
} from "./dataForSeoKeywordsDataSearchVolumeAdapter.ts";
import { buildServiceSearchDemandQueries } from "./serviceSearchDemandQueryBuilder.ts";
import { readConfirmedServiceIds } from "./serviceSearchDemandService.ts";
import { readServiceSearchDemandArtifact } from "./serviceSearchDemandStorage.ts";
import {
  SERVICE_SEARCH_DEMAND_LANGUAGE_CODE,
  SERVICE_SEARCH_DEMAND_LOCATION_CODE,
  SERVICE_SEARCH_DEMAND_SOURCE,
  type ServiceSearchDemandQueryRow,
} from "./serviceSearchDemandModel.ts";

export const DATAFORSEO_SEARCH_VOLUME_ENDPOINT =
  "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live";

/** Indicative USD→GBP for Google Ads CPC (DataForSEO returns USD). */
export const GOOGLE_ADS_USD_TO_GBP = 0.79;

/** Google Ads volumes at or below this are treated as hyper-local / unsmoothed. */
export const LOW_VOLUME_THRESHOLD = 50;

export const CATCHMENT_POPULATION_SOURCE = "modelled-ons-scale-ward-estimates";

/**
 * ONS-scale ward / locality populations for Barnsley catchments.
 * Used only to estimate local clinical inquiries when Ads returns 0/low volume.
 */
export const CATCHMENT_POPULATION_ESTIMATES: Record<string, number> = {
  hoyland: 12300,
  wombwell: 11500,
  penistone: 11300,
  cudworth: 10900,
  darfield: 10200,
  royston: 10700,
  worsbrough: 9000,
  goldthorpe: 9200,
  grimethorpe: 7400,
  silkstone: 3100,
  barnsley: 18900,
  broomhall: 6200,
  "devonshire quarter": 4800,
  "devonshire-quarter": 4800,
  moorfoot: 4100,
  sharrow: 5400,
  highfield: 4600,
  netherthorpe: 3900,
  broomhill: 5100,
  "nether edge": 4700,
  "nether-edge": 4700,
  "kelham island": 3200,
  "kelham-island": 3200,
  "sharrow vale": 3000,
  "sharrow-vale": 3000,
};

export type NhsIncidenceBand = { low: number; high: number };

/** Monthly NHS / clinical inquiry rates as a share of catchment population. */
export const NHS_MONTHLY_INCIDENCE: Record<string, NhsIncidenceBand> = {
  "pharmacy-first": { low: 0.0035, high: 0.0055 },
  "minor-ailments": { low: 0.003, high: 0.005 },
  "blood-pressure-checks": { low: 0.002, high: 0.0035 },
  "flu-vaccinations": { low: 0.006, high: 0.01 },
  "travel-vaccinations": { low: 0.0008, high: 0.0015 },
  "health-checks": { low: 0.0012, high: 0.0022 },
  "smoking-cessation": { low: 0.0006, high: 0.0012 },
  "weight-management": { low: 0.0008, high: 0.0016 },
  "weight-loss": { low: 0.00033, high: 0.00067 },
};

const DEFAULT_INCIDENCE: NhsIncidenceBand = { low: 0.001, high: 0.002 };

const CLUSTER_CLINICAL_QUERIES: Record<string, string[]> = {
  "pharmacy-first": [
    "ear infection treatment near me",
    "sore throat pharmacy",
    "uti prescription",
    "minor illness clinic",
    "sinusitis pharmacy",
    "impetigo treatment pharmacy",
    "shingles pharmacy first",
    "infected insect bite pharmacy",
  ],
  "minor-ailments": [
    "minor illness clinic",
    "sore throat pharmacy",
    "ear infection treatment near me",
  ],
  "blood-pressure-checks": [
    "nhs blood pressure check",
    "blood pressure test near me",
    "pharmacy blood pressure check",
  ],
  "flu-vaccinations": [
    "flu jab pharmacy",
    "walk in flu jab",
    "nhs flu vaccination",
  ],
  "travel-vaccinations": [
    "travel vaccination clinic",
    "travel jabs near me",
  ],
  "weight-loss": [...WEIGHT_LOSS_DEMAND_QUERIES],
};

export type CommercialDemandQuerySpec = {
  query: string;
  serviceId: string;
  intentGroup: "brand" | "clinical" | "local";
  localityIncluded: boolean;
};

export type CatchmentPopulationModel = {
  total: number;
  areas: Array<{ name: string; population: number }>;
  source: typeof CATCHMENT_POPULATION_SOURCE;
};

export type ServiceCommercialDemand = {
  serviceId: string;
  serviceName: string;
  queries: string[];
  ukSearchVolume: number | null;
  ukPeakQuery: string | null;
  averageCpcUsd: number | null;
  averageCpcGbp: number | null;
  competition: string | null;
  catchmentInquiriesLow: number | null;
  catchmentInquiriesHigh: number | null;
  localMonthlySearchesLow: number | null;
  localMonthlySearchesHigh: number | null;
  volumeSource: "dataforseo-google-ads" | "catchment-incidence" | "mixed" | "unavailable";
  demandConclusion: string;
};

export const NHS_PHARMACY_FIRST_CONDITION_DEMAND = [
  { id: "earache", name: "Earache", queries: ["ear infection treatment near me", "earache pharmacy"], needles: ["ear infection", "earache"], share: 0.14 },
  { id: "impetigo", name: "Impetigo", queries: ["impetigo treatment pharmacy", "impetigo pharmacy"], needles: ["impetigo"], share: 0.1 },
  { id: "insect-bites", name: "Infected Insect Bites", queries: ["infected insect bite pharmacy", "insect bite treatment pharmacy"], needles: ["insect bite"], share: 0.1 },
  { id: "shingles", name: "Shingles", queries: ["shingles pharmacy first", "shingles treatment pharmacy"], needles: ["shingles"], share: 0.08 },
  { id: "sinusitis", name: "Sinusitis", queries: ["sinusitis pharmacy", "sinus infection pharmacy"], needles: ["sinusitis", "sinus infection"], share: 0.16 },
  { id: "sore-throat", name: "Sore Throat", queries: ["sore throat pharmacy", "sore throat treatment pharmacy"], needles: ["sore throat"], share: 0.2 },
  { id: "uti", name: "Uncomplicated UTI", queries: ["uti prescription", "uti pharmacy"], needles: ["uti"], share: 0.22 },
] as const;

export type PharmacyFirstConditionDemandRow = {
  condition: string;
  monthlyCatchmentSearchesLow: number;
  monthlyCatchmentSearchesHigh: number;
  monthlyCatchmentSearches: string;
  paidSearchCpcGbp: number | null;
  paidSearchCpc: string;
  potentialMonthlyNhsValueLow: number;
  potentialMonthlyNhsValueHigh: number;
  potentialMonthlyNhsValue: string;
  cpcSource: "dataforseo-google-ads" | "pharmacy-first-benchmark";
  matchedQuery: string | null;
  ukSearchVolume: number | null;
};

export type CommercialClusterDemandOverlay = {
  slug: string;
  source: typeof SERVICE_SEARCH_DEMAND_SOURCE;
  generatedAt: string;
  locationCode: typeof SERVICE_SEARCH_DEMAND_LOCATION_CODE;
  languageCode: typeof SERVICE_SEARCH_DEMAND_LANGUAGE_CODE;
  queries: ServiceSearchDemandQueryRow[];
  requestCount: number;
  taskIds: string[];
  providerCost: number | null;
};

function clean(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function norm(value: unknown): string {
  return clean(value).toLowerCase();
}

function uniqueQueries(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = clean(raw);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function usdToGbp(usd: number | null): number | null {
  if (usd == null || !Number.isFinite(usd)) return null;
  return Math.round(usd * GOOGLE_ADS_USD_TO_GBP * 100) / 100;
}

export function nhsIncidenceRate(serviceId: string): NhsIncidenceBand {
  return NHS_MONTHLY_INCIDENCE[serviceId] || DEFAULT_INCIDENCE;
}

export function estimateCatchmentMonthlyInquiries(
  catchmentPopulation: number,
  incidence: NhsIncidenceBand,
): { low: number; high: number } {
  const pop = Math.max(0, catchmentPopulation);
  return {
    low: Math.round(pop * incidence.low),
    high: Math.round(pop * incidence.high),
  };
}

export function resolveCatchmentPopulation(slug: string): CatchmentPopulationModel {
  const profile = readSetupProfile(slug);
  const locality = resolveTenantLocality(profile);
  const names = uniqueQueries([
    ...(Array.isArray(profile.rankingAreas) ? profile.rankingAreas.map((row: unknown) => clean(row)) : []),
    ...(Array.isArray(profile.coverageAreas) ? profile.coverageAreas.map((row: unknown) => clean(row)) : []),
    clean(locality.value),
    clean(profile.primaryTown),
    clean(profile.townCity),
  ]);
  const areas: Array<{ name: string; population: number }> = [];
  const seen = new Set<string>();
  for (const name of names) {
    const key = norm(name);
    if (!key || seen.has(key)) continue;
    const population = CATCHMENT_POPULATION_ESTIMATES[key];
    if (!population) continue;
    seen.add(key);
    areas.push({ name, population });
  }
  return {
    total: areas.reduce((sum, row) => sum + row.population, 0),
    areas,
    source: CATCHMENT_POPULATION_SOURCE,
  };
}

export function commercialClusterDemandPath(slug: string): string {
  return path.join(
    WORKSPACE_ROOT,
    "data/growth-engine",
    `${safePharmacySlug(slug)}-commercial-cluster-demand.json`,
  );
}

export function readCommercialClusterDemandOverlay(slug: string): CommercialClusterDemandOverlay | null {
  const file = commercialClusterDemandPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as CommercialClusterDemandOverlay;
  } catch {
    return null;
  }
}

export function writeCommercialClusterDemandOverlay(overlay: CommercialClusterDemandOverlay): string {
  const file = commercialClusterDemandPath(overlay.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(overlay, null, 2));
  return file;
}

export function activeCampaignServiceIds(slug: string): string[] {
  const confirmed = readConfirmedServiceIds(slug);
  const active = new Set(ACTIVE_SERVICE_IDS);
  const selectedActive = confirmed.filter((id) => active.has(id));
  return selectedActive.length ? selectedActive : confirmed.filter((id) => Boolean(CLUSTER_CLINICAL_QUERIES[id]));
}

export function buildCommercialDemandQueries(input: {
  serviceId: string;
  slug?: string;
  town?: string;
  catchments?: string[];
}): CommercialDemandQuerySpec[] {
  const serviceId = clean(input.serviceId);
  if (!serviceId) return [];
  const town = clean(input.town);
  const catchments = (input.catchments || []).map(clean).filter(Boolean).slice(0, 3);
  const specs: CommercialDemandQuerySpec[] = [];
  const seen = new Set<string>();

  const push = (query: string, intentGroup: CommercialDemandQuerySpec["intentGroup"], localityIncluded: boolean) => {
    const value = clean(query);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return;
    seen.add(key);
    specs.push({ query: value, serviceId, intentGroup, localityIncluded });
  };

  for (const query of buildServiceSearchDemandQueries({
    serviceId,
    slug: input.slug,
    town,
  })) {
    push(query, "brand", false);
  }

  for (const query of CLUSTER_CLINICAL_QUERIES[serviceId] || []) {
    push(query, "clinical", false);
  }

  if (town) {
    if (serviceId === "pharmacy-first") {
      push(`pharmacy first ${town}`, "local", true);
      push(`minor illness clinic ${town}`, "local", true);
    } else {
      const canonical = buildServiceSearchDemandQueries({ serviceId })[0];
      if (canonical) push(`${canonical} ${town}`, "local", true);
    }
  }

  if (serviceId === "pharmacy-first") {
    for (const area of catchments) {
      push(`pharmacy first ${area}`, "local", true);
      push(`minor illness clinic ${area}`, "local", true);
    }
  }

  return specs.slice(0, 30);
}

function rowsForService(
  serviceId: string,
  artifactRows: ServiceSearchDemandQueryRow[],
  overlayRows: ServiceSearchDemandQueryRow[],
): ServiceSearchDemandQueryRow[] {
  const byQuery = new Map<string, ServiceSearchDemandQueryRow>();
  for (const row of [...artifactRows, ...overlayRows.filter((r) => r.serviceId === serviceId)]) {
    const key = norm(row.query);
    if (!key) continue;
    const prior = byQuery.get(key);
    if (!prior || (row.searchVolume || 0) > (prior.searchVolume || 0)) {
      byQuery.set(key, row);
    }
  }
  return [...byQuery.values()];
}

function peakUkVolume(rows: ServiceSearchDemandQueryRow[]): {
  volume: number | null;
  query: string | null;
  competition: string | null;
  cpcUsd: number | null;
} {
  let volume: number | null = null;
  let query: string | null = null;
  let competition: string | null = null;
  let cpcUsd: number | null = null;
  for (const row of rows) {
    if (row.searchVolume == null || !Number.isFinite(row.searchVolume)) continue;
    if (volume == null || row.searchVolume > volume) {
      volume = row.searchVolume;
      query = row.query;
      competition = row.competition;
      cpcUsd = row.cpc != null && Number.isFinite(row.cpc) && row.cpc > 0 ? row.cpc : null;
    }
  }
  return { volume, query, competition, cpcUsd };
}

function averageCpcUsd(rows: ServiceSearchDemandQueryRow[]): number | null {
  return mean(
    rows
      .map((row) => row.cpc)
      .filter((value): value is number => value != null && Number.isFinite(value) && value > 0),
  );
}

function formatDemandConclusion(input: {
  serviceName: string;
  ukSearchVolume: number | null;
  ukPeakQuery: string | null;
  localLow: number | null;
  localHigh: number | null;
  cpcGbp: number | null;
  volumeSource: ServiceCommercialDemand["volumeSource"];
}): string {
  if (input.volumeSource === "unavailable") {
    return `${input.serviceName} has no stored DataForSEO volume and no catchment model to estimate local demand.`;
  }
  const parts: string[] = [];
  if (input.ukSearchVolume != null && input.ukPeakQuery) {
    parts.push(
      `UK Google Ads peak “${input.ukPeakQuery}” ${input.ukSearchVolume.toLocaleString("en-GB")}/mo`,
    );
  }
  if (input.localLow != null && input.localHigh != null) {
    parts.push(
      `local catchment ${input.localLow.toLocaleString("en-GB")} – ${input.localHigh.toLocaleString("en-GB")} potential patient searches/mo`,
    );
  }
  if (input.cpcGbp != null) {
    parts.push(`avg CPC £${input.cpcGbp.toFixed(2)}`);
  }
  return parts.join(" · ");
}

function matchConditionRow(
  needles: readonly string[],
  rows: ServiceSearchDemandQueryRow[],
): ServiceSearchDemandQueryRow | null {
  const hits = rows.filter((row) => {
    const query = norm(row.query);
    return needles.some((needle) => query.includes(needle));
  });
  if (!hits.length) return null;
  return [...hits].sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0))[0] || null;
}

export function buildPharmacyFirstConditionBreakdown(slug: string): PharmacyFirstConditionDemandRow[] {
  const demand = readPharmacyCommercialDemand(slug);
  const pf = demand.services.find((row) => row.serviceId === "pharmacy-first");
  const localLow = pf?.localMonthlySearchesLow ?? 0;
  const localHigh = pf?.localMonthlySearchesHigh ?? 0;
  const fallbackCpc = pf?.averageCpcGbp ?? null;
  const artifact = readServiceSearchDemandArtifact(slug);
  const overlay = readCommercialClusterDemandOverlay(slug);
  const rows = rowsForService(
    "pharmacy-first",
    artifact?.demandByService?.["pharmacy-first"]?.queries || [],
    overlay?.queries || [],
  );

  return NHS_PHARMACY_FIRST_CONDITION_DEMAND.map((condition) => {
    const matched = matchConditionRow(condition.needles, rows);
    const matchedCpcGbp = usdToGbp(matched?.cpc != null && matched.cpc > 0 ? matched.cpc : null);
    const cpcGbp = matchedCpcGbp ?? fallbackCpc;
    const cpcSource: PharmacyFirstConditionDemandRow["cpcSource"] =
      matchedCpcGbp != null ? "dataforseo-google-ads" : "pharmacy-first-benchmark";
    const searchesLow = Math.round(localLow * condition.share);
    const searchesHigh = Math.round(localHigh * condition.share);
    const valueLow = Math.round(condition.share * 15 * 15);
    const valueHigh = Math.round(condition.share * 25 * 15);
    return {
      condition: condition.name,
      monthlyCatchmentSearchesLow: searchesLow,
      monthlyCatchmentSearchesHigh: searchesHigh,
      monthlyCatchmentSearches:
        localLow > 0
          ? `${searchesLow.toLocaleString("en-GB")} – ${searchesHigh.toLocaleString("en-GB")}`
          : "Not modelled",
      paidSearchCpcGbp: cpcGbp,
      paidSearchCpc: cpcGbp != null ? `£${cpcGbp.toFixed(2)}` : "Not stored",
      potentialMonthlyNhsValueLow: valueLow,
      potentialMonthlyNhsValueHigh: valueHigh,
      potentialMonthlyNhsValue: `${gbpRange(valueLow, valueHigh)}`,
      cpcSource,
      matchedQuery: matched?.query || null,
      ukSearchVolume: matched?.searchVolume ?? null,
    };
  });
}

function gbpRange(low: number, high: number): string {
  return `£${low.toLocaleString("en-GB")} – £${high.toLocaleString("en-GB")}`;
}

export function buildServiceCommercialDemand(input: {
  slug: string;
  serviceId: string;
  serviceName?: string;
  town?: string;
  catchments?: string[];
  catchmentPopulation: number;
}): ServiceCommercialDemand {
  const serviceId = input.serviceId;
  const serviceName = input.serviceName || activeServiceLabel(serviceId);
  const artifact = readServiceSearchDemandArtifact(input.slug);
  const overlay = readCommercialClusterDemandOverlay(input.slug);
  const artifactEntry = artifact?.demandByService?.[serviceId];
  const overlayRows = overlay?.queries || [];
  const rows = rowsForService(serviceId, artifactEntry?.queries || [], overlayRows);
  const peak = peakUkVolume(rows);
  const cpcUsd = peak.cpcUsd ?? averageCpcUsd(rows);
  const cpcGbp = usdToGbp(cpcUsd);
  const incidence = nhsIncidenceRate(serviceId);
  const catchment =
    input.catchmentPopulation > 0
      ? estimateCatchmentMonthlyInquiries(input.catchmentPopulation, incidence)
      : { low: 0, high: 0 };
  const hasAds = peak.volume != null;
  const hasCatchment = input.catchmentPopulation > 0 && (catchment.low > 0 || catchment.high > 0);
  const adsTooLow = peak.volume == null || peak.volume <= LOW_VOLUME_THRESHOLD;

  let localLow: number | null = null;
  let localHigh: number | null = null;
  let volumeSource: ServiceCommercialDemand["volumeSource"] = "unavailable";

  if (hasCatchment && (adsTooLow || !hasAds)) {
    localLow = catchment.low;
    localHigh = catchment.high;
    volumeSource = hasAds ? "mixed" : "catchment-incidence";
  } else if (hasAds && !adsTooLow && hasCatchment) {
    localLow = catchment.low;
    localHigh = catchment.high;
    volumeSource = "mixed";
  } else if (hasAds) {
    volumeSource = "dataforseo-google-ads";
  }

  const clusterQueries = buildCommercialDemandQueries({
    serviceId,
    slug: input.slug,
    town: input.town,
    catchments: input.catchments,
  }).map((spec) => spec.query);

  return {
    serviceId,
    serviceName,
    queries: clusterQueries,
    ukSearchVolume: peak.volume,
    ukPeakQuery: peak.query,
    averageCpcUsd: cpcUsd == null ? null : Math.round(cpcUsd * 100) / 100,
    averageCpcGbp: cpcGbp,
    competition: peak.competition,
    catchmentInquiriesLow: hasCatchment ? catchment.low : null,
    catchmentInquiriesHigh: hasCatchment ? catchment.high : null,
    localMonthlySearchesLow: localLow,
    localMonthlySearchesHigh: localHigh,
    volumeSource,
    demandConclusion: formatDemandConclusion({
      serviceName,
      ukSearchVolume: peak.volume,
      ukPeakQuery: peak.query,
      localLow,
      localHigh,
      cpcGbp,
      volumeSource,
    }),
  };
}

export function readPharmacyCommercialDemand(slug: string): {
  slug: string;
  town: string;
  catchment: CatchmentPopulationModel;
  artifactGeneratedAt: string | null;
  overlayGeneratedAt: string | null;
  hasStoredDemand: boolean;
  services: ServiceCommercialDemand[];
} {
  const profile = readSetupProfile(slug);
  const locality = resolveTenantLocality(profile);
  const town = clean(locality.value || profile.primaryTown || profile.townCity);
  const catchment = resolveCatchmentPopulation(slug);
  const artifact = readServiceSearchDemandArtifact(slug);
  const overlay = readCommercialClusterDemandOverlay(slug);
  const confirmed = readConfirmedServiceIds(slug);
  const campaignIds = activeCampaignServiceIds(slug);
  const ordered = uniqueQueries([...campaignIds, ...confirmed]);
  const catchments = catchment.areas.map((row) => row.name);

  const services = ordered.map((serviceId) =>
    buildServiceCommercialDemand({
      slug,
      serviceId,
      serviceName: activeServiceLabel(serviceId),
      town,
      catchments,
      catchmentPopulation: catchment.total,
    }),
  );

  return {
    slug: safePharmacySlug(slug),
    town,
    catchment,
    artifactGeneratedAt: artifact?.generatedAt || null,
    overlayGeneratedAt: overlay?.generatedAt || null,
    hasStoredDemand: Boolean(artifact || overlay),
    services,
  };
}

export async function collectCommercialClusterSearchVolume(
  slugInput: string,
  options: { force?: boolean } = {},
): Promise<{
  slug: string;
  overlayPath: string | null;
  reused: boolean;
  configured: boolean;
  keywordCount: number;
  error: string | null;
}> {
  const slug = safePharmacySlug(slugInput);
  const existing = readCommercialClusterDemandOverlay(slug);
  if (existing && !options.force) {
    return {
      slug,
      overlayPath: commercialClusterDemandPath(slug),
      reused: true,
      configured: isDataForSeoConfigured(),
      keywordCount: existing.queries.length,
      error: null,
    };
  }
  if (!isDataForSeoConfigured()) {
    return {
      slug,
      overlayPath: existing ? commercialClusterDemandPath(slug) : null,
      reused: Boolean(existing),
      configured: false,
      keywordCount: existing?.queries.length || 0,
      error: "DataForSEO credentials unavailable",
    };
  }

  const demand = readPharmacyCommercialDemand(slug);
  const batches = demand.services.map((service) => ({
    serviceId: service.serviceId,
    queries: service.queries,
  }));
  const keywords = uniqueQueries(batches.flatMap((batch) => batch.queries));
  if (!keywords.length) {
    return {
      slug,
      overlayPath: null,
      reused: false,
      configured: true,
      keywordCount: 0,
      error: "No commercial cluster queries to collect",
    };
  }

  try {
    const live = await postGoogleAdsSearchVolumeLive(keywords);
    const capturedAt = new Date().toISOString();
    const rows: ServiceSearchDemandQueryRow[] = [];
    for (const batch of batches) {
      const parsed = parseSearchVolumeLiveResponse({
        serviceId: batch.serviceId,
        requestedKeywords: batch.queries,
        payload: live.payload,
        capturedAt,
      });
      rows.push(...parsed.rows);
    }
    const overlayPath = writeCommercialClusterDemandOverlay({
      slug,
      source: SERVICE_SEARCH_DEMAND_SOURCE,
      generatedAt: capturedAt,
      locationCode: SERVICE_SEARCH_DEMAND_LOCATION_CODE,
      languageCode: SERVICE_SEARCH_DEMAND_LANGUAGE_CODE,
      queries: rows,
      requestCount: 1,
      taskIds: live.taskId ? [live.taskId] : [],
      providerCost: live.cost > 0 ? live.cost : null,
    });
    return {
      slug,
      overlayPath,
      reused: false,
      configured: true,
      keywordCount: keywords.length,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      slug,
      overlayPath: existing ? commercialClusterDemandPath(slug) : null,
      reused: Boolean(existing),
      configured: true,
      keywordCount: keywords.length,
      error: message.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]"),
    };
  }
}
