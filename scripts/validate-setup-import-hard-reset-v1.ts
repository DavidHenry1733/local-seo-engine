#!/usr/bin/env npx tsx
/**
 * Setup Import Hard Reset V1 validation.
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
import {
  buildCustomerSetupConfirmView,
  formatCustomerSetupSourceLabel,
} from "../src/pharmacy/growthEngineCustomerSetupConfirmService.ts";
import { renderCustomerSetupStartPage } from "../src/pharmacy/growthEngineCustomerSetupStartPage.ts";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const POLLUTED_SLUG = "rowlands-test";
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${POLLUTED_SLUG}.json`);

const CORE_IMPORT_FIELDS = [
  "googlePlaceId",
  "googleBusinessProfileUrl",
  "logoUrl",
  "businessDescription",
  "businessEmail",
] as const;

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

function snapshotOnlyAfterImport(
  before: ReturnType<typeof readSetupProfile>,
  after: ReturnType<typeof readSetupProfile>,
  snapshotKey: "googleImportSnapshot" | "websiteImportSnapshot",
): boolean {
  for (const key of CORE_IMPORT_FIELDS) {
    const b = String((before as Record<string, unknown>)[key] || "").trim();
    const a = String((after as Record<string, unknown>)[key] || "").trim();
    if (a !== b) return false;
  }
  return Boolean(after[snapshotKey]);
}

async function main() {
  console.log("\n=== Setup Import Hard Reset V1 ===\n");

  if (!fs.existsSync(PROFILE_PATH)) {
    record("rowlands-profile-exists", false, `Missing ${PROFILE_PATH}`);
    process.exit(1);
  }

  const profileBackup = fs.readFileSync(PROFILE_PATH, "utf8");
  const backupDoc = JSON.parse(profileBackup);
  const polluted = backupDoc.data || {};

  record(
    "rowlands-polluted-name",
    polluted.pharmacyName === "Pharmacy Delivered",
    `polluted pharmacyName=${polluted.pharmacyName}`,
  );
  record(
    "rowlands-polluted-email",
    String(polluted.businessEmail || "").includes("rowlandspharmacy.co.uk"),
    `polluted email present`,
  );

  const apiSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngine.ts"), "utf8");
  record("route-reset-imports", apiSrc.includes("/setup-reset-imports"), "POST setup-reset-imports");

  const startHtml = renderCustomerSetupStartPage(POLLUTED_SLUG);
  const confirmHtmlBefore = renderCustomerSetupConfirmPage(POLLUTED_SLUG);
  record("start-reset-button", startHtml.includes("Reset imported data"), "start reset button");
  record("confirm-reset-button", confirmHtmlBefore.includes("Reset imported data"), "confirm reset button");
  record("source-label-helper", formatCustomerSetupSourceLabel("google") === "Google Snapshot", "google source label");
  record("source-label-website", formatCustomerSetupSourceLabel("website") === "Website Snapshot", "website source label");
  record("source-label-manual", formatCustomerSetupSourceLabel("manual") === "Manual", "manual source label");
  record("confirm-source-labels-html", confirmHtmlBefore.includes("Google Snapshot") || confirmHtmlBefore.includes("Manual"), "source labels in HTML");

  seedCustomerSetupAdminBaseline(POLLUTED_SLUG, {
    pharmacyName: "Rowlands Pharmacy",
    website: "https://rowlandspharmacy.co.uk/",
    town: "Rotherham",
    postcode: "S60 2NN",
    phone: "01709 982977",
    email: "",
    adminNotes: polluted.adminNotes || "",
    platformClientStatus: polluted.platformClientStatus || "setup_required",
  });

  const afterBaselineSeed = readSetupProfile(POLLUTED_SLUG);
  const viewBeforeReset = buildCustomerSetupConfirmView(POLLUTED_SLUG);
  const confirmHtmlBaseline = renderCustomerSetupConfirmPage(POLLUTED_SLUG);

  record(
    "confirm-google-not-imported-before-reset",
    viewBeforeReset.googleSection.notice === "Google Business Profile not imported yet.",
    viewBeforeReset.googleSection.notice,
  );
  record(
    "confirm-website-not-imported-before-reset",
    viewBeforeReset.websiteSection.notice === "Website not imported yet.",
    viewBeforeReset.websiteSection.notice,
  );
  record(
    "confirm-no-pharmacy-delivered-google-rows",
    !viewBeforeReset.googleSection.rows.some((r) => r.value.includes("Pharmacy Delivered")),
    "no Pharmacy Delivered in google rows",
  );
  record(
    "confirm-no-rowlands-email-website-rows",
    !viewBeforeReset.websiteSection.rows.some((r) => r.value.includes("patientexperience@rowlandspharmacy")),
    "no Rowlands email in website rows",
  );
  record(
    "confirm-form-uses-baseline-not-polluted",
    viewBeforeReset.fields.pharmacyName.value === "Rowlands Pharmacy" &&
      !viewBeforeReset.fields.pharmacyName.value.includes("Pharmacy Delivered"),
    `form pharmacyName=${viewBeforeReset.fields.pharmacyName.value}`,
  );
  record(
    "confirm-html-not-imported-notices",
    confirmHtmlBaseline.includes("Google Business Profile not imported yet.") &&
      confirmHtmlBaseline.includes("Website not imported yet."),
    "not imported notices in HTML",
  );

  resetSetupImports(POLLUTED_SLUG);
  const afterReset = readSetupProfile(POLLUTED_SLUG);
  const viewAfterReset = buildCustomerSetupConfirmView(POLLUTED_SLUG);
  const confirmHtmlAfter = renderCustomerSetupConfirmPage(POLLUTED_SLUG);

  record("reset-clears-google-snapshot", !afterReset.googleImportSnapshot, "googleImportSnapshot null");
  record("reset-clears-website-snapshot", !afterReset.websiteImportSnapshot, "websiteImportSnapshot null");
  record(
    "reset-clears-imported-keys",
    (afterReset.websiteImportedFieldKeys || []).length === 0 &&
      (afterReset.googleImportedFieldKeys || []).length === 0,
    "imported field keys cleared",
  );
  record(
    "reset-clears-confirmations",
    Object.keys(afterReset.profileFieldConfirmations || {}).length === 0,
    "profileFieldConfirmations cleared",
  );
  record(
    "reset-clears-stale-google-url",
    !String(afterReset.googleBusinessProfileUrl || "").includes("share.google"),
    "stale google url cleared",
  );
  record(
    "reset-clears-stale-description",
    !String(afterReset.businessDescription || "").includes("400 pharmacies"),
    "stale Rowlands description cleared",
  );
  record(
    "reset-preserves-admin-name",
    afterReset.pharmacyName === "Rowlands Pharmacy",
    `pharmacyName=${afterReset.pharmacyName}`,
  );
  record(
    "reset-preserves-admin-website",
    afterReset.website === "https://rowlandspharmacy.co.uk/",
    `website=${afterReset.website}`,
  );
  record(
    "reset-preserves-admin-town-postcode",
    afterReset.primaryTown === "Rotherham" && afterReset.postcode === "S60 2NN",
    `${afterReset.primaryTown} ${afterReset.postcode}`,
  );
  record(
    "after-reset-no-stale-html",
    !confirmHtmlAfter.includes("Pharmacy Delivered") &&
      !confirmHtmlAfter.includes("patientexperience@rowlandspharmacy.co.uk"),
    "confirm HTML clean after reset",
  );
  record(
    "after-reset-not-imported-notices",
    viewAfterReset.googleSection.notice === "Google Business Profile not imported yet." &&
      viewAfterReset.websiteSection.notice === "Website not imported yet.",
    "not imported after reset",
  );

  const beforeGoogleOnly = readSetupProfile(POLLUTED_SLUG);
  await runSetupGoogleImport(POLLUTED_SLUG, {
    pharmacyName: "Rowlands Pharmacy",
    town: "Rotherham",
    postcode: "S60 2NN",
  });
  const afterGoogleOnly = readSetupProfile(POLLUTED_SLUG);
  record(
    "google-import-snapshot-only",
    snapshotOnlyAfterImport(beforeGoogleOnly, afterGoogleOnly, "googleImportSnapshot"),
    "google import writes snapshot only",
  );
  record(
    "google-import-core-name-unchanged",
    afterGoogleOnly.pharmacyName === "Rowlands Pharmacy",
    "core pharmacyName unchanged after google import",
  );

  resetSetupImports(POLLUTED_SLUG);
  const beforeWebsiteOnly = readSetupProfile(POLLUTED_SLUG);
  await runSetupWebsiteImport(POLLUTED_SLUG, { websiteUrl: "https://rowlandspharmacy.co.uk/" });
  const afterWebsiteOnly = readSetupProfile(POLLUTED_SLUG);
  record(
    "website-import-snapshot-only",
    snapshotOnlyAfterImport(beforeWebsiteOnly, afterWebsiteOnly, "websiteImportSnapshot"),
    "website import writes snapshot only",
  );
  record(
    "website-import-core-website-unchanged",
    afterWebsiteOnly.website === "https://rowlandspharmacy.co.uk/",
    "core website unchanged after website import",
  );

  const freshView = buildCustomerSetupConfirmView(POLLUTED_SLUG);
  record(
    "website-section-reads-snapshot",
    freshView.websiteSection.rows.some((r) => r.label === "Website URL") ||
      freshView.websiteSection.status !== "not_found",
    `website section status=${freshView.websiteSection.status}`,
  );

  fs.writeFileSync(PROFILE_PATH, profileBackup);
  record("rowlands-profile-restored", fs.readFileSync(PROFILE_PATH, "utf8") === profileBackup, "profile restored");

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) {
    failed.forEach((c) => console.error(`  FAIL ${c.id}: ${c.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  try {
    if (fs.existsSync(PROFILE_PATH)) {
      const backupPath = PROFILE_PATH + ".bak-hard-reset-v1";
      if (fs.existsSync(backupPath)) fs.writeFileSync(PROFILE_PATH, fs.readFileSync(backupPath, "utf8"));
    }
  } catch {
    /* ignore */
  }
  process.exit(1);
});
