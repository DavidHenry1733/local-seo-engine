import * as dashboardMod from "../src/pharmacy/nationalGrowthPlatformDashboardService.ts";
import * as growthPlatform from "../src/pharmacy/growthPlatformResolverService.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const { buildNationalGrowthPlatformDashboard } = exported(dashboardMod);
const { resolveGrowthPlatform } = exported(growthPlatform);

let passed = 0;
let failed = 0;

function check(id: string, ok: boolean, detail: unknown) {
  if (ok) {
    passed++;
    console.log(`PASS  ${id} — ${String(detail)}`);
  } else {
    failed++;
    console.log(`FAIL  ${id} — ${String(detail)}`);
  }
}

console.log("\n=== NC-02.5 NATIONAL GROWTH PLATFORM DASHBOARD V1 ===\n");

const slug = "pharmaconnect";
const platform = resolveGrowthPlatform(slug);
const d = buildNationalGrowthPlatformDashboard(slug);

check(
  "platform-national",
  platform.platform === "national",
  platform.platform,
);

check(
  "dashboard-platform-national",
  d.platform === "national",
  d.platform,
);

check(
  "market-uk",
  d.market === "United Kingdom",
  d.market,
);

check(
  "target-community-pharmacies",
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

const byId = Object.fromEntries(
  d.steps.map((step) => [step.id, step]),
);

check(
  "platform-classification-complete",
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
  "national-discovery-engine-complete",
  byId.national_discovery_engine?.status === "complete",
  byId.national_discovery_engine?.status,
);

check(
  "live-discovery-not-run",
  byId.live_competitor_discovery?.status === "not_run",
  byId.live_competitor_discovery?.status,
);

check(
  "next-action-national-discovery",
  d.nextAction.id === "run_national_competitor_discovery",
  d.nextAction.id,
);

console.log(
  `\n${failed ? "FAIL" : "PASS"} — ${passed}/${passed + failed} checks\n`,
);

if (failed) process.exit(1);
