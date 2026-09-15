#!/usr/bin/env npx tsx
import marketOpportunityService from "../src/pharmacy/marketOpportunityIntelligenceService.ts";

const {
  MARKET_OPPORTUNITY_LIVE_LIMITS,
  writeLiveMarketOpportunityIntelligenceSnapshot,
  writeMarketOpportunityIntelligenceSnapshot,
} = marketOpportunityService;

function argNumber(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;
  const value = Number(raw.slice(prefix.length));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const live = process.argv.includes("--live");

const snapshot = live
  ? await writeLiveMarketOpportunityIntelligenceSnapshot("pharmaconnect", {
      directCompetitors: argNumber("direct-limit", MARKET_OPPORTUNITY_LIVE_LIMITS.directCompetitors),
      directKeywordLimit: argNumber("direct-keyword-limit", MARKET_OPPORTUNITY_LIVE_LIMITS.directKeywordLimit),
      adjacentCompetitors: argNumber("adjacent-limit", MARKET_OPPORTUNITY_LIVE_LIMITS.adjacentCompetitors),
      adjacentKeywordLimit: argNumber("adjacent-keyword-limit", MARKET_OPPORTUNITY_LIVE_LIMITS.adjacentKeywordLimit),
      subjectKeywordLimit: argNumber("subject-keyword-limit", MARKET_OPPORTUNITY_LIVE_LIMITS.subjectKeywordLimit),
    })
  : writeMarketOpportunityIntelligenceSnapshot("pharmaconnect");

console.log("\n=== MARKET OPPORTUNITY INTELLIGENCE V1 ===\n");
console.log(`Generated: ${snapshot.generatedAt}`);
console.log(`Market: ${snapshot.market}`);
console.log(`Subject: ${snapshot.subjectDomain}`);
console.log(`Competitors: ${snapshot.sourceCompetitorCount}`);
console.log(`Keyword universe: ${snapshot.summary.keywordUniverse}`);
console.log(`Qualified commercial keywords: ${snapshot.summary.qualifiedCommercialKeywords}`);
console.log(`High-priority opportunities: ${snapshot.summary.highPriorityOpportunities}`);
console.log(`Total qualified search demand: ${snapshot.summary.totalSearchDemand}`);
console.log(`DataForSEO requests: ${snapshot.dataForSeoUsage.requests}`);
console.log(`DataForSEO tasks: ${snapshot.dataForSeoUsage.tasks}`);
console.log(`DataForSEO cost: ${snapshot.dataForSeoUsage.totalCost}`);
console.log(`Untapped: ${snapshot.summary.untappedKeywords}`);
console.log(`Weak coverage: ${snapshot.summary.weakCoverageKeywords}`);
console.log(`High/medium/low: ${snapshot.summary.highPriorityOpportunities}/${snapshot.summary.mediumPriorityOpportunities}/${snapshot.summary.lowPriorityOpportunities}`);

console.log("\nTop opportunities:");
for (const item of snapshot.keywordOpportunities.filter((x) => x.qualification === "QUALIFIED").slice(0, 10)) {
  console.log(`${item.priority} ${item.opportunityScore} — ${item.keyword} — volume=${item.searchVolume ?? "n/a"} — best=${item.bestCompetitorDomain ?? "n/a"} #${item.bestCompetitorPosition ?? "n/a"} — gap=${item.gapType}`);
}
