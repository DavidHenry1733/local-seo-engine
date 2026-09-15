#!/usr/bin/env npx tsx
/**
 * Customer Setup Reset V1 — Step 1 start screen validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  customerSetupConfirmUrl,
  customerSetupStartUrl,
  parseGooglePlaceIdFromUrl,
  runCustomerSetupStart,
} from "../src/pharmacy/growthEngineCustomerSetupStartService.ts";
import {
  runSetupGoogleImport,
  runSetupWebsiteImport,
  readSetupProfile,
} from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import {
  renderCustomerSetupStartPage,
} from "../src/pharmacy/growthEngineCustomerSetupStartPage.ts";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const TEST_SLUG = `setup-start-test-${Date.now()}`;
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

const BANNED_PAGE_WORDS = [
  "dashboard",
  "Today's task",
  "Growth journey",
  "Your Local Market",
  "report preview",
  "checklist",
  "Business Intelligence",
];

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
  console.log("\n=== Customer Setup Start V1 ===\n");

  record("service-module", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineCustomerSetupStartService.ts")), "service");
  record("page-module", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineCustomerSetupStartPage.ts")), "page");

  const routerSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/growthEnginePageRouter.ts"), "utf8");
  const apiSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngine.ts"), "utf8");
  record("route-start-get", routerSrc.includes("/growth-engine/start"), "GET start");
  record("route-confirm-get", routerSrc.includes("/growth-engine/confirm-pharmacy"), "GET confirm");
  record("route-setup-post", apiSrc.includes("/setup-google-import") && apiSrc.includes("/setup-website-import"), "split import routes");
  record("route-reset-post", apiSrc.includes("/setup-reset-imports"), "POST setup-reset-imports");

  const html = renderCustomerSetupStartPage(TEST_SLUG);
  const body = stripHead(html);
  record("start-page-renders", html.length > 800, `${html.length} chars`);
  record("headline", html.includes("Set up your pharmacy"), "purpose headline");
  record("google-card", html.includes("Import Google Business Profile"), "google card");
  record("website-card", html.includes("Import Website"), "website card");
  record("field-google-url", html.includes('id="googleBusinessUrl"'), "google url");
  record("field-google-name", html.includes('id="googlePharmacyName"'), "google name");
  record("field-google-town", html.includes('id="googleTown"'), "google town");
  record("field-google-postcode", html.includes('id="googlePostcode"'), "google postcode");
  record("field-website-url", html.includes('id="websiteUrl"'), "website url");
  record("primary-google-cta", html.includes("Find Google Profile"), "find google");
  record("primary-website-cta", html.includes("Import Website"), "import website");
  record("continue-cta", html.includes("Review Imported Details"), "continue");
  record("reset-import-button", html.includes("Reset imported data"), "reset button");
  record("google-help", html.includes("Where do I find my Google Profile link?"), "google help");
  record("setup-start-url", html.includes('data-page="customer-setup-start"'), "start page marker");

  for (const term of FORBIDDEN) {
    record(`forbidden:${term.source.slice(0, 16)}`, !term.test(body), term.source);
  }
  for (const word of BANNED_PAGE_WORDS) {
    record(`no-${word.slice(0, 14).replace(/\s+/g, "-")}`, !body.toLowerCase().includes(word.toLowerCase()), word);
  }

  record(
    "parse-place-id",
    parseGooglePlaceIdFromUrl("https://www.google.com/maps/place/?q=place_id:ChIJTestPlaceId1234567890") === "ChIJTestPlaceId1234567890",
    "place id parser",
  );

  const confirmHtml = renderCustomerSetupConfirmPage(TEST_SLUG);
  record("confirm-page", confirmHtml.includes("Review Imported Details"), "confirm headline");
  record("confirm-sections", confirmHtml.includes("Google Profile Import") && confirmHtml.includes("Website Import"), "import sections");
  record("confirm-url", confirmHtml.includes('data-page="customer-setup-confirm"'), "confirm page marker");

  try {
    await runSetupWebsiteImport(TEST_SLUG, { websiteUrl: "https://rowlandspharmacy.co.uk/" });
    await runSetupGoogleImport(TEST_SLUG, {
      pharmacyName: "Setup Test Pharmacy",
      town: "London",
      postcode: "SW1A 1AA",
    });

    const result = await runCustomerSetupStart(TEST_SLUG, {
      website: "https://rowlandspharmacy.co.uk/",
      pharmacyName: "Setup Test Pharmacy",
      town: "London",
      postcode: "SW1A 1AA",
    });

    record("submit-ok", result.ok === true, "setup ran");
    record("redirect-confirm", result.redirectUrl.includes("/confirm-pharmacy"), result.redirectUrl);

    record("profile-saved", fs.existsSync(PROFILE_PATH), PROFILE_PATH);
    const data = readSetupProfile(TEST_SLUG);
    record("website-snapshot", Boolean(data.websiteImportSnapshot), "websiteImportSnapshot");
    record("google-snapshot", Boolean(data.googleImportSnapshot), "googleImportSnapshot");
    record("core-not-written", !data.pharmacyName && !data.googlePlaceId, "core fields isolated");
    record("website-snapshot-url", Boolean(data.websiteImportSnapshot?.websiteUrl), data.websiteImportSnapshot?.websiteUrl || "");
    record("google-search-meta", data.googleImportSnapshot?.searchPharmacyName === "Setup Test Pharmacy", data.googleImportSnapshot?.searchPharmacyName || "");
  } catch (err) {
    record("submit-ok", false, err instanceof Error ? err.message : String(err));
    record("redirect-confirm", false, "skipped");
    record("profile-saved", false, "skipped");
    record("website-snapshot", false, "skipped");
    record("google-snapshot", false, "skipped");
    record("core-not-written", false, "skipped");
    record("website-snapshot-url", false, "skipped");
    record("google-search-meta", false, "skipped");
  }

  record("engine-framework-intact", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineFrameworkService.ts")), "framework");
  record("engine-website-intact", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineWebsiteIntelligenceService.ts")), "website intel");
  record("engine-local-intact", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineLocalMarketService.ts")), "local market");
  record("bpi-intact", fs.existsSync(path.join(ROOT, "src/pharmacy/pharmacyWebsiteAnalysisService.ts")), "website analysis");

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
