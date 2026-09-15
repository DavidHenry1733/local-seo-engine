/**
 * Pharmacy Competitor Intelligence — full build pipeline (shared by CLI + API).
 *
 * One authorised orchestrate_competitor_analysis run invokes:
 * 1. Google Places local discovery
 * 2. DataForSEO organic-search via the existing national search adapter
 */
import { hasGooglePlacesApiKey } from "./googlePlacesConnection.ts";
import {
  discoverCompetitors,
  loadCompetitorDiscoveryResult,
  loadPharmacyDiscoveryInput,
  writeCompetitorDiscoveryResult,
} from "./pharmacyCompetitorDiscovery.ts";
import {
  buildCompetitorIntelligence,
  loadCompetitorIntelligence,
  writeCompetitorIntelligence,
} from "./pharmacyCompetitorIntelligence.ts";
import {
  runCompetitorGapAnalysis,
  writeGapAnalysis,
} from "./pharmacyCompetitorGapAnalysis.ts";
import {
  generateOpportunities,
  writeOpportunityEngineResult,
} from "./pharmacyOpportunityEngine.ts";
import {
  hasReliableOrganicSearchResults,
  readOrganicSearchRun,
  runOrganicSearchCompetitorDiscovery,
  type OrganicSearchProviderResult,
} from "./competitorAnalysisOrganicSearchService.ts";
import { isDataForSeoConfigured } from "./dataForSeoNationalSearchAdapter.ts";
import type { CompetitorAnalysisProviderStatus } from "./nationalCompetitorDiscoveryModel.ts";

export interface CompetitorAnalysisProviderRunSummary {
  family: "google_local" | "dataforseo_organic";
  status: CompetitorAnalysisProviderStatus;
  configured: boolean;
  generated: boolean;
  error: string | null;
  competitorCount: number;
}

export interface CompetitorIntelligenceBuildResult {
  slug: string;
  generatedAt: string;
  discovery: {
    source: string;
    competitorCount: number;
  };
  intelligence: {
    avgRating: number;
    avgReviewCount: number;
  };
  gapAnalysis: {
    serviceComparisons: number;
    reviewGapLevel: string;
    serviceGapLevel: string;
  };
  opportunities: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  paths: {
    discovery: string;
    intelligence: string;
    gapAnalysis: string;
    opportunity: string;
    dashboard: string;
  };
  googleLocal: CompetitorAnalysisProviderRunSummary;
  dataForSeoOrganic: OrganicSearchProviderResult;
  combinedStatus: "completed" | "partial" | "failed";
}

function googleLocalStatusFromDiscovery(slug: string): CompetitorAnalysisProviderRunSummary {
  const configured = hasGooglePlacesApiKey();
  const discovery = loadCompetitorDiscoveryResult(slug);
  const intel = loadCompetitorIntelligence(slug);
  const liveCount = discovery?.source === "google-places-live" ? discovery.competitorCount : intel?.competitors.length || 0;
  if (!configured) {
    return {
      family: "google_local",
      status: "not_configured",
      configured: false,
      generated: false,
      error: "Google Places is not configured",
      competitorCount: 0,
    };
  }
  if (discovery?.source === "google-places-live" && (discovery.competitorCount || 0) > 0) {
    return {
      family: "google_local",
      status: "completed",
      configured: true,
      generated: true,
      error: null,
      competitorCount: discovery.competitorCount,
    };
  }
  if (discovery?.placesError?.message) {
    return {
      family: "google_local",
      status: "failed",
      configured: true,
      generated: false,
      error: discovery.placesError.message,
      competitorCount: liveCount,
    };
  }
  return {
    family: "google_local",
    status: "no_reliable_results",
    configured: true,
    generated: false,
    error: "Google Places returned no reliable local pharmacy competitors.",
    competitorCount: 0,
  };
}

export function isReliableGoogleLocalAnalysis(slug: string): boolean {
  const discovery = loadCompetitorDiscoveryResult(slug);
  if (discovery?.source === "google-places-live" && (discovery.competitorCount || 0) > 0) return true;
  const intel = loadCompetitorIntelligence(slug);
  return Boolean(intel?.source?.includes("google") && (intel.competitors.length || 0) > 0);
}

export function isCombinedCompetitorAnalysisStored(slug: string): boolean {
  const googleOk = isReliableGoogleLocalAnalysis(slug);
  if (!isDataForSeoConfigured()) return googleOk;
  return googleOk && hasReliableOrganicSearchResults(slug);
}

function combinedStatus(
  google: CompetitorAnalysisProviderRunSummary,
  organic: OrganicSearchProviderResult,
): "completed" | "partial" | "failed" {
  const googleDone = google.status === "completed" || google.status === "not_configured";
  const organicDone = organic.status === "completed" || organic.status === "not_configured";
  const googleFailed = google.status === "failed" || google.status === "no_reliable_results";
  const organicFailed = organic.status === "failed" || organic.status === "no_reliable_results" || organic.status === "partial";
  if (google.status === "completed" && organic.status === "completed") return "completed";
  if ((googleDone || google.generated) && (organicDone || organic.generated) && !googleFailed && !organicFailed) {
    return "completed";
  }
  if (google.generated || organic.generated || google.status === "completed" || organic.status === "completed") {
    return "partial";
  }
  if (googleFailed && organicFailed) return "failed";
  if (googleFailed && organic.status === "not_configured") return "failed";
  if (organicFailed && google.status === "not_configured") return "failed";
  return "partial";
}

export async function runCompetitorIntelligencePipeline(
  slug: string,
): Promise<CompetitorIntelligenceBuildResult> {
  const input = loadPharmacyDiscoveryInput(slug);
  let discoveryPath = "";
  let intelligencePath = "";
  let gapPath = "";
  let opportunityPath = "";
  let dashboardPath = "";
  let discoverySource = "unknown";
  let competitorCount = 0;
  let avgRating = 0;
  let avgReviewCount = 0;
  let serviceComparisons = 0;
  let reviewGapLevel = "unknown";
  let serviceGapLevel = "unknown";
  let opportunities = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };

  let googleLocal: CompetitorAnalysisProviderRunSummary;
  try {
    const skipGoogleRequest = isReliableGoogleLocalAnalysis(slug);
    if (!skipGoogleRequest) {
      const discovery = await discoverCompetitors(slug, input);
      discoveryPath = writeCompetitorDiscoveryResult(discovery);
      discoverySource = discovery.source;
      competitorCount = discovery.competitorCount;
    if (discovery.source === "google-places-live" && discovery.competitorCount > 0) {
      try {
        const intelligence = await buildCompetitorIntelligence(discovery);
        intelligencePath = writeCompetitorIntelligence(intelligence);
        avgRating = intelligence.competitorSummary.avgRating;
        avgReviewCount = intelligence.competitorSummary.avgReviewCount;
        const gapAnalysis = runCompetitorGapAnalysis(intelligence);
        gapPath = writeGapAnalysis(gapAnalysis);
        serviceComparisons = gapAnalysis.serviceCoverage.length;
        reviewGapLevel = gapAnalysis.reviewGap.level;
        serviceGapLevel = gapAnalysis.serviceGap.level;
        const opportunity = generateOpportunities(intelligence, gapAnalysis);
        const written = writeOpportunityEngineResult(opportunity);
        opportunityPath = written.opportunityPath;
        dashboardPath = written.dashboardPath;
        opportunities = opportunity.summary;
      } catch {
        /* Discovery already persisted; enrichment failure must not hide live Google results. */
      }
    }
    } else {
      const existing = loadCompetitorDiscoveryResult(slug);
      discoverySource = existing?.source || "google-places-live";
      competitorCount = existing?.competitorCount || 0;
      const intel = loadCompetitorIntelligence(slug);
      avgRating = intel?.competitorSummary.avgRating || 0;
      avgReviewCount = intel?.competitorSummary.avgReviewCount || 0;
    }
    googleLocal = googleLocalStatusFromDiscovery(slug);
  } catch (err) {
    googleLocal = {
      family: "google_local",
      status: hasGooglePlacesApiKey() ? "failed" : "not_configured",
      configured: hasGooglePlacesApiKey(),
      generated: isReliableGoogleLocalAnalysis(slug),
      error: err instanceof Error ? err.message : String(err),
      competitorCount,
    };
  }

  const skipOrganicRequest = hasReliableOrganicSearchResults(slug);
  let dataForSeoOrganic: OrganicSearchProviderResult;
  if (skipOrganicRequest) {
    const existingOrganic = readOrganicSearchRun(slug);
    dataForSeoOrganic = {
      status: "completed",
      configured: true,
      generated: true,
      error: null,
      queryLimitation: existingOrganic?.queryLimitation || null,
      competitorCount: existingOrganic?.competitors.length || 0,
      queries: existingOrganic?.queries || [],
      artifactPath: null,
    };
  } else {
    dataForSeoOrganic = await runOrganicSearchCompetitorDiscovery(slug);
  }

  return {
    slug,
    generatedAt: new Date().toISOString(),
    discovery: {
      source: discoverySource,
      competitorCount,
    },
    intelligence: {
      avgRating,
      avgReviewCount,
    },
    gapAnalysis: {
      serviceComparisons,
      reviewGapLevel,
      serviceGapLevel,
    },
    opportunities,
    paths: {
      discovery: discoveryPath,
      intelligence: intelligencePath,
      gapAnalysis: gapPath,
      opportunity: opportunityPath,
      dashboard: dashboardPath,
    },
    googleLocal,
    dataForSeoOrganic,
    combinedStatus: combinedStatus(googleLocal, dataForSeoOrganic),
  };
}
