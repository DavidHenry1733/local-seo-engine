/**
 * Growth Engine — Cycle Learning Engine V1.
 * Future recommendations consider previous Growth Cycles and growth memory.
 * Reads Growth Plan Intelligence — does not modify it.
 */
import { buildGrowthPlanIntelligence } from "./growthEngineCampaignRecommendationEngine.ts";
import type { GrowthEngineCampaignRecommendation } from "./growthEngineCampaignModel.ts";
import type { GrowthCycleNextRecommendation } from "./growthEngineCycleModel.ts";
import {
  getCompletedServiceIds,
  getPostponedServiceIds,
  getRejectedServiceIds,
  loadGrowthMemory,
} from "./growthEngineCycleMemoryService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { readPharmacyIndexingSummary } from "./pharmacyIndexingBridgeService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";

function serviceLabel(serviceId: string): string {
  return getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface CycleLearningContext {
  completedServiceIds: string[];
  rejectedServiceIds: string[];
  postponedServiceIds: string[];
  completedCycleCount: number;
  indexedPages: number;
  memoryEventCount: number;
}

export function buildCycleLearningContext(slug: string): CycleLearningContext {
  const memory = loadGrowthMemory(slug);
  const indexing = readPharmacyIndexingSummary(slug);

  return {
    completedServiceIds: getCompletedServiceIds(slug),
    rejectedServiceIds: getRejectedServiceIds(slug),
    postponedServiceIds: getPostponedServiceIds(slug),
    completedCycleCount: getCompletedServiceIds(slug).length,
    indexedPages: indexing?.indexed || 0,
    memoryEventCount: memory.events.length,
  };
}

function buildLearningEvidence(context: CycleLearningContext, serviceId: string): string[] {
  const evidence: string[] = [];
  if (context.completedCycleCount > 0) {
    evidence.push(
      `${context.completedCycleCount} previous Growth Cycle${context.completedCycleCount === 1 ? "" : "s"} completed — platform memory informs this recommendation.`,
    );
  }
  if (context.completedServiceIds.length) {
    evidence.push(`Completed services: ${context.completedServiceIds.map(serviceLabel).join(", ")} — not recommended again unless expanding coverage.`);
  }
  if (context.indexedPages > 0) {
    evidence.push(`${context.indexedPages} pages currently indexed — building on existing search visibility.`);
  }
  if (context.memoryEventCount > 5) {
    evidence.push(`Growth memory contains ${context.memoryEventCount} recorded events from your pharmacy programme.`);
  }
  if (context.postponedServiceIds.includes(serviceId)) {
    evidence.push(`${serviceLabel(serviceId)} was previously postponed — still eligible when higher-priority gaps are addressed.`);
  }
  return evidence;
}

function toNextRecommendation(
  rec: GrowthEngineCampaignRecommendation,
  context: CycleLearningContext,
  expansion = false,
): GrowthCycleNextRecommendation {
  const learningNotes = buildLearningEvidence(context, rec.serviceId);
  const evidenceSummary = [...rec.evidence.map((e) => e.headline), ...learningNotes].slice(0, 4).join(" · ");

  return {
    serviceId: rec.serviceId,
    serviceName: rec.campaignName,
    reason: expansion
      ? `${rec.reason} (Expansion recommended — core cycle completed; consider deepening local coverage.)`
      : rec.reason,
    evidenceSummary,
    considersPreviousCycles: context.completedCycleCount > 0 || context.memoryEventCount > 0,
  };
}

export function buildCycleAwareRecommendation(slug: string): GrowthCycleNextRecommendation | null {
  const intel = buildGrowthPlanIntelligence(slug);
  const context = buildCycleLearningContext(slug);
  const excluded = new Set([
    ...context.completedServiceIds.filter((id) => !isExpansionCandidate(slug, id)),
    ...context.rejectedServiceIds,
  ]);

  let candidate = intel.primaryCampaign;
  if (candidate && excluded.has(candidate.serviceId)) {
    const alt = intel.alternatives.find((a) => !excluded.has(a.serviceId));
    if (alt && intel.primaryCampaign) {
      candidate = {
        ...intel.primaryCampaign,
        serviceId: alt.serviceId,
        campaignName: alt.campaignName,
        priority: alt.priority,
        confidence: alt.confidence,
        reason: alt.reason,
      };
    } else {
      candidate = null;
    }
  }

  if (!candidate) {
    const expansionId = context.completedServiceIds.find((id) => isExpansionCandidate(slug, id));
    if (expansionId && intel.primaryCampaign?.serviceId === expansionId) {
      return toNextRecommendation(intel.primaryCampaign, context, true);
    }
    return null;
  }

  return toNextRecommendation(candidate, context);
}

function isExpansionCandidate(slug: string, serviceId: string): boolean {
  const visibility = readPharmacyVisibilityReport(slug);
  if (!visibility) return false;
  const row = visibility.services?.find((s) => s.serviceId === serviceId);
  return Boolean(row && row.indexedStatus === "indexed" && row.visibilityStatus !== "visible");
}

export function buildConsultantMessage(slug: string, next: GrowthCycleNextRecommendation | null): string {
  const context = buildCycleLearningContext(slug);

  if (!next) {
    if (context.completedCycleCount === 0) {
      return "Based on everything we know about your pharmacy, complete the Growth Engine workflow steps to unlock your first Growth Cycle recommendation.";
    }
    return "Based on your completed Growth Cycles and current evidence, no new service recommendation is available right now. Review outstanding opportunities in Growth Intelligence.";
  }

  const prefix =
    context.completedCycleCount > 0 || context.memoryEventCount > 0
      ? "Based on everything we know about your pharmacy — including your previous Growth Cycles — we recommend"
      : "Based on everything we know about your pharmacy, we recommend";

  return `${prefix} ${next.serviceName}. ${next.reason}`;
}
