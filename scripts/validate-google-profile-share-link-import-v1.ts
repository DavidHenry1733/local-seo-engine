#!/usr/bin/env npx tsx
/**
 * Google Profile Share Link Import V1 validation (incl. kgmid resolution).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildScoredGoogleCandidate,
  buildKgMidSearchQuery,
  isPlausibleKgMidTextSearchCandidate,
  shouldAutoConfirmGoogleMatch,
  GOOGLE_MATCH_AUTO_CONFIRM_THRESHOLD,
  parseGooglePlaceIdFromUrl,
} from "../src/pharmacy/growthEngineCustomerSetupGoogleMatchService.ts";
import {
  extractKgMidFromGoogleUrl,
  extractGoogleSearchQueryFromUrl,
  extractPlaceIdFromGoogleUrl,
  resolveGoogleBusinessProfileUrl,
} from "../src/pharmacy/growthEngineGoogleProfileUrlResolver.ts";
import {
  diagnoseGoogleProfileImport,
  formatCandidateLine,
} from "../src/pharmacy/growthEngineGoogleProfileImportDiagnostics.ts";
import { PHARMACY_DELIVERED_TEST_SLUG } from "../src/pharmacy/growthEngineCustomerSetupTestTenants.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const TEST_SCRIPT = path.join(ROOT, "scripts/test-google-profile-import-v1.ts");
const RESOLVER = path.join(ROOT, "src/pharmacy/growthEngineGoogleProfileUrlResolver.ts");
const DIAGNOSTICS = path.join(ROOT, "src/pharmacy/growthEngineGoogleProfileImportDiagnostics.ts");
const PROFILE = path.join(ROOT, "data/pharmacy-profiles", `${PHARMACY_DELIVERED_TEST_SLUG}.json`);

const SAMPLE_SEARCH_URL =
  "https://www.google.com/search?client=firefox-b-d&kgmid=/g/11b5pj59m8&q=Pharmacy+Delivered&shem=epsd1&source=sh/x/loc/uni/m1/1";

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

function loadEnv(): void {
  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

async function main() {
  console.log("\n=== Google Profile Share Link Import V1 ===\n");
  loadEnv();

  record("test-script-exists", fs.existsSync(TEST_SCRIPT), TEST_SCRIPT);
  record("resolver-module", fs.existsSync(RESOLVER), RESOLVER);
  record("diagnostics-module", fs.existsSync(DIAGNOSTICS), DIAGNOSTICS);
  record("test-tenant-profile", fs.existsSync(PROFILE), PHARMACY_DELIVERED_TEST_SLUG);

  const testSrc = fs.readFileSync(TEST_SCRIPT, "utf8");
  record("test-script-kgmid-output", testSrc.includes("kgmid detected"), "kgmid");
  record("test-script-q-output", testSrc.includes("q parameter detected"), "q param");
  record("test-script-possible-match", testSrc.includes("Possible Match"), "possible match");

  const kgmid = extractKgMidFromGoogleUrl(SAMPLE_SEARCH_URL);
  record("kgmid-extracted", kgmid === "/g/11b5pj59m8", kgmid);

  const encodedUrl =
    "https://www.google.com/search?kgmid=%2Fg%2F11b5pj59m8&q=Pharmacy+Delivered";
  record("kgmid-encoded-extracted", extractKgMidFromGoogleUrl(encodedUrl) === "/g/11b5pj59m8", extractKgMidFromGoogleUrl(encodedUrl));

  const q = extractGoogleSearchQueryFromUrl(SAMPLE_SEARCH_URL);
  record("q-param-extracted", q === "Pharmacy Delivered", q);

  const queryUrl = "https://www.google.com/maps/search/?api=1&query_place_id=ChIJSampleFromQueryParam99";
  record("parse-from-query-place-id", parseGooglePlaceIdFromUrl(queryUrl) === "ChIJSampleFromQueryParam99", parseGooglePlaceIdFromUrl(queryUrl));
  record("extract-wrapper", extractPlaceIdFromGoogleUrl(queryUrl) === "ChIJSampleFromQueryParam99", "place id wrapper");

  const hints = {
    pharmacyName: "Pharmacy Delivered 4U",
    town: "Rotherham",
    postcode: "S60 2NN",
    searchQueryFromUrl: "Pharmacy Delivered",
    kgMid: "/g/11b5pj59m8",
  };
  const kgQuery = buildKgMidSearchQuery(hints);
  record("kgmid-search-query", kgQuery.includes("Pharmacy") && kgQuery.includes("Delivered"), kgQuery);

  const lowConfidenceCandidate = buildScoredGoogleCandidate(
    {
      placeId: "ChIJPharmacyDelivered",
      businessName: "Pharmacy Delivered",
      address: "Unit 1, Rotherham S60 2NN",
      postcode: "S602NN",
      phone: "01709123456",
      primaryCategory: "Pharmacy",
      rating: 4.2,
      reviewCount: 12,
    },
    hints,
  );
  record(
    "plausible-kgmid-single",
    isPlausibleKgMidTextSearchCandidate(lowConfidenceCandidate, hints),
    `confidence ${lowConfidenceCandidate.confidence}%`,
  );
  record(
    "single-not-auto-confirmed",
    !shouldAutoConfirmGoogleMatch([lowConfidenceCandidate], false, false),
    "needs review only",
  );
  record(
    "below-auto-threshold",
    lowConfidenceCandidate.confidence < GOOGLE_MATCH_AUTO_CONFIRM_THRESHOLD,
    `${lowConfidenceCandidate.confidence}% < ${GOOGLE_MATCH_AUTO_CONFIRM_THRESHOLD}%`,
  );

  const coreBefore = readSetupProfile(PHARMACY_DELIVERED_TEST_SLUG);
  const diag = await diagnoseGoogleProfileImport(PHARMACY_DELIVERED_TEST_SLUG, SAMPLE_SEARCH_URL);
  const coreAfter = readSetupProfile(PHARMACY_DELIVERED_TEST_SLUG);
  record("diagnose-kgmid-field", diag.kgMidDetected === "/g/11b5pj59m8", diag.kgMidDetected);
  record("diagnose-q-field", diag.searchQueryFromUrl === "Pharmacy Delivered", diag.searchQueryFromUrl);
  record("diagnose-entity-hint", diag.entityHintUsed === true, String(diag.entityHintUsed));
  record(
    "core-profile-not-overwritten",
    coreAfter.pharmacyName === coreBefore.pharmacyName && !coreAfter.googlePlaceId,
    coreAfter.pharmacyName,
  );

  if (process.env.GOOGLE_PLACES_API_KEY) {
    record(
      "live-share-link-candidates",
      diag.candidateCount >= 1 || diag.possibleMatch,
      `candidates=${diag.candidateCount} possibleMatch=${diag.possibleMatch}`,
    );
  } else {
    record("live-share-link-skipped", true, "no API key — static checks only");
  }

  record("format-candidate-line", formatCandidateLine(lowConfidenceCandidate, 0).includes("Pharmacy Delivered"), "formatter");

  const resolved = await resolveGoogleBusinessProfileUrl("https://www.google.com/maps");
  record("resolve-returns-shape", Boolean(resolved.inputUrl && resolved.finalUrl), resolved.finalUrl.slice(0, 60));

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) {
    failed.forEach((c) => console.error(`  FAIL ${c.id}: ${c.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
