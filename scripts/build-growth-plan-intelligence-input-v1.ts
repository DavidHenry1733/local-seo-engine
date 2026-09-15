#!/usr/bin/env npx tsx
import fs from "node:fs";
import path from "node:path";
import contract from "../src/pharmacy/growthPlanIntelligenceContract.ts";

const { buildGrowthPlanIntelligenceInput } = contract;
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));
const inputPath = inputArg
  ? inputArg.slice("--input=".length)
  : "data/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v2-reclassified-b.json";
const outputPath = "data/national-growth-engine/pharmaconnect-growth-plan-intelligence-input-v1.json";

if (!fs.existsSync(inputPath)) {
  console.error(`Reclassified market universe not found: ${inputPath}`);
  process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const output = buildGrowthPlanIntelligenceInput(snapshot);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");

console.log("\n=== GROWTH PLAN INTELLIGENCE INPUT V1 ===\n");
console.log(`PRIMARY COMMERCIAL COUNT: ${output.summary.primaryCommercialCount}`);
console.log(`SUPPORTING COMMERCIAL COUNT: ${output.summary.supportingCommercialCount}`);
console.log(`AUTHORITY SUPPORT COUNT: ${output.summary.authoritySupportCount}`);
console.log(`MARKET EXPANSION COUNT: ${output.summary.marketExpansionCount}`);
console.log(`EXCLUDED COUNT: ${output.summary.excludedCount}`);
console.log(`REVIEW REQUIRED COUNT: ${output.summary.reviewRequiredCount}`);
console.log(`PROVEN UNTAPPED COUNT: ${output.summary.provenUntappedCount}`);
console.log(`PROVEN WEAK COUNT: ${output.summary.provenWeakCoverageCount}`);
console.log(`DEFEND/IMPROVE COUNT: ${output.summary.provenDefendImproveCount}`);
console.log(`INSUFFICIENT GAP EVIDENCE COUNT: ${output.summary.insufficientGapEvidenceCount}`);
console.log(`TOTAL PRIMARY SEARCH DEMAND: ${output.summary.totalPrimarySearchDemand}`);
console.log(`TOTAL SUPPORTING SEARCH DEMAND: ${output.summary.totalSupportingSearchDemand}`);

console.log("\nTop eligible opportunities:");
for (const item of output.primaryCommercialOpportunities.slice(0, 20)) {
  console.log(`${item.keyword} | ${item.growthPlanRole} | ${item.marketScope} | ${item.gapEvidenceStatus}/${item.gapConfidence} | volume=${item.searchVolume ?? "n/a"} | score=${item.opportunityScore}`);
}
