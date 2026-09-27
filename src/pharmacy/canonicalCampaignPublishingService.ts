/**
 * CP04 canonical campaign publication.
 * Publishes the exact CP03-approved HTML bytes. It does not regenerate pages
 * and does not run the live uploader, because that uploader rewrites HTML.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { resolveCanonicalCampaignMembership } from "./canonicalCampaignLifecycleResolver.ts";
import {
  resolveCanonicalCampaignApproval,
  type CanonicalPageApproval,
} from "./canonicalCampaignApprovalService.ts";
import {
  hashPublishablePageBytes,
  resolveCanonicalPageContentRevision,
} from "./canonicalCampaignContentRevision.ts";
import { readManagedPublishingProfile } from "./masterAdminManagedPublishingService.ts";
import { resolveActivePublishBaseUrl } from "./customerEcosystemUrlService.ts";

export type CanonicalPublicationUiState =
  | "READY_TO_PUBLISH"
  | "BLOCKED"
  | "PUBLISHED"
  | "NEW_REVISION_REQUIRES_APPROVAL";

export interface CanonicalPublishedPage {
  tenantSlug: string;
  campaignId: string;
  serviceId: string;
  pageType: "service" | "locality";
  areaSlug: string | null;
  /** SHA-256 of the approved source HTML. */
  contentRevision: string;
  /** SHA-256 of the bytes written into the publish package. Equal to contentRevision when bytes are copied unchanged. */
  deployedArtifactHash: string;
  transformationApplied: false;
  canonicalUrl: string;
  publishedAt: string;
  outputPath: string;
}

export interface CanonicalPublishIndex {
  version: 2;
  tenantSlug: string;
  campaignId: string;
  serviceId: string;
  generatedAt: string;
  pageCount: number;
  pages: CanonicalPublishedPage[];
}

export interface CanonicalPublicationRecord {
  version: 1;
  tenantSlug: string;
  campaignId: string;
  serviceId: string;
  current: { publishedAt: string; pages: CanonicalPublishedPage[] } | null;
  history: Array<{ publishedAt: string; supersededAt: string; pages: CanonicalPublishedPage[] }>;
}

export interface CanonicalPublishResult {
  ok: boolean;
  idempotent: boolean;
  blockers: string[];
  publication: CanonicalPublicationRecord | null;
  uiState: CanonicalPublicationUiState;
}

export function publishIndexPath(tenantSlug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", tenantSlug, "_publish-index.json");
}

export function sitemapPath(tenantSlug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", tenantSlug, "sitemap.xml");
}

export function publicationRecordPath(tenantSlug: string, campaignId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/canonical-campaign-publication",
    tenantSlug,
    `${campaignId}.json`,
  );
}

export function classifyExistingPublishIndex(tenantSlug: string): {
  present: boolean;
  classification: "CANONICAL" | "HISTORICAL_UNSCOPED" | "ABSENT";
  campaignId: string | null;
} {
  const file = publishIndexPath(tenantSlug);
  if (!fs.existsSync(file)) return { present: false, classification: "ABSENT", campaignId: null };
  const doc = readJson(file);
  const pages = Array.isArray(doc?.pages) ? doc.pages as Array<Record<string, unknown>> : [];
  const canonical = doc?.version === 2 && pages.length > 0 && pages.every((page) =>
    typeof page.campaignId === "string" &&
    typeof page.contentRevision === "string" &&
    typeof page.canonicalUrl === "string" &&
    typeof page.tenantSlug === "string",
  );
  if (!canonical) return { present: true, classification: "HISTORICAL_UNSCOPED", campaignId: null };
  return { present: true, classification: "CANONICAL", campaignId: String(doc?.campaignId || "") || null };
}

export function resolveCanonicalPublicationState(input: {
  tenantSlug: string;
  campaignId: string;
}): { state: CanonicalPublicationUiState; blockers: string[]; ready: boolean } {
  const preflight = preflightCanonicalPublication(input);
  const current = readPublication(input.tenantSlug, input.campaignId)?.current || null;
  if (preflight.ok && current && samePublication(current.pages, preflight.pages)) {
    return { state: "PUBLISHED", blockers: [], ready: false };
  }
  if (preflight.ok) return { state: "READY_TO_PUBLISH", blockers: [], ready: true };
  if (current) return { state: "NEW_REVISION_REQUIRES_APPROVAL", blockers: preflight.blockers, ready: false };
  return { state: "BLOCKED", blockers: preflight.blockers, ready: false };
}

export function publishCanonicalCampaign(input: {
  tenantSlug: string;
  campaignId: string;
  publishedAt?: string;
  failBeforeCommit?: boolean;
}): CanonicalPublishResult {
  const preflight = preflightCanonicalPublication(input);
  const uiState = resolveCanonicalPublicationState(input).state;
  if (!preflight.ok || !preflight.membership) {
    return { ok: false, idempotent: false, blockers: preflight.blockers, publication: readPublication(input.tenantSlug, input.campaignId), uiState };
  }
  const existing = readPublication(preflight.membership.tenantSlug, preflight.membership.campaignId);
  if (existing?.current && samePublication(existing.current.pages, preflight.pages)) {
    return {
      ok: true,
      idempotent: true,
      blockers: [],
      publication: existing,
      uiState: "PUBLISHED",
    };
  }

  const publishedAt = input.publishedAt || new Date().toISOString();
  const pages = preflight.pages.map((page) => ({ ...page, publishedAt }));
  const record = nextRecord(existing, preflight.membership, pages, publishedAt);
  const index: CanonicalPublishIndex = {
    version: 2,
    tenantSlug: preflight.membership.tenantSlug,
    campaignId: preflight.membership.campaignId,
    serviceId: preflight.membership.serviceId,
    generatedAt: publishedAt,
    pageCount: pages.length,
    pages,
  };
  const root = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", preflight.membership.tenantSlug);
  const staging = `${root}.cp04-staging-${process.pid}`;
  fs.mkdirSync(staging, { recursive: true });
  try {
    for (const page of pages) {
      const source = resolveCanonicalPageContentRevision({
        tenantSlug: page.tenantSlug,
        serviceId: page.serviceId,
        pageType: page.pageType,
        areaSlug: page.areaSlug,
      }).sourcePath;
      if (!source || hashPublishablePageBytes(fs.readFileSync(source)) !== page.contentRevision) {
        throw new Error("Approved source bytes changed during publication preflight");
      }
      const target = path.join(staging, path.relative(root, page.outputPath));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
      const deployed = hashPublishablePageBytes(fs.readFileSync(target));
      if (deployed !== page.contentRevision) throw new Error("Published bytes do not match the approved revision");
    }
    fs.writeFileSync(path.join(staging, "_publish-index.json"), JSON.stringify(index, null, 2));
    fs.writeFileSync(path.join(staging, "sitemap.xml"), sitemapXml(pages));
    if (input.failBeforeCommit) {
      throw new Error("Canonical publication failed before commit");
    }
    commitTree(staging, root);
    writeJsonAtomic(publicationRecordPath(preflight.membership.tenantSlug, preflight.membership.campaignId), record);
    updateCampaignPublicationState(preflight.membership.tenantSlug, preflight.membership.campaignId, pages.length);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    if (input.failBeforeCommit) {
      return {
        ok: false,
        idempotent: false,
        blockers: [error instanceof Error ? error.message : String(error)],
        publication: readPublication(preflight.membership.tenantSlug, preflight.membership.campaignId),
        uiState,
      };
    }
    throw error;
  }
  return {
    ok: true,
    idempotent: false,
    blockers: [],
    publication: record,
    uiState: "PUBLISHED",
  };
}

function preflightCanonicalPublication(input: { tenantSlug: string; campaignId: string }): {
  ok: boolean;
  blockers: string[];
  membership: { tenantSlug: string; campaignId: string; serviceId: string } | null;
  pages: CanonicalPublishedPage[];
} {
  const membership = resolveCanonicalCampaignMembership(input);
  if (!membership.resolved || !membership.tenantSlug || !membership.campaignId || !membership.serviceId) {
    return { ok: false, blockers: ["Campaign membership is unresolved"], membership: null, pages: [] };
  }
  const approval = resolveCanonicalCampaignApproval({
    tenantSlug: membership.tenantSlug,
    campaignId: membership.campaignId,
  });
  const blockers: string[] = [];
  if (!approval.service || approval.service.contentRevision === null || membership.servicePageState === "MISSING") {
    blockers.push("Service page is not generated");
  } else if (approval.service.decision === "STALE") {
    blockers.push("Service page approval is stale for the current revision");
  } else if (approval.service.decision === "REJECTED") {
    blockers.push("Service page current revision is rejected");
  } else if (approval.service.decision !== "APPROVED") {
    blockers.push("Service page is not approved for the current revision");
  }
  const missing = membership.localityStates.filter((area) => area.contentState !== "PRESENT").map((area) => area.areaSlug);
  if (missing.length) blockers.push(`Missing canonical locality pages: ${missing.join(", ")}`);
  const stale = approval.localities.filter((page) => page.decision === "STALE").map((page) => page.areaSlug);
  if (stale.length) blockers.push(`Stale locality approval is not approval of the current revision: ${stale.join(", ")}`);
  const rejected = approval.localities.filter((page) => page.decision === "REJECTED").map((page) => page.areaSlug);
  if (rejected.length) blockers.push(`Rejected current revision: ${rejected.join(", ")}`);
  const notApproved = approval.localities.filter((page) => page.decision !== "APPROVED");
  if (membership.areaSlugs.length === 0) blockers.push("No locality pages are selected for this campaign");
  else if (notApproved.length) blockers.push(`Selected locality pages not approved: ${notApproved.length} remaining`);
  const origin = publicationOrigin(membership.tenantSlug);
  const pages = blockers.length ? [] : buildPages(membership.tenantSlug, membership.campaignId, membership.serviceId, origin, approval.service, approval.localities);
  return {
    ok: blockers.length === 0 && pages.length === 1 + membership.areaSlugs.length,
    blockers,
    membership: { tenantSlug: membership.tenantSlug, campaignId: membership.campaignId, serviceId: membership.serviceId },
    pages,
  };
}

function buildPages(
  tenantSlug: string,
  campaignId: string,
  serviceId: string,
  origin: string,
  service: CanonicalPageApproval | null,
  localities: CanonicalPageApproval[],
): CanonicalPublishedPage[] {
  const pages: CanonicalPublishedPage[] = [];
  if (service?.contentRevision) {
    pages.push(pageRecord({
      tenantSlug,
      campaignId,
      serviceId,
      pageType: "service",
      areaSlug: null,
      contentRevision: service.contentRevision,
      canonicalUrl: `${origin}/${encodeURIComponent(serviceId)}/`,
      outputPath: path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", tenantSlug, serviceId, "index.html"),
    }));
  }
  for (const locality of localities) {
    if (!locality.areaSlug || !locality.contentRevision) continue;
    pages.push(pageRecord({
      tenantSlug,
      campaignId,
      serviceId,
      pageType: "locality",
      areaSlug: locality.areaSlug,
      contentRevision: locality.contentRevision,
      canonicalUrl: `${origin}/${encodeURIComponent(serviceId)}/${encodeURIComponent(locality.areaSlug)}/`,
      outputPath: path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", tenantSlug, serviceId, locality.areaSlug, "index.html"),
    }));
  }
  return pages;
}

function pageRecord(input: Omit<CanonicalPublishedPage, "deployedArtifactHash" | "transformationApplied" | "publishedAt">): CanonicalPublishedPage {
  return {
    ...input,
    deployedArtifactHash: input.contentRevision,
    transformationApplied: false,
    publishedAt: "",
  };
}

function publicationOrigin(tenantSlug: string): string {
  const profile = readManagedPublishingProfile(tenantSlug);
  return resolveActivePublishBaseUrl(profile, tenantSlug).baseUrl.replace(/\/$/, "");
}

function nextRecord(
  existing: CanonicalPublicationRecord | null,
  membership: { tenantSlug: string; campaignId: string; serviceId: string },
  pages: CanonicalPublishedPage[],
  publishedAt: string,
): CanonicalPublicationRecord {
  const history = [...(existing?.history || [])];
  if (existing?.current) {
    history.push({
      publishedAt: existing.current.publishedAt,
      supersededAt: publishedAt,
      pages: existing.current.pages,
    });
  }
  return {
    version: 1,
    tenantSlug: membership.tenantSlug,
    campaignId: membership.campaignId,
    serviceId: membership.serviceId,
    current: { publishedAt, pages },
    history,
  };
}

function samePublication(current: CanonicalPublishedPage[], next: CanonicalPublishedPage[]): boolean {
  const key = (page: CanonicalPublishedPage) =>
    `${page.pageType}:${page.areaSlug || ""}:${page.contentRevision}:${page.canonicalUrl}`;
  const left = current.map(key).sort();
  const right = next.map(key).sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function commitTree(staging: string, root: string): void {
  const backup = `${root}.cp04-backup-${process.pid}`;
  fs.rmSync(backup, { recursive: true, force: true });
  if (fs.existsSync(root)) fs.renameSync(root, backup);
  try {
    fs.renameSync(staging, root);
  } catch (error) {
    if (fs.existsSync(backup)) fs.renameSync(backup, root);
    throw error;
  }
  fs.rmSync(backup, { recursive: true, force: true });
}

function updateCampaignPublicationState(tenantSlug: string, campaignId: string, publishedPages: number): void {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${tenantSlug}.json`);
  const doc = readJson(file);
  const campaigns = Array.isArray(doc?.campaigns) ? doc.campaigns as Array<Record<string, unknown>> : null;
  if (!doc || !campaigns) throw new Error("Campaign store is missing");
  const campaign = campaigns.find((item) => String(item.id || "") === campaignId);
  if (!campaign) throw new Error("Campaign store does not contain the published campaign");
  campaign.publishingStatus = "published";
  campaign.publishedPages = publishedPages;
  writeJsonAtomic(file, doc);
}

function sitemapXml(pages: CanonicalPublishedPage[]): string {
  const urls = [...new Set(pages.map((page) => page.canonicalUrl))].sort();
  const body = urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function readPublication(tenantSlug: string, campaignId: string): CanonicalPublicationRecord | null {
  const doc = readJson(publicationRecordPath(tenantSlug, campaignId));
  if (!doc || !Array.isArray(doc.history)) return null;
  return doc as unknown as CanonicalPublicationRecord;
}

function writeJsonAtomic(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function readJson(file: string): Record<string, unknown> | null {
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
