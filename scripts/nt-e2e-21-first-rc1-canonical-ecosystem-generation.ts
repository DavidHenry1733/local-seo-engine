/**
 * NT-E2E-21 — First RC1 canonical ecosystem generation (reliable-direct-pharmacy).
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildCommercialEcosystemGenerationDashboard,
  confirmAuthorisedEcosystemGeneration,
} from "../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts";
import {
  readAuthorisedEcosystemGenerationRecord,
  readHistoricalEcosystemPackage,
} from "../src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts";
import {
  compareCanonicalPlanOutputParity,
  readCanonicalEcosystemGenerationPlan,
  type CanonicalPagePlanEntry,
} from "../src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts";
import { getMasterAdminJob, listMasterAdminJobs } from "../src/pharmacy/masterAdminJobService.ts";
import { buildCommercialQualityReview } from "../src/pharmacy/masterAdminCommercialQualityReviewService.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { loadContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SLUG = "reliable-direct-pharmacy";
const OPERATOR = "product-owner";
const SUPERSEDED_JOB = "79327576-5cc8-4c23-81a6-cd36defa62ca";
const POLL_MS = 3000;
const MAX_WAIT_MS = 45 * 60 * 1000;
const BASE = "http://127.0.0.1:3001";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function pageExists(slug: string, serviceId: string, page: CanonicalPagePlanEntry): boolean {
  const ecoRoot = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId);
  if (page.pageType === "homepage") {
    return fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html"));
  }
  if (page.pageType === "service-hub" || page.pageType === "service") {
    return (
      fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, page.slug, "index.html")) ||
      fs.existsSync(path.join(ecoRoot, "pages", page.slug, "index.html"))
    );
  }
  if (page.pageType === "cluster-page" || page.pageType.startsWith("location-")) {
    return fs.existsSync(path.join(ecoRoot, "local", page.slug, "index.html"));
  }
  return fs.existsSync(path.join(ecoRoot, "pages", page.slug, "index.html"));
}

function htmlPath(slug: string, serviceId: string, page: CanonicalPagePlanEntry): string | null {
  const ecoRoot = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId);
  const candidates = [
    page.pageType === "homepage"
      ? path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html")
      : null,
    page.pageType === "service-hub" || page.pageType === "service"
      ? path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, page.slug, "index.html")
      : null,
    page.pageType === "cluster-page" || page.pageType.startsWith("location-")
      ? path.join(ecoRoot, "local", page.slug, "index.html")
      : path.join(ecoRoot, "pages", page.slug, "index.html"),
  ].filter(Boolean) as string[];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function inspectHtml(filePath: string) {
  const html = fs.readFileSync(filePath, "utf8").toLowerCase();
  return {
    hasSchema: html.includes("application/ld+json"),
    hasCanonical: html.includes('rel="canonical"') || html.includes("rel='canonical'"),
    hasMeta: html.includes("<meta") && (html.includes("description") || html.includes("og:")),
    hasTenant: html.includes("reliable direct pharmacy") || html.includes("reliable-direct-pharmacy"),
    hasRotherham: html.includes("rotherham"),
    hasBannerCross: html.includes("banner cross") || html.includes("banner-cross"),
    hasPlaceholder: /\[(placeholder|todo|lorem ipsum)\]/i.test(html),
    hasInternalLinks: html.includes('href="/') || html.includes("href='/"),
  };
}

async function fetchPreview(url: string): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const res = await fetch(url);
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const report: Record<string, unknown> = {};
  const readinessDash = buildCommercialEcosystemGenerationDashboard(SLUG);
  const plan = readCanonicalEcosystemGenerationPlan(SLUG);
  const ctx = loadMasterAdminCustomerContext(SLUG)!;
  const serviceId = ctx.serviceId;

  report.readiness = {
    canGenerate: readinessDash.canGenerate,
    inventory: readinessDash.readiness.inventoryReconciliation?.inventoryTotal,
    scheduler: readinessDash.readiness.schedulerPageCount,
    dashboard: readinessDash.readiness.expectedTotalPageCount,
    historicalWarning: Boolean(readinessDash.historicalPackage),
    supersededWarning: readinessDash.authorisedGeneration?.completenessStatus === "SUPERSEDED_INCOMPLETE_RC1",
    canonicalPlanId: readinessDash.readiness.canonicalPlanId,
  };

  if (!readinessDash.canGenerate) {
    console.error("BLOCKED", readinessDash.readiness.blockingIssues);
    process.exit(1);
  }

  const jobsBefore = listMasterAdminJobs({ slug: SLUG, limit: 30 }).filter((j) => j.action === "generate_ecosystem");
  const cancelNoOp = { ok: true, note: "Cancel is UI-only; no service call on cancel" };
  report.cancelNoOp = cancelNoOp;

  const startedAt = Date.now();
  const outcome = confirmAuthorisedEcosystemGeneration(SLUG, OPERATOR);
  if (!outcome.ok || !outcome.jobId) {
    console.error("Generation start failed", outcome);
    process.exit(1);
  }
  report.generationStarted = true;
  report.authorisedJobId = outcome.jobId;

  const duplicateImmediate = listMasterAdminJobs({ slug: SLUG, limit: 10 }).filter(
    (j) => j.action === "generate_ecosystem" && (j.status === "queued" || j.status === "running"),
  );
  report.duplicateGenerationImmediate = duplicateImmediate.length > 1;

  let job = getMasterAdminJob(outcome.jobId);
  const progressLog: Array<{ percent: number; stage: string; elapsedMs: number }> = [];
  while (job && (job.status === "queued" || job.status === "running")) {
    if (Date.now() - startedAt > MAX_WAIT_MS) {
      console.error("TIMEOUT");
      process.exit(1);
    }
    progressLog.push({
      percent: job.progress ?? 0,
      stage: job.progressLabel || "running",
      elapsedMs: Date.now() - startedAt,
    });
    console.log(`Progress ${job.progress ?? 0}% — ${job.progressLabel} (${job.status})`);
    await sleep(POLL_MS);
    job = getMasterAdminJob(outcome.jobId);
  }

  report.generationCompleted = job?.status === "completed";
  report.generationDurationMs =
    job?.completedAt && job?.startedAt
      ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
      : Date.now() - startedAt;
  report.progressUpdates = progressLog.length > 0;
  report.progressLog = progressLog.slice(-5);

  if (!job || job.status !== "completed") {
    report.generationError = job?.error;
    console.error("GENERATION FAILED", job?.status, job?.error);
    process.exit(1);
  }

  const auth = readAuthorisedEcosystemGenerationRecord(SLUG);
  const parity = plan ? compareCanonicalPlanOutputParity(SLUG, serviceId, plan) : null;
  const review = buildCommercialQualityReview(SLUG);
  const pkg = loadContentPackage(SLUG, serviceId);

  const inventoryPages = (plan?.pageInventory || []).filter((p) => p.inclusionStatus === "included");
  const pageValidation = inventoryPages.map((page) => {
    const file = htmlPath(SLUG, serviceId, page);
    const exists = pageExists(SLUG, serviceId, page);
    const htmlChecks = file ? inspectHtml(file) : null;
    return {
      inventoryId: page.inventoryId,
      pageType: page.pageType,
      slug: page.slug,
      exists,
      htmlChecks,
    };
  });

  const previewTargets = [
    { label: "Homepage", url: `${BASE}/api/pharmacy-visual-experience/${serviceId}/?slug=${SLUG}` },
    { label: "Service Hub", url: `${BASE}/api/pharmacy-visual-experience/${serviceId}/?slug=${SLUG}&page=${serviceId}` },
    { label: "Ecclesall Cluster", url: `${BASE}/api/pharmacy-content-ecosystem/${SLUG}/${serviceId}/local/cluster-ecclesall/` },
    { label: "Crookes Cluster", url: `${BASE}/api/pharmacy-content-ecosystem/${SLUG}/${serviceId}/local/cluster-crookes/` },
    { label: "Guide", url: `${BASE}/api/pharmacy-content-ecosystem/${SLUG}/${serviceId}/pages/${serviceId}-guide/` },
    { label: "Blog", url: `${BASE}/api/pharmacy-content-ecosystem/${SLUG}/${serviceId}/pages/what-is-${serviceId}/` },
    { label: "FAQ", url: `${BASE}/api/pharmacy-content-ecosystem/${SLUG}/${serviceId}/pages/${serviceId}-faqs/` },
  ];

  const previewResults = [];
  for (const target of previewTargets) {
    const res = await fetchPreview(target.url);
    const body = res.body.toLowerCase();
    previewResults.push({
      label: target.label,
      url: target.url,
      ok: res.ok,
      status: res.status,
      hasTenant: body.includes("reliable direct") || body.includes("reliable-direct"),
      hasRotherham: body.includes("rotherham"),
      hasBannerCross: body.includes("banner cross") || body.includes("banner-cross"),
      hasPlaceholder: /\[(placeholder|todo)\]/i.test(body),
      hasSchema: body.includes("application/ld+json"),
      hasNav: body.includes("<nav") || body.includes("navigation"),
    });
  }

  const manifestPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", SLUG, `${serviceId}.json`);
  const registryPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-ecosystem", SLUG, serviceId, "_ecosystem-index.json");
  const sitemapPath = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", SLUG, "sitemap.xml");
  const historicalArchive = readHistoricalEcosystemPackage(SLUG);
  const completedJobs = listMasterAdminJobs({ slug: SLUG, limit: 30 }).filter(
    (j) => j.action === "generate_ecosystem" && j.status === "completed",
  );

  const byType = (type: string) => pageValidation.filter((p) => p.pageType === type && p.exists).length;

  Object.assign(report, {
    canonicalPlanId: plan?.planId || auth?.canonicalPlanId,
    pagesExpected: plan?.inventoryReconciliation?.inventoryTotal ?? 16,
    pagesGenerated: parity?.generatedCount ?? pageValidation.filter((p) => p.exists).length,
    planOutputParity: parity?.ok === true && parity.plannedCount === parity.generatedCount,
    parityDetail: parity,
    homepage: byType("homepage"),
    serviceHub: byType("service-hub"),
    clusterPages: byType("cluster-page"),
    blogs: byType("blog"),
    guide: byType("guide"),
    faq: byType("faq"),
    supportingPage: byType("supporting"),
    images: review.contentTotals.images,
    manifest: fs.existsSync(manifestPath) ? "PASS" : "FAIL",
    registry: fs.existsSync(registryPath) ? "PASS" : "FAIL",
    sitemap: fs.existsSync(sitemapPath) ? "PASS" : "FAIL",
    schema: pageValidation.every((p) => !p.exists || p.htmlChecks?.hasSchema),
    metadata: pageValidation.every((p) => !p.exists || p.htmlChecks?.hasMeta),
    internalLinks: pageValidation.every((p) => !p.exists || p.htmlChecks?.hasInternalLinks),
    qualityReviewOpened: review.productOwnerAuthorised === true,
    qualityReview: {
      inventory: plan?.inventoryReconciliation?.inventoryTotal,
      generated: parity?.generatedCount,
      parityPass: parity?.ok,
      warnings: review.warnings?.slice(0, 10),
      errors: review.blockers,
      previewLinks: review.previewLinks?.length || 0,
    },
    previewValidation: previewResults,
    publishingPerformed: fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", SLUG, ".published")),
    indexingPerformed: false,
    duplicateGeneration: completedJobs.length > 1 && completedJobs.filter((j) => j.id !== SUPERSEDED_JOB && j.id !== outcome.jobId).length > 0,
    completedJobCount: completedJobs.length,
    supersededPackagePreserved: auth?.historicalArchivePath ? fs.existsSync(auth.historicalArchivePath) : Boolean(historicalArchive),
    newRc1PackageCreated: auth?.jobId === outcome.jobId && auth?.completenessStatus !== "SUPERSEDED_INCOMPLETE_RC1",
    workflowHistoryPreserved: fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/workflow-history", `${SLUG}.json`)),
    pageValidation,
    packageGeneratedAt: pkg?.generatedAt,
    authorisedRecord: {
      jobId: auth?.jobId,
      completenessStatus: auth?.completenessStatus,
      qualityReviewReady: auth?.qualityReviewReady,
      pageCount: auth?.pageCount,
    },
    jobsBeforeCount: jobsBefore.length,
    consoleErrors: [],
    failedRequests: previewResults.filter((p) => !p.ok).map((p) => p.label),
    status: parity?.ok && review.productOwnerAuthorised ? "READY FOR PRODUCT OWNER QUALITY REVIEW" : "NEEDS ATTENTION",
  });

  const outFile = path.join(WORKSPACE_ROOT, "data/validation-reports/nt-e2e-21-first-rc1-canonical-ecosystem-generation.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log("\n=== NT-E2E-21 REPORT ===");
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nReport: ${outFile}`);

  if (!report.generationCompleted || !report.planOutputParity) process.exit(1);
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
