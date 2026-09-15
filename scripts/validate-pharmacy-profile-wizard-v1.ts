#!/usr/bin/env npx tsx
/**
 * Business Profile Wizard V2 — navigation, scoring, enrichment, save/resume, backwards compatibility.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeProfileData,
  normalizeProfileDoc,
  type PharmacyProfileData,
} from "../src/pharmacy/pharmacyProfileSchema.ts";
import {
  computeWizardQualityScore,
  wizardProgressPercent,
} from "../src/pharmacy/pharmacyProfileWizardScoring.ts";
import {
  WIZARD_STEPS,
  WIZARD_TOTAL_STEPS,
  WIZARD_VERSION,
  validateWizardStep,
  clampWizardStep,
  resolveInitialWizardStep,
} from "../src/pharmacy/pharmacyProfileWizardSteps.ts";
import { buildWizardImportFields, mapDiscoveredCompetitorsToProfile } from "../src/pharmacy/pharmacyProfileWizardEnrichment.ts";
import { PATIENT_GROUP_OPTIONS, selectedPatientGroupIds } from "../src/pharmacy/pharmacyProfileWizardPresets.ts";
import { isRequiredProfileComplete } from "../src/pharmacy/pharmacyProfileFieldClassification.ts";
import { renderProfileWizardHtml } from "../src/pharmacy/pharmacyProfileWizardPage.ts";

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

function loadSlug(slug: string): PharmacyProfileData {
  const file = path.join(PROFILES_DIR, `${slug}.json`);
  return normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8"))).data;
}

function main() {
  console.log("\n=== Business Profile Wizard V2 ===\n");

  record("wizard-version", WIZARD_VERSION === 2, `v${WIZARD_VERSION}`);
  record("wizard-steps-count", WIZARD_STEPS.length === WIZARD_TOTAL_STEPS, `${WIZARD_TOTAL_STEPS} steps`);
  record("wizard-step-ids-unique", new Set(WIZARD_STEPS.map((s) => s.id)).size === WIZARD_STEPS.length, "unique ids");
  record("wizard-step-import-first", WIZARD_STEPS[0]?.id === "import", WIZARD_STEPS[0]?.id || "");
  record("wizard-no-team-step", !WIZARD_STEPS.some((s) => s.id === "team"), "team merged into trust");
  record("wizard-local-step", WIZARD_STEPS.some((s) => s.id === "local"), "local intelligence step");

  for (const slug of ["dhmdigital", "pharmaconnect"]) {
    const data = loadSlug(slug);
    record(`${slug}:loads-into-wizard`, Boolean(data.pharmacyName), data.pharmacyName);

    const html = renderProfileWizardHtml(slug, data);
    record(`${slug}:renders-html`, html.includes("Business Profile Wizard"), "page title");
    record(`${slug}:v2-auto-enriched-copy`, html.includes("Auto-enriched setup"), "V2 header");
    record(`${slug}:all-step-panels`, (html.match(/data-wizard-step="/g) || []).length >= WIZARD_TOTAL_STEPS, "step panels");
    record(`${slug}:import-badges`, html.includes("wizard-import-badge"), "import status UI");
    record(`${slug}:accept-field-ui`, html.includes("data-accept-field"), "smart confirmation Accept");
    record(`${slug}:help-icons`, html.includes("wizard-help"), "? help tooltips");
    record(`${slug}:local-preview`, html.includes("wizard-local-preview"), "local intel preview");
    record(`${slug}:finish-growth-engine`, html.includes("/api/growth-engine?slug="), "finish redirect");
    record(`${slug}:patient-checkboxes`, html.includes("wizard-patient-cb"), "patient group checkboxes");
    record(`${slug}:local-enrich-btn`, html.includes("btnWizardEnrichLocal"), "local enrich button");
    record(`${slug}:competitor-host`, html.includes("wizardCompetitorHost"), "competitor UI");
    record(`${slug}:progress-bar`, html.includes("wizard-progress-fill"), "progress UI");
    record(`${slug}:quality-score-ui`, html.includes("wizardQualityLabel"), "quality label");
    record(`${slug}:auto-save-hook`, html.includes("scheduleAutoSave"), "client autosave");
    record(`${slug}:wizard-validate-api`, html.includes("/wizard-validate"), "validation endpoint");
    record(`${slug}:wizard-enrich-api`, html.includes("/wizard-enrich-local"), "local enrich endpoint");
    record(`${slug}:legacy-link`, html.includes("legacy=1"), "legacy form link");

    const importFields = buildWizardImportFields(data);
    record(`${slug}:import-field-builder`, importFields.length >= 8, `${importFields.length} fields`);

    const initialStep = resolveInitialWizardStep(data);
    record(`${slug}:resume-step-default`, initialStep >= 1 && initialStep <= WIZARD_TOTAL_STEPS, String(initialStep));

    const withStep = normalizeProfileData({ ...data, profileWizardStep: 5 });
    record(`${slug}:resume-step-saved`, withStep.profileWizardStep === 5, "profileWizardStep round-trip");

    const quality = computeWizardQualityScore(data);
    record(`${slug}:quality-band`, ["poor", "good", "excellent"].includes(quality.band), quality.bandLabel);
    record(`${slug}:quality-categories`, quality.categories.length === 7, `${quality.categories.length} categories`);
    record(`${slug}:quality-local-category`, quality.categories.some((c) => c.id === "local"), "local category");
    record(`${slug}:ready-flag`, quality.readyToGenerate === isRequiredProfileComplete(data), String(quality.readyToGenerate));

    const progress = wizardProgressPercent(5);
    record(`${slug}:progress-step-5`, progress === 57, `${progress}%`);

    record(`${slug}:validate-step1`, validateWizardStep(1, data) === null, "import ok");
    const step2Err = validateWizardStep(2, { ...data, pharmacyName: "" });
    record(`${slug}:validate-step2-required`, step2Err !== null, step2Err || "blocks empty name");

    const patientIds = selectedPatientGroupIds(["Older patients", "Families"]);
    record(`${slug}:patient-preset-map`, patientIds.length >= 2, patientIds.join(","));

    const competitors = mapDiscoveredCompetitorsToProfile([
      {
        name: "Test Pharmacy",
        address: "1 High St",
        distanceKm: 0.5,
        distanceLabel: "0.5 km",
        rating: 4.2,
        reviewCount: 10,
        website: "https://example.com",
        phone: "",
        placeId: "abc",
        latitude: null,
        longitude: null,
        source: "demo-fallback",
      },
    ]);
    record(`${slug}:competitor-map`, competitors[0]?.name === "Test Pharmacy", "competitor mapper");

    const minimalReady = normalizeProfileData({
      pharmacyName: "Test Pharmacy",
      phone: "01709210731",
      website: "https://example.com",
      addressLine1: "1 High Street",
      townCity: "Sheffield",
      postcode: "S1 1AA",
      primaryTown: "Sheffield",
      selectedAreas: [{ areaName: "Ecclesall", priority: 1, order: 1, selected: true, source: "test" }],
      reviewerName: "Test Reviewer",
      clinicalReviewDate: "2026-01-01",
      nextReviewDate: "2027-01-01",
    });
    record(`${slug}:ready-minimal-profile`, isRequiredProfileComplete(minimalReady), "required complete");
  }

  record("patient-presets-count", PATIENT_GROUP_OPTIONS.length >= 10, String(PATIENT_GROUP_OPTIONS.length));

  const empty = normalizeProfileData({});
  record("empty-profile-backwards-compatible", empty.profileWizardStep === 1, "default step 1");
  record("empty-competitors-default", Array.isArray(empty.profileCompetitors) && empty.profileCompetitors.length === 0, "competitors []");
  record("empty-not-ready", !computeWizardQualityScore(empty).readyToGenerate, "not ready");

  const oldStep10 = normalizeProfileData({ profileWizardStep: 10 });
  record("legacy-step-clamped", oldStep10.profileWizardStep === 8, "step 10 → 8");

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
