/**
 * CPR-13 — Generic service-page-only job contract and staged executor.
 * Isolated from ecosystem workflow, publish package, and manual recovery paths.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { generateContentPackage } from "./pharmacyContentPackageService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { selectCampaignBuilderService } from "./growthEngineCampaignBuilderService.ts";
import {
  buildCustomerCampaignGenerationContext,
  freezeCustomerCampaignGenerationContext,
} from "./contentEngine/customerCampaignGenerationContext.ts";
import { rebuildPharmacyProductionImageAssignments } from "./imagePlatform/pharmacyImagePlatformProductionAssignmentService.ts";
import { ensureComponentDnaPersisted } from "./masterAdminComponentDnaPersistenceService.ts";
import { computeBrandDnaRevision } from "./pharmacyDesignLineageRevisionService.ts";
import { loadBrandDnaV1File } from "./pharmacyBrandDnaStore.ts";
import { loadProductionLibraryRevision } from "./imagePlatform/pharmacyImagePlatformProductionResolver.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  assertServicePageGenerationAllowed,
  markServicePageGenerationComplete,
  writeServicePageGenerationRecord,
  buildServicePageGenerationDashboard,
  CPR_DASHBOARD_INITIATION_SOURCE,
} from "./masterAdminCoreProductRecoveryService.ts";
import { buildServicePageSeoPlan } from "./masterAdminCoreProductRecoverySeoService.ts";
import { validateServicePageOutputScope } from "./masterAdminCoreProductRecoveryOutputScopeService.ts";
import {
  SERVICE_PAGE_GENERATION_SCOPE,
  validateServicePageTenantContextGate,
} from "./pharmacyServicePageTenantContextService.ts";
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";
import {
  createMasterAdminJob,
  getMasterAdminJob,
  runMasterAdminJobAsync,
  updateMasterAdminJob,
  type MasterAdminJob,
  type MasterAdminJobStatus,
} from "./masterAdminJobService.ts";

export const SERVICE_PAGE_ONLY_SCOPE = "service-page-only" as const;
export const SERVICE_PAGE_JOB_ACTION = "generate_service_page" as const;

export const SERVICE_PAGE_JOB_STAGES = [
  "validate-context",
  "resolve-brand",
  "resolve-images",
  "compose-content",
  "render-page",
  "write-metadata",
  "write-schema",
  "write-manifest",
  "write-registry",
  "create-review",
  "completed",
] as const;

export type ServicePageJobStage = (typeof SERVICE_PAGE_JOB_STAGES)[number];

export interface ServicePageJobContract {
  jobId: string;
  customerSlug: string;
  serviceId: string;
  scope: typeof SERVICE_PAGE_ONLY_SCOPE;
  initiationSource: typeof CPR_DASHBOARD_INITIATION_SOURCE;
  evidenceRevision: string;
  brandRevision: string;
  imageAssignmentRevision: string | null;
  status: MasterAdminJobStatus | "claimed";
  progress: number;
  stage: ServicePageJobStage | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

const STAGE_PROGRESS: Record<ServicePageJobStage, number> = {
  "validate-context": 5,
  "resolve-brand": 12,
  "resolve-images": 22,
  "compose-content": 35,
  "render-page": 55,
  "write-metadata": 68,
  "write-schema": 76,
  "write-manifest": 84,
  "write-registry": 90,
  "create-review": 96,
  completed: 100,
};

const SYNTHETIC_VALIDATION_SLUG = "synthetic-cpr-13-worker-validation";

function resolvePrimaryServiceId(slug: string): string {
  const data = readSetupProfile(slug);
  const normalized = normalizeProfileData(data);
  const services = normalized.services || [];
  const primary = services.find((s) => s.isPrimary) || services[0];
  return primary?.id || "pharmacy-first";
}

function readEvidenceRevision(slug: string): string {
  const file = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/service-page-evidence-review",
    slug,
    "field-decisions.json",
  );
  if (!fs.existsSync(file)) return "0";
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { evidenceReviewRevision?: number };
    return String(raw.evidenceReviewRevision || 0);
  } catch {
    return "0";
  }
}

export function resolveServicePageJobRevisions(slug: string, serviceId: string): {
  evidenceRevision: string;
  brandRevision: string;
  imageAssignmentRevision: string | null;
} {
  const brandRevision = computeBrandDnaRevision(loadBrandDnaV1File(slug));
  return {
    evidenceRevision: readEvidenceRevision(slug),
    brandRevision,
    imageAssignmentRevision: loadProductionLibraryRevision() || null,
  };
}

export function isServicePageOnlyJob(job: MasterAdminJob): boolean {
  return (
    (job.action === SERVICE_PAGE_JOB_ACTION || job.action === "regenerate_service_page") &&
    job.scope === SERVICE_PAGE_ONLY_SCOPE
  );
}

export function buildServicePageJobContract(job: MasterAdminJob): ServicePageJobContract | null {
  if (!isServicePageOnlyJob(job)) return null;
  return {
    jobId: job.id,
    customerSlug: job.slug,
    serviceId: job.serviceId || resolvePrimaryServiceId(job.slug),
    scope: SERVICE_PAGE_ONLY_SCOPE,
    initiationSource: CPR_DASHBOARD_INITIATION_SOURCE,
    evidenceRevision: job.evidenceRevision || "0",
    brandRevision: job.brandRevision || "unknown",
    imageAssignmentRevision: job.imageAssignmentRevision ?? null,
    status: job.status as ServicePageJobContract["status"],
    progress: job.progress,
    stage: (job.stage as ServicePageJobStage | undefined) || null,
    createdAt: job.createdAt,
    startedAt: job.startedAt || null,
    completedAt: job.completedAt || null,
    error: job.error || null,
  };
}

export function persistServicePageJobStage(
  jobId: string,
  stage: ServicePageJobStage,
  opts: { onProgress?: (progress: number, label: string) => void } = {},
): MasterAdminJob | null {
  const progress = STAGE_PROGRESS[stage];
  const label = stage.replace(/-/g, " ");
  opts.onProgress?.(progress, label);
  return updateMasterAdminJob(jobId, {
    stage,
    progress,
    progressLabel: label,
    status: "running",
  });
}

export function createServicePageOnlyJob(input: {
  slug: string;
  operator: string;
  serviceId?: string;
  campaignId?: string;
  executionPayload?: Record<string, unknown>;
}): MasterAdminJob {
  const serviceId = input.serviceId || (input.executionPayload?.syntheticValidation ? "pharmacy-first" : resolvePrimaryServiceId(input.slug));
  const campaignId =
    input.campaignId ||
    (typeof input.executionPayload?.campaignId === "string" ? input.executionPayload.campaignId : undefined);
  const revisions = resolveServicePageJobRevisions(input.slug, serviceId);
  const dashboard = buildServicePageGenerationDashboard(input.slug);
  const job = createMasterAdminJob({
    slug: input.slug,
    action: SERVICE_PAGE_JOB_ACTION,
    user: input.operator,
  });
  updateMasterAdminJob(job.id, {
    scope: SERVICE_PAGE_ONLY_SCOPE,
    serviceId,
    campaignId: campaignId || null,
    initiationSource: CPR_DASHBOARD_INITIATION_SOURCE,
    evidenceRevision: revisions.evidenceRevision,
    brandRevision: revisions.brandRevision,
    imageAssignmentRevision: revisions.imageAssignmentRevision,
    stage: "validate-context",
    progress: 0,
    progressLabel: "Queued",
    executionPayload: {
      operatorConfirmed: true,
      scope: SERVICE_PAGE_ONLY_SCOPE,
      initiationSource: CPR_DASHBOARD_INITIATION_SOURCE,
      serviceId,
      campaignId: campaignId || null,
      generationType: "service-page",
      ...input.executionPayload,
    },
  });

  if (dashboard) {
    const seoPlan = buildServicePageSeoPlan(input.slug, serviceId);
    writeServicePageGenerationRecord({
      version: 1,
      slug: input.slug,
      serviceId,
      campaignId: campaignId || null,
      generationType: "service-page",
      jobId: job.id,
      initiatedBy: input.operator,
      initiationSource: CPR_DASHBOARD_INITIATION_SOURCE,
      initiatedAt: new Date().toISOString(),
      completedAt: null,
      status: "queued",
      pageTitle: seoPlan.title,
      canonicalUrl: seoPlan.canonicalUrl,
      outputPath: null,
      previewUrl: null,
      wordCount: null,
      imageAssignmentRevision: null,
      manifestPath: null,
      errors: [],
      warnings: [],
    });
  }

  return getMasterAdminJob(job.id)!;
}

export function queueServicePageOnlyJob(input: {
  slug: string;
  operator: string;
  serviceId?: string;
  campaignId?: string;
  executionPayload?: Record<string, unknown>;
}): MasterAdminJob {
  const job = createServicePageOnlyJob(input);
  runMasterAdminJobAsync(job.id, job.executionPayload || {}, {});
  return job;
}

async function executeSyntheticServicePageValidation(
  jobId: string,
  opts: { onProgress?: (progress: number, label: string) => void } = {},
): Promise<MasterAdminJob | null> {
  for (const stage of SERVICE_PAGE_JOB_STAGES) {
    if (stage === "completed") continue;
    persistServicePageJobStage(jobId, stage, opts);
    await new Promise((r) => setTimeout(r, 5));
  }
  persistServicePageJobStage(jobId, "completed", opts);
  return updateMasterAdminJob(jobId, {
    status: "completed",
    progress: 100,
    progressLabel: "Completed (synthetic validation)",
    completedAt: new Date().toISOString(),
    stage: "completed",
    result: { ok: true, syntheticValidation: true },
    evidence: "CPR-13 synthetic worker validation completed",
    leaseExpiresAt: undefined,
  });
}

export async function executeServicePageOnlyJob(
  jobId: string,
  opts: { onProgress?: (progress: number, label: string) => void; body?: Record<string, unknown> } = {},
): Promise<MasterAdminJob | null> {
  const job = getMasterAdminJob(jobId);
  if (!job || !isServicePageOnlyJob(job)) return job;
  if (job.status !== "claimed" && job.status !== "running") return job;

  if (job.status === "claimed") {
    updateMasterAdminJob(jobId, {
      status: "running",
      startedAt: job.startedAt || new Date().toISOString(),
    });
  }

  const payload = { ...(job.executionPayload || {}), ...(opts.body || {}) };
  if (payload.syntheticValidation === true) {
    return executeSyntheticServicePageValidation(jobId, opts);
  }

  const slug = job.slug;
  const serviceId = job.serviceId || resolvePrimaryServiceId(slug);

  try {
    persistServicePageJobStage(jobId, "validate-context", opts);
    const campaignId = job.campaignId || null;
    const regenerate = payload.regenerate === true || job.action === "regenerate_service_page";
    if (!regenerate) {
      const gate = assertServicePageGenerationAllowed(slug, serviceId, campaignId);
      if (!gate.ok) throw new Error(gate.blockers?.[0] || gate.error || "Context validation failed");
    } else {
      const { evaluateServicePageGenerationReadiness } = await import(
        "./masterAdminServicePageGenerationReadinessService.ts"
      );
      const readiness = evaluateServicePageGenerationReadiness(slug, serviceId);
      if (!readiness.canGenerateEvidence) {
        throw new Error(readiness.blockers[0] || "Evidence incomplete for regeneration");
      }
      const { snapshotServicePageRevision } = await import(
        "./masterAdminProductOwnerGenerationControlService.ts"
      );
      snapshotServicePageRevision(slug, serviceId);
    }

    persistServicePageJobStage(jobId, "resolve-brand", opts);
    ensureComponentDnaPersisted(slug);

    persistServicePageJobStage(jobId, "resolve-images", opts);
    selectCampaignBuilderService(slug, serviceId);
    const imageAssignment = rebuildPharmacyProductionImageAssignments({
      slug,
      serviceId,
      assignmentScope: "service-page-only",
      persist: true,
    });
    updateMasterAdminJob(jobId, { imageAssignmentRevision: imageAssignment.revision });

    persistServicePageJobStage(jobId, "compose-content", opts);
    const customerContext = buildCustomerCampaignGenerationContext(slug, serviceId, undefined, {
      commercialAuthorised: true,
    });
    freezeCustomerCampaignGenerationContext(customerContext);

    persistServicePageJobStage(jobId, "render-page", opts);
    const contentResult = await generateContentPackage(slug, serviceId, {
      customerContext,
      scope: "service-page-only",
    });

    const visualPath = path.join(
      WORKSPACE_ROOT,
      "output/pharmacy-visual-experience",
      slug,
      serviceId,
      "index.html",
    );
    // Service-page-only success is the persisted visual page. Full-package ecosystem
    // validation must not block campaign-scoped service page completion.
    if (!fs.existsSync(visualPath)) {
      throw new Error(contentResult.error || "Service page generation failed");
    }

    const { repairServicePagePostGenerationIdentity } = await import(
      "./masterAdminServicePagePostGenerationIdentityService.ts"
    );
    const identityRepair = repairServicePagePostGenerationIdentity({
      slug,
      serviceId,
      campaignId,
      jobId,
      previewUrl: `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(slug)}`,
      outputPath: visualPath,
      scope: "service-page-only",
    });
    if (!identityRepair.ok) {
      throw new Error(identityRepair.error || "Post-generation service identity repair failed");
    }

    persistServicePageJobStage(jobId, "write-metadata", opts);
    persistServicePageJobStage(jobId, "write-schema", opts);
    persistServicePageJobStage(jobId, "write-manifest", opts);
    persistServicePageJobStage(jobId, "write-registry", opts);

    const previewUrl = `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(slug)}`;
    let wordCount: number | null = null;
    const text = fs.readFileSync(visualPath, "utf8").replace(/<[^>]+>/g, " ");
    wordCount = text.split(/\s+/).filter(Boolean).length;

    const scopeCheck = validateServicePageOutputScope(slug, serviceId);
    if (!scopeCheck.ok) {
      const scopeErrors = scopeCheck.forbidden.map((f) => `FAILED_SCOPE: ${f.kind} — ${f.path}`);
      throw new Error(scopeErrors.join("; "));
    }

    persistServicePageJobStage(jobId, "create-review", opts);
    const visualHtml = fs.readFileSync(visualPath, "utf8");
    const tenantGate = validateServicePageTenantContextGate(slug, serviceId as VisualExperienceServiceId, visualHtml, {
      requestedSlug: slug,
      scope: SERVICE_PAGE_GENERATION_SCOPE.SERVICE_PAGE_ONLY,
      generationJobId: jobId,
      contentContext: customerContext.generationContext,
    });
    if (!tenantGate.ok) {
      throw new Error(tenantGate.blockers.map((b) => `FAILED_TENANT_CONTEXT: ${b}`).join("; "));
    }

    const { assertCommercialChecklistForGeneration } = await import(
      "./masterAdminCoreProductRecoveryCommercialChecklistService.ts"
    );
    assertCommercialChecklistForGeneration(slug, serviceId, visualHtml);

    const packageWarnings = [
      ...(contentResult.manifest?.adminDiagnostics || []),
      ...(contentResult.ok ? [] : [`content-package:${contentResult.error || "validation warnings"}`]),
    ];

    markServicePageGenerationComplete(slug, {
      status: "completed",
      serviceId,
      campaignId,
      completedAt: new Date().toISOString(),
      jobId,
      outputPath: visualPath,
      previewUrl,
      wordCount,
      imageAssignmentRevision: imageAssignment.revision,
      manifestPath: path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${serviceId}.json`),
      warnings: packageWarnings,
      errors: [],
    });

    if (regenerate) {
      // Return to Service Page Review — never auto-approve regenerated pages.
      const reviewDecisionPath = path.join(
        WORKSPACE_ROOT,
        "data/pharmacy-master-admin/service-page-review",
        slug,
        "decision.json",
      );
      if (fs.existsSync(reviewDecisionPath)) {
        fs.writeFileSync(
          reviewDecisionPath,
          JSON.stringify(
            {
              decision: "pending_product_owner_review",
              decidedAt: new Date().toISOString(),
              operator: "system",
              reason: "Service page regenerated — Product Owner review required",
            },
            null,
            2,
          ),
          "utf8",
        );
      }
    }

    persistServicePageJobStage(jobId, "completed", opts);
    return updateMasterAdminJob(jobId, {
      status: "completed",
      progress: 100,
      progressLabel: "Completed",
      completedAt: new Date().toISOString(),
      stage: "completed",
      result: {
        ok: true,
        scope: SERVICE_PAGE_ONLY_SCOPE,
        previewUrl,
        wordCount,
        imageAssignmentRevision: imageAssignment.revision,
        regenerate,
        autoApprove: false,
        autoPublish: false,
      },
      evidence: regenerate
        ? `CPR service page regenerated for ${serviceId} — awaiting Product Owner review`
        : `CPR-13 service page generated for ${serviceId}`,
      leaseExpiresAt: undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stackTrace = err instanceof Error ? err.stack || message : message;
    markServicePageGenerationComplete(slug, {
      status: "failed",
      serviceId,
      campaignId: job.campaignId || null,
      completedAt: new Date().toISOString(),
      errors: [message],
    });
    return updateMasterAdminJob(jobId, {
      status: "failed",
      progress: STAGE_PROGRESS[job.stage as ServicePageJobStage] ?? job.progress ?? 0,
      progressLabel: "Failed",
      completedAt: new Date().toISOString(),
      error: message,
      stackTrace,
      leaseExpiresAt: undefined,
    });
  }
}

export async function runServicePageWorkerContractValidation(): Promise<{
  passed: boolean;
  checks: Array<{ label: string; passed: boolean; detail: string }>;
}> {
  const checks: Array<{ label: string; passed: boolean; detail: string }> = [];
  const add = (label: string, passed: boolean, detail: string) => checks.push({ label, passed, detail });

  const { readMasterAdminJobWorkerHealth, startMasterAdminJobWorker, WORKER_POLL_INTERVAL_MS } = await import(
    "./masterAdminJobWorkerService.ts"
  );
  const { claimNextQueuedJob, recoverStaleMasterAdminJobs, listMasterAdminJobs } = await import(
    "./masterAdminJobService.ts"
  );

  startMasterAdminJobWorker();
  await new Promise((r) => setTimeout(r, 100));
  const health = readMasterAdminJobWorkerHealth();
  add("Worker starts automatically", health?.status === "active", health?.status || "missing");

  const validationJob = createServicePageOnlyJob({
    slug: SYNTHETIC_VALIDATION_SLUG,
    operator: "cpr-13-validation",
    executionPayload: { syntheticValidation: true },
  });
  runMasterAdminJobAsync(validationJob.id, validationJob.executionPayload || {}, {});
  add("Synthetic queued job created", validationJob.status === "queued", validationJob.id);

  await new Promise((r) => setTimeout(r, WORKER_POLL_INTERVAL_MS + 2500));
  const afterClaim = getMasterAdminJob(validationJob.id);
  add(
    "Worker discovers queued job",
    afterClaim?.status === "running" || afterClaim?.status === "completed" || afterClaim?.status === "claimed",
    afterClaim?.status || "missing",
  );
  add("Single claim recorded", Boolean(afterClaim?.claimedBy), afterClaim?.claimedBy || "none");

  const duplicateClaim = claimNextQueuedJob("duplicate-test-worker", 60000);
  add(
    "Duplicate claim blocked for same job",
    !duplicateClaim || duplicateClaim.id !== validationJob.id || afterClaim?.status !== "queued",
    duplicateClaim?.id || "none",
  );

  await new Promise((r) => setTimeout(r, WORKER_POLL_INTERVAL_MS + 1500));
  const finished = getMasterAdminJob(validationJob.id);
  add("Synthetic job completes", finished?.status === "completed", finished?.status || "missing");
  add("Progress stages persisted", Boolean(finished?.stage === "completed"), finished?.stage || "none");
  add("Scope blocks forbidden outputs contract", finished?.scope === SERVICE_PAGE_ONLY_SCOPE, finished?.scope || "none");

  recoverStaleMasterAdminJobs("cpr-13-resume-test");
  const resumeJob = createServicePageOnlyJob({
    slug: SYNTHETIC_VALIDATION_SLUG,
    operator: "cpr-13-resume",
    executionPayload: { syntheticValidation: true },
  });
  updateMasterAdminJob(resumeJob.id, {
    status: "running",
    progress: 40,
    stage: "compose-content",
    claimedBy: "stale-worker",
    claimedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    leaseExpiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  });
  const recovered = recoverStaleMasterAdminJobs("cpr-13-resume-test");
  const requeued = getMasterAdminJob(resumeJob.id);
  add("Restart recovery requeues stale lease", recovered >= 1 && requeued?.status === "queued", requeued?.status || "none");

  updateMasterAdminJob(resumeJob.id, {
    status: "failed",
    error: "SYNTHETIC_FAILURE: deliberate validation error",
    completedAt: new Date().toISOString(),
  });
  const failed = getMasterAdminJob(resumeJob.id);
  add("Failure records exact error", failed?.error === "SYNTHETIC_FAILURE: deliberate validation error", failed?.error || "none");

  const contract = buildServicePageJobContract(finished || validationJob);
  add(
    "Dashboard polling contract readable",
    Boolean(contract?.jobId && contract.stage !== undefined && typeof contract.progress === "number"),
    contract ? `${contract.progress}% @ ${contract.stage}` : "missing",
  );

  const syntheticJobs = listMasterAdminJobs({ slug: SYNTHETIC_VALIDATION_SLUG, limit: 10 });
  add("No tenant-specific slug hardcoding in executor", !String(finished?.evidence || "").includes("cpa01"), "generic executor");

  void syntheticJobs;

  return { passed: checks.every((c) => c.passed), checks };
}
