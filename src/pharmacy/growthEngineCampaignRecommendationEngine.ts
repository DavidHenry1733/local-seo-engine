/**
 * Growth Engine — Growth Plan Intelligence V1 recommendation engine.
 * Selects ONE evidence-backed priority campaign from enabled profile services.
 */
import fs from "node:fs";
import path from "node:path";
import {
  BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS,
  CAMPAIGN_EXPECTED_BENEFITS,
  GROWTH_PLAN_INTELLIGENCE_VERSION,
  type CampaignAlternative,
  type CampaignConfidence,
  type CampaignEvidence,
  type CampaignEvidenceSource,
  type CampaignPriority,
  type CampaignReadinessItem,
  type GrowthEngineCampaignRecommendation,
  type GrowthPlanExecutiveSummary,
  type GrowthPlanIntelligence,
} from "./growthEngineCampaignModel.ts";
import type { GrowthEngineCompetitorSnapshot } from "./growthEngineCompetitorModel.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { buildGrowthOpportunityReport } from "./growthEngineOpportunityEngine.ts";
import type { GrowthOpportunity } from "./growthEngineOpportunityModel.ts";
import { loadWebsiteIntelligenceSnapshot, resolveWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import type { GrowthEngineWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceModel.ts";
import { contentPackageGenerated } from "./pharmacyContentPackageService.ts";
import { computeCampaignPharmacyReadiness } from "./pharmacyProfileFieldClassification.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { collectServiceIdsFromProfile } from "./pharmacyProfileV2Fields.ts";
import { BENCHMARK_MASTER_SERVICE_IDS, getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { readPharmacyIndexingSummary } from "./pharmacyIndexingBridgeService.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { explicitConfirmedLocalityNames } from "./growthEngineCampaignTargetAreaRankingService.ts";

interface ScoredCampaign {
  serviceId: string;
  campaignName: string;
  evidence: CampaignEvidence[];
  score: number;
  opportunities: GrowthOpportunity[];
}

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
}

function workflowPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-workflow.json`);
}

function loadProfile(slug: string) {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function loadWorkflowAck(slug: string, stepId: string): boolean {
  const file = workflowPath(slug);
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return Boolean(raw.acknowledgedSteps?.[stepId]);
  } catch {
    return false;
  }
}

function serviceLabel(serviceId: string): string {
  return getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveEnabledServices(profile: ReturnType<typeof normalizeProfileData>): string[] {
  // Always apply classification-aware collection so incompatible clinical residue cannot drive campaigns.
  const collected = collectServiceIdsFromProfile(profile as unknown as Record<string, unknown>);
  if (collected.length) return collected;
  return (profile.selectedServices || []).filter(Boolean);
}

function eligibleCampaignServices(enabledServices: string[]): string[] {
  const benchmarkSet = new Set<string>(BENCHMARK_MASTER_SERVICE_IDS);
  return enabledServices.filter((id) => benchmarkSet.has(id));
}

function resolveClusterPageCount(profile: ReturnType<typeof normalizeProfileData>): number {
  const confirmed = explicitConfirmedLocalityNames(profile.selectedAreas);
  if (confirmed.length) {
    return Math.min(confirmed.length, BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.maxClusterPages);
  }
  const storedNamed = (profile.selectedAreas || []).map((a) => String(a.areaName || "").trim()).filter(Boolean);
  const recommended = Math.min(
    BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.recommendedTargetAreas,
    storedNamed.length,
    BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.maxClusterPages,
  );
  if (storedNamed.length >= BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.recommendedTargetAreas) {
    return recommended;
  }
  const count = storedNamed.length || (profile.rankingAreas || []).length || 5;
  return Math.min(count, BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.maxClusterPages);
}

export function estimateCampaignOutputs(
  profile: ReturnType<typeof normalizeProfileData>,
): GrowthEngineCampaignRecommendation["estimatedOutputs"] {
  const clusterPages = resolveClusterPageCount(profile);
  return {
    servicePage: BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.servicePage,
    clusterPages,
    patientGuides: BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.patientGuides,
    blogs: BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.blogs,
    faqs: BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.faqs,
    gbpPosts: BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.gbpPosts,
    socialPosts: BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.socialPosts,
    emails: BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.emails,
    videos: BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.videos,
    landingPages: BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.landingPages,
  };
}

function priorityFromScore(score: number): CampaignPriority {
  if (score >= 200) return "high";
  if (score >= 100) return "medium";
  return "low";
}

function confidenceFromEvidence(evidence: CampaignEvidence[]): CampaignConfidence {
  const sources = new Set(evidence.map((e) => e.source));
  const strong =
    evidence.some((e) => e.source === "Website Intelligence" && e.headline.includes("No supporting")) ||
    evidence.some((e) => e.source === "Generated Content" && e.headline.includes("No content ecosystem")) ||
    evidence.some((e) => e.source === "Growth Intelligence" && e.headline.includes("high priority"));

  if (sources.size >= 3 || (sources.size >= 2 && strong)) return "high";
  if (sources.size >= 2 || strong) return "medium";
  return "low";
}

function collectWebsiteEvidence(
  serviceId: string,
  serviceName: string,
  website: GrowthEngineWebsiteIntelligenceSnapshot | null,
): CampaignEvidence[] {
  if (!website?.analysis?.understandingComplete) return [];
  const items: CampaignEvidence[] = [];
  const coverage = website.analysis.coverage.find((r) => r.serviceId === serviceId);
  const missing = website.analysis.missingContent.filter((m) => m.serviceId === serviceId);
  const opportunities = website.analysis.opportunities.filter((o) => o.serviceId === serviceId);

  if (coverage && !coverage.websiteDetected) {
    items.push({
      source: "Website Intelligence",
      headline: `No ${serviceName} page detected on your website`,
      detail: coverage.mainPageUrl
        ? `We found limited content for ${serviceName} — your profile lists this service but the website does not have a dedicated service page.`
        : `${serviceName} is enabled on your Business Profile but was not detected during the website crawl.`,
    });
  }

  for (const gap of missing) {
    items.push({
      source: "Website Intelligence",
      headline: `Website gap: ${gap.gap}`,
      detail: gap.evidence,
    });
  }

  for (const opp of opportunities.slice(0, 2)) {
    items.push({
      source: "Website Intelligence",
      headline: opp.headline,
      detail: opp.evidence,
    });
  }

  if (coverage?.websiteDetected && coverage.supportingContent) {
    const sc = coverage.supportingContent;
    const thin =
      sc.faqs === 0 && sc.blogs === 0 && sc.guides === 0 && sc.localPages === 0;
    if (thin && !items.length) {
      items.push({
        source: "Website Intelligence",
        headline: `${serviceName} page exists but supporting content is thin`,
        detail: `Your website has a ${serviceName} page but no FAQs, blogs, guides, or local area pages were detected to support it.`,
      });
    }
  }

  return items;
}

function collectGeneratedContentEvidence(slug: string, serviceId: string, serviceName: string): CampaignEvidence[] {
  const items: CampaignEvidence[] = [];
  if (!contentPackageGenerated(slug, serviceId)) {
    items.push({
      source: "Generated Content",
      headline: `No content ecosystem for ${serviceName}`,
      detail: "Business Profile selectedServices compared with content package manifest — no generated package exists yet.",
    });
  }
  return items;
}

function collectGrowthIntelligenceEvidence(
  serviceId: string,
  opportunities: GrowthOpportunity[],
): { evidence: CampaignEvidence[]; matched: GrowthOpportunity[] } {
  const matched = opportunities.filter((o) => o.serviceId === serviceId);
  const evidence = matched.slice(0, 3).map((o) => ({
    source: "Growth Intelligence" as CampaignEvidenceSource,
    headline: `${o.priority === "high" ? "High priority" : o.priority === "medium" ? "Medium priority" : "Opportunity"}: ${o.title}`,
    detail: o.evidenceSummary || o.whyItMatters,
  }));
  return { evidence, matched };
}

function collectLocalHealthcareEvidence(
  snapshot: GrowthEngineCompetitorSnapshot | null,
  serviceName: string,
): CampaignEvidence[] {
  if (snapshot?.analysis?.dataSource !== "google-places-live") return [];
  const items: CampaignEvidence[] = [];
  const opportunities = snapshot.healthcare?.analysis?.opportunities || [];

  for (const text of opportunities.slice(0, 2)) {
    if (/compet/i.test(text)) {
      items.push({
        source: "Local Healthcare Intelligence",
        headline: "Strong local competitor presence",
        detail: `${text} Building a ${serviceName} content ecosystem strengthens your position against nearby pharmacies.`,
      });
      break;
    }
  }

  const competitorCount = snapshot.competitors?.length || 0;
  if (!items.length && competitorCount >= 5) {
    items.push({
      source: "Local Healthcare Intelligence",
      headline: `${competitorCount} local pharmacies mapped`,
      detail: `Local Healthcare Intelligence mapped ${competitorCount} nearby pharmacies. A dedicated ${serviceName} campaign helps patients find your offering in a competitive catchment.`,
    });
  }

  return items;
}

function collectSearchConsoleEvidence(slug: string): CampaignEvidence[] {
  const indexing = readPharmacyIndexingSummary(slug);
  if (!indexing || indexing.totalRegistered === 0) return [];
  if (indexing.notIndexed <= 0 && indexing.readyToSubmit <= 0) return [];

  const parts: string[] = [];
  if (indexing.notIndexed > 0) parts.push(`${indexing.notIndexed} pages not yet indexed`);
  if (indexing.readyToSubmit > 0) parts.push(`${indexing.readyToSubmit} pages ready to submit`);

  return [
    {
      source: "Search Console",
      headline: "Search indexing gaps detected",
      detail: `Pharmacy indexing registry: ${parts.join("; ")}. New campaign content should be submitted once published.`,
    },
  ];
}

function scoreCampaign(
  slug: string,
  serviceId: string,
  serviceName: string,
  website: GrowthEngineWebsiteIntelligenceSnapshot | null,
  snapshot: GrowthEngineCompetitorSnapshot | null,
  opportunities: GrowthOpportunity[],
): ScoredCampaign {
  const evidence: CampaignEvidence[] = [];
  let score = 0;

  evidence.push({
    source: "Business Profile",
    headline: `${serviceName} is enabled on your profile`,
    detail: "This service is selected in Business Intelligence and available for content generation.",
  });
  score += 10;

  const websiteEvidence = collectWebsiteEvidence(serviceId, serviceName, website);
  for (const e of websiteEvidence) {
    evidence.push(e);
    if (e.headline.includes("No ") && e.headline.includes("page detected")) score += 120;
    else if (e.headline.includes("Website gap")) score += 80;
    else if (e.headline.includes("thin")) score += 70;
    else score += 50;
  }

  const generatedEvidence = collectGeneratedContentEvidence(slug, serviceId, serviceName);
  for (const e of generatedEvidence) {
    evidence.push(e);
    score += 130;
  }

  const { evidence: giEvidence, matched } = collectGrowthIntelligenceEvidence(serviceId, opportunities);
  for (const e of giEvidence) {
    evidence.push(e);
    const opp = matched.find((o) => e.headline.includes(o.title));
    if (opp?.priority === "high") score += 150;
    else if (opp?.priority === "medium") score += 90;
    else score += 40;
  }

  if (evidence.length > 1) {
    const localEvidence = collectLocalHealthcareEvidence(snapshot, serviceName);
    for (const e of localEvidence) {
      evidence.push(e);
      score += 30;
    }
  }

  return { serviceId, campaignName: serviceName, evidence, score, opportunities: matched };
}

function hasActionableEvidence(evidence: CampaignEvidence[]): boolean {
  return evidence.some((e) => e.source !== "Business Profile");
}

function buildPrimaryReason(evidence: CampaignEvidence[]): string {
  const actionable = evidence.filter((e) => e.source !== "Business Profile");
  const top = actionable[0];
  if (!top) return "Complete earlier workflow steps to unlock evidence-backed recommendations.";
  if (top.source === "Generated Content") {
    return `${top.headline.replace("No content ecosystem for ", "")} is enabled on your profile but has no generated content yet — this is the fastest path to a complete patient-facing ecosystem.`;
  }
  if (top.source === "Website Intelligence") {
    return top.detail;
  }
  return top.detail || top.headline;
}

function buildAlternatives(
  ranked: ScoredCampaign[],
  primary: ScoredCampaign,
): CampaignAlternative[] {
  return ranked
    .filter((c) => c.serviceId !== primary.serviceId)
    .slice(0, 3)
    .map((alt) => {
      const whyNotFirst =
        alt.score < primary.score
          ? `Lower priority score (${alt.score} vs ${primary.score}) — ${primary.campaignName} has stronger evidence right now.`
          : `Similar evidence strength, but ${primary.campaignName} addresses a more immediate gap.`;

      const reason =
        alt.evidence.find((e) => e.source !== "Business Profile")?.headline ||
        `${alt.campaignName} is enabled but has less urgent evidence than the primary recommendation.`;

      return {
        serviceId: alt.serviceId,
        campaignName: alt.campaignName,
        priority: priorityFromScore(alt.score),
        confidence: confidenceFromEvidence(alt.evidence),
        reason,
        whyNotFirst,
        evidenceCount: alt.evidence.filter((e) => e.source !== "Business Profile").length,
      };
    });
}

function buildReadiness(
  slug: string,
  profile: ReturnType<typeof normalizeProfileData>,
  website: GrowthEngineWebsiteIntelligenceSnapshot | null,
  snapshot: GrowthEngineCompetitorSnapshot | null,
  primaryServiceId: string | null,
): CampaignReadinessItem[] {
  const campaignPharmacy = computeCampaignPharmacyReadiness(profile);
  const bizComplete = campaignPharmacy.score >= 100;
  const websiteComplete = website?.analysis?.understandingComplete === true;
  const localComplete = snapshot?.analysis?.dataSource === "google-places-live";
  const growthIntelAck = loadWorkflowAck(slug, "growth-intelligence");
  const report = buildGrowthOpportunityReport(slug, snapshot);
  const growthIntelComplete = growthIntelAck || report.overview.total > 0;
  const generatorAvailable = primaryServiceId
    ? BENCHMARK_MASTER_SERVICE_IDS.includes(primaryServiceId as (typeof BENCHMARK_MASTER_SERVICE_IDS)[number])
    : false;

  return [
    {
      id: "business-profile",
      label: "Business Profile complete",
      complete: bizComplete,
      detail: bizComplete
        ? "The required pharmacy details are available for this campaign."
        : campaignPharmacy.missing.length
          ? `${campaignPharmacy.missing.join("; ")} — finish these pharmacy details`
          : "Finish the remaining pharmacy details",
    },
    {
      id: "website",
      label: "Website analysed",
      complete: websiteComplete,
      detail: websiteComplete
        ? `${website?.analysis?.inventory.totalPages || 0} pages understood`
        : "Run Website Intelligence analysis",
    },
    {
      id: "local-healthcare",
      label: "Local Healthcare analysed",
      complete: localComplete,
      detail: localComplete
        ? `${snapshot?.competitors.length || 0} local competitors mapped`
        : "Run Local Healthcare Intelligence discovery",
    },
    {
      id: "growth-intelligence",
      label: "Growth Intelligence complete",
      complete: growthIntelComplete,
      detail: growthIntelComplete
        ? `${report.overview.total} opportunities reviewed`
        : "Review Growth Intelligence opportunities",
    },
    {
      id: "generator",
      label: "Generator available",
      complete: generatorAvailable,
      detail: generatorAvailable
        ? "Service exists in benchmark content generator"
        : "Selected service is not in the generator catalogue",
    },
  ];
}

function buildExecutiveSummary(
  profile: ReturnType<typeof normalizeProfileData>,
  website: GrowthEngineWebsiteIntelligenceSnapshot | null,
  snapshot: GrowthEngineCompetitorSnapshot | null,
  primary: GrowthEngineCampaignRecommendation | null,
): GrowthPlanExecutiveSummary {
  const pharmacyName = profile.pharmacyName || "Your pharmacy";
  const town = profile.primaryTown || profile.town || "your area";
  const enabledCount = resolveEnabledServices(profile).length;
  const websitePages = website?.analysis?.inventory.totalPages || 0;
  const competitors = snapshot?.competitors.length || 0;

  let currentPosition = `${pharmacyName} serves ${town}`;
  if (enabledCount) currentPosition += ` with ${enabledCount} service${enabledCount === 1 ? "" : "s"} enabled on your profile`;
  if (website?.analysis?.understandingComplete) {
    currentPosition += `. Your website has ${websitePages} pages analysed`;
  }
  if (snapshot?.analysis?.dataSource === "google-places-live") {
    currentPosition += ` and ${competitors} local pharmacies mapped nearby`;
  }
  currentPosition += ".";

  if (!primary) {
    return {
      currentPosition,
      primaryOpportunity: "No priority campaign yet",
      whyRecommended:
        "We only recommend campaigns backed by evidence. Complete Business Intelligence, Website Intelligence, and Growth Intelligence to unlock a recommendation.",
      estimatedBusinessBenefit: "Evidence-backed campaigns improve patient discovery and service promotion once prerequisites are complete.",
    };
  }

  const primaryOpportunity = `${primary.campaignName} content ecosystem`;
  const whyRecommended = buildPrimaryReason(primary.evidence);
  const estimatedBusinessBenefit = primary.expectedBenefits.slice(0, 3).join(". ") + ".";

  return {
    currentPosition,
    primaryOpportunity,
    whyRecommended,
    estimatedBusinessBenefit,
  };
}

function toRecommendation(
  scored: ScoredCampaign,
  profile: ReturnType<typeof normalizeProfileData>,
): GrowthEngineCampaignRecommendation {
  const evidenceSources = [...new Set(scored.evidence.map((e) => e.source))];
  return {
    serviceId: scored.serviceId,
    campaignName: scored.campaignName,
    priority: priorityFromScore(scored.score),
    confidence: confidenceFromEvidence(scored.evidence),
    reason: buildPrimaryReason(scored.evidence),
    evidence: scored.evidence,
    evidenceSources,
    estimatedOutputs: estimateCampaignOutputs(profile),
    expectedBenefits: [...CAMPAIGN_EXPECTED_BENEFITS],
    score: scored.score,
  };
}

export function buildGrowthPlanIntelligence(
  slug: string,
  snapshot: GrowthEngineCompetitorSnapshot | null = loadCompetitorSnapshot(slug),
): GrowthPlanIntelligence {
  const profile = loadProfile(slug);
  const website = loadWebsiteIntelligenceSnapshot(slug);
  const enabled = resolveEnabledServices(profile);
  const eligible = eligibleCampaignServices(enabled);
  const report = buildGrowthOpportunityReport(slug, snapshot);
  const contentOpportunities = report.opportunities.filter(
    (o) => o.category === "content-coverage" || o.serviceId,
  );

  const scored = eligible
    .map((serviceId) => scoreCampaign(slug, serviceId, serviceLabel(serviceId), website, snapshot, contentOpportunities))
    .filter((c) => hasActionableEvidence(c.evidence))
    .sort((a, b) => b.score - a.score);

  const primaryScored = scored[0] || null;
  const primaryCampaign = primaryScored ? toRecommendation(primaryScored, profile) : null;
  const alternatives = primaryScored ? buildAlternatives(scored, primaryScored) : [];
  const readiness = buildReadiness(slug, profile, website, snapshot, primaryCampaign?.serviceId || null);
  const readyToGenerate = readiness.every((r) => r.complete) && Boolean(primaryCampaign);

  const executiveSummary = buildExecutiveSummary(profile, website, snapshot, primaryCampaign);

  if (primaryCampaign) {
    const scEvidence = collectSearchConsoleEvidence(slug);
    if (scEvidence.length) {
      primaryCampaign.evidence.push(...scEvidence);
      primaryCampaign.evidenceSources = [...new Set(primaryCampaign.evidence.map((e) => e.source))];
    }
  }

  return {
    version: GROWTH_PLAN_INTELLIGENCE_VERSION,
    slug,
    generatedAt: new Date().toISOString(),
    executiveSummary,
    primaryCampaign,
    alternatives,
    readiness,
    readyToGenerate,
  };
}

export function buildCampaignRecommendation(
  slug: string,
  snapshot?: GrowthEngineCompetitorSnapshot | null,
): GrowthEngineCampaignRecommendation | null {
  return buildGrowthPlanIntelligence(slug, snapshot).primaryCampaign;
}

/** Evidence-backed plan for a customer-selected enabled service. Does not auto-rank other services. */
export function buildGrowthPlanForSelectedService(
  slug: string,
  serviceId: string,
  snapshot: GrowthEngineCompetitorSnapshot | null = loadCompetitorSnapshot(slug),
): {
  campaign: GrowthEngineCampaignRecommendation;
  executiveSummary: GrowthPlanExecutiveSummary;
  readiness: CampaignReadinessItem[];
  readyToGenerate: boolean;
} | null {
  const profile = loadProfile(slug);
  const enabled = (profile.selectedServices || []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!serviceId || !enabled.includes(serviceId)) return null;

  const website = resolveWebsiteIntelligenceSnapshot(slug) || loadWebsiteIntelligenceSnapshot(slug);
  const report = buildGrowthOpportunityReport(slug, snapshot);
  const contentOpportunities = report.opportunities.filter((o) => o.category === "content-coverage" || o.serviceId);
  const name = serviceLabel(serviceId);
  const scored = scoreCampaign(slug, serviceId, name, website, snapshot, contentOpportunities);
  const campaign = toRecommendation(scored, profile);
  campaign.reason = `You selected ${name} as your campaign priority.`;
  const scEvidence = collectSearchConsoleEvidence(slug);
  if (scEvidence.length) {
    campaign.evidence.push(...scEvidence);
    campaign.evidenceSources = [...new Set(campaign.evidence.map((e) => e.source))];
  }
  const executiveSummary = buildExecutiveSummary(profile, website, snapshot, campaign);
  executiveSummary.primaryOpportunity = `${name} campaign`;
  executiveSummary.whyRecommended = `You selected ${name} as your campaign priority.`;
  const readiness = buildReadiness(slug, profile, website, snapshot, serviceId);
  const readyToGenerate = readiness.every((r) => r.complete);

  return { campaign, executiveSummary, readiness, readyToGenerate };
}

/** Maps Growth Plan Intelligence to the legacy plan shape used by Generate step and framework. */
export function toGrowthEnginePlanRecommendation(
  intel: GrowthPlanIntelligence,
  profile: ReturnType<typeof normalizeProfileData>,
): {
  suggestedCampaign: string;
  suggestedEcosystem: string;
  estimatedPages: number;
  estimatedPublishingDays: string;
  expectedIndexingTimeline: string;
  expectedReviewPeriod: string;
  primaryServiceId: string;
  primaryServiceName: string;
  areaCount: number;
} {
  const campaign = intel.primaryCampaign;
  const outputs = campaign?.estimatedOutputs || estimateCampaignOutputs(profile);
  const areaCount = outputs.clusterPages;
  const estimatedPages =
    outputs.servicePage +
    outputs.clusterPages +
    outputs.patientGuides +
    outputs.blogs +
    outputs.faqs;

  const fallbackId = resolveEnabledServices(profile)[0] || "pharmacy-first";
  const primaryServiceId = campaign?.serviceId || fallbackId;

  return {
    suggestedCampaign: campaign?.campaignName || "Complete prerequisites first",
    suggestedEcosystem: campaign
      ? `${campaign.campaignName} service ecosystem with local area pages, patient guides, and supporting content`
      : "Evidence-backed campaign pending",
    estimatedPages,
    estimatedPublishingDays: "2–4 weeks",
    expectedIndexingTimeline: "2–6 weeks after publishing",
    expectedReviewPeriod: "3–5 business days for content review",
    primaryServiceId,
    primaryServiceName: serviceLabel(primaryServiceId),
    areaCount: areaCount || 5,
  };
}
