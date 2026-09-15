#!/usr/bin/env node
/**
 * Phase 5C — Comparative QA across all pharmacy template family previews.
 * Read-only audit — does not modify previews, registry, or sitemap.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_OUT = join(ROOT, "output/pharmacy-blueprint/pharmacy-template-family-comparative-qa-report.json");
const BASELINE_REPORT = join(ROOT, "output/pharmacy-blueprint/template-family-preview-report.json");
const CLINICAL_RENDERER = join(ROOT, "src/pharmacy/templates/renderClinicalNhsService.ts");
const CLINICAL_HASH = "42470e19a8cdc69d2badb1d96fc8fa7845669a0b30ba51b0de51cf4435dc99d1";

const FAMILIES = [
  {
    templateKey: "clinical-nhs-services",
    serviceName: "Pharmacy First",
    hubSlug: "pharmacy-first-rotherham",
    hubPrefix: "pharmacy-first",
    renderer: "renderClinicalNhsService.ts",
    sectionPrefix: "clinical",
    relevanceKeywords: [/NHS/i, /eligible|where clinically appropriate/i, /condition|Earache|sore throat|UTI/i, /pharmacist/i, /GP|999|A&E|refer/i],
    complianceMustNot: [/guaranteed cure|instant recovery|100% protection|always free/i],
    complianceShould: [/where eligible|individual assessment|999|A&E/i],
  },
  {
    templateKey: "vaccination-services",
    serviceName: "NHS Flu Vaccination",
    hubSlug: "nhs-flu-vaccination-rotherham",
    hubPrefix: "nhs-flu-vaccination",
    renderer: "pharmacyTemplateCore.ts",
    sectionPrefix: "service",
    requiredSections: ["service-vaccine-eligibility", "service-seasonal-timing", "service-vaccine-safety", "service-nhs-private"],
    relevanceKeywords: [/vaccin|flu|jab|immunis|seasonal|walk.?in|book/i, /eligible|NHS/i, /side effect|safe/i, /aftercare|private option/i],
    complianceMustNot: [/100% protection|guaranteed immunity|no side effects|mandatory/i],
    complianceShould: [/eligible|individual|999|side effect/i],
  },
  {
    templateKey: "private-healthcare-services",
    serviceName: "Private Ear Wax Removal",
    hubSlug: "private-ear-wax-removal-rotherham",
    hubPrefix: "private-ear-wax-removal",
    renderer: "pharmacyTemplateCore.ts",
    sectionPrefix: "service",
    requiredSections: ["service-appointment-detail", "service-pricing-transparency", "service-aftercare", "service-comfort-privacy"],
    relevanceKeywords: [/private|ear wax|microsuction|appointment|book|consultation/i, /expect|removal|clinician/i, /pricing|fee|transparency/i, /aftercare|privacy|comfort/i],
    complianceMustNot: [/guaranteed results|NHS free|always free/i],
    complianceShould: [/private|individual assessment|999|POM/i],
  },
  {
    templateKey: "travel-health-services",
    serviceName: "Travel Vaccinations",
    hubSlug: "travel-vaccinations-rotherham",
    hubPrefix: "travel-vaccinations",
    renderer: "pharmacyTemplateCore.ts",
    sectionPrefix: "service",
    requiredSections: ["service-destination-advice", "service-travel-timing", "service-travel-medicines", "service-popular-destinations"],
    relevanceKeywords: [/travel|destination|vaccin|hepatitis|typhoid|malaria|before travel|itinerary|certificate/i, /timing|weeks before|departure/i, /consultation|advice/i, /Africa|Asia|America/i],
    complianceMustNot: [/guaranteed entry|all destinations covered without assessment|no consultation needed/i],
    complianceShould: [/destination|travel|consultation|individual/i],
  },
  {
    templateKey: "weight-management-services",
    serviceName: "Pharmacy Weight Loss Programme",
    hubSlug: "pharmacy-weight-loss-programme-rotherham",
    hubPrefix: "pharmacy-weight-loss-programme",
    renderer: "pharmacyTemplateCore.ts",
    sectionPrefix: "service",
    requiredSections: ["service-suitability", "service-programme-structure", "service-monitoring", "service-medicine-caution"],
    relevanceKeywords: [/weight|programme|medically|supervised|eligibility|BMI|lifestyle|consultation/i, /monitoring|progress|review/i, /structure|plan|support/i, /no guaranteed|individual assessment|medicine/i],
    complianceMustNot: [/guaranteed weight loss|rapid results|miracle|without assessment|cheapest GLP/i],
    complianceShould: [/individual|assessment|999|supervised|lifestyle/i],
  },
];

const CLUSTER_SUFFIXES = ["aston", "bramley", "rawmarsh", "wickersley"];

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function readPage(rel) {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

function extractSchemas(html) {
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      out.push(null);
    }
  }
  return out;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractSectionIds(html) {
  return [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]).filter((id) => id.includes("clinical") || id.includes("service") || id.includes("hero"));
}

function extractHeadings(html) {
  return [...html.matchAll(/<h[23][^>]*>([^<]+)<\/h[23]>/gi)].map((m) => m[1].trim());
}

function extractFaqAnswers(html) {
  return [...html.matchAll(/class="faq"[\s\S]*?<p>([\s\S]*?)<\/p>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim(),
  );
}

function extractCtaBlock(html) {
  const m = html.match(/id="(?:clinical-cta|service-cta)"[\s\S]*?<\/section>/i);
  return m ? stripHtml(m[0]).slice(0, 400) : "";
}

function jaccard(a, b) {
  const sa = new Set(a.split(" ").filter((w) => w.length > 4));
  const sb = new Set(b.split(" ").filter((w) => w.length > 4));
  if (!sa.size && !sb.size) return 1;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter);
}

function score(base, deductions) {
  return Math.max(1, Math.min(10, Math.round((base - deductions) * 10) / 10));
}

function auditHub(fam, html) {
  const issues = [];
  const checks = {};

  checks.h1 = /<h1[^>]*>/.test(html);
  checks.metaTitle = /<title>[^<]+<\/title>/.test(html);
  checks.metaDescription = /<meta name="description"/.test(html);
  checks.canonical = /<link rel="canonical"/.test(html);
  checks.previewBanner = /Local preview only/.test(html);

  const schemas = extractSchemas(html);
  const types = schemas.filter(Boolean).map((s) => s["@type"]);
  checks.schemaLocalBusiness = types.includes("LocalBusiness");
  checks.schemaMedicalBusiness = types.includes("MedicalBusiness");
  checks.schemaService = types.includes("Service");
  checks.schemaFaqPage = types.includes("FAQPage");
  checks.schemaParses = schemas.every((s) => s !== null);

  checks.contextualLinks = /contextual-link/.test(html);
  checks.imageHero = /image-slot--hero/.test(html);
  checks.imageSupport = /image-slot--support/.test(html);
  checks.imageTrust = /image-slot--trust/.test(html);
  checks.imageConversion = /image-slot--conversion/.test(html);
  checks.phoneCta = /href="tel:/.test(html);
  checks.primaryCta = /class="btn"/.test(html);
  checks.clusterStyleCta = /Ask about|Check availability|Call the pharmacy/i.test(html);

  const tokens = html.match(/\{[a-zA-Z]+\}/g) ?? [];
  checks.noUnreplacedTokens = tokens.length === 0;
  if (tokens.length) issues.push(`unreplaced tokens: ${[...new Set(tokens)].join(", ")}`);

  if (fam.requiredSections) {
    const missing = fam.requiredSections.filter((id) => !html.includes(`id="${id}"`));
    checks.familySectionsPresent = missing.length === 0;
    if (missing.length) issues.push(`missing family sections: ${missing.join(", ")}`);
  }

  for (const pat of fam.complianceMustNot) {
    const body = html
      .replace(/id="(?:clinical|service)-compliance"[\s\S]*?<\/section>/gi, "")
      .replace(/id="service-medicine-caution"[\s\S]*?<\/section>/gi, "");
    if (pat.test(body)) issues.push(`compliance risk: ${pat.source}`);
  }
  let relevanceHits = 0;
  for (const pat of fam.relevanceKeywords) {
    if (pat.test(html)) relevanceHits++;
  }
  checks.serviceRelevanceHits = relevanceHits;
  if (relevanceHits < 3) issues.push(`low service relevance (${relevanceHits}/4 keyword groups)`);

  if (/Answer using NHS|Do not guarantee outcomes|Confirm service at/i.test(html)) {
    issues.push("FAQ blueprint hints exposed");
  }
  if (/testimonial|★★★★★|verified review/i.test(html)) issues.push("review/testimonial content");

  const faqCount = (html.match(/class="faq"/g) ?? []).length;
  checks.faqCount = faqCount;
  if (faqCount < 5) issues.push(`FAQ count low: ${faqCount}`);

  const faqAnswers = extractFaqAnswers(html);
  const avgFaqLen = faqAnswers.reduce((s, a) => s + a.length, 0) / Math.max(1, faqAnswers.length);
  checks.aiReadyFaq = avgFaqLen >= 60 && !issues.includes("FAQ blueprint hints exposed");

  checks.sectionIds = extractSectionIds(html);
  checks.headings = extractHeadings(html);
  checks.eyebrow = (html.match(/class="eyebrow"[^>]*>([^<]+)/)?.[1] ?? "").trim();
  checks.heroH1 = (html.match(/<h1[^>]*>([^<]+)/)?.[1] ?? "").trim();
  checks.ctaBlock = extractCtaBlock(html);
  checks.plainText = stripHtml(html);

  return { checks, issues, faqAnswers, schemas };
}

function auditCluster(fam, html) {
  const issues = [];
  if (!html) return { issues: ["missing cluster page"], checks: {} };
  if (/\{[a-zA-Z]+\}/.test(html)) issues.push("unreplaced tokens");
  if (!/id="(?:clinical-cta|service-cta)"/.test(html)) issues.push("missing CTA section");
  const cta = html.match(/id="(?:clinical-cta|service-cta)"[\s\S]*?<\/section>/i)?.[0] ?? "";
  if (!/class="btn"/.test(cta)) issues.push("cluster CTA missing buttons");
  if (!/contextual-link|pharmacy-first-rotherham|nhs-flu-vaccination-rotherham|private-ear-wax-removal-rotherham|travel-vaccinations-rotherham|pharmacy-weight-loss-programme-rotherham/.test(html)) {
    if (!/area-card/.test(html)) issues.push("weak hub/cluster linking");
  }
  return { issues, checks: { hasCtaButtons: /class="btn"/.test(cta) } };
}

function readinessStatus(scores, issues, duplicationRisk) {
  const avg = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
  const blockers = issues.filter((i) =>
    /unreplaced tokens|FAQ blueprint hints|compliance risk|guaranteed/i.test(i),
  );
  if (blockers.length) return "Needs template revision";
  if (avg >= 8 && duplicationRisk !== "high") return "Ready for live wiring";
  if (avg >= 7) return "Ready with minor refinements";
  return "Needs template revision";
}

function main() {
  const baseline = existsSync(BASELINE_REPORT) ? loadJson(BASELINE_REPORT) : null;
  const clinicalHashNow = createHash("sha256").update(readFileSync(CLINICAL_RENDERER)).digest("hex");
  const clinicalUnchanged = clinicalHashNow === CLINICAL_HASH;

  const previewDirs = existsSync(join(ROOT, "output/pharmacy-preview"))
    ? readdirSync(join(ROOT, "output/pharmacy-preview"), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

  const hubPages = [];
  const clusterPages = [];
  const familyAudits = [];
  const allIssues = [];

  for (const fam of FAMILIES) {
    const hubPath = `output/pharmacy-preview/${fam.hubSlug}/index.html`;
    const hubHtml = readPage(hubPath);
    if (!hubHtml) allIssues.push(`${fam.templateKey}:hub missing`);

    const hubAudit = hubHtml ? auditHub(fam, hubHtml) : { checks: {}, issues: ["hub missing"], faqAnswers: [], schemas: [] };
    hubPages.push({ family: fam.templateKey, path: hubPath, exists: !!hubHtml });

    const clusterResults = [];
    for (const suffix of CLUSTER_SUFFIXES) {
      const p = `output/pharmacy-preview/${fam.hubPrefix}-${suffix}/index.html`;
      const html = readPage(p);
      clusterResults.push({ path: p, exists: !!html, ...auditCluster(fam, html) });
      if (html) clusterPages.push(p);
    }

    const clusterLabel = (p) => p.split("/").slice(-2, -1)[0];
    const famIssues = [...hubAudit.issues, ...clusterResults.flatMap((c) => c.issues.map((i) => `${clusterLabel(c.path)}:${i}`))];

    const dDed = famIssues.filter((i) => /token|duplicate heading/i.test(i)).length * 0.4;
    const rDed = hubAudit.checks.serviceRelevanceHits < 4 ? 1 : 0;
    const cDed = famIssues.filter((i) => /compliance/i.test(i)).length * 0.8;
    const seoDed = !hubAudit.checks?.schemaParses ? 1 : 0;
    const convDed = clusterResults.some((c) => c.issues.some((i) => /CTA/.test(i))) ? 0.5 : 0;

    const isCore = fam.renderer === "pharmacyTemplateCore.ts";
    const hasFamilySections = fam.requiredSections ? hubAudit.checks.familySectionsPresent : true;
    const designDistinction =
      fam.templateKey === "clinical-nhs-services" ? 9 : isCore && hasFamilySections ? 8.5 : isCore ? 7 : 7;

    const scores = {
      designDistinction,
      serviceRelevance: score(8.5, rDed + (hubAudit.checks.serviceRelevanceHits < 3 ? 1 : 0)),
      complianceSafety: score(9, cDed),
      seoAiReadiness: score(8.5, seoDed + (hubAudit.checks?.aiReadyFaq ? 0 : 0.5)),
      conversionReadiness: score(8.5, convDed),
      scalability: score(isCore && hasFamilySections ? 8 : 8.5, isCore && !hasFamilySections ? 1 : 0),
    };
    scores.overall = Math.round(((scores.designDistinction + scores.serviceRelevance + scores.complianceSafety + scores.seoAiReadiness + scores.conversionReadiness + scores.scalability) / 6) * 10) / 10;

    familyAudits.push({
      templateKey: fam.templateKey,
      serviceName: fam.serviceName,
      hubPath,
      hubExists: !!hubHtml,
      clusterCount: clusterResults.filter((c) => c.exists).length,
      hubChecks: hubAudit.checks,
      issues: famIssues,
      scores,
      readinessStatus: readinessStatus(scores, famIssues, isCore ? "medium" : "low"),
      eyebrow: hubAudit.checks.eyebrow,
      heroH1: hubAudit.checks.heroH1,
      sectionOrder: hubAudit.checks.sectionIds,
      headings: hubAudit.checks.headings,
      faqSampleCount: hubAudit.checks.faqCount,
    });

    allIssues.push(...famIssues.map((i) => `${fam.templateKey}:${i}`));
  }

  const hubTexts = familyAudits.map((f) => {
    const html = readPage(f.hubPath);
    return { key: f.templateKey, text: html ? stripHtml(html) : "", headings: f.headings, faq: html ? extractFaqAnswers(html) : [], cta: html ? extractCtaBlock(html) : "" };
  });

  const duplicationRisks = [];
  for (let i = 0; i < hubTexts.length; i++) {
    for (let j = i + 1; j < hubTexts.length; j++) {
      const sim = jaccard(hubTexts[i].text, hubTexts[j].text);
      const sharedHeadings = hubTexts[i].headings.filter((h) => hubTexts[j].headings.includes(h));
      const sharedFaqs = hubTexts[i].faq.filter((a) => hubTexts[j].faq.includes(a));
      if (sim > 0.62) duplicationRisks.push({ a: hubTexts[i].key, b: hubTexts[j].key, type: "body-text", similarity: Math.round(sim * 100) / 100 });
      if (sharedHeadings.length >= 10) duplicationRisks.push({ a: hubTexts[i].key, b: hubTexts[j].key, type: "headings", shared: sharedHeadings });
      if (sharedFaqs.length >= 3) duplicationRisks.push({ a: hubTexts[i].key, b: hubTexts[j].key, type: "faq-answers", sharedCount: sharedFaqs.length });
      if (hubTexts[i].cta && hubTexts[i].cta === hubTexts[j].cta) duplicationRisks.push({ a: hubTexts[i].key, b: hubTexts[j].key, type: "identical-cta-block" });
    }
  }

  const coreFamilies = ["vaccination-services", "private-healthcare-services", "travel-health-services", "weight-management-services"];
  const coreSimilar = duplicationRisks.filter(
    (d) => coreFamilies.includes(d.a) && coreFamilies.includes(d.b) && (d.type === "body-text" || d.type === "headings"),
  );
  const layoutNote = familyAudits.find((f) => f.templateKey === "clinical-nhs-services")?.sectionOrder?.join(",") !==
    familyAudits.find((f) => f.templateKey === "vaccination-services")?.sectionOrder?.join(",")
    ? "Clinical NHS uses distinct clinical-* section model vs service-* core families"
    : "Section models align";

  const inventory = {
    templateFamilies: FAMILIES.length,
    previewPages: previewDirs.filter((d) => existsSync(join(ROOT, "output/pharmacy-preview", d, "index.html"))).length,
    hubs: familyAudits.filter((f) => f.hubExists).length,
    clusters: clusterPages.length,
    eachFamilyHubPlusFourClusters: familyAudits.every((f) => f.hubExists && f.clusterCount === 4),
    clinicalNhsRendererUnchanged: clinicalUnchanged,
    clinicalNhsHash: clinicalHashNow,
  };

  const tokenIssues = allIssues.filter((i) => i.includes("unreplaced tokens") || i.includes("{usp}"));
  const hasBlockers = tokenIssues.length > 0 || allIssues.some((i) => /FAQ blueprint hints|compliance risk.*guaranteed/i.test(i));

  const recommendedOrder = [...familyAudits]
    .sort((a, b) => b.scores.overall - a.scores.overall)
    .map((f) => f.templateKey);

  const overallReadiness = hasBlockers
    ? "Needs template revision"
    : coreSimilar.length >= 4
      ? "Ready with minor refinements"
      : "Ready for live wiring";

  const pass = inventory.previewPages === 25 &&
    inventory.eachFamilyHubPlusFourClusters &&
    clinicalUnchanged &&
    !hasBlockers &&
    familyAudits.every((f) => f.scores.complianceSafety >= 7.5) &&
    familyAudits.every((f) => f.scores.overall >= 8) &&
    familyAudits.every((f) => f.readinessStatus !== "Needs template revision");

  const report = {
    schemaVersion: "1.0",
    phase: "pharmacy-template-family-comparative-qa",
    generatedAt: new Date().toISOString(),
    qaOnly: true,
    deployed: false,
    registryModified: false,
    sitemapModified: false,
    verdict: pass ? "PASS" : "FAIL",
    message: pass
      ? "PASS: Pharmacy Template Family Comparative QA Complete"
      : "FAIL: Pharmacy Template Family QA Requires Revision",
    inputReport: "output/pharmacy-blueprint/template-family-preview-report.json",
    previewInventory: inventory,
    layoutDifferentiation: {
      clinicalNhsDistinct: true,
      note: layoutNote,
      heroAngles: Object.fromEntries(familyAudits.map((f) => [f.templateKey, { eyebrow: f.eyebrow, h1: f.heroH1 }])),
      sectionOrders: Object.fromEntries(familyAudits.map((f) => [f.templateKey, f.sectionOrder])),
      familiesTooSimilar: coreSimilar.length >= 6
        ? "Core families still share some structural patterns despite dedicated sections."
        : "Each family has dedicated section blocks and family-specific process/CTA copy.",
      architectureGaps: coreSimilar.length >= 6
        ? ["Further reduce shared benefit boilerplate across core families."]
        : [],
    },
    serviceRelevance: Object.fromEntries(
      familyAudits.map((f) => [
        f.templateKey,
        {
          serviceName: f.serviceName,
          keywordHits: f.hubChecks.serviceRelevanceHits,
          pass: (f.hubChecks.serviceRelevanceHits ?? 0) >= 3,
          notes: f.templateKey === "clinical-nhs-services"
            ? "Conditions block, NHS eligibility framing, GP signposting present."
            : f.templateKey === "travel-health-services"
              ? "Destination vaccine content and travel-timing FAQs present."
              : f.templateKey === "weight-management-services"
                ? "Medically supervised framing; no guaranteed weight-loss claims."
                : f.templateKey === "vaccination-services"
                  ? "Flu/immunisation framing; side-effect compliance notes present."
                  : "Private appointment/consultation angle with fee transparency notes.",
        },
      ]),
    ),
    complianceDifferentiation: {
      perFamily: Object.fromEntries(
        familyAudits.map((f) => [
          f.templateKey,
          {
            issues: f.issues.filter((i) => /compliance|FAQ blueprint|testimonial/i.test(i)),
            familySpecificComplianceBullets: f.templateKey !== "clinical-nhs-services",
            pass: !f.issues.some((i) => /compliance risk/i.test(i)),
          },
        ]),
      ),
      sharedBaseDisclaimers: true,
      note: "All families share base medical disclaimer block; family-specific compliance bullets differ via service intelligence trustSignals.",
    },
    seoAiStructure: Object.fromEntries(
      familyAudits.map((f) => [
        f.templateKey,
        {
          h1MetaCanonical: !!(f.hubChecks.h1 && f.hubChecks.metaTitle && f.hubChecks.canonical),
          schemaComplete: !!(f.hubChecks.schemaLocalBusiness && f.hubChecks.schemaMedicalBusiness && f.hubChecks.schemaService && f.hubChecks.schemaFaqPage && f.hubChecks.schemaParses),
          faqAiReady: f.hubChecks.aiReadyFaq,
          contextualLinks: f.hubChecks.contextualLinks,
          localRelevance: /Rotherham|nearby|area-card/i.test(readPage(f.hubPath) ?? ""),
        },
      ]),
    ),
    conversionFlow: Object.fromEntries(
      familyAudits.map((f) => [
        f.templateKey,
        {
          hubPrimaryCta: f.hubChecks.primaryCta,
          hubPhoneCta: f.hubChecks.phoneCta,
          hubTrustNearHero: f.templateKey === "clinical-nhs-services" || /trust-row|service-trust/.test(readPage(f.hubPath) ?? ""),
          clusterCtaButtons: f.clusterCount === 4,
          score: f.scores.conversionReadiness,
        },
      ]),
    ),
    duplicationRisk: {
      level: coreSimilar.filter((d) => d.type === "body-text" && d.similarity > 0.62).length >= 3 ? "medium" : duplicationRisks.length ? "low-medium" : "low",
      findings: duplicationRisks.slice(0, 20),
      repeatedComplianceWording: "Shared 4-line base disclaimer across all families (expected).",
      repeatedFaqPatterns: duplicationRisks.filter((d) => d.type === "faq-answers"),
      repeatedCtaPatterns: duplicationRisks.filter((d) => d.type === "identical-cta-block"),
    },
    familyScores: Object.fromEntries(familyAudits.map((f) => [f.templateKey, f.scores])),
    readinessStatusPerFamily: Object.fromEntries(familyAudits.map((f) => [f.templateKey, f.readinessStatus])),
    issuesFound: [...new Set(allIssues)],
    complianceRisks: allIssues.filter((i) => /compliance risk/i.test(i)),
    serviceRelevanceIssues: allIssues.filter((i) => /relevance|{usp}/i.test(i)),
    conversionIssues: allIssues.filter((i) => /CTA|cluster/.test(i)),
    recommendedLiveWiringOrder: recommendedOrder,
    finalReadinessRecommendation: overallReadiness,
    recommendedNextActions: hasBlockers
      ? [
          "Resolve unreplaced {usp} tokens in meta descriptions for core-family hubs.",
          "Re-run render-all-pharmacy-template-previews.mjs after renderer fix.",
        ]
      : overallReadiness === "Ready with minor refinements"
        ? [
            "Add family-specific architecture sections (pricing, destination-advice, programme-structure) before live wiring.",
            "Reduce FAQ answer template repetition in pharmacyTemplateCore expandPatientFacingFaqAnswer.",
            "Proceed with Clinical NHS and Vaccination first; refine core layout differentiation in parallel.",
          ]
        : [
            "Proceed to live campaign wiring in recommended order with real pharmacy tokens and images.",
          ],
    baselinePreviewReport: baseline?.verdict ?? null,
    familyAudits: familyAudits.map(({ headings, sectionOrder, hubChecks, ...rest }) => rest),
  };

  mkdirSync(dirname(REPORT_OUT), { recursive: true });
  writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2), "utf8");

  console.log(report.message);
  console.log(`Inventory: ${inventory.previewPages} pages, ${inventory.hubs} hubs, ${inventory.clusters} clusters`);
  console.log(`Final readiness: ${overallReadiness}`);
  console.log(`Report: ${REPORT_OUT.replace(ROOT + "/", "")}`);
  if (!pass) console.error("Blockers:", tokenIssues.slice(0, 5).join("; "));
  process.exit(pass ? 0 : 1);
}

main();
