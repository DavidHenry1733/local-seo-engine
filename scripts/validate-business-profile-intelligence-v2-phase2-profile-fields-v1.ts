#!/usr/bin/env npx tsx
/**
 * Business Profile Intelligence V2 — Phase 2 profile fields validation.
 * Confirms schema, round-trip, intelligence mapping, backwards compatibility.
 * Does NOT assert generator output (generators not wired in Phase 2).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildBusinessProfileIntelligenceFromProfile } from "../src/pharmacy/businessProfileIntelligence/buildBusinessProfileIntelligence.ts";
import { profileHasV2Fields } from "../src/pharmacy/businessProfileIntelligence/mapProfileV2ToIntelligence.ts";
import {
  normalizeProfileData,
  normalizeProfileDoc,
  PROFILE_SCHEMA_VERSION,
  type PharmacyProfileData,
} from "../src/pharmacy/pharmacyProfileSchema.ts";
import { defaultProfileServiceDelivery } from "../src/pharmacy/pharmacyProfileV2Fields.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILES_DIR = path.join(ROOT, "data/pharmacy-profiles");

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

function loadSlug(slug: string) {
  const file = path.join(PROFILES_DIR, `${slug}.json`);
  return normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8")));
}

function roundTrip(data: PharmacyProfileData): PharmacyProfileData {
  return normalizeProfileData(data as unknown as Record<string, unknown>);
}

function main() {
  console.log("\n=== Business Profile Intelligence V2 — Phase 2 Profile Fields ===\n");

  record("schema-version-v5", PROFILE_SCHEMA_VERSION === 5, `v${PROFILE_SCHEMA_VERSION}`);

  for (const slug of ["dhmdigital", "pharmaconnect"]) {
    const doc = loadSlug(slug);
    record(`${slug}:loads`, Boolean(doc.data.pharmacyName), doc.data.pharmacyName);

    const intelLegacy = buildBusinessProfileIntelligenceFromProfile(slug, doc.data, doc.updatedAt, doc.version);
    record(`${slug}:intelligence-from-legacy`, Boolean(intelLegacy.identity.businessName), intelLegacy.identity.businessName);

    const rt = roundTrip(doc.data);
    record(`${slug}:round-trip-name`, rt.pharmacyName === doc.data.pharmacyName, rt.pharmacyName);
    record(`${slug}:v2-defaults-present`, Boolean(rt.contentIntelligence?.toneOfVoice), rt.contentIntelligence.toneOfVoice);
    record(`${slug}:service-delivery-map`, typeof rt.serviceDeliveryProfiles === "object", `${Object.keys(rt.serviceDeliveryProfiles).length} services`);

    const enriched: PharmacyProfileData = roundTrip({
      ...doc.data,
      tagline: "Test tagline for V2",
      businessDescription: "Independent community pharmacy serving local patients.",
      serviceDeliveryProfiles: {
        "blood-pressure-checks": {
          ...defaultProfileServiceDelivery("blood-pressure-checks", "Blood Pressure Checks"),
          fundingModel: "nhs",
          pricing: "Free NHS service",
          walkInAvailable: true,
          resultsProcess: "Pharmacist explains reading same day",
        },
      },
      contentIntelligence: {
        ...rt.contentIntelligence,
        toneOfVoice: "warm",
        mentionReviews: true,
      },
    });

    record(`${slug}:v2-tagline-saved`, enriched.tagline === "Test tagline for V2", enriched.tagline);
    record(
      `${slug}:v2-service-pricing`,
      enriched.serviceDeliveryProfiles["blood-pressure-checks"]?.pricing === "Free NHS service",
      enriched.serviceDeliveryProfiles["blood-pressure-checks"]?.pricing || "missing",
    );

    const intelEnriched = buildBusinessProfileIntelligenceFromProfile(slug, enriched, doc.updatedAt, PROFILE_SCHEMA_VERSION);
    record(
      `${slug}:intelligence-uses-v2-tagline`,
      intelEnriched.identity.tagline === "Test tagline for V2",
      intelEnriched.identity.tagline,
    );
    record(
      `${slug}:intelligence-uses-service-pricing`,
      intelEnriched.services.byServiceId["blood-pressure-checks"]?.pricing === "Free NHS service",
      intelEnriched.services.byServiceId["blood-pressure-checks"]?.pricing || "missing",
    );
    record(
      `${slug}:intelligence-content-tone`,
      intelEnriched.content.toneOfVoice === "warm",
      String(intelEnriched.content.toneOfVoice),
    );
    record(`${slug}:has-v2-helper`, profileHasV2Fields(enriched), "profileHasV2Fields true after enrichment");

    const intelAfterRt = buildBusinessProfileIntelligenceFromProfile(slug, roundTrip(enriched), doc.updatedAt, PROFILE_SCHEMA_VERSION);
    record(
      `${slug}:round-trip-intelligence`,
      intelAfterRt.services.byServiceId["blood-pressure-checks"]?.pricing === "Free NHS service",
      "pricing preserved through normalize round-trip",
    );
  }

  const blank = normalizeProfileData({});
  record("blank-profile-v2-defaults", blank.contentIntelligence.readingLevel === "plain-english", blank.contentIntelligence.readingLevel);

  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n${passed}/${checks.length} checks passed\n`);
  if (checks.some((c) => !c.pass)) process.exit(1);
}

main();
