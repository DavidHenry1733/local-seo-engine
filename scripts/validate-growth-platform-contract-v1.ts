import fs from "node:fs";
import path from "node:path";

import * as commercialMarketContextService from "../src/pharmacy/commercialMarketContextService.ts";
import type { GrowthPlatform } from "../src/pharmacy/commercialMarketContextService.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const { buildGrowthPlatformContract } = exported(commercialMarketContextService);

let passed = 0;
let failed = 0;

function check(id: string, ok: boolean, detail: string) {
  if (ok) {
    passed++;
    console.log(`PASS  ${id} — ${detail}`);
  } else {
    failed++;
    console.log(`FAIL  ${id} — ${detail}`);
  }
}

console.log("\n=== GROWTH PLATFORM CONTRACT V1 ===\n");

const projectPath = path.join(
  process.cwd(),
  "config",
  "projects",
  "pharmaconnect.json",
);

const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));

const configuredPlatform = project.growthPlatform as GrowthPlatform | undefined;

check(
  "pharmaconnect-explicit-platform",
  configuredPlatform === "national",
  String(configuredPlatform),
);

const national = buildGrowthPlatformContract(configuredPlatform || "local");

check(
  "national-platform",
  national.platform === "national",
  national.platform,
);

check(
  "national-engine-applicable",
  national.nationalEngineApplicable === true,
  String(national.nationalEngineApplicable),
);

check(
  "local-engine-not-applicable",
  national.localEngineApplicable === false,
  String(national.localEngineApplicable),
);

check(
  "google-places-local-not-applicable",
  national.googlePlacesCompetitorDiscoveryApplicable === false,
  String(national.googlePlacesCompetitorDiscoveryApplicable),
);

check(
  "local-market-not-applicable",
  national.localMarketIntelligenceApplicable === false,
  String(national.localMarketIntelligenceApplicable),
);

check(
  "healthcare-not-applicable",
  national.healthcareIntelligenceApplicable === false,
  String(national.healthcareIntelligenceApplicable),
);

check(
  "national-competitor-applicable",
  national.nationalCompetitorDiscoveryApplicable === true,
  String(national.nationalCompetitorDiscoveryApplicable),
);

check(
  "national-website-applicable",
  national.nationalWebsiteIntelligenceApplicable === true,
  String(national.nationalWebsiteIntelligenceApplicable),
);

check(
  "national-search-applicable",
  national.nationalSearchIntelligenceApplicable === true,
  String(national.nationalSearchIntelligenceApplicable),
);

/*
 * Synthetic community pharmacy.
 *
 * This proves the existing local product contract remains independently
 * available and has not been converted into the national model.
 */
const local = buildGrowthPlatformContract("local");

check(
  "local-platform",
  local.platform === "local",
  local.platform,
);

check(
  "local-engine-applicable",
  local.localEngineApplicable === true,
  String(local.localEngineApplicable),
);

check(
  "national-engine-not-applicable",
  local.nationalEngineApplicable === false,
  String(local.nationalEngineApplicable),
);

check(
  "local-google-places-applicable",
  local.googlePlacesCompetitorDiscoveryApplicable === true,
  String(local.googlePlacesCompetitorDiscoveryApplicable),
);

check(
  "local-market-applicable",
  local.localMarketIntelligenceApplicable === true,
  String(local.localMarketIntelligenceApplicable),
);

check(
  "local-healthcare-applicable",
  local.healthcareIntelligenceApplicable === true,
  String(local.healthcareIntelligenceApplicable),
);

check(
  "local-national-competitor-not-applicable",
  local.nationalCompetitorDiscoveryApplicable === false,
  String(local.nationalCompetitorDiscoveryApplicable),
);

check(
  "local-national-search-not-applicable",
  local.nationalSearchIntelligenceApplicable === false,
  String(local.nationalSearchIntelligenceApplicable),
);

console.log(`\n${failed ? "FAIL" : "PASS"} — ${passed}/${passed + failed} checks\n`);

if (failed) process.exit(1);
