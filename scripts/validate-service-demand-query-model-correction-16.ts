/**
 * SERVICE-DEMAND-QUERY-MODEL-CORRECTION-16 validation.
 * Fixtures and hash checks only — no DataForSEO or Google calls.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
process.chdir(ROOT);
process.env.WORKSPACE_ROOT = ROOT;

const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const EXPECTED_YORKSHIRE_SERVICES = [
  "blood-pressure-checks",
  "discharge-medicines-service",
  "flu-vaccinations",
  "health-checks",
  "independent-prescriber",
  "malaria-prevention",
  "medication-reviews",
  "minor-ailments",
  "new-medicine-service",
  "pharmacy-first",
  "prescription-dispensing",
  "repeat-prescriptions",
  "smoking-cessation",
  "weight-management",
];

const PROTECTED_HASH_PATHS = [
  path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-service-search-demand.json`),
  path.join(ROOT, "data/national-growth-engine", `${YORKSHIRE}-competitor-discovery.json`),
  path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-competitors.json`),
  path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-opportunities.json`),
  path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-generation-context-blood-pressure-checks.json`),
  path.join(ROOT, "data/pharmacy-content-packages", YORKSHIRE, "blood-pressure-checks.json"),
  path.join(ROOT, "data/pharmacy-competitor-intelligence", `${YORKSHIRE}.json`),
  path.join(ROOT, "data/pharmacy-competitor-intelligence", `${YORKSHIRE}-intelligence.json`),
];

const beforeHashes = new Map<string, string>();
for (const file of PROTECTED_HASH_PATHS) {
  if (fs.existsSync(file)) {
    beforeHashes.set(file, createHash("sha256").update(fs.readFileSync(file)).digest("hex"));
  }
}

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
const fetchCalls: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  fetchCalls.push(String(input));
  throw new Error(`Unexpected external request: ${String(input)}`);
}) as typeof fetch;

function record(name: string, passed: boolean, detail?: string): void {
  steps.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

async function main(): Promise<void> {
  console.log("\n=== SERVICE-DEMAND-QUERY-MODEL-CORRECTION-16 ===\n");

  const { buildServiceSearchDemandQuerySpecs } = await import(
    "../src/pharmacy/serviceSearchDemandQueryBuilder.ts"
  );
  const { readConfirmedServiceIds } = await import("../src/pharmacy/serviceSearchDemandService.ts");
  const { buildCompetitorAnalysisOrganicQueries } = await import(
    "../src/pharmacy/competitorAnalysisOrganicSearchService.ts"
  );
  const { describeLocalOrganicVisibilityQuery } = await import(
    "../src/pharmacy/serviceSearchDemandQueryScope.ts"
  );
  const { SERVICE_SEARCH_DEMAND_MAX_QUERIES_PER_SERVICE } = await import(
    "../src/pharmacy/serviceSearchDemandModel.ts"
  );

  const bpSpecs = buildServiceSearchDemandQuerySpecs({ serviceId: "blood-pressure-checks" });
  const bpQueries = bpSpecs.map((s) => s.query);
  record(
    "01-blood-pressure-five-consumer-phrases",
    bpQueries.length === 5 &&
      bpQueries[0] === "blood pressure check" &&
      bpQueries[1] === "blood pressure test" &&
      bpQueries[2] === "pharmacy blood pressure check" &&
      bpQueries[3] === "NHS blood pressure check" &&
      bpQueries[4] === "blood pressure check near me",
    bpQueries.join(" | "),
  );

  record(
    "02-no-barnsley-in-demand-queries",
    !bpQueries.some((q) => /barnsley/i.test(q)) &&
      bpSpecs.every((s) => s.localityIncluded === false),
    "ok",
  );

  const organic = buildCompetitorAnalysisOrganicQueries(YORKSHIRE);
  const organicHasBarnsley = organic.queries.some((q) => /barnsley/i.test(q));
  const organicScoped = organic.queries.map((q) => describeLocalOrganicVisibilityQuery(q));
  record(
    "03-local-serp-still-contains-barnsley",
    organicHasBarnsley &&
      organicScoped.every((s) => s.queryScope === "local-organic-visibility") &&
      organicScoped.every((s) => s.evidencePurpose === "organic-ranking"),
    organic.queries.slice(0, 3).join(" | "),
  );

  const pfSpecs = buildServiceSearchDemandQuerySpecs({ serviceId: "pharmacy-first" });
  record(
    "04-pharmacy-first-specific-demand-phrases",
    pfSpecs.every((s) => /pharmacy first/i.test(s.query)) &&
      !pfSpecs.some((s) => /blood pressure/i.test(s.query)),
    pfSpecs.map((s) => s.query).join(" | "),
  );

  const confirmed = readConfirmedServiceIds(YORKSHIRE);
  record(
    "05-all-14-confirmed-services-have-demand-phrases",
    confirmed.length === 14 &&
      EXPECTED_YORKSHIRE_SERVICES.every((id) => confirmed.includes(id)) &&
      confirmed.every((id) => buildServiceSearchDemandQuerySpecs({ serviceId: id }).length >= 3),
    String(confirmed.length),
  );

  let crossLeak = false;
  const { resolveConsumerDemandLanguage } = await import("../src/pharmacy/serviceSearchDemandMetadata.ts");
  for (const serviceId of confirmed) {
    const specs = buildServiceSearchDemandQuerySpecs({ serviceId });
    for (const otherId of confirmed) {
      if (otherId === serviceId) continue;
      const otherCanon = resolveConsumerDemandLanguage(otherId)?.canonicalConsumerPhrase || "";
      if (
        otherCanon.length > 8 &&
        specs.some((s) => s.query.toLowerCase().includes(otherCanon.toLowerCase()))
      ) {
        crossLeak = true;
      }
    }
  }
  record("06-no-cross-service-query-leakage", !crossLeak, crossLeak ? "leak detected" : "ok");

  record(
    "07-detected-unselected-excluded",
    !confirmed.includes("travel-vaccinations"),
    confirmed.join(","),
  );

  record(
    "08-generic-vaccinations-excluded",
    !confirmed.includes("vaccinations"),
    confirmed.join(","),
  );

  const nhsIds = confirmed.filter((id) =>
    buildServiceSearchDemandQuerySpecs({ serviceId: id, slug: YORKSHIRE }).some(
      (s) => s.queryType === "nhs",
    ),
  );
  const privateNoNhs = [
    "health-checks",
    "independent-prescriber",
    "weight-management",
    "malaria-prevention",
    "medication-reviews",
    "minor-ailments",
  ].every(
    (id) =>
      !buildServiceSearchDemandQuerySpecs({ serviceId: id, slug: YORKSHIRE }).some(
        (s) => s.queryType === "nhs",
      ),
  );
  record(
    "09-nhs-prefix-only-with-explicit-eligibility",
    privateNoNhs && nhsIds.length === 8,
    `${nhsIds.length} NHS-eligible services`,
  );

  record(
    "10-private-unknown-no-nhs-queries",
    privateNoNhs,
    "health-checks,independent-prescriber,weight-management,malaria-prevention,medication-reviews,minor-ailments",
  );

  record(
    "11-max-five-queries-per-service",
    confirmed.every(
      (id) =>
        buildServiceSearchDemandQuerySpecs({ serviceId: id }).length <=
        SERVICE_SEARCH_DEMAND_MAX_QUERIES_PER_SERVICE,
    ),
    "ok",
  );

  record(
    "12-query-scope-and-purpose-explicit",
    bpSpecs.every(
      (s) =>
        s.queryScope === "national-service-demand" &&
        s.evidencePurpose === "search-demand" &&
        Boolean(s.queryType),
    ),
    bpSpecs.map((s) => s.queryType).join(","),
  );

  const demandArtifact = path.join(
    ROOT,
    "data/growth-engine",
    `${YORKSHIRE}-service-search-demand.json`,
  );
  if (beforeHashes.has(demandArtifact)) {
    const after = createHash("sha256").update(fs.readFileSync(demandArtifact)).digest("hex");
    record(
      "13-yorkshire-demand-artifact-byte-unchanged",
      after === beforeHashes.get(demandArtifact),
      after.slice(0, 12),
    );
  } else {
    record("13-yorkshire-demand-artifact-byte-unchanged", true, "no prior artifact hash");
  }

  let protectedOk = true;
  for (const file of PROTECTED_HASH_PATHS) {
    if (!beforeHashes.has(file)) continue;
    const after = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    if (after !== beforeHashes.get(file)) {
      protectedOk = false;
      record("14-15-protected-artifacts-unchanged", false, path.relative(ROOT, file));
    }
  }
  if (protectedOk) {
    record("14-15-protected-artifacts-unchanged", true, `${PROTECTED_HASH_PATHS.length} files`);
  }

  record("16-no-external-api-calls", fetchCalls.length === 0, fetchCalls.join(",") || "none");

  console.log("\n=== DEMAND QUERY TABLE (14 confirmed services) ===\n");
  for (const serviceId of EXPECTED_YORKSHIRE_SERVICES) {
    const specs = buildServiceSearchDemandQuerySpecs({ serviceId });
    console.log(`## ${serviceId}`);
    for (const spec of specs) {
      console.log(`  - [${spec.queryType}] ${spec.query}`);
    }
    console.log("");
  }

  console.log("\n=== DEMAND vs LOCAL SERP SEPARATION (blood-pressure-checks) ===");
  console.log("Demand (national-service-demand / search-demand):");
  for (const s of bpSpecs) console.log(`  ${s.query}`);
  console.log("Local SERP sample (local-organic-visibility / organic-ranking):");
  for (const q of organic.queries.filter((q) => /blood pressure/i.test(q)).slice(0, 5)) {
    const meta = describeLocalOrganicVisibilityQuery(q, "blood-pressure-checks");
    console.log(`  [${meta.queryScope}/${meta.evidencePurpose}] ${meta.query}`);
  }

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
