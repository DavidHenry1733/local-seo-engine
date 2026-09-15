import fs from "node:fs";

const files=[
  "src/pharmacy/commercialKeywordIntelligenceModel.ts",
  "src/pharmacy/pharmaConnectCommercialKeywordTaxonomy.ts",
  "src/pharmacy/dataForSeoRankedKeywordIntelligenceService.ts",
  "src/pharmacy/commercialKeywordScoringService.ts",
  "scripts/run-national-commercial-keyword-qualification-v1.ts",
];

for(const file of files){
  if(!fs.existsSync(file)){
    throw new Error(`Missing ${file}`);
  }
}

const model=fs.readFileSync(files[0],"utf8");
const taxonomy=fs.readFileSync(files[1],"utf8");
const dfs=fs.readFileSync(files[2],"utf8");
const scorer=fs.readFileSync(files[3],"utf8");
const runner=fs.readFileSync(files[4],"utf8");

let pass=0;
let fail=0;

function check(name:string,ok:boolean,evidence:string){
  if(ok){
    pass++;
    console.log(`PASS  ${name} — ${evidence}`);
  }else{
    fail++;
    console.log(`FAIL  ${name} — ${evidence}`);
  }
}

console.log("");
console.log("=== COMMERCIAL KEYWORD INTELLIGENCE V1 ===");
console.log("");

check(
  "generic-taxonomy-model",
  model.includes("CommercialKeywordTaxonomy"),
  "shared taxonomy model"
);

check(
  "positive-market-terms",
  taxonomy.includes("targetMarketTerms"),
  "target-market terms configured"
);

check(
  "service-terms",
  taxonomy.includes("serviceTerms"),
  "commercial services configured"
);

check(
  "high-intent-terms",
  taxonomy.includes("highIntentTerms"),
  "high-intent combinations configured"
);

check(
  "negative-intent-groups",
  taxonomy.includes("negativeIntentGroups"),
  "negative taxonomy configured"
);

check(
  "ranked-keywords-endpoint",
  dfs.includes(
    "/v3/dataforseo_labs/google/ranked_keywords/live"
  ),
  "DataForSEO Labs Ranked Keywords"
);

check(
  "uk-location",
  dfs.includes('"United Kingdom"'),
  "UK keyword database"
);

check(
  "position-evidence",
  model.includes("position"),
  "ranking position retained"
);

check(
  "search-volume-evidence",
  model.includes("searchVolume"),
  "search volume retained"
);

check(
  "negative-scoring",
  scorer.includes("negativeIntentScore"),
  "negative intent affects confidence"
);

check(
  "website-evidence",
  runner.includes("websiteCommercialEvidence"),
  "NC-03E own-site evidence reused"
);

check(
  "only-unresolved-input",
  runner.includes("recovery.unresolvedCandidates"),
  "only NC-03F unresolved candidates analysed"
);

check(
  "no-local-google",
  !/discoverLocalMarketCompetitors|GooglePlaces|googlePlaces/i.test(runner+scorer+dfs),
  "no local competitor discovery"
);

check(
  "no-dashboard",
  !/masterAdminPlatformPage/.test(runner+scorer+dfs),
  "no dashboard promotion"
);

check(
  "no-nc04",
  !/websiteIntelligenceService/.test(runner+scorer+dfs),
  "NC-04 absent"
);

if(fail){
  console.log("");
  console.log(`FAIL — ${pass}/${pass+fail} checks`);
  process.exit(1);
}

console.log("");
console.log(`PASS — ${pass}/${pass+fail} checks`);
