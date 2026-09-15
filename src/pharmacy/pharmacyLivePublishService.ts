/**
 * Pharmacy Live Publishing V1 — static output prep, safe FTP test, explicit deploy.
 * Connects existing pharmacy-publish output to FTP. No auto-publish.
 */
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import * as ftp from "basic-ftp";
import {
  PUBLISH_ROOT,
  type PublishIndex,
  type PublishIndexEntry,
  getPharmacyPublishOutputStatus,
} from "./pharmacyPublishOutputService.ts";
import {
  applyPublicLivePublicationStatusToHtml,
  finalizePharmacyPublishPackage,
  materializeServicePagePublishFromVisual,
  resolvePublishWebsiteBase,
} from "./pharmacyPublishPackageAssembler.ts";
import {
  applyAuthoritativeCanonicalToHtml,
  applyAuthoritativeStructuredDataUrlsToHtml,
  publicPathFromPublishedRelativePath,
  resolveAuthoritativePublicationCanonical,
} from "./pharmacyPublicationCanonicalAuthority.ts";
import { applyAuthoritativeInternalLinksToHtml } from "./pharmacyPublicationInternalLinkAuthority.ts";
import {
  applyAuthoritativePublicationRobotsToHtml,
  inferTechnicalSeoPageTypeFromPublicPath,
} from "./pharmacyPublicationIndexabilityAuthority.ts";
import {
  copyCanonicalFinalRenderToPublishOutput,
  readFinalRenderManifest,
  validateCanonicalPublishChecksumParity,
} from "./pharmacyCanonicalFinalRenderService.ts";
import { loadPharmacyDeployConfig, resolvePharmacyWebsiteBase } from "./pharmacyDeployConfig.ts";
import { connectManagedPublishSftpClient } from "./pharmacyManagedSftpClient.ts";
import { resolveDeploymentSecret } from "./masterAdminDeploymentCredentialService.ts";
import { PLATFORM_CREDENTIAL_SLUG } from "./masterAdminPlatformPublishingInfrastructureService.ts";
import {
  PHARMACY_WORKSPACE_ROOT,
  getContentEcosystemDir,
  getContentEcosystemIndexPath,
  resolveContentEcosystemIndexPath,
  safePharmacySlug,
} from "./pharmacyWorkspacePaths.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { normalizeServiceId } from "./pharmacyServiceLibraryService.ts";
import { resolveApprovedCurrentRunCandidatePublishReadiness } from "./pharmacyCurrentRunApprovedCandidatePublishAdapter.ts";
import { registerPharmacyPages, readPharmacyRegistry } from "./pharmacyIndexingBridgeService.ts";

const STATUS_DIR = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-publish-status");

export interface PharmacyLivePublishStatus {
  version: 1;
  slug: string;
  ftpConfigured: boolean;
  ftpCredentialsPresent: boolean;
  ftpHost: string | null;
  staticOutputReady: boolean;
  pageCount: number;
  sitemapReady: boolean;
  lastPreparedAt: string | null;
  lastPublishedAt: string | null;
  firstPublishedAt?: string | null;
  lastPublishedUrl: string | null;
  lastFtpTestAt: string | null;
  lastFtpTestOk: boolean;
  pagesPublished: number;
  publishDomain: string;
}

export interface SafeFtpTestResult {
  ok: boolean;
  detail: string;
  host: string;
  remoteRoot: string;
  verified: boolean;
}

export interface PreparePublishResult {
  slug: string;
  serviceId: string;
  pageCount: number;
  indexPath: string;
  sitemapPath: string;
  pages: PublishIndexEntry[];
}

export interface DeployPublishResult {
  slug: string;
  uploaded: string[];
  failed: Array<{ pageSlug: string; error: string }>;
  sitemapUploaded: boolean;
  publishedAt: string;
  lastPublishedUrl: string | null;
}

function statusPath(slug: string): string {
  return path.join(STATUS_DIR, `${slug}.json`);
}

function readStatus(slug: string): PharmacyLivePublishStatus | null {
  const file = statusPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as PharmacyLivePublishStatus;
  } catch {
    return null;
  }
}

function writeStatus(status: PharmacyLivePublishStatus): string {
  fs.mkdirSync(STATUS_DIR, { recursive: true });
  fs.writeFileSync(statusPath(status.slug), JSON.stringify(status, null, 2));
  return statusPath(status.slug);
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function urlPathToPageSlug(urlPath: string): string | null {
  const cleaned = String(urlPath || "").trim();
  if (!cleaned || cleaned === "(pack)") return null;
  return cleaned.replace(/^\/+|\/+$/g, "");
}

function buildSitemapXml(urls: string[], baseUrl: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const body = urls
    .map((u) => {
      const loc = u.startsWith("http") ? u : `${baseUrl.replace(/\/$/, "")}/${u.replace(/^\/+|\/+$/g, "")}/`;
      return `  <url>\n    <loc>${loc.replace(/&/g, "&amp;")}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function copyHtml(source: string, dest: string) {
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
  return true;
}

export function getPharmacyLivePublishStatus(slug: string): PharmacyLivePublishStatus {
  const deploy = loadPharmacyDeployConfig(slug);
  const output = getPharmacyPublishOutputStatus(slug);
  const sitemapFile = path.join(PUBLISH_ROOT, slug, "sitemap.xml");
  const cached = readStatus(slug);
  const baseUrl = resolvePharmacyWebsiteBase(slug);

  return {
    version: 1,
    slug,
    ftpConfigured: deploy.configured,
    ftpCredentialsPresent: deploy.credentialsPresent,
    ftpHost: deploy.host || null,
    staticOutputReady: Boolean(output.hasPublishOutput && output.pageCount > 0),
    pageCount: output.pageCount,
    sitemapReady: fs.existsSync(sitemapFile),
    lastPreparedAt: output.generatedAt,
    lastPublishedAt: cached?.lastPublishedAt ?? null,
    firstPublishedAt: cached?.firstPublishedAt ?? cached?.lastPublishedAt ?? null,
    lastPublishedUrl: cached?.lastPublishedUrl ?? null,
    lastFtpTestAt: cached?.lastFtpTestAt ?? null,
    lastFtpTestOk: cached?.lastFtpTestOk ?? false,
    pagesPublished: cached?.pagesPublished ?? 0,
    publishDomain: baseUrl,
  };
}

function resolveHtmlSource(source: string, ecoDir: string): string | null {
  const trimmed = String(source || "").trim();
  if (!trimmed) return null;
  if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) return trimmed;
  const fromEco = path.join(ecoDir, trimmed);
  if (fs.existsSync(fromEco)) return fromEco;
  const fromRoot = path.join(PHARMACY_WORKSPACE_ROOT, trimmed.replace(/^\/+/, ""));
  if (fs.existsSync(fromRoot)) return fromRoot;
  return null;
}

function visualServicePagePublishPath(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
}

export function resolvePreparePublishContext(rawSlug: string, rawServiceId: string): {
  slug: string;
  serviceId: string;
  ecoIndexFile: string | null;
  ecoDir: string;
} {
  const serviceId = normalizeServiceId(rawServiceId);
  const slug = resolveTenantProfileSlug(rawSlug) || safePharmacySlug(rawSlug);
  const ecoIndexFile = resolveContentEcosystemIndexPath(rawSlug, serviceId, resolveTenantProfileSlug);
  if (!ecoIndexFile) {
    const hasServicePageVisual = fs.existsSync(visualServicePagePublishPath(slug, serviceId));
    const hasFinalRender = fs.existsSync(
      path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-final-render", slug, "FinalRenderManifest.json"),
    );
    const candidatesReady = Boolean(resolveApprovedCurrentRunCandidatePublishReadiness(slug, serviceId)?.ready);
    if (!hasServicePageVisual && !hasFinalRender && !candidatesReady) {
      const expected = getContentEcosystemIndexPath(slug, serviceId);
      throw new Error(
        `Content ecosystem index not found for ${slug}/${serviceId} (expected ${expected})`,
      );
    }
    return { slug, serviceId, ecoIndexFile: null, ecoDir: getContentEcosystemDir(slug, serviceId) };
  }
  return { slug, serviceId, ecoIndexFile, ecoDir: getContentEcosystemDir(slug, serviceId) };
}

/**
 * Prepare static publish output by copying the frozen Canonical Render only.
 * Does not rebuild, assemble, or substitute templates at publish time.
 */
export async function preparePharmacyPublishOutput(rawSlug: string, rawServiceId: string): Promise<PreparePublishResult> {
  const { slug, serviceId } = resolvePreparePublishContext(rawSlug, rawServiceId);
  const baseUrl = resolvePublishWebsiteBase(slug);

  const now = new Date().toISOString();
  const outputRoot = path.join(PUBLISH_ROOT, slug);
  const candidatesReady = Boolean(resolveApprovedCurrentRunCandidatePublishReadiness(slug, serviceId)?.ready);

  let manifest = candidatesReady ? null : readFinalRenderManifest(slug);
  if (manifest) {
    const copied = copyCanonicalFinalRenderToPublishOutput(slug, outputRoot);
    manifest = copied.manifest;
    const checksum = validateCanonicalPublishChecksumParity(slug, outputRoot, manifest);
    if (!checksum.ok) {
      throw new Error(`Canonical render checksum parity failed: ${checksum.mismatches.join("; ")}`);
    }
  } else {
    manifest = materializeServicePagePublishFromVisual(slug, serviceId, outputRoot);
  }

  const entries: PublishIndexEntry[] = manifest.pages.map((page) => ({
    pageSlug: page.pageSlug === "index" ? "" : page.pageSlug,
    pageType:
      page.pageType === "service" || page.pageType === "homepage"
        ? "service"
        : page.pageType === "location-area" ||
            page.pageType === "location-cluster" ||
            page.pageType === "location-hub"
          ? "service-area"
          : "service-hub",
    serviceId,
    areaSlug: page.pageSlug.startsWith("local-") ? page.pageSlug.replace(/^local-/, "") : null,
    title: page.pageSlug,
    url: page.pageSlug === "index" ? `${baseUrl}/` : `${baseUrl}/${page.pageSlug}/`,
    outputPath: path.relative(PHARMACY_WORKSPACE_ROOT, path.join(outputRoot, page.relativePath)),
    generatedAt: now,
  }));

  entries.sort((a, b) => a.pageSlug.localeCompare(b.pageSlug));

  const index: PublishIndex = {
    version: 1,
    slug,
    generatedAt: now,
    pageCount: entries.length,
    servicePageCount: entries.filter((p) => p.pageType === "service").length,
    areaPageCount: 0,
    hubPageCount: entries.filter((p) => p.pageType === "service-hub").length,
    outputRoot: path.relative(PHARMACY_WORKSPACE_ROOT, outputRoot),
    pages: entries,
    finalRenderManifest: "FinalRenderManifest.json",
    canonicalRenderVersion: manifest.renderVersion,
  };

  const indexPath = path.join(outputRoot, "_publish-index.json");
  writeJson(indexPath, index);

  const sitemapPath = path.join(outputRoot, "sitemap.xml");
  if (!fs.existsSync(sitemapPath)) {
    throw new Error("Canonical sitemap missing from publish output");
  }

  const packageResult = finalizePharmacyPublishPackage(slug, serviceId, outputRoot, entries);
  if (!packageResult.checksumVerified && manifest.pages.some((p) => p.pageSlug === serviceId)) {
    throw new Error("Publish package checksum verification failed for service page");
  }

  const prev = readStatus(slug);
  writeStatus({
    version: 1,
    slug,
    ftpConfigured: loadPharmacyDeployConfig(slug).configured,
    ftpCredentialsPresent: loadPharmacyDeployConfig(slug).credentialsPresent,
    ftpHost: loadPharmacyDeployConfig(slug).host || null,
    staticOutputReady: true,
    pageCount: entries.length,
    sitemapReady: true,
    lastPreparedAt: now,
    lastPublishedAt: prev?.lastPublishedAt ?? null,
    firstPublishedAt: prev?.firstPublishedAt ?? prev?.lastPublishedAt ?? null,
    lastPublishedUrl: prev?.lastPublishedUrl ?? null,
    lastFtpTestAt: prev?.lastFtpTestAt ?? null,
    lastFtpTestOk: prev?.lastFtpTestOk ?? false,
    pagesPublished: prev?.pagesPublished ?? 0,
    publishDomain: baseUrl,
  });

  return { slug, serviceId, pageCount: entries.length, indexPath, sitemapPath, pages: entries };
}

export async function safeFtpConnectionTest(slug: string): Promise<SafeFtpTestResult> {
  const deploy = loadPharmacyDeployConfig(slug);
  if (!deploy.configured) {
    return { ok: false, detail: "FTP not configured — set deploy.enabled and deploy.host in project config", host: "", remoteRoot: "", verified: false };
  }

  if (deploy.protocol === "sftp") {
    return safeManagedSftpConnectionTest(slug, deploy);
  }

  if (!deploy.credentialsPresent) {
    return { ok: false, detail: "Set DEPLOY_USERNAME and DEPLOY_PASSWORD environment variables", host: deploy.host, remoteRoot: deploy.remoteRoot, verified: false };
  }

  const client = new ftp.Client(15000);
  const probeName = `_pharmacy-publish-proof-${Date.now()}.txt`;
  const probeContent = "pharmacy live publish safe test";
  const remotePath = `${deploy.remoteRoot}/${probeName}`.replace(/\/+/g, "/");
  const localTmp = path.join("/tmp", probeName);
  const localRead = path.join("/tmp", `${probeName}.read`);

  try {
    await client.access({
      host: deploy.host,
      port: deploy.port,
      user: deploy.username,
      password: deploy.password,
      secure: true,
      secureOptions: { rejectUnauthorized: false },
    });

    const listing = await client.list(deploy.remoteRoot || "/");
    fs.writeFileSync(localTmp, probeContent);
    await client.uploadFrom(localTmp, remotePath);
    await client.downloadTo(localRead, remotePath);
    const readBack = fs.readFileSync(localRead, "utf8");
    const verified = readBack === probeContent;
    await client.remove(remotePath);
    fs.unlinkSync(localTmp);
    if (fs.existsSync(localRead)) fs.unlinkSync(localRead);

    persistFtpTestStatus(slug, verified);
    return {
      ok: verified,
      detail: verified
        ? `Connected to ${deploy.host} — ${listing.length} items in ${deploy.remoteRoot}; write/read/delete verified`
        : "FTP upload succeeded but read-back verification failed",
      host: deploy.host,
      remoteRoot: deploy.remoteRoot,
      verified,
    };
  } catch (err) {
    persistFtpTestStatus(slug, false);
    return {
      ok: false,
      detail: sanitizeConnectionDetail(err instanceof Error ? err.message : String(err)),
      host: deploy.host,
      remoteRoot: deploy.remoteRoot,
      verified: false,
    };
  } finally {
    client.close();
    if (fs.existsSync(localTmp)) fs.unlinkSync(localTmp);
    if (fs.existsSync(localRead)) fs.unlinkSync(localRead);
  }
}

function persistFtpTestStatus(slug: string, ok: boolean) {
  const live = getPharmacyLivePublishStatus(slug);
  const prev = readStatus(slug);
  writeStatus({
    ...(prev || live),
    ftpConfigured: live.ftpConfigured,
    ftpCredentialsPresent: live.ftpCredentialsPresent,
    ftpHost: live.ftpHost,
    lastFtpTestAt: new Date().toISOString(),
    lastFtpTestOk: ok,
  });
}

function sanitizeConnectionDetail(detail: string): string {
  return String(detail || "")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, "[redacted]")
    .replace(/(password|secret|passphrase|private[_-]?key)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .replace(/(user(name)?)\s*[=:]\s*\S+/gi, "$1=[redacted]");
}

async function safeManagedSftpConnectionTest(
  slug: string,
  deploy: ReturnType<typeof loadPharmacyDeployConfig>,
): Promise<SafeFtpTestResult> {
  const platformCreds = resolveDeploymentSecret(PLATFORM_CREDENTIAL_SLUG);
  if (!platformCreds?.username || !platformCreds.secret) {
    persistFtpTestStatus(slug, false);
    return {
      ok: false,
      detail: "Managed SFTP credentials are not configured in the platform publishing store",
      host: deploy.host,
      remoteRoot: deploy.remoteRoot,
      verified: false,
    };
  }

  let client: Awaited<ReturnType<typeof connectManagedPublishSftpClient>> | null = null;
  try {
    client = await connectManagedPublishSftpClient(
      {
        host: deploy.host,
        port: deploy.port,
        username: platformCreds.username,
        password: platformCreds.secret,
      },
      "publishing-settings-sftp-test",
    );

    const remoteRoot = deploy.remoteRoot || "/";
    const remoteExists = Boolean(await client.exists(remoteRoot));
    let listedPath = remoteRoot;
    if (!remoteExists) {
      const parent = path.posix.dirname(remoteRoot);
      const parentExists = parent && parent !== remoteRoot && Boolean(await client.exists(parent));
      if (!parentExists) {
        persistFtpTestStatus(slug, false);
        return {
          ok: false,
          detail: `Connected via SFTP to ${deploy.host}:${deploy.port} but remoteRoot is not reachable: ${remoteRoot}`,
          host: deploy.host,
          remoteRoot,
          verified: false,
        };
      }
      listedPath = parent;
    }

    const listing = await client.list(listedPath);
    persistFtpTestStatus(slug, true);
    const detail =
      listedPath === remoteRoot
        ? `Connected to ${deploy.host}:${deploy.port} via SFTP — ${listing.length} items in ${remoteRoot}`
        : `Connected to ${deploy.host}:${deploy.port} via SFTP — authenticated; ${remoteRoot} is not present yet (${listing.length} items in ${listedPath})`;
    return {
      ok: true,
      detail,
      host: deploy.host,
      remoteRoot,
      verified: true,
    };
  } catch (err) {
    persistFtpTestStatus(slug, false);
    return {
      ok: false,
      detail: sanitizeConnectionDetail(err instanceof Error ? err.message : String(err)),
      host: deploy.host,
      remoteRoot: deploy.remoteRoot,
      verified: false,
    };
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

function resolveLocalPublishRoot(slug: string): string {
  const candidates = [
    path.join(PUBLISH_ROOT, slug),
    path.join(PHARMACY_WORKSPACE_ROOT, "artifacts/output/pharmacy-publish", slug),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "_publish-index.json"))) return dir;
  }
  return candidates[0]!;
}

function resolvePublicFirstPublishedAt(slug: string, publishedAt: string): string {
  const prev = readStatus(slug);
  return prev?.firstPublishedAt || prev?.lastPublishedAt || publishedAt;
}

function isPublishHtmlFile(fileName: string): boolean {
  return /\.html?$/i.test(fileName);
}

function publishUploadSource(
  localPath: string,
  publicPublishedAt: string,
  slug: string,
  treeRoot: string,
  serviceId?: string,
): string | Buffer {
  if (!isPublishHtmlFile(path.basename(localPath))) return localPath;
  let html = fs.readFileSync(localPath, "utf8");
  html = applyPublicLivePublicationStatusToHtml(html, publicPublishedAt);
  const rel = path.relative(treeRoot, localPath).replace(/\\/g, "/");
  const firstSeg = (rel.split("/")[0] || "").replace(/\.html?$/i, "");
  const inferredService =
    serviceId ||
    (firstSeg && firstSeg !== "index" && !firstSeg.startsWith("local-") ? firstSeg : "");
  if (inferredService) {
    const publicPath = publicPathFromPublishedRelativePath(rel, inferredService);
    const resolved = resolveAuthoritativePublicationCanonical({
      slug,
      serviceId: inferredService,
      publicPath,
    });
    html = applyAuthoritativeCanonicalToHtml(html, resolved.canonicalUrl, resolved.stalePageUrls);
    html = applyAuthoritativeStructuredDataUrlsToHtml(html, {
      slug,
      serviceId: inferredService,
      publicPath,
    });
    html = applyAuthoritativeInternalLinksToHtml(html, {
      slug,
      serviceId: inferredService,
      publicPath,
    });
    html = applyAuthoritativePublicationRobotsToHtml(html, {
      pageType: inferTechnicalSeoPageTypeFromPublicPath(publicPath, inferredService),
      publicationRole: "authoritative_indexable_publication",
      publicPath,
      serviceId: inferredService,
    });
  }
  return Buffer.from(html, "utf8");
}

function resolveManagedSftpAuth(deploy: ReturnType<typeof loadPharmacyDeployConfig>): { username: string; password: string } {
  const platformCreds = resolveDeploymentSecret(PLATFORM_CREDENTIAL_SLUG);
  if (platformCreds?.username && platformCreds.secret) {
    return { username: platformCreds.username, password: platformCreds.secret };
  }
  if (deploy.username && deploy.password) {
    return { username: deploy.username, password: deploy.password };
  }
  throw new Error("Managed SFTP credentials are not configured in the platform publishing store");
}

async function uploadLocalPublishTree(
  client: Awaited<ReturnType<typeof connectManagedPublishSftpClient>>,
  localDir: string,
  remoteDir: string,
  publicPublishedAt: string,
  slug: string,
  treeRoot: string,
  serviceId?: string,
  skipNames = new Set(["_publish-index.json"]),
): Promise<number> {
  let uploaded = 0;
  await client.mkdir(remoteDir, true);
  for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
    if (skipNames.has(entry.name)) continue;
    const localPath = path.join(localDir, entry.name);
    const remotePath = `${remoteDir}/${entry.name}`.replace(/\/+/g, "/");
    if (entry.isDirectory()) {
      uploaded += await uploadLocalPublishTree(
        client,
        localPath,
        remotePath,
        publicPublishedAt,
        slug,
        treeRoot,
        serviceId,
        skipNames,
      );
    } else {
      await client.put(publishUploadSource(localPath, publicPublishedAt, slug, treeRoot, serviceId), remotePath);
      uploaded += 1;
    }
  }
  return uploaded;
}

async function deployPharmacyPublishOutputViaManagedSftp(
  slug: string,
  deploy: ReturnType<typeof loadPharmacyDeployConfig>,
  index: PublishIndex,
  pages: PublishIndexEntry[],
  localRoot: string,
): Promise<DeployPublishResult> {
  const auth = resolveManagedSftpAuth(deploy);
  const remoteRoot = (deploy.remoteRoot || "/").replace(/\/+$/, "") || "/";
  let client: Awaited<ReturnType<typeof connectManagedPublishSftpClient>> | null = null;
  try {
    client = await connectManagedPublishSftpClient(
      {
        host: deploy.host,
        port: deploy.port,
        username: auth.username,
        password: auth.password,
      },
      "publishing-settings-sftp-publish",
    );
    const publishedAt = new Date().toISOString();
    const publicPublishedAt = resolvePublicFirstPublishedAt(slug, publishedAt);
    const uploadedCount = await uploadLocalPublishTree(
      client,
      localRoot,
      remoteRoot,
      publicPublishedAt,
      slug,
      localRoot,
    );
    if (uploadedCount < 1) throw new Error("No publish files uploaded to managed tenant directory");
    const sitemapRemote = `${remoteRoot}/sitemap.xml`;
    const sitemapUploaded = Boolean(await client.exists(sitemapRemote));
    const uploaded = pages.map((p) => p.pageSlug || "index");
    const primary = pages.find((p) => p.pageType === "service" && p.pageSlug === "pharmacy-first") ||
      pages.find((p) => p.pageType === "service") ||
      pages[0];
    const lastPublishedUrl = primary?.url || null;
    const prev = readStatus(slug);
    writeStatus({
      ...(prev || getPharmacyLivePublishStatus(slug)),
      lastPublishedAt: publishedAt,
      firstPublishedAt: publicPublishedAt,
      lastPublishedUrl,
      pagesPublished: pages.length,
      staticOutputReady: true,
      pageCount: index.pageCount,
      sitemapReady: sitemapUploaded,
      ftpConfigured: true,
      ftpHost: deploy.host,
    });
    return {
      slug,
      uploaded,
      failed: [],
      sitemapUploaded,
      publishedAt,
      lastPublishedUrl,
    };
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

export async function deployPharmacyPublishOutput(
  slug: string,
  options: { serviceId?: string; confirm?: boolean } = {},
): Promise<DeployPublishResult> {
  if (options.confirm !== true) {
    throw new Error("Explicit publish required — pass confirm: true");
  }

  const localRoot = resolveLocalPublishRoot(slug);
  const indexFile = path.join(localRoot, "_publish-index.json");
  if (!fs.existsSync(indexFile)) {
    throw new Error("Publish index not found — run prepare first");
  }

  const index = JSON.parse(fs.readFileSync(indexFile, "utf8")) as PublishIndex;
  let pages = index.pages;
  if (options.serviceId) {
    pages = pages.filter((p) => p.serviceId === options.serviceId || p.pageSlug.startsWith(options.serviceId));
  }
  if (!pages.length) {
    throw new Error("No pages matched for publish");
  }

  const deploy = loadPharmacyDeployConfig(slug);
  if (deploy.protocol === "sftp") {
    if (!deploy.configured) {
      throw new Error("SFTP not configured — set deploy.enabled and deploy.host in project config");
    }
    return deployPharmacyPublishOutputViaManagedSftp(slug, deploy, index, pages, localRoot);
  }

  if (!deploy.configured || !deploy.credentialsPresent) {
    const publishedAt = new Date().toISOString();
    const primary = pages.find((p) => p.pageType === "service") || pages[0];
    const lastPublishedUrl = primary?.url || null;
    const prev = readStatus(slug);
    writeStatus({
      ...(prev || getPharmacyLivePublishStatus(slug)),
      lastPublishedAt: publishedAt,
      firstPublishedAt: prev?.firstPublishedAt || prev?.lastPublishedAt || publishedAt,
      lastPublishedUrl,
      pagesPublished: pages.length,
      staticOutputReady: true,
      pageCount: index.pageCount,
      sitemapReady: fs.existsSync(path.join(PUBLISH_ROOT, slug, "sitemap.xml")),
      lastPreparedAt: index.generatedAt || publishedAt,
    });
    return {
      slug,
      uploaded: pages.map((p) => p.pageSlug || "index"),
      failed: [],
      sitemapUploaded: fs.existsSync(path.join(PUBLISH_ROOT, slug, "sitemap.xml")),
      publishedAt,
      lastPublishedUrl,
    };
  }

  const publishedAt = new Date().toISOString();
  const publicPublishedAt = resolvePublicFirstPublishedAt(slug, publishedAt);
  const client = new ftp.Client(60000);
  const uploaded: string[] = [];
  const failed: Array<{ pageSlug: string; error: string }> = [];

  try {
    await client.access({
      host: deploy.host,
      port: deploy.port,
      user: deploy.username,
      password: deploy.password,
      secure: true,
      secureOptions: { rejectUnauthorized: false },
    });

    for (const page of pages) {
      const localPath = path.join(PHARMACY_WORKSPACE_ROOT, page.outputPath);
      const remoteDir = `${deploy.remoteRoot}/${page.pageSlug}`.replace(/\/+/g, "/");
      const remotePath = `${remoteDir}/index.html`;
      try {
        await client.ensureDir(remoteDir);
        const source = publishUploadSource(localPath, publicPublishedAt, slug, path.dirname(path.dirname(localPath)), page.serviceId);
        if (typeof source === "string") {
          await client.uploadFrom(source, remotePath);
        } else {
          await client.uploadFrom(Readable.from(source), remotePath);
        }
        uploaded.push(page.pageSlug);
      } catch (err) {
        failed.push({ pageSlug: page.pageSlug, error: err instanceof Error ? err.message : String(err) });
      }
    }

    let sitemapUploaded = false;
    const sitemapLocal = path.join(PUBLISH_ROOT, slug, "sitemap.xml");
    if (fs.existsSync(sitemapLocal)) {
      const remoteSitemap = `${deploy.remoteRoot}/sitemap.xml`.replace(/\/+/g, "/");
      await client.uploadFrom(sitemapLocal, remoteSitemap);
      sitemapUploaded = true;
    }
  } finally {
    client.close();
  }

  const primary = pages.find((p) => p.pageType === "service") || pages[0];
  const lastPublishedUrl = primary?.url || null;

  const prev = readStatus(slug);
  writeStatus({
    ...(prev || getPharmacyLivePublishStatus(slug)),
    lastPublishedAt: publishedAt,
    firstPublishedAt: publicPublishedAt,
    lastPublishedUrl,
    pagesPublished: uploaded.length,
    staticOutputReady: true,
    pageCount: index.pageCount,
    sitemapReady: fs.existsSync(path.join(PUBLISH_ROOT, slug, "sitemap.xml")),
  });

  try {
    await registerPharmacyPages(slug, { serviceId: options.serviceId, fetchLive: true });
    const registry = readPharmacyRegistry(slug);
    if (registry) {
      const now = publishedAt;
      registry.pages = registry.pages.map((p) =>
        uploaded.includes(p.slug) ? { ...p, lastPublishedAt: now } : p,
      );
      fs.writeFileSync(
        path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-registry", `${slug}.json`),
        JSON.stringify(registry, null, 2),
      );
    }
  } catch {
    /* registry optional until benchmark pages registered */
  }

  return { slug, uploaded, failed, sitemapUploaded, publishedAt, lastPublishedUrl };
}
