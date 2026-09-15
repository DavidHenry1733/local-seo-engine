#!/usr/bin/env npx tsx
/**
 * Sprint 1 — Business Intelligence Optimisation V1 validation.
 * Import classification, typing reduction, wizard usability, backwards compatibility.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROFILE_FIELD_AUDIT,
  auditEntriesByInputType,
  websiteImportFieldKeys,
} from "../src/pharmacy/pharmacyProfileFieldAudit.ts";
import { normalizeProfileData, normalizeProfileDoc } from "../src/pharmacy/pharmacyProfileSchema.ts";
import {
  buildWizardImportFields,
  buildImportBrandSummary,
  buildLocalIntelPreview,
  countImportSummary,
  mergeWebsiteImportedFieldKeys,
} from "../src/pharmacy/pharmacyProfileWizardEnrichment.ts";
import {
  extractBusinessDescriptionFromHtml,
  extractOpeningHoursFromHtml,
} from "../src/pharmacy/pharmacyWebsiteAnalysisService.ts";
import { computeWizardQualityScore } from "../src/pharmacy/pharmacyProfileWizardScoring.ts";
import { renderProfileWizardHtml } from "../src/pharmacy/pharmacyProfileWizardPage.ts";
import { renderBusinessIntelligencePage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import {
  SERVICE_REFERRAL_OPTIONS,
  SERVICE_RESULTS_OPTIONS,
} from "../src/pharmacy/pharmacyProfileWizardPresets.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILES = path.join(ROOT, "data/pharmacy-profiles");

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
  const file = path.join(PROFILES, `${slug}.json`);
  return normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8"))).data;
}

function main() {
  console.log("\n=== Sprint 1 — Business Intelligence Optimisation V1 ===\n");

  // --- Part 1: Field audit ---
  record("audit-exists", PROFILE_FIELD_AUDIT.length >= 35, `${PROFILE_FIELD_AUDIT.length} fields audited`);
  record("audit-unique-keys", new Set(PROFILE_FIELD_AUDIT.map((e) => e.fieldKey)).size === PROFILE_FIELD_AUDIT.length, "unique field keys");
  record("audit-website-import", auditEntriesByInputType("website-import").length >= 15, `${auditEntriesByInputType("website-import").length} website-import fields`);
  record("audit-checkbox-dropdown", auditEntriesByInputType("checkbox").length >= 3 && auditEntriesByInputType("dropdown").length >= 2, "checkbox + dropdown classified");
  record("audit-deprecated-remove", auditEntriesByInputType("remove").some((e) => e.fieldKey === "email"), "legacy email marked remove");
  record("website-import-keys", websiteImportFieldKeys().includes("businessDescription") && websiteImportFieldKeys().includes("openingHours"), "description + hours in audit");

  // --- Part 2 & 3: Website import expansion ---
  const sampleHtml = `<html><head>
<meta name="description" content="Independent community pharmacy offering NHS services, travel health and private consultations in Sheffield."/>
<script type="application/ld+json">{"openingHoursSpecification":[{"dayOfWeek":"Monday","opens":"09:00","closes":"18:00"},{"dayOfWeek":"Tuesday","opens":"09:00","closes":"18:00"}]}</script>
</head></html>`;
  const desc = extractBusinessDescriptionFromHtml(sampleHtml);
  record("extract-description", desc.includes("community pharmacy"), desc.slice(0, 60));
  const hours = extractOpeningHoursFromHtml(sampleHtml);
  record("extract-hours-monday", Boolean(hours.openingHoursMonday), String(hours.openingHoursMonday || "none"));
  record("extract-hours-no-invent", !extractBusinessDescriptionFromHtml("<html><body>Hi</body></html>"), "empty when no meta");

  // --- Part 4: Smart confirmation model ---
  const withImport = normalizeProfileData({
    pharmacyName: "Test Pharmacy",
    phone: "01709210731",
    websiteImportedFieldKeys: ["pharmacyName", "phone"],
    profileFieldConfirmations: { phone: "2026-06-09T12:00:00.000Z" },
  });
  const fields = buildWizardImportFields(withImport);
  const nameField = fields.find((f) => f.fieldKey === "pharmacyName");
  const phoneField = fields.find((f) => f.fieldKey === "phone");
  record("status-review", nameField?.status === "review", nameField?.status || "");
  record("status-confirmed", phoneField?.status === "confirmed", phoneField?.status || "");
  const summary = countImportSummary(fields);
  record("import-summary-review", typeof summary.review === "number", `review=${summary.review}`);

  record("merge-import-keys", mergeWebsiteImportedFieldKeys(["a"], ["b", "a"]).length === 2, "dedupe merge");

  // --- Part 5: Service presets ---
  record("service-referral-presets", SERVICE_REFERRAL_OPTIONS.length >= 4, String(SERVICE_REFERRAL_OPTIONS.length));
  record("service-results-presets", SERVICE_RESULTS_OPTIONS.length >= 3, String(SERVICE_RESULTS_OPTIONS.length));

  // --- Part 6: Local intel preview ---
  const localData = normalizeProfileData({
    googlePlaceId: "ChIJtest",
    profileCompetitors: [{ id: "1", name: "A", selected: true }],
    gpSurgeries: [{ id: "g1", name: "GP", selected: true }],
  });
  const local = buildLocalIntelPreview(localData);
  record("local-google-found", local.googlePlaceFound, local.googlePlaceLabel);
  record("local-competitors", local.competitorCount >= 1, String(local.competitorCount));
  record("local-gp-count", local.gpCount >= 1, String(local.gpCount));

  // --- Part 7: Profile quality ---
  const importedProfile = normalizeProfileData({
    pharmacyName: "Demo",
    phone: "01709210731",
    website: "https://example.com",
    addressLine1: "1 High St",
    postcode: "S1 1AA",
    townCity: "Sheffield",
    websiteAnalysisAt: "2026-01-01T00:00:00.000Z",
    profileFieldConfirmations: { pharmacyName: "x", phone: "x", website: "x", addressLine1: "x" },
    logoUrl: "https://example.com/logo.png",
    brandPrimaryColor: "#005eb8",
  });
  const quality = computeWizardQualityScore(importedProfile);
  record("quality-import-category", quality.categories.some((c) => c.id === "business"), "business category");
  record("quality-estimated-time", quality.estimatedMinutesRemaining >= 2 && quality.estimatedMinutesRemaining <= 15, `${quality.estimatedMinutesRemaining} min`);
  record("quality-import-summary", Boolean(quality.importSummary), "import summary attached");

  // --- Part 8 & 9: Wizard + BI UI ---
  for (const slug of ["dhmdigital", "pharmaconnect"]) {
    const data = loadSlug(slug);
    const wizardHtml = renderProfileWizardHtml(slug, data);
    record(`${slug}:wizard-help-icons`, wizardHtml.includes("wizard-help"), "? help icons");
    record(`${slug}:wizard-accept-btn`, wizardHtml.includes("data-accept-field"), "Accept buttons");
    record(`${slug}:wizard-confirmations-hidden`, wizardHtml.includes("profileFieldConfirmations"), "confirmations persist field");
    record(`${slug}:wizard-local-preview`, wizardHtml.includes("wizard-local-preview"), "local intel preview");
    record(`${slug}:wizard-svc-quick`, wizardHtml.includes("wizard-svc-quick") || wizardHtml.includes("wizard-svc-funding"), "service quick setup");
    record(`${slug}:wizard-ready-label`, wizardHtml.includes("Ready to Generate") || wizardHtml.includes("required items left"), "completion meta");
    record(`${slug}:wizard-finish-growth-engine`, wizardHtml.includes("/api/growth-engine?slug="), "finish → Growth Engine");

    const biHtml = renderBusinessIntelligencePage(slug, data);
    record(`${slug}:bi-profile-heading`, biHtml.includes("Your pharmacy profile"), "BI hero");
    record(`${slug}:bi-import-badges`, biHtml.includes("ge-import-badge"), "import status badges");
    record(`${slug}:bi-local-preview`, biHtml.includes("Local intelligence preview"), "local preview section");
    record(`${slug}:bi-time-estimate`, biHtml.includes("min to finish"), "time estimate");
    record(`${slug}:bi-wizard-link`, biHtml.includes("Review &amp; confirm in wizard"), "wizard CTA");

    const brand = buildImportBrandSummary(data);
    record(`${slug}:brand-summary`, typeof brand.servicesDetected === "number", `services=${brand.servicesDetected}`);
  }

  // --- Backwards compatibility ---
  const empty = normalizeProfileData({});
  record("empty-website-import-keys", Array.isArray(empty.websiteImportedFieldKeys) && empty.websiteImportedFieldKeys.length === 0, "[] default");
  record("empty-confirmations", empty.profileFieldConfirmations && typeof empty.profileFieldConfirmations === "object", "object default");
  record("legacy-profile-loads", Boolean(loadSlug("pharmaconnect").pharmacyName), "existing tenant loads");

  // --- Docs ---
  record("docs-sprint1", fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-SPRINT1-BI-V1.md")), "documentation file");

  // --- Locked systems guard (generators / BPI paths still present, untouched by this sprint) ---
  record("generators-intact", fs.existsSync(path.join(ROOT, "src/generator/brandImporter.ts")), "brand importer present");
  record("bpi-intact", fs.existsSync(path.join(ROOT, "src/pharmacy/businessProfileIntelligence/businessProfileIntelligenceTypes.ts")), "BPI module present");

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
