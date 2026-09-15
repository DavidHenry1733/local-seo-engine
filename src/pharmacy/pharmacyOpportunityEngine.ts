/**
 * Pharmacy Opportunity Engine V1 —
 * generates prioritised commercial opportunities from competitor gap analysis.
 */
import fs from "node:fs";
import path from "node:path";
import type { CompetitorGapAnalysisResult, ServiceCoverageRow } from "./pharmacyCompetitorGapAnalysis.ts";
import type { CompetitorIntelligenceResult } from "./pharmacyCompetitorIntelligence.ts";

export const OPPORTUNITY_ENGINE_DIR = path.join(
  process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine",
  "data/pharmacy-opportunity-engine",
);

export type OpportunityPriority = "Critical" | "High" | "Medium" | "Low";

export interface Opportunity {
  id: string;
  priority: OpportunityPriority;
  category: "reviews" | "services" | "content" | "visibility" | "trust" | "growth";
  title: string;
  description: string;
  impact: string;
  action: string;
  relatedServices?: string[];
  metrics?: Record<string, number | string>;
}

export interface RecommendedAction {
  id: string;
  priority: OpportunityPriority;
  title: string;
  description: string;
  timeframe: "immediate" | "short-term" | "medium-term";
  effort: "low" | "medium" | "high";
}

export interface DashboardCompetitorIntel {
  competitors: CompetitorIntelligenceResult["competitors"];
  competitorSummary: CompetitorIntelligenceResult["competitorSummary"];
  serviceCoverage: ServiceCoverageRow[];
  reviewComparison: CompetitorGapAnalysisResult["reviewComparison"];
  trustComparison: CompetitorGapAnalysisResult["trustComparison"];
  opportunities: Opportunity[];
  recommendedActions: RecommendedAction[];
  gaps: {
    reviewGap: CompetitorGapAnalysisResult["reviewGap"];
    serviceGap: CompetitorGapAnalysisResult["serviceGap"];
    contentGap: CompetitorGapAnalysisResult["contentGap"];
    visibilityGap: CompetitorGapAnalysisResult["visibilityGap"];
    trustGap: CompetitorGapAnalysisResult["trustGap"];
  };
  generatedAt: string;
  slug: string;
}

export interface OpportunityEngineResult {
  slug: string;
  generatedAt: string;
  opportunities: Opportunity[];
  recommendedActions: RecommendedAction[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  dashboard: DashboardCompetitorIntel;
}

function priorityFromGapLevel(level: string): OpportunityPriority {
  if (level === "critical") return "Critical";
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

function buildReviewOpportunities(gap: CompetitorGapAnalysisResult): Opportunity[] {
  const ops: Opportunity[] = [];
  const { reviewComparison, reviewGap } = gap;

  if (reviewComparison.reviewCountDelta > 10) {
    ops.push({
      id: "opp-review-volume",
      priority: reviewGap.level === "critical" || reviewGap.level === "high" ? "Critical" : "High",
      category: "reviews",
      title: "Close the Google review volume gap",
      description: `Local competitors average ${reviewComparison.competitorAvgReviewCount} reviews while your pharmacy has ${reviewComparison.pharmacyReviewCount}.`,
      impact: "Higher review volume improves local pack visibility and patient trust.",
      action: "Launch a post-visit review request workflow via SMS, receipt QR codes and consultation follow-up.",
      metrics: {
        reviewCountDelta: reviewComparison.reviewCountDelta,
        competitorAvg: reviewComparison.competitorAvgReviewCount,
      },
    });
  }

  if (reviewComparison.ratingDelta > 0.2) {
    ops.push({
      id: "opp-review-rating",
      priority: "High",
      category: "reviews",
      title: "Improve star rating competitiveness",
      description: `Competitor average rating (${reviewComparison.competitorAvgRating}) exceeds yours (${reviewComparison.pharmacyRating ?? "n/a"}).`,
      impact: "Rating parity reduces click-through loss in Google Maps comparisons.",
      action: "Audit recent negative reviews, respond professionally and address recurring service themes.",
      metrics: { ratingDelta: reviewComparison.ratingDelta },
    });
  }

  return ops;
}

function buildServiceOpportunities(gap: CompetitorGapAnalysisResult): Opportunity[] {
  return gap.serviceCoverage
    .filter((s) => s.gapLevel === "high")
    .slice(0, 6)
    .map((s, i) => ({
      id: `opp-service-${s.serviceId}`,
      priority: (i < 2 ? "High" : "Medium") as OpportunityPriority,
      category: "services" as const,
      title: `Differentiate ${s.serviceName} locally`,
      description: `${s.competitorCoveragePct}% of nearby competitors already promote ${s.serviceName.toLowerCase()}.`,
      impact: "High-competition services need stronger local landing pages and clear booking paths.",
      action: `Build dedicated ${s.serviceName} area pages with local proof points and conversion CTAs.`,
      relatedServices: [s.serviceId],
      metrics: { competitorCoveragePct: s.competitorCoveragePct },
    }));
}

function buildContentOpportunities(gap: CompetitorGapAnalysisResult): Opportunity[] {
  if (gap.contentGap.level === "low") return [];
  return [
    {
      id: "opp-content-local",
      priority: priorityFromGapLevel(gap.contentGap.level),
      category: "content",
      title: "Expand local service content coverage",
      description: gap.contentGap.summary,
      impact: "Richer local content improves organic visibility for service + area searches.",
      action: "Publish area-specific service pages targeting patient intent in your ranking areas.",
    },
  ];
}

function buildVisibilityOpportunities(gap: CompetitorGapAnalysisResult): Opportunity[] {
  const ops: Opportunity[] = [];
  if (!gap.pharmacy.website) {
    ops.push({
      id: "opp-visibility-website",
      priority: "Critical",
      category: "visibility",
      title: "Establish a visible pharmacy website",
      description: "Your profile has no website while most local competitors list one on Google.",
      impact: "Missing website reduces branded search capture and service landing page potential.",
      action: "Connect or publish a pharmacy website with service pages linked from Google Business Profile.",
    });
  }

  if (gap.visibilityGap.level !== "low") {
    ops.push({
      id: "opp-visibility-gbp",
      priority: priorityFromGapLevel(gap.visibilityGap.level),
      category: "visibility",
      title: "Optimise Google Business Profile completeness",
      description: gap.visibilityGap.summary,
      impact: "Complete GBP profiles rank better in local pharmacy searches.",
      action: "Add services, photos, opening hours, attributes and weekly posts to your GBP listing.",
    });
  }

  return ops;
}

function buildTrustOpportunities(gap: CompetitorGapAnalysisResult): Opportunity[] {
  if (gap.trustGap.level === "low") return [];
  return [
    {
      id: "opp-trust-signals",
      priority: priorityFromGapLevel(gap.trustGap.level),
      category: "trust",
      title: "Strengthen local trust signals",
      description: gap.trustGap.summary,
      impact: "Trust parity helps win patients comparing nearby pharmacies.",
      action: "Surface GPhC registration, NHS services, accreditations and pharmacist credentials on key pages.",
      metrics: { trustDelta: gap.trustComparison.trustDelta },
    },
  ];
}

function buildGrowthOpportunities(
  intelligence: CompetitorIntelligenceResult,
  gap: CompetitorGapAnalysisResult,
): Opportunity[] {
  const underserved = gap.serviceCoverage.filter((s) => s.competitorCoveragePct < 40);
  if (!underserved.length) return [];

  return underserved.slice(0, 3).map((s) => ({
    id: `opp-growth-${s.serviceId}`,
    priority: "Medium" as OpportunityPriority,
    category: "growth" as const,
    title: `Promote underserved service: ${s.serviceName}`,
    description: `Only ${s.competitorCoveragePct}% of ${intelligence.competitors.length} competitors visibly offer ${s.serviceName.toLowerCase()}.`,
    impact: "Lower local competition creates faster ranking opportunity for this service.",
    action: `Create targeted campaigns and landing pages for ${s.serviceName} in your priority areas.`,
    relatedServices: [s.serviceId],
  }));
}

function toRecommendedActions(opportunities: Opportunity[]): RecommendedAction[] {
  return opportunities.slice(0, 12).map((o, i) => ({
    id: `action-${o.id}`,
    priority: o.priority,
    title: o.action.split(".")[0],
    description: o.action,
    timeframe:
      o.priority === "Critical" ? "immediate" : o.priority === "High" ? "short-term" : "medium-term",
    effort: o.category === "content" ? "high" : o.category === "reviews" ? "low" : "medium",
  }));
}

export function generateOpportunities(
  intelligence: CompetitorIntelligenceResult,
  gap: CompetitorGapAnalysisResult,
): OpportunityEngineResult {
  const opportunities = [
    ...buildReviewOpportunities(gap),
    ...buildServiceOpportunities(gap),
    ...buildContentOpportunities(gap),
    ...buildVisibilityOpportunities(gap),
    ...buildTrustOpportunities(gap),
    ...buildGrowthOpportunities(intelligence, gap),
  ];

  const priorityOrder: OpportunityPriority[] = ["Critical", "High", "Medium", "Low"];
  opportunities.sort(
    (a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority),
  );

  const recommendedActions = toRecommendedActions(opportunities);

  const dashboard: DashboardCompetitorIntel = {
    slug: intelligence.slug,
    generatedAt: new Date().toISOString(),
    competitors: intelligence.competitors,
    competitorSummary: intelligence.competitorSummary,
    serviceCoverage: gap.serviceCoverage,
    reviewComparison: gap.reviewComparison,
    trustComparison: gap.trustComparison,
    opportunities,
    recommendedActions,
    gaps: {
      reviewGap: gap.reviewGap,
      serviceGap: gap.serviceGap,
      contentGap: gap.contentGap,
      visibilityGap: gap.visibilityGap,
      trustGap: gap.trustGap,
    },
  };

  const summary = {
    critical: opportunities.filter((o) => o.priority === "Critical").length,
    high: opportunities.filter((o) => o.priority === "High").length,
    medium: opportunities.filter((o) => o.priority === "Medium").length,
    low: opportunities.filter((o) => o.priority === "Low").length,
    total: opportunities.length,
  };

  return {
    slug: intelligence.slug,
    generatedAt: new Date().toISOString(),
    opportunities,
    recommendedActions,
    summary,
    dashboard,
  };
}

export function writeOpportunityEngineResult(result: OpportunityEngineResult): {
  opportunityPath: string;
  dashboardPath: string;
} {
  fs.mkdirSync(OPPORTUNITY_ENGINE_DIR, { recursive: true });
  const opportunityPath = path.join(OPPORTUNITY_ENGINE_DIR, `${result.slug}.json`);
  const dashboardPath = path.join(OPPORTUNITY_ENGINE_DIR, `${result.slug}-dashboard.json`);

  fs.writeFileSync(
    opportunityPath,
    JSON.stringify(
      {
        slug: result.slug,
        generatedAt: result.generatedAt,
        opportunities: result.opportunities,
        recommendedActions: result.recommendedActions,
        summary: result.summary,
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(dashboardPath, JSON.stringify(result.dashboard, null, 2));

  const intelDashboardPath = path.join(
    process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine",
    "data/pharmacy-competitor-intelligence",
    `${result.slug}-dashboard.json`,
  );
  fs.mkdirSync(path.dirname(intelDashboardPath), { recursive: true });
  fs.writeFileSync(intelDashboardPath, JSON.stringify(result.dashboard, null, 2));

  return { opportunityPath, dashboardPath };
}

export function loadOpportunityEngineResult(slug: string): OpportunityEngineResult | null {
  const file = path.join(OPPORTUNITY_ENGINE_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const partial = JSON.parse(fs.readFileSync(file, "utf8"));
    const dashboardFile = path.join(OPPORTUNITY_ENGINE_DIR, `${slug}-dashboard.json`);
    const dashboard = fs.existsSync(dashboardFile)
      ? JSON.parse(fs.readFileSync(dashboardFile, "utf8"))
      : null;
    return { ...partial, dashboard };
  } catch {
    return null;
  }
}
