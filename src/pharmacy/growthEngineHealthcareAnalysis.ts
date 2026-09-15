/**
 * Growth Engine — Local Healthcare Intelligence V1 analysis & ecosystem grouping.
 */
import type { GrowthEngineCompetitor, GrowthEngineYourPharmacy } from "./growthEngineCompetitorModel.ts";
import { classifyCompetitors, countCompetitorOwnership } from "./growthEngineCompetitorOwnership.ts";
import { realGoogleCompetitors } from "./growthEngineLocalMarketAnalysis.ts";
import { realHealthcareProviders } from "./growthEngineHealthcareDiscovery.ts";
import type {
  HealthcareAnalysisSnapshot,
  HealthcareDisplayGroupKey,
  HealthcareEcosystemGroup,
  HealthcareProviderEntity,
  HealthcareProviderGroupKey,
} from "./growthEngineHealthcareModel.ts";
import { HEALTHCARE_DISPLAY_GROUP_LABELS } from "./growthEngineHealthcareModel.ts";

const SERVICE_GROUP_KEYS: HealthcareProviderGroupKey[] = [
  "dentists",
  "opticians",
  "physiotherapists",
  "podiatrists",
  "mentalHealthServices",
  "communityClinics",
  "urgentTreatmentCentres",
];

function nearest(providers: HealthcareProviderEntity[]): HealthcareProviderEntity | null {
  const sorted = [...providers].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  return sorted[0] || null;
}

function providersForDisplayGroup(
  groupId: HealthcareDisplayGroupKey,
  providers: HealthcareProviderEntity[],
): HealthcareProviderEntity[] {
  switch (groupId) {
    case "gpSurgeries":
      return providers.filter((p) => p.groupKey === "gpSurgeries");
    case "healthCentres":
      return providers.filter((p) => p.groupKey === "healthCentres" || p.groupKey === "walkInCentres");
    case "hospitals":
      return providers.filter((p) => p.groupKey === "hospitals");
    case "careHomes":
      return providers.filter((p) => p.groupKey === "careHomes");
    case "healthcareServices":
      return providers.filter((p) => SERVICE_GROUP_KEYS.includes(p.groupKey));
    default:
      return [];
  }
}

export function buildHealthcareEcosystemGroups(
  providers: HealthcareProviderEntity[],
  competitors: GrowthEngineCompetitor[],
): HealthcareEcosystemGroup[] {
  const liveProviders = realHealthcareProviders(providers);
  const liveCompetitors = realGoogleCompetitors(competitors);

  const displayGroups: HealthcareDisplayGroupKey[] = [
    "gpSurgeries",
    "healthCentres",
    "hospitals",
    "careHomes",
    "otherPharmacies",
    "healthcareServices",
  ];

  return displayGroups.map((id) => {
    if (id === "otherPharmacies") {
      const mapped: HealthcareProviderEntity[] = liveCompetitors.map((c) => ({
        placeId: c.placeId,
        businessName: c.businessName,
        category: c.primaryCategory || "Pharmacy",
        groupKey: "communityClinics" as HealthcareProviderGroupKey,
        distanceKm: c.distanceKm,
        distanceLabel: c.distanceLabel,
        address: c.address,
        rating: c.rating,
        reviewCount: c.reviewCount,
        phone: c.phone,
        website: c.website,
        openingStatus: c.openingStatus,
        googleMapsUrl: c.googleMapsUrl,
        latitude: c.latitude,
        longitude: c.longitude,
        source: "google-places" as const,
      }));
      return {
        id,
        label: HEALTHCARE_DISPLAY_GROUP_LABELS[id],
        count: mapped.length,
        nearest: nearest(mapped),
        providers: mapped,
      };
    }

    const groupProviders = providersForDisplayGroup(id, liveProviders);
    return {
      id,
      label: HEALTHCARE_DISPLAY_GROUP_LABELS[id],
      count: groupProviders.length,
      nearest: nearest(groupProviders),
      providers: groupProviders,
    };
  });
}

function fmtMiles(km: number | null): string {
  if (km == null) return "";
  const miles = km * 0.621371;
  if (miles < 0.5) return `${Math.round(km * 1000)} metres`;
  return `${miles.toFixed(1)} miles`;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function buildHealthcareSummary(
  providers: HealthcareProviderEntity[],
  competitors: GrowthEngineCompetitor[],
  yours: GrowthEngineYourPharmacy | null,
): string[] {
  const liveProviders = realHealthcareProviders(providers);
  const liveCompetitors = realGoogleCompetitors(competitors);
  if (!liveProviders.length && !liveCompetitors.length) {
    return [
      "No live Google Places healthcare data is available yet. Run discovery when your Google Places API key is configured and your pharmacy location is set.",
    ];
  }

  const paragraphs: string[] = [];
  const groups = buildHealthcareEcosystemGroups(liveProviders, competitors);

  const gpCount = groups.find((g) => g.id === "gpSurgeries")?.count || 0;
  if (gpCount > 0) {
    paragraphs.push(`We identified ${gpCount} GP surger${gpCount === 1 ? "y" : "ies"} within your service area.`);
  }

  const hospitalGroup = groups.find((g) => g.id === "hospitals");
  if (hospitalGroup && hospitalGroup.count > 0) {
    const nearestHospital = hospitalGroup.nearest;
    if (nearestHospital?.distanceKm != null) {
      paragraphs.push(
        `${hospitalGroup.count} hospital${hospitalGroup.count === 1 ? "" : "s"} ${hospitalGroup.count === 1 ? "is" : "are"} located within ${fmtMiles(nearestHospital.distanceKm)} of your pharmacy.`,
      );
    } else {
      paragraphs.push(`We identified ${hospitalGroup.count} hospital${hospitalGroup.count === 1 ? "" : "s"} nearby.`);
    }
  }

  if (liveCompetitors.length > 0) {
    paragraphs.push(
      `${liveCompetitors.length} competing pharmac${liveCompetitors.length === 1 ? "y was" : "ies were"} identified from Google Places.`,
    );
  }

  const ratedProviders = liveProviders.filter((p) => p.rating != null);
  const ratingAvg = avg(ratedProviders.map((p) => p.rating!));
  if (ratingAvg != null && ratedProviders.length >= 3) {
    if (ratingAvg >= 4.5) {
      paragraphs.push(`Most nearby healthcare organisations have Google ratings above 4.5 (average ${ratingAvg.toFixed(1)}).`);
    } else {
      paragraphs.push(`Nearby healthcare organisations average ${ratingAvg.toFixed(1)} on Google (${ratedProviders.length} with ratings).`);
    }
  }

  const healthCentreCount = groups.find((g) => g.id === "healthCentres")?.count || 0;
  if (healthCentreCount > 0) {
    paragraphs.push(`${healthCentreCount} health centre${healthCentreCount === 1 ? "" : "s"} or walk-in centre${healthCentreCount === 1 ? "" : "s"} were found nearby.`);
  }

  const careHomeCount = groups.find((g) => g.id === "careHomes")?.count || 0;
  if (careHomeCount > 0) {
    paragraphs.push(`${careHomeCount} care home${careHomeCount === 1 ? "" : "s"} were identified in your local area.`);
  }

  if (yours?.address) {
    paragraphs.push(`Your pharmacy is located at ${yours.address}.`);
  }

  return paragraphs.slice(0, 6);
}

export function buildHealthcareOpportunities(
  providers: HealthcareProviderEntity[],
  competitors: GrowthEngineCompetitor[],
): string[] {
  const liveProviders = realHealthcareProviders(providers);
  const liveCompetitors = realGoogleCompetitors(competitors);
  const opportunities: string[] = [];
  if (!liveProviders.length && !liveCompetitors.length) return opportunities;

  const groups = buildHealthcareEcosystemGroups(liveProviders, competitors);
  const gpCount = groups.find((g) => g.id === "gpSurgeries")?.count || 0;
  const hospitalCount = groups.find((g) => g.id === "hospitals")?.count || 0;
  const healthCentreCount = groups.find((g) => g.id === "healthCentres")?.count || 0;
  const serviceCount = groups.find((g) => g.id === "healthcareServices")?.count || 0;
  const competitorCount = liveCompetitors.length;

  const healthcareDensity = gpCount + hospitalCount + healthCentreCount + serviceCount;

  if (healthcareDensity >= 15) {
    opportunities.push("Strong local healthcare presence — your pharmacy sits within a dense healthcare network.");
  }

  if (hospitalCount >= 2 || (hospitalCount >= 1 && gpCount >= 5)) {
    opportunities.push("Large healthcare network nearby — multiple NHS and community providers surround your location.");
  }

  if (competitorCount > 0 && competitorCount <= 4) {
    opportunities.push("Limited competing pharmacies — fewer nearby pharmacy competitors than typical urban areas.");
  }

  if (competitorCount >= 8) {
    opportunities.push("Highly competitive area — many pharmacies operate within your immediate catchment.");
  }

  const classified = classifyCompetitors(liveCompetitors);
  const ownership = countCompetitorOwnership(classified);
  if (ownership.national >= 2 && ownership.independent >= 2) {
    opportunities.push("Mixed pharmacy market — both national chains and independent pharmacies compete locally.");
  }

  if (gpCount >= 6 && competitorCount <= 6) {
    opportunities.push("GP surgery density exceeds competing pharmacy count — potential referral and partnership opportunities nearby.");
  }

  return opportunities.slice(0, 5);
}

export function buildHealthcareAnalysis(
  providers: HealthcareProviderEntity[],
  competitors: GrowthEngineCompetitor[],
  yours: GrowthEngineYourPharmacy | null,
  dataSource: "google-places-live" | "demo-fallback" | "demo-no-google-key",
): HealthcareAnalysisSnapshot {
  const liveProviders = realHealthcareProviders(providers);
  const liveCompetitors = realGoogleCompetitors(competitors);
  const live = dataSource === "google-places-live" && (liveProviders.length > 0 || liveCompetitors.length > 0);
  const classified = classifyCompetitors(liveCompetitors);

  return {
    dataSource: live ? "google-places-live" : "unavailable",
    providerCount: liveProviders.length,
    summaryParagraphs: live
      ? buildHealthcareSummary(liveProviders, competitors, yours)
      : [
          "Live Google Places data is required for local healthcare intelligence.",
          "Configure GOOGLE_PLACES_API_KEY and run Discover to load real healthcare provider data.",
        ],
    opportunities: live ? buildHealthcareOpportunities(liveProviders, competitors) : [],
    ecosystemGroups: live ? buildHealthcareEcosystemGroups(liveProviders, competitors) : [],
    competitorGroups: live ? countCompetitorOwnership(classified) : { independent: 0, regional: 0, national: 0, unknown: 0 },
  };
}
