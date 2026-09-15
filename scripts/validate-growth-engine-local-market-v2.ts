#!/usr/bin/env npx tsx
/**
 * Growth Engine — Local Market Report V2 (Commercial Intelligence) validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLocalMarketReportView,
  sortCompetitorsByDistance,
} from "../src/pharmacy/growthEngineLocalMarketReportView.ts";
import {
  buildComparisonPanel,
  buildLocalMarketAnalysis,
  realGoogleCompetitors,
} from "../src/pharmacy/growthEngineLocalMarketAnalysis.ts";
import {
  emptyFutureMetrics,
  normalizeGrowthEngineCompetitor,
  type GrowthEngineYourPharmacy,
} from "../src/pharmacy/growthEngineCompetitorModel.ts";
import { renderLocalMarketIntelligencePage } from "../src/pharmacy/growthEngineLocalMarketPage.ts";
import { renderLocalMarketPage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { loadCompetitorSnapshot } from "../src/pharmacy/growthEngineLocalMarketService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "dhmdigital";

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

const BANNED = [/\bschema\b/i, /\bcanonical\b/i, /\bseo\b/i, /\bplace id\b/i, /\bChIJ/i];

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
    secondaryCategories: ["Drugstore", "Health"],
    website: "https://rival.example",
    googleMapsUrl: "https://maps.google.com",
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
  console.log("\n=== Growth Engine Local Market Report V2 ===\n");

  const pool = [
    sampleCompetitor(),
    sampleCompetitor({ placeId: "c2", distanceKm: 0.4, distanceLabel: "400m", reviewCount: 200, photoCount: 160, rating: 4.6 }),
  ];
  const yours = sampleYours();
  const analysis = buildLocalMarketAnalysis(yours, pool, "google-places-live");
  const mockSnapshot = {
    version: 3,
    slug: "test",
    generatedAt: new Date().toISOString(),
    source: "google-places-live" as const,
    targetCount: 10,
    pharmacy: { name: "Test", address: "", postcode: "", latitude: null, longitude: null },
    yourPharmacy: yours,
    competitors: pool,
    analysis,
    healthcare: { version: 1, generatedAt: new Date().toISOString(), providers: [], analysis: null, mapModel: null },
  };

  const view = buildLocalMarketReportView(mockSnapshot as never);
  record("view-live", view.live, "live flag");
  record("view-overview-pharmacies", view.overview.pharmacies === 2, String(view.overview.pharmacies));
  record("view-insights-max", view.insights.length <= 6, String(view.insights.length));
  record("view-actions-max", view.actions.length <= 6, String(view.actions.length));
  record("view-opportunity-words", view.opportunitySummary.split(/\s+/).length <= 120, "120 word cap");
  record("view-has-review-insight", view.insights.some((i) => /reviews/i.test(i)), view.insights[0] || "none");

  const sorted = sortCompetitorsByDistance(pool);
  record("competitors-sorted", sorted[0].distanceKm === 0.4, sorted[0].distanceLabel);

  const page = renderLocalMarketIntelligencePage("test", mockSnapshot as never, {});
  record("section-gbp", page.includes("Your Google Business Profile"), "section 1");
  record("section-overview", page.includes("Local market overview"), "section 2");
  record("section-competitors", page.includes("Competitor comparison"), "section 3");
  record("section-insights", page.includes("Market insights"), "section 4");
  record("section-actions", page.includes("Recommended actions"), "section 5");
  record("section-network", page.includes("Healthcare network"), "section 6");
  record("section-opportunity", page.includes("Local opportunity"), "section 7");
  record("competitor-cards", page.includes("lmr-comp-card"), "premium cards");
  record("no-place-ids", !BANNED.some((re) => re.test(page)), "no place ids in HTML");
  record("no-spreadsheet", !page.includes("<table"), "no tables");
  record("progress-bars", page.includes("lmr-bar"), "comparison bars");
  record("discover-btn", page.includes("btnDiscoverCompetitors"), "discover");

  for (const re of BANNED) {
    record(`no-banned:${re.source}`, !re.test(page), re.source);
  }

  const comparisons = buildComparisonPanel(yours, pool);
  record("engine-comparisons-unchanged", comparisons.length === 4, "analysis engine intact");

  const noLive = buildLocalMarketAnalysis(yours, [], "demo-no-google-key");
  record("no-invented-without-live", noLive.opportunities.length === 0, "no fake opps");

  const dhmdigital = loadCompetitorSnapshot(SLUG);
  const html = renderLocalMarketPage(SLUG, dhmdigital);
  record("dhmdigital:renders", html.includes("Your Local Market"), "page renders");
  record("dhmdigital:google-places", dhmdigital?.source === "google-places-live", dhmdigital?.source || "missing");
  record("dhmdigital:competitor-count", (dhmdigital?.competitors?.length || 0) > 0, String(dhmdigital?.competitors?.length || 0));
  record("dhmdigital:sections", html.includes("Section 3") && html.includes("Section 7"), "all sections");

  record(
    "report-doc-exists",
    fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-LOCAL-MARKET-V2.md")),
    "documentation",
  );

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
