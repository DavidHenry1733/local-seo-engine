import fs from "node:fs";
import path from "node:path";
import { fetchAccessToken, type AuthMethod, detectAuthMethod } from "./indexTrackingEngine";

export interface UrlLifecycleRegistrySource {
  url: string;
  slug?: string;
  remotePath?: string;
  campaignId?: string;
  label?: string;
  type?: string;
  status?: string;
  includedInSitemap?: boolean;
  priority?: number;
  lastSeenAt?: string;
  lastDeployedAt?: string;
  source?: string;
}

export interface UrlLifecycleInspectionSource {
  verdict?: string;
  coverageState?: string;
  indexingState?: string;
  robotsTxtState?: string;
  pageFetchState?: string;
  googleCanonical?: string;
  userCanonical?: string;
  lastCrawlTime?: string;
  lastCheckedAt?: string;
  firstSeenAt?: string;
  lastError?: string | null;
  source?: string;
  siteUrl?: string;
}

export interface UrlLifecycleAnalyticsSource {
  clicks: number;
  impressions: number;
  ctr?: number;
  position: number;
}

export interface UrlLifecycleRecord {
  url: string;
  slug?: string;
  remotePath?: string;
  label?: string;
  type?: string;
  source?: string;
  generated: boolean;
  deployed: boolean;
  submitted: boolean;
  knownToGoogle: boolean;
  crawled: boolean;
  indexed: boolean;
  excluded: boolean;
  lifecycleStatus: "indexed" | "excluded" | "crawled_not_indexed" | "discovered_not_indexed" | "unknown_to_google" | "unchecked";
  coverageState: string | null;
  indexingState: string | null;
  robotsTxtState: string | null;
  pageFetchState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  lastCrawlTime: string | null;
  lastCheckedTime: string | null;
  firstSeenAt: string | null;
  impressions: number | null;
  clicks: number | null;
  averagePosition: number | null;
  sourceFiles: string[];
  issues: string[];
}

export interface UrlLifecycleSummary {
  registryCount: number;
  knownCount: number;
  checkedCount: number;
  indexedCount: number;
  excludedCount: number;
  crawledCount: number;
  submittedCount: number;
  analyticsCount: number;
  urlsMissingLifecycleData: string[];
  missingLifecycleDataCount: number;
}

export interface UrlLifecycleReport {
  projectSlug: string;
  generatedAt: string;
  outputPath: string;
  sourceFiles: Record<string, string | null>;
  searchAnalytics: {
    attempted: boolean;
    authMethod: AuthMethod;
    property: string | null;
    rowCount: number;
    error: string | null;
  };
  summary: UrlLifecycleSummary;
  records: UrlLifecycleRecord[];
}

export interface BuildUrlLifecycleOptions {
  outputDir?: string;
  refreshSearchAnalytics?: boolean;
  searchAnalyticsDays?: number;
  searchAnalyticsRowLimit?: number;
}

interface GscUrlStatusStore {
  records?: Record<string, UrlLifecycleInspectionSource & { url?: string }>;
}

interface GscIndexSnapshot {
  siteUrl?: string;
  results?: Array<UrlLifecycleInspectionSource & { url?: string }>;
}

interface IndexTrackingReport {
  records?: Array<{
    url: string;
    status?: string;
    lastCheckedAt?: string | null;
    firstDetectedIndexedAt?: string | null;
  }>;
}

interface GscSummary {
  property?: string;
}

interface RegistryFile {
  pages?: UrlLifecycleRegistrySource[];
}

interface SearchAnalyticsCache {
  rows?: Array<UrlLifecycleAnalyticsSource & { url?: string; page?: string }>;
}

const GSC_WEBMASTERS_BASE = "https://www.googleapis.com/webmasters/v3/sites";

function projectDir(projectSlug: string, outputDir: string): string {
  return path.join(outputDir, projectSlug);
}

function safeReadJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function normaliseUrl(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.search = "";
    const isAsset = /\.[a-z0-9]{2,5}$/i.test(parsed.pathname);
    if (!isAsset && !parsed.pathname.endsWith("/")) parsed.pathname += "/";
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function low(value: unknown): string {
  return String(value || "").toLowerCase();
}

function isIndexed(inspection?: UrlLifecycleInspectionSource): boolean {
  if (!inspection) return false;
  const coverage = low(inspection.coverageState);
  return (
    inspection.verdict === "PASS" ||
    coverage === "submitted and indexed" ||
    coverage === "indexed, not submitted in sitemap"
  ) && !coverage.includes("not indexed");
}

function isKnownToGoogle(inspection?: UrlLifecycleInspectionSource, analytics?: UrlLifecycleAnalyticsSource): boolean {
  if (analytics && (analytics.impressions > 0 || analytics.clicks > 0)) return true;
  if (!inspection) return false;
  const coverage = low(inspection.coverageState);
  if (!inspection.lastCheckedAt) return false;
  return Boolean(coverage && coverage !== "error" && !coverage.includes("unknown to google"));
}

function isCrawled(inspection?: UrlLifecycleInspectionSource): boolean {
  if (!inspection) return false;
  const coverage = low(inspection.coverageState);
  const fetchState = low(inspection.pageFetchState);
  return Boolean(
    inspection.lastCrawlTime ||
    fetchState === "successful" ||
    coverage.includes("crawled") ||
    isIndexed(inspection),
  );
}

function isExcluded(inspection?: UrlLifecycleInspectionSource): boolean {
  if (!inspection?.lastCheckedAt) return false;
  if (isIndexed(inspection)) return false;
  const coverage = low(inspection.coverageState);
  const verdict = low(inspection.verdict);
  return (
    verdict === "fail" ||
    verdict === "neutral" ||
    coverage.includes("not indexed") ||
    coverage.includes("redirect") ||
    coverage.includes("excluded") ||
    coverage.includes("duplicate") ||
    coverage.includes("blocked")
  );
}

function lifecycleStatus(record: {
  checked: boolean;
  indexed: boolean;
  excluded: boolean;
  crawled: boolean;
  coverageState?: string | null;
  knownToGoogle: boolean;
}): UrlLifecycleRecord["lifecycleStatus"] {
  const coverage = low(record.coverageState);
  if (!record.checked) return "unchecked";
  if (record.indexed) return "indexed";
  if (coverage.includes("crawled") && coverage.includes("not indexed")) return "crawled_not_indexed";
  if (coverage.includes("discovered") && coverage.includes("not indexed")) return "discovered_not_indexed";
  if (!record.knownToGoogle || coverage.includes("unknown to google")) return "unknown_to_google";
  if (record.excluded) return "excluded";
  return "excluded";
}

function mergeInspection(
  primary?: UrlLifecycleInspectionSource,
  secondary?: UrlLifecycleInspectionSource,
): UrlLifecycleInspectionSource | undefined {
  if (!primary) return secondary;
  if (!secondary) return primary;
  return {
    ...secondary,
    ...primary,
    lastCheckedAt: primary.lastCheckedAt || secondary.lastCheckedAt,
    firstSeenAt: primary.firstSeenAt || secondary.firstSeenAt,
    lastCrawlTime: primary.lastCrawlTime || secondary.lastCrawlTime,
  };
}

function loadInspectionMap(dir: string, sourceFiles: Record<string, string | null>): Map<string, UrlLifecycleInspectionSource> {
  const map = new Map<string, UrlLifecycleInspectionSource>();

  const urlStatusPath = path.join(dir, "gsc-url-status.json");
  sourceFiles.gscUrlStatus = fs.existsSync(urlStatusPath) ? urlStatusPath : null;
  const store = safeReadJson<GscUrlStatusStore>(urlStatusPath);
  for (const [url, record] of Object.entries(store?.records ?? {})) {
    map.set(normaliseUrl(url), { ...record, source: record.source || "gsc-url-status" });
  }

  const indexStatusPath = path.join(dir, "gsc-index-status.json");
  sourceFiles.gscIndexStatus = fs.existsSync(indexStatusPath) ? indexStatusPath : null;
  const snapshot = safeReadJson<GscIndexSnapshot>(indexStatusPath);
  for (const record of snapshot?.results ?? []) {
    if (!record.url) continue;
    const key = normaliseUrl(record.url);
    map.set(key, mergeInspection(map.get(key), { ...record, siteUrl: record.siteUrl || snapshot?.siteUrl, source: record.source || "gsc-index-status" })!);
  }

  const simplePath = path.join(dir, "index-tracking.json");
  sourceFiles.indexTracking = fs.existsSync(simplePath) ? simplePath : null;
  const simple = safeReadJson<IndexTrackingReport>(simplePath);
  for (const record of simple?.records ?? []) {
    const key = normaliseUrl(record.url);
    const existing = map.get(key);
    const simpleInspection: UrlLifecycleInspectionSource = {
      verdict: record.status === "indexed" ? "PASS" : record.status === "not_indexed" ? "FAIL" : "UNKNOWN",
      coverageState: record.status === "indexed" ? "Submitted and indexed" : record.status === "not_indexed" ? "Not indexed" : "UNKNOWN",
      lastCheckedAt: record.lastCheckedAt || undefined,
      firstSeenAt: record.firstDetectedIndexedAt || undefined,
      source: "index-tracking",
    };
    map.set(key, mergeInspection(existing, simpleInspection)!);
  }

  return map;
}

function loadAnalyticsCache(dir: string, sourceFiles: Record<string, string | null>): Map<string, UrlLifecycleAnalyticsSource> {
  const candidates = [
    "gsc-search-analytics.json",
    "search-analytics.json",
    "gsc-analytics.json",
  ];
  const map = new Map<string, UrlLifecycleAnalyticsSource>();
  for (const name of candidates) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    sourceFiles.searchAnalytics = file;
    const data = safeReadJson<SearchAnalyticsCache | Array<UrlLifecycleAnalyticsSource & { url?: string; page?: string }>>(file);
    const rows = Array.isArray(data) ? data : data?.rows ?? [];
    for (const row of rows) {
      const url = normaliseUrl(row.url || row.page || "");
      if (!url) continue;
      map.set(url, {
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        ctr: typeof row.ctr === "number" ? row.ctr : undefined,
        position: Number(row.position || 0),
      });
    }
    return map;
  }
  sourceFiles.searchAnalytics = null;
  return map;
}

function siteFromRegistry(registryPages: UrlLifecycleRegistrySource[], summary: GscSummary | null): { property: string | null; siteUrl: string | null } {
  if (summary?.property) return { property: summary.property, siteUrl: summary.property };
  for (const page of registryPages) {
    try {
      const parsed = new URL(page.url);
      const prefix = `${parsed.protocol}//${parsed.hostname}/`;
      return { property: prefix, siteUrl: prefix };
    } catch {
      // skip invalid registry URL
    }
  }
  return { property: null, siteUrl: null };
}

async function fetchSearchAnalytics(
  siteUrl: string,
  accessToken: string,
  days: number,
  rowLimit: number,
): Promise<UrlLifecycleAnalyticsSource[] & Array<{ url: string }>> {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const res = await fetch(`${GSC_WEBMASTERS_BASE}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      dimensions: ["page"],
      rowLimit,
    }),
  });

  if (!res.ok) {
    throw new Error(`Search Analytics API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = await res.json() as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> };
  return (data.rows ?? [])
    .map((row) => ({
      url: String(row.keys?.[0] || ""),
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      ctr: typeof row.ctr === "number" ? row.ctr : undefined,
      position: Number(row.position || 0),
    }))
    .filter((row) => row.url.startsWith("http")) as UrlLifecycleAnalyticsSource[] & Array<{ url: string }>;
}

export async function buildUrlLifecycle(
  projectSlug: string,
  options: BuildUrlLifecycleOptions = {},
): Promise<UrlLifecycleReport> {
  const outputDir = options.outputDir ?? "output";
  const dir = projectDir(projectSlug, outputDir);
  const outputPath = path.join(dir, "url-lifecycle.json");
  const sourceFiles: Record<string, string | null> = {};

  const registryPath = path.join(dir, "page-registry.json");
  sourceFiles.registry = fs.existsSync(registryPath) ? registryPath : null;
  const registry = safeReadJson<RegistryFile>(registryPath);
  const registryPages = (registry?.pages ?? [])
    .filter((page) => page.url && page.status !== "archived")
    .sort((a, b) => normaliseUrl(a.url).localeCompare(normaliseUrl(b.url)));

  const summaryPath = path.join(dir, "gsc-summary.json");
  sourceFiles.gscSummary = fs.existsSync(summaryPath) ? summaryPath : null;
  const gscSummary = safeReadJson<GscSummary>(summaryPath);

  const inspectionMap = loadInspectionMap(dir, sourceFiles);
  const analyticsMap = loadAnalyticsCache(dir, sourceFiles);
  const site = siteFromRegistry(registryPages, gscSummary);
  const authMethod = detectAuthMethod();
  const searchAnalytics = {
    attempted: Boolean(options.refreshSearchAnalytics),
    authMethod,
    property: site.property,
    rowCount: analyticsMap.size,
    error: null as string | null,
  };

  if (options.refreshSearchAnalytics) {
    try {
      const accessToken = await fetchAccessToken();
      if (!accessToken || !site.siteUrl) {
        throw new Error("No GSC access token or property available for Search Analytics refresh.");
      }
      const rows = await fetchSearchAnalytics(
        site.siteUrl,
        accessToken,
        options.searchAnalyticsDays ?? 480,
        options.searchAnalyticsRowLimit ?? 25000,
      );
      analyticsMap.clear();
      for (const row of rows) {
        analyticsMap.set(normaliseUrl(row.url), row);
      }
      searchAnalytics.rowCount = analyticsMap.size;
    } catch (error) {
      searchAnalytics.error = (error as Error).message || String(error);
    }
  }

  const records: UrlLifecycleRecord[] = registryPages.map((page) => {
    const url = normaliseUrl(page.url);
    const inspection = inspectionMap.get(url);
    const analytics = analyticsMap.get(url);
    const checked = Boolean(inspection?.lastCheckedAt);
    const indexed = isIndexed(inspection);
    const crawled = isCrawled(inspection);
    const excluded = isExcluded(inspection);
    const knownToGoogle = isKnownToGoogle(inspection, analytics);
    const sourceFileList = ["registry"];
    if (inspection?.source === "index-tracking") sourceFileList.push("indexTracking");
    if (inspection?.source === "gsc-index-status") sourceFileList.push("gscIndexStatus");
    if (inspection && inspection.source !== "index-tracking" && inspection.source !== "gsc-index-status") sourceFileList.push("gscUrlStatus");
    if (analytics) sourceFileList.push("searchAnalytics");

    const issues: string[] = [];
    if (!checked) issues.push("missing_gsc_inspection");
    if (!analytics) issues.push("missing_search_analytics");
    if (page.status === "live" && !page.lastDeployedAt) issues.push("missing_last_deployed_at");

    const coverageState = inspection?.coverageState ?? null;

    return {
      url,
      slug: page.slug,
      remotePath: page.remotePath,
      label: page.label,
      type: page.type,
      source: page.source,
      generated: Boolean(page.lastSeenAt || page.remotePath || page.slug),
      deployed: page.status === "live",
      submitted: page.includedInSitemap !== false,
      knownToGoogle,
      crawled,
      indexed,
      excluded,
      lifecycleStatus: lifecycleStatus({ checked, indexed, excluded, crawled, coverageState, knownToGoogle }),
      coverageState,
      indexingState: inspection?.indexingState ?? null,
      robotsTxtState: inspection?.robotsTxtState ?? null,
      pageFetchState: inspection?.pageFetchState ?? null,
      googleCanonical: inspection?.googleCanonical ?? null,
      userCanonical: inspection?.userCanonical ?? null,
      lastCrawlTime: inspection?.lastCrawlTime ?? null,
      lastCheckedTime: inspection?.lastCheckedAt ?? null,
      firstSeenAt: inspection?.firstSeenAt ?? null,
      impressions: analytics?.impressions ?? null,
      clicks: analytics?.clicks ?? null,
      averagePosition: analytics?.position ?? null,
      sourceFiles: sourceFileList,
      issues,
    };
  });

  const urlsMissingLifecycleData = records
    .filter((record) => !record.lastCheckedTime)
    .map((record) => record.url);

  const report: UrlLifecycleReport = {
    projectSlug,
    generatedAt: new Date().toISOString(),
    outputPath,
    sourceFiles,
    searchAnalytics,
    summary: {
      registryCount: records.length,
      knownCount: records.filter((record) => record.knownToGoogle).length,
      checkedCount: records.filter((record) => record.lastCheckedTime).length,
      indexedCount: records.filter((record) => record.indexed).length,
      excludedCount: records.filter((record) => record.excluded).length,
      crawledCount: records.filter((record) => record.crawled).length,
      submittedCount: records.filter((record) => record.submitted).length,
      analyticsCount: records.filter((record) => record.impressions !== null || record.clicks !== null).length,
      urlsMissingLifecycleData,
      missingLifecycleDataCount: urlsMissingLifecycleData.length,
    },
    records,
  };

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");

  return report;
}
