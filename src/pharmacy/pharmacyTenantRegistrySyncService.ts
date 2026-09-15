/**
 * CPR-REGISTRY-HOTFIX-01 — sync tenant pharmacy-registry from a completed published release.
 *
 * Source of truth: release FinalRenderManifest (campaign HTML pages).
 * Upserts into data/pharmacy-registry/{slug}.json by serviceId + pageSlug.
 * Preserves other campaigns/services. Does not rewrite sitemap, indexing, or deploy HTML.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { readManagedPublishingProfile } from "./masterAdminManagedPublishingService.ts";
import {
  readPharmacyRegistry,
  type PharmacyRegistry,
  type PharmacyRegistryPage,
  type PharmacyIndexingStatus,
} from "./pharmacyIndexingBridgeService.ts";
import { resolvePublishWebsiteBase } from "./pharmacyPublishPackageAssembler.ts";
import { canonicalUrlForIndexing, publicPathFromPublishedRelativePath } from "./pharmacyPublicationCanonicalAuthority.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";

function readLatestPublishSnapshot(slug: string): Record<string, unknown> | null {
  const file = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/commercial-publish",
    safeAdminSlug(slug),
    "latest.json",
  );
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface TenantRegistrySyncResult {
  slug: string;
  serviceId: string;
  campaignId: string | null;
  releaseId: string;
  upserted: number;
  serviceEntries: number;
  localityEntries: number;
  totalPages: number;
  registryPath: string;
}

function registryPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-registry", `${safeAdminSlug(slug)}.json`);
}

function sourceMasterFor(serviceId: string): string {
  const meta = getServicePublishMeta(serviceId);
  return meta ? `docs/pharmacy-master-library/${meta.masterFile}` : "";
}

function parseCampaignIdFromManifestRevision(revision: string | null | undefined): string | null {
  const raw = String(revision || "");
  // campaign-approved-content:{campaignId}:{serviceId}:{revision}:{count}
  const m = raw.match(/^campaign-approved-content:([^:]+):([^:]+):/);
  return m?.[1] || null;
}

function resolveReleaseManifestPath(slug: string, releaseId?: string): {
  releaseId: string;
  manifestPath: string;
} {
  const safe = safeAdminSlug(slug);
  const managed = readManagedPublishingProfile(safe);
  const resolvedRelease =
    String(releaseId || managed?.currentRelease || "").trim() ||
    String(readLatestPublishSnapshot(safe)?.releaseId || "").trim();
  if (!resolvedRelease) {
    throw new Error(`No published release found for tenant registry sync: ${safe}`);
  }

  const releaseDir =
    managed?.paths?.releaseDirectory ||
    path.join("/var/www/pharmaconnect-sites", safe, "releases");
  const manifestPath = path.join(releaseDir, resolvedRelease, "FinalRenderManifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Release FinalRenderManifest missing for ${safe}/${resolvedRelease}`);
  }
  return { releaseId: resolvedRelease, manifestPath };
}

function pageIdentityKey(serviceId: string, pageSlug: string): string {
  return `${serviceId}::${pageSlug}`;
}

function toRegistryPageType(pageType: string): string {
  if (pageType === "service") return "service";
  if (pageType === "location-area" || pageType === "location-cluster" || pageType === "location-hub") {
    return "service-area";
  }
  return pageType || "support";
}

/**
 * Upsert published campaign pages from a completed release into the tenant pharmacy registry.
 * Does not modify the release registry, sitemap, deployment, or indexing summary.
 */
export function syncTenantRegistryFromPublishedRelease(input: {
  slug: string;
  serviceId?: string;
  campaignId?: string;
  releaseId?: string;
  publishedAt?: string;
}): TenantRegistrySyncResult {
  const slug = safeAdminSlug(input.slug);
  const selection = readActiveServiceCampaignSelection(slug);
  const { releaseId, manifestPath } = resolveReleaseManifestPath(slug, input.releaseId);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    tenant?: string;
    serviceId?: string;
    contentManifestRevision?: string;
    pages?: Array<{
      pageSlug?: string;
      pageType?: string;
      relativePath?: string;
    }>;
  };

  const serviceId = String(
    input.serviceId || selection?.serviceId || manifest.serviceId || "",
  ).trim();
  if (!serviceId) throw new Error(`serviceId required for tenant registry sync: ${slug}`);

  const campaignId =
    String(input.campaignId || selection?.campaignId || "").trim() ||
    parseCampaignIdFromManifestRevision(manifest.contentManifestRevision);

  const baseUrl = resolvePublishWebsiteBase(slug).replace(/\/$/, "");
  const publishedAt = input.publishedAt || new Date().toISOString();
  const campaignPages = (manifest.pages || []).filter((p) => {
    const pageSlug = String(p.pageSlug || "").trim();
    const pageType = String(p.pageType || "").trim();
    if (!pageSlug || pageSlug === "index" || pageType === "homepage") return false;
    return pageType === "service" || pageType.startsWith("location-");
  });

  if (!campaignPages.length) {
    throw new Error(`No campaign HTML pages found in release manifest ${slug}/${releaseId}`);
  }

  const existing = readPharmacyRegistry(slug);
  const byKey = new Map<string, PharmacyRegistryPage>();
  for (const page of existing?.pages || []) {
    // Preserve other services/campaigns; replace matching serviceId+pageSlug identities.
    const inIncoming = campaignPages.some(
      (c) => c.pageSlug === page.slug && page.serviceId === serviceId,
    );
    if (!inIncoming) byKey.set(pageIdentityKey(page.serviceId, page.slug), page);
  }

  let upserted = 0;
  for (const page of campaignPages) {
    const pageSlug = String(page.pageSlug || "").trim();
    const key = pageIdentityKey(serviceId, pageSlug);
    const prev = (existing?.pages || []).find(
      (p) => p.serviceId === serviceId && p.slug === pageSlug,
    );
    const url = `${baseUrl}/${pageSlug}/`;
    const publicPath = publicPathFromPublishedRelativePath(
      page.relativePath || `${pageSlug}/index.html`,
      serviceId,
    );
    const canonicalUrl = canonicalUrlForIndexing({
      slug,
      serviceId,
      publicPath,
      storedCanonicalUrl: prev?.canonicalUrl,
    });
    const next: PharmacyRegistryPage = {
      slug: pageSlug,
      url,
      pageType: toRegistryPageType(String(page.pageType || "")),
      serviceId,
      sourceMaster: sourceMasterFor(serviceId),
      publishPath: page.relativePath || `${pageSlug}/index.html`,
      lastPublishedAt: publishedAt,
      indexingStatus: (prev?.indexingStatus || "ready_to_submit") as PharmacyIndexingStatus,
      submittedAt: prev?.submittedAt ?? null,
      indexedAt: prev?.indexedAt ?? null,
      lastCheckedAt: prev?.lastCheckedAt ?? null,
      canonicalUrl,
      campaignId: campaignId || null,
    };
    byKey.set(key, next);
    upserted += 1;
  }

  const pages = [...byKey.values()].sort((a, b) => {
    if (a.serviceId !== b.serviceId) return a.serviceId.localeCompare(b.serviceId);
    return a.slug.localeCompare(b.slug);
  });

  const registry: PharmacyRegistry = {
    version: 1,
    slug,
    generatedAt: publishedAt,
    pages,
  };

  const file = registryPath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(registry, null, 2));

  const servicePages = pages.filter((p) => p.serviceId === serviceId);
  return {
    slug,
    serviceId,
    campaignId,
    releaseId,
    upserted,
    serviceEntries: servicePages.filter((p) => p.pageType === "service").length,
    localityEntries: servicePages.filter((p) => p.pageType === "service-area").length,
    totalPages: pages.length,
    registryPath: file,
  };
}

/** Safe one-shot reconciliation for an already-completed release (no republish). */
export function reconcileTenantRegistryFromPublishedRelease(input: {
  slug: string;
  serviceId: string;
  campaignId: string;
  releaseId: string;
}): TenantRegistrySyncResult {
  const snapshot = readLatestPublishSnapshot(input.slug);
  return syncTenantRegistryFromPublishedRelease({
    ...input,
    publishedAt:
      (snapshot?.completedAt as string | undefined) ||
      (snapshot?.releaseVersion as string | undefined) ||
      undefined,
  });
}
