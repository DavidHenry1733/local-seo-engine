import fs from "node:fs";

const service=
  fs.readFileSync(
    "src/pharmacy/verifiedNationalCompetitorIntelligenceService.ts",
    "utf8"
  );

const api=
  fs.readFileSync(
    "artifacts/api-server/src/routes/api/masterAdminPlatform.ts",
    "utf8"
  );

const page=
  fs.readFileSync(
    "artifacts/api-server/src/routes/masterAdminPlatformPage.ts",
    "utf8"
  );

const localFiles=[
  "src/pharmacy/growthEngineLocalMarketService.ts",
  "src/pharmacy/pharmacyCompetitorDiscovery.ts",
  "src/pharmacy/growthEngineLocalMarketAnalysis.ts",
];

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
console.log("=== NC-03G VERIFIED COMPETITOR DASHBOARD ===");
console.log("");

check(
  "canonical-snapshot",
  service.includes(
    "verified-national-competitors"
  ),
  "canonical verified snapshot"
);

check(
  "own-site-evidence",
  service.includes(
    "competitor-evidence-enrichment-v1"
  ),
  "NC-03E evidence consumed"
);

check(
  "keyword-evidence",
  service.includes(
    "commercial-keyword-qualification-v1"
  ),
  "DataForSEO keyword evidence consumed"
);

check(
  "read-only-api",
  api.includes(
    "verified-national-competitor-intelligence"
  ),
  "Master Admin read endpoint"
);

check(
  "dashboard-panel",
  page.includes(
    "verifiedNationalCompetitorIntelligence"
  ),
  "visible Master Admin panel"
);

check(
  "keyword-rendering",
  page.includes("strongestKeywords"),
  "ranking keyword evidence rendered"
);

check(
  "position-rendering",
  page.includes("Position"),
  "ranking position rendered"
);

check(
  "volume-rendering",
  page.includes("Search volume"),
  "search volume rendered"
);

check(
  "no-dataforseo-execution",
  !service.includes("dataForSeoRankedKeywordIntelligenceService"),
  "promotion does not execute new DataForSEO work"
);

check(
  "no-local-discovery",
  !/discoverLocalMarketCompetitors|discoverHealthcareProviders/.test(
    service+api+page
  ),
  "no Local Growth Engine discovery"
);

check(
  "no-nc04",
  !/websiteIntelligenceService/.test(service),
  "NC-04 not implemented"
);

for(const file of localFiles){
  check(
    `local-protected-${file.split("/").pop()}`,
    fs.existsSync(file),
    "Local Growth Engine source preserved"
  );
}

if(fail){
  console.log("");
  console.log(`FAIL — ${pass}/${pass+fail} checks`);
  process.exit(1);
}

console.log("");
console.log(`PASS — ${pass}/${pass+fail} checks`);
