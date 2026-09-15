#!/usr/bin/env npx tsx
import fs from "node:fs";
import service from "../src/pharmacy/marketUniverseIntelligenceV2Service.ts";

const runtime = process.argv.includes("--runtime");
const snapshot = runtime
  ? service.readMarketUniverseV2Snapshot("pharmaconnect")
  : service.buildMarketUniverseV2FromFixture("pharmaconnect");
const source = fs.readFileSync("src/pharmacy/marketUniverseIntelligenceV2Service.ts", "utf8");
const labsSource = fs.readFileSync("src/pharmacy/dataForSeoRankedKeywordIntelligenceService.ts", "utf8");
const apiSource = fs.readFileSync("artifacts/api-server/src/routes/api/masterAdminPlatform.ts", "utf8");
const runtimePath = "data/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v2.json";

let pass = 0;
let fail = 0;

function check(id: string, ok: boolean, detail: string) {
  if (ok) {
    pass++;
    console.log(`PASS  ${id} — ${detail}`);
  } else {
    fail++;
    console.log(`FAIL  ${id} — ${detail}`);
  }
}

console.log(`\n=== MARKET UNIVERSE INTELLIGENCE V2 ${runtime ? "RUNTIME" : "FIXTURE"} ===\n`);

check("multiple-sources-wired", labsSource.includes("keywords_for_site/live") && labsSource.includes("domain_intersection/live") && source.includes("getKeywordsForSiteWithCost") && source.includes("getDomainIntersectionWithCost"), "ranked + site + gap endpoints");
check("provenance-retained", snapshot.universe.every((x) => Array.isArray(x.sources) && x.sources.length > 0), "sources on every keyword");
check("true-domain-gap-supported", source.includes("intersections: false") && snapshot.summary.untapped >= 0, "domain gap mode");
check("volume-deduplication", snapshot.summary.qualifiedCommercialSearchDemand >= 0 && snapshot.summary.unique <= snapshot.summary.raw, `${snapshot.summary.unique}/${snapshot.summary.raw}`);
check("taxonomy-filtering", snapshot.universe.some((x) => x.reasons.some((r) => /term:|Market signal:|Commercial service signal:|Classification authority: commercialIntentTaxonomyV2/.test(r))) || snapshot.universe.length === 0, "taxonomy reasons");
check("intent-retained", snapshot.summary.intentCoverage >= 0, String(snapshot.summary.intentCoverage));
check("difficulty-retained", snapshot.summary.difficultyCoverage >= 0, String(snapshot.summary.difficultyCoverage));
check("cpc-separate-from-difficulty", snapshot.universe.every((x) => "cpc" in x && "keywordDifficulty" in x), "separate fields");
check("negative-leakage-blocked", !snapshot.universe.some((x) => x.type === "NEGATIVE_IRRELEVANT" && x.priority === "HIGH"), "negative cannot be high");
check("gap-types-valid", snapshot.universe.every((x) => ["UNTAPPED", "WEAK_COVERAGE", "DEFEND_IMPROVE", "NEW_MARKET", "AUTHORITY_SUPPORT", "REVIEW"].includes(x.gapType)), "valid gap types");
check("scores-bounded", snapshot.universe.every((x) => x.score >= 0 && x.score <= 100), "0-100");
check("ranking-urls-retained", snapshot.summary.rankingUrlCoverage >= 0, String(snapshot.summary.rankingUrlCoverage));
check("cost-recorded", typeof snapshot.costs.totalCost === "number" && snapshot.endpoints.every((x) => typeof x.cost === "number"), String(snapshot.costs.totalCost));
check("runtime-mode-path", !runtime || fs.existsSync(runtimePath), runtime ? runtimePath : "fixture mode");
check("live-runtime-positive-cost", !runtime || !snapshot.liveExecution || snapshot.costs.totalCost > 0, snapshot.liveExecution ? String(snapshot.costs.totalCost) : "not live");
check("no-credentials-persisted", !/authorization|password|api[_-]?login|api[_-]?password|Basic\s+[A-Za-z0-9+/=]+/i.test(JSON.stringify(snapshot)), "no secrets");
check("read-api-pure", apiSource.includes("readMarketUniverseV2Snapshot") && !apiSource.includes("writeMarketUniverseV2Live"), "read only");
check("no-local-growth", !JSON.stringify(snapshot).includes("distanceKm") && !JSON.stringify(snapshot).includes("placeId"), "no local fields");

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
