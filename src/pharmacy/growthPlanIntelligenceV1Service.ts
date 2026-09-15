import fs from "node:fs";
import type { GrowthPlanIntelligenceInput, GrowthPlanKeywordInput } from "./growthPlanIntelligenceContract.ts";
import {
  GROWTH_PLAN_STRATEGY_VERSION,
  compareGapEvidenceQuality,
  type GrowthPlanAction,
  type GrowthPlanActionPriority,
  type GrowthPlanActionType,
  type GrowthPlanIntelligenceSnapshot,
} from "./growthPlanIntelligenceV1Model.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import { inheritPersistedDataForSeoCost } from "./nationalIntelligenceCostLedger.ts";
import {
  resolveNationalIntelligenceArtifactPath,
  nationalIntelligenceDataPath,
  nationalIntelligenceFixturePath,
  ensureNationalIntelligenceDataDir,
  ensureNationalIntelligenceFixtureDir,
} from "./nationalIntelligenceStorageService.ts";

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "action";
}

function serviceFamily(keyword: string): string {
  const k = keyword.toLowerCase();
  if (/seo|search engine/.test(k)) return "SEO";
  if (/web|website|websites/.test(k)) return "WEB_DESIGN";
  if (/advertising|ads|ppc/.test(k)) return "ADVERTISING";
  if (/branding|brand/.test(k)) return "BRANDING";
  if (/digital marketing|marketing/.test(k)) return "DIGITAL_MARKETING";
  if (/leaflet|letter|promotional/.test(k)) return "OFFLINE_PROMOTION";
  return "COMMERCIAL";
}

function actionTypeFor(items: GrowthPlanKeywordInput[]): GrowthPlanActionType {
  const first = items[0];
  if (!first) return "NO_ACTION";
  if (first.growthPlanRole === "MARKET_EXPANSION_ONLY") return "MARKET_EXPANSION_REVIEW";
  if (first.growthPlanRole === "SUPPORTING_COMMERCIAL") return items.length > 1 ? "CONTENT_CLUSTER" : "SUPPORTING_GUIDE";
  if (first.growthPlanRole === "AUTHORITY_SUPPORT") return items.length > 1 ? "CONTENT_CLUSTER" : "BLOG_ARTICLE";
  if (first.gapEvidenceStatus === "PROVEN_DEFEND_IMPROVE" && first.subjectRankingUrl) return "EXISTING_PAGE_IMPROVEMENT";
  if (items.length >= 2) return "SERVICE_HUB";
  if (first.gapEvidenceStatus === "PROVEN_UNTAPPED") return "SERVICE_PAGE";
  return "COMMERCIAL_LANDING_PAGE";
}

function scoreAction(items: GrowthPlanKeywordInput[], actionType: GrowthPlanActionType): number {
  const demand = items.reduce((sum, item) => sum + (item.searchVolume || 0), 0);
  const best = Math.max(...items.map((item) => item.opportunityScore || 0), 0);
  const competitor = Math.max(...items.map((item) => item.competitorCount || 0), 0);
  let score = Math.round(best * 0.45 + Math.min(25, demand / 10) + Math.min(20, competitor * 4));
  if (items.some((item) => item.gapEvidenceStatus === "PROVEN_UNTAPPED")) score += 12;
  if (items.some((item) => item.gapEvidenceStatus === "INSUFFICIENT_EVIDENCE")) score -= 10;
  if (actionType === "MARKET_EXPANSION_REVIEW") score = Math.min(score, 55);
  return Math.max(0, Math.min(100, score));
}

function priority(score: number, items: GrowthPlanKeywordInput[]): GrowthPlanActionPriority {
  const proven = items.some((item) => item.gapEvidenceStatus === "PROVEN_UNTAPPED" || item.gapEvidenceStatus === "PROVEN_WEAK_COVERAGE");
  if (score >= 80 && proven) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

function confidence(items: GrowthPlanKeywordInput[]): GrowthPlanAction["confidence"] {
  if (items.some((item) => item.gapConfidence === "HIGH")) return "HIGH";
  if (items.some((item) => item.gapConfidence === "MEDIUM" || item.gapEvidenceStatus === "NEW_MARKET_EVIDENCE")) return "MEDIUM";
  return "LOW";
}

function compareClusterMembers(a: GrowthPlanKeywordInput, b: GrowthPlanKeywordInput): number {
  const evidence = compareGapEvidenceQuality(a, b);
  if (evidence) return evidence;
  const volumeDelta = (b.searchVolume || 0) - (a.searchVolume || 0);
  if (volumeDelta) return volumeDelta;
  if (b.opportunityScore !== a.opportunityScore) return b.opportunityScore - a.opportunityScore;
  return a.keyword.localeCompare(b.keyword);
}

function actionFromCluster(family: string, items: GrowthPlanKeywordInput[]): GrowthPlanAction {
  const volumeLeader = [...items].sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0) || b.opportunityScore - a.opportunityScore || a.keyword.localeCompare(b.keyword))[0];
  const sorted = [...items].sort(compareClusterMembers);
  const primary = sorted[0];
  const actionType = actionTypeFor(sorted);
  const actionScore = scoreAction(sorted, actionType);
  const combinedDemand = sorted.reduce((sum, item) => sum + (item.searchVolume || 0), 0);
  const best = [...sorted].sort((a, b) => (a.bestCompetitorPosition || 999) - (b.bestCompetitorPosition || 999))[0];
  const supporting = sorted.slice(1).map((item) => item.keyword);
  const pageType = actionType.replace(/_/g, " ");
  const representativeDiffers = Boolean(volumeLeader && volumeLeader.keyword !== primary.keyword);
  const evidenceReasons = [
    `${sorted.length} validated keyword(s) in ${family}.`,
    `Combined search demand ${combinedDemand}.`,
    ...(representativeDiffers
      ? ["Cluster representative is the strongest-evidence keyword in the family; higher-volume supporting terms keep their own evidence and are not copied onto the primary."]
      : []),
    primary.gapEvidenceStatus === "PROVEN_UNTAPPED"
      ? "At least one keyword has proven untapped gap evidence."
      : `Gap evidence status: ${primary.gapEvidenceStatus}.`,
    `${primary.competitorCount} competitor signal(s) on the primary keyword.`,
  ];
  return {
    id: `${slug(family)}-${slug(primary.keyword)}`,
    actionType,
    title: `${pageType}: ${primary.keyword}`,
    primaryKeyword: primary.keyword,
    supportingKeywords: supporting,
    marketScope: primary.marketScope,
    growthPlanRole: primary.growthPlanRole,
    gapEvidenceStatus: primary.gapEvidenceStatus,
    gapConfidence: primary.gapConfidence,
    priority: priority(actionScore, sorted),
    actionScore,
    searchVolume: primary.searchVolume,
    combinedSearchDemand: combinedDemand,
    cpc: primary.cpc,
    competitorCount: primary.competitorCount,
    bestCompetitorDomain: best.bestCompetitorDomain,
    bestCompetitorPosition: best.bestCompetitorPosition,
    bestRankingUrl: best.bestRankingUrl,
    subjectPosition: primary.subjectPosition,
    subjectRankingUrl: primary.subjectRankingUrl,
    rationale: evidenceReasons.join(" "),
    evidenceReasons,
    recommendedPageType: pageType,
    recommendedIntent: primary.growthPlanRole === "PRIMARY_COMMERCIAL" ? "Commercial acquisition" : primary.growthPlanRole,
    recommendedNextStep: primary.gapEvidenceStatus === "INSUFFICIENT_EVIDENCE"
      ? "Review evidence before describing this as an untapped ranking gap."
      : "Use this action as a structured Growth Plan candidate; do not generate content until approved.",
    dependencies: primary.gapEvidenceStatus === "INSUFFICIENT_EVIDENCE" ? ["Evidence review"] : [],
    confidence: confidence(sorted),
  };
}

function cluster(items: GrowthPlanKeywordInput[]): GrowthPlanAction[] {
  const groups = new Map<string, GrowthPlanKeywordInput[]>();
  for (const item of items) {
    const key = serviceFamily(item.keyword);
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return [...groups.entries()].map(([family, rows]) => actionFromCluster(family, rows));
}

export function buildGrowthPlanIntelligenceV1(input: GrowthPlanIntelligenceInput): GrowthPlanIntelligenceSnapshot {
  const primary = cluster(input.primaryCommercialOpportunities);
  const support = cluster(input.supportingCommercialOpportunities);
  const authority = cluster(input.authoritySupportOpportunities);
  const expansion = cluster(input.marketExpansionEvidence);
  const actions = [...primary, ...support, ...authority, ...expansion]
    .filter((action) => action.actionType !== "NO_ACTION")
    .sort((a, b) => b.actionScore - a.actionScore || b.combinedSearchDemand - a.combinedSearchDemand);
  const immediate = actions.filter((action) => action.priority === "HIGH" && action.growthPlanRole === "PRIMARY_COMMERCIAL");
  const next = actions.filter((action) => action.priority === "MEDIUM" || action.growthPlanRole === "SUPPORTING_COMMERCIAL");
  const later = actions.filter((action) => !immediate.includes(action) && !next.includes(action));
  return {
    version: GROWTH_PLAN_STRATEGY_VERSION,
    generatedAt: new Date().toISOString(),
    subjectDomain: input.metadata.subjectDomain,
    market: "UK Community Pharmacy Digital Growth",
    intelligenceSourceVersion: input.metadata.source,
    inheritedDataForSeoCost: inheritPersistedDataForSeoCost({
      totalCost: input.metadata.inheritedUpstreamCost,
    }).cost,
    summary: {
      totalActions: actions.length,
      highPriorityActions: actions.filter((action) => action.priority === "HIGH").length,
      mediumPriorityActions: actions.filter((action) => action.priority === "MEDIUM").length,
      lowPriorityActions: actions.filter((action) => action.priority === "LOW").length,
      primaryCommercialDemand: actions.filter((action) => action.growthPlanRole === "PRIMARY_COMMERCIAL").reduce((sum, action) => sum + action.combinedSearchDemand, 0),
      supportingDemand: actions.filter((action) => action.growthPlanRole === "SUPPORTING_COMMERCIAL" || action.growthPlanRole === "AUTHORITY_SUPPORT").reduce((sum, action) => sum + action.combinedSearchDemand, 0),
      provenUntappedCount: actions.filter((action) => action.gapEvidenceStatus === "PROVEN_UNTAPPED").length,
      insufficientEvidenceCount: actions.filter((action) => action.gapEvidenceStatus === "INSUFFICIENT_EVIDENCE").length,
    },
    actions,
    roadmap: { immediate, next, later },
  };
}

/**
 * Read persisted GP-01 snapshot for a NATIONAL tenant only.
 * LOCAL tenants must never receive another tenant's national fixture.
 */
export function readGrowthPlanIntelligenceV1(slug: string): GrowthPlanIntelligenceSnapshot | null {
  if (!slug || !isNationalGrowthPlatform(slug)) return null;
  const file = resolveNationalIntelligenceArtifactPath(slug, "growth-plan-intelligence-v1");
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as GrowthPlanIntelligenceSnapshot;
}

export function writeGrowthPlanIntelligenceV1(slug: string): GrowthPlanIntelligenceSnapshot {
  const inputFile =
    resolveNationalIntelligenceArtifactPath(slug, "growth-plan-intelligence-input-v1")
    || nationalIntelligenceDataPath(slug, "growth-plan-intelligence-input-v1");
  if (!fs.existsSync(inputFile)) throw new Error(`Growth Plan Intelligence input not found: ${inputFile}`);
  const input = JSON.parse(fs.readFileSync(inputFile, "utf8")) as GrowthPlanIntelligenceInput;
  const snapshot = buildGrowthPlanIntelligenceV1(input);
  ensureNationalIntelligenceDataDir();
  ensureNationalIntelligenceFixtureDir();
  fs.writeFileSync(nationalIntelligenceDataPath(slug, "growth-plan-intelligence-v1"), JSON.stringify(snapshot, null, 2) + "\n");
  fs.writeFileSync(nationalIntelligenceFixturePath(slug, "growth-plan-intelligence-v1"), JSON.stringify(snapshot, null, 2) + "\n");
  return snapshot;
}
