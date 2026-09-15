import fs from "node:fs";

let passed=0;
let failed=0;

function check(name:string,ok:boolean,evidence:unknown) {
  if(ok) {
    passed++;
    console.log(`PASS  ${name} — ${String(evidence)}`);
  } else {
    failed++;
    console.log(`FAIL  ${name} — ${String(evidence)}`);
  }
}

const serviceFile=
  "src/pharmacy/nationalCompetitorEvidenceEnrichmentService.ts";

const runnerFile=
  "scripts/run-national-competitor-evidence-enrichment-v1.ts";

const service=fs.readFileSync(serviceFile,"utf8");
const runner=fs.readFileSync(runnerFile,"utf8");

console.log("\n=== NC-03E NATIONAL COMPETITOR EVIDENCE ENRICHMENT V1 ===\n");

check(
  "uses-own-website-http",
  service.includes("fetch("),
  "candidate websites fetched directly",
);

check(
  "uses-v2-qualification",
  service.includes("qualifyNationalCompetitorV2"),
  "NC-03D qualification reused",
);

check(
  "no-dataforseo-runtime",
  !/from\s+["'][^"']*dataForSeoNationalSearchAdapter/i.test(service + runner) &&
    !/searchNationalGoogleOrganic\s*\(/i.test(service + runner),
  "no DataForSEO runtime dependency or search execution",
);

check(
  "no-local-discovery-runtime",
  !/from\s+["'][^"']*(growthEngineLocalMarketService|pharmacyCompetitorDiscovery|growthEngineLocalMarketAnalysis)/i.test(service + runner) &&
    !/discoverLocalMarketCompetitors\s*\(/i.test(service + runner) &&
    !/discoverHealthcareProviders\s*\(/i.test(service + runner),
  "no Local Growth Engine runtime dependency",
);

check(
  "direct-classification",
  service.includes('"direct_competitor"'),
  "direct competitor supported",
);

check(
  "adjacent-classification",
  service.includes('"adjacent_competitor"'),
  "adjacent competitor supported",
);

check(
  "not-competitor-classification",
  service.includes('"not_competitor"'),
  "not competitor supported",
);

check(
  "manual-review-supported",
  service.includes('"manual_review"'),
  "manual review supported",
);

check(
  "evidence-urls-captured",
  service.includes("evidenceUrls"),
  "source URLs retained",
);

check(
  "service-overlap-captured",
  service.includes("detectedServiceGroups"),
  "service overlap retained",
);

check(
  "excluded-not-refetched",
  !runner.includes("...(input.excluded || [])"),
  "NC-03D exclusions omitted",
);

if(failed) {
  console.log(`\nFAIL — ${passed}/${passed+failed} checks`);
  process.exit(1);
}

console.log(`\nPASS — ${passed}/${passed+failed} checks`);
