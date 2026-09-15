import fs from "node:fs";
import {
  searchNationalGoogleOrganic,
} from "../src/pharmacy/dataForSeoNationalSearchAdapter.ts";

type Candidate = {
  domain:string;
  name?:string;
  score?:number;
  classification?:string;
  rationale?:string;
  detectedServiceGroups?:string[];
  evidenceUrls?:string[];
};

type RecoveredCandidate = {
  domain:string;
  previousClassification:string;
  recoveryQueries:string[];
  evidence:any[];
  pharmacyEvidence:boolean;
  commercialEvidence:boolean;
  serviceEvidence:boolean;
  ukEvidence:boolean;
  directScore:number;
  finalClassification:
    | "direct_competitor"
    | "adjacent_competitor"
    | "not_competitor"
    | "insufficient_evidence";
  reasons:string[];
};

const INPUT =
  "data/national-growth-engine/pharmaconnect-competitor-evidence-enrichment-v1.json";

const OUTPUT =
  "data/national-growth-engine/pharmaconnect-competitor-evidence-recovery-v1.json";

const input=JSON.parse(fs.readFileSync(INPUT,"utf8"));

const unresolved:Candidate[]=[
  ...(input.manualReview || []).map((x:Candidate)=>({
    ...x,
    classification:"manual_review",
  })),
  ...(input.unreachable || []).map((x:Candidate)=>({
    ...x,
    classification:"unreachable",
  })),
];

if(unresolved.length !== 12){
  throw new Error(
    `Expected 12 unresolved candidates; received ${unresolved.length}`
  );
}

const pharmacySignals=[
  "pharmacy",
  "pharmacies",
  "pharmacist",
  "pharmacists",
  "community pharmacy",
  "independent pharmacy",
];

const commercialSignals=[
  "services",
  "agency",
  "we help",
  "we provide",
  "we offer",
  "specialist",
  "marketing",
  "website",
  "seo",
  "digital",
];

const serviceSignals=[
  "website design",
  "web design",
  "website development",
  "seo",
  "local seo",
  "digital marketing",
  "pharmacy marketing",
  "email marketing",
  "website hosting",
  "web hosting",
  "growth strategy",
  "digital strategy",
];

const adjacentSignals=[
  "software",
  "platform",
  "patient app",
  "prescription app",
  "pmr",
  "pharmacy system",
];

function containsAny(text:string,signals:string[]){
  const lower=text.toLowerCase();
  return signals.some(s=>lower.includes(s));
}

function normaliseDomain(value:string){
  return String(value || "")
    .toLowerCase()
    .replace(/^https?:\/\//,"")
    .replace(/^www\./,"")
    .split("/")[0];
}

async function runSearch(query:string){
  const result:any=await searchNationalGoogleOrganic({
    keyword:query,
    locationName:"United Kingdom",
    languageCode:"en",
    depth:20,
  });

  return result;
}

function organicItems(result:any):any[]{
  if(Array.isArray(result?.items)) return result.items;
  if(Array.isArray(result?.organicResults)) return result.organicResults;
  if(Array.isArray(result?.results)) return result.results;
  return [];
}

function evidenceForDomain(result:any,domain:string){
  const target=normaliseDomain(domain);

  return organicItems(result)
    .filter((item:any)=>{
      const d=normaliseDomain(
        item.domain ||
        item.url ||
        item.website ||
        ""
      );

      return d===target || d.endsWith(`.${target}`);
    })
    .map((item:any)=>({
      title:item.title || "",
      description:
        item.description ||
        item.snippet ||
        "",
      url:item.url || "",
      domain:item.domain || target,
      rank:
        item.rankAbsolute ??
        item.rank_absolute ??
        item.position ??
        null,
    }));
}

console.log("============================================================");
console.log("NC-03F — FALLBACK EVIDENCE RECOVERY");
console.log("============================================================");
console.log("");
console.log("Candidates:",unresolved.length);
console.log("This is NOT a new competitor discovery run.");
console.log("");

const recovered:RecoveredCandidate[]=[];

for(let i=0;i<unresolved.length;i++){

  const candidate=unresolved[i];
  const domain=normaliseDomain(candidate.domain);

  console.log(`[${i+1}/${unresolved.length}] ${domain}`);

  const queries=[
    `site:${domain} pharmacy services`,
    `site:${domain} pharmacy website SEO marketing`,
  ];

  const allEvidence:any[]=[];

  for(const query of queries){
    try{
      const result=await runSearch(query);
      const evidence=evidenceForDomain(result,domain);

      for(const item of evidence){
        allEvidence.push({
          query,
          ...item,
        });
      }
    }catch(err){
      console.log(
        `  query warning: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  const evidenceText=allEvidence
    .map(x=>`${x.title} ${x.description}`)
    .join(" ");

  const pharmacyEvidence=
    containsAny(evidenceText,pharmacySignals);

  const commercialEvidence=
    containsAny(evidenceText,commercialSignals);

  const serviceEvidence=
    containsAny(evidenceText,serviceSignals);

  const ukEvidence=
    domain.endsWith(".co.uk") ||
    /\buk\b|united kingdom|england|scotland|wales/i.test(evidenceText);

  const adjacentEvidence=
    containsAny(evidenceText,adjacentSignals);

  let score=0;
  const reasons:string[]=[];

  if(pharmacyEvidence){
    score+=35;
    reasons.push("Search evidence explicitly references the pharmacy market.");
  }

  if(commercialEvidence){
    score+=20;
    reasons.push("Search evidence supports commercial service provision.");
  }

  if(serviceEvidence){
    score+=30;
    reasons.push("Search evidence supports overlapping digital-growth services.");
  }

  if(ukEvidence){
    score+=15;
    reasons.push("UK commercial-market evidence present.");
  }

  let finalClassification:
    RecoveredCandidate["finalClassification"] =
      "insufficient_evidence";

  if(
    pharmacyEvidence &&
    commercialEvidence &&
    serviceEvidence &&
    ukEvidence
  ){
    finalClassification="direct_competitor";
  }
  else if(
    pharmacyEvidence &&
    commercialEvidence &&
    adjacentEvidence
  ){
    finalClassification="adjacent_competitor";
  }
  else if(
    allEvidence.length > 0 &&
    (!pharmacyEvidence || !commercialEvidence)
  ){
    finalClassification="not_competitor";
  }

  console.log(
    `  evidence=${allEvidence.length} score=${score} => ${finalClassification}`
  );

  recovered.push({
    domain,
    previousClassification:
      candidate.classification || "unknown",
    recoveryQueries:queries,
    evidence:allEvidence,
    pharmacyEvidence,
    commercialEvidence,
    serviceEvidence,
    ukEvidence,
    directScore:score,
    finalClassification,
    reasons,
  });
}

const recoveredDirect=
  recovered.filter(x=>x.finalClassification==="direct_competitor");

const recoveredAdjacent=
  recovered.filter(x=>x.finalClassification==="adjacent_competitor");

const recoveredRejected=
  recovered.filter(x=>x.finalClassification==="not_competitor");

const unresolvedStill=
  recovered.filter(x=>x.finalClassification==="insufficient_evidence");

const finalDirect=[
  ...(input.directCompetitors || []),
  ...recoveredDirect,
];

const finalAdjacent=[
  ...(input.adjacentCompetitors || []),
  ...recoveredAdjacent,
];

const output={
  version:1,
  generatedAt:new Date().toISOString(),

  purpose:"NC-03F fallback evidence recovery",

  discoveryRun:false,
  localDiscoveryRun:false,

  originalNc03e:{
    directCompetitorCount:input.directCompetitorCount,
    adjacentCompetitorCount:input.adjacentCompetitorCount,
    manualReviewCount:input.manualReviewCount,
    unreachableCount:input.unreachableCount,
  },

  recovery:{
    candidatesReviewed:recovered.length,
    recoveredDirectCount:recoveredDirect.length,
    recoveredAdjacentCount:recoveredAdjacent.length,
    rejectedCount:recoveredRejected.length,
    unresolvedCount:unresolvedStill.length,
  },

  finalProposedShortlist:{
    directCompetitorCount:finalDirect.length,
    adjacentCompetitorCount:finalAdjacent.length,
    directCompetitors:finalDirect,
    adjacentCompetitors:finalAdjacent,
  },

  recoveredCandidates:recovered,
  unresolvedCandidates:unresolvedStill,
};

fs.writeFileSync(
  OUTPUT,
  JSON.stringify(output,null,2)+"\n"
);

console.log("");
console.log("============================================================");
console.log("NC-03F RESULTS");
console.log("============================================================");

console.log(
  "Recovered direct:",
  recoveredDirect.length
);

console.log(
  "Recovered adjacent:",
  recoveredAdjacent.length
);

console.log(
  "Rejected:",
  recoveredRejected.length
);

console.log(
  "Still unresolved:",
  unresolvedStill.length
);

console.log("");
console.log("FINAL PROPOSED DIRECT COMPETITORS:");
console.log("");

for(const competitor of finalDirect){
  console.log(
    `- ${competitor.domain} | ${
      competitor.directScore ??
      competitor.score ??
      "n/a"
    }`
  );
}

console.log("");
console.log("FINAL PROPOSED ADJACENT COMPETITORS:");
console.log("");

for(const competitor of finalAdjacent){
  console.log(`- ${competitor.domain}`);
}

if(unresolvedStill.length){
  console.log("");
  console.log("STILL UNRESOLVED:");
  console.log("");

  for(const competitor of unresolvedStill){
    console.log(`- ${competitor.domain}`);
  }
}

console.log("");
console.log("OUTPUT:",OUTPUT);
console.log("");
console.log("NO DASHBOARD PROMOTION PERFORMED.");
console.log("NC-04 NOT IMPLEMENTED.");
