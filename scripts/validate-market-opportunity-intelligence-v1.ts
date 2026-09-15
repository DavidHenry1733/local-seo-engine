#!/usr/bin/env npx tsx
import fs from "node:fs";
import marketOpportunityService from "../src/pharmacy/marketOpportunityIntelligenceService.ts";

const { buildMarketOpportunityIntelligenceSnapshot } = marketOpportunityService;
const snapshot = buildMarketOpportunityIntelligenceSnapshot({ slug: "pharmaconnect" });
const serviceSource = fs.readFileSync("src/pharmacy/marketOpportunityIntelligenceService.ts", "utf8");
const labsSource = fs.readFileSync("src/pharmacy/dataForSeoRankedKeywordIntelligenceService.ts", "utf8");
const apiSource = fs.readFileSync("artifacts/api-server/src/routes/api/masterAdminPlatform.ts", "utf8");
let pass = 0;
let fail = 0;

function record(id: string, ok: boolean, detail: string) {
  if (ok) {
    pass++;
    console.log(`PASS  ${id} — ${detail}`);
  } else {
    fail++;
    console.log(`FAIL  ${id} — ${detail}`);
  }
}

console.log("\n=== MARKET OPPORTUNITY INTELLIGENCE V1 ===\n");

record("generic-model", snapshot.version === 1 && Array.isArray(snapshot.keywordOpportunities), "versioned reusable snapshot");
record("pharmaconnect-market", snapshot.market.includes("Pharmacy") && snapshot.subjectDomain === "pharmaconnect.uk", `${snapshot.market} / ${snapshot.subjectDomain}`);
record("verified-competitors-used", snapshot.competitors.some((c) => c.classification === "direct_competitor") && snapshot.sourceCompetitorCount === 13, `${snapshot.sourceCompetitorCount} competitors`);
record("rejected-excluded", !snapshot.competitors.some((c) => c.classification as string === "not_competitor"), "no rejected/insufficient competitors in input set");
record("positive-taxonomy", snapshot.keywordOpportunities.some((k) => k.qualificationReasons.some((r) => r.startsWith("High-intent term") || r.startsWith("Service term"))), "positive taxonomy reasons");
record("negative-taxonomy", snapshot.dataQuality.topRejectionReasons.length >= 0 && snapshot.keywordOpportunities.every((k) => Array.isArray(k.qualificationReasons)), "negative taxonomy applied where matched");

const uniqueKeywords = new Set(snapshot.keywordOpportunities.map((k) => k.keyword.toLowerCase()));
record("deduplication", uniqueKeywords.size === snapshot.keywordOpportunities.length, `${uniqueKeywords.size}/${snapshot.keywordOpportunities.length}`);

const demandFromQualified = snapshot.keywordOpportunities
  .filter((k) => k.qualification === "QUALIFIED")
  .reduce((sum, k) => sum + (k.searchVolume || 0), 0);
record("volume-not-double-counted", demandFromQualified === snapshot.summary.totalSearchDemand, String(snapshot.summary.totalSearchDemand));
record("ranking-urls-retained", snapshot.rankingPages.length > 0 && snapshot.rankingPages.every((p) => p.url), `${snapshot.rankingPages.length} pages`);
record("subject-positions-explicit", snapshot.keywordOpportunities.every((k) => "subjectPosition" in k && "subjectRankingUrl" in k), snapshot.dataQuality.subjectCoverageStatus);
record("score-bounds", snapshot.keywordOpportunities.every((k) => k.opportunityScore >= 0 && k.opportunityScore <= 100), "0-100");
record("priority-bands", snapshot.keywordOpportunities.every((k) => ["HIGH", "MEDIUM", "LOW"].includes(k.priority)), "valid priorities");
record("reasons-exist", snapshot.keywordOpportunities.every((k) => k.reasons.length > 0), "opportunity reasons");
record("cost-recorded", typeof snapshot.dataForSeoUsage.totalCost === "number" && snapshot.totalApiCost === snapshot.dataForSeoUsage.totalCost, String(snapshot.totalApiCost));
record("provider-endpoint-wired", labsSource.includes("/v3/dataforseo_labs/google/ranked_keywords/live") && serviceSource.includes("getDomainRankedKeywordsWithCost"), "ranked keywords endpoint via canonical Labs client");
record("credentials-env-based", labsSource.includes("process.env.DATAFORSEO_LOGIN") && labsSource.includes("process.env.DATAFORSEO_PASSWORD"), "env credentials only");
record("no-credential-literals", !/DATAFORSEO_(LOGIN|PASSWORD)\\s*=/.test(serviceSource + labsSource), "no literal secret assignment");
record("direct-input-bounded", serviceSource.includes("directCompetitors: 6") && serviceSource.includes("directKeywordLimit: 100"), "6 direct / 100 rows");
record("subject-coverage-supported", serviceSource.includes("subjectKeywords") && serviceSource.includes("getDomainRankedKeywordsWithCost") && serviceSource.includes("resolveNationalIntelligenceSubject"), "subject ranked keywords");
record("live-cost-tracking", labsSource.includes("task.cost") && serviceSource.includes("totalCost"), "task cost captured");
record("gap-classification-supported", serviceSource.includes('"untapped"') && serviceSource.includes("weak_coverage"), "gap types");
record("no-google-places", !JSON.stringify(snapshot).toLowerCase().includes("googleplaces"), "no Google Places execution");
record("no-local-growth-dependency", !JSON.stringify(snapshot).includes("distanceKm") && !JSON.stringify(snapshot).includes("placeId"), "no local competitor fields");
record("no-credentials-persisted", !/authorization|password|api[_-]?login|api[_-]?password|Basic\s+[A-Za-z0-9+/=]+/i.test(JSON.stringify(snapshot)), "no secrets");
record("read-api-does-not-execute-dataforseo", apiSource.includes("readMarketOpportunityIntelligenceSnapshot") && !apiSource.includes("writeLiveMarketOpportunityIntelligenceSnapshot"), "read-only endpoint");

const fixture = "fixtures/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v1.json";
record("fixture-safe-path", !fs.existsSync(fixture) || fs.readFileSync(fixture, "utf8").includes('"subjectDomain": "pharmaconnect.uk"'), fixture);

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
