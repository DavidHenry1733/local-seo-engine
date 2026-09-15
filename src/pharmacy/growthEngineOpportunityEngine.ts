/**
 * Growth Engine — Growth Intelligence V1 evidence engine.
 * Every recommendation must be backed by real profile, Google Places, or generated content data.
 */
import fs from "node:fs";
import path from "node:path";
import type { GrowthEngineCompetitorSnapshot } from "./growthEngineCompetitorModel.ts";
import { realGoogleCompetitors } from "./growthEngineLocalMarketAnalysis.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import {
  buildGrowthPlanRecommendation,
  type GrowthEnginePlanRecommendation,
} from "./growthEngineFrameworkService.ts";
import { contentPackageGenerated, loadContentPackage } from "./pharmacyContentPackageService.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import {
  buildPharmacyWideServiceOpportunityAssessment,
  serviceOpportunityRowsToGrowthOpportunities,
} from "./growthEngineServiceOpportunityEvidence.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import {
  GROWTH_OPPORTUNITY_VERSION,
  buildOpportunityOverview,
  buildOpportunityRoadmap,
  dedupeOpportunities,
  normalizeGrowthOpportunity,
  parseComparisonNumber,
  sortOpportunities,
  type GrowthOpportunity,
  type GrowthOpportunityReport,
  type OpportunityCategory,
  type OpportunityConfidence,
  type OpportunityEvidenceSource,
  type OpportunityPriority,
} from "./growthEngineOpportunityModel.ts";
import { readPharmacyIndexingSummary } from "./pharmacyIndexingBridgeService.ts";

const WEBSITE_ANALYSIS_PLACEHOLDERS = [
  { label: "Pages found by search engines", note: "Available after website scan" },
  { label: "Blog articles", note: "Available after website scan" },
  { label: "Business details for Google", note: "Available after website scan" },
  { label: "Links between pages", note: "Available after website scan" },
  { label: "Site speed signals", note: "Available after website scan" },
  { label: "Page load performance", note: "Available after website scan" },
  { label: "Service coverage", note: "Available after website scan" },
];

const CONTENT_ASSET_CHECKS: Array<{ type: string; label: string; idSuffix: string }> = [
  { type: "service-page", label: "Service page", idSuffix: "service-page" },
  { type: "faq", label: "FAQ", idSuffix: "faq" },
  { type: "guides", label: "Guide", idSuffix: "guide" },
  { type: "blog", label: "Blog", idSuffix: "blog" },
  { type: "local-area-pages", label: "Cluster pages", idSuffix: "cluster" },
];

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
}

function loadProfile(slug: string) {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function serviceLabel(serviceId: string): string {
  return getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function googleConfidence(competitorCount: number): OpportunityConfidence {
  if (competitorCount >= 5) return "high";
  if (competitorCount >= 2) return "medium";
  return "low";
}

function addOpportunity(
  drafts: Partial<GrowthOpportunity>[],
  draft: Partial<GrowthOpportunity>,
): void {
  const normalized = normalizeGrowthOpportunity(draft);
  if (normalized) drafts.push(normalized);
}

function buildGooglePlacesOpportunities(snapshot: GrowthEngineCompetitorSnapshot | null): GrowthOpportunity[] {
  if (!snapshot?.analysis || snapshot.analysis.dataSource !== "google-places-live") return [];

  const yours = snapshot.yourPharmacy;
  const pool = realGoogleCompetitors(snapshot.competitors);
  if (!yours || !pool.length) return [];

  const confidence = googleConfidence(pool.length);
  const drafts: Partial<GrowthOpportunity>[] = [];

  for (const row of snapshot.analysis.comparisons) {
    if (!row.hasData) continue;

    const current = parseComparisonNumber(row.yourPharmacy);
    const comparison = parseComparisonNumber(row.competitorAverage);
    if (current == null || comparison == null) continue;

    if (row.id === "reviews" && current < comparison) {
      addOpportunity(drafts, {
        id: "google-reviews-gap",
        title: "Increase Google review acquisition",
        category: "google-reviews",
        priority: current < comparison * 0.5 ? "high" : "medium",
        evidenceSource: "Google Places",
        whyItMatters: "Google reviews influence local trust and Google Business Profile visibility.",
        evidenceSummary: "Average of local competitors discovered through Google Places.",
        currentValue: row.yourPharmacy,
        comparisonValue: row.competitorAverage,
        recommendedAction: "Increase Google review acquisition with in-store prompts and follow-up.",
        expectedBenefit: "Improved local trust and stronger Google Business Profile visibility.",
        confidence,
        futureStatus: null,
        sortScore: comparison - current,
      });
    }

    if (row.id === "photos" && current < comparison) {
      // Unknown / unproven own-pharmacy photo counts must never create a photos gap.
      if (yours.photoCount < 0) continue;
      addOpportunity(drafts, {
        id: "google-photos-gap",
        title: "Add more Google Business photos",
        category: "photos",
        priority: pool.filter((c) => c.photoCount >= 0 && c.photoCount > current + 10).length >= 2 ? "high" : "medium",
        evidenceSource: "Google Places",
        whyItMatters: "Photos help patients recognise your pharmacy and improve profile engagement.",
        evidenceSummary: "Photo count compared with local competitors on Google Places.",
        currentValue: row.yourPharmacy,
        comparisonValue: row.competitorAverage,
        recommendedAction: "Upload professional photos of the pharmacy, team and services to Google Business Profile.",
        expectedBenefit: "Stronger first impression and improved local profile completeness.",
        confidence,
        futureStatus: null,
        sortScore: comparison - current,
      });
    }

    if (row.id === "categories" && current < comparison) {
      addOpportunity(drafts, {
        id: "google-categories-gap",
        title: "Expand Google Business categories",
        category: "categories",
        priority: "medium",
        evidenceSource: "Google Places",
        whyItMatters: "Additional relevant categories help Google match your pharmacy to more local searches.",
        evidenceSummary: "Category count compared with local competitors on Google Places.",
        currentValue: row.yourPharmacy,
        comparisonValue: row.competitorAverage,
        recommendedAction: "Review and add optional pharmacy service categories supported by your profile.",
        expectedBenefit: "Broader local relevance for pharmacy-related searches.",
        confidence,
        futureStatus: null,
        sortScore: comparison - current,
      });
    }

    if (row.id === "rating" && current < comparison) {
      addOpportunity(drafts, {
        id: "google-rating-gap",
        title: "Improve Google rating through service quality",
        category: "local-visibility",
        priority: "medium",
        evidenceSource: "Google Places",
        whyItMatters: "Rating influences patient choice in local pharmacy searches.",
        evidenceSummary: "Average rating compared with local competitors on Google Places.",
        currentValue: row.yourPharmacy,
        comparisonValue: row.competitorAverage,
        recommendedAction: "Address recurring feedback themes and follow up with recent reviewers where appropriate.",
        expectedBenefit: "Stronger reputation signal in local search results.",
        confidence,
        futureStatus: null,
        sortScore: (comparison - current) * 20,
      });
    }
  }

  if (!yours.website && pool.filter((c) => c.website).length >= Math.ceil(pool.length / 2)) {
    addOpportunity(drafts, {
      id: "google-website-link",
      title: "Link website on Google Business Profile",
      category: "local-visibility",
      priority: "medium",
      evidenceSource: "Google Places",
      whyItMatters: "Many local competitors list a website on Google — patients expect a direct link.",
      evidenceSummary: `${pool.filter((c) => c.website).length} of ${pool.length} local competitors list a website on Google.`,
      currentValue: "Not listed",
      comparisonValue: `${pool.filter((c) => c.website).length} competitors`,
      recommendedAction: "Add your pharmacy website URL to your Google Business Profile.",
      expectedBenefit: "Patients can move from Google search to your owned website.",
      confidence,
      futureStatus: null,
      sortScore: 50,
    });
  }

  if (
    yours.rating != null &&
    pool.every((c) => c.rating == null || yours.rating! >= (c.rating ?? 0)) &&
    pool.some((c) => c.rating != null)
  ) {
    addOpportunity(drafts, {
      id: "google-rating-strength",
      title: "Maintain strong Google rating",
      category: "local-visibility",
      priority: "low",
      evidenceSource: "Google Places",
      whyItMatters: "A leading rating is a competitive advantage in local pharmacy search.",
      evidenceSummary: "Your rating is at or above local competitors discovered through Google Places.",
      currentValue: yours.rating.toFixed(1),
      comparisonValue: snapshot.analysis.comparisons.find((r) => r.id === "rating")?.competitorAverage || "—",
      recommendedAction: "Continue monitoring reviews and responding to patient feedback.",
      expectedBenefit: "Sustain trust advantage while growing review volume.",
      confidence,
      futureStatus: null,
      sortScore: 10,
    });
  }

  return dedupeOpportunities(drafts as GrowthOpportunity[]);
}

function buildMissingContentOpportunities(slug: string, enabledServices: string[]): GrowthOpportunity[] {
  const drafts: Partial<GrowthOpportunity>[] = [];

  for (const serviceId of enabledServices) {
    const serviceName = serviceLabel(serviceId);
    const generated = contentPackageGenerated(slug, serviceId);

    if (!generated) {
      addOpportunity(drafts, {
        id: `content-ecosystem-missing-${serviceId}`,
        title: `Generate content ecosystem for ${serviceName}`,
        category: "content-coverage",
        priority: "high",
        evidenceSource: "Generated Content",
        whyItMatters: "This service is enabled on your profile but has no generated content package yet.",
        evidenceSummary: "Business Profile selectedServices compared with content package manifest.",
        currentValue: "Not generated",
        comparisonValue: "Ecosystem expected",
        recommendedAction: `Generate the ${serviceName} content package including service page and supporting assets.`,
        expectedBenefit: "Published service content aligned to your enabled pharmacy offering.",
        confidence: "high",
        futureStatus: null,
        serviceId,
        sortScore: 200,
      });
      continue;
    }

    const pkg = loadContentPackage(slug, serviceId);
    if (!pkg) continue;

    for (const check of CONTENT_ASSET_CHECKS) {
      const asset = pkg.assets.find((a) => a.type === check.type);
      if (asset?.included) continue;

      addOpportunity(drafts, {
        id: `content-missing-${check.idSuffix}-${serviceId}`,
        title: `${check.label} missing for ${serviceName}`,
        category: "content-coverage",
        priority: check.type === "service-page" ? "high" : "medium",
        evidenceSource: "Generated Content",
        whyItMatters: `${check.label} strengthens service discovery and patient education for ${serviceName}.`,
        evidenceSummary: "Content package manifest shows this asset is not included.",
        currentValue: asset?.status === "planned" ? "Planned" : "Missing",
        comparisonValue: "Included in ecosystem",
        recommendedAction: `Regenerate or complete the ${serviceName} package to include ${check.label.toLowerCase()}.`,
        expectedBenefit: `Full ${serviceName} content coverage across your generated ecosystem.`,
        confidence: "high",
        futureStatus: null,
        serviceId,
        sortScore: check.type === "service-page" ? 180 : 120,
      });
    }
  }

  return dedupeOpportunities(drafts as GrowthOpportunity[]);
}

function buildProfileServiceOpportunities(enabledServices: string[]): GrowthOpportunity[] {
  if (enabledServices.length) return [];

  const drafts: Partial<GrowthOpportunity>[] = [];
  addOpportunity(drafts, {
    id: "profile-no-services",
    title: "Select pharmacy services on your profile",
    category: "pharmacy-services",
    priority: "high",
    evidenceSource: "Business Profile",
    whyItMatters: "Enabled services drive content generation and local service messaging.",
    evidenceSummary: "Business Profile selectedServices is empty.",
    currentValue: "0 services",
    comparisonValue: "At least 1 required",
    recommendedAction: "Select the pharmacy services you offer in Business Intelligence.",
    expectedBenefit: "Accurate service-led growth recommendations and content packages.",
    confidence: "high",
    futureStatus: null,
    sortScore: 250,
  });

  return dedupeOpportunities(drafts as GrowthOpportunity[]);
}

function buildSearchConsoleOpportunities(slug: string): GrowthOpportunity[] {
  const indexing = readPharmacyIndexingSummary(slug);
  if (!indexing || indexing.totalRegistered === 0) return [];

  const drafts: Partial<GrowthOpportunity>[] = [];

  if (indexing.notIndexed > 0) {
    addOpportunity(drafts, {
      id: "search-console-not-indexed",
      title: "Submit pages not yet indexed",
      category: "search-console",
      priority: indexing.notIndexed >= 3 ? "high" : "medium",
      evidenceSource: "Search Console",
      whyItMatters: "Pages that are not indexed cannot drive organic search traffic.",
      evidenceSummary: "Pharmacy indexing registry and Search Console tracking summary.",
      currentValue: String(indexing.notIndexed),
      comparisonValue: `${indexing.indexed} indexed`,
      recommendedAction: "Review not-indexed pages and submit or fix blocking issues.",
      expectedBenefit: "More published pharmacy pages available in Google search.",
      confidence: indexing.totalRegistered >= 5 ? "high" : "medium",
      futureStatus: null,
      sortScore: indexing.notIndexed * 10,
    });
  }

  if (indexing.readyToSubmit > 0) {
    addOpportunity(drafts, {
      id: "search-console-ready-submit",
      title: "Submit ready pages for indexing",
      category: "search-console",
      priority: "medium",
      evidenceSource: "Search Console",
      whyItMatters: "Published pages waiting for submission are not yet discoverable in search.",
      evidenceSummary: "Pharmacy indexing registry shows pages ready to submit.",
      currentValue: String(indexing.readyToSubmit),
      comparisonValue: "0 pending",
      recommendedAction: "Run indexing submission for ready pages from the publishing workflow.",
      expectedBenefit: "Faster discovery of newly published pharmacy content.",
      confidence: "high",
      futureStatus: null,
      sortScore: indexing.readyToSubmit * 8,
    });
  }

  return dedupeOpportunities(drafts as GrowthOpportunity[]);
}

/**
 * Growth Intelligence enabled-service contract.
 * Operator-confirmed Business Profile `selectedServices` only.
 * Detection, priority lists, delivery-profile keys, campaigns and GBP categories are not confirmation.
 * Empty selection returns [] — never defaults to Pharmacy First.
 */
export function resolveEnabledServices(profile: ReturnType<typeof normalizeProfileData>): string[] {
  const selected = Array.isArray(profile.selectedServices) ? profile.selectedServices : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of selected) {
    const id = String(raw ?? "").trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function buildReadyToBuild(
  slug: string,
  opportunities: GrowthOpportunity[],
  plan: GrowthEnginePlanRecommendation,
  topServiceId?: string,
): GrowthOpportunityReport["readyToBuild"] {
  const contentGap = opportunities.find(
    (o) => o.category === "pharmacy-services" && o.priority === "high" && o.serviceId,
  );
  const primaryServiceId = topServiceId || contentGap?.serviceId || plan.primaryServiceId;
  const primaryServiceName = serviceLabel(primaryServiceId);

  let reason = "Primary service from your growth plan.";
  if (contentGap) {
    reason = contentGap.evidenceSummary || contentGap.whyItMatters;
  } else {
    const top = opportunities[0];
    if (top) reason = top.whyItMatters;
  }

  return {
    recommendedCampaign: contentGap ? `${primaryServiceName} Content Ecosystem` : plan.suggestedCampaign,
    reason,
    estimatedEcosystem: contentGap
      ? `${primaryServiceName} service page with FAQs, guides, blog and local cluster pages`
      : plan.suggestedEcosystem,
    estimatedTime: plan.estimatedPublishingDays,
    primaryServiceId,
    primaryServiceName,
    planUrl: `/api/growth-engine/growth-plan?slug=${encodeURIComponent(slug)}`,
  };
}

function collectDataSources(opportunities: GrowthOpportunity[]): OpportunityEvidenceSource[] {
  return [...new Set(opportunities.map((o) => o.evidenceSource))];
}

export function buildGrowthOpportunityReport(
  slug: string,
  snapshot: GrowthEngineCompetitorSnapshot | null = loadCompetitorSnapshot(slug),
): GrowthOpportunityReport {
  const profile = loadProfile(slug);
  const enabledServices = resolveEnabledServices(profile);
  const plan = buildGrowthPlanRecommendation(slug);

  const google = buildGooglePlacesOpportunities(snapshot);
  const serviceAssessment = buildPharmacyWideServiceOpportunityAssessment(slug, google);
  const serviceOpportunities = serviceOpportunityRowsToGrowthOpportunities(serviceAssessment);
  const profileServices = buildProfileServiceOpportunities(enabledServices);
  const searchConsole = buildSearchConsoleOpportunities(slug);

  const all = sortOpportunities(
    dedupeOpportunities([...serviceOpportunities, ...google, ...profileServices, ...searchConsole]),
  );

  const localVisibility = all.filter(
    (o) => o.category === "local-visibility" || o.category === "google-reviews" || o.category === "photos" || o.category === "categories",
  );

  const topServiceId = serviceAssessment.topPriorityServices[0]?.serviceId;

  return {
    version: GROWTH_OPPORTUNITY_VERSION,
    slug,
    generatedAt: new Date().toISOString(),
    overview: buildOpportunityOverview(all),
    opportunities: all,
    missingContent: all.filter((o) => o.category === "pharmacy-services" || o.category === "content-coverage"),
    localVisibility,
    roadmap: buildOpportunityRoadmap(all),
    readyToBuild: buildReadyToBuild(slug, all, plan, topServiceId),
    websiteAnalysisPlaceholders: WEBSITE_ANALYSIS_PLACEHOLDERS,
    dataSources: collectDataSources(all),
    serviceOpportunityAssessment: serviceAssessment,
  };
}

export function opportunitiesPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-opportunities.json`);
}

export function saveGrowthOpportunityReport(report: GrowthOpportunityReport): string {
  const file = opportunitiesPath(report.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

export function loadGrowthOpportunityReport(slug: string): GrowthOpportunityReport | null {
  const file = opportunitiesPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as GrowthOpportunityReport;
  } catch {
    return null;
  }
}

export function isContentCategory(category: OpportunityCategory): boolean {
  return category === "content-coverage" || category === "missing-services" || category === "website-content";
}
