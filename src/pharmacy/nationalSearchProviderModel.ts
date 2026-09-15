/**
 * National Search Provider Contract V1
 *
 * Provider-independent web/SERP search contract for the
 * NATIONAL Growth Platform.
 *
 * This is NOT Google Places.
 * This is NOT locality/proximity competitor discovery.
 */

export interface NationalSearchRequest {
  query: string;
  marketCountry: string;
  languageCode?: string;
  depth?: number;
  locationCode?: number;
}

export interface NationalSearchEvidence {
  position: number;
  domain: string;
  url: string;
  title: string;
  description: string;
  source: string;
}

export interface NationalSearchResponse {
  provider: string;
  query: string;
  marketCountry: string;
  locationCode: number;
  capturedAt: string;
  cost: number | null;
  organicResultCount: number;
  results: NationalSearchEvidence[];
  taskId?: string | null;
}

export interface NationalSearchProvider {
  id: string;
  search(request: NationalSearchRequest): Promise<NationalSearchResponse>;
}

export const DATAFORSEO_TASK_OK = 20000;
export const DATAFORSEO_TASK_INTERNAL_SE_ERROR = 40101;
export const MAX_DATAFORSEO_INTERNAL_SE_RETRIES = 1;

export interface NationalSearchExecuteHooks {
  onRetry?: (attempt: NationalSearchTaskAttempt) => void;
}

export interface NationalSearchTaskAttempt {
  query: string;
  endpoint: string;
  taskId: string | null;
  taskStatusCode: number | null;
  taskStatusMessage: string | null;
  cost: number | null;
  successful: boolean;
  retryable: boolean;
  timedOut: boolean;
  attemptNumber: number;
  capturedAt: string;
}

export interface NationalSearchExecutionResult {
  provider: string;
  query: string;
  marketCountry: string;
  locationCode: number;
  capturedAt: string;
  successful: boolean;
  fatal: boolean;
  fatalMessage: string | null;
  organicResultCount: number;
  results: NationalSearchEvidence[];
  attempts: NationalSearchTaskAttempt[];
  cost: number;
}
