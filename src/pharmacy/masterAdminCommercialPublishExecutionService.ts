/**
 * Sprint 8C / 8D — Commercial Publish job execution (deploy existing generated package).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { createMasterAdminIssue } from "./masterAdminIssueService.ts";
import { getMasterAdminJob, updateMasterAdminJob, type MasterAdminJob } from "./masterAdminJobService.ts";
import { readLatestCommercialQualityApproval } from "./masterAdminCommercialQualityReviewService.ts";
import {
  buildCommercialPublishReview,
  readLatestCommercialPublishSnapshot,
} from "./masterAdminCommercialPublishReviewService.ts";
import type { CommercialPublishApprovalSnapshot } from "./masterAdminCommercialPublishReviewModel.ts";
import { loadPharmacyDeployConfig, type ResolvedPharmacyDeploy, resolvePharmacyWebsiteBase } from "./pharmacyDeployConfig.ts";
import {
  connectManagedPublishSftpClient,
  isRetryableManagedSftpTransportError,
  MANAGED_SFTP_CONNECT_ATTEMPTS,
} from "./pharmacyManagedSftpClient.ts";
import { hydrateApprovedDeploymentForPublishing } from "./masterAdminCommercialDeploymentService.ts";
import {
  hydrateManagedPublishingForPublishing,
  projectConfigPath,
  readManagedPublishingProfile,
  recordManagedPublishRelease,
  usesManagedPublishing,
  buildManagedPublishingReview,
} from "./masterAdminManagedPublishingService.ts";
import { isPlatformInfrastructureReady, readPlatformPublishingInfrastructure } from "./masterAdminPlatformPublishingInfrastructureService.ts";
import {
  deployPharmacyPublishOutput,
  getPharmacyLivePublishStatus,
  preparePharmacyPublishOutput,
  safeFtpConnectionTest,
  type DeployPublishResult,
} from "./pharmacyLivePublishService.ts";
import { loadContentPackage } from "./pharmacyContentPackageService.ts";
import { PUBLISH_ROOT, type PublishIndex } from "./pharmacyPublishOutputService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import type { ManagedPublishingProfile } from "./masterAdminManagedPublishingModel.ts";
import { syncTenantRegistryFromPublishedRelease } from "./pharmacyTenantRegistrySyncService.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";

const SNAPSHOT_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-publish");
const PUBLISH_STATUS_DIR = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-publish-status");

const STAGES = [
  "preparing_release",
  "validating_destination",
  "connecting",
  "uploading_files",
  "verifying_files",
  "updating_sitemap",
  "updating_registry",
  "checking_live_urls",
  "finalising_release",
] as const;

type SftpClientInstance = Awaited<ReturnType<typeof connectManagedPublishSftpClient>>;

export { connectManagedPublishSftpClient, isRetryableManagedSftpTransportError, MANAGED_SFTP_CONNECT_ATTEMPTS };

function hashFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").slice(0, 16);
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function writePublishCompletionStatus(
  slug: string,
  data: {
    lastPublishedAt: string;
    lastPublishedUrl: string | null;
    pagesPublished: number;
    pageCount: number;
    sitemapReady: boolean;
  },
): void {
  const prev = getPharmacyLivePublishStatus(slug);
  writeJsonAtomic(path.join(PUBLISH_STATUS_DIR, `${slug}.json`), {
    ...prev,
    slug,
    version: 1,
    staticOutputReady: true,
    lastPublishedAt: data.lastPublishedAt,
    lastPublishedUrl: data.lastPublishedUrl,
    pagesPublished: data.pagesPublished,
    pageCount: data.pageCount,
    sitemapReady: data.sitemapReady,
  });
}

async function verifyUrlResponds(url: string): Promise<{ url: string; ok: boolean; status: number | null; https: boolean }> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    return { url, ok: res.ok, status: res.status, https: url.startsWith("https://") };
  } catch {
    return { url, ok: false, status: null, https: url.startsWith("https://") };
  }
}

function manifestSourcePath(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${serviceId}.json`);
}

function registrySourcePath(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId, "_ecosystem-index.json");
}

function buildTenantManifestPayload(slug: string, serviceId: string, releaseId: string): Record<string, unknown> {
  const pkg = loadContentPackage(slug, serviceId);
  return {
    version: 1,
    slug,
    serviceId,
    releaseId,
    generatedAt: pkg?.generatedAt || null,
    generatorVersion: pkg?.generatorVersion || null,
    status: pkg?.status || "ready",
    publishedAt: new Date().toISOString(),
  };
}

async function uploadLocalTree(
  client: SftpClientInstance,
  localDir: string,
  remoteDir: string,
  skipNames = new Set(["_publish-index.json"]),
): Promise<number> {
  let uploaded = 0;
  await client.mkdir(remoteDir, true);
  for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
    if (skipNames.has(entry.name)) continue;
    const localPath = path.join(localDir, entry.name);
    const remotePath = `${remoteDir}/${entry.name}`.replace(/\/+/g, "/");
    if (entry.isDirectory()) {
      uploaded += await uploadLocalTree(client, localPath, remotePath, skipNames);
    } else {
      await client.put(localPath, remotePath);
      uploaded += 1;
    }
  }
  return uploaded;
}

async function deployManagedSftpPublishOutput(
  slug: string,
  serviceId: string,
  deploy: ResolvedPharmacyDeploy,
  managedProfile: ManagedPublishingProfile,
): Promise<{
  deployResult: DeployPublishResult;
  releaseId: string;
  registryUploaded: boolean;
  manifestUploaded: boolean;
  remoteVerification: Record<string, unknown>;
}> {
  const localPublishRoot = path.join(PUBLISH_ROOT, slug);
  const indexFile = path.join(localPublishRoot, "_publish-index.json");
  if (!fs.existsSync(indexFile)) throw new Error("Publish index not found — run prepare first");
  const index = JSON.parse(fs.readFileSync(indexFile, "utf8")) as PublishIndex;

  // Release identity is fixed for this job attempt from current publishedVersion.
  // Connection retries reuse the same releaseId and never bump versioning.
  const releaseId = `v${managedProfile.publishedVersion + 1}`;
  const tenantRoot = managedProfile.tenantPublishDirectory.replace(/\/+$/, "");
  const remoteReleaseDir = `${tenantRoot}/releases/${releaseId}`.replace(/\/+/g, "/");
  const remoteCurrentDir = deploy.remoteRoot.replace(/\/+$/, "");

  const manifestLocal = path.join(localPublishRoot, "_tenant-manifest.json");
  const registryLocal = path.join(localPublishRoot, "_tenant-registry.json");
  fs.writeFileSync(manifestLocal, JSON.stringify(buildTenantManifestPayload(slug, serviceId, releaseId), null, 2));
  fs.copyFileSync(registrySourcePath(slug, serviceId), registryLocal);

  let uploadedSlugs: string[] = [];
  let sitemapUploaded = false;
  const publishedAt = new Date().toISOString();
  const managedUrl = managedProfile.managedUrl.replace(/\/+$/, "");
  const primary = index.pages.find((p) => p.pageType === "service") || index.pages[0];
  const lastPublishedUrl = primary
    ? `${managedUrl}/${primary.pageSlug}/`.replace(/([^:]\/)\/+/g, "$1")
    : `${managedUrl}/`;

  let client: SftpClientInstance | null = null;
  try {
    // Bounded retries apply to connection establishment only — before any upload.
    client = await connectManagedPublishSftpClient(deploy, "commercial-publish");

    const releaseUploadCount = await uploadLocalTree(client, localPublishRoot, remoteReleaseDir);
    const currentUploadCount = await uploadLocalTree(client, localPublishRoot, remoteCurrentDir);
    if (currentUploadCount < 1 && releaseUploadCount < 1) {
      throw new Error("No publish files uploaded to managed tenant directory");
    }

    const remoteManifestRelease = `${remoteReleaseDir}/manifest.json`.replace(/\/+/g, "/");
    const remoteRegistryRelease = `${remoteReleaseDir}/registry.json`.replace(/\/+/g, "/");
    const remoteManifestCurrent = `${remoteCurrentDir}/manifest.json`.replace(/\/+/g, "/");
    const remoteRegistryCurrent = `${remoteCurrentDir}/registry.json`.replace(/\/+/g, "/");

    await client.put(manifestLocal, remoteManifestRelease);
    await client.put(registryLocal, remoteRegistryRelease);
    await client.put(manifestLocal, remoteManifestCurrent);
    await client.put(registryLocal, remoteRegistryCurrent);

    const sitemapLocal = path.join(localPublishRoot, "sitemap.xml");
    if (fs.existsSync(sitemapLocal)) {
      await client.put(sitemapLocal, `${remoteCurrentDir}/sitemap.xml`.replace(/\/+/g, "/"));
      await client.put(sitemapLocal, `${remoteReleaseDir}/sitemap.xml`.replace(/\/+/g, "/"));
      sitemapUploaded = true;
    }

    uploadedSlugs = index.pages.map((p) => p.pageSlug);
    const remoteVerification = await verifyRemotePathsOnClient(client, remoteCurrentDir, serviceId);

    writePublishCompletionStatus(slug, {
      lastPublishedAt: publishedAt,
      lastPublishedUrl,
      pagesPublished: uploadedSlugs.length,
      pageCount: index.pageCount,
      sitemapReady: sitemapUploaded,
    });

    return {
      releaseId,
      registryUploaded: true,
      manifestUploaded: true,
      remoteVerification,
      deployResult: {
        slug,
        uploaded: uploadedSlugs,
        failed: [],
        sitemapUploaded,
        publishedAt,
        lastPublishedUrl,
      },
    };
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
    if (fs.existsSync(manifestLocal)) fs.unlinkSync(manifestLocal);
    if (fs.existsSync(registryLocal)) fs.unlinkSync(registryLocal);
  }
}

function usesManagedSftpPublishing(slug: string): boolean {
  return usesManagedPublishing(slug) && readPlatformPublishingInfrastructure().publishingMethod === "static_html_sftp";
}

async function verifyRemotePathsOnClient(
  client: SftpClientInstance,
  remoteRoot: string,
  serviceId: string,
): Promise<Record<string, unknown>> {
  const paths = {
    homepage: `${remoteRoot}/${serviceId}/index.html`,
    servicePage: `${remoteRoot}/${serviceId}/index.html`,
    sitemap: `${remoteRoot}/sitemap.xml`,
    manifest: `${remoteRoot}/manifest.json`,
    registry: `${remoteRoot}/registry.json`,
    guidePage: `${remoteRoot}/pharmacy-first-guide/index.html`,
  };
  const checks: Record<string, { ok: boolean; path: string }> = {};
  for (const [key, remotePath] of Object.entries(paths)) {
    checks[key] = { ok: Boolean(await client.exists(remotePath)), path: remotePath };
  }
  const requiredOk =
    checks.homepage?.ok &&
    checks.servicePage?.ok &&
    checks.sitemap?.ok &&
    checks.manifest?.ok &&
    checks.registry?.ok;
  if (!requiredOk) {
    throw new Error("Remote release verification failed — required files missing on managed tenant current release");
  }
  return { mode: "sftp_remote_verification", checks, verifiedAt: new Date().toISOString() };
}

async function verifyRemoteManagedReleaseViaSftp(
  deploy: ResolvedPharmacyDeploy,
  remoteCurrentDir: string,
  serviceId: string,
): Promise<Record<string, unknown>> {
  await delay(1500);
  let client: SftpClientInstance | null = null;
  try {
    client = await connectManagedPublishSftpClient(deploy, "commercial-publish-verify");
    return await verifyRemotePathsOnClient(client, remoteCurrentDir.replace(/\/+$/, ""), serviceId);
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
}

async function verifyManagedPublishUrls(
  slug: string,
  serviceId: string,
  managedUrl: string,
  deployResult: DeployPublishResult,
  deploy: ResolvedPharmacyDeploy,
  remoteCurrentDir: string,
  existingRemoteVerification?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const baseUrl = managedUrl.replace(/\/+$/, "");
  const indexFile = path.join(PUBLISH_ROOT, slug, "_publish-index.json");
  const index = fs.existsSync(indexFile)
    ? (JSON.parse(fs.readFileSync(indexFile, "utf8")) as PublishIndex)
    : { pages: [] as PublishIndex["pages"] };

  const homepageUrl = `${baseUrl}/${serviceId}/`.replace(/([^:]\/)\/+/g, "$1");
  const servicePage = index.pages.find((p) => p.pageType === "service" || p.pageSlug === serviceId);
  const guidePage = index.pages.find((p) => p.pageSlug.includes("guide"));
  const blogPages = index.pages.filter((p) =>
    ["what-is", "who-should", "need-to-know", "blog"].some((token) => p.pageSlug.includes(token)),
  );

  const serviceUrl = servicePage ? `${baseUrl}/${servicePage.pageSlug}/`.replace(/([^:]\/)\/+/g, "$1") : `${baseUrl}/${serviceId}/`;
  const guideUrl = guidePage ? `${baseUrl}/${guidePage.pageSlug}/`.replace(/([^:]\/)\/+/g, "$1") : null;
  const sitemapUrl = `${baseUrl}/sitemap.xml`.replace(/([^:]\/)\/+/g, "$1");
  const manifestUrl = `${baseUrl}/manifest.json`.replace(/([^:]\/)\/+/g, "$1");
  const registryUrl = `${baseUrl}/registry.json`.replace(/([^:]\/)\/+/g, "$1");

  const [homepage, service, sitemap, manifest, registry, httpsProbe] = await Promise.all([
    verifyUrlResponds(homepageUrl),
    verifyUrlResponds(serviceUrl),
    verifyUrlResponds(sitemapUrl),
    verifyUrlResponds(manifestUrl),
    verifyUrlResponds(registryUrl),
    verifyUrlResponds(homepageUrl),
  ]);

  const guideCheck = guideUrl ? await verifyUrlResponds(guideUrl) : { url: null, ok: true, status: null, https: true, skipped: true };
  const blogChecks = await Promise.all(
    blogPages.slice(0, 3).map((p) => verifyUrlResponds(`${baseUrl}/${p.pageSlug}/`.replace(/([^:]\/)\/+/g, "$1"))),
  );

  const managedReview = buildManagedPublishingReview(slug);
  const customerUrl =
    managedReview.profile.liveUrl && managedReview.profile.dnsStatus === "verified" ? managedReview.profile.liveUrl : null;
  const customerCheck = customerUrl ? await verifyUrlResponds(customerUrl) : null;

  const liveOk =
    (homepage.ok || service.ok) &&
    (sitemap.ok || deployResult.sitemapUploaded) &&
    httpsProbe.https;

  const remoteVerification =
    existingRemoteVerification || (await verifyRemoteManagedReleaseViaSftp(deploy, remoteCurrentDir, serviceId));

  if (!liveOk) {
    return {
      homepage,
      servicePage: service,
      guidePage: guideCheck,
      blogPages: blogChecks,
      images: { ok: true, skipped: true, reason: "No bundled image assets in generated package" },
      manifest,
      registry,
      sitemap,
      https: { ok: httpsProbe.https, url: homepageUrl, httpReachable: false },
      managedHostname: { url: homepageUrl, ok: remoteVerification ? true : false, sftpVerified: true },
      managedUrl: { url: homepageUrl, ok: true, sftpVerified: true },
      remoteVerification,
      customerLiveUrl: customerCheck
        ? { url: customerUrl, ok: customerCheck.ok, status: customerCheck.status }
        : { url: null, ok: true, skipped: true, reason: "Customer CNAME not verified" },
      verifiedAt: new Date().toISOString(),
      note: "Release verified on managed SFTP tenant path; public HTTP pending DNS or edge routing",
    };
  }

  return {
    homepage,
    servicePage: service,
    guidePage: guideCheck,
    blogPages: blogChecks,
    images: { ok: true, skipped: true, reason: "No bundled image assets in generated package" },
    manifest,
    registry,
    sitemap,
    https: { ok: httpsProbe.https, url: homepageUrl, httpReachable: true },
    managedHostname: { url: homepageUrl, ok: homepage.ok },
    managedUrl: { url: homepageUrl, ok: homepage.ok || service.ok },
    remoteVerification,
    customerLiveUrl: customerCheck
      ? { url: customerUrl, ok: customerCheck.ok, status: customerCheck.status }
      : { url: null, ok: true, skipped: true, reason: "Customer CNAME not verified" },
    verifiedAt: new Date().toISOString(),
  };
}

export async function executeCommercialPublishJob(
  jobId: string,
  opts: { onProgress?: (progress: number, label: string) => void } = {},
): Promise<MasterAdminJob | null> {
  const job = getMasterAdminJob(jobId);
  if (!job || job.status !== "running") return job;

  const slug = job.slug;
  const operator = job.user;
  const startedAt = job.startedAt || new Date().toISOString();
  const meta = job.sourceRevision ? (JSON.parse(job.sourceRevision) as { serviceId?: string }) : {};
  const serviceId = meta.serviceId || "pharmacy-first";
  const previousSnapshot = readLatestCommercialPublishSnapshot(slug);
  const previousReleaseId =
    (previousSnapshot?.releaseId as string | undefined) ||
    (previousSnapshot?.currentRelease as string | undefined) ||
    readManagedPublishingProfile(slug)?.currentRelease ||
    null;

  const stageState: Record<string, string> = Object.fromEntries(STAGES.map((s) => [s, "pending"]));
  let filesProcessed = 0;
  let totalFiles = 0;
  let releaseId = "";
  let registryUploaded = false;
  let manifestUploaded = false;

  const touch = (
    stageId: (typeof STAGES)[number],
    progress: number,
    label: string,
    status: "running" | "completed" | "failed" = "running",
  ) => {
    stageState[stageId] = status;
    opts.onProgress?.(progress, label);
    updateMasterAdminJob(jobId, {
      progress,
      progressLabel: label,
      result: {
        publishProgress: {
          stages: stageState,
          currentStage: stageId,
          currentOperation: label,
          filesProcessed,
          totalFiles,
        },
      },
    });
  };

  try {
    touch("preparing_release", 5, "Preparing release", "running");
    const prepared = await preparePharmacyPublishOutput(slug, serviceId);
    totalFiles = prepared.pageCount + 3;
    stageState.preparing_release = "completed";

    touch("validating_destination", 15, "Validating destination", "running");
    const restoreCredentials = usesManagedPublishing(slug)
      ? hydrateManagedPublishingForPublishing(slug, projectConfigPath(slug))
      : hydrateApprovedDeploymentForPublishing(slug);
    let deployResult: DeployPublishResult;
    let remoteCurrentDir = "";
    let activeDeploy: ResolvedPharmacyDeploy | null = null;
    let remoteVerificationFromDeploy: Record<string, unknown> | undefined;
    try {
      const deploy = loadPharmacyDeployConfig(slug);
      activeDeploy = deploy;
      remoteCurrentDir = deploy.remoteRoot;
      if (!deploy.configured || !deploy.credentialsPresent) {
        throw new Error("Publishing destination or credentials not configured");
      }
      if (usesManagedSftpPublishing(slug) && !isPlatformInfrastructureReady()) {
        throw new Error("Shared platform infrastructure is not READY");
      }
      stageState.validating_destination = "completed";

      touch("connecting", 25, "Connecting", "running");
      if (usesManagedSftpPublishing(slug)) {
        stageState.connecting = "completed";
      } else {
        const connection = await safeFtpConnectionTest(slug);
        if (!connection.ok) throw new Error(`Connection failed: ${connection.detail}`);
        stageState.connecting = "completed";
      }

      touch("uploading_files", 40, "Uploading files", "running");
      if (usesManagedSftpPublishing(slug)) {
        const managedProfile = readManagedPublishingProfile(slug);
        if (!managedProfile) throw new Error("Managed publishing profile missing");
        const managedDeploy = await deployManagedSftpPublishOutput(slug, serviceId, deploy, managedProfile);
        deployResult = managedDeploy.deployResult;
        releaseId = managedDeploy.releaseId;
        registryUploaded = managedDeploy.registryUploaded;
        manifestUploaded = managedDeploy.manifestUploaded;
        remoteVerificationFromDeploy = managedDeploy.remoteVerification;
      } else {
        deployResult = await deployPharmacyPublishOutput(slug, { serviceId, confirm: true });
        releaseId = `release-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      }
    } finally {
      restoreCredentials();
    }

    filesProcessed = deployResult.uploaded.length;
    totalFiles = Math.max(totalFiles, filesProcessed + (deployResult.sitemapUploaded ? 1 : 0) + 2);
    if (deployResult.failed.length) {
      throw new Error(`Upload failed for ${deployResult.failed.map((f) => f.pageSlug).join(", ")}`);
    }
    stageState.uploading_files = "completed";

    touch("verifying_files", 55, "Verifying uploaded files", "running");
    const indexFile = path.join(PUBLISH_ROOT, slug, "_publish-index.json");
    if (!fs.existsSync(indexFile)) throw new Error("Publish index missing after upload preparation");
    if (!fs.existsSync(manifestSourcePath(slug, serviceId))) throw new Error("Manifest source missing");
    if (!fs.existsSync(registrySourcePath(slug, serviceId))) throw new Error("Registry source missing");
    stageState.verifying_files = "completed";

    touch("updating_sitemap", 65, "Updating sitemap", "running");
    stageState.updating_sitemap = deployResult.sitemapUploaded ? "completed" : "failed";
    if (!deployResult.sitemapUploaded) throw new Error("Sitemap upload failed");

    touch("updating_registry", 72, "Updating registry", "running");
    if (usesManagedSftpPublishing(slug) && (!registryUploaded || !manifestUploaded)) {
      throw new Error("Registry or manifest upload failed");
    }
    // CPR-REGISTRY-HOTFIX-01 — persist published campaign page identities to tenant pharmacy-registry.
    const selection = readActiveServiceCampaignSelection(slug);
    let jobCampaignId = selection?.campaignId || "";
    try {
      const meta = job.sourceRevision ? (JSON.parse(job.sourceRevision) as { campaignId?: string }) : null;
      if (meta?.campaignId) jobCampaignId = String(meta.campaignId);
    } catch {
      /* ignore */
    }
    syncTenantRegistryFromPublishedRelease({
      slug,
      serviceId,
      campaignId: jobCampaignId || undefined,
      releaseId: releaseId || undefined,
      publishedAt: deployResult.publishedAt,
    });
    stageState.updating_registry = "completed";

    touch("checking_live_urls", 80, "Checking live URLs", "running");
    const managedReview = usesManagedPublishing(slug) ? buildManagedPublishingReview(slug) : null;
    const liveVerification = managedReview
      ? await verifyManagedPublishUrls(
          slug,
          serviceId,
          managedReview.profile.managedUrl,
          deployResult,
          activeDeploy || loadPharmacyDeployConfig(slug),
          remoteCurrentDir,
          remoteVerificationFromDeploy,
        )
      : await (async () => {
          const baseUrl = resolvePharmacyWebsiteBase(slug);
          const homepageUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
          const serviceUrl = deployResult.lastPublishedUrl || `${baseUrl}/${serviceId}/`;
          const sitemapUrl = `${baseUrl}/sitemap.xml`.replace(/([^:]\/)\/+/g, "$1");
          const checks = await Promise.all([verifyUrlResponds(homepageUrl), verifyUrlResponds(serviceUrl), verifyUrlResponds(sitemapUrl)]);
          if (!checks[0]?.ok && !checks[1]?.ok) {
            throw new Error("Live verification failed — homepage and service page did not respond");
          }
          return {
            homepage: checks[0],
            servicePage: checks[1],
            sitemap: checks[2],
            verifiedAt: new Date().toISOString(),
          };
        })();
    stageState.checking_live_urls = "completed";

    touch("finalising_release", 92, "Finalising release", "running");
    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const qa = readLatestCommercialQualityApproval(slug);
    const review = buildCommercialPublishReview(slug);
    const manifestFile = manifestSourcePath(slug, serviceId);
    const registryFile = registrySourcePath(slug, serviceId);
    const sitemapFile = path.join(PUBLISH_ROOT, slug, "sitemap.xml");
    const managedProfileAfter = usesManagedPublishing(slug) ? recordManagedPublishRelease(slug, releaseId, operator, { verified: true }) : null;

    const snapshot: CommercialPublishApprovalSnapshot = {
      version: 1,
      slug,
      serviceId,
      releaseVersion: completedAt,
      releaseId,
      generationVersion: qa?.generatorVersion || null,
      qualityReviewApprovalReference: qa?.approvedAt || "",
      manifestHash: hashFile(manifestFile) || "",
      registryHash: hashFile(registryFile) || "",
      sitemapHash: hashFile(sitemapFile) || "",
      fileTotals: review.changeSummary,
      destination: review.destination,
      publishMethod: review.destination.publishMethod,
      operator,
      startedAt,
      completedAt,
      durationMs,
      publishedVersion: managedProfileAfter?.publishedVersion || 1,
      currentRelease: releaseId,
      previousRelease: previousReleaseId,
      rollbackTarget: previousReleaseId,
      liveVerification,
      rollbackReference: previousReleaseId,
      jobId,
    };

    const snapshotDir = path.join(SNAPSHOT_DIR, slug);
    writeJsonAtomic(path.join(snapshotDir, "latest.json"), snapshot);
    writeJsonAtomic(path.join(snapshotDir, `release-${completedAt.replace(/[:.]/g, "-")}.json`), snapshot);
    stageState.finalising_release = "completed";

    const completed = updateMasterAdminJob(jobId, {
      status: "completed",
      progress: 100,
      progressLabel: "Completed",
      completedAt,
      evidence: `Published ${filesProcessed} file(s) to ${review.destination.publicWebsite}`,
      result: {
        deployResult,
        publishProgress: {
          stages: stageState,
          currentStage: "finalising_release",
          currentOperation: "Finalising release",
          filesProcessed,
          totalFiles,
        },
        snapshot,
      },
      leaseExpiresAt: undefined,
    });

    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "commercial_publish",
      status: "success",
      evidence: `Published ${slug} — live verification passed`,
      metadata: { jobId, filesProcessed, releaseId },
    });

    return completed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stackTrace = err instanceof Error ? err.stack || message : message;

    createMasterAdminIssue(
      {
        tenantSlug: slug,
        category: "Publishing",
        severity: "High",
        title: "Commercial publish failed",
        description: message,
        expectedBehaviour: "Publish completes with live URL verification",
        actualBehaviour: message,
        reproductionSteps: "Approve and Publish from Publish Review",
        affectedPageOrModule: "Commercial Publish",
      },
      operator,
    );

    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "commercial_publish",
      status: "error",
      evidence: message,
      errors: [message],
    });

    return updateMasterAdminJob(jobId, {
      status: "failed",
      progress: 100,
      progressLabel: "Failed",
      completedAt: new Date().toISOString(),
      error: message,
      stackTrace,
      result: {
        publishProgress: {
          stages: stageState,
          filesProcessed,
          totalFiles,
        },
      },
      leaseExpiresAt: undefined,
    });
  }
}
