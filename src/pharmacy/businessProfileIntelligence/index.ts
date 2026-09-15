/**
 * Business Profile Intelligence V2 — Phase 1 public exports.
 *
 * Architecture-only module. Generators must not import this until Phase 2 wiring.
 */
export {
  BUSINESS_PROFILE_INTELLIGENCE_VERSION,
  type AiIntelligence,
  type BrandIdentityIntelligence,
  type BusinessIdentityIntelligence,
  type BusinessProfileIntelligence,
  type BusinessProfileIntelligenceProvenance,
  type ContentIntelligence,
  type ContentIntelligenceContext,
  type ConversionIntelligence,
  type LocationIntelligence,
  type PatientIntelligence,
  type ServiceDeliveryIntelligence,
  type ServiceIntelligence,
  type TeamIntelligence,
  type TrustIntelligence,
} from "./businessProfileIntelligenceTypes.ts";

export {
  defaultAiIntelligence,
  defaultBrandIdentityIntelligence,
  defaultBusinessIdentityIntelligence,
  defaultBusinessProfileIntelligence,
  defaultContentIntelligence,
  defaultConversionIntelligence,
  defaultLocationIntelligence,
  defaultPatientIntelligence,
  defaultServiceIntelligence,
  defaultTeamIntelligence,
  defaultTrustIntelligence,
} from "./businessProfileIntelligenceDefaults.ts";

export {
  buildBusinessProfileIntelligenceFromDoc,
  buildBusinessProfileIntelligenceFromProfile,
  toContentIntelligenceContext,
} from "./buildBusinessProfileIntelligence.ts";
