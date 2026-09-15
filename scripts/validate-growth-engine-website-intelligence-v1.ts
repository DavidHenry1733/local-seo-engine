#!/usr/bin/env npx tsx
/**
 * Sprint 3 — Website Intelligence V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyWebsitePage } from "../src/pharmacy/growthEngineWebsiteClassifier.ts";
import {
  detectServicesInHtml,
  detectServicesInUrl,
  WEBSITE_SERVICE_PATTERNS,
} from "../src/pharmacy/growthEngineWebsiteServiceDetection.ts";
import {
  buildContentCoverage,
  buildContentInventory,
  buildContentOpportunities,
  buildMissingContent,
  buildServiceDetections,
  buildWebsiteIntelligenceAnalysis,
  buildWebsiteSummaryNarrative,
  estimateRecommendedEcosystemPages,
} from "../src/pharmacy/growthEngineWebsiteIntelligenceAnalysis.ts";
import { extractInternalLinks, extractTechnicalSignals } from "../src/pharmacy/growthEngineWebsiteCrawler.ts";
import { renderWebsiteIntelligencePage } from "../src/pharmacy/growthEngineWebsiteIntelligencePage.ts";
import { renderWebsiteIntelligencePage as renderWebsitePage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { GROWTH_ENGINE_STEPS, buildGrowthEngineFramework } from "../src/pharmacy/growthEngineFrameworkService.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import type { WebsitePageInventoryItem } from "../src/pharmacy/growthEngineWebsiteIntelligenceModel.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function samplePages(): WebsitePageInventoryItem[] {
  return [
    { url: "https://example.com/", path: "/", title: "Brook Pharmacy", category: "homepage", detectedServiceIds: [] },
    { url: "https://example.com/services/", path: "/services", title: "Services", category: "services", detectedServiceIds: [] },
    {
      url: "https://example.com/blood-pressure-checks/",
      path: "/blood-pressure-checks",
      title: "Blood Pressure Checks",
      category: "service-page",
      detectedServiceIds: ["blood-pressure-checks"],
    },
    {
      url: "https://example.com/blog/bp-tips/",
      path: "/blog/bp-tips",
      title: "Blood pressure tips",
      category: "blog",
      detectedServiceIds: ["blood-pressure-checks"],
    },
    { url: "https://example.com/faqs/", path: "/faqs", title: "FAQs", category: "faq", detectedServiceIds: [] },
    { url: "https://example.com/contact/", path: "/contact", title: "Contact", category: "contact", detectedServiceIds: [] },
  ];
}

function main() {
  console.log("\n=== Sprint 3 — Website Intelligence V1 ===\n");

  record("workflow-seven-steps", GROWTH_ENGINE_STEPS.length === 7, String(GROWTH_ENGINE_STEPS.length));
  record("workflow-website-step", GROWTH_ENGINE_STEPS.some((s) => s.id === "website-intelligence"), "step 3");
  record("service-patterns", WEBSITE_SERVICE_PATTERNS.length >= 18, String(WEBSITE_SERVICE_PATTERNS.length));

  record("classify-homepage", classifyWebsitePage("/", "Home", "") === "homepage", "homepage");
  record("classify-service-page", classifyWebsitePage("/blood-pressure-checks", "BP", "") === "service-page", "service-page");
  record("classify-blog", classifyWebsitePage("/blog/article", "Blog", "") === "blog", "blog");
  record("classify-faq", classifyWebsitePage("/faqs", "FAQ", "") === "faq", "faq");

  record("detect-bp-url", detectServicesInUrl("/blood-pressure-checks").includes("blood-pressure-checks"), "url");
  record("detect-pf-html", detectServicesInHtml("We offer NHS Pharmacy First consultations").includes("pharmacy-first"), "html");

  const pages = samplePages();
  const inventory = buildContentInventory(pages);
  record("inventory-total", inventory.totalPages === 6, String(inventory.totalPages));
  record("inventory-service-pages", inventory.servicePages === 1, String(inventory.servicePages));
  record("inventory-blogs", inventory.blogArticles === 1, String(inventory.blogArticles));

  const detections = buildServiceDetections(pages);
  record("service-detections", detections.some((d) => d.serviceId === "blood-pressure-checks"), "bp detected");

  const profile = normalizeProfileData({
    website: "https://example.com",
    selectedServices: ["blood-pressure-checks", "travel-vaccinations"],
    selectedAreas: [{ areaName: "Ecclesall", priority: 1, order: 1, selected: true, source: "test" }],
  });

  const coverage = buildContentCoverage(profile, pages, detections);
  record("coverage-enabled", coverage.length === 2, String(coverage.length));
  record("coverage-bp-present", coverage.find((c) => c.serviceId === "blood-pressure-checks")?.websiteDetected === true, "bp present");
  record("coverage-travel-missing", coverage.find((c) => c.serviceId === "travel-vaccinations")?.websiteDetected === false, "travel missing");

  const missing = buildMissingContent(coverage);
  record("missing-travel-page", missing.some((m) => m.serviceId === "travel-vaccinations"), missing.map((m) => m.gap).join("; "));
  record("missing-no-invent", buildMissingContent([]).length === 0, "empty coverage");

  const opps = buildContentOpportunities(coverage, missing);
  record("opp-travel", opps.some((o) => o.serviceId === "travel-vaccinations" && /Not detected/i.test(o.headline)), "travel opp");
  record("opp-evidence", opps.every((o) => Boolean(o.evidence)), "all have evidence");

  const recommended = estimateRecommendedEcosystemPages(profile);
  record("recommended-real-math", recommended.totalPages > inventory.totalPages, `${recommended.totalPages} vs ${inventory.totalPages}`);

  const technical = extractTechnicalSignals(
    '<html><head><title>Test Pharmacy</title><meta name="description" content="Independent pharmacy services"/><meta property="og:title" content="Test"/><link rel="canonical" href="https://example.com"/><script type="application/ld+json">{}</script></head></html>',
    "https://example.com",
    true,
    true,
  );
  record("tech-https", technical.https, "https");
  record("tech-schema", technical.schemaDetected, "schema");
  record("tech-no-scores", !("seoScore" in technical) && !("healthScore" in technical), "no scores");

  const analysis = buildWebsiteIntelligenceAnalysis({
    websiteUrl: "https://example.com",
    pages,
    technical,
    profile,
  });
  record("analysis-live", analysis.dataSource === "website-live", analysis.dataSource);
  record("analysis-complete", analysis.understandingComplete, "complete");
  record("summary-evidence", buildWebsiteSummaryNarrative(pages, inventory, coverage, detections).some((p) => /identified 6 page/i.test(p)), "summary");

  const links = extractInternalLinks('<a href="/services">Services</a><a href="https://example.com/contact">Contact</a>', new URL("https://example.com"));
  record("internal-links", links.length >= 2, String(links.length));

  const mockSnapshot = {
    version: 1,
    slug: "test",
    generatedAt: new Date().toISOString(),
    source: "website-live" as const,
    websiteUrl: "https://example.com",
    analysis,
  };

  const html = renderWebsiteIntelligencePage("test", mockSnapshot, {});
  record("page-title", html.includes("Website Intelligence"), "title");
  record("page-no-seo-audit", !html.includes("SEO score") && !html.includes("Authority score"), "no scores");
  record("page-content-map", html.includes("wi-map"), "content map");
  record("page-visual-summary", html.includes("Current website"), "visual summary");
  record("page-coverage", html.includes("Content coverage"), "coverage");
  record("page-missing", html.includes("Missing content"), "missing");
  record("page-opportunities", html.includes("Content opportunities"), "opportunities");
  record("page-technical", html.includes("Technical overview"), "technical");
  record("page-analyse-btn", html.includes("btnAnalyseWebsite"), "analyse button");
  record("page-ready-growth", html.includes("Website understanding complete"), "ready");
  record("page-continue-gi", html.includes("/api/growth-engine/growth-intelligence"), "continue CTA");

  for (const slug of ["dhmdigital", "pharmaconnect"]) {
    const page = renderWebsitePage(slug);
    record(`${slug}:renders`, page.includes("Website Intelligence"), "renders");
    record(`${slug}:framework-step`, buildGrowthEngineFramework(slug).steps.some((s) => s.id === "website-intelligence"), "in framework");
  }

  record("docs-exist", fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-WEBSITE-INTELLIGENCE-V1.md")), "docs");
  record("growth-intel-untouched", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineOpportunityEngine.ts")), "GI file exists");
  record("local-healthcare-untouched", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineHealthcareDiscovery.ts")), "LH file exists");

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
