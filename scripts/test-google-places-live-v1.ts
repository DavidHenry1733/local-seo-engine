/**
 * Live Google Places connection test — Local Market Report V2.
 *
 * Usage: npx tsx scripts/test-google-places-live-v1.ts --slug=dhmdigital
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GOOGLE_PLACES_ENV_VAR,
  formatPlacesErrorForDisplay,
  hasGooglePlacesApiKey,
} from "../src/pharmacy/googlePlacesConnection.ts";
import { WORKSPACE_ROOT, loadPharmacyDiscoveryInput } from "../src/pharmacy/pharmacyCompetitorDiscovery.ts";
import {
  competitorSnapshotPath,
  discoverLocalMarketCompetitors,
  fetchYourPharmacyFromGoogle,
  loadCompetitorSnapshot,
} from "../src/pharmacy/growthEngineLocalMarketService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function loadRootEnv(): void {
  const envFile = path.join(projectRoot, ".env");
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) {
      process.env[key] = trimmed.slice(eq + 1).trim();
    }
  }
  if (!process.env.WORKSPACE_ROOT) {
    process.env.WORKSPACE_ROOT = projectRoot;
  }
}

function parseSlug(argv: string[]): string {
  const flag = argv.find((arg) => arg.startsWith("--slug="));
  if (flag) return flag.split("=")[1]?.trim() || "dhmdigital";
  const idx = argv.indexOf("--slug");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1].trim();
  return "dhmdigital";
}

function printSection(title: string): void {
  console.log(`\n=== ${title} ===`);
}

loadRootEnv();

const slug = parseSlug(process.argv.slice(2));

printSection("Runtime configuration");
console.log(`WORKSPACE_ROOT: ${WORKSPACE_ROOT}`);
console.log(`${GOOGLE_PLACES_ENV_VAR} detected: ${hasGooglePlacesApiKey() ? "yes" : "no"}`);
console.log(`Snapshot path: ${competitorSnapshotPath(slug)}`);

printSection("Profile location fields");
const input = loadPharmacyDiscoveryInput(slug);
console.log(`Business name: ${input.pharmacyName || "(missing)"}`);
console.log(`Address: ${input.address || "(missing)"}`);
console.log(`Postcode: ${input.postcode || "(missing)"}`);
console.log(`Latitude: ${input.latitude ?? "(missing)"}`);
console.log(`Longitude: ${input.longitude ?? "(missing)"}`);

printSection("Pharmacy place lookup");
const yourPharmacy = await fetchYourPharmacyFromGoogle(slug);
if (yourPharmacy) {
  console.log(`Found: ${yourPharmacy.businessName}`);
  console.log(`Place ID: ${yourPharmacy.placeId || "(none)"}`);
  console.log(`Source: ${yourPharmacy.source}`);
} else {
  console.log("No Google Business Profile match (yourPharmacy will be null — competitors can still load).");
}

printSection("Live discovery");
let failureReason: string | null = null;

try {
  const snapshot = await discoverLocalMarketCompetitors(slug);
  const live = snapshot.source === "google-places-live" && snapshot.competitors.length >= 5;

  console.log(`Source: ${snapshot.source}`);
  console.log(`Competitor count: ${snapshot.competitors.length}`);
  console.log(`Healthcare provider count: ${snapshot.healthcare?.providers?.length ?? 0}`);
  console.log(`Snapshot written: ${competitorSnapshotPath(slug)}`);

  if (snapshot.placesError) {
    failureReason = formatPlacesErrorForDisplay(snapshot.placesError);
    console.log(`Failure reason: ${failureReason}`);
  } else if (!live) {
    failureReason = "Discovery completed but did not meet live threshold (5+ Google Places competitors).";
    console.log(`Failure reason: ${failureReason}`);
  } else {
    console.log("Status: live Google Places data OK");
  }

  printSection("First 3 competitors");
  for (const c of snapshot.competitors.slice(0, 3)) {
    console.log(`- ${c.businessName} · ${c.distanceLabel || "?"} · ${c.rating ?? "—"}★ (${c.reviewCount} reviews)`);
  }

  printSection("First 3 healthcare providers");
  for (const p of (snapshot.healthcare?.providers || []).slice(0, 3)) {
    console.log(`- ${p.businessName} (${p.category}) · ${p.distanceLabel || "?"}`);
  }
} catch (err: unknown) {
  failureReason = err instanceof Error ? err.message : String(err);
  console.log(`Failure reason: ${failureReason}`);
}

const stored = loadCompetitorSnapshot(slug);
if (stored && !failureReason) {
  process.exit(0);
}
process.exit(failureReason ? 1 : 0);
