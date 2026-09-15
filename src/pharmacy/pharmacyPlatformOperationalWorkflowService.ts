/**
 * Platform Operational Workflow — aggregates existing module data into one operational view.
 * No content generation; read-only bridge aggregation only.
 */
import fs from "node:fs";
import path from "node:path";
import { getBenchmarkPublishServices, getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { getServiceCatalog, type ServiceCatalogEntry } from "./pharmacyCampaignService.ts";
import { getCampaignImageSummary, type CampaignImageSlotStatus } from "./pharmacyCampaignImageStatusService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { readPharmacyIndexingSummary, readPharmacyRegistry } from "./pharmacyIndexingBridgeService.ts";
import { loadOpportunityEngineResult, type Opportunity } from "./pharmacyOpportunityEngine.ts";
import { loadGapAnalysis, type ServiceCoverageRow } from "./pharmacyCompetitorGapAnalysis.ts";
import { readPharmacyGrowthActionPlan } from "./pharmacyGrowthActionPlanService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { getAuthorityPublishGateSnapshot, type PublishGate } from "./pharmacyAuthorityReadinessService.ts";

export interface ImageCentreServiceRow {
  serviceId: string;
  serviceName: string;
  assignedCount: number;
  totalSlots: number;
  completionPct: number;
  slots: CampaignImageSlotStatus[];
  campaignDetailUrl: string | null;
}

export interface ImageCentreSummary {
  services: ImageCentreServiceRow[];
  averageCompletionPct: number;
  fullyAssignedCount: number;
}

export interface EcosystemExpansionRow extends ServiceCatalogEntry {
  ecosystemLabel: "available" | "not_generated";
  publishedLabel: string;
  indexingLabel: string;
  visibilityLabel: string;
  previewUrl: string;
}

export interface PublishingWorkflowStage {
  id: "ready" | "published" | "submitted" | "indexed" | "visible";
  label: string;
  status: "complete" | "current" | "pending";
  nextAction: string | null;
  expectedOutcome: string;
}

export interface PublishingWorkflowService {
  serviceId: string;
  serviceName: string;
  currentStage: PublishingWorkflowStage["id"];
  currentStageLabel: string;
  nextAction: string;
  expectedOutcome: string;
  stages: PublishingWorkflowStage[];
  authorityPublishGate: PublishGate;
  livePublishBlocked: boolean;
  livePublishBlockReason: string | null;
}

export interface CompetitorGapServiceInsight {
  serviceId: string;
  serviceName: string;
  gapLevel: string;
  competitorCoveragePct: number;
  whyCompetitorRanks: string;
  missingAssets: string[];
  recommendedAction: string;
  leadingCompetitors: string[];
}

export interface CompetitorGapSummary {
  visibilityGapSummary: string;
  serviceGapSummary: string;
  services: CompetitorGapServiceInsight[];
  dashboardUrl: string;
}

export interface OpportunityGroup {
  priority: "High" | "Medium" | "Low";
  opportunities: Array<{
    title: string;
    impact: string;
    action: string;
    category: string;
    relatedServices: string[];
  }>;
}

export interface CampaignRecommendation {
  serviceId: string;
  serviceName: string;
  reason: string;
  priority: string;
  action: string;
}

export interface OpportunityEngineSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  groups: OpportunityGroup[];
  serviceCoverageGaps: ServiceCoverageRow[];
  visibilityGaps: string[];
  campaignRecommendations: CampaignRecommendation[];
  dashboardUrl: string;
}

export interface PlatformWhereYouAre {
  headline: string;
  ecosystemCount: number;
  totalServices: number;
  imageCompletionPct: number;
  publishingStage: string;
  openActions: number;
  topOpportunity: string | null;
}

export interface PlatformOperationalWorkflow {
  slug: string;
  whereYouAre: PlatformWhereYouAre;
  imageCentre: ImageCentreSummary;
  ecosystemExpansion: EcosystemExpansionRow[];
  publishingWorkflow: PublishingWorkflowService[];
  competitorGaps: CompetitorGapSummary;
  opportunities: OpportunityEngineSummary;
}

function safeSlug(slug: string): string {
  return (
    String(slug || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

function ecosystemIndexPath(slug: string, serviceId: string): string {
  return path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    safeSlug(slug),
    serviceId,
    "_ecosystem-index.json",
  );
}

function publishIndexPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-publish", safeSlug(slug), "_publish-index.json");
}

function resolveLiveBridge(slug: string, serviceId: string) {
  const s = safeSlug(slug);
  const publishIndex = fs.existsSync(publishIndexPath(s))
    ? (JSON.parse(fs.readFileSync(publishIndexPath(s), "utf8")) as { pages: Array<{ serviceId: string; pageType: string }> })
    : null;
  const publishPages = (publishIndex?.pages || []).filter((p) => p.serviceId === serviceId);
  const rootPublished = publishPages.some((p) => p.pageType === "service");
  const registry = readPharmacyRegistry(s);
  const rootPage =
    registry?.pages.find((p) => p.serviceId === serviceId && p.pageType === "service") ||
    registry?.pages.find((p) => p.serviceId === serviceId) ||
    null;
  const visibility = readPharmacyVisibilityReport(s);
  const visibilityService = visibility?.services.find((svc) => svc.serviceId === serviceId);
  const meta = getServicePublishMeta(serviceId);
  const masterPath = meta ? path.join(WORKSPACE_ROOT, "docs/pharmacy-master-library", meta.masterFile) : "";

  let publishingStatus: "published" | "partial" | "pending" = "pending";
  if (rootPublished && publishPages.length > 1) publishingStatus = "published";
  else if (rootPublished) publishingStatus = "partial";

  return {
    publishedPages: publishPages.length,
    indexedPages: rootPage?.indexingStatus === "indexed" ? 1 : 0,
    visiblePages: visibilityService?.visibilityStatus === "visible" ? 1 : 0,
    publishingStatus,
    indexingStatus: rootPage?.indexingStatus || "not_registered",
    visibilityStatus: visibilityService?.visibilityStatus || "unknown",
    ecosystemAvailable: fs.existsSync(ecosystemIndexPath(s, serviceId)),
    masterReady: masterPath ? fs.existsSync(masterPath) : false,
  };
}

function mapPublishingStage(live: ReturnType<typeof resolveLiveBridge>): PublishingWorkflowStage["id"] {
  if (live.visibilityStatus === "visible" && live.visiblePages > 0) return "visible";
  if (live.indexingStatus === "indexed" || live.indexedPages > 0) return "indexed";
  if (live.indexingStatus === "submitted") return "submitted";
  if (live.publishingStatus === "published" || live.publishingStatus === "partial") return "published";
  return "ready";
}

const STAGE_META: Record<
  PublishingWorkflowStage["id"],
  { label: string; expectedOutcome: string; nextAction: string }
> = {
  ready: {
    label: "Ready",
    expectedOutcome: "Content ecosystem and images confirmed — ready to publish",
    nextAction: "Confirm images and publish service pages",
  },
  published: {
    label: "Published",
    expectedOutcome: "Live pages on pharmacy site — ready for search engine registration",
    nextAction: "Update sitemap and submit pages for indexing",
  },
  submitted: {
    label: "Submitted",
    expectedOutcome: "Pages submitted to Google Search Console — awaiting crawl",
    nextAction: "Refresh indexing status and monitor crawl",
  },
  indexed: {
    label: "Indexed",
    expectedOutcome: "Pages indexed by Google — visibility tracking active",
    nextAction: "Refresh visibility tracking and growth actions",
  },
  visible: {
    label: "Visible",
    expectedOutcome: "Service visible in local search — capture growth opportunities",
    nextAction: "Review competitor gaps and opportunity engine recommendations",
  },
};

function buildPublishingStages(current: PublishingWorkflowStage["id"]): PublishingWorkflowStage[] {
  const order: PublishingWorkflowStage["id"][] = ["ready", "published", "submitted", "indexed", "visible"];
  const currentIdx = order.indexOf(current);
  return order.map((id, i) => ({
    id,
    label: STAGE_META[id].label,
    status: i < currentIdx ? "complete" : i === currentIdx ? "current" : "pending",
    nextAction: i === currentIdx ? STAGE_META[id].nextAction : null,
    expectedOutcome: STAGE_META[id].expectedOutcome,
  }));
}

function buildImageCentre(slug: string): ImageCentreSummary {
  const services = getBenchmarkPublishServices().map((meta) => {
    const summary = getCampaignImageSummary(slug, meta.serviceId);
    return {
      serviceId: meta.serviceId,
      serviceName: meta.serviceName,
      assignedCount: summary.assignedCount,
      totalSlots: summary.totalSlots,
      completionPct: summary.totalSlots ? Math.round((summary.assignedCount / summary.totalSlots) * 100) : 0,
      slots: summary.slots,
      campaignDetailUrl: `/api/pharmacy-campaigns?slug=${safeSlug(slug)}&campaignId=`,
    };
  });
  const averageCompletionPct = services.length
    ? Math.round(services.reduce((s, r) => s + r.completionPct, 0) / services.length)
    : 0;
  return {
    services,
    averageCompletionPct,
    fullyAssignedCount: services.filter((s) => s.completionPct === 100).length,
  };
}

function buildEcosystemExpansion(slug: string): EcosystemExpansionRow[] {
  return getServiceCatalog(slug).map((row) => ({
    ...row,
    ecosystemLabel: row.ecosystemAvailability === "available" ? "available" : "not_generated",
    publishedLabel: row.publishedStatus.replace(/_/g, " "),
    indexingLabel: row.indexingStatus.replace(/_/g, " "),
    visibilityLabel: row.visibilityStatus.replace(/_/g, " "),
    previewUrl: `/api/pharmacy-content-ecosystem-preview/${row.serviceId}/`,
  }));
}

function buildPublishingWorkflow(slug: string): PublishingWorkflowService[] {
  return getBenchmarkPublishServices().map((meta) => {
    const live = resolveLiveBridge(slug, meta.serviceId);
    const current = mapPublishingStage(live);
    const stages = buildPublishingStages(current);
    const growthPlan = readPharmacyGrowthActionPlan(slug);
    const authority = getAuthorityPublishGateSnapshot(slug, meta.serviceId);
    const action =
      authority.livePublishBlocked
        ? "Resolve Authority & AI Readiness blockers before live publish"
        : growthPlan?.actions.find(
            (a) =>
              a.linkedUrl.includes(meta.serviceId) ||
              (current === "ready" && a.category === "Content") ||
              (current === "published" && a.category === "Publishing") ||
              (current === "submitted" && a.category === "Indexing") ||
              (current === "indexed" && a.category === "Visibility"),
          )?.recommendedNextStep || STAGE_META[current].nextAction;

    return {
      serviceId: meta.serviceId,
      serviceName: meta.serviceName,
      currentStage: current,
      currentStageLabel: STAGE_META[current].label,
      nextAction: action,
      expectedOutcome: authority.livePublishBlocked
        ? "Live publish blocked until authority audit passes"
        : STAGE_META[current].expectedOutcome,
      stages,
      authorityPublishGate: authority.publishGate,
      livePublishBlocked: !authority.livePublishReady,
      livePublishBlockReason: authority.livePublishReady
        ? null
        : "Authority & AI Readiness has unresolved blockers.",
    };
  });
}

function buildCompetitorGaps(slug: string, primaryServiceId?: string): CompetitorGapSummary {
  const s = safeSlug(slug);
  const gap = loadGapAnalysis(s);
  const opp = loadOpportunityEngineResult(s);
  const dashboard =
    opp?.dashboard ||
    (fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-competitor-intelligence", `${s}-dashboard.json`))
      ? JSON.parse(
          fs.readFileSync(path.join(WORKSPACE_ROOT, "data/pharmacy-competitor-intelligence", `${s}-dashboard.json`), "utf8"),
        )
      : null);

  const coverage: ServiceCoverageRow[] = gap?.serviceCoverage || dashboard?.serviceCoverage || [];
  const visibilityReport = readPharmacyVisibilityReport(s);

  const services: CompetitorGapServiceInsight[] = coverage
    .filter((row) => row.gapLevel === "high" || row.gapLevel === "medium" || row.serviceId === primaryServiceId)
    .slice(0, 10)
    .map((row) => {
      const vis = visibilityReport?.services.find((v) => v.serviceId === row.serviceId);
      const relatedOpps = (dashboard?.opportunities || opp?.opportunities || []).filter(
        (o: Opportunity) => o.relatedServices?.includes(row.serviceId),
      );
      const topOpp = relatedOpps[0];
      return {
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        gapLevel: row.gapLevel,
        competitorCoveragePct: row.competitorCoveragePct,
        whyCompetitorRanks:
          vis?.competitorOpportunity ||
          `${row.leadingCompetitors.slice(0, 2).join(" and ") || "Local competitors"} promote this service more visibly (${row.competitorCoveragePct}% competitor coverage).`,
        missingAssets: [
          row.pharmacyOffers ? null : "Service not marked as offered",
          row.gapLevel === "high" ? "Competitive content and local pages" : null,
          vis?.visibilityStatus !== "visible" ? "Search visibility tracking" : null,
        ].filter(Boolean) as string[],
        recommendedAction: topOpp?.action || `Create or strengthen ${row.serviceName} campaign — close ${row.gapLevel} service gap.`,
        leadingCompetitors: row.leadingCompetitors,
      };
    });

  return {
    visibilityGapSummary: gap?.visibilityGap?.summary || dashboard?.gaps?.visibilityGap?.summary || "Run competitor intelligence for visibility gap analysis.",
    serviceGapSummary: gap?.serviceGap?.summary || dashboard?.gaps?.serviceGap?.summary || "Compare service coverage against local competitors.",
    services,
    dashboardUrl: `/api/pharmacy-competitor-dashboard?slug=${s}`,
  };
}

function buildOpportunitySummary(slug: string): OpportunityEngineSummary {
  const s = safeSlug(slug);
  const opp = loadOpportunityEngineResult(s);
  const gap = loadGapAnalysis(s);
  const opportunities: Opportunity[] = opp?.opportunities || [];

  const toGroup = (priorities: string[], label: "High" | "Medium" | "Low"): OpportunityGroup => ({
    priority: label,
    opportunities: opportunities
      .filter((o) => priorities.includes(o.priority))
      .slice(0, 6)
      .map((o) => ({
        title: o.title,
        impact: o.impact,
        action: o.action,
        category: o.category,
        relatedServices: o.relatedServices || [],
      })),
  });

  const serviceCoverageGaps = (gap?.serviceCoverage || opp?.dashboard?.serviceCoverage || []).filter(
    (r) => r.gapLevel === "high" || r.gapLevel === "medium",
  );

  const visibilityGaps = [
    gap?.visibilityGap?.summary,
    ...(gap?.visibilityGap?.details || []),
  ].filter(Boolean) as string[];

  const campaignRecommendations: CampaignRecommendation[] = serviceCoverageGaps.slice(0, 8).map((row) => ({
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    reason: `${row.gapLevel} gap — ${row.competitorCoveragePct}% of competitors promote this service`,
    priority: row.gapLevel === "high" ? "High" : "Medium",
    action: `Launch ${row.serviceName} campaign — assign images, confirm ecosystem, publish and index`,
  }));

  return {
    critical: opp?.summary?.critical ?? opportunities.filter((o) => o.priority === "Critical").length,
    high: opp?.summary?.high ?? opportunities.filter((o) => o.priority === "High").length,
    medium: opp?.summary?.medium ?? opportunities.filter((o) => o.priority === "Medium").length,
    low: opp?.summary?.low ?? opportunities.filter((o) => o.priority === "Low").length,
    total: opp?.summary?.total ?? opportunities.length,
    groups: [
      toGroup(["Critical", "High"], "High"),
      toGroup(["Medium"], "Medium"),
      toGroup(["Low"], "Low"),
    ],
    serviceCoverageGaps,
    visibilityGaps: visibilityGaps.slice(0, 5),
    campaignRecommendations,
    dashboardUrl: `/api/pharmacy-growth-dashboard?slug=${s}#growth-actions`,
  };
}

export function buildPlatformOperationalWorkflow(
  slug: string,
  primaryServiceId?: string,
): PlatformOperationalWorkflow {
  const s = safeSlug(slug);
  const imageCentre = buildImageCentre(s);
  const ecosystemExpansion = buildEcosystemExpansion(s);
  const publishingWorkflow = buildPublishingWorkflow(s);
  const competitorGaps = buildCompetitorGaps(s, primaryServiceId);
  const opportunities = buildOpportunitySummary(s);
  const growthPlan = readPharmacyGrowthActionPlan(s);

  const primaryPub = primaryServiceId
    ? publishingWorkflow.find((p) => p.serviceId === primaryServiceId)
    : publishingWorkflow[0];

  const whereYouAre: PlatformWhereYouAre = {
    headline: primaryPub
      ? `${primaryPub.serviceName} is at ${primaryPub.currentStageLabel} — ${primaryPub.nextAction}`
      : "Select or create a campaign to begin",
    ecosystemCount: ecosystemExpansion.filter((e) => e.ecosystemAvailability === "available").length,
    totalServices: ecosystemExpansion.length,
    imageCompletionPct: imageCentre.averageCompletionPct,
    publishingStage: primaryPub?.currentStageLabel || "Ready",
    openActions: growthPlan?.pendingActions ?? 0,
    topOpportunity: opportunities.groups[0]?.opportunities[0]?.title || null,
  };

  return {
    slug: s,
    whereYouAre,
    imageCentre,
    ecosystemExpansion,
    publishingWorkflow,
    competitorGaps,
    opportunities,
  };
}
