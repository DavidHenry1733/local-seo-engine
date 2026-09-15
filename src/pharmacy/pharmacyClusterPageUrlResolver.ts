/**
 * RC1 Cluster Page URL contract — single idempotent resolver for all cluster paths.
 */
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";

export const CLUSTER_PAGE_TYPE = "cluster-page";
/** Legacy prefix retained for normalisation only — public paths use bare area slugs. */
export const CLUSTER_PATH_PREFIX = "cluster-";

export function normalizeClusterAreaSlug(input: string): string {
  let slug = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
  if (!slug) return "";
  if (slug.startsWith("local/")) {
    slug = slug.slice("local/".length);
  }
  while (slug.startsWith(CLUSTER_PATH_PREFIX)) {
    slug = slug.slice(CLUSTER_PATH_PREFIX.length);
  }
  if (!slug) return "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return slugifyArea(slug);
  }
  return slug;
}

/** Idempotent public slug: ecclesall | cluster-ecclesall → ecclesall (no public "cluster" token). */
export function resolveClusterPageSlug(input: string): string {
  return normalizeClusterAreaSlug(input);
}

export function resolveClusterPageUrlPath(input: string): string {
  const pageSlug = resolveClusterPageSlug(input);
  return pageSlug ? `/local/${pageSlug}/` : "";
}

export function resolveClusterPageFilesystemSegment(input: string): string {
  return resolveClusterPageSlug(input);
}

export function resolveClusterPageFilesystemRelativePath(input: string): string {
  const pageSlug = resolveClusterPageSlug(input);
  return pageSlug ? `local/${pageSlug}/index.html` : "";
}

export function resolveClusterPagePreviewApiPath(
  tenantSlug: string,
  serviceId: string,
  input: string,
): string {
  const pageSlug = resolveClusterPageSlug(input);
  const cleaned = String(tenantSlug || "").trim();
  const slugQ = cleaned ? `?slug=${encodeURIComponent(cleaned)}` : "";
  return `/api/pharmacy-content-ecosystem-preview/${encodeURIComponent(serviceId)}/local/${encodeURIComponent(pageSlug)}/${slugQ}`;
}

/** Shared locality-review / ecosystem-preview URL builder. Always carries tenant slug when supplied. */
export function buildContentEcosystemLocalPreviewUrl(
  serviceId: string,
  areaSlug: string,
  tenantSlug?: string | null,
): string {
  return resolveClusterPagePreviewApiPath(String(tenantSlug || ""), serviceId, areaSlug);
}

export function resolveClusterPageCanonicalFinalRenderSlug(input: string): string {
  const urlPath = resolveClusterPageUrlPath(input);
  return urlPath.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
}

export function isLegacyClusterFilesystemSegment(segment: string): boolean {
  const seg = String(segment || "").trim().toLowerCase();
  if (!seg) return false;
  const canonical = resolveClusterPageSlug(seg);
  if (seg === canonical) return false;
  if (seg.startsWith(`${CLUSTER_PATH_PREFIX}${CLUSTER_PATH_PREFIX}`)) return true;
  const bare = normalizeClusterAreaSlug(seg);
  return bare === seg;
}

export function isLegacyClusterUrlPath(urlPath: string): boolean {
  const cleaned = String(urlPath || "").trim();
  if (!cleaned.startsWith("/local/")) return false;
  const segment = cleaned.replace(/^\/local\/|\/+$/g, "");
  return isLegacyClusterFilesystemSegment(segment);
}

export function countLegacyClusterReferencesInHtml(html: string): number {
  return (html.match(/cluster-cluster-/g) || []).length;
}

const AUTHORISED_OUTPUT_ARCHIVE_DIRS = new Set(["_legacy-non-canonical", "_audit"]);

export function isAuthorisedOutputArchiveDir(dirName: string): boolean {
  return AUTHORISED_OUTPUT_ARCHIVE_DIRS.has(dirName) || dirName.startsWith("_audit");
}

export function rewriteClusterLinksInHtml(html: string, approvedAreaSlugs: string[]): string {
  let out = html;
  for (const input of approvedAreaSlugs) {
    const bare = normalizeClusterAreaSlug(input);
    const canonical = resolveClusterPageSlug(bare);
    const canonicalPath = resolveClusterPageUrlPath(bare);
    const legacyPatterns = [
      `/local-cluster-${CLUSTER_PATH_PREFIX}${bare}/`,
      `/local-cluster-${CLUSTER_PATH_PREFIX}${bare}`,
      `/local-cluster-${bare}/`,
      `/local-cluster-${bare}`,
      `/local/cluster-${CLUSTER_PATH_PREFIX}${bare}/`,
      `/local/cluster-${CLUSTER_PATH_PREFIX}${bare}`,
      `/local/${CLUSTER_PATH_PREFIX}${bare}/`,
      `/local/${CLUSTER_PATH_PREFIX}${bare}`,
      `/local/${bare}/`,
      `/local/${bare}`,
      `/local/cluster-cluster-${bare}/`,
      `/local/cluster-cluster-${bare}`,
    ];
    for (const legacy of legacyPatterns) {
      if (legacy === canonicalPath || legacy === canonicalPath.replace(/\/$/, "")) continue;
      out = out.split(legacy).join(canonicalPath);
    }
    out = out.split(`data-local-cluster="${CLUSTER_PATH_PREFIX}${CLUSTER_PATH_PREFIX}${bare}"`).join(`data-local-cluster="${canonical}"`);
    out = out.split(`data-local-cluster="${CLUSTER_PATH_PREFIX}${bare}"`).join(`data-local-cluster="${canonical}"`);
    out = out.split(`data-local-cluster="${bare}"`).join(`data-local-cluster="${canonical}"`);
  }
  out = out.replace(/\/local-cluster-cluster-/g, "/local/cluster-");
  out = out.replace(/\/local\/cluster-cluster-/g, "/local/cluster-");
  return out;
}
