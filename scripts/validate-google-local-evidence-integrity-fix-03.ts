/**
 * GOOGLE-LOCAL-EVIDENCE-INTEGRITY-FIX-03 validation.
 * Provider stubs only — no live Google Places or DataForSEO calls.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
process.chdir(ROOT);
process.env.WORKSPACE_ROOT = ROOT;
delete process.env.GOOGLE_PLACES_API_KEY;
delete process.env.DATAFORSEO_LOGIN;
delete process.env.DATAFORSEO_PASSWORD;
delete process.env.DATAFORSEO_API_LOGIN;
delete process.env.DATAFORSEO_API_PASSWORD;

const INTEL_DIR = path.join(ROOT, "data/pharmacy-competitor-intelligence");
const GROWTH_DIR = path.join(ROOT, "data/growth-engine");
const NATIONAL_DIR = path.join(ROOT, "data/national-growth-engine");
const CONTENT_DIRS = [
  INTEL_DIR,
  GROWTH_DIR,
  NATIONAL_DIR,
  path.join(ROOT, "data/pharmacy-content-packages"),
  path.join(ROOT, "data/content-packages"),
];

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
const fetchCalls: string[] = [];
const liveHosts = ["api.dataforseo.com", "places.googleapis.com", "maps.googleapis.com"];
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

function hashFile(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function existingGeneratedEvidence(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      files.push(full);
    }
  };
  for (const dir of CONTENT_DIRS) walk(dir);
  return files.sort();
}

function cleanup(files: string[]): void {
  for (const file of files) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

function writeProfile(slug: string, data: Record<string, unknown>): string {
  const dir = path.join(ROOT, "data/pharmacy-profiles");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ slug, updatedAt: "2026-08-20T09:00:00.000Z", version: 5, data }, null, 2),
  );
  return file;
}

async function main() {
  const evidenceSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/googleLocalCompetitorEvidence.ts"), "utf8");
  const intelSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyCompetitorIntelligence.ts"), "utf8");
  const dashSrc = fs.readFileSync(
    path.join(ROOT, "src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"),
    "utf8",
  );
  const metricsSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/googleLocalCompetitorMetricsService.ts"), "utf8");

  record(
    "No Yorkshire-specific production logic",
    !/yorkshire-pharmacy-and-health-clinic/i.test(evidenceSrc) &&
      !/yorkshire-pharmacy-and-health-clinic/i.test(intelSrc) &&
      !/yorkshire-pharmacy-and-health-clinic/i.test(dashSrc) &&
      !/yorkshire-pharmacy-and-health-clinic/i.test(metricsSrc),
  );
  record(
    "Production enrichment no longer defines demo reviews/hours/services or inferred categories",
    !/function demoReviews/.test(intelSrc) &&
      !/function demoOpeningHours/.test(intelSrc) &&
      !/function demoServicesForCompetitor/.test(intelSrc) &&
      !/function inferCategories/.test(intelSrc) &&
      !/demoReviews\(/.test(intelSrc) &&
      !/demoOpeningHours\(/.test(intelSrc) &&
      !/demoServicesForCompetitor\(/.test(intelSrc) &&
      !/inferCategories\(/.test(intelSrc),
  );
  record(
    "Place Details path uses places/{placeId}",
    intelSrc.includes("googlePlaceDetailsUrl") &&
      evidenceSrc.includes("`places/${id}`") &&
      evidenceSrc.includes("https://places.googleapis.com/v1") &&
      !/places\.googleapis\.com\/v1\/\$\{placeId\}/.test(intelSrc),
  );

  const {
    GOOGLE_PLACE_DETAILS_FIELD_MASK,
    googlePlaceDetailsUrl,
    googlePlaceDetailsResourceName,
    parseGooglePlaceDetails,
    evidenceBackedPhotoCount,
    sanitizeGoogleLocalCompetitorEvidence,
    isDemoOpeningHoursEvidence,
    isInferredGoogleCategorySet,
    looksLikeInferredClinicalServices,
  } = await import("../src/pharmacy/googleLocalCompetitorEvidence.ts");
  const {
    buildCompetitorIntelligence,
    fetchGooglePlaceDetails,
    enrichCompetitorFromDiscovery,
  } = await import("../src/pharmacy/pharmacyCompetitorIntelligence.ts");

  const requiredMaskFields = [
    "displayName",
    "formattedAddress",
    "location",
    "rating",
    "userRatingCount",
    "nationalPhoneNumber",
    "internationalPhoneNumber",
    "websiteUri",
    "googleMapsUri",
    "primaryType",
    "types",
    "businessStatus",
    "regularOpeningHours",
    "currentOpeningHours",
    "photos",
  ];
  record(
    "Required Place Details field mask is present",
    requiredMaskFields.every((field) => GOOGLE_PLACE_DETAILS_FIELD_MASK.split(",").includes(field)),
    GOOGLE_PLACE_DETAILS_FIELD_MASK,
  );
  record(
    "Review text is not requested as a Place Details field",
    !GOOGLE_PLACE_DETAILS_FIELD_MASK.split(",").includes("reviews"),
  );
  record(
    "Correct Place Details path for a raw place id",
    googlePlaceDetailsResourceName("ChIJ123") === "places/ChIJ123" &&
      googlePlaceDetailsUrl("ChIJ123") === "https://places.googleapis.com/v1/places/ChIJ123",
  );
  record(
    "places/ prefix is not doubled",
    googlePlaceDetailsUrl("places/ChIJ123") === "https://places.googleapis.com/v1/places/ChIJ123",
  );

  const parsed = parseGooglePlaceDetails({
    displayName: { text: "Well Pharmacy" },
    formattedAddress: "2 Snape Hill Rd",
    location: { latitude: 53.9, longitude: -1.9 },
    rating: 4.5,
    userRatingCount: 21,
    nationalPhoneNumber: "01226 754138",
    internationalPhoneNumber: "+44 1226 754138",
    websiteUri: "https://finder.well.co.uk/store/darfield-snape-hill-road",
    googleMapsUri: "https://maps.google.com/?cid=1",
    primaryType: "pharmacy",
    types: ["pharmacy", "health", "point_of_interest"],
    businessStatus: "OPERATIONAL",
    regularOpeningHours: {
      weekdayDescriptions: ["Monday: 9:00 AM – 6:30 PM", "Sunday: Closed"],
      openNow: false,
    },
    currentOpeningHours: { openNow: false },
    photos: [
      { name: "places/ChIJ-well/photos/ABC", widthPx: 1200, heightPx: 800 },
    ],
  });
  record("Real returned display name persists", parsed.displayName === "Well Pharmacy");
  record("Real returned types persist", parsed.types.includes("pharmacy") && parsed.primaryType === "pharmacy");
  record("Real returned photos persist as references", parsed.photosCaptured && parsed.photoCount === 1 && parsed.photos?.[0]?.name === "places/ChIJ-well/photos/ABC");
  record("Real returned hours persist", parsed.regularOpeningHours?.weekdayDescriptions[0] === "Monday: 9:00 AM – 6:30 PM");

  const missing = parseGooglePlaceDetails({ displayName: { text: "Stone Pharmacy" } });
  record("Missing rating stays unknown", missing.rating == null);
  record("Missing review count stays unknown, not zero", missing.userRatingCount == null);
  record("Missing photos stay unknown, not zero", missing.photoCount == null && missing.photosCaptured === false);
  record("Missing hours stay unknown", missing.regularOpeningHours == null);
  record("Missing types stay empty", missing.types.length === 0 && missing.categories.length === 0);

  const emptyPhotos = parseGooglePlaceDetails({ photos: [] });
  record(
    "Empty photos array after a successful photos field is a genuine zero",
    emptyPhotos.photosCaptured && emptyPhotos.photoCount === 0,
  );
  record(
    "Photo count zero without photo references stays unknown",
    evidenceBackedPhotoCount(0, [{ count: 0, thumbnailUrl: null }]) == null && evidenceBackedPhotoCount(0) == null,
  );
  record("Positive photo counts without a photos array remain usable", evidenceBackedPhotoCount(6) === 6);

  const discovery = {
    slug: "evidence-integrity-fixture-01",
    generatedAt: "2026-08-21T13:42:05.000Z",
    source: "google-places-live" as const,
    targetCount: 1,
    pharmacy: { name: "Fixture Pharmacy", address: "1 High Street", postcode: "S70 1AA", latitude: 53.53, longitude: -1.38 },
    competitors: [
      {
        name: "Well Pharmacy",
        address: "2 Snape Hill Rd",
        distanceKm: 0.57,
        distanceLabel: "573m",
        rating: 4.5,
        reviewCount: 21,
        website: "https://finder.well.co.uk/store/darfield",
        phone: "01226 754138",
        placeId: "ChIJ-well-live",
        latitude: 53.533781,
        longitude: -1.373875,
        source: "google-places" as const,
      },
    ],
    competitorCount: 1,
    placesError: null,
  };

  const built = await buildCompetitorIntelligence(discovery, {
    fetchPlaceDetails: async (placeId) => {
      if (placeId !== "ChIJ-well-live") throw new Error(`Unexpected place id ${placeId}`);
      return {
        displayName: { text: "Well Pharmacy" },
        formattedAddress: "2 Snape Hill Rd, Darfield",
        location: { latitude: 99, longitude: 99 },
        rating: 4.5,
        userRatingCount: 21,
        nationalPhoneNumber: "01226 754138",
        websiteUri: "https://finder.well.co.uk/store/darfield",
        googleMapsUri: "https://maps.google.com/?cid=well",
        primaryType: "pharmacy",
        types: ["pharmacy", "point_of_interest"],
        businessStatus: "OPERATIONAL",
        regularOpeningHours: {
          weekdayDescriptions: ["Monday: 8:00 AM – 6:00 PM"],
          openNow: true,
        },
        photos: [{ name: "places/ChIJ-well-live/photos/XYZ", widthPx: 640, heightPx: 480 }],
      };
    },
  });
  const well = built.competitors[0];
  record("Persisted competitor keeps discovery identity", well.name === "Well Pharmacy" && well.placeId === "ChIJ-well-live");
  record("Existing distances remain unchanged", well.distanceKm === 0.57 && well.distanceLabel === "573m");
  record("Discovery coordinates are preserved despite different Place Details location", well.latitude === 53.533781 && well.longitude === -1.373875);
  record("Ratings and review counts persist", well.gbpRating === 4.5 && well.gbpReviewCount === 21);
  record("Address, phone and website persist", Boolean(well.address && well.phone && well.website));
  record("Google types persist as categories", well.categories.includes("pharmacy") && well.types.includes("pharmacy"));
  record("Real photos persist", well.photosCaptured && well.photoCount === 1);
  record("No demo reviews were stored", well.reviews.length === 0);
  record("No inferred clinical services were stored", well.services.length === 0);
  record("Real hours persist instead of demo hours", well.openingHours?.weekdayDescriptions[0] === "Monday: 8:00 AM – 6:00 PM");

  const unknownBuilt = await buildCompetitorIntelligence(discovery, {
    fetchPlaceDetails: async () => null,
  });
  const unknown = unknownBuilt.competitors[0];
  record("Failed Place Details leaves distance unchanged", unknown.distanceKm === 0.57);
  record("Failed Place Details leaves photo count unknown, not zero", unknown.photoCount == null && unknown.photosCaptured === false);
  record("Failed Place Details does not invent reviews, hours, services or categories", unknown.reviews.length === 0 && unknown.services.length === 0 && unknown.categories.length === 0 && unknown.openingHours == null);

  const fromDiscovery = enrichCompetitorFromDiscovery(discovery.competitors[0]);
  record("Discovery enrichment does not invent Google evidence", fromDiscovery.reviews.length === 0 && fromDiscovery.services.length === 0 && fromDiscovery.categories.length === 0 && fromDiscovery.photoCount == null);

  const demoArtifact = sanitizeGoogleLocalCompetitorEvidence({
    name: "Lo's Pharmacy",
    categories: ["Pharmacy", "Health"],
    reviews: [
      { rating: 3.8, text: "Helpful team at Lo's Pharmacy — quick prescription collection and friendly advice.", relativeTime: "2 weeks ago", author: "Local patient" },
    ],
    services: ["pharmacy-first", "travel-vaccinations", "prescription-dispensing"],
    openingHours: {
      weekdayDescriptions: [
        "Monday: 9:00 AM – 6:00 PM",
        "Tuesday: 9:00 AM – 6:00 PM",
        "Wednesday: 9:00 AM – 6:00 PM",
        "Thursday: 9:00 AM – 7:00 PM",
        "Friday: 9:00 AM – 6:00 PM",
        "Saturday: 9:00 AM – 5:00 PM",
        "Sunday: Closed",
      ],
      openNow: null,
    },
    photoCount: 0,
    photos: [{ count: 0, thumbnailUrl: null }],
  });
  record("Known demo reviews are treated as unavailable", demoArtifact.reviews.length === 0);
  record("Known demo hours are treated as unavailable", demoArtifact.openingHours == null && isDemoOpeningHoursEvidence({
    weekdayDescriptions: [
      "Monday: 9:00 AM – 6:00 PM",
      "Tuesday: 9:00 AM – 6:00 PM",
      "Wednesday: 9:00 AM – 6:00 PM",
      "Thursday: 9:00 AM – 7:00 PM",
      "Friday: 9:00 AM – 6:00 PM",
      "Saturday: 9:00 AM – 5:00 PM",
      "Sunday: Closed",
    ],
  }));
  record("Inferred clinical services are treated as unavailable", demoArtifact.services.length === 0 && looksLikeInferredClinicalServices(["pharmacy-first", "ear-wax-removal"]));
  record("Inferred Pharmacy/Health categories are not Google evidence", demoArtifact.categories.length === 0 && isInferredGoogleCategorySet(["Pharmacy", "Health"]));
  record("Missing photos on old artifacts do not become zero", demoArtifact.photoCount == null);

  const requestedUrls: string[] = [];
  const requestedMasks: string[] = [];
  process.env.GOOGLE_PLACES_API_KEY = "stub-key-not-live";
  const details = await fetchGooglePlaceDetails("ChIJ-path-check", (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requestedUrls.push(url);
    requestedMasks.push(String((init?.headers as Record<string, string>)?.["X-Goog-FieldMask"] || ""));
    return new Response(JSON.stringify({ displayName: { text: "Path Check" } }), { status: 200 });
  }) as typeof fetch);
  delete process.env.GOOGLE_PLACES_API_KEY;
  record(
    "fetchGooglePlaceDetails requests places/{placeId}",
    requestedUrls[0] === "https://places.googleapis.com/v1/places/ChIJ-path-check" && Boolean(details),
    requestedUrls[0],
  );
  record(
    "fetchGooglePlaceDetails sends the required field mask",
    requiredMaskFields.every((field) => requestedMasks[0]?.split(",").includes(field)),
  );

  const beforeEvidence = existingGeneratedEvidence();
  const beforeHashes = Object.fromEntries(beforeEvidence.map((file) => [file, hashFile(file)]));
  const created: string[] = [];
  try {
    const { buildCommercialIntelligenceDashboard } = await import(
      "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"
    );
    const { buildGoogleLocalProfileMetrics, NOT_AVAILABLE, INSUFFICIENT_GOOGLE_PLACES_BENCHMARK } = await import(
      "../src/pharmacy/googleLocalCompetitorMetricsService.ts"
    );
    const intelSlug = "evidence-integrity-fixture-01";
    const otherSlug = "evidence-integrity-fixture-02";
    fs.mkdirSync(INTEL_DIR, { recursive: true });
    const intelPath = path.join(INTEL_DIR, `${intelSlug}-intelligence.json`);
    fs.writeFileSync(
      intelPath,
      JSON.stringify(
        {
          slug: intelSlug,
          generatedAt: "2026-08-21T13:42:06.000Z",
          source: "google-places-live",
          pharmacy: discovery.pharmacy,
          competitors: [
            {
              ...discovery.competitors[0],
              categories: ["Pharmacy", "Health"],
              gbpRating: 4.5,
              gbpReviewCount: 21,
              reviews: [
                {
                  rating: 4.5,
                  text: "Helpful team at Well Pharmacy — quick prescription collection and friendly advice.",
                  relativeTime: "2 weeks ago",
                  author: "Local patient",
                },
              ],
              services: ["pharmacy-first", "travel-vaccinations", "prescription-dispensing"],
              openingHours: {
                weekdayDescriptions: [
                  "Monday: 9:00 AM – 6:00 PM",
                  "Tuesday: 9:00 AM – 6:00 PM",
                  "Wednesday: 9:00 AM – 6:00 PM",
                  "Thursday: 9:00 AM – 7:00 PM",
                  "Friday: 9:00 AM – 6:00 PM",
                  "Saturday: 9:00 AM – 5:00 PM",
                  "Sunday: Closed",
                ],
                openNow: null,
              },
              photoCount: 0,
              chainBrand: "Well",
              independent: false,
              hasWebsite: true,
              hasPhone: true,
            },
          ],
          competitorSummary: {
            count: 1,
            avgRating: 4.5,
            avgReviewCount: 21,
            nearestDistanceKm: 0.57,
            chainCount: 1,
            independentCount: 0,
            withWebsite: 1,
            withPhone: 1,
          },
        },
        null,
        2,
      ),
    );
    created.push(
      intelPath,
      writeProfile(intelSlug, {
        pharmacyName: "Fixture Pharmacy",
        googlePlaceId: "ChIJ-fixture-own",
        googleBusinessRating: 5,
        googleBusinessReviewCount: 10,
        googleProfileOnboardingState: "configured",
        googleImportSnapshot: {
          status: "imported",
          importedAt: "2026-08-20T09:00:00.000Z",
          message: "Imported",
          googleBusinessUrl: "https://maps.google.com/?cid=1",
          searchPharmacyName: "Fixture Pharmacy",
          searchTown: "Fixture Town",
          searchPostcode: "S70 1AA",
          placeId: "ChIJ-fixture-own",
          businessName: "Fixture Pharmacy",
          address: "1 High Street",
          town: "Fixture Town",
          postcode: "S70 1AA",
          phone: "01226 000000",
          website: "https://fixture.example",
          rating: 5,
          reviewCount: 10,
          photoCount: 0,
          photos: [{ count: 0, thumbnailUrl: null }],
          categories: ["pharmacy"],
          openingHours: [],
          googleMapsUrl: "https://maps.google.com",
          latitude: 53.53,
          longitude: -1.38,
          candidates: [],
          nationalWebsiteDetected: false,
        },
      }),
    );

    const dash = buildCommercialIntelligenceDashboard(intelSlug);
    const row = dash.competitorAnalysis.competitors[0];
    record("Dashboard preserves verified identity and distance", row?.name === "Well Pharmacy" && row.placeId === "ChIJ-well-live" && row.distance.includes("573"));
    record("Dashboard preserves rating and review count", row?.rating.includes("4.5") && row.reviews === "21");
    record("Dashboard does not display inferred categories as Google evidence", row?.categories === "Not available");
    record("Dashboard does not display inferred clinical services", row?.services === "Not available");
    record("Dashboard photo count stays Not available when photos were not collected", row?.photoCount === "Not available");
    const photosMetric = dash.googleProfileMetrics.find((m) => m.id === "photos");
    record(
      "Tenant photo count zero without photo references stays unknown",
      photosMetric?.yourPharmacy === NOT_AVAILABLE && photosMetric?.localAverage === NOT_AVAILABLE,
      photosMetric?.yourPharmacy,
    );
    record(
      "Missing photos do not claim an at-or-above benchmark",
      photosMetric?.opportunity === INSUFFICIENT_GOOGLE_PLACES_BENCHMARK,
    );
    record(
      "Service coverage leader is not inferred from competitor names",
      dash.competitorSummary.some((line) => /clinical services are not available/i.test(line.statement)),
    );

    const snapshotRaw = JSON.parse(
      fs.readFileSync(path.join(ROOT, "fixtures/google-local-competitor-metrics/snapshot-other-tenant.json"), "utf8"),
    );
    const snapPath = path.join(GROWTH_DIR, `${otherSlug}-competitors.json`);
    fs.mkdirSync(GROWTH_DIR, { recursive: true });
    fs.writeFileSync(snapPath, JSON.stringify(snapshotRaw, null, 2));
    created.push(snapPath, writeProfile(otherSlug, { googleProfileOnboardingState: "configured" }));
    const otherDash = buildCommercialIntelligenceDashboard(otherSlug);
    record(
      "Another tenant remains compatible",
      otherDash.competitorAnalysis.competitors.some((c) => c.name === "Boots Pharmacy"),
    );
    const otherMetrics = buildGoogleLocalProfileMetrics({ googleProfileOnboardingState: "configured" } as never, snapshotRaw, {
      kind: "snapshot",
      source: snapshotRaw.source,
      capturedAt: snapshotRaw.generatedAt,
      snap: snapshotRaw,
    });
    record(
      "Second tenant snapshot photo counts remain usable",
      otherMetrics.find((m) => m.id === "photos")?.sampleSize === 2 &&
        otherMetrics.find((m) => m.id === "photos")?.yourPharmacy === "9",
    );
  } finally {
    cleanup(created);
  }

  const afterEvidence = existingGeneratedEvidence();
  const afterHashes = Object.fromEntries(afterEvidence.map((file) => [file, hashFile(file)]));
  record(
    "Live generated evidence and content artifacts remain unchanged",
    JSON.stringify(beforeHashes) === JSON.stringify(afterHashes) && beforeEvidence.join("|") === afterEvidence.join("|"),
  );

  const fix1 = spawnSync("pnpm", ["exec", "tsx", "scripts/validate-google-local-competitor-metrics-v1.ts"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, WORKSPACE_ROOT: ROOT },
  });
  record("Fix 1 Google metrics regression passes", fix1.status === 0, (fix1.stdout || fix1.stderr || "").split("\n").filter((line) => /FAIL|PASS — GOOGLE|GOOGLE-LOCAL/.test(line)).slice(-5).join(" | ") || `status=${fix1.status}`);
  const fix2 = spawnSync("pnpm", ["exec", "tsx", "scripts/validate-organic-search-evidence-fix-02.ts"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, WORKSPACE_ROOT: ROOT },
  });
  record("Fix 2 DataForSEO classification regression passes", fix2.status === 0, (fix2.stdout || fix2.stderr || "").split("\n").filter((line) => /FAIL|ORGANIC-SEARCH/.test(line)).slice(-5).join(" | ") || `status=${fix2.status}`);

  const apiBuild = spawnSync("pnpm", ["--filter", "@workspace/api-server", "run", "build"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  record("API server builds", apiBuild.status === 0, apiBuild.status === 0 ? "ok" : (apiBuild.stderr || apiBuild.stdout || "").slice(-400));

  const changedFiles = [
    "src/pharmacy/googleLocalCompetitorEvidence.ts",
    "src/pharmacy/pharmacyCompetitorIntelligence.ts",
    "src/pharmacy/googleLocalCompetitorMetricsService.ts",
    "src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts",
    "scripts/validate-google-local-evidence-integrity-fix-03.ts",
    "fixtures/google-local-competitor-metrics/intelligence-asda.json",
  ];
  const whitespaceHits: string[] = [];
  for (const file of changedFiles) {
    const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", file], {
      cwd: ROOT,
      encoding: "utf8",
    }).status === 0;
    const args = tracked
      ? ["diff", "--check", "--", file]
      : ["diff", "--check", "--no-index", "--", "/dev/null", file];
    const check = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
    const output = `${check.stdout || ""}${check.stderr || ""}`;
    const hits = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /trailing whitespace|space before tab|conflict marker/.test(line));
    whitespaceHits.push(...hits);
  }
  record(
    "git diff --check passes on changed files",
    whitespaceHits.length === 0,
    whitespaceHits.join(" | ") || "ok",
  );

  record(
    "No unexpected external API call occurred",
    fetchCalls.length === 0,
    fetchCalls.join(" | ") || "none",
  );

  globalThis.fetch = originalFetch;
  const failed = steps.filter((step) => !step.passed);
  console.log(
    failed.length
      ? `\nGOOGLE-LOCAL-EVIDENCE-INTEGRITY-FIX-03: FAIL (${failed.length})`
      : "\nGOOGLE-LOCAL-EVIDENCE-INTEGRITY-FIX-03: PASS",
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  globalThis.fetch = originalFetch;
  console.error(err);
  process.exit(1);
});
