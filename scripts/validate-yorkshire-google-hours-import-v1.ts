#!/usr/bin/env npx tsx
/**
 * YORKSHIRE-PHARMACY-GOOGLE-HOURS-IMPORT-FIX-01
 * Isolated mapping/display checks. No Google Places or crawl calls.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "yorkshire-pharmacy-and-health-clinic";

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

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sourceChecks() {
  const page = read("artifacts/api-server/src/routes/masterAdminPlatformPage.ts");
  const service = read("src/pharmacy/masterAdminBusinessProfileReviewService.ts");
  const hours = read("src/pharmacy/masterAdminBusinessProfileOpeningHoursService.ts");
  const logic = read("src/pharmacy/masterAdminBusinessProfileReviewLogic.ts");

  record("table-headers", page.includes("<th>Day</th><th>Opening hours</th>"), "BPR hours table uses Day | Opening hours");
  record(
    "seven-day-labels",
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].every((day) =>
      page.includes("'" + day + "'") || hours.includes('"' + day + '"'),
    ),
    "Monday through Sunday labels exist",
  );
  record("confirm-hours-action", page.includes(">Confirm hours</button>"), "One Confirm hours action");
  record("google-badge", page.includes("Imported from Google") && hours.includes("Imported from Google"), "Imported from Google badge");
  record("no-hardcoded-times-ui", !/bprOpeningHoursCard[\s\S]{0,1800}9:00 AM/.test(page), "Hours table renderer does not hard-code example times");
  record(
    "precedence",
    hours.includes('source: "google"') && hours.includes('source: "website"') && hours.includes('source: "none"') && hours.includes('source: "conflict"'),
    "Google > website > manual, with conflict branch",
  );
  record(
    "uses-imported-evidence",
    service.includes("googleSnapshotOpeningHours") && service.includes("googleIntelOpeningHours"),
    "BPR reads Google snapshot and intelligence hours",
  );
  record(
    "no-auto-accept-summary",
    !logic.includes('"openingHoursSummary"]') || !/GOOGLE_ONLY[\s\S]{0,220}openingHoursSummary/.test(logic),
    "Opening hours summary is not silently auto-accepted",
  );
  record("persist-on-confirm", service.includes("persistConfirmedWeeklyHours"), "Confirmed hours persist to canonical weekly fields");
  record("no-google-fetch-in-hours-service", !/places\.googleapis\.com/.test(hours), "Hours mapper does not call Google Places");
}

async function fixtures() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "yorkshire-hours-"));
  fs.mkdirSync(path.join(tmp, "data/pharmacy-profiles"), { recursive: true });
  const pharmacyConfig = path.join(ROOT, "config/pharmacy");
  if (fs.existsSync(pharmacyConfig)) {
    fs.cpSync(pharmacyConfig, path.join(tmp, "config/pharmacy"), { recursive: true });
  }
  process.env.WORKSPACE_ROOT = tmp;
  process.env.DATAFORSEO_CALLS = "0";
  process.env.GOOGLE_PLACES_API_KEY = "";

  const { parseImportedWeeklyHours, resolveBusinessProfileWeeklyHours } = await import(
    "../src/pharmacy/masterAdminBusinessProfileOpeningHoursService.ts"
  );
  const { writeSetupProfile, readSetupProfile } = await import(
    "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts"
  );
  const { buildBusinessProfileReview, saveBusinessProfileReviewField } = await import(
    "../src/pharmacy/masterAdminBusinessProfileReviewService.ts"
  );

  const googleLines = [
    "Monday: 8:30 AM – 6:00 PM",
    "Tuesday: 8:30 AM – 6:00 PM",
    "Wednesday: 8:30 AM – 6:00 PM",
    "Thursday: 8:30 AM – 1:00 PM, 2:00 PM – 6:00 PM",
    "Friday: 8:30 AM – 6:00 PM",
    "Saturday: 9:00 AM – 1:00 PM",
    "Sunday: Closed",
  ];
  const parsedGoogle = parseImportedWeeklyHours(googleLines);
  record("parse-seven-days", parsedGoogle.monday && parsedGoogle.sunday === "Closed", `Sunday=${parsedGoogle.sunday}`);
  record(
    "parse-split-thursday",
    parsedGoogle.thursday.includes("8:30 AM – 1:00 PM") && parsedGoogle.thursday.includes("2:00 PM – 6:00 PM"),
    parsedGoogle.thursday,
  );
  record("parse-closed-sunday", parsedGoogle.sunday === "Closed", parsedGoogle.sunday);

  const fromPeriods = parseImportedWeeklyHours({
    periods: [
      { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 17, minute: 30 } },
      { open: { day: 1, hour: 18, minute: 0 }, close: { day: 1, hour: 20, minute: 0 } },
    ],
  });
  record("parse-periods-closed-fill", fromPeriods.sunday === "Closed" && fromPeriods.monday.includes("9:00 AM"), fromPeriods.monday);

  const websiteLines = [
    "Monday: 9:00 AM – 5:00 PM",
    "Tuesday: 9:00 AM – 5:00 PM",
    "Wednesday: 9:00 AM – 5:00 PM",
    "Thursday: 9:00 AM – 5:00 PM",
    "Friday: 9:00 AM – 5:00 PM",
    "Saturday: Closed",
    "Sunday: Closed",
  ];

  function baseProfile(overrides: Record<string, unknown>) {
    return {
      pharmacyName: "Yorkshire Pharmacy and Health Clinic",
      website: "https://yorkshirepharmacy.example",
      googlePlaceId: "ChIJYorkshirePharmacyHours",
      googleBusinessProfileUrl: "https://maps.google.com/?cid=yorkshire",
      googleProfileOnboardingState: "configured",
      marketScope: "local_regional",
      selectedServices: ["pharmacy-first"],
      openingHours: "",
      openingHoursMonday: "",
      openingHoursTuesday: "",
      openingHoursWednesday: "",
      openingHoursThursday: "",
      openingHoursFriday: "",
      openingHoursSaturday: "",
      openingHoursSunday: "",
      websiteImportSnapshot: {
        status: "imported",
        importedAt: "2026-08-19T10:00:00.000Z",
        message: "Website imported",
        websiteUrl: "https://yorkshirepharmacy.example",
        logoUrl: "",
        brandPrimaryColor: "",
        brandSecondaryColor: "",
        brandAccentColor: "",
        brandBackgroundColor: "",
        brandTextColor: "",
        phone: "",
        email: "",
        address: "",
        town: "Leeds",
        postcode: "",
        socialLinks: [],
        footerLinks: [],
        servicesDetected: [],
        customerVisibleServices: [],
        description: "",
        openingHours: "",
        intelligence: {
          version: 2,
          businessClassification: {
            class: "community_pharmacy",
            clinicalServiceDetectionEnabled: true,
          },
        },
      },
      googleImportSnapshot: {
        status: "imported",
        importedAt: "2026-08-19T11:00:00.000Z",
        message: "Google Profile imported",
        googleBusinessUrl: "https://maps.google.com/?cid=yorkshire",
        searchPharmacyName: "Yorkshire Pharmacy and Health Clinic",
        searchTown: "Leeds",
        searchPostcode: "",
        placeId: "ChIJYorkshirePharmacyHours",
        businessName: "Yorkshire Pharmacy and Health Clinic",
        address: "Leeds",
        town: "Leeds",
        postcode: "",
        phone: "",
        website: "https://yorkshirepharmacy.example",
        rating: 4.8,
        reviewCount: 12,
        photoCount: 0,
        categories: ["pharmacy"],
        openingHours: [],
        googleMapsUrl: "https://maps.google.com/?cid=yorkshire",
        latitude: null,
        longitude: null,
        candidates: [],
        nationalWebsiteDetected: false,
      },
      ...overrides,
    };
  }

  function hoursField(review: { fields: Array<Record<string, unknown>> }) {
    return review.fields.find((f) => f.id === "openingHoursSummary") as Record<string, unknown> | undefined;
  }

  writeSetupProfile(
    SLUG,
    baseProfile({
      googleImportSnapshot: {
        ...(baseProfile({}).googleImportSnapshot as object),
        openingHours: googleLines,
      },
    }) as never,
  );
  const googleReview = buildBusinessProfileReview(SLUG);
  const googleField = hoursField(googleReview);
  const weekly = googleField?.weeklyHours as { days?: Array<{ day: string; hours: string }>; source?: string; sourceBadge?: string } | undefined;
  record("google-seven-rows", weekly?.days?.length === 7 && weekly.days.every((row) => Boolean(row.hours)), JSON.stringify(weekly?.days?.map((d) => d.day)));
  record("google-source", weekly?.source === "google" && weekly.sourceBadge === "Imported from Google", String(weekly?.source));
  record(
    "google-not-missing",
    googleField?.reviewTier === "needs_confirmation" && googleField?.commercialActionLabel === "Confirm hours",
    `${String(googleField?.reviewTier)} / ${String(googleField?.commercialActionLabel)}`,
  );
  record("google-closed-and-split", weekly?.days?.some((d) => d.day === "Sunday" && d.hours === "Closed") && weekly.days.some((d) => d.day === "Thursday" && d.hours.includes("2:00 PM")), "closed+split preserved");

  saveBusinessProfileReviewField(SLUG, "openingHoursSummary", { action: "confirm", finalValue: String(googleField?.recommendedValue || "") }, "validator");
  const afterConfirm = buildBusinessProfileReview(SLUG);
  const confirmed = hoursField(afterConfirm);
  const persisted = readSetupProfile(SLUG);
  record("blocker-cleared", confirmed?.reviewTier === "verified" && confirmed?.requiresAction === false, String(confirmed?.reviewTier));
  record(
    "persisted-after-refresh",
    persisted.openingHoursSunday === "Closed" && persisted.openingHoursMonday.includes("8:30 AM") && persisted.openingHoursThursday.includes("2:00 PM"),
    `Sun=${persisted.openingHoursSunday} Thu=${persisted.openingHoursThursday}`,
  );

  const reviewStore = path.join(tmp, "data/pharmacy-master-admin/business-profile-review", `${SLUG}.json`);
  if (fs.existsSync(reviewStore)) fs.unlinkSync(reviewStore);

  writeSetupProfile(
    SLUG,
    baseProfile({
      googleImportSnapshot: {
        ...(baseProfile({}).googleImportSnapshot as object),
        openingHours: [],
      },
      websiteImportSnapshot: {
        ...(baseProfile({}).websiteImportSnapshot as object),
        openingHours: websiteLines.join("\n"),
      },
    }) as never,
  );
  const websiteReview = buildBusinessProfileReview(SLUG);
  const websiteField = hoursField(websiteReview);
  const websiteWeekly = websiteField?.weeklyHours as { source?: string; days?: Array<{ day: string; hours: string }> } | undefined;
  record("website-when-google-absent", websiteWeekly?.source === "website" && websiteWeekly.days?.length === 7, String(websiteWeekly?.source));
  record("website-saturday-closed", websiteWeekly?.days?.some((d) => d.day === "Saturday" && d.hours === "Closed"), "Saturday Closed from website");

  if (fs.existsSync(reviewStore)) fs.unlinkSync(reviewStore);
  writeSetupProfile(
    SLUG,
    baseProfile({
      googleImportSnapshot: {
        ...(baseProfile({}).googleImportSnapshot as object),
        openingHours: googleLines,
      },
      websiteImportSnapshot: {
        ...(baseProfile({}).websiteImportSnapshot as object),
        openingHours: websiteLines.join("\n"),
      },
    }) as never,
  );
  const conflictReview = buildBusinessProfileReview(SLUG);
  const conflictField = hoursField(conflictReview);
  const conflictWeekly = conflictField?.weeklyHours as { source?: string; googleDays?: unknown[]; websiteDays?: unknown[] } | undefined;
  record(
    "conflict-requires-confirmation",
    conflictWeekly?.source === "conflict" && conflictField?.reviewTier === "needs_confirmation" && Boolean(conflictWeekly.googleDays && conflictWeekly.websiteDays),
    String(conflictWeekly?.source),
  );

  if (fs.existsSync(reviewStore)) fs.unlinkSync(reviewStore);
  writeSetupProfile(SLUG, baseProfile({}) as never);
  const missingReview = buildBusinessProfileReview(SLUG);
  const missingField = hoursField(missingReview);
  const missingWeekly = missingField?.weeklyHours as { source?: string; days?: Array<{ hours: string }> } | undefined;
  record(
    "no-source-manual",
    missingField?.reviewTier === "missing" && missingWeekly?.source === "none" && missingWeekly.days?.length === 7,
    `${String(missingField?.reviewTier)} / ${String(missingWeekly?.source)}`,
  );

  const resolution = resolveBusinessProfileWeeklyHours({
    googleSnapshotOpeningHours: googleLines,
    websiteSnapshotOpeningHours: websiteLines.join("\n"),
  });
  record("no-silent-merge", resolution.source === "conflict" && resolution.recommendedSummary !== websiteLines.join("; "), resolution.source);
}

async function main() {
  console.log("\n=== YORKSHIRE-GOOGLE-HOURS-IMPORT-V1 ===\n");
  sourceChecks();
  await fixtures();
  const failed = checks.filter((c) => !c.pass);
  const outDir = path.join(ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "yorkshire-google-hours-import-v1.json"),
    JSON.stringify({ pass: failed.length === 0, generatedAt: new Date().toISOString(), checks }, null, 2),
  );
  if (failed.length) {
    console.error(`\nFAILED ${failed.length}/${checks.length}`);
    process.exit(1);
  }
  console.log(`\nPASS ${checks.length}/${checks.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
