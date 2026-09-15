export type ClassificationStatus = "QUALIFIED" | "REJECTED" | "REVIEW";
export type CommercialType =
  | "MONEY_KEYWORD"
  | "COMMERCIAL_SUPPORT"
  | "AUTHORITY_SUPPORT"
  | "PATIENT_SERVICE"
  | "NAVIGATIONAL"
  | "LOCAL_PHARMACY"
  | "INDUSTRY_IRRELEVANT"
  | "AMBIGUOUS_REVIEW";
export type MarketScope = "CORE" | "ADJACENT" | "BROAD" | "NONE";
export type GapEvidenceStatus =
  | "PROVEN_UNTAPPED"
  | "PROVEN_WEAK_COVERAGE"
  | "PROVEN_DEFEND_IMPROVE"
  | "NEW_MARKET_EVIDENCE"
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_APPLICABLE";
export type GapConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type GrowthPlanRole =
  | "PRIMARY_COMMERCIAL"
  | "SUPPORTING_COMMERCIAL"
  | "AUTHORITY_SUPPORT"
  | "MARKET_EXPANSION_ONLY"
  | "EXCLUDED"
  | "REVIEW_REQUIRED";

export interface GrowthPlanKeywordInput {
  keyword: string;
  commercialType: CommercialType;
  classificationStatus: ClassificationStatus;
  marketScope: MarketScope;
  growthPlanRole: GrowthPlanRole;
  growthPlanEligible: boolean;
  growthPlanEligibilityReason: string;
  searchVolume: number | null;
  cpc: number | null;
  paidCompetition: number | null;
  competitorCount: number;
  bestCompetitorDomain: string | null;
  bestCompetitorPosition: number | null;
  bestRankingUrl: string | null;
  subjectPosition: number | null;
  subjectRankingUrl: string | null;
  gapEvidenceStatus: GapEvidenceStatus;
  gapConfidence: GapConfidence;
  opportunityScore: number;
  priority: string;
  reasons: string[];
  sources: string[];
}

export interface GrowthPlanIntelligenceInput {
  metadata: {
    version: 1;
    generatedAt: string;
    source: string;
    sourceGeneratedAt: string | null;
    subjectDomain: string;
    inheritedUpstreamCost?: number | null;
  };
  primaryCommercialOpportunities: GrowthPlanKeywordInput[];
  supportingCommercialOpportunities: GrowthPlanKeywordInput[];
  authoritySupportOpportunities: GrowthPlanKeywordInput[];
  marketExpansionEvidence: GrowthPlanKeywordInput[];
  excluded: GrowthPlanKeywordInput[];
  reviewRequired: GrowthPlanKeywordInput[];
  summary: {
    primaryCommercialCount: number;
    supportingCommercialCount: number;
    authoritySupportCount: number;
    marketExpansionCount: number;
    excludedCount: number;
    reviewRequiredCount: number;
    provenUntappedCount: number;
    provenWeakCoverageCount: number;
    provenDefendImproveCount: number;
    insufficientGapEvidenceCount: number;
    totalPrimarySearchDemand: number;
    totalSupportingSearchDemand: number;
  };
}

function hasDomainGapEvidence(item: any): boolean {
  return Array.isArray(item.sources) && item.sources.includes("domain_intersection_gap");
}

function gapEvidenceStatus(item: any): GapEvidenceStatus {
  const type = item.type as CommercialType;
  if (["PATIENT_SERVICE", "NAVIGATIONAL", "LOCAL_PHARMACY", "INDUSTRY_IRRELEVANT", "AMBIGUOUS_REVIEW"].includes(type)) {
    return "NOT_APPLICABLE";
  }
  if (item.gapType === "UNTAPPED" && hasDomainGapEvidence(item)) return "PROVEN_UNTAPPED";
  if (item.gapType === "UNTAPPED") return "INSUFFICIENT_EVIDENCE";
  if (item.gapType === "WEAK_COVERAGE" && item.subjectPosition != null && item.bestCompetitorPosition != null) return "PROVEN_WEAK_COVERAGE";
  if (item.gapType === "DEFEND_IMPROVE" && item.subjectPosition != null) return "PROVEN_DEFEND_IMPROVE";
  if (item.gapType === "NEW_MARKET") return "NEW_MARKET_EVIDENCE";
  return "INSUFFICIENT_EVIDENCE";
}

function gapConfidence(status: GapEvidenceStatus, item: any): GapConfidence {
  if (status === "PROVEN_UNTAPPED" && hasDomainGapEvidence(item)) return "HIGH";
  if (status === "PROVEN_WEAK_COVERAGE") return "HIGH";
  if (status === "PROVEN_DEFEND_IMPROVE") return "MEDIUM";
  if (status === "NEW_MARKET_EVIDENCE") return "LOW";
  return "NONE";
}

function roleAndEligibility(item: any, gapStatus: GapEvidenceStatus): {
  role: GrowthPlanRole;
  eligible: boolean;
  reason: string;
} {
  const commercialType = item.type as CommercialType;
  const classification = item.qualification as ClassificationStatus;
  const scope = (item.marketScope || "NONE") as MarketScope;

  if (classification === "REVIEW" || commercialType === "AMBIGUOUS_REVIEW") {
    return { role: "REVIEW_REQUIRED", eligible: false, reason: "Keyword requires taxonomy review before Growth Plan use." };
  }

  if (["PATIENT_SERVICE", "NAVIGATIONAL", "LOCAL_PHARMACY", "INDUSTRY_IRRELEVANT"].includes(commercialType)) {
    return { role: "EXCLUDED", eligible: false, reason: `${commercialType} is excluded from positive Growth Plan opportunities.` };
  }

  if (commercialType === "MONEY_KEYWORD" && scope === "CORE" && classification === "QUALIFIED") {
    return {
      role: "PRIMARY_COMMERCIAL",
      eligible: true,
      reason: gapStatus === "PROVEN_UNTAPPED"
        ? "Core qualified money keyword with proven untapped gap evidence."
        : "Core qualified money keyword eligible; gap evidence must be described according to confidence status.",
    };
  }

  if (commercialType === "MONEY_KEYWORD" && scope === "ADJACENT" && classification === "QUALIFIED") {
    return { role: "PRIMARY_COMMERCIAL", eligible: true, reason: "Adjacent qualified money keyword is eligible for Growth Plan review." };
  }

  if (commercialType === "MONEY_KEYWORD" && scope === "BROAD") {
    return { role: "MARKET_EXPANSION_ONLY", eligible: false, reason: "Broad pharma-market term is market expansion evidence, not a core community-pharmacy Growth Plan driver." };
  }

  if (commercialType === "COMMERCIAL_SUPPORT" && classification === "QUALIFIED") {
    return { role: "SUPPORTING_COMMERCIAL", eligible: true, reason: "Commercial support keyword can inform guides, clusters or lead-nurture content." };
  }

  if (commercialType === "AUTHORITY_SUPPORT" && classification === "QUALIFIED") {
    return { role: "AUTHORITY_SUPPORT", eligible: true, reason: "Authority support keyword can inform topical authority content." };
  }

  return { role: "REVIEW_REQUIRED", eligible: false, reason: "Keyword does not meet a positive Growth Plan eligibility rule." };
}

function mapKeyword(item: any): GrowthPlanKeywordInput {
  const gapStatus = gapEvidenceStatus(item);
  const role = roleAndEligibility(item, gapStatus);
  return {
    keyword: String(item.keyword || ""),
    commercialType: item.type || "AMBIGUOUS_REVIEW",
    classificationStatus: item.qualification || "REVIEW",
    marketScope: item.marketScope || "NONE",
    growthPlanRole: role.role,
    growthPlanEligible: role.eligible,
    growthPlanEligibilityReason: role.reason,
    searchVolume: item.searchVolume ?? null,
    cpc: item.cpc ?? null,
    paidCompetition: item.paidCompetition ?? null,
    competitorCount: Number(item.directCompetitorsRanking || item.competitorCount || 0),
    bestCompetitorDomain: item.bestCompetitorDomain || null,
    bestCompetitorPosition: item.bestCompetitorPosition ?? null,
    bestRankingUrl: item.bestRankingUrl || null,
    subjectPosition: item.subjectPosition ?? null,
    subjectRankingUrl: item.subjectRankingUrl || null,
    gapEvidenceStatus: gapStatus,
    gapConfidence: gapConfidence(gapStatus, item),
    opportunityScore: Number(item.score || item.opportunityScore || 0),
    priority: String(item.priority || "LOW"),
    reasons: Array.isArray(item.reasons) ? item.reasons : [],
    sources: Array.isArray(item.sources) ? item.sources : [],
  };
}

function sumDemand(items: GrowthPlanKeywordInput[]): number {
  return items.reduce((sum, item) => sum + (item.searchVolume || 0), 0);
}

export function buildGrowthPlanIntelligenceInput(snapshot: any): GrowthPlanIntelligenceInput {
  const mapped = (snapshot.universe || []).map(mapKeyword);
  const primary = mapped.filter((item) => item.growthPlanRole === "PRIMARY_COMMERCIAL");
  const support = mapped.filter((item) => item.growthPlanRole === "SUPPORTING_COMMERCIAL");
  const authority = mapped.filter((item) => item.growthPlanRole === "AUTHORITY_SUPPORT");
  const expansion = mapped.filter((item) => item.growthPlanRole === "MARKET_EXPANSION_ONLY");
  const excluded = mapped.filter((item) => item.growthPlanRole === "EXCLUDED");
  const review = mapped.filter((item) => item.growthPlanRole === "REVIEW_REQUIRED");
  return {
    metadata: {
      version: 1,
      generatedAt: new Date().toISOString(),
      source: "market-universe-v2-reclassified-b",
      sourceGeneratedAt: snapshot.generatedAt || null,
      subjectDomain: snapshot.subjectDomain || "",
      inheritedUpstreamCost: typeof snapshot.costLedger?.totalCost === "number"
        ? snapshot.costLedger.totalCost
        : typeof snapshot.costs?.totalCost === "number"
          ? snapshot.costs.totalCost
          : 0,
    },
    primaryCommercialOpportunities: primary,
    supportingCommercialOpportunities: support,
    authoritySupportOpportunities: authority,
    marketExpansionEvidence: expansion,
    excluded,
    reviewRequired: review,
    summary: {
      primaryCommercialCount: primary.length,
      supportingCommercialCount: support.length,
      authoritySupportCount: authority.length,
      marketExpansionCount: expansion.length,
      excludedCount: excluded.length,
      reviewRequiredCount: review.length,
      provenUntappedCount: mapped.filter((item) => item.gapEvidenceStatus === "PROVEN_UNTAPPED").length,
      provenWeakCoverageCount: mapped.filter((item) => item.gapEvidenceStatus === "PROVEN_WEAK_COVERAGE").length,
      provenDefendImproveCount: mapped.filter((item) => item.gapEvidenceStatus === "PROVEN_DEFEND_IMPROVE").length,
      insufficientGapEvidenceCount: mapped.filter((item) => item.gapEvidenceStatus === "INSUFFICIENT_EVIDENCE").length,
      totalPrimarySearchDemand: sumDemand(primary),
      totalSupportingSearchDemand: sumDemand([...support, ...authority]),
    },
  };
}
