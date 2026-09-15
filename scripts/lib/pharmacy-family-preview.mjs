/**
 * Shared pharmacy family preview generator.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBlueprintFromIntelligence } from "../../src/pharmacy/templates/pharmacyTemplateCore.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export const PREVIEW = {
  pharmacyName: "PharmaConnect Demo Pharmacy",
  domain: "preview.pharmaconnect.local",
  phone: "01709 000000",
  email: "hello@preview.pharmaconnect.local",
  address: "1 High Street, Rotherham",
  previewBasePath: "..",
};

export const CLUSTER_SLUG_SUFFIXES = ["aston", "bramley", "rawmarsh", "wickersley"];

export function loadJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
}

export function getTemplateFamily(templateKey) {
  const arch = loadJson("output/pharmacy-blueprint/template-architecture.json");
  const family = arch.templateFamilies.find((f) => f.templateKey === templateKey);
  if (!family) throw new Error(`Template family not found: ${templateKey}`);
  return family;
}

export function getServiceIntelligence(serviceKey) {
  const si = loadJson("output/pharmacy-blueprint/service-intelligence.json");
  const service = si.services?.[serviceKey];
  if (!service) throw new Error(`Service intelligence not found: ${serviceKey}`);
  return service;
}

export function writePage(slug, html) {
  const dir = join(ROOT, "output/pharmacy-preview", slug);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "index.html");
  writeFileSync(path, html, "utf8");
  return path.replace(ROOT + "/", "");
}

export function validateHtml(html, slug) {
  const issues = [];
  const isHub = slug.endsWith("-rotherham");
  const hasEligibility =
    /id="service-eligibility"/.test(html) ||
    /id="service-vaccine-eligibility"/.test(html) ||
    /id="service-suitability"/.test(html) ||
    /id="service-appointment-detail"/.test(html) ||
    /id="service-destination-advice"/.test(html);
  const checks = {
    hasHero: /id="service-hero"/.test(html),
    hasTrust: /id="service-trust"/.test(html),
    hasBenefits: /id="service-benefits"/.test(html),
    hasEligibility: isHub ? hasEligibility : true,
    hasProcess: /id="service-process"/.test(html),
    hasFaq: /id="service-faq"/.test(html),
    hasLocal: /id="service-local"/.test(html),
    hasNearby: /id="service-nearby"/.test(html),
    hasRelated: /id="service-related"/.test(html),
    hasCta: /id="service-cta"/.test(html),
    hasCompliance: /id="service-compliance"/.test(html),
    schemaLocalBusiness: /"@type"\s*:\s*"LocalBusiness"/.test(html),
    schemaMedicalBusiness: /"@type"\s*:\s*"MedicalBusiness"/.test(html),
    schemaService: /"@type"\s*:\s*"Service"/.test(html),
    schemaFaqPage: /"@type"\s*:\s*"FAQPage"/.test(html),
    imageHero: /image-slot--hero/.test(html),
    imageSupport: /image-slot--support/.test(html),
    imageTrust: /image-slot--trust/.test(html),
    imageConversion: /image-slot--conversion/.test(html),
    contextualLinks: /contextual-link/.test(html),
    previewBanner: /Local preview only/.test(html),
    noTokens: !/\{[a-zA-Z]+\}/.test(html),
    faqPresent: (html.match(/class="faq"/g) ?? []).length >= 3,
    ctaButtons: /class="btn"/.test(html) && /id="service-cta"/.test(html),
  };

  for (const [k, ok] of Object.entries(checks)) {
    if (!ok) issues.push(`${slug}:${k}`);
  }

  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  for (const m of schemas) {
    try {
      JSON.parse(m[1]);
    } catch {
      issues.push(`${slug}:invalid-json-ld`);
    }
  }

  if (/Answer using NHS|Do not guarantee outcomes|Confirm service at/i.test(html)) {
    issues.push(`${slug}:faq-hint-exposed`);
  }
  if (/Benefit \d+/.test(html)) issues.push(`${slug}:generic-benefit-heading`);

  return { slug, checks, issues, faqCount: (html.match(/class="faq"/g) ?? []).length };
}

export function renderFamilyPreview({ templateKey, serviceKey, renderHub, renderCluster }) {
  const templateFamily = getTemplateFamily(templateKey);
  const serviceIntelligence = getServiceIntelligence(serviceKey);
  const blueprint = buildBlueprintFromIntelligence(serviceIntelligence, templateFamily);
  const hubSlug = String(blueprint.hubBlueprint.pageSlug);
  const pages = [];
  const validations = [];

  const hubHtml = renderHub({
    pageType: "hub",
    serviceIntelligence,
    templateFamily,
    preview: PREVIEW,
    blueprint,
  });
  pages.push(writePage(hubSlug, hubHtml));
  validations.push(validateHtml(hubHtml, hubSlug));

  for (const suffix of CLUSTER_SLUG_SUFFIXES) {
    const clusterBlueprint = blueprint.clusterBlueprints.find((c) => String(c.pageSlug).endsWith(`-${suffix}`));
    if (!clusterBlueprint) throw new Error(`Missing cluster: ${suffix}`);
    const html = renderCluster({
      pageType: "cluster",
      serviceIntelligence,
      templateFamily,
      preview: PREVIEW,
      blueprint,
      clusterBlueprint,
    });
    const slug = String(clusterBlueprint.pageSlug);
    pages.push(writePage(slug, html));
    validations.push(validateHtml(html, slug));
  }

  const issues = validations.flatMap((v) => v.issues);
  const pass = issues.length === 0;
  const score = pass ? 9 : Math.max(5, 9 - issues.length * 0.3);

  return {
    templateKey,
    serviceKey,
    serviceName: serviceIntelligence.serviceProfile?.serviceName,
    pagesRendered: pages,
    pageCount: pages.length,
    validations,
    issues,
    pass,
    readinessScore: Math.round(score * 10) / 10,
  };
}
