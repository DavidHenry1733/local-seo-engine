/**
 * 15-mile UK outcode territory clusterer.
 * Populations: ONS Census 2021 P004. Centroids: postcode-district lookup / postcodes.io.
 */
import fs from "node:fs";
import path from "node:path";
import { listPharmacyCustomers } from "../pharmacy/dashboardCustomerStore.ts";
import {
  isMultiplePharmacyName,
  postcodeOutcode,
  resolvePharmacyCompaniesHouse,
  searchIndependentChemistsByOutcode,
  type CompaniesHouseMatch,
} from "../pharmacy/companiesHouseService.ts";
import { readOpportunityCache } from "../pharmacy/serviceSearchOpportunityService.ts";
import { localCatchmentDemand } from "./catchmentFilter.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacy/pharmacyWorkspacePaths.ts";

export const TERRITORY_RADIUS_MILES = 15;
export const HIGH_DENSITY_POPULATION_MIN = 25_000;
const EARTH_RADIUS_MILES = 3958.7613;

export type OutcodePopulationRow = {
  outcode: string;
  population: number;
  latitude: number | null;
  longitude: number | null;
  town: string;
  region: string;
  ukRegion: string;
  postTown: string;
  source: string;
};

export type ClusteredOutcode = OutcodePopulationRow & {
  distanceMiles: number;
};

export type TerritoryCluster = {
  ok: true;
  anchorOutcode: string;
  radiusMiles: number;
  latitude: number;
  longitude: number;
  postTown: string;
  region: string;
  ukRegion: string;
  outcodes: ClusteredOutcode[];
  polygonOutcodes: string[];
  totalCatchmentPopulation: number;
  primaryCatchmentPopulation: number;
  source: string;
};

type PopulationFile = {
  source?: string;
  outcodes?: Record<string, OutcodePopulationRow>;
};

const METRO_MATCHERS: Record<string, { ukRegions?: string[]; prefixes?: string[]; towns?: string[] }> = {
  westmidlands: {
    ukRegions: ["west midlands"],
    prefixes: ["B", "CV", "DY", "WS", "WV"],
    towns: ["birmingham", "coventry", "wolverhampton", "dudley", "walsall", "solihull"],
  },
  greatermanchester: {
    prefixes: ["M", "BL", "OL", "SK", "WN"],
    towns: ["manchester", "salford", "stockport", "bolton", "oldham", "wigan", "rochdale"],
  },
  merseyside: {
    prefixes: ["L", "CH", "WA"],
    towns: ["liverpool", "wirral", "birkenhead", "st helens", "southport"],
  },
  westyorkshire: {
    prefixes: ["LS", "BD", "HX", "HD", "WF"],
    towns: ["leeds", "bradford", "halifax", "huddersfield", "wakefield"],
  },
  southyorkshire: {
    prefixes: ["S", "DN"],
    towns: ["sheffield", "doncaster", "rotherham", "barnsley"],
  },
};

let catalogCache: { source: string; rows: OutcodePopulationRow[] } | null = null;
const centroidMemo = new Map<string, { latitude: number; longitude: number }>();

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

function populationFilePaths(): string[] {
  return [
    path.join(PHARMACY_WORKSPACE_ROOT, "src/data/outcodesPopulation.json"),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/outcodesPopulation.json"),
  ];
}

export function loadOutcodePopulationCatalog(): { source: string; rows: OutcodePopulationRow[] } {
  if (catalogCache) return catalogCache;
  for (const file of populationFilePaths()) {
    if (!fs.existsSync(file)) continue;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as PopulationFile;
    const rows = Object.values(parsed.outcodes || {}).filter((row) => row.outcode && row.population > 0);
    catalogCache = { source: String(parsed.source || "ONS Census 2021 P004"), rows };
    return catalogCache;
  }
  catalogCache = { source: "missing", rows: [] };
  return catalogCache;
}

export function findOutcodeRow(outcode: string): OutcodePopulationRow | null {
  const key = clean(outcode).toUpperCase();
  return loadOutcodePopulationCatalog().rows.find((row) => row.outcode === key) || null;
}

async function resolveCentroid(outcode: string): Promise<{ latitude: number; longitude: number } | null> {
  const key = clean(outcode).toUpperCase();
  const row = findOutcodeRow(key);
  if (row?.latitude != null && row.longitude != null) {
    return { latitude: row.latitude, longitude: row.longitude };
  }
  if (centroidMemo.has(key)) return centroidMemo.get(key)!;
  try {
    const res = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { latitude?: number; longitude?: number } };
    const latitude = Number(json.result?.latitude);
    const longitude = Number(json.result?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const point = { latitude, longitude };
    centroidMemo.set(key, point);
    return point;
  } catch {
    return null;
  }
}

export async function getOutcodesWithinRadius(
  anchorOutcode: string,
  radiusMiles: number = TERRITORY_RADIUS_MILES,
): Promise<TerritoryCluster | null> {
  const key = postcodeOutcode(anchorOutcode) || clean(anchorOutcode).toUpperCase();
  if (!key) return null;
  const radius = Number.isFinite(radiusMiles) && radiusMiles > 0 ? radiusMiles : TERRITORY_RADIUS_MILES;
  const origin = await resolveCentroid(key);
  const seed = findOutcodeRow(key);
  if (!origin) return null;
  const catalog = loadOutcodePopulationCatalog();
  const matches: ClusteredOutcode[] = [];
  for (const row of catalog.rows) {
    if (row.latitude == null || row.longitude == null) continue;
    const distanceMiles = haversineMiles(origin.latitude, origin.longitude, row.latitude, row.longitude);
    if (distanceMiles <= radius) matches.push({ ...row, distanceMiles });
  }
  matches.sort((a, b) => a.distanceMiles - b.distanceMiles || b.population - a.population);
  const town = seed?.postTown || matches[0]?.postTown || "";
  const primary = matches.filter((row) => !town || row.postTown === town);
  const polygon = (primary.length ? primary : matches).slice(0, 12);
  return {
    ok: true,
    anchorOutcode: key,
    radiusMiles: radius,
    latitude: origin.latitude,
    longitude: origin.longitude,
    postTown: town,
    region: seed?.region || matches[0]?.region || "",
    ukRegion: seed?.ukRegion || matches[0]?.ukRegion || "",
    outcodes: matches,
    polygonOutcodes: polygon.map((row) => row.outcode),
    totalCatchmentPopulation: matches.reduce((sum, row) => sum + row.population, 0),
    primaryCatchmentPopulation: polygon.reduce((sum, row) => sum + row.population, 0),
    source: catalog.source,
  };
}

function matchesCity(row: OutcodePopulationRow, city: string): boolean {
  const needle = city.toLowerCase();
  if (!needle) return false;
  const hay = `${row.postTown} ${row.region} ${row.town} ${row.ukRegion}`.toLowerCase();
  if (hay.includes(needle)) return true;
  const compact = needle.replace(/\s+/g, "");
  return row.outcode.toLowerCase().startsWith(compact.slice(0, 2));
}

function matchesMetro(row: OutcodePopulationRow, metro: string): boolean {
  const spec = METRO_MATCHERS[metro.toLowerCase().replace(/[\s_-]+/g, "")];
  if (!spec) return matchesCity(row, metro);
  if (spec.ukRegions?.some((region) => row.ukRegion.toLowerCase() === region)) return true;
  if (spec.towns?.some((town) => `${row.postTown} ${row.region}`.toLowerCase().includes(town))) return true;
  return Boolean(spec.prefixes?.some((prefix) => row.outcode.startsWith(prefix)));
}

export type LicenseStatus = "available" | "reserved";

export type TerritoryPharmacyLead = {
  pharmacyName: string;
  postcode: string;
  outcode: string;
  tradingAddress: string;
  slug?: string;
  registeredCompanyName?: string;
  companyNumber?: string;
  primaryDirectorName?: string;
  matchMethod: string;
  licenseStatus: LicenseStatus;
  underActiveReview?: boolean;
};

export type EligibleContractor = TerritoryPharmacyLead & {
  underActiveReview: boolean;
};

export type EligibleContractorPool = {
  totalEligibleIndependentsInCluster: number;
  candidateNames: string[];
  contractors: EligibleContractor[];
};

type TerritoryLicenseRecord = {
  outcode: string;
  polygonOutcodes: string[];
  slug: string;
  pharmacyName: string;
  claimedAt: string;
  annualGbp: number;
};

type TerritoryLicenseFile = {
  version: 1;
  licenses: Record<string, TerritoryLicenseRecord>;
};

function licenseFilePath(): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data", "territory-licenses.json");
}

function readLicenseFile(): TerritoryLicenseFile {
  const file = licenseFilePath();
  if (!fs.existsSync(file)) return { version: 1, licenses: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as TerritoryLicenseFile;
    return { version: 1, licenses: parsed.licenses && typeof parsed.licenses === "object" ? parsed.licenses : {} };
  } catch {
    return { version: 1, licenses: {} };
  }
}

export function readTerritoryLicense(outcode: string): TerritoryLicenseRecord | null {
  const key = clean(outcode).toUpperCase();
  if (!key) return null;
  const licenses = readLicenseFile().licenses;
  if (licenses[key]) return licenses[key];
  return Object.values(licenses).find((row) => row.polygonOutcodes.includes(key)) || null;
}

export function claimTerritoryLicense(input: {
  outcode: string;
  polygonOutcodes?: string[];
  slug: string;
  pharmacyName: string;
}): TerritoryLicenseRecord {
  const outcode = clean(input.outcode).toUpperCase();
  const doc = readLicenseFile();
  const record: TerritoryLicenseRecord = {
    outcode,
    polygonOutcodes: (input.polygonOutcodes || [outcode]).map((row) => clean(row).toUpperCase()).filter(Boolean),
    slug: clean(input.slug),
    pharmacyName: clean(input.pharmacyName),
    claimedAt: new Date().toISOString(),
    annualGbp: 1000,
  };
  doc.licenses[outcode] = record;
  fs.mkdirSync(path.dirname(licenseFilePath()), { recursive: true });
  fs.writeFileSync(licenseFilePath(), `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  return record;
}

export function areaNameFromTown(town: string, postTown: string): string {
  const parts = clean(town)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} & ${parts[1]}`;
  return parts[0] || clean(postTown) || "Catchment";
}

function licensedOutcodes(): Set<string> {
  const set = new Set<string>();
  for (const customer of listPharmacyCustomers()) {
    const outcode = postcodeOutcode(customer.postcode);
    if (outcode) set.add(outcode);
  }
  return set;
}

function clusterIsReserved(cluster: TerritoryCluster, licensed = licensedOutcodes()): boolean {
  if (cluster.polygonOutcodes.some((outcode) => licensed.has(outcode))) return true;
  return cluster.polygonOutcodes.some((outcode) => Boolean(readTerritoryLicense(outcode)));
}

function storedClinicalDemand(cluster: TerritoryCluster): number | null {
  const outcodes = new Set(cluster.polygonOutcodes);
  const town = cluster.postTown.toLowerCase();
  let metro: number | null = null;
  for (const customer of listPharmacyCustomers()) {
    const outcode = postcodeOutcode(customer.postcode);
    const inPolygon = outcodes.has(outcode);
    const sameTown = Boolean(town && customer.townCity.toLowerCase().includes(town));
    if (!inPolygon && !sameTown) continue;
    const cache = readOpportunityCache(customer.slug);
    if (!cache) continue;
    const fromForecast = Number(cache.forecast?.totalMonthlySearchDemand || 0);
    const fromServices = Object.values(cache.services || {}).reduce(
      (sum, service) => sum + (service.monthlySearchDemand || 0),
      0,
    );
    const value = fromForecast || fromServices;
    if (value > 0 && (metro == null || value > metro)) metro = value;
  }
  return metro != null ? localCatchmentDemand(metro) : null;
}

function polygonOutcodeSet(cluster: TerritoryCluster): Set<string> {
  return new Set(
    cluster.polygonOutcodes.length ? cluster.polygonOutcodes : cluster.outcodes.map((row) => row.outcode),
  );
}

function tradingAddressFromCustomer(customer: {
  displayAddress?: string;
  addressLine1?: string;
  townCity?: string;
  postcode?: string;
}): string {
  return (
    clean(customer.displayAddress) ||
    [customer.addressLine1, customer.townCity, customer.postcode].map(clean).filter(Boolean).join(", ")
  );
}

function isHighlight(
  row: { slug?: string; pharmacyName: string; postcode: string },
  highlight?: { slug?: string; pharmacyName?: string; postcode?: string },
): boolean {
  if (!highlight) return false;
  if (highlight.slug && row.slug && highlight.slug === row.slug) return true;
  const wantPostcode = clean(highlight.postcode).toUpperCase().replace(/\s+/g, "");
  const gotPostcode = clean(row.postcode).toUpperCase().replace(/\s+/g, "");
  if (wantPostcode && gotPostcode && wantPostcode === gotPostcode) return true;
  const wantName = clean(highlight.pharmacyName).toLowerCase();
  return Boolean(wantName && clean(row.pharmacyName).toLowerCase() === wantName);
}

async function collectPolygonIndependents(cluster: TerritoryCluster): Promise<TerritoryPharmacyLead[]> {
  const outcodeSet = polygonOutcodeSet(cluster);
  const leads: TerritoryPharmacyLead[] = [];
  const seen = new Set<string>();
  const mark = (key: string): boolean => {
    const value = key.toLowerCase();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  };

  for (const customer of listPharmacyCustomers()) {
    const outcode = postcodeOutcode(customer.postcode);
    if (!outcodeSet.has(outcode)) continue;
    if (isMultiplePharmacyName(customer.pharmacyName)) continue;
    if (!mark(customer.slug || customer.pharmacyName)) continue;
    let company: CompaniesHouseMatch | null = null;
    try {
      company = await resolvePharmacyCompaniesHouse({
        pharmacyName: customer.pharmacyName,
        postcode: customer.postcode,
        townCity: customer.townCity,
      });
    } catch {
      company = null;
    }
    if (company?.companyNumber) mark(company.companyNumber);
    leads.push({
      pharmacyName: customer.pharmacyName,
      postcode: customer.postcode,
      outcode,
      tradingAddress: tradingAddressFromCustomer(customer) || company?.registeredOffice || "",
      slug: customer.slug,
      registeredCompanyName: company?.registeredCompanyName,
      companyNumber: company?.companyNumber,
      primaryDirectorName: company?.primaryDirectorName,
      matchMethod: company?.matchMethod || "workspace-customer",
      licenseStatus: "reserved",
    });
  }

  const searchOutcodes = (cluster.polygonOutcodes.length ? cluster.polygonOutcodes : [cluster.anchorOutcode]).slice(0, 4);
  const batches = await Promise.all(
    searchOutcodes.map(async (outcode) => {
      try {
        return await searchIndependentChemistsByOutcode(outcode, 4);
      } catch {
        return [];
      }
    }),
  );
  for (const [index, chemists] of batches.entries()) {
    const outcode = searchOutcodes[index] || cluster.anchorOutcode;
    for (const company of chemists) {
      if (isMultiplePharmacyName(company.registeredCompanyName)) continue;
      const numberKey = clean(company.companyNumber).toLowerCase();
      const nameKey = clean(company.registeredCompanyName).toLowerCase();
      if ((numberKey && seen.has(numberKey)) || (nameKey && seen.has(nameKey))) continue;
      if (numberKey) seen.add(numberKey);
      if (nameKey) seen.add(nameKey);
      leads.push({
        pharmacyName: company.registeredCompanyName,
        postcode: outcode,
        outcode,
        tradingAddress: company.registeredOffice || "",
        registeredCompanyName: company.registeredCompanyName,
        companyNumber: company.companyNumber,
        primaryDirectorName: company.primaryDirectorName,
        matchMethod: company.matchMethod,
        licenseStatus: "available",
      });
    }
  }
  return leads;
}

export async function buildEligibleContractorPool(
  cluster: TerritoryCluster,
  options?: {
    limit?: number;
    highlight?: { slug?: string; pharmacyName?: string; postcode?: string; tradingAddress?: string };
  },
): Promise<EligibleContractorPool> {
  const limit = Math.min(8, Math.max(4, Number(options?.limit) || 6));
  const all = await collectPolygonIndependents(cluster);
  const highlight = options?.highlight;
  const ranked = [...all].sort((a, b) => {
    const aHit = isHighlight(a, highlight) ? 0 : 1;
    const bHit = isHighlight(b, highlight) ? 0 : 1;
    return aHit - bHit;
  });
  if (highlight?.pharmacyName && !ranked.some((row) => isHighlight(row, highlight))) {
    const outcode = postcodeOutcode(highlight.postcode || "") || cluster.anchorOutcode;
    ranked.unshift({
      pharmacyName: highlight.pharmacyName,
      postcode: highlight.postcode || outcode,
      outcode,
      tradingAddress: highlight.tradingAddress || "",
      slug: highlight.slug,
      matchMethod: "report-target",
      licenseStatus: "available",
    });
  }
  const contractors: EligibleContractor[] = ranked.slice(0, limit).map((row) => ({
    ...row,
    underActiveReview: isHighlight(row, highlight),
  }));
  return {
    totalEligibleIndependentsInCluster: ranked.length,
    candidateNames: ranked.map((row) => row.pharmacyName),
    contractors,
  };
}

export type TerritoryLead = {
  rank: number;
  outcode: string;
  town: string;
  region: string;
  postTown: string;
  areaName: string;
  outcodePopulation: number;
  radiusMiles: number;
  polygonOutcodes: string[];
  totalCatchmentPopulation: number;
  primaryCatchmentPopulation: number;
  clinicalDemand: number | null;
  licenseStatus: LicenseStatus;
  pharmacies: TerritoryPharmacyLead[];
  totalEligibleIndependentsInCluster: number;
  candidateNames: string[];
};

export type TerritoryClusterView = TerritoryCluster & {
  areaName: string;
  licenseStatus: LicenseStatus;
  clinicalDemand: number | null;
};

export function decorateCluster(cluster: TerritoryCluster): TerritoryClusterView {
  return {
    ...cluster,
    areaName: areaNameFromTown(findOutcodeRow(cluster.anchorOutcode)?.town || cluster.postTown, cluster.postTown),
    licenseStatus: clusterIsReserved(cluster) ? "reserved" : "available",
    clinicalDemand: storedClinicalDemand(cluster),
  };
}

export async function findTopTerritories(input: {
  city?: string;
  metro?: string;
  outcode?: string;
  limit?: number;
  minPopulation?: number;
  radiusMiles?: number;
}): Promise<{
  ok: true;
  query: { city: string; metro: string; outcode: string };
  radiusMiles: number;
  minPopulation: number;
  source: string;
  territories: TerritoryLead[];
}> {
  const city = clean(input.city);
  const metro = clean(input.metro);
  const outcode = postcodeOutcode(input.outcode || "") || clean(input.outcode).toUpperCase();
  const limit = Math.min(20, Math.max(1, Number(input.limit) || 10));
  const minPopulation = Math.max(1, Number(input.minPopulation) || HIGH_DENSITY_POPULATION_MIN);
  const radiusMiles = Number(input.radiusMiles) || TERRITORY_RADIUS_MILES;
  const catalog = loadOutcodePopulationCatalog();

  let seeds = catalog.rows.filter((row) => row.population >= minPopulation && row.latitude != null);
  if (outcode) seeds = seeds.filter((row) => row.outcode === outcode);
  else if (metro) seeds = seeds.filter((row) => matchesMetro(row, metro));
  else if (city) seeds = seeds.filter((row) => matchesCity(row, city));
  seeds.sort((a, b) => b.population - a.population);
  const rankedSeeds = seeds.slice(0, Math.max(limit * 3, 12));

  const licensed = licensedOutcodes();
  const scored: Array<TerritoryLead & { cluster: TerritoryCluster }> = [];
  for (const seed of rankedSeeds) {
    const cluster = await getOutcodesWithinRadius(seed.outcode, radiusMiles);
    if (!cluster) continue;
    scored.push({
      rank: 0,
      outcode: seed.outcode,
      town: seed.town,
      region: seed.region,
      postTown: seed.postTown,
      areaName: areaNameFromTown(seed.town, seed.postTown),
      outcodePopulation: seed.population,
      radiusMiles,
      polygonOutcodes: cluster.polygonOutcodes,
      totalCatchmentPopulation: cluster.totalCatchmentPopulation,
      primaryCatchmentPopulation: cluster.primaryCatchmentPopulation,
      clinicalDemand: storedClinicalDemand(cluster),
      licenseStatus: clusterIsReserved(cluster, licensed) ? "reserved" : "available",
      pharmacies: [],
      totalEligibleIndependentsInCluster: 0,
      candidateNames: [],
      cluster,
    });
  }
  scored.sort((a, b) => b.primaryCatchmentPopulation - a.primaryCatchmentPopulation || b.outcodePopulation - a.outcodePopulation);
  const territories = scored.slice(0, limit);
  for (const [index, territory] of territories.entries()) {
    territory.rank = index + 1;
    const pool = await buildEligibleContractorPool(territory.cluster, { limit: 6 });
    territory.pharmacies = pool.contractors;
    territory.totalEligibleIndependentsInCluster = pool.totalEligibleIndependentsInCluster;
    territory.candidateNames = pool.candidateNames;
  }
  return {
    ok: true,
    query: { city, metro, outcode },
    radiusMiles,
    minPopulation,
    source: catalog.source,
    territories: territories.map(({ cluster: _cluster, ...row }) => row),
  };
}

export function territoryReportSummary(
  cluster: TerritoryCluster | null,
  metroSearchDemand?: number,
): {
  polygonLabel: string;
  onsPopulationLabel: string;
  clinicalDemand: number | null;
} | null {
  if (!cluster) return null;
  const polygon = cluster.polygonOutcodes.slice(0, 12);
  return {
    polygonLabel: polygon.join(", "),
    onsPopulationLabel: `~${cluster.primaryCatchmentPopulation.toLocaleString("en-GB")} residents`,
    clinicalDemand: metroSearchDemand != null ? localCatchmentDemand(metroSearchDemand) : null,
  };
}
