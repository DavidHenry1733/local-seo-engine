/**
 * DATAFORSEO-SERVICE-DEMAND-CONTRACT-14 validation.
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
  path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-service-search-demand.json`),
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
  const lower = text.toLowerCase();
  if (lower.includes("dataforseo_login") && /dataforseo_login\s*[:=]\s*[^\s\[]+/i.test(text)) {
    return true;
  }
  if (/basic\s+[a-z0-9+/=]{16,}/i.test(text)) return true;
  return false;
}

async function main(): Promise<void> {
  console.log("\n=== DATAFORSEO-SERVICE-DEMAND-CONTRACT-14 ===\n");

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

  // --- Query builder checks ---
  const bpSpecs = buildServiceSearchDemandQuerySpecs({ serviceId: "blood-pressure-checks" });
  const bpQueries = bpSpecs.map((s) => s.query);
  record(
    "01-query-order-and-patterns",
    bpQueries.length <= 5 &&
      bpQueries[0] === "blood pressure check" &&
      bpQueries.includes("blood pressure test"),
    bpQueries.join(" | "),
  );

  const travelQueries = buildServiceSearchDemandQueries({
    serviceId: "travel-vaccinations",
  });
  record(
    "02-no-nhs-prefix-for-private-service",
    !travelQueries.some((q) => q.toLowerCase().startsWith("nhs ")),
    travelQueries.join(" | "),
  );

  const deduped = normaliseDemandQueries([
    "blood pressure check",
    "Blood Pressure Check",
  ]);
  record("03-duplicate-query-removal", deduped.length === 1, String(deduped.length));

  record(
    "04-maximum-five-queries",
    bpQueries.length <= SERVICE_SEARCH_DEMAND_MAX_QUERIES_PER_SERVICE &&
      bpQueries.length === 5,
    String(bpQueries.length),
  );

  record(
    "05-no-pharmacy-first-fallback",
    !bpQueries.some((q) => /pharmacy first/i.test(q)) &&
      !travelQueries.some((q) => /pharmacy first/i.test(q)),
    "ok",
  );

  // --- Parser checks ---
  const bpPayload = fixturePayload("search-volume-blood-pressure.json");
  const parsedBp = parseSearchVolumeLiveResponse({
    serviceId: "blood-pressure-checks",
    requestedKeywords: bpQueries,
    payload: bpPayload,
    capturedAt: "2026-08-24T15:00:00.000Z",
  });
  const byQuery = Object.fromEntries(parsedBp.rows.map((r) => [r.query, r]));

  record(
    "06-returned-search-volume",
    byQuery["blood pressure check"]?.searchVolume === 210,
    String(byQuery["blood pressure check"]?.searchVolume),
  );
  record(
    "07-monthly-search-history",
    (byQuery["blood pressure check"]?.monthlySearches?.length || 0) >= 1,
    String(byQuery["blood pressure check"]?.monthlySearches?.length),
  );
  record(
    "08-cpc-and-paid-competition",
    byQuery["pharmacy blood pressure check"]?.cpc === 2.75 &&
      byQuery["pharmacy blood pressure check"]?.competition === "HIGH" &&
      byQuery["pharmacy blood pressure check"]?.competitionIndex === 88 &&
      byQuery["pharmacy blood pressure check"]?.cpcCurrency === "USD",
    JSON.stringify({
      cpc: byQuery["pharmacy blood pressure check"]?.cpc,
      competition: byQuery["pharmacy blood pressure check"]?.competition,
    }),
  );
  record(
    "09-genuine-returned-zero",
    byQuery["blood pressure test"]?.searchVolume === 0 &&
      byQuery["blood pressure test"]?.availability === "zero",
    String(byQuery["blood pressure test"]?.searchVolume),
  );
  record(
    "10-missing-keyword-data-null",
    byQuery["NHS blood pressure check"]?.searchVolume === null &&
      byQuery["NHS blood pressure check"]?.cpc === null &&
      byQuery["NHS blood pressure check"]?.competition === null &&
      byQuery["NHS blood pressure check"]?.availability === "unavailable",
    byQuery["NHS blood pressure check"]?.unavailableReason || "",
  );

  const partialPayload = fixturePayload("search-volume-partial.json");
  const fluQueries = buildServiceSearchDemandQueries({
    serviceId: "flu-vaccinations",
    pharmacyName: "Fixture Pharmacy",
    town: "Sheffield",
  });
  const parsedPartial = parseSearchVolumeLiveResponse({
    serviceId: "flu-vaccinations",
    requestedKeywords: fluQueries,
    payload: partialPayload,
    capturedAt: "2026-08-24T15:00:00.000Z",
  });
  const partialAvailable = parsedPartial.rows.filter((r) => r.availability === "available").length;
  const partialMissing = parsedPartial.rows.filter((r) => r.availability === "unavailable").length;
  record(
    "11-partial-results",
    partialAvailable === 1 && partialMissing === fluQueries.length - 1,
    `available=${partialAvailable} missing=${partialMissing}`,
  );

  const req = buildSearchVolumeLiveRequest(["a", "b"]);
  record(
    "12-request-contract",
    req[0]?.location_code === 2826 &&
      req[0]?.language_code === "en" &&
      Array.isArray(req[0]?.keywords) &&
      req[0].keywords.length === 2,
    JSON.stringify(req[0]),
  );

  // --- Empty selectedServices ---
  writeProfile(SLUG_A, {
    pharmacyName: "Fixture Pharmacy",
    primaryTown: "Barnsley",
    townCity: "Barnsley",
    selectedServices: [],
    detectedWebsiteServices: [{ serviceId: "pharmacy-first", serviceName: "Pharmacy First" }],
  });
  const emptyResult = await collectServiceSearchDemand(SLUG_A, {
    postSearchVolume: async () => {
      throw new Error("should not call provider for empty selectedServices");
    },
    now: new Date("2026-08-24T15:00:00.000Z"),
  });
  record(
    "13-empty-selectedServices-no-batches",
    emptyResult.requestCount === 0 &&
      emptyResult.artifact.confirmedServiceIds.length === 0 &&
      Object.keys(emptyResult.artifact.demandByService).length === 0,
    `requests=${emptyResult.requestCount}`,
  );

  // --- Confirmed vs detected isolation + multi-service ---
  writeProfile(SLUG_A, {
    pharmacyName: "Fixture Pharmacy",
    primaryTown: "Barnsley",
    townCity: "Barnsley",
    selectedServices: ["blood-pressure-checks", "flu-vaccinations"],
    detectedWebsiteServices: [
      { serviceId: "pharmacy-first", serviceName: "Pharmacy First" },
      { serviceId: "travel-vaccinations", serviceName: "Travel Vaccinations" },
    ],
    priorityServices: ["pharmacy-first"],
  });

  const confirmed = readConfirmedServiceIds(SLUG_A);
  record(
    "14-detected-but-unselected-excluded",
    confirmed.includes("blood-pressure-checks") &&
      confirmed.includes("flu-vaccinations") &&
      !confirmed.includes("pharmacy-first") &&
      !confirmed.includes("travel-vaccinations"),
    confirmed.join(","),
  );

  let callCount = 0;
  const collected = await collectServiceSearchDemand(SLUG_A, {
    force: true,
    now: new Date("2026-08-24T15:00:00.000Z"),
    postSearchVolume: async (body) => {
      callCount += 1;
      const keywords = (body as Array<{ keywords?: string[] }>)[0]?.keywords || [];
      const hasBp = keywords.some((q) => /blood pressure check/i.test(q));
      const hasFlu = keywords.some((q) => /flu/i.test(q));
      if (hasBp && hasFlu) return fixturePayload("search-volume-batched-alpha.json");
      throw new Error(`Unexpected fixture keywords: ${keywords.join("|")}`);
    },
  });

  record("15-one-batched-http-request", callCount === 1 && collected.requestCount === 1, `calls=${callCount}`);
  record(
    "16-services-remain-isolated",
    Boolean(collected.artifact.demandByService["blood-pressure-checks"]) &&
      Boolean(collected.artifact.demandByService["flu-vaccinations"]) &&
      !collected.artifact.demandByService["pharmacy-first"] &&
      collected.artifact.demandByService["blood-pressure-checks"].queries.every(
        (q) => q.serviceId === "blood-pressure-checks",
      ) &&
      collected.artifact.demandByService["flu-vaccinations"].queries.every(
        (q) => q.serviceId === "flu-vaccinations",
      ),
    Object.keys(collected.artifact.demandByService).join(","),
  );
  record(
    "17-no-cross-service-evidence",
    !collected.artifact.demandByService["blood-pressure-checks"].queries.some((q) =>
      /flu|pharmacy first/i.test(q.query),
    ) &&
      !collected.artifact.demandByService["flu-vaccinations"].queries.some((q) =>
        /blood pressure/i.test(q.query),
      ),
    "ok",
  );

  // --- Freshness / force ---
  let refreshCalls = 0;
  const reused = await collectServiceSearchDemand(SLUG_A, {
    force: false,
    now: new Date("2026-08-25T15:00:00.000Z"),
    postSearchVolume: async () => {
      refreshCalls += 1;
      throw new Error("should reuse fresh evidence");
    },
  });
  record(
    "18-fresh-evidence-reusable",
    reused.reused === true && reused.requestCount === 0 && refreshCalls === 0,
    `reused=${reused.reused} requests=${reused.requestCount}`,
  );

  const forced = await collectServiceSearchDemand(SLUG_A, {
    force: true,
    now: new Date("2026-08-25T16:00:00.000Z"),
    postSearchVolume: async (body) => {
      refreshCalls += 1;
      return fixturePayload("search-volume-batched-alpha.json");
    },
  });
  record(
    "19-force-refresh-required",
    forced.requestCount === 1 && refreshCalls === 1,
    `requests=${forced.requestCount} calls=${refreshCalls}`,
  );

  const staleFresh = isServiceSearchDemandFresh(
    { capturedAt: "2026-07-01T00:00:00.000Z" },
    new Date("2026-08-24T15:00:00.000Z"),
  );
  record("20-stale-outside-14-days", staleFresh === false, String(staleFresh));

  // --- Second tenant shared logic ---
  writeProfile(SLUG_B, {
    pharmacyName: "Other Tenant Pharmacy",
    primaryTown: "Leeds",
    townCity: "Leeds",
    selectedServices: ["travel-vaccinations"],
  });
  const tenantB = await collectServiceSearchDemand(SLUG_B, {
    force: true,
    now: new Date("2026-08-24T15:00:00.000Z"),
    postSearchVolume: async () => fixturePayload("search-volume-travel.json"),
  });
  record(
    "21-another-tenant-shared-logic",
    tenantB.artifact.slug === SLUG_B &&
      Boolean(tenantB.artifact.demandByService["travel-vaccinations"]) &&
      !tenantB.artifact.demandByService["blood-pressure-checks"] &&
      fs.existsSync(demandArtifactB),
    tenantB.artifact.slug,
  );

  const artifactText = fs.readFileSync(demandArtifactA, "utf8") + fs.readFileSync(demandArtifactB, "utf8");
  record("22-credentials-never-in-artifacts", !containsCredentialLeak(artifactText), "scanned artifacts");

  const logBlob = steps.map((s) => `${s.name} ${s.detail || ""}`).join("\n");
  record("23-credentials-never-in-logs", !containsCredentialLeak(logBlob), "scanned log buffer");

  record(
    "24-no-external-provider-calls",
    fetchCalls.length === 0,
    fetchCalls.join(",") || "none",
  );

  let protectedOk = true;
  for (const file of PROTECTED_PATHS) {
    const after = hashFile(file);
    if (after !== beforeHashes.get(file)) {
      protectedOk = false;
      record("25-protected-artifact-unchanged", false, file);
    }
  }
  if (protectedOk) {
    record("25-protected-artifact-unchanged", true, `${PROTECTED_PATHS.length} files`);
  }

  record(
    "26-yorkshire-demand-artifact-unchanged",
    (() => {
      const file = path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-service-search-demand.json`);
      if (!beforeHashes.has(file)) return true;
      return hashFile(file) === beforeHashes.get(file);
    })(),
    beforeHashes.has(path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-service-search-demand.json`))
      ? "hash match"
      : "no prior artifact",
  );

  // Cleanup fixture tenants only
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
