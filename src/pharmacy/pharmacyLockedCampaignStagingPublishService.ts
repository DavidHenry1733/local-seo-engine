/**
 * CONTROLLED-LOCKED-CAMPAIGN-STAGING-PUBLISH-41A
 *
 * Campaign-scoped staging publish from the approved-locked inventory.
 * Does not use the production publisher, active Growth Plan campaign,
 * Search Console, or indexing registry.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT, WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { loadContentPackage } from "./pharmacyContentPackageService.ts";
import { resolveApprovedServiceBank } from "./pharmacyServiceVariantLibrary.ts";
import { readManagedPublishingProfile } from "./masterAdminManagedPublishingService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { lockedCampaignStagingPublishApiPath } from "./pharmacyLockedCampaignStagingPublishControl.ts";
import {
  applyApprovedCorePagePresentationContractCss,
  PHARMACONNECT_SERVICE_PAGE_PRESENTATION_CONTRACT_ID,
} from "./pharmacyDesignSystemV1.ts";
import { renderApprovedBankServiceHubCtaHtml } from "./pharmacyApprovedBankLocalityDirectRender.ts";
import { applyTenantBrandPresentationOverlay, protectTenantBrandLogoDuringHostRewrite } from "./pharmacyTenantBrandPresentationOverlay.ts";
import { resolveTenantBrandIdentity } from "./pharmacyTenantBrandIdentityContract.ts";

export const LOCKED_CAMPAIGN_STAGING_PUBLISH_TASK = "CONTROLLED-LOCKED-CAMPAIGN-STAGING-PUBLISH-41A";
export const EXPECTED_STAGING_LOCALITY_COUNT = 8;
export const STAGING_ROBOTS_TXT = "User-agent: *\nDisallow: /\n";

const OTHER_SERVICE_IDS = [
  "pharmacy-first",
  "travel-vaccinations",
  "blood-pressure-checks",
  "prescription-dispensing",
] as const;

const ASSET_ROOT = path.join(PHARMACY_WORKSPACE_ROOT, "assets");

export interface LockedCampaignStagingPublishRequest {
  tenantSlug: string;
  campaignId: string;
}

export interface LockedStagingPage {
  pageType: "service" | "locality";
  areaSlug: string | null;
  sourcePath: string;
  sha256: string;
  publicPath: string;
  relativePath: string;
}

export interface LockedCampaignStagingInventory {
  ok: boolean;
  blockers: string[];
  tenantSlug: string;
  campaignId: string;
  serviceId: string;
  lockedBankHash: string | null;
  stagingBaseUrl: string;
  pages: LockedStagingPage[];
}

export interface StagingPackageFile {
  relativePath: string;
  contents: Buffer;
  contentType: string;
}

export interface LockedCampaignStagingPackage {
  tenantSlug: string;
  campaignId: string;
  serviceId: string;
  stagingBaseUrl: string;
  lockedBankHash: string;
  brandRevision: string;
  files: StagingPackageFile[];
  pagePublicPaths: string[];
  assetPaths: string[];
}

export interface StagingHealthCheck {
  url: string;
  status: number;
  ok: boolean;
  detail: string;
}

export interface LockedCampaignStagingPublishResult {
  ok: boolean;
  dryRun: boolean;
  published: boolean;
  indexed: false;
  searchConsoleSubmitted: false;
  indexingRegistrySubmitted: false;
  sitemapUploaded: false;
  error: string | null;
  unmetCondition: string | null;
  message: string | null;
  tenantSlug: string;
  campaignId: string;
  stagingBaseUrl: string;
  releaseId: string | null;
  rollbackTarget: string | null;
  pages: string[];
  health: StagingHealthCheck[];
}

export interface StagingDestination {
  kind: "filesystem" | "sftp" | "local";
  stagingBaseUrl: string;
  captureCurrent(snapshotId: string): Promise<string>;
  writeRelease(releaseId: string, files: StagingPackageFile[]): Promise<void>;
  validateRelease(releaseId: string, files: StagingPackageFile[]): Promise<void>;
  switchCurrent(releaseId: string, snapshotId: string, files: StagingPackageFile[]): Promise<void>;
  restoreSnapshot(snapshotId: string): Promise<void>;
  readCurrent(relativePath: string): Promise<Buffer | null>;
  listCurrent(): Promise<string[]>;
}

function tenantKey(slug: string): string {
  return String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sha256Bytes(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sha256File(file: string): string {
  return sha256Bytes(fs.readFileSync(file));
}

function areaNameFromSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function approvalRecordPath(slug: string, campaignId: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/campaign-approvals", slug, `${campaignId}.json`);
}

function isSafeRelativePath(rel: string): boolean {
  const normalised = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  return Boolean(normalised) && !normalised.includes("..") && !path.isAbsolute(normalised);
}

export function resolveLockedCampaignStagingBaseUrl(slug: string): string {
  const profile = readManagedPublishingProfile(slug);
  return String(profile?.managedUrl || `https://${slug}.sites.pharmaconnect.uk/`).replace(/\/+$/, "");
}

function customerHostsForTenant(slug: string): string[] {
  const profile = readManagedPublishingProfile(slug);
  const hosts = new Set<string>();
  for (const raw of [profile?.customerRootDomain, profile?.customerRootDomainEvidenceUrl]) {
    const value = String(raw || "").trim();
    if (!value) continue;
    try {
      const host = value.includes("://") ? new URL(value).hostname : value.replace(/^www\./, "");
      if (host) hosts.add(host.replace(/^www\./, "").toLowerCase());
    } catch {
      hosts.add(value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase());
    }
  }
  return [...hosts].filter(Boolean);
}

function otherServiceIds(serviceId: string): string[] {
  return OTHER_SERVICE_IDS.filter((id) => id !== serviceId);
}

export function stagingServicePublicPath(serviceId: string): string {
  return `/${serviceId}/`;
}

export function stagingLocalityPublicPath(serviceId: string, areaSlug: string): string {
  return `/${serviceId}/local/${areaSlug}/`;
}

export function parseLockedCampaignStagingPublishRequest(
  routeSlug: string,
  body: unknown,
): { ok: true; tenantSlug: string; campaignId: string } | { ok: false; unmetCondition: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, unmetCondition: "Publish to staging may only include tenantSlug and campaignId" };
  }
  const rec = body as Record<string, unknown>;
  const extra = Object.keys(rec).filter((key) => key !== "tenantSlug" && key !== "campaignId");
  if (extra.length) {
    return { ok: false, unmetCondition: "Publish to staging may only include tenantSlug and campaignId" };
  }
  const tenantSlug = String(rec.tenantSlug || "").trim();
  const campaignId = String(rec.campaignId || "").trim();
  const expected = tenantKey(routeSlug);
  if (!tenantSlug || tenantKey(tenantSlug) !== expected) {
    return { ok: false, unmetCondition: "tenantSlug must match the Product Owner tenant" };
  }
  if (!campaignId) {
    return { ok: false, unmetCondition: "campaignId is required" };
  }
  return { ok: true, tenantSlug: expected, campaignId };
}

function expectedServiceSource(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
}

function expectedLocalitySource(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    slug,
    serviceId,
    "local",
    areaSlug,
    "index.html",
  );
}

function assertLockedSourcePath(file: string, expected: string): string | null {
  const resolved = path.resolve(file);
  const want = path.resolve(expected);
  if (resolved !== want) return `Locked path is not the campaign source: ${file}`;
  if (!fs.existsSync(resolved)) return `Locked page missing: ${file}`;
  return null;
}

export function resolveLockedCampaignStagingInventory(
  tenantSlug: string,
  campaignId: string,
): LockedCampaignStagingInventory {
  const slug = tenantKey(tenantSlug);
  const serviceId = String(campaignId || "").trim();
  const stagingBaseUrl = resolveLockedCampaignStagingBaseUrl(slug);
  const empty: LockedCampaignStagingInventory = {
    ok: false,
    blockers: [],
    tenantSlug: slug,
    campaignId: serviceId,
    serviceId,
    lockedBankHash: null,
    stagingBaseUrl,
    pages: [],
  };
  if (!serviceId) return { ...empty, blockers: ["campaignId is required"] };

  const approvalPath = approvalRecordPath(slug, serviceId);
  if (!fs.existsSync(approvalPath)) {
    return { ...empty, blockers: ["Approved-locked campaign record is missing"] };
  }
  let approval: {
    status?: string;
    lockedBankHash?: string;
    lockedPageCount?: number;
    lockedCorePageInventory?: {
      servicePage?: { path?: string; sha256?: string };
      localities?: Array<{ areaSlug?: string; path?: string; sha256?: string }>;
    };
  };
  try {
    approval = JSON.parse(fs.readFileSync(approvalPath, "utf8")) as typeof approval;
  } catch {
    return { ...empty, blockers: ["Approved-locked campaign record is unreadable"] };
  }
  if (approval.status !== "approved-locked") {
    return { ...empty, blockers: ["Campaign is not approved-locked"] };
  }

  const pkg = loadContentPackage(slug, serviceId);
  if (!pkg) return { ...empty, blockers: ["Campaign package is missing"] };
  const packageLocked =
    pkg.status === "approved-locked" ||
    pkg.approvalStatus === "approved-locked" ||
    Boolean(pkg.campaignLock?.lockedBankHash);
  if (!packageLocked) return { ...empty, blockers: ["Campaign package is not approved-locked"] };

  const bank = resolveApprovedServiceBank(serviceId);
  const lockedBankHash = String(approval.lockedBankHash || pkg.campaignLock?.lockedBankHash || "").trim();
  if (!lockedBankHash) return { ...empty, blockers: ["Locked bank hash is missing"] };
  if (pkg.campaignLock?.lockedBankHash && pkg.campaignLock.lockedBankHash !== lockedBankHash) {
    return { ...empty, blockers: ["Package locked bank hash does not match the approval record"] };
  }
  if (bank?.hash && bank.hash !== lockedBankHash) {
    return { ...empty, blockers: ["Locked bank hash does not match the approved-bank registry"] };
  }

  const serviceEntry = approval.lockedCorePageInventory?.servicePage;
  const localityEntries = approval.lockedCorePageInventory?.localities || [];
  if (!serviceEntry?.path || !serviceEntry.sha256) {
    return { ...empty, blockers: ["Locked service page inventory is missing"] };
  }
  if (localityEntries.length !== EXPECTED_STAGING_LOCALITY_COUNT) {
    return {
      ...empty,
      lockedBankHash,
      blockers: [`Locked locality inventory must be exactly ${EXPECTED_STAGING_LOCALITY_COUNT} pages`],
    };
  }
  if (Number(approval.lockedPageCount || 0) !== 1 + EXPECTED_STAGING_LOCALITY_COUNT) {
    return { ...empty, lockedBankHash, blockers: ["Locked page count must be one service page plus eight localities"] };
  }

  const pages: LockedStagingPage[] = [];
  const serviceErr = assertLockedSourcePath(serviceEntry.path, expectedServiceSource(slug, serviceId));
  if (serviceErr) return { ...empty, lockedBankHash, blockers: [serviceErr] };
  const serviceHash = sha256File(serviceEntry.path);
  if (serviceHash !== serviceEntry.sha256) {
    return { ...empty, lockedBankHash, blockers: ["Locked service page hash does not match the current file"] };
  }
  pages.push({
    pageType: "service",
    areaSlug: null,
    sourcePath: serviceEntry.path,
    sha256: serviceHash,
    publicPath: stagingServicePublicPath(serviceId),
    relativePath: `${serviceId}/index.html`,
  });

  for (const loc of localityEntries) {
    const areaSlug = String(loc.areaSlug || "").trim();
    if (!areaSlug || !loc.path || !loc.sha256) {
      return { ...empty, lockedBankHash, blockers: ["Locked locality inventory entry is incomplete"] };
    }
    const locErr = assertLockedSourcePath(loc.path, expectedLocalitySource(slug, serviceId, areaSlug));
    if (locErr) return { ...empty, lockedBankHash, blockers: [locErr] };
    const locHash = sha256File(loc.path);
    if (locHash !== loc.sha256) {
      return { ...empty, lockedBankHash, blockers: [`Locked locality hash does not match: ${areaSlug}`] };
    }
    pages.push({
      pageType: "locality",
      areaSlug,
      sourcePath: loc.path,
      sha256: locHash,
      publicPath: stagingLocalityPublicPath(serviceId, areaSlug),
      relativePath: `${serviceId}/local/${areaSlug}/index.html`,
    });
  }

  return {
    ok: true,
    blockers: [],
    tenantSlug: slug,
    campaignId: serviceId,
    serviceId,
    lockedBankHash,
    stagingBaseUrl,
    pages,
  };
}

function rewritePreviewAndLocalLinks(html: string, serviceId: string, areaSlugs: string[]): string {
  const escapedService = serviceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = html;
  out = out.replace(
    new RegExp(`/api/pharmacy-visual-experience/${escapedService}/[^"'\\s>]*`, "gi"),
    `/${serviceId}/`,
  );
  out = out.replace(
    new RegExp(`/api/pharmacy-content-ecosystem-preview/${escapedService}/local/([^/?"'\\s>]+)/[^"'\\s>]*`, "gi"),
    (_match, segment: string) => `/${serviceId}/local/${String(segment || "").trim()}/`,
  );
  out = out.replace(
    new RegExp(`/api/pharmacy-content-ecosystem-preview/${escapedService}/[^"'\\s>]*`, "gi"),
    `/${serviceId}/`,
  );
  for (const area of areaSlugs) {
    const escapedArea = area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(["'])/local-${escapedArea}/?\\1`, "g"), `$1/${serviceId}/local/${area}/$1`);
    out = out.replace(new RegExp(`(["'])/local/${escapedArea}/?\\1`, "g"), `$1/${serviceId}/local/${area}/$1`);
  }
  out = out.replace(/href=(["'])\/locations\/?\1/gi, `href=$1/${serviceId}/$1`);
  out = out.replace(/\?slug=[^"'&\s>]*/gi, "");
  out = out.replace(/href="\/\/([^"]+)"/g, 'href="https://$1"');
  return out;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stagingServiceDisplayName(serviceId: string): string {
  return getServicePublishMeta(serviceId)?.serviceName || areaNameFromSlug(serviceId);
}

export function stagingLocalityNavHeading(serviceId: string): string {
  return `${stagingServiceDisplayName(serviceId)} near you`;
}

export const STAGING_SERVICE_OVERVIEW_ALIGN_MARKER = "approved-core-page-service-overview-align-29j";
export { PHARMACONNECT_SERVICE_PAGE_PRESENTATION_CONTRACT_ID };

function insertBeforeMainClose(html: string, snippet: string): string {
  if (/<\/main>/i.test(html)) return html.replace(/<\/main>/i, `${snippet}\n</main>`);
  if (/<footer\b/i.test(html)) return html.replace(/<footer\b/i, `${snippet}\n<footer`);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${snippet}\n</body>`);
  return `${html}\n${snippet}`;
}

function stagingServiceLocalityNavHtml(serviceId: string, areaSlugs: string[]): string {
  const heading = stagingLocalityNavHeading(serviceId);
  const items = areaSlugs
    .map((area) => {
      const href = stagingLocalityPublicPath(serviceId, area);
      return `<li><a href="${href}">${escapeHtmlText(areaNameFromSlug(area))}</a></li>`;
    })
    .join("");
  return `<section class="cluster-link-band soft" data-staging-campaign-nav="service" aria-labelledby="staging-campaign-nav-heading"><div class="wrap"><div class="section-head center"><h2 id="staging-campaign-nav-heading">${escapeHtmlText(heading)}</h2></div><ul class="clean">${items}</ul></div></section>`;
}

export function stagingServiceHubCtaHeading(serviceId: string): string {
  return `Find out more about ${stagingServiceDisplayName(serviceId)}`;
}

export function stagingServiceHubCtaButtonLabel(serviceId: string): string {
  return `View full ${stagingServiceDisplayName(serviceId)} information`;
}

function stagingServiceHubCtaHtml(serviceId: string): string {
  const rendered = renderApprovedBankServiceHubCtaHtml(stagingServiceDisplayName(serviceId), serviceId, "");
  return rendered
    .replace(/<section class="section-band conversion-image-section"[\s\S]*?<\/section>\s*/i, "")
    .replace(/\sid=["']contact["']/, ' id="service-hub-cta"');
}

function isHiddenOnlyMarkup(html: string): boolean {
  return (
    /\bhidden\b/i.test(html) ||
    /aria-hidden=["']true["']/i.test(html) ||
    /display\s*:\s*none/i.test(html) ||
    /visibility\s*:\s*hidden/i.test(html) ||
    /font-size\s*:\s*0/i.test(html) ||
    /(?:width|height)\s*:\s*0(?:px|em|rem|%)?/i.test(html) ||
    /clip(?:-path)?\s*:/i.test(html) ||
    /class=["'][^"']*(?:sr-only|visually-hidden|screen-reader)/i.test(html)
  );
}

export function extractVisibleStagingServiceHubCta(html: string): string | null {
  const match = html.match(
    /<section\b[^>]*data-service-hub-cta="[^"]+"[^>]*>[\s\S]*?<\/section>/i,
  );
  if (!match) return null;
  const block = match[0];
  if (isHiddenOnlyMarkup(block)) return null;
  return block;
}

function ensureStagingCampaignNavigation(
  html: string,
  serviceId: string,
  areaSlug: string | null,
  areaSlugs: string[],
): string {
  if (areaSlug) {
    if (/data-service-hub-cta=/.test(html)) return html;
    const snippet = stagingServiceHubCtaHtml(serviceId);
    if (/data-template-block=["']parent-child-links["']/.test(html)) {
      return html.replace(
        /(<section\b[^>]*data-template-block=["']parent-child-links["'])/i,
        `${snippet}\n$1`,
      );
    }
    return insertBeforeMainClose(html, snippet);
  }
  if (/data-staging-campaign-nav="service"/i.test(html)) return html;
  const snippet = stagingServiceLocalityNavHtml(serviceId, areaSlugs);
  const localAccess = /(<section\b[^>]*id=["']local-access["'][\s\S]*?<\/section>)/i;
  if (localAccess.test(html)) return html.replace(localAccess, `$1\n${snippet}`);
  return insertBeforeMainClose(html, snippet);
}

function rewriteCustomerHosts(html: string, stagingBaseUrl: string, customerHosts: string[]): string {
  let out = html;
  const origin = stagingBaseUrl.replace(/\/+$/, "");
  for (const host of customerHosts) {
    const escaped = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`https?://(?:www\\.)?${escaped}`, "gi"), origin);
  }
  return out;
}

function ensureRobotsMeta(html: string): string {
  if (/<meta\s+name=["']robots["']/i.test(html)) {
    return html.replace(
      /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta name="robots" content="noindex, nofollow"/>`,
    );
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n<meta name="robots" content="noindex, nofollow"/>`);
  }
  return `<meta name="robots" content="noindex, nofollow"/>\n${html}`;
}

function ensureCanonical(html: string, canonicalUrl: string): string {
  const tag = `<link rel="canonical" href="${canonicalUrl}"/>`;
  if (/rel=["']canonical["']/i.test(html)) {
    return html.replace(/<link[^>]*rel=["']canonical["'][^>]*>/i, tag);
  }
  if (/<meta\s+name=["']robots["'][^>]*>/i.test(html)) {
    return html.replace(/(<meta\s+name=["']robots["'][^>]*>)/i, `$1\n${tag}`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n${tag}`);
  }
  return `${tag}\n${html}`;
}

function rewriteJsonLdValue(
  value: unknown,
  stagingBaseUrl: string,
  pageUrl: string,
  customerHosts: string[],
): unknown {
  if (typeof value === "string") {
    return rewriteCustomerHosts(value, stagingBaseUrl, customerHosts);
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteJsonLdValue(item, stagingBaseUrl, pageUrl, customerHosts));
  }
  if (!value || typeof value !== "object") return value;
  const node = value as Record<string, unknown>;
  const types = String(node["@type"] || "");
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(node)) {
    if (key === "url" && typeof child === "string" && /WebPage|Service/i.test(types)) {
      out[key] = pageUrl;
      continue;
    }
    out[key] = rewriteJsonLdValue(child, stagingBaseUrl, pageUrl, customerHosts);
  }
  return out;
}

function localityJsonLd(
  stagingBaseUrl: string,
  serviceId: string,
  areaSlug: string,
  title: string,
  pharmacyName: string,
): Record<string, unknown> {
  const serviceUrl = `${stagingBaseUrl}${stagingServicePublicPath(serviceId)}`;
  const pageUrl = `${stagingBaseUrl}${stagingLocalityPublicPath(serviceId, areaSlug)}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", name: title, url: pageUrl },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: pharmacyName, item: `${stagingBaseUrl}/` },
          {
            "@type": "ListItem",
            position: 2,
            name: getServicePublishMeta(serviceId)?.serviceName || serviceId,
            item: serviceUrl,
          },
          { "@type": "ListItem", position: 3, name: areaNameFromSlug(areaSlug), item: pageUrl },
        ],
      },
    ],
  };
}

function repairJsonLdRaw(raw: string): string {
  return raw.replace(/,""([A-Za-z][A-Za-z0-9]*)":/g, `,"$1":`);
}

function applyJsonLd(
  html: string,
  stagingBaseUrl: string,
  pageUrl: string,
  customerHosts: string[],
  injectIfMissing: Record<string, unknown> | null,
): string {
  const blockRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let replaced = false;
  const next = html.replace(blockRe, (_full, raw: string) => {
    replaced = true;
    const candidates = [raw, repairJsonLdRaw(raw)];
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        const rewritten = rewriteJsonLdValue(parsed, stagingBaseUrl, pageUrl, customerHosts);
        return `<script type="application/ld+json">${JSON.stringify(rewritten).replace(/</g, "\\u003c")}</script>`;
      } catch {
        /* try next candidate */
      }
    }
    return `<script type="application/ld+json">${rewriteCustomerHosts(repairJsonLdRaw(raw), stagingBaseUrl, customerHosts)}</script>`;
  });
  if (replaced || !injectIfMissing) return next;
  const tag = `<script type="application/ld+json">${JSON.stringify(injectIfMissing).replace(/</g, "\\u003c")}</script>`;
  if (/<\/head>/i.test(next)) return next.replace(/<\/head>/i, `${tag}\n</head>`);
  return `${tag}\n${next}`;
}

function collectAssetRefs(html: string): string[] {
  const refs = new Set<string>();
  for (const match of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/gi)) {
    refs.add((match[1].split("?")[0] || match[1]).replace(/&amp;/g, "&"));
  }
  return [...refs];
}

function copyAssetContents(assetRef: string): Buffer | null {
  const rel = assetRef.replace(/^\/+/, "");
  const source = path.join(ASSET_ROOT, rel.replace(/^assets\//, ""));
  if (!fs.existsSync(source) || !source.startsWith(ASSET_ROOT)) return null;
  return fs.readFileSync(source);
}

export function rewriteLockedCampaignStagingHtml(input: {
  html: string;
  tenantSlug: string;
  serviceId: string;
  areaSlug: string | null;
  stagingBaseUrl: string;
  areaSlugs: string[];
}): string {
  const { html, tenantSlug, serviceId, areaSlug, stagingBaseUrl, areaSlugs } = input;
  const customerHosts = customerHostsForTenant(tenantSlug);
  const serviceUrl = `${stagingBaseUrl}${stagingServicePublicPath(serviceId)}`;
  const pageUrl = areaSlug ? `${stagingBaseUrl}${stagingLocalityPublicPath(serviceId, areaSlug)}` : serviceUrl;
  let out = rewritePreviewAndLocalLinks(html, serviceId, areaSlugs);
  const brand = resolveTenantBrandIdentity(tenantSlug);
  out = protectTenantBrandLogoDuringHostRewrite(out, brand.logoUrl.value, (input) =>
    rewriteCustomerHosts(input, stagingBaseUrl, customerHosts),
  );
  out = applyApprovedCorePagePresentationContractCss(out);
  out = applyTenantBrandPresentationOverlay(out, tenantSlug);
  out = ensureStagingCampaignNavigation(out, serviceId, areaSlug, areaSlugs);
  out = ensureRobotsMeta(out);
  out = ensureCanonical(out, pageUrl);
  const titleMatch = out.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/&amp;/g, "&") : areaNameFromSlug(areaSlug || serviceId);
  const inject = areaSlug
    ? localityJsonLd(stagingBaseUrl, serviceId, areaSlug, title, "Yorkshire Pharmacy and Health Clinic")
    : null;
  return applyJsonLd(out, stagingBaseUrl, pageUrl, customerHosts, inject);
}

function htmlHasHttpCustomerHost(html: string, host: string): boolean {
  const escaped = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`https?://(?:www\\.)?${escaped}`, "i").test(html);
}

function htmlHasCrossServicePageUrl(html: string, serviceId: string): boolean {
  const escaped = serviceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:href|content)=["'](?:https?://[^"']+)?/${escaped}/`, "i").test(html);
}

function assertPackagedHtmlSafe(
  html: string,
  serviceId: string,
  stagingBaseUrl: string,
  tenantSlug: string,
  areaSlug: string | null,
  areaSlugs: string[],
): string[] {
  const blockers: string[] = [];
  if (!/name="robots"\s+content="noindex, nofollow"/i.test(html)) {
    blockers.push("Packaged page is missing noindex, nofollow");
  }
  const canonical = html.match(/rel="canonical"\s+href="([^"]+)"/i)?.[1] || "";
  if (!canonical.startsWith(stagingBaseUrl)) {
    blockers.push("Canonical is not the managed staging destination");
  }
  for (const host of customerHostsForTenant(tenantSlug)) {
    const brandLogo = resolveTenantBrandIdentity(tenantSlug).logoUrl.value;
    const withoutBrandLogo = brandLogo ? html.split(brandLogo).join("") : html;
    if (htmlHasHttpCustomerHost(withoutBrandLogo, host)) {
      blockers.push(`Packaged page still references customer domain ${host}`);
    }
    if (canonical.toLowerCase().includes(host.toLowerCase())) {
      blockers.push(`Canonical references customer domain ${host}`);
    }
  }
  if (/href=["']\/locations\//i.test(html)) blockers.push("Packaged page still links to /locations/");
  if (/href=["']\/local-[a-z0-9-]+\/?["']/i.test(html)) {
    blockers.push("Packaged page still links to /local-{locality}/");
  }
  if (/href=["']\/local\/[a-z0-9-]+\/?["']/i.test(html)) {
    blockers.push("Packaged page still links to unpackaged /local/{locality}/");
  }
  for (const other of otherServiceIds(serviceId)) {
    if (htmlHasCrossServicePageUrl(html, other)) {
      blockers.push(`Packaged page contains cross-service URL /${other}/`);
    }
  }
  if (/\/api\/pharmacy-(visual-experience|content-ecosystem-preview)\//i.test(html)) {
    blockers.push("Packaged page still contains preview API links");
  }
  const heading = stagingLocalityNavHeading(serviceId);
  const hub = stagingServicePublicPath(serviceId);
  const escapedHub = hub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!areaSlug) {
    if (!html.includes(PHARMACONNECT_SERVICE_PAGE_PRESENTATION_CONTRACT_ID)) {
      blockers.push("Service page is missing the shared presentation contract CSS");
    }
    if (!html.includes(STAGING_SERVICE_OVERVIEW_ALIGN_MARKER)) {
      blockers.push("Service page is missing the shared Service Overview alignment rule");
    }
    if (
      !html.includes("#service-definition .definition-split-copy>.tag") ||
      !/#service-definition \.section-opening-copy>\.tag\{display:inline-block;text-align:center;margin-left:auto;margin-right:auto/.test(
        html,
      )
    ) {
      blockers.push("Service Overview label is not centred by shared CSS");
    }
    if (
      !html.includes("#service-definition .definition-split-copy>p") ||
      !/#service-definition \.section-opening-copy>p\{text-align:center;max-width:var\(--reading-width-narrative\);margin:0 auto 18px/.test(
        html,
      )
    ) {
      blockers.push("Service Overview paragraphs are not centred by shared CSS");
    }
    if (!html.includes(heading)) {
      blockers.push("Service page is missing the staging locality navigation heading");
    }
    for (const area of areaSlugs) {
      const href = stagingLocalityPublicPath(serviceId, area);
      const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`href=["']${escaped}["']`, "i").test(html)) {
        blockers.push(`Service page is missing locality link ${href}`);
      }
    }
  } else {
    const cta = extractVisibleStagingServiceHubCta(html);
    const ctaHeading = stagingServiceHubCtaHeading(serviceId);
    const ctaButton = stagingServiceHubCtaButtonLabel(serviceId);
    if (!cta) {
      blockers.push("Locality page is missing a visible service hub CTA");
    } else if (!cta.includes(`>${ctaHeading}</h2>`) || !cta.includes(ctaButton) || !new RegExp(`href=["']${escapedHub}["']`, "i").test(cta)) {
      blockers.push("Locality page hub CTA is not the visible full-service link");
    }
  }
  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  if (!ldBlocks.length) blockers.push("Packaged page is missing JSON-LD");
  for (const block of ldBlocks) {
    try {
      JSON.parse(block[1]);
    } catch {
      blockers.push("Packaged JSON-LD does not parse");
    }
  }
  return blockers;
}

export function packageLockedCampaignStagingRelease(
  inventory: LockedCampaignStagingInventory,
): { ok: true; pkg: LockedCampaignStagingPackage } | { ok: false; blockers: string[] } {
  if (!inventory.ok || !inventory.lockedBankHash) {
    return { ok: false, blockers: inventory.blockers.length ? inventory.blockers : ["Locked inventory is not ready"] };
  }
  const areaSlugs = inventory.pages.filter((p) => p.pageType === "locality").map((p) => String(p.areaSlug));
  const files: StagingPackageFile[] = [];
  const blockers: string[] = [];
  const assetRefs = new Set<string>();

  for (const page of inventory.pages) {
    const sourceHtml = fs.readFileSync(page.sourcePath, "utf8");
    const html = rewriteLockedCampaignStagingHtml({
      html: sourceHtml,
      tenantSlug: inventory.tenantSlug,
      serviceId: inventory.serviceId,
      areaSlug: page.areaSlug,
      stagingBaseUrl: inventory.stagingBaseUrl,
      areaSlugs,
    });
    blockers.push(...assertPackagedHtmlSafe(
      html,
      inventory.serviceId,
      inventory.stagingBaseUrl,
      inventory.tenantSlug,
      page.areaSlug,
      areaSlugs,
    ));
    files.push({
      relativePath: page.relativePath,
      contents: Buffer.from(html, "utf8"),
      contentType: "text/html; charset=utf-8",
    });
    for (const ref of collectAssetRefs(html)) assetRefs.add(ref);
  }

  for (const ref of assetRefs) {
    const contents = copyAssetContents(ref);
    if (!contents) {
      blockers.push(`Required asset missing: ${ref}`);
      continue;
    }
    const relativePath = ref.replace(/^\/+/, "");
    if (!isSafeRelativePath(relativePath)) {
      blockers.push(`Unsafe asset path: ${ref}`);
      continue;
    }
    files.push({ relativePath, contents, contentType: "application/octet-stream" });
  }

  files.push({
    relativePath: "robots.txt",
    contents: Buffer.from(STAGING_ROBOTS_TXT, "utf8"),
    contentType: "text/plain; charset=utf-8",
  });

  if (files.some((f) => /(^|\/)sitemap\.xml$/i.test(f.relativePath))) {
    blockers.push("Staging package must not include a sitemap");
  }
  const htmlPages = files.filter((f) => f.relativePath.endsWith("/index.html") || f.relativePath === "index.html");
  if (htmlPages.length !== 1 + EXPECTED_STAGING_LOCALITY_COUNT) {
    blockers.push("Staging package does not contain exactly nine campaign pages");
  }

  const uniqueBlockers = [...new Set(blockers)];
  if (uniqueBlockers.length) return { ok: false, blockers: uniqueBlockers };

  return {
    ok: true,
    pkg: {
      tenantSlug: inventory.tenantSlug,
      campaignId: inventory.campaignId,
      serviceId: inventory.serviceId,
      stagingBaseUrl: inventory.stagingBaseUrl,
      lockedBankHash: inventory.lockedBankHash,
      brandRevision: resolveTenantBrandIdentity(inventory.tenantSlug).revision,
      files,
      pagePublicPaths: inventory.pages.map((p) => p.publicPath),
      assetPaths: [...assetRefs],
    },
  };
}

function walkRelativeFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    if (!fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else out.push(path.relative(root, full).replace(/\\/g, "/"));
    }
  }
  return out.sort();
}

function copyDirContents(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirContents(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

function rmDirIfExists(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

export function createFilesystemStagingDestination(root: string, stagingBaseUrl: string): StagingDestination {
  const currentDir = path.join(root, "current");
  const releasesDir = path.join(root, "releases");
  const snapshotsDir = path.join(root, "snapshots");
  fs.mkdirSync(currentDir, { recursive: true });
  fs.mkdirSync(releasesDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });

  const releaseDir = (id: string) => path.join(releasesDir, id);
  const snapshotDir = (id: string) => path.join(snapshotsDir, id);

  return {
    kind: "filesystem",
    stagingBaseUrl,
    async captureCurrent(snapshotId) {
      const dest = snapshotDir(snapshotId);
      rmDirIfExists(dest);
      copyDirContents(currentDir, dest);
      return snapshotId;
    },
    async writeRelease(releaseId, files) {
      const dest = releaseDir(releaseId);
      rmDirIfExists(dest);
      fs.mkdirSync(dest, { recursive: true });
      for (const file of files) {
        if (!isSafeRelativePath(file.relativePath)) throw new Error(`Unsafe release path: ${file.relativePath}`);
        const out = path.join(dest, file.relativePath);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, file.contents);
      }
    },
    async validateRelease(releaseId, files) {
      const dest = releaseDir(releaseId);
      for (const file of files) {
        const out = path.join(dest, file.relativePath);
        if (!fs.existsSync(out)) throw new Error(`Release file missing: ${file.relativePath}`);
        if (sha256Bytes(fs.readFileSync(out)) !== sha256Bytes(file.contents)) {
          throw new Error(`Release file checksum mismatch: ${file.relativePath}`);
        }
      }
    },
    async switchCurrent(releaseId, snapshotId, files) {
      const nextDir = `${currentDir}.next`;
      rmDirIfExists(nextDir);
      copyDirContents(currentDir, nextDir);
      for (const file of files) {
        const out = path.join(nextDir, file.relativePath);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, file.contents);
      }
      const prevDir = `${currentDir}.prev`;
      rmDirIfExists(prevDir);
      fs.renameSync(currentDir, prevDir);
      try {
        fs.renameSync(nextDir, currentDir);
      } catch (err) {
        if (fs.existsSync(prevDir) && !fs.existsSync(currentDir)) fs.renameSync(prevDir, currentDir);
        throw err;
      }
      rmDirIfExists(prevDir);
      fs.writeFileSync(path.join(root, "previous-release"), snapshotId, "utf8");
      fs.writeFileSync(path.join(root, "current-release"), releaseId, "utf8");
    },
    async restoreSnapshot(snapshotId) {
      const src = snapshotDir(snapshotId);
      if (!fs.existsSync(src)) throw new Error("Rollback snapshot is missing");
      const nextDir = `${currentDir}.next`;
      rmDirIfExists(nextDir);
      copyDirContents(src, nextDir);
      const prevDir = `${currentDir}.prev`;
      rmDirIfExists(prevDir);
      fs.renameSync(currentDir, prevDir);
      try {
        fs.renameSync(nextDir, currentDir);
      } catch (err) {
        if (fs.existsSync(prevDir) && !fs.existsSync(currentDir)) fs.renameSync(prevDir, currentDir);
        throw err;
      }
      rmDirIfExists(prevDir);
    },
    async readCurrent(relativePath) {
      const file = path.join(currentDir, relativePath);
      if (!fs.existsSync(file)) return null;
      return fs.readFileSync(file);
    },
    async listCurrent() {
      return walkRelativeFiles(currentDir);
    },
  };
}

function htmlFromBuffer(buf: Buffer | null): string {
  return buf ? buf.toString("utf8") : "";
}

function extractHrefs(html: string): string[] {
  return [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map((m) => m[1]);
}

export async function validateLockedCampaignStagingHealth(
  dest: StagingDestination,
  pkg: LockedCampaignStagingPackage,
): Promise<StagingHealthCheck[]> {
  const checks: StagingHealthCheck[] = [];
  const allowed = new Set(pkg.pagePublicPaths);
  const allowedAssets = new Set(pkg.assetPaths);

  for (const publicPath of pkg.pagePublicPaths) {
    const rel = `${publicPath.replace(/^\/+|\/+$/g, "")}/index.html`;
    const buf = await dest.readCurrent(rel);
    const url = `${pkg.stagingBaseUrl}${publicPath}`;
    if (!buf) {
      checks.push({ url, status: 404, ok: false, detail: "HTTP 404 — page missing from current release" });
      continue;
    }
    const html = htmlFromBuffer(buf);
    const problems: string[] = [];
    if (!/name="robots"\s+content="noindex, nofollow"/i.test(html)) problems.push("missing noindex");
    const canonical = html.match(/rel="canonical"\s+href="([^"]+)"/i)?.[1] || "";
    if (canonical !== url) problems.push(`canonical ${canonical || "(missing)"}`);
    if (!/<style/i.test(html)) problems.push("styles missing");
    if (!/maps\.google/i.test(html)) problems.push("map missing");
    const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    if (!ldBlocks.length) problems.push("JSON-LD missing");
    for (const block of ldBlocks) {
      try {
        const parsed = JSON.parse(block[1]) as unknown;
        const blob = JSON.stringify(parsed);
        if (!blob.includes(pkg.stagingBaseUrl)) problems.push("JSON-LD missing staging host");
        for (const host of customerHostsForTenant(pkg.tenantSlug)) {
          if (blob.toLowerCase().includes(host.toLowerCase())) problems.push("JSON-LD customer domain");
        }
      } catch {
        problems.push("JSON-LD parse error");
      }
    }
    for (const href of extractHrefs(html)) {
      if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) continue;
      if (
        /^https?:\/\/(?:(?:www\.)?google\.com\/maps|maps\.google|fonts\.googleapis\.com|fonts\.gstatic\.com)/i.test(
          href,
        )
      ) {
        continue;
      }
      if (href.startsWith("/assets/")) {
        const assetRef = href.split("?")[0];
        if (!allowedAssets.has(assetRef)) problems.push(`unknown asset ${href}`);
        const assetRel = assetRef.replace(/^\/+/, "");
        if (!(await dest.readCurrent(assetRel))) problems.push(`asset 404 ${href}`);
        continue;
      }
      if (href === "/robots.txt") continue;
      let pathOnly = href;
      if (href.startsWith("http")) {
        try {
          pathOnly = new URL(href).pathname;
        } catch {
          problems.push(`bad url ${href}`);
          continue;
        }
      }
      pathOnly = pathOnly.replace(/\/?$/, "/");
      if (pathOnly === "/") continue;
      if (!allowed.has(pathOnly)) problems.push(`unresolved link ${href}`);
    }
    for (const other of otherServiceIds(pkg.serviceId)) {
      if (htmlHasCrossServicePageUrl(html, other)) problems.push(`cross-service /${other}/`);
    }
    const hub = stagingServicePublicPath(pkg.serviceId);
    if (publicPath === hub) {
      const heading = stagingLocalityNavHeading(pkg.serviceId);
      if (!html.includes(heading)) problems.push("missing locality navigation heading");
      for (const locPath of pkg.pagePublicPaths) {
        if (locPath === hub) continue;
        const escaped = locPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(`href=["']${escaped}["']`, "i").test(html)) problems.push(`missing nav ${locPath}`);
      }
    } else {
      const cta = extractVisibleStagingServiceHubCta(html);
      const ctaHeading = stagingServiceHubCtaHeading(pkg.serviceId);
      const ctaButton = stagingServiceHubCtaButtonLabel(pkg.serviceId);
      const escapedHub = hub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!cta) problems.push("missing visible hub CTA");
      else if (
        !cta.includes(`>${ctaHeading}</h2>`) ||
        !cta.includes(ctaButton) ||
        !new RegExp(`href=["']${escapedHub}["']`, "i").test(cta)
      ) {
        problems.push("hub CTA is not visible full-service link");
      }
    }
    checks.push({
      url,
      status: problems.length ? 500 : 200,
      ok: problems.length === 0,
      detail: problems.length ? problems.join("; ") : "HTTP 200 — staging page valid",
    });
  }

  const robots = htmlFromBuffer(await dest.readCurrent("robots.txt"));
  const robotsOk = robots.includes("Disallow: /") && !/Sitemap:/i.test(robots);
  checks.push({
    url: `${pkg.stagingBaseUrl}/robots.txt`,
    status: robotsOk ? 200 : 500,
    ok: robotsOk,
    detail: robotsOk ? "staging robots Disallow: /" : "robots.txt is not staging-protected",
  });
  const sitemap = await dest.readCurrent("sitemap.xml");
  checks.push({
    url: `${pkg.stagingBaseUrl}/sitemap.xml`,
    status: sitemap ? 500 : 404,
    ok: !sitemap,
    detail: sitemap ? "sitemap.xml must not be published for staging" : "sitemap omitted",
  });
  return checks;
}

function emptyResult(
  tenantSlug: string,
  campaignId: string,
  stagingBaseUrl: string,
  dryRun: boolean,
  error: string,
): LockedCampaignStagingPublishResult {
  return {
    ok: false,
    dryRun,
    published: false,
    indexed: false,
    searchConsoleSubmitted: false,
    indexingRegistrySubmitted: false,
    sitemapUploaded: false,
    error,
    unmetCondition: error,
    message: null,
    tenantSlug,
    campaignId,
    stagingBaseUrl,
    releaseId: null,
    rollbackTarget: null,
    pages: [],
    health: [],
  };
}

export async function runLockedCampaignStagingPublish(
  request: LockedCampaignStagingPublishRequest,
  options: {
    destination?: StagingDestination;
    dryRun?: boolean;
    failHealthCheck?: boolean;
  } = {},
): Promise<LockedCampaignStagingPublishResult> {
  const inventory = resolveLockedCampaignStagingInventory(request.tenantSlug, request.campaignId);
  const dryRun = Boolean(options.dryRun);
  if (!inventory.ok) {
    return emptyResult(
      inventory.tenantSlug,
      inventory.campaignId,
      inventory.stagingBaseUrl,
      dryRun,
      inventory.blockers[0] || "Locked inventory is not ready",
    );
  }
  const packed = packageLockedCampaignStagingRelease(inventory);
  if (!packed.ok) {
    return emptyResult(
      inventory.tenantSlug,
      inventory.campaignId,
      inventory.stagingBaseUrl,
      dryRun,
      packed.blockers[0] || "Staging package failed",
    );
  }
  const pkg = packed.pkg;
  const foreign = pkg.files.filter((file) => {
    if (file.relativePath === "robots.txt" || file.relativePath.startsWith("assets/")) return false;
    return !file.relativePath.startsWith(`${pkg.serviceId}/`);
  });
  if (foreign.length) {
    return emptyResult(
      inventory.tenantSlug,
      inventory.campaignId,
      inventory.stagingBaseUrl,
      dryRun,
      "Inventory contains another campaign",
    );
  }
  let dest = options.destination;
  if (!dest) {
    const { resolveLockedCampaignStagingTransport, createLocalFilesystemStagingDestination } = await import(
      "./pharmacyLockedCampaignStagingLocalTransport.ts"
    );
    const resolved = resolveLockedCampaignStagingTransport(inventory.tenantSlug);
    if (resolved.explicitlyLocal) {
      if (!resolved.ok) {
        return emptyResult(
          inventory.tenantSlug,
          inventory.campaignId,
          inventory.stagingBaseUrl,
          dryRun,
          resolved.blockers[0] || "Local staging transport is not available",
        );
      }
      if (dryRun) {
        dest = createFilesystemStagingDestination(
          path.join(os.tmpdir(), `pc-staging-dryrun-${inventory.tenantSlug}`),
          inventory.stagingBaseUrl,
        );
      } else {
        dest = createLocalFilesystemStagingDestination({
          tenantSlug: inventory.tenantSlug,
          stagingBaseUrl: inventory.stagingBaseUrl,
        });
      }
    } else if (dryRun) {
      dest = createFilesystemStagingDestination(
        path.join(os.tmpdir(), `pc-staging-dryrun-${inventory.tenantSlug}`),
        inventory.stagingBaseUrl,
      );
    } else {
      const { createManagedSftpStagingDestination } = await import(
        "./pharmacyLockedCampaignStagingSftpDestination.ts"
      );
      dest = await createManagedSftpStagingDestination(inventory.tenantSlug, inventory.stagingBaseUrl);
    }
  }

  const releaseId = `staging-${inventory.serviceId}-${Date.now()}`;
  const snapshotId = `pre-${releaseId}`;
  await dest.writeRelease(releaseId, pkg.files);
  await dest.validateRelease(releaseId, pkg.files);
  await dest.captureCurrent(snapshotId);
  try {
    await dest.switchCurrent(releaseId, snapshotId, pkg.files);
    const health = options.failHealthCheck
      ? pkg.pagePublicPaths.map((publicPath) => ({
          url: `${pkg.stagingBaseUrl}${publicPath}`,
          status: 500,
          ok: false,
          detail: "forced health-check failure",
        }))
      : await validateLockedCampaignStagingHealth(dest, pkg);
    const healthOk = health.every((item) => item.ok);
    if (!healthOk) {
      await dest.restoreSnapshot(snapshotId);
      return {
        ...emptyResult(
          inventory.tenantSlug,
          inventory.campaignId,
          inventory.stagingBaseUrl,
          dryRun,
          "Staging health check failed — prior state restored",
        ),
        rollbackTarget: snapshotId,
        releaseId,
        pages: pkg.pagePublicPaths,
        health,
      };
    }
    return {
      ok: true,
      dryRun,
      published: dryRun ? false : true,
      indexed: false,
      searchConsoleSubmitted: false,
      indexingRegistrySubmitted: false,
      sitemapUploaded: false,
      error: null,
      unmetCondition: null,
      message: dryRun
        ? `Dry-run packaged ${pkg.pagePublicPaths.length} locked ${inventory.serviceId} pages for staging.`
        : `Published ${pkg.pagePublicPaths.length} locked ${inventory.serviceId} pages to staging.`,
      tenantSlug: inventory.tenantSlug,
      campaignId: inventory.campaignId,
      stagingBaseUrl: inventory.stagingBaseUrl,
      releaseId,
      rollbackTarget: snapshotId,
      pages: pkg.pagePublicPaths,
      health,
    };
  } catch (err) {
    try {
      await dest.restoreSnapshot(snapshotId);
    } catch {
      /* still report original error */
    }
    return emptyResult(
      inventory.tenantSlug,
      inventory.campaignId,
      inventory.stagingBaseUrl,
      dryRun,
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function rollbackLockedCampaignStagingRelease(
  dest: StagingDestination,
  snapshotId: string,
): Promise<void> {
  await dest.restoreSnapshot(snapshotId);
}

export function isLockedCampaignApprovedForStaging(tenantSlug: string, campaignId: string): boolean {
  return resolveLockedCampaignStagingInventory(tenantSlug, campaignId).ok;
}

export { lockedCampaignStagingPublishApiPath };
