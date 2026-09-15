/**
 * Deterministic national consumer demand query builder for Keywords Data.
 * Confirmed services only; max five queries; no locality; no Pharmacy First fallback.
 *
 * Local organic visibility queries remain in competitorAnalysisOrganicSearchService.
 */
import { SERVICE_SEARCH_DEMAND_MAX_QUERIES_PER_SERVICE } from "./serviceSearchDemandModel.ts";
import { resolveConsumerDemandLanguage } from "./serviceSearchDemandMetadata.ts";
import {
  resolveNhsDemandQueryEligibility,
  type NhsDemandQueryEligibilitySource,
} from "./serviceSearchDemandNhsEligibility.ts";
import type {
  ServiceDemandQueryType,
  ServiceSearchDemandQuerySpec,
} from "./serviceSearchDemandQueryScope.ts";

export type ServiceSearchDemandQueryInput = {
  serviceId: string;
  /** Tenant slug — enables NHS eligibility from serviceDeliveryProfiles funding. */
  slug?: string;
  /** Ignored for demand queries — locality belongs to organic SERP only. */
  pharmacyName?: string;
  /** Ignored for demand queries — locality belongs to organic SERP only. */
  town?: string;
  serviceName?: string;
};

function clean(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function pharmacyDemandPhrase(canonical: string): string {
  const lower = canonical.toLowerCase();
  if (lower.startsWith("pharmacy ")) {
    return `${canonical} service`;
  }
  return `pharmacy ${canonical}`;
}

function dedupeSpecs(specs: ServiceSearchDemandQuerySpec[]): ServiceSearchDemandQuerySpec[] {
  const seen = new Set<string>();
  const out: ServiceSearchDemandQuerySpec[] = [];
  for (const spec of specs) {
    const key = spec.query.toLowerCase();
    if (!spec.query || seen.has(key)) continue;
    seen.add(key);
    out.push(spec);
  }
  return out;
}

function spec(
  serviceId: string,
  query: string,
  queryType: ServiceDemandQueryType,
  nhsEligibilitySource?: NhsDemandQueryEligibilitySource,
): ServiceSearchDemandQuerySpec {
  return {
    query: clean(query),
    serviceId,
    queryScope: "national-service-demand",
    queryType,
    localityIncluded: false,
    evidencePurpose: "search-demand",
    ...(nhsEligibilitySource ? { nhsEligibilitySource } : {}),
  };
}

/** Normalise + dedupe query strings while preserving first-seen deterministic order. */
export function normaliseDemandQueries(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const value = clean(item);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/**
 * Build up to five national consumer demand queries for one confirmed service.
 * Order:
 * 1. canonical consumer phrase
 * 2. approved plain-English synonym
 * 3. pharmacy + canonical consumer phrase
 * 4. NHS + canonical consumer phrase (when shared catalogue or tenant funding confirms NHS)
 * 5. canonical + near me (when appropriate)
 */
export function buildServiceSearchDemandQuerySpecs(
  input: ServiceSearchDemandQueryInput,
): ServiceSearchDemandQuerySpec[] {
  const serviceId = clean(input.serviceId);
  if (!serviceId) return [];

  const lang = resolveConsumerDemandLanguage(serviceId);
  if (!lang?.canonicalConsumerPhrase) return [];

  const canonical = clean(lang.canonicalConsumerPhrase);
  const raw: ServiceSearchDemandQuerySpec[] = [
    spec(serviceId, canonical, "canonical"),
  ];

  const synonym = clean(lang.consumerSynonym);
  if (synonym && synonym.toLowerCase() !== canonical.toLowerCase()) {
    raw.push(spec(serviceId, synonym, "consumer-synonym"));
  }

  raw.push(spec(serviceId, pharmacyDemandPhrase(canonical), "pharmacy"));

  const nhsEligibility = resolveNhsDemandQueryEligibility({
    serviceId,
    slug: input.slug,
  });
  if (nhsEligibility.eligible && nhsEligibility.source) {
    raw.push(
      spec(serviceId, `NHS ${canonical}`, "nhs", nhsEligibility.source),
    );
  }

  if (lang.nearMeAppropriate) {
    raw.push(spec(serviceId, `${canonical} near me`, "near-me"));
  }

  return dedupeSpecs(raw).slice(0, SERVICE_SEARCH_DEMAND_MAX_QUERIES_PER_SERVICE);
}

/** String-only view for Keywords Data request batching. */
export function buildServiceSearchDemandQueries(input: ServiceSearchDemandQueryInput): string[] {
  return buildServiceSearchDemandQuerySpecs(input).map((row) => row.query);
}
