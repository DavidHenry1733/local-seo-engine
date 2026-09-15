/**
 * Canonical DataForSEO Google SERP location resolution.
 * Maps a national subject's country to DataForSEO location_code.
 * Does not call the DataForSEO locations API.
 * Does not use commercial market labels, towns, or office locality.
 *
 * DataForSEO country location_code = 2000 + ISO 3166-1 numeric.
 */
import type { NationalIntelligenceSubject } from "./nationalIntelligenceSubjectResolver.ts";

export const DATAFORSEO_COUNTRY_LOCATION_OFFSET = 2000;

export interface DataForSeoSearchLocation {
  country: string;
  iso2: string;
  isoNumeric: number;
  locationCode: number;
  source: "iso3166-numeric-offset";
}

/** ISO 3166-1 alpha-2 → numeric. */
const ISO2_NUMERIC: Record<string, number> = {
  gb: 826,
  ie: 372,
  us: 840,
  au: 36,
  ca: 124,
  nz: 554,
  de: 276,
  fr: 250,
  es: 724,
  it: 380,
  nl: 528,
  be: 56,
  at: 40,
  ch: 756,
  se: 752,
  no: 578,
  dk: 208,
  fi: 246,
  pt: 620,
  pl: 616,
  in: 356,
  sg: 702,
  za: 710,
  ae: 784,
  hk: 344,
  jp: 392,
};

const NAME_TO_ISO2: Record<string, string> = {
  "united kingdom": "gb",
  "great britain": "gb",
  britain: "gb",
  uk: "gb",
  gb: "gb",
  gbr: "gb",
  england: "gb",
  scotland: "gb",
  wales: "gb",
  "northern ireland": "gb",
  ireland: "ie",
  "republic of ireland": "ie",
  eire: "ie",
  ie: "ie",
  irl: "ie",
  "united states": "us",
  "united states of america": "us",
  usa: "us",
  us: "us",
  australia: "au",
  au: "au",
  aus: "au",
  canada: "ca",
  ca: "ca",
  can: "ca",
  "new zealand": "nz",
  nz: "nz",
  nzl: "nz",
  germany: "de",
  de: "de",
  deu: "de",
  france: "fr",
  fr: "fr",
  fra: "fr",
  spain: "es",
  es: "es",
  esp: "es",
  italy: "it",
  it: "it",
  ita: "it",
  netherlands: "nl",
  holland: "nl",
  nl: "nl",
  nld: "nl",
  belgium: "be",
  be: "be",
  bel: "be",
  austria: "at",
  at: "at",
  aut: "at",
  switzerland: "ch",
  ch: "ch",
  che: "ch",
  sweden: "se",
  se: "se",
  swe: "se",
  norway: "no",
  no: "no",
  nor: "no",
  denmark: "dk",
  dk: "dk",
  dnk: "dk",
  finland: "fi",
  fi: "fi",
  fin: "fi",
  portugal: "pt",
  pt: "pt",
  prt: "pt",
  poland: "pl",
  pl: "pl",
  pol: "pl",
  india: "in",
  in: "in",
  ind: "in",
  singapore: "sg",
  sg: "sg",
  sgp: "sg",
  "south africa": "za",
  za: "za",
  zaf: "za",
  "united arab emirates": "ae",
  uae: "ae",
  ae: "ae",
  are: "ae",
  "hong kong": "hk",
  hk: "hk",
  hkg: "hk",
  japan: "jp",
  jp: "jp",
  jpn: "jp",
};

function normaliseCountryToken(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ");
}

export function dataForSeoLocationCodeFromIsoNumeric(isoNumeric: number): number {
  return DATAFORSEO_COUNTRY_LOCATION_OFFSET + isoNumeric;
}

export function resolveDataForSeoSearchLocation(country: unknown): DataForSeoSearchLocation {
  const token = normaliseCountryToken(country);
  if (!token) {
    throw new Error("DataForSEO search location requires a country.");
  }
  const iso2 = NAME_TO_ISO2[token];
  const isoNumeric = iso2 ? ISO2_NUMERIC[iso2] : undefined;
  if (!iso2 || !isoNumeric) {
    throw new Error(`No canonical DataForSEO location_code for country "${String(country || "").trim()}".`);
  }
  return {
    country: String(country || "").trim() || token,
    iso2,
    isoNumeric,
    locationCode: dataForSeoLocationCodeFromIsoNumeric(isoNumeric),
    source: "iso3166-numeric-offset",
  };
}

export function resolveDataForSeoSearchLocationFromSubject(
  subject: Pick<NationalIntelligenceSubject, "country">,
): DataForSeoSearchLocation {
  return resolveDataForSeoSearchLocation(subject.country);
}
