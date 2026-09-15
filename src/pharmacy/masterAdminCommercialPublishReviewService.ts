/**
 * Sprint 8C — Commercial Publish Review (read-only validation + job queue).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { readLatestCommercialQualityApproval } from "./masterAdminCommercialQualityReviewService.ts";
import { resolveCampaignPublishingContentApproval } from "./masterAdminCampaignPublishingApprovalResolver.ts";
import { resolveCampaignReleasePackagePlan } from "./masterAdminCampaignReleasePackageComposer.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { resolvePublishWebsiteBase } from "./pharmacyPublishPackageAssembler.ts";
import {
  resolveApprovedCurrentRunCandidatePublishReadiness,
  resolveCurrentRunCandidateServiceId,
} from "./pharmacyCurrentRunApprovedCandidatePublishAdapter.ts";
import { isCommercialDeploymentApproved, readCommercialDeploymentProfile } from "./masterAdminCommercialDeploymentService.ts";
import {
  buildManagedPublishingReview,
  ensureManagedPublishingTenant,
  isTenantAllocationComplete,
  readManagedPublishingProfile,
  usesManagedPublishing,
} from "./masterAdminManagedPublishingService.ts";
import {
  buildPlatformInfrastructureReview,
  isPlatformInfrastructureReady,
} from "./masterAdminPlatformPublishingInfrastructureService.ts";
import { buildMasterAdminCustomerIssueSummary, listMasterAdminIssueSummaries } from "./masterAdminIssueService.ts";
import {
  createMasterAdminJob,
  getMasterAdminJob,
  listMasterAdminJobs,
  runMasterAdminJobAsync,
  type MasterAdminJob,
} from "./masterAdminJobService.ts";
import { loadContentPackage } from "./pharmacyContentPackageService.ts";
import { loadPharmacyDeployConfig, resolvePharmacyWebsiteBase } from "./pharmacyDeployConfig.ts";
import { getPharmacyLivePublishStatus } from "./pharmacyLivePublishService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { readPharmacyRegistry } from "./pharmacyIndexingBridgeService.ts";
import { PUBLISH_ROOT } from "./pharmacyPublishOutputService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import type {
  CommercialPublishChangeSummary,
  CommercialPublishCheck,
  CommercialPublishCheckStatus,
  CommercialPublishDestination,
  CommercialPublishPublicationVerification,
  CommercialPublishPublishedAsset,
  CommercialPublishReleaseManagement,
  CommercialPublishReviewPayload,
  CommercialPublishReviewSummary,
  CommercialPublishStageSummary,
  PublishedAssetEvidenceStatus,
} from "./masterAdminCommercialPublishReviewModel.ts";

type PublishedPageListItem = CommercialPublishReviewPayload["publishedPageList"][number];

function emptyPublicationVerification(): CommercialPublishPublicationVerification {
  return {
    status: "NOT_PUBLISHED",
    label: "NOT PUBLISHED",
    publishedRelease: null,
    publishedAt: null,
    publishedBy: null,
    previousRelease: null,
    rollbackTarget: null,
    campaignPages: { ready: 0, total: 0 },
    servicePages: { ready: 0, total: 0 },
    localityPages: { ready: 0, total: 0 },
    deployed: { ready: 0, total: 0 },
    liveUrls: { ready: 0, total: 0 },
    registry: { ready: 0, total: 0 },
    sitemap: { ready: 0, total: 0 },
    completedPublishJobId: null,
    assets: [],
  };
}

function evidenceStatus(ok: boolean): PublishedAssetEvidenceStatus {
  return ok ? "PASS" : "FAIL";
}

function normalizeSitemapUrl(url: string): string {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();
}

function readCurrentSitemapUrlSet(slug: string): Set<string> {
  const managed = readManagedPublishingProfile(slug);
  const candidates = [
    managed?.paths?.sitemapPath,
    path.join("/var/www/pharmaconnect-sites", slug, "current", "sitemap.xml"),
    path.join(PUBLISH_ROOT, slug, "sitemap.xml"),
  ].filter(Boolean) as string[];
  const urls = new Set<string>();
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const xml = fs.readFileSync(file, "utf8");
      for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
        urls.add(normalizeSitemapUrl(match[1] || ""));
      }
      if (urls.size) return urls;
    } catch {
      /* try next */
    }
  }
  return urls;
}

function releaseRegistryCoversPage(
  releaseRegistryPath: string,
  serviceId: string,
  pageSlug: string,
  pageType: "Service Page" | "Locality Page",
  locality: string | null,
): boolean {
  if (!fs.existsSync(releaseRegistryPath)) return false;
  try {
    const registry = JSON.parse(fs.readFileSync(releaseRegistryPath, "utf8")) as {
      serviceId?: string;
      selectedAreas?: string[];
      pages?: Array<{ slug?: string; pageSlug?: string; serviceId?: string }>;
    };
    if (Array.isArray(registry.pages) && registry.pages.length) {
      return registry.pages.some(
        (p) =>
          (p.slug === pageSlug || p.pageSlug === pageSlug) &&
          (!p.serviceId || p.serviceId === serviceId),
      );
    }
    if (String(registry.serviceId || "") !== serviceId) return false;
    if (pageType === "Service Page") return true;
    const areas = (registry.selectedAreas || []).map((a) =>
      String(a || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    );
    const localityKey = String(locality || pageSlug.replace(/^local-/, ""))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return areas.includes(localityKey);
  } catch {
    return false;
  }
}

const PUBLISH_SNAPSHOT_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-publish");

export const COMMERCIAL_PUBLISH_JOB_TYPE = "commercial-publish-v1";

function hashFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").slice(0, 16);
}

function manifestPath(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${serviceId}.json`);
}

function registryPath(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId, "_ecosystem-index.json");
}

function publishIndexPath(slug: string): string {
  return path.join(PUBLISH_ROOT, slug, "_publish-index.json");
}

function publishSitemapPath(slug: string): string {
  return path.join(PUBLISH_ROOT, slug, "sitemap.xml");
}

function latestPublishSnapshotPath(slug: string): string {
  return path.join(PUBLISH_SNAPSHOT_DIR, slug, "latest.json");
}

export function readLatestCommercialPublishSnapshot(slug: string): Record<string, unknown> | null {
  const file = latestPublishSnapshotPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function check(id: string, label: string, status: CommercialPublishCheckStatus, detail: string): CommercialPublishCheck {
  return { id, label, status, detail };
}

/**
 * CPR-PUBLISH-UAT-04 — Publish Review package counts must come from the shared
 * campaign release composer (approved service + approved localities), not from a
 * stale `_publish-index.json` or ecosystem inventory alone.
 * Counts here are campaign HTML pages (homepage redirect excluded).
 */
function countPreparedReleaseFiles(slug: string, serviceId: string): {
  files: number;
  pages: number;
  assets: number;
  pageList: Array<{ title: string; url: string; pageSlug: string }>;
  contentManifestRevision: string | null;
  campaignId: string | null;
  usesCampaignComposer: boolean;
} {
  const selection = readActiveServiceCampaignSelection(slug);
  const currentRunServiceId = resolveCurrentRunCandidateServiceId(slug, selection?.serviceId || serviceId);
  const plan = resolveCampaignReleasePackagePlan(slug, {
    campaignId: currentRunServiceId || selection?.campaignId,
    serviceId: currentRunServiceId || selection?.serviceId || serviceId,
  });

  if (plan.servicePage || plan.localityPages.length) {
    const baseUrl = resolvePublishWebsiteBase(slug);
    const pageList: Array<{ title: string; url: string; pageSlug: string }> = [];
    if (plan.servicePage) {
      pageList.push({
        title: `Service page — ${plan.serviceId}`,
        url: `${baseUrl}/${plan.servicePage.pageSlug}/`,
        pageSlug: plan.servicePage.pageSlug,
      });
    }
    for (const locality of plan.localityPages) {
      pageList.push({
        title: `Locality page — ${locality.areaSlug}`,
        url: `${baseUrl}/${locality.pageSlug}/`,
        pageSlug: locality.pageSlug,
      });
    }
    const pages = plan.totalCampaignPages;
    return {
      // Files Ready = campaign HTML pages in the next release package (not sitemap/metadata).
      files: pages,
      pages,
      assets: 0,
      pageList,
      contentManifestRevision: plan.contentManifestRevision,
      campaignId: plan.campaignId || null,
      usesCampaignComposer: true,
    };
  }

  return {
    files: 0,
    pages: 0,
    assets: 0,
    pageList: [],
    contentManifestRevision: plan.contentManifestRevision || null,
    campaignId: plan.campaignId || null,
    usesCampaignComposer: true,
  };
}

function buildDestination(slug: string): CommercialPublishDestination {
  if (usesManagedPublishing(slug)) {
    const managed = buildManagedPublishingReview(slug);
    const infra = buildPlatformInfrastructureReview();
    const profile = managed.profile;
    const proposedVersion = new Date().toISOString();
    const connectionStatus: CommercialPublishDestination["connectionStatus"] =
      infra.summary.platformStatus === "READY"
        ? "Healthy"
        : infra.summary.platformStatus === "CONNECTED"
          ? "Warning"
          : "Offline";
    const customerUrl = managed.summary.canonicalEcosystemUrl;
    return {
      publicWebsite: customerUrl || profile.managedUrl,
      customerEcosystemUrl: customerUrl,
      managedTargetUrl: profile.managedUrl,
      internalManagedUrl: profile.internalFallbackUrl || profile.managedUrl,
      dnsStatus: profile.dnsStatus.replace(/_/g, " "),
      sslStatus: profile.sslStatus.replace(/_/g, " "),
      publishMethod: "PharmaConnect Managed Infrastructure",
      protocol: "HTTPS",
      remotePath: profile.paths.currentReleasePointer,
      host: profile.managedHostname,
      lastConnectionTestAt: infra.profile.lastSuccessfulConnectionTestAt,
      lastConnectionTestOk: infra.profile.connectionStatus === "Healthy",
      connectionStatus,
      lastSuccessfulPublish: profile.publishedVersion > 0 ? `v${profile.publishedVersion}` : null,
      currentLiveVersion: profile.publishedVersion > 0 ? `v${profile.publishedVersion}` : null,
      proposedVersion,
      credentialsConfigured: infra.profile.credentialsConfigured,
      destinationConfigured: isTenantAllocationComplete(slug),
      targetWritable: infra.profile.writableStatus,
    };
  }

  const profile = readCommercialDeploymentProfile(slug);
  const deploy = loadPharmacyDeployConfig(slug);
  const live = getPharmacyLivePublishStatus(slug);
  const publicWebsite = profile.productionWebsite || resolvePharmacyWebsiteBase(slug);
  const proposedVersion = new Date().toISOString();

  let connectionStatus: CommercialPublishDestination["connectionStatus"] = "Offline";
  if (deploy.configured && deploy.credentialsPresent && live.lastFtpTestOk) connectionStatus = "Healthy";
  else if (deploy.configured && deploy.credentialsPresent) connectionStatus = "Warning";

  const publishMethod = profile.host ? methodLabelFromProfile(profile.deploymentMethod) : deploy.configured ? "Static HTML via FTPS" : "Not configured";

  return {
    publicWebsite,
    customerEcosystemUrl: null,
    managedTargetUrl: null,
    internalManagedUrl: null,
    dnsStatus: null,
    sslStatus: null,
    publishMethod,
    protocol: profile.host ? protocolFromProfile(profile.deploymentMethod) : deploy.configured ? "FTPS" : "—",
    remotePath: profile.resolvedDestinationPath || deploy.remoteRoot || "/",
    host: profile.host || deploy.host || null,
    lastConnectionTestAt: profile.lastConnectionTestAt || live.lastFtpTestAt,
    lastConnectionTestOk: profile.lastConnectionTestOk || live.lastFtpTestOk,
    connectionStatus: profile.lastConnectionTestAt ? profile.connectionStatus : connectionStatus,
    lastSuccessfulPublish: live.lastPublishedAt || profile.lastSuccessfulPublish,
    currentLiveVersion: live.lastPublishedAt || profile.lastSuccessfulPublish,
    proposedVersion,
    credentialsConfigured: profile.credentialsConfigured || deploy.credentialsPresent,
    destinationConfigured: Boolean(profile.host && profile.remoteFolder) || deploy.configured,
    targetWritable: profile.writableStatus ?? (live.lastFtpTestOk ? true : deploy.configured && deploy.credentialsPresent ? null : false),
  };
}

function methodLabelFromProfile(method: string): string {
  if (method === "static_html_sftp") return "Static HTML via SFTP";
  if (method === "cpanel") return "Static HTML via cPanel";
  return "Static HTML via FTP";
}

function protocolFromProfile(method: string): string {
  if (method === "static_html_sftp") return "SFTP";
  return "FTPS";
}

function buildChangeSummary(slug: string, serviceId: string, pageCount: number): CommercialPublishChangeSummary {
  const previous = readLatestCommercialPublishSnapshot(slug);
  const previousPages = Number(
    (previous?.fileTotals as { pages?: number } | undefined)?.pages ?? 0,
  );
  const hasPreviousRelease = Boolean(previous?.releaseId || previous?.currentRelease || previousPages > 0);

  if (!hasPreviousRelease) {
    return {
      mode: "initial_publish",
      // Change Summary totals are campaign HTML pages in the next release package.
      totalFiles: pageCount,
      newFiles: pageCount,
      changedFiles: 0,
      unchangedFiles: 0,
      deletedFiles: 0,
      pages: pageCount,
      images: 0,
      sitemap: fs.existsSync(publishSitemapPath(slug)),
      registry: fs.existsSync(registryPath(slug, serviceId)),
      manifest: Boolean(hashFile(manifestPath(slug, serviceId))),
      redirects: 0,
    };
  }

  const unchangedFiles = Math.min(previousPages, pageCount);
  const newFiles = Math.max(0, pageCount - previousPages);
  return {
    mode: "incremental_publish",
    totalFiles: pageCount,
    newFiles,
    changedFiles: 0,
    unchangedFiles,
    deletedFiles: Math.max(0, previousPages - pageCount),
    pages: pageCount,
    images: 0,
    sitemap: fs.existsSync(publishSitemapPath(slug)),
    registry: fs.existsSync(registryPath(slug, serviceId)),
    manifest: Boolean(hashFile(manifestPath(slug, serviceId))),
    redirects: 0,
  };
}

function buildPublishStageSummary(
  slug: string,
  serviceId: string,
  blockers: string[],
  managedHostname: string | null,
  managedUrl: string | null,
): CommercialPublishStageSummary {
  const managedReview = usesManagedPublishing(slug) ? buildManagedPublishingReview(slug) : null;
  const managed = managedReview?.profile || null;
  const snapshot = readLatestCommercialPublishSnapshot(slug) as { releaseId?: string; currentRelease?: string } | null;
  const publishingReadiness = blockers.length
    ? "BLOCKED"
    : managedReview?.summary.publishingReadiness || "READY TO PUBLISH";
  const currentRelease =
    managed?.currentRelease ||
    (snapshot?.currentRelease as string | undefined) ||
    (snapshot?.releaseId as string | undefined) ||
    (managed && managed.publishedVersion > 0 ? `v${managed.publishedVersion}` : "None");
  const previousRelease = managed?.previousRelease || (snapshot?.rollbackReference as string | undefined) || "None";
  const publishingStatus = managed?.publishStatus?.replace(/_/g, " ") || "not published";

  const customerUrl = managedReview?.summary.canonicalEcosystemUrl || null;
  return {
    stageLabel: "Publish",
    generatedPackage: serviceId || "—",
    currentRelease,
    managedHostname,
    managedUrl,
    publishingStatus,
    previousRelease,
    publishingReadiness,
    overallStatus: publishingReadiness,
    customerEcosystemUrl: customerUrl,
    dnsStatus: managed?.dnsStatus?.replace(/_/g, " ") || null,
    sslStatus: managed?.sslStatus?.replace(/_/g, " ") || null,
  };
}

function buildReleaseManagement(slug: string): CommercialPublishReleaseManagement {
  const managed = readManagedPublishingProfile(slug);
  const snapshot = readLatestCommercialPublishSnapshot(slug) as CommercialPublishReleaseManagement & {
    releaseId?: string;
    durationMs?: number;
    operator?: string;
    completedAt?: string;
  } | null;

  return {
    currentRelease: managed?.currentRelease || snapshot?.releaseId || null,
    previousRelease: managed?.previousRelease || snapshot?.rollbackReference || null,
    publishedVersion: managed?.publishedVersion || 0,
    publishedAt: snapshot?.completedAt || null,
    publishedBy: snapshot?.operator || null,
    publishDurationMs: snapshot?.durationMs || null,
    rollbackTarget: managed?.previousRelease || snapshot?.rollbackReference || null,
    rollbackAvailable: Boolean(managed?.previousRelease),
  };
}

function runPrePublishChecks(
  slug: string,
  serviceId: string,
  destination: CommercialPublishDestination,
): { checks: CommercialPublishCheck[]; warnings: string[]; blockers: string[] } {
  const checks: CommercialPublishCheck[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];

  const contentApproval = resolveCampaignPublishingContentApproval(slug, { serviceId });
  const currentRunServiceId = resolveCurrentRunCandidateServiceId(slug, serviceId);
  const candidates = currentRunServiceId
    ? resolveApprovedCurrentRunCandidatePublishReadiness(slug, currentRunServiceId)
    : resolveApprovedCurrentRunCandidatePublishReadiness(slug, serviceId);
  const qa =
    contentApproval.mode === "legacy-commercial-quality"
      ? readLatestCommercialQualityApproval(slug)
      : null;
  const manifest = loadContentPackage(slug, serviceId);
  const issues = buildMasterAdminCustomerIssueSummary(slug);

  if (usesManagedPublishing(slug)) {
    const infra = buildPlatformInfrastructureReview();
    if (isPlatformInfrastructureReady()) {
      checks.push(check("platform-infra", "Shared platform connection ready", "PASS", "Connection tested and publish root validated"));
    } else {
      const reason = infra.summary.lastFailureReason || infra.summary.connectionStatus;
      checks.push(check("platform-infra", "Shared platform connection ready", "FAIL", reason));
      blockers.push(`Shared platform connection not ready (${infra.summary.connectionStatus})`);
    }
    if (isTenantAllocationComplete(slug)) {
      const managed = ensureManagedPublishingTenant(slug);
      checks.push(check("tenant-allocation", "Tenant allocation complete", "PASS", managed.managedHostname));
    } else {
      checks.push(check("tenant-allocation", "Tenant allocation complete", "FAIL", "Tenant paths not allocated"));
      blockers.push("Tenant allocation incomplete");
    }
    if (infra.profile.writableStatus === true) {
      checks.push(check("tenant-writable", "Tenant directory writable", "PASS", "Global publish root verified"));
    } else if (infra.profile.writableStatus === false) {
      checks.push(check("tenant-writable", "Tenant directory writable", "FAIL", "Publish root not writable"));
      blockers.push("Tenant directory not writable");
    } else {
      checks.push(check("tenant-writable", "Tenant directory writable", "WARNING", "Will be verified during publish"));
      warnings.push("Tenant writability will be verified during publish");
    }
    if (infra.profile.publishRootStatus === "VALID") {
      checks.push(check("publish-root", "Publish root valid", "PASS", infra.profile.globalPublishRoot));
    } else {
      checks.push(
        check(
          "publish-root",
          "Publish root valid",
          "FAIL",
          infra.summary.lastFailureReason || "Publish root not validated",
        ),
      );
      blockers.push("Publish root not validated");
    }
  } else if (isCommercialDeploymentApproved(slug)) {
    checks.push(check("deployment-config", "Deployment configuration approved", "PASS", "Publishing destination configured and verified"));
  } else {
    checks.push(check("deployment-config", "Deployment configuration approved", "FAIL", "Complete Deployment Configuration before publishing"));
    blockers.push("Deployment configuration not approved");
  }

  if (contentApproval.approved) {
    checks.push(
      check(
        "quality-review",
        "Quality Review approved",
        "PASS",
        contentApproval.mode === "campaign-scoped-product-owner"
          ? contentApproval.detail
          : `Approved ${contentApproval.approvalReference}`,
      ),
    );
    checks.push(
      check(
        "qa-snapshot",
        "Approval snapshot exists",
        "PASS",
        contentApproval.mode === "campaign-scoped-product-owner"
          ? "Campaign-scoped Product Owner approval records on file (service-page-review + locality approvals)"
          : "QA approval snapshot on file",
      ),
    );
  } else {
    checks.push(
      check(
        "quality-review",
        "Quality Review approved",
        "FAIL",
        contentApproval.detail || "Content approval missing",
      ),
    );
    blockers.push(
      contentApproval.mode === "campaign-scoped-product-owner"
        ? contentApproval.blockers[0] || "Campaign-scoped Product Owner approvals incomplete"
        : "Quality Review not approved",
    );
    checks.push(
      check(
        "qa-snapshot",
        "Approval snapshot exists",
        "FAIL",
        contentApproval.mode === "campaign-scoped-product-owner"
          ? "Campaign-scoped Product Owner approval records incomplete"
          : "No QA approval snapshot",
      ),
    );
  }

  if (candidates?.ready) {
    checks.push(
      check(
        "generated-output",
        "Generated output exists",
        "PASS",
        `${candidates.approvedCount} approved ${candidates.candidateVersion || "current"} candidates ready to publish via Review Centre renderer`,
      ),
    );
    checks.push(
      check(
        "manifest",
        "Manifest exists",
        "PASS",
        "Current-run approved candidates are the publish authority",
      ),
    );
    checks.push(
      check(
        "registry",
        "Registry exists",
        "PASS",
        "Ecosystem registry is not required for current-run candidate publication",
      ),
    );
  } else {
    if (manifest?.generatedAt && manifest.status !== "error") {
      checks.push(check("generated-output", "Generated output exists", "PASS", `Generated ${manifest.generatedAt}`));
    } else {
      checks.push(check("generated-output", "Generated output exists", "FAIL", "Generated output missing"));
      blockers.push("Generated output missing");
    }

    const mPath = manifestPath(slug, serviceId);
    if (fs.existsSync(mPath)) checks.push(check("manifest", "Manifest exists", "PASS", "Content package manifest present"));
    else {
      checks.push(check("manifest", "Manifest exists", "FAIL", "Manifest missing"));
      blockers.push("Manifest missing");
    }

    const rPath = registryPath(slug, serviceId);
    if (fs.existsSync(rPath)) checks.push(check("registry", "Registry exists", "PASS", "Ecosystem registry present"));
    else {
      checks.push(check("registry", "Registry exists", "FAIL", "Registry missing"));
      blockers.push("Registry missing");
    }
  }

  const sitemapLocal = publishSitemapPath(slug);
  const ecoPages = countPreparedReleaseFiles(slug, serviceId).pages;
  if (candidates?.active && !candidates.published) {
    checks.push(
      check(
        "sitemap",
        "Sitemap exists",
        ecoPages > 0 ? "WARNING" : "FAIL",
        ecoPages > 0
          ? "Sitemap and indexing stay blocked until publication succeeds"
          : "No approved current-run candidates available for sitemap",
      ),
    );
    if (ecoPages > 0) warnings.push("Sitemap and indexing remain blocked until publication succeeds");
    else blockers.push("Sitemap missing");
  } else if (fs.existsSync(sitemapLocal) || ecoPages > 0) {
    checks.push(check("sitemap", "Sitemap exists", fs.existsSync(sitemapLocal) ? "PASS" : "WARNING", fs.existsSync(sitemapLocal) ? "Publish sitemap ready" : "Sitemap will be created during release preparation"));
    if (!fs.existsSync(sitemapLocal)) warnings.push("Sitemap will be generated at publish time");
  } else {
    checks.push(check("sitemap", "Sitemap exists", "FAIL", "No pages available for sitemap"));
    blockers.push("Sitemap missing");
  }

  if (ecoPages > 0) checks.push(check("required-pages", "Required pages exist", "PASS", `${ecoPages} page(s) ready`));
  else {
    checks.push(check("required-pages", "Required pages exist", "FAIL", "No publishable pages found"));
    blockers.push("Required pages missing");
  }

  if (destination.destinationConfigured) checks.push(check("destination", "Publishing destination configured", "PASS", destination.publishMethod));
  else {
    checks.push(check("destination", "Publishing destination configured", "FAIL", "Publishing destination not configured"));
    blockers.push("Destination not configured");
  }

  if (usesManagedPublishing(slug)) {
    checks.push(check("credentials", "Platform publishing credentials configured", destination.credentialsConfigured ? "PASS" : "FAIL", "Shared platform credentials"));
    if (!destination.credentialsConfigured) blockers.push("Platform credentials missing");
  } else if (destination.credentialsConfigured) {
    checks.push(check("credentials", "Publishing credentials configured", "PASS", "Secure credentials stored"));
  } else {
    checks.push(check("credentials", "Publishing credentials configured", "FAIL", "Deployment credentials missing"));
    blockers.push("Credentials missing");
  }

  if (destination.connectionStatus === "Healthy") checks.push(check("connection", "Publishing infrastructure available", "PASS", "Infrastructure connection healthy"));
  else if (destination.connectionStatus === "Warning") {
    checks.push(check("connection", "Publishing infrastructure available", "WARNING", "Infrastructure not fully verified"));
    warnings.push("Platform infrastructure not fully verified");
  } else {
    checks.push(check("connection", "Publishing infrastructure available", "FAIL", "Infrastructure unavailable"));
    blockers.push("Infrastructure unavailable");
  }

  if (destination.targetWritable === true) checks.push(check("writable", "Publish destination writable", "PASS", "Write access verified"));
  else if (destination.targetWritable === null) {
    checks.push(check("writable", "Publish destination writable", "WARNING", "Writability will be verified during publish"));
    if (!usesManagedPublishing(slug)) warnings.push("Target writability not yet confirmed");
  } else {
    checks.push(check("writable", "Publish destination writable", "FAIL", "Destination not writable or not verified"));
    blockers.push("Destination not writable");
  }

  const activeJob = listMasterAdminJobs({ slug, limit: 20 }).find(
    (j) => j.action === "publish" && (j.status === "queued" || j.status === "running"),
  );
  if (activeJob) {
    checks.push(check("active-job", "No active publish job", "FAIL", `Job ${activeJob.id} is ${activeJob.status}`));
    blockers.push("Active conflicting publish job");
  } else {
    checks.push(check("active-job", "No active publish job", "PASS", "No conflicting publish job"));
  }

  const blockingCriticalIssues = listMasterAdminIssueSummaries().filter(
    (issue) =>
      issue.tenantSlug === slug &&
      !["Closed", "Passed"].includes(issue.status) &&
      issue.severity === "Critical" &&
      issue.category !== "Publishing",
  );

  if (blockingCriticalIssues.length > 0) {
    checks.push(check("issues", "No critical unresolved issues", "FAIL", `${blockingCriticalIssues.length} open issue(s)`));
    blockers.push("Critical unresolved Issue Centre ticket");
  } else if (issues.openCount > 0 && issues.healthImpact === "critical") {
    checks.push(check("issues", "No critical unresolved issues", "WARNING", "Publishing diagnostics open — retry allowed"));
    warnings.push("Open Publishing diagnostics from a prior attempt");
  } else {
    checks.push(check("issues", "No critical unresolved issues", "PASS", "No critical open issues"));
  }

  if (qa?.checks?.find((c) => c.id === "internal-links" && c.status === "FAIL")) {
    checks.push(check("internal-links", "Internal links passed", "FAIL", "QA internal link validation failed"));
    blockers.push("Broken internal links");
  } else {
    checks.push(check("internal-links", "Internal links passed", "PASS", "Internal links passed at Quality Review"));
  }

  if (qa?.checks?.find((c) => c.id === "schema" && c.status === "FAIL")) {
    checks.push(check("schema", "Schema passed", "FAIL", "Schema validation failed at Quality Review"));
    blockers.push("Invalid schema");
  } else {
    checks.push(check("schema", "Schema passed", "PASS", "Schema passed at Quality Review"));
  }

  warnings.push("Customer pending first login");
  warnings.push("Search Console not connected");
  warnings.push("Analytics not connected");
  warnings.push("Rank tracking not initialised");
  warnings.push("Competitor Intelligence missing");
  warnings.push("Custom imagery not supplied");
  warnings.push("Welcome email not sent");

  return { checks, warnings: [...new Set(warnings)], blockers: [...new Set(blockers)] };
}

function isActivePublishJobStatus(status: MasterAdminJob["status"]): boolean {
  return status === "queued" || status === "claimed" || status === "running";
}

function publishJobReleaseId(job: MasterAdminJob): string | null {
  const result = (job.result || {}) as {
    releaseId?: string;
    currentRelease?: string;
    snapshot?: { releaseId?: string; currentRelease?: string };
  };
  return (
    result.releaseId ||
    result.currentRelease ||
    result.snapshot?.releaseId ||
    result.snapshot?.currentRelease ||
    null
  );
}

function humanizeAreaSlug(areaSlug: string): string {
  return String(areaSlug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseCampaignIdFromManifestRevision(revision: string | null | undefined): string | null {
  const m = String(revision || "").match(/^campaign-approved-content:([^:]+):([^:]+):/);
  return m?.[1] || null;
}

/**
 * Product Owner View Page List — current published release pages only.
 * Source: release FinalRenderManifest (same identity used by deploy / registry sync).
 * Scoped to tenantSlug + campaignId + serviceId + currentRelease.
 */
export function resolvePublishedReleasePageList(input: {
  slug: string;
  serviceId: string;
  campaignId?: string | null;
  currentRelease?: string | null;
}): PublishedPageListItem[] {
  const slug = safeAdminSlug(input.slug);
  const serviceId = String(input.serviceId || "").trim();
  const campaignId = String(input.campaignId || "").trim() || null;
  if (!serviceId) return [];

  const managed = readManagedPublishingProfile(slug);
  const snapshot = readLatestCommercialPublishSnapshot(slug);
  const currentRelease =
    String(input.currentRelease || managed?.currentRelease || snapshot?.releaseId || "").trim() || null;
  if (!currentRelease) return [];

  const releaseDir =
    managed?.paths?.releaseDirectory || path.join("/var/www/pharmaconnect-sites", slug, "releases");
  const manifestFile = path.join(releaseDir, currentRelease, "FinalRenderManifest.json");
  if (!fs.existsSync(manifestFile)) return [];

  let manifest: {
    serviceId?: string;
    contentManifestRevision?: string;
    pages?: Array<{ pageSlug?: string; pageType?: string }>;
  };
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as typeof manifest;
  } catch {
    return [];
  }

  const manifestServiceId = String(manifest.serviceId || "").trim();
  if (manifestServiceId && manifestServiceId !== serviceId) return [];

  const manifestCampaignId = parseCampaignIdFromManifestRevision(manifest.contentManifestRevision);
  if (campaignId && manifestCampaignId && manifestCampaignId !== campaignId) return [];

  const resolvedCampaignId = campaignId || manifestCampaignId;
  const serviceName = getServicePublishMeta(serviceId)?.serviceName || humanizeAreaSlug(serviceId);
  const baseUrl = resolvePublishWebsiteBase(slug).replace(/\/$/, "");

  const rows: PublishedPageListItem[] = [];
  for (const page of manifest.pages || []) {
    const pageSlug = String(page.pageSlug || "").trim();
    const pageType = String(page.pageType || "").trim();
    if (!pageSlug || pageSlug === "index" || pageType === "homepage") continue;

    if (pageType === "service") {
      rows.push({
        title: `${serviceName} Service Page`,
        pageType: "Service Page",
        locality: null,
        url: `${baseUrl}/${pageSlug}/`,
        pageSlug,
        serviceId,
        campaignId: resolvedCampaignId,
        releaseId: currentRelease,
      });
      continue;
    }

    if (pageType.startsWith("location-")) {
      const locality = pageSlug.replace(/^local-/, "");
      rows.push({
        title: `${serviceName} — ${humanizeAreaSlug(locality)}`,
        pageType: "Locality Page",
        locality: humanizeAreaSlug(locality),
        url: `${baseUrl}/${pageSlug}/`,
        pageSlug,
        serviceId,
        campaignId: resolvedCampaignId,
        releaseId: currentRelease,
      });
    }
  }

  // Stable order: service page first, then localities A–Z.
  rows.sort((a, b) => {
    if (a.pageType !== b.pageType) return a.pageType === "Service Page" ? -1 : 1;
    return (a.locality || a.pageSlug).localeCompare(b.locality || b.pageSlug);
  });
  return rows;
}

/**
 * Shared post-publication Product Owner verification for the current campaign release.
 * Reuses FinalRenderManifest + deployed files + tenant registry + sitemap + completed publish job.
 */
export function buildPublishedReleaseVerification(input: {
  slug: string;
  serviceId: string;
  campaignId?: string | null;
  currentRelease?: string | null;
  previousRelease?: string | null;
  rollbackTarget?: string | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  completedPublishJobId?: string | null;
}): CommercialPublishPublicationVerification {
  const empty = emptyPublicationVerification();
  const slug = safeAdminSlug(input.slug);
  const serviceId = String(input.serviceId || "").trim();
  const campaignId = String(input.campaignId || "").trim() || null;
  const pages = resolvePublishedReleasePageList({
    slug,
    serviceId,
    campaignId,
    currentRelease: input.currentRelease,
  });
  if (!pages.length) return empty;

  const managed = readManagedPublishingProfile(slug);
  const releaseId = pages[0]?.releaseId || input.currentRelease || managed?.currentRelease || null;
  if (!releaseId) return empty;

  const releaseDir =
    managed?.paths?.releaseDirectory || path.join("/var/www/pharmaconnect-sites", slug, "releases");
  const currentDir =
    managed?.paths?.currentReleasePointer || path.join("/var/www/pharmaconnect-sites", slug, "current");
  const releaseRegistryPath = path.join(releaseDir, releaseId, "registry.json");
  const tenantRegistry = readPharmacyRegistry(slug);
  const sitemapUrls = readCurrentSitemapUrlSet(slug);

  const assets: CommercialPublishPublishedAsset[] = pages.map((page) => {
    const relativeHtml = `${page.pageSlug}/index.html`;
    const deployed =
      fs.existsSync(path.join(releaseDir, releaseId, relativeHtml)) &&
      fs.existsSync(path.join(currentDir, relativeHtml));
    const inTenantRegistry = Boolean(
      (tenantRegistry?.pages || []).some(
        (p) =>
          p.serviceId === page.serviceId &&
          p.slug === page.pageSlug &&
          (!page.campaignId || !p.campaignId || p.campaignId === page.campaignId),
      ),
    );
    const inReleaseRegistry = releaseRegistryCoversPage(
      releaseRegistryPath,
      page.serviceId,
      page.pageSlug,
      page.pageType,
      page.locality,
    );
    const registryOk = inTenantRegistry || inReleaseRegistry;
    const sitemapOk = sitemapUrls.has(normalizeSitemapUrl(page.url));
    // Live URL evidence for served managed sites: page is deployed to current and listed in sitemap.
    const liveOk = deployed && sitemapOk;
    return {
      ...page,
      deploymentStatus: evidenceStatus(deployed),
      liveUrlStatus: evidenceStatus(liveOk),
      registryStatus: evidenceStatus(registryOk),
      sitemapStatus: evidenceStatus(sitemapOk),
    };
  });

  const total = assets.length;
  const serviceTotal = assets.filter((a) => a.pageType === "Service Page").length;
  const localityTotal = assets.filter((a) => a.pageType === "Locality Page").length;
  const deployedReady = assets.filter((a) => a.deploymentStatus === "PASS").length;
  const liveReady = assets.filter((a) => a.liveUrlStatus === "PASS").length;
  const registryReady = assets.filter((a) => a.registryStatus === "PASS").length;
  const sitemapReady = assets.filter((a) => a.sitemapStatus === "PASS").length;
  const pass =
    total > 0 &&
    deployedReady === total &&
    liveReady === total &&
    registryReady === total &&
    sitemapReady === total &&
    Boolean(input.completedPublishJobId);

  return {
    status: pass ? "PASS" : "FAIL",
    label: pass ? "PUBLISHED & VERIFIED" : "PUBLICATION INCOMPLETE",
    publishedRelease: releaseId,
    publishedAt: input.publishedAt || null,
    publishedBy: input.publishedBy || null,
    previousRelease: input.previousRelease || null,
    rollbackTarget: input.rollbackTarget || null,
    campaignPages: { ready: total, total },
    servicePages: { ready: serviceTotal, total: serviceTotal },
    localityPages: { ready: localityTotal, total: localityTotal },
    deployed: { ready: deployedReady, total },
    liveUrls: { ready: liveReady, total },
    registry: { ready: registryReady, total },
    sitemap: { ready: sitemapReady, total },
    completedPublishJobId: input.completedPublishJobId || null,
    assets,
  };
}

/**
 * Publish Review progress source of truth:
 * 1) active publish job (queued/claimed/running)
 * 2) else completed job for the current release (snapshot jobId, then release match)
 * 3) else none — never surface stale failed/historical mid-flight stages
 */
export function resolvePublishReviewProgressJob(
  slug: string,
  currentRelease: string | null,
): MasterAdminJob | null {
  const publishJobs = listMasterAdminJobs({ slug, limit: 50 }).filter((j) => j.action === "publish");
  const active = publishJobs.find((j) => isActivePublishJobStatus(j.status));
  if (active) return active;

  if (!currentRelease) return null;

  const snapshot = readLatestCommercialPublishSnapshot(slug) as {
    jobId?: string;
    releaseId?: string;
    currentRelease?: string;
  } | null;
  const snapshotRelease = snapshot?.currentRelease || snapshot?.releaseId || null;
  if (snapshot?.jobId && snapshotRelease === currentRelease) {
    const fromSnapshot = getMasterAdminJob(snapshot.jobId);
    if (fromSnapshot?.action === "publish" && fromSnapshot.status === "completed") {
      return fromSnapshot;
    }
  }

  return (
    publishJobs.find(
      (j) => j.status === "completed" && publishJobReleaseId(j) === currentRelease,
    ) || null
  );
}

export function buildCommercialPublishReview(slug: string): CommercialPublishReviewPayload {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) {
    return {
      version: 1,
      slug,
      serviceId: "",
      generatedAt: null,
      summary: {
        qualityReviewApproved: false,
        generatedOutputComplete: false,
        publishingDestinationConfirmed: false,
        deploymentConnection: "Offline",
        filesReady: 0,
        pagesReady: 0,
        assetsReady: 0,
        lastGenerated: null,
        publishingReadiness: "BLOCKED",
      },
      publishStageSummary: {
        stageLabel: "Publish",
        generatedPackage: "—",
        currentRelease: "None",
        managedHostname: null,
        managedUrl: null,
        publishingStatus: "not published",
        previousRelease: "None",
        publishingReadiness: "BLOCKED",
        overallStatus: "BLOCKED",
      },
      releaseManagement: {
        currentRelease: null,
        previousRelease: null,
        publishedVersion: 0,
        publishedAt: null,
        publishedBy: null,
        publishDurationMs: null,
        rollbackTarget: null,
        rollbackAvailable: false,
      },
      destination: buildDestination(slug),
      checks: [],
      warnings: [],
      blockers: ["Customer not found"],
      changeSummary: {
        mode: "initial_publish",
        totalFiles: 0,
        newFiles: 0,
        changedFiles: 0,
        unchangedFiles: 0,
        deletedFiles: 0,
        pages: 0,
        images: 0,
        sitemap: false,
        registry: false,
        manifest: false,
        redirects: 0,
      },
      previewUrl: "",
      pageList: [],
      publishedPageList: [],
      publicationVerification: emptyPublicationVerification(),
      qaApprovalReference: null,
      manifestPath: null,
      publishManifestPath: null,
      canApprove: false,
      activePublishJob: null,
      loadError: "Customer not found",
    };
  }

  const selection = readActiveServiceCampaignSelection(slug);
  const serviceId =
    resolveCurrentRunCandidateServiceId(slug, selection?.serviceId || ctx.serviceId) ||
    selection?.serviceId ||
    ctx.serviceId;
  const contentApproval = resolveCampaignPublishingContentApproval(slug, {
    campaignId: selection?.campaignId,
    serviceId,
  });
  const manifest = loadContentPackage(slug, serviceId);
  const qa =
    contentApproval.mode === "legacy-commercial-quality"
      ? readLatestCommercialQualityApproval(slug)
      : null;
  const destination = buildDestination(slug);
  const releaseCounts = countPreparedReleaseFiles(slug, serviceId);
  const { checks, warnings, blockers } = runPrePublishChecks(slug, serviceId, destination);
  const changeSummary = buildChangeSummary(slug, serviceId, releaseCounts.pages);

  const summary: CommercialPublishReviewSummary = {
    qualityReviewApproved: contentApproval.approved,
    generatedOutputComplete: Boolean(manifest?.generatedAt && manifest.status !== "error"),
    publishingDestinationConfirmed: destination.destinationConfigured,
    deploymentConnection: destination.connectionStatus,
    filesReady: releaseCounts.files,
    pagesReady: releaseCounts.pages,
    assetsReady: releaseCounts.assets || (qa?.contentTotals?.images ?? 0),
    lastGenerated: manifest?.generatedAt || null,
    publishingReadiness: blockers.length ? "BLOCKED" : "READY TO PUBLISH",
  };

  const managedReview = usesManagedPublishing(slug) ? buildManagedPublishingReview(slug) : null;
  const publishStageSummary = buildPublishStageSummary(
    slug,
    serviceId,
    blockers,
    managedReview?.profile.managedHostname || null,
    managedReview?.profile.managedUrl || null,
  );
  const releaseManagement = buildReleaseManagement(slug);
  const progressJob = resolvePublishReviewProgressJob(slug, releaseManagement.currentRelease);
  const blockingPublishJob =
    progressJob && (progressJob.status === "queued" || progressJob.status === "running")
      ? progressJob
      : null;
  const campaignId = selection?.campaignId || releaseCounts.campaignId;
  const publishedPageList = resolvePublishedReleasePageList({
    slug,
    serviceId,
    campaignId,
    currentRelease: releaseManagement.currentRelease,
  });
  const completedPublishJobId =
    progressJob?.status === "completed"
      ? progressJob.id
      : null;
  const publicationVerification = buildPublishedReleaseVerification({
    slug,
    serviceId,
    campaignId,
    currentRelease: releaseManagement.currentRelease,
    previousRelease: releaseManagement.previousRelease,
    rollbackTarget: releaseManagement.rollbackTarget,
    publishedAt: releaseManagement.publishedAt,
    publishedBy: releaseManagement.publishedBy,
    completedPublishJobId,
  });
  // Completed verified campaign release must not continue showing READY FOR INTERNAL PUBLISH.
  if (publicationVerification.status === "PASS") {
    publishStageSummary.publishingReadiness = "PUBLISHED & VERIFIED";
    publishStageSummary.overallStatus = "PUBLISHED & VERIFIED";
    publishStageSummary.publishingStatus = "published and verified";
  }

  return {
    version: 1,
    slug,
    serviceId,
    generatedAt: manifest?.generatedAt || null,
    summary,
    publishStageSummary,
    releaseManagement,
    destination,
    checks,
    warnings,
    blockers,
    changeSummary,
    previewUrl: `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(slug)}`,
    pageList: releaseCounts.pageList,
    publishedPageList,
    publicationVerification,
    qaApprovalReference: contentApproval.approvalReference || qa?.approvedAt || null,
    manifestPath: fs.existsSync(manifestPath(slug, serviceId)) ? manifestPath(slug, serviceId) : null,
    publishManifestPath: fs.existsSync(publishIndexPath(slug)) ? publishIndexPath(slug) : null,
    canApprove: blockers.length === 0 && !blockingPublishJob,
    activePublishJob: progressJob
      ? {
          id: progressJob.id,
          status: progressJob.status,
          progress: progressJob.progress,
          progressLabel: progressJob.progressLabel,
          startedAt: progressJob.startedAt,
          completedAt: progressJob.completedAt,
          retryCount: progressJob.retryCount,
          publishProgress: (progressJob.result as { publishProgress?: Record<string, unknown> })?.publishProgress,
        }
      : null,
  };
}

export function isCommercialPublishJobMeta(sourceRevision?: string): boolean {
  if (!sourceRevision) return false;
  try {
    const meta = JSON.parse(sourceRevision) as { type?: string };
    return meta.type === COMMERCIAL_PUBLISH_JOB_TYPE;
  } catch {
    return false;
  }
}

export function approveAndQueueCommercialPublish(
  slug: string,
  operator: string,
  confirmation: { operatorConfirmed: boolean },
): { ok: boolean; errors: string[]; jobId?: string; review: CommercialPublishReviewPayload } {
  const review = buildCommercialPublishReview(slug);
  if (!confirmation.operatorConfirmed) {
    return { ok: false, errors: ["Operator confirmation required"], review };
  }
  if (review.blockers.length) {
    return { ok: false, errors: review.blockers, review };
  }
  const blockingJob = listMasterAdminJobs({ slug, limit: 20 }).find(
    (j) => j.action === "publish" && (j.status === "queued" || j.status === "running"),
  );
  if (blockingJob) {
    return { ok: false, errors: ["Publish job already in progress"], review };
  }

  const manifestHash = hashFile(manifestPath(slug, review.serviceId)) || "unknown";
  const idempotencyKey = `commercial-publish:${slug}:${manifestHash}`;

  const existingActive = listMasterAdminJobs({ slug, limit: 50 }).find(
    (j) => j.action === "publish" && (j.status === "queued" || j.status === "running"),
  );
  if (existingActive) {
    return { ok: false, errors: ["Active conflicting publish job"], review };
  }

  const contentApproval = resolveCampaignPublishingContentApproval(slug, {
    serviceId: review.serviceId,
  });
  const job = createMasterAdminJob({
    slug,
    action: "publish",
    user: operator,
    workflowStage: "publish",
    idempotencyKey,
    sourceRevision: JSON.stringify({
      type: COMMERCIAL_PUBLISH_JOB_TYPE,
      operatorConfirmed: true,
      qaApprovedAt: contentApproval.approvalReference,
      contentApprovalMode: contentApproval.mode,
      campaignId: contentApproval.campaignId,
      manifestHash,
      serviceId: review.serviceId,
      operator,
      queuedAt: new Date().toISOString(),
    }),
  });

  runMasterAdminJobAsync(job.id);

  return { ok: true, errors: [], jobId: job.id, review: buildCommercialPublishReview(slug) };
}

export function getCommercialPublishJobProgress(jobId: string): Record<string, unknown> | null {
  const job = getMasterAdminJob(jobId);
  if (!job) return null;
  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    progressLabel: job.progressLabel,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    retryCount: job.retryCount,
    error: job.error,
    stackTrace: job.stackTrace,
    publishProgress: (job.result as { publishProgress?: Record<string, unknown> })?.publishProgress || null,
  };
}
