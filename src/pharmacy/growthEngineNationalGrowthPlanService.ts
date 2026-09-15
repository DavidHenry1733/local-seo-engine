/**
 * National Growth Plan authority — consumes persisted GP-01 snapshot only.
 * Does not call DataForSEO, Google Places, or GSC.
 * Does not use the local pharmacy campaign recommendation engine.
 */
import { resolveGrowthPlatform } from "./growthPlatformResolverService.ts";
import { resolvePrimaryMarket } from "./masterAdminMarketScopeService.ts";
import { getPharmacyProjectConfigPath, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";
import { resolveTenantServiceCatalogue, type TenantServiceCatalogueEntry } from "./growthEngineTenantServiceCatalogue.ts";
import { readGrowthPlanIntelligenceV1 } from "./growthPlanIntelligenceV1Service.ts";
import { compareGapEvidenceQuality, type GrowthPlanAction, type GrowthPlanIntelligenceSnapshot } from "./growthPlanIntelligenceV1Model.ts";
import type { CampaignReadinessItem } from "./growthEngineCampaignModel.ts";
import fs from "node:fs";

const ELIGIBLE_ROLES = new Set(["PRIMARY_COMMERCIAL", "SUPPORTING_COMMERCIAL", "AUTHORITY_SUPPORT"]);

export interface NationalPrimaryRecommendation {
  actionId: string;
  actionType: string;
  title: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  combinedSearchDemand: number;
  searchVolume: number | null;
  priority: string;
  actionScore: number;
  marketScope: string;
  growthPlanRole: string;
  gapEvidenceStatus: string;
  gapConfidence: string;
  confidence: string;
  competitorCount: number;
  bestCompetitorDomain: string | null;
  bestCompetitorPosition: number | null;
  bestRankingUrl: string | null;
  rationale: string;
  evidenceReasons: string[];
  recommendedPageType: string;
  recommendedIntent: string;
  recommendedNextStep: string;
}

export interface NationalGrowthPlanView {
  platform: "national";
  slug: string;
  generatedAt: string;
  subjectDomain: string;
  market: string;
  primaryMarket: string;
  businessName: string;
  commercialServices: TenantServiceCatalogueEntry[];
  executiveSummary: {
    currentPosition: string;
    primaryOpportunity: string;
    whyRecommended: string;
    estimatedBusinessBenefit: string;
  };
  primary: NationalPrimaryRecommendation | null;
  alternatives: NationalPrimaryRecommendation[];
  readiness: CampaignReadinessItem[];
  strategyReady: boolean;
  readyToGenerate: false;
  contentGenerationState: "not_implemented";
  intelligenceLoaded: boolean;
}

function readProjectIdentity(slug: string): { businessName: string; primaryLocation: string } {
  const file = getPharmacyProjectConfigPath(safePharmacySlug(slug));
  if (!fs.existsSync(file)) {
    return { businessName: slug, primaryLocation: "United Kingdom" };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    return {
      businessName: String(raw.businessName || raw.legalName || slug),
      primaryLocation: String(raw.primaryLocation || "United Kingdom"),
    };
  } catch {
    return { businessName: slug, primaryLocation: "United Kingdom" };
  }
}

function toRecommendation(action: GrowthPlanAction): NationalPrimaryRecommendation {
  return {
    actionId: action.id,
    actionType: action.actionType,
    title: action.title,
    primaryKeyword: action.primaryKeyword,
    supportingKeywords: [...(action.supportingKeywords || [])],
    combinedSearchDemand: action.combinedSearchDemand,
    searchVolume: action.searchVolume,
    priority: action.priority,
    actionScore: action.actionScore,
    marketScope: action.marketScope,
    growthPlanRole: action.growthPlanRole,
    gapEvidenceStatus: action.gapEvidenceStatus,
    gapConfidence: action.gapConfidence,
    confidence: action.confidence,
    competitorCount: action.competitorCount,
    bestCompetitorDomain: action.bestCompetitorDomain,
    bestCompetitorPosition: action.bestCompetitorPosition,
    bestRankingUrl: action.bestRankingUrl,
    rationale: action.rationale,
    evidenceReasons: [...(action.evidenceReasons || [])],
    recommendedPageType: action.recommendedPageType,
    recommendedIntent: action.recommendedIntent,
    recommendedNextStep: action.recommendedNextStep,
  };
}

function selectEligible(snapshot: GrowthPlanIntelligenceSnapshot | null): GrowthPlanAction[] {
  if (!snapshot) return [];
  return snapshot.actions.filter((action) => ELIGIBLE_ROLES.has(action.growthPlanRole));
}

const PRIORITY_RANK: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function selectPrimary(eligible: GrowthPlanAction[]): GrowthPlanAction | null {
  const corePrimary = eligible.filter((a) => a.growthPlanRole === "PRIMARY_COMMERCIAL" && a.marketScope === "CORE");
  const primaryCommercial = eligible.filter((a) => a.growthPlanRole === "PRIMARY_COMMERCIAL");
  const pool = corePrimary.length ? corePrimary : primaryCommercial.length ? primaryCommercial : eligible;
  const sorted = [...pool].sort((a, b) => {
    const evidence = compareGapEvidenceQuality(a, b);
    if (evidence) return evidence;
    const priorityDelta = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
    if (priorityDelta) return priorityDelta;
    if (b.actionScore !== a.actionScore) return b.actionScore - a.actionScore;
    if (b.combinedSearchDemand !== a.combinedSearchDemand) return b.combinedSearchDemand - a.combinedSearchDemand;
    if (b.competitorCount !== a.competitorCount) return b.competitorCount - a.competitorCount;
    const posA = a.bestCompetitorPosition ?? 999;
    const posB = b.bestCompetitorPosition ?? 999;
    if (posA !== posB) return posA - posB;
    return a.primaryKeyword.localeCompare(b.primaryKeyword);
  });
  return sorted[0] || null;
}

function buildNationalReadiness(
  snapshot: GrowthPlanIntelligenceSnapshot | null,
  services: TenantServiceCatalogueEntry[],
  primary: GrowthPlanAction | null,
): CampaignReadinessItem[] {
  const intelligenceLoaded = Boolean(snapshot);
  return [
    {
      id: "national-intelligence",
      label: "National commercial intelligence",
      complete: intelligenceLoaded,
      detail: intelligenceLoaded
        ? `${snapshot!.summary.totalActions} persisted Growth Plan actions · source ${snapshot!.intelligenceSourceVersion}`
        : "Persisted national Growth Plan Intelligence was not found",
    },
    {
      id: "national-market",
      label: "National market intelligence",
      complete: true,
      detail: "Local Google Places / Your Local Market is not a prerequisite for the national Growth Plan.",
    },
    {
      id: "commercial-services",
      label: "Commercial services configured",
      complete: services.length > 0,
      detail: services.length
        ? services.map((s) => s.serviceName).join(", ")
        : "No project commercial services configured",
    },
    {
      id: "eligible-action",
      label: "Eligible national recommendation",
      complete: Boolean(primary),
      detail: primary
        ? `${primary.primaryKeyword} · ${primary.growthPlanRole} · gap ${primary.gapEvidenceStatus}/${primary.gapConfidence}`
        : "No PRIMARY_COMMERCIAL / SUPPORTING_COMMERCIAL / AUTHORITY_SUPPORT action in the persisted snapshot",
    },
    {
      id: "national-generation",
      label: "National content generation",
      complete: false,
      detail: "National commercial content generation is not implemented. Strategy recommendation only — patient-service Campaign Builder is not used.",
    },
  ];
}

export function buildNationalGrowthPlanView(slug: string): NationalGrowthPlanView {
  const platform = resolveGrowthPlatform(slug);
  if (platform.platform !== "national") {
    throw new Error(`National Growth Plan is not applicable to ${slug}; platform=${platform.platform}`);
  }

  const identity = readProjectIdentity(slug);
  const catalogue = resolveTenantServiceCatalogue(slug);
  const snapshot = readGrowthPlanIntelligenceV1(slug);
  const eligible = selectEligible(snapshot);
  const primaryAction = selectPrimary(eligible);
  const primary = primaryAction ? toRecommendation(primaryAction) : null;
  const alternatives = eligible
    .filter((a) => a.id !== primaryAction?.id)
    .slice(0, 3)
    .map(toRecommendation);
  const primaryMarket = resolvePrimaryMarket(slug) || identity.primaryLocation || "United Kingdom";
  const market = snapshot?.market || "UK Community Pharmacy Digital Growth";
  const readiness = buildNationalReadiness(snapshot, catalogue.services, primaryAction);
  const strategyReady = Boolean(primary);

  const currentPosition = `${identity.businessName} is a national digital-growth provider serving UK community pharmacies. Commercial market: ${primaryMarket} (${market}). Registered office location does not define this market.`;

  const executiveSummary = primary
    ? {
        currentPosition,
        primaryOpportunity: `${primary.recommendedPageType}: ${primary.primaryKeyword}`,
        whyRecommended: primary.rationale,
        estimatedBusinessBenefit: `${primary.recommendedIntent}. Combined search demand ${primary.combinedSearchDemand}. Gap evidence remains ${primary.gapEvidenceStatus} at ${primary.gapConfidence} confidence — this is not upgraded.`,
      }
    : {
        currentPosition,
        primaryOpportunity: snapshot
          ? "No eligible national commercial action in the persisted snapshot"
          : "National Growth Plan Intelligence has not been loaded",
        whyRecommended:
          "The national plan only recommends actions already classified as PRIMARY_COMMERCIAL, SUPPORTING_COMMERCIAL, or AUTHORITY_SUPPORT in persisted GP-01 intelligence.",
        estimatedBusinessBenefit: "Complete national intelligence persistence before treating a recommendation as ready.",
      };

  return {
    platform: "national",
    slug: safePharmacySlug(slug),
    generatedAt: snapshot?.generatedAt || new Date().toISOString(),
    subjectDomain: snapshot?.subjectDomain || "",
    market,
    primaryMarket,
    businessName: identity.businessName,
    commercialServices: catalogue.services,
    executiveSummary,
    primary,
    alternatives,
    readiness,
    strategyReady,
    readyToGenerate: false,
    contentGenerationState: "not_implemented",
    intelligenceLoaded: Boolean(snapshot),
  };
}
