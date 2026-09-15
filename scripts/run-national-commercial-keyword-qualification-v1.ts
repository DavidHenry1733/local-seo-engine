import fs from "node:fs";

import {
  buildPharmaConnectCommercialKeywordTaxonomy,
} from "../src/pharmacy/pharmaConnectCommercialKeywordTaxonomy.ts";

import {
  getDomainRankedKeywords,
} from "../src/pharmacy/dataForSeoRankedKeywordIntelligenceService.ts";

import {
  scoreDomainCommercialKeywords,
} from "../src/pharmacy/commercialKeywordScoringService.ts";

const RECOVERY =
  "data/national-growth-engine/pharmaconnect-competitor-evidence-recovery-v1.json";

const ENRICHMENT =
  "data/national-growth-engine/pharmaconnect-competitor-evidence-enrichment-v1.json";

const OUTPUT =
  "data/national-growth-engine/pharmaconnect-commercial-keyword-qualification-v1.json";

const recovery=JSON.parse(
  fs.readFileSync(RECOVERY,"utf8")
);

const enrichment=JSON.parse(
  fs.readFileSync(ENRICHMENT,"utf8")
);

const unresolved=
  recovery.unresolvedCandidates || [];

if(unresolved.length !== 12){
  throw new Error(
    `Expected 12 unresolved candidates, received ${unresolved.length}`
  );
}

const taxonomy=
  buildPharmaConnectCommercialKeywordTaxonomy();

function ownSiteEvidence(domain:string):boolean {
  const all=[
    ...(enrichment.manualReview || []),
    ...(enrichment.unreachable || []),
    ...(enrichment.directCompetitors || []),
    ...(enrichment.adjacentCompetitors || []),
  ];

  const item=all.find(
    (x:any)=>x.domain===domain
  );

  if(!item) return false;

  return Boolean(
    item.reachable &&
    (
      (item.pharmacyMarketEvidence || []).length ||
      (item.commercialProviderEvidence || []).length ||
      (item.serviceEvidence || []).length
    )
  );
}

console.log("============================================================");
console.log("NC-03F V2 — COMMERCIAL KEYWORD QUALIFICATION");
console.log("============================================================");
console.log("");
console.log("Market:",taxonomy.market);
console.log("Country:",taxonomy.country);
console.log("Candidates:",unresolved.length);
console.log("Positive market terms:",taxonomy.targetMarketTerms.length);
console.log("Service terms:",taxonomy.serviceTerms.length);
console.log("High-intent terms:",taxonomy.highIntentTerms.length);
console.log(
  "Negative terms:",
  Object.values(taxonomy.negativeIntentGroups).flat().length
);
console.log("");

const results:any[]=[];

for(let i=0;i<unresolved.length;i++){

  const candidate=unresolved[i];
  const domain=candidate.domain;

  console.log(
    `[${i+1}/${unresolved.length}] ${domain}`
  );

  try{
    const ranked=
      await getDomainRankedKeywords({
        domain,
        locationName:"United Kingdom",
        languageCode:"en",
        limit:1000,
      });

    const websiteEvidence=
      ownSiteEvidence(domain);

    const score=
      scoreDomainCommercialKeywords(
        domain,
        ranked,
        taxonomy,
        websiteEvidence
      );

    results.push({
      ...score,
      websiteCommercialEvidence:websiteEvidence,
      status:"complete",
    });

    console.log(
      `  ranked=${score.rankedKeywordsAnalysed}` +
      ` relevant=${score.relevantKeywords}` +
      ` high=${score.highCommercialKeywords}` +
      ` negative=${score.negativeIntentKeywords}` +
      ` confidence=${score.confidenceScore}` +
      ` => ${score.classification}`
    );

    if(score.strongestKeywords.length){
      for(const kw of score.strongestKeywords.slice(0,5)){
        console.log(
          `    + ${kw.keyword}` +
          ` | pos=${kw.position ?? "n/a"}` +
          ` | vol=${kw.searchVolume ?? "n/a"}`
        );
      }
    }

  }catch(err){

    const message=
      err instanceof Error ?
      err.message :
      String(err);

    console.log(`  ERROR: ${message}`);

    results.push({
      domain,
      status:"error",
      error:message,
      classification:"insufficient_evidence",
    });
  }
}

const direct=results.filter(
  x=>x.classification==="direct_competitor"
);

const adjacent=results.filter(
  x=>x.classification==="adjacent_competitor"
);

const rejected=results.filter(
  x=>x.classification==="not_competitor"
);

const insufficient=results.filter(
  x=>x.classification==="insufficient_evidence"
);

const output={
  version:1,
  generatedAt:new Date().toISOString(),

  engine:"Commercial Keyword Intelligence",

  platformScope:"national",
  tenant:"pharmaconnect",

  taxonomy,

  dataSource:
    "DataForSEO Labs Google Ranked Keywords — United Kingdom",

  discoveryRun:false,
  localDiscoveryRun:false,

  candidatesAnalysed:results.length,

  directCompetitorCount:direct.length,
  adjacentCompetitorCount:adjacent.length,
  rejectedCount:rejected.length,
  insufficientEvidenceCount:insufficient.length,

  directCompetitors:direct,
  adjacentCompetitors:adjacent,
  rejectedCandidates:rejected,
  insufficientEvidence:insufficient,

  results,
};

fs.writeFileSync(
  OUTPUT,
  JSON.stringify(output,null,2)+"\n"
);

console.log("");
console.log("============================================================");
console.log("NC-03F V2 RESULTS");
console.log("============================================================");
console.log("");

console.log("Candidates analysed:",results.length);
console.log("Direct:",direct.length);
console.log("Adjacent:",adjacent.length);
console.log("Rejected:",rejected.length);
console.log("Insufficient:",insufficient.length);

console.log("");
console.log("--- DIRECT ---");

for(const x of direct){
  console.log("");
  console.log(`${x.domain} | confidence=${x.confidenceScore}`);
  console.log(
    `ranked=${x.rankedKeywordsAnalysed}` +
    ` relevant=${x.relevantKeywords}` +
    ` high=${x.highCommercialKeywords}` +
    ` top10=${x.top10RelevantKeywords}` +
    ` volume=${x.relevantSearchVolume}`
  );

  for(const kw of (x.strongestKeywords || []).slice(0,10)){
    console.log(
      `  + ${kw.keyword}` +
      ` | pos=${kw.position ?? "n/a"}` +
      ` | volume=${kw.searchVolume ?? "n/a"}`
    );
  }
}

console.log("");
console.log("--- ADJACENT ---");

for(const x of adjacent){
  console.log(
    `${x.domain} | confidence=${x.confidenceScore}` +
    ` | relevant=${x.relevantKeywords}`
  );
}

console.log("");
console.log("--- REJECTED ---");

for(const x of rejected){
  console.log(
    `${x.domain} | relevant=${x.relevantKeywords}` +
    ` | negative=${x.negativeIntentKeywords}`
  );
}

console.log("");
console.log("--- INSUFFICIENT ---");

for(const x of insufficient){
  console.log(
    `${x.domain}` +
    `${x.error ? " | "+x.error : ""}`
  );
}

console.log("");
console.log("OUTPUT:",OUTPUT);
console.log("");
console.log("NO DASHBOARD PROMOTION.");
console.log("NO NC-04.");
