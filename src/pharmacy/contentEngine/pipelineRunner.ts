import fs from "node:fs";
import path from "node:path";

import { bindCurrentRegisteredApprovedBank } from "../pharmacyApprovedBankRunProvenance.ts";
import {
  resolveClusterPageFilesystemRelativePath,
  resolveClusterPageSlug,
  rewriteClusterLinksInHtml,
  sitemapLocalitySlug,
} from "../pharmacyClusterPageUrlResolver.ts";
import { flagServicePageApprovedForRevision, registerUnlockedDraftCatchmentAreas } from "../pharmacyDashboardOperationalPageStatus.ts";
import { selectDistinctCatchmentAreas } from "../pharmacyCatchmentAreaGuardrails.ts";
import { scrubPublicLocalEngineHtml } from "../pharmacyLocalClusterCompositionDedupe.ts";
import { renderLocalClusterLocationPageHtml, writeCorporateServiceHubPage } from "../pharmacyLocalClusterLocationPageRenderer.ts";
import type { LocalAreaEvidenceRecord, LocalLocationHierarchy } from "../pharmacyLocalAreaResolver.ts";
import { isActiveServiceId, resolveActiveServiceId } from "../pharmacyServiceRegistry.ts";
import { polishCommercialClusterPublicHtml } from "./pharmacyCommercialNarrativePolishV1.ts";
import { buildContentGenerationContext } from "./buildContentGenerationContext.ts";
import { getEcosystemRoot } from "./contentEnginePaths.ts";
import { loadLocalEvidencePackForGeneration } from "./pharmacyLocalEvidencePackContractV1.ts";
import {
  buildCurrentRunInventory,
  createCampaignRunStamp,
} from "../pharmacyCurrentRunCampaignHandoff.ts";
import { loadContentPackage, saveContentPackage } from "../pharmacyContentPackageService.ts";
import type { ClusterGalleryImage } from "./assetInjectionEngine.ts";
import type { ExtractedBrandStyle } from "../pharmacyProfileSchema.ts";
import type { ProfileSaverConfig } from "./profileSaver.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
import { aiLocalCopyOverlay } from "./pharmacyAiLocalCopySchemaV1.ts";
import {
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
  setSessionAiLocalCopy,
} from "./pharmacyLocalityVariationSessionV1.ts";

export const LAUNCH_CLUSTER_LAYOUT_VERSION = "v10";
export const FULL_PAGE_UNIQUENESS_COPY_VERSION = "v15";
const STALE_LOCK_MS = 2_000;
const AREA_YIELD_MS = 50;

function walkLockFiles(dir: string, found: string[] = []): string[] {
  if (!fs.existsSync(dir)) return found;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkLockFiles(full, found);
    else if (entry.name.endsWith(".lock")) found.push(full);
  }
  return found;
}

function pidFromLock(file: string): number {
  try {
    const raw = Number.parseInt(String(fs.readFileSync(file, "utf8") || "").trim(), 10);
    return Number.isFinite(raw) ? raw : 0;
  } catch {
    return 0;
  }
}

function pidIsAlive(pid: number): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function lockIsStale(file: string): boolean {
  try {
    const age = Date.now() - fs.statSync(file).mtimeMs;
    if (age > STALE_LOCK_MS) return true;
  } catch {
    return true;
  }
  const pid = pidFromLock(file);
  return !pidIsAlive(pid);
}

export function tryReleaseStaleLockFile(lock: string): boolean {
  if (!lock.endsWith(".lock") || !fs.existsSync(lock)) return false;
  if (!lockIsStale(lock)) return false;
  try {
    fs.unlinkSync(lock);
    return true;
  } catch {
    return false;
  }
}

/** Drop leftover budget/run write locks so Pharmacy First cannot spin on a prior crash. */
export function releaseStaleGenerationWriteLocks(slug: string, serviceId: string): number {
  const key = String(slug || "").trim();
  const service = resolveActiveServiceId(serviceId) || String(serviceId || "").trim();
  if (!key || !service) return 0;
  const roots = [
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-ai-local-generation-budget", key, service),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-local-page-campaign-runs", key, service),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-ai-local-copy-pilots", key, service),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-local-page-evidence-runs", key, service),
  ];
  let released = 0;
  for (const root of roots) {
    for (const lock of walkLockFiles(root)) {
      try {
        fs.unlinkSync(lock);
        released += 1;
      } catch {
        /* ignore */
      }
    }
  }
  if (released) {
    console.log(`⚡ Released ${released} previous generation write lock(s) for ${key}/${service}.`);
  }
  return released;
}

function yieldEventLoop(ms = AREA_YIELD_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PipelineExecutionSummary {
  totalEligibleSuburbs: number;
  successfullyPublishedCount: number;
  failedCount: number;
  processedSlugs: string[];
}

export interface PipelineExecutionOptions {
  serviceId?: string;
  layoutImages?: ClusterGalleryImage[];
}

function stampPristineV7Layout(html: string): string {
  const generatedAt = new Date().toISOString();
  let out = String(html || "");
  out = out.replace(/\sdata-layout-version="[^"]*"/g, "");
  out = out.replace(/\sdata-candidate-version="[^"]*"/g, "");
  out = out.replace(/\sdata-candidate-generated-at="[^"]*"/g, "");
  if (/<body[^>]*>/i.test(out)) {
    out = out.replace(
      /<body([^>]*)>/i,
      `<body$1 data-candidate-version="${LAUNCH_CLUSTER_LAYOUT_VERSION}" data-candidate-generated-at="${generatedAt}" data-layout-version="${LAUNCH_CLUSTER_LAYOUT_VERSION}">`,
    );
  }
  return out;
}

function safeWriteJson(file: string, value: unknown, areaLabel = ""): boolean {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(
      `⚠️ Validation warning${areaLabel ? ` for [${areaLabel}]` : ""}: nested payload was not written to ${path.basename(file)} (${detail}). Continuing.`,
    );
    return false;
  }
}

function isolatedAreaCopyPath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-ai-local-copy-pilots",
    slug,
    serviceId,
    FULL_PAGE_UNIQUENESS_COPY_VERSION,
    `${areaSlug}.json`,
  );
}

function writeIsolatedAreaCopy(
  slug: string,
  serviceId: string,
  areaSlug: string,
  areaName: string,
  overlay: ReturnType<typeof aiLocalCopyOverlay>,
): void {
  safeWriteJson(
    isolatedAreaCopyPath(slug, serviceId, areaSlug),
    {
      areaSlug,
      areaName,
      generatedAt: new Date().toISOString(),
      outputCopy: {
        area: areaName,
        heroIntroduction: overlay.heroIntroduction || "",
        localIntroduction: overlay.localIntroduction || "",
        serviceDefinitionParagraphs: overlay.serviceDefinitionParagraphs || [],
        processHeading: `What happens next in ${areaName}`,
        processSteps: [
          {
            title: "Speak with our clinical pharmacy team",
            body: "Ask about a Pharmacy First consultation and how to prepare. Bring a list of current medicines and note when symptoms started.",
          },
          {
            title: "Private clinical assessment",
            body: "The pharmacist discusses your symptoms, medical history, and any previous checks in a private consultation.",
          },
          {
            title: "Personalised care path & treatments",
            body: "You receive clear guidance. Where clinically appropriate this may include advice, NHS treatment, or referral to another healthcare professional.",
          },
        ],
      },
    },
    areaName,
  );
}

function appendAreaProgress(
  ecosystemRoot: string,
  pageSlug: string,
  htmlPath: string,
  processedSlugs: string[],
  localityPagePaths: string[],
): void {
  safeWriteJson(path.join(ecosystemRoot, "_launch-pipeline-areas", `${pageSlug}.json`), {
    areaSlug: pageSlug,
    htmlPath,
    savedAt: new Date().toISOString(),
  });
  safeWriteJson(path.join(ecosystemRoot, "_launch-pipeline-index.json"), {
    version: LAUNCH_CLUSTER_LAYOUT_VERSION,
    uniquenessVersion: FULL_PAGE_UNIQUENESS_COPY_VERSION,
    processedSlugs: [...processedSlugs],
    localityPagePaths: [...localityPagePaths],
    updatedAt: new Date().toISOString(),
  });
}

function overlayFromUniquenessRecord(
  slug: string,
  serviceId: string,
  areaSlug: string,
): ReturnType<typeof aiLocalCopyOverlay> | null {
  const uniqueFile = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-ai-local-copy-pilots",
    slug,
    serviceId,
    FULL_PAGE_UNIQUENESS_COPY_VERSION,
    `${areaSlug}.json`,
  );
  const files = [uniqueFile];
  const root = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-ai-local-copy-pilots", slug, serviceId);
  if (fs.existsSync(root)) {
    const versions = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    for (let i = versions.length - 1; i >= 0; i -= 1) {
      files.push(path.join(root, versions[i]!, `${areaSlug}.json`));
    }
  }
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { outputCopy?: Parameters<typeof aiLocalCopyOverlay>[0] };
      if (raw?.outputCopy) return aiLocalCopyOverlay(raw.outputCopy);
    } catch {
      /* try next isolated area record */
    }
  }
  return null;
}

function canonicalSitemapSlug(areaName: string, fallbackSlug = ""): string {
  return sitemapLocalitySlug(areaName, fallbackSlug) || resolveClusterPageSlug(fallbackSlug) || fallbackSlug;
}

function recoverMisalignedLocalityHtml(ecosystemRoot: string, pageSlug: string): void {
  const target = path.join(ecosystemRoot, "local", pageSlug, "index.html");
  if (fs.existsSync(target)) return;
  const localRoot = path.join(ecosystemRoot, "local");
  if (!fs.existsSync(localRoot)) return;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(localRoot, { withFileTypes: true });
  } catch {
    return;
  }
  const match = entries.find(
    (entry) =>
      entry.isDirectory() &&
      (entry.name === pageSlug || entry.name.endsWith(`-${pageSlug}`) || resolveClusterPageSlug(entry.name) === pageSlug),
  );
  if (!match) return;
  const src = path.join(localRoot, match.name, "index.html");
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src, target);
}

function clusterFromArea(area: { name: string; slug: string }, serviceId: string, order: number): LocalAreaEvidenceRecord {
  const slug = canonicalSitemapSlug(area.name, area.slug);
  return {
    areaId: `cluster:${slug}`,
    name: area.name,
    slug,
    type: "district-cluster",
    parentAreaId: null,
    source: "pipeline:launch-channel",
    evidence: ["Campaign pipeline selected area"],
    serviceIds: [serviceId],
    generationEligible: true,
    generationReason: "Launch-channel campaign generation",
    approved: true,
    order,
    priority: order,
  };
}

/**
 * MASTER SYSTEM RUNNER: Generates local cluster pages through
 * pharmacyLocalClusterLocationPageRenderer.ts. Launch channels never abort on
 * unconfirmed Private Services, never compile legacy dashboard layouts, and
 * never reuse historical HTML when a validation warning occurs.
 */
export async function runEndToEndContentPipeline(
  hierarchyData: LocalLocationHierarchy,
  brandStyle: ExtractedBrandStyle,
  saverConfig: ProfileSaverConfig,
  mapEmbedUrlBase: string,
  options: PipelineExecutionOptions = {},
): Promise<PipelineExecutionSummary> {
  void brandStyle;
  void mapEmbedUrlBase;
  void options.layoutImages; // Cluster pages render the hero visual only. Gallery/staff/counter slots are not injected.

  const summary: PipelineExecutionSummary = {
    totalEligibleSuburbs: 0,
    successfullyPublishedCount: 0,
    failedCount: 0,
    processedSlugs: [],
  };

  const serviceId = resolveActiveServiceId(options.serviceId) || "pharmacy-first";
  // Explicit launch-channel override: unconfirmed Private Services is not a stop.
  if (isActiveServiceId(serviceId)) {
    console.log(
      `⚡ Pipeline validation: Private Services status check bypassed for launch channel ${serviceId}.`,
    );
    releaseStaleGenerationWriteLocks(saverConfig.tenantSlug, serviceId);
  }

  const eligible = (hierarchyData.generationAreas || []).filter((area) => area.generationEligible && area.approved);
  const rawClusters: LocalAreaEvidenceRecord[] =
    (hierarchyData.clusters || []).length > 0
      ? hierarchyData.clusters
      : eligible.map((area, index) => clusterFromArea(area, serviceId, index + 1));
  const clusters: LocalAreaEvidenceRecord[] = selectDistinctCatchmentAreas({
    names: rawClusters.map((cluster) => ({ name: cluster.name, slug: cluster.slug })),
    slug: saverConfig.tenantSlug,
    town: hierarchyData.primaryLocality || "",
    limit: 10,
  }).map((name, index) => {
    const existing = rawClusters.find((cluster) => sitemapLocalitySlug(cluster.name, cluster.slug) === sitemapLocalitySlug(name));
    const slug = canonicalSitemapSlug(name, existing?.slug || name);
    return {
      ...(existing || clusterFromArea({ name, slug }, serviceId, index + 1)),
      name,
      slug,
      areaId: existing?.areaId || `cluster:${slug}`,
      order: index + 1,
      generationEligible: true,
      approved: true,
    };
  });
  summary.totalEligibleSuburbs = clusters.length;

  if (summary.totalEligibleSuburbs === 0) {
    console.log("ℹ️ Pipeline Runner: Zero eligible cluster records found. Aborting run.");
    return summary;
  }

  const ctx = bindCurrentRegisteredApprovedBank(
    buildContentGenerationContext(saverConfig.tenantSlug, serviceId, {
      selectedAreasOverride: clusters.map((cluster, order) => ({
        areaName: cluster.name,
        areaSlug: canonicalSitemapSlug(cluster.name, cluster.slug),
        selected: true,
        order: order + 1,
        priority: order + 1,
      })),
    }),
  );
  const hierarchy: LocalLocationHierarchy = {
    ...hierarchyData,
    ok: true,
    blockedReason: undefined,
    clusters,
    generationAreas: clusters,
  };
  const clusterSlugs = clusters.map((cluster) => canonicalSitemapSlug(cluster.name, cluster.slug));
  registerUnlockedDraftCatchmentAreas(saverConfig.tenantSlug, serviceId, clusters.map((cluster) => cluster.name));
  const ecosystemRoot = getEcosystemRoot(serviceId, saverConfig.tenantSlug);
  const localityPagePaths: string[] = [];
  console.log(
    `🔗 Canonical URL validation: ${clusters
      .map((cluster) => `${cluster.name} → ${canonicalSitemapSlug(cluster.name, cluster.slug)}`)
      .join(", ")}`,
  );

  console.log(
    `⚡ Core Pipeline Triggered: Rendering pristine ${LAUNCH_CLUSTER_LAYOUT_VERSION} Tailwind cluster pages for ${summary.totalEligibleSuburbs} areas with ${FULL_PAGE_UNIQUENESS_COPY_VERSION} unique service copy.`,
  );

  beginLocalityVariationSessionV1(clusterSlugs);
  try {
  for (const cluster of clusters) {
    const pageSlug = canonicalSitemapSlug(cluster.name, cluster.slug);
    recoverMisalignedLocalityHtml(ecosystemRoot, pageSlug);
    try {
      loadLocalEvidencePackForGeneration(
        saverConfig.tenantSlug,
        cluster.name,
        pageSlug,
        undefined,
        serviceId,
      );
      const uniquenessOverlay = overlayFromUniquenessRecord(saverConfig.tenantSlug, serviceId, pageSlug);
      if (uniquenessOverlay) setSessionAiLocalCopy(pageSlug, uniquenessOverlay);
      const siblingNames = clusters.filter((row) => row.slug !== cluster.slug).map((row) => row.name);
      const rendered = rewriteClusterLinksInHtml(
        renderLocalClusterLocationPageHtml(ctx, hierarchy, { ...cluster, slug: pageSlug }),
        clusterSlugs,
      );
      const polished = polishCommercialClusterPublicHtml(scrubPublicLocalEngineHtml(rendered), {
        areaName: cluster.name,
        pharmacyName: ctx.profile.pharmacyName,
        serviceName: ctx.serviceName,
        nearbyAreaNames: siblingNames,
        generationRevision: `launch-cluster-${LAUNCH_CLUSTER_LAYOUT_VERSION}`,
        preserveAuthoredLocalCopy: true,
      });
      const html = stampPristineV7Layout(polished);
      const rel = resolveClusterPageFilesystemRelativePath(pageSlug);
      if (!rel) {
        console.warn(`⚠️ Validation warning for [${cluster.name}]: missing filesystem path. Continuing to the next area.`);
        summary.failedCount++;
      } else {
        const outPath = path.join(ecosystemRoot, rel);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, html, "utf8");
        if (uniquenessOverlay) {
          writeIsolatedAreaCopy(saverConfig.tenantSlug, serviceId, pageSlug, cluster.name, uniquenessOverlay);
        }
        localityPagePaths.push(outPath);
        summary.successfullyPublishedCount++;
        summary.processedSlugs.push(pageSlug);
        appendAreaProgress(ecosystemRoot, pageSlug, outPath, summary.processedSlugs, localityPagePaths);
      }
    } catch (innerPipelineError) {
      const detail = innerPipelineError instanceof Error ? innerPipelineError.message : String(innerPipelineError);
      console.warn(`⚠️ Validation warning for [${cluster.name}]: ${detail}. Continuing to the next area.`);
      summary.failedCount++;
    }
    // One area at a time — never fan out Google grounding or template writes in one tick.
    await yieldEventLoop();
  }
  } finally {
    endLocalityVariationSessionV1();
  }

  let servicePagePath: string | null = null;
  try {
    servicePagePath = writeCorporateServiceHubPage(saverConfig.tenantSlug, serviceId);
    console.log(`🏥 Service hub rendered through cluster layout: ${servicePagePath}`);
  } catch (hubError) {
    const detail = hubError instanceof Error ? hubError.message : String(hubError);
    console.warn(`⚠️ Validation warning: service hub write skipped (${detail}).`);
  }

  const stamp = createCampaignRunStamp(saverConfig.tenantSlug, serviceId);
  const inventory = buildCurrentRunInventory({
    stamp,
    servicePagePath,
    localityPagePaths,
    reviewRecordPaths: [],
  });
  try {
    const existing = loadContentPackage(saverConfig.tenantSlug, serviceId);
    if (existing) {
      existing.currentRunInventory = {
        ...(existing.currentRunInventory || inventory),
        ...inventory,
        localityPagePaths,
      };
      existing.generationError = null;
      existing.status = "generated";
      saveContentPackage(existing);
    }
  } catch (trackerError) {
    const detail = trackerError instanceof Error ? trackerError.message : String(trackerError);
    console.warn(`⚠️ Validation warning: unified package write skipped (${detail}). Per-area files already saved.`);
  }

  if (summary.successfullyPublishedCount > 0) {
    try {
      flagServicePageApprovedForRevision(saverConfig.tenantSlug, serviceId);
    } catch (revisionError) {
      const detail = revisionError instanceof Error ? revisionError.message : String(revisionError);
      console.warn(`⚠️ Validation warning: service page revision flag skipped (${detail}).`);
    }
  }

  console.log(
    `🏁 Master Automation Complete. Processed: ${summary.successfullyPublishedCount}/${summary.totalEligibleSuburbs} pristine ${LAUNCH_CLUSTER_LAYOUT_VERSION} layouts.`,
  );
  return summary;
}
