/**
 * Master Admin — unified Commercial Intelligence Dashboard (display/orchestration only).
 */
import { loadCompetitorIntelligence } from "./pharmacyCompetitorIntelligence.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { loadGrowthOpportunityReport } from "./growthEngineOpportunityEngine.ts";
import { OPPORTUNITY_CATEGORY_LABELS, type GrowthOpportunity } from "./growthEngineOpportunityModel.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import {
  localityUnavailableLabel,
  resolveTenantLocality,
  textContainsForeignLocality,
  type TenantLocalityResolution,
} from "./masterAdminPrimaryLocalityService.ts";
import { loadContentPackage, type ContentPackageAsset } from "./pharmacyContentPackageService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { resolveGoogleProfileOnboardingState } from "./masterAdminGoogleProfileOnboardingService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { listMasterAdminIssueSummaries } from "./masterAdminIssueService.ts";
import { listMasterAdminJobs } from "./masterAdminJobService.ts";
import { getWorkflowHistory, getWorkflowExecutions } from "./masterAdminWorkflowHistoryService.ts";
import { buildBrookGoldenDemoIntelligenceDashboard } from "./brookPharmacyGoldenDemoV1.ts";
import {
  isCommercialIntelligenceApproved,
  isCommercialIntelligenceGenerated,
  isCommercialIntelligenceReadyForReview,
  isLocalMarketIntelligenceGenerated,
  isGrowthIntelligenceGenerated,
  findActiveCommercialIntelligenceJob,
  ensureCommercialIntelligenceDerivedFromStoredCompetitors,
} from "./masterAdminCommercialIntelligenceWorkflowService.ts";
import {
  buildGoogleLocalProfileMetrics,
  googleLocalArtifactConfidence,
  loadCanonicalGoogleLocalCompetitorArtifact,
} from "./googleLocalCompetitorMetricsService.ts";
import { readCommercialIntelligenceApproval } from "./masterAdminWorkflowAckService.ts";
import {
  isAuthorisedEcosystemQualityReviewReady,
  readHistoricalEcosystemPackage,
} from "./masterAdminAuthorisedEcosystemGenerationService.ts";
import { isLegacyAutoAdvance, legacyAutoAdvanceLabel } from "./masterAdminWorkflowLegacyService.ts";
import { WORKFLOW_STAGE_DEFINITIONS, type WorkflowStageId } from "./masterAdminWorkflowModel.ts";
import { resolveClinicalMissingServicePages } from "./growthEngineWebsiteDiscoveredServiceReconciliation.ts";
import {
  buildNationalGrowthPlatformDashboard,
} from "./nationalGrowthPlatformDashboardService.ts";
import { isDataForSeoConfigured } from "./dataForSeoNationalSearchAdapter.ts";
import {
  readOrganicSearchRun,
} from "./competitorAnalysisOrganicSearchService.ts";
import { isCombinedCompetitorAnalysisStored, isReliableGoogleLocalAnalysis } from "./pharmacyCompetitorIntelligenceService.ts";
import { hasGooglePlacesApiKey } from "./googlePlacesConnection.ts";
import type { CompetitorAnalysisProviderStatus } from "./nationalCompetitorDiscoveryModel.ts";
import { isCoreProductRecoveryMode } from "./masterAdminCoreProductRecoveryService.ts";
import { isBusinessProfileReviewApproved } from "./masterAdminBusinessProfileReviewService.ts";
import {
  ORGANIC_SEARCH_EVIDENCE_HEADING,
  classifyOrganicSearchEvidence,
  type ClassifiedOrganicSearchEvidenceRow,
  type VerifiedGoogleCompetitorWebsite,
} from "./organicSearchEvidenceClassification.ts";

export interface CommercialDashboardSection {
  title: string;
  narrative?: string;
  items: string[];
  evidence?: SectionEvidence;
}

export interface SectionEvidence {
  evidenceSource: string;
  capturedAt: string | null;
  confidence: string;
  dataFreshness: string;
}

export interface CommercialGoogleMetric {
  id: string;
  label: string;
  yourPharmacy: string;
  localAverage: string;
  highestCompetitor: string;
  gap: string;
  recommendedTarget: string;
  opportunity: string;
  sampleSize: number;
  sampleSizeLabel: string;
}

export interface CommercialCompetitorSummaryLine {
  label: string;
  statement: string;
}

export interface CommercialTrafficKeyword {
  keyword: string;
  provenance: string;
  searchDemand: string;
}

const SEARCH_DEMAND_UNAVAILABLE =
  "Search demand not yet available. Keyword research can be completed using connected keyword intelligence.";

export interface CommercialDashboardCompetitorRow {
  name: string;
  rating: string;
  reviews: string;
  distance: string;
  categories: string;
  services: string;
  website: string;
  maps: string;
  evidence: string;
  confidence: string;
  address: string;
  placeId: string;
  phone: string;
  photoCount: string;
  openingStatus: string;
  capturedAt: string;
}

export interface CommercialDashboardCompetitorAnalysis {
  generated: boolean;
  narrative: string;
  competitors: CommercialDashboardCompetitorRow[];
  strongestCompetitor: string;
  averageRating: string;
  averageReviewCount: string;
  serviceOverlap: string;
  serviceGaps: string;
  evidenceTimestamp: string | null;
  confidence: string;
  discoverySource: string;
  discoveryCentre: string;
  summary: CommercialCompetitorSummaryLine[];
  evidence: SectionEvidence;
}

export interface CommercialIntelligenceDashboard {
  nationalGrowthPlatform?: ReturnType<typeof buildNationalGrowthPlatformDashboard> | null;

  slug: string;
  pharmacyName: string;
  status: "pending_generation" | "ready_for_review" | "approved";
  statusLabel: string;
  generated: boolean;
  approved: boolean;
  canApprove: boolean;
  canGenerateEcosystem: boolean;
  activeAction: "approve_intelligence" | "generate_approved_ecosystem";
  legacyAutoAdvance: boolean;
  legacyLabel: string | null;
  approval: ReturnType<typeof readCommercialIntelligenceApproval>;
  executiveSummary: {
    overallBusinessHealth: string;
    biggestOpportunity: string;
    biggestCommercialRisk: string;
    strongestCompetitor: string;
    biggestLocalVisibilityGap: string;
    biggestContentGap: string;
    googleBusinessProfileStatus: string;
    estimatedTrafficOpportunity: string;
    estimatedEnquiryOpportunity: string;
    confidence: string;
  };
  competitorAnalysis: CommercialDashboardCompetitorAnalysis;
  locality: TenantLocalityResolution;
  localMarketIntelligence: {
    sections: CommercialDashboardSection[];
  };
  growthIntelligence: {
    sections: CommercialDashboardSection[];
    opportunities: Array<{
      id: string;
      title: string;
      priority: string;
      impact: string;
      evidence: string;
      evidenceSource: string;
      category: string;
      serviceId: string | null;
      /** Service-linked actions vs pharmacy-wide Google-local opportunities. */
      scope: "service" | "pharmacy-wide";
    }>;
    serviceOpportunityAssessment?: import("./growthEngineServiceOpportunityEvidence.ts").PharmacyWideServiceOpportunityAssessment | null;
  };
  previouslyGenerated: {
    exists: boolean;
    completedAt: string | null;
    pages: number;
    images: number;
    blogs: number;
    guides: number;
    locationPages: number;
    faqs: number;
    productOwnerAuthorised: boolean;
    historicalAccidental: boolean;
    historicalLabel: string | null;
    historicalJobId: string | null;
  };
  blockingIssues: Array<{ title: string; detail: string }>;
  recommendations: Array<{ title: string; detail: string }>;
  historicalEvents: Array<{ title: string; detail: string; timestamp: string | null }>;
  technicalLog: Array<{ timestamp: string | null; label: string; detail: string }>;
  googleProfileMetrics: CommercialGoogleMetric[];
  competitorSummary: CommercialCompetitorSummaryLine[];
  trafficOpportunity: {
    summary: string;
    keywords: CommercialTrafficKeyword[];
    evidence: SectionEvidence;
  };
  analysisProviders: Array<{
    id: string;
    label: string;
    family: "google_local" | "dataforseo_organic";
    configured: boolean;
    generated: boolean;
    status: CompetitorAnalysisProviderStatus | "configured";
    statusLabel: string;
    source: string;
    capturedAt: string | null;
    error: string | null;
  }>;
  organicSearchCompetitors: {
    generated: boolean;
    provider: string;
    status: CompetitorAnalysisProviderStatus | "configured";
    statusLabel: string;
    error: string | null;
    locationName: string | null;
    languageCode: string | null;
    competitors: Array<{
      name: string;
      domain: string;
      host: string;
      url: string;
      position: number | null;
      matchedQuery: string;
      title: string;
      description: string;
      evidence: string;
      source: string;
      capturedAt: string | null;
      taskId: string | null;
    }>;
    capturedAt: string | null;
  };
  organicSearchEvidence: {
    heading: typeof ORGANIC_SEARCH_EVIDENCE_HEADING;
    generated: boolean;
    provider: string;
    status: CompetitorAnalysisProviderStatus | "configured";
    statusLabel: string;
    error: string | null;
    locationName: string | null;
    languageCode: string | null;
    capturedAt: string | null;
    yourPharmacy: ClassifiedOrganicSearchEvidenceRow[];
    verifiedLocalCompetitorMatches: ClassifiedOrganicSearchEvidenceRow[];
    widerOrganicLandscape: ClassifiedOrganicSearchEvidenceRow[];
    rows: ClassifiedOrganicSearchEvidenceRow[];
  };
  combinedCompetitorAnalysisStatus: "completed" | "partial" | "failed" | "pending";
  staleCompletion: {
    flagged: boolean;
    message: string | null;
  };
  canGenerateCompetitorAnalysis: boolean;
  activeCompetitorAnalysisJobId: string | null;
  sectionEvidence: {
    executiveSummary: SectionEvidence;
    googleProfileMetrics: SectionEvidence;
    competitorAnalysis: SectionEvidence;
    localMarketIntelligence: SectionEvidence;
    growthIntelligence: SectionEvidence;
    trafficOpportunity: SectionEvidence;
  };
}

function ownerGoogleStatus(profile: ReturnType<typeof readSetupProfile>): string {
  const state = resolveGoogleProfileOnboardingState(profile);
  if (state === "no_profile") return "No Google Business Profile connected yet — local map visibility may be limited.";
  if (state === "deferred") return "Google profile setup deferred — website and business profile evidence used instead.";
  if (profile.googleImportSnapshot?.importedAt) return "Google Business Profile connected and imported.";
  return "Google Business Profile linked — review recommended before publishing.";
}

function websiteImportSummary(profile: ReturnType<typeof readSetupProfile>) {
  const snap = profile.websiteImportSnapshot as {
    customerSummary?: { alreadyHas?: string[]; missing?: string[]; competitorNote?: string };
    contentCoverage?: {
      missingServicePages?: string[];
      overallCompletenessPercent?: number;
      summaryLines?: string[];
    };
    intelligence?: {
      seoSnapshot?: {
        missingServicePages?: string[];
        overallCompletenessPercent?: number;
        summaryLines?: string[];
      };
      customerSummary?: { alreadyHas?: string[]; missing?: string[]; competitorNote?: string };
      businessClassification?: { clinicalServiceDetectionEnabled?: boolean };
    };
    evidence?: Array<{ sourceUrl?: string; confidence?: number; detectionMethod?: string }>;
  } | null;
  if (!snap) return snap;
  const clinicalEnabled = snap.intelligence?.businessClassification?.clinicalServiceDetectionEnabled === true;
  const rawMissing =
    snap.contentCoverage?.missingServicePages ||
    snap.intelligence?.seoSnapshot?.missingServicePages ||
    [];
  const gatedMissing = resolveClinicalMissingServicePages({
    clinicalServiceDetectionEnabled: clinicalEnabled,
    detectedClinicalServiceIds: [],
  });
  // When clinical dictionaries are inactive, never surface stored clinical gap residue.
  const missingServicePages = clinicalEnabled ? rawMissing : gatedMissing;
  return {
    ...snap,
    customerSummary: snap.customerSummary || snap.intelligence?.customerSummary,
    contentCoverage: {
      ...(snap.contentCoverage || {}),
      missingServicePages,
      overallCompletenessPercent:
        snap.contentCoverage?.overallCompletenessPercent ??
        snap.intelligence?.seoSnapshot?.overallCompletenessPercent,
      summaryLines: snap.contentCoverage?.summaryLines || snap.intelligence?.seoSnapshot?.summaryLines,
    },
  };
}

function countAssets(assets: ContentPackageAsset[], ...types: string[]): number {
  return assets.filter((a) => types.includes(a.type) || types.some((t) => a.type.includes(t))).length;
}

function formatOpportunity(o: GrowthOpportunity): string {
  return `${o.title} — ${o.whyItMatters}`;
}

function stageLabel(stageId: string): string {
  const def = WORKFLOW_STAGE_DEFINITIONS[stageId as WorkflowStageId];
  return def?.label || stageId.replace(/_/g, " ");
}

function notAvailable(): string {
  return "Not Available";
}

function dataFreshnessLabel(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const ageMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "Unknown";
  const hours = Math.round(ageMs / 3_600_000);
  if (hours < 24) return `${hours}h old`;
  return `${Math.round(hours / 24)}d old`;
}

function buildSectionEvidence(input: {
  evidenceSource: string;
  capturedAt: string | null;
  confidence: string;
}): SectionEvidence {
  return {
    evidenceSource: input.evidenceSource,
    capturedAt: input.capturedAt,
    confidence: input.confidence,
    dataFreshness: dataFreshnessLabel(input.capturedAt),
  };
}

type CompetitorPoolRow = {
  name: string;
  rating: number | null;
  reviewCount: number;
  photoCount: number;
  categoryCount: number;
  serviceCount: number;
  website: string;
};

function loadCompetitorPool(slug: string): { rows: CompetitorPoolRow[]; source: string; capturedAt: string | null } {
  const intel = loadCompetitorIntelligence(slug);
  if (intel?.competitors.length) {
    return {
      source: intel.source,
      capturedAt: intel.generatedAt,
      rows: intel.competitors.map((c) => ({
        name: c.name,
        rating: c.gbpRating ?? null,
        reviewCount: c.gbpReviewCount ?? 0,
        photoCount: typeof c.photoCount === "number" && c.photoCount > 0 ? c.photoCount : 0,
        categoryCount: (c.categories || []).length,
        serviceCount: (c.services || []).length,
        website: c.website || "",
      })),
    };
  }
  const snap = loadCompetitorSnapshot(slug);
  if (snap?.competitors.length) {
    return {
      source: snap.source,
      capturedAt: snap.generatedAt,
      rows: snap.competitors.map((c) => ({
        name: c.businessName,
        rating: c.rating,
        reviewCount: c.reviewCount,
        photoCount: c.photoCount,
        categoryCount: 1 + (c.secondaryCategories || []).length,
        serviceCount: (c.attributes || []).length + (c.website ? 1 : 0),
        website: c.website || "",
      })),
    };
  }
  return { rows: [], source: "Unknown", capturedAt: null };
}

function buildMeasuredCompetitorSummary(slug: string): CommercialCompetitorSummaryLine[] {
  const { rows, source, capturedAt } = loadCompetitorPool(slug);
  if (!rows.length) {
    return [{ label: "Competitor evidence", statement: "Competitor Analysis not yet generated." }];
  }

  const lines: CommercialCompetitorSummaryLine[] = [];
  const topRating = [...rows].filter((r) => r.rating != null).sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
  const topReviews = [...rows].sort((a, b) => b.reviewCount - a.reviewCount)[0];
  const topPhotos = [...rows].sort((a, b) => b.photoCount - a.photoCount)[0];
  const topCategories = [...rows].sort((a, b) => b.categoryCount - a.categoryCount)[0];
  const topServices = [...rows].sort((a, b) => b.serviceCount - a.serviceCount)[0];

  if (topRating) {
    lines.push({
      label: "Highest rated competitor",
      statement: `${topRating.name} — ${topRating.rating?.toFixed(1)}★ (${source}${capturedAt ? ` · ${capturedAt}` : ""})`,
    });
  }
  if (topReviews) {
    lines.push({
      label: "Most reviewed competitor",
      statement: `${topReviews.name} — ${topReviews.reviewCount} Google reviews (${source})`,
    });
  }
  if (topPhotos && topPhotos.photoCount > 0) {
    lines.push({
      label: "Best photo coverage",
      statement: `${topPhotos.name} — ${topPhotos.photoCount} Google photos (${source})`,
    });
  } else {
    lines.push({
      label: "Best photo coverage",
      statement: `Photo counts not available for all competitors — ${notAvailable()} (${source})`,
    });
  }
  if (topCategories && topCategories.categoryCount > 0) {
    lines.push({
      label: "Largest category coverage",
      statement: `${topCategories.name} — ${topCategories.categoryCount} categories (${source})`,
    });
  } else {
    lines.push({
      label: "Largest category coverage",
      statement: `Category coverage not available — ${notAvailable()} (${source})`,
    });
  }
  if (topServices && topServices.serviceCount > 0) {
    lines.push({
      label: "Service coverage leader",
      statement: `${topServices.name} — ${topServices.serviceCount} detected service signals${topServices.website ? " · website listed" : ""} (${source})`,
    });
  } else {
    lines.push({
      label: "Service coverage leader",
      statement: `Competitor clinical services are not available from Google Places — ${notAvailable()} (${source})`,
    });
  }

  return lines;
}

function buildTrafficOpportunitySection(
  slug: string,
  locality: TenantLocalityResolution,
  visibility: ReturnType<typeof readPharmacyVisibilityReport>,
): CommercialIntelligenceDashboard["trafficOpportunity"] {
  const keywordOpps = filterLocalityKeywords(visibility?.topKeywordOpportunities || [], locality);
  const evidence = buildSectionEvidence({
    evidenceSource: visibility ? "Pharmacy Visibility Bridge" : "Unknown",
    capturedAt: visibility?.lastCheckedAt || null,
    confidence: visibility ? "Medium" : "Unknown",
  });

  if (!keywordOpps.length) {
    return { summary: SEARCH_DEMAND_UNAVAILABLE, keywords: [], evidence };
  }

  return {
    summary: SEARCH_DEMAND_UNAVAILABLE,
    keywords: keywordOpps.map((k) => ({
      keyword: k.keyword,
      provenance: `Pharmacy Visibility Bridge · ${k.serviceId} · ${visibility?.lastCheckedAt || "Unknown"}`,
      searchDemand: SEARCH_DEMAND_UNAVAILABLE,
    })),
    evidence,
  };
}

function ciEvidenceFooter(evidence: SectionEvidence | undefined): string[] {
  if (!evidence) return [];
  return [
    `Evidence Source: ${evidence.evidenceSource}`,
    `Captured At: ${evidence.capturedAt || "Unknown"}`,
    `Confidence: ${evidence.confidence}`,
    `Data Freshness: ${evidence.dataFreshness}`,
  ];
}

function na(value: unknown): string {
  if (value == null || value === "" || value === 0) return "Not available";
  return String(value);
}

function mapIntelCompetitor(
  c: ReturnType<typeof loadCompetitorIntelligence> extends infer T
    ? T extends { competitors: (infer R)[] }
      ? R
      : never
    : never,
  intel: NonNullable<ReturnType<typeof loadCompetitorIntelligence>>,
): CommercialDashboardCompetitorRow {
  const rating = c.gbpRating ?? (c as { rating?: number | null }).rating;
  const reviews = c.gbpReviewCount ?? (c as { reviewCount?: number }).reviewCount;
  const mapsUrl =
    (c as { mapsUrl?: string }).mapsUrl ||
    (c.placeId ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(c.placeId)}` : "");
  const photoCount = typeof c.photoCount === "number" ? c.photoCount : null;
  return {
    name: c.name || "Not available",
    rating: rating != null ? `${rating}★` : "Not available",
    reviews: reviews != null ? String(reviews) : "Not available",
    distance: c.distanceLabel || (c.distanceKm != null ? `${c.distanceKm} km` : "Not available"),
    categories: (c.categories || []).slice(0, 4).join(", ") || "Not available",
    services: (c.services || []).slice(0, 6).join(", ") || "Not available",
    website: c.website || "Not available",
    maps: mapsUrl || "Not available",
    evidence: c.source || intel.source || "Google Places",
    confidence: c.source === "google-places" ? "High" : "Medium",
    address: c.address || "Not available",
    placeId: c.placeId || "Not available",
    phone: c.phone || "Not available",
    photoCount: photoCount != null ? String(photoCount) : "Not available",
    openingStatus: c.openingHours?.openNow != null ? (c.openingHours.openNow ? "Open now" : "Closed now") : "Not available",
    capturedAt: intel.generatedAt || "Not available",
  };
}

function mapSnapshotCompetitor(c: ReturnType<typeof loadCompetitorSnapshot> extends infer T
  ? T extends { competitors: (infer R)[] }
    ? R
    : never
  : never, snap: NonNullable<ReturnType<typeof loadCompetitorSnapshot>>): CommercialDashboardCompetitorRow {
  return {
    name: c.businessName || "Not available",
    rating: c.rating != null ? `${c.rating}★` : "Not available",
    reviews: c.reviewCount != null ? String(c.reviewCount) : "Not available",
    distance: c.distanceLabel || (c.distanceKm != null ? `${c.distanceKm} km` : "Not available"),
    categories: [c.primaryCategory, ...(c.secondaryCategories || [])].filter(Boolean).slice(0, 4).join(", ") || "Not available",
    services: (c.services || []).slice(0, 6).join(", ") || "Not available",
    website: c.website || "Not available",
    maps: c.googleMapsUrl || c.directionsUrl || "Not available",
    evidence: c.source || snap.source || "Google Places",
    confidence: snap.source === "google-places-live" ? "High" : "Medium",
    address: c.address || "Not available",
    placeId: c.placeId || "Not available",
    phone: c.phone || "Not available",
    photoCount: c.photoCount != null ? String(c.photoCount) : "Not available",
    openingStatus: c.openingStatus || "Not available",
    capturedAt: snap.generatedAt || "Not available",
  };
}

function buildCompetitorAnalysis(
  slug: string,
  locality: TenantLocalityResolution,
): CommercialDashboardCompetitorAnalysis {
  const empty: CommercialDashboardCompetitorAnalysis = {
    generated: false,
    narrative: "",
    competitors: [],
    strongestCompetitor: "Not available",
    averageRating: "Not available",
    averageReviewCount: "Not available",
    serviceOverlap: "Not available",
    serviceGaps: "Not available",
    evidenceTimestamp: null,
    confidence: "Not available",
    discoverySource: "Not available",
    discoveryCentre: locality.available ? locality.value || "Not available" : localityUnavailableLabel(),
    summary: [{ label: "Competitor evidence", statement: "Competitor Analysis not yet generated." }],
    evidence: buildSectionEvidence({ evidenceSource: "Unknown", capturedAt: null, confidence: "Unknown" }),
  };

  const artifact = loadCanonicalGoogleLocalCompetitorArtifact(slug);
  if (artifact?.kind === "intelligence") {
    const intel = artifact.intel;
    const rows = intel.competitors.slice(0, 12).map((c) => mapIntelCompetitor(c, intel));
    const top = [...intel.competitors].sort((a, b) => (b.gbpReviewCount || 0) - (a.gbpReviewCount || 0))[0];
    const ratings = intel.competitors.map((c) => c.gbpRating).filter((r): r is number => r != null);
    const reviews = intel.competitors.map((c) => c.gbpReviewCount).filter((r): r is number => typeof r === "number" && r > 0);
    const summary = buildMeasuredCompetitorSummary(slug);
    const topByReviews = summary.find((s) => s.label === "Most reviewed competitor");
    return {
      generated: true,
      narrative: topByReviews?.statement || "",
      competitors: rows,
      strongestCompetitor: top?.name || "Not available",
      averageRating:
        ratings.length > 0
          ? `${Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10}★`
          : "Not available",
      averageReviewCount:
        reviews.length > 0 ? String(Math.round(reviews.reduce((a, b) => a + b, 0) / reviews.length)) : "Not available",
      serviceOverlap: na(intel.competitorSummary?.withWebsite),
      serviceGaps: "See Local Market Intelligence gap analysis",
      evidenceTimestamp: intel.generatedAt,
      confidence: intel.source.includes("google") ? "High" : "Medium",
      discoverySource: intel.source,
      discoveryCentre: intel.pharmacy?.address || locality.provenanceLabel,
      summary,
      evidence: buildSectionEvidence({
        evidenceSource: intel.source,
        capturedAt: intel.generatedAt,
        confidence: intel.source.includes("google") ? "High" : "Medium",
      }),
    };
  }

  if (artifact?.kind === "snapshot") {
    const snap = artifact.snap;
    const rows = snap.competitors.slice(0, 12).map((c) => mapSnapshotCompetitor(c, snap));
    const top = snap.competitors[0];
    const ratings = snap.competitors.map((c) => c.rating).filter((r): r is number => r != null);
    const reviews = snap.competitors.map((c) => c.reviewCount).filter((r) => r > 0);
    const summary = buildMeasuredCompetitorSummary(slug);
    const topByReviews = summary.find((s) => s.label === "Most reviewed competitor");
    return {
      generated: true,
      narrative: topByReviews?.statement || "",
      competitors: rows,
      strongestCompetitor: top?.businessName || "Not available",
      averageRating:
        ratings.length > 0
          ? `${Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10}★`
          : "Not available",
      averageReviewCount:
        reviews.length > 0 ? String(Math.round(reviews.reduce((a, b) => a + b, 0) / reviews.length)) : "Not available",
      serviceOverlap: snap.analysis?.comparisons?.length ? `${snap.analysis.comparisons.length} comparisons captured` : "Not available",
      serviceGaps: snap.analysis?.summaryParagraphs?.[0] || "Not available",
      evidenceTimestamp: snap.generatedAt,
      confidence: "High",
      discoverySource: snap.source,
      discoveryCentre: snap.pharmacy?.address || locality.provenanceLabel,
      summary,
      evidence: buildSectionEvidence({
        evidenceSource: snap.source,
        capturedAt: snap.generatedAt,
        confidence: "High",
      }),
    };
  }

  return empty;
}

function formatLocalMarketComparisonRow(row: {
  label: string;
  yourPharmacy: string;
  competitorAverage: string;
  highestCompetitor?: string;
}): string {
  const yours =
    !row.yourPharmacy || row.yourPharmacy === "—"
      ? notAvailable()
      : row.yourPharmacy;
  const highest = row.highestCompetitor ? ` · Highest: ${row.highestCompetitor}` : "";
  return `${row.label} — Your Pharmacy: ${yours} · Local Average: ${row.competitorAverage || notAvailable()}${highest}`;
}

function buildLocalMarketSections(
  slug: string,
  profile: ReturnType<typeof readSetupProfile>,
  report: ReturnType<typeof loadGrowthOpportunityReport>,
  locality: TenantLocalityResolution,
  googleMetrics: CommercialGoogleMetric[],
  snap: ReturnType<typeof loadCompetitorSnapshot>,
): CommercialDashboardSection[] {
  const analysis = snap?.analysis;
  const visibility = readPharmacyVisibilityReport(slug);
  const web = websiteImportSummary(profile);
  const areas = (profile.selectedLocalAreas || profile.localAreas || profile.nearbyAreas || []) as Array<
    string | { areaName?: string }
  >;
  const town = locality.available ? locality.value || localityUnavailableLabel() : localityUnavailableLabel();
  const googleLocalArtifact = loadCanonicalGoogleLocalCompetitorArtifact(slug);
  const googleMetricsEvidence = buildSectionEvidence({
    evidenceSource: googleLocalArtifact?.source || "Unknown",
    capturedAt: googleLocalArtifact?.capturedAt || null,
    confidence: googleLocalArtifactConfidence(googleLocalArtifact),
  });
  const lmEvidence = buildSectionEvidence({
    evidenceSource: snap?.source || "Unknown",
    capturedAt: snap?.generatedAt || null,
    confidence: snap?.source === "google-places-live" ? "High" : "Unknown",
  });

  const googleMetricItems = googleMetrics.map(
    (m) =>
      `${m.label} — Your Pharmacy: ${m.yourPharmacy} · Local Average: ${m.localAverage} · Highest Competitor: ${m.highestCompetitor} · Gap: ${m.gap} · Target: ${m.recommendedTarget} · Sample: ${m.sampleSizeLabel || "Not Available"}`,
  );
  const gapItems = googleMetrics.map(
    (m) => `${m.label} — ${m.opportunity} (sample ${m.sampleSizeLabel || "Not Available"})`,
  );

  const coverageItems =
    analysis?.comparisons?.map((c) =>
      formatLocalMarketComparisonRow({
        label: c.label,
        yourPharmacy: c.yourPharmacy,
        competitorAverage: c.competitorAverage,
        highestCompetitor: c.highestCompetitor,
      }),
    ) ||
    (snap?.competitors.length
      ? [`${snap.competitors.length} local competitors captured from ${snap.source}`]
      : web?.contentCoverage?.summaryLines?.slice(0, 4) || [`Website completeness estimated at ${web?.contentCoverage?.overallCompletenessPercent ?? "Unknown"}%`]);

  return [
    {
      title: "Google Profile Metrics",
      narrative:
        resolveGoogleProfileOnboardingState(profile) === "no_profile"
          ? "No Google Business Profile is connected — your pharmacy metrics are recorded as zero. Competitor benchmarks are from live Google Places evidence."
          : "Google Business Profile metrics compared with nearby pharmacy benchmarks from live Google Places evidence.",
      items: googleMetricItems,
      evidence: googleMetricsEvidence,
    },
    {
      title: "Gap Analysis",
      narrative: "Commercial gaps measured against local competitor averages and highest nearby performers.",
      items: gapItems,
      evidence: googleMetricsEvidence,
    },
    buildLocalMarketComparisonSection(snap),
    {
      title: "Market Summary",
      narrative: locality.available
        ? `Patients searching for pharmacy services in ${town} compare websites, reviews and service coverage before choosing where to book.`
        : localityUnavailableLabel(),
      items: analysis?.summaryParagraphs || web?.contentCoverage?.summaryLines || visibility?.recommendedActions?.slice(0, 3) || ["Local market evidence available from website and visibility analysis."],
    },
    {
      title: "Coverage",
      items: coverageItems,
    },
    {
      title: "Coverage Gaps",
      narrative: "These gaps matter because patients often choose the pharmacy that clearly explains the service they need.",
      items: web?.customerSummary?.missing?.slice(0, 6) || (web?.contentCoverage?.missingServicePages || []).slice(0, 6).map((s) => `Missing dedicated page for ${s}`) || ["Service page coverage can be expanded after ecosystem generation."],
    },
    {
      title: "Missing Areas",
      items: localMarketMissingAreaItems(visibility, analysis),
    },
    {
      title: "Recommended Locations",
      narrative: "Location pages help you appear when patients search by neighbourhood — not just by pharmacy name.",
      items: localMarketRecommendedLocationItems(areas, Boolean(analysis)),
    },
    {
      title: "Local Visibility Comparison",
      items: visibility?.services?.slice(0, 4).map((s) => `${s.primaryKeyword}: ${s.visibilityStatus.replace(/_/g, " ")}`) || [`Visibility score: ${visibility?.estimatedVisibilityScore ?? "Unknown"}/100`],
    },
  ].map((section) => ({ ...section, evidence: section.evidence || lmEvidence }));
}

function localMarketMissingAreaItems(
  visibility: ReturnType<typeof readPharmacyVisibilityReport>,
  analysis: { opportunities?: string[] } | null | undefined,
): string[] {
  const visibilityItems =
    visibility?.topKeywordOpportunities?.slice(0, 5).map((k) => `${k.keyword} — ${k.opportunity}`) || [];
  const stalePlaceholder = visibilityItems.length > 0 && visibilityItems.every((item) => /not yet analysed/i.test(item));
  if (analysis && (stalePlaceholder || visibilityItems.length === 0)) {
    if (analysis.opportunities?.length) return analysis.opportunities;
    return ["Keyword demand is unavailable. Stored competitor evidence does not include search-volume data."];
  }
  return visibilityItems.length
    ? visibilityItems
    : ["Local keyword opportunities will expand once pages are indexed."];
}

function localMarketRecommendedLocationItems(
  areas: Array<string | { areaName?: string }>,
  localMarketReady: boolean,
): string[] {
  const names = areas
    .map((area) => String(typeof area === "object" && area && "areaName" in area ? area.areaName : area).trim())
    .filter(Boolean);
  if (names.length) return names.slice(0, 8);
  if (localMarketReady) {
    return ["No local areas are selected. Location recommendations stay unavailable until areas are chosen."];
  }
  return ["Confirm local areas during ecosystem setup."];
}

function buildLocalMarketComparisonSection(
  snap: ReturnType<typeof loadCompetitorSnapshot>,
): CommercialDashboardSection {
  const rows = snap?.analysis?.comparisons?.filter((c) => c.hasData) || [];
  return {
    title: "Local Market Comparison",
    narrative: "Side-by-side comparison of your pharmacy against local competitor benchmarks.",
    items: rows.length
      ? rows.map((r) =>
          formatLocalMarketComparisonRow({
            label: r.label,
            yourPharmacy: r.yourPharmacy,
            competitorAverage: r.competitorAverage,
            highestCompetitor: r.highestCompetitor,
          }),
        )
      : ["Local market comparison pending — run Local Market Intelligence discovery."],
  };
}

function buildGrowthSections(
  report: ReturnType<typeof loadGrowthOpportunityReport>,
  capturedAt: string | null,
): CommercialDashboardSection[] {
  const giEvidence = buildSectionEvidence({
    evidenceSource: report ? "Growth Opportunity Engine" : "Unknown",
    capturedAt: report?.generatedAt || capturedAt,
    confidence: report ? "Medium" : "Unknown",
  });

  if (!report) {
    return [
      {
        title: "Growth Intelligence",
        items: ["Growth Intelligence report pending — continue workflow to generate."],
        evidence: giEvidence,
      },
    ];
  }

  const assessment = report.serviceOpportunityAssessment;
  const topFive = assessment?.topPriorityServices || [];

  return [
    {
      title: "Service Opportunity Matrix",
      narrative: assessment
        ? `${assessment.confirmedServiceCount} confirmed services assessed from stored demand, website import, organic SERP and content packages.`
        : "Service opportunity matrix pending.",
      items: assessment
        ? assessment.services.slice(0, 5).map(
            (row) =>
              `${row.serviceName}: ${row.opportunityClassification.replace(/-/g, " ")} — ${row.priorityRationale}`,
          )
        : ["Service opportunity assessment not available."],
      evidence: giEvidence,
    },
    {
      title: "Top Priority Services",
      narrative: "First five services ranked by website coverage, organic visibility, then demand (highest query, pharmacy-intent, near-me).",
      items: topFive.length
        ? topFive.map(
            (row) =>
              `${row.serviceName}: ${row.priorityRationale}. Website: ${row.websiteEvidence}. Demand: ${row.demandEvidence}. Organic: ${row.organicVisibility}. Package: ${row.packageStatus}. Next: ${row.recommendedAction}`,
          )
        : ["No priority services ranked yet."],
      evidence: giEvidence,
    },
    {
      title: "Google Profile Actions",
      items: (assessment?.googleProfileActions || report.opportunities.filter((o) => !o.serviceId))
        .slice(0, 5)
        .map((o) => `${o.title} (${o.evidenceSource}: ${o.evidenceSummary})`),
      evidence: giEvidence,
    },
    {
      title: "Evidence Limitations",
      items: assessment?.evidenceLimitations?.length
        ? assessment.evidenceLimitations
        : ["No evidence limitations recorded."],
      evidence: giEvidence,
    },
  ];
}

function filterLocalityKeywords(
  keywords: Array<{ keyword: string; serviceId: string; opportunity: string; estimatedPosition: number | null }>,
  locality: TenantLocalityResolution,
): typeof keywords {
  if (!locality.available || !locality.value) return [];
  return keywords.filter((k) => !textContainsForeignLocality(k.keyword, locality.value!));
}

function buildExecutiveSummary(
  slug: string,
  profile: ReturnType<typeof readSetupProfile>,
  report: ReturnType<typeof loadGrowthOpportunityReport>,
  competitor: CommercialDashboardCompetitorAnalysis,
  locality: TenantLocalityResolution,
  traffic: CommercialIntelligenceDashboard["trafficOpportunity"],
): CommercialIntelligenceDashboard["executiveSummary"] {
  const visibility = readPharmacyVisibilityReport(slug);
  const web = websiteImportSummary(profile);
  const topOpp = report?.roadmap?.high?.[0] || report?.opportunities?.[0];
  const town = locality.available ? locality.value || localityUnavailableLabel() : localityUnavailableLabel();

  const trafficDisplay =
    traffic.keywords.length > 0
      ? traffic.keywords.map((k) => `${k.keyword} (${k.provenance})`).join("; ")
      : traffic.summary;

  return {
    overallBusinessHealth:
      !locality.available
        ? localityUnavailableLabel()
        : web?.contentCoverage?.overallCompletenessPercent != null
          ? `Your pharmacy has a working foundation in ${town}, but online completeness is around ${web.contentCoverage.overallCompletenessPercent}% — there is clear room to win more local patients.`
          : `Your pharmacy is established in ${town} with meaningful growth potential once service content and local visibility improve.`,
    biggestOpportunity: topOpp?.title || (locality.available ? `Build a Pharmacy First content ecosystem for ${town}` : localityUnavailableLabel()),
    biggestCommercialRisk:
      web?.contentCoverage?.missingServicePages?.length
        ? `${web.contentCoverage.missingServicePages.length} common pharmacy services are not yet explained on your website — patients may choose a competitor who does.`
        : "Limited service-page coverage may cause patients to choose pharmacies that explain services more clearly online.",
    strongestCompetitor: competitor.generated ? competitor.strongestCompetitor : "Not available — Competitor Analysis not yet generated",
    biggestLocalVisibilityGap:
      !locality.available
        ? localityUnavailableLabel()
        : visibility?.visibilityStatus === "needs_attention"
          ? `Local visibility needs attention — ${visibility.indexedPageCount || 0} pages indexed so far in ${town}.`
          : visibility?.competitorGap || `Patients searching by service and location in ${town} may not yet find your pharmacy first.`,
    biggestContentGap:
      web?.customerSummary?.missing?.[0] ||
      report?.missingContent?.[0]?.title ||
      "Dedicated patient guides, FAQs and service pages for your highest-demand services.",
    googleBusinessProfileStatus: ownerGoogleStatus(profile),
    estimatedTrafficOpportunity: trafficDisplay,
    estimatedEnquiryOpportunity: SEARCH_DEMAND_UNAVAILABLE,
    confidence: competitor.generated ? (competitor.confidence === "High" ? "High" : "Medium") : "Unknown",
  };
}

function classifyIssues(
  slug: string,
  ready: boolean,
  locality: TenantLocalityResolution,
  competitor: CommercialDashboardCompetitorAnalysis,
  visibility: ReturnType<typeof readPharmacyVisibilityReport>,
) {
  const openIssues = listMasterAdminIssueSummaries().filter(
    (i) => i.tenantSlug === slug && !["Closed", "Passed"].includes(i.status),
  );
  const blockingIssues = openIssues
    .filter((i) => i.severity === "Critical" || i.severity === "High")
    .map((i) => ({ title: i.title, detail: `${i.severity} · ${i.status}` }));
  const recommendations = openIssues
    .filter((i) => i.severity === "Medium" || i.severity === "Low")
    .map((i) => ({ title: i.title, detail: `${i.severity} recommendation · ${i.status}` }));

  if (!locality.available) {
    blockingIssues.push({
      title: "Tenant locality not verified",
      detail: localityUnavailableLabel(),
    });
  }

  if (locality.available && locality.value && visibility) {
    const staleKeywords = (visibility.topKeywordOpportunities || []).filter((k) =>
      textContainsForeignLocality(k.keyword, locality.value!),
    );
    if (staleKeywords.length) {
      blockingIssues.push({
        title: "Cross-tenant locality detected in visibility evidence",
        detail: `Stale keywords reference another locality — refresh Commercial Intelligence evidence (${staleKeywords[0]?.keyword}).`,
      });
    }
  }

  if (!competitor.generated || competitor.competitors.length === 0) {
    blockingIssues.push({
      title: "Competitor Analysis not yet generated",
      detail: "Generate Competitor Analysis before approval.",
    });
  }

  if (!isLocalMarketIntelligenceGenerated(slug)) {
    blockingIssues.push({
      title: "Local Market Intelligence incomplete",
      detail: "Local Market Intelligence requires competitor evidence.",
    });
  }

  for (const action of visibility?.recommendedActions?.slice(0, 4) || []) {
    if (locality.available && locality.value && !textContainsForeignLocality(action, locality.value)) {
      recommendations.push({ title: action, detail: "Visibility recommendation" });
    }
  }

  if (!ready) {
    blockingIssues.push({
      title: "Intelligence generation incomplete",
      detail: "Competitor Analysis, Local Market Intelligence and Growth Intelligence must be available before approval.",
    });
  }

  return { blockingIssues, recommendations };
}

function buildHistoricalEvents(slug: string): CommercialIntelligenceDashboard["historicalEvents"] {
  const history = getWorkflowHistory(slug).slice(0, 8);
  return history.map((h) => ({
    title: `${stageLabel(h.fromStage)} completed`,
    detail: `Advanced to ${stageLabel(h.toStage)} — ${h.reason}`,
    timestamp: h.timestamp,
  }));
}

function providerStatusLabel(status: CompetitorAnalysisProviderStatus, error?: string | null): string {
  if (status === "not_configured") return "not configured";
  if (status === "no_reliable_results") return "no reliable results";
  if (status === "failed") return error ? `failed — ${error}` : "failed";
  if (status === "partial") return error ? `partial — ${error}` : "partial";
  return status;
}

function buildOrganicSearchCompetitors(slug: string): CommercialIntelligenceDashboard["organicSearchCompetitors"] {
  const run = readOrganicSearchRun(slug);
  const configured = isDataForSeoConfigured();
  if (!run) {
    const status: CompetitorAnalysisProviderStatus = configured ? "configured" : "not_configured";
    return {
      generated: false,
      provider: "dataforseo-google-organic-live",
      status,
      statusLabel: providerStatusLabel(status),
      error: configured ? null : "DataForSEO is not configured",
      locationName: "United Kingdom",
      languageCode: "en",
      competitors: [],
      capturedAt: null,
    };
  }
  const rows = (run.competitors || []).map((c) => ({
    name: c.title || c.domain || "Not available",
    domain: c.domain || "",
    host: c.host || c.domain || "",
    url: c.url || "",
    position: c.position,
    matchedQuery: c.matchedQuery || "",
    title: c.title || "",
    description: c.description || "",
    evidence: c.overlapEvidence || "DataForSEO Google organic SERP",
    source: c.provider || "dataforseo-google-organic-live",
    capturedAt: c.capturedAt || run.capturedAt,
    taskId: c.taskId,
  }));
  const generated = run.status === "completed" && rows.length > 0;
  return {
    generated,
    provider: run.provider || "dataforseo-google-organic-live",
    status: run.status,
    statusLabel: providerStatusLabel(run.status, run.error),
    error: run.error,
    locationName: run.locationName || "United Kingdom",
    languageCode: run.languageCode || "en",
    competitors: rows,
    capturedAt: run.capturedAt,
  };
}

function verifiedGoogleWebsitesFromArtifact(
  artifact: ReturnType<typeof loadCanonicalGoogleLocalCompetitorArtifact>,
): VerifiedGoogleCompetitorWebsite[] {
  if (!artifact) return [];
  if (artifact.kind === "intelligence") {
    return artifact.intel.competitors.map((c) => ({
      name: c.name,
      website: c.website || "",
      placeId: c.placeId,
      source: c.source || artifact.source,
    }));
  }
  return artifact.snap.competitors.map((c) => ({
    name: c.businessName,
    website: c.website || "",
    placeId: c.placeId,
    source: c.source || artifact.source,
  }));
}

function buildOrganicSearchEvidence(
  slug: string,
  organic: CommercialIntelligenceDashboard["organicSearchCompetitors"],
  artifact: ReturnType<typeof loadCanonicalGoogleLocalCompetitorArtifact>,
): CommercialIntelligenceDashboard["organicSearchEvidence"] {
  const profile = readSetupProfile(slug);
  const classified = classifyOrganicSearchEvidence({
    tenantWebsiteUrls: [profile.website, profile.googleImportSnapshot?.website],
    pharmacyName: String(profile.tradingName || profile.pharmacyName || "").trim(),
    verifiedGoogleCompetitorWebsites: verifiedGoogleWebsitesFromArtifact(artifact),
    rows: organic.competitors,
  });
  return {
    heading: ORGANIC_SEARCH_EVIDENCE_HEADING,
    generated: organic.generated,
    provider: organic.provider,
    status: organic.status,
    statusLabel: organic.statusLabel,
    error: organic.error,
    locationName: organic.locationName,
    languageCode: organic.languageCode,
    capturedAt: organic.capturedAt,
    yourPharmacy: classified.yourPharmacy,
    verifiedLocalCompetitorMatches: classified.verifiedLocalCompetitorMatches,
    widerOrganicLandscape: classified.widerOrganicLandscape,
    rows: classified.rows,
  };
}

function buildGoogleProviderStatus(
  slug: string,
  localGenerated: boolean,
  localSource: string,
  localCapturedAt: string | null,
): CommercialIntelligenceDashboard["analysisProviders"][number] {
  const configured = hasGooglePlacesApiKey();
  let status: CompetitorAnalysisProviderStatus = configured ? "configured" : "not_configured";
  let error: string | null = configured ? null : "Google Places is not configured";
  if (isReliableGoogleLocalAnalysis(slug) || (localGenerated && String(localSource || "").includes("google"))) {
    status = "completed";
    error = null;
  } else if (localGenerated && !String(localSource || "").includes("google")) {
    status = "no_reliable_results";
    error = "Google/local competitor artifact is not live Google Places evidence.";
  }
  return {
    id: "google-places-local",
    label: "Google/local competitors",
    family: "google_local",
    configured,
    generated: status === "completed",
    status,
    statusLabel: providerStatusLabel(status, error),
    source: localGenerated ? localSource || "Google Places" : configured ? "Google Places (configured)" : "Google Places (not configured)",
    capturedAt: localCapturedAt,
    error,
  };
}

function buildAnalysisProviders(
  slug: string,
  localGenerated: boolean,
  localSource: string,
  localCapturedAt: string | null,
  organic: CommercialIntelligenceDashboard["organicSearchCompetitors"],
): CommercialIntelligenceDashboard["analysisProviders"] {
  return [
    buildGoogleProviderStatus(slug, localGenerated, localSource, localCapturedAt),
    {
      id: "dataforseo-google-organic-live",
      label: "DataForSEO organic-search competitors",
      family: "dataforseo_organic",
      configured: organic.status !== "not_configured" && isDataForSeoConfigured(),
      generated: organic.generated,
      status: organic.status,
      statusLabel: organic.statusLabel,
      source: organic.generated
        ? organic.provider
        : isDataForSeoConfigured()
          ? "dataforseo-google-organic-live (configured)"
          : "dataforseo-google-organic-live (not configured)",
      capturedAt: organic.capturedAt,
      error: organic.error,
    },
  ];
}

function buildStaleCompetitorCompletion(slug: string, competitorGenerated: boolean): CommercialIntelligenceDashboard["staleCompletion"] {
  const history = getWorkflowHistory(slug);
  const historySaysComplete = history.some(
    (h) => h.fromStage === "commercial_intelligence" || h.fromStage === "competitor_analysis",
  );
  const operatorMarkedComplete =
    isCommercialIntelligenceApproved(slug) ||
    (isCoreProductRecoveryMode(slug) && isBusinessProfileReviewApproved(slug));
  const flagged = !competitorGenerated && (operatorMarkedComplete || historySaysComplete);
  return {
    flagged,
    message: flagged
      ? "Workflow history marks Commercial Intelligence complete, but no valid Competitor Analysis artifact is stored. Generate Competitor Analysis to create evidence."
      : null,
  };
}

function buildTechnicalLog(slug: string, locality: TenantLocalityResolution): CommercialIntelligenceDashboard["technicalLog"] {
  const jobs = listMasterAdminJobs({ slug, limit: 8 });
  const executions = getWorkflowExecutions(slug).slice(0, 8);
  const lines: CommercialIntelligenceDashboard["technicalLog"] = [
    {
      timestamp: new Date().toISOString(),
      label: "Tenant locality provenance",
      detail: locality.provenanceLabel,
    },
  ];

  for (const j of jobs) {
    lines.push({
      timestamp: j.finishedAt || j.startedAt || j.createdAt,
      label: j.action,
      detail: `${j.status} · ${j.progressLabel || ""}`.trim(),
    });
  }
  for (const e of executions) {
    lines.push({
      timestamp: e.finishedAt || e.startedAt,
      label: `${e.stageId} / ${e.actionId}`,
      detail: `${e.status} · ${e.evidence}`,
    });
  }
  return lines.slice(0, 12);
}

export function buildCommercialIntelligenceDashboard(slug: string): CommercialIntelligenceDashboard {
  const golden = buildBrookGoldenDemoIntelligenceDashboard(slug);
  if (golden) return golden;
  const nationalGrowthPlatform = (() => {
    try {
      return buildNationalGrowthPlatformDashboard(slug);
    } catch {
      return null;
    }
  })();

  try {
    ensureCommercialIntelligenceDerivedFromStoredCompetitors(slug);
  } catch {
    /* A derivation failure leaves the missing stage visible. It must not invent completion. */
  }
  const profile = readSetupProfile(slug);
  const locality = resolveTenantLocality(profile);
  const report = loadGrowthOpportunityReport(slug);
  const ctx = loadMasterAdminCustomerContext(slug);
  const pkg = ctx ? loadContentPackage(slug, ctx.serviceId) : null;
  const assets = pkg?.assets || [];
  const visibility = readPharmacyVisibilityReport(slug);
  const snap = loadCompetitorSnapshot(slug);
  const googleLocalArtifact = loadCanonicalGoogleLocalCompetitorArtifact(slug);
  const competitor = buildCompetitorAnalysis(slug, locality);
  const organicSearchCompetitors = buildOrganicSearchCompetitors(slug);
  const organicSearchEvidence = buildOrganicSearchEvidence(slug, organicSearchCompetitors, googleLocalArtifact);
  const staleCompletion = buildStaleCompetitorCompletion(slug, Boolean(competitor.generated));
  const activeCompetitorJob = findActiveCommercialIntelligenceJob(slug, new Set(["orchestrate_competitor_analysis"]));
  const analysisProviders = buildAnalysisProviders(
    slug,
    Boolean(competitor.generated),
    competitor.discoverySource,
    competitor.evidenceTimestamp,
    organicSearchCompetitors,
  );
  const googleProvider = analysisProviders.find((p) => p.family === "google_local");
  const organicProvider = analysisProviders.find((p) => p.family === "dataforseo_organic");
  const combinedCompetitorAnalysisStatus =
    googleProvider?.status === "completed" && (organicProvider?.status === "completed" || organicProvider?.status === "not_configured")
      ? "completed"
      : googleProvider?.status === "failed" && (organicProvider?.status === "failed" || organicProvider?.status === "not_configured")
        ? "failed"
        : googleProvider?.generated || organicProvider?.generated || googleProvider?.status === "completed" || organicProvider?.status === "completed"
          ? "partial"
          : "pending";
  const googleProfileMetrics = buildGoogleLocalProfileMetrics(profile, snap, googleLocalArtifact);
  const trafficOpportunity = buildTrafficOpportunitySection(slug, locality, visibility);
  const competitorSummary = competitor.summary;
  const sectionEvidence = {
    executiveSummary: buildSectionEvidence({
      evidenceSource: "Commercial Intelligence Dashboard synthesis",
      capturedAt: new Date().toISOString(),
      confidence: competitor.generated ? competitor.confidence : "Unknown",
    }),
    googleProfileMetrics: buildSectionEvidence({
      evidenceSource: googleLocalArtifact?.source || "Unknown",
      capturedAt: googleLocalArtifact?.capturedAt || null,
      confidence: googleLocalArtifactConfidence(googleLocalArtifact),
    }),
    competitorAnalysis: competitor.evidence,
    localMarketIntelligence: buildSectionEvidence({
      evidenceSource: snap?.source || "Local Market Intelligence",
      capturedAt: snap?.generatedAt || null,
      confidence: snap?.source === "google-places-live" ? "High" : "Unknown",
    }),
    growthIntelligence: buildSectionEvidence({
      evidenceSource: "Growth Opportunity Engine",
      capturedAt: report?.generatedAt || null,
      confidence: report ? "Medium" : "Unknown",
    }),
    trafficOpportunity: trafficOpportunity.evidence,
  };
  const generated = isCommercialIntelligenceGenerated(slug);
  const ready = isCommercialIntelligenceReadyForReview(slug);
  const approved = isCommercialIntelligenceApproved(slug);
  const approval = readCommercialIntelligenceApproval(slug);
  const { blockingIssues, recommendations } = classifyIssues(slug, ready, locality, competitor, visibility);
  const evidenceComplete =
    locality.available &&
    competitor.generated &&
    competitor.competitors.length > 0 &&
    isLocalMarketIntelligenceGenerated(slug) &&
    isGrowthIntelligenceGenerated(slug) &&
    blockingIssues.every((b) => !/locality|Competitor Analysis|cross-tenant/i.test(b.title));

  let status: CommercialIntelligenceDashboard["status"] = "pending_generation";
  let statusLabel = "Intelligence generation in progress";
  if (approved) {
    status = "approved";
    statusLabel = "Commercial Intelligence approved";
  } else if (ready && evidenceComplete) {
    status = "ready_for_review";
    statusLabel = "Commercial Intelligence Ready For Review";
  }

  return {
    slug,
    pharmacyName: profile.pharmacyName || profile.tradingName || slug,
    status,
    statusLabel,
    generated,
    approved,
    canApprove: ready && evidenceComplete && !approved,
    canGenerateEcosystem: approved && !isAuthorisedEcosystemQualityReviewReady(slug),
    activeAction: approved ? "generate_approved_ecosystem" : "approve_intelligence",
    legacyAutoAdvance: isLegacyAutoAdvance(slug),
    legacyLabel: legacyAutoAdvanceLabel(slug),
    approval,
    nationalGrowthPlatform,
    locality,
    executiveSummary: buildExecutiveSummary(slug, profile, report, competitor, locality, trafficOpportunity),
    competitorAnalysis: competitor,
    competitorSummary,
    googleProfileMetrics,
    trafficOpportunity,
    analysisProviders,
    organicSearchCompetitors,
    organicSearchEvidence,
    combinedCompetitorAnalysisStatus,
    staleCompletion,
    canGenerateCompetitorAnalysis: !isCombinedCompetitorAnalysisStored(slug) || staleCompletion.flagged,
    activeCompetitorAnalysisJobId: activeCompetitorJob?.id || null,
    sectionEvidence,
    localMarketIntelligence: {
      sections: buildLocalMarketSections(slug, profile, report, locality, googleProfileMetrics, snap),
    },
    growthIntelligence: {
      sections: buildGrowthSections(report, snap?.generatedAt || null),
      opportunities: (report?.opportunities || []).map((o) => ({
        id: o.id,
        title: o.title,
        priority: o.priority,
        impact: o.whyItMatters,
        evidence: o.evidenceSummary,
        evidenceSource: o.evidenceSource,
        category: o.category,
        serviceId: o.serviceId || null,
        scope: o.serviceId ? ("service" as const) : ("pharmacy-wide" as const),
      })),
      serviceOpportunityAssessment: report?.serviceOpportunityAssessment || null,
    },
    previouslyGenerated: (() => {
      const historical = readHistoricalEcosystemPackage(slug);
      const authorised = isAuthorisedEcosystemQualityReviewReady(slug);
      return {
        exists: Boolean(historical || (pkg?.generatedAt && authorised)),
        completedAt: historical?.generatedAt || (authorised ? pkg?.generatedAt || null : null),
        pages: historical?.pageCountEstimate || countAssets(assets, "service-page"),
        images: historical?.imageCountEstimate || countAssets(assets, "images"),
        blogs: countAssets(assets, "blog"),
        guides: countAssets(assets, "guides"),
        locationPages: countAssets(assets, "local-area-pages"),
        faqs: countAssets(assets, "faq"),
        productOwnerAuthorised: authorised,
        historicalAccidental: Boolean(historical),
        historicalLabel: historical?.label || null,
        historicalJobId: historical?.jobId || null,
      };
    })(),
    blockingIssues,
    recommendations,
    historicalEvents: buildHistoricalEvents(slug),
    technicalLog: buildTechnicalLog(slug, locality),
  };
}
