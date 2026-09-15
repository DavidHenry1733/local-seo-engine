/**
 * Pharmacy Indexing Bridge V1 — register, submit, refresh lifecycle for published pages.
 *
 * Authority chain:
 *   current campaign/service → authoritative publication → Technical SEO eligibility
 *   → indexing registry → (separate) submission → indexing status → visibility
 *
 * REGISTER writes the internal PharmaConnect registry only.
 * It does not call Google Indexing API, Search Console, sitemap ping, or URL inspection.
 */
import fs from "node:fs";
import path from "node:path";
import { readTrackingReport } from "../indexing/indexTrackingEngine.ts";
import type { IndexStatus } from "../indexing/indexTrackingTypes.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import {
  canonicalUrlForIndexing,
  isPlaceholderPublicationHost,
  resolveAuthoritativePublicationCanonical,
  type AuthoritativePublicationCanonicalInput,
} from "./pharmacyPublicationCanonicalAuthority.ts";
import {
  auditPublishedTechnicalSeo,
  loadTechnicalSeoAudit,
  type TechnicalSeoCampaignAudit,
} from "./pharmacyTechnicalSeoAuditService.ts";
import type { TechnicalSeoIndexGateResult } from "./pharmacyTechnicalSeoIndexGate.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";

export type PharmacyIndexingStatus =
  | "ready_to_submit"
  | "submitted"
  | "indexed"
  | "not_indexed"
  | "failed";

export type IndexingRegistrationRejectReason =
  | "unpublished"
  | "not_intended_indexable"
  | "homepage_redirect"
  | "noindex"
  | "technical_seo_blocker"
  | "stale_service"
  | "cross_tenant"
  | "cross_service"
  | "placeholder_host"
  | "profile_website_override"
  | "preview_url"
  | "not_eligible";

export interface PharmacyRegistryPage {
  slug: string;
  url: string;
  pageType: string;
  serviceId: string;
  /** Optional campaign scope for multi-campaign tenant registries. */
  campaignId?: string | null;
  sourceMaster: string;
  publishPath: string;
  lastPublishedAt: string | null;
  indexingStatus: PharmacyIndexingStatus;
  submittedAt: string | null;
  indexedAt: string | null;
  lastCheckedAt: string | null;
  canonicalUrl: string;
}

export interface PharmacyRegistry {
  version: 1;
  slug: string;
  generatedAt: string;
  pages: PharmacyRegistryPage[];
}

export interface PharmacyIndexingSummary {
  version: 1;
  slug: string;
  serviceId?: string;
  campaignId?: string | null;
  publishedCount?: number;
  indexEligibleCount?: number;
  registerableCount?: number;
  totalRegistered: number;
  readyToSubmit: number;
  submitted: number;
  indexed: number;
  notIndexed: number;
  failed: number;
  sitemapUrl: string;
  lastUpdated: string;
  lastAction?: "register" | "submit" | "refresh";
  externalIndexingRequested?: boolean;
}

export interface IndexingCandidateInspection {
  slug?: string;
  serviceId: string;
  pageType: string;
  publicPath: string;
  pageUrl?: string | null;
  canonical?: string | null;
  authoritativeCanonical?: string | null;
  intendedIndexable: boolean;
  eligible: boolean;
  robots?: string;
  blockers?: Array<{ code?: string; message?: string }>;
  published?: boolean;
  tenantSlug?: string;
}

export interface IndexingRegistrationContext {
  slug: string;
  serviceId: string;
  campaignId?: string | null;
  profileWebsite?: string | null;
  managedProfile?: AuthoritativePublicationCanonicalInput["managedProfile"];
}

export interface IndexingRegistrationDecision {
  accepted: boolean;
  reason: IndexingRegistrationRejectReason | null;
  canonicalUrl: string;
  url: string;
  pageType: string;
  publicPath: string;
  serviceId: string;
}

export interface IndexingWorkflowState {
  slug: string;
  serviceId: string;
  campaignId: string | null;
  publishedCount: number;
  indexEligibleCount: number;
  registerableCount: number;
  registeredCount: number;
  readyToSubmitCount: number;
  submittedCount: number;
  indexedCount: number;
  notIndexedCount: number;
  failedCount: number;
  registerableUrls: string[];
  registeredUrls: string[];
  registeredPages: PharmacyRegistryPage[];
  homepageExcluded: boolean;
  lastUpdated: string | null;
  sitemapUrl: string;
  connected: boolean;
  visibilityTrend: string;
  externalIndexingRequested: boolean;
}

interface ExternalIndexingTelemetry {
  registerCalls: number;
  submitCalls: number;
  refreshCalls: number;
  externalIndexingRequests: number;
  lastExternalIndexingTarget: string | null;
}

export const indexingBridgeTelemetry: ExternalIndexingTelemetry = {
  registerCalls: 0,
  submitCalls: 0,
  refreshCalls: 0,
  externalIndexingRequests: 0,
  lastExternalIndexingTarget: null,
};

export function resetIndexingBridgeTelemetry(): void {
  indexingBridgeTelemetry.registerCalls = 0;
  indexingBridgeTelemetry.submitCalls = 0;
  indexingBridgeTelemetry.refreshCalls = 0;
  indexingBridgeTelemetry.externalIndexingRequests = 0;
  indexingBridgeTelemetry.lastExternalIndexingTarget = null;
}

/**
 * Explicit external submission hook. Registration must never call this.
 * Current Growth Journey Register Pages path does not invoke it.
 */
export function requestExternalIndexingSubmission(targetUrl: string): never {
  indexingBridgeTelemetry.externalIndexingRequests += 1;
  indexingBridgeTelemetry.lastExternalIndexingTarget = String(targetUrl || "");
  throw new Error(
    "External indexing submission is a separate explicit action and is not performed during internal registration.",
  );
}

function safeSlug(slug: string): string {
  return (
    String(slug || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

function str(value: unknown): string {
  return String(value || "").trim();
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function registryPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-registry", `${safeSlug(slug)}.json`);
}

function indexingSummaryPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-indexing", `${safeSlug(slug)}.json`);
}

function sitemapPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-publish", safeSlug(slug), "sitemap.xml");
}

function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function originOf(url: string): string {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

function normalizeUrlKey(url: string): string {
  const raw = str(url);
  if (!raw) return "";
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    parsed.hash = "";
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`.replace(/\/$/, pathname === "/" ? "/" : "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function pageKeyFromPublicPath(publicPath: string, serviceId: string): string {
  const cleaned = str(publicPath).replace(/^\/+|\/+$/g, "");
  return cleaned || serviceId || "page";
}

function sourceMasterFor(serviceId: string): string {
  const meta = getServicePublishMeta(serviceId);
  return meta ? `docs/pharmacy-master-library/${meta.masterFile}` : "";
}

function robotsIsNoindex(robots: string): boolean {
  return /\bnoindex\b/i.test(str(robots));
}

function isPreviewOrApiHost(host: string, url: string): boolean {
  const h = str(host).toLowerCase();
  const u = str(url).toLowerCase();
  if (!h && !u) return false;
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return true;
  if (h.includes("preview")) return true;
  if (/^api\./.test(h) || h.startsWith("app.")) return true;
  if (/\/api\//.test(u)) return true;
  return false;
}

function managedHostFor(slug: string): string {
  return `${safeSlug(slug)}.sites.pharmaconnect.uk`;
}

function profileWebsiteFromDisk(slug: string): string {
  const profile = readJson<{ data?: { website?: string } }>(
    path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${safeSlug(slug)}.json`),
  );
  return str(profile?.data?.website);
}

export function resolveCurrentIndexingServiceId(
  slug: string,
  explicitServiceId?: string | null,
): { serviceId: string; campaignId: string | null } {
  const explicit = str(explicitServiceId);
  const selection = readActiveServiceCampaignSelection(slug);
  const serviceId = explicit || str(selection?.serviceId);
  if (!serviceId) {
    throw new Error(`No current service/campaign authority for indexing registration: ${safeSlug(slug)}`);
  }
  return {
    serviceId,
    campaignId: str(selection?.campaignId) || null,
  };
}

export function resolveCurrentIndexingServiceIdSafe(
  slug: string,
  explicitServiceId?: string | null,
): { serviceId: string; campaignId: string | null } {
  try {
    return resolveCurrentIndexingServiceId(slug, explicitServiceId);
  } catch {
    return { serviceId: "", campaignId: null };
  }
}

export function evaluateIndexingRegistrationCandidate(
  page: IndexingCandidateInspection,
  ctx: IndexingRegistrationContext,
): IndexingRegistrationDecision {
  const tenant = safeSlug(page.tenantSlug || page.slug || ctx.slug);
  const ctxSlug = safeSlug(ctx.slug);
  const publicPath = str(page.publicPath) || "/";
  const pageType = str(page.pageType) || "service";
  const pageService = str(page.serviceId);
  const empty = (reason: IndexingRegistrationRejectReason): IndexingRegistrationDecision => ({
    accepted: false,
    reason,
    canonicalUrl: "",
    url: str(page.pageUrl || page.canonical || page.authoritativeCanonical),
    pageType,
    publicPath,
    serviceId: pageService,
  });

  if (page.published === false) return empty("unpublished");
  if (tenant && tenant !== ctxSlug) return empty("cross_tenant");
  if (pageService && pageService !== ctx.serviceId) {
    return empty("stale_service");
  }
  if (pageType === "homepage" || publicPath === "/") return empty("homepage_redirect");
  if (!page.intendedIndexable) return empty("not_intended_indexable");
  if (robotsIsNoindex(page.robots || "")) return empty("noindex");
  if ((page.blockers || []).length > 0) return empty("technical_seo_blocker");
  if (!page.eligible) return empty("not_eligible");

  const authority = resolveAuthoritativePublicationCanonical({
    slug: ctxSlug,
    serviceId: ctx.serviceId,
    publicPath,
    storedCanonicalUrl: page.authoritativeCanonical || page.canonical || page.pageUrl,
    profileWebsite: ctx.profileWebsite,
    managedProfile: ctx.managedProfile,
  });
  const canonicalUrl = canonicalUrlForIndexing({
    slug: ctxSlug,
    serviceId: ctx.serviceId,
    publicPath,
    storedCanonicalUrl: page.authoritativeCanonical || page.canonical || page.pageUrl,
    profileWebsite: ctx.profileWebsite,
    managedProfile: ctx.managedProfile,
  });
  const host = hostOf(canonicalUrl);
  const profileHost = hostOf(ctx.profileWebsite || "");
  const managedHost = hostOf(authority.managedPublicUrl) || managedHostFor(ctxSlug);

  if (!canonicalUrl || isPlaceholderPublicationHost(host)) {
    return { ...empty("placeholder_host"), canonicalUrl };
  }
  if (isPreviewOrApiHost(host, canonicalUrl)) {
    return { ...empty("preview_url"), canonicalUrl };
  }
  if (authority.profileWebsiteRejected && profileHost && host === profileHost && host !== managedHost) {
    return { ...empty("profile_website_override"), canonicalUrl };
  }
  if (authority.source === "managed_publication" && host !== managedHost) {
    if (profileHost && host === profileHost) return { ...empty("profile_website_override"), canonicalUrl };
    if (host.endsWith(".sites.pharmaconnect.uk") && host !== managedHost) {
      return { ...empty("cross_tenant"), canonicalUrl };
    }
    return { ...empty("not_eligible"), canonicalUrl };
  }
  if (host.endsWith(".sites.pharmaconnect.uk") && host !== managedHost) {
    return { ...empty("cross_tenant"), canonicalUrl };
  }

  return {
    accepted: true,
    reason: null,
    canonicalUrl,
    url: canonicalUrl,
    pageType,
    publicPath,
    serviceId: ctx.serviceId,
  };
}

export function selectIndexingRegisterablePages(
  audit: Pick<TechnicalSeoCampaignAudit, "slug" | "serviceId" | "pages">,
  ctx?: Partial<IndexingRegistrationContext>,
): IndexingRegistrationDecision[] {
  const slug = safeSlug(ctx?.slug || audit.slug);
  const serviceId = str(ctx?.serviceId || audit.serviceId);
  const fullCtx: IndexingRegistrationContext = {
    slug,
    serviceId,
    campaignId: ctx?.campaignId ?? null,
    profileWebsite: ctx?.profileWebsite ?? profileWebsiteFromDisk(slug),
    managedProfile: ctx?.managedProfile,
  };
  return (audit.pages || [])
    .map((page) =>
      evaluateIndexingRegistrationCandidate(
        {
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
        },
        fullCtx,
      ),
    )
    .filter((decision) => decision.accepted);
}

function countByStatus(pages: PharmacyRegistryPage[]) {
  return {
    readyToSubmit: pages.filter((p) => p.indexingStatus === "ready_to_submit").length,
    submitted: pages.filter((p) => p.indexingStatus === "submitted").length,
    indexed: pages.filter((p) => p.indexingStatus === "indexed").length,
    notIndexed: pages.filter((p) => p.indexingStatus === "not_indexed").length,
    failed: pages.filter((p) => p.indexingStatus === "failed").length,
  };
}

function resolveIndexingSitemapUrl(slug: string, serviceId: string): string {
  try {
    const authority = resolveAuthoritativePublicationCanonical({
      slug: safeSlug(slug),
      serviceId,
      publicPath: `/${serviceId}/`,
    });
    const origin = originOf(authority.canonicalUrl || authority.managedPublicUrl);
    if (origin) return `${origin}/sitemap.xml`;
  } catch {
    /* fall through */
  }
  return `https://${managedHostFor(slug)}/sitemap.xml`;
}

function buildSummary(
  slug: string,
  pages: PharmacyRegistryPage[],
  extras: Partial<PharmacyIndexingSummary> = {},
): PharmacyIndexingSummary {
  const counts = countByStatus(pages);
  const serviceId = str(extras.serviceId);
  return {
    version: 1,
    slug: safeSlug(slug),
    totalRegistered: pages.length,
    ...counts,
    sitemapUrl: extras.sitemapUrl || (serviceId ? resolveIndexingSitemapUrl(slug, serviceId) : ""),
    lastUpdated: extras.lastUpdated || new Date().toISOString(),
    ...extras,
    externalIndexingRequested: extras.externalIndexingRequested === true,
  };
}

function writeRegistry(registry: PharmacyRegistry): string {
  const file = registryPath(registry.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(registry, null, 2));
  return file;
}

function writeSummary(slug: string, pages: PharmacyRegistryPage[], extras: Partial<PharmacyIndexingSummary> = {}): string {
  const file = indexingSummaryPath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(buildSummary(slug, pages, extras), null, 2));
  return file;
}

function mapGscStatus(status: IndexStatus): PharmacyIndexingStatus | null {
  if (status === "indexed") return "indexed";
  if (status === "not_indexed") return "not_indexed";
  if (status === "unknown" || status === "property_not_found") return null;
  return null;
}

function currentServicePages(registry: PharmacyRegistry | null, serviceId: string): PharmacyRegistryPage[] {
  return (registry?.pages || []).filter((page) => page.serviceId === serviceId);
}

export function readPharmacyRegistry(slug: string): PharmacyRegistry | null {
  return readJson<PharmacyRegistry>(registryPath(slug));
}

export function readPharmacyIndexingSummary(slug: string, serviceId?: string): PharmacyIndexingSummary | null {
  const safe = safeSlug(slug);
  const stored = readJson<PharmacyIndexingSummary>(indexingSummaryPath(safe));
  const registry = readPharmacyRegistry(safe);
  if (serviceId && registry) {
    const pages = currentServicePages(registry, serviceId);
    return buildSummary(safe, pages, {
      serviceId,
      campaignId: stored?.campaignId ?? null,
      publishedCount: stored?.publishedCount,
      indexEligibleCount: stored?.indexEligibleCount,
      registerableCount: stored?.registerableCount ?? pages.length,
      lastUpdated: stored?.lastUpdated || registry.generatedAt,
      lastAction: stored?.lastAction,
      sitemapUrl: stored?.sitemapUrl || resolveIndexingSitemapUrl(safe, serviceId),
      externalIndexingRequested: stored?.externalIndexingRequested === true,
    });
  }
  return stored;
}

export function readIndexingWorkflowState(slug: string, explicitServiceId?: string | null): IndexingWorkflowState {
  const safe = safeSlug(slug);
  const { serviceId, campaignId } = resolveCurrentIndexingServiceIdSafe(safe, explicitServiceId);
  if (!serviceId) {
    return {
      slug: safe,
      serviceId: "",
      campaignId: null,
      publishedCount: 0,
      indexEligibleCount: 0,
      registerableCount: 0,
      registeredCount: 0,
      readyToSubmitCount: 0,
      submittedCount: 0,
      indexedCount: 0,
      notIndexedCount: 0,
      failedCount: 0,
      registerableUrls: [],
      registeredUrls: [],
      registeredPages: [],
      homepageExcluded: false,
      lastUpdated: null,
      sitemapUrl: "",
      connected: false,
      visibilityTrend: "Not registered",
      externalIndexingRequested: false,
    };
  }
  const audit = loadTechnicalSeoAudit(safe, serviceId);
  const registerable = audit
    ? selectIndexingRegisterablePages(audit, { slug: safe, serviceId, campaignId, profileWebsite: profileWebsiteFromDisk(safe) })
    : [];
  const registry = readPharmacyRegistry(safe);
  const pages = currentServicePages(registry, serviceId);
  const counts = countByStatus(pages);
  const publishedCount = audit?.totalPublishedUrls ?? 0;
  const indexEligibleCount = audit?.eligibleCount ?? 0;
  const homepageExcluded = Boolean(
    audit?.pages?.some((page) => page.pageType === "homepage" && page.intendedIndexable === false),
  );
  const connected = pages.length > 0;
  const visibilityTrend = !connected
    ? "Not registered"
    : counts.indexed > 0
      ? "Indexed evidence present"
      : counts.submitted > 0
        ? "Awaiting index confirmation"
        : "Registered internally — not submitted";

  return {
    slug: safe,
    serviceId,
    campaignId,
    publishedCount,
    indexEligibleCount,
    registerableCount: registerable.length,
    registeredCount: pages.length,
    readyToSubmitCount: counts.readyToSubmit,
    submittedCount: counts.submitted,
    indexedCount: counts.indexed,
    notIndexedCount: counts.notIndexed,
    failedCount: counts.failed,
    registerableUrls: registerable.map((item) => item.canonicalUrl),
    registeredUrls: pages.map((page) => page.canonicalUrl || page.url),
    registeredPages: pages,
    homepageExcluded,
    lastUpdated: registry?.generatedAt || readPharmacyIndexingSummary(safe, serviceId)?.lastUpdated || null,
    sitemapUrl: resolveIndexingSitemapUrl(safe, serviceId),
    connected,
    visibilityTrend,
    externalIndexingRequested: false,
  };
}

export async function registerPharmacyPages(
  slug: string,
  options: { serviceId?: string; campaignId?: string | null; fetchLive?: boolean } = {},
): Promise<{
  registryPath: string;
  sitemapPath: string;
  summaryPath: string;
  registered: number;
  pages: PharmacyRegistryPage[];
  skipped: Array<{ publicPath: string; reason: string }>;
  workflow: IndexingWorkflowState;
  externalIndexingRequested: false;
  audit: TechnicalSeoCampaignAudit;
}> {
  indexingBridgeTelemetry.registerCalls += 1;
  const safe = safeSlug(slug);
  const resolved = resolveCurrentIndexingServiceId(safe, options.serviceId);
  const serviceId = resolved.serviceId;
  const campaignId = options.campaignId ?? resolved.campaignId;
  const audit = await auditPublishedTechnicalSeo({
    slug: safe,
    serviceId,
    fetchLive: options.fetchLive !== false,
  });
  const ctx: IndexingRegistrationContext = {
    slug: safe,
    serviceId,
    campaignId,
    profileWebsite: profileWebsiteFromDisk(safe),
  };
  const skipped: Array<{ publicPath: string; reason: string }> = [];
  const accepted: IndexingRegistrationDecision[] = [];
  for (const page of audit.pages) {
    const decision = evaluateIndexingRegistrationCandidate(
      {
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
      },
      ctx,
    );
    if (decision.accepted) accepted.push(decision);
    else skipped.push({ publicPath: page.publicPath, reason: decision.reason || "not_eligible" });
  }

  const existing = readPharmacyRegistry(safe);
  const otherServicePages = (existing?.pages || []).filter((page) => page.serviceId !== serviceId);
  const existingByUrl = new Map(
    currentServicePages(existing, serviceId).map((page) => [normalizeUrlKey(page.canonicalUrl || page.url), page]),
  );
  const now = new Date().toISOString();

  const pages: PharmacyRegistryPage[] = accepted.map((decision) => {
    const key = normalizeUrlKey(decision.canonicalUrl);
    const prev = existingByUrl.get(key);
    const pageSlug = pageKeyFromPublicPath(decision.publicPath, serviceId);
    return {
      slug: pageSlug,
      url: decision.canonicalUrl,
      pageType: decision.pageType,
      serviceId,
      campaignId,
      sourceMaster: sourceMasterFor(serviceId),
      publishPath: decision.publicPath,
      lastPublishedAt: prev?.lastPublishedAt || now,
      indexingStatus: prev?.indexingStatus || "ready_to_submit",
      submittedAt: prev?.submittedAt ?? null,
      indexedAt: prev?.indexedAt ?? null,
      lastCheckedAt: prev?.lastCheckedAt ?? null,
      canonicalUrl: decision.canonicalUrl,
    };
  });

  const registry: PharmacyRegistry = {
    version: 1,
    slug: safe,
    generatedAt: now,
    pages: [...otherServicePages, ...pages],
  };

  const extras: Partial<PharmacyIndexingSummary> = {
    serviceId,
    campaignId,
    publishedCount: audit.totalPublishedUrls,
    indexEligibleCount: audit.eligibleCount,
    registerableCount: pages.length,
    lastUpdated: now,
    lastAction: "register",
    sitemapUrl: resolveIndexingSitemapUrl(safe, serviceId),
    externalIndexingRequested: false,
  };

  const regFile = writeRegistry(registry);
  const sumFile = writeSummary(safe, pages, extras);
  const workflow = readIndexingWorkflowState(safe, serviceId);

  return {
    registryPath: regFile,
    sitemapPath: sitemapPath(safe),
    summaryPath: sumFile,
    registered: pages.length,
    pages,
    skipped,
    workflow,
    externalIndexingRequested: false,
    audit,
  };
}

export async function submitReadyPharmacyPages(
  slug: string,
  options: { serviceId?: string; mode?: "dry-run" | "live"; confirmExternal?: boolean; fetchLive?: boolean } = {},
): Promise<{
  submitted: number;
  summary: PharmacyIndexingSummary;
  externalIndexingRequested: false | boolean;
  workflow: IndexingWorkflowState;
  preflight?: unknown;
}> {
  const { runPharmacyExternalIndexingSubmission } = await import("./pharmacyExternalIndexingSubmissionService.ts");
  const safe = safeSlug(slug);
  const { serviceId } = resolveCurrentIndexingServiceId(safe, options.serviceId);
  const result = await runPharmacyExternalIndexingSubmission({
    slug: safe,
    serviceId,
    mode: options.mode === "live" ? "live" : "dry-run",
    confirmExternal: options.confirmExternal === true,
    fetchLive: options.fetchLive,
    persist: false,
  });
  const workflow = readIndexingWorkflowState(safe, serviceId);
  const summary = readPharmacyIndexingSummary(safe, serviceId) || buildSummary(safe, workflow.registeredPages, {
    serviceId,
    lastUpdated: workflow.lastUpdated || new Date().toISOString(),
    sitemapUrl: workflow.sitemapUrl,
    externalIndexingRequested: false,
  });
  return {
    submitted: result.submittedCount,
    summary,
    externalIndexingRequested: result.externalIndexingRequested,
    workflow,
    preflight: result.preflight,
  };
}

export function refreshPharmacyIndexingStatus(
  slug: string,
  options: { serviceId?: string } = {},
): {
  checked: number;
  summary: PharmacyIndexingSummary;
} {
  indexingBridgeTelemetry.refreshCalls += 1;
  const safe = safeSlug(slug);
  const { serviceId } = resolveCurrentIndexingServiceId(safe, options.serviceId);
  const registry = readPharmacyRegistry(safe);
  if (!registry) {
    throw new Error(`Registry not found for slug: ${safe}. Run register first.`);
  }

  const gscReport = readTrackingReport(safe, path.join(WORKSPACE_ROOT, "output"));
  const gscByUrl = new Map((gscReport?.records || []).map((r) => [r.url, r]));

  const now = new Date().toISOString();
  let checked = 0;

  for (const page of registry.pages) {
    if (page.serviceId !== serviceId) continue;
    if (page.indexingStatus !== "submitted" && page.indexingStatus !== "indexed" && page.indexingStatus !== "not_indexed") {
      continue;
    }

    page.lastCheckedAt = now;
    checked += 1;

    const gscRecord = gscByUrl.get(page.url) || gscByUrl.get(page.canonicalUrl);
    if (!gscRecord) continue;
    const mapped = mapGscStatus(gscRecord.status);
    if (mapped === "indexed") {
      page.indexingStatus = "indexed";
      page.indexedAt = gscRecord.firstDetectedIndexedAt || now;
    } else if (mapped === "not_indexed") {
      page.indexingStatus = "not_indexed";
    }
  }

  registry.generatedAt = now;
  writeRegistry(registry);
  const current = currentServicePages(registry, serviceId);
  const summary = buildSummary(safe, current, {
    serviceId,
    lastUpdated: now,
    lastAction: "refresh",
    sitemapUrl: resolveIndexingSitemapUrl(safe, serviceId),
    externalIndexingRequested: false,
  });
  writeSummary(safe, current, summary);

  return {
    checked,
    summary,
  };
}

export function getPharmacyIndexingBridgeStatus(
  slug: string,
  explicitServiceId?: string | null,
): {
  registry: PharmacyRegistry | null;
  summary: PharmacyIndexingSummary | null;
  sitemapExists: boolean;
  sitemapPath: string;
  workflow: IndexingWorkflowState;
} {
  const safe = safeSlug(slug);
  const { serviceId } = resolveCurrentIndexingServiceIdSafe(safe, explicitServiceId);
  return {
    registry: readPharmacyRegistry(safe),
    summary: serviceId ? readPharmacyIndexingSummary(safe, serviceId) : readPharmacyIndexingSummary(safe),
    sitemapExists: fs.existsSync(sitemapPath(safe)),
    sitemapPath: sitemapPath(safe),
    workflow: readIndexingWorkflowState(safe, serviceId),
  };
}

export function computeIndexingRoadmapPct(summary: PharmacyIndexingSummary | null): number {
  if (!summary || summary.totalRegistered === 0) return 0;
  if (summary.indexed > 0) {
    return Math.round((summary.indexed / summary.totalRegistered) * 100);
  }
  if (summary.submitted > 0) {
    return Math.min(90, Math.round((summary.submitted / summary.totalRegistered) * 100));
  }
  return Math.min(50, Math.round((summary.readyToSubmit / summary.totalRegistered) * 100));
}

export function gatePageToCandidate(page: TechnicalSeoIndexGateResult): IndexingCandidateInspection {
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
