/**
 * DataForSEO National Search Adapter V1
 *
 * Connects the NATIONAL Growth Platform search-provider contract
 * to DataForSEO Google Organic SERP Live Advanced.
 *
 * No Local Growth Engine dependencies.
 * No Google Places dependencies.
 */
import type {
  NationalSearchProvider,
  NationalSearchRequest,
  NationalSearchResponse,
  NationalSearchEvidence,
  NationalSearchExecutionResult,
  NationalSearchTaskAttempt,
  NationalSearchExecuteHooks,
} from "./nationalSearchProviderModel.ts";
import {
  DATAFORSEO_TASK_INTERNAL_SE_ERROR,
  DATAFORSEO_TASK_OK,
  MAX_DATAFORSEO_INTERNAL_SE_RETRIES,
} from "./nationalSearchProviderModel.ts";
import { resolveDataForSeoSearchLocation } from "./dataForSeoSearchLocationResolver.ts";
import {
  fetchDataForSeo,
  isDataForSeoTransportTimeout,
  resolveDataForSeoHttpTimeoutMs,
} from "./dataForSeoHttp.ts";

export const DATAFORSEO_SERP_ENDPOINT =
  "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

function firstCredential(...names: string[]): string {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  throw new Error(`${names[0]} is not configured`);
}

export function isDataForSeoConfigured(): boolean {
  const login = String(
    process.env.DATAFORSEO_LOGIN ||
    process.env.DATAFORSEO_API_LOGIN ||
    "",
  ).trim();
  const password = String(
    process.env.DATAFORSEO_PASSWORD ||
    process.env.DATAFORSEO_API_PASSWORD ||
    "",
  ).trim();
  return Boolean(login && password);
}

function canonicalDomain(raw: unknown, url: unknown): string {
  const supplied = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");

  if (supplied) return supplied;

  try {
    return new URL(String(url || "")).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function parseOrganicItems(items: unknown[], source: string): NationalSearchEvidence[] {
  return items
    .filter((item: any) => item?.type === "organic")
    .map((item: any) => ({
      position: Number(item.rank_absolute || item.rank_group || 0),
      domain: canonicalDomain(item.domain, item.url),
      url: String(item.url || ""),
      title: String(item.title || ""),
      description: String(item.description || item.snippet || ""),
      source,
    }))
    .filter((item) => Boolean(item.domain && item.url));
}

function isFatalApiStatus(statusCode: number | null): boolean {
  if (statusCode == null) return true;
  if (statusCode === DATAFORSEO_TASK_OK) return false;
  return statusCode === 40100 || statusCode === 40200 || statusCode === 40201 || statusCode === 40400;
}

async function executeOnce(
  request: NationalSearchRequest,
  attemptNumber: number,
  providerId: string,
): Promise<{
  attempt: NationalSearchTaskAttempt;
  results: NationalSearchEvidence[];
  locationCode: number;
  marketCountry: string;
  fatal: boolean;
  fatalMessage: string | null;
}> {
  const login = firstCredential("DATAFORSEO_LOGIN", "DATAFORSEO_API_LOGIN");
  const password = firstCredential("DATAFORSEO_PASSWORD", "DATAFORSEO_API_PASSWORD");
  const query = String(request.query || "").trim();
  if (!query) {
    throw new Error("National search query is required");
  }

  const marketCountry = String(request.marketCountry || "").trim();
  const location = Number.isInteger(request.locationCode) && Number(request.locationCode) > 0
    ? { locationCode: Number(request.locationCode), country: marketCountry }
    : resolveDataForSeoSearchLocation(marketCountry);
  const languageCode = String(request.languageCode || "").trim() || "en";
  const depth = Math.max(10, Math.min(Number(request.depth || 10), 100));
  const capturedAt = new Date().toISOString();
  const auth = Buffer.from(`${login}:${password}`, "utf8").toString("base64");

  const baseAttempt = {
    query,
    endpoint: DATAFORSEO_SERP_ENDPOINT,
    attemptNumber,
    capturedAt,
    timedOut: false,
  };

  let response: Response;
  try {
    response = await fetchDataForSeo(DATAFORSEO_SERP_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keyword: query,
          location_code: location.locationCode,
          language_code: languageCode,
          depth,
        },
      ]),
    });
  } catch (err) {
    const timedOut = isDataForSeoTransportTimeout(err);
    return {
      attempt: {
        ...baseAttempt,
        taskId: null,
        taskStatusCode: null,
        taskStatusMessage: timedOut
          ? `HTTP timeout after ${resolveDataForSeoHttpTimeoutMs()}ms`
          : err instanceof Error ? err.message : String(err),
        cost: null,
        successful: false,
        retryable: timedOut,
        timedOut,
      },
      results: [],
      locationCode: location.locationCode,
      marketCountry: location.country || marketCountry,
      fatal: false,
      fatalMessage: null,
    };
  }

  const rawText = await response.text();
  let payload: any;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return {
      attempt: {
        ...baseAttempt,
        taskId: null,
        taskStatusCode: response.status,
        taskStatusMessage: `DataForSEO returned invalid JSON (HTTP ${response.status})`,
        cost: null,
        successful: false,
        retryable: false,
        timedOut: false,
      },
      results: [],
      locationCode: location.locationCode,
      marketCountry: location.country || marketCountry,
      fatal: false,
      fatalMessage: null,
    };
  }

  const topStatus = typeof payload?.status_code === "number" ? payload.status_code : null;
  const task = payload?.tasks?.[0];
  const taskStatus = typeof task?.status_code === "number" ? task.status_code : null;
  const taskMessage = String(task?.status_message || payload?.status_message || "request failed");
  const taskId = task?.id != null ? String(task.id) : null;
  const cost = typeof task?.cost === "number" ? task.cost : null;

  if (!response.ok || (topStatus != null && topStatus !== DATAFORSEO_TASK_OK)) {
    const fatal = response.status === 401 || response.status === 403 || isFatalApiStatus(topStatus);
    return {
      attempt: {
        ...baseAttempt,
        taskId,
        taskStatusCode: topStatus ?? response.status,
        taskStatusMessage: taskMessage,
        cost,
        successful: false,
        retryable: false,
        timedOut: false,
      },
      results: [],
      locationCode: location.locationCode,
      marketCountry: location.country || marketCountry,
      fatal,
      fatalMessage: fatal ? `DataForSEO API ${topStatus ?? response.status}: ${taskMessage}` : null,
    };
  }

  if (taskStatus === DATAFORSEO_TASK_OK) {
    const items = Array.isArray(task?.result?.[0]?.items) ? task.result[0].items : [];
    const organic = parseOrganicItems(items, providerId);
    return {
      attempt: {
        ...baseAttempt,
        taskId,
        taskStatusCode: taskStatus,
        taskStatusMessage: taskMessage,
        cost,
        successful: true,
        retryable: false,
        timedOut: false,
      },
      results: organic,
      locationCode: location.locationCode,
      marketCountry: location.country || marketCountry,
      fatal: false,
      fatalMessage: null,
    };
  }

  const fatalTask =
    taskStatus === 40100 || taskStatus === 40200 || taskStatus === 40201 || taskStatus === 40400;
  return {
    attempt: {
      ...baseAttempt,
      taskId,
      taskStatusCode: taskStatus,
      taskStatusMessage: taskMessage,
      cost,
      successful: false,
      retryable: taskStatus === DATAFORSEO_TASK_INTERNAL_SE_ERROR,
      timedOut: false,
    },
    results: [],
    locationCode: location.locationCode,
    marketCountry: location.country || marketCountry,
    fatal: fatalTask,
    fatalMessage: fatalTask ? `DataForSEO task ${taskStatus}: ${taskMessage}` : null,
  };
}

export class DataForSeoNationalSearchProvider
  implements NationalSearchProvider
{
  readonly id = "dataforseo-google-organic-live";

  async execute(
    request: NationalSearchRequest,
    hooks: NationalSearchExecuteHooks = {},
  ): Promise<NationalSearchExecutionResult> {
    const attempts: NationalSearchTaskAttempt[] = [];
    const first = await executeOnce(request, 1, this.id);
    attempts.push(first.attempt);

    let current = first;
    if (!first.attempt.successful && first.attempt.retryable && !first.fatal) {
      hooks.onRetry?.(first.attempt);
      const retry = await executeOnce(request, 1 + MAX_DATAFORSEO_INTERNAL_SE_RETRIES, this.id);
      attempts.push(retry.attempt);
      current = retry;
    }

    const cost = attempts.reduce((sum, row) => sum + (typeof row.cost === "number" ? row.cost : 0), 0);
    return {
      provider: this.id,
      query: current.attempt.query,
      marketCountry: current.marketCountry,
      locationCode: current.locationCode,
      capturedAt: current.attempt.capturedAt,
      successful: current.attempt.successful,
      fatal: first.fatal || current.fatal,
      fatalMessage: first.fatalMessage || current.fatalMessage,
      organicResultCount: current.results.length,
      results: current.attempt.successful ? current.results : [],
      attempts,
      cost,
    };
  }

  async search(
    request: NationalSearchRequest,
  ): Promise<NationalSearchResponse> {
    const executed = await this.execute(request);
    if (!executed.successful) {
      const last = executed.attempts[executed.attempts.length - 1];
      throw new Error(
        `DataForSEO task ${last?.taskStatusCode || "unknown"}: ${last?.taskStatusMessage || "request failed"}`,
      );
    }
    return {
      provider: executed.provider,
      query: executed.query,
      marketCountry: executed.marketCountry,
      locationCode: executed.locationCode,
        languageCode:
          String(request.languageCode || "").trim() || "en",
      capturedAt: executed.capturedAt,
      cost: executed.cost,
      organicResultCount: executed.organicResultCount,
      results: executed.results,
        taskId:
          executed.attempts[executed.attempts.length - 1]?.taskId ??
          null,
    };
  }
}

export async function executeNationalGoogleOrganic(
  request: NationalSearchRequest,
  hooks: NationalSearchExecuteHooks = {},
): Promise<NationalSearchExecutionResult> {
  const provider = new DataForSeoNationalSearchProvider();
  return provider.execute(request, hooks);
}

export async function searchNationalGoogleOrganic(
  request: NationalSearchRequest,
): Promise<NationalSearchResponse> {
  const provider = new DataForSeoNationalSearchProvider();
  return provider.search(request);
}
