#!/usr/bin/env npx tsx
/**
 * Sprint 2 — Local Healthcare Intelligence V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyCompetitorOwnership,
  classifyCompetitors,
  countCompetitorOwnership,
} from "../src/pharmacy/growthEngineCompetitorOwnership.ts";
import {
  buildHealthcareAnalysis,
  buildHealthcareEcosystemGroups,
  buildHealthcareOpportunities,
  buildHealthcareSummary,
} from "../src/pharmacy/growthEngineHealthcareAnalysis.ts";
import {
  classifyHealthcareProvider,
  realHealthcareProviders,
} from "../src/pharmacy/growthEngineHealthcareDiscovery.ts";
import { buildHealthcareMapModel, mapModelLayerCounts } from "../src/pharmacy/growthEngineHealthcareMapModel.ts";
import {
  HEALTHCARE_DISPLAY_GROUP_LABELS,
  normalizeHealthcareProvider,
} from "../src/pharmacy/growthEngineHealthcareModel.ts";
import {
  normalizeGrowthEngineCompetitor,
  emptyFutureMetrics,
  type GrowthEngineYourPharmacy,
} from "../src/pharmacy/growthEngineCompetitorModel.ts";
import { LOCAL_MARKET_SNAPSHOT_VERSION } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { renderLocalMarketIntelligencePage } from "../src/pharmacy/growthEngineLocalMarketPage.ts";
import { renderLocalMarketPage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { loadCompetitorSnapshot, refreshSnapshotAnalysis } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { normalizeCompetitorSnapshot } from "../src/pharmacy/growthEngineCompetitorModel.ts";

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

function sampleProvider(overrides: Record<string, unknown> = {}) {
  return normalizeHealthcareProvider({
    placeId: "ChIJgp1",
    businessName: "Rotherham GP Surgery",
    category: "GP Surgery",
    groupKey: "gpSurgeries",
    distanceKm: 0.4,
    distanceLabel: "400m",
    address: "1 Medical Way",
    rating: 4.6,
    reviewCount: 42,
    phone: "01709123456",
    website: "",
    openingStatus: "Operational",
    googleMapsUrl: "https://maps.google.com",
    latitude: 53.43,
    longitude: -1.35,
    source: "google-places",
    ...overrides,
  })!;
}

function sampleCompetitor(overrides: Record<string, unknown> = {}) {
  return normalizeGrowthEngineCompetitor({
    placeId: "ChIJcomp1",
    businessName: "Boots Pharmacy",
    distanceKm: 0.6,
    distanceLabel: "600m",
    rating: 4.5,
    reviewCount: 120,
    photoCount: 80,
    primaryCategory: "Pharmacy",
    latitude: 53.431,
    longitude: -1.357,
    source: "google-places",
    future: emptyFutureMetrics(),
    ...overrides,
  })!;
}

function sampleYours(): GrowthEngineYourPharmacy {
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
    secondaryCategories: [],
    rating: 4.8,
    reviewCount: 32,
    photoCount: 41,
    businessStatus: "OPERATIONAL",
    openingStatus: "Open now",
    openingHours: [],
    attributes: [],
    businessDescription: "",
    directionsUrl: "https://maps.google.com",
    googleMapsUrl: "https://maps.google.com",
    notes: "",
    source: "google-places",
    isYourPharmacy: true,
  };
}

function main() {
  console.log("\n=== Sprint 2 — Local Healthcare Intelligence V1 ===\n");

  record("snapshot-version", LOCAL_MARKET_SNAPSHOT_VERSION === 3, `v${LOCAL_MARKET_SNAPSHOT_VERSION}`);

  // --- Part 1: Discovery classification ---
  record("classify-gp", (() => {
    const r = classifyHealthcareProvider("Rotherham GP Surgery", ["doctor"], "doctor");
    return r?.groupKey === "gpSurgeries";
  })(), "GP surgery");
  record("classify-hospital", (() => {
    const r = classifyHealthcareProvider("General Hospital", ["hospital"], "hospital");
    return r?.groupKey === "hospitals";
  })(), "hospital");
  record("classify-pharmacy-excluded", classifyHealthcareProvider("Boots Pharmacy", ["pharmacy"], "pharmacy") === null, "pharmacy excluded");
  record("classify-dentist", (() => {
    const r = classifyHealthcareProvider("Smile Dental Practice", ["dentist"], "dentist");
    return r?.groupKey === "dentists";
  })(), "dentist");

  record("classify-podiatry-not-gp", (() => {
    const names = [
      "Step in Podiatry",
      "PodoSkin Podiatry Clinic",
      "City Podiatry & Nail Surgery Clinic",
      "County Fungal Nail Clinic",
    ];
    return names.every((name) => classifyHealthcareProvider(name, ["doctor"], "doctor")?.groupKey === "podiatrists");
  })(), "podiatry/nail not GP despite doctor type");

  record("classify-counselling-not-gp", (() => {
    const r = classifyHealthcareProvider("Wellbeing Counselling Practice", ["doctor"], "doctor");
    return r?.groupKey === "mentalHealthServices";
  })(), "counselling not GP despite doctor type");

  record("classify-doctor-type-not-enough-for-gp", (() => {
    const r = classifyHealthcareProvider("S R Associates Healthcare", ["doctor"], "doctor");
    return r?.groupKey !== "gpSurgeries";
  })(), "doctor type alone is not a GP surgery");

  record("classify-genuine-gp-surgery", (() => {
    const names = ["Rotherham GP Surgery", "The Central Surgery", "Severn Surgery", "Private Medical Clinic | Private GP"];
    return names.every((name) => classifyHealthcareProvider(name, ["doctor"], "doctor")?.groupKey === "gpSurgeries");
  })(), "genuine GP/surgery names");

  record("classify-health-centre-not-hospital", (() => {
    const names = ["Victoria Park Health Centre", "St Peter's Health Centre", "Groby Road Medical Centre"];
    return names.every((name) => classifyHealthcareProvider(name, ["hospital"], "hospital")?.groupKey === "healthCentres");
  })(), "health/medical centres are not hospitals");

  record("classify-clinic-treatment-not-hospital", (() => {
    const clinic = classifyHealthcareProvider("Regent Street Clinic", ["hospital"], "hospital");
    const treatment = classifyHealthcareProvider("Head To Toe Treatments Ltd", ["hospital"], "hospital");
    const suite = classifyHealthcareProvider("The Health Suite", ["hospital"], "hospital");
    return (
      clinic?.groupKey !== "hospitals" &&
      treatment?.groupKey !== "hospitals" &&
      suite?.groupKey !== "hospitals"
    );
  })(), "clinics/treatments are not hospitals");

  record("classify-education-centre-not-hospital", (() => {
    const r = classifyHealthcareProvider("General Hospital Clinical Education Centre", ["hospital"], "hospital");
    return r?.groupKey !== "hospitals";
  })(), "clinical education is not a hospital");

  record("classify-urgent-care-not-hospital", (() => {
    const r = classifyHealthcareProvider("Oadby Urgent Care Centre", ["hospital"], "hospital");
    return r?.groupKey === "urgentTreatmentCentres";
  })(), "urgent care is not a hospital");

  record("classify-genuine-hospital-still-hospital", (() => {
    const names = ["Spire Leicester Hospital", "District General Hospital", "Royal Infirmary", "Glenfield Hospital"];
    return names.every((name) => classifyHealthcareProvider(name, ["hospital"], "hospital")?.groupKey === "hospitals");
  })(), "genuine hospitals remain hospitals");

  record("classify-hospital-not-health-centre-by-type", (() => {
    const r = classifyHealthcareProvider("Spire Example Hospital", ["hospital", "medical_center"], "hospital");
    return r?.groupKey === "hospitals";
  })(), "hospital name wins over medical_center type");

  record("classify-clinic-not-health-centre-by-type", (() => {
    const clinic = classifyHealthcareProvider("Regent Street Clinic", ["medical_center"], "medical_center");
    const treatment = classifyHealthcareProvider("Head To Toe Treatments Ltd", ["medical_center"], "medical_center");
    return clinic?.groupKey !== "healthCentres" && clinic?.groupKey !== "hospitals" &&
      treatment?.groupKey !== "healthCentres" && treatment?.groupKey !== "hospitals";
  })(), "clinic/treatment medical_center is other healthcare");

  const specialistNotHospitalGroups = buildHealthcareEcosystemGroups(
    [
      sampleProvider({ placeId: "utc1", businessName: "Urgent Care Centre", groupKey: "urgentTreatmentCentres", category: "Urgent Treatment Centre" }),
    ],
    [],
  );
  record(
    "eco-urgent-care-not-hospital-bucket",
    (specialistNotHospitalGroups.find((g) => g.id === "hospitals")?.count || 0) === 0 &&
      (specialistNotHospitalGroups.find((g) => g.id === "healthcareServices")?.count || 0) === 1,
    "UTC displays in other healthcare, not hospitals",
  );

  // --- Part 2: Ecosystem grouping ---
  const providers = [
    sampleProvider(),
    sampleProvider({ placeId: "ChIJhc1", businessName: "Health Centre", groupKey: "healthCentres", category: "Health Centre" }),
    sampleProvider({ placeId: "ChIJh1", businessName: "District Hospital", groupKey: "hospitals", category: "Hospital", distanceKm: 2.1, distanceLabel: "2.1km" }),
  ];
  const competitors = [sampleCompetitor(), sampleCompetitor({ placeId: "c2", businessName: "Brook Pharmacy" })];
  const groups = buildHealthcareEcosystemGroups(providers, competitors);
  record("eco-six-groups", groups.length === 6, String(groups.length));
  record("eco-gp-count", groups.find((g) => g.id === "gpSurgeries")?.count === 1, "gp=1");
  record("eco-display-labels", groups.every((g) => HEALTHCARE_DISPLAY_GROUP_LABELS[g.id]), "labels");
  record("eco-nearest", Boolean(groups.find((g) => g.id === "gpSurgeries")?.nearest), "nearest set");

  // --- Part 3: Competitor ownership ---
  record("ownership-national", classifyCompetitorOwnership("Boots Pharmacy Rotherham").ownershipType === "national", "Boots");
  record("ownership-regional", classifyCompetitorOwnership("Rowlands Pharmacy").ownershipType === "regional", "Rowlands");
  record("ownership-independent", classifyCompetitorOwnership("Brook Pharmacy").ownershipType === "independent", "independent");
  record("ownership-no-guess", classifyCompetitorOwnership("ABC Ltd").ownershipType === "unknown", "unknown");

  // --- Part 4: Map model ---
  const yours = sampleYours();
  const mapModel = buildHealthcareMapModel(yours, providers, competitors);
  record("map-center", mapModel.center?.latitude === yours.latitude, "center on pharmacy");
  record("map-markers", mapModel.markers.length >= 4, String(mapModel.markers.length));
  record("map-layers", mapModelLayerCounts(mapModel).competitor >= 1 && mapModelLayerCounts(mapModel)["healthcare-provider"] >= 1, "layer mix");
  record("map-future-null", mapModel.futureLayers.catchmentOverlay === null, "future placeholders null");

  // --- Part 5: Healthcare summary ---
  const summary = buildHealthcareSummary(providers, competitors, yours);
  record("summary-gp-mention", summary.some((p) => /GP surger/i.test(p)), summary[0] || "");
  record("summary-competitors", summary.some((p) => /competing pharmac/i.test(p)), "competitors");
  record("summary-no-invent-empty", buildHealthcareSummary([], [], null).some((p) => /No live Google Places/i.test(p)), "honest empty");

  // --- Part 6: Opportunities ---
  const manyProviders = Array.from({ length: 16 }, (_, i) =>
    sampleProvider({ placeId: `p${i}`, businessName: `Provider ${i}`, groupKey: i % 2 === 0 ? "gpSurgeries" : "communityClinics" }),
  );
  const manyCompetitors = Array.from({ length: 9 }, (_, i) =>
    sampleCompetitor({ placeId: `c${i}`, businessName: `Pharmacy ${i}` }),
  );
  const opps = buildHealthcareOpportunities(manyProviders, manyCompetitors);
  record("opp-competitive", opps.some((o) => /Highly competitive/i.test(o)), opps.join("; "));
  record("opp-healthcare-presence", opps.some((o) => /healthcare/i.test(o)), "healthcare observations");
  record("opp-no-data-empty", buildHealthcareOpportunities([], []).length === 0, "empty when no data");

  // --- Analysis snapshot ---
  const analysis = buildHealthcareAnalysis(providers, competitors, yours, "google-places-live");
  record("analysis-live", analysis.dataSource === "google-places-live", analysis.dataSource);
  record("analysis-competitor-groups", analysis.competitorGroups.national >= 1, `national=${analysis.competitorGroups.national}`);

  // --- Backwards compatibility ---
  const legacySnapshot = normalizeCompetitorSnapshot({
    version: 2,
    slug: "test",
    generatedAt: new Date().toISOString(),
    source: "google-places-live",
    targetCount: 10,
    pharmacy: { name: "Test", address: "", postcode: "", latitude: null, longitude: null },
    yourPharmacy: yours,
    competitors: [sampleCompetitor()],
    analysis: null,
  });
  record("legacy-v2-loads", legacySnapshot?.healthcare !== undefined, "healthcare default on v2");
  const refreshed = refreshSnapshotAnalysis(legacySnapshot!);
  record("refresh-adds-healthcare", Boolean(refreshed.healthcare?.analysis), "refresh analysis");

  record("real-providers-filter", realHealthcareProviders([sampleProvider()]).length === 1, "valid provider kept");

  // --- Page UI ---
  const mockSnapshot = {
    version: 3,
    slug: "test",
    generatedAt: new Date().toISOString(),
    source: "google-places-live" as const,
    targetCount: 10,
    pharmacy: { name: "Test", address: "", postcode: "", latitude: 53.43, longitude: -1.356 },
    yourPharmacy: yours,
    competitors: [sampleCompetitor(), sampleCompetitor({ placeId: "c3", businessName: "Rowlands Pharmacy" })],
    analysis: {
      competitorCount: 2,
      dataSource: "google-places-live" as const,
      comparisons: [],
      summaryParagraphs: ["We found 2 pharmacies within your target area."],
      opportunities: [],
      yourPharmacyComplete: true,
    },
    healthcare: {
      version: 1,
      generatedAt: new Date().toISOString(),
      providers,
      analysis,
      mapModel,
    },
  };

  const page = renderLocalMarketIntelligencePage("test", mockSnapshot as never, {});
  record("page-healthcare-network", page.includes("Healthcare network"), "network section");
  record("page-gp-list", page.includes("GP surgeries"), "gp heading");
  record("page-hospital-list", page.includes("Hospitals"), "hospital heading");
  record("page-health-centres", page.includes("Health centres"), "health centre heading");
  record("page-your-pharmacy", page.includes("Your Google Business Profile"), "profile section");
  record("page-discover-btn", page.includes("btnDiscoverCompetitors"), "discover");

  const visionHtml = renderLocalMarketPage("vision-pharmacy", loadCompetitorSnapshot("vision-pharmacy"));
  record("vision-pharmacy:renders", /Healthcare network|Local market/i.test(visionHtml), "Vision Local Market renders");
  record("vision-pharmacy:gp-section", visionHtml.includes("GP surgeries"), "GP section retained");
  record("vision-pharmacy:comparison", /Competitor comparison|Nearby pharmacies|Local average/i.test(visionHtml), "comparison retained");

  record("docs-exist", fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-LOCAL-HEALTHCARE-V1.md")), "documentation");
  record("bpi-intact", fs.existsSync(path.join(ROOT, "src/pharmacy/businessProfileIntelligence/businessProfileIntelligenceTypes.ts")), "BPI untouched");
  record("growth-intel-intact", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineOpportunityEngine.ts")), "Growth Intelligence untouched");

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
