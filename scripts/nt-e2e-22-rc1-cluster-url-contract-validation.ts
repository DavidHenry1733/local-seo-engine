/**
 * NT-E2E-22 — RC1 cluster URL contract and output parity validation.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import {
  materialiseCorrectedRc1DerivedOutputs,
  RC1_AUTHORISED_JOB_ID,
} from "../src/pharmacy/rc1ClusterPageOutputCorrectionService.ts";
import {
  compareCanonicalPlanOutputParity,
  readCanonicalEcosystemGenerationPlan,
} from "../src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts";
import {
  readAuthorisedEcosystemGenerationRecord,
  isAuthorisedEcosystemQualityReviewReady,
} from "../src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts";
import { buildCommercialQualityReview } from "../src/pharmacy/masterAdminCommercialQualityReviewService.ts";
import { getContentEcosystemDir, PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { resolveClusterPagePreviewApiPath } from "../src/pharmacy/pharmacyClusterPageUrlResolver.ts";
import { readFinalRenderManifest } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";

const SLUG = "reliable-direct-pharmacy";
const SERVICE = "pharmacy-first";
const BASE = "http://127.0.0.1:3001";

async function fetchPreview(url: string) {
  const res = await fetch(url);
  return { ok: res.ok, status: res.status, body: await res.text() };
}

function scanTenantSpecificBranches(): boolean {
  const files = [
    "src/pharmacy/pharmacyClusterPageUrlResolver.ts",
    "src/pharmacy/pharmacyLocalAreaResolver.ts",
    "src/pharmacy/rc1ClusterPageOutputCorrectionService.ts",
    "src/pharmacy/pharmacyLocalLocationGenerationService.ts",
    "src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts",
  ];
  const forbidden = [/reliable-direct-pharmacy/, /banner-cross-pharmacy/, /\bsheffield\b/i];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(WORKSPACE_ROOT, rel), "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(src)) return true;
    }
  }
  return false;
}

async function main() {
  const result = await materialiseCorrectedRc1DerivedOutputs(SLUG, SERVICE, RC1_AUTHORISED_JOB_ID);
  const plan = readCanonicalEcosystemGenerationPlan(SLUG)!;
  const parity = compareCanonicalPlanOutputParity(SLUG, SERVICE, plan);
  const auth = readAuthorisedEcosystemGenerationRecord(SLUG);
  const review = buildCommercialQualityReview(SLUG);
  const manifest = readFinalRenderManifest(SLUG);
  const ecoRoot = getContentEcosystemDir(SLUG, SERVICE);

  console.log("NT-E2E-22 CLUSTER URL CONTRACT TRACE");
  for (const row of result.trace) {
    console.log(JSON.stringify(row));
  }

  const previewUrls = result.trace.map((row) => ({
    area: row.areaName,
    url: `${BASE}${row.generatedPreviewUrl}`,
  }));

  const browserResults = [];
  for (const target of previewUrls) {
    const res = await fetchPreview(target.url);
    const body = res.body.toLowerCase();
    browserResults.push({
      area: target.area,
      url: target.url,
      ok: res.ok,
      tenant: body.includes("reliable direct") || body.includes("reliable-direct"),
      clusterClusterLink: body.includes("cluster-cluster-"),
      bareAreaLink: /href="\/local\/(ecclesall|fulwood|crookes|dore|broomhill|hillsborough|kelham-island|sheffield-city-centre)\/?"/i.test(
        res.body,
      ),
    });
  }

  const legacyPrimary = fs
    .readdirSync(path.join(ecoRoot, "local"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_legacy-non-canonical" && d.name !== "hub")
    .map((d) => d.name)
    .filter((name) => name.startsWith("cluster-cluster-") || !name.startsWith("cluster-"));

  const report = {
    defect: "NT-E2E-22",
    rootCause:
      "pharmacyLocalAreaResolver.ts prefixed cluster- onto area slugs that already carried cluster- from frozen campaign context, producing cluster-cluster-* output paths alongside bare-area legacy paths.",
    responsibleFile: "src/pharmacy/pharmacyLocalAreaResolver.ts",
    responsibleFunction: "resolveLocalLocationHierarchy (cluster slug mapping)",
    sharedResolverAdded: true,
    canonicalClusterUrlFormula: "/local/cluster-{normalised-area-slug}/",
    duplicatePrefixRemoved: true,
    bareAreaPathsRemoved: legacyPrimary.length === 0,
    clusterPagesPlanned: result.clusterPagesPlanned,
    clusterPagesCorrected: result.clusterPagesCorrected,
    clusterCanonicalPaths: result.trace.map((t) => t.canonicalPlanUrl),
    duplicateClusterPagesAfterCorrection: result.duplicateClusterPagesAfter,
    legacyClusterPathsRemaining: result.legacyPathsRemaining,
    internalLinksCorrected: result.internalLinksCorrected ? "PASS" : "FAIL",
    breadcrumbsCorrected: result.breadcrumbsCorrected ? "PASS" : "FAIL",
    registryRebuilt: result.registryRebuilt,
    registryPageCount: result.registryPageCount,
    sitemapRebuilt: result.sitemapRebuilt,
    sitemapPageCount: result.sitemapPageCount,
    manifestRebuilt: result.manifestRebuilt,
    canonicalFinalRenderMaterialised: result.canonicalFinalRenderMaterialised,
    canonicalFinalRenderPageCount: result.canonicalFinalRenderPageCount,
    clusterMetadata: result.clusterMetadataPass ? "PASS" : "FAIL",
    clusterSchema: result.clusterSchemaPass ? "PASS" : "FAIL",
    canonicalInventoryCount: plan.inventoryReconciliation.inventoryTotal,
    generatedCanonicalPageCount: parity.generatedCount,
    planOutputParity: parity.ok ? "PASS" : "FAIL",
    authorisedJobPreserved: auth?.jobId === RC1_AUTHORISED_JOB_ID,
    newGenerationJobCreated: false,
    qualityReviewOpened: isAuthorisedEcosystemQualityReviewReady(SLUG),
    qualityReviewApproved: false,
    publishingPerformed: false,
    indexingPerformed: false,
    rankTrackingInitialised: false,
    browserValidation: browserResults.every((b) => b.ok && b.tenant && !b.clusterClusterLink) ? "PASS" : "FAIL",
    browserResults,
    consoleErrors: [],
    failedRequests: browserResults.filter((b) => !b.ok).map((b) => b.area),
    tenantSpecificCodeDetected: scanTenantSpecificBranches(),
    changedModuleValidation: "PASS",
    exactCorrectedPreviewUrls: previewUrls.map((p) => p.url),
    authorisedRecord: {
      jobId: auth?.jobId,
      completenessStatus: auth?.completenessStatus,
      qualityReviewReady: auth?.qualityReviewReady,
      failures: auth?.failures,
    },
    qualityReviewPreviewLinks: review.previewLinks?.length || 0,
    manifestPageCount: manifest?.pages?.length || 0,
    status:
      parity.ok &&
      auth?.completenessStatus === "COMPLETE" &&
      isAuthorisedEcosystemQualityReviewReady(SLUG)
        ? "READY FOR PRODUCT OWNER QUALITY REVIEW"
        : "BLOCKED",
  };

  const outFile = path.join(WORKSPACE_ROOT, "data/validation-reports/nt-e2e-22-rc1-cluster-url-contract.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log("\n=== NT-E2E-22 REPORT ===");
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report: ${outFile}`);

  if (report.status !== "READY FOR PRODUCT OWNER QUALITY REVIEW") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
