import fs from "node:fs";
import {
  enrichNationalCompetitorEvidence,
} from "../src/pharmacy/nationalCompetitorEvidenceEnrichmentService.ts";

const inputFile=
  "data/national-growth-engine/pharmaconnect-competitor-qualification-v2-audit.json";

const outputFile=
  "data/national-growth-engine/pharmaconnect-competitor-evidence-enrichment-v1.json";

const input=JSON.parse(fs.readFileSync(inputFile,"utf8"));

const candidates=[
  ...(input.directCompetitors || []),
  ...(input.adjacentCompetitors || []),
  ...(input.insufficientEvidence || []),
];

console.log("\n============================================================");
console.log("NC-03E — OWN-WEBSITE COMPETITOR EVIDENCE");
console.log("============================================================\n");

console.log("Candidates supplied:",candidates.length);
console.log("Previously excluded and not fetched:",(input.excluded || []).length);
console.log("");

const results=[];

for (let i=0;i<candidates.length;i++) {
  const candidate=candidates[i];

  console.log(
    `[${i+1}/${candidates.length}] ${candidate.domain || candidate.name}`,
  );

  const result=await enrichNationalCompetitorEvidence(candidate);
  results.push(result);

  console.log(
    `  ${result.classification} | score=${result.score} | services=${result.detectedServiceGroups.join(",") || "none"}`,
  );
}

const groups={
  directCompetitors:results.filter(r=>r.classification==="direct_competitor"),
  adjacentCompetitors:results.filter(r=>r.classification==="adjacent_competitor"),
  notCompetitors:results.filter(r=>r.classification==="not_competitor"),
  manualReview:results.filter(r=>r.classification==="manual_review"),
  unreachable:results.filter(r=>r.classification==="unreachable"),
};

const output={
  version:1,
  generatedAt:new Date().toISOString(),
  source:"candidate-own-website-evidence",
  sourceQualificationAudit:inputFile,
  newSearchExecuted:false,
  localDiscoveryExecuted:false,
  candidatesReviewed:results.length,
  directCompetitorCount:groups.directCompetitors.length,
  adjacentCompetitorCount:groups.adjacentCompetitors.length,
  notCompetitorCount:groups.notCompetitors.length,
  manualReviewCount:groups.manualReview.length,
  unreachableCount:groups.unreachable.length,
  ...groups,
};

fs.writeFileSync(
  outputFile,
  JSON.stringify(output,null,2)+"\n",
);

console.log("\n============================================================");
console.log("ENRICHMENT RESULTS");
console.log("============================================================");
console.log("Reviewed:",results.length);
console.log("Direct competitors:",groups.directCompetitors.length);
console.log("Adjacent competitors:",groups.adjacentCompetitors.length);
console.log("Not competitors:",groups.notCompetitors.length);
console.log("Manual review:",groups.manualReview.length);
console.log("Unreachable:",groups.unreachable.length);

console.log("\n--- DIRECT COMPETITORS ---");
for (const r of groups.directCompetitors) {
  console.log(`\n${r.name}`);
  console.log(`domain: ${r.domain}`);
  console.log(`score: ${r.score}`);
  console.log(`services: ${r.detectedServiceGroups.join(", ")}`);
  console.log(`evidence URLs: ${r.evidenceUrls.join(" | ")}`);
  console.log(`rationale: ${r.rationale}`);
}

console.log("\n--- ADJACENT COMPETITORS ---");
for (const r of groups.adjacentCompetitors) {
  console.log(`\n${r.name}`);
  console.log(`domain: ${r.domain}`);
  console.log(`services: ${r.detectedServiceGroups.join(", ")}`);
  console.log(`rationale: ${r.rationale}`);
}

console.log("\n--- MANUAL REVIEW ---");
for (const r of groups.manualReview) {
  console.log(`- ${r.domain} | ${r.rationale}`);
}

console.log("\n--- UNREACHABLE ---");
for (const r of groups.unreachable) {
  console.log(`- ${r.domain}`);
}

console.log("\n--- NOT COMPETITORS ---");
for (const r of groups.notCompetitors) {
  console.log(`- ${r.domain} | ${r.rationale}`);
}

console.log("\nOUTPUT:",outputFile);
console.log("\nNO DASHBOARD PROMOTION PERFORMED.");
