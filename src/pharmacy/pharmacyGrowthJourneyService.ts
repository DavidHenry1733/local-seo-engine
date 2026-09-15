/**
 * Pharmacy Growth Journey Dashboard V1 — orchestration layer over existing modules.
 * Does not duplicate scoring or generation logic.
 */
import fs from "node:fs";
import path from "node:path";
import { readTrackingReport } from "../indexing/indexTrackingEngine.ts";
import {
  computeIndexingRoadmapPct,
  readIndexingWorkflowState,
  type IndexingWorkflowState,
} from "./pharmacyIndexingBridgeService.ts";
import {
  computeVisibilityRoadmapPct,
  countIndexedServices,
  readPharmacyVisibilityReport,
} from "./pharmacyVisibilityBridgeService.ts";
import { resolveProductionEmailDisplay } from "./pharmacyProfileProductionSafety.ts";
import {
  countBenchmarkEcosystems,
} from "./benchmarkServiceEcosystemBuilder.ts";
import { readPharmacyGrowthActionPlan } from "./pharmacyGrowthActionPlanService.ts";
import { buildExecutiveDashboard, type ExecutiveDashboardV1, type PrioritisedAction } from "./pharmacyExecutiveDashboardService.ts";
import { computeProfileCompleteness } from "./pharmacyProfileCompleteness.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { getPharmacyPublishingStatus } from "./pharmacyPublishingFoundationService.ts";
import { getPharmacyPublishOutputStatus } from "./pharmacyPublishOutputService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { resolvePharmacySearchConsoleProperty } from "./pharmacyExternalIndexingSubmissionService.ts";
import { buildLocalSearchConsoleWriteAuthority } from "./pharmacySearchConsoleWriteAuthorityService.ts";

export type JourneyStepStatus = "not_started" | "in_progress" | "complete";

export interface JourneyStep {
  id: string;
  step: number;
  title: string;
  status: JourneyStepStatus;
  pct: number;
  summary: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface GrowthJourneyFactor {
  label: string;
  score: number;
  max: number;
  note: string;
}

export interface GrowthJourneyDashboardV1 {
  version: 1;
  slug: string;
  generatedAt: string;
  profile: {
    pharmacyName: string;
    tradingName: string;
    logoUrl: string;
    phone: string;
    email: string;
    town: string;
    address: string;
    brandPrimaryColor: string;
    brandSecondaryColor: string;
    brandCtaColor: string;
    trustSignals: string[];
    profileCompletenessPct: number;
  };
  growthScore: {
    score: number;
    targetScore: number;
    nextImprovement: string;
    band: string;
    factors: GrowthJourneyFactor[];
  };
  roadmap: JourneyStep[];
  competitor: {
    topCompetitors: Array<{ name: string; rating: number | null; reviews: number | null; distanceKm: number | null }>;
    visibilityGapSummary: string;
    opportunitiesFound: number;
    competitorCount: number;
    positionLabel: string;
    ctaHref: string;
  };
  opportunities: {
    quickWins: Array<{ title: string; impact: string; priority: string }>;
    mediumWins: Array<{ title: string; impact: string; priority: string }>;
    strategicWins: Array<{ title: string; impact: string; priority: string }>;
  };
  content: {
    servicePages: { published: number; draft: number; total: number };
    blogContent: { published: number; draft: number; total: number };
    faqAssets: number;
    gbpAssets: number;
    emailAssets: number;
    contentEcosystems: number;
    visualExperiencePages: number;
  };
  publishing: {
    pagesPublished: number;
    pagesPending: number;
    pagesReady: number;
    registryCount: number;
  };
  indexing: {
    connected: boolean;
    serviceId: string;
    campaignId: string | null;
    publishedPages: number;
    indexEligiblePages: number;
    registerablePages: number;
    registerableUrls: string[];
    registeredUrls: string[];
    registeredPages: number;
    readyToSubmit: number;
    registryCount: number;
    submittedUrls: number;
    indexedUrls: number;
    notIndexedUrls: number;
    failedUrls: number;
    unknownUrls: number;
    sitemapUrl: string;
    lastUpdated: string | null;
    visibilityTrend: string;
    homepageExcluded: boolean;
    externalIndexingRequested: boolean;
    searchConsole: {
      connectedLabel: "Connected" | "Not connected";
      submissionPermissionLabel: "Write authorised" | "Reconnect required";
      managedPropertyLabel: "Verified" | "Not verified";
      externalSubmissionLabel: "Ready" | "Blocked";
      reconnectRequired: boolean;
      reconnectUrl: string;
      requestedProperty: string;
      canSubmitSitemaps: boolean;
      liveSubmitKillSwitchEnabled: boolean;
      setupHint: string;
      googleError: string;
    };
  };
  visibility: {
    connected: boolean;
    trackedServices: number;
    indexedServices: number;
    visibleServices: number;
    trackedKeywords: number;
    estimatedVisibilityScore: number;
    competitorGap: string;
    mapVisibilitySummary: string;
    organicVisibilitySummary: string;
    competitorComparison: string;
    topKeywordOpportunities: Array<{ keyword: string; serviceId: string; opportunity: string }>;
    recommendedActions: string[];
    lastCheckedAt: string | null;
  };
  executiveSummary: {
    actions: PrioritisedAction[];
  };
  growthActions: {
    connected: boolean;
    totalActions: number;
    pendingActions: number;
    inProgressActions: number;
    completeActions: number;
    topActions: Array<{
      id: string;
      title: string;
      category: string;
      priority: string;
      impact: string;
      effort: string;
      status: string;
      linkedUrl: string;
    }>;
    planUrl: string;
    lastUpdated: string | null;
  };
  executive: ExecutiveDashboardV1;
  dataSources: Record<string, boolean>;
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

function stepStatus(pct: number): JourneyStepStatus {
  if (pct >= 100) return "complete";
  if (pct > 0) return "in_progress";
  return "not_started";
}

function countFilesRecursive(dir: string, pattern: RegExp): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (pattern.test(entry.name)) count += 1;
    }
  };
  walk(dir);
  return count;
}

function mapOpportunity(o: { title?: string; impact?: string; action?: string; priority?: string }) {
  return {
    title: String(o.title || o.action || "Growth opportunity"),
    impact: String(o.impact || o.action || ""),
    priority: String(o.priority || "Medium"),
  };
}

function buildRoadmap(input: {
  slug: string;
  completenessPct: number;
  competitorDash: any;
  publishOutput: ReturnType<typeof getPharmacyPublishOutputStatus>;
  publishFoundation: ReturnType<typeof getPharmacyPublishingStatus>;
  indexReport: ReturnType<typeof readTrackingReport>;
  indexingWorkflow: IndexingWorkflowState;
  visibilityReport: ReturnType<typeof readPharmacyVisibilityReport>;
  executive: ExecutiveDashboardV1;
  contentTotals: { generated: number; ecosystemPages: number };
}): JourneyStep[] {
  const { slug, completenessPct, competitorDash, publishOutput, publishFoundation, indexingWorkflow, visibilityReport, executive, contentTotals } = input;

  const competitorPct = competitorDash?.competitors?.length
    ? competitorDash?.serviceCoverage?.length
      ? 100
      : 60
    : 0;
  const opportunityPct = competitorDash?.opportunities?.length
    ? Math.min(100, Math.round((competitorDash.opportunities.length / 5) * 100))
    : competitorPct >= 60
      ? 40
      : 0;
  const contentPct = contentTotals.generated > 0 ? Math.min(100, Math.round((contentTotals.generated / 240) * 100)) : contentTotals.ecosystemPages > 0 ? 35 : 0;
  const publishPct = publishOutput.pageCount > 0 ? 100 : publishFoundation.publishReadyCount > 0 ? 70 : publishFoundation.totalPageCount > 0 ? 45 : 0;
  const indexPct = indexingWorkflow.registeredCount
    ? computeIndexingRoadmapPct({
        version: 1,
        slug,
        totalRegistered: indexingWorkflow.registeredCount,
        readyToSubmit: indexingWorkflow.readyToSubmitCount,
        submitted: indexingWorkflow.submittedCount,
        indexed: indexingWorkflow.indexedCount,
        notIndexed: indexingWorkflow.notIndexedCount,
        failed: indexingWorkflow.failedCount,
        sitemapUrl: indexingWorkflow.sitemapUrl,
        lastUpdated: indexingWorkflow.lastUpdated || new Date().toISOString(),
      })
    : 0;
  const visibilityPct = visibilityReport?.trackedServices
    ? computeVisibilityRoadmapPct(visibilityReport)
    : executive.competitorPosition.label === "Leading"
      ? 100
      : executive.competitorPosition.label === "Competitive"
        ? 65
        : competitorPct > 0
          ? 35
          : 0;
  const monitoringPct = executive.actionPlan.actions.length > 0 ? 100 : executive.executiveSummary.growthScore > 0 ? 50 : 0;

  return [
    {
      id: "profile",
      step: 1,
      title: "Profile Setup",
      status: stepStatus(completenessPct >= 85 ? 100 : completenessPct),
      pct: Math.min(100, completenessPct),
      summary: `${completenessPct}% profile complete — central source for headers, footers, trust and local access.`,
      ctaLabel: "Open Profile Dashboard",
      ctaHref: `/api/pharmacy-profile-dashboard?slug=${slug}`,
    },
    {
      id: "competitor",
      step: 2,
      title: "Competitor Intelligence",
      status: stepStatus(competitorPct),
      pct: competitorPct,
      summary: competitorDash?.competitors?.length
        ? `${competitorDash.competitors.length} local competitors analysed.`
        : "Run competitor intelligence to benchmark your pharmacy.",
      ctaLabel: "View Competitor Report",
      ctaHref: `/api/pharmacy-competitor-dashboard?slug=${slug}`,
    },
    {
      id: "opportunity",
      step: 3,
      title: "Opportunity Discovery",
      status: stepStatus(opportunityPct),
      pct: opportunityPct,
      summary: competitorDash?.opportunities?.length
        ? `${competitorDash.opportunities.length} growth opportunities identified.`
        : "Complete competitor analysis to unlock opportunities.",
      ctaLabel: "Explore Opportunities",
      ctaHref: `/api/pharmacy-executive-dashboard?slug=${slug}#opportunity-engine`,
    },
    {
      id: "content",
      step: 4,
      title: "Content Creation",
      status: stepStatus(contentPct),
      pct: contentPct,
      summary: `${contentTotals.generated} generated pages · ${contentTotals.ecosystemPages} ecosystem pages.`,
      ctaLabel: "Review Content Assets",
      ctaHref: `/api/pharmacy-content-ecosystem-preview/pharmacy-first/`,
    },
    {
      id: "publishing",
      step: 5,
      title: "Publishing",
      status: stepStatus(publishPct),
      pct: publishPct,
      summary: `${publishOutput.pageCount} published HTML pages · ${publishFoundation.publishReadyCount} publish-ready in registry.`,
      ctaLabel: "Publishing Status",
      ctaHref: `/api/pharmacy-executive-dashboard?slug=${slug}`,
    },
    {
      id: "indexing",
      step: 6,
      title: "Indexing",
      status: stepStatus(indexPct),
      pct: indexPct,
      summary: indexingWorkflow.registeredCount
        ? `Published ${indexingWorkflow.publishedCount} · index eligible ${indexingWorkflow.indexEligibleCount} · registered ${indexingWorkflow.registeredCount} · submitted ${indexingWorkflow.submittedCount} · indexed ${indexingWorkflow.indexedCount}.`
        : indexingWorkflow.registerableCount
          ? `Register ${indexingWorkflow.registerableCount} Technical SEO eligible pages for the current ${indexingWorkflow.serviceId} publication.`
          : "Register published pharmacy pages for indexing workflow.",
      ctaLabel: indexingWorkflow.registeredCount ? "Manage Indexing" : "Register Pages",
      ctaHref: `/api/pharmacy-growth-dashboard?slug=${slug}#indexing`,
    },
    {
      id: "visibility",
      step: 7,
      title: "Visibility Tracking",
      status: stepStatus(visibilityPct),
      pct: visibilityPct,
      summary: visibilityReport?.trackedServices
        ? `${visibilityReport.visiblePageCount} visible · ${visibilityReport.indexedPageCount} indexed · score ${visibilityReport.estimatedVisibilityScore}.`
        : `Competitor position: ${executive.competitorPosition.label}.`,
      ctaLabel: visibilityReport?.trackedServices ? "Manage Visibility" : "Refresh Visibility",
      ctaHref: `/api/pharmacy-growth-dashboard?slug=${slug}#visibility`,
    },
    {
      id: "monitoring",
      step: 8,
      title: "Growth Monitoring",
      status: stepStatus(monitoringPct),
      pct: monitoringPct,
      summary: `${executive.actionPlan.actions.length} prioritised actions in your growth plan.`,
      ctaLabel: "Executive Dashboard",
      ctaHref: `/api/pharmacy-executive-dashboard?slug=${slug}`,
    },
  ];
}

function buildJourneyFactors(
  executive: ExecutiveDashboardV1,
  completenessPct: number,
  publishOutput: ReturnType<typeof getPharmacyPublishOutputStatus>,
  indexingWorkflow: IndexingWorkflowState,
  visibilityReport: ReturnType<typeof readPharmacyVisibilityReport>,
  competitorDash: any,
): GrowthJourneyFactor[] {
  const factor = (label: string) => executive.growthScore.factors.find((f) => f.label.toLowerCase().includes(label.toLowerCase()));
  const quality = factor("Content quality")?.score ?? 50;
  const readability = factor("Patient readability")?.score ?? 50;
  const contentAssets = Math.round((quality + readability) / 2);
  const indexedPct = indexingWorkflow.registeredCount
    ? Math.round((indexingWorkflow.indexedCount / indexingWorkflow.registeredCount) * 100)
    : 0;
  const visibilityLevel = String(competitorDash?.gaps?.visibilityGap?.level || "").toLowerCase();
  const visibilityScore = visibilityReport?.estimatedVisibilityScore
    ? visibilityReport.estimatedVisibilityScore
    : visibilityLevel === "low"
      ? 85
      : visibilityLevel === "medium"
        ? 60
        : visibilityLevel === "high"
          ? 35
          : executive.competitorPosition.label === "Leading"
            ? 80
            : 50;

  return [
    { label: "Profile Completeness", score: completenessPct, max: 100, note: `${completenessPct}% complete` },
    { label: "Competitor Analysis", score: factor("Competitor position")?.score ?? 0, max: 100, note: executive.competitorPosition.label },
    { label: "Content Assets", score: contentAssets, max: 100, note: "Quality + readability audits" },
    { label: "Published Pages", score: factor("Local pages")?.score ?? Math.min(100, Math.round((publishOutput.pageCount / 240) * 100)), max: 100, note: `${publishOutput.pageCount} pages` },
    {
      label: "Indexed Pages",
      score: indexedPct,
      max: 100,
      note: indexingWorkflow.registeredCount
        ? `${indexingWorkflow.indexedCount} of ${indexingWorkflow.registeredCount} indexed`
        : indexingWorkflow.registerableCount
          ? `${indexingWorkflow.registerableCount} eligible to register`
          : "Not registered",
    },
    { label: "Visibility Data", score: visibilityScore, max: 100, note: visibilityReport?.trackedServices ? `Score ${visibilityReport.estimatedVisibilityScore} · ${visibilityReport.visiblePageCount} visible` : competitorDash?.gaps?.visibilityGap?.summary || "Run competitor intelligence" },
    { label: "Trust Signals", score: factor("Trust signals")?.score ?? 0, max: 100, note: factor("Trust signals")?.note || "Profile trust fields" },
  ];
}

export function buildGrowthJourneyDashboard(slug: string): GrowthJourneyDashboardV1 {
  const safe = safeSlug(slug);
  const executive = buildExecutiveDashboard(safe);

  const profileDoc = readJson<{ data?: Record<string, unknown> }>(path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${safe}.json`));
  const profileData = normalizeProfileData(profileDoc?.data || {});
  const completeness = computeProfileCompleteness(profileData, safe);

  const competitorDash =
    readJson<any>(path.join(WORKSPACE_ROOT, "data/pharmacy-competitor-intelligence", `${safe}-dashboard.json`)) ||
    readJson<any>(path.join(WORKSPACE_ROOT, "data/pharmacy-opportunity-engine", `${safe}-dashboard.json`));

  const publishFoundation = getPharmacyPublishingStatus(safe);
  const publishOutput = getPharmacyPublishOutputStatus(safe);
  const indexReport = readTrackingReport(safe, path.join(WORKSPACE_ROOT, "output"));
  const indexingWorkflow = readIndexingWorkflowState(safe);
  const visibilityReport = readPharmacyVisibilityReport(safe);
  const actionPlan = readPharmacyGrowthActionPlan(safe);

  const ecoRoot = path.join(WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", safe);
  const ecosystemPages = countFilesRecursive(ecoRoot, /index\.html$/);
  const gbpAssets = fs.existsSync(path.join(ecoRoot, "pharmacy-first/packs/gbp-posts.json")) ? 1 : 0;
  const emailAssets = fs.existsSync(path.join(ecoRoot, "pharmacy-first/packs/email-sequence.json")) ? 1 : 0;
  const faqAssets = countFilesRecursive(ecoRoot, /faq/i);
  const visualExperiencePages = countFilesRecursive(path.join(WORKSPACE_ROOT, "output/pharmacy-visual-experience", safe), /index\.html$/);
  const blogPages = countFilesRecursive(path.join(ecoRoot, "pharmacy-first/pages"), /index\.html$/);

  const opportunities = competitorDash?.opportunities || [];
  const quickWins = opportunities.filter((o: any) => o.priority === "Critical" || o.priority === "High").slice(0, 5).map(mapOpportunity);
  const mediumWins = opportunities.filter((o: any) => o.priority === "Medium").slice(0, 5).map(mapOpportunity);
  const strategicWins = opportunities.filter((o: any) => o.priority === "Low").slice(0, 5).map(mapOpportunity);

  const topCompetitors = (competitorDash?.competitors || []).slice(0, 5).map((c: any) => ({
    name: String(c.name || c.pharmacyName || "Competitor"),
    rating: c.rating ?? c.googleRating ?? null,
    reviews: c.reviewCount ?? c.userRatingsTotal ?? null,
    distanceKm: c.distanceKm ?? c.distance ?? null,
  }));

  const address = [profileData.addressLine1, profileData.addressLine2, profileData.postcode].filter(Boolean).join(", ");
  const journeyFactors = buildJourneyFactors(executive, completeness.score, publishOutput, indexingWorkflow, visibilityReport, competitorDash);
  const nextImprovement =
    executive.actionPlan.actions[0]?.title ||
    completeness.missingItems[0] ||
    "Complete your pharmacy profile to unlock the next growth actions.";

  const rankTracking = readJson<any>(path.join(WORKSPACE_ROOT, "output", safe, "rank-tracking.json"));
  const trackedKeywords = rankTracking?.records?.length ?? rankTracking?.summary?.keywordCount ?? 0;

  return {
    version: 1,
    slug: safe,
    generatedAt: new Date().toISOString(),
    profile: {
      pharmacyName: profileData.pharmacyName || profileData.tradingName || executive.pharmacyName,
      tradingName: profileData.tradingName || profileData.pharmacyName || "",
      logoUrl: profileData.logoUrl || "",
      phone: profileData.phone || "",
      email: resolveProductionEmailDisplay(profileData).display,
      town: profileData.townCity || executive.town,
      address,
      brandPrimaryColor: profileData.brandPrimaryColor || "#005eb8",
      brandSecondaryColor: profileData.brandSecondaryColor || "#003087",
      brandCtaColor: profileData.brandCtaColor || "#005eb8",
      trustSignals: executive.trustAndContent.trustSignals,
      profileCompletenessPct: completeness.score,
    },
    growthScore: {
      score: executive.executiveSummary.growthScore,
      targetScore: 80,
      nextImprovement,
      band: executive.executiveSummary.growthBand,
      factors: journeyFactors,
    },
    roadmap: buildRoadmap({
      slug: safe,
      completenessPct: completeness.score,
      competitorDash,
      publishOutput,
      publishFoundation,
      indexReport,
      indexingWorkflow,
      visibilityReport,
      executive,
      contentTotals: { generated: publishFoundation.totalPageCount, ecosystemPages },
    }),
    competitor: {
      topCompetitors,
      visibilityGapSummary: String(competitorDash?.gaps?.visibilityGap?.summary || executive.competitorPosition.summary),
      opportunitiesFound: opportunities.length,
      competitorCount: executive.competitorPosition.competitorCount,
      positionLabel: executive.competitorPosition.label,
      ctaHref: `/api/pharmacy-competitor-dashboard?slug=${safe}`,
    },
    opportunities: { quickWins, mediumWins, strategicWins },
    content: {
      servicePages: {
        published: publishOutput.pageCount,
        draft: Math.max(0, publishFoundation.totalPageCount - publishOutput.pageCount),
        total: publishFoundation.totalPageCount,
      },
      blogContent: { published: blogPages, draft: 0, total: blogPages },
      faqAssets: faqAssets,
      gbpAssets,
      emailAssets,
      contentEcosystems: countBenchmarkEcosystems(safe),
      visualExperiencePages,
    },
    publishing: {
      pagesPublished: publishOutput.pageCount,
      pagesPending: Math.max(0, publishFoundation.totalPageCount - publishFoundation.publishReadyCount),
      pagesReady: publishFoundation.publishReadyCount,
      registryCount: publishFoundation.registryCount,
    },
    indexing: {
      connected: indexingWorkflow.connected,
      serviceId: indexingWorkflow.serviceId,
      campaignId: indexingWorkflow.campaignId,
      publishedPages: indexingWorkflow.publishedCount,
      indexEligiblePages: indexingWorkflow.indexEligibleCount,
      registerablePages: indexingWorkflow.registerableCount,
      registerableUrls: indexingWorkflow.registerableUrls,
      registeredUrls: indexingWorkflow.registeredUrls,
      registeredPages: indexingWorkflow.registeredCount,
      readyToSubmit: indexingWorkflow.readyToSubmitCount,
      registryCount: indexingWorkflow.registeredCount,
      submittedUrls: indexingWorkflow.submittedCount,
      indexedUrls: indexingWorkflow.indexedCount,
      notIndexedUrls: indexingWorkflow.notIndexedCount,
      failedUrls: indexingWorkflow.failedCount,
      unknownUrls: 0,
      sitemapUrl: indexingWorkflow.sitemapUrl,
      lastUpdated: indexingWorkflow.lastUpdated,
      visibilityTrend: indexingWorkflow.visibilityTrend,
      homepageExcluded: indexingWorkflow.homepageExcluded,
      externalIndexingRequested: false,
      searchConsole: (() => {
        const requested = indexingWorkflow.serviceId
          ? resolvePharmacySearchConsoleProperty(safe, indexingWorkflow.serviceId)
          : { property: `https://${safe}.sites.pharmaconnect.uk/` };
        const authority = buildLocalSearchConsoleWriteAuthority({
          slug: safe,
          requestedProperty: requested.property,
          customerWebsite: String(profileData.website || ""),
        });
        return {
          connectedLabel: authority.connectedLabel,
          submissionPermissionLabel: authority.submissionPermissionLabel,
          managedPropertyLabel: authority.managedPropertyLabel,
          externalSubmissionLabel: authority.externalSubmissionLabel,
          reconnectRequired: authority.reconnectRequired,
          reconnectUrl: authority.reconnectUrl,
          requestedProperty: authority.property.requestedProperty,
          canSubmitSitemaps: authority.canSubmitSitemaps,
          liveSubmitKillSwitchEnabled: authority.liveSubmitKillSwitchEnabled,
          setupHint: authority.property.setupHint,
          googleError: authority.error || "",
        };
      })(),
    },
    visibility: {
      connected: Boolean(visibilityReport?.trackedServices || competitorDash),
      trackedServices: visibilityReport?.trackedServices ?? 0,
      indexedServices: visibilityReport ? countIndexedServices(visibilityReport) : 0,
      visibleServices: visibilityReport?.visiblePageCount ?? 0,
      trackedKeywords: visibilityReport?.trackedKeywords ?? trackedKeywords,
      estimatedVisibilityScore: visibilityReport?.estimatedVisibilityScore ?? 0,
      competitorGap: visibilityReport?.competitorGap || competitorDash?.gaps?.visibilityGap?.summary || "Run competitor intelligence for visibility gap analysis.",
      mapVisibilitySummary: competitorDash?.gaps?.visibilityGap?.summary || "Connect Search Console for live map visibility.",
      organicVisibilitySummary: executive.competitorPosition.summary,
      competitorComparison: `${executive.competitorPosition.label} vs ${executive.competitorPosition.competitorCount} local pharmacies`,
      topKeywordOpportunities: (visibilityReport?.topKeywordOpportunities || []).slice(0, 5).map((o) => ({
        keyword: o.keyword,
        serviceId: o.serviceId,
        opportunity: o.opportunity,
      })),
      recommendedActions: visibilityReport?.recommendedActions?.length
        ? visibilityReport.recommendedActions
        : executive.actionPlan.actions.slice(0, 3).map((a) => a.title),
      lastCheckedAt: visibilityReport?.lastCheckedAt ?? null,
    },
    executiveSummary: {
      actions: executive.actionPlan.actions.slice(0, 5),
    },
    growthActions: {
      connected: Boolean(actionPlan?.totalActions),
      totalActions: actionPlan?.totalActions ?? 0,
      pendingActions: actionPlan?.pendingActions ?? 0,
      inProgressActions: actionPlan?.inProgressActions ?? 0,
      completeActions: actionPlan?.completeActions ?? 0,
      topActions: (actionPlan?.topPriorityActions || []).map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        priority: a.priority,
        impact: a.impact,
        effort: a.effort,
        status: a.status,
        linkedUrl: a.linkedUrl,
      })),
      planUrl: `/api/pharmacy-growth-actions?slug=${safe}`,
      lastUpdated: actionPlan?.lastUpdated ?? null,
    },
    executive,
    dataSources: {
      ...executive.dataSources,
      profileDashboard: fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${safe}.json`)),
      competitorDashboard: Boolean(competitorDash),
      publishOutput: publishOutput.hasPublishOutput,
      publishRegistry: publishFoundation.registryCount > 0,
      indexTracking: Boolean(indexReport),
      pharmacyIndexing: indexingWorkflow.registeredCount > 0,
      pharmacyVisibility: Boolean(visibilityReport?.trackedServices),
      pharmacyGrowthActions: Boolean(actionPlan?.totalActions),
      contentEcosystem: fs.existsSync(ecoRoot),
      visualExperience: visualExperiencePages > 0,
    },
  };
}

export function writeGrowthJourneyDashboardJson(slug: string): string {
  const dash = buildGrowthJourneyDashboard(slug);
  const dir = path.join(WORKSPACE_ROOT, "data/pharmacy-growth-journey");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${safeSlug(slug)}.json`);
  fs.writeFileSync(file, JSON.stringify(dash, null, 2));
  return file;
}
