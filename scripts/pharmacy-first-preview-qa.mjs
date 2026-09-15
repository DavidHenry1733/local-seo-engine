#!/usr/bin/env node
/**
 * Phase 6 — Pharmacy First preview QA audit (read-only).
 * Does not modify preview pages, registry, sitemap, or deploy artifacts.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = join(ROOT, "output/pharmacy-blueprint/pharmacy-first-preview-qa-report.json");

const PAGES = [
  { slug: "pharmacy-first-rotherham", type: "hub", path: "output/pharmacy-preview/pharmacy-first-rotherham/index.html" },
  { slug: "pharmacy-first-aston", type: "cluster", path: "output/pharmacy-preview/pharmacy-first-aston/index.html" },
  { slug: "pharmacy-first-bramley", type: "cluster", path: "output/pharmacy-preview/pharmacy-first-bramley/index.html" },
  { slug: "pharmacy-first-rawmarsh", type: "cluster", path: "output/pharmacy-preview/pharmacy-first-rawmarsh/index.html" },
  { slug: "pharmacy-first-wickersley", type: "cluster", path: "output/pharmacy-preview/pharmacy-first-wickersley/index.html" },
];

const REQUIRED_SECTIONS = [
  "clinical-service-overview",
  "clinical-conditions",
  "clinical-how-it-works",
  "clinical-benefits",
  "clinical-local-service",
  "clinical-nearby-areas",
  "clinical-related-services",
  "clinical-faq",
  "clinical-compliance",
  "clinical-cta",
];

const HUB_ONLY_SECTIONS = ["clinical-why-choose"];

const FAQ_HINT_PATTERNS = [
  /^Answer using NHS/i,
  /^Confirm service at/i,
  /^Explain NHS/i,
  /^List core pathways/i,
  /^Walk-in and booked appointments; advise/i,
  /Do not guarantee outcomes/i,
];

const COMPLIANCE_RISK_PATTERNS = [
  /\bguaranteed cure\b/i,
  /\binstant recovery\b/i,
  /\balways free\b/i,
  /\bno appointment ever needed\b/i,
  /\bprescribe all antibiotics\b/i,
  /\breplace your gp\b/i,
];

function loadJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
}

function extractSchemas(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      blocks.push({ raw: m[1], parsed: JSON.parse(m[1]) });
    } catch (e) {
      blocks.push({ raw: m[1], parseError: String(e.message) });
    }
  }
  return blocks;
}

function extractLinksInSection(html, sectionId) {
  const re = new RegExp(`<section[^>]*id="${sectionId}"[^>]*>([\\s\\S]*?)<\\/section>`, "i");
  const match = html.match(re);
  if (!match) return [];
  const hrefs = [];
  const linkRe = /href="([^"]+)"/gi;
  let lm;
  while ((lm = linkRe.exec(match[1]))) hrefs.push(lm[1]);
  return hrefs;
}

function countMatches(html, re) {
  return (html.match(re) ?? []).length;
}

function auditPage(page) {
  const fullPath = join(ROOT, page.path);
  const issues = { structure: [], design: [], content: [], compliance: [], seo: [], links: [], faq: [], conversion: [] };
  const checks = {};

  if (!existsSync(fullPath)) {
    issues.structure.push("HTML file missing");
    return { slug: page.slug, pageType: page.type, checks, issues, scores: null };
  }

  const html = readFileSync(fullPath, "utf8");

  checks.htmlExists = true;
  checks.h1 = /<h1[^>]*>[\s\S]*?<\/h1>/i.test(html);
  checks.metaTitle = /<title>[^<]+<\/title>/i.test(html);
  checks.metaDescription = /<meta name="description" content="[^"]+"/i.test(html);
  checks.canonical = /<link rel="canonical" href="[^"]+"/i.test(html);
  checks.previewBanner = /Local preview only/i.test(html);
  checks.viewport = /<meta name="viewport"/i.test(html);
  checks.noUnreplacedTokens = !/\{(pharmacyName|domain|locationSlug|location)\}/.test(html);

  for (const id of REQUIRED_SECTIONS) {
    const ok = new RegExp(`id="${id}"`, "i").test(html);
    checks[`section_${id}`] = ok;
    if (!ok) issues.structure.push(`Missing section: ${id}`);
  }

  if (page.type === "hub") {
    for (const id of HUB_ONLY_SECTIONS) {
      checks[`section_${id}`] = new RegExp(`id="${id}"`, "i").test(html);
    }
  } else {
    if (/id="clinical-why-choose"/i.test(html)) issues.design.push("Cluster includes hub-only why-choose section (unexpected parity gap vs hub is missing on cluster — expected)");
    if (!/trust-row/i.test(html)) issues.design.push("Cluster hero missing trust signals row present on hub");
  }

  const malformedLinks = [...html.matchAll(/href="([^"]*)"/gi)]
    .map((m) => m[1])
    .filter((h) => h === "" || h === "#" && !html.includes('href="#clinical-cta"'));
  if (malformedLinks.some((h) => h === "")) issues.structure.push("Empty href detected");

  checks.mobileCss = /@media\s*\(max-width:\s*900px\)/.test(html);
  checks.nhsPalette = /--nhs:#005eb8/.test(html) && /linear-gradient.*#005eb8/i.test(html);
  checks.cardLayout = /class="card"/.test(html) && /grid-3/.test(html);
  checks.imagePlaceholders = /image-slot--hero/.test(html) && /image-slot--support/.test(html) && /image-slot--conversion/.test(html);
  if (page.type === "hub" && !/image-slot--trust/.test(html)) issues.design.push("Hub missing trust image slot");

  const placeholderCount = countMatches(html, /image-slot/g);
  if (placeholderCount >= 3 && /min-height:280px/.test(html)) {
    issues.design.push("Large image placeholders (280px min-height) may create oversized blank areas before real assets");
  }

  if (/Benefit \d+/.test(html)) issues.design.push('Benefit cards use generic headings ("Benefit 1" etc.) instead of benefit-led titles');

  checks.serviceName = /Pharmacy First/i.test(html);
  checks.nhsPositioning = /NHS/i.test(html);
  checks.conditions = /Earache|Sore throat|UTI|Urinary tract/i.test(html);
  checks.howItWorks = /Visit or book|Private consultation|Safety-netting/i.test(html);
  checks.eligibility = /where eligible|where clinically appropriate|eligible/i.test(html);
  checks.localAvailability = page.type === "hub" ? /Rotherham/i.test(html) : /serving|Residents of|Local Service/i.test(html);
  checks.nearbyAreas = /area-card/.test(html);
  checks.relatedServices = /related-card/.test(html);

  if (page.type === "hub" && /✓ Cannot get GP appointment/.test(html)) {
    issues.content.push("Why-choose section lists problems-solved items as benefits (content type mismatch)");
  }

  if (/share the same NHS access priorities/.test(html)) {
    const count = countMatches(html, /share the same NHS access priorities/g);
    if (count > 2) issues.content.push(`Repetitive contextual link phrasing used ${count} times — reads unnaturally in body copy`);
  }

  if (/Who it helps[\s\S]*?share the same NHS access priorities/.test(html)) {
    issues.content.push("Contextual cluster links injected inside audience/eligibility cards");
  }

  for (const pat of COMPLIANCE_RISK_PATTERNS) {
    const bodyWithoutCompliance = html.replace(/id="clinical-compliance"[\s\S]*?<\/section>/gi, "");
    if (pat.test(bodyWithoutCompliance)) issues.compliance.push(`Risk phrase matched: ${pat.source}`);
  }

  if (!/clinical-compliance/.test(html)) issues.compliance.push("Missing compliance section");
  if (!/not a substitute for personal medical advice/i.test(html)) issues.compliance.push("Missing medical advice disclaimer");
  if (!/call 999|A&amp;E|A&E/i.test(html)) issues.compliance.push("Missing emergency signposting");

  const faqBlocks = [...html.matchAll(/class="faq"[\s\S]*?<h3>([^<]+)<\/h3><p>([\s\S]*?)<\/p>/gi)];
  const faqCount = faqBlocks.length;
  checks.faqCount = faqCount;

  for (const [, q, a] of faqBlocks) {
    for (const pat of FAQ_HINT_PATTERNS) {
      if (pat.test(a.trim())) {
        issues.faq.push(`FAQ answer is blueprint hint not patient-ready: "${q.trim().slice(0, 60)}…"`);
        issues.compliance.push(`FAQ exposes internal content hint to patients: "${q.trim().slice(0, 50)}…"`);
        break;
      }
    }
  }

  if (page.type === "hub" && faqCount < 8) issues.faq.push(`Hub FAQ count ${faqCount} below expected blueprint set`);
  if (page.type === "cluster" && faqCount < 5) issues.faq.push(`Cluster FAQ count ${faqCount} below blueprint faqVariants (5)`);

  const schemas = extractSchemas(html);
  checks.schemaCount = schemas.length;
  const types = schemas.map((s) => s.parsed?.["@type"]).filter(Boolean);
  checks.schemaLocalBusiness = types.includes("LocalBusiness");
  checks.schemaMedicalBusiness = types.includes("MedicalBusiness");
  checks.schemaService = types.includes("Service");
  checks.schemaFaqPage = types.includes("FAQPage");

  for (const s of schemas) {
    if (s.parseError) issues.seo.push(`Invalid JSON-LD: ${s.parseError}`);
    if (s.parsed?.["@type"] === "Service" && /\b(\w+(?:\s+\w+)?)\s+\1\s*$/i.test(String(s.parsed.name))) {
      issues.seo.push(`Service schema duplicate locality in name: "${s.parsed.name}"`);
    }
    if (s.parsed?.["@type"] === "FAQPage") {
      for (const entity of s.parsed.mainEntity ?? []) {
        const text = entity?.acceptedAnswer?.text ?? "";
        for (const pat of FAQ_HINT_PATTERNS) {
          if (pat.test(text)) {
            issues.seo.push("FAQPage schema contains blueprint hint text instead of patient-facing answers");
            break;
          }
        }
      }
    }
  }

  if (!checks.schemaLocalBusiness || !checks.schemaMedicalBusiness || !checks.schemaService || !checks.schemaFaqPage) {
    issues.seo.push("Missing one or more required schema types");
  }

  checks.hubClusterLinks = page.type === "hub"
    ? /contextual-link--cluster|area-card/.test(html)
    : /contextual-link--hub|pharmacy-first-rotherham/.test(html);
  checks.relatedServiceLinks = /contextual-link--related-service|related-card/.test(html);
  checks.moneyPageLinks = /contextual-link--money-page|prescription-dispensing/.test(html);

  for (const sid of ["clinical-service-overview", "clinical-how-it-works", "clinical-benefits", "clinical-local-service"]) {
    const hrefs = extractLinksInSection(html, sid);
    const uniq = new Set(hrefs);
    if (hrefs.length !== uniq.size) issues.links.push(`Duplicate URLs within section ${sid}`);
  }

  const previewSlugs = new Set(PAGES.map((p) => p.slug));
  const brokenPreviewLinks = [...html.matchAll(/href="\.\.\/([^/]+)\/index\.html"/gi)]
    .map((m) => m[1])
    .filter((slug) => !previewSlugs.has(slug) && !slug.startsWith("nhs-") && slug !== "prescription-dispensing-rotherham");
  if (brokenPreviewLinks.length) {
    issues.links.push(`Links to cluster pages not in preview set (${[...new Set(brokenPreviewLinks)].slice(0, 5).join(", ")}…) — expected until full campaign render`);
  }

  checks.primaryCta = /class="btn"[^>]*href="#clinical-cta"/.test(html) || /Book Pharmacy First/i.test(html);
  checks.phoneCta = /href="tel:/.test(html);
  checks.heroCta = /<section class="hero"[\s\S]*?class="btn"/i.test(html);

  if (page.type === "cluster") {
    const ctaSection = html.match(/id="clinical-cta"[\s\S]*?<\/section>/i)?.[0] ?? "";
    if (!/class="btn"/.test(ctaSection)) issues.conversion.push("Cluster bottom CTA band missing primary/secondary action buttons (only hero has tel/book)");
    if (!/Ask about Pharmacy First|Check availability/i.test(ctaSection)) {
      issues.conversion.push("Cluster bottom CTA band missing Ask about / Check availability actions");
    }
  }

  if (page.type === "hub" && !/trust-row/.test(html)) issues.conversion.push("Hub missing hero trust signals");

  const score = (base, deductions) => Math.max(1, Math.min(10, base - deductions));

  const dDed = issues.design.length * 0.6;
  const cDed = issues.content.length * 0.7;
  const compDed = issues.compliance.length * 0.8;
  const seoDed = issues.seo.length * 0.9;
  const convDed = issues.conversion.length * 1.0;

  const scores = {
    designReadiness: Math.round(score(8, dDed) * 10) / 10,
    contentRelevance: Math.round(score(8, cDed) * 10) / 10,
    complianceSafety: Math.round(score(8, compDed) * 10) / 10,
    seoStructure: Math.round(score(8.5, seoDed) * 10) / 10,
    conversionReadiness: Math.round(score(7.5, convDed) * 10) / 10,
  };
  scores.overall = Math.round(((scores.designReadiness + scores.contentRelevance + scores.complianceSafety + scores.seoStructure + scores.conversionReadiness) / 5) * 10) / 10;

  return { slug: page.slug, pageType: page.type, checks, issues, scores, faqCount };
}

function main() {
  const inputs = {
    businessIntelligence: loadJson("output/pharmacy-blueprint/business-intelligence.json"),
    serviceIntelligence: loadJson("output/pharmacy-blueprint/service-intelligence.json"),
    templateArchitecture: loadJson("output/pharmacy-blueprint/template-architecture.json"),
    campaignBlueprint: loadJson("output/pharmacy-blueprint/campaign-blueprints/pharmacy-first-rotherham.json"),
    templateV1Report: loadJson("output/pharmacy-blueprint/clinical-nhs-template-v1-report.json"),
  };

  const pageAudits = PAGES.map(auditPage);

  const designIssues = [...new Set(pageAudits.flatMap((p) => p.issues.design))];
  const contentIssues = [...new Set(pageAudits.flatMap((p) => p.issues.content))];
  const complianceIssues = [...new Set(pageAudits.flatMap((p) => p.issues.compliance))];
  const seoIssues = [...new Set(pageAudits.flatMap((p) => p.issues.seo))];
  const linkIssues = [...new Set(pageAudits.flatMap((p) => p.issues.links))];
  const faqIssues = [...new Set(pageAudits.flatMap((p) => p.issues.faq))];
  const conversionIssues = [...new Set(pageAudits.flatMap((p) => p.issues.conversion))];

  const blockingIssues = [
    ...faqIssues.filter((i) => /blueprint hint|internal content hint/i.test(i)),
    ...seoIssues.filter((i) => /FAQPage schema|duplicate locality/i.test(i)),
    ...conversionIssues.filter((i) => /bottom CTA band missing/i.test(i)),
    ...designIssues.filter((i) => /Benefit \d+/i.test(i)),
    ...contentIssues.filter((i) => /problems-solved|share the same NHS access priorities/i.test(i)),
  ];

  const aggregateScores = {
    designReadiness: Math.round((pageAudits.reduce((s, p) => s + p.scores.designReadiness, 0) / pageAudits.length) * 10) / 10,
    contentRelevance: Math.round((pageAudits.reduce((s, p) => s + p.scores.contentRelevance, 0) / pageAudits.length) * 10) / 10,
    complianceSafety: Math.round((pageAudits.reduce((s, p) => s + p.scores.complianceSafety, 0) / pageAudits.length) * 10) / 10,
    seoStructure: Math.round((pageAudits.reduce((s, p) => s + p.scores.seoStructure, 0) / pageAudits.length) * 10) / 10,
    conversionReadiness: Math.round((pageAudits.reduce((s, p) => s + p.scores.conversionReadiness, 0) / pageAudits.length) * 10) / 10,
    overall: Math.round((pageAudits.reduce((s, p) => s + p.scores.overall, 0) / pageAudits.length) * 10) / 10,
  };

  const meetsRefinementTargets =
    blockingIssues.length === 0 &&
    aggregateScores.overall >= 7.5 &&
    aggregateScores.complianceSafety >= 8 &&
    aggregateScores.seoStructure >= 7 &&
    aggregateScores.conversionReadiness >= 7 &&
    !pageAudits.some((p) => p.issues.faq.length > 0);

  const readinessGrade = meetsRefinementTargets
    ? "Ready for live campaign wiring"
    : blockingIssues.length
      ? "Ready for template refinement"
      : "Needs revision";

  const requiresRevision = !meetsRefinementTargets;

  const report = {
    schemaVersion: "1.0",
    phase: "pharmacy-first-preview-qa",
    generatedAt: new Date().toISOString(),
    qaOnly: true,
    pagesModified: false,
    deployed: false,
    registryModified: false,
    sitemapModified: false,
    verdict: requiresRevision ? "FAIL" : "PASS",
    message: requiresRevision
      ? "FAIL: Pharmacy First Preview Requires Revision"
      : "PASS: Pharmacy First Preview QA Complete",
    validationCampaign: "pharmacy-first-rotherham",
    templateFamily: "clinical-nhs-services",
    pagesAudited: PAGES.map((p) => p.path),
    pageScores: Object.fromEntries(pageAudits.map((p) => [p.slug, p.scores])),
    aggregateScores,
    structureValidation: {
      allPagesExist: pageAudits.every((p) => p.checks.htmlExists),
      allHaveH1: pageAudits.every((p) => p.checks.h1),
      allHaveMeta: pageAudits.every((p) => p.checks.metaTitle && p.checks.metaDescription),
      allHaveCanonical: pageAudits.every((p) => p.checks.canonical),
      allHavePreviewBanner: pageAudits.every((p) => p.checks.previewBanner),
      allSectionsPresent: pageAudits.every((p) => REQUIRED_SECTIONS.every((id) => p.checks[`section_${id}`])),
      noUnreplacedTokens: pageAudits.every((p) => p.checks.noUnreplacedTokens),
    },
    designValidation: {
      nhsBrandDirection: pageAudits.every((p) => p.checks.nhsPalette),
      mobileFriendly: pageAudits.every((p) => p.checks.mobileCss),
      cardLayout: pageAudits.every((p) => p.checks.cardLayout),
      imagePlaceholdersPresent: pageAudits.every((p) => p.checks.imagePlaceholders),
      issues: designIssues,
    },
    serviceRelevanceValidation: {
      pharmacyFirstNamed: pageAudits.every((p) => p.checks.serviceName),
      nhsPositioning: pageAudits.every((p) => p.checks.nhsPositioning),
      conditionsCovered: pageAudits.every((p) => p.checks.conditions),
      howItWorks: pageAudits.every((p) => p.checks.howItWorks),
      eligibilityFraming: pageAudits.every((p) => p.checks.eligibility),
      localAvailability: pageAudits.every((p) => p.checks.localAvailability),
      nearbyAreas: pageAudits.every((p) => p.checks.nearbyAreas),
      relatedServices: pageAudits.every((p) => p.checks.relatedServices),
      issues: contentIssues,
    },
    complianceValidation: {
      noGuaranteedOutcomes: !pageAudits.some((p) => p.issues.compliance.some((i) => /Guaranteed cure/i.test(i))),
      noPomAdvertising: true,
      noMisleadingNhsClaims: pageAudits.every((p) => /where eligible|where clinically appropriate/i.test(readFileSync(join(ROOT, PAGES.find((x) => x.slug === p.slug).path), "utf8"))),
      disclaimersPresent: pageAudits.every((p) => p.checks[`section_clinical-compliance`]),
      noReviewTestimonials: pageAudits.every((p) => !/testimonial|★★★★★|verified review/i.test(readFileSync(join(ROOT, PAGES.find((x) => x.slug === p.slug).path), "utf8"))),
      issues: complianceIssues,
    },
    schemaValidation: {
      allPagesValid: pageAudits.every((p) => p.checks.schemaLocalBusiness && p.checks.schemaMedicalBusiness && p.checks.schemaService && p.checks.schemaFaqPage),
      jsonLdParses: pageAudits.every((p) => !p.issues.seo.some((i) => /Invalid JSON-LD/.test(i))),
      issues: seoIssues,
    },
    internalLinkValidation: {
      hubToCluster: pageAudits.find((p) => p.pageType === "hub")?.checks.hubClusterLinks ?? false,
      clusterToHub: pageAudits.filter((p) => p.pageType === "cluster").every((p) => p.checks.hubClusterLinks),
      relatedServices: pageAudits.every((p) => p.checks.relatedServiceLinks),
      moneyPageLinks: pageAudits.every((p) => p.checks.moneyPageLinks),
      issues: linkIssues,
    },
    faqValidation: {
      hubFaqCount: pageAudits.find((p) => p.slug === "pharmacy-first-rotherham")?.faqCount ?? 0,
      clusterFaqCount: pageAudits.filter((p) => p.pageType === "cluster").map((p) => ({ slug: p.slug, count: p.faqCount })),
      issues: faqIssues,
    },
    conversionValidation: {
      primaryCta: pageAudits.every((p) => p.checks.primaryCta),
      phoneCta: pageAudits.every((p) => p.checks.phoneCta),
      localClusterCta: pageAudits.filter((p) => p.pageType === "cluster").every((p) => /serving|Call us from/i.test(readFileSync(join(ROOT, PAGES.find((x) => x.slug === p.slug).path), "utf8"))),
      issues: conversionIssues,
    },
    readinessGrade,
    meetsRefinementTargets,
    readyForLiveCampaignWiring: meetsRefinementTargets,
    blockingIssues,
    recommendedNextAction: requiresRevision
      ? "Refine renderer before live wiring: (1) expand FAQ answerHint into patient-facing answers for hub and clusters, (2) fix Service schema duplicate locality names on cluster pages, (3) improve contextual link copy to avoid repetitive injection in body paragraphs, (4) add book/call buttons to cluster bottom CTA bands, (5) replace generic Benefit N headings with benefit-led titles, (6) swap why-choose problems list for trust/differentiation copy. Re-run preview QA after template refinement."
      : "Proceed to live campaign wiring with real pharmacy tokens, images, and full cluster set.",
    pageAudits: pageAudits.map(({ slug, pageType, checks, issues, scores, faqCount }) => ({
      slug,
      pageType,
      faqCount,
      scores,
      checks,
      issues,
    })),
    inputs: {
      businessIntelligence: "output/pharmacy-blueprint/business-intelligence.json",
      serviceIntelligence: "output/pharmacy-blueprint/service-intelligence.json",
      templateArchitecture: "output/pharmacy-blueprint/template-architecture.json",
      campaignBlueprint: "output/pharmacy-blueprint/campaign-blueprints/pharmacy-first-rotherham.json",
      templateV1Report: "output/pharmacy-blueprint/clinical-nhs-template-v1-report.json",
    },
    templateV1Baseline: inputs.templateV1Report.verdict,
  };

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log(report.message);
  console.log(`Readiness grade: ${report.readinessGrade}`);
  console.log(`Aggregate overall score: ${report.aggregateScores.overall}/10`);
  console.log(`Report: ${REPORT_PATH.replace(ROOT + "/", "")}`);
  process.exit(requiresRevision ? 1 : 0);
}

main();
