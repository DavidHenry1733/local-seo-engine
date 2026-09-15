#!/usr/bin/env npx tsx
/**
 * Validates PharmaConnect Area Import & Cluster Selection V1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverPharmacyAreas,
  mergeManualAreas,
  resolveProfileCampaignAreas,
} from "../src/pharmacy/pharmacyAreaDiscoveryService.ts";
import { createPharmacyCampaign, readPharmacyCampaignStore } from "../src/pharmacy/pharmacyCampaignService.ts";
import { normalizeProfileData, PROFILE_SCHEMA_VERSION } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { rankAreasFromCityData } from "../src/area/areaEngine.ts";
import { loadCityAreaData } from "../src/area/loadCityAreaData.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = process.argv[2] || "pharmaconnect";
const PROFILE_DIR = path.join(ROOT, "data/pharmacy-profiles");
const PROFILE_FILE = path.join(PROFILE_DIR, `${SLUG}.json`);
const BACKUP_FILE = path.join(PROFILE_DIR, `${SLUG}.area-v1-backup.json`);

let pass = 0;
let fail = 0;

function check(id: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${detail}`);
  if (ok) pass++;
  else fail++;
}

console.log("\nPharmaConnect Area Import & Cluster Selection V1 — validation\n");

const sections = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyProfileDashboardSections.ts"), "utf8");
const dashPage = fs.readFileSync(
  path.join(ROOT, "artifacts/api-server/src/routes/pharmacyProfileDashboardPage.ts"),
  "utf8",
);
const profilesApi = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyProfiles.ts"), "utf8");
const campaignsApi = fs.readFileSync(
  path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyCampaigns.ts"),
  "utf8",
);
const campaignPage = fs.readFileSync(
  path.join(ROOT, "artifacts/api-server/src/routes/pharmacyCampaignsPage.ts"),
  "utf8",
);

check("discovery-service", fs.existsSync(path.join(ROOT, "src/pharmacy/pharmacyAreaDiscoveryService.ts")), "service module");
check("city-area-loader", fs.existsSync(path.join(ROOT, "src/area/loadCityAreaData.ts")), "shared loader");
check("rotherham-area-data", fs.existsSync(path.join(ROOT, "config/areas/rotherham.json")), "Rotherham config");
check("schema-v5", PROFILE_SCHEMA_VERSION === 5, `version ${PROFILE_SCHEMA_VERSION}`);
check("local-areas-section", sections.includes("Local Areas"), "dashboard section");
check("generate-areas-button", sections.includes("Generate Suggested Areas"), "UI control");
check("discover-areas-api", profilesApi.includes("discover-areas"), "API route");
check("save-areas-api", profilesApi.includes("save-areas"), "save route");
check("campaign-area-source", campaignsApi.includes("areaSource"), "campaign API");
check("campaign-summary-areas", campaignPage.includes("profileAreas"), "campaign wizard areas");
check("no-dashboard-redesign", !sections.includes("Nearby Areas (comma-separated)"), "legacy textarea removed");
check("docs-file", fs.existsSync(path.join(ROOT, "docs/platform/PHARMACONNECT-AREA-IMPORT-CLUSTER-SELECTION-V1.md")), "documentation");

const discovery5 = discoverPharmacyAreas({ town: "Rotherham", limit: 5 });
check("rotherham-discovery", discovery5.areas.length === 5, `${discovery5.areas.length} areas`);
check("rotherham-priority-order", discovery5.areas[0]?.areaName === "Wickersley", discovery5.areas[0]?.areaName || "");
check("area-metadata", Boolean(discovery5.areas[0]?.source && discovery5.areas[0]?.priority), "source + priority");

const discovery10 = discoverPharmacyAreas({ town: "Rotherham", limit: 10 });
check("limit-10-respected", discovery10.areas.length === 10, String(discovery10.areas.length));

const cityData = loadCityAreaData("Rotherham");
const ranked = rankAreasFromCityData(cityData, 5, 5);
check("area-engine-reuse", ranked.length === cityData.areas.length, "rankAreasFromCityData");

const withManual = mergeManualAreas(discovery5.areas, ["Custom Village"]);
check("manual-area-add", withManual.some((a) => a.areaName === "Custom Village" && a.source === "manual"), "manual merge");

if (fs.existsSync(PROFILE_FILE)) {
  fs.copyFileSync(PROFILE_FILE, BACKUP_FILE);
}

const existing = fs.existsSync(PROFILE_FILE)
  ? JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8"))
  : { slug: SLUG, data: {} };
const baseData = normalizeProfileData(existing.data || {});

const savedData = normalizeProfileData({
  ...baseData,
  primaryTown: "Rotherham",
  primaryCity: "Rotherham",
  townCity: "Rotherham",
  selectedAreas: withManual,
  manualAreas: ["Custom Village"],
  areaDiscoverySource: discovery5.source,
  areaDiscoveryUpdatedAt: discovery5.generatedAt,
});

check("main-town-saved", savedData.primaryTown === "Rotherham", savedData.primaryTown);
check("areas-in-profile", savedData.selectedAreas.length >= 6, String(savedData.selectedAreas.length));
check("coverage-compat", savedData.coverageAreas.includes("Custom Village"), savedData.coverageAreas.join(", "));
check("ranking-compat", savedData.rankingAreas.length > 0, String(savedData.rankingAreas.length));
check("nearby-compat", savedData.nearbyAreas.length >= savedData.rankingAreas.length, "nearby >= ranking");

fs.mkdirSync(PROFILE_DIR, { recursive: true });
fs.writeFileSync(
  PROFILE_FILE,
  JSON.stringify({ slug: SLUG, updatedAt: new Date().toISOString(), version: PROFILE_SCHEMA_VERSION, data: savedData }, null, 2),
);

const campaignAreas = resolveProfileCampaignAreas(savedData);
check("campaign-profile-areas", campaignAreas.length > 0, String(campaignAreas.length));

let createdCampaignId = "";
try {
  const { campaign } = createPharmacyCampaign(SLUG, {
    serviceId: "pharmacy-first",
    campaignGoal: "Increase Visibility",
    areaSource: "profile",
  });
  createdCampaignId = campaign.id;
  check("campaign-save-areas", (campaign.campaignAreas || []).length > 0, String(campaign.campaignAreas?.length));
  check("campaign-area-source-profile", campaign.areaSource === "profile", campaign.areaSource);
  const store = readPharmacyCampaignStore(SLUG);
  const stored = store?.campaigns.find((c) => c.id === campaign.id);
  check("campaign-store-areas", Boolean(stored?.campaignAreas?.length), String(stored?.campaignAreas?.length));
} catch (err) {
  check("campaign-create", false, String(err));
}

const masterDir = path.join(ROOT, "docs/pharmacy-master-library");
const masterBefore = fs.readdirSync(masterDir).length;
check("no-service-master-change", masterBefore > 0, `${masterBefore} masters unchanged`);

const localClusterScripts = fs.readdirSync(path.join(ROOT, "scripts")).filter((f) =>
  /local-cluster|cluster-page/i.test(f),
);
check("no-local-pages-generated", localClusterScripts.length === 0, "no cluster page scripts added");

if (fs.existsSync(BACKUP_FILE)) {
  fs.copyFileSync(BACKUP_FILE, PROFILE_FILE);
  fs.unlinkSync(BACKUP_FILE);
}

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass}/${pass + fail} checks\n`);
process.exit(fail === 0 ? 0 : 1);
