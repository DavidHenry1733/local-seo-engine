/**
 * Growth Platform Contract V1
 *
 * The platform contains two separate commercial intelligence engines:
 *
 * LOCAL
 * - location-led businesses
 * - local competitor discovery
 * - Google Places / GBP intelligence
 * - local market and geographic intelligence
 * - healthcare ecosystem intelligence where applicable
 *
 * NATIONAL
 * - national / non-local commercial markets
 * - national competitor discovery
 * - competitor website intelligence
 * - offer/service/content/search competition
 * - national commercial opportunity modelling
 *
 * IMPORTANT:
 * Physical locality must never be used to convert a NATIONAL tenant
 * into a LOCAL tenant.
 *
 * Platform selection is explicit. It must not be inferred from keywords,
 * service names, business descriptions, or physical office location.
 */

export type GrowthPlatform = "local" | "national";

export interface GrowthPlatformContract {
  platform: GrowthPlatform;
  explicit: boolean;

  localEngineApplicable: boolean;
  nationalEngineApplicable: boolean;

  googlePlacesCompetitorDiscoveryApplicable: boolean;
  localMarketIntelligenceApplicable: boolean;
  healthcareIntelligenceApplicable: boolean;

  nationalCompetitorDiscoveryApplicable: boolean;
  nationalWebsiteIntelligenceApplicable: boolean;
  nationalSearchIntelligenceApplicable: boolean;

  evidence: string[];
}

export function buildGrowthPlatformContract(
  platform: GrowthPlatform,
): GrowthPlatformContract {
  if (platform === "national") {
    return {
      platform: "national",
      explicit: true,

      localEngineApplicable: false,
      nationalEngineApplicable: true,

      googlePlacesCompetitorDiscoveryApplicable: false,
      localMarketIntelligenceApplicable: false,
      healthcareIntelligenceApplicable: false,

      nationalCompetitorDiscoveryApplicable: true,
      nationalWebsiteIntelligenceApplicable: true,
      nationalSearchIntelligenceApplicable: true,

      evidence: [
        "Growth platform explicitly configured as NATIONAL.",
        "Physical office locality does not define the commercial competitor market.",
        "Local Google Places competitor discovery is not applicable.",
        "Local healthcare ecosystem intelligence is not applicable.",
        "National competitor, website and search intelligence are applicable.",
      ],
    };
  }

  return {
    platform: "local",
    explicit: true,

    localEngineApplicable: true,
    nationalEngineApplicable: false,

    googlePlacesCompetitorDiscoveryApplicable: true,
    localMarketIntelligenceApplicable: true,
    healthcareIntelligenceApplicable: true,

    nationalCompetitorDiscoveryApplicable: false,
    nationalWebsiteIntelligenceApplicable: false,
    nationalSearchIntelligenceApplicable: false,

    evidence: [
      "Growth platform explicitly configured as LOCAL.",
      "Verified locality may define the commercial competitor market.",
      "Local Google Places competitor discovery is applicable.",
      "Local market intelligence is applicable.",
    ],
  };
}
