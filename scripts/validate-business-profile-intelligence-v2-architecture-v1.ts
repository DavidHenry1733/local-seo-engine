#!/usr/bin/env npx tsx
/**
 * Business Profile Intelligence V2 — Phase 1 architecture validation.
 * Does not modify profiles, generators, or existing validation scripts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildBusinessProfileIntelligenceFromProfile } from "../src/pharmacy/businessProfileIntelligence/buildBusinessProfileIntelligence.ts";
import { defaultBusinessProfileIntelligence } from "../src/pharmacy/businessProfileIntelligence/businessProfileIntelligenceDefaults.ts";
import { BUSINESS_PROFILE_INTELLIGENCE_VERSION } from "../src/pharmacy/businessProfileIntelligence/businessProfileIntelligenceTypes.ts";
import { normalizeProfileDoc } from "../src/pharmacy/pharmacyProfileSchema.ts";

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

function loadProfile(slug: string) {
  const file = path.join(PROFILES_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8")));
}

function main() {
  console.log("\n=== Business Profile Intelligence V2 — Phase 1 Architecture ===\n");

  const defaults = defaultBusinessProfileIntelligence("test");
  record("defaults:version", defaults.version === BUSINESS_PROFILE_INTELLIGENCE_VERSION, defaults.version);
  record("defaults:sections", Boolean(defaults.identity && defaults.brand && defaults.ai), "all 10 sections present");

  for (const slug of ["dhmdigital", "pharmaconnect"]) {
    const doc = loadProfile(slug);
    record(`${slug}:profile-exists`, Boolean(doc), doc ? "loaded" : "missing");
    if (!doc) continue;

    const intel = buildBusinessProfileIntelligenceFromProfile(doc.slug, doc.data, doc.updatedAt, doc.version);
    record(`${slug}:intelligence-built`, intel.slug === slug, intel.provenance.builtAt);
    record(`${slug}:identity-name`, Boolean(intel.identity.businessName), intel.identity.businessName);
    record(`${slug}:location-town`, Boolean(intel.location.primaryTown), intel.location.primaryTown);
    record(`${slug}:conversion-phone`, Boolean(intel.conversion.telephone), intel.conversion.telephone);
    record(`${slug}:services-count`, Object.keys(intel.services.byServiceId).length > 0, `${Object.keys(intel.services.byServiceId).length} services`);
    record(`${slug}:team-reviewer`, intel.team.members.some((m) => m.isPrimaryReviewer), intel.team.members[0]?.name || "none");
    record(`${slug}:patients-groups`, intel.patients.targetGroups.length >= 0, `${intel.patients.targetGroups.length} groups`);
    record(`${slug}:content-tone`, Boolean(intel.content.toneOfVoice), String(intel.content.toneOfVoice));
    record(`${slug}:ai-guardrails`, intel.ai.doNotInventWithoutProfile.length > 0, `${intel.ai.doNotInventWithoutProfile.length} rules`);
    record(`${slug}:migration-notes`, intel.provenance.migrationNotes.length > 0, `${intel.provenance.migrationNotes.length} notes`);
  }

  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n${passed}/${checks.length} checks passed\n`);
  if (checks.some((c) => !c.pass)) process.exit(1);
}

main();
