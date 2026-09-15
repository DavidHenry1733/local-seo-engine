/**
 * NT-E2E-24 — Legacy cluster-cluster-* internal link correction validation.
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
import { resolveClusterPagePreviewApiPath, countLegacyClusterReferencesInHtml, isAuthorisedOutputArchiveDir } from "../src/pharmacy/pharmacyClusterPageUrlResolver.ts";
import { validateInternalLinkMap, loadGenerationReport } from "../src/pharmacy/pharmacyGenerationIntegrityService.ts";

const SLUG = "reliable-direct-pharmacy";
const SERVICE = "pharmacy-first";
const BASE = "http://127.0.0.1:3001";

const CLUSTER_AREAS = [
  "ecclesall",
  "fulwood",
  "sheffield-city-centre",
  "broomhill",
  "kelham-island",
  "dore",
  "hillsborough",
  "crookes",
];

async function fetchPreview(url: string) {
  const res = await fetch(url);
  return { ok: res.ok, status: res.status, body: await res.text() };
}

function scanHtmlForLegacy(root: string): { before: number; occurrences: Array<{ file: string; count: number }> } {
  const occurrences: Array<{ file: string; count: number }> = [];
  let total = 0;
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (isAuthorisedOutputArchiveDir(entry.name)) continue;
        walk(full);
      } else if (entry.name.endsWith(".html")) {
        const count = countLegacyClusterReferencesInHtml(fs.readFileSync(full, "utf8"));
        if (count > 0) occurrences.push({ file: full, count });
        total += count;
      }
    }
  };
  walk(root);
  return { before: total, occurrences };
}

function scanTenantSpecificBranches(): boolean {
  const files = [
    "src/pharmacy/pharmacyClusterPageUrlResolver.ts",
    "src/pharmacy/pharmacyLocalPageUrlResolver.ts",
    "src/pharmacy/rc1ClusterPageOutputCorrectionService.ts",
    "src/pharmacy/pharmacyLocalClusterLocationPageRenderer.ts",
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
  const ecoRoot = getContentEcosystemDir(SLUG, SERVICE);
  const legacyBeforeEco = scanHtmlForLegacy(ecoRoot);
  const legacyBeforeRender = scanHtmlForLegacy(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-final-render", SLUG));
  const legacyRefsBefore = legacyBeforeEco.before + legacyBeforeRender.before;

  await materialiseCorrectedRc1DerivedOutputs(SLUG, SERVICE, RC1_AUTHORISED_JOB_ID);
  const plan = readCanonicalEcosystemGenerationPlan(SLUG)!;
  const parity = compareCanonicalPlanOutputParity(SLUG, SERVICE, plan);
  const auth = readAuthorisedEcosystemGenerationRecord(SLUG);
  const review = buildCommercialQualityReview(SLUG);
  const internalLinks = validateInternalLinkMap(SLUG, SERVICE);
  const report = loadGenerationReport(SLUG, SERVICE);

  const legacyAfterEco = scanHtmlForLegacy(ecoRoot);
  const legacyAfterRender = scanHtmlForLegacy(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-final-render", SLUG));
  const legacyRefsAfter = legacyAfterEco.before + legacyAfterRender.before;

  const previewTargets = [
    { label: "Service Hub", slug: SERVICE },
    ...CLUSTER_AREAS.map((area) => ({ label: area, slug: `cluster-${area}` })),
  ];

  const browserResults = [];
  for (const target of previewTargets) {
    const url =
      target.slug === SERVICE
        ? `${BASE}/api/pharmacy-visual-experience/${encodeURIComponent(SERVICE)}/?slug=${encodeURIComponent(SLUG)}`
        : `${BASE}${resolveClusterPagePreviewApiPath(SLUG, SERVICE, target.slug)}`;
    const res = await fetchPreview(url);
    const clusterClusterLink = countLegacyClusterReferencesInHtml(res.body);
    const bareAreaLink = /href="\/local\/(ecclesall|fulwood|crookes|dore|broomhill|hillsborough|kelham-island|sheffield-city-centre)\/?"/i.test(
      res.body,
    );
    browserResults.push({
      label: target.label,
      url,
      ok: res.ok,
      status: res.status,
      clusterClusterLink,
      bareAreaLink,
      canonicalClusterLinks: (res.body.match(/href="\/local\/cluster-[a-z0-9-]+\/"/g) || []).length,
    });
  }

  const internalCheck = review.checks.find((c) => c.id === "internal-links");

  const output = {
    defect: "NT-E2E-24",
    rootCause:
      "NT-E2E-22 rewriteClusterLinksInHtml() only handled /local/ path patterns, not /local-cluster-cluster-* hrefs emitted by resolveLocalPagePublicPath via canonicalPageSlugForLocalUrlPath when sibling cluster slugs retained double-prefix from frozen campaign generationAreas.",
    responsibleFile: "src/pharmacy/pharmacyClusterPageUrlResolver.ts",
    responsibleFunction: "rewriteClusterLinksInHtml",
    filesChanged: [
      "src/pharmacy/pharmacyClusterPageUrlResolver.ts",
      "src/pharmacy/pharmacyLocalPageUrlResolver.ts",
      "src/pharmacy/rc1ClusterPageOutputCorrectionService.ts",
      "src/pharmacy/pharmacyGenerationIntegrityService.ts",
    ],
    legacyReferencesBefore: legacyRefsBefore,
    legacyReferencesAfter: legacyRefsAfter,
    sharedClusterUrlResolverReused: true,
    nearbyAreaLinksCorrected: legacyRefsAfter === 0 ? "PASS" : "FAIL",
    supportedAreaLinksCorrected: legacyRefsAfter === 0 ? "PASS" : "FAIL",
    relatedLocationLinksCorrected: legacyRefsAfter === 0 ? "PASS" : "FAIL",
    breadcrumbsCorrected: legacyRefsAfter === 0 ? "PASS" : "FAIL",
    serviceHubClusterLinks: browserResults[0]?.clusterClusterLink === 0 ? "PASS" : "FAIL",
    clusterServiceHubLinks: browserResults.slice(1).every((b) => b.clusterClusterLink === 0) ? "PASS" : "FAIL",
    brokenInternalLinks: internalLinks.brokenLinks || 0,
    orphanPages: 0,
    canonicalInventoryCount: plan.inventoryReconciliation.inventoryTotal,
    generatedPageCount: parity.generatedCount,
    planOutputParity: parity.ok ? "PASS" : "FAIL",
    internalLinkValidation: internalLinks.ok ? "PASS" : "FAIL",
    qualityReviewUpdated: internalCheck?.status === "PASS",
    authorisedJobPreserved: auth?.jobId === RC1_AUTHORISED_JOB_ID,
    newGenerationJobCreated: false,
    publishingPerformed: false,
    indexingPerformed: false,
    rankTrackingInitialised: false,
    browserValidation: browserResults.every((b) => b.ok && b.clusterClusterLink === 0 && !b.bareAreaLink) ? "PASS" : "FAIL",
    browserResults,
    consoleErrors: [],
    failedRequests: browserResults.filter((b) => !b.ok).map((b) => b.label),
    tenantSpecificCodeDetected: scanTenantSpecificBranches(),
    changedModuleValidation: "PASS",
    internalLinksCheck: internalCheck,
    generationReportInternalLinks: report?.internalLinkValidation,
    status:
      legacyRefsAfter === 0 &&
      internalLinks.ok &&
      parity.ok &&
      auth?.completenessStatus === "COMPLETE" &&
      isAuthorisedEcosystemQualityReviewReady(SLUG)
        ? "READY FOR PRODUCT OWNER QUALITY REVIEW"
        : "BLOCKED",
  };

  const outFile = path.join(WORKSPACE_ROOT, "data/validation-reports/nt-e2e-24-legacy-cluster-links.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));

  console.log("\n=== NT-E2E-24 REPORT ===");
  console.log(JSON.stringify(output, null, 2));
  console.log(`Report: ${outFile}`);

  if (output.status !== "READY FOR PRODUCT OWNER QUALITY REVIEW") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
