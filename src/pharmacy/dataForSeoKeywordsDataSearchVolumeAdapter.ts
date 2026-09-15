/**
 * DataForSEO Keywords Data — Google Ads search_volume/live adapter.
 * Live HTTP runs only when an explicit collect function posts.
 * Does not infer volume/CPC/competition from organic SERP.
 */
import { fetchDataForSeo, isDataForSeoTransportTimeout } from "./dataForSeoHttp.ts";
import { isDataForSeoConfigured } from "./dataForSeoNationalSearchAdapter.ts";
import {
  SERVICE_SEARCH_DEMAND_ENDPOINT,
  SERVICE_SEARCH_DEMAND_LANGUAGE_CODE,
  SERVICE_SEARCH_DEMAND_LOCATION_CODE,
  SERVICE_SEARCH_DEMAND_SOURCE,
  type MonthlySearchVolume,
  type PaidCompetitionLevel,
  type ServiceSearchDemandQueryRow,
} from "./serviceSearchDemandModel.ts";

export { isDataForSeoConfigured };

export type SearchVolumeLiveRequest = {
  keywords: string[];
  location_code: typeof SERVICE_SEARCH_DEMAND_LOCATION_CODE;
  language_code: typeof SERVICE_SEARCH_DEMAND_LANGUAGE_CODE;
};

export type SearchVolumeLivePostResult = {
  payload: unknown;
  taskId: string | null;
  cost: number;
};

function credentials(): { login: string; password: string } {
  const login = String(process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_API_LOGIN || "").trim();
  const password = String(
    process.env.DATAFORSEO_PASSWORD || process.env.DATAFORSEO_API_PASSWORD || "",
  ).trim();
  if (!login || !password) {
    throw new Error("DataForSEO credentials unavailable");
  }
  return { login, password };
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseCompetition(value: unknown): PaidCompetitionLevel | null {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "HIGH" || raw === "MEDIUM" || raw === "LOW") return raw;
  return null;
}

function parseMonthlySearches(value: unknown): MonthlySearchVolume[] {
  if (!Array.isArray(value)) return [];
  const out: MonthlySearchVolume[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const year = num((row as { year?: unknown }).year);
    const month = num((row as { month?: unknown }).month);
    if (year == null || month == null) continue;
    out.push({
      year,
      month,
      searchVolume: num((row as { search_volume?: unknown }).search_volume),
    });
  }
  return out;
}

export function buildSearchVolumeLiveRequest(keywords: string[]): SearchVolumeLiveRequest[] {
  return [
    {
      keywords: keywords.map((k) => String(k || "").trim()).filter(Boolean),
      location_code: SERVICE_SEARCH_DEMAND_LOCATION_CODE,
      language_code: SERVICE_SEARCH_DEMAND_LANGUAGE_CODE,
    },
  ];
}

/**
 * Parse Google Ads search_volume/live payload into one row per requested keyword.
 * Zero remains zero. Missing remains null. Never fabricates monthly history.
 */
export function parseSearchVolumeLiveResponse(input: {
  serviceId: string;
  requestedKeywords: string[];
  payload: unknown;
  capturedAt?: string;
}): {
  rows: ServiceSearchDemandQueryRow[];
  taskId: string | null;
  cost: number;
} {
  const capturedAt = input.capturedAt || new Date().toISOString();
  const json = input.payload as {
    cost?: number;
    tasks?: Array<{
      id?: string;
      cost?: number;
      result?: Array<Record<string, unknown>>;
    }>;
  };
  const task = json?.tasks?.[0] || null;
  const taskId = task?.id ? String(task.id) : null;
  const cost =
    typeof task?.cost === "number"
      ? task.cost
      : typeof json?.cost === "number"
        ? json.cost
        : 0;
  const results = Array.isArray(task?.result) ? task!.result! : [];

  const byKeyword = new Map<string, Record<string, unknown>>();
  for (const item of results) {
    const keyword = String(item?.keyword || "").trim().toLowerCase();
    if (!keyword) continue;
    byKeyword.set(keyword, item);
  }

  const rows: ServiceSearchDemandQueryRow[] = input.requestedKeywords.map((query) => {
    const item = byKeyword.get(query.trim().toLowerCase());
    if (!item) {
      return {
        serviceId: input.serviceId,
        query,
        searchVolume: null,
        monthlySearches: [],
        competition: null,
        competitionIndex: null,
        cpc: null,
        cpcCurrency: null,
        lowTopOfPageBid: null,
        highTopOfPageBid: null,
        source: SERVICE_SEARCH_DEMAND_SOURCE,
        capturedAt,
        taskId,
        locationCode: SERVICE_SEARCH_DEMAND_LOCATION_CODE,
        languageCode: SERVICE_SEARCH_DEMAND_LANGUAGE_CODE,
        availability: "unavailable",
        unavailableReason: "Keyword absent from DataForSEO Google Ads search_volume result.",
      };
    }

    const searchVolume = num(item.search_volume);
    const monthlySearches = parseMonthlySearches(item.monthly_searches);
    const competition = parseCompetition(item.competition);
    const competitionIndex = num(item.competition_index);
    const cpc = num(item.cpc);
    const lowTopOfPageBid = num(item.low_top_of_page_bid);
    const highTopOfPageBid = num(item.high_top_of_page_bid);

    const hasAnyMetric =
      searchVolume !== null ||
      competition !== null ||
      competitionIndex !== null ||
      cpc !== null ||
      monthlySearches.length > 0;

    let availability: ServiceSearchDemandQueryRow["availability"] = "unavailable";
    let unavailableReason: string | null =
      "Google Ads returned no search volume, CPC, or paid competition for this keyword.";

    if (searchVolume === 0) {
      availability = "zero";
      unavailableReason = null;
    } else if (searchVolume !== null || hasAnyMetric) {
      availability = "available";
      unavailableReason = null;
    }

    return {
      serviceId: input.serviceId,
      query,
      searchVolume,
      monthlySearches,
      competition,
      competitionIndex,
      cpc,
      cpcCurrency: cpc !== null ? "USD" : null,
      lowTopOfPageBid,
      highTopOfPageBid,
      source: SERVICE_SEARCH_DEMAND_SOURCE,
      capturedAt,
      taskId,
      locationCode: num(item.location_code) ?? SERVICE_SEARCH_DEMAND_LOCATION_CODE,
      languageCode: String(item.language_code || SERVICE_SEARCH_DEMAND_LANGUAGE_CODE),
      availability,
      unavailableReason,
    };
  });

  return { rows, taskId, cost };
}

/**
 * Live POST to search_volume/live. Does not retry on transport timeout
 * (request may already have been charged).
 */
export async function postGoogleAdsSearchVolumeLive(
  keywords: string[],
): Promise<SearchVolumeLivePostResult> {
  if (!keywords.length) {
    return { payload: { tasks: [] }, taskId: null, cost: 0 };
  }
  const { login, password } = credentials();
  const body = buildSearchVolumeLiveRequest(keywords);
  try {
    const response = await fetchDataForSeo(SERVICE_SEARCH_DEMAND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: "Basic " + Buffer.from(`${login}:${password}`).toString("base64"),
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload: any = await response.json();
    if (!response.ok || payload?.status_code !== 20000) {
      throw new Error(
        `DataForSEO search_volume failed: HTTP ${response.status} status ${payload?.status_code || "unknown"}`,
      );
    }
    const task = payload?.tasks?.[0];
    if (task && task.status_code !== 20000) {
      throw new Error(
        `DataForSEO search_volume task failed: ${task?.status_code || "unknown"} ${task?.status_message || ""}`.trim(),
      );
    }
    const parsed = parseSearchVolumeLiveResponse({
      serviceId: "",
      requestedKeywords: keywords,
      payload,
    });
    return { payload, taskId: parsed.taskId, cost: parsed.cost };
  } catch (err) {
    if (isDataForSeoTransportTimeout(err)) {
      throw err;
    }
    throw err;
  }
}
