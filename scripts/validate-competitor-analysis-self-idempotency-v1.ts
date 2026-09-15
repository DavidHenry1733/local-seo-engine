/**
 * Stubbed validation: competitor-analysis jobs must not treat themselves as duplicates.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);
process.env.WORKSPACE_ROOT = ROOT;

const liveHosts = ["api.dataforseo.com", "places.googleapis.com"];
let failDataForSeo = false;
let failGoogle = false;
const fetchCalls: Array<{ url: string }> = [];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
    rating: 4.2,
    userRatingCount: 12 + index,
    websiteUri: `https://${name.toLowerCase()}-neighbourhood-pharmacy.example`,
    nationalPhoneNumber: `01234 00000${index}`,
  }));
  return jsonResponse({ places });
}

function dataForSeoPayload() {
  if (failDataForSeo) {
    return {
      status_code: 40100,
      status_message: "Authentication failed: invalid login or password",
      tasks: [],
    };
  }
  return {
    status_code: 20000,
    status_message: "Ok.",
    tasks: [
      {
        id: "task-stub-organic",
        status_code: 20000,
        cost: 0,
        result: [
          {
            items: [
              {
                type: "organic",
                rank_absolute: 2,
                domain: "example-health-competitor.co.uk",
                url: "https://example-health-competitor.co.uk/page",
                title: "Example Health Competitor",
                description: "Organic search result",
              },
            ],
          },
        ],
      },
    ],
  };
}

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  fetchCalls.push({ url });
  if (url.includes("postcodes.io")) throw new Error(`Unexpected external request: ${url}`);
  if (url.includes("places.googleapis.com")) return googlePlacesPayload();
  if (url.includes("api.dataforseo.com")) return jsonResponse(dataForSeoPayload());
  throw new Error(`Unexpected external request: ${url}`);
}) as typeof fetch;

const {
  findActiveCommercialIntelligenceJob,
  runCompetitorAnalysisWorkflowAction,
} = await import("../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts");
const { executeMasterAdminAction } = await import("../src/pharmacy/masterAdminPlatformService.ts");
const {
  createMasterAdminJob,
  updateMasterAdminJob,
} = await import("../src/pharmacy/masterAdminJobService.ts");
const { writeActiveServiceCampaignSelection } = await import("../src/pharmacy/masterAdminActiveServiceCampaignStore.ts");
const { readOrganicSearchRun } = await import("../src/pharmacy/competitorAnalysisOrganicSearchService.ts");
const { loadCompetitorDiscoveryResult, COMPETITOR_INTEL_DIR } = await import("../src/pharmacy/pharmacyCompetitorDiscovery.ts");
const { nationalCompetitorDiscoveryPath } = await import("../src/pharmacy/nationalCompetitorDiscoveryStorageService.ts");
const { isReliableGoogleLocalAnalysis } = await import("../src/pharmacy/pharmacyCompetitorIntelligenceService.ts");

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
    JSON.stringify({
      slug,
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
    }),
  );
  writeActiveServiceCampaignSelection(slug, "campaign-fixture-1", "blood-pressure-checks");
}

function cleanupSlug(slug: string) {
  for (const file of [
    path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`),
    path.join(ROOT, "data/pharmacy-master-admin/active-service-campaign", `${slug}.json`),
    path.join(COMPETITOR_INTEL_DIR, `${slug}.json`),
    path.join(COMPETITOR_INTEL_DIR, `${slug}-intelligence.json`),
    nationalCompetitorDiscoveryPath(slug),
  ]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

function countHost(host: string) {
  return fetchCalls.filter((c) => c.url.includes(host)).length;
}

const workflowSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts"), "utf8");
const platformSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminPlatformService.ts"), "utf8");
const changed = [
  workflowSrc,
  platformSrc,
  fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminWorkflowStageExecutor.ts"), "utf8"),
].join("\n");

check("11-no-yorkshire-logic", !/yorkshire/i.test(changed));
check(
  "exclude-job-id-in-lookup",
  /excludeJobId/.test(workflowSrc) && /j\.id !== exclude/.test(workflowSrc) && /executingJobId/.test(platformSrc),
);
check(
  "self-id-cannot-be-returned",
  /active\.id !== selfId/.test(workflowSrc),
);

const slugSelf = "fixture-self-idempotency-alpha";
const slugDup = "fixture-self-idempotency-duplicate";
const slugPartial = "fixture-self-idempotency-partial";
const slugOther = "fixture-self-idempotency-other";
const slugs = [slugSelf, slugDup, slugPartial, slugOther];

process.env.GOOGLE_PLACES_API_KEY = "stub-google-key";
process.env.DATAFORSEO_LOGIN = "stub-login";
process.env.DATAFORSEO_PASSWORD = "stub-password";

try {
  for (const slug of slugs) {
    cleanupSlug(slug);
    writeProfile(slug);
  }

  const selfJob = createMasterAdminJob({
    slug: slugSelf,
    action: "orchestrate_competitor_analysis",
    user: "validator",
  });
  updateMasterAdminJob(selfJob.id, { status: "running", progressLabel: "Executing…" });
  const listedSelf = findActiveCommercialIntelligenceJob(slugSelf, new Set(["orchestrate_competitor_analysis"]));
  const listedExcludingSelf = findActiveCommercialIntelligenceJob(
    slugSelf,
    new Set(["orchestrate_competitor_analysis"]),
    selfJob.id,
  );
  check("1-lookup-without-exclude-sees-self", listedSelf?.id === selfJob.id, listedSelf?.id || "none");
  check("1-lookup-with-exclude-ignores-self", listedExcludingSelf === null, listedExcludingSelf?.id || "none");

  fetchCalls.length = 0;
  const selfRun = await runCompetitorAnalysisWorkflowAction(slugSelf, "validator", selfJob.id);
  check(
    "1-executing-job-does-not-match-itself",
    selfRun.idempotent !== true && selfRun.activeJobId !== selfJob.id && !/job already/i.test(selfRun.evidence),
    `idempotent=${selfRun.idempotent} activeJobId=${selfRun.activeJobId || "none"} evidence=${selfRun.evidence}`,
  );
  check("2-pipeline-runs-once", /Google\/local/.test(selfRun.evidence) && /DataForSEO organic/.test(selfRun.evidence), selfRun.evidence);
  check("3-google-places-invoked", countHost("places.googleapis.com") > 0, String(countHost("places.googleapis.com")));
  check("4-dataforseo-invoked", countHost("api.dataforseo.com") > 0, String(countHost("api.dataforseo.com")));
  check("7-evidence-after-pipeline", Boolean(loadCompetitorDiscoveryResult(slugSelf)?.competitorCount) && Boolean(readOrganicSearchRun(slugSelf)?.competitors.length));
  check("7-not-noop-generated", isReliableGoogleLocalAnalysis(slugSelf) && (readOrganicSearchRun(slugSelf)?.generated === true));

  const firstGoogle = countHost("places.googleapis.com");
  const firstDfs = countHost("api.dataforseo.com");
  const repeat = await runCompetitorAnalysisWorkflowAction(slugSelf, "validator", selfJob.id);
  check(
    "6-repeat-click-no-duplicate-external-calls",
    countHost("places.googleapis.com") === firstGoogle && countHost("api.dataforseo.com") === firstDfs && repeat.idempotent === true,
    `google ${firstGoogle}->${countHost("places.googleapis.com")} dfs ${firstDfs}->${countHost("api.dataforseo.com")} idempotent=${repeat.idempotent}`,
  );

  const otherJob = createMasterAdminJob({
    slug: slugDup,
    action: "orchestrate_competitor_analysis",
    user: "validator",
  });
  updateMasterAdminJob(otherJob.id, { status: "running" });
  const executingDuplicate = createMasterAdminJob({
    slug: slugDup,
    action: "orchestrate_competitor_analysis",
    user: "validator",
  });
  updateMasterAdminJob(executingDuplicate.id, { status: "running" });
  fetchCalls.length = 0;
  const reused = await runCompetitorAnalysisWorkflowAction(slugDup, "validator", executingDuplicate.id);
  check(
    "5-separate-active-job-reused",
    reused.idempotent === true && reused.activeJobId === otherJob.id && reused.activeJobId !== executingDuplicate.id && fetchCalls.length === 0,
    `activeJobId=${reused.activeJobId} executing=${executingDuplicate.id} calls=${fetchCalls.length} evidence=${reused.evidence}`,
  );

  failDataForSeo = true;
  const partialJob = createMasterAdminJob({
    slug: slugPartial,
    action: "orchestrate_competitor_analysis",
    user: "validator",
  });
  updateMasterAdminJob(partialJob.id, { status: "running" });
  fetchCalls.length = 0;
  const partial = await runCompetitorAnalysisWorkflowAction(slugPartial, "validator", partialJob.id);
  check(
    "8-partial-status-accurate",
    /partial/i.test(partial.evidence) && /Authentication failed/i.test(partial.evidence + (partial.errors || []).join(" ")),
    partial.evidence,
  );
  check("9-real-provider-error", /Authentication failed: invalid login or password/.test((partial.errors || []).join(" | ")), (partial.errors || []).join(" | "));
  failDataForSeo = false;

  const otherJobRun = createMasterAdminJob({
    slug: slugOther,
    action: "orchestrate_competitor_analysis",
    user: "validator",
  });
  updateMasterAdminJob(otherJobRun.id, { status: "running" });
  const viaAction = await executeMasterAdminAction("orchestrate_competitor_analysis", slugOther, "validator", {
    masterAdminJobId: otherJobRun.id,
  });
  check(
    "10-other-tenant-via-action-body",
    viaAction.ok === true && !/job already/i.test(viaAction.audit.evidence) && viaAction.audit.evidence.includes("DataForSEO organic"),
    viaAction.audit.evidence,
  );
  const viaResult = viaAction.result as { activeJobId?: string; idempotent?: boolean };
  check("1-action-result-not-self-active", viaResult?.activeJobId !== otherJobRun.id && viaResult?.idempotent !== true, JSON.stringify(viaResult || {}));

  for (const job of [selfJob, otherJob, executingDuplicate, partialJob, otherJobRun]) {
    updateMasterAdminJob(job.id, { status: "completed", progressLabel: "validator cleanup" });
  }
} finally {
  globalThis.fetch = originalFetch;
  for (const slug of slugs) cleanupSlug(slug);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error(failed.map((f) => ` - ${f.name}: ${f.detail}`).join("\n"));
  process.exit(1);
}
