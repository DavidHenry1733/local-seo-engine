/**
 * Generic local page URL resolution — preview vs canonical public paths.
 */
import fs from "node:fs";
import path from "node:path";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { LocalLocationHierarchy } from "./pharmacyLocalAreaResolver.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import { canonicalPageSlugForLocalUrlPath } from "./pharmacyLocalLocationGenerationService.ts";
import { resolveClusterPageSlug, resolveClusterPageUrlPath } from "./pharmacyClusterPageUrlResolver.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import type { LocalAreaLink } from "./pharmacyServicePageTrustInjection.ts";

export type LocalPageTargetType = "location-hub" | "location-cluster" | "location-area" | "service";

export interface LocalPageTarget {
  pageType: LocalPageTargetType;
  localSegment: string;
  areaName?: string;
}

export function resolveLocalPagePublicPath(target: LocalPageTarget, serviceId: string): string {
  if (target.pageType === "service") {
    return `/${serviceId}/`;
  }
  if (target.pageType === "location-cluster") {
    return resolveClusterPageUrlPath(target.localSegment);
  }
  if (target.pageType === "location-hub") {
    return `/${String(serviceId || "").replace(/^\/+|\/+$/g, "") || "service"}/`;
  }
  const urlPath = `/local/${target.localSegment}/`;
  return `/${canonicalPageSlugForLocalUrlPath(urlPath)}/`;
}

export function resolveLocalPagePreviewPath(
  tenantSlug: string,
  serviceId: string,
  target: LocalPageTarget,
): string {
  const key = resolveTenantProfileSlug(tenantSlug) || tenantSlug;
  if (target.pageType === "service") {
    return `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(key)}`;
  }
  if (target.pageType === "location-hub") {
    return `/api/pharmacy-visual-experience/locations/?slug=${encodeURIComponent(key)}`;
  }
  const urlPath = `/local/${target.localSegment}/`;
  const pageSlug = canonicalPageSlugForLocalUrlPath(urlPath);
  return `/api/pharmacy-visual-experience/${encodeURIComponent(pageSlug)}/?slug=${encodeURIComponent(key)}`;
}

function loadInternalLinkMap(slug: string, serviceId: string) {
  const key = resolveTenantProfileSlug(slug) || slug;
  const mapPath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    key,
    serviceId,
    "_internal-link-map.json",
  );
  if (!fs.existsSync(mapPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(mapPath, "utf8")) as {
      localClusterPages?: Array<{ areaName?: string; areaSlug?: string; outputPath?: string }>;
    };
  } catch {
    return null;
  }
}

export function resolveLocalPageTargetForAreaName(
  areaName: string,
  ctx: ContentGenerationContext,
  hierarchy?: LocalLocationHierarchy,
): LocalPageTarget | null {
  const trimmed = areaName.trim();
  if (!trimmed) return null;

  if (hierarchy) {
    const cluster = hierarchy.clusters.find((c) => c.name === trimmed);
    if (cluster) {
      return { pageType: "location-cluster", localSegment: cluster.slug, areaName: trimmed };
    }
    const area = hierarchy.areas.find((a) => a.name === trimmed);
    if (area) {
      return { pageType: "location-area", localSegment: area.slug, areaName: trimmed };
    }
  }

  const map = loadInternalLinkMap(ctx.resolvedSlug, ctx.serviceId);
  const ecoRoot = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    resolveTenantProfileSlug(ctx.resolvedSlug) || ctx.resolvedSlug,
    ctx.serviceId,
  );
  const entry = map?.localClusterPages?.find(
    (p) =>
      p.areaName === trimmed &&
      p.areaSlug &&
      fs.existsSync(path.join(ecoRoot, p.outputPath || `local/${p.areaSlug}/index.html`)),
  );
  if (entry?.areaSlug) {
    const seg = entry.areaSlug;
    return {
      pageType: seg.startsWith("cluster-") ? "location-cluster" : "location-area",
      localSegment: seg,
      areaName: trimmed,
    };
  }

  const slug = slugifyArea(trimmed);
  if (
    fs.existsSync(
      path.join(ecoRoot, "local", slug, "index.html"),
    )
  ) {
    return {
      pageType: slug.startsWith("cluster-") ? "location-cluster" : "location-area",
      localSegment: slug,
      areaName: trimmed,
    };
  }
  return null;
}

function canonicalFinalRenderPageExists(resolvedSlug: string, target: LocalPageTarget): boolean {
  const key = resolveTenantProfileSlug(resolvedSlug) || resolvedSlug;
  const pageSlug =
    target.pageType === "location-hub"
      ? "local-hub"
      : canonicalPageSlugForLocalUrlPath(`/local/${target.localSegment}/`);
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-final-render", key, pageSlug, "index.html");
  return fs.existsSync(file);
}

function resolveCoverageAreaTarget(
  areaName: string,
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy | undefined,
): LocalPageTarget | null {
  const trimmed = areaName.trim();
  if (!trimmed) return null;

  const map = loadInternalLinkMap(ctx.resolvedSlug, ctx.serviceId);
  const ecoRoot = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    resolveTenantProfileSlug(ctx.resolvedSlug) || ctx.resolvedSlug,
    ctx.serviceId,
  );
  const fromMap = map?.localClusterPages?.find(
    (p) =>
      p.areaName === trimmed &&
      p.areaSlug &&
      fs.existsSync(path.join(ecoRoot, p.outputPath || `local/${p.areaSlug}/index.html`)),
  );
  if (fromMap?.areaSlug) {
    const seg = fromMap.areaSlug;
    return {
      pageType: seg.startsWith("cluster-") ? "location-cluster" : "location-area",
      localSegment: seg,
      areaName: trimmed,
    };
  }

  const fromHierarchy = resolveLocalPageTargetForAreaName(trimmed, ctx, hierarchy);
  if (fromHierarchy && canonicalFinalRenderPageExists(ctx.resolvedSlug, fromHierarchy)) {
    return fromHierarchy;
  }
  return null;
}

export function resolveTenantSupportedAreaLinks(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy | undefined,
  hrefMode: "public" | "preview",
): LocalAreaLink[] {
  const names = (
    ctx.rawProfile?.coverageAreas?.length ? ctx.rawProfile.coverageAreas : ctx.coverageAreas || []
  )
    .map(String)
    .map((n) => n.trim())
    .filter(Boolean);
  if (!names.length) {
    const fromSelected =
      ctx.rawProfile?.selectedAreas
        ?.filter((a) => a.selected !== false && String(a.areaName || "").trim())
        .map((a) => String(a.areaName).trim()) || [];
    names.push(...fromSelected);
  }

  const links: LocalAreaLink[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const target = resolveCoverageAreaTarget(name, ctx, hierarchy);
    if (!target || !canonicalFinalRenderPageExists(ctx.resolvedSlug, target)) {
      links.push({ areaName: name, href: "" });
      continue;
    }
    links.push({
      areaName: name,
      href:
        hrefMode === "preview"
          ? resolveLocalPagePreviewPath(ctx.resolvedSlug, ctx.serviceId, target)
          : resolveLocalPagePublicPath(target, ctx.serviceId),
    });
  }
  return links;
}

export function resolveLocalHubTarget(hierarchy: LocalLocationHierarchy): LocalPageTarget {
  return { pageType: "location-hub", localSegment: hierarchy.hub?.slug ?? "hub" };
}

export function resolveLocalClusterTarget(clusterSlug: string, clusterName?: string): LocalPageTarget {
  return {
    pageType: "location-cluster",
    localSegment: resolveClusterPageSlug(clusterSlug),
    areaName: clusterName,
  };
}

export function resolveLocalAreaTarget(areaSlug: string, areaName?: string): LocalPageTarget {
  return { pageType: "location-area", localSegment: areaSlug, areaName };
}

export function rewriteCanonicalHtmlLinksForAuthenticatedPreview(
  html: string,
  tenantSlug: string,
  serviceId: string,
): string {
  const key = resolveTenantProfileSlug(tenantSlug) || tenantSlug;
  let out = html;
  out = out.replace(
    /href="(\/(?:local-hub|local-cluster-[a-z0-9-]+|local-[a-z0-9-]+|pharmacy-first)\/?)"/gi,
    (_match, pathPart: string) => {
      const cleaned = pathPart.replace(/^\/+|\/+$/g, "");
      if (cleaned === serviceId) {
        return `href="/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(key)}"`;
      }
      return `href="/api/pharmacy-visual-experience/${encodeURIComponent(cleaned)}/?slug=${encodeURIComponent(key)}"`;
    },
  );
  out = out.replace(
    new RegExp(
      `/api/pharmacy-content-ecosystem-preview/${serviceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/local/([^/?"'\\s>]+)/[^"'\\s>]*`,
      "gi",
    ),
    (_m, segment: string) => {
      const pageSlug = canonicalPageSlugForLocalUrlPath(`/local/${segment}/`);
      return `/api/pharmacy-visual-experience/${encodeURIComponent(pageSlug)}/?slug=${encodeURIComponent(key)}`;
    },
  );
  return out;
}
