/**
 * Query scope labels separating Keywords Data demand from local organic SERP evidence.
 * Demand queries must not include mandatory locality.
 * Organic SERP queries remain locality-scoped in competitorAnalysisOrganicSearchService.
 */
import type { NhsDemandQueryEligibilitySource } from "./serviceSearchDemandNhsEligibility.ts";

export type ServiceDemandQueryScope = "national-service-demand";
export type LocalOrganicQueryScope = "local-organic-visibility";
export type ServiceDemandQueryType =
  | "canonical"
  | "consumer-synonym"
  | "pharmacy"
  | "nhs"
  | "near-me";
export type ServiceDemandEvidencePurpose = "search-demand";
export type LocalOrganicEvidencePurpose = "organic-ranking";

export type ServiceSearchDemandQuerySpec = {
  query: string;
  serviceId: string;
  queryScope: ServiceDemandQueryScope;
  queryType: ServiceDemandQueryType;
  localityIncluded: false;
  evidencePurpose: ServiceDemandEvidencePurpose;
  /** Present on NHS queryType rows when eligibility is confirmed. */
  nhsEligibilitySource?: NhsDemandQueryEligibilitySource;
};

export type LocalOrganicVisibilityQuerySpec = {
  query: string;
  serviceId?: string;
  queryScope: LocalOrganicQueryScope;
  queryType: "local-service-town" | "local-pharmacy-service" | "local-pharmacy-town";
  localityIncluded: true;
  evidencePurpose: LocalOrganicEvidencePurpose;
};

export function describeLocalOrganicVisibilityQuery(
  query: string,
  serviceId?: string,
): LocalOrganicVisibilityQuerySpec {
  const text = String(query || "").trim();
  const lower = text.toLowerCase();
  let queryType: LocalOrganicVisibilityQuerySpec["queryType"] = "local-service-town";
  if (serviceId && lower.includes(String(serviceId).replace(/-/g, " "))) {
    queryType = "local-pharmacy-service";
  } else if (/\bnear me\b/i.test(text)) {
    queryType = "local-service-town";
  } else if (/\b(pharmacy|chemist)\b/i.test(text) && !serviceId) {
    queryType = "local-pharmacy-town";
  }
  return {
    query: text,
    serviceId: serviceId || undefined,
    queryScope: "local-organic-visibility",
    queryType,
    localityIncluded: true,
    evidencePurpose: "organic-ranking",
  };
}
