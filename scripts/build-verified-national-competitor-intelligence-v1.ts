import {
  buildVerifiedNationalCompetitorIntelligence,
} from "../src/pharmacy/verifiedNationalCompetitorIntelligenceService.ts";

const x=
  buildVerifiedNationalCompetitorIntelligence("pharmaconnect");

console.log("");
console.log("=== VERIFIED NATIONAL COMPETITOR INTELLIGENCE ===");
console.log("");

console.log("Status:",x.status);
console.log("Direct:",x.directCompetitorCount);
console.log("Adjacent:",x.adjacentCompetitorCount);
console.log("Rejected:",x.rejectedCount);
console.log("Insufficient:",x.insufficientEvidenceCount);
console.log("Relevant keywords:",x.totalRelevantKeywords);
console.log("High-commercial keywords:",x.totalHighCommercialKeywords);
console.log("Relevant search volume:",x.totalRelevantSearchVolume);

console.log("");
console.log("--- VERIFIED DIRECT COMPETITORS ---");

for(const c of x.directCompetitors){
  console.log("");
  console.log(
    `${c.domain} | confidence=${c.confidenceScore ?? "n/a"}`
  );

  console.log(
    `evidence=${c.evidenceBasis || "own_site"}`
  );

  if(c.relevantKeywords != null){
    console.log(
      `ranked=${c.rankedKeywordsAnalysed || 0}` +
      ` relevant=${c.relevantKeywords || 0}` +
      ` high=${c.highCommercialKeywords || 0}` +
      ` top10=${c.top10RelevantKeywords || 0}` +
      ` volume=${c.relevantSearchVolume || 0}`
    );
  }

  for(const kw of (c.strongestKeywords || []).slice(0,10)){
    console.log(
      `  + ${kw.keyword}` +
      ` | pos=${kw.position ?? "n/a"}` +
      ` | volume=${kw.searchVolume ?? "n/a"}`
    );
  }
}

console.log("");
console.log("OUTPUT:");
console.log(
  "data/national-growth-engine/pharmaconnect-verified-national-competitors.json"
);
