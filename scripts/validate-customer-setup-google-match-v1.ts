#!/usr/bin/env npx tsx
/**
 * Customer Setup Import Accuracy V1 — Google match validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildScoredGoogleCandidate,
  confirmCustomerSetupGoogleListing,
  detectNationalChainWebsite,
  readSetupProfile,
  scoreGoogleListingCandidate,
  shouldAutoConfirmGoogleMatch,
  GOOGLE_MATCH_AUTO_CONFIRM_THRESHOLD,
} from "../src/pharmacy/growthEngineCustomerSetupGoogleMatchService.ts";
import { runCustomerSetupStart } from "../src/pharmacy/growthEngineCustomerSetupStartService.ts";
import { buildCustomerSetupConfirmView } from "../src/pharmacy/growthEngineCustomerSetupConfirmService.ts";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";
import { normalizeProfileData, PROFILE_SCHEMA_VERSION } from "../src/pharmacy/pharmacyProfileSchema.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const TEST_SLUG = `setup-google-match-${Date.now()}`;
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${TEST_SLUG}.json`);
const BRAND_DIR = path.join(ROOT, "config/projects", TEST_SLUG);
const SNAPSHOT_PATH = path.join(ROOT, "data/growth-engine", `${TEST_SLUG}-competitors.json`);

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

function writeTestProfile(slug: string, data: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(PROFILE_PATH), { recursive: true });
  fs.writeFileSync(
    PROFILE_PATH,
    JSON.stringify(
      {
        slug,
        updatedAt: new Date().toISOString(),
        version: PROFILE_SCHEMA_VERSION,
        data: normalizeProfileData(data),
      },
      null,
      2,
    ),
  );
}

function cleanup(): void {
  for (const file of [PROFILE_PATH, SNAPSHOT_PATH]) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
  try {
    if (fs.existsSync(BRAND_DIR)) fs.rmSync(BRAND_DIR, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

async function main() {
  console.log("\n=== Customer Setup Google Match V1 ===\n");

  record("service-module", fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineCustomerSetupGoogleMatchService.ts")), "module");

  const apiSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngine.ts"), "utf8");
  record("route-google-select", apiSrc.includes("/setup-google-select"), "POST setup-google-select");
  record("route-google-search", apiSrc.includes("/setup-google-search"), "POST setup-google-search");

  const hints = {
    pharmacyName: "Rowlands Pharmacy",
    town: "Manchester",
    postcode: "M1 1AE",
    phone: "01612345678",
    website: "https://rowlandspharmacy.co.uk/",
  };

  const wrongMatch = buildScoredGoogleCandidate(
    {
      placeId: "ChIJWrongDelivered",
      businessName: "Pharmacy Delivered",
      address: "Unit 5 Industrial Estate, Leeds LS1 1AA",
      postcode: "LS1 1AA",
      phone: "08001234567",
      website: "https://pharmacydelivered.example/",
      rating: null,
      reviewCount: 0,
      primaryCategory: "Courier service",
    },
    hints,
  );

  const goodMatch = buildScoredGoogleCandidate(
    {
      placeId: "ChIJGoodRowlands",
      businessName: "Rowlands Pharmacy - Manchester",
      address: "1 Deansgate, Manchester M1 1AE",
      postcode: "M1 1AE",
      phone: "01612345678",
      website: "https://rowlandspharmacy.co.uk/",
      rating: 4.6,
      reviewCount: 42,
      photoCount: 8,
      primaryCategory: "Pharmacy",
    },
    hints,
  );

  record("wrong-match-low-score", wrongMatch.confidence < GOOGLE_MATCH_AUTO_CONFIRM_THRESHOLD, `${wrongMatch.confidence}%`);
  record("good-match-high-score", goodMatch.confidence >= GOOGLE_MATCH_AUTO_CONFIRM_THRESHOLD, `${goodMatch.confidence}%`);
  record(
    "wrong-match-not-auto-confirmed",
    !shouldAutoConfirmGoogleMatch([wrongMatch, goodMatch], false, false) ||
      !shouldAutoConfirmGoogleMatch([wrongMatch], false, false),
    "uncertain/wrong blocked",
  );
  record(
    "national-website-blocks-auto",
    !shouldAutoConfirmGoogleMatch([goodMatch], true, false),
    detectNationalChainWebsite(hints.website) ? "rowlands national" : "detect",
  );
  record("national-website-detect", detectNationalChainWebsite("https://www.rowlandspharmacy.co.uk/"), "rowlands");

  writeTestProfile(TEST_SLUG, {
    pharmacyName: hints.pharmacyName,
    website: hints.website,
    primaryTown: hints.town,
    townCity: hints.town,
    postcode: hints.postcode,
    phone: hints.phone,
    customerSetupGoogleMatchStatus: "possible_match",
    customerSetupGoogleCandidates: [wrongMatch, goodMatch],
    customerSetupNationalWebsiteDetected: true,
    websiteAnalysisAt: new Date().toISOString(),
    websiteImportedFieldKeys: ["logoUrl", "brandPrimaryColor"],
  });

  const view = buildCustomerSetupConfirmView(TEST_SLUG);
  record("uncertain-status", view.googleSection.status === "possible_match", view.googleSection.statusLabel);
  record("selector-visible", view.googleListingSelector.visible && view.googleListingSelector.candidates.length === 2, "2 candidates");
  record("selector-headline", view.googleListingSelector.headline.includes("Possible Google listings found"), "headline");
  record("national-banner-data", view.googleListingSelector.nationalWebsiteWarning === true, "national flag");

  const html = renderCustomerSetupConfirmPage(TEST_SLUG);
  record("page-selector-ui", html.includes("This is my pharmacy") && html.includes("Not my pharmacy"), "selector actions");
  record("page-search-again", html.includes("Search again"), "search again");
  record("page-manual-maps", html.includes("Add Google Maps link manually"), "manual maps");
  record("page-national-banner", html.includes("national or multi-location website"), "banner copy");
  record("page-no-imported-badge-google", !html.includes('css-badge imported">Imported'), "no Imported badge");
  record("page-possible-match-badge", html.includes("Possible Match"), "Possible Match");
  record("website-separate-notice", html.includes("Website data comes from your website only"), "website notice");
  record(
    "website-not-google-phone",
    !view.websiteSection.rows.some((r) => r.label === "Contact details" && r.value.includes("01612345678")),
    view.websiteSection.rows.find((r) => r.label === "Contact details")?.value || "email only",
  );

  await confirmCustomerSetupGoogleListing(TEST_SLUG, goodMatch.placeId);
  const saved = readSetupProfile(TEST_SLUG);
  record("selected-listing-saved", saved.customerSetupGoogleMatchStatus === "confirmed", saved.customerSetupGoogleMatchStatus);
  record("google-place-id-saved", saved.googlePlaceId === goodMatch.placeId, saved.googlePlaceId || "");
  record("rating-imported", saved.customerSetupGoogleListing?.rating === 4.6, String(saved.customerSetupGoogleListing?.rating));
  record("reviews-imported", saved.customerSetupGoogleListing?.reviewCount === 42, String(saved.customerSetupGoogleListing?.reviewCount));
  record("photos-imported", saved.customerSetupGoogleListing?.photoCount === 8, String(saved.customerSetupGoogleListing?.photoCount));
  record("category-imported", saved.customerSetupGoogleListing?.primaryCategory === "Pharmacy", saved.customerSetupGoogleListing?.primaryCategory || "");
  record("google-keys-separate", (saved.googleImportedFieldKeys || []).length > 0 && !(saved.websiteImportedFieldKeys || []).includes("googlePlaceId"), "separate keys");

  await runCustomerSetupStart(`${TEST_SLUG}-flow`, {
    pharmacyName: "Rowlands Pharmacy",
    website: "https://rowlandspharmacy.co.uk/",
    town: "Manchester",
    postcode: "M1 1AE",
    phone: "01612345678",
  });
  const flowProfile = readSetupProfile(`${TEST_SLUG}-flow`);
  record(
    "step1-no-silent-wrong-google",
    flowProfile.customerSetupGoogleMatchStatus !== "confirmed" || Boolean(flowProfile.customerSetupGoogleListing?.placeId),
    flowProfile.customerSetupGoogleMatchStatus,
  );
  record(
    "step1-national-flag",
    flowProfile.customerSetupNationalWebsiteDetected === true,
    String(flowProfile.customerSetupNationalWebsiteDetected),
  );

  try {
    if (fs.existsSync(path.join(ROOT, "data/pharmacy-profiles", `${TEST_SLUG}-flow.json`))) {
      fs.unlinkSync(path.join(ROOT, "data/pharmacy-profiles", `${TEST_SLUG}-flow.json`));
    }
    if (fs.existsSync(path.join(ROOT, "config/projects", `${TEST_SLUG}-flow`))) {
      fs.rmSync(path.join(ROOT, "config/projects", `${TEST_SLUG}-flow`), { recursive: true, force: true });
    }
  } catch {
    /* ignore */
  }

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
