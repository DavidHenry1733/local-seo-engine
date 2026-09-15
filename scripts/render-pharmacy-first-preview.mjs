#!/usr/bin/env node
/**
 * Phase 5 — Clinical NHS Services template local preview (Pharmacy First Rotherham).
 * Local preview only — no deploy, registry, or sitemap changes.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderClinicalNhsHubPage,
  renderClinicalNhsClusterPage,
} from "../src/pharmacy/templates/renderClinicalNhsService.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "output/pharmacy-preview");
const REPORT_PATH = join(ROOT, "output/pharmacy-blueprint/clinical-nhs-template-v1-report.json");

const PREVIEW = {
  pharmacyName: "PharmaConnect Demo Pharmacy",
  domain: "preview.pharmaconnect.local",
  phone: "01709 000000",
  email: "hello@preview.pharmaconnect.local",
  address: "1 High Street, Rotherham",
  previewBasePath: "..",
};

const CLUSTER_SLUGS = [
  "pharmacy-first-aston",
  "pharmacy-first-bramley",
  "pharmacy-first-rawmarsh",
  "pharmacy-first-wickersley",
];

function loadJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
}

function writePage(slug, html) {
  const dir = join(OUT_DIR, slug);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "index.html");
  writeFileSync(path, html, "utf8");
  return path;
}

function validatePage(html, slug, pageType) {
  const issues = [];
  const checks = {
    hasHero: /<section class="hero"/i.test(html),
    hasServiceOverview: /id="clinical-service-overview"/i.test(html),
    hasConditions: /id="clinical-conditions"/i.test(html),
    hasHowItWorks: /id="clinical-how-it-works"/i.test(html),
    hasBenefits: /id="clinical-benefits"/i.test(html),
    hasLocalService: /id="clinical-local-service"/i.test(html),
    hasNearbyAreas: /id="clinical-nearby-areas"/i.test(html),
    hasRelatedServices: /id="clinical-related-services"/i.test(html),
    hasFaq: /id="clinical-faq"/i.test(html),
    hasCompliance: /id="clinical-compliance"/i.test(html),
    hasCta: /id="clinical-cta"/i.test(html),
    schemaLocalBusiness: /"@type"\s*:\s*"LocalBusiness"/.test(html),
    schemaMedicalBusiness: /"@type"\s*:\s*"MedicalBusiness"/.test(html),
    schemaService: /"@type"\s*:\s*"Service"/.test(html),
    schemaFaqPage: /"@type"\s*:\s*"FAQPage"/.test(html),
    imageHero: /image-slot--hero/.test(html),
    imageSupport: /image-slot--support/.test(html),
    imageTrust: pageType === "hub" ? /image-slot--trust/.test(html) : true,
    imageConversion: /image-slot--conversion/.test(html),
    previewBanner: /Local preview only/i.test(html),
    noUnreplacedTokens: !/\{(pharmacyName|domain|locationSlug|location)\}/.test(html),
    contextualLinks: /contextual-link/.test(html),
    areaCards: /area-card/.test(html),
    relatedCards: /related-card/.test(html),
  };

  for (const [k, ok] of Object.entries(checks)) {
    if (!ok) issues.push(`failed:${k}`);
  }

  const benefitsSection = html.match(/id="clinical-benefits"[\s\S]*?<\/section>/i)?.[0] ?? "";
  const benefitCount = (benefitsSection.match(/class="card"/g) ?? []).length;
  if (benefitCount < 8) issues.push(`benefits:${benefitCount}<8`);

  const faqCount = (html.match(/class="faq"/g) ?? []).length;
  if (faqCount < 3) issues.push(`faq:${faqCount}<3`);

  return { slug, pageType, checks, issues, benefitCount, faqCount };
}

function main() {
  const campaignBlueprint = loadJson("output/pharmacy-blueprint/campaign-blueprints/pharmacy-first-rotherham.json");
  const serviceIntelligenceRoot = loadJson("output/pharmacy-blueprint/service-intelligence.json");
  const templateArchitecture = loadJson("output/pharmacy-blueprint/template-architecture.json");
  const businessIntelligence = loadJson("output/pharmacy-blueprint/business-intelligence.json");

  const serviceKey = campaignBlueprint.campaignIdentity?.serviceKey ?? "pharmacy-first";
  const serviceIntelligence = serviceIntelligenceRoot.services?.[serviceKey];
  if (!serviceIntelligence) throw new Error(`Missing service intelligence for ${serviceKey}`);

  const templateFamily = templateArchitecture.templateFamilies?.["clinical-nhs-services"];
  const filesCreated = [
    "src/pharmacy/templates/renderClinicalNhsService.ts",
    "scripts/render-pharmacy-first-preview.mjs",
  ];

  const pagesRendered = [];
  const validations = [];

  const hubHtml = renderClinicalNhsHubPage({
    pageType: "hub",
    campaignBlueprint,
    serviceIntelligence,
    templateFamily,
    preview: PREVIEW,
  });
  const hubPath = writePage("pharmacy-first-rotherham", hubHtml);
  pagesRendered.push(hubPath);
  validations.push(validatePage(hubHtml, "pharmacy-first-rotherham", "hub"));

  for (const slug of CLUSTER_SLUGS) {
    const clusterBlueprint = (campaignBlueprint.clusterBlueprints ?? []).find((c) => c.pageSlug === slug);
    if (!clusterBlueprint) throw new Error(`Missing cluster blueprint: ${slug}`);
    const html = renderClinicalNhsClusterPage({
      pageType: "cluster",
      campaignBlueprint,
      serviceIntelligence,
      templateFamily,
      preview: PREVIEW,
      clusterBlueprint,
    });
    const path = writePage(slug, html);
    pagesRendered.push(path);
    validations.push(validatePage(html, slug, "cluster"));
  }

  const allIssues = validations.flatMap((v) => v.issues.map((i) => `${v.slug}:${i}`));
  const pass = allIssues.length === 0;

  const report = {
    schemaVersion: "1.0",
    phase: "clinical-nhs-services-template-v1",
    generatedAt: new Date().toISOString(),
    verdict: pass ? "PASS" : "FAIL",
    message: pass
      ? "PASS: Clinical NHS Services Template V1 Complete"
      : "FAIL: Clinical NHS Services Template Requires Investigation",
    validationCampaign: "pharmacy-first-rotherham",
    templateFamily: "clinical-nhs-services",
    localPreviewOnly: true,
    deployed: false,
    registryModified: false,
    sitemapModified: false,
    filesCreated,
    pagesRendered: pagesRendered.map((p) => p.replace(ROOT + "/", "")),
    pageCount: pagesRendered.length,
    schemaValidation: validations.every(
      (v) => v.checks.schemaLocalBusiness && v.checks.schemaMedicalBusiness && v.checks.schemaService && v.checks.schemaFaqPage,
    ),
    internalLinkValidation: validations.every((v) => v.checks.contextualLinks && v.checks.areaCards && v.checks.relatedCards),
    faqValidation: validations.every((v) => v.faqCount >= 3),
    complianceValidation: validations.every((v) => v.checks.hasCompliance),
    imageSlotValidation: validations.every(
      (v) => v.checks.imageHero && v.checks.imageSupport && v.checks.imageTrust && v.checks.imageConversion,
    ),
    tokenValidation: validations.every((v) => v.checks.noUnreplacedTokens),
    issues: allIssues,
    validations,
    inputs: {
      businessIntelligence: "output/pharmacy-blueprint/business-intelligence.json",
      serviceIntelligence: "output/pharmacy-blueprint/service-intelligence.json",
      templateArchitecture: "output/pharmacy-blueprint/template-architecture.json",
      campaignBlueprint: "output/pharmacy-blueprint/campaign-blueprints/pharmacy-first-rotherham.json",
    },
    readinessForLiveCampaign: pass
      ? "Ready for Pharmacy First live campaign generation — hub and cluster renderer validated locally with schema, internal links, FAQ, compliance and image slots."
      : "Requires investigation before live campaign generation.",
    businessIntelligenceLoaded: !!businessIntelligence,
  };

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log(report.message);
  console.log(`Pages: ${report.pageCount}`);
  console.log(`Report: ${REPORT_PATH.replace(ROOT + "/", "")}`);
  if (allIssues.length) {
    console.error("Issues:", allIssues.join(", "));
    process.exit(1);
  }
}

main();
