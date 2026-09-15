/**
 * External indexing submission pre-flight for ordinary pharmacy/service/locality pages.
 *
 * Appropriate Google mechanism:
 *   Search Console Sitemaps API
 *   PUT https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}
 *   (googleapis: webmasters.sitemaps.submit)
 *
 * Forbidden for these pages:
 *   Google Indexing API  POST https://indexing.googleapis.com/v3/urlNotifications:publish
 *
 * Status evidence (not submission):
 *   Search Console URL Inspection API
 *   POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect
 *
 * Live Google calls are disabled unless PHARMACY_GSC_SITEMAP_SUBMIT_ENABLED=true
 * AND mode=live AND confirmExternal=true. Dry-run is the default.
 */
import fs from "node:fs";
import path from "node:path";
import { detectAuthMethod } from "../indexing/indexTrackingEngine.ts";
import {
  GSC_OAUTH_SCOPE_READONLY,
  GSC_OAUTH_SCOPE_WRITE,
  loadOAuthTokenRecord,
} from "../../artifacts/api-server/src/routes/api/gscAuth.ts";
import {
  buildLocalSearchConsoleWriteAuthority,
  isPharmacyGscSitemapSubmitEnabled as writeAuthorityKillSwitch,
  isWriteOauthScope,
} from "./pharmacySearchConsoleWriteAuthorityService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  canonicalUrlForIndexing,
  resolveAuthoritativePublicationCanonical,
} from "./pharmacyPublicationCanonicalAuthority.ts";
import {
  evaluateIndexingRegistrationCandidate,
  indexingBridgeTelemetry,
  readPharmacyRegistry,
  resolveCurrentIndexingServiceId,
  type IndexingCandidateInspection,
  type PharmacyRegistryPage,
} from "./pharmacyIndexingBridgeService.ts";
import {
  auditPublishedTechnicalSeo,
  loadTechnicalSeoAudit,
  type TechnicalSeoCampaignAudit,
} from "./pharmacyTechnicalSeoAuditService.ts";
import type { TechnicalSeoIndexGateResult } from "./pharmacyTechnicalSeoIndexGate.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";

export const GOOGLE_INDEXING_API_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";
export const GSC_SITEMAPS_API_METHOD = "webmasters.sitemaps.submit";
export const GSC_SITEMAPS_HTTP = "PUT https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}";
export const GSC_URL_INSPECTION_API = "POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
export const GSC_OAUTH_SCOPE_CURRENT = GSC_OAUTH_SCOPE_READONLY;
export const GSC_OAUTH_SCOPE_REQUIRED_FOR_SITEMAP_SUBMIT = GSC_OAUTH_SCOPE_WRITE;

export const externalIndexingTelemetry = {
  googleRequests: 0,
  sitemapSubmitCalls: 0,
  urlInspectionCalls: 0,
  indexingApiCalls: 0,
  lastGoogleTarget: null as string | null,
};

export function resetExternalIndexingTelemetry(): void {
  externalIndexingTelemetry.googleRequests = 0;
  externalIndexingTelemetry.sitemapSubmitCalls = 0;
  externalIndexingTelemetry.urlInspectionCalls = 0;
  externalIndexingTelemetry.indexingApiCalls = 0;
  externalIndexingTelemetry.lastGoogleTarget = null;
}

export function isPharmacyGscSitemapSubmitEnabled(): boolean {
  return writeAuthorityKillSwitch();
}

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

function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeIndexingUrl(url: string): string {
  const raw = str(url);
  if (!raw) return "";
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    parsed.hash = "";
    parsed.search = "";
    const pathname = parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}`;
  } catch {
    return raw;
  }
}

function managedHostFor(slug: string): string {
  return `${safeSlug(slug)}.sites.pharmaconnect.uk`;
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function parseSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map((match) => normalizeIndexingUrl(match[1] || ""))
    .filter(Boolean);
}

function profileWebsiteFromDisk(slug: string): string {
  const profile = readJson<{ data?: { website?: string } }>(
    path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${safeSlug(slug)}.json`),
  );
  return str(profile?.data?.website);
}

function projectConfigDomain(slug: string): string {
  const file = path.join(WORKSPACE_ROOT, "config", "projects", `${safeSlug(slug)}.json`);
  const doc = readJson<{ domain?: string }>(file);
  return str(doc?.domain);
}

export function resolvePharmacySearchConsoleProperty(
  slug: string,
  serviceId: string,
): {
  property: string;
  propertyType: "url_prefix";
  managedHost: string;
  managedOrigin: string;
  sitemapUrl: string;
  rejectedCustomerWebsite: string | null;
  rejectedProjectDomain: string | null;
  rejectedPlatformWideDomainProperty: string | null;
  tenantSafe: boolean;
} {
  const safe = safeSlug(slug);
  const authority = resolveAuthoritativePublicationCanonical({
    slug: safe,
    serviceId,
    publicPath: `/${serviceId}/`,
    profileWebsite: profileWebsiteFromDisk(safe),
  });
  const managedHost = hostOf(authority.managedPublicUrl) || managedHostFor(safe);
  const managedOrigin = `https://${managedHost}/`;
  const customer = profileWebsiteFromDisk(safe);
  const projectDomain = projectConfigDomain(safe);
  const customerHost = hostOf(customer);
  const projectHost = hostOf(projectDomain);
  const platformWide = `sc-domain:sites.pharmaconnect.uk`;
  return {
    property: managedOrigin,
    propertyType: "url_prefix",
    managedHost,
    managedOrigin,
    sitemapUrl: `${managedOrigin.replace(/\/$/, "")}/sitemap.xml`,
    rejectedCustomerWebsite: customerHost && customerHost !== managedHost ? customer : null,
    rejectedProjectDomain: projectHost && projectHost !== managedHost ? projectDomain : null,
    rejectedPlatformWideDomainProperty: platformWide,
    tenantSafe: managedHost === managedHostFor(safe) && !managedHost.startsWith("www."),
  };
}

export function readPharmacySearchConsoleConnection(): {
  connected: boolean;
  authMethod: "oauth" | "service_account" | "none";
  oauthScope: string;
  requestedScope: string;
  canSubmitSitemaps: boolean;
  tokenFilePresent: boolean;
  disconnected: boolean;
  reconnectRequired: boolean;
  propertyOwnershipVerified: boolean;
  permissionStatus: "readonly_insufficient_for_sitemap_submit" | "none" | "write_enabled" | "scope_unproven";
} {
  const disconnected = fs.existsSync("/tmp/.gsc-oauth-disconnected");
  const tokenFilePresent = fs.existsSync("/tmp/.gsc-oauth-tokens.json");
  const oauthTokens = disconnected ? null : loadOAuthTokenRecord();
  const authMethod = detectAuthMethod();
  const connected = Boolean(oauthTokens?.refresh_token) || authMethod === "service_account";
  const granted = oauthTokens?.granted_scope || "";
  const proven = oauthTokens?.granted_scope_source === "google_token_response";
  const writeAuthorized = proven && isWriteOauthScope(granted);
  const reconnectRequired = !writeAuthorized;
  const permissionStatus = !connected
    ? "none"
    : writeAuthorized
      ? "write_enabled"
      : proven
        ? "readonly_insufficient_for_sitemap_submit"
        : "scope_unproven";
  return {
    connected,
    authMethod: connected ? (oauthTokens?.refresh_token ? "oauth" : authMethod) : "none",
    oauthScope: granted || (connected ? "unproven" : ""),
    requestedScope: GSC_OAUTH_SCOPE_REQUIRED_FOR_SITEMAP_SUBMIT,
    canSubmitSitemaps: writeAuthorized,
    tokenFilePresent: tokenFilePresent && !disconnected,
    disconnected,
    reconnectRequired,
    propertyOwnershipVerified: false,
    permissionStatus,
  };
}

export type SubmissionRejectReason =
  | "not_registered"
  | "unpublished"
  | "homepage_redirect"
  | "noindex"
  | "technical_seo_blocker"
  | "canonical_mismatch"
  | "unavailable"
  | "stale_service"
  | "cross_tenant"
  | "cross_service"
  | "customer_website"
  | "placeholder_host"
  | "already_submitted"
  | "not_eligible";

export interface SubmissionCandidateDecision {
  url: string;
  accepted: boolean;
  reason: SubmissionRejectReason | null;
  registered: boolean;
  alreadySubmitted: boolean;
}

export interface SearchConsolePreflight {
  connected: boolean;
  authMethod: string;
  oauthScope: string;
  requestedScope: string;
  canSubmitSitemaps: boolean;
  reconnectRequired: boolean;
  writeAuthorized: boolean;
  property: string;
  propertyType: "url_prefix";
  propertyCoversManagedHost: boolean;
  propertyOwnershipVerified: boolean;
  permissionStatus: string;
  tenantSafe: boolean;
  rejectedCustomerWebsite: string | null;
  rejectedProjectDomain: string | null;
  submissionPermissionLabel: "Write authorised" | "Reconnect required";
  connectedLabel: "Connected" | "Not connected";
  managedPropertyLabel: "Verified" | "Not verified";
  externalSubmissionLabel: "Ready" | "Blocked";
}

export interface ExternalIndexingPreflight {
  slug: string;
  serviceId: string;
  campaignId: string | null;
  mechanism: typeof GSC_SITEMAPS_API_METHOD;
  googleApi: typeof GSC_SITEMAPS_HTTP;
  indexingApiForbidden: typeof GOOGLE_INDEXING_API_URL;
  urlInspectionApi: typeof GSC_URL_INSPECTION_API;
  mechanismAppropriateForOrdinaryPages: true;
  searchConsole: SearchConsolePreflight;
  sitemapUrl: string;
  sitemapUrls: string[];
  sitemapCount: number;
  sitemapMatchesCandidates: boolean;
  candidates: string[];
  candidateCount: number;
  skipped: SubmissionCandidateDecision[];
  liveSubmitAllowed: boolean;
  liveSubmitBlockedReasons: string[];
  duplicateProtection: "skip_already_submitted";
  partialFailureBehaviour: "sitemap_submit_is_atomic_no_url_marked_submitted_on_google_failure";
  indexedEvidence: "search_console_url_inspection_only";
}

export interface GoogleSitemapSubmitAdapter {
  submitSitemap(input: { property: string; sitemapUrl: string; urls: string[] }): Promise<{ ok: boolean; error?: string }>;
}

export interface ExternalIndexingSubmissionResult {
  ok: boolean;
  mode: "dry-run" | "live";
  confirmExternal: boolean;
  submittedCount: number;
  externalIndexingRequested: boolean;
  googleRequests: number;
  preflight: ExternalIndexingPreflight;
  persisted: boolean;
  error?: string;
}

function liveSitemapPath(slug: string): string {
  return `/var/www/pharmaconnect-sites/${safeSlug(slug)}/current/sitemap.xml`;
}

export function readManagedPublicationSitemap(slug: string): { url: string; urls: string[] } {
  const safe = safeSlug(slug);
  const sitemapUrl = `https://${managedHostFor(safe)}/sitemap.xml`;
  const file = liveSitemapPath(safe);
  const xml = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  return { url: sitemapUrl, urls: parseSitemapLocs(xml) };
}

function auditPageInspection(page: TechnicalSeoIndexGateResult): IndexingCandidateInspection {
  return {
    slug: page.slug,
    tenantSlug: page.slug,
    serviceId: page.serviceId,
    pageType: page.pageType,
    publicPath: page.publicPath,
    pageUrl: page.pageUrl,
    canonical: page.canonical,
    authoritativeCanonical: page.authoritativeCanonical,
    intendedIndexable: page.intendedIndexable,
    eligible: page.eligible,
    robots: page.robots,
    blockers: page.blockers,
    published: true,
  };
}

function findAuditPage(
  audit: Pick<TechnicalSeoCampaignAudit, "pages">,
  page: PharmacyRegistryPage,
): TechnicalSeoIndexGateResult | undefined {
  const key = normalizeIndexingUrl(page.canonicalUrl || page.url);
  const publicPath = str(page.publishPath).replace(/\/+$/, "");
  const matches = audit.pages.filter((item) => {
    if (item.pageType === "homepage" && page.pageType !== "homepage") return false;
    if (publicPath && str(item.publicPath).replace(/\/+$/, "") === publicPath) return true;
    if (normalizeIndexingUrl(item.authoritativeCanonical) === key) return true;
    if (normalizeIndexingUrl(item.canonical) === key) return true;
    if (normalizeIndexingUrl(item.pageUrl) === key) return true;
    return false;
  });
  return matches[0];
}

function cloneAuditPage(
  page: TechnicalSeoIndexGateResult,
  overrides: Partial<TechnicalSeoIndexGateResult> = {},
): TechnicalSeoIndexGateResult {
  return { ...page, ...overrides };
}

export function withAuditPageOverride(
  audit: TechnicalSeoCampaignAudit,
  url: string,
  overrides: Partial<TechnicalSeoIndexGateResult>,
): TechnicalSeoCampaignAudit {
  const key = normalizeIndexingUrl(url);
  return {
    ...audit,
    pages: audit.pages.map((page) => {
      if (page.pageType === "homepage") return page;
      const pageKey = normalizeIndexingUrl(page.pageUrl || page.canonical || page.authoritativeCanonical);
      return pageKey === key || str(page.publicPath).replace(/\/+$/, "") === str(new URL(key).pathname).replace(/\/+$/, "")
        ? cloneAuditPage(page, overrides)
        : page;
    }),
  };
}

export function evaluateRegisteredUrlForSubmission(
  page: PharmacyRegistryPage,
  audit: Pick<TechnicalSeoCampaignAudit, "slug" | "serviceId" | "pages">,
  ctx: { slug: string; serviceId: string; profileWebsite?: string | null },
): SubmissionCandidateDecision {
  const url = normalizeIndexingUrl(page.canonicalUrl || page.url);
  const host = hostOf(url);
  if (page.serviceId !== ctx.serviceId) {
    return { url, accepted: false, reason: "stale_service", registered: true, alreadySubmitted: page.indexingStatus === "submitted" };
  }
  if (host.includes("example.local") || host === "localhost") {
    return { url, accepted: false, reason: "placeholder_host", registered: true, alreadySubmitted: false };
  }
  if (
    host.includes("www.visionpharmacy.com") ||
    (ctx.profileWebsite && host === hostOf(ctx.profileWebsite) && host !== managedHostFor(ctx.slug))
  ) {
    return { url, accepted: false, reason: "customer_website", registered: true, alreadySubmitted: false };
  }
  if (host.endsWith(".sites.pharmaconnect.uk") && host !== managedHostFor(ctx.slug)) {
    return { url, accepted: false, reason: "cross_tenant", registered: true, alreadySubmitted: false };
  }
  if (page.indexingStatus === "submitted" || page.indexingStatus === "indexed") {
    return { url, accepted: false, reason: "already_submitted", registered: true, alreadySubmitted: true };
  }
  const audited = findAuditPage(audit, page);
  if (!audited) {
    return { url, accepted: false, reason: "unpublished", registered: true, alreadySubmitted: false };
  }
  if (audited.httpStatus !== null && audited.httpStatus !== 200) {
    return { url, accepted: false, reason: "unavailable", registered: true, alreadySubmitted: false };
  }
  const decision = evaluateIndexingRegistrationCandidate(auditPageInspection(audited), {
    slug: ctx.slug,
    serviceId: ctx.serviceId,
    profileWebsite: ctx.profileWebsite,
  });
  if (!decision.accepted) {
    const mapped: SubmissionRejectReason =
      decision.reason === "homepage_redirect"
        ? "homepage_redirect"
        : decision.reason === "noindex"
          ? "noindex"
          : decision.reason === "technical_seo_blocker"
            ? "technical_seo_blocker"
            : decision.reason === "stale_service"
              ? "stale_service"
              : decision.reason === "cross_tenant"
                ? "cross_tenant"
                : decision.reason === "unpublished"
                  ? "unpublished"
                  : "not_eligible";
    return { url, accepted: false, reason: mapped, registered: true, alreadySubmitted: false };
  }
  const currentCanonical = normalizeIndexingUrl(
    canonicalUrlForIndexing({
      slug: ctx.slug,
      serviceId: ctx.serviceId,
      publicPath: audited.publicPath,
      storedCanonicalUrl: audited.authoritativeCanonical || audited.canonical,
      profileWebsite: ctx.profileWebsite,
    }),
  );
  if (currentCanonical && currentCanonical !== url) {
    return { url, accepted: false, reason: "canonical_mismatch", registered: true, alreadySubmitted: false };
  }
  return { url, accepted: true, reason: null, registered: true, alreadySubmitted: false };
}

export function buildExternalIndexingPreflight(input: {
  slug: string;
  serviceId: string;
  campaignId?: string | null;
  registryPages: PharmacyRegistryPage[];
  audit: Pick<TechnicalSeoCampaignAudit, "slug" | "serviceId" | "pages">;
  sitemapUrls: string[];
  sitemapUrl: string;
  profileWebsite?: string | null;
}): ExternalIndexingPreflight {
  const slug = safeSlug(input.slug);
  const serviceId = str(input.serviceId);
  const profileWebsite = input.profileWebsite ?? profileWebsiteFromDisk(slug);
  const property = resolvePharmacySearchConsoleProperty(slug, serviceId);
  const connection = readPharmacySearchConsoleConnection();
  const authority = buildLocalSearchConsoleWriteAuthority({
    slug,
    requestedProperty: property.property,
    customerWebsite: profileWebsite,
  });
  const currentPages = input.registryPages.filter((page) => page.serviceId === serviceId);
  const skipped: SubmissionCandidateDecision[] = [];
  const candidates: string[] = [];
  for (const page of currentPages) {
    const decision = evaluateRegisteredUrlForSubmission(page, input.audit, { slug, serviceId, profileWebsite });
    if (decision.accepted) candidates.push(decision.url);
    else skipped.push(decision);
  }
  const sitemapUrls = input.sitemapUrls.map(normalizeIndexingUrl).filter(Boolean).sort();
  const candidateSorted = [...candidates].sort();
  const sitemapMatchesCandidates =
    sitemapUrls.length === candidateSorted.length && sitemapUrls.every((url, index) => url === candidateSorted[index]);
  const blocked: string[] = [];
  if (!connection.connected) blocked.push("search_console_not_connected_or_unverified_for_managed_host");
  if (authority.reconnectRequired || !authority.writeAuthorized) {
    blocked.push(
      connection.permissionStatus === "readonly_insufficient_for_sitemap_submit"
        ? "oauth_scope_readonly_cannot_submit_sitemaps"
        : "oauth_reconnect_required_for_write_scope",
    );
  }
  if (authority.property.missingExactUrlPrefix) blocked.push("managed_host_property_missing");
  else if (!authority.property.permissionSufficient) blocked.push("managed_host_property_permission_insufficient");
  if (!authority.propertyVerified) blocked.push("managed_host_property_ownership_not_verified");
  if (!sitemapMatchesCandidates) blocked.push("live_sitemap_does_not_exactly_match_currently_eligible_registered_set");
  if (candidates.length === 0) blocked.push("no_eligible_registered_candidates");
  if (skipped.some((item) => item.reason && item.reason !== "already_submitted")) {
    blocked.push("ineligible_registered_url_present");
  }
  if (!isPharmacyGscSitemapSubmitEnabled()) blocked.push("live_google_sitemap_submit_disabled");
  if (!property.tenantSafe) blocked.push("property_not_tenant_safe");

  return {
    slug,
    serviceId,
    campaignId: input.campaignId ?? readActiveServiceCampaignSelection(slug)?.campaignId ?? null,
    mechanism: GSC_SITEMAPS_API_METHOD,
    googleApi: GSC_SITEMAPS_HTTP,
    indexingApiForbidden: GOOGLE_INDEXING_API_URL,
    urlInspectionApi: GSC_URL_INSPECTION_API,
    mechanismAppropriateForOrdinaryPages: true,
    searchConsole: {
      connected: connection.connected,
      authMethod: connection.authMethod,
      oauthScope: connection.oauthScope,
      requestedScope: connection.requestedScope,
      canSubmitSitemaps: authority.canSubmitSitemaps,
      reconnectRequired: authority.reconnectRequired,
      writeAuthorized: authority.writeAuthorized,
      property: property.property,
      propertyType: property.propertyType,
      propertyCoversManagedHost: hostOf(property.property) === property.managedHost,
      propertyOwnershipVerified: authority.propertyVerified,
      permissionStatus: connection.permissionStatus,
      tenantSafe: property.tenantSafe,
      rejectedCustomerWebsite: property.rejectedCustomerWebsite,
      rejectedProjectDomain: property.rejectedProjectDomain,
      submissionPermissionLabel: authority.submissionPermissionLabel,
      connectedLabel: authority.connectedLabel,
      managedPropertyLabel: authority.managedPropertyLabel,
      externalSubmissionLabel: authority.externalSubmissionLabel,
    },
    sitemapUrl: input.sitemapUrl || property.sitemapUrl,
    sitemapUrls,
    sitemapCount: sitemapUrls.length,
    sitemapMatchesCandidates,
    candidates: candidateSorted,
    candidateCount: candidateSorted.length,
    skipped,
    liveSubmitAllowed: blocked.length === 0,
    liveSubmitBlockedReasons: blocked,
    duplicateProtection: "skip_already_submitted",
    partialFailureBehaviour: "sitemap_submit_is_atomic_no_url_marked_submitted_on_google_failure",
    indexedEvidence: "search_console_url_inspection_only",
  };
}

export async function planPharmacyExternalIndexingSubmission(input: {
  slug: string;
  serviceId?: string;
  fetchLive?: boolean;
  audit?: TechnicalSeoCampaignAudit | null;
  registryPages?: PharmacyRegistryPage[];
  sitemapUrls?: string[];
}): Promise<ExternalIndexingPreflight> {
  const { serviceId, campaignId } = resolveCurrentIndexingServiceId(input.slug, input.serviceId);
  const audit =
    input.audit ||
    (input.fetchLive === false
      ? loadTechnicalSeoAudit(input.slug, serviceId)
      : await auditPublishedTechnicalSeo({ slug: input.slug, serviceId, fetchLive: input.fetchLive !== false }));
  if (!audit) {
    throw new Error(`Technical SEO audit required before external indexing submission: ${input.slug}/${serviceId}`);
  }
  const registry = readPharmacyRegistry(input.slug);
  const sitemap = readManagedPublicationSitemap(input.slug);
  return buildExternalIndexingPreflight({
    slug: input.slug,
    serviceId,
    campaignId,
    registryPages: input.registryPages || registry?.pages || [],
    audit,
    sitemapUrls: input.sitemapUrls || sitemap.urls,
    sitemapUrl: sitemap.url,
  });
}

/**
 * Live Google adapter. Never invoked unless the kill-switch and confirmExternal are set.
 * Default implementation still refuses to call Google so this task cannot submit.
 */
export async function submitManagedSitemapToSearchConsole(input: {
  property: string;
  sitemapUrl: string;
  urls: string[];
}): Promise<{ ok: boolean; error?: string }> {
  externalIndexingTelemetry.googleRequests += 1;
  externalIndexingTelemetry.sitemapSubmitCalls += 1;
  externalIndexingTelemetry.lastGoogleTarget = input.sitemapUrl;
  indexingBridgeTelemetry.externalIndexingRequests += 1;
  return {
    ok: false,
    error: `Live Search Console sitemap submit is disabled. Would call ${GSC_SITEMAPS_HTTP} for property ${input.property} feed ${input.sitemapUrl}. Google Indexing API is not used.`,
  };
}

export async function runPharmacyExternalIndexingSubmission(input: {
  slug: string;
  serviceId?: string;
  mode?: "dry-run" | "live";
  confirmExternal?: boolean;
  fetchLive?: boolean;
  audit?: TechnicalSeoCampaignAudit | null;
  registryPages?: PharmacyRegistryPage[];
  sitemapUrls?: string[];
  persist?: boolean;
  googleClient?: GoogleSitemapSubmitAdapter;
}): Promise<ExternalIndexingSubmissionResult> {
  indexingBridgeTelemetry.submitCalls += 1;
  const mode = input.mode === "live" ? "live" : "dry-run";
  const confirmExternal = input.confirmExternal === true;
  const googleBefore = externalIndexingTelemetry.googleRequests;
  const preflight = await planPharmacyExternalIndexingSubmission({
    slug: input.slug,
    serviceId: input.serviceId,
    fetchLive: input.fetchLive,
    audit: input.audit,
    registryPages: input.registryPages,
    sitemapUrls: input.sitemapUrls,
  });

  const liveAttempt =
    mode === "live" &&
    confirmExternal === true &&
    (input.googleClient
      ? true
      : isPharmacyGscSitemapSubmitEnabled() && preflight.liveSubmitAllowed);

  if (!liveAttempt) {
    return {
      ok: true,
      mode,
      confirmExternal,
      submittedCount: 0,
      externalIndexingRequested: false,
      googleRequests: externalIndexingTelemetry.googleRequests - googleBefore,
      preflight,
      persisted: false,
    };
  }

  const client = input.googleClient || { submitSitemap: submitManagedSitemapToSearchConsole };
  let outcome: { ok: boolean; error?: string };
  try {
    outcome = await client.submitSitemap({
      property: preflight.searchConsole.property,
      sitemapUrl: preflight.sitemapUrl,
      urls: preflight.candidates,
    });
  } catch (err) {
    outcome = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (!outcome.ok) {
    return {
      ok: false,
      mode,
      confirmExternal,
      submittedCount: 0,
      externalIndexingRequested: true,
      googleRequests: externalIndexingTelemetry.googleRequests - googleBefore,
      preflight,
      persisted: false,
      error: outcome.error || "Search Console sitemap submit failed",
    };
  }

  if (input.persist === true) {
    throw new Error("Persisting submittedAt is not allowed from this pre-flight task path.");
  }

  return {
    ok: true,
    mode,
    confirmExternal,
    submittedCount: 0,
    externalIndexingRequested: true,
    googleRequests: externalIndexingTelemetry.googleRequests - googleBefore,
    preflight,
    persisted: false,
  };
}

export function applySuccessfulSitemapSubmitToPages(
  pages: PharmacyRegistryPage[],
  submittedUrls: string[],
  now: string,
  googleOk: boolean,
): PharmacyRegistryPage[] {
  if (!googleOk) return pages.map((page) => ({ ...page }));
  const keys = new Set(submittedUrls.map(normalizeIndexingUrl));
  return pages.map((page) => {
    const url = normalizeIndexingUrl(page.canonicalUrl || page.url);
    if (!keys.has(url)) return { ...page };
    return {
      ...page,
      indexingStatus: "submitted",
      submittedAt: now,
    };
  });
}
