#!/usr/bin/env npx tsx
import service from "../src/pharmacy/growthPlanIntelligenceV1Service.ts";

const snapshot = service.writeGrowthPlanIntelligenceV1("pharmaconnect");

console.log("\n=== GROWTH PLAN INTELLIGENCE V1 ===\n");
console.log(`Total actions: ${snapshot.summary.totalActions}`);
console.log(`High: ${snapshot.summary.highPriorityActions}`);
console.log(`Medium: ${snapshot.summary.mediumPriorityActions}`);
console.log(`Low: ${snapshot.summary.lowPriorityActions}`);
console.log(`Primary demand: ${snapshot.summary.primaryCommercialDemand}`);
console.log(`Supporting demand: ${snapshot.summary.supportingDemand}`);
console.log(`Proven untapped: ${snapshot.summary.provenUntappedCount}`);
console.log(`Insufficient evidence: ${snapshot.summary.insufficientEvidenceCount}`);

console.log("\nRoadmap:");
console.log(`Immediate: ${snapshot.roadmap.immediate.length}`);
console.log(`Next: ${snapshot.roadmap.next.length}`);
console.log(`Later: ${snapshot.roadmap.later.length}`);

console.log("\nTop actions:");
for (const action of snapshot.actions.slice(0, 20)) {
  console.log(`${action.priority} ${action.actionScore} — ${action.actionType} — ${action.primaryKeyword} — demand=${action.combinedSearchDemand} — gap=${action.gapEvidenceStatus}/${action.gapConfidence}`);
}
