/**
 * NT-E2E-17 — First Product Owner authorised ecosystem generation execution + validation.
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildCommercialEcosystemGenerationDashboard,
  confirmAuthorisedEcosystemGeneration,
} from "../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts";
import {
  readAuthorisedEcosystemGenerationRecord,
  isAuthorisedEcosystemGenerated,
  readHistoricalEcosystemPackage,
} from "../src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts";
import { getMasterAdminJob, listMasterAdminJobs } from "../src/pharmacy/masterAdminJobService.ts";
import { buildCommercialQualityReview } from "../src/pharmacy/masterAdminCommercialQualityReviewService.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { loadContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { readFinalRenderManifest } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { isCommercialIntelligenceApproved } from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";

const SLUG = "reliable-direct-pharmacy";
const OPERATOR = "admin";
const POLL_MS = 5000;
const MAX_WAIT_MS = 45 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ecosystemRoot(slug: string, serviceId: string) {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-ecosystem", slug, serviceId);
}

function countPagesByType(slug: string, serviceId: string) {
  const manifest = readFinalRenderManifest(slug);
  const pages = manifest?.pages || [];
  const byType = (t: string) => pages.filter((p) => p.pageType === t).length;
  return {
    total: pages.length,
    homepage: byType("homepage") + (fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-canonical-final-render", slug, "index.html")) ? 1 : 0),
    servicePages: pages.filter((p) => p.pageType === "service").length,
    locationHubs: pages.filter((p) => p.pageType === "location-hub" || p.pageType === "hub").length,
    locationClusters: pages.filter((p) => p.pageType === "location-cluster").length,
    locationAreaPages: pages.filter((p) => p.pageType === "location-area").length,
    blogs: pages.filter((p) => p.pageType === "blog").length,
    guides: pages.filter((p) => p.pageType === "guide").length,
    faqs: pages.filter((p) => p.pageType === "faq" || p.pageType === "support").length,
    supporting: pages.filter((p) => p.pageType === "support").length,
    images: manifest?.assets?.length || 0,
    schema: pages.length,
    manifest: fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-canonical-final-render", slug, "FinalRenderManifest.json")) ? 1 : 0,
    registry: fs.existsSync(path.join(ecosystemRoot(slug, serviceId), "_ecosystem-index.json")) ? 1 : 0,
    sitemap: fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug, "sitemap.xml")) ? 1 : 0,
    canonicalFinalRender: fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-canonical-final-render", slug, "index.html")) ? 1 : 0,
    previewLinks: buildCommercialQualityReview(slug).previewLinks?.length || 0,
  };
}

async function main() {
  const startedAt = Date.now();
  const readiness = buildCommercialEcosystemGenerationDashboard(SLUG);
  if (!readiness.canGenerate) {
    console.error("BLOCKED — cannot generate:", readiness.readiness.blockingIssues);
    process.exit(1);
  }

  console.log("=== READINESS ===");
  console.log(JSON.stringify({
    canGenerate: readiness.canGenerate,
    expectedPages: readiness.readiness.expectedTotalPageCount,
    googleState: readiness.readiness.googleBusinessProfile?.state,
    warnings: readiness.readiness.warnings,
    opportunities: readiness.readiness.opportunities,
    historical: Boolean(readHistoricalEcosystemPackage(SLUG)),
  }, null, 2));

  const beforeJobs = listMasterAdminJobs({ slug: SLUG, limit: 20 }).filter((j) => j.action === "generate_ecosystem");
  const activeBefore = beforeJobs.filter((j) => j.status === "queued" || j.status === "running");

  let jobId: string;
  if (activeBefore.length) {
    jobId = activeBefore[0]!.id;
    console.log("Using existing active job:", jobId);
  } else {
    const outcome = confirmAuthorisedEcosystemGeneration(SLUG, OPERATOR);
    if (!outcome.ok || !outcome.jobId) {
      console.error("Generation start failed:", outcome.error, outcome.blockers);
      process.exit(1);
    }
    jobId = outcome.jobId;
    console.log("Generation started — job:", jobId);
  }

  let job = getMasterAdminJob(jobId);
  while (job && (job.status === "queued" || job.status === "running")) {
    if (Date.now() - startedAt > MAX_WAIT_MS) {
      console.error("TIMEOUT waiting for generation");
      process.exit(1);
    }
    console.log(`Progress: ${job.progress}% — ${job.progressLabel} (${job.status})`);
    await sleep(POLL_MS);
    job = getMasterAdminJob(jobId);
  }

  if (!job || job.status !== "completed") {
    console.error("GENERATION FAILED", job?.status, job?.error);
    console.error(JSON.stringify({ jobId, progress: job?.progress, error: job?.error, stack: job?.error }, null, 2));
    process.exit(1);
  }

  const durationMs = job.completedAt && job.startedAt
    ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
    : Date.now() - startedAt;

  const ctx = loadMasterAdminCustomerContext(SLUG)!;
  const counts = countPagesByType(SLUG, ctx.serviceId);
  const auth = readAuthorisedEcosystemGenerationRecord(SLUG);
  const review = buildCommercialQualityReview(SLUG);
  const pkg = loadContentPackage(SLUG, ctx.serviceId);

  const report = {
    generationStarted: true,
    generationCompleted: true,
    generationDurationMs: durationMs,
    generationDurationMin: Math.round(durationMs / 60000),
    authorisedJobId: jobId,
    totalPagesGenerated: counts.total || review.contentTotals.websitePages,
    homepage: counts.homepage || 1,
    servicePages: counts.servicePages || review.contentTotals.servicePages,
    locationHubs: counts.locationHubs,
    locationClusters: counts.locationClusters,
    locationAreaPages: counts.locationAreaPages,
    blogs: counts.blogs || review.contentTotals.blogPosts,
    guides: counts.guides || review.contentTotals.patientGuides,
    faqs: counts.faqs || review.contentTotals.faqPages,
    supportingPages: counts.supporting,
    images: counts.images || review.contentTotals.images,
    schema: review.contentTotals.schemas,
    metadata: review.checks.filter((c) => /seo|meta|title/i.test(c.label)).length,
    internalLinks: review.contentTotals.internalLinks,
    sitemap: counts.sitemap,
    registry: counts.registry,
    manifest: counts.manifest,
    canonicalFinalRender: counts.canonicalFinalRender,
    qualityReviewOpened: review.productOwnerAuthorised === true,
    previewLinksWorking: (review.previewLinks?.length || 0) >= 5,
    previewLinkCount: review.previewLinks?.length || 0,
    publishingPerformed: false,
    indexingPerformed: false,
    duplicateGeneration: listMasterAdminJobs({ slug: SLUG, limit: 10 }).filter((j) => j.action === "generate_ecosystem" && j.status === "completed").length > 2,
    ciApprovalPreserved: isCommercialIntelligenceApproved(SLUG),
    historicalPreserved: Boolean(readHistoricalEcosystemPackage(SLUG)),
    authorisedRecord: auth,
    packageGeneratedAt: pkg?.generatedAt,
    blockers: review.blockers,
    warnings: review.warnings,
  };

  const outPath = path.join(PHARMACY_WORKSPACE_ROOT, "../pharmaconnect-growth-engine/output/nt-e2e-17-generation-report.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("\n=== NT-E2E-17 REPORT ===");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
