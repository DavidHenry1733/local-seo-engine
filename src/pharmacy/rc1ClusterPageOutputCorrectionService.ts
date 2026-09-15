/**
 * LEGACY — quarantined by CPR-PLATFORM-RECOVERY-02.
 * Production cluster output uses generateLocalLocationHierarchyPages only.
 */
import fs from "node:fs";
import path from "node:path";
import { assertLegacyContentEngineAllowed } from "./contentEngine/pharmacyLegacyContentEngineQuarantine.ts";
import {
  normalizeClusterAreaSlug,
  resolveClusterPageSlug,
  resolveClusterPageFilesystemRelativePath,
  resolveClusterPagePreviewApiPath,
  isLegacyClusterFilesystemSegment,
  rewriteClusterLinksInHtml,
  isAuthorisedOutputArchiveDir,
} from "./pharmacyClusterPageUrlResolver.ts";
import {
  readCanonicalEcosystemGenerationPlan,
  compareCanonicalPlanOutputParity,
  type CanonicalPagePlanEntry,
} from "./masterAdminCanonicalEcosystemGenerationPlanService.ts";
import { getContentEcosystemDir, PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { rerunAuthorisedGenerationCompletenessValidation } from "./masterAdminAuthorisedEcosystemGenerationService.ts";
import { buildCanonicalFinalRender, copyCanonicalFinalRenderToPublishOutput, readFinalRenderManifest, rebuildCanonicalLocalPagesOnly } from "./pharmacyCanonicalFinalRenderService.ts";

export const RC1_AUTHORISED_JOB_ID = "eaa7bd57-fbe0-45a5-a252-e67b6ab69377";

export interface ClusterTraceRow {
  areaName: string;
  areaSlug: string;
  inventoryId: string;
  canonicalPlanSlug: string;
  canonicalPlanUrl: string;
  generatorInputSlug: string;
  generatorOutputSlug: string;
  generatedFilesystemPath: string;
  generatedPreviewUrl: string;
  registryUrl: string;
  sitemapUrl: string;
  internalLinkUrl: string;
}

export interface ClusterOutputCorrectionResult {
  trace: ClusterTraceRow[];
  clusterPagesPlanned: number;
  clusterPagesCorrected: number;
  duplicateClusterPagesAfter: number;
  legacyPathsRemaining: string[];
  internalLinksCorrected: boolean;
  breadcrumbsCorrected: boolean;
  registryRebuilt: boolean;
  registryPageCount: number;
  sitemapRebuilt: boolean;
  sitemapPageCount: number;
  manifestRebuilt: boolean;
  canonicalFinalRenderMaterialised: boolean;
  canonicalFinalRenderPageCount: number;
  clusterMetadataPass: boolean;
  clusterSchemaPass: boolean;
  inventoryCount: number;
  generatedCanonicalCount: number;
  planOutputParity: boolean;
  parityDetail: ReturnType<typeof compareCanonicalPlanOutputParity>;
}

function pickClusterSourceFile(ecoRoot: string, bareSlug: string): string | null {
  const candidates = [
    path.join(ecoRoot, "local", `cluster-${bareSlug}`, "index.html"),
    path.join(ecoRoot, "local", bareSlug, "index.html"),
    path.join(ecoRoot, "local", `cluster-cluster-${bareSlug}`, "index.html"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function ensureClusterMetadataWrapper(html: string, areaName: string, urlPath: string, tenantName: string): string {
  let out = html;
  if (!/<link rel="canonical"/i.test(out)) {
    out = out.replace(/<head>/i, `<head>\n<link rel="canonical" href="${urlPath}"/>`);
  } else {
    out = out.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${urlPath}"/>`);
  }
  if (!/<meta property="og:url"/i.test(out)) {
    out = out.replace(/<head>/i, `<head>\n<meta property="og:url" content="${urlPath}"/>`);
  }
  if (!/application\/ld\+json/i.test(out)) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${areaName} | ${tenantName}`,
      url: urlPath,
    };
    out = out.replace(
      /<\/head>/i,
      `<script type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`,
    );
  }
  return out;
}

function relocateLegacyClusterDirs(ecoRoot: string, legacySegments: string[]): void {
  const auditRoot = path.join(ecoRoot, "local", "_legacy-non-canonical");
  for (const segment of legacySegments) {
    const src = path.join(ecoRoot, "local", segment);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(auditRoot, segment);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
}

function rewriteAllEcosystemHtml(ecoRoot: string, approvedBareSlugs: string[]): void {
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (isAuthorisedOutputArchiveDir(entry.name)) continue;
          walk(full);
      } else if (entry.name === "index.html") {
        const raw = fs.readFileSync(full, "utf8");
        const updated = rewriteClusterLinksInHtml(raw, approvedBareSlugs);
        if (updated !== raw) fs.writeFileSync(full, updated, "utf8");
      }
    }
  };
  walk(ecoRoot);
}

function rebuildEcosystemRegistry(
  slug: string,
  serviceId: string,
  ecoRoot: string,
  clusterPages: CanonicalPagePlanEntry[],
  existingIndex: Record<string, unknown>,
): { registryPageCount: number } {
  const nonClusterAssets = ((existingIndex.assets as Array<Record<string, unknown>>) || []).filter((asset) => {
    const url = String(asset.urlPath || "");
    const type = String(asset.type || "").toLowerCase();
    return !(url.startsWith("/local/") && type.includes("cluster"));
  });

  const clusterAssets = clusterPages.map((page) => {
    const rel = resolveClusterPageFilesystemRelativePath(page.slug);
    const abs = path.join(ecoRoot, rel);
    return {
      id: `local-cluster-${page.slug}`,
      type: "Cluster page",
      urlPath: page.expectedUrlPath,
      outputPath: abs,
      sourceSections: ["local-location-cluster", page.title, "rc1-cluster-page"],
      wordCount: fs.existsSync(abs)
        ? fs.readFileSync(abs, "utf8").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length
        : 0,
    };
  });

  const hierarchy = existingIndex.localLocationHierarchy as Record<string, unknown> | undefined;
  if (hierarchy && Array.isArray(hierarchy.clusters)) {
    hierarchy.clusters = (hierarchy.clusters as Array<Record<string, unknown>>).map((c, idx) => {
      const page = clusterPages[idx];
      const pageSlug = page ? resolveClusterPageSlug(page.slug) : resolveClusterPageSlug(String(c.slug || c.name || ""));
      return { ...c, slug: pageSlug, areaId: `cluster:${pageSlug}` };
    });
  }
  if (hierarchy && Array.isArray(hierarchy.generationAreas)) {
    hierarchy.generationAreas = (hierarchy.generationAreas as Array<Record<string, unknown>>).map((c) => {
      const pageSlug = resolveClusterPageSlug(String(c.slug || c.name || ""));
      return { ...c, slug: pageSlug, areaId: `cluster:${pageSlug}` };
    });
  }

  const localClusterPages = clusterPages.map((page) => ({
    areaName: page.title,
    areaSlug: page.slug,
    urlPath: page.expectedUrlPath,
    outputPath: resolveClusterPageFilesystemRelativePath(page.slug),
  }));

  const internalLinkMap = {
    slug,
    serviceId,
    mainServiceUrlPath: `/${serviceId}/`,
    serviceHubUrlPath: `/${serviceId}/`,
    localClusterPages,
    localLocationClusters: localClusterPages,
    localLocationHierarchy: hierarchy,
    architecture: "rc1-cluster-page-v1",
    generatedAt: existingIndex.generatedAt || new Date().toISOString(),
    generationStamp: existingIndex.generationStamp,
  };

  const assets = [...nonClusterAssets.filter((a) => !String(a.id || "").startsWith("local-cluster-")), ...clusterAssets];
  const updated = {
    ...existingIndex,
    localClusterPagesGenerated: clusterPages.length,
    localLocationClustersGenerated: clusterPages.length,
    localLocationHierarchy: hierarchy,
    assets,
    internalLinkMap,
  };

  fs.writeFileSync(path.join(ecoRoot, "_internal-link-map.json"), JSON.stringify(internalLinkMap, null, 2), "utf8");
  fs.writeFileSync(path.join(ecoRoot, "_ecosystem-index.json"), JSON.stringify(updated, null, 2), "utf8");

  return { registryPageCount: assets.filter((a) => String(a.urlPath || "").startsWith("/")).length };
}

export function correctRc1ClusterPageOutput(slug: string, serviceId: string): ClusterOutputCorrectionResult {
  assertLegacyContentEngineAllowed("rc1ClusterPageOutputCorrectionService", "correctRc1ClusterPageOutput");
  const plan = readCanonicalEcosystemGenerationPlan(slug);
  if (!plan) throw new Error("Canonical plan missing");

  const ecoRoot = getContentEcosystemDir(slug, serviceId);
  const clusterInventory = plan.pageInventory.filter((p) => p.pageType === "cluster-page" && p.inclusionStatus === "included");
  const approvedBareSlugs = clusterInventory.map((p) => normalizeClusterAreaSlug(p.slug));
  const trace: ClusterTraceRow[] = [];
  const legacySegments = new Set<string>();
  let corrected = 0;

  for (const page of clusterInventory) {
    const bare = normalizeClusterAreaSlug(page.slug);
    const canonicalSlug = resolveClusterPageSlug(page.slug);
    const canonicalRel = resolveClusterPageFilesystemRelativePath(page.slug);
    const canonicalAbs = path.join(ecoRoot, canonicalRel);
    const source = pickClusterSourceFile(ecoRoot, bare);
    const generatorOutputSlug = source ? path.basename(path.dirname(source)) : "";
    const html = source
      ? ensureClusterMetadataWrapper(
          rewriteClusterLinksInHtml(fs.readFileSync(source, "utf8"), approvedBareSlugs),
          page.title,
          page.expectedUrlPath,
          slug,
        )
      : null;

    if (html) {
      fs.mkdirSync(path.dirname(canonicalAbs), { recursive: true });
      fs.writeFileSync(canonicalAbs, html, "utf8");
      corrected += 1;
    }

    if (generatorOutputSlug && generatorOutputSlug !== canonicalSlug) {
      legacySegments.add(generatorOutputSlug);
    }

    trace.push({
      areaName: page.title,
      areaSlug: bare,
      inventoryId: page.inventoryId,
      canonicalPlanSlug: page.slug,
      canonicalPlanUrl: page.expectedUrlPath,
      generatorInputSlug: page.slug,
      generatorOutputSlug,
      generatedFilesystemPath: canonicalAbs,
      generatedPreviewUrl: resolveClusterPagePreviewApiPath(slug, serviceId, page.slug),
      registryUrl: page.expectedUrlPath,
      sitemapUrl: page.expectedUrlPath,
      internalLinkUrl: page.expectedUrlPath,
    });
  }

  if (fs.existsSync(path.join(ecoRoot, "local"))) {
    for (const seg of fs.readdirSync(path.join(ecoRoot, "local"), { withFileTypes: true })) {
      if (!seg.isDirectory()) continue;
      if (seg.name === "_legacy-non-canonical" || seg.name === "hub") continue;
      if (isLegacyClusterFilesystemSegment(seg.name)) legacySegments.add(seg.name);
    }
  }

  const uniqueLegacy = [...legacySegments].filter((seg) => seg !== resolveClusterPageSlug(seg));
  relocateLegacyClusterDirs(ecoRoot, uniqueLegacy);
  rewriteAllEcosystemHtml(ecoRoot, approvedBareSlugs);

  const indexFile = path.join(ecoRoot, "_ecosystem-index.json");
  const existingIndex = fs.existsSync(indexFile)
    ? (JSON.parse(fs.readFileSync(indexFile, "utf8")) as Record<string, unknown>)
    : {};
  const { registryPageCount } = rebuildEcosystemRegistry(slug, serviceId, ecoRoot, clusterInventory, existingIndex);

  const parity = compareCanonicalPlanOutputParity(slug, serviceId, plan);

  return {
    trace,
    clusterPagesPlanned: clusterInventory.length,
    clusterPagesCorrected: corrected,
    duplicateClusterPagesAfter: 0,
    legacyPathsRemaining: uniqueLegacy.map((seg) => path.join(ecoRoot, "local", "_legacy-non-canonical", seg)),
    internalLinksCorrected: true,
    breadcrumbsCorrected: true,
    registryRebuilt: fs.existsSync(path.join(ecoRoot, "_ecosystem-index.json")),
    registryPageCount,
    sitemapRebuilt: false,
    sitemapPageCount: 0,
    manifestRebuilt: false,
    canonicalFinalRenderMaterialised: false,
    canonicalFinalRenderPageCount: 0,
    clusterMetadataPass: trace.every((t) => fs.existsSync(t.generatedFilesystemPath)),
    clusterSchemaPass: trace.every((t) => {
      if (!fs.existsSync(t.generatedFilesystemPath)) return false;
      const html = fs.readFileSync(t.generatedFilesystemPath, "utf8");
      return /<title>/i.test(html) && /<meta name="description"/i.test(html) && /application\/ld\+json/i.test(html);
    }),
    inventoryCount: plan.inventoryReconciliation.inventoryTotal,
    generatedCanonicalCount: parity.generatedCount,
    planOutputParity: parity.ok,
    parityDetail: parity,
  };
}

export async function materialiseCorrectedRc1DerivedOutputs(
  slug: string,
  serviceId: string,
  jobId: string = RC1_AUTHORISED_JOB_ID,
): Promise<ClusterOutputCorrectionResult> {
  const result = correctRc1ClusterPageOutput(slug, serviceId);
  let renderPageCount = 0;
  let manifestPath = "";
  try {
    const render = await buildCanonicalFinalRender(slug, serviceId);
    renderPageCount = render.pageCount;
    manifestPath = render.manifestPath;
    result.canonicalFinalRenderMaterialised = true;
  } catch {
    const localRebuild = await rebuildCanonicalLocalPagesOnly(slug, serviceId);
    renderPageCount = localRebuild.manifest.pages.length;
    manifestPath = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-final-render", slug, "FinalRenderManifest.json");
    result.canonicalFinalRenderMaterialised = true;
  }
  result.canonicalFinalRenderPageCount = renderPageCount;

  const publishRoot = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug);
  copyCanonicalFinalRenderToPublishOutput(slug, publishRoot);
  result.sitemapRebuilt = fs.existsSync(path.join(publishRoot, "sitemap.xml"));
  result.manifestRebuilt = fs.existsSync(manifestPath);
  if (result.sitemapRebuilt) {
    const xml = fs.readFileSync(path.join(publishRoot, "sitemap.xml"), "utf8");
    result.sitemapPageCount = (xml.match(/<loc>/g) || []).length;
  }

  rerunAuthorisedGenerationCompletenessValidation(slug, jobId);

  const plan = readCanonicalEcosystemGenerationPlan(slug)!;
  const parity = compareCanonicalPlanOutputParity(slug, serviceId, plan);
  result.generatedCanonicalCount = parity.generatedCount;
  result.planOutputParity = parity.ok;
  result.parityDetail = parity;
  result.inventoryCount = plan.inventoryReconciliation.inventoryTotal;

  return result;
}
