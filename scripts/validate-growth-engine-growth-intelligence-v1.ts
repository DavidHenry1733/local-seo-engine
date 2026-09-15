#!/usr/bin/env npx tsx
/**
 * Growth Engine — Growth Intelligence V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GROWTH_OPPORTUNITY_VERSION,
  buildOpportunityOverview,
  buildOpportunityRoadmap,
  dedupeOpportunities,
  normalizeGrowthOpportunity,
  parseComparisonNumber,
  sortOpportunities,
  type GrowthOpportunity,
} from "../src/pharmacy/growthEngineOpportunityModel.ts";
import {
  buildGrowthOpportunityReport,
  saveGrowthOpportunityReport,
} from "../src/pharmacy/growthEngineOpportunityEngine.ts";
import { loadCompetitorSnapshot } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { renderGrowthIntelligencePage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { buildGrowthEngineFramework } from "../src/pharmacy/growthEngineFrameworkService.ts";
import { growthIntelligencePageCss } from "../src/pharmacy/growthEngineGrowthIntelligencePage.ts";

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

function sampleOpportunity(overrides: Partial<GrowthOpportunity> = {}): GrowthOpportunity {
  return normalizeGrowthOpportunity({
    id: "test-opp",
    title: "Test opportunity",
    category: "google-reviews",
    priority: "high",
    evidenceSource: "Google Places",
    evidenceSummary: "Test evidence",
    whyItMatters: "Test why",
    currentValue: "10",
    comparisonValue: "50",
    recommendedAction: "Do something",
    expectedBenefit: "Better outcome",
    confidence: "high",
    futureStatus: null,
    sortScore: 100,
    ...overrides,
  })!;
}

function main() {
  console.log("\n=== Growth Engine Growth Intelligence V1 ===\n");

  record("model-version", GROWTH_OPPORTUNITY_VERSION === 1, `v${GROWTH_OPPORTUNITY_VERSION}`);

  const normalized = normalizeGrowthOpportunity({
    id: "google-reviews-gap",
    title: "Increase Google review acquisition",
    category: "google-reviews",
    priority: "high",
    evidenceSource: "Google Places",
    evidenceSummary: "Competitor average from Google Places",
    whyItMatters: "Reviews matter",
    currentValue: "32",
    comparisonValue: "176",
    recommendedAction: "Increase review acquisition",
    expectedBenefit: "Improved trust",
    confidence: "high",
    futureStatus: null,
  });
  record("model-normalize", Boolean(normalized?.id && normalized.confidence === "high"), normalized?.title || "missing");

  record("model-rejects-invalid", normalizeGrowthOpportunity({ id: "", title: "x", category: "google-reviews" }) === null, "empty id rejected");

  const dupes = dedupeOpportunities([
    sampleOpportunity({ id: "a" }),
    sampleOpportunity({ id: "a", title: "Duplicate" }),
    sampleOpportunity({ id: "b", priority: "low" }),
  ]);
  record("dedupe", dupes.length === 2, `${dupes.length} unique`);

  const sorted = sortOpportunities([
    sampleOpportunity({ id: "low", priority: "low", sortScore: 1 }),
    sampleOpportunity({ id: "high", priority: "high", sortScore: 1 }),
    sampleOpportunity({ id: "med", priority: "medium", sortScore: 99 }),
  ]);
  record("priority-order", sorted[0]?.priority === "high" && sorted[1]?.priority === "medium", sorted.map((o) => o.priority).join(","));

  const overview = buildOpportunityOverview([
    sampleOpportunity({ id: "1", priority: "high" }),
    sampleOpportunity({ id: "2", priority: "high" }),
    sampleOpportunity({ id: "3", priority: "medium" }),
    sampleOpportunity({ id: "4", priority: "low" }),
  ]);
  record("overview-counts", overview.total === 4 && overview.high === 2 && overview.medium === 1 && overview.low === 1, JSON.stringify(overview));

  const roadmap = buildOpportunityRoadmap([
    sampleOpportunity({ id: "h", priority: "high" }),
    sampleOpportunity({ id: "m", priority: "medium" }),
    sampleOpportunity({ id: "l", priority: "low" }),
  ]);
  record("roadmap-buckets", roadmap.high.length === 1 && roadmap.medium.length === 1 && roadmap.later.length === 1, "high/medium/later");

  record("parse-comparison", parseComparisonNumber("176") === 176 && parseComparisonNumber("—") === null, "numeric parse");

  for (const slug of ["dhmdigital", "pharmaconnect"]) {
    const report = buildGrowthOpportunityReport(slug, loadCompetitorSnapshot(slug));
    record(`${slug}:report-builds`, report.version === 1 && Array.isArray(report.opportunities), `${report.overview.total} opportunities`);

    const ids = report.opportunities.map((o) => o.id);
    record(`${slug}:no-duplicate-ids`, new Set(ids).size === ids.length, `${ids.length} unique ids`);

    const inventedScores = report.opportunities.some(
      (o) => /seo score|authority score|content score|visibility score/i.test(o.title + o.evidenceSummary),
    );
    record(`${slug}:no-scores`, !inventedScores, "no score fields");

    for (const opp of report.opportunities) {
      if (!opp.evidenceSummary || !opp.recommendedAction || !opp.expectedBenefit) {
        record(`${slug}:evidence-complete-${opp.id}`, false, "missing evidence fields");
      }
    }
    record(`${slug}:evidence-fields`, report.opportunities.every((o) => o.evidenceSummary && o.recommendedAction && o.expectedBenefit), "all complete");

    const websiteSection = report.websiteAnalysisPlaceholders.every((p) => p.note.includes("Available after website analysis"));
    record(`${slug}:website-placeholders`, websiteSection && report.websiteAnalysisPlaceholders.length >= 6, `${report.websiteAnalysisPlaceholders.length} placeholders`);

    const html = renderGrowthIntelligencePage(slug, loadCompetitorSnapshot(slug));
    record(`${slug}:page-sections`, [
      "Growth Overview",
      "Priority Opportunities",
      "Evidence",
      "Missing Content",
      "Local Visibility",
      "Website Analysis",
      "Growth Roadmap",
      "Ready To Build",
    ].every((s) => html.includes(s)), "8 sections");
    record(`${slug}:no-placeholder-cards`, !html.includes("Placeholder") && !html.includes("Competitive comparison framework"), "V1 page");
    record(`${slug}:ready-to-build`, html.includes("Review Growth Plan") && html.includes("growth-plan"), "CTA");

    const framework = buildGrowthEngineFramework(slug);
    const step3 = framework.steps.find((s) => s.id === "growth-intelligence");
    record(`${slug}:framework-step3`, step3?.subtitle?.includes("Evidence-backed") === true, step3?.summary || "missing");

    const saved = saveGrowthOpportunityReport(report);
    record(`${slug}:persist`, fs.existsSync(saved), path.basename(saved));
  }

  record("page-css", growthIntelligencePageCss().includes("gi-overview"), "styles");

  const apiFile = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngine.ts"), "utf8");
  record("api-opportunities", apiFile.includes("/opportunities"), "GET endpoint");

  record("docs-exist", fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-GROWTH-INTELLIGENCE-V1.md")), "documentation");

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
