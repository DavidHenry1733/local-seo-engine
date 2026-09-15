/**
 * Shared competitor-analysis DataForSEO organic-search runner.
 *
 * Invoked by orchestrate_competitor_analysis alongside Google Places.
 * Reuses the existing DataForSEO Google organic adapter and national
 * competitor-discovery artifact. Does not create a second provider,
 * job, or storage system.
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { resolveTenantLocality } from "./masterAdminPrimaryLocalityService.ts";
import { buildSearchIntelligenceCampaignQueries } from "./searchIntelligenceCampaignInputs.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { readConfirmedServiceIds } from "./serviceSearchDemandService.ts";
import {
  isDataForSeoConfigured,
  searchNationalGoogleOrganic,
} from "./dataForSeoNationalSearchAdapter.ts";
import {
  emptyNationalCompetitorDiscoveryResult,
  type NationalCompetitorDiscoveryCandidate,
  type NationalCompetitorDiscoveryQuery,
  type NationalCompetitorDiscoveryResult,
  type OrganicSearchCompetitorEvidence,
  type OrganicSearchCompetitorRun,
  type CompetitorAnalysisProviderStatus,
} from "./nationalCompetitorDiscoveryModel.ts";
import {
  readNationalCompetitorDiscovery,
  writeNationalCompetitorDiscovery,
} from "./nationalCompetitorDiscoveryStorageService.ts";

export const ORGANIC_SEARCH_PROVIDER_ID = "dataforseo-google-organic-live" as const;
export const ORGANIC_RESULT_LIMIT = 10;
export const ORGANIC_QUERY_LIMIT = 4;
export const ORGANIC_SERP_DEPTH = 10;
export const ORGANIC_MARKET_COUNTRY = "United Kingdom";
export const ORGANIC_LANGUAGE_CODE = "en";

export interface OrganicSearchProviderResult {
  status: CompetitorAnalysisProviderStatus;
  configured: boolean;
  generated: boolean;
  error: string | null;
  queryLimitation: string | null;
  competitorCount: number;
  queries: string[];
  artifactPath: string | null;
}

function clean(value: unknown): string {
  return String(value || "").trim();
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = clean(raw).replace(/\s+/g, " ");
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function canonicalHost(raw: unknown): string {
  const text = clean(raw)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  return text;
}

function freshnessLabel(capturedAt: string): string {
  const then = Date.parse(capturedAt);
  if (!Number.isFinite(then)) return "Unknown";
  const hours = Math.max(0, (Date.now() - then) / 36e5);
  if (hours < 24) return "Fresh";
  if (hours < 168) return "Recent";
  return "Stored";
}

export function readOrganicSearchRun(slug: string, serviceId?: string | null): OrganicSearchCompetitorRun | null {
  const discovery = readNationalCompetitorDiscovery(slug);
  const scopedId = clean(serviceId);
  if (scopedId && discovery?.organicSearchByService?.[scopedId]) {
    return discovery.organicSearchByService[scopedId];
  }
  if (discovery?.organicSearch) return discovery.organicSearch;
  if (!discovery) return null;
  const rows = discovery.qualifiedCompetitors || [];
  if (!rows.length) return null;
  return {
    provider: ORGANIC_SEARCH_PROVIDER_ID,
    status: discovery.status === "complete" ? "completed" : discovery.status === "failed" ? "failed" : "completed",
    configured: isDataForSeoConfigured(),
    generated: rows.length > 0,
    error: discovery.errors?.[0] || null,
    queryLimitation: null,
    locationName: discovery.marketCountry || ORGANIC_MARKET_COUNTRY,
    languageCode: ORGANIC_LANGUAGE_CODE,
    taskIds: [],
    queries: (discovery.queries || []).map((q) => q.query).filter(Boolean),
    competitors: rows.map((c) => ({
      domain: c.domain || canonicalHost(c.websiteUrl),
      host: canonicalHost(c.domain || c.websiteUrl),
      url: c.websiteUrl || (c.evidenceUrls && c.evidenceUrls[0]) || "",
      position: null,
      matchedQuery: c.sourceQuery || "",
      title: c.title || c.name || "",
      description: c.description || "",
      overlapEvidence: (c.qualificationReasons || []).join("; ") || "Stored DataForSEO organic-search competitor",
      capturedAt: c.capturedAt || discovery.generatedAt,
      provider: ORGANIC_SEARCH_PROVIDER_ID,
      locationName: discovery.marketCountry || ORGANIC_MARKET_COUNTRY,
      languageCode: ORGANIC_LANGUAGE_CODE,
      taskId: null,
      provenance: discovery.source || "national-competitor-discovery-v1",
      freshness: freshnessLabel(c.capturedAt || discovery.generatedAt),
    })),
    capturedAt: discovery.generatedAt || null,
  };
}

export function hasReliableOrganicSearchResults(slug: string): boolean {
  const run = readOrganicSearchRun(slug);
  return Boolean(run?.generated && (run.competitors?.length || 0) > 0 && run.status !== "failed" && run.status !== "no_reliable_results");
}

function persistOrganicRun(
  slug: string,
  run: OrganicSearchCompetitorRun,
  queries: NationalCompetitorDiscoveryQuery[],
  errors: string[],
  options?: { serviceId?: string | null },
): string {
  const capturedAt = run.capturedAt || new Date().toISOString();
  const existing = readNationalCompetitorDiscovery(slug);
  const serviceId = clean(options?.serviceId);
  const byService: Record<string, OrganicSearchCompetitorRun> = {
    ...(existing?.organicSearchByService || {}),
  };

  // Preserve a prior Pharmacy First–scoped run when collecting a different service.
  if (existing?.organicSearch && serviceId && serviceId !== "pharmacy-first") {
    const prevQueries = existing.organicSearch.queries || [];
    const prevIsPharmacyFirst = prevQueries.some((q) => /pharmacy first/i.test(q));
    if (prevIsPharmacyFirst && !byService["pharmacy-first"]) {
      byService["pharmacy-first"] = existing.organicSearch;
    }
  }
  if (serviceId) {
    byService[serviceId] = run;
  }

  const result: NationalCompetitorDiscoveryResult = {
    ...(existing || emptyNationalCompetitorDiscoveryResult(slug, run.locationName, "organic-search competitors")),
    generatedAt: capturedAt,
    queries,
    candidates: existing?.candidates || [],
    qualifiedCompetitors: run.competitors.map((c, index): NationalCompetitorDiscoveryCandidate => ({
      id: `organic-${index + 1}-${c.host || c.domain}`,
      name: c.title || c.domain,
      domain: c.domain,
      websiteUrl: c.url,
      marketCountry: run.locationName,
      targetCustomerMarket: "organic-search competitors",
      source: "search-engine",
      sourceQuery: c.matchedQuery || null,
      qualification: "qualified",
      qualificationReasons: [c.overlapEvidence],
      rejectionReasons: [],
      serviceEvidence: [],
      title: c.title || null,
      description: c.description || null,
      evidenceUrls: c.url ? [c.url] : [],
      capturedAt: c.capturedAt,
    })),
    rejectedCandidates: existing?.rejectedCandidates || [],
    status:
      run.status === "completed"
        ? "complete"
        : run.status === "no_reliable_results"
          ? "insufficient-evidence"
          : run.status === "not_configured"
            ? "draft"
            : "failed",
    errors,
    organicSearch: run,
    organicSearchByService: Object.keys(byService).length ? byService : undefined,
  };
  return writeNationalCompetitorDiscovery(result);
}

export interface OrganicSearchDemandRow {
  query: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  unavailableReason: string | null;
}

/**
 * Bounded organic-search collection for an explicit query list.
 * Reuses the shared DataForSEO Google Organic Live adapter and shared discovery artifact.
 * Does not call Google Places or invent search volume/CPC.
 */
export async function runOrganicSearchForExplicitQueries(
  slug: string,
  queriesInput: string[],
  options?: { serviceId?: string | null; serviceIntent?: string | null },
): Promise<OrganicSearchProviderResult & { demand: OrganicSearchDemandRow[]; requestCount: number }> {
  const capturedAt = new Date().toISOString();
  const queries = unique(queriesInput);
  const serviceId = clean(options?.serviceId);
  const serviceIntent = clean(options?.serviceIntent) || serviceId || "canonical customer evidence";
  const profile = readSetupProfile(slug);
  const websiteHost = canonicalHost(profile.website);

  const baseRun = (): OrganicSearchCompetitorRun => ({
    provider: ORGANIC_SEARCH_PROVIDER_ID,
    status: "configured",
    configured: isDataForSeoConfigured(),
    generated: false,
    error: null,
    queryLimitation: null,
    locationName: ORGANIC_MARKET_COUNTRY,
    languageCode: ORGANIC_LANGUAGE_CODE,
    taskIds: [],
    queries,
    competitors: [],
    capturedAt,
  });

  if (!isDataForSeoConfigured()) {
    const run = { ...baseRun(), status: "not_configured" as const, configured: false, error: "DataForSEO is not configured" };
    const path = persistOrganicRun(slug, run, [], [run.error!], { serviceId });
    return {
      status: "not_configured",
      configured: false,
      generated: false,
      error: run.error,
      queryLimitation: null,
      competitorCount: 0,
      queries,
      artifactPath: path,
      demand: queries.map((query) => ({
        query,
        searchVolume: null,
        cpc: null,
        competition: null,
        unavailableReason: "DataForSEO is not configured",
      })),
      requestCount: 0,
    };
  }

  if (!queries.length) {
    const limitation = "No explicit organic-search queries were supplied.";
    const run: OrganicSearchCompetitorRun = {
      ...baseRun(),
      status: "no_reliable_results",
      queryLimitation: limitation,
      error: limitation,
    };
    const path = persistOrganicRun(slug, run, [], [limitation], { serviceId });
    return {
      status: "no_reliable_results",
      configured: true,
      generated: false,
      error: limitation,
      queryLimitation: limitation,
      competitorCount: 0,
      queries: [],
      artifactPath: path,
      demand: [],
      requestCount: 0,
    };
  }

  const queryRecords: NationalCompetitorDiscoveryQuery[] = queries.map((query, index) => ({
    id: `organic-query-${String(index + 1).padStart(2, "0")}`,
    query,
    marketCountry: ORGANIC_MARKET_COUNTRY,
    targetCustomerMarket: "organic-search competitors",
    serviceIntent,
    evidenceReason: "Explicit service-local organic-search evidence",
  }));

  const byDomain = new Map<string, OrganicSearchCompetitorEvidence>();
  const taskIds: string[] = [];
  const errors: string[] = [];
  let requestCount = 0;

  for (const query of queries) {
    try {
      requestCount += 1;
      const serp = await searchNationalGoogleOrganic({
        query,
        marketCountry: ORGANIC_MARKET_COUNTRY,
        languageCode: ORGANIC_LANGUAGE_CODE,
        depth: ORGANIC_SERP_DEPTH,
      });
      if (serp.taskId) taskIds.push(serp.taskId);
      for (const row of serp.results) {
        const host = canonicalHost(row.domain || row.url);
        if (!host || host === websiteHost) continue;
        const previous = byDomain.get(host);
        const position = Number.isFinite(row.position) ? row.position : null;
        if (previous && (previous.position ?? 999) <= (position ?? 999)) continue;
        byDomain.set(host, {
          domain: host,
          host,
          url: row.url,
          position,
          matchedQuery: query,
          title: row.title || "",
          description: row.description || "",
          overlapEvidence: `Organic-search visibility for query "${query}" at position ${position ?? "unavailable"}. Not verified as a nearby physical pharmacy.`,
          capturedAt: serp.capturedAt || capturedAt,
          provider: ORGANIC_SEARCH_PROVIDER_ID,
          locationName: serp.marketCountry || ORGANIC_MARKET_COUNTRY,
          languageCode: serp.languageCode || ORGANIC_LANGUAGE_CODE,
          taskId: serp.taskId || null,
          provenance: ORGANIC_SEARCH_PROVIDER_ID,
          freshness: freshnessLabel(serp.capturedAt || capturedAt),
        });
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const competitors = [...byDomain.values()]
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .slice(0, ORGANIC_RESULT_LIMIT);

  let status: CompetitorAnalysisProviderStatus = "completed";
  if (errors.length && !competitors.length) status = "failed";
  else if (errors.length && competitors.length) status = "partial";
  else if (!competitors.length) status = "no_reliable_results";

  const error =
    status === "failed" || status === "partial"
      ? unique(errors).join(" | ")
      : status === "no_reliable_results"
        ? "DataForSEO returned no reliable organic-search visibility rows for the supplied queries."
        : null;

  const run: OrganicSearchCompetitorRun = {
    ...baseRun(),
    status,
    configured: true,
    generated: competitors.length > 0 && status !== "failed",
    error,
    queryLimitation: null,
    taskIds: unique(taskIds),
    queries,
    competitors,
    capturedAt,
  };
  const path = persistOrganicRun(slug, run, queryRecords, errors, { serviceId });
  const demand: OrganicSearchDemandRow[] = queries.map((query) => ({
    query,
    searchVolume: null,
    cpc: null,
    competition: null,
    unavailableReason:
      "DataForSEO Google Organic Live returns visibility rows only; search volume/CPC/competition were not returned for these queries.",
  }));

  return {
    status,
    configured: true,
    generated: Boolean(run.generated),
    error,
    queryLimitation: null,
    competitorCount: competitors.length,
    queries,
    artifactPath: path,
    demand,
    requestCount,
  };
}

function resolveOrganicSearchServiceId(slug: string): string | null {
  return readActiveServiceCampaignSelection(slug)?.serviceId || readConfirmedServiceIds(slug)[0] || null;
}

export function buildCompetitorAnalysisOrganicQueries(slug: string): {
  queries: string[];
  limitation: string | null;
  pharmacyName: string;
  town: string;
  postcode: string;
  websiteHost: string;
  serviceTerms: string[];
} {
  const profile = readSetupProfile(slug);
  const locality = resolveTenantLocality(profile);
  const pharmacyName = clean(profile.pharmacyName || profile.tradingName);
  const town = clean(locality.value || profile.primaryTown || profile.townCity);
  const postcode = clean(profile.postcode);
  const websiteHost = canonicalHost(profile.website);
  const serviceId = resolveOrganicSearchServiceId(slug);
  const campaign = serviceId
    ? buildSearchIntelligenceCampaignQueries({
        serviceId,
        pharmacyName,
        town,
        postcode,
      })
    : { serviceId: "", serviceName: "", demandQueries: [], organicQueries: [] };
  const serviceTerms = campaign.serviceName ? [campaign.serviceName] : [];
  const queries = campaign.organicQueries;

  let limitation: string | null = null;
  if (!queries.length) {
    limitation =
      "Canonical pharmacy name, locality and service/search terms are unavailable. DataForSEO queries were not invented.";
  } else if (!serviceTerms.length) {
    limitation =
      "Canonical service/search terms are unavailable. Queries used confirmed pharmacy name and locality only.";
  }
  return { queries, limitation, pharmacyName, town, postcode, websiteHost, serviceTerms };
}

export async function runOrganicSearchCompetitorDiscovery(slug: string): Promise<OrganicSearchProviderResult> {
  const capturedAt = new Date().toISOString();
  const baseRun = (): OrganicSearchCompetitorRun => ({
    provider: ORGANIC_SEARCH_PROVIDER_ID,
    status: "configured",
    configured: isDataForSeoConfigured(),
    generated: false,
    error: null,
    queryLimitation: null,
    locationName: ORGANIC_MARKET_COUNTRY,
    languageCode: ORGANIC_LANGUAGE_CODE,
    taskIds: [],
    queries: [],
    competitors: [],
    capturedAt,
  });

  if (!isDataForSeoConfigured()) {
    const existing = readOrganicSearchRun(slug);
    if (existing && (existing.competitors?.length || 0) > 0) {
      return {
        status: "not_configured",
        configured: false,
        generated: existing.generated,
        error: "DataForSEO is not configured",
        queryLimitation: existing.queryLimitation,
        competitorCount: existing.competitors.length,
        queries: existing.queries,
        artifactPath: null,
      };
    }
    const run = { ...baseRun(), status: "not_configured" as const, configured: false, error: "DataForSEO is not configured" };
    const path = persistOrganicRun(slug, run, [], [run.error!]);
    return {
      status: "not_configured",
      configured: false,
      generated: false,
      error: run.error,
      queryLimitation: null,
      competitorCount: 0,
      queries: [],
      artifactPath: path,
    };
  }

  const evidence = buildCompetitorAnalysisOrganicQueries(slug);
  if (!evidence.queries.length) {
    const run: OrganicSearchCompetitorRun = {
      ...baseRun(),
      status: "no_reliable_results",
      queryLimitation: evidence.limitation,
      error: evidence.limitation,
    };
    const path = persistOrganicRun(slug, run, [], [evidence.limitation || "No canonical query evidence"]);
    return {
      status: "no_reliable_results",
      configured: true,
      generated: false,
      error: evidence.limitation,
      queryLimitation: evidence.limitation,
      competitorCount: 0,
      queries: [],
      artifactPath: path,
    };
  }

  const queryRecords: NationalCompetitorDiscoveryQuery[] = evidence.queries.map((query, index) => ({
    id: `organic-query-${String(index + 1).padStart(2, "0")}`,
    query,
    marketCountry: ORGANIC_MARKET_COUNTRY,
    targetCustomerMarket: "organic-search competitors",
    serviceIntent: evidence.serviceTerms[0] || evidence.pharmacyName || "canonical customer evidence",
    evidenceReason: evidence.limitation || "Canonical stored customer evidence",
  }));

  const byDomain = new Map<string, OrganicSearchCompetitorEvidence>();
  const taskIds: string[] = [];
  const errors: string[] = [];

  for (const query of evidence.queries) {
    try {
      const serp = await searchNationalGoogleOrganic({
        query,
        marketCountry: ORGANIC_MARKET_COUNTRY,
        languageCode: ORGANIC_LANGUAGE_CODE,
        depth: ORGANIC_SERP_DEPTH,
      });
      if (serp.taskId) taskIds.push(serp.taskId);
      for (const row of serp.results) {
        const host = canonicalHost(row.domain || row.url);
        if (!host || host === evidence.websiteHost) continue;
        const previous = byDomain.get(host);
        const position = Number.isFinite(row.position) ? row.position : null;
        if (previous && (previous.position ?? 999) <= (position ?? 999)) continue;
        byDomain.set(host, {
          domain: host,
          host,
          url: row.url,
          position,
          matchedQuery: query,
          title: row.title || "",
          description: row.description || "",
          overlapEvidence: `Organic-search competitor for query "${query}" at position ${position ?? "unknown"}. Not verified as a nearby physical pharmacy.`,
          capturedAt: serp.capturedAt || capturedAt,
          provider: ORGANIC_SEARCH_PROVIDER_ID,
          locationName: serp.marketCountry || ORGANIC_MARKET_COUNTRY,
          languageCode: serp.languageCode || ORGANIC_LANGUAGE_CODE,
          taskId: serp.taskId || null,
          provenance: ORGANIC_SEARCH_PROVIDER_ID,
          freshness: freshnessLabel(serp.capturedAt || capturedAt),
        });
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const competitors = [...byDomain.values()]
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .slice(0, ORGANIC_RESULT_LIMIT);

  let status: CompetitorAnalysisProviderStatus = "completed";
  if (errors.length && !competitors.length) status = "failed";
  else if (errors.length && competitors.length) status = "partial";
  else if (!competitors.length) status = "no_reliable_results";

  const error =
    status === "failed" || status === "partial"
      ? unique(errors).join(" | ")
      : status === "no_reliable_results"
        ? "DataForSEO returned no reliable organic-search competitors for the canonical queries."
        : null;

  const run: OrganicSearchCompetitorRun = {
    ...baseRun(),
    status,
    configured: true,
    generated: competitors.length > 0 && status !== "failed",
    error,
    queryLimitation: evidence.limitation,
    taskIds: unique(taskIds),
    queries: evidence.queries,
    competitors,
    capturedAt,
  };
  const path = persistOrganicRun(slug, run, queryRecords, errors);
  return {
    status,
    configured: true,
    generated: Boolean(run.generated),
    error,
    queryLimitation: evidence.limitation,
    competitorCount: competitors.length,
    queries: evidence.queries,
    artifactPath: path,
  };
}
