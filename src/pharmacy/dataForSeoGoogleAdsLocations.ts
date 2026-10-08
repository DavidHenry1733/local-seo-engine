/**
 * Google Ads geotargets for DataForSEO keywords_data search_volume.
 * City codes avoid postcode-sector targeting and string-match misses
 * (e.g. Liverpool → 1006886).
 */
export const GOOGLE_ADS_UNITED_KINGDOM_LOCATION_CODE = 2826 as const;

export const UK_CITY_GOOGLE_ADS_LOCATION_CODES: Record<string, number> = {
  liverpool: 1006886,
  manchester: 1006885,
  leeds: 1006884,
  sheffield: 1006907,
  birmingham: 1006874,
  london: 1006880,
  bristol: 1006881,
  nottingham: 1006896,
  leicester: 1006887,
  newcastle: 1006894,
  "newcastle upon tyne": 1006894,
  bradford: 1006876,
  preston: 1006900,
  cardiff: 1006944,
  edinburgh: 1006934,
  glasgow: 1006936,
};

const METRO_ALIASES: Record<string, string> = {
  wavertree: "Liverpool",
  "sefton park": "Liverpool",
  "aigburth": "Liverpool",
  "toxteth": "Liverpool",
  "anfield": "Liverpool",
  "city of liverpool": "Liverpool",
};

export function canonicalizeMetroCity(locationName: string): string {
  const raw = String(locationName || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const stripped = raw
    .replace(/,?\s*(england|scotland|wales|united kingdom|uk)\s*/gi, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const alias = METRO_ALIASES[stripped.toLowerCase()];
  if (alias) return alias;
  return stripped.split(" ")[0] ? stripped : raw;
}

export function resolveGoogleAdsSearchVolumeLocation(locationName: string): {
  city: string;
  locationCode?: number;
  locationName: string;
} {
  const city = canonicalizeMetroCity(locationName) || "United Kingdom";
  if (/united kingdom|^uk$/i.test(city)) {
    return { city: "United Kingdom", locationCode: GOOGLE_ADS_UNITED_KINGDOM_LOCATION_CODE, locationName: "United Kingdom" };
  }
  const code = UK_CITY_GOOGLE_ADS_LOCATION_CODES[city.toLowerCase()];
  const formatted = /united kingdom/i.test(city) ? city : `${city},England,United Kingdom`;
  if (code) return { city, locationCode: code, locationName: formatted };
  return { city, locationName: formatted };
}
