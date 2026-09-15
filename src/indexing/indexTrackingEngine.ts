/**
 * Index Tracking Engine
 *
 * Uses the Google Search Console URL Inspection API to determine the precise
 * indexing status of each URL in the project's sitemap.
 *
 * Requires env var: GOOGLE_SERVICE_ACCOUNT_JSON
 *   A JSON string containing a Google service account key.  The service account
 *   must be added as a user (Full permission) inside Google Search Console for
 *   the property being checked.
 *
 * Safety constraints:
 *   - Default limit: 50 URLs per run   (configurable via options.limit)
 *   - Default delay: 300 ms between API calls (GSC quota: 2 000 req/day)
 *   - No parallel requests — always sequential
 *   - OAuth2 access token is obtained once and reused for the whole run.
 */

import fs   from "node:fs";
import path from "node:path";
import { createSign } from "node:crypto";
import type {
  IndexStatus,
  PageIndexRecord,
  IndexTrackingReport,
  IndexTrackingOptions,
} from "./indexTrackingTypes";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT    = 50;
const DEFAULT_DELAY_MS = 300;

const GSC_TOKEN_URL   = "https://oauth2.googleapis.com/token";
const GSC_INSPECT_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const GSC_SCOPE       = "https://www.googleapis.com/auth/webmasters.readonly";

// ─── File helpers ─────────────────────────────────────────────────────────────

function trackingPath(projectSlug: string, outputDir: string): string {
  return path.join(outputDir, projectSlug, "index-tracking.json");
}

export function readTrackingReport(
  projectSlug: string,
  outputDir = "output",
): IndexTrackingReport | null {
  const p = trackingPath(projectSlug, outputDir);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as IndexTrackingReport;
  } catch {
    return null;
  }
}

function writeTrackingReport(report: IndexTrackingReport, outputDir: string): void {
  const p = trackingPath(report.projectSlug, outputDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(report, null, 2), "utf8");
}


function loadRegistryUrls(projectSlug: string, outputDir = "output"): string[] {
  const registryFile = path.join(outputDir, projectSlug, "page-registry.json");
  if (!fs.existsSync(registryFile)) return [];

  try {
    const registry = JSON.parse(fs.readFileSync(registryFile, "utf8")) as {
      pages?: Array<{
        url?: string;
        status?: string;
        includedInSitemap?: boolean;
      }>;
    };

    const urls = (registry.pages ?? [])
      .filter(p => p.url && p.status === "live" && p.includedInSitemap !== false)
      .map(p => p.url as string);

    return [...new Set(urls)];
  } catch {
    return [];
  }
}


// ─── Sitemap URL loader ───────────────────────────────────────────────────────

/**
 * Reads the project's generated sitemap.xml and extracts all <loc> URLs.
 * Falls back to proof-log.json if no sitemap exists.
 */
export function loadSitemapUrls(projectSlug: string, outputDir = "output"): string[] {
  const projectDir = path.join(outputDir, projectSlug);

  // Prefer sitemap index when present
  const sitemapIndex = path.join(projectDir, "sitemap-index.xml");
  if (fs.existsSync(sitemapIndex)) {
    const indexXml = fs.readFileSync(sitemapIndex, "utf8");
    const childSitemaps = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(m => m[1].trim());

    const allUrls: string[] = [];

    for (const smUrl of childSitemaps) {
      const fileName = smUrl.split("/").pop();
      if (!fileName) continue;

      const localPath = path.join(projectDir, fileName);
      if (!fs.existsSync(localPath)) continue;

      const xml = fs.readFileSync(localPath, "utf8");
      const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map(m => m[1].trim());

      allUrls.push(...urls);
    }

    if (allUrls.length > 0) return [...new Set(allUrls)];
  }

  // Legacy single sitemap fallback
  const sitemapFile = path.join(projectDir, "sitemap.xml");
  if (fs.existsSync(sitemapFile)) {
    const xml = fs.readFileSync(sitemapFile, "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
    if (locs.length > 0) return locs;
  }

  const proofFile = path.join(projectDir, "proof-log.json");
  if (fs.existsSync(proofFile)) {
    try {
      const log = JSON.parse(fs.readFileSync(proofFile, "utf8")) as Array<{
        event: string;
        data: Record<string, unknown>;
      }>;
      const urls = log
        .filter(e => typeof e.data?.pageUrl === "string")
        .map(e => e.data.pageUrl as string);
      return [...new Set(urls)];
    } catch {}
  }

  return [];
}

// ─── Google Authentication — Service Account or OAuth2 ───────────────────────

interface ServiceAccount {
  client_email: string;
  private_key:  string;
}

// ── Service account (JWT) ────────────────────────────────────────────────────

function parseServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed as ServiceAccount;
  } catch {
    return null;
  }
}

function makeJwt(sa: ServiceAccount): string {
  const now     = Math.floor(Date.now() / 1000);
  const header  = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss:   sa.client_email,
    scope: GSC_SCOPE,
    aud:   GSC_TOKEN_URL,
    exp:   now + 3600,
    iat:   now,
  };
  const b64h  = Buffer.from(JSON.stringify(header)).toString("base64url");
  const b64p  = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const input = `${b64h}.${b64p}`;
  const sign  = createSign("RSA-SHA256");
  sign.update(input);
  return `${input}.${sign.sign(sa.private_key, "base64url")}`;
}

async function fetchAccessTokenViaServiceAccount(sa: ServiceAccount): Promise<string | null> {
  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion:  makeJwt(sa),
  });
  try {
    const res = await fetch(GSC_TOKEN_URL, {
      method: "POST", body: params,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!res.ok) {
      console.error(`[indexTracking] Service-account token error ${res.status}: ${await res.text().catch(() => "")}`);
      return null;
    }
    return ((await res.json()) as { access_token?: string }).access_token ?? null;
  } catch (err) {
    console.error("[indexTracking] Service-account token fetch failed:", err);
    return null;
  }
}

// ── OAuth2 refresh-token (personal Google account) ───────────────────────────

interface OAuthTokens { refresh_token: string }

function loadOAuthTokens(): OAuthTokens | null {
  // These paths must match exactly what gscAuth.ts writes to.
  const TOKEN_FILE       = "/tmp/.gsc-oauth-tokens.json";
  const DISCONNECTED_FILE = "/tmp/.gsc-oauth-disconnected";

  // If user explicitly disconnected via UI, suppress env var until they reconnect
  if (fs.existsSync(DISCONNECTED_FILE)) return null;

  // Token file (written by OAuth callback) takes priority over env var
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")) as OAuthTokens;
    }
  } catch { /* ignore corrupt file */ }

  const envToken = (process.env.GSC_OAUTH_REFRESH_TOKEN ?? "").trim();
  if (envToken) return { refresh_token: envToken };
  return null;
}

async function fetchAccessTokenViaOAuth(tokens: OAuthTokens): Promise<string | null> {
  const clientId     = (process.env.GSC_OAUTH_CLIENT_ID     ?? "").trim();
  const clientSecret = (process.env.GSC_OAUTH_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) {
    console.error("[indexTracking] GSC_OAUTH_CLIENT_ID or GSC_OAUTH_CLIENT_SECRET not set");
    return null;
  }
  try {
    const res = await fetch(GSC_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type:    "refresh_token",
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[indexTracking] OAuth refresh error ${res.status}: ${body}`);
      return null;
    }
    const json = JSON.parse(body) as { access_token?: string };
    return json.access_token ?? null;
  } catch (err) {
    console.error("[indexTracking] OAuth refresh failed:", err);
    return null;
  }
}

// ── Unified access-token resolver ─────────────────────────────────────────────

export type AuthMethod = "service_account" | "oauth" | "none";

export function detectAuthMethod(): AuthMethod {
  if (loadOAuthTokens())    return "oauth";
  if (parseServiceAccount()) return "service_account";
  return "none";
}

export async function fetchAccessToken(): Promise<string | null> {
  // OAuth personal account takes priority — service account can't be added to GSC
  const tokens = loadOAuthTokens();
  if (tokens) {
    console.log("[indexTracking] Auth: OAuth2 refresh token");
    return fetchAccessTokenViaOAuth(tokens);
  }
  const sa = parseServiceAccount();
  if (sa) {
    console.log("[indexTracking] Auth: service account");
    return fetchAccessTokenViaServiceAccount(sa);
  }
  return null;
}

// ─── GSC URL Inspection API ───────────────────────────────────────────────────

/**
 * Calls the GSC URL Inspection API for a single URL.
 *
 * coverageState meanings (from Google docs):
 *   "Submitted and indexed"              → indexed  ✓
 *   "Indexed, not submitted in sitemap"  → indexed  ✓
 *   "Crawled - currently not indexed"    → not_indexed
 *   "Discovered - currently not indexed" → not_indexed
 *   "Page with redirect"                 → not_indexed
 *   (anything else)                      → unknown
 *
 * verdict field:
 *   "PASS"    → indexed
 *   "FAIL"    → not_indexed
 *   "NEUTRAL" → not_indexed (excluded but not an error)
 *   "VERDICT_UNSPECIFIED" → unknown
 */
async function inspectUrl(
  url:         string,
  siteUrl:     string,
  accessToken: string,
): Promise<IndexStatus> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(GSC_INSPECT_URL, {
      method:  "POST",
      signal:  controller.signal,
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ inspectionUrl: url, siteUrl }),
    });
    clearTimeout(timeout);

    if (res.status === 403) {
      console.error(`[indexTracking] 403 — GSC account does not have access to property: ${siteUrl}`);
      return "property_not_found";
    }
    if (!res.ok) {
      console.error(`[indexTracking] GSC API error ${res.status} for ${url}`);
      return "unknown";
    }

    const data = await res.json() as {
      inspectionResult?: {
        indexStatusResult?: {
          verdict?:       string;
          coverageState?: string;
        };
      };
    };

    const verdict       = data.inspectionResult?.indexStatusResult?.verdict;
    const coverageState = data.inspectionResult?.indexStatusResult?.coverageState ?? "";

    if (verdict === "PASS") return "indexed";

    if (
      coverageState === "Submitted and indexed" ||
      coverageState === "Indexed, not submitted in sitemap"
    ) return "indexed";

    if (
      verdict === "FAIL" ||
      verdict === "NEUTRAL" ||
      coverageState.includes("not indexed") ||
      coverageState.includes("redirect") ||
      coverageState.includes("not crawled") ||
      coverageState === "Excluded"
    ) return "not_indexed";

    return "unknown";
  } catch (err) {
    clearTimeout(timeout);
    const msg = (err as Error).message ?? "";
    if (msg.includes("abort")) return "unknown";
    console.error(`[indexTracking] inspectUrl error for ${url}:`, err);
    return "unknown";
  }
}

// ─── Delay helper ─────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main engine ──────────────────────────────────────────────────────────────

/**
 * Run the index tracking check for a project.
 *
 * - Loads URLs from output/<projectSlug>/sitemap.xml
 * - Checks each URL via the GSC URL Inspection API
 * - Merges results with any existing tracking data (preserves firstDetectedIndexedAt)
 * - Writes output/<projectSlug>/index-tracking.json
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON env var.  If absent, all URLs are
 * returned with status "unknown" and a clear error is thrown.
 */
export async function runIndexTracking(
  projectSlug: string,
  options:     IndexTrackingOptions & { outputDir?: string } = {},
): Promise<IndexTrackingReport> {
  const limit       = options.limit       ?? DEFAULT_LIMIT;
  const delayMs     = options.delayMs     ?? DEFAULT_DELAY_MS;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 5, 10));
  const outputDir   = options.outputDir   ?? "output";

  const registryUrls = loadRegistryUrls(projectSlug, outputDir);
  const allUrls = registryUrls.length > 0 ? registryUrls : loadSitemapUrls(projectSlug, outputDir);
  if (allUrls.length === 0) {
    throw new Error(
      `No URLs found for project "${projectSlug}". ` +
      `Run the sitemap engine first to generate output/${projectSlug}/sitemap.xml.`,
    );
  }

  // ── Authenticate ──────────────────────────────────────────────────────────
  const authMethod = detectAuthMethod();
  if (authMethod === "none") {
    throw new Error(
      "No Google credentials configured. " +
      "Connect Google Search Console via the 'Connect Google Account' button in Stage 8.",
    );
  }

  console.log("[indexTracking] Fetching Google access token…");
  const accessToken = await fetchAccessToken();
  if (!accessToken) {
    throw new Error(
      "Failed to obtain a Google access token. " +
      "Try disconnecting and reconnecting Google Search Console.",
    );
  }
  console.log("[indexTracking] Access token obtained ✓");

  // ── Load existing records ─────────────────────────────────────────────────
  const existing    = readTrackingReport(projectSlug, outputDir);
  const existingMap = new Map<string, PageIndexRecord>(
    (existing?.records ?? []).map(r => [r.url, r]),
  );

  // ── Determine site URL (GSC property) ────────────────────────────────────
  // The siteUrl must match the verified GSC property exactly.
  // GSC supports two formats:
  //   URL prefix:    https://example.com/
  //   Domain:        sc-domain:example.com
  // We try the URL prefix first; if we get 403 we fall back to domain format.
  let siteUrl = "";
  let hostname = "";
  try {
    const parsed = new URL(allUrls[0]);
    hostname = parsed.hostname;
    siteUrl = `${parsed.protocol}//${hostname}/`;
  } catch {
    throw new Error(`Cannot parse site URL from: ${allUrls[0]}`);
  }

  // Auto-detect the correct GSC property format with a probe on the first URL
  const probeStatus = await inspectUrl(allUrls[0], siteUrl, accessToken);
  if (probeStatus === "property_not_found" && hostname) {
    const domainSiteUrl = `sc-domain:${hostname}`;
    console.log(`[indexTracking] URL prefix property not found, trying domain property: ${domainSiteUrl}`);
    siteUrl = domainSiteUrl;
  }

  const urlsToCheck = allUrls.slice(0, limit);
  const skipped     = allUrls.slice(limit);

  console.log(
    `[indexTracking] Checking ${urlsToCheck.length} URLs via GSC URL Inspection API` +
    (skipped.length ? ` (${skipped.length} deferred — limit=${limit})` : "") +
    ` for site: ${siteUrl}`,
  );

  const now     = new Date().toISOString();
  const records: PageIndexRecord[] = [];

  // ── Parallel batch checking ────────────────────────────────────────────────
  // Split URLs into batches of `concurrency` and check each batch in parallel.
  // The probe result for URL[0] is reused to avoid an extra API call.
  // A small delay between batches keeps us well under GSC's quota.

  for (let batchStart = 0; batchStart < urlsToCheck.length; batchStart += concurrency) {
    if (batchStart > 0) await delay(delayMs);

    const batch = urlsToCheck.slice(batchStart, batchStart + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (url, localIdx) => {
        const globalIdx = batchStart + localIdx;
        console.log(`[indexTracking] [${globalIdx + 1}/${urlsToCheck.length}] ${url}`);

        // Reuse probe result for the very first URL to save one API call
        const rawStatus = (globalIdx === 0 && probeStatus !== "property_not_found")
          ? probeStatus
          : await inspectUrl(url, siteUrl, accessToken);

        const status: IndexStatus = rawStatus === "property_not_found" ? "unknown" : rawStatus;
        console.log(`[indexTracking]   → ${url} : ${status}`);
        return { url, status };
      }),
    );

    for (const { url, status } of batchResults) {
      const prev = existingMap.get(url);

      const firstDetected =
        status === "indexed" && prev?.status !== "indexed"
          ? now
          : (prev?.firstDetectedIndexedAt ?? null);

      records.push({
        url,
        status,
        lastCheckedAt:          now,
        firstDetectedIndexedAt: firstDetected,
      });
    }
  }

  // Carry forward any URLs not checked this run
  for (const url of skipped) {
    const prev = existingMap.get(url);
    records.push(
      prev ?? {
        url,
        status:                 "unknown" as IndexStatus,
        lastCheckedAt:          null,
        firstDetectedIndexedAt: null,
      },
    );
  }

  const indexedCount    = records.filter(r => r.status === "indexed").length;
  const notIndexedCount = records.filter(r => r.status === "not_indexed").length;
  const unknownCount    = records.filter(r => r.status === "unknown").length;

  const report: IndexTrackingReport = {
    projectSlug,
    runAt:          now,
    totalChecked:   urlsToCheck.length,
    indexedCount,
    notIndexedCount,
    unknownCount,
    records,
  };

  writeTrackingReport(report, outputDir);
  return report;
}
