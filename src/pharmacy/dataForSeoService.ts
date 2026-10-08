/**
 * DataForSEO Google Ads search-volume helpers.
 * City/metro geotargets (location_code) take priority over postcode strings.
 * Service keyword clusters are bundled, deduped, then posted as one city query.
 */
export {
  buildSearchVolumeLiveRequest,
  postGoogleAdsSearchVolumeLive,
  parseSearchVolumeLiveResponse,
} from "./dataForSeoKeywordsDataSearchVolumeAdapter.ts";
export {
  GOOGLE_ADS_UNITED_KINGDOM_LOCATION_CODE,
  UK_CITY_GOOGLE_ADS_LOCATION_CODES,
  canonicalizeMetroCity,
  resolveGoogleAdsSearchVolumeLocation,
} from "./dataForSeoGoogleAdsLocations.ts";
export {
  SERVICE_KEYWORD_CLUSTERS,
  bundleCitySearchKeywords,
  dedupeKeywordCluster,
  expandKeywordCluster,
  keywordClusterFor,
} from "./keywordCatalog.ts";
