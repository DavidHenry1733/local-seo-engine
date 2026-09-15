#!/usr/bin/env npx tsx
import service from "../src/pharmacy/marketUniverseIntelligenceV2Service.ts";

const live = process.argv.includes("--live");
const snapshot = live
  ? await service.writeMarketUniverseV2Live("pharmaconnect")
  : service.writeMarketUniverseV2Fixture("pharmaconnect");

console.log("\n=== MARKET UNIVERSE INTELLIGENCE V2 ===\n");
console.log(`Live execution: ${snapshot.liveExecution}`);
console.log(`Raw: ${snapshot.summary.raw}`);
console.log(`Unique: ${snapshot.summary.unique}`);
console.log(`Money keywords: ${snapshot.summary.moneyKeywords}`);
console.log(`Commercial support: ${snapshot.summary.commercialSupport}`);
console.log(`Authority/support: ${snapshot.summary.authoritySupport}`);
console.log(`Rejected: ${snapshot.summary.rejected}`);
console.log(`Review: ${snapshot.summary.review}`);
console.log(`Untapped: ${snapshot.summary.untapped}`);
console.log(`Weak coverage: ${snapshot.summary.weakCoverage}`);
console.log(`New market: ${snapshot.summary.newMarket}`);
console.log(`Qualified demand: ${snapshot.summary.qualifiedCommercialSearchDemand}`);
console.log(`Supporting demand: ${snapshot.summary.supportingSearchDemand}`);
console.log(`Requests: ${snapshot.costs.requests}`);
console.log(`Tasks: ${snapshot.costs.tasks}`);
console.log(`Cost: ${snapshot.costs.totalCost}`);

console.log("\nEndpoint cost breakdown:");
for (const endpoint of snapshot.endpoints) {
  console.log(`${endpoint.endpoint}`);
  console.log(`  used=${endpoint.used} requests=${endpoint.requests} tasks=${endpoint.tasks} cost=${endpoint.cost}`);
}

console.log("\nTop 20 opportunities:");
for (const [index, item] of snapshot.universe.filter((x) => x.qualification === "QUALIFIED").slice(0, 20).entries()) {
  console.log(`${index + 1}. ${item.keyword}`);
  console.log(`  type=${item.type} volume=${item.searchVolume ?? "n/a"} cpc=${item.cpc ?? "n/a"} paidCompetition=${item.paidCompetition ?? "n/a"} difficulty=${item.keywordDifficulty ?? "n/a"} intent=${item.intent ?? "n/a"}`);
  console.log(`  directCompetitors=${item.directCompetitorsRanking} best=${item.bestCompetitorDomain ?? "n/a"} position=${item.bestCompetitorPosition ?? "n/a"}`);
  console.log(`  subjectPosition=${item.subjectPosition ?? "n/a"} subjectUrl=${item.subjectRankingUrl ?? "n/a"}`);
  console.log(`  gap=${item.gapType} sources=${item.sources.join(",")} score=${item.score} priority=${item.priority}`);
  console.log(`  url=${item.bestRankingUrl ?? "n/a"}`);
  console.log(`  why=${item.reasons.slice(0, 4).join(" | ")}`);
}

console.log("\nTop 30 rejected/review keywords:");
for (const [index, item] of snapshot.universe
  .filter((x) => x.qualification === "REJECTED" || x.qualification === "REVIEW")
  .sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0) || (b.cpc || 0) - (a.cpc || 0))
  .slice(0, 30)
  .entries()) {
  console.log(`${index + 1}. ${item.keyword}`);
  console.log(`  volume=${item.searchVolume ?? "n/a"} cpc=${item.cpc ?? "n/a"} source=${item.sources.join(",")} competitor=${item.bestCompetitorDomain ?? "n/a"} position=${item.bestCompetitorPosition ?? "n/a"}`);
  console.log(`  classification=${item.qualification} reason=${item.reasons.slice(0, 3).join(" | ")}`);
}
