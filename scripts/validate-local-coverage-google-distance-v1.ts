#!/usr/bin/env npx tsx
/**
 * LOCAL-COVERAGE-GOOGLE-DISTANCE-FIX-01
 * Isolated geographic recommendation checks. Google Places calls are stubbed.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sourceChecks() {
  const geo = read("src/pharmacy/masterAdminLocalCoverageGeoService.ts");
  const rec = read("src/pharmacy/masterAdminLocalCoverageRecommendationService.ts");
  const setup = read("src/pharmacy/masterAdminGenerationSetupService.ts");
  const onboarding = read("src/pharmacy/masterAdminOnboardingAreaDiscoveryService.ts");
  const page = read("artifacts/api-server/src/routes/masterAdminPlatformPage.ts");
  const production = [geo, rec, setup, onboarding, page].join("\n");

  record(
    "shared-haversine",
    geo.includes("export function haversineKm") && rec.includes("haversineKm(pharmacy, locality)"),
    "Shared service calculates haversine from pharmacy and locality coordinates",
  );
  record(
    "no-index-distance",
    !rec.includes("idx + 1") && !setup.includes("distanceKm: idx + 1") && !setup.includes("Approx. ${profile.distanceKm}"),
    "Recommendation engine does not use list index as distance",
  );
  record(
    "unavailable-label",
    geo.includes('DISTANCE_UNAVAILABLE_LABEL = "Distance unavailable"') &&
      page.includes("Distance unavailable"),
    "Missing coordinates display Distance unavailable",
  );
  record(
    "no-dataforseo-geo",
    !/dataforseo\.com|DATAFORSEO_/i.test(geo) && !/dataforseo\.com|DATAFORSEO_/i.test(rec),
    "Local coverage geography does not call DataForSEO",
  );
  record(
    "no-yorkshire-production",
    !/yorkshire-pharmacy-and-health-clinic|Yorkshire Pharmacy|Darfield|Penistone|Worsbrough|Royston/i.test(production),
    "No Yorkshire tenant or area names in production local-coverage code",
  );
}

async function fixtures() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "local-coverage-geo-"));
  fs.mkdirSync(path.join(tmp, "data/pharmacy-profiles"), { recursive: true });
  const pharmacyConfig = path.join(ROOT, "config/pharmacy");
  if (fs.existsSync(pharmacyConfig)) {
    fs.cpSync(pharmacyConfig, path.join(tmp, "config/pharmacy"), { recursive: true });
  }
  const areasDir = path.join(ROOT, "config/areas");
  if (fs.existsSync(areasDir)) {
    fs.cpSync(areasDir, path.join(tmp, "config/areas"), { recursive: true });
  }
  process.env.WORKSPACE_ROOT = tmp;
  process.env.DATAFORSEO_CALLS = "0";
  process.env.GOOGLE_PLACES_API_KEY = "";

  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (..._args: unknown[]) => {
    fetchCalls += 1;
    throw new Error("Google Places must be stubbed during validation");
  }) as typeof fetch;

  const {
    haversineKm,
    parseLocalityFromFormattedAddress,
    setLocalCoverageGoogleClientForTests,
    resetLocalCoverageGeoCacheForTests,
    roundDistanceKm,
  } = await import("../src/pharmacy/masterAdminLocalCoverageGeoService.ts");
  const { writeSetupProfile } = await import("../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts");
  const { buildLocalCoverageRecommendations } = await import(
    "../src/pharmacy/masterAdminLocalCoverageRecommendationService.ts"
  );
  const { buildLocalAreaRecommendations, saveGenerationSetupLocalAreas } = await import(
    "../src/pharmacy/masterAdminGenerationSetupService.ts"
  );

  const pharmacyPoint = { latitude: 53.5336, longitude: -1.3815 };
  const stubPlaces: Record<string, { latitude: number; longitude: number; placeId: string }> = {
    darfield: { latitude: 53.5336, longitude: -1.3815, placeId: "ChIJ-stub-darfield" },
    worsbrough: { latitude: 53.517, longitude: -1.473, placeId: "ChIJ-stub-worsbrough" },
    penistone: { latitude: 53.5256, longitude: -1.6297, placeId: "ChIJ-stub-penistone" },
    royston: { latitude: 53.598, longitude: -1.45, placeId: "ChIJ-stub-royston" },
    wombwell: { latitude: 53.5215, longitude: -1.4002, placeId: "ChIJ-stub-wombwell" },
  };

  const stubClient = {
    geocodeLocality(query: string) {
      const hit = stubPlaces[query.trim().toLowerCase()];
      if (!hit) return null;
      return {
        areaName: query.trim(),
        latitude: hit.latitude,
        longitude: hit.longitude,
        placeId: hit.placeId,
        formattedAddress: `${query.trim()}, South Yorkshire`,
        source: "test-stub" as const,
      };
    },
    discoverNearbyLocalities() {
      return ["Penistone", "Royston", "Worsbrough"].map((name) => {
        const hit = stubPlaces[name.toLowerCase()]!;
        return {
          areaName: name,
          latitude: hit.latitude,
          longitude: hit.longitude,
          placeId: hit.placeId,
          formattedAddress: `${name}, South Yorkshire`,
          source: "test-stub" as const,
        };
      });
    },
  };
  setLocalCoverageGoogleClientForTests(stubClient);
  resetLocalCoverageGeoCacheForTests();

  const londonParis = roundDistanceKm(haversineKm({ latitude: 51.5074, longitude: -0.1278 }, { latitude: 48.8566, longitude: 2.3522 }));
  record("haversine-real-distance", londonParis > 330 && londonParis < 350, `London–Paris ${londonParis} km`);

  const parsed = parseLocalityFromFormattedAddress("91 Snape Hill Road, Darfield, Barnsley, S73 9LR");
  record("address-locality-parse", parsed === "Darfield", String(parsed));

  function baseProfile(name: string, overrides: Record<string, unknown>) {
    return {
      pharmacyName: name,
      website: "https://example-pharmacy.test",
      googlePlaceId: "ChIJConfirmedPlace",
      googleProfileOnboardingState: "configured",
      marketScope: "local_regional",
      primaryTown: "Barnsley",
      townCity: "Barnsley",
      postcode: "S73 9LR",
      displayAddress: "91 Snape Hill Road, Darfield, Barnsley, S73 9LR",
      selectedAreas: [],
      googleImportSnapshot: {
        status: "imported",
        importedAt: "2026-08-19T11:00:00.000Z",
        message: "Google Profile imported",
        googleBusinessUrl: "https://maps.google.com/?cid=example",
        searchPharmacyName: name,
        searchTown: "Darfield",
        searchPostcode: "S73 9LR",
        placeId: "ChIJConfirmedPlace",
        businessName: name,
        address: "91 Snape Hill Road, Darfield, Barnsley S73 9LR, UK",
        town: "Darfield",
        postcode: "S73 9LR",
        phone: "",
        website: "https://example-pharmacy.test",
        rating: 4.8,
        reviewCount: 12,
        photoCount: 0,
        categories: ["pharmacy"],
        openingHours: [],
        googleMapsUrl: "https://maps.google.com/?cid=example",
        latitude: pharmacyPoint.latitude,
        longitude: pharmacyPoint.longitude,
        candidates: [],
        nationalWebsiteDetected: false,
      },
      ...overrides,
    };
  }

  const yorkshireSlug = "yorkshire-pharmacy-and-health-clinic";
  writeSetupProfile(
    yorkshireSlug,
    baseProfile("Yorkshire Pharmacy and Health Clinic", {}) as never,
  );
  const yorkshire = buildLocalCoverageRecommendations(yorkshireSlug);
  const darfield = yorkshire.areas.find((a) => a.areaName.toLowerCase() === "darfield");
  const penistone = yorkshire.areas.find((a) => a.areaName.toLowerCase() === "penistone");
  const namesInOrder = yorkshire.areas.filter((a) => a.distanceKm != null).map((a) => a.areaName);
  const expectedPenistoneKm = roundDistanceKm(
    haversineKm(pharmacyPoint, { latitude: 53.5256, longitude: -1.6297 }),
  );

  record(
    "darfield-from-google-evidence",
    Boolean(darfield?.branchLocality && darfield.recommended && darfield.distanceKm === 0),
    `present=${Boolean(darfield)} km=${String(darfield?.distanceKm)} recommended=${String(darfield?.recommended)}`,
  );
  record(
    "penistone-not-approx-2km",
    Boolean(penistone && penistone.distanceKm != null && Math.abs(penistone.distanceKm - 2) > 5 && Math.abs(penistone.distanceKm - expectedPenistoneKm) < 0.2),
    `km=${String(penistone?.distanceKm)} expected=${expectedPenistoneKm}`,
  );
  record(
    "order-not-distance",
    namesInOrder[0]?.toLowerCase() === "darfield" &&
      (penistone?.distanceKm || 0) > 10 &&
      namesInOrder.indexOf("Penistone") > namesInOrder.indexOf("Worsbrough"),
    namesInOrder.join(" → "),
  );
  record(
    "provenance-stored",
    darfield?.distanceMethod === "haversine" &&
      darfield.distanceProvenance.distanceSource === "google-coordinates" &&
      darfield.distanceProvenance.pharmacy?.source === "google-import-snapshot",
    JSON.stringify(darfield?.distanceProvenance.pharmacy?.source),
  );

  const genericSlug = "generic-local-pharmacy";
  writeSetupProfile(
    genericSlug,
    baseProfile("Generic Local Pharmacy", {
      pharmacyName: "Generic Local Pharmacy",
      displayAddress: "1 High Street, Wombwell, Barnsley, S73 0AA",
      googleImportSnapshot: {
        ...(baseProfile("Generic Local Pharmacy", {}).googleImportSnapshot as object),
        address: "1 High Street, Wombwell, Barnsley S73 0AA, UK",
        town: "Wombwell",
        latitude: 53.5215,
        longitude: -1.4002,
      },
    }) as never,
  );
  const generic = buildLocalCoverageRecommendations(genericSlug);
  const wombwell = generic.areas.find((a) => a.areaName.toLowerCase() === "wombwell");
  record(
    "platform-wide-branch-locality",
    Boolean(wombwell?.branchLocality && wombwell.recommended),
    `branch=${generic.branchLocality}`,
  );

  const missingSlug = "missing-coordinates-pharmacy";
  writeSetupProfile(
    missingSlug,
    baseProfile("Missing Coordinates Pharmacy", {
      googlePlaceId: "",
      googleImportSnapshot: {
        ...(baseProfile("Missing Coordinates Pharmacy", {}).googleImportSnapshot as object),
        placeId: "",
        latitude: null,
        longitude: null,
        address: "",
        town: "Barnsley",
      },
    }) as never,
  );
  setLocalCoverageGoogleClientForTests({
    geocodeLocality: () => null,
    discoverNearbyLocalities: () => [],
  });
  resetLocalCoverageGeoCacheForTests();
  const missing = buildLocalCoverageRecommendations(missingSlug);
  record(
    "missing-coords-no-invented-distance",
    missing.areas.every((a) => a.distanceKm == null && a.distanceLabel === "Distance unavailable" && !a.recommended) &&
      Boolean(missing.evidenceLimitation),
    `areas=${missing.areas.length} limitation=${Boolean(missing.evidenceLimitation)}`,
  );

  setLocalCoverageGoogleClientForTests(stubClient);
  resetLocalCoverageGeoCacheForTests();
  const manualSlug = "manual-selection-pharmacy";
  writeSetupProfile(
    manualSlug,
    baseProfile("Manual Selection Pharmacy", {
      selectedAreas: [
        {
          areaName: "Operator Chosen Area",
          areaType: "service area",
          priority: 1,
          order: 1,
          selected: true,
          source: "manual",
          confidence: 100,
        },
      ],
    }) as never,
  );
  const beforeSave = buildLocalCoverageRecommendations(manualSlug);
  const preserved = beforeSave.areas.find((a) => a.areaName === "Operator Chosen Area");
  record(
    "manual-selection-preserved",
    Boolean(preserved?.selected && !preserved.recommended),
    `selected=${String(preserved?.selected)} recommended=${String(preserved?.recommended)}`,
  );

  writeSetupProfile(
    yorkshireSlug,
    baseProfile("Yorkshire Pharmacy and Health Clinic", {
      selectedAreas: [
        {
          areaName: "Operator Chosen Area",
          areaType: "service area",
          priority: 1,
          order: 1,
          selected: true,
          source: "manual",
          confidence: 100,
        },
      ],
    }) as never,
  );
  const rebuilt = buildLocalAreaRecommendations(yorkshireSlug);
  const stillSelected = rebuilt.areas.find((a) => a.areaName === "Operator Chosen Area");
  record(
    "existing-tenant-compatible",
    Boolean(stillSelected?.selected) && rebuilt.areas.some((a) => a.areaName.toLowerCase() === "darfield"),
    `manualSelected=${Boolean(stillSelected?.selected)} darfield=${rebuilt.areas.some((a) => a.areaName.toLowerCase() === "darfield")}`,
  );

  saveGenerationSetupLocalAreas(manualSlug, {
    primaryTown: "Barnsley",
    areas: [
      { areaName: "Operator Chosen Area", selected: true },
      { areaName: "Darfield", selected: false },
    ],
  });
  const afterUnrelatedBuild = buildLocalCoverageRecommendations(manualSlug);
  record(
    "save-is-explicit",
    afterUnrelatedBuild.areas.find((a) => a.areaName === "Operator Chosen Area")?.selected === true,
    "Explicit save keeps operator selection",
  );

  record("google-calls-stubbed", fetchCalls === 0, `fetchCalls=${fetchCalls}`);
  globalThis.fetch = originalFetch;
  setLocalCoverageGoogleClientForTests(null);
  resetLocalCoverageGeoCacheForTests();
}

async function main() {
  console.log("\n=== LOCAL-COVERAGE-GOOGLE-DISTANCE-V1 ===\n");
  sourceChecks();
  await fixtures();
  const failed = checks.filter((c) => !c.pass);
  const outDir = path.join(ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "local-coverage-google-distance-v1.json"),
    JSON.stringify({ pass: failed.length === 0, generatedAt: new Date().toISOString(), checks }, null, 2),
  );
  if (failed.length) {
    console.error(`\nFAILED ${failed.length}/${checks.length}`);
    process.exit(1);
  }
  console.log(`\nPASS ${checks.length}/${checks.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
