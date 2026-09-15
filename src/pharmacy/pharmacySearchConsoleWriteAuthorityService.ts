/**
 * Search Console write authority + tenant-safe managed property verification.
 *
 * Allowed Google calls: OAuth token refresh (scope evidence) and sites.list.
 * Forbidden: sitemap submit, URL submit, Indexing API, URL Inspection.
 */
import fs from "node:fs";
import path from "node:path";
import {
  GSC_OAUTH_CALLBACK_URL,
  GSC_OAUTH_SCOPE_READONLY,
  GSC_OAUTH_SCOPE_WRITE,
  buildSearchConsoleAuthUrl,
  loadOAuthTokenRecord,
  persistGrantedOauthScope,
  type GscOAuthTokenRecord,
} from "../../artifacts/api-server/src/routes/api/gscAuth.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";

export const GSC_SITES_LIST_HTTP = "GET https://www.googleapis.com/webmasters/v3/sites";
export const GSC_SITES_LIST_URL = "https://www.googleapis.com/webmasters/v3/sites";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_INDEXING_API_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";
export const GSC_SITEMAPS_HTTP = "PUT https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}";

export const searchConsoleAuthorityTelemetry = {
  tokenRefreshCalls: 0,
  sitesListCalls: 0,
  sitemapSubmitCalls: 0,
  indexingApiCalls: 0,
  lastGoogleTarget: null as string | null,
};

export function resetSearchConsoleAuthorityTelemetry(): void {
  searchConsoleAuthorityTelemetry.tokenRefreshCalls = 0;
  searchConsoleAuthorityTelemetry.sitesListCalls = 0;
  searchConsoleAuthorityTelemetry.sitemapSubmitCalls = 0;
  searchConsoleAuthorityTelemetry.indexingApiCalls = 0;
  searchConsoleAuthorityTelemetry.lastGoogleTarget = null;
}

export type SearchConsolePermissionLevel =
  | "siteOwner"
  | "siteFullUser"
  | "siteRestrictedUser"
  | "siteUnverifiedUser"
  | "unknown";

export interface SearchConsoleSiteEntry {
  siteUrl: string;
  permissionLevel: string;
}

export interface SearchConsoleGoogleClient {
  refreshScope(refreshToken: string): Promise<{ scope: string }>;
  listSites(accessProof: { refreshToken: string }): Promise<SearchConsoleSiteEntry[]>;
}

export interface ManagedPropertyAuthority {
  requestedProperty: string;
  matchedProperty: string | null;
  permissionLevel: string | null;
  propertyVerified: boolean;
  permissionSufficient: boolean;
  missingExactUrlPrefix: boolean;
  rejectedCustomerWebsite: string | null;
  rejectedPlatformWideDomainProperty: string | null;
  rejectedCrossTenant: string[];
  relevantProperties: SearchConsoleSiteEntry[];
  setupRequired: boolean;
  setupHint: string;
}

export interface SearchConsoleWriteAuthority {
  connected: boolean;
  requestedScope: typeof GSC_OAUTH_SCOPE_WRITE;
  grantedScope: string | null;
  grantedScopeProvenByGoogle: boolean;
  writeAuthorized: boolean;
  reconnectRequired: boolean;
  reconnectUrl: string;
  callbackUrl: string;
  canSubmitSitemaps: boolean;
  propertyVerified: boolean;
  permissionStatus: "write_enabled" | "readonly_insufficient_for_sitemap_submit" | "scope_unproven" | "none";
  submissionPermissionLabel: "Write authorised" | "Reconnect required";
  connectedLabel: "Connected" | "Not connected";
  managedPropertyLabel: "Verified" | "Not verified";
  externalSubmissionLabel: "Ready" | "Blocked";
  liveSubmitKillSwitchEnabled: boolean;
  liveGoogleCalls: {
    tokenRefresh: boolean;
    sitesList: boolean;
    sitemapSubmit: boolean;
    indexingApi: boolean;
  };
  property: ManagedPropertyAuthority;
  error?: string;
}

const SUFFICIENT_PERMISSIONS = new Set(["siteOwner", "siteFullUser"]);

function str(value: unknown): string {
  return String(value || "").trim();
}

function safeSlug(slug: string): string {
  return (
    str(slug)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

function splitScopes(scope: string | null | undefined): string[] {
  return str(scope)
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isWriteOauthScope(scope: string | null | undefined): boolean {
  const scopes = splitScopes(scope);
  return scopes.includes(GSC_OAUTH_SCOPE_WRITE);
}

export function isReadonlyOnlyOauthScope(scope: string | null | undefined): boolean {
  const scopes = splitScopes(scope);
  return scopes.includes(GSC_OAUTH_SCOPE_READONLY) && !scopes.includes(GSC_OAUTH_SCOPE_WRITE);
}

export function reconnectUrlForSlug(slug: string, authHandoff?: string | null): string {
  const params = new URLSearchParams({ returnSlug: safeSlug(slug) });
  if (str(authHandoff)) params.set("_t", str(authHandoff));
  return `/api/gsc/auth/start?${params.toString()}`;
}

export function authoritySnapshotPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-search-console-authority", `${safeSlug(slug)}.json`);
}

export function isPharmacyGscSitemapSubmitEnabled(): boolean {
  return process.env.PHARMACY_GSC_SITEMAP_SUBMIT_ENABLED === "true";
}

export function normalizeSearchConsoleProperty(siteUrl: string): string {
  const raw = str(siteUrl);
  if (!raw) return "";
  if (raw.toLowerCase().startsWith("sc-domain:")) {
    return `sc-domain:${raw.slice("sc-domain:".length).toLowerCase()}`;
  }
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const pathname = parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}`;
  } catch {
    return raw.toLowerCase();
  }
}

function hostOf(siteUrl: string): string {
  const normalized = normalizeSearchConsoleProperty(siteUrl);
  if (normalized.startsWith("sc-domain:")) return normalized.slice("sc-domain:".length);
  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function evaluateManagedPropertyAuthority(input: {
  slug: string;
  requestedProperty: string;
  sites: SearchConsoleSiteEntry[];
  customerWebsite?: string | null;
}): ManagedPropertyAuthority {
  const slug = safeSlug(input.slug);
  const requested = normalizeSearchConsoleProperty(input.requestedProperty);
  const requestedHost = hostOf(requested);
  const customer = normalizeSearchConsoleProperty(str(input.customerWebsite));
  const customerHost = hostOf(customer);
  const platformWide = "sc-domain:sites.pharmaconnect.uk";
  const relevant: SearchConsoleSiteEntry[] = [];
  const rejectedCrossTenant: string[] = [];
  let matched: SearchConsoleSiteEntry | null = null;
  let rejectedCustomer: string | null = null;
  let rejectedPlatform: string | null = null;

  for (const entry of input.sites) {
    const siteUrl = normalizeSearchConsoleProperty(entry.siteUrl);
    const host = hostOf(siteUrl);
    const isExact = siteUrl === requested;
    const isPlatformWide = siteUrl === platformWide;
    const isCustomer =
      Boolean(customerHost) &&
      (host === customerHost || siteUrl === `sc-domain:${customerHost.replace(/^www\./, "")}` || siteUrl === customer);
    const isCrossTenant =
      host.endsWith(".sites.pharmaconnect.uk") && host !== requestedHost && !isPlatformWide;
    if (isExact || isPlatformWide || isCustomer || isCrossTenant) {
      relevant.push({ siteUrl, permissionLevel: entry.permissionLevel });
    }
    if (isExact) matched = { siteUrl, permissionLevel: entry.permissionLevel };
    if (isCustomer) rejectedCustomer = siteUrl;
    if (isPlatformWide) rejectedPlatform = siteUrl;
    if (isCrossTenant) rejectedCrossTenant.push(siteUrl);
  }

  const permissionLevel = matched?.permissionLevel || null;
  const permissionSufficient = Boolean(permissionLevel && SUFFICIENT_PERMISSIONS.has(permissionLevel));
  const propertyVerified = Boolean(matched && permissionSufficient);
  const setupRequired = !matched;

  return {
    requestedProperty: requested,
    matchedProperty: matched?.siteUrl || null,
    permissionLevel,
    propertyVerified,
    permissionSufficient,
    missingExactUrlPrefix: !matched,
    rejectedCustomerWebsite: rejectedCustomer,
    rejectedPlatformWideDomainProperty: rejectedPlatform,
    rejectedCrossTenant,
    relevantProperties: relevant,
    setupRequired,
    setupHint: setupRequired
      ? `Add a URL-prefix property in Search Console for ${requested} and verify ownership on that managed host. Do not use the customer website or ${platformWide} as the tenant submission property.`
      : permissionSufficient
        ? `Exact URL-prefix property ${requested} is present with ${permissionLevel} permission.`
        : `Exact URL-prefix property ${requested} is present but permission ${permissionLevel || "unknown"} is insufficient for sitemap submission.`,
  };
}

function classifyConnection(record: GscOAuthTokenRecord | null, grantedScope: string | null, proven: boolean): {
  connected: boolean;
  writeAuthorized: boolean;
  reconnectRequired: boolean;
  permissionStatus: SearchConsoleWriteAuthority["permissionStatus"];
} {
  const connected = Boolean(record?.refresh_token);
  if (!connected) {
    return {
      connected: false,
      writeAuthorized: false,
      reconnectRequired: true,
      permissionStatus: "none",
    };
  }
  if (!proven || !grantedScope) {
    return {
      connected: true,
      writeAuthorized: false,
      reconnectRequired: true,
      permissionStatus: "scope_unproven",
    };
  }
  if (isWriteOauthScope(grantedScope)) {
    return {
      connected: true,
      writeAuthorized: true,
      reconnectRequired: false,
      permissionStatus: "write_enabled",
    };
  }
  return {
    connected: true,
    writeAuthorized: false,
    reconnectRequired: true,
    permissionStatus: isReadonlyOnlyOauthScope(grantedScope)
      ? "readonly_insufficient_for_sitemap_submit"
      : "scope_unproven",
  };
}

export function readSearchConsoleAuthoritySnapshot(slug: string): SearchConsoleWriteAuthority | null {
  const file = authoritySnapshotPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as SearchConsoleWriteAuthority;
  } catch {
    return null;
  }
}

function writeSnapshot(slug: string, doc: SearchConsoleWriteAuthority): void {
  const file = authoritySnapshotPath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(doc, null, 2), "utf8");
}

export function buildLocalSearchConsoleWriteAuthority(input: {
  slug: string;
  requestedProperty: string;
  customerWebsite?: string | null;
  authHandoff?: string | null;
  tokenRecord?: GscOAuthTokenRecord | null;
  snapshot?: SearchConsoleWriteAuthority | null;
}): SearchConsoleWriteAuthority {
  const slug = safeSlug(input.slug);
  const tokenRecord = input.tokenRecord === undefined ? loadOAuthTokenRecord() : input.tokenRecord;
  const snapshot = input.snapshot === undefined ? readSearchConsoleAuthoritySnapshot(slug) : input.snapshot;
  const grantedScope = str(tokenRecord?.granted_scope) || snapshot?.grantedScope || null;
  const proven = tokenRecord?.granted_scope_source === "google_token_response" || snapshot?.grantedScopeProvenByGoogle === true;
  const classified = classifyConnection(tokenRecord, grantedScope, proven);
  const property =
    snapshot?.property && snapshot.property.requestedProperty === normalizeSearchConsoleProperty(input.requestedProperty)
      ? snapshot.property
      : evaluateManagedPropertyAuthority({
          slug,
          requestedProperty: input.requestedProperty,
          sites: snapshot?.property.relevantProperties || [],
          customerWebsite: input.customerWebsite,
        });
  const canSubmitSitemaps = classified.writeAuthorized && property.propertyVerified;
  return {
    connected: classified.connected,
    requestedScope: GSC_OAUTH_SCOPE_WRITE,
    grantedScope,
    grantedScopeProvenByGoogle: proven,
    writeAuthorized: classified.writeAuthorized,
    reconnectRequired: classified.reconnectRequired,
    reconnectUrl: reconnectUrlForSlug(slug, input.authHandoff),
    callbackUrl: GSC_OAUTH_CALLBACK_URL(),
    canSubmitSitemaps,
    propertyVerified: property.propertyVerified,
    permissionStatus: classified.permissionStatus,
    submissionPermissionLabel: classified.writeAuthorized ? "Write authorised" : "Reconnect required",
    connectedLabel: classified.connected ? "Connected" : "Not connected",
    managedPropertyLabel: property.propertyVerified ? "Verified" : "Not verified",
    externalSubmissionLabel: canSubmitSitemaps ? "Ready" : "Blocked",
    liveSubmitKillSwitchEnabled: isPharmacyGscSitemapSubmitEnabled(),
    liveGoogleCalls: snapshot?.liveGoogleCalls || {
      tokenRefresh: false,
      sitesList: false,
      sitemapSubmit: false,
      indexingApi: false,
    },
    property,
    error: snapshot?.error,
  };
}

function assertVerificationOnlyGoogleCall(method: string, url: string): void {
  if (/sitemaps/i.test(url) || /urlNotifications/i.test(url) || /indexing\.googleapis/i.test(url) || /urlInspection/i.test(url)) {
    if (/sitemaps/i.test(url)) searchConsoleAuthorityTelemetry.sitemapSubmitCalls += 1;
    if (/urlNotifications|indexing\.googleapis|urlInspection/i.test(url)) searchConsoleAuthorityTelemetry.indexingApiCalls += 1;
    throw new Error(`Refused Google call outside connection/property verification: ${method} ${url}`);
  }
}

async function defaultRefreshScope(refreshToken: string): Promise<{ scope: string; accessToken?: string }> {
  assertVerificationOnlyGoogleCall("POST", GOOGLE_TOKEN_URL);
  searchConsoleAuthorityTelemetry.tokenRefreshCalls += 1;
  searchConsoleAuthorityTelemetry.lastGoogleTarget = GOOGLE_TOKEN_URL;
  const clientId = str(process.env.GSC_OAUTH_CLIENT_ID);
  const clientSecret = str(process.env.GSC_OAUTH_CLIENT_SECRET);
  if (!clientId || !clientSecret) throw new Error("Search Console OAuth client is not configured");
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json() as { scope?: string; access_token?: string; error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(body.error_description || body.error || `OAuth refresh failed (${res.status})`);
  }
  return { scope: str(body.scope), accessToken: body.access_token };
}

async function defaultListSites(accessToken: string): Promise<SearchConsoleSiteEntry[]> {
  assertVerificationOnlyGoogleCall("GET", GSC_SITES_LIST_URL);
  searchConsoleAuthorityTelemetry.sitesListCalls += 1;
  searchConsoleAuthorityTelemetry.lastGoogleTarget = GSC_SITES_LIST_URL;
  const res = await fetch(GSC_SITES_LIST_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const body = await res.json() as { siteEntry?: SearchConsoleSiteEntry[]; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(body.error?.message || `Search Console sites.list failed (${res.status})`);
  }
  return Array.isArray(body.siteEntry) ? body.siteEntry : [];
}

export async function verifyPharmacySearchConsoleWriteAuthority(input: {
  slug: string;
  requestedProperty: string;
  customerWebsite?: string | null;
  authHandoff?: string | null;
  liveGoogle?: boolean;
  persist?: boolean;
  tokenRecord?: GscOAuthTokenRecord | null;
  googleClient?: SearchConsoleGoogleClient;
  sites?: SearchConsoleSiteEntry[];
  grantedScope?: string | null;
  grantedScopeProvenByGoogle?: boolean;
}): Promise<SearchConsoleWriteAuthority> {
  const slug = safeSlug(input.slug);
  const tokenRecord = input.tokenRecord === undefined ? loadOAuthTokenRecord() : input.tokenRecord;
  let grantedScope = input.grantedScope ?? tokenRecord?.granted_scope ?? null;
  let proven = input.grantedScopeProvenByGoogle ?? tokenRecord?.granted_scope_source === "google_token_response";
  let sites = input.sites;
  const live = input.liveGoogle === true;
  const liveGoogleCalls = {
    tokenRefresh: false,
    sitesList: false,
    sitemapSubmit: false,
    indexingApi: false,
  };

  if (live) {
    if (!tokenRecord?.refresh_token) {
      const local = buildLocalSearchConsoleWriteAuthority({
        slug,
        requestedProperty: input.requestedProperty,
        customerWebsite: input.customerWebsite,
        authHandoff: input.authHandoff,
        tokenRecord,
      });
      local.error = "Search Console is not connected";
      if (input.persist !== false) writeSnapshot(slug, local);
      return local;
    }
    try {
      if (input.googleClient) {
        liveGoogleCalls.tokenRefresh = true;
        const refreshed = await input.googleClient.refreshScope(tokenRecord.refresh_token);
        grantedScope = refreshed.scope;
        proven = true;
        liveGoogleCalls.sitesList = true;
        sites = await input.googleClient.listSites({ refreshToken: tokenRecord.refresh_token });
      } else {
        const refreshed = await defaultRefreshScope(tokenRecord.refresh_token);
        grantedScope = refreshed.scope;
        proven = true;
        if (input.persist !== false) persistGrantedOauthScope(grantedScope);
        liveGoogleCalls.tokenRefresh = true;
        if (!refreshed.accessToken) throw new Error("OAuth refresh did not return an access token");
        liveGoogleCalls.sitesList = true;
        sites = await defaultListSites(refreshed.accessToken);
      }
    } catch (err) {
      const local = buildLocalSearchConsoleWriteAuthority({
        slug,
        requestedProperty: input.requestedProperty,
        customerWebsite: input.customerWebsite,
        authHandoff: input.authHandoff,
        tokenRecord: {
          refresh_token: tokenRecord.refresh_token,
          granted_scope: grantedScope || undefined,
          granted_scope_source: proven ? "google_token_response" : tokenRecord.granted_scope_source,
        },
      });
      local.liveGoogleCalls = liveGoogleCalls;
      local.error = err instanceof Error ? err.message : String(err);
      if (input.persist !== false) writeSnapshot(slug, local);
      return local;
    }
  }

  const classified = classifyConnection(tokenRecord, grantedScope, Boolean(proven && grantedScope));
  const property = evaluateManagedPropertyAuthority({
    slug,
    requestedProperty: input.requestedProperty,
    sites: sites || [],
    customerWebsite: input.customerWebsite,
  });
  const canSubmitSitemaps = classified.writeAuthorized && property.propertyVerified;
  const result: SearchConsoleWriteAuthority = {
    connected: classified.connected,
    requestedScope: GSC_OAUTH_SCOPE_WRITE,
    grantedScope,
    grantedScopeProvenByGoogle: Boolean(proven && grantedScope),
    writeAuthorized: classified.writeAuthorized,
    reconnectRequired: classified.reconnectRequired,
    reconnectUrl: reconnectUrlForSlug(slug, input.authHandoff),
    callbackUrl: GSC_OAUTH_CALLBACK_URL(),
    canSubmitSitemaps,
    propertyVerified: property.propertyVerified,
    permissionStatus: classified.permissionStatus,
    submissionPermissionLabel: classified.writeAuthorized ? "Write authorised" : "Reconnect required",
    connectedLabel: classified.connected ? "Connected" : "Not connected",
    managedPropertyLabel: property.propertyVerified ? "Verified" : "Not verified",
    externalSubmissionLabel: canSubmitSitemaps ? "Ready" : "Blocked",
    liveSubmitKillSwitchEnabled: isPharmacyGscSitemapSubmitEnabled(),
    liveGoogleCalls,
    property,
  };
  if (input.persist !== false && (live || sites)) writeSnapshot(slug, result);
  return result;
}
