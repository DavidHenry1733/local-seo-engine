/**
 * NI-03B — Explicit National Search Intelligence collection and persisted reads.
 * GET/render paths must call readNationalSearchIntelligence only.
 * Live DataForSEO runs only from collectNationalSearchIntelligence.
 */
import fs from "node:fs";

import {
  DATAFORSEO_LABS_ENDPOINTS,
  getDomainRankedKeywordsWithCost,
} from "./dataForSeoRankedKeywordIntelligenceService.ts";
import { DATAFORSEO_SERP_ENDPOINT, executeNationalGoogleOrganic } from "./dataForSeoNationalSearchAdapter.ts";
import { isDataForSeoTransportTimeout } from "./dataForSeoHttp.ts";
import { buildNationalCompetitorDiscoveryQueries } from "./nationalCompetitorDiscoveryQueryService.ts";
import { qualifyNationalCompetitorV2 } from "./nationalCompetitorQualificationV2Service.ts";
import { resolveNationalIntelligenceSubject } from "./nationalIntelligenceSubjectResolver.ts";
import {
  authorityFromProvenance,
  buildProvenance,
  evidenceSourceFromSnapshot,
  type NationalEvidenceSourceType,
} from "./nationalIntelligenceEvidenceProvenance.ts";
import { buildCostLedgerFromEndpoints } from "./nationalIntelligenceCostLedger.ts";
import {
  ensureNationalIntelligenceDataDir,
  isNationalIntelligenceFixturePath,
  nationalIntelligenceDataPath,
  resolveNationalIntelligenceArtifactPath,
} from "./nationalIntelligenceStorageService.ts";
import {
  NI03B_LIMITS,
  NATIONAL_SEARCH_INTELLIGENCE_VERSION,
  PARTIAL_COLLECTION_CUSTOMER_MESSAGE,
  isUsableNationalSearchIntelligenceStatus,
  type NationalCustomerRankingKeyword,
  type NationalOrganicSearchCompetitor,
  type NationalSearchIntelligenceSnapshot,
} from "./nationalSearchIntelligenceV1Model.ts";
import { writeNationalCompetitorDiscovery } from "./nationalCompetitorDiscoveryStorageService.ts";
import { emptyNationalCompetitorDiscoveryResult } from "./nationalCompetitorDiscoveryModel.ts";
import { resolveDataForSeoSearchLocationFromSubject } from "./dataForSeoSearchLocationResolver.ts";

const SERP_ENDPOINT = DATAFORSEO_SERP_ENDPOINT;

const inFlight = new Map<string, Promise<NationalSearchIntelligenceSnapshot>>();

export type NationalSearchIntelligenceProgressEvent =
  | { type: "ranked_start" }
  | { type: "ranked_complete"; rows: number; cost: number }
  | { type: "ranked_failed"; timedOut: boolean; message: string }
  | { type: "serp_start"; index: number; total: number; query: string }
  | { type: "serp_retry"; index: number; total: number; query: string; statusCode: number | null }
  | { type: "serp_complete"; index: number; total: number; query: string; results: number; cost: number; retried: boolean }
  | { type: "serp_failed"; index: number; total: number; query: string; timedOut: boolean; statusCode: number | null; retried: boolean; cost: number };

export type NationalSearchIntelligenceProgress = (event: NationalSearchIntelligenceProgressEvent) => void;

function json<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function writeJson(file: string, value: unknown): void {
  ensureNationalIntelligenceDataDir();
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

export function hasDataForSeoCredentials(): boolean {
  const login = process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_API_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD || process.env.DATAFORSEO_API_PASSWORD;
  return Boolean(login && password);
}

export function nationalSearchIntelligencePath(slug: string): string {
  return nationalIntelligenceDataPath(slug, "search-intelligence-v1");
}

function summarise(
  keywords: NationalCustomerRankingKeyword[],
  competitors: NationalOrganicSearchCompetitor[],
): NationalSearchIntelligenceSnapshot["summary"] {
  const pages = new Set(keywords.map((row) => row.rankingUrl).filter(Boolean));
  const demandValues = keywords.map((row) => row.searchVolume).filter((value): value is number => typeof value === "number");
  return {
    rankingKeywordCount: keywords.length,
    top10Count: keywords.filter((row) => row.position != null && row.position <= 10).length,
    top20Count: keywords.filter((row) => row.position != null && row.position <= 20).length,
    rankingPageCount: pages.size,
    availableSearchDemand: demandValues.length ? demandValues.reduce((sum, value) => sum + value, 0) : null,
    organicCompetitorCount: competitors.length,
    directCompetitorCount: competitors.filter((row) => row.classification === "direct_competitor").length,
    adjacentCompetitorCount: competitors.filter((row) => row.classification === "adjacent_competitor").length,
    top10CountCalculated: true,
    top20CountCalculated: true,
    rankingPageCountCalculated: true,
    availableSearchDemandCalculated: true,
  };
}

function nextStage(): NationalSearchIntelligenceSnapshot["nextStage"] {
  return {
    title: "Compare competitor keyword universes",
    detail: "Next: compare competitor keyword universes and identify commercial search gaps. That work is not part of this screen.",
    implemented: false,
  };
}

function snapshotShell(input: {
  slug: string;
  liveExecution: boolean;
  fixture: boolean;
  recovered: boolean;
  status: NationalSearchIntelligenceSnapshot["status"];
  lastError: string | null;
  reusedExistingSnapshot: boolean;
  capturedAt?: string;
  keywords: NationalCustomerRankingKeyword[];
  competitors: NationalOrganicSearchCompetitor[];
  endpoints: NationalSearchIntelligenceSnapshot["endpoints"];
  serpAttempts?: NationalSearchIntelligenceSnapshot["serpAttempts"];
}): NationalSearchIntelligenceSnapshot {
  const subject = resolveNationalIntelligenceSubject(input.slug);
  const capturedAt = input.capturedAt || new Date().toISOString();
  const uncollected =
    input.status === "not_collected"
    || (input.status === "error" && !input.liveExecution && !input.fixture && !input.recovered);
  const evidenceSource = uncollected
    ? "FALLBACK"
    : evidenceSourceFromSnapshot({
      liveExecution: input.liveExecution,
      fixture: input.fixture,
      recovered: input.recovered,
    });
  const sourceSnapshot = uncollected ? null : nationalSearchIntelligencePath(subject.slug);
  const costLedger = buildCostLedgerFromEndpoints({
    tenantSlug: subject.slug,
    snapshotId: `search-intelligence-v1:${subject.slug}`,
    capturedAt,
    liveExecution: input.liveExecution,
    fixture: input.fixture,
    recovered: input.recovered,
    endpoints: input.endpoints,
    sourceSnapshot,
  });
  if (uncollected) {
    costLedger.evidenceSource = "FALLBACK";
    costLedger.entries = costLedger.entries.map((entry) => ({ ...entry, evidenceSource: "FALLBACK" }));
  }
  const provenance = buildProvenance({
    tenantSlug: subject.slug,
    subjectDomain: subject.subjectDomain,
    capturedAt,
    evidenceSource,
    sourceSystem: "national-search-intelligence-v1",
    sourceEndpoint: input.liveExecution ? DATAFORSEO_LABS_ENDPOINTS.rankedKeywords : null,
    sourceSnapshot,
    liveExecution: input.liveExecution,
    confidenceBasis: input.liveExecution
      ? "explicit-dataforseo-collection"
      : input.fixture
        ? "fixture-snapshot"
        : uncollected
          ? "not-collected"
          : "persisted-snapshot",
    costContribution: costLedger.totalCost,
  });
  return {
    version: NATIONAL_SEARCH_INTELLIGENCE_VERSION,
    tenantSlug: subject.slug,
    businessName: subject.businessName,
    subjectDomain: subject.subjectDomain,
    primaryMarket: subject.primaryMarket,
    country: subject.country,
    growthPlatform: "national",
    capturedAt,
    liveExecution: input.liveExecution,
    status: input.status,
    lastError: input.lastError,
    reusedExistingSnapshot: input.reusedExistingSnapshot,
    serpLocation: (() => {
      try {
        const location = resolveDataForSeoSearchLocationFromSubject(subject);
        return { country: subject.country, locationCode: location.locationCode };
      } catch {
        return null;
      }
    })(),
    limits: NI03B_LIMITS,
    endpoints: input.endpoints,
    costs: {
      requests: costLedger.requestCount,
      tasks: costLedger.taskCount,
      totalCost: costLedger.totalCost,
    },
    costLedger,
    provenance,
    authority: uncollected
      ? "INSUFFICIENT_EVIDENCE"
      : authorityFromProvenance({
        liveExecution: input.liveExecution,
        fixture: input.fixture,
        recovered: input.recovered,
        hasAuthoritativeGapEvidence: false,
      }),
    customerKeywords: input.keywords,
    organicCompetitors: input.competitors,
    serpAttempts: input.serpAttempts || [],
    summary: summarise(input.keywords, input.competitors),
    nextStage: nextStage(),
  };
}

function emptySnapshot(
  slug: string,
  status: NationalSearchIntelligenceSnapshot["status"] = "not_collected",
  lastError: string | null = null,
): NationalSearchIntelligenceSnapshot {
  return snapshotShell({
    slug,
    liveExecution: false,
    fixture: false,
    recovered: false,
    status,
    lastError,
    reusedExistingSnapshot: false,
    keywords: [],
    competitors: [],
    endpoints: [
      { endpoint: DATAFORSEO_LABS_ENDPOINTS.rankedKeywords, requests: 0, tasks: 0, cost: 0 },
      { endpoint: SERP_ENDPOINT, requests: 0, tasks: 0, cost: 0 },
    ],
  });
}

function persistSnapshot(snapshot: NationalSearchIntelligenceSnapshot): void {
  writeJson(nationalSearchIntelligencePath(snapshot.tenantSlug), snapshot);
  writeJson(nationalIntelligenceDataPath(snapshot.tenantSlug, "ranked-keywords-customer"), {
    tenantSlug: snapshot.tenantSlug,
    subjectDomain: snapshot.subjectDomain,
    capturedAt: snapshot.capturedAt,
    liveExecution: snapshot.liveExecution,
    evidenceSource: snapshot.provenance.evidenceSource,
    sourceEndpoint: DATAFORSEO_LABS_ENDPOINTS.rankedKeywords,
    cost: snapshot.endpoints[0]?.cost ?? 0,
    keywords: snapshot.customerKeywords,
  });
  writeJson(nationalIntelligenceDataPath(snapshot.tenantSlug, "cost-ledger-v1"), snapshot.costLedger);
  writeJson(nationalIntelligenceDataPath(snapshot.tenantSlug, "refresh-metadata-v1"), {
    tenantSlug: snapshot.tenantSlug,
    subjectDomain: snapshot.subjectDomain,
    capturedAt: snapshot.capturedAt,
    status: snapshot.status,
    liveExecution: snapshot.liveExecution,
    authority: snapshot.authority,
    evidenceSource: snapshot.provenance.evidenceSource,
    lastError: snapshot.lastError,
    reusedExistingSnapshot: snapshot.reusedExistingSnapshot,
    requests: snapshot.costs.requests,
    tasks: snapshot.costs.tasks,
    totalCost: snapshot.costs.totalCost,
    serpLocation: snapshot.serpLocation,
    serpAttempts: snapshot.serpAttempts,
  });
}

function persistCompetitorDiscovery(snapshot: NationalSearchIntelligenceSnapshot): void {
  const result = emptyNationalCompetitorDiscoveryResult(
    snapshot.tenantSlug,
    snapshot.country || "United Kingdom",
    snapshot.primaryMarket,
  );
  result.generatedAt = snapshot.capturedAt;
  result.status = snapshot.organicCompetitors.length ? "complete" : snapshot.status === "error" ? "failed" : "draft";
  result.qualifiedCompetitors = snapshot.organicCompetitors
    .filter((row) => row.qualification === "qualified" || row.classification === "direct_competitor")
    .map((row) => ({
      id: `national-${row.domain.replace(/[^a-z0-9]+/g, "-")}`,
      name: row.name,
      domain: row.domain,
      websiteUrl: row.websiteUrl,
      marketCountry: snapshot.country,
      targetCustomerMarket: snapshot.primaryMarket,
      source: "search-engine" as const,
      sourceQuery: row.sourceQueries[0] || null,
      qualification: row.qualification,
      qualificationReasons: row.whyIdentified,
      rejectionReasons: [],
      serviceEvidence: [],
      title: row.name,
      description: row.whyIdentified.join(" "),
      evidenceUrls: row.evidenceUrls,
      capturedAt: row.capturedAt,
    }));
  result.candidates = result.qualifiedCompetitors;
  writeNationalCompetitorDiscovery(result);
}

export function readNationalSearchIntelligence(slug: string): NationalSearchIntelligenceSnapshot {
  const subject = resolveNationalIntelligenceSubject(slug);
  if (!subject.eligibleForNationalIntelligence) {
    return emptySnapshot(slug, "not_collected", "National Search Intelligence is available for NATIONAL Growth Platform tenants only.");
  }
  const file = resolveNationalIntelligenceArtifactPath(slug, "search-intelligence-v1");
  if (!file) return emptySnapshot(slug);
  const snapshot = json<NationalSearchIntelligenceSnapshot>(file);
  const fixture = isNationalIntelligenceFixturePath(file);
  snapshot.reusedExistingSnapshot = false;
  if (!snapshot.subjectDomain) snapshot.subjectDomain = subject.subjectDomain;
  if (!snapshot.businessName) snapshot.businessName = subject.businessName;
  if (!Array.isArray(snapshot.serpAttempts)) snapshot.serpAttempts = [];
  if (fixture) {
    snapshot.liveExecution = false;
    snapshot.authority = "FIXTURE_ONLY";
    snapshot.provenance = {
      ...snapshot.provenance,
      liveExecution: false,
      evidenceSource: "FIXTURE",
    };
  } else if (snapshot.provenance?.evidenceSource === "RECOVERED" || snapshot.authority === "RECOVERED_EVIDENCE") {
    snapshot.liveExecution = false;
    snapshot.authority = "RECOVERED_EVIDENCE";
    if (snapshot.provenance) {
      snapshot.provenance.evidenceSource = "RECOVERED";
      snapshot.provenance.liveExecution = false;
    }
  } else if (snapshot.provenance?.evidenceSource === "DATAFORSEO_LIVE" || snapshot.liveExecution) {
    snapshot.liveExecution = false;
    if (snapshot.authority === "LIVE_PROVEN") snapshot.authority = "PERSISTED_PROVEN";
    if (snapshot.provenance) {
      snapshot.provenance.evidenceSource = "DATAFORSEO_PERSISTED";
      snapshot.provenance.liveExecution = false;
    }
  }
  return snapshot;
}

function mapCompetitor(input: {
  domain: string;
  name: string;
  url: string;
  title: string;
  description: string;
  bestPosition: number | null;
  sourceQueries: string[];
  capturedAt: string;
  evidenceSource: NationalEvidenceSourceType;
  ownDomains: string[];
}): NationalOrganicSearchCompetitor | null {
  const qualification = qualifyNationalCompetitorV2({
    domain: input.domain,
    title: input.title,
    snippet: input.description,
    url: input.url,
    websiteText: `${input.title} ${input.description}`,
    matchedQueries: input.sourceQueries,
    ownDomains: input.ownDomains,
  });
  if (qualification.classification === "excluded" || qualification.classification === "insufficient_evidence") {
    return null;
  }
  const qualificationLabel =
    qualification.classification === "direct_competitor" ? "qualified" : "candidate";
  const why = [
    ...input.sourceQueries.map((query) => `Appeared in organic Google results for “${query}”.`),
    ...qualification.reasons,
    input.bestPosition != null ? `Best observed SERP position ${input.bestPosition}.` : "SERP position not available.",
  ];
  return {
    domain: input.domain,
    name: input.name,
    websiteUrl: `https://${input.domain}`,
    whyIdentified: why,
    sourceQueries: input.sourceQueries,
    bestSerpPosition: input.bestPosition,
    classification: qualification.classification,
    qualification: qualificationLabel,
    evidenceStatus: qualification.classification,
    evidenceUrls: [input.url, `https://${input.domain}`].filter((value, index, arr) => value && arr.indexOf(value) === index),
    capturedAt: input.capturedAt,
    evidenceSource: input.evidenceSource,
    verified: false,
  };
}

async function collectInner(
  slug: string,
  force: boolean,
  onProgress?: NationalSearchIntelligenceProgress,
): Promise<NationalSearchIntelligenceSnapshot> {
  const subject = resolveNationalIntelligenceSubject(slug);
  if (!subject.eligibleForNationalIntelligence) {
    throw new Error(`National Search Intelligence is not eligible for ${slug}`);
  }
  const dataFile = nationalSearchIntelligencePath(slug);
  if (!force && fs.existsSync(dataFile)) {
    const existing = json<NationalSearchIntelligenceSnapshot>(dataFile);
    const source = existing.provenance?.evidenceSource;
    if (isUsableNationalSearchIntelligenceStatus(existing.status)) {
      if (source === "DATAFORSEO_LIVE" || source === "DATAFORSEO_PERSISTED" || existing.liveExecution) {
        return { ...existing, reusedExistingSnapshot: true, liveExecution: false };
      }
    }
  }
  if (!hasDataForSeoCredentials()) {
    const missing = emptySnapshot(slug, "error", "DataForSEO credentials are not configured. Collection was not executed.");
    persistSnapshot(missing);
    return missing;
  }

  const capturedAt = new Date().toISOString();
  const serpLocation = resolveDataForSeoSearchLocationFromSubject(subject);
  const endpoints = [
    { endpoint: DATAFORSEO_LABS_ENDPOINTS.rankedKeywords, requests: 0, tasks: 0, cost: 0 },
    { endpoint: SERP_ENDPOINT, requests: 0, tasks: 0, cost: 0 },
  ];
  const ownDomains = [subject.subjectDomain].filter(Boolean);
  const serpAttempts: NationalSearchIntelligenceSnapshot["serpAttempts"] = [];

  let keywords: NationalCustomerRankingKeyword[] = [];
  let rankedIncomplete = false;
  onProgress?.({ type: "ranked_start" });
  try {
    const ranked = await getDomainRankedKeywordsWithCost({
      domain: subject.subjectDomain,
      locationName: "United Kingdom",
      languageCode: subject.languageCode || "en",
      limit: NI03B_LIMITS.customerRankedKeywords,
      orderBy: ["keyword_data.keyword_info.search_volume,desc"],
    });
    endpoints[0].requests = 1;
    endpoints[0].tasks = ranked.tasks;
    endpoints[0].cost = ranked.cost;
    keywords = ranked.rows.slice(0, NI03B_LIMITS.customerRankedKeywords).map((row) => ({
      keyword: row.keyword,
      position: row.position,
      rankingUrl: row.url,
      searchVolume: row.searchVolume,
      cpc: row.cpc,
      competition: row.competition,
      capturedAt,
      sourceEndpoint: ranked.endpoint,
      evidenceSource: "DATAFORSEO_LIVE",
      calculated: false,
    }));
    onProgress?.({ type: "ranked_complete", rows: keywords.length, cost: ranked.cost });
  } catch (err) {
    const timedOut = isDataForSeoTransportTimeout(err);
    const message = err instanceof Error ? err.message : "DataForSEO ranked keyword collection failed.";
    onProgress?.({ type: "ranked_failed", timedOut, message });
    if (!timedOut) {
      const failed = emptySnapshot(slug, "error", message);
      persistSnapshot(failed);
      return failed;
    }
    endpoints[0].requests = 1;
    endpoints[0].tasks = 1;
    rankedIncomplete = true;
  }

  const queries = buildNationalCompetitorDiscoveryQueries({
    businessName: subject.businessName,
    marketCountry: subject.country || "United Kingdom",
    targetCustomerMarket: subject.primaryMarket,
    services: [],
  }).slice(0, NI03B_LIMITS.serpQueries);

  const byDomain = new Map<string, {
    domain: string;
    url: string;
    title: string;
    description: string;
    bestPosition: number | null;
    sourceQueries: string[];
  }>();

  let serpQueryFailed = false;
  for (let index = 0; index < queries.length; index += 1) {
    const query = queries[index];
    onProgress?.({ type: "serp_start", index: index + 1, total: queries.length, query: query.query });
    const executed = await executeNationalGoogleOrganic({
      query: query.query,
      marketCountry: subject.country,
      locationCode: serpLocation.locationCode,
      languageCode: subject.languageCode || "en",
      depth: NI03B_LIMITS.serpDepth,
    }, {
      onRetry(attempt) {
        onProgress?.({
          type: "serp_retry",
          index: index + 1,
          total: queries.length,
          query: query.query,
          statusCode: attempt.taskStatusCode,
        });
      },
    });
    for (const attempt of executed.attempts) {
      endpoints[1].requests += 1;
      endpoints[1].tasks += 1;
      endpoints[1].cost += typeof attempt.cost === "number" ? attempt.cost : 0;
      serpAttempts.push({
        query: attempt.query,
        endpoint: attempt.endpoint,
        taskId: attempt.taskId,
        taskStatusCode: attempt.taskStatusCode,
        taskStatusMessage: attempt.taskStatusMessage,
        cost: attempt.cost,
        successful: attempt.successful,
        timedOut: attempt.timedOut,
        attemptNumber: attempt.attemptNumber,
        capturedAt: attempt.capturedAt,
      });
    }
    const retried = executed.attempts.length > 1;
    const lastAttempt = executed.attempts[executed.attempts.length - 1];
    if (executed.successful) {
      onProgress?.({
        type: "serp_complete",
        index: index + 1,
        total: queries.length,
        query: query.query,
        results: executed.organicResultCount,
        cost: executed.cost,
        retried,
      });
    } else {
      onProgress?.({
        type: "serp_failed",
        index: index + 1,
        total: queries.length,
        query: query.query,
        timedOut: Boolean(lastAttempt?.timedOut),
        statusCode: lastAttempt?.taskStatusCode ?? null,
        retried,
        cost: executed.cost,
      });
    }
    if (executed.fatal) {
      serpQueryFailed = true;
      break;
    }
    if (!executed.successful) {
      serpQueryFailed = true;
      continue;
    }
    for (const row of executed.results) {
      const domain = String(row.domain || "").replace(/^www\./, "").toLowerCase();
      if (!domain || ownDomains.includes(domain) || (subject.subjectDomain && domain.endsWith(`.${subject.subjectDomain}`))) continue;
      const previous = byDomain.get(domain);
      if (!previous) {
        byDomain.set(domain, {
          domain,
          url: row.url,
          title: row.title,
          description: row.description,
          bestPosition: row.position || null,
          sourceQueries: [query.query],
        });
      } else {
        if (row.position > 0 && (previous.bestPosition == null || row.position < previous.bestPosition)) {
          previous.bestPosition = row.position;
          previous.url = row.url;
          previous.title = row.title || previous.title;
          previous.description = row.description || previous.description;
        }
        if (!previous.sourceQueries.includes(query.query)) previous.sourceQueries.push(query.query);
      }
    }
  }

  const competitors = [...byDomain.values()]
    .sort((a, b) => (a.bestPosition || 999) - (b.bestPosition || 999))
    .slice(0, NI03B_LIMITS.competitorCandidates)
    .map((row) => mapCompetitor({
      ...row,
      name: row.title.split(/\s+[|\-–—]\s+/)[0] || row.domain,
      capturedAt,
      evidenceSource: "DATAFORSEO_LIVE",
      ownDomains,
    }))
    .filter((row): row is NationalOrganicSearchCompetitor => Boolean(row));

  const usable = keywords.length > 0 || competitors.length > 0;
  const collectionIncomplete = rankedIncomplete || serpQueryFailed;
  let status: NationalSearchIntelligenceSnapshot["status"];
  let lastError: string | null = null;
  if (!usable && collectionIncomplete) {
    status = "error";
    lastError = "Search intelligence collection could not complete. No usable live evidence was returned.";
  } else if (!usable) {
    status = "empty";
  } else if (collectionIncomplete) {
    status = "partial";
    lastError = PARTIAL_COLLECTION_CUSTOMER_MESSAGE;
  } else {
    status = "collected";
  }
  const snapshot = snapshotShell({
    slug,
    liveExecution: true,
    fixture: false,
    recovered: false,
    status,
    lastError,
    reusedExistingSnapshot: false,
    capturedAt,
    keywords,
    competitors,
    endpoints,
    serpAttempts,
  });
  persistSnapshot(snapshot);
  if (status !== "error") persistCompetitorDiscovery(snapshot);
  return snapshot;
}

export async function collectNationalSearchIntelligence(
  slug: string,
  options: { force?: boolean; onProgress?: NationalSearchIntelligenceProgress } = {},
): Promise<NationalSearchIntelligenceSnapshot> {
  const subject = resolveNationalIntelligenceSubject(slug);
  if (!subject.eligibleForNationalIntelligence) {
    throw new Error(`National Search Intelligence is not eligible for ${slug}`);
  }
  const existing = inFlight.get(subject.slug);
  if (existing) {
    const snapshot = await existing;
    return { ...snapshot, reusedExistingSnapshot: true };
  }
  const pending = collectInner(subject.slug, Boolean(options.force), options.onProgress);
  inFlight.set(subject.slug, pending);
  try {
    return await pending;
  } finally {
    inFlight.delete(subject.slug);
  }
}
