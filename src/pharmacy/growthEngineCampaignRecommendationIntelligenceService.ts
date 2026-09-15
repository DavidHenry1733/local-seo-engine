/**
 * Campaign Recommendation Intelligence V1 — evidence-backed consultation builder.
 * Presentation layer only — reads existing import/analysis data, never invents facts.
 */
import {
  CAMPAIGN_EVIDENCE_CARD_LABELS,
  CAMPAIGN_EXPECTED_OUTCOME_OPTIONS,
  CAMPAIGN_INTELLIGENCE_FORBIDDEN_TERMS,
  CAMPAIGN_RECOMMENDATION_INTELLIGENCE_VERSION,
  type CampaignConfidenceLevel,
  type CampaignEvidenceCard,
  type CampaignEvidenceCardId,
  type CampaignPositionLevel,
  type CampaignPositionScore,
  type CampaignRecommendationConfidence,
  type CampaignRecommendationIntelligence,
} from "./growthEngineCampaignRecommendationIntelligenceModel.ts";
import {
  collectExistingWebsiteServices,
  collectMissingServiceOpportunities,
  findFallbackCampaignRecommendation,
} from "./growthEngineCampaignBuilderFallbackService.ts";
import {
  buildGrowthPlanIntelligence,
  estimateCampaignOutputs,
} from "./growthEngineCampaignRecommendationEngine.ts";
import type { GrowthEngineCampaignRecommendation } from "./growthEngineCampaignModel.ts";
import { authoritativeCampaignPackageTotal } from "./growthEngineCampaignModel.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { loadWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { inferCompetitorHasService, loadCompetitorIntelligence } from "./pharmacyCompetitorIntelligence.ts";
import { cbUxBuildTimeDisplay } from "./growthEngineCampaignBuilderUxV2.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import fs from "node:fs";
import path from "node:path";

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
}

function loadProfile(slug: string) {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function serviceName(serviceId: string): string {
  return getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function findCampaign(slug: string, serviceId: string): GrowthEngineCampaignRecommendation | null {
  const plan = buildGrowthPlanIntelligence(slug);
  if (plan.primaryCampaign?.serviceId === serviceId) return plan.primaryCampaign;
  const alt = plan.alternatives.find((a) => a.serviceId === serviceId);
  if (alt) {
    const profile = loadProfile(slug);
    const fallback = findFallbackCampaignRecommendation(slug, serviceId);
    return {
      serviceId: alt.serviceId,
      campaignName: alt.campaignName,
      priority: alt.priority,
      confidence: alt.confidence,
      reason: alt.reason,
      evidence: [],
      evidenceSources: [],
      estimatedOutputs: fallback?.estimatedOutputs || estimateCampaignOutputs(profile),
      expectedBenefits: [],
      score: alt.evidenceCount * 40,
    };
  }
  return findFallbackCampaignRecommendation(slug, serviceId);
}

function addEvidenceCard(
  cards: CampaignEvidenceCard[],
  seen: Set<CampaignEvidenceCardId>,
  id: CampaignEvidenceCardId,
  detail: string,
  source: CampaignEvidenceCard["source"],
): void {
  if (seen.has(id)) return;
  seen.add(id);
  cards.push({
    id,
    label: CAMPAIGN_EVIDENCE_CARD_LABELS[id],
    detail,
    source,
  });
}

function supportingCounts(serviceId: string, slug: string) {
  const website = loadWebsiteIntelligenceSnapshot(slug);
  const coverage = website?.analysis?.coverage?.find((r) => r.serviceId === serviceId);
  const sc = coverage?.supportingContent || { faqs: 0, blogs: 0, guides: 0, localPages: 0 };
  return {
    coverage,
    faqs: sc.faqs,
    blogs: sc.blogs,
    guides: sc.guides,
    localPages: sc.localPages,
    websiteDetected: coverage?.websiteDetected === true,
    profileEnabled: coverage?.profileEnabled === true,
  };
}

function addImportSnapshotEvidence(
  profile: ReturnType<typeof loadProfile>,
  serviceId: string,
  name: string,
  cards: CampaignEvidenceCard[],
  seen: Set<CampaignEvidenceCardId>,
): void {
  const rows = profile.websiteImportSnapshot?.intelligence?.services;
  if (!Array.isArray(rows)) return;
  const row = rows.find((s) => s?.serviceId === serviceId && s.exists === true);
  if (!row) return;

  if (!seen.has("website-detected")) {
    addEvidenceCard(
      cards,
      seen,
      "website-detected",
      row.url
        ? `We found ${name} on your website at ${row.url}.`
        : `We found ${name} during your website import.`,
      "Website Analysis",
    );
  }

  const content = row.content;
  if (content?.hasFaqSection === false) {
    addEvidenceCard(
      cards,
      seen,
      "missing-faqs",
      `No FAQ section was detected on your ${name} page.`,
      "Website Analysis",
    );
    addEvidenceCard(
      cards,
      seen,
      "missing-patient-guide",
      `No dedicated patient guide was detected for ${name} on your website.`,
      "Website Analysis",
    );
    addEvidenceCard(
      cards,
      seen,
      "website-limited-support",
      `Your ${name} page exists but supporting patient information is limited.`,
      "Website Analysis",
    );
  } else if (content && content.approximateWordCount > 0 && content.approximateWordCount < 600) {
    addEvidenceCard(
      cards,
      seen,
      "limited-supporting-content",
      `Your ${name} page has limited supporting content based on your website import.`,
      "Website Analysis",
    );
  }
}

function buildEvidenceCards(slug: string, serviceId: string, name: string): CampaignEvidenceCard[] {
  const profile = loadProfile(slug);
  const cards: CampaignEvidenceCard[] = [];
  const seen = new Set<CampaignEvidenceCardId>();
  const support = supportingCounts(serviceId, slug);
  const existingOnWebsite = collectExistingWebsiteServices(slug).some((s) => s.serviceId === serviceId);
  const missing = collectMissingServiceOpportunities(slug).find((m) => m.serviceId === serviceId);
  const inSelectedServices = (profile.selectedServices || []).includes(serviceId);
  const inPriorityServices = (profile.priorityServices || []).some(
    (n) => n.toLowerCase().includes(name.toLowerCase()) || n.toLowerCase().includes(serviceId.replace(/-/g, " ")),
  );

  if (existingOnWebsite || support.websiteDetected) {
    addEvidenceCard(
      cards,
      seen,
      "website-detected",
      `We found ${name} during your website analysis.`,
      "Website Analysis",
    );
  }

  addImportSnapshotEvidence(profile, serviceId, name, cards, seen);

  if (inSelectedServices) {
    addEvidenceCard(
      cards,
      seen,
      "profile-service-match",
      `${name} is listed in your pharmacy profile services.`,
      "Google Business Profile",
    );
  }

  if (missing?.source === "profile" || missing?.source === "google" || (inPriorityServices && !existingOnWebsite)) {
    addEvidenceCard(
      cards,
      seen,
      "gbp-not-promoted",
      missing?.evidence ||
        `${name} appears on your Google Business Profile but was not found on your website during analysis.`,
      "Google Business Profile",
    );
  }

  const competitorIntel = loadCompetitorIntelligence(slug);
  if (competitorIntel?.competitors?.length) {
    const withService = competitorIntel.competitors.filter((c) => inferCompetitorHasService(c, serviceId));
    const threshold = Math.max(2, Math.ceil(competitorIntel.competitors.length * 0.3));
    if (withService.length >= threshold) {
      addEvidenceCard(
        cards,
        seen,
        "competitors-promoting",
        `${withService.length} local competitors promote ${name} in your area.`,
        "Local Market Analysis",
      );
    }
  }

  const website = loadWebsiteIntelligenceSnapshot(slug);
  const gaps = website?.analysis?.missingContent?.filter((m) => m.serviceId === serviceId) || [];

  for (const gap of gaps) {
    const gapLower = gap.gap.toLowerCase();
    if (/guide|patient information/i.test(gapLower)) {
      addEvidenceCard(cards, seen, "missing-patient-guide", gap.evidence, "Website Analysis");
    } else if (/faq/i.test(gapLower)) {
      addEvidenceCard(cards, seen, "missing-faqs", gap.evidence, "Website Analysis");
    } else if (/local|landing|area/i.test(gapLower)) {
      addEvidenceCard(cards, seen, "missing-local-pages", gap.evidence, "Website Analysis");
    }
  }

  if (support.websiteDetected) {
    if (support.guides === 0 && !seen.has("missing-patient-guide")) {
      addEvidenceCard(
        cards,
        seen,
        "missing-patient-guide",
        `No patient guide was detected for ${name} on your website.`,
        "Website Analysis",
      );
    }
    if (support.faqs === 0 && !seen.has("missing-faqs")) {
      addEvidenceCard(
        cards,
        seen,
        "missing-faqs",
        `No FAQ content was detected for ${name} on your website.`,
        "Website Analysis",
      );
    }
    if (support.localPages === 0 && !seen.has("missing-local-pages")) {
      addEvidenceCard(
        cards,
        seen,
        "missing-local-pages",
        `No local landing pages were detected for ${name}.`,
        "Website Analysis",
      );
    }

    const thin = support.faqs + support.blogs + support.guides + support.localPages <= 1;
    if (thin && !seen.has("website-limited-support")) {
      addEvidenceCard(
        cards,
        seen,
        "website-limited-support",
        `${name} is on your website but supporting pages are limited.`,
        "Website Analysis",
      );
    } else if (support.faqs + support.blogs + support.guides + support.localPages <= 3 && !seen.has("limited-supporting-content")) {
      addEvidenceCard(
        cards,
        seen,
        "limited-supporting-content",
        `Supporting content for ${name} is present but could be expanded.`,
        "Website Analysis",
      );
    }
  }

  const campaign = findCampaign(slug, serviceId);
  if (cards.length < 3 && campaign?.evidence?.length) {
    for (const item of campaign.evidence) {
      if (cards.length >= 6) break;
      const source =
        item.source === "Business Profile"
          ? "Google Business Profile"
          : item.source === "Website Intelligence"
            ? "Website Analysis"
            : item.source === "Local Healthcare Intelligence"
              ? "Local Market Analysis"
              : null;
      if (!source) continue;
      const headline = item.headline.toLowerCase();
      if (/competitor|local pharmacies mapped/i.test(headline) && !seen.has("competitors-promoting")) {
        addEvidenceCard(cards, seen, "competitors-promoting", item.detail, "Local Market Analysis");
      } else if (/no .*page detected|not found on your website/i.test(headline) && !seen.has("gbp-not-promoted")) {
        addEvidenceCard(cards, seen, "gbp-not-promoted", item.detail, "Google Business Profile");
      } else if (/thin|supporting content|website gap/i.test(headline) && !seen.has("limited-supporting-content")) {
        addEvidenceCard(cards, seen, "limited-supporting-content", item.detail, "Website Analysis");
      } else if (/detected on your website/i.test(headline) && !seen.has("website-detected")) {
        addEvidenceCard(cards, seen, "website-detected", item.detail, "Website Analysis");
      }
    }
  }

  return cards.slice(0, 6);
}

function scoreLevel(excellent: boolean, good: boolean): CampaignPositionLevel {
  if (excellent) return "Excellent";
  if (good) return "Good";
  return "Needs Improvement";
}

function buildCurrentPosition(slug: string, serviceId: string, name: string): CampaignPositionScore[] {
  const profile = loadProfile(slug);
  const support = supportingCounts(serviceId, slug);
  const existingOnWebsite = collectExistingWebsiteServices(slug).some((s) => s.serviceId === serviceId);
  const inSelected = (profile.selectedServices || []).includes(serviceId);
  const hasGoogleImport = Boolean(profile.googleImportSnapshot?.placeId || profile.customerSetupGoogleListing);
  const hasPriority = (profile.priorityServices || []).some((n) =>
    n.toLowerCase().includes(name.toLowerCase()),
  );

  const gbpLevel = scoreLevel(
    inSelected && (hasGoogleImport || hasPriority),
    inSelected || hasPriority,
  );

  const websiteLevel = scoreLevel(
    support.websiteDetected && Boolean(support.coverage?.mainPageUrl),
    existingOnWebsite || support.websiteDetected,
  );

  const supportTotal = support.faqs + support.blogs + support.guides + support.localPages;
  const supportTypes = [support.faqs, support.blogs, support.guides, support.localPages].filter((n) => n > 0).length;
  const supportingLevel = scoreLevel(supportTypes >= 3, supportTotal >= 2);

  const patientLevel = scoreLevel(support.guides > 0 && support.faqs > 0, support.guides > 0 || support.faqs > 0);

  const levels = [gbpLevel, websiteLevel, supportingLevel, patientLevel];
  const needsCount = levels.filter((l) => l === "Needs Improvement").length;
  const overallLevel: CampaignPositionLevel =
    needsCount >= 3 ? "Needs Improvement" : needsCount >= 1 ? "Good" : "Excellent";

  return [
    { id: "gbp", label: "Google Business Profile", level: gbpLevel },
    { id: "website", label: "Website", level: websiteLevel },
    { id: "supporting", label: "Supporting Content", level: supportingLevel },
    { id: "patient", label: "Patient Information", level: patientLevel },
    { id: "overall", label: "Overall Campaign Readiness", level: overallLevel },
  ];
}

function buildExpectedOutcomes(slug: string, serviceId: string, cards: CampaignEvidenceCard[]): string[] {
  const outcomes = new Set<string>();
  const cardIds = new Set(cards.map((c) => c.id));

  if (cardIds.has("website-detected") || cardIds.has("website-limited-support")) {
    outcomes.add("Help more patients discover this service");
  }
  if (
    cardIds.has("limited-supporting-content") ||
    cardIds.has("missing-patient-guide") ||
    cardIds.has("missing-faqs") ||
    cardIds.has("missing-local-pages")
  ) {
    outcomes.add("Improve supporting content");
    outcomes.add("Strengthen your online presence");
  }
  if (cardIds.has("missing-patient-guide") || cardIds.has("missing-faqs")) {
    outcomes.add("Build trust with patients");
  }
  if (cardIds.has("gbp-not-promoted") || cardIds.has("missing-local-pages")) {
    outcomes.add("Support local Google visibility");
  }
  if (cardIds.has("gbp-not-promoted") || cardIds.has("profile-service-match")) {
    outcomes.add("Improve consistency across your website");
  }
  if (cardIds.has("competitors-promoting")) {
    outcomes.add("Strengthen your online presence");
  }

  if (!outcomes.size) {
    outcomes.add(CAMPAIGN_EXPECTED_OUTCOME_OPTIONS[0]);
    outcomes.add(CAMPAIGN_EXPECTED_OUTCOME_OPTIONS[1]);
  }

  return [...outcomes].slice(0, 4);
}

function buildConfidence(slug: string): CampaignRecommendationConfidence {
  const profile = loadProfile(slug);
  const website = loadWebsiteIntelligenceSnapshot(slug);
  const snapshot = loadCompetitorSnapshot(slug);
  const sources: CampaignRecommendationConfidence["sources"] = [];

  if ((profile.selectedServices || []).length || profile.googleImportSnapshot?.placeId) {
    sources.push("Google Business Profile");
  }
  if (website?.analysis?.understandingComplete) {
    sources.push("Website Analysis");
  }
  if (snapshot?.analysis?.dataSource === "google-places-live") {
    sources.push("Local Market Analysis");
  }

  let level: CampaignConfidenceLevel = "Low";
  let stars = 2;
  if (sources.length >= 3) {
    level = "High";
    stars = 5;
  } else if (sources.length === 2) {
    level = "Medium";
    stars = 4;
  }

  return { level, stars, sources };
}

function buildWhyNow(cards: CampaignEvidenceCard[], name: string): string {
  if (cards.some((c) => c.id === "competitors-promoting")) {
    return `Local competitors are already promoting ${name}, so improving your content now helps patients find your pharmacy first.`;
  }
  if (cards.some((c) => c.id === "gbp-not-promoted")) {
    return `Your profile and website are not fully aligned for ${name} — acting now improves consistency before patients search for this service.`;
  }
  if (cards.some((c) => c.id === "website-detected")) {
    return `${name} is already part of your offering — this is the right time to help more local patients discover it online.`;
  }
  return `Your pharmacy data shows a clear opportunity to improve how ${name} is presented to patients.`;
}

function buildReasonSelected(cards: CampaignEvidenceCard[], campaign: GrowthEngineCampaignRecommendation | null): string {
  if (cards.length) return cards[0].detail;
  return campaign?.reason || "This campaign addresses the most important gap we found in your pharmacy data.";
}

function countAssets(outputs: ReturnType<typeof estimateCampaignOutputs>): number {
  return authoritativeCampaignPackageTotal(outputs);
}

export function buildCampaignRecommendationIntelligence(
  slug: string,
  serviceId: string,
): CampaignRecommendationIntelligence | null {
  if (!serviceId) return null;
  const campaign = findCampaign(slug, serviceId);
  const name = campaign?.campaignName || serviceName(serviceId);
  const evidenceCards = buildEvidenceCards(slug, serviceId, name);
  if (evidenceCards.length < 1) return null;

  const profile = loadProfile(slug);
  const outputs = campaign?.estimatedOutputs || estimateCampaignOutputs(profile);
  const assetCount = countAssets(outputs);

  const expectedOutcomes = buildExpectedOutcomes(slug, serviceId, evidenceCards);
  const confidence = buildConfidence(slug);

  return {
    version: CAMPAIGN_RECOMMENDATION_INTELLIGENCE_VERSION,
    slug,
    serviceId,
    serviceName: name,
    whyRecommendTitle: "Why we recommend starting here",
    whyNow: buildWhyNow(evidenceCards, name),
    evidenceCards,
    currentPosition: buildCurrentPosition(slug, serviceId, name),
    expectedOutcomes,
    summary: {
      campaignName: name,
      reasonSelected: buildReasonSelected(evidenceCards, campaign),
      assetsToCreate: assetCount,
      estimatedBuildTime: cbUxBuildTimeDisplay(assetCount),
      tagline: "This campaign gives you a complete marketing package for this pharmacy service.",
    },
    confidence,
    whatsNext:
      "After building your campaign you'll be able to review every page, guide and post before publishing anything live.",
  };
}

export function campaignIntelligenceCopyIsSafe(text: string): boolean {
  const lower = ` ${text.toLowerCase()} `;
  return !CAMPAIGN_INTELLIGENCE_FORBIDDEN_TERMS.some((term) => lower.includes(term));
}

export function campaignIntelligenceHasMinimumEvidence(intel: CampaignRecommendationIntelligence): boolean {
  return intel.evidenceCards.length >= 1 && intel.evidenceCards.length <= 6;
}

/** Expected outcome text for approval summary — comma-separated, customer-safe. */
export function campaignIntelligenceExpectedOutcomeText(intel: CampaignRecommendationIntelligence): string {
  return intel.expectedOutcomes.join(". ") + ".";
}

// Re-export findCampaign for tests — avoid circular import in service consumers
export { findCampaign as resolveCampaignRecommendationForIntelligence };
