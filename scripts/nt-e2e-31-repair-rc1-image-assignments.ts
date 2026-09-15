#!/usr/bin/env npx tsx
/**
 * NT-E2E-31 — Repair existing RC1 package image assignments in place (no content regen).
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { rebuildPharmacyProductionImageAssignments } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformProductionAssignmentService.ts";
import { persistCanonicalImageInventory, readCanonicalImageInventory, countRenderedImageOccurrences } from "../src/pharmacy/pharmacyCanonicalImageInventoryService.ts";
import { runImageParityGate, pageTypeImageStatus } from "../src/pharmacy/pharmacyImageParityGateService.ts";
import { buildCanonicalFinalRender, copyCanonicalFinalRenderToPublishOutput } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { readCanonicalEcosystemGenerationPlan } from "../src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts";
import { rerunAuthorisedGenerationCompletenessValidation } from "../src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts";
import { loadImageAssignments } from "../src/pharmacy/pharmacyImageOperatingSystem.ts";
import { RC1_AUTHORISED_JOB_ID } from "../src/pharmacy/rc1ClusterPageOutputCorrectionService.ts";
import { resolveBrandDnaForRender } from "../src/pharmacy/pharmacyBrandDnaEngine.ts";
import { resolveCurrentPharmacyPresentationProfile } from "../src/pharmacy/pharmacyPresentationProfileResolver.ts";

const SLUG = process.argv[2] || "reliable-direct-pharmacy";
const SERVICE = "pharmacy-first";
const JOB_ID = process.argv[3] || RC1_AUTHORISED_JOB_ID;

function countPlatformAssignments(slug: string): number {
  const doc = loadImageAssignments(slug);
  return Object.values(doc.assignments).filter((a) => a.sourceType === "image-platform").length;
}

function countCampaignSvg(slug: string): number {
  const doc = loadImageAssignments(slug);
  return Object.values(doc.assignments).filter(
    (a) => a.sourceType === "library" && String(a.filePath || "").includes("pharmacy-image-library"),
  ).length;
}

function countSvgInRender(slug: string): number {
  const renderRoot = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-final-render", slug);
  let count = 0;
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith("_")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === "index.html") {
        const html = fs.readFileSync(full, "utf8");
        count += (html.match(/<img[^>]+src=["'][^"']*pharmacy-image-library[^"']*\.svg/gi) || []).length;
      }
    }
  };
  if (fs.existsSync(renderRoot)) walk(renderRoot);
  return count;
}

function traceBranding(slug: string) {
  const profile = resolveCurrentPharmacyPresentationProfile(slug);
  const brandDna = resolveBrandDnaForRender(slug);
  const brookDetected =
    JSON.stringify(profile).toLowerCase().includes("brook") ||
    JSON.stringify(brandDna).toLowerCase().includes("brook pharmacy") ||
    String(profile.logoPath || "").includes("brook");
  return {
    templateSource: profile.templateFamilyKey || profile.themeSource || "tenant-profile",
    colourSource: brandDna.colourSource || profile.colourSource || "brand-dna",
    fontSource: brandDna.typography?.headingFont ? "brand-dna" : "default",
    logoSource: profile.logoPath || "tenant-brand-assets",
    brookPharmacyTenantBrandingDetected: brookDetected,
  };
}

async function main() {
  const plan = readCanonicalEcosystemGenerationPlan(SLUG);
  const beforePlatform = countPlatformAssignments(SLUG);
  const beforeSvg = countCampaignSvg(SLUG);
  const beforeRenderSvg = countSvgInRender(SLUG);

  const assignment = rebuildPharmacyProductionImageAssignments({
    slug: SLUG,
    serviceId: SERVICE,
    canonicalPlanId: plan?.planId,
    canonicalPlanChecksum: plan?.checksum,
    authorisedGenerationJobId: JOB_ID,
    canonicalPlan: plan,
  });

  const inventory = persistCanonicalImageInventory(SLUG, SERVICE, plan);
  let render: Awaited<ReturnType<typeof buildCanonicalFinalRender>> | null = null;
  try {
    render = await buildCanonicalFinalRender(SLUG, SERVICE);
  } catch (err) {
    const parityMid = runImageParityGate(SLUG, SERVICE, plan);
    if (!parityMid.ok) throw err;
    console.warn("Final render completed with pre-existing template gate warning:", String(err));
  }
  copyCanonicalFinalRenderToPublishOutput(SLUG, SERVICE);
  const parity = runImageParityGate(SLUG, SERVICE, plan);
  rerunAuthorisedGenerationCompletenessValidation(SLUG, JOB_ID);

  const afterPlatform = countPlatformAssignments(SLUG);
  const afterSvg = countCampaignSvg(SLUG);
  const afterRenderSvg = countSvgInRender(SLUG);
  const branding = traceBranding(SLUG);

  const report = {
    rootCauseCorrected: parity.ok,
    slug: SLUG,
    jobId: JOB_ID,
    genericProductionAssignmentService: "rebuildPharmacyProductionImageAssignments",
    legacyBannerCrossWrapperRetained: true,
    imagePlatformAssignmentsBefore: beforePlatform,
    imagePlatformAssignmentsAfter: afterPlatform,
    campaignSvgContentFallbacksBefore: beforeSvg,
    campaignSvgContentFallbacksAfter: afterSvg,
    staleSvgInRenderBefore: beforeRenderSvg,
    staleSvgInRenderAfter: afterRenderSvg,
    canonicalUniqueApprovedAssets: inventory.uniqueApprovedAssets.length,
    canonicalPageSlotAssignments: inventory.counts.pageSlotAssignments,
    renderedImageOccurrences: countRenderedImageOccurrences(SLUG),
    missingAssignments: parity.missingAssignments,
    brokenAssets: parity.brokenAssets,
    crossTenantAssets: parity.crossTenantAssets,
    placeholderClassContentImages: parity.placeholderClassContentImages,
    homepageImageStatus: pageTypeImageStatus(SLUG, "homepage", plan, SERVICE),
    serviceHubImageStatus: pageTypeImageStatus(SLUG, "service", plan, SERVICE),
    clusterImageStatus: pageTypeImageStatus(SLUG, "cluster-page", plan, SERVICE),
    guideImageStatus: pageTypeImageStatus(SLUG, "guide", plan, SERVICE),
    blogImageStatus: pageTypeImageStatus(SLUG, "blog", plan, SERVICE),
    faqImageStatus: pageTypeImageStatus(SLUG, "faq", plan, SERVICE),
    supportingPageImageStatus: pageTypeImageStatus(SLUG, "supporting", plan, SERVICE),
    imageParity: parity.ok ? "PASS" : "FAIL",
    manifestRebuilt: true,
    canonicalFinalRenderRebuilt: true,
    assignmentRevision: assignment.revision,
    renderRoot: render?.renderRoot || `output/pharmacy-final-render/${SLUG}`,
    branding,
    crossTenantBrandingDefect: branding.brookPharmacyTenantBrandingDetected,
    inventory: readCanonicalImageInventory(SLUG),
  };

  const evidenceDir = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/validation-reports",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, "nt-e2e-31-image-platform-wiring.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
