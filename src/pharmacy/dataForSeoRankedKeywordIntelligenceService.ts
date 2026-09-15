/**
 * Canonical DataForSEO Labs client for ranked_keywords, keywords_for_site, and domain_intersection.
 * Live HTTP runs only when an explicit execution function is called.
 * Read/render paths must not import-call these live functions.
 */
import { fetchDataForSeo } from "./dataForSeoHttp.ts";

export const DATAFORSEO_LABS_ENDPOINTS = {
  rankedKeywords: "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
  keywordsForSite: "https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live",
  domainIntersection: "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_intersection/live",
} as const;

export type DataForSeoRankedKeyword = {
  keyword: string;
  position: number | null;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  url: string | null;
};

export type DataForSeoLabsKeywordRow = DataForSeoRankedKeyword & {
  sourceDomain: string;
};

export type DataForSeoLabsResult = {
  rows: DataForSeoLabsKeywordRow[];
  cost: number;
  tasks: number;
  endpoint: string;
};

function credentials() {
  const login = process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_API_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD || process.env.DATAFORSEO_API_PASSWORD;
  if (!login || !password) {
    throw new Error("DataForSEO credentials unavailable");
  }
  return { login, password };
}

export function normaliseLabsDomain(domain: string): string {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseLabsKeywordItems(payload: unknown, sourceDomain: string): { rows: DataForSeoLabsKeywordRow[]; cost: number; tasks: number } {
  const json = payload as { tasks?: Array<{ cost?: number; result?: Array<{ items?: unknown[] }> }> };
  const task = json?.tasks?.[0] || {};
  const items = task?.result?.[0]?.items || [];
  return {
    rows: items.map((item: any) => {
      const keywordData = item?.keyword_data || {};
      const keywordInfo = keywordData?.keyword_info || item?.keyword_info || {};
      const ranked = item?.ranked_serp_element?.serp_item || item?.ranked_serp_element || {};
      return {
        keyword: String(keywordData?.keyword || item?.keyword || "").trim(),
        position: num(ranked?.rank_absolute ?? ranked?.rank_group ?? item?.rank_absolute),
        searchVolume: num(keywordInfo?.search_volume ?? item?.search_volume),
        cpc: num(keywordInfo?.cpc ?? item?.cpc),
        competition: num(keywordInfo?.competition ?? item?.competition),
        url: ranked?.url || item?.url || null,
        sourceDomain,
      };
    }).filter((row: DataForSeoLabsKeywordRow) => row.keyword),
    cost: typeof task.cost === "number" ? task.cost : 0,
    tasks: task ? 1 : 0,
  };
}

export async function postDataForSeoLabs(endpoint: string, body: unknown): Promise<unknown> {
  const { login, password } = credentials();
  const response = await fetchDataForSeo(endpoint, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${login}:${password}`).toString("base64"),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload: any = await response.json();
  if (!response.ok || payload?.status_code !== 20000) {
    throw new Error(`DataForSEO request failed: ${endpoint} ${response.status} ${payload?.status_code || "unknown"}`);
  }
  const task = payload?.tasks?.[0];
  if (task && task.status_code !== 20000) {
    throw new Error(`DataForSEO task failed: ${task?.status_code || "unknown"} ${task?.status_message || ""}`);
  }
  return payload;
}

export async function getDomainRankedKeywordsWithCost(input: {
  domain: string;
  locationName?: string;
  languageCode?: string;
  limit?: number;
  orderBy?: string[];
}): Promise<DataForSeoLabsResult> {
  const domain = normaliseLabsDomain(input.domain);
  const payload = await postDataForSeoLabs(DATAFORSEO_LABS_ENDPOINTS.rankedKeywords, [{
    target: domain,
    location_name: input.locationName || "United Kingdom",
    language_code: input.languageCode || "en",
    limit: Math.min(Math.max(input.limit || 1000, 1), 1000),
    order_by: input.orderBy || ["keyword_data.keyword_info.search_volume,desc"],
  }]);
  const parsed = parseLabsKeywordItems(payload, domain);
  return { ...parsed, endpoint: DATAFORSEO_LABS_ENDPOINTS.rankedKeywords };
}

export async function getDomainRankedKeywords(input: {
  domain: string;
  locationName?: string;
  languageCode?: string;
  limit?: number;
}): Promise<DataForSeoRankedKeyword[]> {
  const result = await getDomainRankedKeywordsWithCost(input);
  return result.rows.map(({ sourceDomain: _sourceDomain, ...row }) => row);
}

export async function getKeywordsForSiteWithCost(input: {
  domain: string;
  locationName?: string;
  languageCode?: string;
  limit?: number;
  orderBy?: string[];
}): Promise<DataForSeoLabsResult> {
  const domain = normaliseLabsDomain(input.domain);
  const payload = await postDataForSeoLabs(DATAFORSEO_LABS_ENDPOINTS.keywordsForSite, [{
    target: domain,
    location_name: input.locationName || "United Kingdom",
    language_code: input.languageCode || "en",
    limit: Math.min(Math.max(input.limit || 100, 1), 1000),
    order_by: input.orderBy || ["keyword_info.search_volume,desc"],
  }]);
  const parsed = parseLabsKeywordItems(payload, domain);
  return { ...parsed, endpoint: DATAFORSEO_LABS_ENDPOINTS.keywordsForSite };
}

export async function getDomainIntersectionWithCost(input: {
  competitorDomain: string;
  subjectDomain: string;
  locationName?: string;
  languageCode?: string;
  limit?: number;
  intersections?: boolean;
  orderBy?: string[];
}): Promise<DataForSeoLabsResult> {
  const competitorDomain = normaliseLabsDomain(input.competitorDomain);
  const subjectDomain = normaliseLabsDomain(input.subjectDomain);
  const payload = await postDataForSeoLabs(DATAFORSEO_LABS_ENDPOINTS.domainIntersection, [{
    target1: competitorDomain,
    target2: subjectDomain,
    intersections: input.intersections === true,
    location_name: input.locationName || "United Kingdom",
    language_code: input.languageCode || "en",
    limit: Math.min(Math.max(input.limit || 100, 1), 1000),
    order_by: input.orderBy || ["keyword_data.keyword_info.search_volume,desc"],
  }]);
  const parsed = parseLabsKeywordItems(payload, competitorDomain);
  return { ...parsed, endpoint: DATAFORSEO_LABS_ENDPOINTS.domainIntersection };
}
