import fs from "node:fs";

const file=
  "scripts/run-national-competitor-evidence-recovery-v1.ts";

const s=fs.readFileSync(file,"utf8");

let pass=0;
let fail=0;

function check(name:string,condition:boolean,evidence:string){
  if(condition){
    pass++;
    console.log(`PASS  ${name} — ${evidence}`);
  }else{
    fail++;
    console.log(`FAIL  ${name} — ${evidence}`);
  }
}

console.log("");
console.log("=== NC-03F EVIDENCE RECOVERY VALIDATION ===");
console.log("");

check(
  "uses-dataforseo-adapter",
  s.includes("dataForSeoNationalSearchAdapter"),
  "existing national search adapter reused"
);

check(
  "site-restricted-recovery",
  s.includes("site:${domain}"),
  "queries restricted to known candidate domains"
);

check(
  "no-local-market-service",
  !/growthEngineLocalMarketService/.test(s),
  "Local Market service not imported"
);

check(
  "no-local-competitor-discovery",
  !/discoverLocalMarketCompetitors/.test(s),
  "Google Places competitor discovery absent"
);

check(
  "no-healthcare-discovery",
  !/discoverHealthcareProviders/.test(s),
  "healthcare discovery absent"
);

check(
  "no-dashboard-promotion",
  !/masterAdminPlatformPage/.test(s),
  "dashboard not modified"
);

check(
  "no-nc04",
  !/websiteIntelligenceService/.test(s),
  "NC-04 website analysis absent"
);

check(
  "preserves-nc03e",
  s.includes("pharmaconnect-competitor-evidence-enrichment-v1.json"),
  "NC-03E used as immutable input"
);

if(fail){
  console.log("");
  console.log(`FAIL — ${pass}/${pass+fail} checks`);
  process.exit(1);
}

console.log("");
console.log(`PASS — ${pass}/${pass+fail} checks`);
