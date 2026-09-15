/**
 * PHARMACY-WIDE-SERVICE-OPPORTUNITY-EVIDENCE-18 validation.
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
  console.log("\n=== PHARMACY-WIDE-SERVICE-OPPORTUNITY-EVIDENCE-18 ===\n");

  const { buildGrowthOpportunityReport, saveGrowthOpportunityReport, loadGrowthOpportunityReport } =
    await import("../src/pharmacy/growthEngineOpportunityEngine.ts");
  const { buildCommercialIntelligenceDashboard } = await import(
    "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"
  );
  const { loadCompetitorSnapshot } = await import("../src/pharmacy/growthEngineLocalMarketService.ts");

  const giBeforeHash = fs.existsSync(path.join(ROOT, `data/growth-engine/${YORKSHIRE}-opportunities.json`))
    ? createHash("sha256")
        .update(fs.readFileSync(path.join(ROOT, `data/growth-engine/${YORKSHIRE}-opportunities.json`)))
        .digest("hex")
    : null;

  const report = buildGrowthOpportunityReport(YORKSHIRE, loadCompetitorSnapshot(YORKSHIRE));
  const assessment = report.serviceOpportunityAssessment;

  record("01-exactly-14-confirmed-services", assessment?.confirmedServiceCount === 14, String(assessment?.confirmedServiceCount));
  record(
    "02-generic-vaccinations-absent",
    !assessment?.services.some((s) => s.serviceId === "vaccinations"),
    "ok",
  );

  const bp = assessment?.services.find((s) => s.serviceId === "blood-pressure-checks");
  record(
    "03-no-overlapping-volume-sum",
    Boolean(
      bp &&
        bp.demand.canonicalQueryVolume === 9900 &&
        bp.demand.highestQueryVolume === 9900 &&
        bp.demand.pharmacyIntentVolume === 260,
    ),
    bp ? `canonical=${bp.demand.canonicalQueryVolume} peak=${bp.demand.highestQueryVolume}` : "missing",
  );
  record(
    "04-bp-separate-demand-fields",
    Boolean(bp && bp.demand.nearMeVolume === 1000 && bp.demand.nhsQueryVolume === 9900),
    bp ? `near-me=${bp.demand.nearMeVolume} nhs=${bp.demand.nhsQueryVolume}` : "missing",
  );

  const weight = assessment?.services.find((s) => s.serviceId === "weight-management");
  record(
    "05-dedicated-imported-page-recognised",
    weight?.websiteCoverage.classification === "adequate-existing-page",
    weight?.websiteCoverage.dedicatedImportedPageUrl || "none",
  );

  record(
    "06-weak-pages-not-adequate",
    bp?.websiteCoverage.classification === "weak-existing-evidence" &&
      assessment?.services.find((s) => s.serviceId === "pharmacy-first")?.websiteCoverage.classification ===
        "weak-existing-evidence",
    "bp+pf weak",
  );

  record(
    "07-organic-uses-canonical-domain",
    Boolean(bp && bp.organicVisibility.tenantDomainAppears === false),
    String(bp?.organicVisibility.tenantDomainAppears),
  );

  record(
    "08-organic-domains-not-local-competitors",
    Boolean(
      assessment?.evidenceLimitations.some((l) => l.includes("not verified physical competitors")),
    ),
    "limitations note present",
  );

  const googleActions = assessment?.googleProfileActions || [];
  const serviceOpps = report.opportunities.filter((o) => o.serviceId);
  record(
    "09-google-local-once-not-per-service",
    googleActions.length >= 1 &&
      !serviceOpps.some((o) => o.category === "google-reviews" || o.id.startsWith("google-")),
    `${googleActions.length} google-wide`,
  );

  record(
    "10-every-service-has-evidence-reason",
    Boolean(assessment?.services.every((s) => s.priorityRationale.length > 10 && s.recommendedAction.length > 10)),
    "ok",
  );

  record(
    "11-matrix-all-14-services",
    assessment?.services.length === 14,
    String(assessment?.services.length),
  );

  record(
    "12-top-priority-exactly-five",
    assessment?.topPriorityServices.length === 5,
    String(assessment?.topPriorityServices.length),
  );

  record(
    "13-no-repeated-content-ecosystem-list",
    !report.opportunities.some((o) => /^Generate content ecosystem for /i.test(o.title)),
    "ok",
  );

  record(
    "14-unknown-remains-unknown",
    assessment?.services.some((s) => s.organicVisibility.classification === "unavailable"),
    "organic unavailable present",
  );

  let protectedOk = true;
  for (const [file, hash] of beforeHashes) {
    const after = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    if (after !== hash) {
      protectedOk = false;
      record("15-protected-artifacts-unchanged", false, path.relative(ROOT, file));
    }
  }
  if (protectedOk) record("15-protected-artifacts-unchanged", true, `${beforeHashes.size} files`);

  saveGrowthOpportunityReport(report);
  const dashboard = buildCommercialIntelligenceDashboard(YORKSHIRE);
  record(
    "16-dashboard-has-assessment",
    Boolean(dashboard.growthIntelligence.serviceOpportunityAssessment?.services.length === 14),
    String(dashboard.growthIntelligence.serviceOpportunityAssessment?.services.length),
  );

  record("17-no-external-calls", fetchCalls.length === 0, "none");

  const giAfterHash = createHash("sha256")
    .update(fs.readFileSync(path.join(ROOT, `data/growth-engine/${YORKSHIRE}-opportunities.json`)))
    .digest("hex");
  record("18-gi-artifact-regenerated", giAfterHash !== giBeforeHash, giAfterHash.slice(0, 12));

  const passed = steps.filter((s) => s.passed).length;
  const failed = steps.filter((s) => !s.passed).length;
  console.log(`\n${failed ? "FAIL" : "PASS"} — ${passed}/${steps.length} checks\n`);
  console.log("GI hash before:", giBeforeHash?.slice(0, 16) || "none");
  console.log("GI hash after:", giAfterHash.slice(0, 16));
  globalThis.fetch = originalFetch;
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  globalThis.fetch = originalFetch;
  console.error(err);
  process.exit(1);
});
