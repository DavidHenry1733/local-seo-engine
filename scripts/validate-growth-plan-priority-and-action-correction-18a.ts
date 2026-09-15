/**
 * GROWTH-PLAN-PRIORITY-AND-ACTION-CORRECTION-18A validation.
 * Stored evidence and fixtures only — no external API calls.
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
const EXPECTED_TOP_FIVE = [
  "pharmacy-first",
  "blood-pressure-checks",
  "flu-vaccinations",
  "repeat-prescriptions",
  "health-checks",
];

const PROTECTED = [
  `data/growth-engine/${YORKSHIRE}-service-search-demand.json`,
  `data/national-growth-engine/${YORKSHIRE}-competitor-discovery.json`,
  `data/growth-engine/${YORKSHIRE}-competitors.json`,
  `data/pharmacy-content-packages/${YORKSHIRE}/blood-pressure-checks.json`,
  `data/pharmacy-content-packages/${YORKSHIRE}/pharmacy-first.json`,
];

const beforeHashes = new Map<string, string>();
for (const rel of PROTECTED) {
  const file = path.join(ROOT, rel);
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
  console.log("\n=== GROWTH-PLAN-PRIORITY-AND-ACTION-CORRECTION-18A ===\n");

  const {
    buildPharmacyWideServiceOpportunityAssessment,
    compareServicePriority,
    buildServicePriorityComparisonFields,
  } = await import("../src/pharmacy/growthEngineServiceOpportunityEvidence.ts");
  const { buildGrowthOpportunityReport, saveGrowthOpportunityReport } = await import(
    "../src/pharmacy/growthEngineOpportunityEngine.ts"
  );
  const { buildCommercialIntelligenceDashboard } = await import(
    "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"
  );
  const { loadCompetitorSnapshot } = await import("../src/pharmacy/growthEngineLocalMarketService.ts");

  const giPath = path.join(ROOT, `data/growth-engine/${YORKSHIRE}-opportunities.json`);
  const giBeforeHash = fs.existsSync(giPath)
    ? createHash("sha256").update(fs.readFileSync(giPath)).digest("hex")
    : null;

  const assessment = buildPharmacyWideServiceOpportunityAssessment(YORKSHIRE);
  const report = buildGrowthOpportunityReport(YORKSHIRE, loadCompetitorSnapshot(YORKSHIRE));

  record("01-exactly-14-confirmed-services", assessment.confirmedServiceCount === 14, String(assessment.confirmedServiceCount));
  record(
    "02-generic-vaccinations-absent",
    !assessment.services.some((s) => s.serviceId === "vaccinations"),
    "ok",
  );

  const sorted = [...assessment.services].sort((a, b) =>
    compareServicePriority(a.priorityComparisonFields, b.priorityComparisonFields),
  );
  const orderMatches = sorted.every((row, index) => row.serviceId === assessment.services[index]?.serviceId);
  record("03-deterministic-comparator-order", orderMatches, sorted.map((s) => s.serviceId).join(","));

  const topIds = assessment.topPriorityServices.map((s) => s.serviceId);
  record(
    "04-top-five-order",
    JSON.stringify(topIds) === JSON.stringify(EXPECTED_TOP_FIVE),
    topIds.join(" > "),
  );

  const pf = assessment.services.find((s) => s.serviceId === "pharmacy-first");
  const bp = assessment.services.find((s) => s.serviceId === "blood-pressure-checks");
  record(
    "05-pharmacy-first-above-bp-on-demand",
    pf?.priorityRank === 1 && bp?.priorityRank === 2,
    `pf=${pf?.priorityRank} bp=${bp?.priorityRank}`,
  );
  record(
    "06-pf-bp-real-package-state",
    pf?.workflowAction === "complete-generated-package" &&
      bp?.workflowAction === "complete-generated-package" &&
      pf?.packageStatus.includes("required assets still incomplete") &&
      bp?.packageStatus.includes("required assets still incomplete"),
    `pf=${pf?.workflowAction} bp=${bp?.workflowAction}`,
  );
  record(
    "07-no-generate-when-package-exists",
    !assessment.services.some(
      (s) => s.generatedContentCoverage.packageGenerated && s.workflowAction === "build-dedicated-content",
    ),
    "ok",
  );

  const weight = assessment.services.find((s) => s.serviceId === "weight-management");
  record(
    "08-adequate-page-gets-improve-existing-page",
    weight?.workflowAction === "improve-existing-page",
    weight?.workflowAction || "missing",
  );

  record(
    "09-unknown-organic-stays-unavailable",
    assessment.services.some((s) => s.organicVisibility.classification === "unavailable"),
    String(assessment.services.filter((s) => s.organicVisibility.classification === "unavailable").length),
  );

  record(
    "10-comparison-fields-present",
    assessment.services.every(
      (s) =>
        s.priorityComparisonFields.websiteCoverageRank >= 0 &&
        s.priorityComparisonFields.organicVisibilityRank >= 0 &&
        typeof s.priorityComparisonFields.serviceId === "string",
    ),
    "all rows",
  );

  record(
    "11-no-hidden-priority-score",
    !("priorityScore" in (assessment.services[0] || {})),
    "ok",
  );

  const bpDemand = bp?.demand;
  record(
    "12-demand-not-summed",
    Boolean(
      bpDemand &&
        bpDemand.canonicalQueryVolume === 9900 &&
        bpDemand.highestQueryVolume === 9900 &&
        bpDemand.pharmacyIntentVolume === 260,
    ),
    bpDemand ? `peak=${bpDemand.highestQueryVolume}` : "missing",
  );

  let protectedOk = true;
  for (const [file, hash] of beforeHashes) {
    const after = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    if (after !== hash) {
      protectedOk = false;
      record("13-protected-artifacts-unchanged", false, path.relative(ROOT, file));
    }
  }
  if (protectedOk) record("13-protected-artifacts-unchanged", true, `${beforeHashes.size} files`);

  saveGrowthOpportunityReport(report);
  record("14-gi-artifact-regenerated-only", fs.existsSync(giPath), giPath);

  const dashboard = buildCommercialIntelligenceDashboard(YORKSHIRE);
  record(
    "15-dashboard-has-assessment",
    dashboard.growthIntelligence.serviceOpportunityAssessment?.services.length === 14,
    String(dashboard.growthIntelligence.serviceOpportunityAssessment?.services.length),
  );

  record("16-no-external-calls", fetchCalls.length === 0, "none");

  const giAfterHash = createHash("sha256").update(fs.readFileSync(giPath)).digest("hex");
  record("17-gi-hash-changed", giAfterHash !== giBeforeHash, giAfterHash.slice(0, 12));

  const comparatorSelfTest = compareServicePriority(
    buildServicePriorityComparisonFields({
      serviceId: "a",
      websiteCoverage: { classification: "weak-existing-evidence" } as never,
      organicVisibility: { classification: "not-visible-in-collected-results" } as never,
      demand: { highestQueryVolume: 100, pharmacyIntentVolume: 10, nearMeVolume: 5 } as never,
    }),
    buildServicePriorityComparisonFields({
      serviceId: "b",
      websiteCoverage: { classification: "weak-existing-evidence" } as never,
      organicVisibility: { classification: "unavailable" } as never,
      demand: { highestQueryVolume: 99999, pharmacyIntentVolume: 99999, nearMeVolume: 99999 } as never,
    }),
  );
  record("18-not-visible-ranks-before-unavailable", comparatorSelfTest < 0, String(comparatorSelfTest));

  const passed = steps.filter((s) => s.passed).length;
  const failed = steps.filter((s) => !s.passed).length;
  console.log(`\n${failed ? "FAIL" : "PASS"} — ${passed}/${steps.length} checks\n`);
  console.log("GI hash before:", giBeforeHash || "none");
  console.log("GI hash after:", giAfterHash);
  console.log("\nTop five:", topIds.join(", "));
  console.log("\nAll 14 workflow actions:");
  for (const row of assessment.services) {
    console.log(`  ${row.priorityRank}. ${row.serviceId}: ${row.workflowAction} — ${row.packageStatus}`);
  }

  globalThis.fetch = originalFetch;
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  globalThis.fetch = originalFetch;
  console.error(err);
  process.exit(1);
});
