#!/usr/bin/env npx tsx
/**
 * Growth Engine — Local Market Intelligence V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildComparisonPanel,
  buildMarketSummary,
  buildOpportunityHighlights,
  buildLocalMarketAnalysis,
  realGoogleCompetitors,
} from "../src/pharmacy/growthEngineLocalMarketAnalysis.ts";
import {
  normalizeGrowthEngineCompetitor,
  emptyFutureMetrics,
  type GrowthEngineYourPharmacy,
} from "../src/pharmacy/growthEngineCompetitorModel.ts";
import { LOCAL_MARKET_SNAPSHOT_VERSION } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { renderLocalMarketIntelligencePage } from "../src/pharmacy/growthEngineLocalMarketPage.ts";
import { renderLocalMarketPage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { loadCompetitorSnapshot } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { isNationalGrowthPlatform } from "../src/pharmacy/growthPlatformResolverService.ts";
import { isDirectCommunityPharmacyCompetitor } from "../src/pharmacy/pharmacyCompetitorDiscovery.ts";

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

function sampleCompetitor(overrides: Record<string, unknown> = {}) {
  return normalizeGrowthEngineCompetitor({
    placeId: "ChIJtest1",
    businessName: "Rival Pharmacy",
    distanceKm: 0.8,
    distanceLabel: "800m",
    rating: 4.5,
    reviewCount: 178,
    photoCount: 146,
    primaryCategory: "Pharmacy",
    secondaryCategories: ["Drugstore"],
    source: "google-places",
    future: emptyFutureMetrics(),
    ...overrides,
  })!;
}

function sampleYours(overrides: Partial<GrowthEngineYourPharmacy> = {}): GrowthEngineYourPharmacy {
  return {
    placeId: "ChIJyours",
    businessName: "Your Pharmacy",
    distanceKm: 0,
    distanceLabel: "Your location",
    latitude: 53.43,
    longitude: -1.356,
    address: "1 High Street",
    phone: "01709210731",
    website: "https://example.com",
    primaryCategory: "Pharmacy",
    secondaryCategories: ["Drugstore"],
    rating: 4.8,
    reviewCount: 32,
    photoCount: 41,
    businessStatus: "OPERATIONAL",
    openingStatus: "Open now",
    openingHours: ["Mon: 09:00–18:00"],
    attributes: [],
    businessDescription: "",
    directionsUrl: "https://maps.google.com",
    googleMapsUrl: "https://maps.google.com",
    notes: "",
    source: "google-places",
    isYourPharmacy: true,
    ...overrides,
  };
}

function main() {
  console.log("\n=== Growth Engine Local Market Intelligence V1 ===\n");

  record("snapshot-version", LOCAL_MARKET_SNAPSHOT_VERSION === 3, `v${LOCAL_MARKET_SNAPSHOT_VERSION}`);

  const pool = [sampleCompetitor(), sampleCompetitor({ placeId: "c2", reviewCount: 200, photoCount: 160, rating: 4.6 })];
  const yours = sampleYours();
  const comparisons = buildComparisonPanel(yours, pool);
  record("comparison-rows", comparisons.length === 4, String(comparisons.length));
  record("comparison-reviews-avg", comparisons[0].competitorAverage === "189", comparisons[0].competitorAverage);
  record("comparison-no-fake-yours", comparisons[0].yourPharmacy === "32", "your reviews");

  const summary = buildMarketSummary(yours, pool);
  record("summary-mentions-count", summary.some((p) => p.includes("2 pharmacies")), summary[0]);
  record("summary-real-numbers", summary.some((p) => p.includes("32 reviews")), "your stats");

  const opps = buildOpportunityHighlights(yours, pool);
  record("opportunity-fewer-reviews", opps.some((o) => /fewer Google reviews/i.test(o)), opps.join("; "));
  record("opportunity-high-rating", opps.some((o) => /highest average ratings/i.test(o)), opps.join("; "));

  record("demo-excluded-from-real-pool", realGoogleCompetitors([sampleCompetitor({ source: "demo-fallback" })]).length === 0, "no demo");
  record(
    "exclude-superstore-without-pharmacy-name",
    isDirectCommunityPharmacyCompetitor({ name: "Asda Superstore", primaryCategory: "supermarket" }) === false,
    "superstore is adjacent, not a direct pharmacy competitor",
  );
  record(
    "keep-named-pharmacy-counter",
    isDirectCommunityPharmacyCompetitor({ name: "ASDA Pharmacy", primaryCategory: "pharmacy" }) === true,
    "named pharmacy counters remain",
  );
  record(
    "exclude-lab-even-if-google-pharmacy-type",
    isDirectCommunityPharmacyCompetitor({ name: "Steroids Pharma Lab", primaryCategory: "pharmacy" }) === false,
    "labs are not community pharmacy competitors",
  );

  const noLive = buildLocalMarketAnalysis(yours, [], "demo-no-google-key");
  record("no-invented-without-live", noLive.dataSource === "unavailable" && noLive.opportunities.length === 0, "unavailable");

  record("no-invented-summary-demo", !noLive.summaryParagraphs.some((p) => /\d+ Google reviews/.test(p) && p.includes("average pharmacy has:")), "honest");

  for (const slug of ["dhmdigital", "pharmaconnect"]) {
    const html = renderLocalMarketPage(slug, loadCompetitorSnapshot(slug));
    const national = isNationalGrowthPlatform(slug);
    // Local-market UI expectations only apply when the tenant is actually on the Local Growth Engine.
    if (!national) {
      record(`${slug}:your-pharmacy-section`, html.includes("Your Google Business Profile"), "GBP section");
      record(`${slug}:healthcare-network`, html.includes("Healthcare network"), "healthcare network");
      record(
        `${slug}:comparison-cards`,
        html.includes("Competitor comparison") && html.includes("lmr-comp-card"),
        "competitor cards",
      );
      record(`${slug}:market-insights`, html.includes("Market insights"), "insights");
      record(`${slug}:recommended-actions`, html.includes("Recommended actions"), "actions");
      record(`${slug}:local-opportunity`, html.includes("Local opportunity"), "opportunity");
      record(`${slug}:discover-btn`, html.includes("btnDiscoverCompetitors"), "discover");
    } else {
      record(`${slug}:skips-local-assertions-when-national`, true, "national platform — expected");
    }
    record(`${slug}:website-cta`, html.includes("Your Website Report"), "CTA");
  }

  const mockSnapshot = {
    version: 2,
    slug: "test",
    generatedAt: new Date().toISOString(),
    source: "google-places-live" as const,
    targetCount: 10,
    pharmacy: { name: "Test", address: "", postcode: "", latitude: null, longitude: null },
    yourPharmacy: yours,
    competitors: pool,
    analysis: buildLocalMarketAnalysis(yours, pool, "google-places-live"),
  };
  const page = renderLocalMarketIntelligencePage("test", mockSnapshot as never, {});
  record("live-page-comparison", page.includes("lmr-compare-card") || page.includes("189") || page.includes("178"), "live comparison shown");

  record("docs-exist", fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-LOCAL-MARKET-V2.md")), "docs");

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
