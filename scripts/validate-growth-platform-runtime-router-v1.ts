import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as growthPlatformResolverService from "../src/pharmacy/growthPlatformResolverService.ts";
import * as pharmacyWorkspacePaths from "../src/pharmacy/pharmacyWorkspacePaths.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const { resolveGrowthPlatform, isNationalGrowthPlatform, isLocalGrowthPlatform } = exported(growthPlatformResolverService);
const { getPharmacyProjectConfigPath } = exported(pharmacyWorkspacePaths);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

console.log("\n=== GROWTH PLATFORM RUNTIME ROUTER V1 ===\n");

const pc = resolveGrowthPlatform("pharmaconnect");

check(
  "pharmaconnect-national",
  pc.platform === "national",
  pc.platform,
);

check(
  "pharmaconnect-explicit-source",
  pc.source === "project-config-explicit",
  pc.source,
);

check(
  "pharmaconnect-national-helper",
  isNationalGrowthPlatform("pharmaconnect") === true,
  String(isNationalGrowthPlatform("pharmaconnect")),
);

check(
  "pharmaconnect-not-local",
  isLocalGrowthPlatform("pharmaconnect") === false,
  String(isLocalGrowthPlatform("pharmaconnect")),
);

check(
  "pharmaconnect-local-engine-disabled",
  pc.contract.localEngineApplicable === false,
  String(pc.contract.localEngineApplicable),
);

check(
  "pharmaconnect-google-places-disabled",
  pc.contract.googlePlacesCompetitorDiscoveryApplicable === false,
  String(pc.contract.googlePlacesCompetitorDiscoveryApplicable),
);

check(
  "pharmaconnect-local-market-disabled",
  pc.contract.localMarketIntelligenceApplicable === false,
  String(pc.contract.localMarketIntelligenceApplicable),
);

check(
  "pharmaconnect-healthcare-disabled",
  pc.contract.healthcareIntelligenceApplicable === false,
  String(pc.contract.healthcareIntelligenceApplicable),
);

check(
  "pharmaconnect-national-competitor-enabled",
  pc.contract.nationalCompetitorDiscoveryApplicable === true,
  String(pc.contract.nationalCompetitorDiscoveryApplicable),
);

/*
 * Backwards-compatibility fixture:
 * an unknown tenant with no explicit project setting remains LOCAL.
 * This protects all established local tenants from migration-by-default.
 */
const legacy = resolveGrowthPlatform("__validation_legacy_local__");

check(
  "legacy-default-local",
  legacy.platform === "local",
  legacy.platform,
);

check(
  "legacy-local-engine",
  legacy.contract.localEngineApplicable === true,
  String(legacy.contract.localEngineApplicable),
);

check(
  "legacy-national-disabled",
  legacy.contract.nationalEngineApplicable === false,
  String(legacy.contract.nationalEngineApplicable),
);

const canonicalProjectConfig = getPharmacyProjectConfigPath("pharmaconnect");
check(
  "canonical-project-config-found",
  fs.existsSync(canonicalProjectConfig) && canonicalProjectConfig.includes(`${path.sep}config${path.sep}projects${path.sep}`),
  canonicalProjectConfig,
);

const resolverSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthPlatformResolverService.ts"), "utf8");
check(
  "resolver-uses-canonical-workspace-path",
  resolverSrc.includes("getPharmacyProjectConfigPath") && !resolverSrc.includes("process.cwd()"),
  "getPharmacyProjectConfigPath",
);

const nestedCwd = path.join(ROOT, "artifacts", "api-server");
const originalCwd = process.cwd();
let nestedNationalPlatform = "";
let nestedNationalSource = "";
let nestedUnknownPlatform = "";
let nestedUnknownSource = "";
try {
  process.chdir(nestedCwd);
  const nestedNational = resolveGrowthPlatform("pharmaconnect");
  const nestedUnknown = resolveGrowthPlatform("__validation_legacy_local__");
  nestedNationalPlatform = nestedNational.platform;
  nestedNationalSource = nestedNational.source;
  nestedUnknownPlatform = nestedUnknown.platform;
  nestedUnknownSource = nestedUnknown.source;
} finally {
  process.chdir(originalCwd);
}

check(
  "cwd-not-repo-root-still-national",
  nestedNationalPlatform === "national" && nestedNationalSource === "project-config-explicit",
  `${nestedNationalPlatform}/${nestedNationalSource} cwd=${nestedCwd}`,
);

check(
  "cwd-not-repo-root-unknown-still-local",
  nestedUnknownPlatform === "local" && nestedUnknownSource === "backwards-compatible-local-default",
  `${nestedUnknownPlatform}/${nestedUnknownSource}`,
);

console.log(`\n${failed ? "FAIL" : "PASS"} — ${passed}/${passed + failed} checks\n`);

if (failed) process.exit(1);
