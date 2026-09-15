/**
 * Campaign Builder V1 — session state, campaign spec, review centre.
 */
import fs from "node:fs";
import path from "node:path";
import {
  CAMPAIGN_BUILDER_VERSION,
  DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION,
  type CampaignBuilderApprovalSummary,
  type CampaignBuilderAreaOption,
  type CampaignBuilderAssetSelection,
  type CampaignBuilderImageStrategy,
  type CampaignImageLocalMode,
  type CampaignBuilderListItem,
  type CampaignBuilderMode,
  type CampaignBuilderOverview,
  type CampaignBuilderOverviewAsset,
  type CampaignBuilderPriority,
  type CampaignBuilderReviewItem,
  type CampaignBuilderSession,
  type CampaignBuilderStep,
  type CampaignBuilderTargetAreaMode,
  type CampaignBuilderTotals,
} from "./growthEngineCampaignBuilderModel.ts";
import {
  buildFallbackCampaignBuilderList,
  findFallbackCampaignRecommendation,
} from "./growthEngineCampaignBuilderFallbackService.ts";
import { buildCampaignBuilderImagePlan, saveCampaignImagePlanSnapshot } from "./growthEngineCampaignBuilderImagePlanService.ts";
import {
  deriveCampaignImageStrategy,
  listCampaignPharmacyPhotographs,
  listEligibleCampaignStockPhotographs,
  recordCampaignAiImageRequests,
} from "./growthEngineCampaignBuilderImageStrategyService.ts";
import { CAMPAIGN_EXPLORER_ALL_SUPPORTED } from "./growthEngineCampaignExplorerModel.ts";
import {
  buildGrowthPlanForSelectedService,
  buildGrowthPlanIntelligence,
  estimateCampaignOutputs,
} from "./growthEngineCampaignRecommendationEngine.ts";
import { resolveAuthoritativeCampaignPriority, saveAuthoritativeCampaignPriority } from "./growthEngineGrowthPlanResolver.ts";
import {
  buildCampaignRecommendationIntelligence,
  campaignIntelligenceExpectedOutcomeText,
} from "./growthEngineCampaignRecommendationIntelligenceService.ts";
import type { CampaignAlternative, CampaignEstimatedOutputs, GrowthEngineCampaignRecommendation } from "./growthEngineCampaignModel.ts";
import { authoritativeCampaignPackageItems, authoritativeCampaignPackageTotal, BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS } from "./growthEngineCampaignModel.ts";
import {
  rankStoredCampaignTargetAreas,
  resolveRecommendedCampaignTargetAreaCount,
  explicitConfirmedLocalityNames,
} from "./growthEngineCampaignTargetAreaRankingService.ts";
import {
  contentPackageApproved,
  contentPackageGenerated,
  getContentPackageReviewSections,
} from "./pharmacyContentPackageService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import {
  discoverCampaignBuilderAreaCandidates,
  saveCampaignAreaDiscoverySnapshot,
} from "./growthEngineCampaignBuilderAreaDiscoveryService.ts";

function sessionPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-campaign-builder.json`);
}

function loadProfile(slug: string) {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

export function isCampaignBuilderAreaStrategyConfirmed(session: CampaignBuilderSession): boolean {
  return (session.targetAreaNames || []).some((name) => String(name).trim());
}

export function resolveStoredCampaignBuilderAreaScope(slug: string): {
  primaryTown: string;
  pool: CampaignBuilderAreaOption[];
  storedCampaignAreas: string[];
  recommendedAreas: string[];
  configuredLocalPages: number;
  hasAuthoritativeStoredSelection: boolean;
  outputs: ReturnType<typeof estimateCampaignOutputs>;
} {
  const profile = loadProfile(slug);
  const primaryTown = String(profile.primaryTown || profile.townCity || "").trim();
  const ranked = rankStoredCampaignTargetAreas(slug, profile.selectedAreas || [], profile.rankingAreas || []);
  const pool: CampaignBuilderAreaOption[] = ranked.map((row) => ({
    area: row.area,
    source: "Your Pharmacy",
    distanceLabel: row.distanceLabel,
    grade: row.grade,
    recommended: row.recommended,
    selected: false,
  }));
  const confirmedAreas = explicitConfirmedLocalityNames(profile.selectedAreas);
  const recommendedAreas = ranked.filter((row) => row.recommended).map((row) => row.area);
  const outputs = estimateCampaignOutputs(profile);
  const configuredLocalPages = confirmedAreas.length
    ? Math.min(confirmedAreas.length, BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.maxClusterPages)
    : resolveRecommendedCampaignTargetAreaCount(pool.length) || outputs.clusterPages;
  return {
    primaryTown,
    pool,
    storedCampaignAreas: confirmedAreas.length ? confirmedAreas : recommendedAreas,
    recommendedAreas,
    configuredLocalPages,
    hasAuthoritativeStoredSelection: confirmedAreas.length > 0,
    outputs,
  };
}

function applySessionLocalPageOverride(
  slug: string,
  serviceId: string,
  outputs: ReturnType<typeof estimateCampaignOutputs>,
): ReturnType<typeof estimateCampaignOutputs> {
  const session = loadCampaignBuilderSession(slug);
  if (session.selectedServiceId !== serviceId || !isCampaignBuilderAreaStrategyConfirmed(session)) {
    return outputs;
  }
  const scope = resolveStoredCampaignBuilderAreaScope(slug);
  const poolKeys = new Set(scope.pool.map((row) => row.area.toLowerCase()));
  const selectedInPool = session.targetAreaNames
    .map((name) => String(name).trim())
    .filter((name) => poolKeys.has(name.toLowerCase()));
  if (!selectedInPool.length) return outputs;
  return {
    ...outputs,
    clusterPages: selectedInPool.length,
  };
}

function emptySession(slug: string): CampaignBuilderSession {
  return {
    version: CAMPAIGN_BUILDER_VERSION,
    slug,
    updatedAt: new Date().toISOString(),
    step: "choose",
    selectedServiceId: null,
    mode: "all",
    assetSelection: { ...DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION },
    targetAreaMode: "wholeTown",
    targetAreaNames: [],
    discoveredAreaCandidates: [],
    areaDiscoveryStatus: "idle",
    areaDiscoveredAt: null,
    areaDiscoverySource: null,
    areaDiscoveryError: null,
    imageStrategy: "existing",
    localImageMode: "shared",
    imageDeferredSlots: {},
    selectedStockImageIds: null,
    requestAiImages: false,
    imagePlanConfirmedAt: null,
    contextFrozenAt: null,
    generationStartedAt: null,
    generationCompletedAt: null,
    approvedAssets: {},
  };
}

export function loadCampaignBuilderSession(slug: string): CampaignBuilderSession {
  const file = sessionPath(slug);
  if (!fs.existsSync(file)) return emptySession(slug);
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as CampaignBuilderSession;
    return {
      ...emptySession(slug),
      ...raw,
      assetSelection: { ...DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION, ...raw.assetSelection },
      targetAreaMode:
        raw.targetAreaMode === "selected"
          ? "selected"
          : raw.targetAreaMode === "recommended"
            ? "recommended"
            : "wholeTown",
      targetAreaNames: Array.isArray(raw.targetAreaNames) ? raw.targetAreaNames.map(String) : [],
      discoveredAreaCandidates: Array.isArray(raw.discoveredAreaCandidates) ? raw.discoveredAreaCandidates : [],
      areaDiscoveryStatus:
        raw.areaDiscoveryStatus === "ready" || raw.areaDiscoveryStatus === "failed"
          ? raw.areaDiscoveryStatus
          : "idle",
      areaDiscoveredAt: raw.areaDiscoveredAt || null,
      areaDiscoverySource: raw.areaDiscoverySource || null,
      areaDiscoveryError: raw.areaDiscoveryError || null,
      imageStrategy: raw.imageStrategy || "existing",
      localImageMode: raw.localImageMode === "area-specific" ? "area-specific" : "shared",
      imageDeferredSlots:
        raw.imageDeferredSlots && typeof raw.imageDeferredSlots === "object" ? raw.imageDeferredSlots : {},
      selectedStockImageIds: Array.isArray(raw.selectedStockImageIds)
        ? raw.selectedStockImageIds.map(String)
        : raw.selectedStockImageIds === null
          ? null
          : null,
      requestAiImages: raw.requestAiImages === true,
      imagePlanConfirmedAt: raw.imagePlanConfirmedAt || null,
      contextFrozenAt: raw.contextFrozenAt || null,
      approvedAssets: raw.approvedAssets || {},
    };
  } catch {
    return emptySession(slug);
  }
}

export function saveCampaignBuilderSession(session: CampaignBuilderSession): CampaignBuilderSession {
  const next = { ...session, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(sessionPath(session.slug)), { recursive: true });
  fs.writeFileSync(sessionPath(session.slug), JSON.stringify(next, null, 2));
  return next;
}

export function campaignBuilderStepUrl(slug: string, step: CampaignBuilderStep): string {
  return `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}&step=${step}`;
}

export function campaignBuilderPublishUrl(slug: string, serviceId: string): string {
  return `/api/pharmacy-campaign-launch-queue?slug=${encodeURIComponent(slug)}&service=${encodeURIComponent(serviceId)}`;
}

function mapPriority(campaign: { priority: string; score: number }): CampaignBuilderPriority {
  if (campaign.score >= 250 || campaign.priority === "high" && campaign.score >= 220) return "Critical";
  if (campaign.priority === "high" || campaign.score >= 180) return "High";
  if (campaign.priority === "medium" || campaign.score >= 90) return "Medium";
  return "Low";
}

function priorityClass(priority: CampaignBuilderPriority): string {
  return priority.toLowerCase();
}

export { priorityClass as campaignBuilderPriorityClass };

function countAssets(outputs: ReturnType<typeof estimateCampaignOutputs>): number {
  return authoritativeCampaignPackageTotal(outputs);
}

function estimateCompletionTime(assetCount: number): string {
  if (assetCount >= 45) return "45–90 minutes";
  if (assetCount >= 30) return "30–60 minutes";
  return "20–45 minutes";
}

function estimateOpportunity(campaign: GrowthEngineCampaignRecommendation | CampaignAlternative): string {
  if (campaign.priority === "high") return "Strong local demand — high patient interest";
  if (campaign.priority === "medium") return "Good growth potential in your area";
  return "Steady opportunity to strengthen visibility";
}

function listItemFromPrimary(slug: string, campaign: GrowthEngineCampaignRecommendation): CampaignBuilderListItem {
  const outputs = applySessionLocalPageOverride(slug, campaign.serviceId, campaign.estimatedOutputs);
  const assetCount = countAssets(outputs);
  return {
    serviceId: campaign.serviceId,
    serviceName: campaign.campaignName,
    priority: mapPriority(campaign),
    reason: campaign.reason,
    estimatedOpportunity: estimateOpportunity(campaign),
    estimatedCompletionTime: estimateCompletionTime(assetCount),
    expectedAssetCount: assetCount,
    packageItems: authoritativeCampaignPackageItems(outputs),
    recommended: true,
    score: campaign.score,
  };
}

function listItemFromAlternative(slug: string, alt: CampaignAlternative): CampaignBuilderListItem {
  const outputs = applySessionLocalPageOverride(slug, alt.serviceId, estimateCampaignOutputs(loadProfile(slug)));
  const assetCount = countAssets(outputs);
  return {
    serviceId: alt.serviceId,
    serviceName: alt.campaignName,
    priority: mapPriority(alt),
    reason: alt.reason,
    estimatedOpportunity: estimateOpportunity(alt),
    estimatedCompletionTime: estimateCompletionTime(assetCount),
    expectedAssetCount: assetCount,
    packageItems: authoritativeCampaignPackageItems(outputs),
    recommended: false,
    score: alt.evidenceCount * 40,
  };
}

export function buildCampaignBuilderList(slug: string): CampaignBuilderListItem[] {
  const selectedId = resolveAuthoritativeCampaignPriority(slug);
  if (selectedId) {
    const selectedPlan = buildGrowthPlanForSelectedService(slug, selectedId);
    if (selectedPlan?.campaign) {
      return [
        {
          ...listItemFromPrimary(slug, selectedPlan.campaign),
          recommended: false,
          customerSelected: true,
        },
      ];
    }
  }
  const plan = buildGrowthPlanIntelligence(slug);
  const items: CampaignBuilderListItem[] = [];
  if (plan.primaryCampaign) items.push(listItemFromPrimary(slug, plan.primaryCampaign));
  for (const alt of plan.alternatives) items.push(listItemFromAlternative(slug, alt));
  if (items.length) return items;
  return buildFallbackCampaignBuilderList(slug);
}

export function resolveCampaignBuilderAssetSelection(session: CampaignBuilderSession): CampaignBuilderAssetSelection {
  if (session.mode === "all") return { ...DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION };
  return { ...DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION, ...session.assetSelection };
}

function resolveSelection(session: CampaignBuilderSession): CampaignBuilderAssetSelection {
  return resolveCampaignBuilderAssetSelection(session);
}

/** Same package lines as Growth Plan / Campaign Builder preview, mapped to include/exclude keys. */
const AUTHORITATIVE_PACKAGE_SELECTION_KEYS: Array<keyof CampaignBuilderAssetSelection> = [
  "servicePage",
  "landingPages",
  "guides",
  "blogs",
  "faqs",
  "gbp",
  "social",
  "emails",
  "videos",
  "landingPage",
];

export function resolveCampaignBuilderPackageOutputs(slug: string): CampaignEstimatedOutputs | null {
  const session = loadCampaignBuilderSession(slug);
  if (!session.selectedServiceId) return null;
  const campaign = findCampaign(slug, session.selectedServiceId);
  const outputs = campaign?.estimatedOutputs || estimateCampaignOutputs(loadProfile(slug));
  return applySessionLocalPageOverride(slug, session.selectedServiceId, outputs);
}

export function campaignPackageSelectionRows(
  outputs: CampaignEstimatedOutputs,
  selection: CampaignBuilderAssetSelection,
): Array<{ key: keyof CampaignBuilderAssetSelection; count: number; label: string; selected: boolean }> {
  const items = authoritativeCampaignPackageItems(outputs);
  return items.map((item, index) => {
    const key = AUTHORITATIVE_PACKAGE_SELECTION_KEYS[index] || "servicePage";
    return {
      key,
      count: item.count,
      label: item.label,
      selected: selection[key] !== false,
    };
  });
}

function buildOverviewAssets(
  outputs: ReturnType<typeof estimateCampaignOutputs>,
  selection: CampaignBuilderAssetSelection,
): CampaignBuilderOverviewAsset[] {
  const socialBreakdown = Math.ceil(outputs.socialPosts / 3);
  return [
    { key: "servicePage", label: "Main service page", included: selection.servicePage, count: selection.servicePage ? outputs.servicePage : 0 },
    { key: "landingPages", label: "Local landing pages", included: selection.landingPages, count: selection.landingPages ? outputs.clusterPages : 0 },
    { key: "guides", label: "Patient guide", included: selection.guides, count: selection.guides ? outputs.patientGuides : 0 },
    { key: "faqs", label: "FAQ page", included: selection.faqs, count: selection.faqs ? outputs.faqs : 0 },
    { key: "blogs", label: "Blog articles", included: selection.blogs, count: selection.blogs ? outputs.blogs : 0 },
    { key: "gbp", label: "Google Business Profile posts", included: selection.gbp, count: selection.gbp ? outputs.gbpPosts : 0 },
    { key: "social", label: "Facebook posts", included: selection.social, count: selection.social ? socialBreakdown : 0 },
    { key: "socialInstagram", label: "Instagram posts", included: selection.social, count: selection.social ? socialBreakdown : 0 },
    { key: "socialX", label: "X posts", included: selection.social, count: selection.social ? outputs.socialPosts - socialBreakdown * 2 : 0 },
    { key: "emails", label: "Email campaign", included: selection.emails, count: selection.emails ? outputs.emails : 0 },
    { key: "images", label: "AI images", included: selection.images, count: selection.images ? 8 : 0 },
    { key: "internalLinks", label: "Internal links", included: true, count: selection.servicePage ? 1 : 0 },
    { key: "structuredData", label: "Structured data", included: true, count: selection.servicePage ? 1 : 0 },
    { key: "publishingPackage", label: "Publishing package", included: true, count: 1 },
  ];
}

function buildTotals(assets: CampaignBuilderOverviewAsset[]): CampaignBuilderTotals {
  const pages =
    (assets.find((a) => a.key === "servicePage")?.count || 0) +
    (assets.find((a) => a.key === "landingPages")?.count || 0) +
    (assets.find((a) => a.key === "guides")?.count || 0) +
    (assets.find((a) => a.key === "faqs")?.count || 0) +
    (assets.find((a) => a.key === "blogs")?.count || 0);
  const posts =
    (assets.find((a) => a.key === "gbp")?.count || 0) +
    (assets.find((a) => a.key === "social")?.count || 0) +
    (assets.find((a) => a.key === "socialInstagram")?.count || 0) +
    (assets.find((a) => a.key === "socialX")?.count || 0);
  const images = assets.find((a) => a.key === "images")?.count || 0;
  const emails = assets.find((a) => a.key === "emails")?.count || 0;
  return { pages, posts, images, emails };
}

function findCampaign(slug: string, serviceId: string): GrowthEngineCampaignRecommendation | null {
  const selectedPlan = buildGrowthPlanForSelectedService(slug, serviceId);
  if (selectedPlan?.campaign) return selectedPlan.campaign;
  const plan = buildGrowthPlanIntelligence(slug);
  if (plan.primaryCampaign?.serviceId === serviceId) return plan.primaryCampaign;
  const alt = plan.alternatives.find((a) => a.serviceId === serviceId);
  if (alt) {
    return {
      serviceId: alt.serviceId,
      campaignName: alt.campaignName,
      priority: alt.priority,
      confidence: alt.confidence,
      reason: alt.reason,
      evidence: [],
      evidenceSources: [],
      estimatedOutputs: estimateCampaignOutputs(loadProfile(slug)),
      expectedBenefits: [],
      score: alt.evidenceCount * 40,
    };
  }
  return findFallbackCampaignRecommendation(slug, serviceId) || findExplorerCampaign(slug, serviceId);
}

function findExplorerCampaign(slug: string, serviceId: string): GrowthEngineCampaignRecommendation | null {
  const def = CAMPAIGN_EXPLORER_ALL_SUPPORTED.find((s) => s.serviceId === serviceId);
  if (!def) return null;
  const profile = loadProfile(slug);
  return {
    serviceId: def.serviceId,
    campaignName: def.serviceName,
    priority: "medium",
    confidence: "medium",
    reason: def.description,
    evidence: [],
    evidenceSources: [],
    estimatedOutputs: estimateCampaignOutputs(profile),
    expectedBenefits: [],
    score: 30,
  };
}

export function buildCampaignBuilderOverview(slug: string, session?: CampaignBuilderSession): CampaignBuilderOverview | null {
  const state = session || loadCampaignBuilderSession(slug);
  if (!state.selectedServiceId) return null;
  const campaign = findCampaign(slug, state.selectedServiceId);
  if (!campaign) return null;
  const selection = resolveSelection(state);
  const outputs = applySessionLocalPageOverride(slug, campaign.serviceId, campaign.estimatedOutputs);
  const assets = buildOverviewAssets(outputs, selection);
  const totals = buildTotals(assets);
  const assetCount = assets.filter((a) => a.included && a.count > 0).reduce((n, a) => n + a.count, 0);
  const intel = buildCampaignRecommendationIntelligence(slug, campaign.serviceId);
  return {
    serviceId: campaign.serviceId,
    campaignName: campaign.campaignName,
    assets,
    totals,
    estimatedCompletionTime: estimateCompletionTime(assetCount),
    estimatedSeoStrength: campaign.priority === "high" ? "Strong" : campaign.priority === "medium" ? "Good" : "Building",
    estimatedCustomerValue: campaign.priority === "high" ? "High patient reach" : "Growing awareness",
    campaignObjective: intel?.summary.tagline || `Promote ${campaign.campaignName} to patients in your local area`,
    expectedOutcome: intel ? campaignIntelligenceExpectedOutcomeText(intel) : campaign.reason,
  };
}

export function buildCampaignBuilderApprovalSummary(slug: string): CampaignBuilderApprovalSummary | null {
  const session = loadCampaignBuilderSession(slug);
  const overview = buildCampaignBuilderOverview(slug, session);
  if (!overview) return null;
  const assetCount = overview.assets.filter((a) => a.included && a.count > 0).reduce((n, a) => n + a.count, 0);
  const selection = resolveSelection(session);
  const areaOptions = buildCampaignBuilderAreaOptions(slug, session);
  const targetAreas = areaOptions.candidates.filter((row) => row.selected).map((row) => row.area);
  const encodedSlug = encodeURIComponent(slug);
  return {
    campaignName: overview.campaignName,
    serviceId: overview.serviceId,
    estimatedAssets: assetCount,
    estimatedTime: overview.estimatedCompletionTime,
    campaignObjective: overview.campaignObjective,
    expectedOutcome: overview.expectedOutcome,
    targetAreaMode: session.targetAreaMode,
    targetAreas,
    imageStrategy: session.imageStrategy,
    assetSelection: selection,
    sourceRefs: {
      businessProfileUrl: `/api/pharmacy-profile-wizard?slug=${encodedSlug}`,
      websiteIntelligenceUrl: `/api/growth-engine/website-intelligence?slug=${encodedSlug}`,
      localMarketUrl: `/api/growth-engine/local-market?slug=${encodedSlug}`,
    },
    imagePlan: buildCampaignBuilderImagePlan(slug, session),
  };
}

export function buildCampaignBuilderAreaOptions(slug: string, session?: CampaignBuilderSession): {
  primaryTown: string;
  candidates: CampaignBuilderAreaOption[];
  storedCampaignAreas: string[];
  recommendedAreas: string[];
  configuredLocalPages: number;
  hasAuthoritativeStoredSelection: boolean;
  outputs: ReturnType<typeof estimateCampaignOutputs>;
  discoveryStatus: CampaignBuilderSession["areaDiscoveryStatus"];
  discoveredAt: string | null;
} {
  const state = session || loadCampaignBuilderSession(slug);
  const scope = resolveStoredCampaignBuilderAreaScope(slug);
  const poolByKey = new Map(scope.pool.map((row) => [row.area.toLowerCase(), row.area]));
  const savedFromPool = (state.targetAreaNames || [])
    .map((name) => poolByKey.get(String(name).trim().toLowerCase()))
    .filter((name): name is string => Boolean(name));
  const preserveSaved = state.targetAreaMode !== "wholeTown" && savedFromPool.length > 0;
  const selectedKeys = new Set(
    (preserveSaved ? savedFromPool : scope.recommendedAreas).map((name) => name.toLowerCase()),
  );

  return {
    primaryTown: scope.primaryTown,
    storedCampaignAreas: scope.recommendedAreas,
    recommendedAreas: scope.recommendedAreas,
    configuredLocalPages: scope.configuredLocalPages,
    hasAuthoritativeStoredSelection: scope.hasAuthoritativeStoredSelection,
    outputs: applySessionLocalPageOverride(slug, state.selectedServiceId || "", scope.outputs),
    discoveryStatus: "idle",
    discoveredAt: null,
    candidates: scope.pool.map((row) => ({
      ...row,
      selected: selectedKeys.has(row.area.toLowerCase()),
    })),
  };
}

export function runCampaignBuilderAreaDiscovery(
  slug: string,
  limit = 10,
): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  try {
    const { primaryTown, candidates, discovery } = discoverCampaignBuilderAreaCandidates(slug, session, limit);
    saveCampaignAreaDiscoverySnapshot(slug, {
      discoveredAt: discovery.generatedAt,
      primaryTown,
      source: discovery.source,
      candidates,
    });
    return saveCampaignBuilderSession({
      ...session,
      discoveredAreaCandidates: candidates,
      areaDiscoveryStatus: "ready",
      areaDiscoveredAt: discovery.generatedAt,
      areaDiscoverySource: discovery.source,
      areaDiscoveryError: null,
      step: "areas",
    });
  } catch (err) {
    return saveCampaignBuilderSession({
      ...session,
      areaDiscoveryStatus: "failed",
      areaDiscoveryError: err instanceof Error ? err.message : String(err),
      step: "areas",
    });
  }
}

export function updateCampaignBuilderAreas(
  slug: string,
  mode: CampaignBuilderTargetAreaMode,
  areaNames: string[],
  _candidateSelection?: Array<{ areaName: string; selected: boolean }>,
): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  const scope = resolveStoredCampaignBuilderAreaScope(slug);
  const cleaned = areaNames.map((a) => String(a).trim()).filter(Boolean);
  const poolByKey = new Map(scope.pool.map((row) => [row.area.toLowerCase(), row.area]));
  let targetAreaNames: string[] = [];
  const resolvedMode: CampaignBuilderTargetAreaMode =
    mode === "recommended" || mode === "selected" ? mode : "selected";

  if (resolvedMode === "recommended") {
    if (scope.recommendedAreas.length !== scope.configuredLocalPages) {
      throw new Error("Recommended target areas are not available for this campaign package.");
    }
    targetAreaNames = [...scope.recommendedAreas];
  } else {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const name of cleaned) {
      const key = name.toLowerCase();
      const canonical = poolByKey.get(key);
      if (!canonical || seen.has(key)) continue;
      seen.add(key);
      unique.push(canonical);
    }
    if (unique.length !== scope.configuredLocalPages) {
      throw new Error(
        `Select exactly ${scope.configuredLocalPages} stored area${scope.configuredLocalPages === 1 ? "" : "s"} before continuing.`,
      );
    }
    targetAreaNames = unique;
  }

  return saveCampaignBuilderSession({
    ...session,
    targetAreaMode: "selected",
    targetAreaNames,
    step: "settings",
  });
}

export function updateCampaignBuilderImageStrategy(
  slug: string,
  strategy: CampaignBuilderImageStrategy,
  localImageMode?: CampaignImageLocalMode,
  deferredSlots?: Record<string, boolean>,
  extras?: {
    selectedStockImageIds?: string[] | null;
    requestAiImages?: boolean;
  },
): CampaignBuilderSession {
  void strategy;
  const session = loadCampaignBuilderSession(slug);
  const selectedStockImageIds =
    extras && "selectedStockImageIds" in extras
      ? extras.selectedStockImageIds === null
        ? null
        : Array.isArray(extras.selectedStockImageIds)
          ? extras.selectedStockImageIds.map(String)
          : session.selectedStockImageIds
      : session.selectedStockImageIds;
  const requestAiImages =
    extras && typeof extras.requestAiImages === "boolean" ? extras.requestAiImages : session.requestAiImages === true;
  const selectedStockCount = Array.isArray(selectedStockImageIds)
    ? selectedStockImageIds.length
    : listEligibleCampaignStockPhotographs(slug).length;
  const derived = deriveCampaignImageStrategy({
    selectedStockCount: selectedStockCount,
    uploadCount: listCampaignPharmacyPhotographs(slug).length,
    requestAiImages,
  });
  return saveCampaignBuilderSession({
    ...session,
    imageStrategy: derived,
    localImageMode: localImageMode || session.localImageMode || "shared",
    imageDeferredSlots: deferredSlots || session.imageDeferredSlots || {},
    selectedStockImageIds,
    requestAiImages,
    imagePlanConfirmedAt: null,
    step: "images",
  });
}

export function confirmCampaignBuilderImagePlan(slug: string): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  const plan = buildCampaignBuilderImagePlan(slug, session);
  if (!plan) throw new Error("Select a campaign before confirming the image plan.");
  if (session.requestAiImages) {
    const serviceId = session.selectedServiceId || "pharmacy-first";
    recordCampaignAiImageRequests(slug, serviceId);
  }
  saveCampaignImagePlanSnapshot(slug, { ...plan, confirmedAt: new Date().toISOString() });
  return saveCampaignBuilderSession({
    ...session,
    imagePlanConfirmedAt: new Date().toISOString(),
    step: "overview",
  });
}

export function ensureCampaignBuilderImageDefaults(
  slug: string,
  session?: CampaignBuilderSession,
): CampaignBuilderSession {
  return session || loadCampaignBuilderSession(slug);
}

export function selectCampaignBuilderService(slug: string, serviceId: string): CampaignBuilderSession {
  saveAuthoritativeCampaignPriority(slug, serviceId);
  const session = loadCampaignBuilderSession(slug);
  const selected = saveCampaignBuilderSession({
    ...session,
    selectedServiceId: serviceId,
    step: "areas",
    approvedAssets: {},
    generationStartedAt: null,
    generationCompletedAt: null,
    contextFrozenAt: null,
    imageDeferredSlots: {},
  });
  return ensureCampaignBuilderImageDefaults(slug, selected);
}

export function updateCampaignBuilderSettings(
  slug: string,
  mode: CampaignBuilderMode,
  selection: Partial<CampaignBuilderAssetSelection>,
): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({
    ...session,
    mode,
    assetSelection: { ...session.assetSelection, ...selection },
    step: "images",
  });
}

export function advanceCampaignBuilderStep(slug: string, step: CampaignBuilderStep): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({ ...session, step });
}

export function markCampaignBuilderContextFrozen(slug: string, frozenAt: string): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({ ...session, contextFrozenAt: frozenAt });
}

export function markCampaignBuilderGenerationStarted(slug: string): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({
    ...session,
    generationStartedAt: new Date().toISOString(),
    step: "review",
  });
}

export function markCampaignBuilderGenerationCompleted(slug: string): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({
    ...session,
    generationCompletedAt: new Date().toISOString(),
    step: "review",
    approvedAssets: {},
  });
}

function qualityFromAsset(status: string, included: boolean): { score: number; label: string } {
  if (included && status === "included") return { score: 92, label: "Excellent" };
  if (included && status === "planned") return { score: 78, label: "Good" };
  if (status === "error") return { score: 45, label: "Needs attention" };
  if (status === "missing") return { score: 55, label: "Pending" };
  return { score: 70, label: "Review" };
}

function flattenReviewSections(
  slug: string,
  serviceId: string,
  session: CampaignBuilderSession,
): CampaignBuilderReviewItem[] {
  const sections = getContentPackageReviewSections(slug, serviceId);
  const items: CampaignBuilderReviewItem[] = [];

  for (const sec of sections.filter((s) => s.included || s.required)) {
    const quality = qualityFromAsset(sec.status, sec.included);
    const key = sec.type;
    items.push({
      key,
      title: sec.title,
      type: sec.type,
      qualityScore: quality.score,
      qualityLabel: quality.label,
      previewUrl: sec.previewUrl,
      approved: Boolean(session.approvedAssets[key]),
      approvedAt: session.approvedAssets[key] || null,
      count: sec.count,
    });
  }

  if (items.length === 0) {
    const overview = buildCampaignBuilderOverview(slug, session);
    if (overview) {
      for (const asset of overview.assets.filter((a) => a.included && a.count > 0 && !a.key.startsWith("social"))) {
        items.push({
          key: asset.key,
          title: asset.label,
          type: asset.key,
          qualityScore: 75,
          qualityLabel: "Ready to review",
          previewUrl: null,
          approved: Boolean(session.approvedAssets[asset.key]),
          approvedAt: session.approvedAssets[asset.key] || null,
          count: asset.count,
        });
      }
    }
  }

  return items;
}

export function buildCampaignBuilderReviewItems(slug: string): CampaignBuilderReviewItem[] {
  const session = loadCampaignBuilderSession(slug);
  if (!session.selectedServiceId) return [];
  return flattenReviewSections(slug, session.selectedServiceId, session);
}

export function approveCampaignBuilderAsset(slug: string, assetKey: string): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({
    ...session,
    approvedAssets: { ...session.approvedAssets, [assetKey]: new Date().toISOString() },
  });
}

export function allCampaignBuilderAssetsApproved(slug: string): boolean {
  const session = loadCampaignBuilderSession(slug);
  if (!session.selectedServiceId) return false;
  const items = buildCampaignBuilderReviewItems(slug);
  if (!items.length) return false;
  return items.every((item) => Boolean(session.approvedAssets[item.key]));
}

export function campaignBuilderReadyToPublish(slug: string): boolean {
  const session = loadCampaignBuilderSession(slug);
  if (!session.selectedServiceId) return false;
  if (!contentPackageGenerated(slug, session.selectedServiceId)) return false;
  return allCampaignBuilderAssetsApproved(slug) || contentPackageApproved(slug, session.selectedServiceId);
}

export function resolveCampaignBuilderServiceName(serviceId: string): string {
  return getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseCampaignBuilderAssetSelection(body: Record<string, unknown>): Partial<CampaignBuilderAssetSelection> {
  const keys = Object.keys(DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION) as (keyof CampaignBuilderAssetSelection)[];
  const out: Partial<CampaignBuilderAssetSelection> = {};
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key] === true || body[key] === "true" || body[key] === "on";
  }
  return out;
}
