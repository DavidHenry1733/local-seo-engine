/**
 * Pharmacy Visibility Tracking Bridge V1 — keyword visibility estimates from existing data.
 */
import fs from "node:fs";
import path from "node:path";
import type { GscRankTrackingRecord, GscRankTrackingReport } from "../tracking/gscRankTrackingEngine.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  readPharmacyIndexingSummary,
  readPharmacyRegistry,
  type PharmacyRegistryPage,
} from "./pharmacyIndexingBridgeService.ts";
import { BENCHMARK_MASTER_SERVICE_IDS, getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { countTrackedKeywords, resolveServiceKeywords } from "./pharmacyVisibilityKeywordMappings.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import {
  localityUnavailableLabel,
  resolveTenantLocality,
} from "./masterAdminPrimaryLocalityService.ts";

export type ServiceVisibilityStatus = "visible" | "pending" | "not_visible" | "awaiting_index";

export interface PharmacyVisibilityService {
  serviceId: string;
  pageUrl: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  indexedStatus: string;
  visibilityStatus: ServiceVisibilityStatus;
  estimatedPosition: number | null;
  impressions: number;
  clicks: number;
  competitorOpportunity: string;
  recommendedAction: string;
}

export interface KeywordOpportunity {
  keyword: string;
  serviceId: string;
  opportunity: string;
  estimatedPosition: number | null;
}

export interface PharmacyVisibilityReport {
  version: 1;
  slug: string;
  trackedPages: number;
  trackedServices: number;
  trackedKeywords: number;
  estimatedVisibilityScore: number;
  indexedPageCount: number;
  visiblePageCount: number;
  visibilityStatus: string;
  competitorGap: string;
  lastCheckedAt: string;
  topKeywordOpportunities: KeywordOpportunity[];
  recommendedActions: string[];
  services: PharmacyVisibilityService[];
}

interface CompetitorDashboard {
  serviceCoverage?: Array<{
    serviceId: string;
    serviceName?: string;
    competitorCoveragePct?: number;
    gapLevel?: string;
    leadingCompetitors?: string[];
  }>;
  opportunities?: Array<{
    title?: string;
    action?: string;
    priority?: string;
    relatedServices?: string[];
    impact?: string;
  }>;
  gaps?: {
    visibilityGap?: { summary?: string; level?: string; score?: number };
  };
}

function safeSlug(slug: string): string {
  return String(slug || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function visibilityPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-visibility", `${safeSlug(slug)}.json`);
}

function resolveTown(slug: string): string {
  const profileDoc = readJson<{ data?: Record<string, unknown> }>(
    path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${safeSlug(slug)}.json`),
  );
  const profile = normalizeProfileData(profileDoc?.data || {});
  const locality = resolveTenantLocality(profile);
  return locality.available && locality.value ? locality.value : localityUnavailableLabel();
}

function readCompetitorDashboard(slug: string): CompetitorDashboard | null {
  return (
    readJson<CompetitorDashboard>(
      path.join(WORKSPACE_ROOT, "data/pharmacy-competitor-intelligence", `${safeSlug(slug)}-dashboard.json`),
    ) ||
    readJson<CompetitorDashboard>(
      path.join(WORKSPACE_ROOT, "data/pharmacy-opportunity-engine", `${safeSlug(slug)}-dashboard.json`),
    )
  );
}

function readGscRankReport(slug: string): GscRankTrackingReport | null {
  const file = path.join(WORKSPACE_ROOT, "output", safeSlug(slug), "rank-tracking.json");
  return readJson<GscRankTrackingReport>(file);
}

function findGscRecord(records: GscRankTrackingRecord[], keyword: string, pageUrl: string): GscRankTrackingRecord | undefined {
  const kw = keyword.toLowerCase();
  return records.find(
    (r) =>
      r.keyword.toLowerCase() === kw ||
      (r.url === pageUrl && r.keyword.toLowerCase().includes(kw.split(" ")[0] || "")),
  );
}

function mapIndexedStatus(page: PharmacyRegistryPage | undefined): string {
  return page?.indexingStatus || "not_registered";
}

function deriveVisibilityStatus(indexedStatus: string): ServiceVisibilityStatus {
  if (indexedStatus === "indexed") return "visible";
  if (indexedStatus === "submitted") return "pending";
  if (indexedStatus === "not_indexed" || indexedStatus === "failed") return "not_visible";
  return "awaiting_index";
}

function simulatePosition(serviceId: string, competitorCoveragePct: number, indexed: boolean): number | null {
  if (!indexed) return null;
  const idx = BENCHMARK_MASTER_SERVICE_IDS.indexOf(serviceId as (typeof BENCHMARK_MASTER_SERVICE_IDS)[number]);
  const base = 8 + (idx >= 0 ? idx : 0);
  const competitionPenalty = Math.round(competitorCoveragePct / 10);
  return Math.min(50, Math.max(3, base + competitionPenalty));
}

function simulateTraffic(indexed: boolean, position: number | null): { impressions: number; clicks: number } {
  if (!indexed || position == null) return { impressions: 0, clicks: 0 };
  const impressions = Math.max(20, Math.round(180 / Math.sqrt(position)));
  const ctr = position <= 5 ? 0.08 : position <= 10 ? 0.05 : 0.02;
  return { impressions, clicks: Math.max(1, Math.round(impressions * ctr)) };
}

function serviceCoverageFor(dash: CompetitorDashboard | null, serviceId: string) {
  return dash?.serviceCoverage?.find((s) => s.serviceId === serviceId);
}

function opportunityFor(dash: CompetitorDashboard | null, serviceId: string) {
  return dash?.opportunities?.find((o) => o.relatedServices?.includes(serviceId));
}

function competitorOpportunityText(
  coverage: ReturnType<typeof serviceCoverageFor>,
  visibilityGap: string,
): string {
  if (coverage) {
    const pct = coverage.competitorCoveragePct ?? 0;
    const leaders = (coverage.leadingCompetitors || []).slice(0, 2).join(", ");
    return `${pct}% of local competitors promote ${coverage.serviceName || coverage.serviceId}${leaders ? ` — leaders include ${leaders}` : ""}.`;
  }
  return visibilityGap || "Run competitor intelligence for service-level gap analysis.";
}

function recommendedActionText(
  indexedStatus: string,
  visibilityStatus: ServiceVisibilityStatus,
  opportunity: ReturnType<typeof opportunityFor>,
  serviceName: string,
): string {
  if (opportunity?.action) return opportunity.action;
  if (visibilityStatus === "awaiting_index" || indexedStatus === "ready_to_submit") {
    return `Submit ${serviceName} page for indexing to begin visibility tracking.`;
  }
  if (visibilityStatus === "pending") {
    return `Monitor ${serviceName} indexing status — refresh once Google confirms the page is indexed.`;
  }
  if (visibilityStatus === "not_visible") {
    return `Improve ${serviceName} local signals and resubmit for indexing review.`;
  }
  return `Maintain ${serviceName} rankings with local proof points and review requests.`;
}

function computeEstimatedScore(services: PharmacyVisibilityService[]): number {
  if (!services.length) return 0;
  const visible = services.filter((s) => s.visibilityStatus === "visible").length;
  const pending = services.filter((s) => s.visibilityStatus === "pending").length;
  const positionScore =
    services
      .filter((s) => s.estimatedPosition != null)
      .reduce((sum, s) => sum + Math.max(0, 100 - (s.estimatedPosition || 50) * 2), 0) /
    Math.max(1, services.filter((s) => s.estimatedPosition != null).length);

  const coverageScore = Math.round((visible / services.length) * 60 + (pending / services.length) * 20);
  return Math.min(100, Math.round(coverageScore * 0.6 + positionScore * 0.4));
}

function overallVisibilityStatus(score: number, indexedCount: number, visibleCount: number): string {
  if (visibleCount >= indexedCount && indexedCount > 0 && score >= 60) return "improving";
  if (indexedCount > 0 || visibleCount > 0) return "building";
  return "needs_attention";
}

export function readPharmacyVisibilityReport(slug: string): PharmacyVisibilityReport | null {
  return readJson<PharmacyVisibilityReport>(visibilityPath(slug));
}

export function refreshPharmacyVisibility(slug: string): {
  reportPath: string;
  report: PharmacyVisibilityReport;
} {
  const safe = safeSlug(slug);
  const town = resolveTown(safe);
  const registry = readPharmacyRegistry(safe);
  const indexingSummary = readPharmacyIndexingSummary(safe);
  const competitorDash = readCompetitorDashboard(safe);
  const gscReport = readGscRankReport(safe);
  const gscRecords = gscReport?.records || [];
  const visibilityGap = competitorDash?.gaps?.visibilityGap?.summary || "Competitor visibility gap not yet analysed.";
  const now = new Date().toISOString();

  const registryByService = new Map(
    (registry?.pages || []).filter((p) => p.pageType === "service").map((p) => [p.serviceId, p]),
  );

  const services: PharmacyVisibilityService[] = BENCHMARK_MASTER_SERVICE_IDS.map((serviceId) => {
    const page = registryByService.get(serviceId);
    const keywords = resolveServiceKeywords(serviceId, town);
    const meta = getServicePublishMeta(serviceId);
    const serviceName = meta?.serviceName || serviceId;
    const pageUrl = page?.url || page?.canonicalUrl || meta?.urlPath || `/${serviceId}/`;
    const indexedStatus = mapIndexedStatus(page);
    const visibilityStatus = deriveVisibilityStatus(indexedStatus);
    const coverage = serviceCoverageFor(competitorDash, serviceId);
    const opportunity = opportunityFor(competitorDash, serviceId);

    const primaryKeyword = keywords?.primaryKeyword || `${serviceName} ${town}`;
    const secondaryKeywords = keywords?.secondaryKeywords || [];

    const gscRecord =
      findGscRecord(gscRecords, primaryKeyword, pageUrl) ||
      secondaryKeywords.map((k) => findGscRecord(gscRecords, k, pageUrl)).find(Boolean);

    const indexed = indexedStatus === "indexed";
    const estimatedPosition =
      gscRecord?.averagePosition ??
      simulatePosition(serviceId, coverage?.competitorCoveragePct ?? 50, indexed);

    const traffic = gscRecord
      ? { impressions: gscRecord.impressions, clicks: gscRecord.clicks }
      : simulateTraffic(indexed, estimatedPosition);

    const effectiveVisibility: ServiceVisibilityStatus =
      indexed && estimatedPosition != null && estimatedPosition <= 30 ? "visible" : visibilityStatus;

    return {
      serviceId,
      pageUrl,
      primaryKeyword,
      secondaryKeywords,
      indexedStatus,
      visibilityStatus: effectiveVisibility,
      estimatedPosition,
      impressions: traffic.impressions,
      clicks: traffic.clicks,
      competitorOpportunity: competitorOpportunityText(coverage, visibilityGap),
      recommendedAction: recommendedActionText(indexedStatus, effectiveVisibility, opportunity, serviceName),
    };
  });

  const indexedPageCount = indexingSummary?.indexed ?? services.filter((s) => s.indexedStatus === "indexed").length;
  const visiblePageCount = services.filter((s) => s.visibilityStatus === "visible").length;
  const estimatedVisibilityScore = computeEstimatedScore(services);

  const topKeywordOpportunities: KeywordOpportunity[] = services
    .map((s) => ({
      keyword: s.primaryKeyword,
      serviceId: s.serviceId,
      opportunity: s.competitorOpportunity,
      estimatedPosition: s.estimatedPosition,
    }))
    .sort((a, b) => (a.estimatedPosition ?? 99) - (b.estimatedPosition ?? 99))
    .slice(0, 5);

  const recommendedActions = [
    ...new Set(
      services
        .filter((s) => s.visibilityStatus !== "visible")
        .map((s) => s.recommendedAction)
        .concat(
          (competitorDash?.opportunities || [])
            .filter((o) => o.priority === "High" || o.priority === "Critical")
            .slice(0, 3)
            .map((o) => o.action || o.title || "")
            .filter(Boolean),
        ),
    ),
  ].slice(0, 5);

  const report: PharmacyVisibilityReport = {
    version: 1,
    slug: safe,
    trackedPages: services.length,
    trackedServices: services.length,
    trackedKeywords: countTrackedKeywords(town),
    estimatedVisibilityScore,
    indexedPageCount,
    visiblePageCount,
    visibilityStatus: overallVisibilityStatus(estimatedVisibilityScore, indexedPageCount, visiblePageCount),
    competitorGap: visibilityGap,
    lastCheckedAt: now,
    topKeywordOpportunities,
    recommendedActions,
    services,
  };

  const file = visibilityPath(safe);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2));

  return { reportPath: file, report };
}

export function getPharmacyVisibilityStatus(slug: string): {
  report: PharmacyVisibilityReport | null;
  reportPath: string;
  reportExists: boolean;
} {
  const safe = safeSlug(slug);
  const file = visibilityPath(safe);
  return {
    report: readPharmacyVisibilityReport(safe),
    reportPath: file,
    reportExists: fs.existsSync(file),
  };
}

export function computeVisibilityRoadmapPct(report: PharmacyVisibilityReport | null): number {
  if (!report || report.trackedServices === 0) return 0;
  if (report.estimatedVisibilityScore > 0) return report.estimatedVisibilityScore;
  return Math.round((report.visiblePageCount / report.trackedServices) * 100);
}

export function countIndexedServices(report: PharmacyVisibilityReport | null): number {
  if (!report) return 0;
  return report.services.filter((s) => s.indexedStatus === "indexed").length;
}
