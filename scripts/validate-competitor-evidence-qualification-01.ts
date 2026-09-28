#!/usr/bin/env npx tsx
/**
 * Canonical commercial evidence classes.
 * Fixture tenants only. Does not call a live provider or rewrite Gilbert.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pc-ceq-"));
process.env.WORKSPACE_ROOT = tmp;
process.env.GOOGLE_PLACES_API_KEY = "";

interface Check { id: string; pass: boolean }
const checks: Check[] = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function writeJson(rel: string, value: unknown) {
  const file = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

async function main() {
  console.log("\n=== COMPETITOR EVIDENCE QUALIFICATION 01 ===\n");
  const {
    qualifyCommercialEvidenceCandidate,
    countsTowardLocalBenchmark,
    countsTowardOrganicAnalysis,
    countsTowardCommercialCompetitorTotal,
    countsTowardOpportunityScoring,
    COMMERCIAL_EVIDENCE_CLASSES,
  } = await import("../src/pharmacy/organicSearchEvidenceClassification.ts");
  const {
    isLocalMarketQualificationStale,
    isGrowthIntelligenceQualificationStale,
    qualifiedLocalCommercialPlaceIds,
  } = await import("../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts");
  const { isCurrentLocalMarketIntelligence } = await import("../src/pharmacy/masterAdminWorkflowStageExecutor.ts");

  const q = (input: Parameters<typeof qualifyCommercialEvidenceCandidate>[0]) =>
    qualifyCommercialEvidenceCandidate(input);

  const placesPharmacy = q({
    name: "Abbey Chemist",
    source: "google-places",
    provider: "google-places",
    placeId: "ChIJPharmacy",
    primaryCategory: "pharmacy",
    categories: ["pharmacy"],
    distanceKm: 0.8,
  });
  record("1-places-pharmacy-local", placesPharmacy.evidenceClass === "LOCAL_COMMERCIAL_COMPETITOR", placesPharmacy.evidenceClass);

  const placesRestaurant = q({
    name: "Harbour Restaurant",
    source: "google-places",
    provider: "google-places",
    placeId: "ChIJRestaurant",
    primaryCategory: "restaurant",
    categories: ["restaurant"],
    distanceKm: 0.4,
    discoveryAccepted: true,
  });
  record("2-places-non-pharmacy", placesRestaurant.evidenceClass !== "LOCAL_COMMERCIAL_COMPETITOR", placesRestaurant.evidenceClass);

  const organicLocal = q({
    domain: "abbeychemist.co.uk",
    url: "https://abbeychemist.co.uk/services",
    title: "Abbey Chemist",
    description: "Community pharmacy",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
    verifiedLocalDomains: ["abbeychemist.co.uk"],
    matchedQuery: "pharmacy Paisley",
    position: 3,
    capturedAt: "2026-09-28T16:23:11.000Z",
  });
  record("3-organic-corroborated-local", organicLocal.evidenceClass === "LOCAL_COMMERCIAL_COMPETITOR", organicLocal.evidenceClass);

  const organicOutside = q({
    domain: "healthfulpharmacy.co.uk",
    url: "https://www.healthfulpharmacy.co.uk/services/blood-pressure-checks",
    title: "Blood Pressure Checks",
    description: "Blood Pressure Checks 1604 Paisley Road, Glasgow. Appointment length: 15 minutes Book by phone only",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
    matchedQuery: "Blood Pressure Checks Paisley",
    position: 5,
    capturedAt: "2026-09-28T16:23:11.000Z",
  });
  record("4-organic-outside-local-market", organicOutside.evidenceClass === "ORGANIC_COMMERCIAL_COMPETITOR", organicOutside.evidenceClass);

  const national = q({
    domain: "boots.com",
    url: "https://www.boots.com/health-pharmacy",
    title: "Boots Pharmacy",
    description: "Shop pharmacy services online",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
    matchedQuery: "pharmacy services",
  });
  record("5-national-organic", national.evidenceClass === "ORGANIC_COMMERCIAL_COMPETITOR", national.evidenceClass);

  const nhs = q({
    domain: "nhs.uk",
    url: "https://www.nhs.uk/nhs-services/pharmacies/find-a-pharmacy-that-offers-free-blood-pressure-checks/",
    title: "Find a pharmacy that offers free blood pressure checks",
    description: "Use this service to find a pharmacy that offers free blood pressure checks.",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
  });
  record("6-nhs", nhs.evidenceClass === "AUTHORITATIVE_INFORMATIONAL", nhs.evidenceClass);

  const government = q({
    domain: "gov.uk",
    url: "https://www.gov.uk/find-pharmacy",
    title: "Find a pharmacy",
    description: "Government service",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
  });
  record("7-government", government.evidenceClass === "AUTHORITATIVE_INFORMATIONAL", government.evidenceClass);

  const directory = q({
    domain: "yell.com",
    url: "https://www.yell.com/s/pharmacies.html",
    title: "Pharmacies near you",
    description: "Directory listing",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
  });
  record("8-directory", directory.evidenceClass === "AUTHORITATIVE_INFORMATIONAL", directory.evidenceClass);

  const academic = q({
    domain: "link.springer.com",
    url: "https://link.springer.com/content/pdf/10.1007/978-1-4757-5971-6.pdf",
    title: "Neuroreceptors and Signal Transduction - Springer Nature",
    description: "1988 · Cited by 2 — pressure ejection",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
    matchedQuery: "Blood Pressure Checks PA2 7EP",
  });
  record("9-academic-pdf", academic.evidenceClass === "IRRELEVANT", academic.evidenceClass);

  const music = q({
    domain: "metacritic.com",
    url: "https://www.metacritic.com/publication/the-new-york-times",
    title: "The New York Times' Scores",
    description: "The album is surprisingly effective in musical terms",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
    matchedQuery: "Blood Pressure Checks PA2 7EP",
  });
  record("10-music", music.evidenceClass === "IRRELEVANT", music.evidenceClass);

  const historical = q({
    domain: "worldradiohistory.com",
    url: "https://www.worldradiohistory.com/UK/Practical-Electronics/80s/Practical-Electronics-1982-09-S-OCR.pdf",
    title: "Practical-Electronics-1982-09-S-OCR.pdf",
    description: "measurement of stress, strain, pressure",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
  });
  record("11-historical-pdf", historical.evidenceClass === "IRRELEVANT", historical.evidenceClass);

  const foreignDoc = q({
    domain: "lib3.dss.go.th",
    url: "http://lib3.dss.go.th/fulltext/scan_ebook/j.liq_chro_1994_v17_n3.pdf",
    title: "Scan ebook",
    description: "Your order must be prepaid by personal check",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
  });
  record("12-foreign-document", foreignDoc.evidenceClass === "IRRELEVANT", foreignDoc.evidenceClass);

  const servicePage = q({
    domain: "agpharmacy.co.uk",
    url: "https://agpharmacy.co.uk/booking-blood-pressure-service/",
    title: "Book a Blood pressure test",
    description: "Choose a branch, select your service, and confirm your appointment",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
    matchedQuery: "Blood Pressure Checks Paisley",
  });
  record("13-pharmacy-service-page", servicePage.evidenceClass === "ORGANIC_COMMERCIAL_COMPETITOR", servicePage.evidenceClass);

  const blog = q({
    domain: "example-pharmacy.co.uk",
    url: "https://example-pharmacy.co.uk/blog/pressure-notes",
    title: "Pharmacy blog notes",
    description: "A short article mentioning blood pressure",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
  });
  record("14-blog-not-local", blog.evidenceClass !== "LOCAL_COMMERCIAL_COMPETITOR", blog.evidenceClass);

  const coincidence = q({
    domain: "example-notes.test",
    url: "https://example-notes.test/post",
    title: "Weekend notes",
    description: "Nothing commercial is offered here",
    provider: "dataforseo-google-organic-live",
    source: "search-engine",
    matchedQuery: "Blood Pressure Checks PA2 7EP",
  });
  record("15-query-coincidence", coincidence.evidenceClass === "IRRELEVANT", coincidence.evidenceClass);

  const localOnly = [placesPharmacy, organicOutside, nhs, academic].filter((row) => countsTowardLocalBenchmark(row.evidenceClass));
  record("16-local-metrics-local-only", localOnly.length === 1 && localOnly[0] === placesPharmacy, String(localOnly.length));
  record("17-organic-analysis", countsTowardOrganicAnalysis(organicOutside.evidenceClass) && !countsTowardOrganicAnalysis(nhs.evidenceClass), organicOutside.evidenceClass);
  record("18-authority-not-commercial-count", !countsTowardCommercialCompetitorTotal(nhs.evidenceClass), nhs.evidenceClass);
  record(
    "19-irrelevant-not-scored",
    !countsTowardOpportunityScoring(academic.evidenceClass) && !countsTowardOpportunityScoring(nhs.evidenceClass) && countsTowardOpportunityScoring(placesPharmacy.evidenceClass),
    academic.evidenceClass,
  );
  record("20-raw-evidence-fields", Boolean(academic.url && academic.title && academic.query), academic.url);
  record("21-provenance", academic.provider === "dataforseo-google-organic-live" && organicLocal.capturedAt === "2026-09-28T16:23:11.000Z", academic.provider);
  record("22-confidence", placesPharmacy.confidence === "high" && academic.confidence === "high", placesPharmacy.confidence);

  const batch = [placesPharmacy, placesRestaurant, organicLocal, organicOutside, national, nhs, government, directory, academic, music, historical, foreignDoc, servicePage, blog, coincidence];
  const unclassified = batch.filter((row) => !COMMERCIAL_EVIDENCE_CLASSES.includes(row.evidenceClass));
  record("23-zero-unclassified", unclassified.length === 0, String(unclassified.length));

  const otherTenant = q({ ...organicOutside, domain: "second-pharmacy.example", url: "https://second-pharmacy.example/services/blood-pressure", title: "Second Pharmacy blood pressure" });
  record("24-tenant-isolation", otherTenant.domain !== organicOutside.domain && otherTenant.evidenceClass === "ORGANIC_COMMERCIAL_COMPETITOR", otherTenant.domain);
  const second = q({
    name: "Second Chemist",
    source: "google-places",
    provider: "google-places",
    placeId: "ChIJSecond",
    primaryCategory: "pharmacy",
    categories: ["pharmacy"],
  });
  record("25-second-pharmacy", second.evidenceClass === placesPharmacy.evidenceClass, second.evidenceClass);

  const production = [
    "src/pharmacy/organicSearchEvidenceClassification.ts",
    "src/pharmacy/competitorAnalysisOrganicSearchService.ts",
    "src/pharmacy/googleLocalCompetitorMetricsService.ts",
    "src/pharmacy/growthEngineOpportunityEngine.ts",
    "src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts",
    "src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts",
    "artifacts/api-server/src/routes/masterAdminPlatformPage.ts",
  ].map((rel) => fs.readFileSync(path.join(ROOT, rel), "utf8")).join("\n");
  record("26-no-gilbert-literals", !/gilbert-pharmacy-health-clinic/i.test(production), "production sources");

  writeJson("data/pharmacy-competitor-intelligence/ceq-stale-pharmacy-intelligence.json", {
    slug: "ceq-stale-pharmacy",
    generatedAt: "2026-09-28T10:00:00.000Z",
    source: "google-places-live",
    pharmacy: { name: "Fixture Pharmacy", address: "1 High Street", postcode: "PA1 1AA" },
    competitors: [
      { name: "Fixture Chemist", placeId: "ChIJLocal", source: "google-places", primaryType: "pharmacy", categories: ["pharmacy"], distanceKm: 0.5, website: "https://fixture-chemist.example", rating: 4, reviewCount: 10 },
      { name: "Harbour Restaurant", placeId: "ChIJFood", source: "google-places", primaryType: "restaurant", categories: ["restaurant"], distanceKm: 0.2, website: "", rating: 4, reviewCount: 10 },
    ],
  });
  writeJson("data/growth-engine/ceq-stale-pharmacy-competitors.json", {
    version: 1,
    slug: "ceq-stale-pharmacy",
    generatedAt: "2026-09-28T10:05:00.000Z",
    source: "google-places-live",
    pharmacy: { name: "Fixture Pharmacy", address: "1 High Street", postcode: "PA1 1AA" },
    yourPharmacy: null,
    competitors: [
      { businessName: "Fixture Chemist", placeId: "ChIJLocal", source: "google-places", primaryCategory: "pharmacy", distanceKm: 0.5 },
      { businessName: "Harbour Restaurant", placeId: "ChIJFood", source: "google-places", primaryCategory: "restaurant", distanceKm: 0.2 },
    ],
    analysis: { dataSource: "google-places-live", competitorCount: 2, comparisons: [] },
  });
  writeJson("data/growth-engine/ceq-stale-pharmacy-opportunities.json", {
    version: 1,
    slug: "ceq-stale-pharmacy",
    generatedAt: "2026-09-28T10:06:00.000Z",
    opportunities: [{ id: "google-reviews-gap", title: "Reviews", evidenceSource: "Google Places" }],
    dataSources: ["Google Places"],
  });
  const before = fs.statSync(path.join(tmp, "data/growth-engine/ceq-stale-pharmacy-competitors.json")).mtimeMs;
  const qualified = qualifiedLocalCommercialPlaceIds("ceq-stale-pharmacy");
  record("27-revision-invalidates", isLocalMarketQualificationStale("ceq-stale-pharmacy") && isGrowthIntelligenceQualificationStale("ceq-stale-pharmacy") && qualified.join(",") === "ChIJLocal", qualified.join(","));
  record("28-stale-does-not-complete", isCurrentLocalMarketIntelligence("ceq-stale-pharmacy") === false, "local market completion");
  const after = fs.statSync(path.join(tmp, "data/growth-engine/ceq-stale-pharmacy-competitors.json")).mtimeMs;
  const oppAfter = fs.readFileSync(path.join(tmp, "data/growth-engine/ceq-stale-pharmacy-opportunities.json"), "utf8");
  record("29-no-automatic-local-market", before === after, "snapshot bytes untouched");
  record("30-no-automatic-growth", oppAfter.includes("google-reviews-gap") && !oppAfter.includes("regenerated"), "opportunity file untouched");

  const workflow = fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts"), "utf8");
  const dashboard = fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"), "utf8");
  const page = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  record(
    "31-explicit-action-required",
    workflow.includes("rebuild: true") && !dashboard.includes("deriveLocalMarketSnapshotFromStoredCompetitorAnalysis"),
    "rebuild stays on the explicit local-market action",
  );
  record("32-auth-path", page.includes("withAuthHandoff") && page.includes("continue-workflow"), "authenticated continue");

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
