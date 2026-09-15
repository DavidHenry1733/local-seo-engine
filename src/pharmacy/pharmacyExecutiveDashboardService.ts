/**
 * Pharmacy Executive Dashboard V1 — business growth intelligence for pharmacy owners.
 * Aggregates existing JSON outputs; no new APIs or generation changes.
 */
import fs from "node:fs";
import path from "node:path";
import { auditPharmacyProfile } from "./pharmacyProfileSchema.ts";
import { buildProductionTrustSignals } from "./pharmacyProfileProductionSafety.ts";
import {
  PHARMACY_WORKSPACE_ROOT,
  resolvePharmacyWorkspaceRoot,
} from "./pharmacyWorkspacePaths.ts";

export const WORKSPACE_ROOT = PHARMACY_WORKSPACE_ROOT;
export { resolvePharmacyWorkspaceRoot };
export const EXECUTIVE_DASHBOARD_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-executive-dashboard");

export type GrowthBand = "Early" | "Building" | "Strong" | "Leading";
export type CompetitorPositionLabel = "Behind" | "Competitive" | "Leading";
export type GrowthPotentialLabel = "Limited" | "Moderate" | "Strong" | "High";

export interface PrioritisedAction {
  rank: number;
  id: string;
  title: string;
  why: string;
  category: string;
  priority: string;
  timeframe: string;
  effort: string;
  score: number;
}

export interface ExecutiveDashboardV1 {
  version: 1;
  slug: string;
  generatedAt: string;
  pharmacyName: string;
  town: string;
  executiveSummary: {
    headline: string;
    subheadline: string;
    growthScore: number;
    growthBand: GrowthBand;
    topInsight: string;
    readinessLabel: string;
    competitorPosition: CompetitorPositionLabel;
    growthPotential: GrowthPotentialLabel;
  };
  growthScore: {
    score: number;
    band: GrowthBand;
    summary: string;
    factors: Array<{ label: string; score: number; max: number; note: string }>;
  };
  competitorPosition: {
    label: CompetitorPositionLabel;
    summary: string;
    yourRating: number | null;
    competitorAvgRating: number | null;
    yourReviews: number | null;
    competitorAvgReviews: number | null;
    competitorCount: number;
    nearestKm: number | null;
    chainVsIndependent: string;
    strengths: string[];
    risks: string[];
  };
  opportunityEngine: {
    summary: string;
    totalOpportunities: number;
    highPriorityCount: number;
    topOpportunities: Array<{
      id: string;
      priority: string;
      category: string;
      title: string;
      impact: string;
      action: string;
    }>;
  };
  localCoverage: {
    summary: string;
    areasSelected: number;
    areas: string[];
    entitiesSelected: number;
    entityBreakdown: Record<string, number>;
    localIntelligenceStatus: string;
    pagesGenerated: number;
    coverageRadius: string;
  };
  competitorWeaknesses: {
    summary: string;
    items: Array<{
      serviceName: string;
      competitorCoveragePct: number;
      insight: string;
      opportunity: string;
    }>;
  };
  estimatedGrowthPotential: {
    label: GrowthPotentialLabel;
    summary: string;
    drivers: string[];
    conservativeEstimate: string;
  };
  actionPlan: {
    summary: string;
    actions: PrioritisedAction[];
  };
  trustAndContent: {
    trustScore: number | null;
    qualityScore: number | null;
    readabilityScore: number | null;
    pagesPublished: number;
    profileCompletePct: number;
    trustSignals: string[];
  };
  dataSources: Record<string, boolean>;
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function safeSlug(slug: string): string {
  return String(slug || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function growthBand(score: number): GrowthBand {
  if (score >= 80) return "Leading";
  if (score >= 65) return "Strong";
  if (score >= 45) return "Building";
  return "Early";
}

function competitorLabel(ratingDelta: number, reviewDelta: number, lowCompetitionServices: number): CompetitorPositionLabel {
  let points = 0;
  if (ratingDelta >= 0) points += 1;
  if (reviewDelta <= 15) points += 1;
  if (lowCompetitionServices >= 3) points += 1;
  if (points >= 2) return "Leading";
  if (points === 1) return "Competitive";
  return "Behind";
}

function growthPotentialLabel(
  highPriority: number,
  lowCompetition: number,
  pagesGenerated: number,
  qualityScore: number | null,
): GrowthPotentialLabel {
  let points = 0;
  if (highPriority >= 3) points += 1;
  if (lowCompetition >= 4) points += 1;
  if (pagesGenerated >= 200) points += 1;
  if ((qualityScore || 0) >= 45) points += 1;
  if (points >= 3) return "High";
  if (points === 2) return "Strong";
  if (points === 1) return "Moderate";
  return "Limited";
}

function priorityWeight(p: string): number {
  const v = String(p || "").toLowerCase();
  if (v === "critical") return 4;
  if (v === "high") return 3;
  if (v === "medium") return 2;
  return 1;
}

function friendlyAction(text: string): string {
  return String(text || "")
    .replace(/^Build dedicated /i, "Promote ")
    .replace(/ area pages with local proof points and conversion CTAs\.?$/i, " with clear local pages and easy booking.")
    .replace(/Create targeted campaigns and landing pages for /i, "Run local campaigns for ")
    .trim();
}

export function prioritiseExecutiveActions(
  opportunities: Array<{ id?: string; priority?: string; category?: string; title?: string; impact?: string; action?: string }>,
  recommendedActions: Array<{ id?: string; priority?: string; title?: string; description?: string; timeframe?: string; effort?: string }>,
): PrioritisedAction[] {
  const scored: PrioritisedAction[] = [];
  const seen = new Set<string>();

  for (const o of opportunities) {
    const title = friendlyAction(o.action || o.title || "");
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const category = String(o.category || "growth");
    const pw = priorityWeight(o.priority || "Medium");
    const catBoost = category === "reviews" || category === "trust" ? 0.5 : 0;
    scored.push({
      rank: 0,
      id: String(o.id || `opp-${scored.length}`),
      title,
      why: String(o.impact || o.description || "Supports local growth and patient acquisition."),
      category,
      priority: String(o.priority || "Medium"),
      timeframe: "short-term",
      effort: "medium",
      score: pw + catBoost,
    });
  }

  for (const a of recommendedActions) {
    const title = friendlyAction(a.title || a.description || "");
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const pw = priorityWeight(a.priority || "Medium");
    scored.push({
      rank: 0,
      id: String(a.id || `action-${scored.length}`),
      title,
      why: String(a.description || "Recommended next step from your growth intelligence."),
      category: "operations",
      priority: String(a.priority || "Medium"),
      timeframe: String(a.timeframe || "short-term"),
      effort: String(a.effort || "medium"),
      score: pw,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 7)
    .map((a, i) => ({ ...a, rank: i + 1 }));
}

export function buildExecutiveDashboard(slug: string): ExecutiveDashboardV1 {
  const safe = safeSlug(slug);
  const profileDoc = readJson<{ data?: Record<string, unknown> }>(path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${safe}.json`));
  const profile = profileDoc?.data || {};
  const serviceLib = readJson<{ selectedServices?: unknown[] }>(path.join(WORKSPACE_ROOT, "data/pharmacy-service-library", `${safe}.json`));
  const competitorDash =
    readJson<any>(path.join(WORKSPACE_ROOT, "data/pharmacy-competitor-intelligence", `${safe}-dashboard.json`)) ||
    readJson<any>(path.join(WORKSPACE_ROOT, "data/pharmacy-opportunity-engine", `${safe}-dashboard.json`));
  const quality = readJson<any>(path.join(WORKSPACE_ROOT, "data/pharmacy-quality-audit", `${safe}.json`));
  const readability = readJson<any>(path.join(WORKSPACE_ROOT, "data/pharmacy-human-readability-audit", `${safe}.json`));
  const localIntel = readJson<any>(path.join(WORKSPACE_ROOT, "data/pharmacy-local-intelligence", `${safe}.json`));
  const publishIndex = readJson<{ pageCount?: number }>(path.join(WORKSPACE_ROOT, "output/pharmacy-publish", safe, "_publish-index.json"));

  let profileAudit: ReturnType<typeof auditPharmacyProfile> | null = null;
  try {
    profileAudit = auditPharmacyProfile(safe, profile as Record<string, unknown>);
  } catch {
    profileAudit = null;
  }

  const pharmacyName = String(profile.pharmacyName || profile.tradingName || "Your Pharmacy").trim();
  const town = String(profile.townCity || localIntel?.town || "your area").trim();
  const areas = (profile.rankingAreas as string[]) || [];
  const entityGroups = [
    "gpSurgeries", "hospitals", "healthCentres", "careHomes", "schools",
    "landmarks", "communityFacilities", "transportLinks", "retailCentres", "residentialAreas",
  ] as const;
  const entityBreakdown: Record<string, number> = {};
  let entitiesSelected = 0;
  for (const g of entityGroups) {
    const n = Array.isArray(profile[g]) ? (profile[g] as unknown[]).length : 0;
    if (n) entityBreakdown[g] = n;
    entitiesSelected += n;
  }

  const pagesGenerated = publishIndex?.pageCount || quality?.pageCount || 0;
  const qualityScore = quality?.averages?.overall ?? null;
  const readabilityScore = readability?.humanReadabilityScore ?? null;
  const profileScore = profileAudit?.score ?? 0;
  const profileCompletePct = profileAudit
    ? Math.round((profileAudit.requiredPassed / Math.max(profileAudit.requiredTotal, 1)) * 100)
    : 0;

  const summary = competitorDash?.competitorSummary || {};
  const review = competitorDash?.reviewComparison || {};
  const serviceCoverage = competitorDash?.serviceCoverage || [];
  const opportunities = competitorDash?.opportunities || [];
  const recommendedActions = competitorDash?.recommendedActions || [];
  const gaps = competitorDash?.gaps || {};

  const yourRating = review.pharmacyRating ?? null;
  const competitorAvgRating = review.competitorAvgRating ?? summary.avgRating ?? null;
  const yourReviews = review.pharmacyReviewCount ?? null;
  const competitorAvgReviews = review.competitorAvgReviewCount ?? summary.avgReviewCount ?? null;
  const ratingDelta = yourRating != null && competitorAvgRating != null ? yourRating - competitorAvgRating : 0;
  const reviewDelta = yourReviews != null && competitorAvgReviews != null ? competitorAvgReviews - yourReviews : 0;

  const lowCompetitionServices = serviceCoverage.filter(
    (s: { gapLevel?: string; competitorCoveragePct?: number }) =>
      s.gapLevel === "low" || (s.competitorCoveragePct ?? 100) <= 40,
  );
  const highPriorityOpps = opportunities.filter(
    (o: { priority?: string }) => o.priority === "Critical" || o.priority === "High",
  );

  const competitorCount = summary.count || competitorDash?.competitors?.length || 0;
  const positionLabel = competitorLabel(ratingDelta, reviewDelta, lowCompetitionServices.length);
  const potentialLabel = growthPotentialLabel(highPriorityOpps.length, lowCompetitionServices.length, pagesGenerated, qualityScore);

  const trustSignals = buildProductionTrustSignals(profile);
  const trustFactor = Math.min(100, trustSignals.length * 20 + (trustSignals.some((s) => s.startsWith("GPhC ")) ? 20 : 10));
  const pagesFactor = Math.min(100, Math.round((pagesGenerated / 240) * 100));
  const qualityFactor = qualityScore != null ? Math.round((qualityScore / 50) * 100) : 50;
  const readabilityFactor = readabilityScore != null ? Math.round((readabilityScore / 50) * 100) : 50;
  const profileFactor = profileScore || profileCompletePct;
  const localFactor = Math.min(100, Math.round((areas.length / 10) * 50 + Math.min(entitiesSelected, 20) * 2.5));
  const competitorFactor = Math.min(
    100,
    Math.round(
      50 +
        (ratingDelta >= 0 ? 15 : -10) +
        (reviewDelta <= 20 ? 10 : -5) +
        lowCompetitionServices.length * 5,
    ),
  );

  const growthScoreValue = Math.round(
    profileFactor * 0.12 +
      qualityFactor * 0.22 +
      readabilityFactor * 0.13 +
      pagesFactor * 0.18 +
      competitorFactor * 0.17 +
      localFactor * 0.1 +
      trustFactor * 0.08,
  );
  const band = growthBand(growthScoreValue);

  const competitorStrengths: string[] = [];
  const competitorRisks: string[] = [];
  if (ratingDelta >= 0) competitorStrengths.push(`Your Google rating (${yourRating}) matches or beats local average (${competitorAvgRating}).`);
  else competitorRisks.push(`Local competitors average ${competitorAvgRating} stars vs your ${yourRating}.`);
  if (reviewDelta > 20) competitorRisks.push(`Competitors average ${competitorAvgReviews} reviews — you have ${yourReviews}. Closing this gap builds trust.`);
  else if (yourReviews != null) competitorStrengths.push(`Review volume is competitive for your area (${yourReviews} reviews).`);
  if (lowCompetitionServices.length >= 3) {
    competitorStrengths.push(`${lowCompetitionServices.length} services have weaker local competition — room to stand out.`);
  }
  if ((gaps.visibilityGap?.level || "") === "high") {
    competitorRisks.push(String(gaps.visibilityGap.summary || "Google visibility needs attention."));
  }

  const weaknessItems = lowCompetitionServices
    .slice(0, 6)
    .map((s: { serviceName?: string; competitorCoveragePct?: number }) => ({
      serviceName: String(s.serviceName || "Service"),
      competitorCoveragePct: Number(s.competitorCoveragePct || 0),
      insight: `Only ${s.competitorCoveragePct}% of nearby pharmacies promote this prominently.`,
      opportunity: `Strong chance to become the go-to pharmacy for ${String(s.serviceName || "this service").toLowerCase()} in ${town}.`,
    }));

  const actions = prioritiseExecutiveActions(opportunities, recommendedActions);
  const topOpp = opportunities[0];
  const topInsight = topOpp?.title
    ? String(topOpp.title)
    : lowCompetitionServices[0]?.serviceName
      ? `${lowCompetitionServices[0].serviceName} is under-promoted locally — a clear growth opportunity.`
      : "Complete competitor intelligence to unlock tailored growth recommendations.";

  const potentialDrivers: string[] = [];
  if (highPriorityOpps.length) potentialDrivers.push(`${highPriorityOpps.length} high-priority growth opportunities identified.`);
  if (lowCompetitionServices.length) potentialDrivers.push(`${lowCompetitionServices.length} services with limited local competition.`);
  if (pagesGenerated >= 200) potentialDrivers.push(`${pagesGenerated} local service pages ready to drive enquiries.`);
  if ((qualityScore || 0) >= 45) potentialDrivers.push("Content quality is strong — focus on visibility and reviews.");
  if (!potentialDrivers.length) potentialDrivers.push("Complete setup and competitor analysis to quantify growth potential.");

  const conservativeEstimate =
    potentialLabel === "High"
      ? "With consistent action on reviews and local visibility, meaningful enquiry growth is realistic within 3–6 months."
      : potentialLabel === "Strong"
        ? "Focused improvements to reviews and under-promoted services could lift local enquiries over the next quarter."
        : potentialLabel === "Moderate"
          ? "Steady progress is achievable by completing local pages and closing review gaps."
          : "Complete your profile and competitor analysis to unlock growth recommendations.";

  const readinessLabel =
    pagesGenerated >= 200 && profileCompletePct >= 80
      ? "Launch-ready"
      : profileCompletePct >= 80
        ? "Profile ready — build pages"
        : "Setup in progress";

  return {
    version: 1,
    slug: safe,
    generatedAt: new Date().toISOString(),
    pharmacyName,
    town,
    executiveSummary: {
      headline: `${pharmacyName} — Growth Overview`,
      subheadline: `${town} · ${competitorCount || "No"} local competitors analysed · ${areas.length} priority areas`,
      growthScore: growthScoreValue,
      growthBand: band,
      topInsight,
      readinessLabel,
      competitorPosition: positionLabel,
      growthPotential: potentialLabel,
    },
    growthScore: {
      score: growthScoreValue,
      band,
      summary:
        band === "Leading"
          ? "Your pharmacy is well positioned for local growth — focus on reviews and high-impact services."
          : band === "Strong"
            ? "Solid foundations — targeted actions on visibility and differentiation will accelerate growth."
            : band === "Building"
              ? "Good progress — complete local coverage and competitor actions to strengthen position."
              : "Early stage — complete profile setup and run competitor intelligence first.",
      factors: [
        { label: "Content quality", score: qualityFactor, max: 100, note: qualityScore != null ? `${qualityScore}/50 average` : "Run quality audit" },
        { label: "Local pages", score: pagesFactor, max: 100, note: `${pagesGenerated} pages generated` },
        { label: "Profile readiness", score: profileFactor, max: 100, note: `${profileCompletePct}% required fields` },
        { label: "Competitor position", score: competitorFactor, max: 100, note: positionLabel },
        { label: "Local coverage", score: localFactor, max: 100, note: `${areas.length} areas · ${entitiesSelected} entities` },
        { label: "Patient readability", score: readabilityFactor, max: 100, note: readabilityScore != null ? `${readabilityScore}/50` : "Not audited" },
        { label: "Trust signals", score: trustFactor, max: 100, note: `${trustSignals.length} credentials surfaced` },
      ],
    },
    competitorPosition: {
      label: positionLabel,
      summary:
        positionLabel === "Leading"
          ? `You compare well against ${competitorCount} nearby pharmacies — protect your advantage with reviews and local visibility.`
          : positionLabel === "Competitive"
            ? `You are in the mix with ${competitorCount} local pharmacies — differentiation and reviews will decide who wins local patients.`
            : `Local competition is active (${competitorCount} pharmacies nearby) — prioritise reviews, trust signals and under-served services.`,
      yourRating,
      competitorAvgRating,
      yourReviews,
      competitorAvgReviews,
      competitorCount,
      nearestKm: summary.nearestDistanceKm ?? null,
      chainVsIndependent: `${summary.chainCount || 0} chains · ${summary.independentCount || 0} independents nearby`,
      strengths: competitorStrengths,
      risks: competitorRisks,
    },
    opportunityEngine: {
      summary: opportunities.length
        ? `${opportunities.length} growth opportunities identified — ${highPriorityOpps.length} are high priority.`
        : "Run competitor intelligence to generate tailored opportunities.",
      totalOpportunities: opportunities.length,
      highPriorityCount: highPriorityOpps.length,
      topOpportunities: opportunities.slice(0, 5).map((o: any) => ({
        id: String(o.id || ""),
        priority: String(o.priority || "Medium"),
        category: String(o.category || "growth"),
        title: String(o.title || ""),
        impact: String(o.impact || ""),
        action: friendlyAction(o.action || o.title || ""),
      })),
    },
    localCoverage: {
      summary: areas.length
        ? `Covering ${areas.length} priority areas with ${entitiesSelected} local places referenced in your content.`
        : "Add ranking areas in pharmacy setup to build local coverage.",
      areasSelected: areas.length,
      areas: areas.slice(0, 12),
      entitiesSelected,
      entityBreakdown,
      localIntelligenceStatus: localIntel?.researchStatus || (localIntel ? "available" : "not generated"),
      pagesGenerated,
      coverageRadius: String(profile.coverageRadius || "Local area"),
    },
    competitorWeaknesses: {
      summary: weaknessItems.length
        ? `Competitors under-promote ${weaknessItems.length} of your services — these are your easiest wins.`
        : "Run competitor intelligence to find services where rivals are weaker locally.",
      items: weaknessItems,
    },
    estimatedGrowthPotential: {
      label: potentialLabel,
      summary: conservativeEstimate,
      drivers: potentialDrivers,
      conservativeEstimate,
    },
    actionPlan: {
      summary: actions.length
        ? `Top ${actions.length} actions ranked by business impact — start with #1 this week.`
        : "Complete competitor intelligence to generate your action plan.",
      actions,
    },
    trustAndContent: {
      trustScore: competitorDash?.trustComparison?.pharmacyTrustScore ?? null,
      qualityScore,
      readabilityScore,
      pagesPublished: pagesGenerated,
      profileCompletePct,
      trustSignals,
    },
    dataSources: {
      profile: Boolean(profileDoc),
      competitorDashboard: Boolean(competitorDash),
      qualityAudit: Boolean(quality),
      readabilityAudit: Boolean(readability),
      localIntelligence: Boolean(localIntel),
      publishIndex: Boolean(publishIndex),
      serviceLibrary: Boolean(serviceLib),
    },
  };
}

export function writeExecutiveDashboardJson(slug: string): string {
  const dashboard = buildExecutiveDashboard(slug);
  const safe = safeSlug(slug);
  fs.mkdirSync(EXECUTIVE_DASHBOARD_DIR, { recursive: true });
  const outPath = path.join(EXECUTIVE_DASHBOARD_DIR, `${safe}.json`);
  fs.writeFileSync(outPath, JSON.stringify(dashboard, null, 2));
  return outPath;
}
