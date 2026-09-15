#!/usr/bin/env npx tsx
/**
 * NI-03A — National Intelligence Evidence Layer V1
 * Architectural consolidation checks only. Does not call paid APIs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as subjectResolverMod from "../src/pharmacy/nationalIntelligenceSubjectResolver.ts";
import * as provenanceMod from "../src/pharmacy/nationalIntelligenceEvidenceProvenance.ts";
import * as costLedgerMod from "../src/pharmacy/nationalIntelligenceCostLedger.ts";
import * as storageMod from "../src/pharmacy/nationalIntelligenceStorageService.ts";
import * as universeMod from "../src/pharmacy/marketUniverseIntelligenceV2Service.ts";
import * as opportunityMod from "../src/pharmacy/marketOpportunityIntelligenceService.ts";
import * as contractMod from "../src/pharmacy/growthPlanIntelligenceContract.ts";
import * as gp01Mod from "../src/pharmacy/growthPlanIntelligenceV1Service.ts";
import * as platformMod from "../src/pharmacy/growthPlatformResolverService.ts";
import * as websiteBoundaryMod from "../src/pharmacy/nationalIntelligenceWebsiteBoundary.ts";
import * as routingMod from "../src/pharmacy/growthEngineGrowthPlanResolver.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const subjectResolver = exported(subjectResolverMod);
const provenance = exported(provenanceMod);
const costLedger = exported(costLedgerMod);
const storage = exported(storageMod);
const universe = exported(universeMod);
const opportunity = exported(opportunityMod);
const contract = exported(contractMod);
const gp01 = exported(gp01Mod);
const platform = exported(platformMod);
const websiteBoundary = exported(websiteBoundaryMod);
const routing = exported(routingMod);

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

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
const fetchUrls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  fetchCalls += 1;
  fetchUrls.push(String(input));
  throw new Error(`NI-03A validator blocked fetch: ${String(input)}`);
}) as typeof fetch;

console.log("\n=== NI-03A NATIONAL INTELLIGENCE EVIDENCE LAYER V1 ===\n");

const resolverSource = read("src/pharmacy/nationalIntelligenceSubjectResolver.ts");
const universeSource = read("src/pharmacy/marketUniverseIntelligenceV2Service.ts");
const storageSource = read("src/pharmacy/nationalIntelligenceStorageService.ts");
const labsSource = read("src/pharmacy/dataForSeoRankedKeywordIntelligenceService.ts");
const opportunitySource = read("src/pharmacy/marketOpportunityIntelligenceService.ts");
const gp01Source = read("src/pharmacy/growthPlanIntelligenceV1Service.ts");
const contractSource = read("src/pharmacy/growthPlanIntelligenceContract.ts");
const apiSource = read("artifacts/api-server/src/routes/api/masterAdminPlatform.ts");
const nationalPlanSource = read("src/pharmacy/growthEngineNationalGrowthPlanService.ts");
const resolverRouteSource = read("src/pharmacy/growthEngineGrowthPlanResolver.ts");

check(
  "generic-resolver-no-pharmaconnect-slug",
  !/pharmaconnect/i.test(resolverSource),
  "resolver has no PharmaConnect slug/domain hardcode",
);
check(
  "universe-no-hardcoded-pharmaconnect-domain",
  !/pharmaconnect\.uk/i.test(universeSource),
  "Market Universe V2 has no hardcoded pharmaconnect.uk",
);
check(
  "canonical-storage-no-process-cwd",
  !storageSource.includes("process.cwd()"),
  "canonical national storage uses WORKSPACE_ROOT",
);

const nationalA = subjectResolver.resolveNationalIntelligenceSubject("pharmaconnect");
check(
  "national-a-from-config",
  nationalA.growthPlatform === "national"
    && nationalA.subjectDomain === "pharmaconnect.uk"
    && nationalA.eligibleForNationalIntelligence === true
    && nationalA.identitySource === "PROJECT_CONFIG",
  `${nationalA.subjectDomain} / ${nationalA.growthPlatform}`,
);

const tenantBSlug = "ni03a-national-b";
const tenantBFile = path.join(ROOT, "config/projects", `${tenantBSlug}.json`);
fs.writeFileSync(tenantBFile, JSON.stringify({
  clientSlug: tenantBSlug,
  businessName: "National Tenant B",
  domain: "https://example-national-b.co.uk",
  growthPlatform: "national",
  primaryLocation: "United Kingdom",
  country: "United Kingdom",
  languageCode: "en",
  services: ["National SEO"],
}, null, 2) + "\n");
let nationalB: ReturnType<typeof subjectResolver.resolveNationalIntelligenceSubject>;
try {
  nationalB = subjectResolver.resolveNationalIntelligenceSubject(tenantBSlug);
} finally {
  fs.unlinkSync(tenantBFile);
}
check(
  "national-b-different-domain",
  nationalB.growthPlatform === "national"
    && nationalB.subjectDomain === "example-national-b.co.uk"
    && nationalB.subjectDomain !== nationalA.subjectDomain
    && nationalB.eligibleForNationalIntelligence === true,
  `${nationalB.subjectDomain}`,
);

const localTenant = subjectResolver.resolveNationalIntelligenceSubject("brook-pharmacy");
check(
  "local-tenant-stays-local",
  localTenant.growthPlatform === "local"
    && localTenant.eligibleForNationalIntelligence === false,
  `${localTenant.growthPlatform} eligible=${localTenant.eligibleForNationalIntelligence}`,
);

const unknown = subjectResolver.resolveNationalIntelligenceSubject("ni03a-unknown-missing-tenant");
const unknownPlatform = platform.resolveGrowthPlatform("ni03a-unknown-missing-tenant");
check(
  "unknown-tenant-local-fallback",
  unknown.growthPlatform === "local"
    && unknown.eligibleForNationalIntelligence === false
    && unknown.identitySource === "FALLBACK"
    && unknownPlatform.source === "backwards-compatible-local-default",
  unknownPlatform.source,
);

const dataPath = storage.nationalIntelligenceDataPath("tenant-a", "market-opportunity-intelligence-v2");
const fixturePath = storage.nationalIntelligenceFixturePath("tenant-b", "cost-ledger-v1");
check(
  "tenant-scoped-canonical-paths",
  dataPath.includes("/data/national-growth-engine/tenant-a-market-opportunity-intelligence-v2.json")
    && fixturePath.includes("/fixtures/national-growth-engine/tenant-b-cost-ledger-v1.json")
    && !dataPath.includes("process.cwd"),
  dataPath,
);

check(
  "canonical-labs-ranked-keywords",
  labsSource.includes("ranked_keywords/live")
    && labsSource.includes("keywords_for_site/live")
    && labsSource.includes("domain_intersection/live")
    && labsSource.includes("export async function getDomainRankedKeywordsWithCost")
    && labsSource.includes("export async function getKeywordsForSiteWithCost")
    && labsSource.includes("export async function getDomainIntersectionWithCost"),
  "Labs wrapper covers ranked / site / intersection",
);
check(
  "opportunity-uses-canonical-labs",
  opportunitySource.includes("getDomainRankedKeywordsWithCost")
    && !opportunitySource.includes("fetchRankedKeywordsWithCost"),
  "opportunity service delegates ranked keywords",
);
check(
  "universe-uses-canonical-labs",
  universeSource.includes("getDomainRankedKeywordsWithCost")
    && universeSource.includes("getKeywordsForSiteWithCost")
    && universeSource.includes("getDomainIntersectionWithCost"),
  "universe service delegates Labs calls",
);

const pharmacySrc = path.join(ROOT, "src/pharmacy");
const rankedClientFiles = fs.readdirSync(pharmacySrc)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => ({ name, source: fs.readFileSync(path.join(pharmacySrc, name), "utf8") }))
  .filter((file) => file.source.includes("ranked_keywords/live"));
check(
  "single-labs-ranked-client",
  rankedClientFiles.length === 1 && rankedClientFiles[0].name === "dataForSeoRankedKeywordIntelligenceService.ts",
  rankedClientFiles.map((file) => file.name).join(",") || "none",
);

const liveProven = provenance.authorityFromProvenance({
  liveExecution: true,
  fixture: false,
  recovered: false,
  hasAuthoritativeGapEvidence: true,
});
const fixtureOnly = provenance.authorityFromProvenance({
  liveExecution: false,
  fixture: true,
  recovered: false,
  hasAuthoritativeGapEvidence: true,
});
const recovered = provenance.authorityFromProvenance({
  liveExecution: false,
  fixture: false,
  recovered: true,
  hasAuthoritativeGapEvidence: true,
});
const persisted = provenance.authorityFromProvenance({
  liveExecution: false,
  fixture: false,
  recovered: false,
  hasAuthoritativeGapEvidence: true,
});
check("authority-live-proven", liveProven === "LIVE_PROVEN", liveProven);
check("authority-fixture-only", fixtureOnly === "FIXTURE_ONLY", fixtureOnly);
check("authority-recovered", recovered === "RECOVERED_EVIDENCE", recovered);
check("authority-persisted", persisted === "PERSISTED_PROVEN", persisted);
check(
  "fixture-cannot-become-live-proven",
  fixtureOnly !== "LIVE_PROVEN" && recovered !== "LIVE_PROVEN",
  `${fixtureOnly}/${recovered}`,
);
check(
  "gap-evidence-requires-intersection",
  provenance.hasAuthoritativeGapEvidence(["ranked_keyword"]) === false
    && provenance.hasAuthoritativeGapEvidence(["domain_intersection_gap"]) === true,
  "domain_intersection_gap required",
);

const calculated = provenance.buildProvenance({
  tenantSlug: "tenant-a",
  subjectDomain: "example.co.uk",
  evidenceSource: "CALCULATED",
  liveExecution: false,
  calculated: true,
  calculationMethod: "commercialIntentTaxonomyV2",
  confidenceBasis: "taxonomy",
});
check(
  "calculated-marked-calculated",
  calculated.calculated === true && calculated.evidenceSource === "CALCULATED" && calculated.liveExecution === false,
  calculated.evidenceSource,
);

const snapshot = universe.buildMarketUniverseV2FromFixture("pharmaconnect");
check(
  "universe-generic-subject-domain",
  snapshot.subjectDomain === nationalA.subjectDomain && snapshot.tenantSlug === "pharmaconnect",
  snapshot.subjectDomain,
);
check(
  "universe-classification-taxonomy-v2",
  snapshot.classificationAuthority === "commercialIntentTaxonomyV2"
    && universeSource.includes("scoreCommercialOpportunityV2")
    && universeSource.includes("legacyCommercialScore"),
  snapshot.classificationAuthority,
);
check(
  "universe-customer-ranked-shape",
  Array.isArray(snapshot.customerRankedKeywords)
    && snapshot.customerRankedKeywords.every((row) => "keyword" in row && "position" in row && "rankingUrl" in row && "sources" in row),
  String(snapshot.customerRankedKeywords.length),
);
check(
  "universe-competitor-ranked-shape",
  Array.isArray(snapshot.competitorRankedKeywords)
    && snapshot.competitorRankedKeywords.every((row) => "domain" in row && "keyword" in row && "position" in row && "rankingUrl" in row && "sources" in row)
    && snapshot.competitorRankedKeywords.length > 0,
  String(snapshot.competitorRankedKeywords.length),
);
check(
  "universe-intersection-shape",
  Array.isArray(snapshot.intersection)
    && snapshot.intersection.every((row) =>
      "customerPresent" in row
      && "customerPosition" in row
      && "competitorRankers" in row
      && "bestCompetitorPosition" in row
      && "directCompetitorCount" in row
      && "hasDomainIntersectionEvidence" in row),
  String(snapshot.intersection.length),
);
check(
  "universe-top-competitor-pages",
  Array.isArray(snapshot.topCompetitorPages),
  String(snapshot.topCompetitorPages.length),
);
check(
  "universe-fixture-not-live-proven",
  snapshot.liveExecution === false
    && snapshot.authority !== "LIVE_PROVEN"
    && (snapshot.authority === "FIXTURE_ONLY" || snapshot.authority === "RECOVERED_EVIDENCE"),
  snapshot.authority,
);
check(
  "universe-no-false-untapped-without-gap",
  snapshot.universe.every((row) => row.gapType !== "UNTAPPED" || row.sources.includes("domain_intersection_gap")),
  `untapped=${snapshot.summary.untapped}`,
);

const opportunitySnapshot = opportunity.buildMarketOpportunityIntelligenceSnapshot({ slug: "pharmaconnect" });
check(
  "opportunity-subject-from-config",
  opportunitySnapshot.subjectDomain === "pharmaconnect.uk",
  opportunitySnapshot.subjectDomain,
);

const gpInput = contract.buildGrowthPlanIntelligenceInput({
  generatedAt: "2026-08-16T00:00:00.000Z",
  subjectDomain: snapshot.subjectDomain,
  costs: snapshot.costs,
  costLedger: snapshot.costLedger,
  universe: [
    {
      keyword: "pharmacy seo",
      type: "MONEY_KEYWORD",
      qualification: "QUALIFIED",
      marketScope: "CORE",
      gapType: "UNTAPPED",
      searchVolume: 50,
      cpc: 1,
      paidCompetition: 0.2,
      directCompetitorsRanking: 3,
      bestCompetitorDomain: "example.com",
      bestCompetitorPosition: 3,
      bestRankingUrl: "https://example.com/page",
      subjectPosition: null,
      subjectRankingUrl: null,
      score: 90,
      priority: "HIGH",
      reasons: ["test"],
      sources: ["ranked_keyword"],
    },
    {
      keyword: "pharmacy web design",
      type: "MONEY_KEYWORD",
      qualification: "QUALIFIED",
      marketScope: "CORE",
      gapType: "UNTAPPED",
      searchVolume: 40,
      cpc: 1,
      paidCompetition: 0.2,
      directCompetitorsRanking: 2,
      bestCompetitorDomain: "example.com",
      bestCompetitorPosition: 4,
      bestRankingUrl: "https://example.com/web",
      subjectPosition: null,
      subjectRankingUrl: null,
      score: 88,
      priority: "HIGH",
      reasons: ["test"],
      sources: ["domain_intersection_gap"],
    },
  ],
});
const absenceOnly = gpInput.primaryCommercialOpportunities.find((row) => row.keyword === "pharmacy seo");
const proven = gpInput.primaryCommercialOpportunities.find((row) => row.keyword === "pharmacy web design");
check(
  "proven-untapped-requires-gap-evidence",
  absenceOnly?.gapEvidenceStatus === "INSUFFICIENT_EVIDENCE"
    && proven?.gapEvidenceStatus === "PROVEN_UNTAPPED",
  `${absenceOnly?.gapEvidenceStatus}/${proven?.gapEvidenceStatus}`,
);
check(
  "gp01-subject-domain-not-hardcoded",
  gpInput.metadata.subjectDomain === snapshot.subjectDomain && !contractSource.includes('"pharmaconnect.uk"'),
  gpInput.metadata.subjectDomain,
);

const ledger = costLedger.buildCostLedgerFromEndpoints({
  tenantSlug: "pharmaconnect",
  snapshotId: "test",
  liveExecution: false,
  fixture: false,
  recovered: false,
  endpoints: [{ endpoint: "ranked_keywords", requests: 2, tasks: 2, cost: 0.12 }],
});
const inherited = costLedger.inheritPersistedDataForSeoCost({ ledger });
const gpFromLedger = gp01.buildGrowthPlanIntelligenceV1({
  ...gpInput,
  metadata: { ...gpInput.metadata, inheritedUpstreamCost: inherited.cost },
});
check(
  "cost-ledger-from-persisted-task-cost",
  ledger.totalCost === 0.12 && inherited.derived === true && inherited.evidenceSource === "DATAFORSEO_PERSISTED",
  String(ledger.totalCost),
);
check(
  "gp01-inherits-persisted-cost",
  gpFromLedger.inheritedDataForSeoCost === 0.12 && !gp01Source.includes("0.21792"),
  String(gpFromLedger.inheritedDataForSeoCost),
);
check(
  "no-hardcoded-inherited-cost-path",
  !gp01Source.includes("inheritedDataForSeoCost: 0.21792") && gp01Source.includes("inheritPersistedDataForSeoCost"),
  "GP-01 derives cost from persisted ledger",
);

check(
  "read-api-no-live-write",
  apiSource.includes("readMarketUniverseV2Snapshot")
    && apiSource.includes("readMarketOpportunityIntelligenceSnapshot")
    && apiSource.includes("readGrowthPlanIntelligenceV1")
    && !apiSource.includes("writeMarketUniverseV2Live")
    && !apiSource.includes("writeLiveMarketOpportunityIntelligenceSnapshot")
    && !apiSource.includes("buildMarketUniverseV2Live")
    && apiSource.includes("isNationalGrowthPlatform"),
  "Master Admin intelligence GETs remain read-only and platform-gated",
);
check(
  "national-gp-read-only",
  nationalPlanSource.includes("readGrowthPlanIntelligenceV1")
    && !/fetch\s*\(|dataforseo_labs|GooglePlaces|googleapis/i.test(nationalPlanSource),
  "national Growth Plan consumes persisted GP-01 only",
);

const fetchBeforeReads = fetchCalls;
opportunity.readMarketOpportunityIntelligenceSnapshot("pharmaconnect");
universe.readMarketUniverseV2Snapshot("pharmaconnect");
gp01.readGrowthPlanIntelligenceV1("pharmaconnect");
routing.resolveGrowthPlan("pharmaconnect");
routing.resolveGrowthPlan("brook-pharmacy");
check(
  "reads-do-not-call-fetch",
  fetchCalls === fetchBeforeReads,
  `fetchCalls=${fetchCalls} urls=${fetchUrls.join(",") || "none"}`,
);

const places = /maps\.googleapis|GooglePlaces|places\.googleapis/i.test(
  universeSource + opportunitySource + gp01Source + nationalPlanSource + apiSource,
);
const gsc = /searchconsole|webmasters|googleapis.com\/webmasters/i.test(
  universeSource + opportunitySource + gp01Source + nationalPlanSource,
);
check("no-google-places-in-national-path", !places, "no Places wiring on NI read/build path");
check("no-gsc-in-national-path", !gsc, "no GSC wiring on NI read/build path");

check(
  "website-boundary-contract-only",
  Boolean(websiteBoundary.NATIONAL_WEBSITE_EVIDENCE_BOUNDARY)
    && websiteBoundary.NATIONAL_WEBSITE_EVIDENCE_BOUNDARY.includes("not a GP-01 ranking input"),
  "boundary defined, pipelines not merged",
);

const nationalPlan = routing.resolveGrowthPlan("pharmaconnect");
const localPlan = routing.resolveGrowthPlan("brook-pharmacy");
check("gp01-national-routing", nationalPlan.platform === "national", nationalPlan.platform);
check("gp01-local-routing", localPlan.platform === "local", localPlan.platform);

const localEngineFiles = [
  "src/pharmacy/growthEngineLocalMarketService.ts",
  "src/pharmacy/pharmacyCompetitorDiscovery.ts",
  "src/pharmacy/growthEngineLocalMarketAnalysis.ts",
];
for (const file of localEngineFiles) {
  check(`local-engine-preserved-${path.basename(file)}`, fs.existsSync(path.join(ROOT, file)), file);
}

globalThis.fetch = originalFetch;

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
