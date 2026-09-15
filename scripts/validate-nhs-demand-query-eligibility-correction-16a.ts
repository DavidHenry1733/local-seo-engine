/**
 * NHS-DEMAND-QUERY-ELIGIBILITY-CORRECTION-16A validation.
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
const EXPECTED_NHS_SHARED = [
  "blood-pressure-checks",
  "discharge-medicines-service",
  "flu-vaccinations",
  "new-medicine-service",
  "pharmacy-first",
  "prescription-dispensing",
  "repeat-prescriptions",
  "smoking-cessation",
];
const NO_NHS_WITHOUT_EVIDENCE = [
  "health-checks",
  "independent-prescriber",
  "malaria-prevention",
  "medication-reviews",
  "minor-ailments",
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
  console.log("\n=== NHS-DEMAND-QUERY-ELIGIBILITY-CORRECTION-16A ===\n");

  const { buildServiceSearchDemandQuerySpecs } = await import(
    "../src/pharmacy/serviceSearchDemandQueryBuilder.ts"
  );
  const { readConfirmedServiceIds } = await import("../src/pharmacy/serviceSearchDemandService.ts");
  const { listNationallyCommissionedNhsCommunityPharmacyServiceIds } = await import(
    "../src/pharmacy/serviceSearchDemandNhsEligibility.ts"
  );
  const { SERVICE_SEARCH_DEMAND_MAX_QUERIES_PER_SERVICE } = await import(
    "../src/pharmacy/serviceSearchDemandModel.ts"
  );

  const malariaSpecs = buildServiceSearchDemandQuerySpecs({ serviceId: "malaria-prevention" });
  record(
    "01-malaria-prevention-no-nhs-query",
    !malariaSpecs.some((s) => s.queryType === "nhs"),
    malariaSpecs.map((s) => s.query).join(" | "),
  );

  const ipSpecs = buildServiceSearchDemandQuerySpecs({ serviceId: "independent-prescriber" });
  record(
    "02-independent-prescriber-no-nhs-without-funding",
    !ipSpecs.some((s) => s.queryType === "nhs"),
    String(ipSpecs.length),
  );

  const wmSpecs = buildServiceSearchDemandQuerySpecs({ serviceId: "weight-management" });
  record(
    "03-weight-management-no-nhs-without-funding",
    !wmSpecs.some((s) => s.queryType === "nhs"),
    String(wmSpecs.length),
  );

  record(
    "04-private-unknown-no-nhs-queries",
    NO_NHS_WITHOUT_EVIDENCE.every(
      (id) => !buildServiceSearchDemandQuerySpecs({ serviceId: id }).some((s) => s.queryType === "nhs"),
    ),
    NO_NHS_WITHOUT_EVIDENCE.join(","),
  );

  record(
    "05-nationally-commissioned-retain-nhs-queries",
    EXPECTED_NHS_SHARED.every((id) => {
      const specs = buildServiceSearchDemandQuerySpecs({ serviceId: id });
      const nhs = specs.find((s) => s.queryType === "nhs");
      return Boolean(nhs && nhs.nhsEligibilitySource?.kind === "shared-catalogue");
    }),
    EXPECTED_NHS_SHARED.join(","),
  );

  const confirmed = readConfirmedServiceIds(YORKSHIRE);
  const nhsCount = confirmed.filter((id) =>
    buildServiceSearchDemandQuerySpecs({ serviceId: id, slug: YORKSHIRE }).some((s) => s.queryType === "nhs"),
  ).length;
  record(
    "06-yorkshire-eight-nhs-queries-from-shared-catalogue",
    nhsCount === EXPECTED_NHS_SHARED.length,
    String(nhsCount),
  );

  record(
    "07-max-five-queries-per-service",
    confirmed.every(
      (id) =>
        buildServiceSearchDemandQuerySpecs({ serviceId: id, slug: YORKSHIRE }).length <=
        SERVICE_SEARCH_DEMAND_MAX_QUERIES_PER_SERVICE,
    ),
    "ok",
  );

  const fourQueryServices = confirmed.filter(
    (id) => buildServiceSearchDemandQuerySpecs({ serviceId: id, slug: YORKSHIRE }).length === 4,
  );
  record(
    "08-fewer-than-five-valid",
    fourQueryServices.length === NO_NHS_WITHOUT_EVIDENCE.length,
    fourQueryServices.join(","),
  );

  const bpTwice = buildServiceSearchDemandQuerySpecs({ serviceId: "blood-pressure-checks" });
  const bpAgain = buildServiceSearchDemandQuerySpecs({ serviceId: "blood-pressure-checks" });
  record(
    "09-deterministic-order-and-dedup",
    JSON.stringify(bpTwice) === JSON.stringify(bpAgain) && bpTwice.length === 5,
    String(bpTwice.length),
  );

  const eligibilityModule = fs.readFileSync(
    path.join(ROOT, "src/pharmacy/serviceSearchDemandNhsEligibility.ts"),
    "utf8",
  );
  record(
    "10-no-yorkshire-specific-production-conditions",
    !/yorkshire/i.test(eligibilityModule),
    "ok",
  );

  const demandArtifact = path.join(
    ROOT,
    "data/growth-engine",
    `${YORKSHIRE}-service-search-demand.json`,
  );
  if (beforeHashes.has(demandArtifact)) {
    const after = createHash("sha256").update(fs.readFileSync(demandArtifact)).digest("hex");
    record(
      "11-yorkshire-demand-artifact-unchanged",
      after === beforeHashes.get(demandArtifact),
      after.slice(0, 12),
    );
  }

  let protectedOk = true;
  for (const file of PROTECTED_HASH_PATHS) {
    if (!beforeHashes.has(file)) continue;
    const after = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    if (after !== beforeHashes.get(file)) {
      protectedOk = false;
      record("12-protected-artifacts-unchanged", false, path.relative(ROOT, file));
    }
  }
  if (protectedOk) {
    record("12-protected-artifacts-unchanged", true, `${PROTECTED_HASH_PATHS.length} files`);
  }

  record("13-no-external-api-calls", fetchCalls.length === 0, "none");

  record(
    "14-shared-catalogue-list-stable",
    listNationallyCommissionedNhsCommunityPharmacyServiceIds().join(",") ===
      [...EXPECTED_NHS_SHARED].sort().join(","),
    listNationallyCommissionedNhsCommunityPharmacyServiceIds().join(","),
  );

  console.log("\n=== DEMAND QUERY TABLE (14 confirmed services, Yorkshire slug) ===\n");
  for (const serviceId of confirmed.sort()) {
    const specs = buildServiceSearchDemandQuerySpecs({ serviceId, slug: YORKSHIRE });
    console.log(`--- ${serviceId}`);
    for (const s of specs) {
      const nhsMeta =
        s.queryType === "nhs" && s.nhsEligibilitySource
          ? ` nhsSource=${s.nhsEligibilitySource.kind}:${s.nhsEligibilitySource.field}`
          : "";
      console.log(`  ${s.query} [${s.queryType}]${nhsMeta}`);
    }
  }

  const passed = steps.filter((s) => s.passed).length;
  const failed = steps.filter((s) => !s.passed).length;
  console.log(`\n${failed ? "FAIL" : "PASS"} — ${passed}/${steps.length} checks\n`);
  globalThis.fetch = originalFetch;
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  globalThis.fetch = originalFetch;
  console.error(err);
  process.exit(1);
});
