/**
 * RC1 local location generation — cluster pages only (one per approved area).
 */
import fs from "node:fs";
import path from "node:path";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { EcosystemAsset, GenerationStamp, LocalClusterLinkEntry } from "./benchmarkServiceEcosystemBuilder.ts";
import { getEcosystemRoot } from "./contentEngine/contentEnginePaths.ts";
import {
  hierarchyToContentGenerationAreas,
  resolveLocalLocationHierarchy,
  type LocalLocationHierarchy,
} from "./pharmacyLocalAreaResolver.ts";
import {
  renderLocalLocationClusterFullPage,
} from "./pharmacyLocalHierarchyFullPageRenderer.ts";

export interface LocalLocationGenerationResult {
  ok: boolean;
  blockedReason?: string;
  hierarchy: LocalLocationHierarchy;
  assets: EcosystemAsset[];
  localClusterEntries: LocalClusterLinkEntry[];
  hubPath?: string;
  clusterPaths: string[];
  areaPaths: string[];
}

function countWords(html: string): number {
  return html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
}

export function generateLocalLocationHierarchyPages(ctx: ContentGenerationContext): LocalLocationGenerationResult {
  const hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
  if (!hierarchy.ok) {
    return {
      ok: false,
      blockedReason: hierarchy.blockedReason,
      hierarchy,
      assets: [],
      localClusterEntries: [],
      clusterPaths: [],
      areaPaths: [],
    };
  }

  const ecosystemRoot = ctx.links.ecosystemRoot;
  const generatedAt = new Date().toISOString();
  const generationStamp: GenerationStamp = {
    tenantSlug: ctx.resolvedSlug,
    campaignId: ctx.serviceId,
    generatedAt,
    sourceContext: "customer-imported-profile",
  };

  const assets: EcosystemAsset[] = [];
  const localClusterEntries: LocalClusterLinkEntry[] = [];
  const clusterPaths: string[] = [];
  const areaPaths: string[] = [];

  const writeLocal = (relPath: string, html: string): string => {
    const outPath = path.join(ecosystemRoot, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    return outPath;
  };

  for (const cluster of hierarchy.clusters) {
    const html = renderLocalLocationClusterFullPage(ctx, hierarchy, cluster);
    const rel = `local/${cluster.slug}/index.html`;
    const out = writeLocal(rel, html);
    clusterPaths.push(out);
    localClusterEntries.push({
      areaName: cluster.name,
      areaSlug: cluster.slug,
      urlPath: `/local/${cluster.slug}/`,
      outputPath: path.relative(ecosystemRoot, out),
      nearbyAreas: hierarchy.clusters
        .filter((c) => c.areaId !== cluster.areaId)
        .map((c) => ({
          areaName: c.name,
          areaSlug: c.slug,
          urlPath: `/local/${c.slug}/`,
        })),
    });
    assets.push({
      id: `local-cluster-${cluster.slug}`,
      type: "Cluster page",
      urlPath: `/local/${cluster.slug}/`,
      outputPath: out,
      sourceSections: ["local-location-cluster", cluster.name, "rc1-cluster-page"],
      wordCount: countWords(html),
    });
  }

  const linkMap = {
    slug: ctx.resolvedSlug,
    serviceId: ctx.serviceId,
    mainServiceUrlPath: ctx.serviceMeta.urlPath,
    serviceHubUrlPath: ctx.serviceMeta.urlPath,
    localClusterPages: localClusterEntries,
    localLocationClusters: hierarchy.clusters.map((c) => ({
      areaName: c.name,
      areaSlug: c.slug,
      urlPath: `/local/${c.slug}/`,
      outputPath: `local/${c.slug}/index.html`,
    })),
    localLocationHierarchy: hierarchy,
    architecture: "rc1-cluster-page-v1",
    generatedAt,
    generationStamp,
  };

  fs.mkdirSync(ecosystemRoot, { recursive: true });
  fs.writeFileSync(path.join(ecosystemRoot, "_internal-link-map.json"), JSON.stringify(linkMap, null, 2), "utf8");

  return {
    ok: true,
    hierarchy,
    assets,
    localClusterEntries,
    clusterPaths,
    areaPaths,
  };
}

/** Regenerate location hub + cluster HTML only — does not rewrite area pages. */
export function regenerateLocalHubAndClusterPagesOnly(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
): Pick<
  LocalLocationGenerationResult,
  "ok" | "hierarchy" | "assets" | "hubPath" | "clusterPaths"
> {
  const ecosystemRoot = ctx.links.ecosystemRoot;
  const assets: EcosystemAsset[] = [];
  const clusterPaths: string[] = [];

  const writeLocal = (relPath: string, html: string): string => {
    const outPath = path.join(ecosystemRoot, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    return outPath;
  };

  const hubHtml = renderLocalLocationHubFullPage(ctx, hierarchy);
  const hubOut = writeLocal("local/hub/index.html", hubHtml);
  assets.push({
    id: "local-location-hub",
    type: "Location hub",
    urlPath: "/local/hub/",
    outputPath: hubOut,
    sourceSections: ["local-location-hub", "local-hub-v1"],
    wordCount: countWords(hubHtml),
  });

  for (const cluster of hierarchy.clusters) {
    const html = renderLocalLocationClusterFullPage(ctx, hierarchy, cluster);
    const rel = `local/${cluster.slug}/index.html`;
    const out = writeLocal(rel, html);
    clusterPaths.push(out);
    assets.push({
      id: `local-cluster-${cluster.slug}`,
      type: "Location cluster",
      urlPath: `/local/${cluster.slug}/`,
      outputPath: out,
      sourceSections: ["local-location-cluster", cluster.name, "local-cluster-v1"],
      wordCount: countWords(html),
    });
  }

  return { ok: true, hierarchy, assets, hubPath: hubOut, clusterPaths };
}

/** Regenerate location area HTML only — preserves hub/cluster ecosystem files. */
export function regenerateLocalAreaPagesOnly(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  options?: { onlyAreaSlugs?: string[] },
): Pick<LocalLocationGenerationResult, "ok" | "hierarchy" | "assets" | "areaPaths"> {
  const ecosystemRoot = ctx.links.ecosystemRoot;
  const assets: EcosystemAsset[] = [];
  const areaPaths: string[] = [];
  const localClusterEntries: LocalClusterLinkEntry[] = [];

  const writeLocal = (relPath: string, html: string): string => {
    const outPath = path.join(ecosystemRoot, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    return outPath;
  };

  for (const area of hierarchy.areas) {
    if (options?.onlyAreaSlugs?.length && !options.onlyAreaSlugs.includes(area.slug)) {
      continue;
    }
    const scopedCtx = scopeContentGenerationContextForArea(ctx, area.name);
    const nearby = hierarchy.areas
      .filter((a) => a.areaId !== area.areaId)
      .map((a) => ({
        areaName: a.name,
        areaSlug: a.slug,
        urlPath: `/local/${a.slug}/`,
      }));
    const html = renderLocalLocationAreaFullPage(scopedCtx, hierarchy, area);
    const rel = `local/${area.slug}/index.html`;
    const out = writeLocal(rel, html);
    areaPaths.push(out);
    localClusterEntries.push({
      areaName: area.name,
      areaSlug: area.slug,
      urlPath: `/local/${area.slug}/`,
      outputPath: path.relative(ecosystemRoot, out),
      nearbyAreas: nearby,
    });
    assets.push({
      id: `local-area-${area.slug}`,
      type: "Location area page",
      urlPath: `/local/${area.slug}/`,
      outputPath: out,
      sourceSections: ["local-location-area", area.name, "local-area-v1"],
      wordCount: countWords(html),
    });
  }

  const linkMapPath = path.join(ecosystemRoot, "_internal-link-map.json");
  if (fs.existsSync(linkMapPath)) {
    try {
      const linkMap = JSON.parse(fs.readFileSync(linkMapPath, "utf8")) as Record<string, unknown>;
      fs.writeFileSync(
        linkMapPath,
        JSON.stringify({ ...linkMap, localClusterPages: localClusterEntries }, null, 2),
        "utf8",
      );
    } catch {
      /* preserve map if malformed */
    }
  }

  return { ok: true, hierarchy, assets, areaPaths };
}

export function mergeLocalHubClusterAssetsIntoEcosystemIndex(
  slug: string,
  serviceId: string,
  hubClusterAssets: EcosystemAsset[],
  hierarchy: LocalLocationHierarchy,
): void {
  const ecosystemRoot = getEcosystemRoot(serviceId, slug);
  const indexPath = path.join(ecosystemRoot, "_ecosystem-index.json");
  const existing = fs.existsSync(indexPath)
    ? (JSON.parse(fs.readFileSync(indexPath, "utf8")) as Record<string, unknown>)
    : { version: 1, serviceId, slug, assets: [] as EcosystemAsset[] };

  const assets = (existing.assets as EcosystemAsset[]) || [];
  const kept = assets.filter(
    (a) =>
      a.id !== "local-location-hub" &&
      !a.id.startsWith("local-cluster-") &&
      a.type !== "Location cluster" &&
      a.type !== "Location hub",
  );
  const merged = [...kept, ...hubClusterAssets];

  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        ...existing,
        localLocationHubGenerated: true,
        localLocationClustersGenerated: hierarchy.clusters.length,
        localLocationHierarchy: hierarchy,
        generatedAt: new Date().toISOString(),
        assets: merged,
      },
      null,
      2,
    ),
    "utf8",
  );
}

export function mergeLocalAssetsIntoEcosystemIndex(
  slug: string,
  serviceId: string,
  localResult: LocalLocationGenerationResult,
): void {
  if (!localResult.ok) return;
  const ecosystemRoot = getEcosystemRoot(serviceId, slug);
  const indexPath = path.join(ecosystemRoot, "_ecosystem-index.json");
  const existing = fs.existsSync(indexPath)
    ? (JSON.parse(fs.readFileSync(indexPath, "utf8")) as Record<string, unknown>)
    : { version: 1, serviceId, slug, assets: [] as EcosystemAsset[] };

  const assets = (existing.assets as EcosystemAsset[]) || [];
  const withoutLocal = assets.filter(
    (a) =>
      !a.id.startsWith("local-cluster-") &&
      !a.id.startsWith("local-area-") &&
      a.id !== "local-location-hub" &&
      a.type !== "Local cluster page",
  );
  const merged = [...withoutLocal, ...localResult.assets];
  const selectedAreas = hierarchyToContentGenerationAreas(localResult.hierarchy).map((a) => a.areaName);

  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        ...existing,
        selectedAreas,
        localClusterPagesGenerated: localResult.localClusterEntries.length,
        localLocationHubGenerated: true,
        localLocationClustersGenerated: localResult.hierarchy.clusters.length,
        localLocationAreasGenerated: localResult.hierarchy.areas.length,
        localLocationHierarchy: localResult.hierarchy,
        generatedAt: new Date().toISOString(),
        assets: merged,
        internalLinkMap: JSON.parse(fs.readFileSync(path.join(ecosystemRoot, "_internal-link-map.json"), "utf8")),
      },
      null,
      2,
    ),
    "utf8",
  );
}

export function canonicalPageSlugForLocalUrlPath(urlPath: string): string {
  const cleaned = urlPath.replace(/^\/+|\/+$/g, "");
  if (cleaned === "local/hub") return "local-hub";
  const parts = cleaned.split("/").filter(Boolean);
  if (parts[0] === "local" && parts[1]?.startsWith("cluster-")) return `local-${parts[1]}`;
  if (parts[0] === "local" && parts[1]) return `local-${parts[1]}`;
  return cleaned.replace(/\//g, "-");
}
