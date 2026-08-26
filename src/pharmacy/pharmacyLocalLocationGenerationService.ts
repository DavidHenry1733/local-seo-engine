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
  resolveClusterPageSlug,
  resolveClusterPageUrlPath,
  resolveClusterPageFilesystemRelativePath,
  rewriteClusterLinksInHtml,
} from "./pharmacyClusterPageUrlResolver.ts";
import {
  renderLocalLocationClusterFullPage,
  renderLocalLocationHubFullPage,
} from "./pharmacyLocalHierarchyFullPageRenderer.ts";
import { scrubPublicLocalEngineHtml } from "./pharmacyLocalClusterCompositionDedupe.ts";
import { polishCommercialClusterPublicHtml } from "./contentEngine/pharmacyCommercialNarrativePolishV1.ts";
import { scrubUnconfirmedServiceClaims } from "./pharmacyServicePagePublicationQuality.ts";
import {
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
} from "./contentEngine/pharmacyLocalityVariationSessionV1.ts";
import { evaluateLocalityHtmlDuplicationGate } from "./pharmacyLocalityPageDuplicationGateV1.ts";
import {
  evaluateLocalityPatientCopyQualityGate,
  localityIntroductionsAreDistinct,
} from "./contentEngine/pharmacyLocalityPatientCopyQualityGateV1.ts";

export interface LocalLocationGenerationResult {
  ok: boolean;
  blockedReason?: string;
  hierarchy: LocalLocationHierarchy;
  assets: EcosystemAsset[];
  localClusterEntries: LocalClusterLinkEntry[];
  hubPath?: string;
  clusterPaths: string[];
  areaPaths: string[];
  duplicationGate?: {
    ok: boolean;
    message: string;
  };
}

function countWords(html: string): number {
  return html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
}

function escAttr(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Embed the same generation stamp meta required by content-package handoff / Review Centre. */
function stampLocalHtmlOutput(html: string, stamp: GenerationStamp): string {
  const meta = [
    `<meta name="tenantSlug" content="${escAttr(stamp.tenantSlug)}"/>`,
    `<meta name="campaignId" content="${escAttr(stamp.campaignId)}"/>`,
    `<meta name="generatedAt" content="${escAttr(stamp.generatedAt)}"/>`,
    `<meta name="sourceContext" content="${escAttr(stamp.sourceContext)}"/>`,
  ].join("\n");
  if (/name="tenantSlug"/i.test(html) && /name="campaignId"/i.test(html) && /customer-imported-profile/.test(html)) {
    return html;
  }
  return html.replace(
    /<head>/i,
    `<head>\n${meta}\n<!-- tenantSlug: ${escAttr(stamp.tenantSlug)}; campaignId: ${escAttr(stamp.campaignId)}; generatedAt: ${escAttr(stamp.generatedAt)}; sourceContext: ${escAttr(stamp.sourceContext)} -->`,
  );
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
    fs.writeFileSync(outPath, stampLocalHtmlOutput(html, generationStamp), "utf8");
    return outPath;
  };

  const clusterSlugs = hierarchy.clusters.map((c) => resolveClusterPageSlug(c.slug));
  const generationRevision = `cpr-content-hotfix-04-${generatedAt}`;
  const session = beginLocalityVariationSessionV1(clusterSlugs);
  const pharmacyName = ctx.profile.pharmacyName;

  const renderClusterHtml = (cluster: (typeof hierarchy.clusters)[number]): string => {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    const siblingNames = hierarchy.clusters
      .filter((c) => c.slug !== cluster.slug)
      .map((c) => c.name);
    const delivery = (
      ctx.rawProfile as {
        serviceDeliveryProfiles?: Record<
          string,
          { fundingModel?: string | null; walkInAvailable?: boolean | null; appointmentRequired?: boolean | null }
        >;
      }
    )?.serviceDeliveryProfiles?.[ctx.serviceId];
    const polished = polishCommercialClusterPublicHtml(
      scrubPublicLocalEngineHtml(
        rewriteClusterLinksInHtml(
          renderLocalLocationClusterFullPage(ctx, hierarchy, { ...cluster, slug: pageSlug }),
          clusterSlugs,
        ),
      ),
      {
        areaName: cluster.name,
        pharmacyName,
        serviceName: ctx.serviceName,
        nearbyAreaNames: siblingNames,
        generationRevision,
      },
    );
    return scrubUnconfirmedServiceClaims(polished, {
      fundingModel: delivery?.fundingModel ?? "unknown",
      walkInAvailable: delivery?.walkInAvailable ?? null,
      appointmentRequired: delivery?.appointmentRequired ?? null,
      abpmConfirmed: false,
      gphcConfirmed: Boolean(ctx.profile.gphcNumber?.trim()),
    })
      .replace(/Welcome to\s+/gi, "")
      .replace(/\bProfessional Insight\b/gi, "Pharmacy guidance")
      .replace(/reduced unnecessary A&amp;E visits/gi, "timely pharmacy advice")
      .replace(/reduced unnecessary A&E visits/gi, "timely pharmacy advice")
      .replace(/\bservice experience\b/gi, "pharmacy support")
      .replace(/<span class="tag">pharmacy support<\/span>/gi, "")
      .replace(/>pharmacy support</gi, "><")
      .replace(/>Book or call about [^<]*</gi, ">Contact the pharmacy<")
      .replace(/>Book, call or get directions</gi, ">Contact the pharmacy<")
      .replace(/call ahead if you want parking or opening-hour guidance[^.]*\./gi, "Contact the pharmacy to ask how this service is arranged.")
      .replace(/Ask about parking, opening hours and consultation availability[^.]*\./gi, `Contact the pharmacy to ask how ${ctx.serviceName.toLowerCase()} are arranged.`)
      .replace(/call [^.]*before leaving [^.]*to confirm availability\./gi, `Contact the pharmacy to ask how ${ctx.serviceName.toLowerCase()} are arranged.`)
      .replace(/Private checks may incur a fee — confirm at booking\./gi, "Private checks may be available for a fee — ask what applies locally.")
      .replace(/confirm at booking\./gi, "ask what applies locally.")
      .replace(/\bavailable in ([A-Z][A-Za-z' -]+)\b/gi, "for patients travelling from $1")
      .replace(/\bOther approved ([A-Za-z][\w' -]{1,60}) locality pages?\b/gi, "Guidance for patients travelling from $1")
      .replace(/\blocal guides under service hub for [^.]+/gi, "")
      .replace(/\blocal guidance for patients around [A-Za-z][\w' -]{0,40}\.?/gi, "")
      .replace(/\bunder service hub for [A-Za-z][\w' -]{0,40}/gi, "")
      .replace(/\bservice hub for [A-Za-z][\w' -]{0,40}/gi, "")
      .replace(/Call (\d[\d\s]+) to check availability\./gi, `Call $1 to ask how ${ctx.serviceName.toLowerCase()} are arranged.`)
      .replace(/\bprofile\.(?:source|areaType|confidence|tier):[a-z0-9._:-]+/gi, "")
      .replace(/\bprofile\.[a-z0-9._:-]+/gi, "")
      .replace(/<li>Call to ask how [^<]*<\/li>/gi, "")
      .replace(/Call to ask how [^.]+\./gi, "")
      .replace(
        /<strong>Opening hours:<\/strong>\s*Contact the pharmacy to confirm current opening hours\./gi,
        "<strong>Opening hours:</strong> Confirm when you get in touch.",
      )
      .replace(
        /<strong>Opening hours:<\/strong>\s*Hours can vary — confirm when you get in touch\./gi,
        "<strong>Opening hours:</strong> Confirm when you get in touch.",
      )
      .replace(/\s{2,}/g, " ")
      .replace(/\.\s*\./g, ".");
  };

  const htmlBySlug = new Map<string, string>();
  for (const cluster of hierarchy.clusters) {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    htmlBySlug.set(pageSlug, renderClusterHtml(cluster));
  }

  const patientCopyFailures: string[] = [];
  for (const cluster of hierarchy.clusters) {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    const html = htmlBySlug.get(pageSlug) || "";
    const gate = evaluateLocalityPatientCopyQualityGate({
      html,
      areaName: cluster.name,
      pharmacyName,
      distanceLabel: cluster.distanceLabel || "",
    });
    if (!gate.ok) {
      patientCopyFailures.push(`${pageSlug}: ${gate.failures.join("; ")}`);
    }
  }
  for (let i = 0; i < hierarchy.clusters.length; i++) {
    for (let j = i + 1; j < hierarchy.clusters.length; j++) {
      const a = hierarchy.clusters[i]!;
      const b = hierarchy.clusters[j]!;
      const aSlug = resolveClusterPageSlug(a.slug);
      const bSlug = resolveClusterPageSlug(b.slug);
      if (
        !localityIntroductionsAreDistinct(
          htmlBySlug.get(aSlug) || "",
          htmlBySlug.get(bSlug) || "",
          a.name,
          b.name,
        )
      ) {
        patientCopyFailures.push(`${aSlug}/${bSlug}: duplicate locality introduction or access paragraph`);
      }
    }
  }
  if (patientCopyFailures.length) {
    endLocalityVariationSessionV1();
    return {
      ok: false,
      blockedReason: `Locality patient-copy quality gate failed: ${patientCopyFailures.slice(0, 8).join(" | ")}`,
      hierarchy,
      assets: [],
      localClusterEntries: [],
      clusterPaths: [],
      areaPaths: [],
    };
  }

  const duplicationGate = evaluateLocalityHtmlDuplicationGate({
    pages: hierarchy.clusters.map((cluster) => {
      const pageSlug = resolveClusterPageSlug(cluster.slug);
      return {
        areaSlug: pageSlug,
        areaName: cluster.name,
        html: htmlBySlug.get(pageSlug) || "",
      };
    }),
    pharmacyName,
  });
  if (!duplicationGate.ok) {
    endLocalityVariationSessionV1();
    return {
      ok: false,
      blockedReason: `Locality duplication gate failed: ${duplicationGate.message}`,
      hierarchy,
      assets: [],
      localClusterEntries: [],
      clusterPaths: [],
      areaPaths: [],
    };
  }

  for (const cluster of hierarchy.clusters) {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    const html = htmlBySlug.get(pageSlug) || renderClusterHtml(cluster);
    const rel = resolveClusterPageFilesystemRelativePath(pageSlug);
    const out = writeLocal(rel, html);
    clusterPaths.push(out);
    const urlPath = resolveClusterPageUrlPath(pageSlug);
    localClusterEntries.push({
      areaName: cluster.name,
      areaSlug: pageSlug,
      urlPath,
      outputPath: path.relative(ecosystemRoot, out),
      nearbyAreas: hierarchy.clusters
        .filter((c) => c.areaId !== cluster.areaId)
        .map((c) => {
          const nearbySlug = resolveClusterPageSlug(c.slug);
          return {
            areaName: c.name,
            areaSlug: nearbySlug,
            urlPath: resolveClusterPageUrlPath(nearbySlug),
          };
        }),
    });
    assets.push({
      id: `local-cluster-${pageSlug}`,
      type: "Cluster page",
      urlPath,
      outputPath: out,
      sourceSections: [
        "local-location-cluster",
        cluster.name,
        "rc1-cluster-page",
        session.strategyBySlug.get(pageSlug) || "strategy",
      ],
      wordCount: countWords(html),
    });
  }

  endLocalityVariationSessionV1();

  const linkMap = {
    slug: ctx.resolvedSlug,
    serviceId: ctx.serviceId,
    mainServiceUrlPath: ctx.serviceMeta.urlPath,
    serviceHubUrlPath: ctx.serviceMeta.urlPath,
    localClusterPages: localClusterEntries,
    localLocationClusters: hierarchy.clusters.map((c) => {
      const pageSlug = resolveClusterPageSlug(c.slug);
      return {
        areaName: c.name,
        areaSlug: pageSlug,
        urlPath: resolveClusterPageUrlPath(pageSlug),
        outputPath: resolveClusterPageFilesystemRelativePath(pageSlug),
      };
    }),
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
    duplicationGate: {
      ok: duplicationGate.ok,
      message: duplicationGate.message,
    },
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

  const hubHtml = scrubPublicLocalEngineHtml(renderLocalLocationHubFullPage(ctx, hierarchy));
  const hubOut = writeLocal("local/locations/index.html", hubHtml);
  assets.push({
    id: "local-location-hub",
    type: "Location overview",
    urlPath: "/locations/",
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
  if (cleaned === "local/hub" || cleaned === "local/locations" || cleaned === "locations") {
    return "locations";
  }
  const parts = cleaned.split("/").filter(Boolean);
  if (parts[0] === "local" && parts[1]) {
    const segment = resolveClusterPageSlug(parts[1]);
    return `local-${segment || parts[1]}`;
  }
  return cleaned.replace(/\//g, "-");
}
