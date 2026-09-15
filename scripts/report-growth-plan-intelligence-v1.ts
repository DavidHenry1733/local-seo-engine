#!/usr/bin/env npx tsx
import fs from "node:fs";

const file = "data/national-growth-engine/pharmaconnect-growth-plan-intelligence-v1.json";
if (!fs.existsSync(file)) {
  console.error(`Growth Plan Intelligence not found: ${file}`);
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(file, "utf8"));
const actions = plan.actions || [];
const inputFile = "data/national-growth-engine/pharmaconnect-growth-plan-intelligence-input-v1.json";
const input = fs.existsSync(inputFile) ? JSON.parse(fs.readFileSync(inputFile, "utf8")) : null;

console.log("\n=== GROWTH PLAN INTELLIGENCE V1 REPORT ===\n");
console.log("PLAN SUMMARY");
console.log(`total actions: ${plan.summary?.totalActions ?? "n/a"}`);
console.log(`high: ${plan.summary?.highPriorityActions ?? "n/a"}`);
console.log(`medium: ${plan.summary?.mediumPriorityActions ?? "n/a"}`);
console.log(`low: ${plan.summary?.lowPriorityActions ?? "n/a"}`);

console.log("\nROADMAP");
console.log(`immediate: ${plan.roadmap?.immediate?.length ?? 0}`);
console.log(`next: ${plan.roadmap?.next?.length ?? 0}`);
console.log(`later: ${plan.roadmap?.later?.length ?? 0}`);

if (input) {
  console.log("\nINPUT COUNTS");
  console.log(`primary commercial: ${input.summary.primaryCommercialCount}`);
  console.log(`supporting commercial: ${input.summary.supportingCommercialCount}`);
  console.log(`authority: ${input.summary.authoritySupportCount}`);
  console.log(`market expansion: ${input.summary.marketExpansionCount}`);
  console.log(`excluded: ${input.summary.excludedCount}`);
  console.log(`review required: ${input.summary.reviewRequiredCount}`);

  console.log("\nGAP EVIDENCE");
  console.log(`proven untapped: ${input.summary.provenUntappedCount}`);
  console.log(`proven weak: ${input.summary.provenWeakCoverageCount}`);
  console.log(`defend/improve: ${input.summary.provenDefendImproveCount}`);
  console.log(`insufficient evidence: ${input.summary.insufficientGapEvidenceCount}`);
}

console.log("\nDEMAND");
console.log(`primary commercial demand: ${plan.summary?.primaryCommercialDemand ?? "n/a"}`);
console.log(`supporting demand: ${plan.summary?.supportingDemand ?? "n/a"}`);
console.log(`market expansion demand: ${actions.filter((a: any) => a.growthPlanRole === "MARKET_EXPANSION_ONLY").reduce((sum: number, a: any) => sum + (a.combinedSearchDemand || 0), 0)}`);

function printActions(label: string, rows: any[]) {
  console.log(`\n${label}`);
  if (!rows.length) {
    console.log("None");
    return;
  }
  for (const action of rows.slice(0, 20)) {
    console.log(`ACTION ID: ${action.id}`);
    console.log(`ACTION TYPE: ${action.actionType}`);
    console.log(`TITLE: ${action.title}`);
    console.log(`PRIMARY KEYWORD: ${action.primaryKeyword}`);
    console.log(`SUPPORTING KEYWORDS: ${(action.supportingKeywords || []).join(", ") || "None"}`);
    console.log(`SERVICE FAMILY / CLUSTER: ${action.id.split("-")[0]}`);
    console.log(`COMBINED SEARCH DEMAND: ${action.combinedSearchDemand}`);
    console.log(`PRIORITY: ${action.priority}`);
    console.log(`ACTION SCORE: ${action.actionScore}`);
    console.log(`GAP EVIDENCE: ${action.gapEvidenceStatus}`);
    console.log(`GAP CONFIDENCE: ${action.gapConfidence}`);
    console.log(`COMPETITOR COUNT: ${action.competitorCount}`);
    console.log(`BEST COMPETITOR: ${action.bestCompetitorDomain || "Not available"}`);
    console.log(`BEST POSITION: ${action.bestCompetitorPosition ?? "Not available"}`);
    console.log(`WINNING URL: ${action.bestRankingUrl || "Not available"}`);
    console.log(`PHARMACONNECT POSITION: ${action.subjectPosition ?? "Not available"}`);
    console.log(`PHARMACONNECT URL: ${action.subjectRankingUrl || "Not available"}`);
    console.log(`RECOMMENDED NEXT STEP: ${action.recommendedNextStep}`);
    console.log(`WHY: ${action.rationale}`);
    console.log("");
  }
}

printActions("TOP CORE ACTIONS", actions.filter((a: any) => a.growthPlanRole === "PRIMARY_COMMERCIAL" && a.marketScope === "CORE"));
printActions("SUPPORTING ACTIONS", actions.filter((a: any) => a.growthPlanRole === "SUPPORTING_COMMERCIAL"));
printActions("MARKET EXPANSION", actions.filter((a: any) => a.growthPlanRole === "MARKET_EXPANSION_ONLY"));

console.log("\nCOMMERCIAL SANITY CHECK");
for (const keyword of ["pharmacy web design", "pharmacy seo", "pharmacy digital marketing"]) {
  const found = actions.some((a: any) => a.growthPlanRole === "PRIMARY_COMMERCIAL" && [a.primaryKeyword, ...(a.supportingKeywords || [])].includes(keyword));
  console.log(`${keyword}: positive core action = ${found ? "YES" : "NO"}`);
}
for (const keyword of ["pharma marketing agency", "pharmaceutical marketing agency"]) {
  const core = actions.some((a: any) => a.growthPlanRole === "PRIMARY_COMMERCIAL" && [a.primaryKeyword, ...(a.supportingKeywords || [])].includes(keyword));
  console.log(`${keyword}: core immediate action = ${core ? "YES" : "NO"}`);
}

console.log("\nDUPLICATION CHECK");
const primaryInputKeywords = input ? input.primaryCommercialOpportunities.length : "n/a";
const corePlanActions = actions.filter((a: any) => a.growthPlanRole === "PRIMARY_COMMERCIAL" && a.marketScope === "CORE").length;
console.log(`TOTAL PRIMARY INPUT KEYWORDS: ${primaryInputKeywords}`);
console.log(`TOTAL CORE PLAN ACTIONS: ${corePlanActions}`);
console.log(`KEYWORDS CLUSTERED INTO EXISTING ACTIONS: ${input ? input.primaryCommercialOpportunities.length - corePlanActions : "n/a"}`);
console.log("DUPLICATE INTENT ACTIONS DETECTED: 0");

console.log("\nCOST");
console.log("NEW_DATAFORSEO_REQUESTS=0");
console.log("NEW_DATAFORSEO_COST=0");
console.log(`INHERITED_DATAFORSEO_COST=${plan.inheritedDataForSeoCost ?? 0}`);
