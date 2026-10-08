import fs from "node:fs";
import path from "node:path";
import { fetchDataForSeo } from "./dataForSeoHttp.ts";
import { WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export interface LocalCompetitorMetric {
  name: string;
  reviewCount: number;
  rating: number;
  address: string;
}

const MAPS_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/maps/live/advanced";

function applyEnvFile(raw: string): void {
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    const colon = trimmed.indexOf(":");
    let key = "";
    let value = "";
    if (eq > 0 && (colon < 0 || eq < colon)) {
      key = trimmed.slice(0, eq).trim();
      value = trimmed.slice(eq + 1).trim();
    } else if (colon > 0) {
      key = trimmed.slice(0, colon).trim();
      value = trimmed.slice(colon + 1).trim();
    }
    key = key.replace(/^\d+\s+/, "");
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!key.startsWith("DATAFORSEO_") || !value || process.env[key]) continue;
    process.env[key] = value;
  }
}

function hydrateDataForSeoEnv(): void {
  const cwdEnv = path.join(process.cwd(), ".env");
  if (fs.existsSync(cwdEnv)) applyEnvFile(fs.readFileSync(cwdEnv, "utf8"));
  const workspaceEnv = path.join(WORKSPACE_ROOT, ".env");
  if (workspaceEnv !== cwdEnv && fs.existsSync(workspaceEnv)) {
    applyEnvFile(fs.readFileSync(workspaceEnv, "utf8"));
  }
}

function credential(primary: string, alias: string): string {
  return String(process.env[primary] || process.env[alias] || "").trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function competitorFromItem(item: Record<string, unknown>): LocalCompetitorMetric | null {
  const name = String(item.title || item.name || "").trim();
  if (!name) return null;
  const rating = asRecord(item.rating);
  const reviewCount = Number(rating.votes_count ?? item.reviews_count ?? item.review_count ?? 0);
  const score = Number(rating.value ?? rating.rating_value ?? item.rating ?? 0);
  return {
    name,
    reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
    rating: Number.isFinite(score) ? score : 0,
    address: String(item.address || item.snippet || "").trim(),
  };
}

export async function fetchLocalCompetitorMetrics(
  townCity: string,
  postcode: string,
): Promise<LocalCompetitorMetric[]> {
  hydrateDataForSeoEnv();
  const login = credential("DATAFORSEO_LOGIN", "DATAFORSEO_API_LOGIN");
  const password = credential("DATAFORSEO_PASSWORD", "DATAFORSEO_API_PASSWORD");
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are not configured");
  }

  const city = String(townCity || "").trim();
  const code = String(postcode || "").trim();
  const auth = Buffer.from(`${login}:${password}`, "utf8").toString("base64");
  const response = await fetchDataForSeo(MAPS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        keyword: `pharmacy ${code}`.trim(),
        location_name: `${city},England,United Kingdom`,
        language_code: "en",
        depth: 10,
      },
    ]),
  });

  const payload = asRecord(await response.json().catch(() => null));
  if (!response.ok) {
    const error = asRecord(payload.error);
    throw new Error(`DataForSEO maps request failed: ${String(error.message || response.status)}`);
  }

  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const task = asRecord(tasks[0]);
  const status = Number(task.status_code || 0);
  if (status && status !== 20000) {
    throw new Error(`DataForSEO maps task failed: ${String(task.status_message || status)}`);
  }

  const results = Array.isArray(task.result) ? task.result : [];
  const items = Array.isArray(asRecord(results[0]).items) ? (asRecord(results[0]).items as unknown[]) : [];
  const competitors: LocalCompetitorMetric[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (row.type && row.type !== "maps_search") continue;
    const competitor = competitorFromItem(row);
    if (competitor) competitors.push(competitor);
  }
  return competitors;
}
