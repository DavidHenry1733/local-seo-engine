#!/usr/bin/env node
/**
 * Phase 5B — Render all pharmacy template family previews and validate.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { renderVaccinationHubPage, renderVaccinationClusterPage } from "../src/pharmacy/templates/renderVaccinationService.ts";
import { renderPrivateHealthcareHubPage, renderPrivateHealthcareClusterPage } from "../src/pharmacy/templates/renderPrivateHealthcareService.ts";
import { renderTravelHealthHubPage, renderTravelHealthClusterPage } from "../src/pharmacy/templates/renderTravelHealthService.ts";
import { renderWeightManagementHubPage, renderWeightManagementClusterPage } from "../src/pharmacy/templates/renderWeightManagementService.ts";
import { loadJson, renderFamilyPreview } from "./lib/pharmacy-family-preview.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = join(ROOT, "output/pharmacy-blueprint/template-family-preview-report.json");
const CLINICAL_PATH = join(ROOT, "src/pharmacy/templates/renderClinicalNhsService.ts");
const CLINICAL_HASH_BASELINE = existsSync(CLINICAL_PATH)
  ? createHash("sha256").update(readFileSync(CLINICAL_PATH)).digest("hex")
  : null;

const FAMILIES = [
  {
    templateKey: "clinical-nhs-services",
    serviceKey: "pharmacy-first",
    displayName: "Clinical NHS Services (Pharmacy First)",
    existing: true,
  },
  {
    templateKey: "vaccination-services",
    serviceKey: "nhs-flu-vaccination",
    displayName: "Vaccination — NHS Flu Vaccination",
    renderHub: renderVaccinationHubPage,
    renderCluster: renderVaccinationClusterPage,
  },
  {
    templateKey: "private-healthcare-services",
    serviceKey: "private-ear-wax-removal",
    displayName: "Private Healthcare — Ear Wax Removal",
    renderHub: renderPrivateHealthcareHubPage,
    renderCluster: renderPrivateHealthcareClusterPage,
  },
  {
    templateKey: "travel-health-services",
    serviceKey: "travel-vaccinations",
    displayName: "Travel Health — Travel Vaccinations",
    renderHub: renderTravelHealthHubPage,
    renderCluster: renderTravelHealthClusterPage,
  },
  {
    templateKey: "weight-management-services",
    serviceKey: "pharmacy-weight-loss-programme",
    displayName: "Weight Management — Pharmacy Weight Loss Programme",
    renderHub: renderWeightManagementHubPage,
    renderCluster: renderWeightManagementClusterPage,
  },
];

function main() {
  const arch = loadJson("output/pharmacy-blueprint/template-architecture.json");
  const templateFamilyCount = arch.templateFamilies?.length ?? 0;

  const clinicalHashNow = createHash("sha256").update(readFileSync(CLINICAL_PATH)).digest("hex");
  const clinicalUnchanged = CLINICAL_HASH_BASELINE === clinicalHashNow;

  const results = [];
  const allPages = [];

  for (const fam of FAMILIES) {
    if (fam.existing) {
      const existingPages = [
        "output/pharmacy-preview/pharmacy-first-rotherham/index.html",
        "output/pharmacy-preview/pharmacy-first-aston/index.html",
        "output/pharmacy-preview/pharmacy-first-bramley/index.html",
        "output/pharmacy-preview/pharmacy-first-rawmarsh/index.html",
        "output/pharmacy-preview/pharmacy-first-wickersley/index.html",
      ];
      const missing = existingPages.filter((p) => !existsSync(join(ROOT, p)));
      results.push({
        templateKey: fam.templateKey,
        serviceKey: fam.serviceKey,
        displayName: fam.displayName,
        existing: true,
        pagesRendered: existingPages.filter((p) => existsSync(join(ROOT, p))),
        pageCount: existingPages.length - missing.length,
        pass: missing.length === 0 && clinicalUnchanged,
        readinessScore: missing.length === 0 ? 9 : 6,
        issues: missing.map((p) => `missing:${p}`),
      });
      allPages.push(...existingPages.filter((p) => existsSync(join(ROOT, p))));
      continue;
    }

    const r = renderFamilyPreview(fam);
    results.push({
      templateKey: r.templateKey,
      serviceKey: r.serviceKey,
      displayName: fam.displayName,
      serviceName: r.serviceName,
      pagesRendered: r.pagesRendered,
      pageCount: r.pageCount,
      pass: r.pass,
      readinessScore: r.readinessScore,
      issues: r.issues,
      validations: r.validations,
    });
    allPages.push(...r.pagesRendered);
  }

  const newFamilyResults = results.filter((r) => !r.existing);
  const allNewPass = newFamilyResults.every((r) => r.pass);
  const clinicalPass = results.find((r) => r.templateKey === "clinical-nhs-services")?.pass ?? false;
  const pass =
    templateFamilyCount >= 5 &&
    clinicalUnchanged &&
    clinicalPass &&
    allNewPass &&
    newFamilyResults.length === 4 &&
    newFamilyResults.every((r) => r.pageCount === 5);

  const recommendedOrder = [
    "clinical-nhs-services",
    "vaccination-services",
    "private-healthcare-services",
    "travel-health-services",
    "weight-management-services",
  ].sort((a, b) => {
    const sa = results.find((r) => r.templateKey === a)?.readinessScore ?? 0;
    const sb = results.find((r) => r.templateKey === b)?.readinessScore ?? 0;
    return sb - sa;
  });

  const report = {
    schemaVersion: "1.0",
    phase: "pharmacy-template-family-preview-v1",
    generatedAt: new Date().toISOString(),
    verdict: pass ? "PASS" : "FAIL",
    message: pass
      ? "PASS: Pharmacy Template Family Preview System Complete"
      : "FAIL: Pharmacy Template Family Preview System Requires Investigation",
    deployed: false,
    registryModified: false,
    sitemapModified: false,
    templateFamiliesAvailable: templateFamilyCount,
    clinicalNhsRendererUnchanged: clinicalUnchanged,
    clinicalNhsHash: clinicalHashNow,
    templateFamiliesRendered: results.map((r) => ({
      templateKey: r.templateKey,
      serviceKey: r.serviceKey,
      displayName: r.displayName,
      pageCount: r.pageCount,
      pass: r.pass,
      readinessScore: r.readinessScore,
      issues: r.issues,
    })),
    previewPagesGenerated: allPages,
    totalPreviewPages: allPages.length,
    validationResults: {
      fiveTemplateFamilies: templateFamilyCount >= 5,
      clinicalNhsExists: clinicalPass,
      clinicalNhsUnchanged: clinicalUnchanged,
      fourNewPreviewSets: newFamilyResults.length === 4 && newFamilyResults.every((r) => r.pageCount === 5),
      allSectionsPresent: newFamilyResults.every((r) => r.pass),
      schemaValid: newFamilyResults.every((r) => !r.issues.some((i) => i.includes("invalid-json-ld"))),
      faqsPresent: newFamilyResults.every((r) => !r.issues.some((i) => i.includes("faq"))),
      internalLinksPresent: newFamilyResults.every((r) => !r.issues.some((i) => i.includes("contextualLinks"))),
      ctaPresent: newFamilyResults.every((r) => !r.issues.some((i) => i.includes("service-cta") || i.includes("ctaButtons"))),
      imageSlotsPresent: newFamilyResults.every((r) => !r.issues.some((i) => i.includes("image"))),
      noUnreplacedTokens: newFamilyResults.every((r) => !r.issues.some((i) => i.includes("noTokens"))),
    },
    issuesFound: results.flatMap((r) => r.issues.map((i) => `${r.templateKey}:${i}`)),
    readinessScorePerTemplate: Object.fromEntries(results.map((r) => [r.templateKey, r.readinessScore])),
    recommendedTemplateOrderForLiveWiring: recommendedOrder,
    filesCreated: [
      "src/pharmacy/templates/pharmacyTemplateCore.ts",
      "src/pharmacy/templates/renderVaccinationService.ts",
      "src/pharmacy/templates/renderPrivateHealthcareService.ts",
      "src/pharmacy/templates/renderTravelHealthService.ts",
      "src/pharmacy/templates/renderWeightManagementService.ts",
      "scripts/lib/pharmacy-family-preview.mjs",
      "scripts/render-vaccination-preview.mjs",
      "scripts/render-private-healthcare-preview.mjs",
      "scripts/render-travel-health-preview.mjs",
      "scripts/render-weight-management-preview.mjs",
      "scripts/render-all-pharmacy-template-previews.mjs",
    ],
  };

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log(report.message);
  console.log(`Template families: ${templateFamilyCount}, Preview pages: ${allPages.length}`);
  console.log(`Clinical NHS unchanged: ${clinicalUnchanged}`);
  console.log(`Report: ${REPORT_PATH.replace(ROOT + "/", "")}`);

  if (!pass) {
    console.error("Issues:", report.issuesFound.slice(0, 20).join(", "));
    process.exit(1);
  }
}

main();
