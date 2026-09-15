/**
 * DATAFORSEO-CONFIRMED-SERVICE-DEMAND-14 validation.
 * Stored fixtures only — no live DataForSEO or Google calls.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
process.chdir(ROOT);
process.env.WORKSPACE_ROOT = ROOT;

const FIXTURE_DIR = path.join(ROOT, "fixtures/dataforseo-service-demand-contract-14");
const SLUG_A = "fixture-demand-alpha";
const SLUG_B = "fixture-demand-beta";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";

const PROTECTED_PATHS = [
  path.join(ROOT, "data/national-growth-engine", `${YORKSHIRE}-competitor-discovery.json`),
  path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-competitors.json`),
  path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-opportunities.json`),
  path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-generation-context-blood-pressure-checks.json`),
  path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-generation-context-pharmacy-first.json`),
  path.join(ROOT, "data/pharmacy-competitor-intelligence", `${YORKSHIRE}.json`),
  path.join(ROOT, "data/pharmacy-competitor-intelligence", `${YORKSHIRE}-intelligence.json`),
  path.join(ROOT, "data/pharmacy-profiles", `${YORKSHIRE}.json`),
];

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
const fetchCalls: string[] = [];

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  fetchCalls.push(url);
  throw new Error(`Unexpected external request: ${url}`);
}) as typeof fetch;

function record(name: string, passed: boolean, detail?: string): void {
  steps.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function hashFile(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function writeProfile(slug: string, data: Record<string, unknown>): string {
  const dir = path.join(ROOT, "data/pharmacy-profiles");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        slug,
        updatedAt: "2026-08-24T12:00:00.000Z",
        version: 5,
        data,
      },
      null,
      2,
    ),
  );
  return file;
}

function removeIfExists(file: string): void {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function fixturePayload(name: string): unknown {
  return readJson(path.join(FIXTURE_DIR, name));
}

function containsCredentialLeak(text: string): boolean {
  if (/dataforseo_login\s*[:=]\s*[^\s\[]+/i.test(text)) return true;
  if (/basic\s+[a-z0-9+/=]{16,}/i.test(text)) return true;
  return false;
}

async function main(): Promise<void> {
  console.log("\n=== DATAFORSEO-CONFIRMED-SERVICE-DEMAND-14 ===\n");

  const beforeHashes = new Map<string, string | null>();
  for (const file of PROTECTED_PATHS) beforeHashes.set(file, hashFile(file));

  const demandArtifactA = path.join(ROOT, "data/growth-engine", `${SLUG_A}-service-search-demand.json`);
  const demandArtifactB = path.join(ROOT, "data/growth-engine", `${SLUG_B}-service-search-demand.json`);
  const profileA = path.join(ROOT, "data/pharmacy-profiles", `${SLUG_A}.json`);
  const profileB = path.join(ROOT, "data/pharmacy-profiles", `${SLUG_B}.json`);
  removeIfExists(demandArtifactA);
  removeIfExists(demandArtifactB);
  removeIfExists(profileA);
  removeIfExists(profileB);

  const {
    buildServiceSearchDemandQueries,
    buildServiceSearchDemandQuerySpecs,
    normaliseDemandQueries,
  } = await import("../src/pharmacy/serviceSearchDemandQueryBuilder.ts");
  const { parseSearchVolumeLiveResponse, buildSearchVolumeLiveRequest } = await import(
    "../src/pharmacy/dataForSeoKeywordsDataSearchVolumeAdapter.ts"
  );
  const {
    collectServiceSearchDemand,
    isServiceSearchDemandFresh,
    readConfirmedServiceIds,
  } = await import("../src/pharmacy/serviceSearchDemandService.ts");
  const { resolveServiceSearchDemandMeta } = await import(
    "../src/pharmacy/serviceSearchDemandMetadata.ts"
  );
  const { SERVICE_SEARCH_DEMAND_MAX_QUERIES_PER_SERVICE } = await import(
    "../src/pharmacy/serviceSearchDemandModel.ts"
  );

  const bpSpecs = buildServiceSearchDemandQuerySpecs({
    serviceId: "blood-pressure-checks",
  });
  const bpQueries = bpSpecs.map((s) => s.query);
  record(
    "01-only-selectedServices-query-patterns",
    bpQueries.length <= 5 &&
      bpQueries[0] === "blood pressure check" &&
      bpQueries.includes("blood pressure test") &&
      bpSpecs.every((s) => s.queryScope === "national-service-demand"),
    bpQueries.join(" | "),
  );

  const travelQueries = buildServiceSearchDemandQueries({
    serviceId: "travel-vaccinations",
  });
  record(
    "02-no-nhs-for-private-service",
    !travelQueries.some((q) => q.toLowerCase().startsWith("nhs ")),
    travelQueries.join(" | "),
  );

  record(
    "03-five-query-maximum",
    bpQueries.length === SERVICE_SEARCH_DEMAND_MAX_QUERIES_PER_SERVICE,
    String(bpQueries.length),
  );

  record(
    "04-duplicate-query-removal",
    normaliseDemandQueries([
      "blood pressure check",
      "Blood Pressure Check",
    ]).length === 1,
    "ok",
  );

  record(
    "05-no-pharmacy-first-fallback",
    !bpQueries.some((q) => /pharmacy first/i.test(q)),
    "ok",
  );

  const bpPayload = fixturePayload("search-volume-blood-pressure.json");
  const parsedBp = parseSearchVolumeLiveResponse({
    serviceId: "blood-pressure-checks",
    requestedKeywords: bpQueries,
    payload: bpPayload,
    capturedAt: "2026-08-24T15:00:00.000Z",
  });
  const byQuery = Object.fromEntries(parsedBp.rows.map((r) => [r.query, r]));

  record("06-search-volume-parsed", byQuery["blood pressure check"]?.searchVolume === 210, "210");
  record(
    "07-monthly-searches-parsed",
    (byQuery["blood pressure check"]?.monthlySearches?.length || 0) >= 1,
    String(byQuery["blood pressure check"]?.monthlySearches?.length),
  );
  record(
    "08-cpc-and-competition-parsed",
    byQuery["pharmacy blood pressure check"]?.cpc === 2.75 &&
      byQuery["pharmacy blood pressure check"]?.competition === "HIGH" &&
      byQuery["pharmacy blood pressure check"]?.competitionIndex === 88,
    "ok",
  );
  record(
    "09-zero-remains-zero",
    byQuery["blood pressure test"]?.searchVolume === 0 &&
      byQuery["blood pressure test"]?.availability === "zero",
    "0",
  );
  record(
    "10-missing-remains-null",
    byQuery["NHS blood pressure check"]?.searchVolume === null &&
      byQuery["NHS blood pressure check"]?.cpc === null &&
      byQuery["NHS blood pressure check"]?.competition === null,
    byQuery["NHS blood pressure check"]?.unavailableReason || "",
  );

  const req = buildSearchVolumeLiveRequest(["a", "b"]);
  record(
    "11-request-contract-uk-en",
    req[0]?.location_code === 2826 && req[0]?.language_code === "en",
    JSON.stringify(req[0]),
  );

  writeProfile(SLUG_A, {
    pharmacyName: "Fixture Pharmacy",
    primaryTown: "Barnsley",
    townCity: "Barnsley",
    selectedServices: [],
    detectedWebsiteServices: [{ serviceId: "pharmacy-first", serviceName: "Pharmacy First" }],
  });
  const emptyResult = await collectServiceSearchDemand(SLUG_A, {
    postSearchVolume: async () => {
      throw new Error("should not call provider");
    },
    now: new Date("2026-08-24T15:00:00.000Z"),
  });
  record(
    "12-empty-selectedServices-no-tasks",
    emptyResult.requestCount === 0 &&
      emptyResult.artifact.confirmedServiceIds.length === 0,
    `requests=${emptyResult.requestCount}`,
  );

  writeProfile(SLUG_A, {
    pharmacyName: "Fixture Pharmacy",
    primaryTown: "Barnsley",
    townCity: "Barnsley",
    selectedServices: ["blood-pressure-checks", "flu-vaccinations"],
    detectedWebsiteServices: [
      { serviceId: "pharmacy-first", serviceName: "Pharmacy First" },
      { serviceId: "travel-vaccinations", serviceName: "Travel Vaccinations" },
    ],
  });

  const confirmed = readConfirmedServiceIds(SLUG_A);
  record(
    "13-detected-unselected-excluded",
    confirmed.length === 2 &&
      !confirmed.includes("pharmacy-first") &&
      !confirmed.includes("travel-vaccinations"),
    confirmed.join(","),
  );

  let batchedKeywordCount = 0;
  let httpCalls = 0;
  const collected = await collectServiceSearchDemand(SLUG_A, {
    force: true,
    now: new Date("2026-08-24T15:00:00.000Z"),
    postSearchVolume: async (body) => {
      httpCalls += 1;
      const keywords = (body as Array<{ keywords?: string[] }>)[0]?.keywords || [];
      batchedKeywordCount = keywords.length;
      const hasBp = keywords.some((q) => /blood pressure check/i.test(q));
      const hasFlu = keywords.some((q) => /flu vaccination/i.test(q));
      record(
        "14-batched-keywords-include-both-services",
        hasBp && hasFlu && keywords.length <= 10,
        `${keywords.length} keywords`,
      );
      return fixturePayload("search-volume-batched-alpha.json");
    },
  });

  record(
    "15-one-http-request-for-multiple-services",
    httpCalls === 1 && collected.requestCount === 1 && collected.artifact.requestCount === 1,
    `http=${httpCalls} artifact=${collected.artifact.requestCount}`,
  );
  record(
    "16-services-remain-isolated",
    collected.artifact.demandByService["blood-pressure-checks"]?.queries.every(
      (q) => q.serviceId === "blood-pressure-checks",
    ) &&
      collected.artifact.demandByService["flu-vaccinations"]?.queries.every(
        (q) => q.serviceId === "flu-vaccinations",
      ) &&
      collected.artifact.demandByService["blood-pressure-checks"]?.requestCount === 1 &&
      collected.artifact.demandByService["flu-vaccinations"]?.requestCount === 1,
    Object.keys(collected.artifact.demandByService).join(","),
  );
  record(
    "17-no-cross-service-query-leakage",
    !collected.artifact.demandByService["blood-pressure-checks"]?.queries.some((q) =>
      /flu/i.test(q.query),
    ) &&
      !collected.artifact.demandByService["flu-vaccinations"]?.queries.some((q) =>
        /blood pressure/i.test(q.query),
      ),
    "ok",
  );

  let refreshCalls = 0;
  const reused = await collectServiceSearchDemand(SLUG_A, {
    force: false,
    now: new Date("2026-08-25T15:00:00.000Z"),
    postSearchVolume: async () => {
      refreshCalls += 1;
      throw new Error("should reuse");
    },
  });
  record(
    "18-fourteen-day-reuse",
    reused.reused === true &&
      reused.requestCount === 0 &&
      refreshCalls === 0 &&
      reused.artifact.demandByService["blood-pressure-checks"]?.requestCount === 0,
    `reused=${reused.reused}`,
  );

  const forced = await collectServiceSearchDemand(SLUG_A, {
    force: true,
    now: new Date("2026-08-25T16:00:00.000Z"),
    postSearchVolume: async () => {
      refreshCalls += 1;
      return fixturePayload("search-volume-batched-alpha.json");
    },
  });
  record(
    "19-force-refresh-recollects",
    forced.requestCount === 1 && refreshCalls === 1,
    `requests=${forced.requestCount}`,
  );

  record(
    "20-stale-outside-window",
    isServiceSearchDemandFresh(
      { capturedAt: "2026-07-01T00:00:00.000Z" },
      new Date("2026-08-24T15:00:00.000Z"),
    ) === false,
    "ok",
  );

  writeProfile(SLUG_B, {
    pharmacyName: "Other Tenant Pharmacy",
    primaryTown: "Leeds",
    townCity: "Leeds",
    selectedServices: ["travel-vaccinations"],
  });
  await collectServiceSearchDemand(SLUG_B, {
    force: true,
    now: new Date("2026-08-24T15:00:00.000Z"),
    postSearchVolume: async () => fixturePayload("search-volume-travel.json"),
  });
  record(
    "21-shared-logic-second-tenant",
    fs.existsSync(demandArtifactB) &&
      readJson<{ slug: string }>(demandArtifactB).slug === SLUG_B,
    SLUG_B,
  );

  const artifactText = fs.readFileSync(demandArtifactA, "utf8") + fs.readFileSync(demandArtifactB, "utf8");
  record("22-no-credentials-in-artifacts", !containsCredentialLeak(artifactText), "ok");
  record(
    "23-no-credentials-in-logs",
    !containsCredentialLeak(steps.map((s) => s.detail || "").join("\n")),
    "ok",
  );
  record("24-no-external-calls", fetchCalls.length === 0, fetchCalls.join(",") || "none");

  let protectedOk = true;
  for (const file of PROTECTED_PATHS) {
    if (hashFile(file) !== beforeHashes.get(file)) {
      protectedOk = false;
      record("25-protected-artifacts-unchanged", false, file);
    }
  }
  if (protectedOk) {
    record("25-protected-artifacts-unchanged", true, `${PROTECTED_PATHS.length} files`);
  }

  record(
    "26-artifact-schema-fields",
    collected.artifact.schemaVersion === 1 &&
      Array.isArray(collected.artifact.confirmedServiceIds) &&
      collected.artifact.locationCode === 2826 &&
      collected.artifact.languageCode === "en" &&
      typeof collected.artifact.generatedAt === "string" &&
      Array.isArray(collected.artifact.taskIds),
    "ok",
  );

  removeIfExists(demandArtifactA);
  removeIfExists(demandArtifactB);
  removeIfExists(profileA);
  removeIfExists(profileB);

  globalThis.fetch = originalFetch;

  const failed = steps.filter((s) => !s.passed).length;
  const passed = steps.filter((s) => s.passed).length;
  console.log(`\n${failed ? "FAIL" : "PASS"} — ${passed}/${passed + failed} checks\n`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  globalThis.fetch = originalFetch;
  console.error(err);
  process.exit(1);
});
