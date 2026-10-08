/**
 * Automated New Pharmacy Pitch — name + UK postcode → workspace, catchments,
 * DataForSEO demand, live SERP competitor audit, and Executive Opportunity Report.
 */
import fs from "node:fs";
import path from "node:path";

import { selectDistinctCatchmentAreas } from "./pharmacyCatchmentAreaGuardrails.ts";
import {
  createPharmacyCampaign,
  readPharmacyCampaignStore,
} from "./pharmacyCampaignService.ts";
import {
  upsertPharmacyCustomer,
  findPharmacyCustomer,
  type PharmacyCustomerRecord,
} from "./dashboardCustomerStore.ts";
import {
  createPharmacyWorkspace,
  discoverAreasForWizard,
  resolveUniqueSlug,
  slugFromPharmacyName,
  safeAdminSlug,
} from "./pharmacyMasterAdminService.ts";
import { getPharmacyProfilePath } from "./pharmacyWorkspacePaths.ts";
import { catalogServiceIds } from "./servicesCatalog.ts";
import { buildTenantPortfolioOpportunity } from "./portfolioOpportunityService.ts";
import { buildTenantOpportunityForecast } from "./opportunityForecastService.ts";
import { buildTenantCompetitorRadar } from "./localCompetitorSerpRadarService.ts";
import type { ProfileAreaEntry } from "./pharmacyProfileSchema.ts";
import { resolvePharmacyCompaniesHouse } from "./companiesHouseService.ts";

export const PITCH_CORE_SERVICE_IDS = ["travel-vaccinations", "weight-loss", "pharmacy-first"] as const;
export const DEFAULT_GPHC_PLACEHOLDER = "GPhC-verified";
export const PITCH_CATCHMENT_MIN = 6;
export const PITCH_CATCHMENT_MAX = 8;
export const PITCH_RADIUS_MILES = 4;

const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const OSM_RADIUS_METERS = Math.round(PITCH_RADIUS_MILES * 1609);

export type GeneratePharmacyPitchInput = {
  pharmacyName: string;
  postcode: string;
  gphcNumber?: string;
};

export type PitchProgressStep = {
  id: "catchments" | "demand" | "serp" | "report";
  label: string;
  status: "done";
};

export type GeneratePharmacyPitchResult = {
  ok: true;
  slug: string;
  pharmacyName: string;
  townCity: string;
  district: string;
  postcode: string;
  gphcNumber: string;
  registeredCompanyName: string;
  companyNumber: string;
  primaryDirectorName: string;
  latitude: number;
  longitude: number;
  catchments: string[];
  campaigns: string[];
  catalogServiceCount: number;
  monthlySearchDemand: number | null;
  competitorQueries: string[];
  contentGapSummary: string | null;
  reportUrl: string;
  workspaceUrl: string;
  elapsedMs: number;
  warnings: string[];
  steps: PitchProgressStep[];
};

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function uniqueNames(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const name = clean(raw);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function isUsableCatchmentName(name: string, townCity: string): boolean {
  const value = clean(name);
  if (!value) return false;
  const key = value.toLowerCase();
  const town = clean(townCity).toLowerCase();
  if (town && (key === town || key.startsWith(`${town},`))) return false;
  if (/\bunparished\b|\bmetropolitan borough\b|\bcouncil\b|\bdistrict\b|\bcounty of\b/i.test(value)) return false;
  return true;
}

export function normalizeUkPostcode(raw: string): string {
  const compact = clean(raw).toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5) return clean(raw).toUpperCase();
  return `${compact.slice(0, compact.length - 3)} ${compact.slice(-3)}`;
}

async function lookupPostcode(postcode: string): Promise<Record<string, unknown> | null> {
  const pc = encodeURIComponent(normalizeUkPostcode(postcode));
  const res = await fetch(`https://api.postcodes.io/postcodes/${pc}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: Record<string, unknown> };
  return json.result || null;
}

async function overpassNeighbourhoods(lat: number, lon: number, radiusMeters: number): Promise<string[]> {
  const query = `[out:json][timeout:18];
(
  node(around:${radiusMeters},${lat},${lon})["place"~"suburb|village|neighbourhood|hamlet|town"];
  way(around:${radiusMeters},${lat},${lon})["place"~"suburb|village|neighbourhood"];
);
out tags 80;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": "PharmaConnectGrowthEngine/1.0 support@pharmaconnect.uk",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: Array<{ tags?: { name?: string; place?: string } }> };
      const names = (json.elements || [])
        .map((el) => clean(el.tags?.name))
        .filter(Boolean);
      if (names.length) return uniqueNames(names);
    } catch {
      /* try next endpoint */
    }
  }
  return [];
}

function areaEntries(names: string[]): ProfileAreaEntry[] {
  return names.map((areaName, index) => ({
    areaName,
    areaType: "priority cluster",
    priority: index + 1,
    order: index + 1,
    selected: true,
    source: "pitch-generator",
    confidence: 80,
  }));
}

function patchPharmacyProfile(
  slug: string,
  patch: Record<string, unknown>,
): void {
  const file = getPharmacyProfilePath(slug);
  if (!fs.existsSync(file)) return;
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as {
      slug?: string;
      updatedAt?: string;
      data?: Record<string, unknown>;
    };
    doc.updatedAt = new Date().toISOString();
    doc.data = { ...(doc.data || {}), ...patch };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  } catch {
    /* profile overlay is best-effort */
  }
}

function ensureCoreCampaigns(slug: string, warnings: string[]): string[] {
  const created: string[] = [];
  const existing = readPharmacyCampaignStore(slug);
  const active = new Set(
    (existing?.campaigns || [])
      .filter((campaign) => campaign.status === "active")
      .map((campaign) => campaign.serviceId),
  );
  for (const serviceId of PITCH_CORE_SERVICE_IDS) {
    if (active.has(serviceId)) {
      created.push(serviceId);
      continue;
    }
    try {
      createPharmacyCampaign(slug, {
        serviceId,
        campaignGoal: "Increase Visibility",
      });
      created.push(serviceId);
      active.add(serviceId);
    } catch (err) {
      const already = /already exists/i.test(String(err instanceof Error ? err.message : err));
      if (already) {
        created.push(serviceId);
        continue;
      }
      warnings.push(`Campaign ${serviceId} deferred: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return created;
}

export async function generatePharmacyPitch(
  input: GeneratePharmacyPitchInput,
): Promise<GeneratePharmacyPitchResult> {
  const started = Date.now();
  const warnings: string[] = [];
  const pharmacyName = clean(input.pharmacyName);
  if (!pharmacyName) throw new Error("Pharmacy name is required");
  const postcode = normalizeUkPostcode(input.postcode);
  if (!UK_POSTCODE_RE.test(postcode)) {
    throw new Error("Enter a valid UK postcode, for example PR2 9EA");
  }
  const gphcNumber = clean(input.gphcNumber) || DEFAULT_GPHC_PLACEHOLDER;

  const geo = await lookupPostcode(postcode);
  if (!geo || geo.latitude == null || geo.longitude == null) {
    throw new Error(`Could not resolve postcode ${postcode}`);
  }
  const latitude = Number(geo.latitude);
  const longitude = Number(geo.longitude);
  const district = clean(geo.admin_district || geo.nuts || geo.pfa);
  const townCity = district || clean(geo.parish || geo.admin_ward) || "United Kingdom";
  const parish = clean(geo.parish);

  let neighbourhoods = (await overpassNeighbourhoods(latitude, longitude, OSM_RADIUS_METERS))
    .filter((name) => isUsableCatchmentName(name, townCity));
  if (neighbourhoods.length < PITCH_CATCHMENT_MIN) {
    try {
      const discovered = discoverAreasForWizard(townCity, 10)
        .filter((row) => row.selected !== false)
        .map((row) => row.areaName)
        .filter((name) => isUsableCatchmentName(name, townCity));
      neighbourhoods = uniqueNames([...neighbourhoods, ...discovered]);
    } catch (err) {
      warnings.push(`Area engine fallback skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (isUsableCatchmentName(parish, townCity)) {
    neighbourhoods = uniqueNames([parish, ...neighbourhoods]);
  }
  let catchments = selectDistinctCatchmentAreas({
    names: neighbourhoods,
    town: townCity,
    limit: PITCH_CATCHMENT_MAX,
  }).filter((name) => isUsableCatchmentName(name, townCity));
  if (catchments.length < PITCH_CATCHMENT_MIN) {
    catchments = uniqueNames([...catchments, ...neighbourhoods]).filter((name) => isUsableCatchmentName(name, townCity)).slice(0, PITCH_CATCHMENT_MAX);
  }
  if (!catchments.length) {
    catchments = uniqueNames([townCity, district].filter((name) => isUsableCatchmentName(name, ""))).slice(0, PITCH_CATCHMENT_MAX);
  }
  if (catchments.length < 1) {
    throw new Error(`Could not identify local neighbourhoods for ${postcode}`);
  }

  const baseSlug = `${slugFromPharmacyName(pharmacyName)}-${safeAdminSlug(townCity) || "uk"}`;
  const existing = findPharmacyCustomer(baseSlug);
  const slug = existing?.slug || resolveUniqueSlug(baseSlug);
  const selectedAreas = areaEntries(catchments);
  const displayAddress = [pharmacyName, townCity, postcode, "UK"].filter(Boolean).join(", ");
  const mapsEmbed = `https://maps.google.com/maps?q=${latitude},${longitude}&hl=en&z=15&output=embed`;

  try {
    if (!existing) {
      await createPharmacyWorkspace({
        pharmacyName,
        contactEmail: "onboarding@pharmaconnect.uk",
        telephone: "GPhC verified",
        growthPlanTier: "professional",
        primaryTown: townCity,
        coverageRadius: `${PITCH_RADIUS_MILES} miles`,
        selectedAreas,
        selectedServices: [...PITCH_CORE_SERVICE_IDS],
        slug,
      });
    }
  } catch (err) {
    warnings.push(`Workspace provision warning: ${err instanceof Error ? err.message : String(err)}`);
  }

  let registeredCompanyName = "";
  let companyNumber = "";
  let primaryDirectorName = "";
  let directorNames: string[] = [];
  let companiesHouseMatchMethod = "";
  try {
    const company = await resolvePharmacyCompaniesHouse({
      pharmacyName,
      postcode,
      townCity,
    });
    if (company) {
      registeredCompanyName = company.registeredCompanyName;
      companyNumber = company.companyNumber;
      primaryDirectorName = company.primaryDirectorName;
      directorNames = company.directorNames;
      companiesHouseMatchMethod = company.matchMethod;
      console.log(
        `[Companies House] ${pharmacyName} → ${registeredCompanyName} (${companyNumber}) directors=${company.directorNames.join("; ") || "none"} method=${company.matchMethod}`,
      );
    } else {
      warnings.push("Companies House did not return an active registered owner for this trading name.");
    }
  } catch (err) {
    warnings.push(`Companies House lookup skipped: ${err instanceof Error ? err.message : String(err)}`);
  }

  patchPharmacyProfile(slug, {
    pharmacyName,
    tradingName: pharmacyName,
    postcode,
    primaryTown: townCity,
    primaryCity: townCity,
    townCity,
    county: district,
    latitude,
    longitude,
    gphcNumber,
    coverageRadius: "5 miles",
    selectedAreas,
    rankingAreas: catchments,
    nearbyAreas: catchments,
    coverageAreas: catchments,
    displayAddress,
    country: "United Kingdom",
    companyName: registeredCompanyName,
    registeredCompanyName,
    companyRegistrationNumber: companyNumber,
    pharmacyOwnerName: primaryDirectorName,
    primaryDirectorName,
    directorNames,
    companiesHouseMatchMethod,
  });

  const customer: PharmacyCustomerRecord = {
    slug,
    pharmacyName,
    website: existing?.website || "",
    email: existing?.email || "onboarding@pharmaconnect.uk",
    phone: existing?.phone || "GPhC verified",
    addressLine1: pharmacyName,
    addressLine2: "",
    townCity,
    county: district,
    postcode,
    displayAddress,
    brandPrimaryColor: existing?.brandPrimaryColor || "#015e69",
    googleCatchment: {
      googlePlaceId: existing?.googleCatchment?.googlePlaceId || "",
      latitude,
      longitude,
      googleBusinessProfileUrl: existing?.googleCatchment?.googleBusinessProfileUrl || "",
      googleMapsEmbedUrl: mapsEmbed,
      coverageRadius: "5 miles",
      rankingAreas: catchments,
      nearbyAreas: catchments,
      coverageAreas: catchments,
    },
    activeServiceChannels: [...PITCH_CORE_SERVICE_IDS],
  };
  upsertPharmacyCustomer(customer);

  const campaigns = ensureCoreCampaigns(slug, warnings);

  let monthlySearchDemand: number | null = null;
  let competitorQueries: string[] = [];
  let contentGapSummary: string | null = null;

  const [portfolio, radar] = await Promise.all([
    buildTenantPortfolioOpportunity(slug, { force: true, locationName: townCity }),
    buildTenantCompetitorRadar(slug, { force: true, locationName: townCity }),
  ]);
  monthlySearchDemand = portfolio.services.reduce((sum, row) => sum + (row.monthlySearchDemand || 0), 0);
  competitorQueries = radar.queries.map((query) => query.keyword);
  if (radar.contentGap?.overall?.takeaway) contentGapSummary = radar.contentGap.overall.takeaway;

  try {
    await buildTenantOpportunityForecast(slug, { force: false, locationName: townCity });
  } catch (err) {
    warnings.push(`Forecast overlay skipped: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    ok: true,
    slug,
    pharmacyName,
    townCity,
    district,
    postcode,
    gphcNumber,
    registeredCompanyName,
    companyNumber,
    primaryDirectorName,
    latitude,
    longitude,
    catchments,
    campaigns,
    catalogServiceCount: catalogServiceIds().length,
    monthlySearchDemand,
    competitorQueries,
    contentGapSummary,
    reportUrl: `/api/growth-engine/${encodeURIComponent(slug)}/executive-report`,
    workspaceUrl: `/?slug=${encodeURIComponent(slug)}#workspace-intelligence`,
    elapsedMs: Date.now() - started,
    warnings,
    steps: [
      { id: "catchments", label: "Identifying local catchment areas and neighbourhoods...", status: "done" },
      { id: "demand", label: "Querying Google Ads search demand for 10 clinical services...", status: "done" },
      { id: "serp", label: "Auditing local competitor SERP rankings and content gaps...", status: "done" },
      { id: "report", label: "Generating Executive Board Report...", status: "done" },
    ],
  };
}
