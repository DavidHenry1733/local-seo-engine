/**
 * NT-E2E-14 — Commercial Performance Dashboard (final commercial workflow stage).
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import {
  finishWorkflowExecution,
  getLastRecordedWorkflowStage,
  recordWorkflowTransition,
  startWorkflowExecution,
} from "./masterAdminWorkflowHistoryService.ts";
import { readPharmacyIndexingSummary } from "./pharmacyIndexingBridgeService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { resolveGoogleProfileOnboardingState } from "./masterAdminGoogleProfileOnboardingService.ts";
import { readLatestCommercialIndexingApproval } from "./masterAdminCommercialIndexingReviewService.ts";

export interface CommercialPerformancePageRow {
  title: string;
  url: string;
  position: string;
  impressions: string;
  clicks: string;
  ctr: string;
}

export interface CommercialPerformanceAcknowledgement {
  version: 1;
  slug: string;
  acknowledgedAt: string;
  acknowledgedBy: string;
}

export interface CommercialPerformanceDashboard {
  version: 1;
  slug: string;
  pharmacyName: string;
  indexedPages: number;
  rankedPages: number;
  averagePosition: string;
  impressions: string;
  clicks: string;
  ctr: string;
  topPerformingPages: CommercialPerformancePageRow[];
  topOpportunities: string[];
  seoHealthLabel: string;
  commercialHealthLabel: string;
  growthTrendLabel: string;
  googleBusinessProfileStatus: string;
  lastUpdate: string | null;
  canRefresh: boolean;
  canComplete: boolean;
  completed: boolean;
  narrative: string;
  nextStep: string;
}

const ACK_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-performance-dashboard");

function ackPath(slug: string): string {
  return path.join(ACK_DIR, slug, "latest.json");
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

export function readLatestCommercialPerformanceAcknowledgement(slug: string): CommercialPerformanceAcknowledgement | null {
  const file = ackPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as CommercialPerformanceAcknowledgement;
  } catch {
    return null;
  }
}

function readRankTracking(slug: string): {
  keywords?: Array<{ keyword?: string; position?: number; impressions?: number; clicks?: number }>;
  updatedAt?: string;
} | null {
  const file = path.join(WORKSPACE_ROOT, "output", slug, "rank-tracking.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function fmtNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Not available";
  return String(Math.round(value));
}

function fmtPosition(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Not available";
  return value.toFixed(1);
}

function fmtCtr(clicks: number, impressions: number): string {
  if (!impressions) return "Not available";
  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

function googleStatusLabel(slug: string): string {
  const profile = readSetupProfile(slug);
  const state = resolveGoogleProfileOnboardingState(profile);
  if (state === "no_profile") return "No Google Business Profile connected";
  if (state === "deferred") return "Google profile setup deferred";
  if (profile.googleImportSnapshot?.importedAt) return "Google Business Profile connected";
  return "Google Business Profile linked — review recommended";
}

export function buildCommercialPerformanceDashboard(slug: string): CommercialPerformanceDashboard {
  const ctx = loadMasterAdminCustomerContext(slug);
  const profile = readSetupProfile(slug);
  const visibility = readPharmacyVisibilityReport(slug);
  const indexing = readPharmacyIndexingSummary(slug);
  const rank = readRankTracking(slug);
  const ack = readLatestCommercialPerformanceAcknowledgement(slug);
  const indexingApproval = readLatestCommercialIndexingApproval(slug);

  const services = visibility?.services || [];
  const ranked = services.filter((s) => s.estimatedPosition != null && s.estimatedPosition <= 50);
  const totalImpressions = services.reduce((sum, s) => sum + (s.impressions || 0), 0);
  const totalClicks = services.reduce((sum, s) => sum + (s.clicks || 0), 0);
  const avgPosition =
    ranked.length > 0
      ? ranked.reduce((sum, s) => sum + (s.estimatedPosition || 0), 0) / ranked.length
      : null;

  const topPerformingPages: CommercialPerformancePageRow[] = [...services]
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 6)
    .map((s) => ({
      title: s.primaryKeyword,
      url: s.pageUrl,
      position: fmtPosition(s.estimatedPosition),
      impressions: fmtNumber(s.impressions),
      clicks: fmtNumber(s.clicks),
      ctr: fmtCtr(s.clicks || 0, s.impressions || 0),
    }));

  const topOpportunities =
    visibility?.recommendedActions?.slice(0, 5) ||
    visibility?.topKeywordOpportunities?.slice(0, 5).map((k) => `${k.keyword} — ${k.opportunity}`) ||
    ["Performance data will populate as indexing and ranking signals arrive."];

  const seoHealthLabel = visibility
    ? `${visibility.estimatedVisibilityScore}/100 · ${visibility.visibilityStatus.replace(/_/g, " ")}`
    : "Not available yet";

  const commercialHealthLabel = ctx?.live.lastPublishedAt
    ? indexing && indexing.indexed > 0
      ? "Published and indexing in progress"
      : "Published — awaiting indexing signals"
    : "Publish and indexing required before commercial health can be measured";

  const growthTrendLabel =
    rank?.keywords?.length && rank.keywords.length > 0
      ? `${rank.keywords.length} keywords tracked`
      : ranked.length > 0
        ? `${ranked.length} ranked service pages detected`
        : "Early stage — ranking trend not yet available";

  const published = Boolean(ctx?.live.lastPublishedAt);
  const indexingDone = Boolean(indexingApproval?.requestedAt || (indexing && indexing.submitted > 0));
  const canComplete = published && indexingDone && !ack?.acknowledgedAt;

  return {
    version: 1,
    slug,
    pharmacyName: profile.pharmacyName || profile.tradingName || slug,
    indexedPages: indexing?.indexed ?? 0,
    rankedPages: ranked.length || rank?.keywords?.length || 0,
    averagePosition: fmtPosition(avgPosition),
    impressions: fmtNumber(totalImpressions),
    clicks: fmtNumber(totalClicks),
    ctr: fmtCtr(totalClicks, totalImpressions),
    topPerformingPages,
    topOpportunities,
    seoHealthLabel,
    commercialHealthLabel,
    growthTrendLabel,
    googleBusinessProfileStatus: googleStatusLabel(slug),
    lastUpdate: visibility?.lastCheckedAt || indexing?.lastUpdated || rank?.updatedAt || null,
    canRefresh: true,
    canComplete,
    completed: Boolean(ack?.acknowledgedAt),
    narrative: "Your commercial workflow ends here — review live performance, then complete the lifecycle.",
    nextStep: ack?.acknowledgedAt ? "Commercial workflow complete" : "Review performance and complete workflow",
  };
}

export function acknowledgeCommercialPerformanceDashboard(
  slug: string,
  operator: string,
): { ok: boolean; errors: string[]; dashboard: CommercialPerformanceDashboard } {
  const dashboard = buildCommercialPerformanceDashboard(slug);
  if (dashboard.completed) {
    return { ok: true, errors: [], dashboard };
  }
  if (!dashboard.canComplete) {
    return {
      ok: false,
      errors: ["Publish and request indexing before completing the Performance Dashboard."],
      dashboard,
    };
  }

  const snapshot: CommercialPerformanceAcknowledgement = {
    version: 1,
    slug,
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: operator,
  };
  writeJsonAtomic(ackPath(slug), snapshot);

  const recorded = getLastRecordedWorkflowStage(slug);
  if (recorded === "initialise_rank_tracking") {
    startWorkflowExecution({
      slug,
      stageId: "initialise_rank_tracking",
      actionId: "complete_performance_dashboard",
      operator,
    });
    finishWorkflowExecution({
      slug,
      stageId: "initialise_rank_tracking",
      actionId: "complete_performance_dashboard",
      operator,
      evidence: "Performance Dashboard reviewed and completed",
      status: "completed",
    });
    recordWorkflowTransition({
      slug,
      fromStage: "initialise_rank_tracking",
      toStage: "monitoring",
      operator,
      reason: "Commercial workflow completed",
      evidence: snapshot.acknowledgedAt,
    });
  }

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "complete_commercial_performance_dashboard",
    status: "success",
    evidence: "Performance Dashboard completed",
  });

  return { ok: true, errors: [], dashboard: buildCommercialPerformanceDashboard(slug) };
}

export function refreshCommercialPerformanceDashboard(slug: string): CommercialPerformanceDashboard {
  return buildCommercialPerformanceDashboard(slug);
}
