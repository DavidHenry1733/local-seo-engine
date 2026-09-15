/**
 * NT-E2E-15 — Product Owner-authorised ecosystem generation (orchestration only).
 * Historical accidental packages are preserved but do not satisfy authorised gates.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { loadContentPackage } from "./pharmacyContentPackageService.ts";
import { readLatestApprovalSnapshot } from "./masterAdminBusinessProfileReviewService.ts";
import { readCommercialIntelligenceApproval } from "./masterAdminWorkflowAckService.ts";
import {
  isCommercialIntelligenceApproved,
  readCommercialIntelligenceApprovalExtended,
} from "./masterAdminCommercialIntelligenceWorkflowService.ts";
import { listMasterAdminJobs, type MasterAdminJob } from "./masterAdminJobService.ts";
import { runPreGenerationValidation } from "./masterAdminPreGenerationValidation.ts";
import { buildGenerationSetupState } from "./masterAdminGenerationSetupService.ts";
import { getPharmacyComponentDnaPath } from "./masterAdminComponentDnaPersistenceService.ts";
import { PHARMACY_WORKSPACE_ROOT, getPharmacyBrandDnaPath, getContentEcosystemDir } from "./pharmacyWorkspacePaths.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { loadGenerationReport } from "./pharmacyGenerationIntegrityService.ts";
import {
  buildCanonicalEcosystemGenerationPlan,
  readCanonicalEcosystemGenerationPlan,
  compareCanonicalPlanOutputParity,
  type CanonicalEcosystemGenerationPlan,
} from "./masterAdminCanonicalEcosystemGenerationPlanService.ts";
import {
  isDashboardAuthorisedGenerationRecord,
  isProductOwnerGenerationRequired,
  PRODUCT_OWNER_DASHBOARD_INITIATION_SOURCE,
} from "./masterAdminProductOwnerAcceptanceGenerationService.ts";
import { runImageParityGate } from "./pharmacyImageParityGateService.ts";
import { loadImageAssignments } from "./pharmacyImageOperatingSystem.ts";
import { buildProductionPageSlotInventory } from "./imagePlatform/pharmacyProductionImageSlotInventoryService.ts";

export const HISTORICAL_ACCIDENTAL_JOB_ID = "4a470616-abbc-484e-85d9-73ee1cd520d7";
export const HISTORICAL_ACCIDENTAL_SOURCE = "Accidental pre-approval admin workflow job";

export interface HistoricalEcosystemPackageRecord {
  jobId: string;
  generatedAt: string | null;
  source: string;
  manifestPath: string;
  pageCountEstimate: number;
  imageCountEstimate: number;
  productOwnerAuthorised: false;
  label: string;
  preservedForAudit: true;
}

export interface ExpectedPagePlan {
  homepage: number;
  serviceHubs: number;
  clusterPages: number;
  guides: number;
  blogs: number;
  faqs: number;
  totalPages: number;
  requiredImages: number;
}

export interface PostGenerationValidationSummary {
  ok: boolean;
  checkedAt: string;
  pageCount: number;
  imageCount: number;
  warnings: string[];
  failures: string[];
}

export interface AuthorisedEcosystemGenerationRecord {
  version: 2;
  slug: string;
  authorised: true;
  status: "pending" | "running" | "completed" | "failed";
  jobId: string | null;
  initiatedBy: string | null;
  initiatedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  currentStep: string | null;
  intelligenceApprovalRevision: string | null;
  businessProfileRevision: string | null;
  websiteIntelligenceRevision: string | null;
  brandDnaRevision: string | null;
  componentDnaRevision: string | null;
  layoutDnaRevision: string | null;
  imagePlatformRevision: string | null;
  generationEngineRevision: string | null;
  designIntelligenceRevision: string | null;
  generationRevision: string | null;
  expectedPagePlan: ExpectedPagePlan | null;
  historicalArchivePath: string | null;
  outputPath: string | null;
  manifestPath: string | null;
  registryPath: string | null;
  sitemapPath: string | null;
  manifestChecksum: string | null;
  pageCount: number | null;
  imageCount: number | null;
  warnings: string[];
  failures: string[];
  postGenerationValidation: PostGenerationValidationSummary | null;
  canonicalPlanId?: string | null;
  canonicalPlanRevision?: string | null;
  canonicalPlanChecksum?: string | null;
  completenessStatus?: "COMPLETE" | "FAILED_COMPLETENESS" | "INCOMPLETE_AGAINST_CANONICAL_PLAN" | "SUPERSEDED_INCOMPLETE_RC1" | null;
  imageCompletenessStatus?: "COMPLETE" | "FAILED_IMAGE_COMPLETENESS" | null;
  completenessLabel?: string | null;
  qualityReviewReady?: boolean;
  initiationSource?: import("./masterAdminProductOwnerAcceptanceGenerationModel.ts").AuthorisedGenerationInitiationSource | null;
  packageRevision?: string | null;
}

const AUTHORISED_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/authorised-ecosystem-generation");
const HISTORICAL_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/historical-ecosystem-packages");

function authorisedPath(slug: string): string {
  return path.join(AUTHORISED_DIR, slug, "latest.json");
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function hashFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function fileRevision(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.statSync(filePath).mtime.toISOString();
}

import { resolveClusterPageSlug, resolveClusterPageUrlPath } from "./pharmacyClusterPageUrlResolver.ts";
import { getContentEcosystemDir } from "./pharmacyWorkspacePaths.ts";

function expectedPagePlanFromCanonical(plan: CanonicalEcosystemGenerationPlan): ExpectedPagePlan {
  const c = plan.coreEcosystem;
  return {
    homepage: c.homepage,
    serviceHubs: c.serviceHubs,
    clusterPages: c.clusterPages,
    guides: c.guides,
    blogs: c.blogs,
    faqs: c.faqs,
    totalPages: c.inventoryTotal,
    requiredImages: c.requiredImageRoles,
  };
}

function buildExpectedPagePlan(slug: string, serviceId: string): ExpectedPagePlan {
  const plan = readCanonicalEcosystemGenerationPlan(slug) || buildCanonicalEcosystemGenerationPlan(slug);
  return expectedPagePlanFromCanonical(plan);
}

function runPostGenerationValidation(slug: string, serviceId: string): PostGenerationValidationSummary {
  const pkg = loadContentPackage(slug, serviceId);
  const report = loadGenerationReport(slug, serviceId);
  const warnings: string[] = [];
  const failures: string[] = [];
  if (!pkg?.generatedAt) failures.push("Content package missing generatedAt");
  if (pkg?.status === "error") failures.push(pkg.generationError || "Content package error");
  const manifest = manifestPath(slug, serviceId);
  const registry = path.join(getContentEcosystemDir(slug, serviceId), "_ecosystem-index.json");
  const sitemap = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug, "sitemap.xml");
  if (!fs.existsSync(manifest)) failures.push("Manifest missing");
  if (!fs.existsSync(registry)) failures.push("Registry missing");
  if (!fs.existsSync(sitemap)) warnings.push("Publish sitemap not yet materialised — expected after generation completes");
  if (report?.warnings?.length) warnings.push(...report.warnings.slice(0, 5).map(String));
  return {
    ok: failures.length === 0,
    checkedAt: new Date().toISOString(),
    pageCount: countPackagePages(pkg),
    imageCount: countPackageImages(slug, serviceId),
    warnings,
    failures,
  };
}

function manifestPath(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${serviceId}.json`);
}

function countPackagePages(pkg: ReturnType<typeof loadContentPackage>): number {
  if (!pkg) return 0;
  return (pkg.assets || []).reduce((sum, a) => sum + (a.count || (a.included ? 1 : 0)), 0);
}

function countPackageImages(slug: string, serviceId: string): number {
  const assignments = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-image-assignments", `${slug}.json`);
  if (!fs.existsSync(assignments)) return 0;
  try {
    const raw = JSON.parse(fs.readFileSync(assignments, "utf8")) as {
      assignments?: Record<string, { serviceId?: string }>;
    };
    return Object.values(raw.assignments || {}).filter((a) => a.serviceId === serviceId).length;
  } catch {
    return 0;
  }
}

export function readAuthorisedEcosystemGenerationRecord(slug: string): AuthorisedEcosystemGenerationRecord | null {
  const file = authorisedPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as AuthorisedEcosystemGenerationRecord;
  } catch {
    return null;
  }
}

export function isAuthorisedEcosystemGenerated(slug: string): boolean {
  const record = readAuthorisedEcosystemGenerationRecord(slug);
  return record?.status === "completed" && Boolean(record.jobId && record.completedAt);
}

export function isAuthorisedEcosystemQualityReviewReady(slug: string): boolean {
  const record = readAuthorisedEcosystemGenerationRecord(slug);
  if (!isAuthorisedEcosystemGenerated(slug) || !record) return false;
  if (isProductOwnerGenerationRequired(slug) && !isDashboardAuthorisedGenerationRecord(slug, record)) return false;
  if (record.completenessStatus === "INCOMPLETE_AGAINST_CANONICAL_PLAN") return false;
  if (record.completenessStatus === "SUPERSEDED_INCOMPLETE_RC1") return false;
  if (record.completenessStatus === "FAILED_COMPLETENESS") return false;
  if (record.qualityReviewReady === false) return false;
  return true;
}

export function readHistoricalEcosystemPackage(slug: string): HistoricalEcosystemPackageRecord | null {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return null;
  const pkg = loadContentPackage(slug, ctx.serviceId);
  if (!pkg?.generatedAt) return null;

  const ciApproval = readCommercialIntelligenceApproval(slug);
  const authorised = readAuthorisedEcosystemGenerationRecord(slug);
  if (authorised?.historicalArchivePath && fs.existsSync(authorised.historicalArchivePath)) {
    return {
      jobId: HISTORICAL_ACCIDENTAL_JOB_ID,
      generatedAt: pkg?.generatedAt || null,
      source: HISTORICAL_ACCIDENTAL_SOURCE,
      manifestPath: authorised.historicalArchivePath,
      pageCountEstimate: countPackagePages(pkg),
      imageCountEstimate: countPackageImages(slug, ctx.serviceId),
      productOwnerAuthorised: false,
      label: "Not Product Owner-authorised",
      preservedForAudit: true,
    };
  }
  if (authorised?.status === "completed") return null;

  const generatedBeforeApproval =
    !ciApproval?.approvedAt || new Date(pkg.generatedAt).getTime() < new Date(ciApproval.approvedAt).getTime();

  if (!generatedBeforeApproval && authorised?.status === "completed") return null;
  if (!generatedBeforeApproval && !authorised && !isAccidentalJobEvidence(slug)) return null;

  return {
    jobId: HISTORICAL_ACCIDENTAL_JOB_ID,
    generatedAt: pkg.generatedAt,
    source: HISTORICAL_ACCIDENTAL_SOURCE,
    manifestPath: manifestPath(slug, ctx.serviceId),
    pageCountEstimate: countPackagePages(pkg),
    imageCountEstimate: countPackageImages(slug, ctx.serviceId),
    productOwnerAuthorised: false,
    label: "Not Product Owner-authorised",
    preservedForAudit: true,
  };
}

function isAccidentalJobEvidence(slug: string): boolean {
  const history = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/workflow-history",
    `${slug}.json`,
  );
  if (!fs.existsSync(history)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(history, "utf8")) as {
      executions?: Array<{ actionId?: string; jobId?: string }>;
    };
    return (raw.executions || []).some(
      (e) => e.actionId === "generate_ecosystem" && e.jobId === HISTORICAL_ACCIDENTAL_JOB_ID,
    );
  } catch {
    return false;
  }
}

export function archiveHistoricalEcosystemPackage(slug: string): string | null {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return null;
  const src = manifestPath(slug, ctx.serviceId);
  if (!fs.existsSync(src)) return null;

  const archiveDir = path.join(HISTORICAL_DIR, slug);
  fs.mkdirSync(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(archiveDir, `accidental-${stamp}.json`);
  fs.copyFileSync(src, dest);

  const genReport = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-generation-reports",
    slug,
    `${ctx.serviceId}.json`,
  );
  if (fs.existsSync(genReport)) {
    fs.copyFileSync(genReport, path.join(archiveDir, `accidental-${stamp}-generation-report.json`));
  }

  return dest;
}

export function beginAuthorisedEcosystemGeneration(
  slug: string,
  operator: string,
  jobId: string,
  initiationSource: import("./masterAdminProductOwnerAcceptanceGenerationModel.ts").AuthorisedGenerationInitiationSource = PRODUCT_OWNER_DASHBOARD_INITIATION_SOURCE,
): AuthorisedEcosystemGenerationRecord {
  const ctx = loadMasterAdminCustomerContext(slug)!;
  const ci = readCommercialIntelligenceApprovalExtended(slug);
  const bpr = readLatestApprovalSnapshot(slug);
  const historicalArchivePath = archiveHistoricalEcosystemPackage(slug);
  const plan = buildCanonicalEcosystemGenerationPlan(slug);
  const expectedPagePlan = expectedPagePlanFromCanonical(plan);
  const brandDnaPath = getPharmacyBrandDnaPath(slug);
  const componentDnaPath = getPharmacyComponentDnaPath(slug);
  const layoutDnaPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-layout-dna", `${slug}.json`);
  const imageAssignmentsPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-image-assignments", `${slug}.json`);
  const websiteIntelPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-website-intelligence", `${slug}.json`);
  const genEnginePath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-generation-reports", slug, `${ctx.serviceId}.json`);
  const outputPath = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug);
  const manifest = manifestPath(slug, ctx.serviceId);
  const registry = path.join(getContentEcosystemDir(slug, ctx.serviceId), "_ecosystem-index.json");
  const sitemap = path.join(outputPath, "sitemap.xml");

  const record: AuthorisedEcosystemGenerationRecord = {
    version: 2,
    slug,
    authorised: true,
    status: "running",
    jobId,
    initiatedBy: operator,
    initiationSource,
    packageRevision: new Date().toISOString(),
    initiatedAt: new Date().toISOString(),
    completedAt: null,
    durationMs: null,
    currentStep: "initialising",
    intelligenceApprovalRevision: ci?.approvedVersion || null,
    businessProfileRevision: bpr?.approvedAt || bpr?.revisionId || null,
    websiteIntelligenceRevision: fileRevision(websiteIntelPath),
    brandDnaRevision: fileRevision(brandDnaPath),
    componentDnaRevision: fileRevision(componentDnaPath),
    layoutDnaRevision: fileRevision(layoutDnaPath),
    imagePlatformRevision: fileRevision(imageAssignmentsPath),
    generationEngineRevision: fileRevision(genEnginePath),
    designIntelligenceRevision: fileRevision(componentDnaPath),
    generationRevision: null,
    expectedPagePlan,
    canonicalPlanId: plan.planId,
    canonicalPlanRevision: plan.planRevision,
    canonicalPlanChecksum: plan.checksum,
    qualityReviewReady: true,
    historicalArchivePath,
    outputPath,
    manifestPath: manifest,
    registryPath: registry,
    sitemapPath: sitemap,
    manifestChecksum: null,
    pageCount: null,
    imageCount: null,
    warnings: [],
    failures: [],
    postGenerationValidation: null,
  };
  writeJsonAtomic(authorisedPath(slug), record);
  return record;
}

export function updateAuthorisedEcosystemGenerationProgress(
  slug: string,
  patch: Partial<Pick<AuthorisedEcosystemGenerationRecord, "currentStep" | "warnings">>,
): AuthorisedEcosystemGenerationRecord | null {
  const existing = readAuthorisedEcosystemGenerationRecord(slug);
  if (!existing || existing.status !== "running") return existing;
  const record: AuthorisedEcosystemGenerationRecord = {
    ...existing,
    currentStep: patch.currentStep ?? existing.currentStep,
    warnings: patch.warnings ?? existing.warnings,
  };
  writeJsonAtomic(authorisedPath(slug), record);
  return record;
}

export function completeAuthorisedEcosystemGeneration(slug: string, job: MasterAdminJob): AuthorisedEcosystemGenerationRecord | null {
  const existing = readAuthorisedEcosystemGenerationRecord(slug);
  if (!existing || existing.jobId !== job.id) return existing;

  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return existing;
  const pkg = loadContentPackage(slug, ctx.serviceId);
  const manifest = manifestPath(slug, ctx.serviceId);
  const completedAt = job.completedAt || new Date().toISOString();
  const initiatedAt = existing.initiatedAt ? new Date(existing.initiatedAt).getTime() : Date.now();
  const postGenerationValidation =
    job.status === "completed" ? runPostGenerationValidation(slug, ctx.serviceId) : null;

  const plan = readCanonicalEcosystemGenerationPlan(slug);
  const parity =
    job.status === "completed" && plan
      ? compareCanonicalPlanOutputParity(slug, ctx.serviceId, plan)
      : null;
  const imageParity =
    job.status === "completed" && plan ? runImageParityGate(slug, ctx.serviceId, plan) : null;
  const completenessStatus =
    job.status !== "completed"
      ? null
      : parity?.ok && imageParity?.ok
        ? "COMPLETE"
        : "FAILED_COMPLETENESS";
  const imageCompletenessStatus = imageParity?.imageCompletenessStatus ?? null;

  const record: AuthorisedEcosystemGenerationRecord = {
    ...existing,
    status: job.status === "completed" ? "completed" : "failed",
    completedAt,
    durationMs: Date.now() - initiatedAt,
    currentStep: job.status === "completed" ? "completed" : "failed",
    generationRevision: pkg?.generatedAt || job.completedAt || null,
    manifestPath: manifest,
    manifestChecksum: hashFile(manifest),
    pageCount: countPackagePages(pkg),
    imageCount: countPackageImages(slug, ctx.serviceId),
    failures:
      job.status === "failed"
        ? [job.error || "Generation failed"]
        : [
            ...(postGenerationValidation?.failures || []),
            ...(parity && !parity.ok
              ? [
                  `Plan/output parity failed: planned ${parity.plannedCount}, generated ${parity.generatedCount}`,
                  ...parity.missingPages.map((p) => `Missing planned page: ${p}`),
                ]
              : []),
            ...(imageParity && !imageParity.ok ? imageParity.failures : []),
          ],
    warnings: postGenerationValidation?.warnings || existing.warnings,
    postGenerationValidation,
    completenessStatus,
    imageCompletenessStatus,
    completenessLabel:
      completenessStatus === "FAILED_COMPLETENESS"
        ? imageParity && !imageParity.ok
          ? "FAILED IMAGE COMPLETENESS"
          : "FAILED COMPLETENESS"
        : completenessStatus === "COMPLETE"
          ? "Complete against canonical plan"
          : null,
    qualityReviewReady: completenessStatus === "COMPLETE" && imageCompletenessStatus === "COMPLETE",
    canonicalPlanId: plan?.planId || existing.canonicalPlanId || null,
    canonicalPlanRevision: plan?.planRevision || existing.canonicalPlanRevision || null,
    canonicalPlanChecksum: plan?.checksum || existing.canonicalPlanChecksum || null,
  };
  writeJsonAtomic(authorisedPath(slug), record);
  return record;
}

export function rerunAuthorisedGenerationCompletenessValidation(
  slug: string,
  jobId: string,
): AuthorisedEcosystemGenerationRecord | null {
  const existing = readAuthorisedEcosystemGenerationRecord(slug);
  if (!existing || existing.jobId !== jobId) return null;
  const job: MasterAdminJob = {
    id: jobId,
    slug,
    action: "generate_ecosystem",
    status: "completed",
    user: existing.initiatedBy || "system",
    createdAt: existing.initiatedAt || new Date().toISOString(),
    updatedAt: existing.completedAt || new Date().toISOString(),
    startedAt: existing.initiatedAt,
    completedAt: existing.completedAt || new Date().toISOString(),
    progress: 100,
    progressLabel: "completed",
    retryCount: 0,
    error: undefined,
    workflowStage: "generate_ecosystem",
  };
  return completeAuthorisedEcosystemGeneration(slug, job);
}

export function buildExpectedPagePlanForSlug(slug: string): ExpectedPagePlan | null {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return null;
  return buildExpectedPagePlan(slug, ctx.serviceId);
}

export function assertAuthorisedEcosystemGenerationAllowed(slug: string): { ok: boolean; error?: string; blockers?: string[] } {
  if (!isCommercialIntelligenceApproved(slug)) {
    return { ok: false, error: "Approve Intelligence before generating the approved ecosystem." };
  }
  if (
    isAuthorisedEcosystemGenerated(slug) &&
    isAuthorisedEcosystemQualityReviewReady(slug) &&
    !isProductOwnerGenerationRequired(slug)
  ) {
    return { ok: false, error: "Authorised ecosystem already generated — open Quality Review." };
  }
  if (
    isProductOwnerGenerationRequired(slug) &&
    isAuthorisedEcosystemGenerated(slug) &&
    isDashboardAuthorisedGenerationRecord(slug)
  ) {
    return { ok: false, error: "Product Owner test package already generated — open Quality Review." };
  }

  const activeJob = listMasterAdminJobs({ slug, limit: 5 }).find(
    (j) => j.action === "generate_ecosystem" && (j.status === "queued" || j.status === "running"),
  );
  if (activeJob) {
    return { ok: false, error: "Authorised ecosystem generation is already in progress." };
  }

  const record = readAuthorisedEcosystemGenerationRecord(slug);
  if (record?.status === "running") {
    return { ok: false, error: "Authorised ecosystem generation is already in progress." };
  }

  const setup = buildGenerationSetupState(slug);
  if (!setup.areasConfirmed || !setup.componentDnaReady) {
    return { ok: false, error: "Generation readiness requirements are not met." };
  }

  const pre = runPreGenerationValidation(slug);
  if (pre.readiness !== "READY TO GENERATE") {
    return { ok: false, error: "Generation blocked by readiness checks.", blockers: pre.blockers };
  }

  return { ok: true };
}
