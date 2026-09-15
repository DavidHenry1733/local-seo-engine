/**
 * Shared service search-demand contract (DataForSEO Keywords Data Google Ads search_volume).
 * Demand metrics are never inferred from organic SERP evidence.
 */

export const SERVICE_SEARCH_DEMAND_SCHEMA_VERSION = 1 as const;
export const SERVICE_SEARCH_DEMAND_SOURCE = "dataforseo-google-ads-search-volume" as const;
export const SERVICE_SEARCH_DEMAND_ENDPOINT =
  "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live" as const;
export const SERVICE_SEARCH_DEMAND_LOCATION_CODE = 2826 as const;
export const SERVICE_SEARCH_DEMAND_LANGUAGE_CODE = "en" as const;
export const SERVICE_SEARCH_DEMAND_FRESHNESS_DAYS = 14 as const;
export const SERVICE_SEARCH_DEMAND_MAX_QUERIES_PER_SERVICE = 5 as const;

export type PaidCompetitionLevel = "HIGH" | "MEDIUM" | "LOW";

export type ServiceSearchDemandAvailability =
  | "available"
  | "unavailable"
  | "zero";

export type ServiceSearchDemandEvidenceStatus =
  | "complete"
  | "partial"
  | "unavailable"
  | "empty"
  | "reused";

export type MonthlySearchVolume = {
  year: number;
  month: number;
  searchVolume: number | null;
};

export type ServiceSearchDemandQueryRow = {
  serviceId: string;
  query: string;
  searchVolume: number | null;
  monthlySearches: MonthlySearchVolume[];
  competition: PaidCompetitionLevel | null;
  competitionIndex: number | null;
  cpc: number | null;
  /** Google Ads CPC is USD per official DataForSEO docs. */
  cpcCurrency: "USD" | null;
  lowTopOfPageBid: number | null;
  highTopOfPageBid: number | null;
  source: typeof SERVICE_SEARCH_DEMAND_SOURCE;
  capturedAt: string;
  taskId: string | null;
  locationCode: number;
  languageCode: string;
  availability: ServiceSearchDemandAvailability;
  unavailableReason: string | null;
};

export type ServiceSearchDemandServiceEntry = {
  serviceId: string;
  serviceName: string;
  queries: ServiceSearchDemandQueryRow[];
  requestCount: number;
  taskIds: string[];
  evidenceStatus: ServiceSearchDemandEvidenceStatus;
  capturedAt: string;
};

export type ServiceSearchDemandArtifact = {
  schemaVersion: typeof SERVICE_SEARCH_DEMAND_SCHEMA_VERSION;
  slug: string;
  source: typeof SERVICE_SEARCH_DEMAND_SOURCE;
  generatedAt: string;
  locationCode: typeof SERVICE_SEARCH_DEMAND_LOCATION_CODE;
  languageCode: typeof SERVICE_SEARCH_DEMAND_LANGUAGE_CODE;
  confirmedServiceIds: string[];
  demandByService: Record<string, ServiceSearchDemandServiceEntry>;
  requestCount: number;
  taskIds: string[];
  /** DataForSEO-reported task cost in USD when live collection ran. */
  providerCost: number | null;
};

export type ServiceSearchDemandCollectOptions = {
  /** Required to recollect within the freshness window. */
  force?: boolean;
  /** Injectable transport for fixtures; live path uses DataForSEO HTTP. */
  postSearchVolume?: (body: unknown[]) => Promise<unknown>;
  /** Override clock for freshness tests. */
  now?: Date;
};
