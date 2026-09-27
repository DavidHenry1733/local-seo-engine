/**
 * NT-E2E-14 — Commercial Indexing Review dashboard (wraps existing indexing engine).
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import {
  finishWorkflowExecution,
  getLastRecordedWorkflowStage,
  recordWorkflowTransition,
  startWorkflowExecution,
} from "./masterAdminWorkflowHistoryService.ts";
import { readLatestCommercialQualityApproval } from "./masterAdminCommercialQualityReviewService.ts";
import { resolveCampaignPublishingContentApproval } from "./masterAdminCampaignPublishingApprovalResolver.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { submitCanonicalCampaignSearch } from "./canonicalCampaignSearchResultsService.ts";
import {
  buildPublishedReleaseVerification,
  resolvePublishReviewProgressJob,
  readLatestCommercialPublishSnapshot,
} from "./masterAdminCommercialPublishReviewService.ts";
import { readManagedPublishingProfile } from "./masterAdminManagedPublishingService.ts";
import {
  buildPharmacySearchConsoleListMetrics,
} from "./pharmacySearchConsoleDashboardService.ts";
import {
  readPharmacyIndexingSummary,
  readPharmacyRegistry,
  registerPharmacyPages,
  submitReadyPharmacyPages,
  refreshPharmacyIndexingStatus,
  type PharmacyIndexingSummary,
} from "./pharmacyIndexingBridgeService.ts";
import { getPharmacyLivePublishStatus } from "./pharmacyLivePublishService.ts";
import { listMasterAdminJobs } from "./masterAdminJobService.ts";

export interface CommercialIndexingHistoryEntry {
  timestamp: string;
  label: string;
  detail: string;
}

export interface CommercialIndexingApprovalSnapshot {
  version: 1;
  slug: string;
  requestedAt: string;
  requestedBy: string;
  pagesSubmitted: number;
  summary: PharmacyIndexingSummary;
}

export interface CommercialIndexingReviewDashboard {
  version: 1;
  slug: string;
  published: boolean;
  canRequestIndexing: boolean;
  indexingRequested: boolean;
  publicationVerified: boolean;
  contentApproved: boolean;
  searchConsoleConnected: boolean;
  summary: PharmacyIndexingSummary | null;
  pagesSubmitted: number;
  pagesIndexed: number;
  pagesPending: number;
  pagesExcluded: number;
  pagesReady: number;
  coverageLabel: string;
  sitemapUrl: string;
  robotsLabel: string;
  searchConsoleStatus: string;
  expectedUrls: string[];
  history: CommercialIndexingHistoryEntry[];
  narrative: string;
  nextStep: string;
  entryStateLabel: string;
  publicationStateLabel: string;
  publicationVerification: "PASS" | "FAIL" | "UNKNOWN";
  approvalStateLabel: string;
  approvalMode: string;
  inventoryStateLabel: string;
  indexingSubmissionLabel: string;
  campaignId: string | null;
  serviceId: string;
  currentRelease: string | null;
}

const APPROVAL_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-indexing-review");

function approvalPath(slug: string): string {
  return path.join(APPROVAL_DIR, slug, "latest.json");
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

export function readLatestCommercialIndexingApproval(slug: string): CommercialIndexingApprovalSnapshot | null {
  const file = approvalPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as CommercialIndexingApprovalSnapshot;
  } catch {
    return null;
  }
}

function robotsLabel(slug: string): string {
  const robots = path.join(WORKSPACE_ROOT, "output/pharmacy-publish", slug, "robots.txt");
  if (!fs.existsSync(robots)) return "Not available until publish completes";
  try {
    const txt = fs.readFileSync(robots, "utf8");
    if (/sitemap:/i.test(txt)) return "Published robots.txt includes sitemap reference";
    return "Published robots.txt present";
  } catch {
    return "Not available";
  }
}

function parseCampaignIdFromManifestRevision(revision: string | null | undefined): string | null {
  const m = String(revision || "").match(/^campaign-approved-content:([^:]+):([^:]+):/);
  return m?.[1] || null;
}

function parseServiceIdFromManifestRevision(revision: string | null | undefined): string | null {
  const m = String(revision || "").match(/^campaign-approved-content:([^:]+):([^:]+):/);
  return m?.[2] || null;
}

/**
 * Resolve campaign/service identity for the current published release lineage.
 * Prefer active selection, then publish snapshot, then FinalRenderManifest / registry.
 */
function resolveIndexingCampaignIdentity(slug: string): {
  serviceId: string;
  campaignId: string | null;
} {
  const selection = readActiveServiceCampaignSelection(slug);
  const snapshot = readLatestCommercialPublishSnapshot(slug) as {
    serviceId?: string;
    contentManifestRevision?: string;
    currentRelease?: string;
    releaseId?: string;
  } | null;
  const managed = readManagedPublishingProfile(slug);
  const currentRelease =
    String(managed?.currentRelease || snapshot?.currentRelease || snapshot?.releaseId || "").trim() || null;

  let serviceId = String(selection?.serviceId || snapshot?.serviceId || "").trim();
  let campaignId =
    String(selection?.campaignId || "").trim() ||
    parseCampaignIdFromManifestRevision(snapshot?.contentManifestRevision) ||
    null;

  if (currentRelease && (!serviceId || !campaignId)) {
    const releaseDir =
      managed?.paths?.releaseDirectory || path.join("/var/www/pharmaconnect-sites", slug, "releases");
    const manifestFile = path.join(releaseDir, currentRelease, "FinalRenderManifest.json");
    if (fs.existsSync(manifestFile)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
          serviceId?: string;
          contentManifestRevision?: string;
        };
        if (!serviceId) {
          serviceId =
            String(manifest.serviceId || "").trim() ||
            parseServiceIdFromManifestRevision(manifest.contentManifestRevision) ||
            "";
        }
        if (!campaignId) {
          campaignId = parseCampaignIdFromManifestRevision(manifest.contentManifestRevision);
        }
      } catch {
        /* keep prior identity */
      }
    }
  }

  if (serviceId && !campaignId) {
    const registry = readPharmacyRegistry(slug);
    const fromRegistry = (registry?.pages || []).find(
      (p) => p.serviceId === serviceId && p.campaignId,
    );
    if (fromRegistry?.campaignId) campaignId = String(fromRegistry.campaignId);
  }

  return { serviceId, campaignId };
}

/**
 * Campaign-scoped Product Owner approval for indexing readiness.
 * Uses current campaign approvals when available; legacy Commercial Quality only
 * as fallback for legacy campaigns that lack campaign-scoped evidence.
 * Campaign-scoped mode never falls through to legacy when campaign identity exists.
 */
export function resolveIndexingContentApproval(slug: string): {
  approved: boolean;
  mode: "campaign-scoped-product-owner" | "legacy-commercial-quality" | "none";
  serviceId: string;
  campaignId: string | null;
  detail: string;
  servicePageApproved: boolean;
  localityApprovedCount: number;
  localityExpectedCount: number;
} {
  const { serviceId, campaignId } = resolveIndexingCampaignIdentity(slug);

  if (serviceId && campaignId) {
    const campaignApproval = resolveCampaignPublishingContentApproval(slug, {
      campaignId,
      serviceId,
    });
    return {
      approved: campaignApproval.approved,
      mode: "campaign-scoped-product-owner",
      serviceId,
      campaignId: campaignApproval.campaignId || campaignId,
      detail: campaignApproval.detail,
      servicePageApproved: campaignApproval.servicePageApproved,
      localityApprovedCount: campaignApproval.localityApprovedCount,
      localityExpectedCount: campaignApproval.localityExpectedCount,
    };
  }

  // Legacy only when no campaign-scoped identity exists for the current release.
  const legacy = readLatestCommercialQualityApproval(slug);
  if (legacy?.approvedAt) {
    return {
      approved: true,
      mode: "legacy-commercial-quality",
      serviceId: serviceId || String(legacy.serviceId || ""),
      campaignId,
      detail: `Legacy Commercial Quality approval ${legacy.approvedAt}`,
      servicePageApproved: true,
      localityApprovedCount: 0,
      localityExpectedCount: 0,
    };
  }

  return {
    approved: false,
    mode: "none",
    serviceId,
    campaignId,
    detail: "No campaign-scoped or legacy content approval found",
    servicePageApproved: false,
    localityApprovedCount: 0,
    localityExpectedCount: 0,
  };
}

export function buildCommercialIndexingReviewDashboard(slug: string): CommercialIndexingReviewDashboard {
  const ctx = loadMasterAdminCustomerContext(slug);
  const live = getPharmacyLivePublishStatus(slug);
  const published = Boolean(ctx?.live.lastPublishedAt || live.lastPublishedAt);
  const summary = readPharmacyIndexingSummary(slug);
  const registry = readPharmacyRegistry(slug);
  const approval = readLatestCommercialIndexingApproval(slug);
  const activeJob = listMasterAdminJobs({ slug, limit: 3 }).find(
    (j) => (j.status === "queued" || j.status === "running") && j.action === "request_indexing",
  );

  const contentApproval = resolveIndexingContentApproval(slug);
  const managed = readManagedPublishingProfile(slug);
  const currentRelease = managed?.currentRelease || null;
  const progressJob = resolvePublishReviewProgressJob(slug, currentRelease);
  const completedPublishJobId = progressJob?.status === "completed" ? progressJob.id : null;
  const publicationVerification = buildPublishedReleaseVerification({
    slug,
    serviceId: contentApproval.serviceId || String(ctx?.serviceId || ""),
    campaignId: contentApproval.campaignId,
    currentRelease,
    completedPublishJobId,
  });
  const publicationVerified = publicationVerification.status === "PASS";
  const contentApproved = contentApproval.approved;

  const gscMetrics = buildPharmacySearchConsoleListMetrics(slug);
  const searchConsoleConnected = Boolean(gscMetrics.searchConsoleConnected);
  const searchConsoleStatus = searchConsoleConnected
    ? gscMetrics.connectionStatus || "Connected"
    : "Not connected";

  const scopedPages = (registry?.pages || []).filter((page) => {
    if (contentApproval.serviceId && page.serviceId !== contentApproval.serviceId) return false;
    if (
      contentApproval.campaignId &&
      page.campaignId &&
      page.campaignId !== contentApproval.campaignId
    ) {
      return false;
    }
    return true;
  });

  const pagesSubmitted =
    summary?.submitted ??
    approval?.pagesSubmitted ??
    scopedPages.filter((p) => p.indexingStatus === "submitted").length;
  const pagesIndexed =
    summary?.indexed ?? scopedPages.filter((p) => p.indexingStatus === "indexed").length;
  const pagesPending = scopedPages.filter((p) => p.indexingStatus === "ready_to_submit").length;
  const pagesExcluded =
    summary?.notIndexed ?? scopedPages.filter((p) => p.indexingStatus === "not_indexed").length;
  const indexingRequested = pagesSubmitted > 0 || Boolean(approval?.requestedAt);

  const canRequestIndexing =
    published && contentApproved && publicationVerified && !activeJob && !indexingRequested;

  const expectedUrls = scopedPages
    .map((p) => p.url || p.canonicalUrl)
    .filter(Boolean);

  const history: CommercialIndexingHistoryEntry[] = [];
  if (publicationVerified && publicationVerification.publishedAt) {
    history.push({
      timestamp: publicationVerification.publishedAt,
      label: "Publication verified",
      detail: `${publicationVerification.publishedRelease || currentRelease || "release"} published and verified (${expectedUrls.length} campaign URL(s))`,
    });
  } else if (ctx?.live.lastPublishedAt) {
    history.push({
      timestamp: ctx.live.lastPublishedAt,
      label: "Website published",
      detail: "Published pages are ready for indexing submission",
    });
  }
  if (contentApproved) {
    history.push({
      timestamp: new Date().toISOString(),
      label: "Content approval",
      detail: contentApproval.detail,
    });
  }
  if (approval?.requestedAt) {
    history.push({
      timestamp: approval.requestedAt,
      label: "Indexing requested",
      detail: `${approval.pagesSubmitted} page(s) submitted for indexing`,
    });
  }

  const pagesReady = expectedUrls.length;
  const inventoryReady = publicationVerified && pagesReady > 0;
  const publicationStateLabel = publicationVerified
    ? publicationVerification.label || "PUBLISHED & VERIFIED"
    : published
      ? "Published (verification incomplete)"
      : "Not published";
  const approvalStateLabel = contentApproved
    ? contentApproval.mode === "campaign-scoped-product-owner"
      ? `APPROVED (${contentApproval.localityApprovedCount}/${contentApproval.localityExpectedCount} localities)`
      : "APPROVED (legacy)"
    : "NOT APPROVED";
  const inventoryStateLabel = inventoryReady
    ? `READY (${pagesReady} URLs)`
    : pagesReady > 0
      ? "PENDING PUBLICATION VERIFICATION"
      : "NOT READY";
  const indexingSubmissionLabel = indexingRequested ? "REQUESTED" : "NOT STARTED";

  let entryStateLabel = "NOT READY";
  let narrative = "After publishing, submit your pages for search indexing and monitor coverage.";
  let nextStep = "Complete Publish first";

  if (!published || !publicationVerified) {
    entryStateLabel = "PUBLICATION REQUIRED";
    narrative = "Publish and verify the current campaign release before indexing.";
    nextStep = "Complete Publish Review";
  } else if (!contentApproved) {
    entryStateLabel = "APPROVAL REQUIRED";
    narrative = "Campaign content must be approved before indexing can be requested.";
    nextStep = "Complete Product Owner content approval";
  } else if (indexingRequested) {
    entryStateLabel = "INDEXING REQUESTED";
    narrative = "Indexing has been requested. Monitor submitted and indexed pages below.";
    nextStep = "Open Performance Dashboard when ready";
  } else {
    entryStateLabel = "READY FOR INDEXING";
    narrative = searchConsoleConnected
      ? "Published & Verified inventory is ready. Confirm and request indexing."
      : "Published & Verified · Approved · Inventory ready · Search Console not connected · Indexing not started.";
    nextStep = searchConsoleConnected
      ? "Confirm and request indexing"
      : "Connect Search Console, then request indexing";
  }

  return {
    version: 1,
    slug,
    published,
    canRequestIndexing,
    indexingRequested,
    publicationVerified,
    contentApproved,
    searchConsoleConnected,
    summary,
    pagesSubmitted,
    pagesIndexed,
    pagesPending,
    pagesExcluded,
    pagesReady,
    coverageLabel: `${pagesIndexed} indexed · ${pagesSubmitted} submitted · ${pagesPending} ready · ${pagesExcluded} excluded`,
    sitemapUrl:
      summary?.sitemapUrl ||
      `${(live.publishDomain || "").replace(/\/+$/, "")}/sitemap.xml`,
    robotsLabel: robotsLabel(slug),
    searchConsoleStatus,
    expectedUrls,
    history,
    narrative,
    nextStep,
    entryStateLabel,
    publicationStateLabel,
    publicationVerification: publicationVerified ? "PASS" : published ? "FAIL" : "UNKNOWN",
    approvalStateLabel,
    approvalMode: contentApproval.mode,
    inventoryStateLabel,
    indexingSubmissionLabel,
    campaignId: contentApproval.campaignId,
    serviceId: contentApproval.serviceId,
    currentRelease: currentRelease || publicationVerification.publishedRelease || null,
  };
}

export async function requestCommercialIndexing(
  slug: string,
  operator: string,
  input: { operatorConfirmed?: boolean; campaignId?: string },
): {
  ok: boolean;
  errors: string[];
  dashboard: CommercialIndexingReviewDashboard;
  snapshot: CommercialIndexingApprovalSnapshot | null;
} {
  const dashboard = buildCommercialIndexingReviewDashboard(slug);
  if (!input.operatorConfirmed) {
    return { ok: false, errors: ["Confirm indexing submission before continuing."], dashboard, snapshot: null };
  }
  const campaignId = String(input.campaignId || readActiveServiceCampaignSelection(slug)?.campaignId || "").trim();
  if (campaignId) {
    const canonical = await submitCanonicalCampaignSearch({ tenantSlug: slug, campaignId });
    if (canonical.handled) {
      return {
        ok: canonical.ok,
        errors: canonical.blockers,
        dashboard: buildCommercialIndexingReviewDashboard(slug),
        snapshot: null,
      };
    }
  }
  if (!dashboard.published || !dashboard.publicationVerified) {
    return { ok: false, errors: ["Publish and verify the website before requesting indexing."], dashboard, snapshot: null };
  }
  if (!dashboard.contentApproved) {
    return { ok: false, errors: ["Campaign content approval is required before indexing."], dashboard, snapshot: null };
  }
  if (dashboard.indexingRequested && dashboard.pagesSubmitted > 0) {
    return {
      ok: true,
      errors: [],
      dashboard,
      snapshot: readLatestCommercialIndexingApproval(slug),
    };
  }

  try {
    await registerPharmacyPages(slug);
    const outcome = await submitReadyPharmacyPages(slug, { mode: "dry-run", confirmExternal: false });
    try {
      refreshPharmacyIndexingStatus(slug);
    } catch {
      /* optional refresh */
    }

    const snapshot: CommercialIndexingApprovalSnapshot = {
      version: 1,
      slug,
      requestedAt: new Date().toISOString(),
      requestedBy: operator,
      pagesSubmitted: outcome.submitted,
      summary: outcome.summary,
    };
    writeJsonAtomic(approvalPath(slug), snapshot);

    const recorded = getLastRecordedWorkflowStage(slug);
    if (recorded === "request_indexing") {
      startWorkflowExecution({ slug, stageId: "request_indexing", actionId: "request_indexing", operator });
      finishWorkflowExecution({
        slug,
        stageId: "request_indexing",
        actionId: "request_indexing",
        operator,
        evidence: `Indexing requested for ${outcome.submitted} page(s)`,
        status: "completed",
      });
      recordWorkflowTransition({
        slug,
        fromStage: "request_indexing",
        toStage: "initialise_rank_tracking",
        operator,
        reason: "Commercial indexing requested",
        evidence: `${outcome.submitted} pages submitted`,
      });
    }

    recordMasterAdminAudit({
      slug,
      action: "request_indexing",
      status: "success",
      user: operator,
      evidence: `Indexing requested for ${outcome.submitted} page(s)`,
    });

    return {
      ok: true,
      errors: [],
      dashboard: buildCommercialIndexingReviewDashboard(slug),
      snapshot,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordMasterAdminAudit({
      slug,
      action: "request_indexing",
      status: "error",
      user: operator,
      evidence: message,
    });
    return {
      ok: false,
      errors: [message],
      dashboard: buildCommercialIndexingReviewDashboard(slug),
      snapshot: null,
    };
  }
}
