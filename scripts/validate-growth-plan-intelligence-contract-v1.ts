#!/usr/bin/env npx tsx
import fs from "node:fs";
import contract from "../src/pharmacy/growthPlanIntelligenceContract.ts";

const { buildGrowthPlanIntelligenceInput } = contract;
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

const snapshot = {
  generatedAt: "2026-08-16T00:00:00.000Z",
  subjectDomain: "pharmaconnect.uk",
  universe: [
    item({ keyword: "pharmacy seo" }),
    item({ keyword: "pharmacy web design", gapType: "UNTAPPED", sources: ["ranked_keyword"] }),
    item({ keyword: "pharmaceutical marketing agency", marketScope: "BROAD" }),
    item({ keyword: "pharmacy leaflet", type: "COMMERCIAL_SUPPORT" }),
    item({ keyword: "pharmacy patient engagement", type: "AUTHORITY_SUPPORT" }),
    item({ keyword: "cost of flu jab", type: "PATIENT_SERVICE", qualification: "REJECTED", marketScope: "NONE" }),
    item({ keyword: "numark login", type: "NAVIGATIONAL", qualification: "REJECTED", marketScope: "NONE" }),
    item({ keyword: "chatham pharmacy", type: "LOCAL_PHARMACY", qualification: "REJECTED", marketScope: "NONE" }),
    item({ keyword: "pharmacy inventory management", type: "INDUSTRY_IRRELEVANT", qualification: "REJECTED", marketScope: "NONE" }),
    item({ keyword: "pharmacists online", type: "AMBIGUOUS_REVIEW", qualification: "REVIEW", marketScope: "CORE" }),
    item({ keyword: "pharmacy ads", gapType: "WEAK_COVERAGE", subjectPosition: 24, bestCompetitorPosition: 4, sources: ["ranked_keyword"] }),
    item({ keyword: "pharmacy branding", gapType: "DEFEND_IMPROVE", subjectPosition: 7, bestCompetitorPosition: 5, sources: ["ranked_keyword"] }),
  ],
};

const output = buildGrowthPlanIntelligenceInput(snapshot);
const all = [
  ...output.primaryCommercialOpportunities,
  ...output.supportingCommercialOpportunities,
  ...output.authoritySupportOpportunities,
  ...output.marketExpansionEvidence,
  ...output.excluded,
  ...output.reviewRequired,
];
const byKeyword = (keyword: string) => all.find((row) => row.keyword === keyword)!;

check("classification-status-explicit", all.every((row) => row.classificationStatus), "classificationStatus");
check("commercial-type-explicit", all.every((row) => row.commercialType), "commercialType");
check("market-scope-explicit", all.every((row) => row.marketScope), "marketScope");
check("gap-status-explicit", all.every((row) => row.gapEvidenceStatus), "gapEvidenceStatus");
check("gap-confidence-explicit", all.every((row) => row.gapConfidence), "gapConfidence");
check("eligibility-explicit", all.every((row) => typeof row.growthPlanEligible === "boolean"), "growthPlanEligible");
check("role-explicit", all.every((row) => row.growthPlanRole), "growthPlanRole");
check("reason-explicit", all.every((row) => row.growthPlanEligibilityReason), "eligibility reason");
check("core-money-eligible", byKeyword("pharmacy seo").growthPlanRole === "PRIMARY_COMMERCIAL" && byKeyword("pharmacy seo").growthPlanEligible, byKeyword("pharmacy seo").growthPlanEligibilityReason);
check("broad-market-expansion", byKeyword("pharmaceutical marketing agency").growthPlanRole === "MARKET_EXPANSION_ONLY" && !byKeyword("pharmaceutical marketing agency").growthPlanEligible, "broad excluded from core");
check("support-role", byKeyword("pharmacy leaflet").growthPlanRole === "SUPPORTING_COMMERCIAL", "supporting");
check("authority-role", byKeyword("pharmacy patient engagement").growthPlanRole === "AUTHORITY_SUPPORT", "authority");
check("patient-excluded", byKeyword("cost of flu jab").growthPlanRole === "EXCLUDED", "patient excluded");
check("navigation-excluded", byKeyword("numark login").growthPlanRole === "EXCLUDED", "nav excluded");
check("local-excluded", byKeyword("chatham pharmacy").growthPlanRole === "EXCLUDED", "local excluded");
check("industry-excluded", byKeyword("pharmacy inventory management").growthPlanRole === "EXCLUDED", "industry excluded");
check("review-required", byKeyword("pharmacists online").growthPlanRole === "REVIEW_REQUIRED", "review required");
check("domain-gap-proven-untapped", byKeyword("pharmacy seo").gapEvidenceStatus === "PROVEN_UNTAPPED" && byKeyword("pharmacy seo").gapConfidence === "HIGH", "domain gap");
check("absence-not-proven", byKeyword("pharmacy web design").gapEvidenceStatus === "INSUFFICIENT_EVIDENCE", "absence-only not proven");
check("weak-coverage", byKeyword("pharmacy ads").gapEvidenceStatus === "PROVEN_WEAK_COVERAGE", "weak");
check("defend-improve", byKeyword("pharmacy branding").gapEvidenceStatus === "PROVEN_DEFEND_IMPROVE", "defend");
check("competitor-evidence-retained", all.filter((row) => row.growthPlanEligible).every((row) => row.competitorCount >= 0 && row.bestCompetitorDomain), "competitor evidence");
check("ranking-url-retained", byKeyword("pharmacy seo").bestRankingUrl === "https://example.com/page", "ranking URL");
check("source-provenance-retained", all.every((row) => Array.isArray(row.sources)), "sources");
check("no-external-api", !/fetch\s*\(|DataForSEO|GooglePlaces|GSC/i.test(fs.readFileSync("src/pharmacy/growthPlanIntelligenceContract.ts", "utf8")), "pure contract");
check("summary-primary", output.summary.primaryCommercialCount === 4, String(output.summary.primaryCommercialCount));
check("summary-support", output.summary.supportingCommercialCount === 1, String(output.summary.supportingCommercialCount));
check("summary-authority", output.summary.authoritySupportCount === 1, String(output.summary.authoritySupportCount));
check("summary-expansion", output.summary.marketExpansionCount === 1, String(output.summary.marketExpansionCount));
check("summary-excluded", output.summary.excludedCount === 4, String(output.summary.excludedCount));
check("summary-review", output.summary.reviewRequiredCount === 1, String(output.summary.reviewRequiredCount));

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
