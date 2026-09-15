import fs from "node:fs";
import path from "node:path";
import { fetchAccessToken, type AuthMethod, detectAuthMethod } from "../indexing/indexTrackingEngine";

const GSC_WEBMASTERS_BASE = "https://www.googleapis.com/webmasters/v3/sites";

export type RankDirection = "up" | "down" | "same" | "new";

export interface GscRankTrackingRecord {
  keyword: string;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
  previousAveragePosition: number | null;
  positionChange: number | null;
  direction: RankDirection;
  lastUpdated: string;
}

export interface GscRankTrackingSummary {
  recordsCount: number;
  keywordsCount: number;
  urlsCount: number;
  totalClicks: number;
  totalImpressions: number;
  averagePosition: number | null;
  newKeywords: number;
  improvedKeywords: number;
  droppedKeywords: number;
}

export interface GscRankTrackingReport {
  projectSlug: string;
  generatedAt: string;
  outputPath: string;
  backupPath: string | null;
  source: "google-search-console";
  sourceMethod: "search-analytics-query-page";
  dateRange: {
    startDate: string;
    endDate: string;
    days: number;
  };
  searchAnalytics: {
    attempted: boolean;
    authMethod: AuthMethod;
    property: string | null;
    rowCount: number;
    error: string | null;
  };
  summary: GscRankTrackingSummary;
  topKeywordsByImpressions: GscRankTrackingRecord[];
  topKeywordsByClicks: GscRankTrackingRecord[];
  topRankingOpportunities: GscRankTrackingRecord[];
  records: GscRankTrackingRecord[];
}

export interface BuildGscRankTrackingOptions {
  outputDir?: string;
  days?: number;
  rowLimit?: number;
}

interface RegistryFile {
  pages?: Array<{ url?: string; status?: string }>;
}

interface GscSummary {
  property?: string;
}

interface SearchAnalyticsRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

function projectDir(projectSlug: string, outputDir: string): string {
  return path.join(outputDir, projectSlug);
}

function outputPath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "rank-tracking.json");
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
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    parsed.hash = "";
    parsed.search = "";
    if (parsed.pathname.endsWith("/") && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return url.trim();
  }
}

function fmtDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateRange(days: number): { startDate: string; endDate: string; days: number } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { startDate: fmtDate(start), endDate: fmtDate(end), days };
}

function siteFromProject(projectSlug: string, outputDir: string): string | null {
  const dir = projectDir(projectSlug, outputDir);
  const summary = safeReadJson<GscSummary>(path.join(dir, "gsc-summary.json"));
  if (summary?.property) return summary.property;

  const registry = safeReadJson<RegistryFile>(path.join(dir, "page-registry.json"));
  for (const page of registry?.pages ?? []) {
    if (!page.url) continue;
    try {
      const parsed = new URL(page.url);
      return `${parsed.protocol}//${parsed.hostname}/`;
    } catch {
      // skip malformed registry URL
    }
  }
  return null;
}

function recordKey(keyword: string, url: string): string {
  return `${keyword.toLowerCase().trim()}::${normaliseUrl(url)}`;
}

function backupExistingReport(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = file.replace(/\.json$/, `.${stamp}.bak.json`);
  fs.copyFileSync(file, backup);
  return backup;
}

function positionTrend(
  current: number,
  previous: number | null,
): Pick<GscRankTrackingRecord, "previousAveragePosition" | "positionChange" | "direction"> {
  if (previous === null) {
    return { previousAveragePosition: null, positionChange: null, direction: "new" };
  }

  const change = Number((previous - current).toFixed(2));
  if (Math.abs(change) < 0.01) {
    return { previousAveragePosition: previous, positionChange: 0, direction: "same" };
  }

  return {
    previousAveragePosition: previous,
    positionChange: change,
    direction: change > 0 ? "up" : "down",
  };
}

function weightedAveragePosition(records: GscRankTrackingRecord[]): number | null {
  const withImpressions = records.filter((record) => record.impressions > 0);
  if (!withImpressions.length) return null;
  const impressions = withImpressions.reduce((sum, record) => sum + record.impressions, 0);
  if (!impressions) return null;
  const weighted = withImpressions.reduce((sum, record) => sum + record.averagePosition * record.impressions, 0);
  return Number((weighted / impressions).toFixed(2));
}

function buildSummary(records: GscRankTrackingRecord[]): GscRankTrackingSummary {
  return {
    recordsCount: records.length,
    keywordsCount: new Set(records.map((record) => record.keyword.toLowerCase())).size,
    urlsCount: new Set(records.map((record) => normaliseUrl(record.url))).size,
    totalClicks: records.reduce((sum, record) => sum + record.clicks, 0),
    totalImpressions: records.reduce((sum, record) => sum + record.impressions, 0),
    averagePosition: weightedAveragePosition(records),
    newKeywords: records.filter((record) => record.direction === "new").length,
    improvedKeywords: records.filter((record) => record.direction === "up").length,
    droppedKeywords: records.filter((record) => record.direction === "down").length,
  };
}

async function fetchQueryPageAnalytics(params: {
  siteUrl: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  rowLimit: number;
}): Promise<SearchAnalyticsRow[]> {
  const res = await fetch(`${GSC_WEBMASTERS_BASE}/${encodeURIComponent(params.siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: ["query", "page"],
      rowLimit: params.rowLimit,
    }),
  });

  if (!res.ok) {
    throw new Error(`Search Analytics API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = await res.json() as { rows?: SearchAnalyticsRow[] };
  return data.rows ?? [];
}

export async function buildGscRankTracking(
  projectSlug: string,
  options: BuildGscRankTrackingOptions = {},
): Promise<GscRankTrackingReport> {
  const outputDir = options.outputDir ?? "output";
  const outPath = outputPath(projectSlug, outputDir);
  const previous = safeReadJson<GscRankTrackingReport>(outPath);
  const previousByKey = new Map<string, GscRankTrackingRecord>(
    (previous?.records ?? []).map((record) => [recordKey(record.keyword, record.url), record]),
  );

  const range = dateRange(options.days ?? 90);
  const authMethod = detectAuthMethod();
  const siteUrl = siteFromProject(projectSlug, outputDir);
  const generatedAt = new Date().toISOString();
  const searchAnalytics = {
    attempted: true,
    authMethod,
    property: siteUrl,
    rowCount: 0,
    error: null as string | null,
  };

  let rawRows: SearchAnalyticsRow[] = [];
  try {
    const accessToken = await fetchAccessToken();
    if (!accessToken || !siteUrl) {
      throw new Error("No GSC access token or property available for rank tracking.");
    }
    rawRows = await fetchQueryPageAnalytics({
      siteUrl,
      accessToken,
      startDate: range.startDate,
      endDate: range.endDate,
      rowLimit: options.rowLimit ?? 25000,
    });
    searchAnalytics.rowCount = rawRows.length;
  } catch (error) {
    searchAnalytics.error = (error as Error).message || String(error);
  }

  if (searchAnalytics.error) {
    throw new Error(searchAnalytics.error);
  }

  const records = rawRows
    .map((row): GscRankTrackingRecord | null => {
      const keyword = String(row.keys?.[0] || "").trim();
      const url = normaliseUrl(String(row.keys?.[1] || "").trim());
      if (!keyword || !url.startsWith("http")) return null;

      const clicks = Number(row.clicks || 0);
      const impressions = Number(row.impressions || 0);
      const ctr = typeof row.ctr === "number" ? row.ctr : impressions > 0 ? clicks / impressions : 0;
      const averagePosition = Number(Number(row.position || 0).toFixed(2));
      const previousRecord = previousByKey.get(recordKey(keyword, url));

      return {
        keyword,
        url,
        clicks,
        impressions,
        ctr: Number(ctr.toFixed(4)),
        averagePosition,
        ...positionTrend(averagePosition, previousRecord?.averagePosition ?? null),
        lastUpdated: generatedAt,
      };
    })
    .filter((record): record is GscRankTrackingRecord => Boolean(record))
    .sort((a, b) =>
      b.impressions - a.impressions ||
      b.clicks - a.clicks ||
      a.averagePosition - b.averagePosition ||
      a.keyword.localeCompare(b.keyword) ||
      a.url.localeCompare(b.url)
    );

  const summary = buildSummary(records);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const backupPath = backupExistingReport(outPath);

  const report: GscRankTrackingReport = {
    projectSlug,
    generatedAt,
    outputPath: outPath,
    backupPath,
    source: "google-search-console",
    sourceMethod: "search-analytics-query-page",
    dateRange: range,
    searchAnalytics,
    summary,
    topKeywordsByImpressions: [...records]
      .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.averagePosition - b.averagePosition)
      .slice(0, 10),
    topKeywordsByClicks: [...records]
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions || a.averagePosition - b.averagePosition)
      .slice(0, 10),
    topRankingOpportunities: records
      .filter((record) => record.impressions >= 10 && record.clicks <= 1 && record.averagePosition >= 8 && record.averagePosition <= 30)
      .sort((a, b) => b.impressions - a.impressions || a.clicks - b.clicks || a.averagePosition - b.averagePosition)
      .slice(0, 10),
    records,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
