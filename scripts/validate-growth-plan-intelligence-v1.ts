#!/usr/bin/env npx tsx
import fs from "node:fs";
import contract from "../src/pharmacy/growthPlanIntelligenceContract.ts";
import service from "../src/pharmacy/growthPlanIntelligenceV1Service.ts";

const { buildGrowthPlanIntelligenceInput } = contract;
const { buildGrowthPlanIntelligenceV1 } = service;

let pass = 0;
let fail = 0;
function check(id: string, ok: boolean, detail: string) {
  if (ok) {
    pass++;
    console.log(`PASS  ${id} — ${detail}`);
  } else {
    fail++;
    console.log(`FAIL  ${id} — ${detail}`);
  }
}

function item(overrides: Record<string, unknown>) {
  return {
    keyword: "pharmacy seo",
    type: "MONEY_KEYWORD",
    qualification: "QUALIFIED",
    marketScope: "CORE",
    gapType: "UNTAPPED",
    searchVolume: 50,
    cpc: 1,
    paidCompetition: 0.2,
    directCompetitorsRanking: 3,
    bestCompetitorDomain: "example.com",
    bestCompetitorPosition: 3,
    bestRankingUrl: "https://example.com/page",
    subjectPosition: null,
    subjectRankingUrl: null,
    score: 90,
    priority: "HIGH",
    reasons: ["test reason"],
    sources: ["domain_intersection_gap"],
    ...overrides,
  };
}

const input = buildGrowthPlanIntelligenceInput({
  generatedAt: "2026-08-16T00:00:00.000Z",
  subjectDomain: "pharmaconnect.uk",
  universe: [
    item({ keyword: "pharmacy seo" }),
    item({ keyword: "seo for pharmacies", searchVolume: 30 }),
    item({ keyword: "pharmacy web design", gapType: "UNTAPPED", sources: ["ranked_keyword"] }),
    item({ keyword: "pharmaceutical marketing agency", marketScope: "BROAD" }),
    item({ keyword: "pharmacy leaflet", type: "COMMERCIAL_SUPPORT" }),
    item({ keyword: "cost of flu jab", type: "PATIENT_SERVICE", qualification: "REJECTED", marketScope: "NONE" }),
    item({ keyword: "pharmacists online", type: "AMBIGUOUS_REVIEW", qualification: "REVIEW", marketScope: "CORE" }),
  ],
});
const plan = buildGrowthPlanIntelligenceV1(input);
const actionKeywords = plan.actions.flatMap((action) => [action.primaryKeyword, ...action.supportingKeywords]);

check("locked-contract-used", input.metadata.source === "market-universe-v2-reclassified-b", input.metadata.source);
check("excluded-not-positive", !actionKeywords.includes("cost of flu jab"), "patient excluded");
check("review-not-positive", !actionKeywords.includes("pharmacists online"), "review excluded");
check("broad-not-core", plan.roadmap.immediate.every((action) => action.marketScope !== "BROAD"), "broad excluded from immediate core");
check("core-money-consumed", actionKeywords.includes("pharmacy seo"), "core consumed");
check("proven-gap-preserved", plan.actions.some((action) => action.gapEvidenceStatus === "PROVEN_UNTAPPED"), "proven gap");
check("insufficient-preserved", plan.actions.some((action) => action.gapEvidenceStatus === "INSUFFICIENT_EVIDENCE"), "insufficient evidence retained");
check("no-false-untapped", plan.actions.find((action) => action.primaryKeyword === "pharmacy web design")?.gapEvidenceStatus !== "PROVEN_UNTAPPED", "absence-only not proven");
check("clustering", plan.actions.some((action) => action.primaryKeyword === "pharmacy seo" && action.supportingKeywords.includes("seo for pharmacies")), "SEO cluster");
const seoAction = plan.actions.find((action) => action.primaryKeyword === "pharmacy seo");
check("volume-not-double-counted", seoAction?.combinedSearchDemand === 80, String(seoAction?.combinedSearchDemand));
check("scores-bounded", plan.actions.every((action) => action.actionScore >= 0 && action.actionScore <= 100), "0-100");
check("priorities-valid", plan.actions.every((action) => ["HIGH", "MEDIUM", "LOW"].includes(action.priority)), "priorities");
check("rationale-exists", plan.actions.every((action) => action.rationale && action.evidenceReasons.length), "rationale");
check("evidence-retained", plan.actions.every((action) => action.competitorCount >= 0), "competitor evidence");
check("winning-url-retained", plan.actions.some((action) => action.bestRankingUrl === "https://example.com/page"), "URL");
check("support-separate", plan.actions.some((action) => action.growthPlanRole === "SUPPORTING_COMMERCIAL"), "support action");
check("market-expansion-separate", plan.actions.some((action) => action.growthPlanRole === "MARKET_EXPANSION_ONLY"), "market expansion");
check("roadmap-valid", Array.isArray(plan.roadmap.immediate) && Array.isArray(plan.roadmap.next) && Array.isArray(plan.roadmap.later), "roadmap");
check("no-external-api", !/fetch\s*\(|GooglePlaces|GSC|googleapis|dataforseo_labs/i.test(fs.readFileSync("src/pharmacy/growthPlanIntelligenceV1Service.ts", "utf8")), "pure service");
check("no-content-generation", !new RegExp('from "\\\\./.*(?:Content|Publish|Deploy)|from "\\\\.\\\\./.*(?:Content|Publish|Deploy)|generate[A-Z].*Content|publish[A-Z]|deploy[A-Z]').test(fs.readFileSync("src/pharmacy/growthPlanIntelligenceV1Service.ts", "utf8")), "strategy only");
check("summary-counts", plan.summary.totalActions === plan.actions.length, String(plan.summary.totalActions));
check("dependencies-exist", plan.actions.every((action) => Array.isArray(action.dependencies)), "dependencies");
check("confidence-valid", plan.actions.every((action) => ["HIGH", "MEDIUM", "LOW"].includes(action.confidence)), "confidence");
check("page-types-valid", plan.actions.every((action) => action.recommendedPageType), "page type");
check("next-step-exists", plan.actions.every((action) => action.recommendedNextStep), "next step");
check("no-no-action", plan.actions.every((action) => action.actionType !== "NO_ACTION"), "no no-action");
check("primary-demand", plan.summary.primaryCommercialDemand >= 80, String(plan.summary.primaryCommercialDemand));
check("support-demand", plan.summary.supportingDemand >= 0, String(plan.summary.supportingDemand));
check("no-review-role-action", plan.actions.every((action) => action.growthPlanRole !== "REVIEW_REQUIRED"), "review excluded");
check("no-excluded-role-action", plan.actions.every((action) => action.growthPlanRole !== "EXCLUDED"), "excluded omitted");
check("fixture-readable", !fs.existsSync("fixtures/national-growth-engine/pharmaconnect-growth-plan-intelligence-v1.json") || fs.readFileSync("fixtures/national-growth-engine/pharmaconnect-growth-plan-intelligence-v1.json", "utf8").includes('"version": 1'), "fixture path");

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
