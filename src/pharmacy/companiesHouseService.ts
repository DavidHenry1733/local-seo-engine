/**
 * Companies House corporate-entity resolver for UK pharmacy trading names.
 * Trading names (Sefton Park Pharmacy) often differ from the registered owner
 * (Optichem (UK) Ltd). Never invent officers or company numbers.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const DISPENSING_CHEMIST_SIC = "47730";
const CH_API_ROOT = "https://api.company-information.service.gov.uk";
const STOP_WORDS = /\b(pharmacy|pharmacies|chemist|chemists|healthcare|health\s*care|clinic|the|ltd|limited|llp)\b/gi;

export type CompaniesHouseMatch = {
  ok: true;
  registeredCompanyName: string;
  companyNumber: string;
  companyStatus: string;
  sicCodes: string[];
  primaryDirectorName: string;
  directorNames: string[];
  registeredOffice: string;
  matchMethod: string;
};

type SearchHit = {
  company_number?: string;
  title?: string;
  company_status?: string;
  address_snippet?: string;
};

type NhsbsaOwnerRow = {
  tradingNames?: string[];
  postcodePrefixes?: string[];
  registeredOwner?: string;
  companyNumber?: string;
};

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function companiesHouseApiKey(): string {
  return String(process.env.COMPANIES_HOUSE_API_KEY || "").trim();
}

export function postcodeOutcode(postcode: string): string {
  const compact = clean(postcode).toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5) return compact;
  return compact.slice(0, compact.length - 3);
}

export function stripPharmacyStopwords(name: string): string {
  return clean(name.replace(STOP_WORDS, " ")).replace(/\s+/g, " ").trim();
}

function formatOfficerName(raw: string): string {
  const value = clean(raw);
  if (!value) return "";
  if (value.includes(",")) {
    const [surname, rest] = value.split(",").map((part) => clean(part));
    return [rest, surname].filter(Boolean).join(" ");
  }
  return value.replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function authHeader(): string {
  const key = companiesHouseApiKey();
  if (!key) throw new Error("COMPANIES_HOUSE_API_KEY is not configured");
  return `Basic ${Buffer.from(`${key}:`, "utf8").toString("base64")}`;
}

async function chGet<T>(pathname: string, query?: Record<string, string>): Promise<T | null> {
  if (!companiesHouseApiKey()) return null;
  const url = new URL(pathname, CH_API_ROOT);
  for (const [key, value] of Object.entries(query || {})) {
    if (value) url.searchParams.set(key, value);
  }
  const res = await fetch(url, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Companies House ${pathname} failed: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function loadNhsbsaOwners(): NhsbsaOwnerRow[] {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data", "nhsbsa-pharmacy-owners.json");
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { owners?: NhsbsaOwnerRow[] };
    return Array.isArray(parsed.owners) ? parsed.owners : [];
  } catch {
    return [];
  }
}

export function lookupNhsbsaRegisteredOwner(
  pharmacyName: string,
  postcode: string,
): { registeredOwner: string; companyNumber: string } | null {
  const name = clean(pharmacyName).toLowerCase();
  const outcode = postcodeOutcode(postcode);
  for (const row of loadNhsbsaOwners()) {
    const names = (row.tradingNames || []).map((item) => clean(item).toLowerCase());
    const prefixes = (row.postcodePrefixes || []).map((item) => clean(item).toUpperCase());
    const nameHit = names.includes(name);
    const postcodeHit = !prefixes.length || prefixes.includes(outcode);
    if (nameHit && postcodeHit && row.companyNumber && row.registeredOwner) {
      return { registeredOwner: row.registeredOwner, companyNumber: clean(row.companyNumber) };
    }
  }
  return null;
}

function addressBlob(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .filter((item) => typeof item === "string")
      .join(" ");
  }
  return "";
}

async function getCompany(companyNumber: string): Promise<{
  company_name?: string;
  company_number?: string;
  company_status?: string;
  sic_codes?: string[];
  registered_office_address?: Record<string, string>;
} | null> {
  return chGet(`/company/${encodeURIComponent(companyNumber)}`);
}

async function getActiveDirectors(companyNumber: string): Promise<string[]> {
  const payload = await chGet<{ items?: Array<{ name?: string; officer_role?: string; resigned_on?: string; appointed_on?: string }> }>(
    `/company/${encodeURIComponent(companyNumber)}/officers`,
  );
  const rows = (payload?.items || [])
    .filter((row) => String(row.officer_role || "").toLowerCase() === "director" && !row.resigned_on)
    .sort((a, b) => String(a.appointed_on || "").localeCompare(String(b.appointed_on || "")));
  return rows.map((row) => formatOfficerName(row.name || "")).filter(Boolean);
}

async function searchCompanies(query: string): Promise<SearchHit[]> {
  const q = clean(query);
  if (!q) return [];
  const payload = await chGet<{ items?: SearchHit[] }>("/search/companies", { q, items_per_page: "20" });
  return payload?.items || [];
}

async function advancedChemistSearch(location: string): Promise<SearchHit[]> {
  const payload = await chGet<{ items?: SearchHit[] }>("/advanced-search/companies", {
    sic_codes: DISPENSING_CHEMIST_SIC,
    location: clean(location),
    company_status: "active",
    size: "20",
  });
  return payload?.items || [];
}

function scoreHit(
  hit: SearchHit,
  input: { name: string; root: string; outcode: string; town: string; sicCodes?: string[] },
): number {
  const title = clean(hit.title).toLowerCase();
  const address = clean(hit.address_snippet).toLowerCase();
  const status = clean(hit.company_status).toLowerCase();
  let score = 0;
  if (status === "active") score += 25;
  else score -= 20;
  if ((input.sicCodes || []).includes(DISPENSING_CHEMIST_SIC)) score += 50;
  if (input.outcode && address.includes(input.outcode.toLowerCase())) score += 35;
  if (input.town && address.includes(input.town.toLowerCase())) score += 15;
  if (input.root && title.includes(input.root.toLowerCase())) score += 20;
  if (input.name && title.includes(input.name.toLowerCase())) score += 10;
  if (/\b(optichem|pharmacy|chemist|healthcare)\b/i.test(title)) score += 8;
  return score;
}

async function packCompany(companyNumber: string, matchMethod: string): Promise<CompaniesHouseMatch | null> {
  const company = await getCompany(companyNumber);
  if (!company?.company_name || !company.company_number) return null;
  const directors = await getActiveDirectors(company.company_number);
  const office = addressBlob(company.registered_office_address);
  return {
    ok: true,
    registeredCompanyName: company.company_name,
    companyNumber: company.company_number,
    companyStatus: String(company.company_status || ""),
    sicCodes: Array.isArray(company.sic_codes) ? company.sic_codes.map(String) : [],
    primaryDirectorName: directors[0] || "",
    directorNames: directors,
    registeredOffice: office,
    matchMethod,
  };
}

async function pickFromHits(
  hits: SearchHit[],
  input: { name: string; root: string; outcode: string; town: string },
  method: string,
): Promise<CompaniesHouseMatch | null> {
  const ranked: Array<{ hit: SearchHit; score: number; sicCodes: string[] }> = [];
  for (const hit of hits.slice(0, 8)) {
    const number = clean(hit.company_number);
    if (!number) continue;
    const company = await getCompany(number);
    const sicCodes = Array.isArray(company?.sic_codes) ? company!.sic_codes.map(String) : [];
    ranked.push({
      hit,
      sicCodes,
      score: scoreHit({ ...hit, title: hit.title || company?.company_name }, { ...input, sicCodes }),
    });
  }
  ranked.sort((a, b) => b.score - a.score);
  const best = ranked.find((row) => row.score >= 40) || ranked[0];
  if (!best?.hit.company_number || best.score < 30) return null;
  const address = clean(best.hit.address_snippet).toLowerCase();
  const sicOk = best.sicCodes.includes(DISPENSING_CHEMIST_SIC);
  const postcodeOk = Boolean(input.outcode && address.includes(input.outcode.toLowerCase()));
  if (!sicOk && !postcodeOk && best.score < 70) return null;
  if (clean(best.hit.company_status).toLowerCase() !== "active") {
    const stem = stripPharmacyStopwords(best.hit.title || "");
    if (stem) {
      const related = await searchCompanies(stem);
      const activeRelated = related.find((row) => clean(row.company_status).toLowerCase() === "active");
      if (activeRelated?.company_number) {
        const packed = await packCompany(activeRelated.company_number, `${method}->related-active`);
        if (packed && (packed.sicCodes.includes(DISPENSING_CHEMIST_SIC) || packed.companyStatus === "active")) {
          return packed;
        }
      }
    }
  }
  return packCompany(best.hit.company_number, method);
}

export const MULTIPLE_PHARMACY_RE =
  /\b(boots|lloyds|lloydspharmacy|well|wellcare|superdrug|tesco|asda|morrisons|sainsbury'?s?|rowlands|day[- ]lewis|cohens|pharmacy2u|numark)\b/i;

export function isMultiplePharmacyName(name: string): boolean {
  return MULTIPLE_PHARMACY_RE.test(clean(name));
}

export async function searchIndependentChemistsByOutcode(
  outcode: string,
  limit = 6,
): Promise<CompaniesHouseMatch[]> {
  const location = clean(outcode).toUpperCase();
  if (!location) return [];
  const hits = await advancedChemistSearch(location);
  const packed: CompaniesHouseMatch[] = [];
  const seen = new Set<string>();
  for (const hit of hits.slice(0, 12)) {
    const number = clean(hit.company_number);
    if (!number || seen.has(number)) continue;
    if (isMultiplePharmacyName(hit.title || "")) continue;
    const company = await packCompany(number, `sic-47730-${location}`);
    if (!company || company.companyStatus.toLowerCase() !== "active") continue;
    if (!company.sicCodes.includes(DISPENSING_CHEMIST_SIC) && !/pharmacy|chemist/i.test(company.registeredCompanyName)) {
      continue;
    }
    seen.add(number);
    packed.push(company);
    if (packed.length >= limit) break;
  }
  return packed;
}

export async function resolvePharmacyCompaniesHouse(input: {
  pharmacyName: string;
  postcode: string;
  townCity?: string;
}): Promise<CompaniesHouseMatch | null> {
  const pharmacyName = clean(input.pharmacyName);
  const postcode = clean(input.postcode);
  const townCity = clean(input.townCity);
  const root = stripPharmacyStopwords(pharmacyName);
  const outcode = postcodeOutcode(postcode);
  const ctx = { name: pharmacyName, root, outcode, town: townCity };

  try {
    const mapped = lookupNhsbsaRegisteredOwner(pharmacyName, postcode);
    if (mapped?.companyNumber) {
      const packed = await packCompany(mapped.companyNumber, "nhsbsa-owner-map");
      if (packed) return packed;
    }

    const safeSearch = async (run: () => Promise<SearchHit[]>): Promise<SearchHit[]> => {
      try {
        return await run();
      } catch (err) {
        console.warn("[Companies House] search skipped:", err instanceof Error ? err.message : err);
        return [];
      }
    };
    const [trading, rootOutcode, sicOutcode, sicTown, byPostcode] = await Promise.all([
      safeSearch(() => searchCompanies(pharmacyName)),
      safeSearch(() => searchCompanies([root, outcode].filter(Boolean).join(" "))),
      outcode ? safeSearch(() => advancedChemistSearch(outcode)) : Promise.resolve([]),
      townCity ? safeSearch(() => advancedChemistSearch(townCity)) : Promise.resolve([]),
      postcode ? safeSearch(() => searchCompanies(postcode)) : Promise.resolve([]),
    ]);
    const attempts: Array<{ query: SearchHit[]; method: string }> = [
      { query: trading, method: "trading-name" },
      { query: rootOutcode, method: "root-outcode" },
      { query: sicOutcode, method: "sic-47730-outcode" },
      { query: sicTown, method: "sic-47730-town" },
      { query: byPostcode, method: "postcode" },
    ];
    for (const attempt of attempts) {
      const packed = await pickFromHits(attempt.query, ctx, attempt.method);
      if (packed) return packed;
    }
  } catch (err) {
    console.warn("[Companies House] resolve failed:", err instanceof Error ? err.message : err);
    return null;
  }
  return null;
}
