#!/usr/bin/env npx tsx
/**
 * Emergency Import Debug V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runSetupGoogleImport,
  runSetupWebsiteImport,
  resetSetupImports,
  readSetupProfile,
  seedCustomerSetupAdminBaseline,
} from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { buildSetupDebugReport, SETUP_STALE_NEEDLES } from "../src/pharmacy/growthEngineCustomerSetupDebugService.ts";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";
import { buildCustomerSetupConfirmView } from "../src/pharmacy/growthEngineCustomerSetupConfirmService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const SLUG = "rowlands-test";
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const DIST_PATH = path.join(ROOT, "artifacts/api-server/dist/index.mjs");

const STALE = [...SETUP_STALE_NEEDLES];

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

function htmlHasStale(html: string): string | null {
  for (const needle of STALE) {
    if (html.includes(needle)) return needle;
  }
  return null;
}

async function main() {
  console.log("\n=== Emergency Import Debug V1 ===\n");

  if (!fs.existsSync(PROFILE_PATH)) {
    record("profile-exists", false, PROFILE_PATH);
    process.exit(1);
  }

  const backup = fs.readFileSync(PROFILE_PATH, "utf8");
  const apiSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngine.ts"), "utf8");
  record("route-setup-debug", apiSrc.includes("/setup-debug"), "GET setup-debug");

  if (fs.existsSync(DIST_PATH)) {
    const dist = fs.readFileSync(DIST_PATH, "utf8");
    record("dist-uses-snapshots", dist.includes("websiteImportSnapshot"), "bundle includes snapshot confirm");
    record("dist-not-legacy-website-section", !dist.includes("function buildWebsiteSection(data2)"), "legacy website section removed");
  } else {
    record("dist-exists", false, "run api-server build before deploy");
  }

  seedCustomerSetupAdminBaseline(SLUG, {
    pharmacyName: "Rowlands Pharmacy",
    website: "https://rowlandspharmacy.co.uk/",
    town: "Rotherham",
    postcode: "S60 2NN",
    phone: "01709 982977",
    email: "",
    platformClientStatus: "setup_required",
  });

  resetSetupImports(SLUG);
  const afterReset = readSetupProfile(SLUG);
  const viewReset = buildCustomerSetupConfirmView(SLUG);
  const htmlReset = renderCustomerSetupConfirmPage(SLUG);
  const debugReset = buildSetupDebugReport(SLUG);

  record("reset-no-stale-email-core", !afterReset.businessEmail.includes("patientexperience"), afterReset.businessEmail || "(empty)");
  record(
    "reset-no-stale-description-core",
    !String(afterReset.businessDescription).includes("400 pharmacies"),
    String(afterReset.businessDescription || "(empty)").slice(0, 40),
  );
  record(
    "reset-no-imported-keys",
    (afterReset.websiteImportedFieldKeys || []).length === 0,
    `${(afterReset.websiteImportedFieldKeys || []).length} keys`,
  );
  record(
    "confirm-google-not-imported",
    viewReset.googleSection.notice === "Google Business Profile not imported yet.",
    viewReset.googleSection.notice,
  );
  record(
    "confirm-website-not-imported",
    viewReset.websiteSection.notice === "Website not imported yet.",
    viewReset.websiteSection.notice,
  );
  record("confirm-no-stale-html", !htmlHasStale(htmlReset), htmlHasStale(htmlReset) || "clean");
  record("debug-no-snapshots", !debugReset.googleImportSnapshotExists && !debugReset.websiteImportSnapshotExists, "snapshots absent");
  record("debug-confirm-not-stale", !debugReset.confirmHtmlStale, `confirmHtmlStale=${debugReset.confirmHtmlStale}`);
  record(
    "debug-form-source-baseline",
    debugReset.confirmFieldsUsed.formFieldsSource === "customerSetupAdminBaseline",
    debugReset.confirmFieldsUsed.formFieldsSource,
  );
  record(
    "debug-website-source-none",
    debugReset.confirmFieldsUsed.websiteSectionSource === "none",
    debugReset.confirmFieldsUsed.websiteSectionSource,
  );
  record("debug-identifies-profile-path", debugReset.profilePath.endsWith(`${SLUG}.json`), debugReset.profilePath);

  await runSetupWebsiteImport(SLUG, { websiteUrl: "https://rowlandspharmacy.co.uk/" });
  const afterWebsite = readSetupProfile(SLUG);
  const viewWebsite = buildCustomerSetupConfirmView(SLUG);
  const htmlWebsite = renderCustomerSetupConfirmPage(SLUG);
  const debugWebsite = buildSetupDebugReport(SLUG);

  record("website-snapshot-exists", Boolean(afterWebsite.websiteImportSnapshot?.importedAt), "website snapshot");
  record(
    "website-section-from-snapshot",
    viewWebsite.websiteSection.status === "imported" && viewWebsite.websiteSection.rows.length > 0,
    `${viewWebsite.websiteSection.rows.length} rows`,
  );
  record(
    "website-core-unchanged",
    afterWebsite.pharmacyName === "Rowlands Pharmacy",
    afterWebsite.pharmacyName,
  );
  record("debug-website-source-snapshot", debugWebsite.confirmFieldsUsed.websiteSectionSource === "websiteImportSnapshot", "source");

  resetSetupImports(SLUG);
  await runSetupGoogleImport(SLUG, {
    pharmacyName: "Rowlands Pharmacy",
    town: "Rotherham",
    postcode: "S60 2NN",
  });
  const afterGoogle = readSetupProfile(SLUG);
  const viewGoogle = buildCustomerSetupConfirmView(SLUG);
  const debugGoogle = buildSetupDebugReport(SLUG);

  record("google-snapshot-written", Boolean(afterGoogle.googleImportSnapshot?.importedAt), "google snapshot");
  record(
    "google-section-only-after-import",
    viewGoogle.googleSection.status !== "not_found" || viewGoogle.googleSection.notice !== "Google Business Profile not imported yet.",
    viewGoogle.googleSection.notice,
  );
  record("debug-google-source", debugGoogle.confirmFieldsUsed.googleSectionSource === "googleImportSnapshot", debugGoogle.confirmFieldsUsed.googleSectionSource);

  const htmlFinal = renderCustomerSetupConfirmPage(SLUG);
  record("final-no-stale-after-reset-path", !htmlHasStale(htmlReset), "reset path clean");

  fs.writeFileSync(PROFILE_PATH, backup);
  record("profile-restored", true, SLUG);

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
