/**
 * Shared DataForSEO HTTP transport bounds.
 * Used by NI-03B Labs ranked_keywords and Google Organic SERP Live Advanced.
 * A client timeout is not retryable: the request may already have been charged.
 */
export const DATAFORSEO_HTTP_TIMEOUT_MS = 60_000;
export const DATAFORSEO_TRANSPORT_TIMEOUT = "TIMEOUT";

let testTimeoutMs: number | null = null;

export function setDataForSeoHttpTimeoutMsForTests(ms: number | null): void {
  testTimeoutMs = typeof ms === "number" && ms > 0 ? ms : null;
}

export function resolveDataForSeoHttpTimeoutMs(): number {
  return testTimeoutMs ?? DATAFORSEO_HTTP_TIMEOUT_MS;
}

export class DataForSeoTransportTimeoutError extends Error {
  readonly code = DATAFORSEO_TRANSPORT_TIMEOUT;
  readonly timedOut = true;
  readonly retryable = false;
  readonly endpoint: string;
  readonly timeoutMs: number;

  constructor(endpoint: string, timeoutMs = resolveDataForSeoHttpTimeoutMs()) {
    super(`DataForSEO HTTP timeout after ${timeoutMs}ms`);
    this.name = "DataForSeoTransportTimeoutError";
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }
}

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = String((err as { name?: string }).name || "");
  return name === "AbortError" || name === "TimeoutError";
}

export function isDataForSeoTransportTimeout(err: unknown): boolean {
  return err instanceof DataForSeoTransportTimeoutError || isAbortError(err);
}

export async function fetchDataForSeo(url: string, init: RequestInit = {}): Promise<Response> {
  const timeoutMs = resolveDataForSeoHttpTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (isDataForSeoTransportTimeout(err)) {
      throw new DataForSeoTransportTimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
