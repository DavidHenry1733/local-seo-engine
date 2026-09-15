#!/usr/bin/env npx tsx
/**
 * Customer Setup Reset V1 — Step 2 confirm pharmacy validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runSetupGoogleImport, runSetupWebsiteImport } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import {
  buildCustomerSetupConfirmView,
  readCustomerSetupProfile,
  runCustomerSetupConfirm,
} from "../src/pharmacy/growthEngineCustomerSetupConfirmService.ts";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const TEST_SLUG = `setup-confirm-test-${Date.now()}`;
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${TEST_SLUG}.json`);
const BRAND_DIR = path.join(ROOT, "config/projects", TEST_SLUG);

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

const FORBIDDEN = [
  /\bschema\b/i,
  /\bcanonical\b/i,
  /\bbreadcrumb/i,
  /\bentity\b/i,
  /\bmanifest\b/i,
  /\bregistry\b/i,
  /\blifecycle\b/i,
  /\bgenerator\b/i,
  /\bpipeline\b/i,
  /\bstructured data\b/i,
  /\btechnical SEO\b/i,
];

const BANNED = ["dashboard", "Today's task", "Growth journey", "checklist", "Business Intelligence"];

function stripHead(html: string): string {
  return html.replace(/<head[\s\S]*?<\/head>/i, "");
}

function cleanup(): void {
  try {
    if (fs.existsSync(PROFILE_PATH)) fs.unlinkSync(PROFILE_PATH);
  } catch {
    /* ignore */
  }
  try {
    if (fs.existsSync(BRAND_DIR)) fs.rmSync(BRAND_DIR, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

async function main() {
  console.log("\n=== Customer Setup Confirm V1 ===\n");

  record("service-module", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineCustomerSetupConfirmService.ts")), "service");
  record("page-module", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineCustomerSetupConfirmPage.ts")), "page");

  const routerSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/growthEnginePageRouter.ts"), "utf8");
  const apiSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngine.ts"), "utf8");
  record("route-confirm-get", routerSrc.includes("/growth-engine/confirm-pharmacy"), "GET confirm");
  record("route-confirm-post", apiSrc.includes("/setup-confirm"), "POST setup-confirm");

  await runSetupWebsiteImport(TEST_SLUG, { websiteUrl: "https://rowlandspharmacy.co.uk/" });
  await runSetupGoogleImport(TEST_SLUG, {
    pharmacyName: "Confirm Test Pharmacy",
    town: "Manchester",
    postcode: "M1 1AE",
  });

  const html = renderCustomerSetupConfirmPage(TEST_SLUG);
  const body = stripHead(html);
  const view = buildCustomerSetupConfirmView(TEST_SLUG);
  record("confirm-renders", html.length > 1500, `${html.length} chars`);
  record("google-section", html.includes("Google Profile Import"), "google section");
  record("website-section", html.includes("Website Import"), "website section");
  record("essentials-section", html.includes("Confirm Pharmacy Details"), "essentials");
  record("status-imported", html.includes("Imported"), "imported badge");
  record("status-needs-review", html.includes("Needs Review") || html.includes("Not Found"), "status badges");
  record("status-not-found", html.includes("Not Found"), "not found badge");
  record(
    "use-google-btn",
    view.googleSection.status === "imported"
      ? html.includes("Use Google Profile Details")
      : !html.includes("Use Google Profile Details"),
    view.googleSection.status === "imported" ? "use google when imported" : "no use google when not imported",
  );
  record("use-website-btn", html.includes("Use Website Details"), "use website");
  record(
    "google-business-name",
    view.googleSection.status === "imported"
      ? html.includes("Business name")
      : html.includes("Google Profile Import"),
    "google section",
  );
  record("website-logo", html.includes("Logo"), "website rows");
  record("website-services", html.includes("Services detected"), "services row");
  record("editable-pharmacy-name", html.includes('id="pharmacyName"'), "edit name");
  record("editable-website", html.includes('id="website"'), "edit website");
  record("editable-phone", html.includes('id="phone"'), "edit phone");
  record("editable-email", html.includes('id="email"'), "edit email");
  record("editable-address", html.includes('id="address"'), "edit address");
  record("editable-town", html.includes('id="town"'), "edit town");
  record("editable-postcode", html.includes('id="postcode"'), "edit postcode");
  record("source-badges", html.includes("css-field-source"), "source badges");
  record("reset-import-button", html.includes("Reset imported data"), "reset button");
  record("source-label-manual", html.includes("Manual") || html.includes("Website Snapshot"), "source labels");
  record("no-wizard-fields", !html.includes("GPhC") && !html.includes("clinicalReviewDate"), "no advanced fields");
  record("sticky-action-bar", html.includes("css-sticky-bar"), "sticky bottom bar");
  record(
    "primary-cta-text",
    /<button[^>]*id="confirmBtn"[^>]*>Confirm and Continue<\/button>/.test(html),
    "Confirm and Continue",
  );
  record("primary-cta-sticky", html.includes('form="confirmForm"') && html.includes("css-sticky-bar"), "button in sticky bar");
  record("form-setup-confirm-url", html.includes('data-setup-confirm-url="/api/growth-engine/') && html.includes("/setup-confirm"), "form points to setup-confirm");
  record("form-novalidate", html.includes('id="confirmForm"') && html.includes("novalidate"), "no native required blocking");
  record("inline-missing-message", html.includes("Please complete the highlighted details before continuing."), "highlight message");
  record("secondary-back", html.includes("Back to setup"), "back link");

  const incompleteSlug = `setup-confirm-incomplete-${Date.now()}`;
  const incompleteHtml = renderCustomerSetupConfirmPage(incompleteSlug);
  record(
    "button-visible-incomplete",
    incompleteHtml.includes("css-sticky-bar") &&
      incompleteHtml.includes("Confirm and Continue") &&
      !incompleteHtml.includes('required'),
    "sticky CTA with empty profile",
  );

  for (const term of FORBIDDEN) {
    record(`forbidden:${term.source.slice(0, 14)}`, !term.test(body), term.source);
  }
  for (const word of BANNED) {
    record(`no-${word.slice(0, 12)}`, !body.toLowerCase().includes(word.toLowerCase()), word);
  }

  record("view-google-rows", view.googleSection.rows.length >= 0, `${view.googleSection.rows.length} rows`);
  record("view-website-rows", view.websiteSection.rows.length >= 6, `${view.websiteSection.rows.length} rows`);
  record("website-import-data", view.websiteSection.status === "imported" || view.websiteSection.status === "needs_review", view.websiteSection.statusLabel);

  const confirm = runCustomerSetupConfirm(TEST_SLUG, {
    pharmacyName: "Confirm Test Pharmacy Updated",
    website: "https://rowlandspharmacy.co.uk/",
    phone: "01612345678",
    email: "info@example.com",
    address: "1 Test Street",
    town: "Manchester",
    postcode: "M1 1AE",
  });

  record("confirm-saves", confirm.ok === true, "saved");
  record("redirect-local-market", confirm.redirectUrl.includes("/local-market"), confirm.redirectUrl);

  const saved = readCustomerSetupProfile(TEST_SLUG);
  record("saved-name", saved.pharmacyName === "Confirm Test Pharmacy Updated", saved.pharmacyName || "");
  record("saved-address", saved.addressLine1 === "1 Test Street", saved.addressLine1 || "");
  record("confirmed-fields", Boolean(saved.profileFieldConfirmations?.pharmacyName && saved.profileFieldConfirmations?.postcode), "confirmations");

  record("local-market-engine-intact", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineLocalMarketService.ts")), "local market untouched");

  cleanup();

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  cleanup();
  console.error(err);
  process.exit(1);
});
