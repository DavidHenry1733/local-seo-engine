#!/usr/bin/env npx tsx
/**
 * NI-03B — National Search Intelligence V1
 * Customer ranking keywords + organic competitor discovery + dashboard contract.
 * Does not build keyword intersection/gap intelligence.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as subjectResolverMod from "../src/pharmacy/nationalIntelligenceSubjectResolver.ts";
import * as platformMod from "../src/pharmacy/growthPlatformResolverService.ts";
import * as storageMod from "../src/pharmacy/nationalIntelligenceStorageService.ts";
import * as provenanceMod from "../src/pharmacy/nationalIntelligenceEvidenceProvenance.ts";
import * as searchServiceMod from "../src/pharmacy/nationalSearchIntelligenceV1Service.ts";
import * as searchModelMod from "../src/pharmacy/nationalSearchIntelligenceV1Model.ts";
import * as searchPageMod from "../src/pharmacy/nationalSearchIntelligencePage.ts";
import * as pageRenderersMod from "../src/pharmacy/growthEnginePageRenderers.ts";
import * as frameworkMod from "../src/pharmacy/growthEngineFrameworkService.ts";
import * as localMarketPageMod from "../src/pharmacy/growthEngineLocalMarketPage.ts";
import * as locationResolverMod from "../src/pharmacy/dataForSeoSearchLocationResolver.ts";
import * as searchProviderMod from "../src/pharmacy/nationalSearchProviderModel.ts";
import * as dataForSeoHttpMod from "../src/pharmacy/dataForSeoHttp.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const subjectResolver = exported(subjectResolverMod);
const platform = exported(platformMod);
const storage = exported(storageMod);
const provenance = exported(provenanceMod);
const searchService = exported(searchServiceMod);
const searchModel = exported(searchModelMod);
const searchPage = exported(searchPageMod);
const pageRenderers = exported(pageRenderersMod);
const framework = exported(frameworkMod);
const localMarketPage = exported(localMarketPageMod);
const locationResolver = exported(locationResolverMod);
const searchProvider = exported(searchProviderMod);
const dataForSeoHttp = exported(dataForSeoHttpMod);

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
globalThis.fetch = (async (input: RequestInfo | URL) => {
  fetchCalls += 1;
  fetchUrls.push(String(input));
  throw new Error(`NI-03B validator blocked fetch: ${String(input)}`);
}) as typeof fetch;

console.log("\n=== NI-03B NATIONAL SEARCH INTELLIGENCE V1 ===\n");

const serviceSource = read("src/pharmacy/nationalSearchIntelligenceV1Service.ts");
const modelSource = read("src/pharmacy/nationalSearchIntelligenceV1Model.ts");
const pageSource = read("src/pharmacy/nationalSearchIntelligencePage.ts");
const resolverSource = read("src/pharmacy/nationalIntelligenceSubjectResolver.ts");
const storageSource = read("src/pharmacy/nationalIntelligenceStorageService.ts");
const apiSource = read("artifacts/api-server/src/routes/api/growthEngine.ts");
const htmlRouteSource = read("artifacts/api-server/src/routes/growthEnginePageRouter.ts");
const frameworkSource = read("src/pharmacy/growthEngineFrameworkService.ts");
const localMarketSource = read("src/pharmacy/growthEngineLocalMarketPage.ts");
const localMarketServiceSource = read("src/pharmacy/growthEngineLocalMarketService.ts");
const placesSource = read("src/pharmacy/pharmacyCompetitorDiscovery.ts");
const healthcareSource = read("src/pharmacy/growthEngineHealthcareDiscovery.ts");
const campaignEngineSource = read("src/pharmacy/growthEngineCampaignRecommendationEngine.ts");
const contentPackageSource = read("src/pharmacy/pharmacyContentPackageService.ts");
const labsSource = read("src/pharmacy/dataForSeoRankedKeywordIntelligenceService.ts");
const adapterSource = read("src/pharmacy/dataForSeoNationalSearchAdapter.ts");
const locationResolverSource = read("src/pharmacy/dataForSeoSearchLocationResolver.ts");
const httpSource = read("src/pharmacy/dataForSeoHttp.ts");
const collectScriptSource = read("scripts/collect-national-search-intelligence-v1.ts");

check(
  "platform-national-eligible",
  platform.isNationalGrowthPlatform("pharmaconnect") === true
    && subjectResolver.resolveNationalIntelligenceSubject("pharmaconnect").eligibleForNationalIntelligence === true,
  "pharmaconnect eligible for National Search Intelligence",
);
check(
  "platform-local-excluded",
  platform.isNationalGrowthPlatform("brook-pharmacy") === false
    && subjectResolver.resolveNationalIntelligenceSubject("brook-pharmacy").eligibleForNationalIntelligence === false,
  "brook-pharmacy remains LOCAL and ineligible",
);
check(
  "platform-unknown-local-fallback",
  platform.resolveGrowthPlatform("__ni03b_unknown_tenant__").platform === "local"
    && subjectResolver.resolveNationalIntelligenceSubject("__ni03b_unknown_tenant__").eligibleForNationalIntelligence === false,
  "unknown tenant LOCAL fallback",
);

const subject = subjectResolver.resolveNationalIntelligenceSubject("pharmaconnect");
check(
  "subject-domain-from-config",
  subject.subjectDomain === "pharmaconnect.uk" && subject.identitySource === "PROJECT_CONFIG",
  `${subject.subjectDomain} via ${subject.identitySource}`,
);
check(
  "reusable-logic-no-pharmaconnect-slug",
  !/["']pharmaconnect["']|slug\s*===\s*["']pharmaconnect["']/i.test(resolverSource + serviceSource + modelSource + pageSource),
  "resolver/service/model/page have no PharmaConnect slug hardcode",
);
check(
  "reusable-logic-no-pharmaconnect-domain",
  !/pharmaconnect\.uk/i.test(resolverSource + serviceSource + modelSource + pageSource),
  "resolver/service/model/page have no pharmaconnect.uk hardcode",
);

const tenantBSlug = "ni03b-national-b";
const tenantBFile = path.join(ROOT, "config/projects", `${tenantBSlug}.json`);
fs.writeFileSync(tenantBFile, JSON.stringify({
  clientSlug: tenantBSlug,
  businessName: "National Search Tenant B",
  domain: "https://example-national-search-b.co.uk",
  growthPlatform: "national",
  primaryLocation: "United Kingdom",
  country: "United Kingdom",
  languageCode: "en",
  services: ["National SEO"],
}, null, 2) + "\n");
const tenantB = subjectResolver.resolveNationalIntelligenceSubject(tenantBSlug);
check(
  "subject-generic-second-national-tenant",
  tenantB.subjectDomain === "example-national-search-b.co.uk" && tenantB.eligibleForNationalIntelligence === true,
  tenantB.subjectDomain,
);

const ukLocation = locationResolver.resolveDataForSeoSearchLocation("United Kingdom");
const ieLocation = locationResolver.resolveDataForSeoSearchLocation("Ireland");
const usLocation = locationResolver.resolveDataForSeoSearchLocation("United States");
const subjectLocation = locationResolver.resolveDataForSeoSearchLocationFromSubject(subject);
check(
  "uk-location-code-2826",
  ukLocation.locationCode === 2826 && subjectLocation.locationCode === 2826,
  `UK=${ukLocation.locationCode} subjectCountry=${subject.country} subjectCode=${subjectLocation.locationCode}`,
);
check(
  "subject-country-feeds-location-resolver",
  subject.country === "United Kingdom" && subjectLocation.country === "United Kingdom",
  subject.country,
);
check(
  "other-national-country-does-not-inherit-uk",
  ieLocation.locationCode === 2372 && usLocation.locationCode === 2840 && ieLocation.locationCode !== ukLocation.locationCode,
  `IE=${ieLocation.locationCode} US=${usLocation.locationCode}`,
);
check(
  "serp-adapter-uses-location-code",
  adapterSource.includes("location_code: location.locationCode")
    && !adapterSource.includes("location_name"),
  "SERP adapter submits location_code only",
);
check(
  "serp-adapter-not-primary-market-location-name",
  !adapterSource.includes("primaryMarket")
    && !serviceSource.includes("marketCountry: query.marketCountry")
    && serviceSource.includes("locationCode: serpLocation.locationCode")
    && serviceSource.includes("resolveDataForSeoSearchLocationFromSubject(subject)"),
  "SERP uses subject country location_code, not primaryMarket as location_name",
);
check(
  "location-resolver-no-pharmaconnect",
  !/["']pharmaconnect["']|pharmaconnect\.uk/i.test(locationResolverSource + adapterSource),
  "location resolver/adapter have no PharmaConnect hardcode",
);
check(
  "shared-dataforseo-http-timeout-60s",
  dataForSeoHttp.DATAFORSEO_HTTP_TIMEOUT_MS === 60000
    && httpSource.includes("export const DATAFORSEO_HTTP_TIMEOUT_MS = 60_000")
    && labsSource.includes("fetchDataForSeo")
    && adapterSource.includes("fetchDataForSeo"),
  `timeoutMs=${dataForSeoHttp.DATAFORSEO_HTTP_TIMEOUT_MS}`,
);
check(
  "transport-timeout-is-not-retryable",
  httpSource.includes("retryable = false")
    && adapterSource.includes("!first.attempt.timedOut")
    && serviceSource.includes("isDataForSeoTransportTimeout"),
  "timeout failures are typed and not retried",
);
check(
  "cli-progress-is-concise",
  collectScriptSource.includes("COLLECTING ranked_keywords...")
    && collectScriptSource.includes("COLLECTING SERP")
    && collectScriptSource.includes("retrying once")
    && collectScriptSource.includes("PERSISTED snapshot=")
    && collectScriptSource.includes("STATUS=")
    && collectScriptSource.includes("TOTAL_COST=")
    && !/DATAFORSEO_(LOGIN|PASSWORD)/.test(collectScriptSource),
  "collector CLI prints bounded progress without credentials",
);

check(
  "collection-explicit-function",
  typeof searchService.collectNationalSearchIntelligence === "function"
    && typeof searchService.readNationalSearchIntelligence === "function",
  "collect vs read are separate functions",
);
check(
  "page-render-reads-only",
  pageSource.includes("readNationalSearchIntelligence")
    && !pageSource.includes("collectNationalSearchIntelligence")
    && !pageSource.includes("getDomainRankedKeywords")
    && !pageSource.includes("searchNationalGoogleOrganic"),
  "page render calls read, not DataForSEO",
);
check(
  "html-get-does-not-collect",
  htmlRouteSource.includes("renderSearchIntelligencePage")
    && !htmlRouteSource.includes("collectNationalSearchIntelligence"),
  "HTML GET does not execute collection",
);
check(
  "json-get-does-not-collect",
  /router\.get\("\/growth-engine\/:slug\/search-intelligence"[\s\S]*?readNationalSearchIntelligence\(slug\)/.test(apiSource)
    && /router\.post\("\/growth-engine\/:slug\/search-intelligence\/collect"[\s\S]*?collectNationalSearchIntelligence/.test(apiSource),
  "JSON GET reads persisted snapshot; POST collect is explicit",
);
check(
  "bounded-limits",
  searchModel.NI03B_LIMITS.customerRankedKeywords === 40
    && searchModel.NI03B_LIMITS.serpQueries === 3
    && searchModel.NI03B_LIMITS.serpDepth === 10
    && searchModel.NI03B_LIMITS.competitorCandidates === 15,
  JSON.stringify(searchModel.NI03B_LIMITS),
);
check(
  "service-uses-bounded-limits",
  serviceSource.includes("NI03B_LIMITS.customerRankedKeywords")
    && serviceSource.includes("NI03B_LIMITS.serpQueries")
    && serviceSource.includes("NI03B_LIMITS.serpDepth"),
  "collection uses NI-03B limits",
);
check(
  "in-flight-dedupe",
  serviceSource.includes("inFlight") && serviceSource.includes("reusedExistingSnapshot"),
  "duplicate in-flight collection is coalesced",
);

const fetchBeforeRead = fetchCalls;
const unread = searchService.readNationalSearchIntelligence("pharmaconnect");
searchService.readNationalSearchIntelligence("pharmaconnect");
pageRenderers.renderSearchIntelligencePage("pharmaconnect");
pageRenderers.renderLocalMarketPage("pharmaconnect", null);
check(
  "duplicate-render-no-paid-call",
  fetchCalls === fetchBeforeRead && unread.status === "not_collected",
  `fetchCalls=${fetchCalls - fetchBeforeRead} status=${unread.status}`,
);
check(
  "uncollected-not-labelled-persisted-or-live",
  unread.liveExecution === false
    && unread.provenance.evidenceSource === "FALLBACK"
    && unread.authority === "INSUFFICIENT_EVIDENCE",
  `${unread.authority}/${unread.provenance.evidenceSource}`,
);

check(
  "keyword-model-fields",
  modelSource.includes("position")
    && modelSource.includes("rankingUrl")
    && modelSource.includes("searchVolume")
    && modelSource.includes("cpc")
    && modelSource.includes("competition")
    && modelSource.includes("evidenceSource")
    && modelSource.includes("calculated: false"),
  "ranked keyword model retains evidence fields",
);
check(
  "null-not-fabricated-in-service",
  !serviceSource.includes("|| 0") || serviceSource.includes("filter((value): value is number"),
  "service does not coerce missing metrics with a blanket || 0",
);
check(
  "labs-canonical-client",
  serviceSource.includes("getDomainRankedKeywordsWithCost")
    && labsSource.includes("DATAFORSEO_LABS_ENDPOINTS")
    && labsSource.includes("ranked_keywords"),
  "uses NI-03A canonical ranked_keywords client",
);

check(
  "competitors-organic-evidence",
  modelSource.includes("whyIdentified")
    && modelSource.includes("sourceQueries")
    && modelSource.includes("qualification")
    && serviceSource.includes("qualifyNationalCompetitorV2")
    && serviceSource.includes("executeNationalGoogleOrganic")
    && !serviceSource.includes("searchNationalGoogleOrganic"),
  "organic competitor evidence + qualification retained",
);
check(
  "competitors-no-google-places",
  !/maps\.googleapis|GooglePlaces|places\.googleapis|nearbysearch/i.test(serviceSource + modelSource + pageSource)
    && serviceSource.includes("They are not") === false,
  "no Google Places dependency on NI-03B path",
);
check(
  "competitors-no-proximity-authority",
  !/distanceMeters|place_id|nearby pharmacies/i.test(serviceSource + modelSource)
    && pageSource.includes("not selected based on physical proximity"),
  "physical proximity is not national competitor authority",
);

check(
  "storage-canonical-workspace",
  !storageSource.includes("process.cwd()")
    && storageSource.includes("search-intelligence-v1")
    && serviceSource.includes("nationalIntelligenceDataPath")
    && serviceSource.includes("ranked-keywords-customer")
    && serviceSource.includes("cost-ledger-v1")
    && serviceSource.includes("refresh-metadata-v1"),
  "canonical tenant-scoped WORKSPACE_ROOT storage",
);
check(
  "storage-tenant-scoped-path",
  storage.nationalIntelligenceDataPath("pharmaconnect", "search-intelligence-v1").includes(`${path.sep}data${path.sep}national-growth-engine${path.sep}pharmaconnect-search-intelligence-v1.json`)
    && !storage.nationalIntelligenceDataPath("pharmaconnect", "search-intelligence-v1").includes(process.cwd() === ROOT ? "FORCE_FAIL" : process.cwd()),
  storage.nationalIntelligenceDataPath("pharmaconnect", "search-intelligence-v1"),
);

check(
  "cost-ledger-used",
  serviceSource.includes("buildCostLedgerFromEndpoints")
    && pageSource.includes("collection cost") === false
    && pageSource.includes("Collection cost"),
  "actual cost ledger is persisted and shown",
);
check(
  "no-hardcoded-inherited-cost",
  !serviceSource.includes("0.21792") && !pageSource.includes("0.21792") && !modelSource.includes("0.21792"),
  "no hard-coded inherited DataForSEO cost",
);

const fixtureDir = storage.ensureNationalIntelligenceFixtureDir();
const fixtureFile = path.join(fixtureDir, storage.nationalIntelligenceArtifactFileName(tenantBSlug, "search-intelligence-v1"));
const fixtureSnapshot = {
  version: 1,
  tenantSlug: tenantBSlug,
  businessName: "National Search Tenant B",
  subjectDomain: "example-national-search-b.co.uk",
  primaryMarket: "United Kingdom",
  country: "United Kingdom",
  growthPlatform: "national",
  capturedAt: "2026-01-01T00:00:00.000Z",
  liveExecution: true,
  status: "collected",
  lastError: null,
  reusedExistingSnapshot: false,
  limits: searchModel.NI03B_LIMITS,
  endpoints: [],
  costs: { requests: 1, tasks: 1, totalCost: 0.01 },
  costLedger: { totalCost: 0.01 },
  provenance: {
    tenantSlug: tenantBSlug,
    subjectDomain: "example-national-search-b.co.uk",
    capturedAt: "2026-01-01T00:00:00.000Z",
    evidenceSource: "DATAFORSEO_LIVE",
    sourceSystem: "fixture",
    sourceEndpoint: null,
    sourceSnapshot: fixtureFile,
    liveExecution: true,
    calculated: false,
    calculationMethod: null,
    confidenceBasis: "fixture",
    costContribution: 0.01,
  },
  authority: "LIVE_PROVEN",
  customerKeywords: [{
    keyword: "pharmacy website design",
    position: 4,
    rankingUrl: "https://example-national-search-b.co.uk/websites",
    searchVolume: 320,
    cpc: 3.1,
    competition: 0.44,
    capturedAt: "2026-01-01T00:00:00.000Z",
    sourceEndpoint: "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
    evidenceSource: "DATAFORSEO_LIVE",
    calculated: false,
  }],
  organicCompetitors: [{
    domain: "example-search-competitor.co.uk",
    name: "Example Search Competitor",
    websiteUrl: "https://example-search-competitor.co.uk",
    whyIdentified: ["Appeared in organic Google results for pharmacy website design United Kingdom."],
    sourceQueries: ["pharmacy website design United Kingdom"],
    bestSerpPosition: 3,
    classification: "direct_competitor",
    qualification: "qualified",
    evidenceStatus: "direct_competitor",
    evidenceUrls: ["https://example-search-competitor.co.uk"],
    capturedAt: "2026-01-01T00:00:00.000Z",
    evidenceSource: "DATAFORSEO_LIVE",
    verified: false,
  }],
  summary: {
    rankingKeywordCount: 1,
    top10Count: 1,
    top20Count: 1,
    rankingPageCount: 1,
    availableSearchDemand: 320,
    organicCompetitorCount: 1,
    directCompetitorCount: 1,
    adjacentCompetitorCount: 0,
    top10CountCalculated: true,
    top20CountCalculated: true,
    rankingPageCountCalculated: true,
    availableSearchDemandCalculated: true,
  },
  nextStage: {
    title: "Compare competitor keyword universes",
    detail: "Next: compare competitor keyword universes and identify commercial search gaps. That work is not part of this screen.",
    implemented: false,
  },
};
fs.writeFileSync(fixtureFile, JSON.stringify(fixtureSnapshot, null, 2) + "\n");
const fixtureRead = searchService.readNationalSearchIntelligence(tenantBSlug);
check(
  "fixture-cannot-become-live",
  fixtureRead.liveExecution === false
    && fixtureRead.authority === "FIXTURE_ONLY"
    && fixtureRead.provenance.evidenceSource === "FIXTURE",
  `${fixtureRead.authority}/${fixtureRead.provenance.evidenceSource}`,
);

const recoveredFile = storage.nationalIntelligenceDataPath(tenantBSlug, "search-intelligence-v1");
storage.ensureNationalIntelligenceDataDir();
const recoveredSnapshot = {
  ...fixtureSnapshot,
  liveExecution: false,
  authority: "RECOVERED_EVIDENCE",
  provenance: {
    ...fixtureSnapshot.provenance,
    evidenceSource: "RECOVERED",
    liveExecution: false,
  },
};
fs.writeFileSync(recoveredFile, JSON.stringify(recoveredSnapshot, null, 2) + "\n");
const recoveredRead = searchService.readNationalSearchIntelligence(tenantBSlug);
check(
  "recovered-cannot-become-live",
  recoveredRead.liveExecution === false
    && recoveredRead.authority === "RECOVERED_EVIDENCE"
    && recoveredRead.provenance.evidenceSource === "RECOVERED",
  `${recoveredRead.authority}/${recoveredRead.provenance.evidenceSource}`,
);
fs.unlinkSync(recoveredFile);
check(
  "null-data-not-zeroed",
  fixtureRead.customerKeywords[0]?.cpc === 3.1
    && provenance.evidenceSourceFromSnapshot({ liveExecution: false, fixture: true }) === "FIXTURE",
  "fixture metrics retained without conversion to live zeroes",
);
check(
  "calculated-fields-identified",
  fixtureRead.summary.top10CountCalculated === true
    && fixtureRead.summary.availableSearchDemandCalculated === true
    && fixtureRead.nextStage.implemented === false,
  "summary metrics marked calculated; next stage not implemented",
);

const nationalHtml = pageRenderers.renderSearchIntelligencePage("pharmaconnect");
const nationalMarketHtml = pageRenderers.renderLocalMarketPage("pharmaconnect", null);
const localHtml = pageRenderers.renderSearchIntelligencePage("brook-pharmacy");
const localMarketHtml = pageRenderers.renderLocalMarketPage("brook-pharmacy", null);
check(
  "ui-national-search-page",
  nationalHtml.includes('data-ni03b-page="search-intelligence"')
    && nationalHtml.includes('data-ni03b-section="search-intelligence"')
    && nationalHtml.includes("Search Intelligence")
    && nationalHtml.includes('data-growth-platform="national"'),
  "National Search Intelligence page renders",
);
check(
  "ui-keyword-table",
  nationalHtml.includes('data-ni03b-section="keywords"')
    && nationalHtml.includes("<th>Keyword</th>")
    && nationalHtml.includes("<th>Position</th>")
    && nationalHtml.includes("<th>Ranking page</th>"),
  "customer keyword table renders",
);
check(
  "ui-organic-competitor-section",
  nationalHtml.includes('data-ni03b-section="competitors"')
    && nationalHtml.includes("not selected based on physical proximity"),
  "organic competitor section renders",
);
check(
  "ui-collection-metadata",
  nationalHtml.includes('data-ni03b-section="collection-meta"')
    && nationalHtml.includes('data-ni03b-domain="pharmaconnect.uk"')
    && nationalHtml.includes("Last collected"),
  "collection metadata renders domain from tenant config",
);
check(
  "ui-provenance",
  nationalHtml.includes('data-ni03b-section="provenance"')
    && /DATAFORSEO|Not collected|FIXTURE|PERSISTED|FALLBACK/i.test(nationalHtml),
  "provenance renders",
);
check(
  "ui-cost",
  nationalHtml.includes('data-ni03b-section="cost"') && nationalHtml.includes("Collection cost"),
  "cost metadata renders",
);
check(
  "ui-explicit-refresh",
  nationalHtml.includes('data-ni03b-section="explicit-refresh"')
    && nationalHtml.includes("Collect Search Intelligence")
    && nationalHtml.includes("Opening this page does not call DataForSEO"),
  "explicit collect control renders",
);
check(
  "ui-next-stage-not-implemented",
  nationalHtml.includes('data-ni03b-section="next-stage"')
    && /compare competitor keyword universes/i.test(nationalHtml)
    && !pageSource.includes("generateContent")
    && !serviceSource.includes("contentPackageGenerated")
    && fixtureRead.nextStage.implemented === false,
  "next-stage explanation only; no content generation",
);
check(
  "ui-national-market-step-uses-search-intel",
  nationalMarketHtml.includes('data-ni03b-page="search-intelligence"'),
  "National Market step renders Search Intelligence",
);
check(
  "ui-local-blocked-and-local-market-retained",
  localHtml.includes('data-ni03b-section="local-blocked"')
    && localMarketHtml.includes("Your Local Market")
    && !localMarketHtml.includes('data-ni03b-page="search-intelligence"'),
  "LOCAL tenant stays on Local Market",
);
check(
  "ui-no-rotherham-market",
  !/commercial market: rotherham|serves Rotherham/i.test(nationalHtml),
  "no Rotherham commercial-market contamination",
);
check(
  "ui-no-patient-service-contamination",
  !/Pharmacy First|blood pressure|Travel Vaccinations/i.test(nationalHtml),
  "no patient-service contamination",
);

const nationalFw = framework.buildGrowthEngineFramework("pharmaconnect");
const localFw = framework.buildGrowthEngineFramework("brook-pharmacy");
check(
  "html-tenant-resolution-accepts-project-config",
  read("src/pharmacy/pharmacyTenantSlug.ts").includes("getPharmacyProjectConfigPath")
    && subjectResolver.resolveNationalIntelligenceSubject("pharmaconnect").subjectDomain === "pharmaconnect.uk",
  "HTML tenant resolution accepts config-backed NATIONAL tenants",
);
check(
  "framework-national-search-url",
  nationalFw.steps.find((s) => s.id === "local-market")?.url.includes("/api/growth-engine/search-intelligence") === true,
  nationalFw.steps.find((s) => s.id === "local-market")?.url || "",
);
check(
  "framework-local-market-url-unchanged",
  localFw.steps.find((s) => s.id === "local-market")?.url.includes("/api/growth-engine/local-market") === true,
  localFw.steps.find((s) => s.id === "local-market")?.url || "",
);
check(
  "framework-national-title-retained",
  nationalFw.steps.find((s) => s.id === "local-market")?.title === "National Market",
  nationalFw.steps.find((s) => s.id === "local-market")?.title || "",
);

check(
  "local-places-semantics-unchanged",
  localMarketServiceSource.includes("discoverLocalMarketCompetitors")
    && placesSource.includes("google-places")
    && /healthcare/i.test(healthcareSource),
  "local Places/healthcare files remain",
);
check(
  "local-campaign-and-content-unchanged-core",
  campaignEngineSource.includes("BENCHMARK_MASTER_SERVICE_IDS")
    && contentPackageSource.includes("contentPackageGenerated")
    && !serviceSource.includes("contentPackageGenerated"),
  "local campaign/content generation not used by NI-03B",
);
check(
  "national-local-market-page-no-places-run",
  localMarketSource.includes("renderNationalSearchIntelligencePage")
    && apiSource.includes("Local Google Places discovery is not applicable"),
  "NATIONAL local-market action remains Places-blocked",
);

const previousLogin = process.env.DATAFORSEO_LOGIN;
const previousPassword = process.env.DATAFORSEO_PASSWORD;
process.env.DATAFORSEO_LOGIN = "ni03b-validator";
process.env.DATAFORSEO_PASSWORD = "ni03b-validator";
let mockedRequests = 0;
const serpRequestBodies: unknown[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  mockedRequests += 1;
  fetchCalls += 1;
  const url = String(input);
  fetchUrls.push(url);
  const labs = url.includes("ranked_keywords");
  if (!labs && init?.body) {
    serpRequestBodies.push(JSON.parse(String(init.body)));
  }
  const body = labs
    ? {
      status_code: 20000,
      tasks: [{
        status_code: 20000,
        cost: 0.0123,
        result: [{
          items: [{
            keyword_data: {
              keyword: "pharmacy website design uk",
              keyword_info: { search_volume: 210, cpc: 4.2, competition: 0.51 },
            },
            ranked_serp_element: {
              serp_item: {
                rank_absolute: 7,
                url: "https://example-national-search-b.co.uk/websites",
              },
            },
          }, {
            keyword_data: {
              keyword: "pharmacy seo agency",
              keyword_info: { search_volume: null, cpc: null, competition: null },
            },
            ranked_serp_element: {
              serp_item: {
                rank_absolute: 12,
                url: "https://example-national-search-b.co.uk/seo",
              },
            },
          }],
        }],
      }],
    }
    : {
      status_code: 20000,
      tasks: [{
        status_code: 20000,
        cost: 0.0015,
        result: [{
          items: [{
            type: "organic",
            rank_absolute: 2,
            domain: "example-search-competitor.co.uk",
            url: "https://example-search-competitor.co.uk/pharmacy-websites",
            title: "Pharmacy Website Design & SEO Agency UK",
            description: "We provide pharmacy website design, pharmacy SEO and digital marketing services for UK community pharmacies.",
          }],
        }],
      }],
    };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const [firstCollect, secondCollect] = await Promise.all([
  searchService.collectNationalSearchIntelligence(tenantBSlug, { force: true }),
  searchService.collectNationalSearchIntelligence(tenantBSlug, { force: true }),
]);
check(
  "duplicate-collect-does-not-double-paid-calls",
  mockedRequests === 4 && (firstCollect.reusedExistingSnapshot || secondCollect.reusedExistingSnapshot),
  `requests=${mockedRequests} reused=${firstCollect.reusedExistingSnapshot}/${secondCollect.reusedExistingSnapshot}`,
);
check(
  "live-serp-requests-use-location-code-2826",
  serpRequestBodies.length === 3
    && serpRequestBodies.every((payload) => {
      const task = Array.isArray(payload) ? payload[0] as Record<string, unknown> : null;
      return Boolean(task)
        && task.location_code === 2826
        && !("location_name" in task);
    }),
  JSON.stringify(serpRequestBodies),
);
const liveCollect = firstCollect.liveExecution ? firstCollect : secondCollect.liveExecution ? secondCollect : firstCollect;
check(
  "collect-persists-keywords-and-cost",
  liveCollect.customerKeywords.length === 2
    && liveCollect.customerKeywords[0]?.position === 7
    && liveCollect.customerKeywords[0]?.rankingUrl?.includes("example-national-search-b.co.uk") === true
    && liveCollect.customerKeywords[1]?.searchVolume === null
    && liveCollect.customerKeywords[1]?.cpc === null
    && liveCollect.costLedger.totalCost > 0
    && Math.abs(liveCollect.costLedger.totalCost - liveCollect.costs.totalCost) < 1e-9
    && fs.existsSync(storage.nationalIntelligenceDataPath(tenantBSlug, "search-intelligence-v1"))
    && fs.existsSync(storage.nationalIntelligenceDataPath(tenantBSlug, "ranked-keywords-customer"))
    && fs.existsSync(storage.nationalIntelligenceDataPath(tenantBSlug, "cost-ledger-v1")),
  `keywords=${liveCollect.customerKeywords.length} cost=${liveCollect.costs.totalCost}`,
);
check(
  "collect-persists-organic-competitors",
  liveCollect.organicCompetitors.length >= 1
    && liveCollect.organicCompetitors[0]?.whyIdentified.length > 0
    && liveCollect.organicCompetitors[0]?.verified === false
    && liveCollect.status === "collected",
  `${liveCollect.status} competitors=${liveCollect.organicCompetitors.length}`,
);

const persistedRead = searchService.readNationalSearchIntelligence(tenantBSlug);
check(
  "later-read-is-persisted-not-live",
  persistedRead.liveExecution === false
    && persistedRead.provenance.evidenceSource === "DATAFORSEO_PERSISTED"
    && persistedRead.customerKeywords.length === 2,
  `${persistedRead.authority}/${persistedRead.provenance.evidenceSource}`,
);

check(
  "max-40101-retries-is-one",
  searchProvider.MAX_DATAFORSEO_INTERNAL_SE_RETRIES === 1
    && searchProvider.DATAFORSEO_TASK_INTERNAL_SE_ERROR === 40101,
  String(searchProvider.MAX_DATAFORSEO_INTERNAL_SE_RETRIES),
);

function rankedOkPayload() {
  return {
    status_code: 20000,
    tasks: [{
      status_code: 20000,
      cost: 0.0123,
      result: [{
        items: [{
          keyword_data: {
            keyword: "pharmacy website design uk",
            keyword_info: { search_volume: 210, cpc: 4.2, competition: 0.51 },
          },
          ranked_serp_element: {
            serp_item: {
              rank_absolute: 7,
              url: "https://example-national-search-b.co.uk/websites",
            },
          },
        }],
      }],
    }],
  };
}

function serpOkPayload(domain: string, cost = 0.0015) {
  return {
    status_code: 20000,
    tasks: [{
      id: `ok-${domain}`,
      status_code: 20000,
      status_message: "Ok.",
      cost,
      result: [{
        items: [{
          type: "organic",
          rank_absolute: 2,
          domain,
          url: `https://${domain}/pharmacy-websites`,
          title: "Pharmacy Website Design & SEO Agency UK",
          description: "We provide pharmacy website design, pharmacy SEO and digital marketing services for UK community pharmacies.",
        }],
      }],
    }],
  };
}

function serp40101Payload(cost = 0.002) {
  return {
    status_code: 20000,
    tasks: [{
      id: "task-40101",
      status_code: 40101,
      status_message: "Internal SE Server Error",
      cost,
    }],
  };
}

function writeNationalTenant(slug: string, domain: string): string {
  const file = path.join(ROOT, "config/projects", `${slug}.json`);
  fs.writeFileSync(file, JSON.stringify({
    clientSlug: slug,
    businessName: "National Search Tenant",
    domain: `https://${domain}`,
    growthPlatform: "national",
    primaryLocation: "United Kingdom",
    country: "United Kingdom",
    languageCode: "en",
    services: ["National SEO"],
  }, null, 2) + "\n");
  return file;
}

async function collectWithSerpQueue(
  slug: string,
  queue: object[],
  options: { rankedAuthFail?: boolean; hangRanked?: boolean; hangFirstSerp?: boolean } = {},
) {
  const remaining = [...queue];
  let rankedCalls = 0;
  let serpCalls = 0;
  let fetchesWithSignal = 0;
  let fetchesMissingSignal = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls += 1;
    const url = String(input);
    fetchUrls.push(url);
    if (init?.signal) fetchesWithSignal += 1;
    else fetchesMissingSignal += 1;
    const hang = (): Promise<Response> => new Promise((_, reject) => {
      const fail = () => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        reject(err);
      };
      if (init?.signal?.aborted) return fail();
      init?.signal?.addEventListener("abort", fail, { once: true });
      setTimeout(() => reject(new Error("NI-03B validator hang mock was not aborted")), 5000);
    });
    if (url.includes("ranked_keywords")) {
      rankedCalls += 1;
      if (options.hangRanked) return hang();
      if (options.rankedAuthFail) {
        return new Response(JSON.stringify({ status_code: 40100, status_message: "You are not authorized." }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(rankedOkPayload()), { status: 200, headers: { "content-type": "application/json" } });
    }
    serpCalls += 1;
    if (options.hangFirstSerp && serpCalls === 1) return hang();
    const next = remaining.shift() || serp40101Payload();
    return new Response(JSON.stringify(next), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const snapshot = await searchService.collectNationalSearchIntelligence(slug, { force: true });
  return { snapshot, rankedCalls, serpCalls, fetchesWithSignal, fetchesMissingSignal, unusedQueue: remaining.length };
}

const tenantRetry = "ni03b-resilience-retry";
const tenantPartial = "ni03b-resilience-partial";
const tenantAllFail = "ni03b-resilience-allfail";
const tenantAuth = "ni03b-resilience-auth";
const tenantTimeoutSerp = "ni03b-timeout-serp";
const tenantTimeoutRanked = "ni03b-timeout-ranked";
const extraTenantFiles = [
  writeNationalTenant(tenantRetry, "example-national-retry.co.uk"),
  writeNationalTenant(tenantPartial, "example-national-partial.co.uk"),
  writeNationalTenant(tenantAllFail, "example-national-allfail.co.uk"),
  writeNationalTenant(tenantAuth, "example-national-auth.co.uk"),
  writeNationalTenant(tenantTimeoutSerp, "example-national-timeout-serp.co.uk"),
  writeNationalTenant(tenantTimeoutRanked, "example-national-timeout-ranked.co.uk"),
];

const retryCase = await collectWithSerpQueue(tenantRetry, [
  serp40101Payload(0.002),
  serpOkPayload("retry-success-agency.co.uk"),
  serpOkPayload("second-query-agency.co.uk"),
  serpOkPayload("third-query-agency.co.uk"),
]);
check(
  "resilience-40101-retry-then-collected",
  retryCase.snapshot.status === "collected"
    && retryCase.serpCalls === 4
    && retryCase.snapshot.serpAttempts.filter((row) => row.taskStatusCode === 40101).length === 1
    && retryCase.snapshot.serpAttempts.filter((row) => row.successful).length === 3
    && Math.abs(retryCase.snapshot.costs.totalCost - (0.0123 + 0.002 + 0.0015 * 3)) < 1e-9
    && retryCase.snapshot.customerKeywords.length === 1
    && retryCase.snapshot.organicCompetitors.length >= 1,
  `${retryCase.snapshot.status} serpCalls=${retryCase.serpCalls} cost=${retryCase.snapshot.costs.totalCost} attempts=${retryCase.snapshot.serpAttempts.length}`,
);

const partialCase = await collectWithSerpQueue(tenantPartial, [
  serp40101Payload(0.002),
  serp40101Payload(0.002),
  serpOkPayload("partial-two-agency.co.uk"),
  serpOkPayload("partial-three-agency.co.uk"),
]);
check(
  "resilience-40101-exhausted-still-runs-remaining",
  partialCase.snapshot.status === "partial"
    && partialCase.serpCalls === 4
    && partialCase.snapshot.serpAttempts.filter((row) => row.taskStatusCode === 40101).length === 2
    && partialCase.snapshot.customerKeywords.length === 1
    && partialCase.snapshot.organicCompetitors.length >= 1
    && Math.abs(partialCase.snapshot.costs.totalCost - (0.0123 + 0.002 * 2 + 0.0015 * 2)) < 1e-9
    && /one or more search-engine requests could not be completed/i.test(partialCase.snapshot.lastError || ""),
  `${partialCase.snapshot.status} serpCalls=${partialCase.serpCalls} competitors=${partialCase.snapshot.organicCompetitors.length} cost=${partialCase.snapshot.costs.totalCost}`,
);
check(
  "resilience-partial-not-labelled-collected",
  partialCase.snapshot.status !== "collected" && searchModel.isUsableNationalSearchIntelligenceStatus(partialCase.snapshot.status),
  partialCase.snapshot.status,
);

const allFail = await collectWithSerpQueue(tenantAllFail, [
  serp40101Payload(0.002),
  serp40101Payload(0.002),
  serp40101Payload(0.002),
  serp40101Payload(0.002),
  serp40101Payload(0.002),
  serp40101Payload(0.002),
]);
check(
  "resilience-all-serps-fail-keeps-keywords-partial",
  allFail.snapshot.status === "partial"
    && allFail.serpCalls === 6
    && allFail.snapshot.customerKeywords.length === 1
    && allFail.snapshot.organicCompetitors.length === 0
    && allFail.snapshot.serpAttempts.every((row) => row.successful === false)
    && Math.abs(allFail.snapshot.costs.totalCost - (0.0123 + 0.002 * 6)) < 1e-9,
  `${allFail.snapshot.status} keywords=${allFail.snapshot.customerKeywords.length} competitors=${allFail.snapshot.organicCompetitors.length} serpCalls=${allFail.serpCalls}`,
);

const authCase = await collectWithSerpQueue(tenantAuth, [], { rankedAuthFail: true });
check(
  "resilience-fatal-auth-no-serp-retry",
  authCase.snapshot.status === "error"
    && authCase.rankedCalls === 1
    && authCase.serpCalls === 0
    && authCase.snapshot.customerKeywords.length === 0
    && authCase.snapshot.organicCompetitors.length === 0,
  `${authCase.snapshot.status} ranked=${authCase.rankedCalls} serp=${authCase.serpCalls}`,
);

dataForSeoHttp.setDataForSeoHttpTimeoutMsForTests(80);
try {
  const timeoutSerp = await collectWithSerpQueue(tenantTimeoutSerp, [
    serpOkPayload("timeout-two-agency.co.uk"),
    serpOkPayload("timeout-three-agency.co.uk"),
  ], { hangFirstSerp: true });
  check(
    "http-timeout-does-not-retry-serp",
    timeoutSerp.snapshot.status === "partial"
      && timeoutSerp.serpCalls === 3
      && timeoutSerp.snapshot.customerKeywords.length === 1
      && timeoutSerp.snapshot.organicCompetitors.length >= 1
      && timeoutSerp.snapshot.serpAttempts.filter((row) => row.timedOut).length === 1
      && timeoutSerp.snapshot.serpAttempts.filter((row) => row.timedOut).every((row) => row.successful === false)
      && timeoutSerp.fetchesMissingSignal === 0,
    `${timeoutSerp.snapshot.status} serpCalls=${timeoutSerp.serpCalls} timedOut=${timeoutSerp.snapshot.serpAttempts.filter((row) => row.timedOut).length} keywords=${timeoutSerp.snapshot.customerKeywords.length}`,
  );

  const timeoutRanked = await collectWithSerpQueue(tenantTimeoutRanked, [
    serpOkPayload("ranked-timeout-one-agency.co.uk"),
    serpOkPayload("ranked-timeout-two-agency.co.uk"),
    serpOkPayload("ranked-timeout-three-agency.co.uk"),
  ], { hangRanked: true });
  check(
    "ranked-timeout-continues-serps-partial",
    timeoutRanked.snapshot.status === "partial"
      && timeoutRanked.rankedCalls === 1
      && timeoutRanked.serpCalls === 3
      && timeoutRanked.snapshot.customerKeywords.length === 0
      && timeoutRanked.snapshot.organicCompetitors.length >= 1,
    `${timeoutRanked.snapshot.status} ranked=${timeoutRanked.rankedCalls} serp=${timeoutRanked.serpCalls} keywords=${timeoutRanked.snapshot.customerKeywords.length} competitors=${timeoutRanked.snapshot.organicCompetitors.length}`,
  );
} finally {
  dataForSeoHttp.setDataForSeoHttpTimeoutMsForTests(null);
}

const fetchBeforePartialRead = fetchCalls;
searchService.readNationalSearchIntelligence(tenantPartial);
pageRenderers.renderSearchIntelligencePage(tenantPartial);
const partialHtml = pageRenderers.renderSearchIntelligencePage(tenantPartial);
check(
  "resilience-dashboard-get-zero-dataforseo",
  fetchCalls === fetchBeforePartialRead,
  `fetchCallsDelta=${fetchCalls - fetchBeforePartialRead}`,
);
check(
  "resilience-partial-ui-copy",
  partialHtml.includes('data-ni03b-section="partial"')
    && /one or more search-engine requests could not be completed/i.test(partialHtml)
    && !partialHtml.includes("Internal SE Server Error"),
  "customer-facing partial copy without task stack traces",
);

let localCollectError = "";
try {
  await searchService.collectNationalSearchIntelligence("brook-pharmacy");
} catch (err) {
  localCollectError = err instanceof Error ? err.message : String(err);
}
check(
  "collect-rejects-local-tenant",
  /not eligible/i.test(localCollectError),
  localCollectError,
);

if (previousLogin === undefined) delete process.env.DATAFORSEO_LOGIN;
else process.env.DATAFORSEO_LOGIN = previousLogin;
if (previousPassword === undefined) delete process.env.DATAFORSEO_PASSWORD;
else process.env.DATAFORSEO_PASSWORD = previousPassword;

for (const slug of [tenantBSlug, tenantRetry, tenantPartial, tenantAllFail, tenantAuth, tenantTimeoutSerp, tenantTimeoutRanked]) {
  for (const artifact of [
    "search-intelligence-v1",
    "ranked-keywords-customer",
    "cost-ledger-v1",
    "refresh-metadata-v1",
    "competitor-discovery",
  ] as const) {
    const dataFile = storage.nationalIntelligenceDataPath(slug, artifact);
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
  }
}
if (fs.existsSync(fixtureFile)) fs.unlinkSync(fixtureFile);
if (fs.existsSync(tenantBFile)) fs.unlinkSync(tenantBFile);
for (const file of extraTenantFiles) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

globalThis.fetch = originalFetch;

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
