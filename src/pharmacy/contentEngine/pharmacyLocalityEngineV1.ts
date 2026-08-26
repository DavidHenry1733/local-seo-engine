/**
 * Locality Engine V1 — shared locality intelligence surface.
 * Canonical providers: area resolver + market snapshot + locality packs + cluster intelligence.
 */
export {
  areaDiscoveryForName,
  providersForArea,
} from "../pharmacyLocalMarketSnapshot.ts";
export {
  phraseAreaTravelContext,
  phraseLocalGpNetwork,
  phraseLocalHealthcareFacility,
  phraseLocalMarketClusterIntro,
} from "./pharmacyLocalMarketIntelligencePhrases.ts";
export {
  applyClusterIntelligence,
  clusterHeroIntro,
  mergeClusterFaqs,
} from "../pharmacyLocalClusterIntelligence.ts";
export {
  hierarchyToContentGenerationAreas,
  resolveLocalLocationHierarchy,
} from "../pharmacyLocalAreaResolver.ts";
export {
  localitySentences,
  resolveLocalityIntelligencePack,
} from "./pharmacyLocalityIntelligencePackV1.ts";
export {
  allocateLocalityEvidenceV1,
} from "./pharmacyLocalityEvidenceAllocatorV1.ts";
export {
  bindVerifiedLocalityEvidenceV1,
} from "./pharmacyVerifiedLocalityEvidenceV1.ts";
export {
  resolvePatientFacingClusterHeading,
  resolvePatientFacingServiceHeading,
} from "./pharmacyCommercialPatientHeadingsV1.ts";
