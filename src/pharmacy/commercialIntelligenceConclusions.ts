/**
 * Commercial Intelligence conclusion layer.
 * Consumes canonical evidence. Does not collect or rewrite it.
 */
export const COMMERCIAL_EVIDENCE_STATES = [
  "KNOWN_POSITIVE",
  "KNOWN_GAP",
  "UNKNOWN",
  "NOT_APPLICABLE",
] as const;

export type CommercialEvidenceState = (typeof COMMERCIAL_EVIDENCE_STATES)[number];
export type CommercialConclusionConfidence = "high" | "medium" | "low" | "unknown";

export interface CommercialConclusion {
  id: string;
  conclusion: string;
  evidenceStatus: CommercialEvidenceState;
  sourceRef: string;
  confidence: CommercialConclusionConfidence;
  explanation: string;
  recommendedAction: string | null;
}

export interface EnabledServiceCoverageInput {
  serviceId: string;
  serviceName: string;
  dedicatedPage: "PRESENT" | "NOT_FOUND" | "UNCERTAIN";
}

export interface IndexingMeasurement {
  registeredPageCount: number;
  indexedPageCount: number | null;
}

export interface BenchmarkCompetitor {
  name: string;
  reviewCount: number | null;
  categoryCount: number | null;
}

const SEARCH_DEMAND_UNKNOWN = "Search demand data is not yet available.";
const ORGANIC_UNKNOWN = "Organic visibility is not yet measured.";
const INDEXING_UNKNOWN = "Indexing visibility is not yet measured.";
const PHOTO_UNKNOWN = "Photo evidence is not yet measured.";

export function crawlCompletenessConclusion(percent: number | null | undefined): CommercialConclusion {
  if (percent == null || !Number.isFinite(percent)) {
    return {
      id: "crawl-completeness",
      conclusion: "Imported website crawl completeness is not available.",
      evidenceStatus: "UNKNOWN",
      sourceRef: "website-import-crawl-completeness",
      confidence: "unknown",
      explanation: "No crawled-page completeness figure is stored. This is not an overall online-completeness score.",
      recommendedAction: null,
    };
  }
  return {
    id: "crawl-completeness",
    conclusion: `Imported website crawl completeness is ${percent}% of the pages that were analysed.`,
    evidenceStatus: "KNOWN_POSITIVE",
    sourceRef: "website-import-crawl-completeness",
    confidence: "medium",
    explanation: "This percentage describes the analysed website crawl. It is not overall online completeness, and it does not mean every enabled service has a dedicated page.",
    recommendedAction: null,
  };
}

export function indexingConclusion(measurement: IndexingMeasurement | null): CommercialConclusion {
  const registered = measurement?.registeredPageCount ?? 0;
  const indexed = measurement?.indexedPageCount;
  if (!measurement || registered <= 0 || indexed == null) {
    return {
      id: "indexing",
      conclusion: INDEXING_UNKNOWN,
      evidenceStatus: "UNKNOWN",
      sourceRef: "indexing-registry",
      confidence: "unknown",
      explanation: "No pages are registered for indexing measurement, so an indexed-page count cannot be stated.",
      recommendedAction: null,
    };
  }
  if (indexed === 0) {
    return {
      id: "indexing",
      conclusion: "Indexing evidence records 0 indexed pages among the pages registered for measurement.",
      evidenceStatus: "KNOWN_GAP",
      sourceRef: "indexing-registry",
      confidence: "high",
      explanation: "Zero is shown because the indexing record explicitly counts registered pages and none are indexed.",
      recommendedAction: null,
    };
  }
  return {
    id: "indexing",
    conclusion: `Indexing evidence records ${indexed} indexed page${indexed === 1 ? "" : "s"}.`,
    evidenceStatus: "KNOWN_POSITIVE",
    sourceRef: "indexing-registry",
    confidence: "high",
    explanation: "The count comes from pages registered for indexing measurement.",
    recommendedAction: null,
  };
}

export function demandConclusion(volume: number | null | undefined): CommercialConclusion {
  if (volume == null || !Number.isFinite(volume)) {
    return {
      id: "search-demand",
      conclusion: SEARCH_DEMAND_UNKNOWN,
      evidenceStatus: "UNKNOWN",
      sourceRef: "search-demand-evidence",
      confidence: "unknown",
      explanation: "No search-demand figure is stored for this service.",
      recommendedAction: null,
    };
  }
  return {
    id: "search-demand",
    conclusion: `Stored search demand for the measured query is ${volume}.`,
    evidenceStatus: "KNOWN_POSITIVE",
    sourceRef: "search-demand-evidence",
    confidence: "medium",
    explanation: "The figure is the stored measured query volume. Overlapping queries are not added together.",
    recommendedAction: null,
  };
}

export function organicVisibilityConclusion(classification: string | null | undefined): CommercialConclusion {
  const value = String(classification || "").trim().toLowerCase();
  if (!value || value === "unavailable" || value === "unknown") {
    return {
      id: "organic-visibility",
      conclusion: ORGANIC_UNKNOWN,
      evidenceStatus: "UNKNOWN",
      sourceRef: "organic-search-evidence",
      confidence: "unknown",
      explanation: "No measured organic ranking is stored for this service.",
      recommendedAction: null,
    };
  }
  return {
    id: "organic-visibility",
    conclusion: `Organic visibility evidence is recorded as ${value.replace(/-/g, " ")}.`,
    evidenceStatus: value === "not-visible" ? "KNOWN_GAP" : "KNOWN_POSITIVE",
    sourceRef: "organic-search-evidence",
    confidence: "medium",
    explanation: "This uses stored organic-search evidence only.",
    recommendedAction: null,
  };
}

export function photoEvidenceConclusion(photoCount: number | null | undefined): CommercialConclusion {
  if (photoCount == null || !Number.isFinite(photoCount) || photoCount < 0) {
    return {
      id: "photo-evidence",
      conclusion: PHOTO_UNKNOWN,
      evidenceStatus: "UNKNOWN",
      sourceRef: "google-places-photo-count",
      confidence: "unknown",
      explanation: "A missing photo count is not a measured count of zero.",
      recommendedAction: null,
    };
  }
  if (photoCount === 0) {
    return {
      id: "photo-evidence",
      conclusion: "Google Places records 0 photos.",
      evidenceStatus: "KNOWN_GAP",
      sourceRef: "google-places-photo-count",
      confidence: "high",
      explanation: "Zero is shown because the stored photo count is explicitly 0.",
      recommendedAction: "Add Google Business photos after the profile evidence is reviewed.",
    };
  }
  return {
    id: "photo-evidence",
    conclusion: `Google Places records ${photoCount} photos.`,
    evidenceStatus: "KNOWN_POSITIVE",
    sourceRef: "google-places-photo-count",
    confidence: "high",
    explanation: "The count is the stored Google Places photo evidence.",
    recommendedAction: null,
  };
}

export function servicePageConclusion(service: EnabledServiceCoverageInput): CommercialConclusion {
  if (service.dedicatedPage === "PRESENT") {
    return {
      id: `coverage-${service.serviceId}`,
      conclusion: `${service.serviceName} has an existing dedicated page.`,
      evidenceStatus: "KNOWN_POSITIVE",
      sourceRef: "canonical-service-coverage",
      confidence: "high",
      explanation: `${service.serviceName} is an enabled service and the imported website has a dedicated page.`,
      recommendedAction: `Improve the existing ${service.serviceName} page before considering indexing.`,
    };
  }
  if (service.dedicatedPage === "UNCERTAIN") {
    return {
      id: `coverage-${service.serviceId}`,
      conclusion: `${service.serviceName} page evidence is not conclusive.`,
      evidenceStatus: "UNKNOWN",
      sourceRef: "canonical-service-coverage",
      confidence: "low",
      explanation: "The imported website does not confirm or rule out a dedicated page.",
      recommendedAction: `Review the imported ${service.serviceName} evidence before creating or indexing a page.`,
    };
  }
  return {
    id: `coverage-${service.serviceId}`,
    conclusion: `${service.serviceName} has no dedicated page.`,
    evidenceStatus: "KNOWN_GAP",
    sourceRef: "canonical-service-coverage",
    confidence: "high",
    explanation: `${service.serviceName} is enabled, and the imported website has no dedicated page.`,
    recommendedAction: `Create a dedicated ${service.serviceName} page, then review and publish it before any indexing submission.`,
  };
}

export function indexingRecommendationAllowed(service: EnabledServiceCoverageInput, measurement: IndexingMeasurement | null): boolean {
  if (service.dedicatedPage !== "PRESENT") return false;
  if (!measurement || measurement.registeredPageCount <= 0) return false;
  return true;
}

export function localBenchmarkConclusion(competitors: BenchmarkCompetitor[]): CommercialConclusion {
  const named = competitors.filter((row) => row.name.trim());
  const reviewLeader = named
    .filter((row) => row.reviewCount != null && row.reviewCount > 0)
    .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))[0];
  const categoryLeader = named
    .filter((row) => row.categoryCount != null && row.categoryCount > 0)
    .sort((a, b) => (b.categoryCount || 0) - (a.categoryCount || 0))[0];
  if (!reviewLeader && !categoryLeader) {
    return {
      id: "local-benchmark",
      conclusion: "No local benchmark leader is available.",
      evidenceStatus: "UNKNOWN",
      sourceRef: "google-places-competitor-metrics",
      confidence: "unknown",
      explanation: "Stored local competitors do not include a review count or category count to rank.",
      recommendedAction: null,
    };
  }
  const parts: string[] = [];
  if (reviewLeader) parts.push(`Google review-count leader: ${reviewLeader.name} — ${reviewLeader.reviewCount} reviews`);
  if (categoryLeader && categoryLeader.name !== reviewLeader?.name) {
    parts.push(`Category-coverage leader: ${categoryLeader.name} — ${categoryLeader.categoryCount} categories`);
  }
  return {
    id: "local-benchmark",
    conclusion: parts.join(". ") + ".",
    evidenceStatus: "KNOWN_POSITIVE",
    sourceRef: "google-places-competitor-metrics",
    confidence: "high",
    explanation: "Each leader is named for one measured benchmark. A single competitor is not called strongest unless the same business leads the stated metric.",
    recommendedAction: null,
  };
}

export function localityTargetConclusion(primaryMarket: string | null, selectedTargets: string[]): CommercialConclusion {
  const market = String(primaryMarket || "").trim();
  const targets = selectedTargets.map((name) => name.trim()).filter(Boolean);
  if (!market && !targets.length) {
    return {
      id: "locality-targets",
      conclusion: "Primary market and locality-page targets are not selected.",
      evidenceStatus: "UNKNOWN",
      sourceRef: "tenant-locality",
      confidence: "unknown",
      explanation: "A primary market and selected locality-page targets are different decisions.",
      recommendedAction: null,
    };
  }
  if (!targets.length) {
    return {
      id: "locality-targets",
      conclusion: `Primary market: ${market || "not recorded"}. No locality-page targets are selected yet.`,
      evidenceStatus: market ? "KNOWN_GAP" : "UNKNOWN",
      sourceRef: "tenant-locality",
      confidence: market ? "high" : "unknown",
      explanation: "Nearby competitors do not become locality-page targets. Pages for neighbourhoods stay unavailable until areas are selected.",
      recommendedAction: "Select locality-page targets before requesting location pages.",
    };
  }
  return {
    id: "locality-targets",
    conclusion: `Primary market: ${market || "not recorded"}. Locality-page targets: ${targets.join(", ")}.`,
    evidenceStatus: "KNOWN_POSITIVE",
    sourceRef: "tenant-locality",
    confidence: "high",
    explanation: "These are the selected locality-page targets, separate from the primary market name.",
    recommendedAction: null,
  };
}

export function contentTypeGapConclusion(label: string): CommercialConclusion | null {
  const text = label.trim();
  if (!text || /^service pages for:/i.test(text)) return null;
  return {
    id: `content-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    conclusion: `${text} were not found in the imported website.`,
    evidenceStatus: "KNOWN_GAP",
    sourceRef: "website-import-content-summary",
    confidence: "medium",
    explanation: "This is an imported website content-type gap, not a competitor service and not a crawl-completeness percentage.",
    recommendedAction: `Add ${text.toLowerCase()} after the enabled service pages are confirmed.`,
  };
}

export const COMMERCIAL_DECISION_COPY =
  "Approve Intelligence accepts these commercial conclusions for the next workflow stage. It does not approve raw search results, unmeasured evidence, services that are not enabled, or an indexing step for a page that does not exist.";
