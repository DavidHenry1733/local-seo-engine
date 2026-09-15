/**
 * CPR cluster-pages job — thin queue/worker wrapper around existing
 * generateLocalLocationHierarchyPages. Does not implement a second generator.
 */
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import fs from "node:fs";
import path from "node:path";
import { buildContentGenerationContext } from "./contentEngine/buildContentGenerationContext.ts";
import {
  generateLocalLocationHierarchyPages,
  mergeLocalAssetsIntoEcosystemIndex,
} from "./pharmacyLocalLocationGenerationService.ts";
import { resolveLocalLocationHierarchy } from "./pharmacyLocalAreaResolver.ts";
import { renderLocalLocationClusterFullPage } from "./pharmacyLocalHierarchyFullPageRenderer.ts";
import { scrubPublicLocalEngineHtml } from "./pharmacyLocalClusterCompositionDedupe.ts";
import { polishCommercialClusterPublicHtml } from "./contentEngine/pharmacyCommercialNarrativePolishV1.ts";
import { resolveClusterPageSlug } from "./pharmacyClusterPageUrlResolver.ts";

import { CPR_DASHBOARD_INITIATION_SOURCE, isCprClusterGenerationEligible } from "./masterAdminCoreProductRecoveryService.ts";
import {
  createMasterAdminJob,
  getMasterAdminJob,
  listMasterAdminJobs,
  runMasterAdminJobAsync,
  updateMasterAdminJob,
  type MasterAdminJob,
} from "./masterAdminJobService.ts";

export const LOCAL_CLUSTER_JOB_ACTION = "generate_local_cluster_pages" as const;
export const LOCAL_CLUSTER_SCOPE = "local-cluster-only" as const;

function resolvePrimaryServiceId(slug: string): string {
  const data = readSetupProfile(slug);
  const normalized = normalizeProfileData(data);
  const services = normalized.services || [];
  const primary = services.find((s) => s.isPrimary) || services[0];
  return primary?.id || "pharmacy-first";
}

export function isLocalClusterPagesJob(job: MasterAdminJob): boolean {
  return (
    job.scope === LOCAL_CLUSTER_SCOPE &&
    (job.action === LOCAL_CLUSTER_JOB_ACTION ||
      job.action === "regenerate_local_cluster_page" ||
      job.action === "regenerate_all_local_cluster_pages")
  );
}

export function findActiveLocalClusterJob(slug: string): MasterAdminJob | null {
  return (
    listMasterAdminJobs({ slug, limit: 10 }).find(
      (j) =>
        j.action === LOCAL_CLUSTER_JOB_ACTION &&
        (j.status === "queued" || j.status === "claimed" || j.status === "running"),
    ) || null
  );
}

export function createLocalClusterPagesJob(input: {
  slug: string;
  operator: string;
  serviceId?: string;
  campaignId?: string;
  workflowStage?: string;
  executionPayload?: Record<string, unknown>;
}): MasterAdminJob {
  const serviceId = input.serviceId || resolvePrimaryServiceId(input.slug);
  const campaignId = input.campaignId || (typeof input.executionPayload?.campaignId === "string"
    ? input.executionPayload.campaignId
    : undefined);
  const job = createMasterAdminJob({
    slug: input.slug,
    action: LOCAL_CLUSTER_JOB_ACTION,
    user: input.operator,
    workflowStage: input.workflowStage || "generate_ecosystem",
  });
  updateMasterAdminJob(job.id, {
    scope: LOCAL_CLUSTER_SCOPE,
    serviceId,
    campaignId: campaignId || null,
    initiationSource: CPR_DASHBOARD_INITIATION_SOURCE,
    stage: "validate-context",
    progress: 0,
    progressLabel: "Queued",
    executionPayload: {
      operatorConfirmed: true,
      scope: LOCAL_CLUSTER_SCOPE,
      initiationSource: CPR_DASHBOARD_INITIATION_SOURCE,
      serviceId,
      campaignId: campaignId || null,
      ...input.executionPayload,
    },
  });
  return getMasterAdminJob(job.id)!;
}

export function queueLocalClusterPagesJob(input: {
  slug: string;
  operator: string;
  serviceId?: string;
  campaignId?: string;
  workflowStage?: string;
  executionPayload?: Record<string, unknown>;
}): MasterAdminJob {
  const job = createLocalClusterPagesJob(input);
  runMasterAdminJobAsync(job.id, job.executionPayload || {}, {
    workflowStage: job.workflowStage,
  });
  return job;
}

export async function executeLocalClusterPagesJob(
  jobId: string,
  opts: { onProgress?: (progress: number, label: string) => void; body?: Record<string, unknown> } = {},
): Promise<MasterAdminJob | null> {
  const job = getMasterAdminJob(jobId);
  if (!job || !isLocalClusterPagesJob(job)) return job;
  if (job.status !== "claimed" && job.status !== "running") return job;

  if (job.status === "claimed") {
    updateMasterAdminJob(jobId, {
      status: "running",
      startedAt: job.startedAt || new Date().toISOString(),
    });
  }

  const slug = job.slug;
  const serviceId = job.serviceId || resolvePrimaryServiceId(slug);
  const payload = { ...(job.executionPayload || {}), ...(opts.body || {}) };
  const regenerateMode = String(payload.regenerateMode || "generate_all");
  const onlyAreaSlug = String(payload.onlyAreaSlug || "").trim();

  try {
    opts.onProgress?.(10, "Validating cluster generation eligibility");
    updateMasterAdminJob(jobId, { progress: 10, progressLabel: "Validating cluster generation eligibility", stage: "validate-context" });
    if (!isCprClusterGenerationEligible(slug)) {
      const { readCanonicalSavedLocalityAreas } = await import("./masterAdminSavedLocalitySelectionService.ts");
      const hasSavedLocalityAreas = readCanonicalSavedLocalityAreas(slug).length > 0;
      // Normal local campaigns are eligible after the shared queue has validated
      // service-page approval and persisted canonical profile.selectedAreas.
      if (!hasSavedLocalityAreas && regenerateMode === "generate_all") {
        throw new Error("No saved locality areas. Save at least one area in Local Coverage before generating locality pages.");
      }
    }

    opts.onProgress?.(20, "Collecting verified locality evidence");
    updateMasterAdminJob(jobId, {
      progress: 20,
      progressLabel: "Collecting verified locality evidence",
      stage: "collect-evidence",
    });
    const { preflightPharmacyLocalEvidenceForCampaign } = await import(
      "./contentEngine/pharmacyLocalEvidencePackContractV1.ts"
    );
    let evidencePreflight = preflightPharmacyLocalEvidenceForCampaign(slug, serviceId);
    if (!evidencePreflight.ok && (evidencePreflight.missingAreas.length || evidencePreflight.staleAreas.length)) {
      const { runPharmacyLocalEvidenceDiscovery } = await import("./pharmacyLocalRelevancePackService.ts");
      await runPharmacyLocalEvidenceDiscovery(slug);
      evidencePreflight = preflightPharmacyLocalEvidenceForCampaign(slug, serviceId);
    }
    if (!evidencePreflight.ok) {
      throw new Error(
        evidencePreflight.customerError ||
          "Local pages cannot be generated yet because verified area evidence is missing or insufficient.",
      );
    }

    opts.onProgress?.(30, "Building generation context");
    updateMasterAdminJob(jobId, { progress: 30, progressLabel: "Building generation context", stage: "compose-content" });
    const ctx = buildContentGenerationContext(slug, serviceId);

    let clusterPaths: string[] = [];
    let pagesGenerated = 0;

    if (regenerateMode === "regenerate_one" && onlyAreaSlug) {
      opts.onProgress?.(55, `Regenerating locality ${onlyAreaSlug}`);
      updateMasterAdminJob(jobId, {
        progress: 55,
        progressLabel: `Regenerating locality ${onlyAreaSlug}`,
        stage: "render-page",
      });
      const hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
      if (!hierarchy.ok) throw new Error(hierarchy.blockedReason || "Local hierarchy unavailable");
      const cluster = hierarchy.clusters.find(
        (c) => resolveClusterPageSlug(c.slug) === resolveClusterPageSlug(onlyAreaSlug) || c.slug === onlyAreaSlug,
      );
      if (!cluster) throw new Error(`Locality not in campaign selection: ${onlyAreaSlug}`);
      const pageSlug = resolveClusterPageSlug(cluster.slug);
      const siblingNames = hierarchy.clusters.filter((c) => c.slug !== cluster.slug).map((c) => c.name);
      const html = polishCommercialClusterPublicHtml(
        scrubPublicLocalEngineHtml(renderLocalLocationClusterFullPage(ctx, hierarchy, { ...cluster, slug: pageSlug })),
        {
          areaName: cluster.name,
          pharmacyName: ctx.profile.pharmacyName,
          serviceName: ctx.serviceName,
          nearbyAreaNames: siblingNames,
          generationRevision: `po-regen-${new Date().toISOString()}`,
        },
      );
      const outPath = path.join(ctx.links.ecosystemRoot, "local", pageSlug, "index.html");
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, "utf8");
      clusterPaths = [outPath];
      pagesGenerated = 1;
      // Keep existing ecosystem index intact for single-locality regeneration.
    } else {
      opts.onProgress?.(55, "Generating local cluster pages");
      updateMasterAdminJob(jobId, { progress: 55, progressLabel: "Generating local cluster pages", stage: "render-page" });
      const result = generateLocalLocationHierarchyPages(ctx);
      if (!result.ok) {
        throw new Error(result.blockedReason || "Local cluster generation failed");
      }
      opts.onProgress?.(85, "Updating ecosystem index");
      updateMasterAdminJob(jobId, { progress: 85, progressLabel: "Updating ecosystem index", stage: "write-manifest" });
      mergeLocalAssetsIntoEcosystemIndex(slug, serviceId, result);
      clusterPaths = result.clusterPaths;
      pagesGenerated = result.clusterPaths.length;
    }

    opts.onProgress?.(100, "Completed");
    const completed = updateMasterAdminJob(jobId, {
      status: "completed",
      progress: 100,
      progressLabel: "Completed",
      completedAt: new Date().toISOString(),
      stage: "completed",
      result: {
        ok: true,
        scope: LOCAL_CLUSTER_SCOPE,
        clusterPaths,
        pagesGenerated,
        regenerateMode,
        onlyAreaSlug: onlyAreaSlug || null,
        autoApprove: false,
        autoPublish: false,
      },
      evidence:
        regenerateMode === "regenerate_one"
          ? `CPR locality page regenerated (${onlyAreaSlug})`
          : `CPR local cluster pages generated (${pagesGenerated} clusters)`,
      leaseExpiresAt: undefined,
    });

    if (job.workflowStage) {
      const { finalizeWorkflowJob } = await import("./masterAdminWorkflowOrchestrator.ts");
      finalizeWorkflowJob(jobId);
    }
    return completed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stackTrace = err instanceof Error ? err.stack || message : message;
    const failed = updateMasterAdminJob(jobId, {
      status: "failed",
      progressLabel: "Failed",
      completedAt: new Date().toISOString(),
      error: message,
      stackTrace,
      leaseExpiresAt: undefined,
    });
    if (job.workflowStage) {
      const { finalizeWorkflowJob } = await import("./masterAdminWorkflowOrchestrator.ts");
      finalizeWorkflowJob(jobId);
    }
    return failed;
  }
}
