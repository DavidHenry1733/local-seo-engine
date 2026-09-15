/**
 * Growth Engine — Growth Intelligence V1 opportunity model.
 */
export const GROWTH_OPPORTUNITY_VERSION = 1;

export type OpportunityEvidenceSource =
  | "Google Places"
  | "Business Profile"
  | "Generated Content"
  | "Search Console"
  | "Website Analysis"
  | "Manual";

export type OpportunityPriority = "high" | "medium" | "low";
export type OpportunityConfidence = "high" | "medium" | "low";

export type OpportunityCategory =
  | "google-reviews"
  | "photos"
  | "categories"
  | "missing-services"
  | "website-content"
  | "local-visibility"
  | "content-coverage"
  | "pharmacy-services"
  | "search-console";

export const OPPORTUNITY_CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  "google-reviews": "Google Reviews",
  photos: "Photos",
  categories: "Categories",
  "missing-services": "Missing Services",
  "website-content": "Website Content",
  "local-visibility": "Local Visibility",
  "content-coverage": "Content Coverage",
  "pharmacy-services": "Pharmacy Services",
  "search-console": "Search Console",
};

export interface GrowthOpportunity {
  id: string;
  title: string;
  category: OpportunityCategory;
  priority: OpportunityPriority;
  evidenceSource: OpportunityEvidenceSource;
  evidenceSummary: string;
  whyItMatters: string;
  currentValue: string;
  comparisonValue: string;
  recommendedAction: string;
  expectedBenefit: string;
  confidence: OpportunityConfidence;
  futureStatus: string | null;
  serviceId?: string;
  sortScore: number;
}

export interface GrowthOpportunityOverview {
  total: number;
  high: number;
  medium: number;
  low: number;
}

export interface GrowthOpportunityRoadmap {
  high: GrowthOpportunity[];
  medium: GrowthOpportunity[];
  later: GrowthOpportunity[];
}

export interface GrowthReadyToBuild {
  recommendedCampaign: string;
  reason: string;
  estimatedEcosystem: string;
  estimatedTime: string;
  primaryServiceId: string;
  primaryServiceName: string;
  planUrl: string;
}

export interface WebsiteAnalysisPlaceholder {
  label: string;
  note: string;
}

export interface GrowthOpportunityReport {
  version: typeof GROWTH_OPPORTUNITY_VERSION;
  slug: string;
  generatedAt: string;
  overview: GrowthOpportunityOverview;
  opportunities: GrowthOpportunity[];
  missingContent: GrowthOpportunity[];
  localVisibility: GrowthOpportunity[];
  roadmap: GrowthOpportunityRoadmap;
  readyToBuild: GrowthReadyToBuild;
  websiteAnalysisPlaceholders: WebsiteAnalysisPlaceholder[];
  dataSources: OpportunityEvidenceSource[];
  /** Pharmacy-wide service opportunity matrix from stored demand, website, organic and content evidence. */
  serviceOpportunityAssessment?: import("./growthEngineServiceOpportunityEvidence.ts").PharmacyWideServiceOpportunityAssessment;
}

const PRIORITY_WEIGHT: Record<OpportunityPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function opportunityCategoryLabel(category: OpportunityCategory): string {
  return OPPORTUNITY_CATEGORY_LABELS[category] || category;
}

export function normalizeGrowthOpportunity(raw: Partial<GrowthOpportunity>): GrowthOpportunity | null {
  const id = String(raw.id || "").trim();
  const title = String(raw.title || "").trim();
  const category = raw.category as OpportunityCategory;
  if (!id || !title || !category || !OPPORTUNITY_CATEGORY_LABELS[category]) return null;

  const priority = (["high", "medium", "low"] as const).includes(raw.priority as OpportunityPriority)
    ? (raw.priority as OpportunityPriority)
    : "medium";
  const confidence = (["high", "medium", "low"] as const).includes(raw.confidence as OpportunityConfidence)
    ? (raw.confidence as OpportunityConfidence)
    : "medium";
  const sources: OpportunityEvidenceSource[] = [
    "Google Places",
    "Business Profile",
    "Generated Content",
    "Search Console",
    "Website Analysis",
    "Manual",
  ];
  const evidenceSource = sources.includes(raw.evidenceSource as OpportunityEvidenceSource)
    ? (raw.evidenceSource as OpportunityEvidenceSource)
    : "Business Profile";

  return {
    id,
    title,
    category,
    priority,
    evidenceSource,
    evidenceSummary: String(raw.evidenceSummary || ""),
    whyItMatters: String(raw.whyItMatters || ""),
    currentValue: String(raw.currentValue ?? "—"),
    comparisonValue: String(raw.comparisonValue ?? "—"),
    recommendedAction: String(raw.recommendedAction || ""),
    expectedBenefit: String(raw.expectedBenefit || ""),
    confidence,
    futureStatus: raw.futureStatus != null ? String(raw.futureStatus) : null,
    serviceId: raw.serviceId ? String(raw.serviceId) : undefined,
    sortScore: Number(raw.sortScore) || PRIORITY_WEIGHT[priority] * 100,
  };
}

export function dedupeOpportunities(opportunities: GrowthOpportunity[]): GrowthOpportunity[] {
  const seen = new Set<string>();
  const out: GrowthOpportunity[] = [];
  for (const opp of opportunities) {
    if (seen.has(opp.id)) continue;
    seen.add(opp.id);
    out.push(opp);
  }
  return out;
}

export function sortOpportunities(opportunities: GrowthOpportunity[]): GrowthOpportunity[] {
  return [...opportunities].sort(
    (a, b) =>
      PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] ||
      b.sortScore - a.sortScore ||
      a.title.localeCompare(b.title),
  );
}

export function buildOpportunityOverview(opportunities: GrowthOpportunity[]): GrowthOpportunityOverview {
  return {
    total: opportunities.length,
    high: opportunities.filter((o) => o.priority === "high").length,
    medium: opportunities.filter((o) => o.priority === "medium").length,
    low: opportunities.filter((o) => o.priority === "low").length,
  };
}

export function buildOpportunityRoadmap(opportunities: GrowthOpportunity[]): GrowthOpportunityRoadmap {
  const sorted = sortOpportunities(opportunities);
  return {
    high: sorted.filter((o) => o.priority === "high"),
    medium: sorted.filter((o) => o.priority === "medium"),
    later: sorted.filter((o) => o.priority === "low"),
  };
}

export function parseComparisonNumber(value: string): number | null {
  const cleaned = String(value || "")
    .replace(/,/g, "")
    .trim();
  if (!cleaned || cleaned === "—" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
