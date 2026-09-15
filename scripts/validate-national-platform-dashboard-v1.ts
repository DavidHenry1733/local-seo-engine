import { buildNationalGrowthPlatformDashboard } from "../src/pharmacy/nationalGrowthPlatformDashboardService.ts";
import { resolveGrowthPlatform } from "../src/pharmacy/growthPlatformResolverService.ts";

let failed = 0;
let checks = 0;

function check(id: string, pass: boolean, detail: unknown) {
  checks++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${String(detail)}`);
  if (!pass) failed++;
}

console.log("\n=== NC-02.5 NATIONAL PLATFORM DASHBOARD V1 ===\n");

const slug = "pharmaconnect";
const platform = resolveGrowthPlatform(slug);
const d = buildNationalGrowthPlatformDashboard(slug);

check("platform-national", platform.platform === "national", platform.platform);
check("dashboard-national", d.platform === "national", d.platform);
check("market-uk", d.market === "United Kingdom", d.market);
check(
  "target-pharmacies",
  /community pharmacies/i.test(d.targetCustomer),
  d.targetCustomer,
);
check(
  "local-market-na",
  d.localMarketIntelligence === "Not Applicable",
  d.localMarketIntelligence,
);
check(
  "google-places-na",
  d.googlePlacesCompetitorDiscovery === "Not Applicable",
  d.googlePlacesCompetitorDiscovery,
);
check(
  "healthcare-na",
  d.healthcareIntelligence === "Not Applicable",
  d.healthcareIntelligence,
);

const byId = Object.fromEntries(d.steps.map((s) => [s.id, s]));

check(
  "classification-complete",
  byId.platform_classification?.status === "complete",
  byId.platform_classification?.status,
);
check(
  "runtime-separation-complete",
  byId.runtime_separation?.status === "complete",
  byId.runtime_separation?.status,
);
check(
  "workflow-protection-complete",
  byId.workflow_protection?.status === "complete",
  byId.workflow_protection?.status,
);
check(
  "national-contract-complete",
  byId.national_competitor_contract?.status === "complete",
  byId.national_competitor_contract?.status,
);
check(
  "discovery-engine-complete",
  byId.national_discovery_engine?.status === "complete",
  byId.national_discovery_engine?.status,
);
check(
  "next-action-national-discovery",
  d.nextAction.id === "run_national_competitor_discovery",
  d.nextAction.id,
);

console.log(`\n${failed ? "FAIL" : "PASS"} — ${checks - failed}/${checks} checks\n`);
process.exit(failed ? 1 : 0);
