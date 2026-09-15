/**
 * Stubbed validation for competitor-analysis DataForSEO live integration.
 * All Google Places and DataForSEO HTTP calls are intercepted. No live API spend.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);
process.env.WORKSPACE_ROOT = ROOT;

const liveHosts = ["api.dataforseo.com", "places.googleapis.com", "maps.googleapis.com"];
let failDataForSeo = false;
let failGoogle = false;
let emptyDataForSeo = false;
const fetchCalls: Array<{ url: string; body: string }> = [];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function dataForSeoPayload(keyword: string) {
  if (failDataForSeo) {
    return {
      status_code: 40100,
      status_message: "Authentication failed: invalid login or password",
      tasks: [],
    };
  }
  const items = emptyDataForSeo
    ? []
    : [
        {
          type: "organic",
          rank_absolute: 3,
          rank_group: 3,
          domain: "example-health-competitor.co.uk",
          url: `https://example-health-competitor.co.uk/search?q=${encodeURIComponent(keyword)}`,
          title: "Example Health Competitor",
          description: "Organic search result for the canonical query.",
        },
      ];
  return {
    status_code: 20000,
    status_message: "Ok.",
    tasks: [
      {
        id: `task-${keyword.replace(/\s+/g, "-").slice(0, 24)}`,
        status_code: 20000,
        status_message: "Ok.",
        cost: 0.002,
        result: [{ items }],
      },
    ],
  };
}

function googlePlacesPayload() {
  if (failGoogle) {
    return jsonResponse({ error: { message: "Google Places REQUEST_DENIED: billing not enabled" } }, 403);
  }
  const places = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"].map((name, index) => ({
    id: `places/stub-local-pharmacy-${index + 1}`,
    displayName: { text: `${name} Neighbourhood Pharmacy` },
    formattedAddress: `${10 + index} High Street, Riverside RI1 2B${index}`,
    location: { latitude: 53.51 + index * 0.002, longitude: -1.41 + index * 0.002 },
    rating: 4.1 + index * 0.05,
    userRatingCount: 12 + index,
    websiteUri: `https://${name.toLowerCase()}-neighbourhood-pharmacy.example`,
    nationalPhoneNumber: `01234 00000${index}`,
  }));
  return jsonResponse({ places });
}

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  fetchCalls.push({ url, body: String(init?.body || "") });
  if (url.includes("postcodes.io")) {
    throw new Error(`Unexpected external request: ${url}`);
  }
  if (url.includes("places.googleapis.com")) return googlePlacesPayload();
  if (url.includes("api.dataforseo.com")) {
    let keyword = "unknown";
    try {
      keyword = JSON.parse(String(init?.body || "[]"))[0]?.keyword || keyword;
    } catch {
      /* ignore */
    }
    return jsonResponse(dataForSeoPayload(keyword));
  }
  throw new Error(`Unexpected external request: ${url}`);
}) as typeof fetch;

const {
  writeActiveServiceCampaignSelection,
} = await import("../src/pharmacy/masterAdminActiveServiceCampaignStore.ts");
const {
  runCompetitorIntelligencePipeline,
  isCombinedCompetitorAnalysisStored,
} = await import("../src/pharmacy/pharmacyCompetitorIntelligenceService.ts");
const {
  runCompetitorAnalysisWorkflowAction,
} = await import("../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts");
const {
  buildCommercialIntelligenceDashboard,
} = await import("../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts");
const {
  buildCompetitorAnalysisOrganicQueries,
  readOrganicSearchRun,
} = await import("../src/pharmacy/competitorAnalysisOrganicSearchService.ts");
const {
  writeNationalCompetitorDiscovery,
  nationalCompetitorDiscoveryPath,
} = await import("../src/pharmacy/nationalCompetitorDiscoveryStorageService.ts");
const {
  emptyNationalCompetitorDiscoveryResult,
} = await import("../src/pharmacy/nationalCompetitorDiscoveryModel.ts");
const {
  COMPETITOR_INTEL_DIR,
} = await import("../src/pharmacy/pharmacyCompetitorDiscovery.ts");

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

function writeProfile(slug: string) {
  const dir = path.join(ROOT, "data/pharmacy-profiles");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${slug}.json`),
    JSON.stringify(
      {
        slug,
        updatedAt: new Date().toISOString(),
        data: {
          pharmacyName: "Riverside Health Pharmacy",
          tradingName: "Riverside Health Pharmacy",
          website: "https://www.riverside-health-pharmacy.example",
          primaryTown: "Riverside",
          townCity: "Riverside",
          postcode: "RI1 1AA",
          latitude: "53.5",
          longitude: "-1.4",
          addressLine1: "1 High Street",
          selectedServices: ["blood-pressure-checks"],
        },
      },
      null,
      2,
    ),
  );
  writeActiveServiceCampaignSelection(slug, "campaign-fixture-1", "blood-pressure-checks");
}

function cleanupSlug(slug: string) {
  const files = [
    path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`),
    path.join(ROOT, "data/pharmacy-master-admin/active-service-campaign", `${slug}.json`),
    path.join(COMPETITOR_INTEL_DIR, `${slug}.json`),
    path.join(COMPETITOR_INTEL_DIR, `${slug}-intelligence.json`),
    nationalCompetitorDiscoveryPath(slug),
  ];
  for (const file of files) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

function countHost(host: string) {
  return fetchCalls.filter((c) => c.url.includes(host)).length;
}

const api = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/masterAdminPlatform.ts"), "utf8");
const page = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
const pipeline = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyCompetitorIntelligenceService.ts"), "utf8");
const organic = fs.readFileSync(path.join(ROOT, "src/pharmacy/competitorAnalysisOrganicSearchService.ts"), "utf8");
const adapter = fs.readFileSync(path.join(ROOT, "src/pharmacy/dataForSeoNationalSearchAdapter.ts"), "utf8");
const dash = fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"), "utf8");
const prodFiles = [api, page, pipeline, organic, adapter, dash];

check(
  "1-generate-route-queues-shared-job",
  /generate-competitor-analysis/.test(api) && /action: "orchestrate_competitor_analysis"/.test(api),
);
check(
  "2-pipeline-invokes-google-places",
  /discoverCompetitors\(slug, input\)/.test(pipeline),
);
check(
  "3-pipeline-invokes-dataforseo-adapter",
  /runOrganicSearchCompetitorDiscovery/.test(pipeline) && /searchNationalGoogleOrganic/.test(organic),
);
check(
  "4-dataforseo-auth-alias-path",
  /DATAFORSEO_LOGIN/.test(adapter) && /DATAFORSEO_API_LOGIN/.test(adapter) && /DATAFORSEO_PASSWORD/.test(adapter) && /DATAFORSEO_API_PASSWORD/.test(adapter),
);
check(
  "6-no-yorkshire-hardcoding",
  ![pipeline, organic, adapter].some((t) => /yorkshire-pharmacy-and-health-clinic|Yorkshire Pharmacy|Barnsley/i.test(t)) &&
    !/Pharmacy First/.test(organic),
);
check(
  "7-labels-separate",
  /Google\/local competitors/.test(page) && /DataForSEO organic-search competitors/.test(page),
);
check(
  "18-open-is-get-only",
  /async function openCommercialIntelligenceReview\(\)\{[\s\S]*?commercial-intelligence-dashboard'/.test(page) &&
    !/generate-competitor-analysis/.test(
      page.slice(page.indexOf("async function openCommercialIntelligenceReview()"), page.indexOf("async function generateCompetitorAnalysisFromCir()")),
    ),
);
check("17-no-yorkshire-in-production", !prodFiles.some((t) => /yorkshire/i.test(t)));

const slugOk = "fixture-local-pharmacy-alpha";
const slugGoogleFail = "fixture-local-pharmacy-google-fail";
const slugDfsFail = "fixture-local-pharmacy-dfs-fail";
const slugEmpty = "fixture-local-pharmacy-empty-organic";
const slugCompat = "fixture-local-pharmacy-stored-organic";
const slugOther = "fixture-local-pharmacy-other-tenant";
const allSlugs = [slugOk, slugGoogleFail, slugDfsFail, slugEmpty, slugCompat, slugOther];

try {
  process.env.GOOGLE_PLACES_API_KEY = "stub-google-key";
  process.env.DATAFORSEO_LOGIN = "stub-login";
  process.env.DATAFORSEO_PASSWORD = "stub-password";

  for (const slug of allSlugs) {
    cleanupSlug(slug);
    writeProfile(slug);
  }

  const queries = buildCompetitorAnalysisOrganicQueries(slugOk);
  check(
    "5-canonical-query-evidence",
    queries.queries.some((q) => q.includes("Blood Pressure Checks") && q.includes("Riverside")) &&
      queries.queries.some((q) => q.includes("Riverside Health Pharmacy")) &&
      queries.queries.some((q) => q.includes("RI1 1AA")) &&
      !queries.queries.some((q) => /yorkshire|barnsley|pharmacy first/i.test(q)),
    queries.queries.join(" | "),
  );

  fetchCalls.length = 0;
  const first = await runCompetitorIntelligencePipeline(slugOk);
  const googleCalls = countHost("places.googleapis.com");
  const dfsCalls = countHost("api.dataforseo.com");
  check("20-no-unexpected-hosts", fetchCalls.every((c) => liveHosts.some((h) => c.url.includes(h))));
  check("2-google-live-stub-invoked", googleCalls > 0 && first.googleLocal.status === "completed", `googleCalls=${googleCalls} status=${first.googleLocal.status} error=${first.googleLocal.error}`);
  check("3-dataforseo-live-stub-invoked", dfsCalls > 0 && first.dataForSeoOrganic.status === "completed", `dfsCalls=${dfsCalls} status=${first.dataForSeoOrganic.status}`);
  check("8-artifact-fields", Boolean(readOrganicSearchRun(slugOk)?.competitors[0]?.domain && readOrganicSearchRun(slugOk)?.competitors[0]?.url && readOrganicSearchRun(slugOk)?.competitors[0]?.position != null && readOrganicSearchRun(slugOk)?.competitors[0]?.matchedQuery && readOrganicSearchRun(slugOk)?.competitors[0]?.taskId && readOrganicSearchRun(slugOk)?.competitors[0]?.provider === "dataforseo-google-organic-live"));
  check("combined-completed", first.combinedStatus === "completed", first.combinedStatus);

  const beforeRefresh = fetchCalls.length;
  const dashboard = buildCommercialIntelligenceDashboard(slugOk);
  check("9-dashboard-refresh-no-external-call", fetchCalls.length === beforeRefresh);
  check(
    "7-dashboard-separate-labels",
    dashboard.analysisProviders.some((p) => p.family === "google_local" && p.status === "completed") &&
      dashboard.analysisProviders.some((p) => p.family === "dataforseo_organic" && p.status === "completed"),
  );
  check(
    "8-dashboard-organic-fields",
    Boolean(dashboard.organicSearchCompetitors.competitors[0]?.domain && dashboard.organicSearchCompetitors.competitors[0]?.position != null && dashboard.organicSearchCompetitors.competitors[0]?.matchedQuery),
  );

  fetchCalls.length = 0;
  const second = await runCompetitorIntelligencePipeline(slugOk);
  check("10-duplicate-run-skips-provider-requests", fetchCalls.length === 0 && second.googleLocal.status === "completed" && second.dataForSeoOrganic.status === "completed", `calls=${fetchCalls.length}`);
  check("10-combined-already-stored", isCombinedCompetitorAnalysisStored(slugOk));

  failDataForSeo = true;
  fetchCalls.length = 0;
  const dfsFail = await runCompetitorIntelligencePipeline(slugDfsFail);
  check(
    "11-google-success-dataforseo-failure-partial",
    dfsFail.googleLocal.status === "completed" && dfsFail.dataForSeoOrganic.status === "failed" && dfsFail.combinedStatus === "partial" && /Authentication failed/i.test(String(dfsFail.dataForSeoOrganic.error)),
    `${dfsFail.combinedStatus} dfs=${dfsFail.dataForSeoOrganic.error}`,
  );
  failDataForSeo = false;

  failGoogle = true;
  fetchCalls.length = 0;
  const googleFail = await runCompetitorIntelligencePipeline(slugGoogleFail);
  check(
    "12-dataforseo-success-google-failure-partial",
    googleFail.googleLocal.status === "failed" && googleFail.dataForSeoOrganic.status === "completed" && googleFail.combinedStatus === "partial" && /billing|REQUEST_DENIED|failed/i.test(String(googleFail.googleLocal.error)),
    `${googleFail.combinedStatus} google=${googleFail.googleLocal.error}`,
  );
  failGoogle = false;

  emptyDataForSeo = true;
  fetchCalls.length = 0;
  const empty = await runCompetitorIntelligencePipeline(slugEmpty);
  check(
    "13-configured-empty-not-completed-evidence",
    empty.dataForSeoOrganic.status === "no_reliable_results" && empty.dataForSeoOrganic.generated === false,
    empty.dataForSeoOrganic.status,
  );
  const emptyDash = buildCommercialIntelligenceDashboard(slugEmpty);
  check("13-dashboard-empty-not-generated", emptyDash.organicSearchCompetitors.generated === false && emptyDash.organicSearchCompetitors.status === "no_reliable_results");
  emptyDataForSeo = false;

  delete process.env.DATAFORSEO_LOGIN;
  delete process.env.DATAFORSEO_PASSWORD;
  delete process.env.DATAFORSEO_API_LOGIN;
  delete process.env.DATAFORSEO_API_PASSWORD;
  const noCredSlug = "fixture-local-pharmacy-other-tenant";
  cleanupSlug(noCredSlug);
  writeProfile(noCredSlug);
  fetchCalls.length = 0;
  const missingCreds = await runCompetitorIntelligencePipeline(noCredSlug);
  check(
    "14-missing-credentials-not-configured",
    missingCreds.dataForSeoOrganic.status === "not_configured" && /not configured/i.test(String(missingCreds.dataForSeoOrganic.error)),
    missingCreds.dataForSeoOrganic.status,
  );
  check("16-other-tenant-compatible", missingCreds.googleLocal.status === "completed" || missingCreds.googleLocal.status === "failed" || missingCreds.googleLocal.status === "no_reliable_results");
  process.env.DATAFORSEO_LOGIN = "stub-login";
  process.env.DATAFORSEO_PASSWORD = "stub-password";

  writeNationalCompetitorDiscovery({
    ...emptyNationalCompetitorDiscoveryResult(slugCompat, "United Kingdom", "organic-search competitors"),
    status: "complete",
    generatedAt: "2026-01-01T00:00:00.000Z",
    qualifiedCompetitors: [
      {
        id: "legacy-1",
        name: "Legacy Organic Competitor",
        domain: "legacy-competitor.example",
        websiteUrl: "https://legacy-competitor.example/page",
        marketCountry: "United Kingdom",
        targetCustomerMarket: "organic-search competitors",
        source: "search-engine",
        sourceQuery: "blood pressure riverside",
        qualification: "qualified",
        qualificationReasons: ["Stored national discovery artifact"],
        rejectionReasons: [],
        serviceEvidence: [],
        title: "Legacy Organic Competitor",
        description: "Compatible stored row",
        evidenceUrls: ["https://legacy-competitor.example/page"],
        capturedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });
  const compat = readOrganicSearchRun(slugCompat);
  check("15-existing-stored-artifact-compatible", Boolean(compat?.generated && compat.competitors[0]?.domain === "legacy-competitor.example"));

  const workflow = await runCompetitorAnalysisWorkflowAction(slugOk, "validator");
  check("10-workflow-reuses-stored", Boolean(workflow.idempotent && workflow.ok));

  const opener = page.slice(page.indexOf("async function openCommercialIntelligenceReview()"), page.indexOf("async function generateCompetitorAnalysisFromCir()"));
  check("18-opener-has-no-generate-post", opener.includes("commercial-intelligence-dashboard") && !opener.includes("generate-competitor-analysis"));
} finally {
  globalThis.fetch = originalFetch;
  for (const slug of allSlugs) cleanupSlug(slug);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error(failed.map((f) => ` - ${f.name}: ${f.detail}`).join("\n"));
  process.exit(1);
}
