/**
 * Master Admin — commercial intelligence review panels (orchestration display only).
 */
import { loadCompetitorIntelligence } from "./pharmacyCompetitorIntelligence.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { loadGrowthOpportunityReport } from "./growthEngineOpportunityEngine.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import {
  isCompetitorAnalysisApproved,
  isCompetitorAnalysisGenerated,
  isGrowthIntelligenceApproved,
  isGrowthIntelligenceGenerated,
  isLocalMarketIntelligenceApproved,
  isLocalMarketIntelligenceGenerated,
} from "./masterAdminCommercialIntelligenceWorkflowService.ts";
import { isLegacyAutoAdvance, legacyAutoAdvanceLabel } from "./masterAdminWorkflowLegacyService.ts";

export interface CommercialIntelligenceReviewSummary {
  slug: string;
  stage: "competitor" | "local_market" | "growth";
  generated: boolean;
  approved: boolean;
  canApprove: boolean;
  legacyAutoAdvance: boolean;
  legacyLabel: string | null;
  summary: Record<string, string | number>;
  competitors: Array<Record<string, unknown>>;
  sections: Array<{ title: string; items: string[] }>;
  opportunities: Array<Record<string, unknown>>;
  blockers: string[];
}

function competitorRows(slug: string): Array<Record<string, unknown>> {
  const intel = loadCompetitorIntelligence(slug);
  if (!intel) return [];
  return intel.competitors.slice(0, 12).map((c) => ({
    name: c.name,
    distanceKm: c.distanceKm,
    distanceLabel: c.distanceLabel,
    rating: c.rating,
    reviewCount: c.reviewCount,
    categories: c.categories?.slice(0, 4) || [],
    services: c.services?.slice(0, 6) || [],
    website: c.website || "",
    mapsUrl: c.mapsUrl || "",
    source: c.source || intel.source,
    confidence: c.source === "google-places" ? "high" : "medium",
  }));
}

export function buildCompetitorAnalysisReview(slug: string): CommercialIntelligenceReviewSummary {
  const intel = loadCompetitorIntelligence(slug);
  const profile = readSetupProfile(slug);
  return {
    slug,
    stage: "competitor",
    generated: isCompetitorAnalysisGenerated(slug),
    approved: isCompetitorAnalysisApproved(slug),
    canApprove: isCompetitorAnalysisGenerated(slug) && !isCompetitorAnalysisApproved(slug),
    legacyAutoAdvance: isLegacyAutoAdvance(slug),
    legacyLabel: legacyAutoAdvanceLabel(slug),
    summary: {
      pharmacyName: profile.pharmacyName || profile.tradingName || slug,
      competitorCount: intel?.competitorSummary.count || 0,
      avgRating: intel?.competitorSummary.avgRating || 0,
      avgReviews: intel?.competitorSummary.avgReviewCount || 0,
      source: intel?.source || "—",
    },
    competitors: competitorRows(slug),
    sections: [],
    opportunities: [],
    blockers: isCompetitorAnalysisGenerated(slug) ? [] : ["Generate Competitor Analysis before approval"],
  };
}

export function buildLocalMarketIntelligenceReview(slug: string): CommercialIntelligenceReviewSummary {
  const snap = loadCompetitorSnapshot(slug);
  const profile = readSetupProfile(slug);
  const analysis = snap?.analysis;
  return {
    slug,
    stage: "local_market",
    generated: isLocalMarketIntelligenceGenerated(slug),
    approved: isLocalMarketIntelligenceApproved(slug),
    canApprove: isLocalMarketIntelligenceGenerated(slug) && !isLocalMarketIntelligenceApproved(slug),
    legacyAutoAdvance: isLegacyAutoAdvance(slug),
    legacyLabel: legacyAutoAdvanceLabel(slug),
    summary: {
      pharmacyName: profile.pharmacyName || profile.tradingName || slug,
      competitorCount: analysis?.competitorCount || snap?.competitors.length || 0,
      dataSource: analysis?.dataSource || snap?.source || "—",
      opportunities: analysis?.opportunities?.length || 0,
    },
    competitors: (snap?.competitors || []).slice(0, 8).map((c) => ({
      name: c.name,
      distanceLabel: c.distanceLabel,
      rating: c.rating,
      reviewCount: c.reviewCount,
      website: c.website || "",
    })),
    sections: [
      {
        title: "Market Summary",
        items: analysis?.summaryParagraphs || ["Local market analysis pending"],
      },
      {
        title: "Review Opportunities",
        items: (analysis?.opportunities || []).slice(0, 8).map((o) => String(o)),
      },
      {
        title: "Recommended Coverage",
        items: (snap?.analysis?.comparisons || []).slice(0, 6).map((c) => `${c.label}: you ${c.yourPharmacy} · avg ${c.competitorAverage}`),
      },
    ],
    opportunities: [],
    blockers: isLocalMarketIntelligenceGenerated(slug) ? [] : ["Generate Local Market Intelligence before approval"],
  };
}

export function buildGrowthIntelligenceReview(slug: string): CommercialIntelligenceReviewSummary {
  const report = loadGrowthOpportunityReport(slug);
  const profile = readSetupProfile(slug);
  return {
    slug,
    stage: "growth",
    generated: isGrowthIntelligenceGenerated(slug),
    approved: isGrowthIntelligenceApproved(slug),
    canApprove: isGrowthIntelligenceGenerated(slug) && !isGrowthIntelligenceApproved(slug),
    legacyAutoAdvance: isLegacyAutoAdvance(slug),
    legacyLabel: legacyAutoAdvanceLabel(slug),
    summary: {
      pharmacyName: profile.pharmacyName || profile.tradingName || slug,
      opportunityCount: report?.opportunities.length || 0,
      highPriority: report?.overview?.high || 0,
      generatedAt: report?.generatedAt || "—",
    },
    competitors: [],
    sections: [
      {
        title: "Executive Summary",
        items: report
          ? [
              `${report.overview.total} opportunities identified`,
              `${report.overview.high} high priority`,
              `${report.missingContent.length} missing content signals`,
            ]
          : ["Growth Intelligence report pending"],
      },
      {
        title: "Growth Roadmap",
        items: [
          ...(report?.roadmap.high || []).slice(0, 4).map((r) => `High: ${r.title}`),
          ...(report?.roadmap.medium || []).slice(0, 3).map((r) => `Medium: ${r.title}`),
        ],
      },
      {
        title: "Expected Results",
        items: report?.readyToBuild
          ? [report.readyToBuild.reason, report.readyToBuild.estimatedEcosystem, report.readyToBuild.estimatedTime]
          : [],
      },
    ],
    opportunities: (report?.opportunities || []).slice(0, 12).map((o) => ({
      title: o.title,
      priority: o.priority,
      category: o.category,
      impact: o.commercialImpact || o.description,
      evidence: o.evidenceSources?.join(", ") || "",
    })),
    blockers: isGrowthIntelligenceGenerated(slug) ? [] : ["Generate Growth Intelligence before approval"],
  };
}
