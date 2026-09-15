/**
 * CPR-GSC-INTEGRATION-V1 — PharmaConnect adapter over Local SEO Engine Search Console artifacts.
 * Reuses existing GSC OAuth, index tracking, summary, and dashboard storage. No duplicate engines.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { readPharmacyIndexingSummary } from "./pharmacyIndexingBridgeService.ts";
import { readTrackingReport } from "../indexing/indexTrackingEngine.ts";
import { detectAuthMethod } from "../indexing/indexTrackingEngine.ts";
import { loadOAuthTokens } from "../../artifacts/api-server/src/routes/api/gscAuth.ts";
import type { IndexDashboard, DashboardUrlRecord } from "../indexing/indexDashboardEngine.ts";

const OUTPUT_DIR = path.join(WORKSPACE_ROOT, "output");

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export interface PharmacySearchConsoleDashboardV1 {
  version: 1;
  slug: string;
  connected: boolean;
  connectionStatus: string;
  authMethod: string;
  property: string | null;
  lastSync: string | null;
  indexing: {
    indexedPages: number | null;
    submittedPages: number | null;
    pendingPages: number | null;
    failedPages: number | null;
    coverageSummary: string | null;
    lastCrawl: string | null;
  };
  performance: {
    impressions: number | null;
    clicks: number | null;
    ctr: string | null;
    averagePosition: string | null;
  };
  insights: {
    topQueries: Array<{ query: string; clicks: number; impressions: number; position: number | null }>;
    topPages: Array<{ url: string; title: string; clicks: number; impressions: number; position: number | null }>;
    recentlyIndexedPages: Array<{ url: string; indexedAt: string | null }>;
    pagesAwaitingIndexing: Array<{ url: string; reason: string | null }>;
  };
  indexHealth: string;
  connectUrl: string;
  refreshUrl: string;
}

function readGscSummary(slug: string) {
  return readJson<{
    property?: string;
    lastUpdated?: string;
    indexedCount?: number | null;
    notIndexedCount?: number | null;
    pagesWithImpressions?: number | null;
    pagesWithClicks?: number | null;
    inspection?: { lastRunAt?: string | null; indexed?: number; notIndexed?: number; checked?: number };
  }>(path.join(OUTPUT_DIR, slug, "gsc-summary.json"));
}

function readIndexDashboard(slug: string): IndexDashboard | null {
  return readJson<IndexDashboard>(path.join(OUTPUT_DIR, slug, "index-dashboard.json"));
}

function aggregatePerformanceFromDashboard(dashboard: IndexDashboard | null): {
  impressions: number;
  clicks: number;
  avgPosition: number | null;
} {
  if (!dashboard) return { impressions: 0, clicks: 0, avgPosition: null };
  let impressions = 0;
  let clicks = 0;
  let weightedPos = 0;
  let weight = 0;
  const groups = dashboard.statusGroups || ({} as IndexDashboard["statusGroups"]);
  const all: DashboardUrlRecord[] = [
    ...(groups.INDEXED || []),
    ...(groups.NOT_INDEXED || []),
    ...(groups.OPPORTUNITY || []),
  ];
  for (const row of all) {
    impressions += row.impressions || 0;
    clicks += row.clicks || 0;
    if (row.averagePosition != null && row.impressions > 0) {
      weightedPos += row.averagePosition * row.impressions;
      weight += row.impressions;
    }
  }
  return {
    impressions,
    clicks,
    avgPosition: weight > 0 ? weightedPos / weight : null,
  };
}

function topPagesFromDashboard(dashboard: IndexDashboard | null): PharmacySearchConsoleDashboardV1["insights"]["topPages"] {
  if (!dashboard) return [];
  const groups = dashboard.statusGroups || ({} as IndexDashboard["statusGroups"]);
  const rows: DashboardUrlRecord[] = [...(groups.INDEXED || []), ...(groups.OPPORTUNITY || [])];
  return rows
    .filter((r) => r.clicks > 0 || r.impressions > 0)
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 8)
    .map((r) => ({
      url: r.url,
      title: r.label || r.slug || r.url,
      clicks: r.clicks,
      impressions: r.impressions,
      position: r.averagePosition,
    }));
}

function pagesAwaitingIndexing(
  tracking: ReturnType<typeof readTrackingReport>,
  dashboard: IndexDashboard | null,
): PharmacySearchConsoleDashboardV1["insights"]["pagesAwaitingIndexing"] {
  const fromTracking =
    tracking?.records
      .filter((r) => r.status === "not_indexed")
      .slice(0, 12)
      .map((r) => ({ url: r.url, reason: "URL inspection: not indexed" })) || [];
  if (fromTracking.length) return fromTracking;
  if (!dashboard) return [];
  return (dashboard.statusGroups?.NOT_INDEXED || []).slice(0, 12).map((r) => ({
    url: r.url,
    reason: r.actionReason || "Not indexed",
  }));
}

function recentlyIndexed(
  tracking: ReturnType<typeof readTrackingReport>,
): PharmacySearchConsoleDashboardV1["insights"]["recentlyIndexedPages"] {
  if (!tracking) return [];
  return tracking.records
    .filter((r) => r.status === "indexed" && r.firstDetectedIndexedAt)
    .sort((a, b) => String(b.firstDetectedIndexedAt).localeCompare(String(a.firstDetectedIndexedAt)))
    .slice(0, 8)
    .map((r) => ({ url: r.url, indexedAt: r.firstDetectedIndexedAt }));
}

export function buildPharmacySearchConsoleDashboard(slug: string): PharmacySearchConsoleDashboardV1 {
  const summary = readGscSummary(slug);
  const indexDashboard = readIndexDashboard(slug);
  const tracking = readTrackingReport(slug, OUTPUT_DIR);
  const pharmacyIndexing = readPharmacyIndexingSummary(slug);
  const bridge = readJson<{ property?: string; submitted?: number; lastSync?: string }>(
    path.join(OUTPUT_DIR, slug, "indexing-bridge.json"),
  );

  const oauthConnected = Boolean(loadOAuthTokens()?.refresh_token);
  const authMethod = detectAuthMethod();
  const connected = oauthConnected || authMethod !== "none" || Boolean(summary?.property || bridge?.property);

  let connectionStatus = "Not connected";
  if (oauthConnected) connectionStatus = "Connected (OAuth)";
  else if (authMethod === "service_account") connectionStatus = "Connected (service account)";
  else if (summary?.property || bridge?.property) connectionStatus = "Connected";

  const indexedPages =
    summary?.indexedCount ??
    indexDashboard?.summary?.indexed ??
    tracking?.indexedCount ??
    pharmacyIndexing?.indexed ??
    null;
  const submittedPages =
    pharmacyIndexing?.submitted ??
    bridge?.submitted ??
    indexDashboard?.summary?.knownToGoogle ??
    null;
  const pendingPages =
    pharmacyIndexing?.readyToSubmit ??
    indexDashboard?.summary?.notIndexed ??
    tracking?.notIndexedCount ??
    null;
  const failedPages = pharmacyIndexing?.notIndexed ?? summary?.notIndexedCount ?? null;

  const perf = aggregatePerformanceFromDashboard(indexDashboard);
  const impressions =
    perf.impressions ||
    summary?.pagesWithImpressions ||
    null;
  const clicks = perf.clicks || summary?.pagesWithClicks || null;
  const avgPos = perf.avgPosition;

  const ctr =
    impressions && clicks != null && impressions > 0
      ? `${((clicks / impressions) * 100).toFixed(1)}%`
      : null;

  const lastSync = summary?.lastUpdated || bridge?.lastSync || pharmacyIndexing?.lastUpdated || indexDashboard?.generatedAt || null;
  const lastCrawl = tracking?.runAt || summary?.inspection?.lastRunAt || null;

  const coverageSummary =
    summary?.indexedCount != null && summary?.notIndexedCount != null
      ? `${summary.indexedCount} indexed · ${summary.notIndexedCount} not indexed in Search Console`
      : indexDashboard?.summary
        ? `${indexDashboard.summary.indexed} indexed · ${indexDashboard.summary.notIndexed} not indexed · ${indexDashboard.summary.opportunities} opportunities`
        : null;

  let indexHealth = "Unknown";
  if (indexedPages != null && pendingPages != null) {
    indexHealth = pendingPages === 0 ? "Healthy" : pendingPages <= 3 ? "Needs attention" : "Action required";
  } else if (connected) {
    indexHealth = "Awaiting sync";
  }

  const topQueries: PharmacySearchConsoleDashboardV1["insights"]["topQueries"] = [];
  // Top queries live in url-lifecycle search analytics map — read lightweight from lifecycle if present
  const lifecycle = readJson<{ searchAnalytics?: { rowCount?: number }; records?: Array<{ url: string; query?: string }> }>(
    path.join(OUTPUT_DIR, slug, "url-lifecycle.json"),
  );
  if (lifecycle?.searchAnalytics?.rowCount) {
    topQueries.push({
      query: `${lifecycle.searchAnalytics.rowCount} queries tracked in lifecycle report`,
      clicks: 0,
      impressions: 0,
      position: null,
    });
  }

  return {
    version: 1,
    slug,
    connected,
    connectionStatus,
    authMethod,
    property: summary?.property || bridge?.property || null,
    lastSync,
    indexing: {
      indexedPages,
      submittedPages,
      pendingPages,
      failedPages,
      coverageSummary,
      lastCrawl,
    },
    performance: {
      impressions,
      clicks,
      ctr,
      averagePosition: avgPos != null ? avgPos.toFixed(1) : null,
    },
    insights: {
      topQueries,
      topPages: topPagesFromDashboard(indexDashboard),
      recentlyIndexedPages: recentlyIndexed(tracking),
      pagesAwaitingIndexing: pagesAwaitingIndexing(tracking, indexDashboard),
    },
    indexHealth,
    connectUrl: "/api/gsc/auth/start",
    refreshUrl: `/api/gsc-summary/refresh/${encodeURIComponent(slug)}`,
  };
}

/** Compact metrics for Master Dashboard customer list cards. */
export function buildPharmacySearchConsoleListMetrics(slug: string): {
  searchConsoleConnected: boolean;
  lastSync: string | null;
  indexedPages: number | null;
  impressions: number | null;
  clicks: number | null;
  averagePosition: string | null;
  indexHealth: string;
  connectionStatus: string;
  property: string | null;
} {
  const dash = buildPharmacySearchConsoleDashboard(slug);
  return {
    searchConsoleConnected: dash.connected,
    lastSync: dash.lastSync,
    indexedPages: dash.indexing.indexedPages,
    impressions: dash.performance.impressions,
    clicks: dash.performance.clicks,
    averagePosition: dash.performance.averagePosition,
    indexHealth: dash.indexHealth,
    connectionStatus: dash.connectionStatus,
    property: dash.property,
  };
}
