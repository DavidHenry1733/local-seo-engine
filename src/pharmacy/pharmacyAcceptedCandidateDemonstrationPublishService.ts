/**
 * Demonstration publication of one accepted Pharmacy First candidate.
 * Does not require, write, or fabricate clinical or campaign approval.
 * Does not mutate saved candidates, evidence, or acceptance records.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  ACCEPTED_LOCAL_PAGE_ASSET,
  ACCEPTED_PHARMACY_FIRST_CAMPAIGN_ID,
  ACCEPTED_PHARMACY_FIRST_LOCAL_AREAS,
  ACCEPTED_SERVICE_PAGE_ASSET,
  resolveAcceptedPharmacyFirstPageRoutes,
} from "./pharmacyAcceptedPageRouteResolverV1.ts";
import {
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  AI_PILOT_V3_PREVIEW_BANNER,
  BROOK_DERBY_DEMO_SLUG,
  aiLocalCopyPilotPath,
  aiLocalPagePilotHtmlPath,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { overlayPharmacyFirstLocalPagePreviewHtml } from "./pharmacyPharmacyFirstLocalPagePreviewOverlay.ts";
import {
  resolveLockedCampaignStagingBaseUrl,
  stagingLocalityPublicPath,
  stagingServicePublicPath,
} from "./pharmacyLockedCampaignStagingPublishService.ts";
import { PHARMACY_WORKSPACE_ROOT, WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  SERVICE_PAGE_MASTER_PENDING_BANNER,
  SERVICE_PAGE_MASTER_PREVIEW_BANNER,
  SERVICE_PAGE_MASTER_TEMPLATE_VERSION,
  isExactPageVersionClinicallyApproved,
  isExactPageVersionPublicationAuthorised,
  loadServicePageMasterContext,
} from "./pharmacyServicePageMasterTemplateV1.ts";
import { renderServicePageMasterTemplatePreview } from "./pharmacyServicePageMasterTemplatePreview.ts";
import type { ReviewCentrePublicationPanel } from "./growthEngineReviewCentreModel.ts";

export const DEMONSTRATION_PUBLISH_KIND = "accepted-candidate-demonstration-publication";
export const DEMONSTRATION_PUBLISH_STATUS = "published-demonstration";
export const DEMONSTRATION_BANNER =
  "Demonstration website — not clinically approved and not submitted to search engines";
export const DEMONSTRATION_PUBLICATION_NOTICE =
  "Demonstration publication — not clinically approved and not submitted for indexing.";
export const DEMONSTRATION_ROBOTS_TXT = "User-agent: *\nDisallow: /\n";
export const ACCEPTED_SERVICE_PAGE_PUBLICATION_AREA = "service";
const BROOK_DEMONSTRATION_HOST = "brook-pharmacy-demo-derby.sites.pharmaconnect.uk";

const ASSET_ROOT = path.join(PHARMACY_WORKSPACE_ROOT, "assets");

export type AcceptedCandidateDemonstrationPublishRequest = {
  tenantSlug: string;
  campaignId: string;
  asset: string;
  area: string;
};

export type AcceptedCandidateDemonstrationPublicationRecord = {
  id: string;
  kind: typeof DEMONSTRATION_PUBLISH_KIND;
  status: typeof DEMONSTRATION_PUBLISH_STATUS;
  clinicalApproval: false;
  campaignApproval: false;
  publication: true;
  indexingSubmitted: false;
  searchConsoleSubmitted: false;
  indexingRegistrySubmitted: false;
  sitemapUploaded: false;
  tenantSlug: string;
  campaignId: string;
  asset: string;
  area: string;
  candidateVersion: string;
  candidateHtmlSha256: string;
  candidateCopySha256: string;
  publishedUrl: string;
  destinationBaseUrl: string;
  releaseId: string;
  publishedAt: string;
  robots: "noindex, nofollow";
  jsonLd: false;
  pages: string[];
};

export type AcceptedCandidateDemonstrationPublishResult = {
  ok: boolean;
  published: boolean;
  duplicate: boolean;
  indexed: false;
  searchConsoleSubmitted: false;
  indexingRegistrySubmitted: false;
  clinicalApproval: false;
  campaignApproval: false;
  error: string | null;
  unmetCondition: string | null;
  message: string | null;
  tenantSlug: string;
  campaignId: string;
  asset: string;
  area: string;
  publishedUrl: string | null;
  destinationBaseUrl: string;
  candidateVersion: string | null;
  candidateHtmlSha256: string | null;
  candidateCopySha256: string | null;
  publicationRecordId: string | null;
  status: string | null;
  releaseId: string | null;
  publishedAt: string | null;
  pages: string[];
};

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

function publicationRecordId(slug: string, campaignId: string, asset: string, area: string): string {
  return `demo-pub:${slug}:${campaignId}:${asset}:${area}`;
}

export function acceptedCandidateDemonstrationPublishApiPath(slug: string): string {
  return `/api/growth-engine/${encodeURIComponent(slug)}/review-centre/publish-demonstration`;
}

export function demonstrationPublicationRecordPath(
  slug: string,
  campaignId: string,
  asset: string,
  area: string,
): string {
  return path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-demonstration-publications",
    slug,
    campaignId,
    asset,
    `${area}.json`,
  );
}

function acceptedDecisionDir(slug: string, campaignId: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-ai-local-copy-decisions", slug, campaignId, "v3");
}

function isProductOwnerAcceptanceFile(name: string): boolean {
  return name.endsWith(".json") && name.includes("product-owner-accepted");
}

function loadLatestAcceptedDecision(slug: string, campaignId: string): {
  clinicalApproval: boolean;
  campaignApproval: boolean;
  localPages: string[];
  servicePageAsset: string | null;
} | null {
  const dir = acceptedDecisionDir(slug, campaignId);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(isProductOwnerAcceptanceFile).map((name) => path.join(dir, name));
  if (!files.length) return null;
  let best: { at: string; raw: Record<string, unknown> } | null = null;
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
      const at = String(raw.acceptedAt || raw.recordedAt || "");
      if (!best || at > best.at) best = { at, raw };
    } catch {
      continue;
    }
  }
  if (!best) return null;
  const assets = (best.raw.acceptedAssets || {}) as Record<string, unknown>;
  const servicePage =
    assets.servicePage && typeof assets.servicePage === "object" && !Array.isArray(assets.servicePage)
      ? (assets.servicePage as Record<string, unknown>)
      : null;
  return {
    clinicalApproval: best.raw.clinicalApproval === true,
    campaignApproval: best.raw.campaignApproval === true,
    localPages: Array.isArray(assets.localPages)
      ? assets.localPages.map((row) => String(row || "").trim().toLowerCase())
      : [],
    servicePageAsset: servicePage ? String(servicePage.asset || "").trim().toLowerCase() || null : null,
  };
}

function expectedHashesForArea(
  slug: string,
  campaignId: string,
  area: string,
): { htmlSha256: string | null; copySha256: string | null } {
  const dir = acceptedDecisionDir(slug, campaignId);
  if (!fs.existsSync(dir)) return { htmlSha256: null, copySha256: null };
  const files = fs.readdirSync(dir).filter(isProductOwnerAcceptanceFile);
  let best: { at: string; htmlSha256: string | null; copySha256: string | null } | null = null;
  for (const name of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as Record<string, unknown>;
      const at = String(raw.acceptedAt || raw.recordedAt || "");
      const preserved = (raw.preservedCandidateVersions || {}) as Record<string, Record<string, string>>;
      const next = {
        at,
        htmlSha256: preserved.v3HtmlSha256?.[area] || null,
        copySha256: preserved.v3CopySha256?.[area] || null,
      };
      if (!best || at > best.at) best = next;
    } catch {
      continue;
    }
  }
  return { htmlSha256: best?.htmlSha256 || null, copySha256: best?.copySha256 || null };
}

export function parseAcceptedCandidateDemonstrationPublishRequest(
  routeSlug: string,
  body: unknown,
): { ok: true; request: AcceptedCandidateDemonstrationPublishRequest } | { ok: false; unmetCondition: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, unmetCondition: "Demonstration publish may only include tenantSlug, campaignId, asset and area" };
  }
  const rec = body as Record<string, unknown>;
  const extra = Object.keys(rec).filter(
    (key) => !["tenantSlug", "campaignId", "asset", "area"].includes(key),
  );
  if (extra.length) {
    return { ok: false, unmetCondition: "Demonstration publish may only include tenantSlug, campaignId, asset and area" };
  }
  const tenantSlug = tenantKey(String(rec.tenantSlug || ""));
  const campaignId = String(rec.campaignId || "").trim().toLowerCase();
  const asset = String(rec.asset || "").trim().toLowerCase();
  const area = String(rec.area || "").trim().toLowerCase();
  if (tenantSlug !== tenantKey(routeSlug)) {
    return { ok: false, unmetCondition: "tenantSlug must match the Product Owner tenant" };
  }
  if (!tenantSlug || !campaignId || !asset || !area) {
    return { ok: false, unmetCondition: "tenantSlug, campaignId, asset and area are required" };
  }
  return { ok: true, request: { tenantSlug, campaignId, asset, area } };
}

export type ResolvedAcceptedCandidateDemonstrationPublish = {
  ok: true;
  pageType: "local-page" | "service-page";
  htmlPath: string | null;
  copyPath: string | null;
  sourceHtml: string | null;
  htmlSha256: string;
  copySha256: string;
  destinationBaseUrl: string;
  publishedUrl: string;
  relativeHtmlPath: string;
  candidateVersion: string;
};

function tenantDestinationBaseUrl(slug: string): string {
  const base = resolveLockedCampaignStagingBaseUrl(slug);
  if (slug !== BROOK_DERBY_DEMO_SLUG && base.toLowerCase().includes(BROOK_DEMONSTRATION_HOST)) {
    return `https://${slug}.sites.pharmaconnect.uk`;
  }
  return base;
}

function localAreaLabel(area: string): string {
  return ACCEPTED_PHARMACY_FIRST_LOCAL_AREAS.find((row) => row.slug === area)?.name || sentenceArea(area);
}

function sentenceArea(area: string): string {
  const text = String(area || "").replace(/-/g, " ").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pharmacyDisplayName(slug: string, campaignId: string): string {
  try {
    return loadServicePageMasterContext(slug, campaignId).identity.pharmacyName || slug;
  } catch {
    return slug;
  }
}

function campaignDisplayName(campaignId: string, fallback?: string): string {
  const known = String(fallback || "").trim();
  if (known) return known;
  if (campaignId === ACCEPTED_PHARMACY_FIRST_CAMPAIGN_ID) return "Pharmacy First";
  return sentenceArea(campaignId) || campaignId;
}

function publishedUrlForCandidate(
  destinationBaseUrl: string,
  campaignId: string,
  pageType: "local-page" | "service-page",
  area: string,
): string {
  const path =
    pageType === "service-page"
      ? stagingServicePublicPath(campaignId)
      : stagingLocalityPublicPath(campaignId, area);
  return `${destinationBaseUrl}${path}`;
}

function relativeHtmlPathForCandidate(
  campaignId: string,
  pageType: "local-page" | "service-page",
  area: string,
): string {
  return pageType === "service-page"
    ? `${campaignId}/index.html`
    : `${campaignId}/local/${area}/index.html`;
}

function emptyResult(
  request: AcceptedCandidateDemonstrationPublishRequest,
  destinationBaseUrl: string,
  error: string,
): AcceptedCandidateDemonstrationPublishResult {
  return {
    ok: false,
    published: false,
    duplicate: false,
    indexed: false,
    searchConsoleSubmitted: false,
    indexingRegistrySubmitted: false,
    clinicalApproval: false,
    campaignApproval: false,
    error,
    unmetCondition: error,
    message: null,
    tenantSlug: request.tenantSlug,
    campaignId: request.campaignId,
    asset: request.asset,
    area: request.area,
    publishedUrl: null,
    destinationBaseUrl,
    candidateVersion: null,
    candidateHtmlSha256: null,
    candidateCopySha256: null,
    publicationRecordId: null,
    status: null,
    releaseId: null,
    publishedAt: null,
    pages: [],
  };
}

export function resolveAcceptedCandidateDemonstrationPublish(
  request: AcceptedCandidateDemonstrationPublishRequest,
): ResolvedAcceptedCandidateDemonstrationPublish | { ok: false; unmetCondition: string; destinationBaseUrl: string } {
  const slug = tenantKey(request.tenantSlug);
  const campaignId = String(request.campaignId || "").trim().toLowerCase();
  const asset = String(request.asset || "").trim().toLowerCase();
  const area = String(request.area || "").trim().toLowerCase();
  const pageType = asset === ACCEPTED_SERVICE_PAGE_ASSET ? "service-page" : "local-page";
  const destinationBaseUrl = tenantDestinationBaseUrl(slug);
  if (slug !== BROOK_DERBY_DEMO_SLUG) {
    return { ok: false, unmetCondition: "Demonstration publish is limited to the Brook demonstration tenant", destinationBaseUrl };
  }
  if (campaignId !== ACCEPTED_PHARMACY_FIRST_CAMPAIGN_ID) {
    return { ok: false, unmetCondition: "Demonstration publish is limited to the pharmacy-first campaign", destinationBaseUrl };
  }
  if (asset !== ACCEPTED_LOCAL_PAGE_ASSET && asset !== ACCEPTED_SERVICE_PAGE_ASSET) {
    return { ok: false, unmetCondition: "Demonstration publish is limited to accepted service-page and V3 local-page candidates", destinationBaseUrl };
  }
  if (pageType === "local-page" && !ACCEPTED_PHARMACY_FIRST_LOCAL_AREAS.some((row) => row.slug === area)) {
    return { ok: false, unmetCondition: "Area is not an accepted Pharmacy First local page", destinationBaseUrl };
  }
  if (pageType === "service-page" && area !== ACCEPTED_SERVICE_PAGE_PUBLICATION_AREA) {
    return { ok: false, unmetCondition: "Service-page demonstration publish requires the service page identity", destinationBaseUrl };
  }
  if (!resolveAcceptedPharmacyFirstPageRoutes({ slug, campaignId })) {
    return { ok: false, unmetCondition: "Accepted page routes are not available for this tenant and campaign", destinationBaseUrl };
  }
  const decision = loadLatestAcceptedDecision(slug, campaignId);
  if (!decision) {
    return { ok: false, unmetCondition: "Product Owner acceptance record is missing", destinationBaseUrl };
  }
  if (decision.clinicalApproval) {
    return { ok: false, unmetCondition: "Genuine clinical approval is present — demonstration publish must not run", destinationBaseUrl };
  }
  if (decision.campaignApproval) {
    return { ok: false, unmetCondition: "Campaign approval is present — demonstration publish must not run", destinationBaseUrl };
  }
  if (pageType === "local-page" && !decision.localPages.includes(area)) {
    return { ok: false, unmetCondition: "This local page is not in the accepted candidate set", destinationBaseUrl };
  }
  if (pageType === "service-page" && decision.servicePageAsset !== ACCEPTED_SERVICE_PAGE_ASSET) {
    return { ok: false, unmetCondition: "This service page is not in the accepted candidate set", destinationBaseUrl };
  }
  const publishedUrl = publishedUrlForCandidate(destinationBaseUrl, campaignId, pageType, area);
  const relativeHtmlPath = relativeHtmlPathForCandidate(campaignId, pageType, area);
  if (pageType === "service-page") {
    const preview = renderServicePageMasterTemplatePreview(slug, campaignId);
    if (!preview.pageVersionHash || preview.sourceRoute !== ACCEPTED_SERVICE_PAGE_ASSET) {
      return { ok: false, unmetCondition: "Accepted service-page candidate is not available", destinationBaseUrl };
    }
    return {
      ok: true,
      pageType,
      htmlPath: null,
      copyPath: null,
      sourceHtml: preview.html,
      htmlSha256: sha256Bytes(Buffer.from(preview.html, "utf8")),
      copySha256: preview.pageVersionHash,
      destinationBaseUrl,
      publishedUrl,
      relativeHtmlPath,
      candidateVersion: `v${SERVICE_PAGE_MASTER_TEMPLATE_VERSION}`,
    };
  }
  const htmlPath = aiLocalPagePilotHtmlPath(slug, campaignId, area, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
  const copyPath = aiLocalCopyPilotPath(slug, campaignId, area, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
  if (!fs.existsSync(htmlPath) || !fs.existsSync(copyPath)) {
    return { ok: false, unmetCondition: "Accepted candidate files are missing", destinationBaseUrl };
  }
  const htmlSha256 = sha256File(htmlPath);
  const copySha256 = sha256File(copyPath);
  const expected = expectedHashesForArea(slug, campaignId, area);
  if (expected.htmlSha256 && expected.htmlSha256 !== htmlSha256) {
    return { ok: false, unmetCondition: "Saved HTML hash does not match the accepted candidate version", destinationBaseUrl };
  }
  if (expected.copySha256 && expected.copySha256 !== copySha256) {
    return { ok: false, unmetCondition: "Saved copy hash does not match the accepted candidate version", destinationBaseUrl };
  }
  return {
    ok: true,
    pageType,
    htmlPath,
    copyPath,
    sourceHtml: null,
    htmlSha256,
    copySha256,
    destinationBaseUrl,
    publishedUrl,
    relativeHtmlPath,
    candidateVersion: AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  };
}

export function canPublishAcceptedCandidateDemonstration(input: {
  slug: string;
  campaignId: string;
  asset: string;
  area: string;
}): boolean {
  return resolveAcceptedCandidateDemonstrationPublish({
    tenantSlug: input.slug,
    campaignId: input.campaignId,
    asset: input.asset,
    area: input.area,
  }).ok;
}

export function readAcceptedCandidateDemonstrationPublicationRecord(
  slug: string,
  campaignId: string,
  asset: string,
  area: string,
): AcceptedCandidateDemonstrationPublicationRecord | null {
  return readPublicationRecord(slug, campaignId, asset, area);
}

function genuineHashesForCandidate(input: {
  slug: string;
  campaignId: string;
  asset: string;
  area: string;
  pageType: "local-page" | "service-page";
}): { candidateVersion: string; htmlSha256: string; copySha256: string; clinicallyApproved: boolean; publicationAuthorised: boolean } {
  if (input.pageType === "service-page") {
    if (input.slug !== BROOK_DERBY_DEMO_SLUG) {
      const context = loadServicePageMasterContext(input.slug, input.campaignId);
      const pageVersionHash = String(context.approval?.pageVersionHash || context.publicationAuthorisation?.pageVersionHash || "");
      return {
        candidateVersion: `v${SERVICE_PAGE_MASTER_TEMPLATE_VERSION}`,
        htmlSha256: "",
        copySha256: pageVersionHash,
        clinicallyApproved: false,
        publicationAuthorised: false,
      };
    }
    const context = loadServicePageMasterContext(input.slug, input.campaignId);
    const preview = renderServicePageMasterTemplatePreview(input.slug, input.campaignId);
    const pageVersionHash = preview.pageVersionHash || "";
    return {
      candidateVersion: `v${SERVICE_PAGE_MASTER_TEMPLATE_VERSION}`,
      htmlSha256: preview.pageVersionHash ? sha256Bytes(Buffer.from(preview.html, "utf8")) : "",
      copySha256: pageVersionHash,
      clinicallyApproved: isExactPageVersionClinicallyApproved(context.approval, pageVersionHash),
      publicationAuthorised: isExactPageVersionPublicationAuthorised(context.publicationAuthorisation, pageVersionHash),
    };
  }
  const htmlPath = aiLocalPagePilotHtmlPath(input.slug, input.campaignId, input.area, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
  const copyPath = aiLocalCopyPilotPath(input.slug, input.campaignId, input.area, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
  return {
    candidateVersion: AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
    htmlSha256: fs.existsSync(htmlPath) ? sha256File(htmlPath) : "",
    copySha256: fs.existsSync(copyPath) ? sha256File(copyPath) : "",
    clinicallyApproved: false,
    publicationAuthorised: false,
  };
}

export function describeAcceptedCandidatePublication(input: {
  tenantSlug: string;
  campaignId: string;
  campaignName?: string;
  asset: string;
  area: string;
}): ReviewCentrePublicationPanel | null {
  const slug = tenantKey(input.tenantSlug);
  const campaignId = String(input.campaignId || "").trim().toLowerCase();
  const asset = String(input.asset || "").trim().toLowerCase();
  const area = String(input.area || "").trim().toLowerCase();
  const pageType = asset === ACCEPTED_SERVICE_PAGE_ASSET ? "service-page" : "local-page";
  if (asset !== ACCEPTED_LOCAL_PAGE_ASSET && asset !== ACCEPTED_SERVICE_PAGE_ASSET) return null;
  if (pageType === "local-page" && !area) return null;
  if (pageType === "service-page" && area !== ACCEPTED_SERVICE_PAGE_PUBLICATION_AREA) return null;
  const destinationBaseUrl = tenantDestinationBaseUrl(slug);
  const destinationUrl = publishedUrlForCandidate(destinationBaseUrl, campaignId, pageType, area);
  if (slug !== BROOK_DERBY_DEMO_SLUG && destinationUrl.toLowerCase().includes(BROOK_DEMONSTRATION_HOST)) {
    return null;
  }
  const pharmacyName = pharmacyDisplayName(slug, campaignId);
  const campaignName = campaignDisplayName(campaignId, input.campaignName);
  const pageTypeLabel = pageType === "service-page" ? "Service page" : "Local page";
  const areaLabel = pageType === "service-page" ? "—" : localAreaLabel(area);
  const resolved = resolveAcceptedCandidateDemonstrationPublish({
    tenantSlug: slug,
    campaignId,
    asset,
    area,
  });
  if (resolved.ok) {
    const existing = readPublicationRecord(slug, campaignId, asset, area);
    const hashesMatch = Boolean(
      existing &&
        existing.candidateHtmlSha256 === resolved.htmlSha256 &&
        existing.candidateCopySha256 === resolved.copySha256 &&
        existing.status === DEMONSTRATION_PUBLISH_STATUS,
    );
    const published = Boolean(existing && existing.status === DEMONSTRATION_PUBLISH_STATUS);
    const stale = published && !hashesMatch;
    const publishedUrl = published ? existing?.publishedUrl || resolved.publishedUrl : null;
    const primaryAction = hashesMatch ? "view-published" : stale ? "update-demonstration" : "publish-demonstration";
    return {
      kind: "demonstration",
      enabled: true,
      pageType,
      pageTypeLabel,
      area,
      areaLabel,
      pharmacyName,
      campaignName,
      apiPath: acceptedCandidateDemonstrationPublishApiPath(slug),
      asset,
      candidateVersion: resolved.candidateVersion,
      candidateHtmlSha256: resolved.htmlSha256,
      candidateCopySha256: resolved.copySha256,
      destinationBaseUrl,
      destinationUrl: publishedUrl || destinationUrl,
      publishedUrl,
      publicationStatus: hashesMatch ? "published-demonstration" : stale ? "update-available" : "not-published",
      publicationStatusLabel: hashesMatch
        ? "Published demonstration"
        : stale
          ? "Published demonstration — accepted version differs"
          : "Not published",
      approvalStatusLabel: "Not clinically approved",
      indexingStatusLabel: "Not submitted for indexing · noindex, nofollow",
      primaryAction,
      primaryActionLabel:
        primaryAction === "view-published"
          ? "View published page"
          : primaryAction === "update-demonstration"
            ? "Update demonstration page"
            : "Publish demonstration page",
      demonstrationNotice: DEMONSTRATION_PUBLICATION_NOTICE,
      lockReason: null,
      clinicalApproval: false,
      campaignApproval: false,
      publicationAuthorised: false,
      indexingSubmitted: false,
      robots: "noindex, nofollow",
    };
  }

  const genuine = genuineHashesForCandidate({ slug, campaignId, asset, area, pageType });
  const protectedChanged =
    pageType === "service-page" &&
    Boolean(loadServicePageMasterContext(slug, campaignId).approval?.pageVersionHash) &&
    !genuine.clinicallyApproved;
  const canOfferPublish = genuine.clinicallyApproved && genuine.publicationAuthorised;
  const lockReason = canOfferPublish
    ? "Genuine publication uses the confirmed tenant destination and is not available through demonstration publish."
    : protectedChanged
      ? "Publish is unavailable. Protected content changed, so clinical approval for this exact candidate version is invalid."
      : "Publish is unavailable until this exact candidate version has genuine clinical approval and publication authorisation.";
  return {
    kind: "genuine",
    enabled: true,
    pageType,
    pageTypeLabel,
    area,
    areaLabel,
    pharmacyName,
    campaignName,
    apiPath: acceptedCandidateDemonstrationPublishApiPath(slug),
    asset,
    candidateVersion: genuine.candidateVersion,
    candidateHtmlSha256: genuine.htmlSha256,
    candidateCopySha256: genuine.copySha256,
    destinationBaseUrl,
    destinationUrl,
    publishedUrl: null,
    publicationStatus: "not-published",
    publicationStatusLabel: "Not published",
    approvalStatusLabel: genuine.clinicallyApproved
      ? genuine.publicationAuthorised
        ? "Clinically approved and publication authorised"
        : "Clinically approved — publication authorisation pending"
      : "Not clinically approved",
    indexingStatusLabel: "Indexing is a separate explicit action after publication · not submitted",
    primaryAction: "locked",
    primaryActionLabel: "Publish",
    demonstrationNotice: null,
    lockReason,
    clinicalApproval: genuine.clinicallyApproved,
    campaignApproval: false,
    publicationAuthorised: genuine.publicationAuthorised,
    indexingSubmitted: false,
    robots: "noindex, nofollow",
  };
}

function stripEvidenceIdentifiers(html: string): string {
  return String(html || "")
    .replace(/\sdata-locality-evidence="[^"]*"/gi, "")
    .replace(/\sdata-evidence-[a-z0-9-]+="[^"]*"/gi, "");
}

function ensureRobotsMeta(html: string): string {
  if (/<meta\s+name=["']robots["']/i.test(html)) {
    return html.replace(
      /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta name="robots" content="noindex, nofollow"/>`,
    );
  }
  return html.replace(/<head([^>]*)>/i, `<head$1>\n<meta name="robots" content="noindex, nofollow"/>`);
}

function ensureCanonical(html: string, canonicalUrl: string): string {
  const tag = `<link rel="canonical" href="${canonicalUrl}"/>`;
  if (/rel=["']canonical["']/i.test(html)) {
    return html.replace(/<link[^>]*rel=["']canonical["'][^>]*>/i, tag);
  }
  return html.replace(/(<meta\s+name=["']robots["'][^>]*>)/i, `$1\n${tag}`);
}

function stripJsonLd(html: string): string {
  return String(html || "").replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
}

function applyDemonstrationBanner(html: string): string {
  let out = String(html || "");
  out = out.replace(new RegExp(AI_PILOT_V3_PREVIEW_BANNER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), DEMONSTRATION_BANNER);
  out = out.replace(
    new RegExp(SERVICE_PAGE_MASTER_PREVIEW_BANNER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
    DEMONSTRATION_BANNER,
  );
  out = out.replace(
    new RegExp(SERVICE_PAGE_MASTER_PENDING_BANNER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
    DEMONSTRATION_BANNER,
  );
  out = out.replace(
    /(<div class="candidate-preview-toolbar"[^>]*>)[\s\S]*?(<\/div>)/i,
    `$1${DEMONSTRATION_BANNER}$2`,
  );
  out = out.replace(
    /(<div class="pharmacy-review-preview-toolbar"[^>]*>)[\s\S]*?(<\/div>)/i,
    `$1${DEMONSTRATION_BANNER}$2`,
  );
  return out;
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
  if (!fs.existsSync(source)) return null;
  const real = fs.realpathSync(source);
  if (!real.startsWith(fs.realpathSync(ASSET_ROOT))) return null;
  return fs.readFileSync(source);
}

export function packageAcceptedCandidateDemonstrationHtml(input: {
  slug: string;
  campaignId: string;
  area: string;
  sourceHtml: string;
  publishedUrl: string;
}): string {
  let out = overlayPharmacyFirstLocalPagePreviewHtml(input.sourceHtml, {
    slug: input.slug,
    campaignId: input.campaignId,
    areaSlug: input.area,
  });
  return finalizeDemonstrationPackage(out, input.publishedUrl);
}

function packageAcceptedServicePageDemonstrationHtml(sourceHtml: string, publishedUrl: string): string {
  return finalizeDemonstrationPackage(sourceHtml, publishedUrl);
}

function finalizeDemonstrationPackage(html: string, publishedUrl: string): string {
  let out = String(html || "");
  out = stripJsonLd(out);
  out = stripEvidenceIdentifiers(out);
  out = applyDemonstrationBanner(out);
  out = ensureRobotsMeta(out);
  out = ensureCanonical(out, publishedUrl);
  if (/application\/ld\+json/i.test(out)) {
    throw new Error("Demonstration package must not contain JSON-LD");
  }
  if (!/name="robots"\s+content="noindex, nofollow"/i.test(out)) {
    throw new Error("Demonstration package must remain noindex");
  }
  return out;
}

function readPublicationRecord(
  slug: string,
  campaignId: string,
  asset: string,
  area: string,
): AcceptedCandidateDemonstrationPublicationRecord | null {
  const file = demonstrationPublicationRecordPath(slug, campaignId, asset, area);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as AcceptedCandidateDemonstrationPublicationRecord;
  } catch {
    return null;
  }
}

function writePublicationRecord(record: AcceptedCandidateDemonstrationPublicationRecord): void {
  const file = demonstrationPublicationRecordPath(
    record.tenantSlug,
    record.campaignId,
    record.asset,
    record.area,
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

function successFromRecord(
  record: AcceptedCandidateDemonstrationPublicationRecord,
  duplicate: boolean,
): AcceptedCandidateDemonstrationPublishResult {
  return {
    ok: true,
    published: true,
    duplicate,
    indexed: false,
    searchConsoleSubmitted: false,
    indexingRegistrySubmitted: false,
    clinicalApproval: false,
    campaignApproval: false,
    error: null,
    unmetCondition: null,
    message: duplicate
      ? "Demonstration publication is already current for this candidate version."
      : `Published accepted ${record.area} demonstration page.`,
    tenantSlug: record.tenantSlug,
    campaignId: record.campaignId,
    asset: record.asset,
    area: record.area,
    publishedUrl: record.publishedUrl,
    destinationBaseUrl: record.destinationBaseUrl,
    candidateVersion: record.candidateVersion,
    candidateHtmlSha256: record.candidateHtmlSha256,
    candidateCopySha256: record.candidateCopySha256,
    publicationRecordId: record.id,
    status: record.status,
    releaseId: record.releaseId,
    publishedAt: record.publishedAt,
    pages: record.pages,
  };
}

export async function runAcceptedCandidateDemonstrationPublish(
  request: AcceptedCandidateDemonstrationPublishRequest,
): Promise<AcceptedCandidateDemonstrationPublishResult> {
  const resolved = resolveAcceptedCandidateDemonstrationPublish(request);
  if (!resolved.ok) {
    return emptyResult(request, resolved.destinationBaseUrl, resolved.unmetCondition);
  }
  const existing = readPublicationRecord(request.tenantSlug, request.campaignId, request.asset, request.area);
  if (
    existing &&
    existing.candidateHtmlSha256 === resolved.htmlSha256 &&
    existing.candidateCopySha256 === resolved.copySha256 &&
    existing.status === DEMONSTRATION_PUBLISH_STATUS
  ) {
    return successFromRecord(existing, true);
  }

  const sourceHtml =
    resolved.sourceHtml ||
    (resolved.htmlPath ? fs.readFileSync(resolved.htmlPath, "utf8") : "");
  if (!sourceHtml) {
    return emptyResult(request, resolved.destinationBaseUrl, "Accepted candidate HTML is missing");
  }
  const packaged =
    resolved.pageType === "service-page"
      ? packageAcceptedServicePageDemonstrationHtml(sourceHtml, resolved.publishedUrl)
      : packageAcceptedCandidateDemonstrationHtml({
          slug: request.tenantSlug,
          campaignId: request.campaignId,
          area: request.area,
          sourceHtml,
          publishedUrl: resolved.publishedUrl,
        });
  const files: Array<{ relativePath: string; contents: Buffer; contentType: string }> = [
    {
      relativePath: resolved.relativeHtmlPath,
      contents: Buffer.from(packaged, "utf8"),
      contentType: "text/html; charset=utf-8",
    },
    {
      relativePath: "robots.txt",
      contents: Buffer.from(DEMONSTRATION_ROBOTS_TXT, "utf8"),
      contentType: "text/plain",
    },
  ];
  for (const ref of collectAssetRefs(packaged)) {
    const contents = copyAssetContents(ref);
    if (!contents) {
      return emptyResult(request, resolved.destinationBaseUrl, `Demonstration image asset is missing: ${ref}`);
    }
    files.push({
      relativePath: ref.replace(/^\/+/, ""),
      contents,
      contentType: "application/octet-stream",
    });
  }

  const { createLocalFilesystemStagingDestination } = await import(
    "./pharmacyLockedCampaignStagingLocalTransport.ts"
  );
  const dest = createLocalFilesystemStagingDestination({
    tenantSlug: request.tenantSlug,
    stagingBaseUrl: resolved.destinationBaseUrl,
  });
  const releaseId = `demo-${request.campaignId}-${request.area}-${Date.now()}`;
  const snapshotId = `pre-${releaseId}`;
  await dest.writeRelease(releaseId, files);
  await dest.validateRelease(releaseId, files);
  await dest.captureCurrent(snapshotId);
  await dest.switchCurrent(releaseId, snapshotId, files);

  const record: AcceptedCandidateDemonstrationPublicationRecord = {
    id: publicationRecordId(request.tenantSlug, request.campaignId, request.asset, request.area),
    kind: DEMONSTRATION_PUBLISH_KIND,
    status: DEMONSTRATION_PUBLISH_STATUS,
    clinicalApproval: false,
    campaignApproval: false,
    publication: true,
    indexingSubmitted: false,
    searchConsoleSubmitted: false,
    indexingRegistrySubmitted: false,
    sitemapUploaded: false,
    tenantSlug: request.tenantSlug,
    campaignId: request.campaignId,
    asset: request.asset,
    area: request.area,
    candidateVersion: resolved.candidateVersion,
    candidateHtmlSha256: resolved.htmlSha256,
    candidateCopySha256: resolved.copySha256,
    publishedUrl: resolved.publishedUrl,
    destinationBaseUrl: resolved.destinationBaseUrl,
    releaseId,
    publishedAt: new Date().toISOString(),
    robots: "noindex, nofollow",
    jsonLd: false,
    pages: [resolved.publishedUrl.replace(resolved.destinationBaseUrl, "") || `/${resolved.relativeHtmlPath.replace(/index\.html$/, "")}`],
  };
  writePublicationRecord(record);
  return successFromRecord(record, false);
}
