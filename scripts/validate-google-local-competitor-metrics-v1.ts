/**
 * GOOGLE-LOCAL-COMPETITOR-METRICS-FIX-01 validation.
 * Uses stored fixtures only — no live Google Places or DataForSEO calls.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import * as googleLocal from "../src/pharmacy/googleLocalCompetitorMetricsService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE_DIR = path.join(ROOT, "fixtures/google-local-competitor-metrics");
const INTEL_DIR = path.join(ROOT, "data/pharmacy-competitor-intelligence");
const GROWTH_DIR = path.join(ROOT, "data/growth-engine");

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];

function record(name: string, passed: boolean, detail?: string): void {
  steps.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function hashFile(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function existingGeneratedEvidence(): string[] {
  const files: string[] = [];
  const dirs = [
    INTEL_DIR,
    GROWTH_DIR,
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      files.push(path.join(dir, name));
    }
  }
  return files.sort();
}

function ownProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pharmacyName: "Fixture Town Pharmacy",
    googlePlaceId: "ChIJ-fixture-own",
    googleBusinessRating: 4.2,
    googleBusinessReviewCount: 41,
    googleProfileOnboardingState: "configured",
    googleImportSnapshot: {
      status: "imported",
      importedAt: "2026-08-20T09:00:00.000Z",
      message: "Imported",
      googleBusinessUrl: "https://maps.google.com/?cid=1",
      searchPharmacyName: "Fixture Town Pharmacy",
      searchTown: "Fixture Town",
      searchPostcode: "S70 1AA",
      placeId: "ChIJ-fixture-own",
      businessName: "Fixture Town Pharmacy",
      address: "1 High Street, Fixture Town",
      town: "Fixture Town",
      postcode: "S70 1AA",
      phone: "01226 000000",
      website: "https://fixture-town.example",
      rating: 4.2,
      reviewCount: 41,
      photoCount: 6,
      categories: ["Pharmacy", "Health"],
      openingHours: [],
      googleMapsUrl: "https://maps.google.com",
      latitude: 53.553,
      longitude: -1.479,
      candidates: [],
      nationalWebsiteDetected: false,
    },
    ...overrides,
  };
}

function writeProfile(slug: string, data: Record<string, unknown>): string {
  const dir = path.join(ROOT, "data/pharmacy-profiles");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ slug, updatedAt: new Date().toISOString(), version: 5, data }, null, 2),
  );
  return file;
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

function metric(rows: ReturnType<typeof googleLocal.buildGoogleLocalProfileMetrics>, id: string) {
  return rows.find((m) => m.id === id);
}

async function main() {
  const api = (googleLocal as { default?: typeof googleLocal }).default ?? googleLocal;
  record(
    "googleLocal namespace exports builder",
    typeof api.buildGoogleLocalProfileMetrics === "function",
    Object.keys(api).join(",") || "none",
  );
  const {
    buildGoogleLocalProfileMetrics,
    googleLocalArtifactConfidence,
    INSUFFICIENT_GOOGLE_PLACES_BENCHMARK,
    loadCanonicalGoogleLocalCompetitorArtifact,
    NOT_AVAILABLE,
  } = api;
  type CanonicalGoogleLocalCompetitorArtifact = googleLocal.CanonicalGoogleLocalCompetitorArtifact;
  const dashboardSrc = fs.readFileSync(
    path.join(ROOT, "src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"),
    "utf8",
  );
  const metricsSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/googleLocalCompetitorMetricsService.ts"), "utf8");
  const pageSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");

  record(
    "Metrics reader uses canonical Google-local artifact, not snapshot.analysis.comparisons",
    metricsSrc.includes("loadCompetitorIntelligence") &&
      metricsSrc.includes("loadCompetitorSnapshot") &&
      !/snapshot\.analysis\.comparisons/.test(metricsSrc.replace(/\/\*[\s\S]*?\*\//g, "")) &&
      dashboardSrc.includes("loadCanonicalGoogleLocalCompetitorArtifact") &&
      dashboardSrc.includes("buildGoogleLocalProfileMetrics") &&
      !/comparisons\.find\(\(c\) => c\.id === def\.id\)/.test(dashboardSrc),
  );
  record(
    "No Yorkshire-specific production logic",
    !/yorkshire-pharmacy-and-health-clinic/i.test(dashboardSrc) &&
      !/yorkshire-pharmacy-and-health-clinic/i.test(metricsSrc),
  );
  record(
    "DataForSEO modules are not imported by the Google-local metrics reader",
    !/from ["'].*dataForSeo/i.test(metricsSrc) && !/from ["'].*nationalSearch/i.test(metricsSrc),
  );
  record("UI shows sample size", pageSrc.includes("Sample Size") && pageSrc.includes("sampleSizeLabel"));
  record(
    "Insufficient evidence copy present",
    metricsSrc.includes(INSUFFICIENT_GOOGLE_PLACES_BENCHMARK) &&
      dashboardSrc.includes("INSUFFICIENT_GOOGLE_PLACES_BENCHMARK") === false
        ? metricsSrc.includes("Insufficient verified Google Places evidence")
        : true,
  );

  const beforeEvidence = existingGeneratedEvidence();
  const beforeHashes = Object.fromEntries(beforeEvidence.map((f) => [f, hashFile(f)]));

  const intel = readJson<CanonicalGoogleLocalCompetitorArtifact["kind"] extends never ? never : Record<string, unknown>>(
    path.join(FIXTURE_DIR, "intelligence-asda.json"),
  );
  const asdaArtifact: CanonicalGoogleLocalCompetitorArtifact = {
    kind: "intelligence",
    source: String(intel.source),
    capturedAt: String(intel.generatedAt),
    intel: intel as never,
  };
  const asdaMetrics = buildGoogleLocalProfileMetrics(ownProfile() as never, null, asdaArtifact);
  const rating = metric(asdaMetrics, "rating");
  const reviews = metric(asdaMetrics, "reviews");
  const photos = metric(asdaMetrics, "photos");
  const categories = metric(asdaMetrics, "categories");

  record("ASDA remains in Google-local artifact", (intel.competitors as Array<{ name: string }>).some((c) => c.name === "ASDA Pharmacy"));
  record("ASDA 3.1 rating reaches calculations", rating?.highestCompetitor === "4.6" && rating?.sampleSize === 2 && Math.abs(Number.parseFloat(rating.localAverage) - 3.85) < 0.15, rating?.localAverage);
  record("ASDA 87 reviews reach calculations", reviews?.highestCompetitor === "140" && reviews?.sampleSize === 2, `${reviews?.localAverage} sample=${reviews?.sampleSize}`);
  record("Own imported Google rating appears", rating?.yourPharmacy === "4.2", rating?.yourPharmacy);
  record("Own imported Google reviews appear", reviews?.yourPharmacy === "41", reviews?.yourPharmacy);
  record("Local average uses only available rating values (n=2, excludes missing)", rating?.sampleSize === 2 && rating?.sampleSizeLabel === "n=2");
  record("Highest competitor uses available rating evidence", rating?.highestCompetitor === "4.6");
  record("Sample size is displayed on averages", Boolean(rating?.localAverage.includes("n=2")) && Boolean(reviews?.localAverage.includes("n=2")));
  record("Photos remain unavailable when the intelligence artifact has no photo references", photos?.localAverage === NOT_AVAILABLE && photos?.yourPharmacy === "6");
  record("Missing photo benchmark is not zero", photos?.gap === NOT_AVAILABLE && photos?.recommendedTarget === NOT_AVAILABLE);
  record("Missing photo evidence does not claim at or above benchmark", photos?.opportunity === INSUFFICIENT_GOOGLE_PLACES_BENCHMARK);
  record("Categories average uses available category counts", (categories?.sampleSize || 0) >= 2, String(categories?.sampleSize));
  record("Gap is not fabricated as zero when a real gap exists", reviews?.gap !== "0" && reviews?.gap !== NOT_AVAILABLE, reviews?.gap);

  const missingIntel = readJson<Record<string, unknown>>(path.join(FIXTURE_DIR, "intelligence-missing-metrics.json"));
  const missingArtifact: CanonicalGoogleLocalCompetitorArtifact = {
    kind: "intelligence",
    source: String(missingIntel.source),
    capturedAt: String(missingIntel.generatedAt),
    intel: missingIntel as never,
  };
  const missingOwn = { googleProfileOnboardingState: "deferred" } as never;
  const missingMetrics = buildGoogleLocalProfileMetrics(missingOwn, null, missingArtifact);
  record(
    "Missing competitor metrics stay Not Available, not zero",
    missingMetrics.every((m) => m.localAverage === NOT_AVAILABLE && m.highestCompetitor === NOT_AVAILABLE && m.gap === NOT_AVAILABLE && m.recommendedTarget === NOT_AVAILABLE && m.yourPharmacy === NOT_AVAILABLE),
  );
  record(
    "Missing evidence never produces at-or-above benchmark claim",
    missingMetrics.every((m) => m.opportunity === INSUFFICIENT_GOOGLE_PLACES_BENCHMARK && !/at or above/i.test(m.opportunity)),
  );
  record("Missing evidence sample size is zero", missingMetrics.every((m) => m.sampleSize === 0 && m.sampleSizeLabel === NOT_AVAILABLE));

  const snapshotRaw = readJson<Record<string, unknown>>(path.join(FIXTURE_DIR, "snapshot-other-tenant.json"));
  const snapArtifact: CanonicalGoogleLocalCompetitorArtifact = {
    kind: "snapshot",
    source: String(snapshotRaw.source),
    capturedAt: String(snapshotRaw.generatedAt),
    snap: snapshotRaw as never,
  };
  const otherProfile = { googleProfileOnboardingState: "configured" } as never;
  const otherMetrics = buildGoogleLocalProfileMetrics(otherProfile, snapArtifact.snap, snapArtifact);
  const otherRating = metric(otherMetrics, "rating");
  const otherReviews = metric(otherMetrics, "reviews");
  const otherPhotos = metric(otherMetrics, "photos");
  record("Second tenant snapshot path is compatible", otherRating?.sampleSize === 2 && otherRating?.highestCompetitor === "4.2" && Math.abs(Number.parseFloat(String(otherRating?.localAverage)) - 4.05) < 0.15, otherRating?.localAverage);
  record("Second tenant highest rating comes from competitor rows, not empty analysis.comparisons", otherRating?.highestCompetitor === "4.2");
  record("Second tenant own snapshot rating appears", otherRating?.yourPharmacy === "4.8", otherRating?.yourPharmacy);
  record("Second tenant review average uses available values", otherReviews?.sampleSize === 2 && otherReviews?.highestCompetitor === "55");
  record("Second tenant photos are comparable from snapshot photoCount", otherPhotos?.sampleSize === 2 && otherPhotos?.yourPharmacy === "9", otherPhotos?.localAverage);

  const staleAnalysis = (snapshotRaw.analysis as { comparisons: Array<{ competitorAverage: string }> }).comparisons;
  record(
    "Stale snapshot.analysis.comparisons would have been Not Available (reader no longer uses them)",
    staleAnalysis.every((row) => row.competitorAverage === "Not available"),
  );

  const created: string[] = [];
  try {
    const intelSlug = "google-local-metrics-fixture-01";
    const snapSlug = "google-local-metrics-fixture-02";
    fs.mkdirSync(INTEL_DIR, { recursive: true });
    fs.mkdirSync(GROWTH_DIR, { recursive: true });
    const intelPath = path.join(INTEL_DIR, `${intelSlug}-intelligence.json`);
    const snapPath = path.join(GROWTH_DIR, `${snapSlug}-competitors.json`);
    fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2));
    fs.writeFileSync(snapPath, JSON.stringify(snapshotRaw, null, 2));
    created.push(intelPath, snapPath, writeProfile(intelSlug, ownProfile()), writeProfile(snapSlug, otherProfile));

    const loadedIntel = loadCanonicalGoogleLocalCompetitorArtifact(intelSlug);
    const loadedSnap = loadCanonicalGoogleLocalCompetitorArtifact(snapSlug);
    record("Canonical loader prefers intelligence artifact for table-matching tenant", loadedIntel?.kind === "intelligence" && loadedIntel.source === "google-places-live");
    record("Canonical loader uses live snapshot when intelligence is absent", loadedSnap?.kind === "snapshot" && loadedSnap.source === "google-places-live");
    record("Intelligence provenance is preserved", loadedIntel?.capturedAt === "2026-08-20T10:15:00.000Z" && googleLocalArtifactConfidence(loadedIntel) === "High");
    record("Snapshot provenance is preserved", loadedSnap?.capturedAt === "2026-08-19T08:00:00.000Z" && googleLocalArtifactConfidence(loadedSnap) === "High");

    const { buildCommercialIntelligenceDashboard } = await import(
      "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"
    );
    const dash = buildCommercialIntelligenceDashboard(intelSlug);
    const asdaRow = dash.competitorAnalysis.competitors.find((c) => c.name === "ASDA Pharmacy");
    const dashRating = dash.googleProfileMetrics.find((m) => m.id === "rating");
    const dashReviews = dash.googleProfileMetrics.find((m) => m.id === "reviews");
    record("Dashboard competitor table still includes ASDA Pharmacy", Boolean(asdaRow), asdaRow?.name);
    record("Dashboard table preserves ASDA rating 3.1", asdaRow?.rating.includes("3.1"), asdaRow?.rating);
    record("Dashboard table preserves ASDA 87 reviews", asdaRow?.reviews === "87", asdaRow?.reviews);
    record("Dashboard table preserves distance/address/phone/website", Boolean(asdaRow?.distance.includes("7") && asdaRow?.address && asdaRow?.phone && asdaRow?.website));
    record("Dashboard Google Profile Metrics read the same intelligence artifact", dash.sectionEvidence.googleProfileMetrics.evidenceSource === "google-places-live");
    record("Dashboard captured time is no longer Unknown when present", dash.sectionEvidence.googleProfileMetrics.capturedAt === "2026-08-20T10:15:00.000Z");
    record("Dashboard confidence is preserved", dash.sectionEvidence.googleProfileMetrics.confidence === "High");
    record("Dashboard rating local average is calculated", dashRating?.sampleSize === 2 && Math.abs(Number.parseFloat(String(dashRating?.localAverage)) - 3.85) < 0.15, dashRating?.localAverage);
    record("Dashboard reviews include ASDA 87 in sample", dashReviews?.sampleSize === 2 && dashReviews?.highestCompetitor === "140");
    record("Dashboard does not claim at or above when photos are missing from intelligence", dash.googleProfileMetrics.find((m) => m.id === "photos")?.opportunity === INSUFFICIENT_GOOGLE_PLACES_BENCHMARK);

    const otherDash = buildCommercialIntelligenceDashboard(snapSlug);
    record("Second tenant dashboard remains compatible", otherDash.competitorAnalysis.competitors.some((c) => c.name === "Boots Pharmacy"));
    record(
      "Second tenant metrics ignore empty analysis.comparisons",
      otherDash.googleProfileMetrics.find((m) => m.id === "rating")?.highestCompetitor === "4.2",
    );
  } finally {
    cleanup(created);
  }

  const afterEvidence = existingGeneratedEvidence();
  const afterHashes = Object.fromEntries(afterEvidence.map((f) => [f, hashFile(f)]));
  record(
    "Live generated evidence files remain unchanged",
    JSON.stringify(beforeHashes) === JSON.stringify(afterHashes) && beforeEvidence.join("|") === afterEvidence.join("|"),
  );

  const failed = steps.filter((s) => !s.passed);
  console.log(failed.length ? `\nGOOGLE-LOCAL-COMPETITOR-METRICS-FIX-01: FAIL (${failed.length})` : "\nGOOGLE-LOCAL-COMPETITOR-METRICS-FIX-01: PASS");
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
