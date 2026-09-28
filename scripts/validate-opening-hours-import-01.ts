#!/usr/bin/env npx tsx
/**
 * Canonical opening-hours evidence. Uses the production review resolver.
 * No Google Places calls and no live tenant writes.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG_A = "hours-import-pharmacy-a";
const SLUG_B = "hours-import-pharmacy-b";

const checks: Array<{ id: string; pass: boolean }> = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function shaFile(rel: string): string {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return "";
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const GOOGLE_SPLIT = [
  "Monday: 8:30 AM – 12:30 PM, 1:30 – 6:30 PM",
  "Tuesday: 8:30 AM – 12:30 PM, 1:30 – 6:30 PM",
  "Wednesday: 8:30 AM – 12:30 PM, 1:30 – 5:30 PM",
  "Thursday: 8:30 AM – 12:30 PM, 1:30 – 5:30 PM",
  "Friday: 8:30 AM – 12:30 PM, 1:30 – 5:30 PM",
  "Saturday: 9:00 AM – 1:00 PM",
  "Sunday: Closed",
];

const WEBSITE_EQUIVALENT =
  "Opening Times Monday | 8:30-12:30 - 13:30-18:30 Tuesday | 8:30-12:30 - 13:30-18:30 Wednesday | 8:30-12:30 - 13:30-17:30 Thursday | 8:30-12:30 - 13:30-17:30 Friday | 8:30-12:30 - 13:30-17:30 Saturday | 09:00-13:00 Sunday | Closed";

const WEBSITE_CONFLICT =
  "Opening Times Monday | 9:00-17:00 Tuesday | 9:00-17:00 Wednesday | 9:00-17:00 Thursday | 9:00-17:00 Friday | 9:00-17:00 Saturday | 10:00-14:00 Sunday | Closed";

const WEEK_B = [
  "Monday: 10:00 AM – 4:00 PM",
  "Tuesday: 10:00 AM – 4:00 PM",
  "Wednesday: 10:00 AM – 4:00 PM",
  "Thursday: 10:00 AM – 4:00 PM",
  "Friday: 10:00 AM – 4:00 PM",
  "Saturday: Closed",
  "Sunday: Closed",
];

function baseProfile(name: string, overrides: Record<string, unknown>) {
  return {
    pharmacyName: name,
    website: "https://example-pharmacy.test",
    googlePlaceId: "",
    googleBusinessProfileUrl: "",
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
      importedAt: "2026-09-28T10:00:00.000Z",
      message: "Website imported",
      websiteUrl: "https://example-pharmacy.test",
      logoUrl: "",
      brandPrimaryColor: "",
      brandSecondaryColor: "",
      brandAccentColor: "",
      brandBackgroundColor: "",
      brandTextColor: "",
      phone: "",
      email: "",
      address: "",
      town: "Paisley",
      postcode: "PA2 7EP",
      socialLinks: [],
      footerLinks: [],
      servicesDetected: [],
      customerVisibleServices: [],
      description: "",
      openingHours: "",
      intelligence: {
        version: 2,
        businessClassification: { class: "community_pharmacy", clinicalServiceDetectionEnabled: true },
      },
    },
    googleImportSnapshot: {
      status: "imported",
      importedAt: "2026-09-28T11:00:00.000Z",
      message: "Google Profile imported",
      googleBusinessUrl: "",
      searchPharmacyName: name,
      searchTown: "Paisley",
      searchPostcode: "PA2 7EP",
      placeId: "",
      businessName: name,
      address: "1 High Street",
      town: "Paisley",
      postcode: "PA2 7EP",
      phone: "",
      website: "https://example-pharmacy.test",
      rating: 5,
      reviewCount: 1,
      photoCount: 0,
      categories: ["pharmacy"],
      openingHours: [],
      googleMapsUrl: "",
      latitude: null,
      longitude: null,
      candidates: [],
      nationalWebsiteDetected: false,
    },
    ...overrides,
  };
}

async function main() {
  const gilbertBefore = shaFile("data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "opening-hours-"));
  fs.mkdirSync(path.join(tmp, "data/pharmacy-profiles"), { recursive: true });
  const pharmacyConfig = path.join(ROOT, "config/pharmacy");
  if (fs.existsSync(pharmacyConfig)) fs.cpSync(pharmacyConfig, path.join(tmp, "config/pharmacy"), { recursive: true });
  process.env.WORKSPACE_ROOT = tmp;
  process.env.GOOGLE_PLACES_API_KEY = "";

  const { writeSetupProfile } = await import("../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts");
  const { buildBusinessProfileReview } = await import("../src/pharmacy/masterAdminBusinessProfileReviewService.ts");
  const { extractStructuredOpeningHoursText } = await import("../src/pharmacy/masterAdminBusinessProfileOpeningHoursService.ts");

  type Review = { fields: Array<Record<string, unknown>>; missingInformation?: Array<{ id?: string; commercialActionLabel?: string }> };
  const hoursField = (review: Review) => review.fields.find((f) => f.id === "openingHoursSummary");
  const weeklyOf = (field: Record<string, unknown> | undefined) =>
    field?.weeklyHours as { source?: string; sourceBadge?: string; days?: Array<{ day: string; hours: string }>; recommendedSummary?: string | null } | undefined;

  function write(slug: string, name: string, google: string[], website: string) {
    const profile = baseProfile(name, {});
    const googleSnap = profile.googleImportSnapshot as { openingHours: string[] };
    const websiteSnap = profile.websiteImportSnapshot as { openingHours: string };
    googleSnap.openingHours = google;
    websiteSnap.openingHours = website;
    writeSetupProfile(slug, profile as never);
  }

  write(SLUG_A, "Hours Pharmacy A", GOOGLE_SPLIT, "");
  const googleReview = buildBusinessProfileReview(SLUG_A) as Review;
  const googleWeekly = weeklyOf(hoursField(googleReview));
  record("1-google-only", googleWeekly?.source === "google" && googleWeekly.days?.length === 7 && googleWeekly.days.every((d) => Boolean(d.hours)), googleWeekly?.source || "");
  record("1-not-missing", !googleReview.missingInformation?.some((f) => f.id === "openingHoursSummary"), "google hours leave the manual requirement");
  record("6-closed-day", googleWeekly?.days?.some((d) => d.day === "Sunday" && d.hours === "Closed") === true, "Sunday Closed");
  record("7-split-hours", googleWeekly?.days?.some((d) => d.day === "Monday" && d.hours.includes("08:30–12:30") && d.hours.includes("13:30–18:30")) === true, googleWeekly?.days?.find((d) => d.day === "Monday")?.hours || "");

  write(SLUG_A, "Hours Pharmacy A", [], WEBSITE_EQUIVALENT);
  const websiteReview = buildBusinessProfileReview(SLUG_A) as Review;
  const websiteWeekly = weeklyOf(hoursField(websiteReview));
  record("2-website-only", websiteWeekly?.source === "website" && websiteWeekly.sourceBadge === "Imported from website", websiteWeekly?.source || "");

  write(SLUG_A, "Hours Pharmacy A", GOOGLE_SPLIT, WEBSITE_EQUIVALENT);
  const both = weeklyOf(hoursField(buildBusinessProfileReview(SLUG_A) as Review));
  record("3-corroborated", both?.source === "corroborated" && both.sourceBadge === "Google and website agree", both?.source || "");

  write(SLUG_A, "Hours Pharmacy A", GOOGLE_SPLIT, WEBSITE_CONFLICT);
  const conflictField = hoursField(buildBusinessProfileReview(SLUG_A) as Review);
  const conflict = weeklyOf(conflictField);
  record(
    "4-conflict",
    conflict?.source === "conflict" && conflict.recommendedSummary == null && conflictField?.reviewTier === "needs_confirmation",
    `${conflict?.source} / ${String(conflictField?.commercialActionLabel)}`,
  );

  write(SLUG_A, "Hours Pharmacy A", [], "");
  const missingField = hoursField(buildBusinessProfileReview(SLUG_A) as Review);
  const missing = weeklyOf(missingField);
  record(
    "5-neither",
    missing?.source === "none" && missingField?.reviewTier === "missing" && String(missingField?.commercialActionLabel || "").includes("Enter opening hours"),
    `${missing?.source} / ${String(missingField?.commercialActionLabel)}`,
  );

  write(SLUG_A, "Hours Pharmacy A", GOOGLE_SPLIT, "");
  const first = weeklyOf(hoursField(buildBusinessProfileReview(SLUG_A) as Review));
  write(SLUG_A, "Hours Pharmacy A", WEEK_B, "");
  const replaced = weeklyOf(hoursField(buildBusinessProfileReview(SLUG_A, { supplementalGoogleOpeningHours: GOOGLE_SPLIT }) as Review));
  record(
    "8-reimport-replaces-stale",
    first?.days?.some((d) => d.hours.includes("08:30")) === true &&
      replaced?.days?.some((d) => d.day === "Monday" && d.hours.includes("10:00–16:00")) === true &&
      replaced?.days?.some((d) => d.hours.includes("08:30")) !== true,
    replaced?.days?.find((d) => d.day === "Monday")?.hours || "",
  );

  write(SLUG_A, "Hours Pharmacy A", GOOGLE_SPLIT, "");
  write(SLUG_B, "Hours Pharmacy B", WEEK_B, "");
  const reviewA = weeklyOf(hoursField(buildBusinessProfileReview(SLUG_A) as Review));
  const reviewB = weeklyOf(hoursField(buildBusinessProfileReview(SLUG_B) as Review));
  record(
    "9-tenant-isolation",
    reviewA?.days?.some((d) => d.hours.includes("08:30")) === true &&
      reviewB?.days?.every((d) => !d.hours.includes("08:30")) === true &&
      reviewB?.source === "google",
    `A=${reviewA?.days?.[0]?.hours} B=${reviewB?.days?.[0]?.hours}`,
  );
  record("10-second-pharmacy", reviewB?.days?.length === 7 && reviewB.days.every((d) => Boolean(d.hours)), "second pharmacy uses the same resolver");

  const partial = "17:30 | Thursday | 8:30-12:30 - 13:30-17:30 | Friday | 8:30-12:30 - 13:30-17:30 | Saturday | 09:00-13:00 | Sunday | Closed";
  record("partial-snippet-not-used", extractStructuredOpeningHoursText(partial) === "", "truncated website text is not a full week");

  const gilbertAfter = shaFile("data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json");
  record("gilbert-unchanged", gilbertBefore === gilbertAfter, gilbertAfter.slice(0, 12));

  const failed = checks.filter((c) => !c.pass);
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
