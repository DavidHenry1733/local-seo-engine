/**
 * CP05 search identity for a canonically published campaign.
 * Pages come only from the CP04 publication record.
 * Submission is Search Console sitemap submission. Indexing API is not used.
 * URL Inspection is a separate check and is not treated as submission.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  classifyExistingPublishIndex,
  publicationRecordPath,
  sitemapPath,
  type CanonicalPublicationRecord,
  type CanonicalPublishedPage,
} from "./canonicalCampaignPublishingService.ts";
import { readSearchConsoleAuthoritySnapshot } from "./pharmacySearchConsoleWriteAuthorityService.ts";

export const CANONICAL_SEARCH_SUBMISSION_MECHANISM = "search_console_sitemaps_submit" as const;
export const CANONICAL_SEARCH_INDEXING_MECHANISM = "search_console_url_inspection" as const;
export const CANONICAL_SEARCH_GSC_ATTRIBUTION = "URL_LEVEL_NOT_REVISION_SPECIFIC" as const;

export interface CanonicalSearchPageIdentity {
  tenantSlug: string;
  campaignId: string;
  serviceId: string;
  pageType: "service" | "locality";
  areaSlug: string | null;
  canonicalUrl: string;
  contentRevision: string;
  publishedAt: string;
}

export interface CanonicalSitemapSubmitProvider {
  submitSitemap(input: { property: string | null; sitemapUrl: string; urls: string[] }): Promise<{ ok: boolean; error?: string }>;
}

export interface CanonicalIndexingInspection {
  status: "NOT_INDEXED" | "INDEXED" | "UNKNOWN" | "ERROR";
  indexedAt?: string | null;
  evidenceRef?: string | null;
  error?: string | null;
}

export interface CanonicalIndexingProvider {
  inspect(input: { canonicalUrl: string; contentRevision: string }): Promise<CanonicalIndexingInspection>;
}

export interface CanonicalSearchConsoleRow {
  canonicalUrl: string;
  property?: string | null;
  measurementStart?: string | null;
  measurementEnd?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  averagePosition?: number | null;
}

export interface CanonicalSearchConsoleProvider {
  fetchRows(input: { property: string | null; urls: string[] }): Promise<{ ok: boolean; error?: string; rows?: CanonicalSearchConsoleRow[] }>;
}

export interface CanonicalRankObservationInput {
  canonicalUrl: string;
  query: string;
  position: number | null;
  checkedAt: string;
  provider: string;
  location?: string | null;
  device?: string | null;
}

export interface CanonicalRankProvider {
  observe(input: { urls: string[] }): Promise<{ ok: boolean; error?: string; observations?: CanonicalRankObservationInput[] }>;
}

interface StoredSubmission {
  status: "NOT_SUBMITTED" | "SUBMITTED" | "ERROR";
  submittedAt: string | null;
  source: typeof CANONICAL_SEARCH_SUBMISSION_MECHANISM | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  contentRevision: string | null;
}

interface StoredIndexing {
  status: "NOT_CHECKED" | "SUBMITTED" | "NOT_INDEXED" | "INDEXED" | "UNKNOWN" | "ERROR";
  checkedAt: string | null;
  indexedAt: string | null;
  source: typeof CANONICAL_SEARCH_INDEXING_MECHANISM | null;
  lastError: string | null;
  contentRevision: string | null;
  evidenceRef: string | null;
}

interface StoredSearchConsole {
  connectionStatus: "NOT_CONNECTED" | "CONNECTED" | "ERROR";
  property: string | null;
  attribution: typeof CANONICAL_SEARCH_GSC_ATTRIBUTION | "NOT_MEASURED";
  measurementStart: string | null;
  measurementEnd: string | null;
  impressions: number | null;
  clicks: number | null;
  averagePosition: number | null;
  lastFetchedAt: string | null;
  lastError: string | null;
  measuredContentRevision: string | null;
}

interface StoredRank {
  query: string;
  position: number | null;
  checkedAt: string;
  provider: string;
  location: string | null;
  device: string | null;
  contentRevision: string;
  canonicalUrl: string;
}

interface StoredPage {
  identity: CanonicalSearchPageIdentity;
  submission: StoredSubmission;
  indexing: StoredIndexing;
  searchConsole: StoredSearchConsole;
  urlLevelSearchConsole: StoredSearchConsole | null;
  rankObservations: StoredRank[];
  history: Array<{
    contentRevision: string;
    supersededAt: string;
    submission: StoredSubmission;
    indexing: StoredIndexing;
    searchConsole: StoredSearchConsole;
    rankObservations: StoredRank[];
  }>;
}

interface SearchStore {
  version: 1;
  tenantSlug: string;
  campaignId: string;
  pages: StoredPage[];
}

function searchStorePath(tenantSlug: string, campaignId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/canonical-campaign-search",
    tenantSlug,
    `${campaignId}.json`,
  );
}

export function readCanonicalPublishedPages(tenantSlug: string, campaignId: string): {
  classification: "CANONICAL" | "HISTORICAL_UNSCOPED" | "ABSENT";
  pages: CanonicalPublishedPage[];
} {
  const record = readPublication(tenantSlug, campaignId);
  if (record?.current?.pages?.length) {
    return { classification: "CANONICAL", pages: record.current.pages };
  }
  const index = classifyExistingPublishIndex(tenantSlug);
  if (index.classification === "HISTORICAL_UNSCOPED") return { classification: "HISTORICAL_UNSCOPED", pages: [] };
  return { classification: "ABSENT", pages: [] };
}

export function resolveCanonicalSearchIdentity(input: { tenantSlug: string; campaignId: string }): {
  classification: "CANONICAL" | "HISTORICAL_UNSCOPED" | "ABSENT";
  pages: CanonicalSearchPageIdentity[];
} {
  const published = readCanonicalPublishedPages(input.tenantSlug, input.campaignId);
  return {
    classification: published.classification,
    pages: published.pages.map(identityOf),
  };
}

export async function submitCanonicalCampaignSearch(input: {
  tenantSlug: string;
  campaignId: string;
  provider?: CanonicalSitemapSubmitProvider;
  now?: string;
}): Promise<{ ok: boolean; handled: boolean; blockers: string[]; submittedUrls: string[] }> {
  const published = readCanonicalPublishedPages(input.tenantSlug, input.campaignId);
  if (published.classification !== "CANONICAL") {
    return {
      ok: false,
      handled: published.classification === "HISTORICAL_UNSCOPED",
      blockers: [published.classification === "HISTORICAL_UNSCOPED"
        ? "Historical publish index is unscoped and cannot be submitted"
        : "No canonical publication exists"],
      submittedUrls: [],
    };
  }
  const connection = tenantSearchConsoleConnection(input.tenantSlug);
  const now = input.now || new Date().toISOString();
  const store = syncedStore(input.tenantSlug, input.campaignId, published.pages, now);
  if (connection.status !== "CONNECTED" || !connection.canSubmit) {
    for (const page of store.pages) {
      page.submission.lastAttemptAt = now;
      page.submission.lastError = connection.status !== "CONNECTED"
        ? "Search Console is not connected for this tenant. Sitemap submission was not sent. Google Indexing API is not used."
        : "Search Console is connected without sitemap submit permission. Sitemap submission was not sent. Google Indexing API is not used.";
      if (page.submission.status !== "SUBMITTED") page.submission.status = "ERROR";
    }
    writeStore(store);
    return { ok: false, handled: true, blockers: [store.pages[0]?.submission.lastError || "Search Console is not connected"], submittedUrls: [] };
  }
  const provider = input.provider || defaultSitemapProvider;
  let outcome: { ok: boolean; error?: string };
  try {
    outcome = await provider.submitSitemap({
      property: connection.property,
      sitemapUrl: sitemapPath(input.tenantSlug),
      urls: published.pages.map((page) => page.canonicalUrl),
    });
  } catch (error) {
    outcome = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  for (const page of store.pages) {
    page.submission.lastAttemptAt = now;
    if (outcome.ok) {
      page.submission.status = "SUBMITTED";
      page.submission.submittedAt = page.submission.submittedAt || now;
      page.submission.source = CANONICAL_SEARCH_SUBMISSION_MECHANISM;
      page.submission.contentRevision = page.identity.contentRevision;
      page.submission.lastError = null;
      if (page.indexing.status === "NOT_CHECKED") page.indexing.status = "SUBMITTED";
    } else {
      page.submission.lastError = outcome.error || "Search Console sitemap submit failed";
      if (page.submission.status !== "SUBMITTED") page.submission.status = "ERROR";
    }
  }
  writeStore(store);
  return {
    ok: outcome.ok,
    handled: true,
    blockers: outcome.ok ? [] : [outcome.error || "Search Console sitemap submit failed"],
    submittedUrls: outcome.ok ? published.pages.map((page) => page.canonicalUrl) : [],
  };
}

export async function checkCanonicalCampaignIndexing(input: {
  tenantSlug: string;
  campaignId: string;
  provider?: CanonicalIndexingProvider;
  now?: string;
}): Promise<{ ok: boolean; blockers: string[] }> {
  const published = readCanonicalPublishedPages(input.tenantSlug, input.campaignId);
  if (published.classification !== "CANONICAL") {
    return { ok: false, blockers: ["No canonical publication exists"] };
  }
  const now = input.now || new Date().toISOString();
  const store = syncedStore(input.tenantSlug, input.campaignId, published.pages, now);
  const provider = input.provider;
  if (!provider) {
    for (const page of store.pages) {
      page.indexing.lastError = "URL Inspection was not executed. Sitemap submission is not indexing evidence.";
    }
    writeStore(store);
    return { ok: false, blockers: ["URL Inspection was not executed. Sitemap submission is not indexing evidence."] };
  }
  const blockers: string[] = [];
  for (const page of store.pages) {
    let evidence: CanonicalIndexingInspection;
    try {
      evidence = await provider.inspect({ canonicalUrl: page.identity.canonicalUrl, contentRevision: page.identity.contentRevision });
    } catch (error) {
      evidence = { status: "ERROR", error: error instanceof Error ? error.message : String(error) };
    }
    if (evidence.status === "ERROR") {
      page.indexing.lastError = evidence.error || "Indexing check failed";
      if (page.indexing.status !== "INDEXED") page.indexing.status = "ERROR";
      blockers.push(page.indexing.lastError);
      continue;
    }
    page.indexing.status = evidence.status === "INDEXED" ? "INDEXED" : evidence.status === "NOT_INDEXED" ? "NOT_INDEXED" : "UNKNOWN";
    page.indexing.checkedAt = now;
    page.indexing.source = CANONICAL_SEARCH_INDEXING_MECHANISM;
    page.indexing.contentRevision = page.identity.contentRevision;
    page.indexing.evidenceRef = evidence.evidenceRef || null;
    page.indexing.lastError = null;
    page.indexing.indexedAt = evidence.status === "INDEXED" ? evidence.indexedAt || now : page.indexing.indexedAt;
  }
  writeStore(store);
  return { ok: blockers.length === 0, blockers };
}

export async function fetchCanonicalSearchConsolePerformance(input: {
  tenantSlug: string;
  campaignId: string;
  provider?: CanonicalSearchConsoleProvider;
  now?: string;
}): Promise<{ ok: boolean; blockers: string[] }> {
  const published = readCanonicalPublishedPages(input.tenantSlug, input.campaignId);
  if (published.classification !== "CANONICAL") return { ok: false, blockers: ["No canonical publication exists"] };
  const now = input.now || new Date().toISOString();
  const store = syncedStore(input.tenantSlug, input.campaignId, published.pages, now);
  const connection = tenantSearchConsoleConnection(input.tenantSlug);
  if (connection.status !== "CONNECTED") {
    for (const page of store.pages) {
      if (page.searchConsole.impressions == null) {
        page.searchConsole = emptySearchConsole("NOT_CONNECTED");
      }
      page.searchConsole.connectionStatus = "NOT_CONNECTED";
      page.searchConsole.lastError = "Search Console is not connected. No performance values were inferred.";
    }
    writeStore(store);
    return { ok: false, blockers: ["Search Console is not connected. No performance values were inferred."] };
  }
  if (!input.provider) {
    for (const page of store.pages) {
      page.searchConsole.connectionStatus = "CONNECTED";
      page.searchConsole.property = connection.property;
      page.searchConsole.lastError = "Search Console performance fetch was not executed.";
    }
    writeStore(store);
    return { ok: false, blockers: ["Search Console performance fetch was not executed."] };
  }
  let fetched: { ok: boolean; error?: string; rows?: CanonicalSearchConsoleRow[] };
  try {
    fetched = await input.provider.fetchRows({ property: connection.property, urls: published.pages.map((page) => page.canonicalUrl) });
  } catch (error) {
    fetched = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  if (!fetched.ok) {
    for (const page of store.pages) {
      page.searchConsole.connectionStatus = "ERROR";
      page.searchConsole.lastError = fetched.error || "Search Console fetch failed";
      page.searchConsole.lastFetchedAt = now;
    }
    writeStore(store);
    return { ok: false, blockers: [fetched.error || "Search Console fetch failed"] };
  }
  const allowed = new Set(published.pages.map((page) => page.canonicalUrl));
  for (const page of store.pages) {
    const row = (fetched.rows || []).find((item) => item.canonicalUrl === page.identity.canonicalUrl);
    page.searchConsole.connectionStatus = "CONNECTED";
    page.searchConsole.property = connection.property;
    page.searchConsole.lastFetchedAt = now;
    page.searchConsole.lastError = null;
    page.searchConsole.attribution = row ? CANONICAL_SEARCH_GSC_ATTRIBUTION : "NOT_MEASURED";
    page.searchConsole.measuredContentRevision = null;
    if (!row) {
      page.searchConsole.impressions = null;
      page.searchConsole.clicks = null;
      page.searchConsole.averagePosition = null;
      continue;
    }
    page.searchConsole.measurementStart = row.measurementStart || null;
    page.searchConsole.measurementEnd = row.measurementEnd || null;
    page.searchConsole.impressions = numberOrNull(row.impressions);
    page.searchConsole.clicks = numberOrNull(row.clicks);
    page.searchConsole.averagePosition = numberOrNull(row.averagePosition);
    page.urlLevelSearchConsole = { ...page.searchConsole };
  }
  for (const row of fetched.rows || []) {
    if (!allowed.has(row.canonicalUrl)) continue;
  }
  writeStore(store);
  return { ok: true, blockers: [] };
}

export async function recordCanonicalRankObservations(input: {
  tenantSlug: string;
  campaignId: string;
  provider: CanonicalRankProvider;
  now?: string;
}): Promise<{ ok: boolean; blockers: string[]; attached: number }> {
  const published = readCanonicalPublishedPages(input.tenantSlug, input.campaignId);
  if (published.classification !== "CANONICAL") return { ok: false, blockers: ["No canonical publication exists"], attached: 0 };
  const now = input.now || new Date().toISOString();
  const store = syncedStore(input.tenantSlug, input.campaignId, published.pages, now);
  let observed: { ok: boolean; error?: string; observations?: CanonicalRankObservationInput[] };
  try {
    observed = await input.provider.observe({ urls: published.pages.map((page) => page.canonicalUrl) });
  } catch (error) {
    observed = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  if (!observed.ok) {
    writeStore(store);
    return { ok: false, blockers: [observed.error || "Rank provider failed"], attached: 0 };
  }
  const allowed = new Map(store.pages.map((page) => [page.identity.canonicalUrl, page]));
  let attached = 0;
  for (const observation of observed.observations || []) {
    const page = allowed.get(observation.canonicalUrl);
    if (!page) continue;
    page.rankObservations.push({
      query: observation.query,
      position: observation.position,
      checkedAt: observation.checkedAt || now,
      provider: observation.provider,
      location: observation.location || null,
      device: observation.device || null,
      contentRevision: page.identity.contentRevision,
      canonicalUrl: page.identity.canonicalUrl,
    });
    attached += 1;
  }
  writeStore(store);
  return { ok: true, blockers: [], attached };
}

export function resolveCanonicalCampaignResults(input: { tenantSlug: string; campaignId: string }): {
  classification: "CANONICAL" | "HISTORICAL_UNSCOPED" | "ABSENT";
  synthetic: false;
  publishedPageCount: number;
  submittedPageCount: number;
  indexedPageCount: number;
  pagesWithImpressions: number | null;
  totalImpressions: number | null;
  totalClicks: number | null;
  averagePosition: number | null;
  trackedKeywords: number;
  latestMeasurementAt: string | null;
  pages: Array<{
    identity: CanonicalSearchPageIdentity;
    publicationStatus: "PUBLISHED";
    submissionStatus: StoredSubmission["status"];
    indexingStatus: StoredIndexing["status"];
    searchConsole: StoredSearchConsole;
    urlLevelSearchConsole: StoredSearchConsole | null;
    rankObservations: StoredRank[];
    measurementRevisionMatch: false | "CURRENT_REVISION";
    dataFreshness: "NOT_MEASURED" | "URL_LEVEL_NOT_REVISION_SPECIFIC" | "CURRENT_REVISION";
    historyCount: number;
  }>;
} {
  const published = readCanonicalPublishedPages(input.tenantSlug, input.campaignId);
  if (published.classification !== "CANONICAL") {
    return emptyResults(published.classification);
  }
  const store = syncedStore(input.tenantSlug, input.campaignId, published.pages, new Date().toISOString());
  writeStore(store);
  const pages = store.pages.map((page) => {
    const revisionSpecific = page.searchConsole.attribution !== CANONICAL_SEARCH_GSC_ATTRIBUTION && page.searchConsole.impressions != null;
    return {
      identity: page.identity,
      publicationStatus: "PUBLISHED" as const,
      submissionStatus: page.submission.status,
      indexingStatus: page.indexing.status,
      searchConsole: page.searchConsole,
      urlLevelSearchConsole: page.urlLevelSearchConsole,
      rankObservations: page.rankObservations,
      measurementRevisionMatch: revisionSpecific ? "CURRENT_REVISION" as const : false as const,
      dataFreshness: page.urlLevelSearchConsole
        ? "URL_LEVEL_NOT_REVISION_SPECIFIC" as const
        : page.searchConsole.impressions == null
          ? "NOT_MEASURED" as const
          : "CURRENT_REVISION" as const,
      historyCount: page.history.length,
    };
  });
  const impressions = pages.map((page) => page.searchConsole.impressions).filter((value): value is number => value != null);
  const clicks = pages.map((page) => page.searchConsole.clicks).filter((value): value is number => value != null);
  const positions = pages.map((page) => page.searchConsole.averagePosition).filter((value): value is number => value != null);
  return {
    classification: "CANONICAL",
    synthetic: false,
    publishedPageCount: pages.length,
    submittedPageCount: pages.filter((page) => page.submissionStatus === "SUBMITTED").length,
    indexedPageCount: pages.filter((page) => page.indexingStatus === "INDEXED").length,
    pagesWithImpressions: impressions.length ? impressions.filter((value) => value > 0).length : null,
    totalImpressions: impressions.length ? impressions.reduce((sum, value) => sum + value, 0) : null,
    totalClicks: clicks.length ? clicks.reduce((sum, value) => sum + value, 0) : null,
    averagePosition: positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : null,
    trackedKeywords: pages.reduce((sum, page) => sum + page.rankObservations.length, 0),
    latestMeasurementAt: latestTime(pages),
    pages,
  };
}

export function classifyLegacyRankFile(tenantSlug: string): "ABSENT" | "LEGACY_UNSCOPED" | "CANONICAL" {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "output", tenantSlug, "rank-tracking.json");
  if (!fs.existsSync(file)) return "ABSENT";
  const doc = readJson(file);
  const keywords = Array.isArray(doc?.keywords) ? doc.keywords as Array<Record<string, unknown>> : [];
  const canonical = keywords.length > 0 && keywords.every((row) => typeof row.campaignId === "string" && typeof row.contentRevision === "string");
  return canonical ? "CANONICAL" : "LEGACY_UNSCOPED";
}

async function defaultSitemapProvider(input: { property: string | null; sitemapUrl: string; urls: string[] }): Promise<{ ok: boolean; error?: string }> {
  return {
    ok: false,
    error: `Live Search Console sitemap submit was not executed for ${input.urls.length} canonical URL(s). Google Indexing API is not used.`,
  };
}

function tenantSearchConsoleConnection(tenantSlug: string): { status: "NOT_CONNECTED" | "CONNECTED"; property: string | null; canSubmit: boolean } {
  const snapshot = readSearchConsoleAuthoritySnapshot(tenantSlug);
  const property = String(snapshot?.property?.matchedProperty || snapshot?.property?.requestedProperty || "").trim();
  if (!snapshot?.connected || !property) return { status: "NOT_CONNECTED", property: null, canSubmit: false };
  return { status: "CONNECTED", property, canSubmit: snapshot.canSubmitSitemaps === true };
}

function syncedStore(tenantSlug: string, campaignId: string, pages: CanonicalPublishedPage[], now: string): SearchStore {
  const existing = readStore(tenantSlug, campaignId);
  const byUrl = new Map((existing?.pages || []).map((page) => [page.identity.canonicalUrl, page]));
  const nextPages = pages.map((page) => {
    const identity = identityOf(page);
    const stored = byUrl.get(identity.canonicalUrl);
    if (!stored) return freshPage(identity);
    if (stored.identity.contentRevision === identity.contentRevision) {
      stored.identity = identity;
      return stored;
    }
    stored.history.push({
      contentRevision: stored.identity.contentRevision,
      supersededAt: now,
      submission: stored.submission,
      indexing: stored.indexing,
      searchConsole: stored.searchConsole,
      rankObservations: stored.rankObservations,
    });
    const urlLevel = stored.urlLevelSearchConsole || (stored.searchConsole.impressions != null ? { ...stored.searchConsole, attribution: CANONICAL_SEARCH_GSC_ATTRIBUTION, measuredContentRevision: null } : null);
    const fresh = freshPage(identity);
    fresh.history = stored.history;
    fresh.urlLevelSearchConsole = urlLevel;
    return fresh;
  });
  return { version: 1, tenantSlug, campaignId, pages: nextPages };
}

function freshPage(identity: CanonicalSearchPageIdentity): StoredPage {
  return {
    identity,
    submission: { status: "NOT_SUBMITTED", submittedAt: null, source: null, lastAttemptAt: null, lastError: null, contentRevision: null },
    indexing: { status: "NOT_CHECKED", checkedAt: null, indexedAt: null, source: null, lastError: null, contentRevision: null, evidenceRef: null },
    searchConsole: emptySearchConsole(tenantSearchConsoleConnection(identity.tenantSlug).status),
    urlLevelSearchConsole: null,
    rankObservations: [],
    history: [],
  };
}

function emptySearchConsole(connectionStatus: StoredSearchConsole["connectionStatus"]): StoredSearchConsole {
  return {
    connectionStatus,
    property: null,
    attribution: "NOT_MEASURED",
    measurementStart: null,
    measurementEnd: null,
    impressions: null,
    clicks: null,
    averagePosition: null,
    lastFetchedAt: null,
    lastError: null,
    measuredContentRevision: null,
  };
}

function emptyResults(classification: "HISTORICAL_UNSCOPED" | "ABSENT") {
  return {
    classification,
    synthetic: false as const,
    publishedPageCount: 0,
    submittedPageCount: 0,
    indexedPageCount: 0,
    pagesWithImpressions: null,
    totalImpressions: null,
    totalClicks: null,
    averagePosition: null,
    trackedKeywords: 0,
    latestMeasurementAt: null,
    pages: [],
  };
}

function identityOf(page: CanonicalPublishedPage): CanonicalSearchPageIdentity {
  return {
    tenantSlug: page.tenantSlug,
    campaignId: page.campaignId,
    serviceId: page.serviceId,
    pageType: page.pageType,
    areaSlug: page.areaSlug,
    canonicalUrl: page.canonicalUrl,
    contentRevision: page.contentRevision,
    publishedAt: page.publishedAt,
  };
}

function latestTime(pages: Array<{ searchConsole: StoredSearchConsole; rankObservations: StoredRank[]; indexingStatus: string }>): string | null {
  const times = pages.flatMap((page) => [page.searchConsole.lastFetchedAt, ...page.rankObservations.map((row) => row.checkedAt)]).filter((value): value is string => Boolean(value));
  return times.sort().at(-1) || null;
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPublication(tenantSlug: string, campaignId: string): CanonicalPublicationRecord | null {
  const doc = readJson(publicationRecordPath(tenantSlug, campaignId));
  if (!doc || !Array.isArray(doc.history)) return null;
  return doc as unknown as CanonicalPublicationRecord;
}

function readStore(tenantSlug: string, campaignId: string): SearchStore | null {
  const doc = readJson(searchStorePath(tenantSlug, campaignId));
  if (!doc || !Array.isArray(doc.pages)) return null;
  return doc as unknown as SearchStore;
}

function writeStore(store: SearchStore): void {
  const file = searchStorePath(store.tenantSlug, store.campaignId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, file);
}

function readJson(file: string): Record<string, unknown> | null {
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
